import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { CraftData } from "./craft-data.js";
import { TravellerActorSheet } from "./character-sheet.js";

const PARTS_PATH = "systems/mgt2/templates/actors";

/** Cell keys that phrase themselves as a signed DM and nothing else. */
const DM_KEYS = ["sensorDM", "controlDM", "jumpDM"];

/**
 * The spacecraft sheet — the type `DOCUMENT-TYPES.md` calls the hard one, because it is the single
 * screen that needs all four layout blocks at once: a statline header, three budgets with live
 * totals, two rosters of linked actors, and a code row.
 *
 * Every block comes from `_blocks.sass` unchanged. What this file adds is the mount table and the
 * finance panel, and nothing else.
 *
 * @extends {TravellerActorSheet}
 */
export class SpacecraftActorSheet extends TravellerActorSheet {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["spacecraft"],
        position: { width: 1120, height: 860 },
        actions: {
            criticalSet: SpacecraftActorSheet.#onCriticalSet,
            criticalRoll: SpacecraftActorSheet.#onCriticalRoll,
            criticalClear: SpacecraftActorSheet.#onCriticalClear,
            powerToggle: SpacecraftActorSheet.#onPowerToggle,
            hullOptionToggle: SpacecraftActorSheet.#onHullOptionToggle,
            rowCreate: SpacecraftActorSheet.#onRowCreate,
            rowDelete: SpacecraftActorSheet.#onRowDelete,
            stationAction: SpacecraftActorSheet.#onStationAction,
            openCraft: SpacecraftActorSheet.#onOpenCraft
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/spacecraft/header.html` },
        rail: {
            template: `${PARTS_PATH}/spacecraft/rail.html`,
            templates: [`${PARTS_PATH}/spacecraft/budget.html`],
            scrollable: [""]
        },
        panel: {
            template: `${PARTS_PATH}/spacecraft/panel.html`,
            templates: [`${PARTS_PATH}/parts/row-controls.html`,
                `${PARTS_PATH}/spacecraft/budget.html`],
            scrollable: [""]
        }
    };

    /** One rail and one panel, no tab strip. */
    static TABS = {};

    /**
     * The parent maps document paths onto the *character* sheet's parts, and this sheet has three of
     * its own, so a document-driven render redraws all of them instead.
     * @inheritDoc
     */
    _configureRenderOptions(options) {
        super._configureRenderOptions(options);
        if (options.renderContext && !options.isFirstRender) {
            options.parts = Object.keys(this.constructor.PARTS);
        }
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const system = this.actor.system;

        context.choices = {
            configurations: MGT2.HullConfigurations,
            hullOptions: MGT2.HullOptions,
            materials: MGT2.ArmourMaterials,
            bridges: MGT2.BridgeTypes,
            sensors: MGT2.SensorGrades,
            mountTypes: MGT2.ShipMounts,
            duties: MGT2.CombatDuties,
            bays: MGT2.CraftBays,
            service: MGT2.ShipService,
            screens: MGT2.ShipScreens,
            scales: MGT2.Scales
        };

        context.ship = {
            hull: SpacecraftActorSheet.#hull(system),
            tonnage: SpacecraftActorSheet.#tonnage(system),
            power: SpacecraftActorSheet.#power(system),
            hardpoints: SpacecraftActorSheet.#hardpoints(system),
            computer: SpacecraftActorSheet.#computer(system),
            options: SpacecraftActorSheet.#hullOptions(system),
            accommodation: SpacecraftActorSheet.#accommodation(system),
            mounts: this.#mounts(system, context.weapons),
            crew: this.#crew(system),
            bays: this.#bays(system),
            criticals: this.#criticals(system),
            finance: SpacecraftActorSheet.#finance(system)
        };
        return context;
    }

    /* -------------------------------------------- */
    /*  Blocks                                      */
    /* -------------------------------------------- */

    /**
     * One budget panel: the total, the bar and the over-state are computed here and never authored,
     * which is the block's own contract.
     * @param {number} cap
     * @param {Array<{key: string, value: number, why?: string, powered?: boolean}>} rows
     */
    static #budget(cap, rows) {
        const total = rows.reduce((sum, row) => sum + ((row.powered === false) ? 0 : row.value), 0);
        const over = total > cap;
        const fill = cap > 0 ? Math.min(100, (total / cap) * 100) : 0;
        const round = value => Math.round(value * 100) / 100;
        return {
            rows: rows.map(row => ({ ...row, value: round(row.value) })),
            total: round(total), cap: round(cap), over,
            // The cap tick sits where the fill stops, so an overrun reads as an overrun.
            fill: Math.round(fill * 10) / 10,
            mark: over ? 100 : Math.round(fill * 10) / 10,
            remaining: round(Math.abs(cap - total))
        };
    }

    /** The pool. A hull only ever fills — there is no state under wrecked (Core p.169). */
    static #hull(system) {
        const hull = system.characteristics.hull;
        return {
            value: hull.value, max: hull.max, damage: hull.damage,
            wound: (hull.max > 0) ? Math.min(100, Math.round((hull.damage / hull.max) * 100)) : 0,
            wrecked: system.states.wrecked,
            crossed: system.sustainedCrossed,
            steps: system.sustainedSteps,
            severity: system.hullSeverity
        };
    }

    static #tonnage(system) {
        return SpacecraftActorSheet.#budget(system.hull.tons,
            system.budget.rows.map(row => ({ key: row.key, value: row.tons })));
    }

    /**
     * The one budget with a state: a consumer taken offline is an Engineer's action and it frees its
     * draw (Core p.172), which is why power is a panel rather than a number.
     */
    static #power(system) {
        const budget = SpacecraftActorSheet.#budget(system.power.available,
            system.power.rows.map(row => ({ key: row.key, value: row.draw, powered: row.powered })));
        budget.surplus = system.power.surplus;
        budget.plant = system.power.plant;
        // A critical that cut the plant's output is why `available` and `plant` can differ.
        budget.damaged = system.power.available < system.power.plant;
        return budget;
    }

    static #hardpoints(system) {
        const rows = system.mounts.map((mount, index) => ({
            key: String(index + 1),
            label: mount.label || game.i18n.format("MGT2.Actor.spacecraft.MountN", { n: index + 1 }),
            why: MGT2.ShipMounts[mount.type]?.label ?? "",
            value: MGT2.ShipMounts[mount.type]?.hardpoints ?? 1
        }));
        const budget = SpacecraftActorSheet.#budget(system.hardpoints.max, rows);
        budget.firmpoints = system.firmpoints.max;
        budget.airlocks = system.airlocks;
        return budget;
    }

    static #computer(system) {
        const budget = SpacecraftActorSheet.#budget(system.computer.processing,
            system.computer.software.map(row => ({ key: row._id, label: row.name, value: row.bandwidth })));
        budget.overload = system.computer.overload;
        return budget;
    }

    /** Hull options are options, not traits: the registry has no ship family (§1.4). */
    static #hullOptions(system) {
        return Object.entries(MGT2.HullOptions).map(([key, option]) => ({
            key, label: option.label, on: system.hull.options.has(key)
        }));
    }

    /** Berths and passengers as one list: three consumers read them and none of them is a pool. */
    static #accommodation(system) {
        const rows = [];
        for (const [key, room] of Object.entries(MGT2.Staterooms)) {
            rows.push({ path: `staterooms.${key}`, label: room.label, value: system.staterooms[key] });
        }
        for (const [key, berth] of Object.entries(MGT2.LowBerths)) {
            rows.push({ path: `lowBerths.${key}`, label: berth.label, value: system.lowBerths[key] });
        }
        for (const [key, label] of Object.entries(MGT2.PassageClasses)) {
            rows.push({ path: `passengers.${key}`, label, value: system.passengers[key] });
        }
        return rows;
    }

    /* -------------------------------------------- */

    /** Each mount with the weapons it holds, its damage multiple, and the ones no mount claimed. */
    #mounts(system, weapons) {
        const byId = new Map(weapons.map(weapon => [weapon._id, weapon]));
        const claimed = new Set();
        const rows = system.mounts.map((mount, index) => {
            const type = MGT2.ShipMounts[mount.type] ?? MGT2.ShipMounts.fixed;
            const held = [];
            let ammo = 0;
            for (const id of mount.weapons) {
                const weapon = byId.get(id);
                if (!weapon) continue;
                claimed.add(id);
                held.push(weapon);
                ammo += weapon.system.magazine ?? 0;
            }
            // HG p.30: the multiple applies after armour and never to missiles or torpedoes.
            const missile = held.some(weapon => MGT2Helper.hasTrait(weapon.system.traits, "smart")
                || /missile|torpedo/i.test(weapon.name));
            return {
                index, type: mount.type, label: mount.label, popup: mount.popup,
                typeLabel: type.label,
                multiple: missile ? 1 : type.damageMultiple,
                printed: type.damageMultiple,
                missile,
                big: !missile && (type.damageMultiple >= 10),
                hardpoints: type.hardpoints ?? 1,
                tons: type.tons,
                ammo: mount.ammo, ammoMax: ammo,
                weapons: held,
                choices: weapons.map(weapon => ({
                    _id: weapon._id, name: weapon.name, selected: mount.weapons.includes(weapon._id)
                }))
            };
        });
        return {
            rows,
            unmounted: weapons.filter(weapon => !claimed.has(weapon._id)),
            spinal: system.mounts.some(mount => mount.type === "spinal"),
            scansUnarmed: system.scansUnarmed,
            tons: system.hull.tons
        };
    }

    /**
     * The roster. A station action of kind `skill` needs a sheet to read the level off, so it is
     * disabled on a vacant or unstatted slot; a `special` action is the referee's and is not.
     */
    #crew(system) {
        const required = new Map(system.crewRequired.map(row => [row.key, row.count]));
        const rows = system.crew.map((station, index) => {
            const role = station.role ? this.actor.items.get(station.role) : null;
            let actor = null;
            if (station.actor) {
                try { actor = foundry.utils.fromUuidSync(station.actor); } catch { actor = null; }
            }
            const statted = actor != null;
            return {
                index,
                role: station.role, actor: station.actor, count: station.count,
                name: actor?.name ?? station.name,
                img: actor?.img ?? null,
                statted,
                vacant: !statted && !station.name,
                station: role?.name ?? "",
                department: role ? MGT2.Departments[role.system.department] : "",
                duty: station.duty,
                dutyLabel: MGT2.CombatDuties[station.duty]?.label ?? "",
                dutyTarget: station.dutyTarget,
                actions: (role?.system.actions ?? []).map((action, i) => ({
                    index: i, label: action.label, kind: action.kind, skill: action.skill,
                    difficulty: action.difficulty,
                    target: action.difficulty ? MGT2Helper.getDifficultyValue(action.difficulty) : null,
                    disabled: (action.kind !== "special") && !statted
                })),
                roles: this.actor.items.filter(item => item.type === "role")
                    .map(item => ({ _id: item.id, name: item.name, selected: item.id === station.role })),
                required: role ? (required.get(SpacecraftActorSheet.#roleKey(role.name)) ?? null) : null
            };
        });

        return {
            rows,
            required: system.crewRequired.filter(row => row.count > 0).map(row => ({
                ...row, label: MGT2.CrewRoles[row.key]?.label ?? row.key
            })),
            totals: system.crewTotals,
            military: system.role === "military",
            hasRoles: this.actor.items.some(item => item.type === "role")
        };
    }

    /** A station named for a construction role gets that role's requirement beside it. */
    static #roleKey(name) {
        const slug = MGT2Helper.skillSlug(name);
        return Object.keys(MGT2.CrewRoles).find(key => key.toLowerCase() === slug) ?? slug;
    }

    /** Carried craft are references: a stored UUID, resolved only where it is already loaded. */
    #bays(system) {
        return system.bays.map((bay, index) => {
            let actor = null;
            if (bay.craft) {
                try { actor = foundry.utils.fromUuidSync(bay.craft); } catch { actor = null; }
            }
            const kind = MGT2.CraftBays[bay.kind] ?? {};
            return {
                index, kind: bay.kind, capacity: bay.capacity, craft: bay.craft,
                kindLabel: kind.label ?? "", external: kind.external === true,
                transfer: kind.transfer ?? null,
                name: actor?.name ?? null,
                img: actor?.img ?? null,
                purchase: actor?.system?.finance?.purchase ?? 0,
                vacant: !bay.craft
            };
        });
    }

    /** Eleven locations × six pips, with the standing severity spelled out beside it. */
    #criticals(system) {
        const locations = Object.entries(MGT2.ShipCriticals).map(([key, location]) => {
            const severity = system.criticals[key] ?? 0;
            return {
                key, label: location.label, severity,
                roll: `${location.roll[0]}`,
                pips: Array.fromRange(6, 1).map(step => ({ step, on: step <= severity })),
                effect: SpacecraftActorSheet.#effectText(system.criticalEffect(key))
            };
        });
        return { locations, hullSeverity: system.hullSeverity, standing: system.criticalEffects };
    }

    /**
     * One critical cell as localised fragments. The config table carries numbers and system names
     * only, so a cell that is nothing but the books' flavour has nothing to print and the sheet
     * hands it back to the referee.
     */
    static #effectText(cell) {
        if (!cell) return null;
        const parts = [];
        const say = (key, data) => parts.push(game.i18n.format(`MGT2.Criticals.${key}`, data));
        const state = key => game.i18n.localize(`MGT2.Criticals.States.${key}`);

        if (cell.damage) say("Damage", { dice: cell.damage });
        if (cell.power === 0) say("PowerZero");
        else if (cell.power) say("Power", { pct: String(cell.power).replace("-", "") });
        if (cell.thrust === 0) say("ThrustZero");
        else if (cell.thrust) say("Thrust", { value: String(cell.thrust).replace("-", "") });
        if (cell.armour) say("Armour", { value: String(cell.armour).replace("-", "") });
        if ("sensorRange" in cell) {
            if (cell.sensorRange === null) say("SensorsDisabled");
            else say("SensorRange", { band: game.i18n.localize(MGT2.ShipRangeBands[cell.sensorRange]?.label ?? "") });
        }
        for (const key of DM_KEYS) {
            if (cell[key] !== undefined) {
                say(key[0].toUpperCase() + key.slice(1), { dm: MGT2Helper.signed(cell[key]) });
            }
        }
        if (cell.weapons) {
            say("Weapon", { n: cell.weapons.n ?? game.i18n.localize("MGT2.Criticals.Some"),
                state: state(cell.weapons.state) });
        }
        if (cell.fuel?.leak) say("FuelLeak", { amount: cell.fuel.leak, per: cell.fuel.per ?? "" });
        if (cell.fuel?.state) say("FuelState", { state: state(cell.fuel.state) });
        if (cell.cargo) {
            say("Cargo", {
                amount: (cell.cargo === "all") ? game.i18n.localize("MGT2.Criticals.All") : cell.cargo
            });
        }
        if (cell.jump) say("Jump", { state: state(cell.jump) });
        if (cell.occupants) {
            say("Occupants", {
                n: (cell.occupants.n === "all") ? game.i18n.localize("MGT2.Criticals.All") : cell.occupants.n,
                dice: cell.occupants.damage
            });
        }
        if (cell.lifeSupport) say("LifeSupport", { time: cell.lifeSupport });
        if (cell.computer) say("Computer", { state: state(cell.computer) });
        if (cell.bridge) {
            say("Bridge", { state: state(cell.bridge.station) });
            if (cell.bridge.occupantDamage) say("Damage", { dice: cell.bridge.occupantDamage });
        }
        if (cell.hullSeverity) say("HullSeverity", { value: cell.hullSeverity });
        return parts.length ? parts.join(" · ") : game.i18n.localize("MGT2.Criticals.RefereesCall");
    }

    /**
     * The running costs, and the one row that disagrees with the printed page on purpose: Core
     * p.184 subtracts carried craft from the maintenance base and the catalogue's cost ÷ 12 000 does
     * not, so the catalogue bills a carried boat twice (§9.20).
     */
    static #finance(system) {
        const finance = system.finance;
        const money = value => Math.round(value);
        return {
            purchase: money(finance.purchase),
            mortgage: money(finance.mortgage),
            mortgageOverridden: finance.mortgageOverride !== null,
            maintenance: money(finance.maintenance),
            catalogue: money(finance.maintenanceCatalogue),
            carried: money(finance.carried),
            delta: money(finance.maintenanceCatalogue - finance.maintenance),
            lifeSupport: money(finance.lifeSupport),
            salaries: money(finance.salaries),
            fuel: money(finance.fuel),
            refined: system.fuel.refined
        };
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** @this {SpacecraftActorSheet} */
    static async #onCriticalSet(event, target) {
        const location = target.closest("[data-location]").dataset.location;
        const step = Number(target.dataset.step);
        const current = this.actor.system.criticals[location] ?? 0;
        return this.actor.update({ [`system.criticals.${location}`]: (current === step) ? step - 1 : step });
    }

    /** @this {SpacecraftActorSheet} */
    static async #onCriticalClear() {
        const criticals = Object.fromEntries(Object.keys(MGT2.ShipCriticals).map(key => [key, 0]));
        return this.actor.update({ system: { criticals, hullSeverity: 0 } });
    }

    /**
     * Core p.170: severity is Effect − 5, a repeat takes `max(new, old + 1)` and caps at 6, and a
     * further hit on a 6 deals 6D that ignores armour. The location is the referee's own 2D roll,
     * typed here rather than rolled: the system does not resolve an attack for them.
     * @this {SpacecraftActorSheet}
     */
    static async #onCriticalRoll(event, target) {
        const panel = target.closest(".critctl");
        const location = panel.querySelector('[data-crit="location"]').value;
        const effect = Number(panel.querySelector('[data-crit="effect"]').value) || 0;
        const severity = CraftData.severityFor(effect);
        if (severity <= 0) {
            return ui.notifications.info(game.i18n.localize("MGT2.Actor.spacecraft.NoCritical"));
        }

        const result = await this.actor.system.applyCritical(location, severity);
        if (!result) return;
        const label = game.i18n.localize(MGT2.ShipCriticals[location].label);
        // The sixteen cells that raise Hull Severity instead of damaging their own location are
        // applied here rather than folded, because two of them are a 1D roll.
        const cell = this.actor.system.criticalEffect(location);
        if (cell?.hullSeverity && !result.overflow) await this.#raiseHullSeverity(cell.hullSeverity);

        return ui.notifications.info(result.overflow
            ? game.i18n.format("MGT2.Actor.spacecraft.CriticalOverflow",
                { location: label, damage: result.overflow.total })
            : game.i18n.format("MGT2.Actor.spacecraft.CriticalApplied",
                { location: label, severity: result.severity }));
    }

    /** `+1` or `+1D`, capped at 6 like every other severity. */
    async #raiseHullSeverity(amount) {
        const roll = Number.isInteger(amount) ? amount : (await new Roll(String(amount).replace(/D$/i, "d6")).roll()).total;
        const next = Math.min(6, this.actor.system.hullSeverity + roll);
        return this.actor.update({ "system.hullSeverity": next });
    }

    /** Core p.172: cutting power to a system is an Engineer's action, and it is reversible. */
    static async #onPowerToggle(event, target) {
        const key = target.dataset.consumer;
        const offline = new Set(this.actor.system.power.offline);
        if (offline.has(key)) offline.delete(key);
        else offline.add(key);
        return this.actor.update({ "system.power.offline": Array.from(offline) });
    }

    /** @this {SpacecraftActorSheet} */
    static async #onHullOptionToggle(event, target) {
        const key = target.dataset.option;
        const options = new Set(this.actor.system.hull.options);
        if (options.has(key)) options.delete(key);
        else options.add(key);
        return this.actor.update({ "system.hull.options": Array.from(options) });
    }

    /**
     * One handler for the four repeatable arrays. The form is submitted first, because a create
     * rewrites the whole array and would otherwise discard what is typed in the other rows.
     * @this {SpacecraftActorSheet}
     */
    static async #onRowCreate(event, target) {
        await this.submit();
        const key = target.dataset.rows;
        const rows = this.actor.system[key].map(row => ({ ...row }));
        return this.actor.update({ [`system.${key}`]: [...rows, {}] });
    }

    /** @this {SpacecraftActorSheet} */
    static async #onRowDelete(event, target) {
        await this.submit();
        const key = target.dataset.rows;
        const index = Number(target.closest("[data-row-index]").dataset.rowIndex);
        const rows = this.actor.system[key].map(row => ({ ...row })).filter((_row, i) => i !== index);
        return this.actor.update({ [`system.${key}`]: rows });
    }

    /**
     * A station's action, rolled on the crew member the slot links to — the one place the ship reads
     * a linked actor at all. A `skill` action is refused on a vacant or unstatted slot because there
     * is no sheet to read the level off; a `special` one is a referee's call and always offered.
     * @this {SpacecraftActorSheet}
     */
    static async #onStationAction(event, target) {
        const row = target.closest("[data-row-index]");
        const station = this.actor.system.crew[Number(row.dataset.rowIndex)];
        const action = this.actor.items.get(station?.role)?.system.actions[Number(target.dataset.actionIndex)];
        if (!action) return;

        let actor = null;
        if (station.actor) {
            try { actor = foundry.utils.fromUuidSync(station.actor); } catch { actor = null; }
        }
        if ((action.kind !== "special") && !actor) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Actor.spacecraft.NoCrewSheet"));
        }
        if (!actor) {
            return ui.notifications.info(game.i18n.format("MGT2.Actor.spacecraft.RefereeAction",
                { action: action.label }));
        }

        // Core p.59: an unskilled check is DM−3, and a skill the crewman does not have is unskilled.
        const skill = actor.items.find(item => (item.type === "talent")
            && (item.system.subType === "skill") && MGT2Helper.matchesSkill(item.name, action.skill));
        const characteristic = actor.system.characteristics[action.characteristic];
        const terms = [
            { label: action.skill || game.i18n.localize("MGT2.Items.NotProficient"),
                dm: skill ? skill.system.level : -3 },
            { label: action.characteristic, dm: characteristic?.dm ?? 0 },
            { label: game.i18n.localize("MGT2.Actor.spacecraft.StationDM"), dm: action.dm ?? 0 }
        ].filter(term => term.dm !== 0);

        const formula = ["2d6", ...terms.map(term => MGT2Helper.getFormulaDM(term.dm))].join("");
        const roll = await new Roll(formula).roll();
        const target8 = action.difficulty ? MGT2Helper.getDifficultyValue(action.difficulty) : null;
        const effect = (target8 === null) ? null : roll.total - target8;

        return roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: game.i18n.format("MGT2.Actor.spacecraft.ActionFlavor", {
                action: action.label,
                ship: this.actor.name,
                effect: (effect === null) ? "—" : MGT2Helper.signed(effect)
            })
        });
    }

    /** The link is a stored UUID and nothing here reads the canvas. @this {SpacecraftActorSheet} */
    static async #onOpenCraft(event, target) {
        const uuid = target.closest("[data-uuid]")?.dataset.uuid;
        if (!uuid) return;
        const document = await fromUuid(uuid);
        return document?.sheet?.render(true);
    }
}
