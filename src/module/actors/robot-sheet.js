import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { traitLabel } from "../traits.js";
import { TravellerActorSheet } from "./character-sheet.js";

const PARTS_PATH = "systems/mgt2/templates/actors";

/** The six canonical characteristics, in the order the UPP prints them. */
const TRAVELLER_KEYS = ["strength", "dexterity", "endurance", "intellect", "education", "social"];

/** The three repeatable arrays one pair of handlers serves. */
const ROW_ARRAYS = new Set(["options", "locomotion", "manipulators"]);

/** Every block the panel composes from; each one is a partial of the same name. */
const BLOCKS = ["attacks", "skills", "traits", "characteristics", "armour", "description", "notes",
    "chassis", "derivations", "locomotion", "manipulators", "brain", "options"];

const blockPath = id => `${PARTS_PATH}/robot/blocks/${id}.html`;

/** Which tab holds each block. */
const SLOT = {
    attacks: "field", skills: "field", traits: "field", characteristics: "field", armour: "field",
    description: "field", notes: "field",
    chassis: "design", derivations: "design", locomotion: "design", manipulators: "design", brain: "design",
    options: "design"
};

for ( const id of BLOCKS ) {
    if ( !(id in SLOT) ) throw new Error(`MGT2 | the robot sheet block "${id}" has no tab slot.`);
}

/** The robot sheet. @extends {TravellerActorSheet} */
export class RobotActorSheet extends TravellerActorSheet {

  /** @inheritDoc */
  static GUIDE_TOPIC = "robot";

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
            templates: [`${PARTS_PATH}/robot/budget.html`, `${PARTS_PATH}/parts/row-controls.html`],
            scrollable: [""]
        },
        panel: {
            template: `${PARTS_PATH}/robot/panel.html`,
            templates: BLOCKS.map(blockPath).concat(`${PARTS_PATH}/parts/tabs-nav.html`,
                `${PARTS_PATH}/parts/attack-card.html`,
                `${PARTS_PATH}/parts/characteristic.html`,
                `${PARTS_PATH}/parts/row-controls.html`,
                `${PARTS_PATH}/parts/armour-rows.html`,
                "systems/mgt2/templates/items/blocks/traits.html"),
            scrollable: ['.tab[data-group="robot"].active']
        }
    };

    /** A round with a robot rolls and reads in the first tab; the second is where it is built. @inheritDoc */
    static TABS = {
        robot: {
            tabs: [
                { id: "field", cssClass: "item tab-select", icon: "fa-solid fa-crosshairs", label: "MGT2.Actor.robot.Tabs.Field" },
                { id: "design", cssClass: "item tab-select", icon: "fa-solid fa-drafting-compass", label: "MGT2.Design.Title" }
            ],
            initial: "field"
        }
    };

    /**
     * The parent maps document paths onto the *character* sheet's parts, and this sheet has three
     * of its own, so a document-driven render redraws all of them instead.
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

        // The parent overwrites `context.tabs` with the character sheet's two groups.
        context.tabs = this._prepareTabs("robot");
        for ( const tab of Object.values(context.tabs) ) {
            tab.blocks = BLOCKS.filter(id => SLOT[id] === tab.id).map(id => ({ id, template: blockPath(id) }));
        }

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
            vacuumRows: game.i18n.format("MGT2.Actor.robot.VacuumFromRows", { rows: game.i18n.localize(
                MGT2.RobotVacuumSealing[system.vacuumRows] ?? "MGT2.Actor.robot.VacuumNone") }),
            statblock: RobotActorSheet.#statblock(system),
            // The Size table as options: `eq` is strict, and an object's `{{#each}}` key is a
            // string where `system.size` is a number, so the match is made here instead.
            sizes: Object.entries(MGT2.RobotSize).map(([key, row]) => ({
                key, label: row.label, slots: row.slots, hits: row.hits,
                selected: Number(key) === system.size
            })),
            traveller: TRAVELLER_KEYS.map(key => byKey.get(key)).filter(Boolean)
        };
        // One Attacks block, as the printed statblock has one line: natural attacks, then carried weapons.
        context.attacks = [...context.weapons.filter(weapon => weapon.system.natural === true),
            ...context.weapons.filter(weapon => weapon.system.natural !== true)];
        // Play mode folds what holds nothing into one line; edit mode keeps every block to fill in.
        const vacant = {
            attacks: !context.attacks.length, skills: !context.skills.length,
            description: MGT2Helper.isBlankHtml(system.description), notes: MGT2Helper.isBlankHtml(system.notes)
        };
        context.robot.vacant = vacant;
        context.tabs.field.vacant = [
            vacant.attacks && { label: "MGT2.Actor.robot.Attacks" },
            vacant.skills && { label: "MGT2.Actor.Skills" },
            vacant.description && { label: "MGT2.Actor.robot.Description", door: this.isEditable },
            vacant.notes && { label: "MGT2.Actor.Notes", door: this.isEditable }
        ].filter(Boolean);
        return context;
    }

    /**
     * One budget panel.
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
     * the Destroyed state (RH p.13), so the two printed thresholds are two marks on one bar.
     */
    static #hits(system) {
        const hits = system.characteristics.hits;
        const scale = 2 * hits.max;
        const pct = points => (scale > 0) ? Math.min(100, Math.max(0, Math.round((points / scale) * 100))) : 0;
        const states = system.states;
        const marks = [
            { at: 50, label: "MGT2.Actor.robot.Wrecked", hit: states.wrecked },
            { at: 100, label: "MGT2.Actor.robot.Destroyed", hit: states.destroyed }
        ];
        return {
            value: hits.value, max: hits.max, damage: hits.damage,
            wound: pct(hits.damage),
            wrecked: states.wrecked, destroyed: states.destroyed,
            marks,
            labels: marks.map(mark => ({ at: mark.at, hit: mark.hit, text: game.i18n.localize(mark.label),
                anchor: (mark.at === 100) ? "end" : "" }))
        };
    }

    /**
     * The slot budget, in the **soft** over-state: the Robot Handbook states no penalty for
     * exceeding Slots, so this is a design-time warning with no rule behind it and must not borrow
     * the danger colour.
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
        // The total departs from Base Slots only once Slots were removed (RH p.13), and only then says so.
        if ( system.slots.removed > 0 ) {
            budget.why = `${game.i18n.localize("MGT2.Actor.robot.BaseSlots")} ${system.slots.base} · `
                + `${game.i18n.localize("MGT2.Actor.robot.Removed")} ${system.slots.removed}`;
        }
        return budget;
    }

    static #zeroSlot(system) {
        const rows = system.options.filter(option => option.zeroSlot).map(option => ({
            key: option.name, label: option.name, why: option.note, value: 1
        }));
        return RobotActorSheet.#budget(system.zeroSlot.budget, rows);
    }

    /** The `computer` pattern a third time. */
    static #bandwidth(system) {
        const brain = system.brain;
        const rows = brain.packages.map(entry => ({
            key: entry._id, label: entry.name, value: entry.bandwidth, item: true
        }));
        // RH p.73's surcharge is a cost like any other and rides `used`, so it gets a row of its
        // own — folded into the INT figure below it would read as an upgrade nobody bought.
        if (brain.bandwidth.surcharged > 0) {
            rows.push({
                key: "surcharge",
                label: game.i18n.format("MGT2.Actor.robot.SurchargeRow",
                    { count: brain.bandwidth.surcharged }),
                why: game.i18n.localize("MGT2.Actor.robot.SurchargeWhy"),
                value: brain.bandwidth.surcharged
            });
        }
        const intellect = brain.bandwidth.used - brain.bandwidth.surcharged
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
        // The brain is a `computer` Item, so its Bandwidth reads as the computer's Processing does.
        budget.cells = Array.from({ length: Math.ceil(Math.max(budget.cap, budget.total)) },
            (_cell, index) => ({ on: index < budget.total }));
        budget.inherent = brain.bandwidth.inherent;
        budget.oversized = brain.bandwidth.oversized;
        budget.downgradesIgnored = brain.bandwidth.downgradesIgnored;
        budget.freeSkillsUsed = brain.bandwidth.freeSkillsUsed;
        budget.surcharged = brain.bandwidth.surcharged;
        budget.item = brain.item;
        return budget;
    }

    /** The three chains the sheet writes out rather than only answering. */
    static #chains(system) {
        const loco = MGT2.RobotLocomotion[system.primaryLocomotionKey];
        const term = (value, label, extra = {}) => ({ value, label, ...extra });

        const endurance = system.endurance.chain.map(entry => term(
            entry.value,
            (entry.key === "base") ? (loco?.label ?? "") : `MGT2.Actor.robot.Chain.${entry.key}`,
            { off: !entry.on }));
        endurance.push(term(system.endurance.hours, "MGT2.Actor.robot.Chain.hours", { result: true }));

        const agility = system.agility;
        const speed = (system.speed.metres === null) ? [] : [
            term(5, "MGT2.Actor.robot.Chain.speedBase"),
            term(Math.abs(agility), loco?.label ?? "", { op: agility < 0 ? "−" : "+" }),
            term(Math.abs(system.agilityEnhancement), "MGT2.Actor.robot.AgilityEnhancement",
                { op: system.agilityEnhancement < 0 ? "−" : "+", off: !system.agilityEnhancement }),
            term(Math.abs(system.speed.tactical), "MGT2.Actor.robot.Chain.tactical",
                { op: system.speed.tactical < 0 ? "−" : "+", off: !system.speed.tactical }),
            ...(system.soleSourcePower
                ? [term(2, "MGT2.Actor.robot.Power", { op: "÷" }),
                    term(2, "MGT2.Actor.robot.Agility", { op: "−" })] : []),
            term(system.speed.metres, "MGT2.Actor.robot.Chain.metres", { result: true })
        ];

        const money = value => `Cr${MGT2Helper.credits(value)}`;
        const cost = [
            term(money(system.sizeRow.cost), `MGT2.RobotSize.${system.size}`),
            term(loco?.costMultiplier ?? 1, loco?.label ?? ""),
            term(money(system.baseCost), "MGT2.Actor.robot.Chain.chassis", { result: true })
        ];

        return { endurance, speed, cost, vehicle: system.endurance.vehicleHours };
    }

    /** Each mode with the four values it drives at once (RH p.16) — which is why it is not an enum. */
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
     * bought up independently, so the formula is the starting point and not the value (RH p.26).
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
            hardened: system.hardened,
            // RH folio 106: the count is stored and both losses read off it, so the sheet prints
            // the two together — the rads that reached the brain and what they have cost it.
            rads: brain.rads,
            radiationLoss: system.radiationLoss,
            inoperable: system.states.inoperable,
            ceiling: brain.taskCeiling ? `MGT2.Difficulty.${brain.taskCeiling}` : "",
            ceilingTarget: brain.taskCeilingTarget,
            freeSkills: brain.freeSkills,
            skillCap: system.skillLevelCap,
            educationCap: brain.educationCap,
            overload: brain.overload,
            item: brain.item
        };
    }

    /** The thirteen printed rows, nine of them computed (RH p.13-31, p.66). */
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

    /** One handler for the three repeatable arrays. */
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
     * cost multiplier all read (RH p.16, p.23).
     */
    static async #onLocomotionPrimary(event, target) {
        await this.submit();
        const index = Number(target.closest("[data-row-index]").dataset.rowIndex);
        const rows = this.actor.system.locomotion.map((row, i) => ({ ...row, primary: i === index }));
        return this.actor.update({ "system.locomotion": rows });
    }
}
