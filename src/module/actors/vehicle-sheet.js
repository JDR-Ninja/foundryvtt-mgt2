import { Checks } from "../checks.js";
import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { RollPromptHelper } from "../roll-prompt.js";
import { CraftData } from "./craft-data.js";
import { TravellerActorSheet } from "./character-sheet.js";

const PARTS_PATH = "systems/mgt2/templates/actors";

/** Which cell keys phrase themselves the same way: a signed DM and nothing else. */
const DM_KEYS = ["controlDM", "systemsDM", "sensorDM"];

/**
 * The vehicle sheet: the eleven printed statblock lines in the books' own order, the five armour
 * facings, the six-line systems block and a critical track of nine locations.
 * @extends {TravellerActorSheet}
 */
export class VehicleActorSheet extends TravellerActorSheet {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["vehicle"],
        position: { width: 1020, height: 800 },
        actions: {
            criticalSet: VehicleActorSheet.#onCriticalSet,
            criticalRoll: VehicleActorSheet.#onCriticalRoll,
            criticalClear: VehicleActorSheet.#onCriticalClear,
            mountCreate: VehicleActorSheet.#onMountCreate,
            mountDelete: VehicleActorSheet.#onMountDelete,
            skillCreate: VehicleActorSheet.#onSkillCreate,
            skillDelete: VehicleActorSheet.#onSkillDelete,
            blockToggle: VehicleActorSheet.#onBlockToggle,
            vehicleAction: VehicleActorSheet.#onVehicleAction,
            combatClear: VehicleActorSheet.#onCombatClear,
            openDriver: VehicleActorSheet.#onOpenDriver
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/vehicle/header.html` },
        rail: { template: `${PARTS_PATH}/vehicle/rail.html`, scrollable: [""] },
        panel: {
            template: `${PARTS_PATH}/vehicle/panel.html`,
            templates: [`${PARTS_PATH}/parts/row-controls.html`,
                "systems/mgt2/templates/items/blocks/traits.html"],
            scrollable: [""]
        }
    };

    /** One rail and one panel, no tab strip. */
    static TABS = {};

    /**
     * The parent maps document paths onto the *character* sheet's parts, and this sheet has three
     * of its own — an unlucky mapping would filter the list down to nothing — so a document-driven
     * render redraws all of them instead.
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
            speedBands: MGT2.SpeedBands,
            operatingModes: MGT2.OperatingModes,
            rangeUnits: MGT2.RangeUnits,
            vehicleSkills: MGT2.VehicleSkills,
            mountTypes: MGT2.VehicleMounts,
            arcs: MGT2.FireArcs,
            interfaces: MGT2.RemoteInterfaces
        };

        context.vehicle = {
            hull: VehicleActorSheet.#hull(system),
            skills: VehicleActorSheet.#skills(system),
            speed: VehicleActorSheet.#speed(system),
            agility: VehicleActorSheet.#agility(system),
            armour: VehicleActorSheet.#armour(system),
            systems: VehicleActorSheet.#systems(system),
            crossCheck: VehicleActorSheet.#crossCheck(system),
            criticals: this.#criticals(system),
            combat: VehicleActorSheet.#combat(system),
            mounts: this.#mounts(system, context.weapons)
        };
        return context;
    }

    /** Core folio 138: who rolls the two vehicular actions, and what the last ones left standing. */
    static #combat(system) {
        return {
            driver: system.driverActor?.name ?? "",
            dogfight: system.combat.dogfight,
            carry: system.combat.carry,
            evasive: system.combat.evasive,
            // The Effect is what is stored; the rule turns it into a negative DM, so that is what
            // the row prints — and a failed check's negative Effect prints as a positive one.
            evasiveDM: -system.combat.evasive
        };
    }

    /** The pool, drawn on the stored wound. */
    static #hull(system) {
        const hull = system.characteristics.hull;
        const pct = points => (hull.max > 0) ? Math.min(100, Math.round((points / hull.max) * 100)) : 0;
        return {
            value: hull.value, max: hull.max, damage: hull.damage,
            wound: pct(hull.damage),
            wrecked: system.states.wrecked,
            crossed: system.sustainedCrossed,
            steps: system.sustainedSteps,
            weapons: system.mountedWeapons,
            cap: system.weaponCap
        };
    }

    /** Each stored pair with the speciality list its own skill offers. */
    static #skills(system) {
        return system.skill.map((pair, index) => ({
            index, skill: pair.skill, speciality: pair.speciality,
            label: MGT2.VehicleSkills[pair.skill]?.label ?? "",
            specialityLabel: MGT2.VehicleSpecialities[pair.speciality] ?? "",
            specialities: MGT2.VehicleSkills[pair.skill]?.specialities ?? {}
        }));
    }

    /** `Very slow (idle)` — the band names, off the numbers the schema stores. */
    static #speed(system) {
        const names = Object.values(MGT2.SpeedBands);
        return {
            max: names[system.speed.max] ?? null,
            cruise: names[system.speed.cruise] ?? null,
            effective: names[system.speed.effective] ?? null,
            reduced: system.speed.effective < system.speed.max
        };
    }

    /** The printed number, what is standing between it and play, and the result. */
    static #agility(system) {
        return {
            printed: system.agility,
            effective: system.agilityEffective,
            penalties: system.agilityPenalties,
            native: system.nativeModes.has(system.operatingMode)
        };
    }

    /**
     * Five facings, and the two derived ones say so: a dashed cell is the sheet reporting a
     * fallback rather than a value, which is the distinction both books rest on.
     */
    static #armour(system) {
        const armour = system.armour;
        const facing = (key, value, reactive, derived) => ({
            key, value, reactive, derived,
            field: derived ? null : key
        });
        return {
            facings: [
                facing("front", armour.front, armour.reactive.front, false),
                facing("rear", armour.rear, armour.reactive.rear, false),
                facing("sides", armour.sides, armour.reactive.sides, false),
                facing("top", armour.effectiveRoof, 0, armour.top === null),
                facing("bottom", armour.effectiveFloor, 0, armour.bottom === null)
            ],
            vsLight: armour.vsLight,
            toHit: system.toHit,
            maintenance: system.maintenance
        };
    }

    /**
     * Six lines, six kinds of number — and `opposed` marks the two that are a negative DM on
     * somebody else's roll rather than a bonus on this vehicle's.
     */
    static #systems(system) {
        const rows = [
            { key: "autopilot", value: system.systems.autopilot, opposed: false, unit: null },
            { key: "comms", value: system.systems.comms, opposed: false, unit: "MGT2.RangeUnits.km" },
            { key: "navigation", value: system.systems.navigation, opposed: false, unit: null, signed: true },
            { key: "sensors", value: system.systems.sensors, opposed: false, unit: null, signed: true },
            { key: "camouflage", value: system.systems.camouflage, opposed: true, unit: null, signed: true },
            { key: "stealth", value: system.systems.stealth, opposed: true, unit: null, signed: true }
        ];
        for (const row of rows) row.absent = (row.value === null);
        return rows;
    }

    /** Printed beside computed. Never a correction — the row only ever reports. */
    static #crossCheck(system) {
        const rows = system.crossCheck.map(row => ({
            ...row,
            printed: Math.round(row.printed * 100) / 100,
            derived: Math.round(row.derived * 100) / 100
        }));
        return { rows, mismatch: rows.some(row => !row.agrees), envelope: system.gasEnvelope };
    }

    /** Nine locations × six pips, with the effect of the standing severity spelled out beside. */
    #criticals(system) {
        const locations = Object.entries(MGT2.VehicleCriticals).map(([key, location]) => {
            const severity = system.criticals[key] ?? 0;
            return {
                key, label: location.label, severity,
                roll: (location.roll[0] === location.roll[1])
                    ? `${location.roll[0]}` : `${location.roll[0]}–${location.roll[1]}`,
                pips: Array.fromRange(6, 1).map(step => ({ step, on: step <= severity })),
                effect: VehicleActorSheet.#effectText(system.criticalEffect(key))
            };
        });
        return { locations, hullSeverity: system.hullSeverity, standing: system.criticalEffects };
    }

    /** One critical cell as localised fragments. */
    static #effectText(cell) {
        if (!cell) return null;
        const parts = [];
        const say = (key, data) => parts.push(game.i18n.format(`MGT2.Criticals.${key}`, data));

        if (cell.damage) say("Damage", { dice: cell.damage });
        if (cell.fuel?.dryIn) {
            say("FuelDry", { time: `${cell.fuel.dryIn.dice} `
                + game.i18n.localize(`MGT2.Criticals.Units.${cell.fuel.dryIn.unit}`) });
        }
        if (cell.fuel?.state) say("FuelState", { state: game.i18n.localize(`MGT2.Criticals.States.${cell.fuel.state}`) });
        if (cell.speedBands === 0) say("SpeedZero");
        else if (cell.speedBands) say("SpeedBands", { bands: String(cell.speedBands).replace("-", "") });
        if (cell.armour) say("Armour", { value: String(cell.armour).replace("-", "") });
        for (const key of DM_KEYS) {
            if (cell[key] !== undefined) {
                say(key[0].toUpperCase() + key.slice(1), { dm: MGT2Helper.signed(cell[key]) });
            }
        }
        if (cell.weapons) {
            const state = game.i18n.localize(`MGT2.Criticals.States.${cell.weapons.state}`);
            if (cell.weapons.state === "dm") {
                say("WeaponDM", { n: cell.weapons.n, state, dm: MGT2Helper.signed(cell.weapons.dm ?? 0) });
            } else say("Weapon", { n: cell.weapons.n, state });
        }
        if (cell.cargo) {
            say("Cargo", {
                amount: (cell.cargo === "all") ? game.i18n.localize("MGT2.Criticals.All") : cell.cargo
            });
        }
        if (cell.occupants) {
            say("Occupants", {
                n: (cell.occupants.n === "all") ? game.i18n.localize("MGT2.Criticals.All") : cell.occupants.n,
                dice: cell.occupants.damage
            });
        }
        if (cell.systemLoss) say("SystemLoss");
        if (cell.hullSeverity) say("HullSeverity", { value: cell.hullSeverity });
        return parts.length ? parts.join(" · ") : game.i18n.localize("MGT2.Criticals.RefereesCall");
    }

    /** Each mount with the embedded weapons it holds, and the ones no mount has claimed. */
    #mounts(system, weapons) {
        const byId = new Map(weapons.map(weapon => [weapon._id, weapon]));
        const claimed = new Set();
        const mounts = system.mounts.map((mount, index) => {
            const held = [];
            for (const id of mount.weapons) {
                const weapon = byId.get(id);
                if (!weapon) continue;
                claimed.add(id);
                held.push(weapon);
            }
            return {
                index, type: mount.type, arc: mount.arc, fireControl: mount.fireControl,
                typeLabel: MGT2.VehicleMounts[mount.type] ?? "",
                arcLabel: MGT2.FireArcs[mount.arc] ?? "",
                weapons: held,
                choices: weapons.map(weapon => ({
                    _id: weapon._id, name: weapon.name, selected: mount.weapons.includes(weapon._id)
                }))
            };
        });
        return { rows: mounts, unmounted: weapons.filter(weapon => !claimed.has(weapon._id)) };
    }

    /** The pip the referee clicked, or one step back when it is already the standing severity. */
    static async #onCriticalSet(event, target) {
        const location = target.closest("[data-location]").dataset.location;
        const step = Number(target.dataset.step);
        const current = this.actor.system.criticals[location] ?? 0;
        return this.actor.update({ [`system.criticals.${location}`]: (current === step) ? step - 1 : step });
    }

    /** @this {VehicleActorSheet} */
    static async #onCriticalClear() {
        const criticals = Object.fromEntries(Object.keys(MGT2.VehicleCriticals).map(key => [key, 0]));
        return this.actor.update({ system: { criticals, hullSeverity: 0 } });
    }

    /**
     * Core p.140: severity is Effect − 5, a repeat takes `max(new, old + 1)` and caps at 6, and a
     * further hit on a 6 deals 6D that ignores armour.
     */
    static async #onCriticalRoll(event, target) {
        const panel = target.closest(".critctl");
        const location = panel.querySelector('[data-crit="location"]').value;
        const effect = Number(panel.querySelector('[data-crit="effect"]').value) || 0;
        const severity = CraftData.severityFor(effect);
        if (severity <= 0) {
            return ui.notifications.info(game.i18n.localize("MGT2.Actor.vehicle.NoCritical"));
        }

        const result = await this.actor.system.applyCritical(location, severity);
        if (!result) return;
        const label = game.i18n.localize(MGT2.VehicleCriticals[location].label);
        // The fourteen cells raising Hull Severity are applied here, two of them being a 1D roll.
        const cell = this.actor.system.criticalEffect(location);
        if (cell?.hullSeverity && !result.overflow) {
            await this.actor.system.raiseHullSeverity(cell.hullSeverity);
        }

        return ui.notifications.info(result.overflow
            ? game.i18n.format("MGT2.Actor.vehicle.CriticalOverflow",
                { location: label, damage: result.overflow.total })
            : game.i18n.format("MGT2.Actor.vehicle.CriticalApplied",
                { location: label, severity: result.severity }));
    }

    /** @this {VehicleActorSheet} */
    static async #onMountCreate() {
        await this.submit();
        return this.actor.update({ "system.mounts": [...this.actor.system.mounts.map(m => ({ ...m })), {}] });
    }

    /** @this {VehicleActorSheet} */
    static async #onMountDelete(event, target) {
        await this.submit();
        const index = Number(target.closest("[data-mount-index]").dataset.mountIndex);
        const mounts = this.actor.system.mounts.map(m => ({ ...m })).filter((_m, i) => i !== index);
        return this.actor.update({ "system.mounts": mounts });
    }

    /** @this {VehicleActorSheet} */
    static async #onSkillCreate() {
        await this.submit();
        return this.actor.update({ "system.skill": [...this.actor.system.skill.map(p => ({ ...p })), {}] });
    }

    /** @this {VehicleActorSheet} */
    static async #onSkillDelete(event, target) {
        await this.submit();
        const index = Number(target.closest("[data-skill-index]").dataset.skillIndex);
        const skill = this.actor.system.skill.map(p => ({ ...p })).filter((_p, i) => i !== index);
        return this.actor.update({ "system.skill": skill });
    }

    /** The two nullable sub-objects. */
    static async #onBlockToggle(event, target) {
        await this.submit();
        const key = target.dataset.block;
        return this.actor.update({ [`system.${key}`]: this.actor.system[key] ? null : {} });
    }

    /** Core folio 138's two actions that leave a DM behind. */
    static async #onVehicleAction(event, target) {
        const action = MGT2.VehicleActions[target.dataset.vehicleAction];
        if (!action) return;
        const system = this.actor.system;
        const driver = system.driverActor;
        if (!driver) return ui.notifications.warn(game.i18n.localize("MGT2.Actor.vehicle.NoDriver"));

        // Folio 141: a critical's Control DM stands on control checks, and both actions here are
        // control checks — they roll the chassis skill.
        const modifiers = [];
        if (system.criticalEffects.controlDM !== 0) {
            modifiers.push({ key: "criticalControl", label: "MGT2.Actor.vehicle.ControlDM",
                dm: system.criticalEffects.controlDM });
        }

        // "All skill checks used in these actions use the Agility of the vehicle as a DM" — as a
        // row the referee can untick, which is the treatment a ship's own station DM already gets.
        if (system.agilityEffective !== 0) {
            modifiers.push({ key: "agility", label: "MGT2.Actor.vehicle.Agility",
                dm: system.agilityEffective });
        }
        // "If one of the vehicles' drivers chooses to initiate a dogfight again in the following
        // combat round, the winner of the previous dogfight applies the difference between that
        // round's opposed check as a positive DM to this round's opposed check."
        if (action.opposed && (system.combat.carry > 0)) {
            modifiers.push({ key: "carry", label: "MGT2.Actor.vehicle.DogfightCarry",
                dm: system.combat.carry });
        }

        const skills = RollPromptHelper.actorSkills(driver);
        const rollOptions = {
            rollTypeName: this.actor.name,
            rollObjectName: game.i18n.localize(action.label),
            characteristics: RollPromptHelper.actorCharacteristics(driver),
            characteristic: "",
            skills,
            skill: VehicleActorSheet.#chassisSkill(system, skills),
            checkModifiers: modifiers,
            difficulty: null,
            blocks: { skill: true, range: false, traits: false },
            ceiling: driver.system.taskCeiling,
            strengthDM: driver.system.characteristics.strength?.dm ?? 0
        };

        const data = await RollPromptHelper.roll(rollOptions);
        if (!data) return; // dialog dismissed

        const { formula, modifiers: named, chainSources } =
            RollPromptHelper.terms(data, driver, modifiers);
        if (MGT2Helper.hasValue(data, "difficulty")) rollOptions.difficulty = data.difficulty;

        const scored = await Checks.resolve({
            formula, rollData: driver.getRollData(),
            difficulty: rollOptions.difficulty, prompt: data
        });
        if (!scored) return;

        const outcome = await this.#resolveAction(action, scored.effect, scored.opposed);

        return VehicleActorSheet.#postAction(this.actor, driver, scored, {
            action, outcome, modifiers: named, chainSources,
            difficulty: rollOptions.difficulty, mode: data.rollMode
        });
    }

    /**
     * What the check leaves standing on the vehicle.
     * @returns {Promise<string>}   The i18n key of the sentence the card states
     */
    async #resolveAction(action, effect, opposed) {
        if (!action.opposed) {
            await this.actor.update({ "system.combat.evasive": effect });
            return "MGT2.Chat.Roll.Evasive";
        }
        if (!opposed) return "MGT2.Chat.Roll.DogfightNone";

        // "The winner of a dogfight gains DM+2 to all their attack rolls for this round while the
        // loser suffers DM-2", and a draw leaves neither with an advantage.
        const won = opposed.outcome === "won";
        await this.actor.update({ system: { combat: {
            dogfight: won ? action.winner : (opposed.outcome === "lost") ? action.loser : 0,
            carry: won ? Math.abs(effect - opposed.effect) : 0
        } } });
        return `MGT2.Chat.Roll.Dogfight${won ? "Won" : (opposed.outcome === "lost") ? "Lost" : "Tie"}`;
    }

    /**
     * Core folio 138 names "the skill appropriate to their vehicle (Drive, Flyer, or Seafarer)",
     * which the chassis already stores — so the driver's own matching skill opens preselected.
     */
    static #chassisSkill(system, skills) {
        for (const pair of system.skill) {
            const label = MGT2.VehicleSkills[pair.skill]?.label;
            if (!label) continue;
            const wanted = game.i18n.localize(label);
            const match = skills.find(entry => MGT2Helper.matchesSkill(entry.term, wanted));
            if (match) return match._id;
        }
        return "NP";
    }

    /**
     * The same card every other check posts, so the action can be chained from and opposed like any
     * other.
     */
    static async #postAction(vehicle, driver, scored, context) {
        const { action, outcome } = context;
        const label = game.i18n.localize(action.label);
        const opposed = scored.opposed;
        return Checks.post(scored, {
            actor: driver,
            label,
            mode: context.mode,
            rollTypeName: vehicle.name,
            rollObjectName: label,
            difficulty: context.difficulty,
            modifiers: context.modifiers,
            chainSources: context.chainSources,
            showButtons: true,
            lines: [game.i18n.format(outcome, {
                dm: MGT2Helper.signed(-scored.effect, "+0"),
                carry: opposed ? Math.abs(scored.effect - opposed.effect) : 0
            })]
        });
    }

    /** Both actions last a round and nothing on the sheet can watch for one. @this {VehicleActorSheet} */
    static async #onCombatClear() {
        return this.actor.update({ system: { combat: { dogfight: 0, carry: 0, evasive: 0 } } });
    }

    /** @this {VehicleActorSheet} */
    static async #onOpenDriver() {
        return this.actor.system.driverActor?.sheet?.render(true);
    }

    /**
     * A person dropped on the sheet takes the controls — the same drop the ship's crew roster
     * accepts, at one seat instead of a table.
     * @inheritDoc
     */
    async _onDrop(event) {
        const data = MGT2Helper.getDataFromDropEvent(event);
        if (data?.type !== "Actor") return super._onDrop(event);
        if (!this.isEditable) return false;

        const actor = await fromUuid(data.uuid);
        if (!["character", "npc"].includes(actor?.type)) {
            ui.notifications.warn(game.i18n.localize("MGT2.Actor.vehicle.NotDriver"));
            return false;
        }
        await this.actor.update({ "system.driver": actor.uuid });
        return true;
    }
}
