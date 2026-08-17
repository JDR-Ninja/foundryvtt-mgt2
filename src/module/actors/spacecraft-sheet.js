import { Checks } from "../checks.js";
import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { RollPromptHelper } from "../roll-prompt.js";
import { SkipDebtsDialog } from "../skip-debts.js";
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
            softwareToggle: SpacecraftActorSheet.#onSoftwareToggle,
            hullOptionToggle: SpacecraftActorSheet.#onHullOptionToggle,
            rowCreate: SpacecraftActorSheet.#onRowCreate,
            rowDelete: SpacecraftActorSheet.#onRowDelete,
            stationAction: SpacecraftActorSheet.#onStationAction,
            openCraft: SpacecraftActorSheet.#onOpenCraft,
            electMortgage: SpacecraftActorSheet.#onElectMortgage,
            skipDebts: SpacecraftActorSheet.#onSkipDebts
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
            mounts: SpacecraftActorSheet.#mounts(system, context.weapons),
            crew: this.#crew(system),
            bays: this.#bays(system),
            // Craft and bays are two counts now: a clamp rack of ten fighters is one row (§9.95).
            craftCount: system.smallCraftCount,
            criticals: this.#criticals(system),
            manoeuvre: system.manoeuvre,
            finance: SpacecraftActorSheet.#finance(system),
            design: SpacecraftActorSheet.#design(system),
            // Which of §4.1's six the book is answering for. The panel marks each beside its own
            // readout; the two budget blocks carry theirs on the row and the header.
            printed: system.printedFigures,
            derived: SpacecraftActorSheet.#derived(system),
            // Null where the table does not play fleet battles: the rule is off and no statblock was
            // computed. The stored Crew Skill it reads is drawn with the roster either way (§9.100).
            fleet: system.fleet
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
     * @param {number} [stated]   A printed total displacing the sum of the rows (§4.1). The rows
     *                            then no longer add up to the header, which is exactly what the
     *                            block's `why` gloss is there to say
     */
    static #budget(cap, rows, stated) {
        const total = stated
            ?? rows.reduce((sum, row) => sum + ((row.powered === false) ? 0 : row.value), 0);
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

    /**
     * The parts list and the design check beside it (§9.92). Every figure is `system.components`
     * and `system.design` read back — the arithmetic is the model's, and this names it.
     *
     * A check that does not APPLY is drawn and greyed rather than dropped: an empty ledger says
     * nothing, and a ledger of four lines with two of them silent says exactly which two rules this
     * parts list is complete enough to answer.
     */
    static #design(system) {
        const design = system.design;
        return {
            ...system.components,
            failed: design.failed,
            checks: design.checks.map(check => ({
                ...check,
                label: `MGT2.Design.Checks.${check.key}`,
                why: `MGT2.Design.Why.${check.key}`,
                // The two transcription lines read as a match rather than as a cap, so the reading
                // is `used = cap` and not `used / cap`.
                match: check.key.startsWith("stated")
            })),
            rows: system.components.rows.map(row => ({
                ...row,
                categoryLabel: MGT2.ComponentCategories[row.category] ?? row.category,
                // A power plant states what it makes; every other row states what it takes.
                power: row.generates > 0 ? row.generates : -row.draw
            }))
        };
    }

    /** The pool. A hull only ever fills — there is no state under wrecked (Core p.168). */
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

    /** The gloss that says a printed figure is answering, in the slot `mortgageOverride` already uses. */
    static #printedWhy(on) {
        return on ? "MGT2.Actor.spacecraft.Printed" : undefined;
    }

    /**
     * The formula's own answer for each of §4.1's six, whether or not an override is displacing it.
     * The edit form prompts with these, so an empty box already says what "derive" will give — which
     * is the cheapest way to make a nullable field's two states legible.
     */
    static #derived(system) {
        const round = value => Math.round(value * 100) / 100;
        return {
            hullPoints: system.hullPoints,
            armourTons: round(system.armourTons),
            bridgeTons: round(system.bridgeTons),
            bridgeCost: system.bridgeCost,
            jumpTons: round(system.fuelPerMaxJump),
            powerDraw: system.power.fullDraw
        };
    }

    static #tonnage(system) {
        const printed = system.printedFigures;
        const why = { armour: printed.armourTons, bridge: printed.bridgeTons };
        return SpacecraftActorSheet.#budget(system.hull.tons,
            system.budget.rows.map(row => ({ key: row.key, value: row.tons,
                why: SpacecraftActorSheet.#printedWhy(why[row.key]) })));
    }

    /**
     * The one budget with a state: a consumer taken offline is an Engineer's action and it frees its
     * draw (Core p.171), which is why power is a panel rather than a number.
     */
    static #power(system) {
        const budget = SpacecraftActorSheet.#budget(system.power.available,
            system.power.rows.map(row => ({ key: row.key, value: row.draw, powered: row.powered })),
            system.power.requirements.total);
        budget.surplus = system.power.surplus;
        budget.plant = system.power.plant;
        // A critical that cut the plant's output is why `available` and `plant` can differ.
        budget.damaged = system.power.available < system.power.plant;
        budget.why = SpacecraftActorSheet.#printedWhy(system.printedFigures.powerDraw);
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

    /** A package the ship cannot run spends nothing, so its row reads 0 and says why (§9.128). */
    static #computer(system) {
        const budget = SpacecraftActorSheet.#budget(system.computer.processing,
            system.computer.software.map(row => ({
                key: row._id, label: row.name, value: row.bandwidth, powered: row.powered,
                why: row.tlBlocked ? "MGT2.Actor.spacecraft.SoftwareBlocked"
                    : (row.downgraded ? "MGT2.Actor.spacecraft.SoftwareDowngraded" : undefined)
            })));
        budget.overload = system.computer.overload;
        budget.overCrowded = system.computer.overCrowded;
        budget.blockedSoftware = system.computer.blockedSoftware;
        // What is aboard, beside what is running: the hint under the budget is the only place the
        // design figure appears, and it is the one HG p.73 is about (§9.132).
        budget.installed = system.computer.installed;
        budget.carried = system.computer.carried;
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
        for (const [key, passage] of Object.entries(MGT2.PassageClasses)) {
            // A working passage is paid in labour, not booked into a berth the ship counts.
            if (!(key in system.passengers)) continue;
            rows.push({ path: `passengers.${key}`, label: passage.label, value: system.passengers[key] });
        }
        return rows;
    }

    /* -------------------------------------------- */

    /** Each mount with the weapons it holds, its damage multiple, and the ones no mount claimed. */
    static #mounts(system, weapons) {
        const byId = new Map(weapons.map(weapon => [weapon._id, weapon]));
        const claimed = new Set();
        const inert = system.mountsInert;
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
            // HG p.29: the multiple applies after armour and never to missiles or torpedoes.
            const missile = held.some(weapon => MGT2Helper.hasTrait(weapon.system.traits, "smart")
                || /missile|torpedo/i.test(weapon.name));
            // Core p.168: two or more weapons OF THE SAME TYPE in one mount fire together on a
            // single attack roll, each extra one adding +1 per damage die. Missiles are excluded.
            const linked = held.length
                ? held.filter(weapon => weapon.name === held[0].name).length : 0;
            const band = held[0]?.system.range?.band || "";
            return {
                index, type: mount.type, label: mount.label, popup: mount.popup,
                typeLabel: type.label,
                // Names a weapon and resolves none: correct for the defensive counts, which read the
                // class off the label, and silently zero for anything offensive (§9.106).
                inert: inert[index],
                // Core p.165-167: the furthest band the mounted weapon reaches. What the band is
                // worth to an attack belongs to the range the exchange happens at, not to the
                // weapon, so only the reach is carried here.
                band, bandLabel: MGT2.ShipRangeBands[band]?.label ?? "",
                linked: missile ? 1 : linked,
                linkedBonus: missile ? 0
                    : (linked - 1) * SpacecraftActorSheet.#damageDice(held[0]?.system.damage),
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
            inertCount: system.inertMountCount,
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
                // The mount this station sits at. The combat DUTY is not the ship's any more: it is
                // per-encounter and lives on the `crew` Combatant (§9.26), so this roster names the
                // turret and the encounter names who is at it.
                dutyTarget: station.dutyTarget,
                actions: (role?.system.actions ?? []).map((action, i) => ({
                    index: i, label: action.label, kind: action.kind, skill: action.skill,
                    difficulty: action.difficulty,
                    step: action.step, stepLabel: MGT2.CombatSteps[action.step] ?? "",
                    cap: action.cap, capLabel: (action.cap && (action.cap !== "none"))
                        ? MGT2.ActionCaps[action.cap] : "",
                    target: action.difficulty ? MGT2Helper.getDifficultyValue(action.difficulty) : null,
                    disabled: (action.kind !== "special") && !statted
                })),
                roles: this.actor.items.filter(item => item.type === "role")
                    .map(item => ({ _id: item.id, name: item.name, selected: item.id === station.role })),
                required: role ? (required.get(role.system.crewRoleKey) ?? null) : null
            };
        });

        return {
            rows,
            required: system.crewRequired.filter(row => row.count > 0).map(row => ({
                ...row, label: MGT2.CrewRoles[row.key]?.label ?? row.key
            })),
            totals: system.crewTotals,
            military: system.role === "military",
            hasRoles: this.actor.items.some(item => item.type === "role"),
            // The typed Crew Skill and the average the roster can see. Not the same claim: the
            // roster holds stations, so the observed figure is over `bodies` and not over the crew.
            skill: system.crewSkill,
            observed: system.crewSkillObserved
        };
    }


    /** Carried craft are references: a stored UUID, resolved only where it is already loaded. */
    #bays(system) {
        return system.bays.map((bay, index) => {
            let actor = null;
            if (bay.craft) {
                try { actor = foundry.utils.fromUuidSync(bay.craft); } catch { actor = null; }
            }
            const kind = MGT2.CraftBays[bay.kind] ?? {};
            const count = Math.max(1, bay.count);
            return {
                index, kind: bay.kind, capacity: bay.capacity, craft: bay.craft, count,
                kindLabel: kind.label ?? "", external: kind.external === true,
                transfer: kind.transfer ?? null,
                name: actor?.name ?? null,
                img: actor?.img ?? null,
                // `capacity` is per craft (§9.95), so the row's own tonnage is the product — and it
                // is the figure the tonnage budget sums, which is why the sheet prints it and not
                // the stored number.
                tons: Math.round(count * bay.capacity * 100) / 100,
                many: count > 1,
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
     * p.183 subtracts carried craft from the maintenance base and the catalogue's cost ÷ 12 000 does
     * not, so the catalogue bills a carried boat twice (§9.20).
     */
    static #finance(system) {
        const finance = system.finance;
        const money = value => Math.round(value);
        const election = row => row && {
            payment: money(row.payment), periods: row.periods, total: money(row.total) };
        return {
            purchase: money(finance.purchase),
            mortgage: money(finance.mortgage),
            mortgageOverridden: finance.mortgageOverride !== null,
            // Core p.149's term, and the total it was never multiplied out to. `multiple` is what
            // makes the overcost legible — at the book's twelve periods a year it reads x2.00, which
            // is to say the crew buys the hull twice (§9.115).
            periods: finance.mortgagePeriods,
            periodsPerYear: finance.periodsPerYear,
            total: money(finance.mortgageTotal),
            overcost: money(finance.mortgageOvercost),
            multiple: finance.mortgageMultiple?.toFixed(2) ?? null,
            paid: finance.periodsPaid,
            remaining: finance.periodsRemaining,
            balance: money(finance.balance),
            percent: Math.round(finance.paidFraction * 100),
            quarters: finance.benefitQuarters,
            elections: finance.elections && {
                keep: election(finance.elections.keep),
                remortgage: election(finance.elections.remortgage)
            },
            maintenance: money(finance.maintenance),
            catalogue: money(finance.maintenanceCatalogue),
            carried: money(finance.carried),
            delta: money(finance.maintenanceCatalogue - finance.maintenance),
            lifeSupport: money(finance.lifeSupport),
            salaries: money(finance.salaries),
            // Outside the five periodic rows above, and rendered apart from them: fuel is a unit
            // price the crew pays when they buy some (§9.33.7 c).
            fuelPerTon: money(finance.fuelPerTon),
            tankFill: money(finance.tankFill),
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
     * Core p.169: severity is Effect − 5, a repeat takes `max(new, old + 1)` and caps at 6, and a
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

    /** Core p.171: cutting power to a system is an Engineer's action, and it is reversible. */
    static async #onPowerToggle(event, target) {
        return this.#toggleMember("system.power.offline", this.actor.system.power.offline,
            target.dataset.consumer);
    }

    /**
     * HG p.73: a package is started when it is wanted and stopped when it is not, and only what is
     * running spends Processing (§9.132). The set is the inverse of power's — what is IN service.
     */
    static async #onSoftwareToggle(event, target) {
        return this.#toggleMember("system.computer.running", this.actor.system.computer.running,
            target.dataset.consumer);
    }

    /** @this {SpacecraftActorSheet} */
    async #toggleMember(path, current, key) {
        const members = new Set(current);
        if (members.has(key)) members.delete(key);
        else members.add(key);
        return this.actor.update({ [path]: Array.from(members) });
    }

    /**
     * Core p.149's two elections after a career Benefit. Continuing keeps the calculated payment, so
     * it CLEARS the override rather than writing the same number back — that null is what tells the
     * two elections apart afterwards.
     * @this {SpacecraftActorSheet}
     */
    static async #onElectMortgage(event, target) {
        const payment = target.dataset.election === "remortgage"
            ? Math.round(this.actor.system.finance.elections.remortgage.payment) : null;
        return this.actor.update({ "system.finance.mortgageOverride": payment });
    }

    /**
     * Core p.153's check, for this hull. Its own window rather than a block on the panel: it is
     * asked once per system arrived at, and half its ladder is per-check rather than per-ship.
     * @this {SpacecraftActorSheet}
     */
    static async #onSkipDebts(event, target) {
        return SkipDebtsDialog.open(this.actor);
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
        return SpacecraftActorSheet.rollStationAction(this.actor, action,
            { crew: actor, dutyTarget: station.dutyTarget });
    }

    /**
     * The same roll from two screens: the ship's own roster and the space combat screen. The
     * encounter's answer for the mount wins where there is one — Core folio 164 has a gunner choose
     * a turret at the start of the combat, and the roster's own is the standing one (§9.26).
     * @param {Actor} ship
     * @param {object} action              A `role.actions[]` record
     * @param {object} [options]
     * @param {Actor|null} [options.crew]  Whoever is at the station, or null
     * @param {string} [options.dutyTarget]
     * @param {object[]} [options.extraModifiers]  The caller's own waivable modifiers
     */
    static async rollStationAction(ship, action,
        { crew: actor = null, dutyTarget = "", extraModifiers = [] } = {}) {
        if ((action.kind !== "special") && !actor) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Actor.spacecraft.NoCrewSheet"));
        }
        if (!actor) {
            return ui.notifications.info(game.i18n.format("MGT2.Actor.spacecraft.RefereeAction",
                { action: action.label }));
        }

        const system = ship.system;
        // A `weapon` action fires the mount the gunner is sitting at — `dutyTarget`, which is what
        // `MGT2.CombatDuties[duty].mount` marks the two gunner duties as needing.
        const mount = (action.kind === "weapon")
            ? SpacecraftActorSheet.#dutyMount(ship, dutyTarget) : null;
        if ((action.kind === "weapon") && !mount) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Actor.spacecraft.NoMount"));
        }

        // Core p.59: an unskilled check is DM−3, and a skill the crewman does not have is unskilled.
        // The prompt states that as its own "Not proficient" option rather than as a term.
        const skill = actor.items.find(item => (item.type === "talent")
            && (item.system.subType === "skill") && MGT2Helper.matchesSkill(item.name, action.skill));

        // The ship's own contributions ride the prompt as waivable modifiers, which is what they
        // are: a referee who rules that a critical has knocked the fire control out says so by
        // unticking it rather than by editing the ship. A caller's own join them HERE, before the
        // prompt is built: `RollPromptHelper.terms`' fourth argument pushes its entries in AFTER
        // the checkbox filter, so a term passed there could never be unticked (§9.33.4).
        const shipModifiers = [...extraModifiers];
        if (action.dm) {
            shipModifiers.push({ key: "station", label: "MGT2.Actor.spacecraft.StationDM", dm: action.dm });
        }
        // The mount's own accuracy grade, which stands in for a scope on a vehicle or ship weapon
        // (VH p.45). It is stored per weapon and was displayed and never rolled.
        const weapon = mount?.weapon ?? null;
        if (weapon?.system.fireControl) {
            shipModifiers.push({ key: "fireControl", label: "MGT2.Items.FireControl",
                dm: weapon.system.fireControl });
        }
        // The sensor suite's grade modifies a sensors check made from this ship, and a Sensors
        // critical is already folded into the same number (`sensors.dm`).
        const sensorRole = MGT2.CrewRoles.sensorOperator;
        const sensorCheck = MGT2Helper.matchesSkill(action.skill, sensorRole.skill)
            && String(action.skill).toLowerCase().includes(sensorRole.speciality);
        if (sensorCheck && system.sensors.dm) {
            shipModifiers.push({ key: "sensors", label: "MGT2.Actor.spacecraft.SensorDM",
                dm: system.sensors.dm });
        }

        // The same prompt every other check opens, seeded from the crew member's sheet: Boon and
        // Bane, the timeframe, the difficulty ladder and the chain row all come with it. The
        // characteristics and skills are the CREWMAN's — the ship has neither.
        const rollOptions = {
            rollTypeName: ship.name,
            rollObjectName: action.label,
            characteristics: RollPromptHelper.actorCharacteristics(actor),
            characteristic: action.characteristic || "",
            skills: RollPromptHelper.actorSkills(actor),
            skill: skill?.id ?? "NP",
            checkModifiers: shipModifiers,
            difficulty: action.difficulty,
            damageFormula: weapon?.system.damage ?? null,
            // A ship weapon reaches in range BANDS, which Core p.74's ground table does not speak;
            // its traits are not offered here either, and that is the entry's remaining half.
            blocks: { skill: true, range: false, traits: false },
            strengthDM: actor.system.characteristics.strength?.dm ?? 0
        };

        const userRollData = await RollPromptHelper.roll(rollOptions);
        if (!userRollData) return; // dialog dismissed

        const { formula, modifiers, chainSources } =
            RollPromptHelper.terms(userRollData, actor, shipModifiers);
        if (MGT2Helper.hasValue(userRollData, "difficulty")) {
            rollOptions.difficulty = userRollData.difficulty;
        }

        // A station action scores an Effect like any other check, so it can feed a chain too —
        // Core p.166's Aid Gunners is exactly that shape.
        const scored = await Checks.resolve({
            formula, rollData: actor.getRollData(),
            difficulty: rollOptions.difficulty, prompt: userRollData
        });
        if (!scored) return;

        const flags = { mgt2: {} };

        // A fired mount carries the whole damage payload, so the card the defender resolves knows
        // what the mount is worth. HG p.29's multiple and Core p.168's linked weapons both live
        // here because both are properties of the MOUNT, not of the weapon.
        if (weapon?.system.damage) {
            const traits = weapon.system.traits;
            flags.mgt2.damage = {
                formula: mount.linkedBonus
                    ? `${weapon.system.damage} + ${mount.linkedBonus}` : weapon.system.damage,
                rollObjectName: weapon.name,
                rollTypeName: game.i18n.localize(mount.typeLabel),
                effect: scored.effect,
                strengthDM: 0,
                scale: weapon.system.scale ?? "spacecraft",
                multiple: mount.multiple,
                ap: MGT2Helper.traitScore(traits, "ap"),
                loPen: MGT2Helper.traitScore(traits, "lo-pen"),
                stun: MGT2Helper.hasTrait(traits, "stun"),
                destructive: MGT2Helper.hasTrait(traits, "destructive"),
                damageType: Array.from(weapon.system.damageType ?? [])
            };
        }

        // The same card every other check posts. A one-line flavour cost this path three things: the
        // Effect band, the terms that produced the roll, and — because the Roll damage button lives
        // on that card and nowhere else — any way at all to roll the damage payload above. A gunner
        // could fire and never resolve the hit.
        return Checks.post(scored, {
            actor,
            label: action.label,
            flags,
            mode: userRollData.rollMode,
            // The ship names the context the action was taken in; the crewman is already the
            // message's speaker.
            rollTypeName: ship.name,
            rollObjectName: action.label,
            difficulty: rollOptions.difficulty,
            modifiers,
            chainSources,
            showButtons: true,
            showRollDamage: Boolean(flags.mgt2.damage),
            damageCarriesEffect: true
        });
    }

    /**
     * The mount a gunner's `dutyTarget` names — an index, or a label, matched case-insensitively.
     * Returns the prepared row rather than the stored record, so the caller gets the multiple and
     * the linked-weapon bonus already computed.
     */
    static #dutyMount(ship, dutyTarget) {
        const rows = SpacecraftActorSheet.#mounts(ship.system, ship.items.filter(i => i.type === "weapon"));
        const wanted = String(dutyTarget ?? "").trim();
        if (!wanted) return null;
        const index = Number(wanted);
        const row = Number.isInteger(index) ? rows.rows[index]
            : rows.rows.find(entry => entry.label.trim().toLowerCase() === wanted.toLowerCase());
        if (!row?.weapons.length) return null;
        return { ...row, weapon: row.weapons[0] };
    }

    /** How many dice a damage expression rolls, for Core p.168's +1 per die per linked weapon. */
    static #damageDice(formula) {
        const match = /(\d*)\s*[dD]/.exec(String(formula ?? ""));
        if (!match) return 0;
        return match[1] ? Number(match[1]) : 1;
    }

    /** The link is a stored UUID and nothing here reads the canvas. @this {SpacecraftActorSheet} */
    static async #onOpenCraft(event, target) {
        const uuid = target.closest("[data-uuid]")?.dataset.uuid;
        if (!uuid) return;
        const document = await fromUuid(uuid);
        return document?.sheet?.render(true);
    }

    /* -------------------------------------------- */
    /*  Drag and Drop                               */
    /* -------------------------------------------- */

    /**
     * A person dropped on a station row takes it. The roster stored a UUID from the first day and
     * the only way to put one there was to paste it into a text field, which §10 called the most
     * visible UX hole in the system. Dropped on the table and nowhere in particular they are a new
     * station with nobody's name on it, which is the roster's own vacant state.
     * @inheritDoc
     */
    async _onDrop(event) {
        const data = MGT2Helper.getDataFromDropEvent(event);
        if (data?.type !== "Actor") return super._onDrop(event);
        if (!this.isEditable) return false;

        const actor = await fromUuid(data.uuid);
        // §9.26's drop table names these two: a ship's crew is people, and a `spacecraft` dropped
        // here would be asking for a carried craft, which is the bay's question and not this one.
        if (!["character", "npc"].includes(actor?.type)) {
            ui.notifications.warn(game.i18n.localize("MGT2.Actor.spacecraft.NotCrew"));
            return false;
        }

        const index = Number(event.target.closest("[data-row-index]")?.dataset.rowIndex ?? -1);
        const crew = this.actor.system.crew.map(station => ({ ...station }));
        if (crew[index]) crew[index].actor = actor.uuid;
        else crew.push({ actor: actor.uuid, name: actor.name });
        await this.actor.update({ "system.crew": crew });
        return true;
    }

    /** A zone refuses at the pointer or not at all — after the drop is too late to be feedback. */
    _onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        for (const node of this.element.querySelectorAll(".over, .deny")) {
            if (node !== zone) node.classList.remove("over", "deny");
        }
        if (!zone) return super._onDragOver(event);
        const accepted = MGT2Helper.dropAccepted(zone);
        zone.classList.toggle("over", accepted);
        zone.classList.toggle("deny", !accepted);
    }
}
