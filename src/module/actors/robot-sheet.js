import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { traitLabel } from "../traits.js";
import { TravellerActorSheet } from "./character-sheet.js";

const PARTS_PATH = "systems/mgt2/templates/actors";

/** The six canonical characteristics, in the order the UPP prints them (§5.8). */
const TRAVELLER_KEYS = ["strength", "dexterity", "endurance", "intellect", "education", "social"];

/** The three repeatable arrays one pair of handlers serves. */
const ROW_ARRAYS = new Set(["options", "locomotion", "manipulators"]);

/**
 * The robot sheet. Nine of the thirteen printed statblock rows are computed from a handful of
 * stored choices, which no other Actor type does — so this is the one sheet that has to be able to
 * show a *formula* rather than only its result, and the derivation chains in the panel are the
 * single component the shared kit did not already carry.
 *
 * Everything else is the kit unchanged: the statline, two budget panels in the soft over-state, the
 * damage track, the code row, and — under `traveller.enabled` — the character sheet's own
 * characteristic partial.
 *
 * @extends {TravellerActorSheet}
 */
export class RobotActorSheet extends TravellerActorSheet {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["robot"],
        position: { width: 1060, height: 840 },
        actions: {
            rowCreate: RobotActorSheet.#onRowCreate,
            rowDelete: RobotActorSheet.#onRowDelete,
            locomotionPrimary: RobotActorSheet.#onLocomotionPrimary
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/robot/header.html` },
        rail: {
            template: `${PARTS_PATH}/robot/rail.html`,
            templates: [`${PARTS_PATH}/robot/budget.html`],
            scrollable: [""]
        },
        panel: {
            template: `${PARTS_PATH}/robot/panel.html`,
            templates: [`${PARTS_PATH}/robot/budget.html`,
                `${PARTS_PATH}/parts/characteristic.html`,
                `${PARTS_PATH}/parts/row-controls.html`,
                "systems/mgt2/templates/items/blocks/traits.html"],
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
            sizes: MGT2.RobotSize,
            brains: MGT2.RobotBrains,
            locomotion: MGT2.RobotLocomotion,
            power: MGT2.RobotPower,
            society: MGT2.RobotSociety,
            speedBands: MGT2.SpeedBands
        };

        const byKey = new Map(context.characteristics.map(c => [c.key, c]));
        context.robot = {
            hits: RobotActorSheet.#hits(system),
            slots: RobotActorSheet.#slots(system),
            zero: RobotActorSheet.#zeroSlot(system),
            bandwidth: RobotActorSheet.#bandwidth(system),
            chains: RobotActorSheet.#chains(system),
            locomotion: RobotActorSheet.#locomotion(system),
            manipulators: RobotActorSheet.#manipulators(system),
            brain: RobotActorSheet.#brain(system),
            statblock: RobotActorSheet.#statblock(system),
            // The Size table as options: `eq` is strict, and an object's `{{#each}}` key is a
            // string where `system.size` is a number, so the match is made here instead.
            sizes: Object.entries(MGT2.RobotSize).map(([key, row]) => ({
                key, label: row.label, slots: row.slots, hits: row.hits,
                selected: Number(key) === system.size
            })),
            traveller: TRAVELLER_KEYS.map(key => byKey.get(key)).filter(Boolean)
        };
        // The natural attacks print in the statblock; anything else is an ordinary weapon row.
        context.naturals = context.weapons.filter(weapon => weapon.system.natural === true);
        context.carried = context.weapons.filter(weapon => weapon.system.natural !== true);
        return context;
    }

    /* -------------------------------------------- */
    /*  Blocks                                      */
    /* -------------------------------------------- */

    /**
     * One budget panel. The total, the bar and the over-state are computed here and never authored,
     * which is the block's own contract.
     * @param {number} cap
     * @param {Array<{key: string, value: number}>} rows
     * @param {string} over   `soft` for a design-time warning, `hard` for a real game state
     */
    static #budget(cap, rows, over = "soft") {
        const total = rows.reduce((sum, row) => sum + row.value, 0);
        const fill = cap > 0 ? Math.min(100, (total / cap) * 100) : 0;
        const round = value => Math.round(value * 100) / 100;
        return {
            rows: rows.map(row => ({ ...row, value: round(row.value) })),
            total: round(total), cap: round(cap), over: total > cap, kind: over,
            fill: Math.round(fill * 10) / 10,
            // The cap tick sits where the fill stops, so an overrun reads as an overrun.
            mark: (total > cap) ? 100 : Math.round(fill * 10) / 10,
            remaining: round(Math.abs(cap - total))
        };
    }

    /**
     * The pool, on a scale of **twice** the maximum: `damage` can exceed `max` and that overrun is
     * the Destroyed state (RH p.14), so the two printed thresholds are two marks on one bar.
     */
    static #hits(system) {
        const hits = system.characteristics.hits;
        const scale = 2 * hits.max;
        const pct = points => (scale > 0) ? Math.min(100, Math.max(0, Math.round((points / scale) * 100))) : 0;
        const states = system.states;
        let state = "operational";
        if (states.destroyed) state = "destroyed";
        else if (states.wrecked) state = "wrecked";
        else if (hits.damage > 0) state = "damaged";
        return {
            value: hits.value, max: hits.max, damage: hits.damage,
            wound: pct(hits.damage), state,
            wrecked: states.wrecked, destroyed: states.destroyed,
            marks: [
                { at: 50, label: "MGT2.Actor.robot.Wrecked", hit: states.wrecked },
                { at: 100, label: "MGT2.Actor.robot.Destroyed", hit: states.destroyed }
            ]
        };
    }

    /**
     * The slot budget, in the **soft** over-state: the Robot Handbook states no penalty for
     * exceeding Slots, so this is a design-time warning with no rule behind it and must not borrow
     * the danger colour. The zero-slot overrun is a row of its own, because that is where a real
     * Slot is spent on an option that costs none (RH p.32).
     */
    static #slots(system) {
        const rows = system.options.filter(option => !option.zeroSlot).map(option => ({
            key: option.name, label: option.name, why: option.note, value: option.slots
        }));
        if (system.slots.overrun > 0) {
            rows.push({
                key: "zeroOverrun", label: game.i18n.localize("MGT2.Actor.robot.ZeroOverrun"),
                why: "", value: system.slots.overrun
            });
        }
        const budget = RobotActorSheet.#budget(system.slots.total, rows);
        budget.base = system.slots.base;
        budget.removed = system.slots.removed;
        budget.spare = system.slots.spare;
        return budget;
    }

    static #zeroSlot(system) {
        const rows = system.options.filter(option => option.zeroSlot).map(option => ({
            key: option.name, label: option.name, why: option.note, value: 1
        }));
        return RobotActorSheet.#budget(system.zeroSlot.budget, rows);
    }

    /**
     * The `computer` pattern a third time. Unlike the two above this one **is** a hard state: a
     * brain asked for more Bandwidth than it has is overloaded, which the rules do define.
     */
    static #bandwidth(system) {
        const brain = system.brain;
        const rows = brain.packages.map(entry => ({
            key: entry._id, label: entry.name, value: entry.bandwidth
        }));
        const intellect = brain.bandwidth.used
            - brain.packages.reduce((sum, entry) => sum + entry.bandwidth, 0);
        if (intellect > 0) {
            rows.unshift({
                key: "intellect",
                label: game.i18n.format("MGT2.Actor.robot.IntellectBought", { n: MGT2Helper.signed(brain.intellect) }),
                why: game.i18n.localize("MGT2.Actor.robot.IntellectWhy"),
                value: intellect
            });
        }
        const budget = RobotActorSheet.#budget(brain.bandwidth.total, rows, "hard");
        budget.inherent = brain.bandwidth.inherent;
        budget.oversized = brain.bandwidth.oversized;
        budget.item = brain.item;
        return budget;
    }

    /**
     * The three chains the sheet writes out rather than only answering. Nine of thirteen rows are
     * computed and several multiplicatively, so a bare result cannot be audited: the user could not
     * tell a wrong efficiency flag from a wrong TL band.
     */
    static #chains(system) {
        const loco = MGT2.RobotLocomotion[system.primaryLocomotionKey];
        const term = (value, label, extra = {}) => ({ value, label, ...extra });

        const endurance = system.endurance.chain.map(entry => term(
            entry.value,
            (entry.key === "base") ? (loco?.label ?? "") : `MGT2.Actor.robot.Chain.${entry.key}`,
            { off: !entry.on }));
        endurance.push(term(system.endurance.hours, "MGT2.Actor.robot.Chain.hours", { result: true }));

        const agility = system.agility;
        const speed = [
            term(5, "MGT2.Actor.robot.Chain.speedBase"),
            term(Math.abs(agility), loco?.label ?? "", { op: agility < 0 ? "−" : "+" }),
            term(Math.abs(system.speed.tactical), "MGT2.Actor.robot.Chain.tactical",
                { op: system.speed.tactical < 0 ? "−" : "+", off: !system.speed.tactical }),
            term(system.speed.metres, "MGT2.Actor.robot.Chain.metres", { result: true })
        ];

        const money = value => `Cr${value.toLocaleString("en-GB").replace(/,/g, " ")}`;
        const cost = [
            term(money(system.sizeRow.cost), `MGT2.RobotSize.${system.size}`),
            term(loco?.costMultiplier ?? 1, loco?.label ?? ""),
            term(money(system.baseCost), "MGT2.Actor.robot.Chain.chassis", { result: true })
        ];

        return { endurance, speed, cost, vehicle: system.endurance.vehicleHours };
    }

    /** Each mode with the four values it drives at once (RH p.17) — which is why it is not an enum. */
    static #locomotion(system) {
        const chosen = system.locomotion.find(mode => mode.primary) ?? system.locomotion[0];
        return system.locomotion.map((mode, index) => {
            const row = MGT2.RobotLocomotion[mode.type] ?? {};
            return {
                index, type: mode.type,
                label: row.label ?? "",
                // `None` has no Agility rather than an Agility of zero, and the two read differently.
                agility: (row.agility === null) || (row.agility === undefined)
                    ? null : MGT2Helper.signed(row.agility),
                endurance: row.endurance ?? 0,
                costMultiplier: row.costMultiplier ?? 1,
                tl: row.tl ?? 0,
                traits: (row.traits ?? []).map(key => traitLabel({ family: "robot", key })),
                isPrimary: mode === chosen,
                // Built here rather than in the template: `eq` is strict and the outer row's own
                // value is not reachable from inside a nested `{{#each}}`'s block params.
                choices: Object.entries(MGT2.RobotLocomotion).map(([key, entry]) => ({
                    key, label: entry.label, selected: key === mode.type
                }))
            };
        });
    }

    /**
     * Per limb, with the formula printed beside the stored score rather than replacing it: both are
     * bought up independently, so the formula is the starting point and not the value (RH p.27).
     */
    static #manipulators(system) {
        return system.manipulators.map((limb, index) => ({
            index, count: limb.count, size: limb.size,
            strength: limb.strength, dexterity: limb.dexterity, isLeg: limb.isLeg,
            baseStrength: Math.max(0, (2 * limb.size) - 1),
            baseDexterity: Math.ceil(system.tl / 2) + 1,
            strongest: limb === system.strongestManipulator,
            deftest: limb === system.mostDexterousManipulator
        }));
    }

    static #brain(system) {
        const brain = system.brain;
        return {
            grade: brain.grade,
            label: MGT2.RobotBrains[brain.grade]?.label ?? "",
            intellect: brain.intellect,
            baseIntellect: system.brainIntellect,
            skillDM: brain.skillDM,
            hardened: brain.hardened,
            ceiling: brain.taskCeiling ? `MGT2.Difficulty.${brain.taskCeiling}` : "",
            ceilingTarget: brain.taskCeilingTarget,
            freeSkills: brain.freeSkills,
            skillCap: system.skillLevelCap,
            educationCap: brain.educationCap,
            overload: brain.overload,
            item: brain.item
        };
    }

    /** The thirteen printed rows, nine of them computed (RH p.14-32, p.67). */
    static #statblock(system) {
        return {
            locomotion: system.locomotion.map(mode => MGT2.RobotLocomotion[mode.type]?.label ?? "")
                .filter(Boolean),
            speed: system.speed.metres,
            band: (system.speed.band === null) ? null : Object.values(MGT2.SpeedBands)[system.speed.band],
            endurance: system.endurance.hours,
            halfLife: system.endurance.halfLife,
            armour: system.inventory.armor,
            armourBase: system.armour.base,
            armourPrinted: system.armour.printed,
            attackDM: system.attackDM,
            manipulators: system.manipulatorCount,
            spaces: system.spaces,
            traits: system.locomotionTraits.map(key => traitLabel({ family: "robot", key }))
        };
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /**
     * One handler for the three repeatable arrays. The form is submitted first, because a create
     * rewrites the whole array and would otherwise discard what is typed in the other rows.
     * @this {RobotActorSheet}
     */
    static async #onRowCreate(event, target) {
        const key = target.dataset.rows;
        if (!ROW_ARRAYS.has(key)) return;
        await this.submit();
        const rows = this.actor.system[key].map(row => ({ ...row }));
        return this.actor.update({ [`system.${key}`]: [...rows, {}] });
    }

    /** @this {RobotActorSheet} */
    static async #onRowDelete(event, target) {
        const key = target.dataset.rows;
        if (!ROW_ARRAYS.has(key)) return;
        await this.submit();
        const index = Number(target.closest("[data-row-index]").dataset.rowIndex);
        const rows = this.actor.system[key].map(row => ({ ...row })).filter((_row, i) => i !== index);
        return this.actor.update({ [`system.${key}`]: rows });
    }

    /**
     * Exactly one mode is primary, and it is the one Agility, the base endurance and the chassis
     * cost multiplier all read (RH p.17, p.24).
     * @this {RobotActorSheet}
     */
    static async #onLocomotionPrimary(event, target) {
        await this.submit();
        const index = Number(target.closest("[data-row-index]").dataset.rowIndex);
        const rows = this.actor.system.locomotion.map((row, i) => ({ ...row, primary: i === index }));
        return this.actor.update({ "system.locomotion": rows });
    }
}
