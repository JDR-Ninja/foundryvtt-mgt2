import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { ActorBaseData, createCharacteristicField } from "./actor-base-data.js";
import { createTraitsField } from "../traits.js";

const fields = foundry.data.fields;

/** RH p.8, p.32: the Default Suite pays for this many zero-slot options before Size and TL. */
const ZERO_SLOT_BASE = 5;

/** RH p.17: locomotion `None` adds a quarter to the available Slots without raising Base Slots. */
const NO_LOCOMOTION_BONUS = 0.25;

/** RH p.17, p.23: 5 m per Minor Action, modified by Agility, and never more than 12. */
const SPEED_BASE = 5;
const SPEED_CAP = 12;

/** RH p.24: Vehicle Speed Movement quarters the endurance while it is in use. */
const VEHICLE_SPEED_DIVISOR = 4;

/** RH p.24: recharging takes eight hours whatever the endurance was. */
const RECHARGE_HOURS = 8;

/** RH p.21: the efficiency option doubles the endurance; a tactical speed step costs a tenth. */
const EFFICIENCY_FACTOR = 2;
const SPEED_STEP_ENDURANCE = 0.1;

/** RH p.68: Bandwidth spent to buy +1, +2 or +3 INT, capped at +3 and costing no Slot. */
const INTELLECT_BANDWIDTH = [0, 1, 3, 6];

/** RH p.74: a robot's stored skill level never exceeds 3; the printed one may, via the DM. */
const SKILL_LEVEL_CAP = 3;

/** RH p.27: `STR = 2 × size − 1`, `DEX = ceil(TL / 2) + 1` — the starting point, not the value. */
const manipulatorStrength = size => Math.max(0, (2 * size) - 1);
const manipulatorDexterity = tl => Math.ceil(tl / 2) + 1;

/** RH p.116: END is the greater of 6 or Size, overridden outright by a power pack. */
const TRAVELLER_ENDURANCE = Object.freeze({ floor: 6, packs: [9, 12, 15], efficiency: 1, rtg: 16 });

/** RH p.20-21: the endurance multiplier for the robot's own Tech Level, best band first. */
const ENDURANCE_TL = Object.freeze([{ minTL: 15, factor: 2 }, { minTL: 12, factor: 1.5 }]);

/**
 * Schema and behaviour of the `robot` Actor sub-type. Four of the thirteen printed statblock rows
 * are design picks and the other nine are computed (§5.1), so this model is mostly derivations
 * hanging off `size`, `tl`, the locomotion list, the manipulators and the brain.
 *
 * Two things separate it from every other type. `characteristics.{str,dex,end,int}` are
 * **projections of design fields** and land in `auto`, the same accumulator a species modifier
 * feeds — an Active Effect on a robot's STR still targets `.effect` in the `initial` phase, so no
 * key changes phase by Actor type. And the slot budget is a design-time warning with no rule behind
 * it: the Robot Handbook states no penalty for exceeding Slots.
 *
 * @extends {ActorBaseData}
 */
export class RobotData extends ActorBaseData {

    static DEFAULT_DAMAGE_ORDER = ["hits"];

    /** Every robot has manipulators, so the DEX projection is the one score always worth rolling. */
    static DEFAULT_INITIATIVE = "dexterity";

    /** Field labels come off the schema; see `MGT2.Actor.robot.FIELDS` in `lang/en.json`. */
    static LOCALIZATION_PREFIXES = ["MGT2.Actor.robot"];

    /** The six the flag reveals, in the order the UPP prints them (§5.8). */
    static TRAVELLER_KEYS = ["strength", "dexterity", "endurance", "intellect", "education", "social"];

    static defineSchema() {
        const schema = super.defineSchema();
        schema.traits = createTraitsField("robot");

        const count = (initial = 0) => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, initial });

        Object.assign(schema, {
            // `hits` carries the whole pool and the six canonical characteristics are declared on
            // every robot but hidden until `traveller.enabled` (§1.3). STR, DEX, END and INT project
            // from the design into `auto`; EDU and SOC carry an authored `base`, because a Bandwidth
            // cap is not a value and a 2D roll has no hardware field to write back to (RH p.116-118).
            characteristics: new fields.SchemaField({
                hits: createCharacteristicField(true),
                strength: createCharacteristicField(false),
                dexterity: createCharacteristicField(false),
                endurance: createCharacteristicField(false),
                intellect: createCharacteristicField(false),
                education: createCharacteristicField(false),
                social: createCharacteristicField(false)
            }),

            // The Robot Size table is the spine (RH p.14): one stored number gives Base Slots, Base
            // Hits, the attack DM, Spaces and the basic cost.
            size: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 1, max: 8, initial: 5 }),
            tl: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 12 }),

            slots: new fields.SchemaField({
                // Permanently deleted at design time, −Cr100 each and unrestorable (RH p.14).
                removed: count(0),
                // Declared although derived, so a chassis modification reaching it as a `final`-phase
                // Active Effect is coerced and validated rather than written raw (§1.5, §1.6).
                total: count(0)
            }),

            // Options are rows rather than `equipment` Items: §6.1's `slots` field on the Item type
            // does not exist yet, and a robot option has no use for weight, quantity or an equipped
            // flag. `zeroSlot` rows spend the Default Suite's budget instead (RH p.32).
            options: new fields.ArrayField(new fields.SchemaField({
                name: new fields.StringField({ required: false, blank: true, trim: true }),
                slots: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 1 }),
                zeroSlot: new fields.BooleanField({ required: false, initial: false }),
                note: new fields.StringField({ required: false, blank: true, trim: true })
            }), { initial: [] }),

            // A robot may carry a primary and a secondary mode, each granting its own traits
            // (RH p.24), so this is an array and not an enum — and the primary is what Agility, the
            // base endurance and the chassis cost multiplier all read.
            locomotion: new fields.ArrayField(new fields.SchemaField({
                type: new fields.StringField({
                    required: false, blank: false, initial: "walker", choices: MGT2.RobotLocomotion }),
                primary: new fields.BooleanField({ required: false, initial: false })
            }), { initial: [{ type: "walker", primary: true }] }),

            // `strength` and `dexterity` are stored and not derived: the formulas are the starting
            // point and each limb may be bought up independently (RH p.27).
            manipulators: new fields.ArrayField(new fields.SchemaField({
                count: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 1, initial: 1 }),
                size: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 1, max: 10, initial: 5 }),
                strength: count(0),
                dexterity: count(0),
                isLeg: new fields.BooleanField({ required: false, initial: false })
            }), { initial: [] }),

            speed: new fields.SchemaField({
                // Signed: an enhancement buys a metre for 10 % of the base chassis cost and a tenth
                // of the endurance, a reduction sells one back (RH p.23).
                tactical: new fields.NumberField({
                    required: false, nullable: false, integer: true, initial: 0 }),
                // Vehicle Speed Movement replaces metres with a Speed Band entirely (RH p.24), so the
                // two readouts below are exclusive. Null is "this robot moves in metres".
                vehicleBand: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, max: 10, initial: null })
            }),

            endurance: new fields.SchemaField({
                // RTG and solar replace the multiplicative chain outright and print a half-life in
                // years with the hourly figure beside it (RH p.21, p.77).
                source: new fields.StringField({
                    required: false, blank: false, initial: "internal", choices: MGT2.RobotPower }),
                halfLife: new fields.NumberField({
                    required: false, nullable: true, min: 0, initial: null }),
                efficiency: new fields.BooleanField({ required: false, initial: false }),
                powerPacks: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 0, max: 3, initial: 0 })
            }),

            brain: new fields.SchemaField({
                grade: new fields.StringField({
                    required: false, blank: false, initial: "basic", choices: MGT2.RobotBrains }),
                // Bought rather than looked up: +1 costs 1 Bandwidth, +2 costs 3, +3 costs 6, and
                // none of them costs a Slot (RH p.68).
                intellect: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 0, max: 3, initial: 0 }),
                // The `/fib` designation (RH p.68).
                hardened: new fields.BooleanField({ required: false, initial: false })
            }),

            // §5.8: one type with a flag, not a chassis Item and not a second sub-type. Every
            // Traveller characteristic of a robot PC is a projection of a design field it already
            // owns, so a `character` carrying a chassis would have to shadow all six.
            traveller: new fields.SchemaField({
                enabled: new fields.BooleanField({ required: false, initial: false }),
                // SOC is 0 where robots are property and 2D where one is a citizen (RH p.118); this
                // seeds the authored `base` and never overwrites it.
                society: new fields.StringField({
                    required: false, blank: false, initial: "property", choices: MGT2.RobotSociety })
            }),

            // Increased Resiliency buys a point of Hits for a Slot; Decreased Resiliency sells one
            // back (RH p.21). Signed, and folded into the Size table's figure.
            resiliency: new fields.NumberField({
                required: false, nullable: false, integer: true, initial: 0 }),
            // The Agility Enhancement the DEX projection adds on top of the manipulator (RH p.116).
            agilityEnhancement: new fields.NumberField({
                required: false, nullable: false, integer: true, initial: 0 }),

            cost: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            owner: new fields.StringField({ required: false, blank: true, trim: true }),
            description: new fields.HTMLField({ required: false, blank: true, trim: true })
        });
        return schema;
    }

    /* -------------------------------------------- */
    /*  The design spine                            */
    /* -------------------------------------------- */

    /** The Robot Size row (RH p.14) — Base Slots, Base Hits, the attack DM, Spaces and the cost. */
    get sizeRow() {
        return MGT2.RobotSize[this.size] ?? MGT2.RobotSize[5];
    }

    /** The mode flagged primary, or the first one listed; everything below reads this one. */
    get primaryLocomotionKey() {
        const entry = this.locomotion.find(mode => mode.primary) ?? this.locomotion[0];
        return entry?.type ?? "";
    }

    get primaryLocomotion() {
        return MGT2.RobotLocomotion[this.primaryLocomotionKey] ?? null;
    }

    /** RH p.17: Agility comes from the locomotion type. `None` has none rather than zero. */
    get agility() {
        return this.primaryLocomotion?.agility ?? 0;
    }

    /**
     * RH p.17. The denominator for armour reduction, resiliency, efficiency, agility, tactical speed
     * and vehicle speed — a named field, because otherwise five derivations recompute it.
     */
    get baseChassisCost() {
        return this.sizeRow.cost * (this.primaryLocomotion?.costMultiplier ?? 1);
    }

    /** The armour band the robot's Tech Level falls in (RH p.20). */
    get armourBand() {
        return Object.values(MGT2.RobotArmour).find(band =>
            (this.tl >= band.minTL) && ((band.maxTL === null) || (this.tl <= band.maxTL))) ?? null;
    }

    /** The brain's ladder row; `drone` is a printed grade with no row of its own (RH p.209-216). */
    get brainRow() {
        return MGT2.RobotBrains[this.brain.grade] ?? MGT2.RobotBrains.basic;
    }

    /**
     * Which step of the grade the robot's Tech Level buys. The ladder lists Bandwidth and INT per
     * TL step (RH p.67), so a Very Advanced brain is Computer/3 at TL 12 and Computer/5 at TL 14.
     */
    get brainStep() {
        const row = this.brainRow;
        if (!row.tl?.length) return -1;
        return Math.min(row.tl.length - 1, Math.max(0, this.tl - row.tl[0]));
    }

    /** RH p.67: `Computer/X` **is** Bandwidth, and it caps any single skill package. */
    get inherentBandwidth() {
        const step = this.brainStep;
        return (step < 0) ? 0 : (this.brainRow.bandwidth?.[step] ?? 0);
    }

    /** The brain's own INT before the upgrades bought with Bandwidth. */
    get brainIntellect() {
        const step = this.brainStep;
        return (step < 0) ? 0 : (this.brainRow.intellect?.[step] ?? 0);
    }

    /**
     * The `computer` Item standing in for the brain — the third use of the type, after a Traveller's
     * handcomp and a starship's Computer/25 (§5.4). Its `processing` is the total Bandwidth, so a
     * storage module raises it by raising the Item.
     */
    get brainItem() {
        return this.parent.items.find(item => item.type === "computer") ?? null;
    }

    /* -------------------------------------------- */
    /*  Manipulators, speed, endurance              */
    /* -------------------------------------------- */

    /** RH p.116: STR is the strongest manipulator's, and per check it is the limb actually used. */
    get strongestManipulator() {
        return this.manipulators.reduce((best, limb) =>
            (!best || (limb.strength > best.strength)) ? limb : best, null);
    }

    /** RH p.116: DEX is the most dexterous manipulator's, plus the agility enhancement. */
    get mostDexterousManipulator() {
        return this.manipulators.reduce((best, limb) =>
            (!best || (limb.dexterity > best.dexterity)) ? limb : best, null);
    }

    /** How many limbs there are in total; the rows carry a count each (`2 × (STR 12 DEX 8)`). */
    get manipulatorCount() {
        return this.manipulators.reduce((total, limb) => total + limb.count, 0);
    }

    /** RH p.17, p.23: 5 m, modified by Agility and by whatever tactical speed was bought. */
    get speedMetres() {
        if (this.speed.vehicleBand !== null) return null;
        return Math.max(0, Math.min(SPEED_CAP, SPEED_BASE + this.agility + this.speed.tactical));
    }

    /**
     * RH p.20-21, p.24: base × TL band × efficiency × 2^power packs × the tactical speed penalty,
     * multiplicative and in that order, rounded to the nearest hour.
     */
    get enduranceHours() {
        const base = this.primaryLocomotion?.endurance ?? 0;
        const tl = ENDURANCE_TL.find(band => this.tl >= band.minTL)?.factor ?? 1;
        const efficiency = this.endurance.efficiency ? EFFICIENCY_FACTOR : 1;
        const packs = Math.pow(2, this.endurance.powerPacks);
        const steps = 1 - (SPEED_STEP_ENDURANCE * this.speed.tactical);
        return Math.round(base * tl * efficiency * packs * Math.max(0, steps));
    }

    /** The endurance chain written out, so a wrong TL band can be told from a wrong efficiency. */
    get enduranceChain() {
        const tl = ENDURANCE_TL.find(band => this.tl >= band.minTL)?.factor ?? 1;
        return [
            { key: "base", value: this.primaryLocomotion?.endurance ?? 0, on: true },
            { key: "tl", value: tl, on: tl !== 1 },
            { key: "efficiency", value: this.endurance.efficiency ? EFFICIENCY_FACTOR : 1,
                on: this.endurance.efficiency },
            { key: "packs", value: Math.pow(2, this.endurance.powerPacks),
                on: this.endurance.powerPacks > 0 },
            { key: "steps", value: Math.round((1 - (SPEED_STEP_ENDURANCE * this.speed.tactical)) * 100) / 100,
                on: this.speed.tactical !== 0 }
        ];
    }

    /* -------------------------------------------- */
    /*  The slot budget (§5.3)                      */
    /* -------------------------------------------- */

    /**
     * RH p.14, p.32. `slots.base` is the Size table's figure and never moves: it stays the
     * multiplier for every "per Base Slot" cost and every "% of Slots" rounding, even when
     * modifications have changed what is actually available.
     */
    get slotBudget() {
        const base = this.sizeRow.slots;
        const bonus = (this.primaryLocomotionKey === "none") ? NO_LOCOMOTION_BONUS : 0;
        // Rounded up, and the bonus never raises `base` — it is available Slots only (RH p.17).
        const total = Math.ceil(Math.max(0, base - this.slots.removed) * (1 + bonus));

        let used = 0, zeroUsed = 0;
        for (const option of this.options) {
            if (option.zeroSlot) zeroUsed += 1;
            else used += option.slots;
        }
        // Past the Default Suite's allowance every further zero-slot option costs a real Slot
        // (RH p.32), which is what couples the two panels.
        const zeroBudget = ZERO_SLOT_BASE + this.size + this.tl;
        const overrun = Math.max(0, zeroUsed - zeroBudget);
        used += overrun;

        return {
            base, total, used, overrun,
            spare: Math.max(0, total - used),
            over: used > total,
            zero: { budget: zeroBudget, used: zeroUsed, over: zeroUsed > zeroBudget }
        };
    }

    /** RH p.20, p.21, p.26: a "% of Slots" option rounds up and never costs less than one Slot. */
    slotsForPercent(percent, points = 1) {
        return Math.max(1, Math.ceil((percent / 100) * this.sizeRow.slots * points));
    }

    /**
     * What a given number of added Protection points costs in Slots (RH p.20). Two rules, and the
     * book's own StarTek needs both: `6 × 0.4 % × 16` is 0.384 and rounds to one Slot, but a TL 14
     * band holds at most three points per Slot, so six points take two.
     */
    armourSlots(points) {
        const band = this.armourBand;
        if (!band || !(points > 0)) return 0;
        return Math.max(1,
            Math.ceil((band.slotsPerPoint / 100) * this.sizeRow.slots * points),
            Math.ceil(points / band.maxPerSlot));
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /**
     * RH p.14: wrecked at Hits 0, irreparably destroyed at cumulative damage twice its Hits. With
     * the wound stored those are `damage >= max` and `damage >= 2 × max` — **the creature's two
     * expressions** (Core p.86), stated the other way round, so there is no third damage model.
     *
     * Both comparisons are behind `max > 0`: a fresh robot has no Hits until its Size projects them
     * and `0 >= 0` would read as destroyed on creation.
     * @inheritDoc
     */
    get damageStates() {
        const hits = this.characteristics.hits;
        const live = (hits.max > 0) && this.damageChain.includes("hits");
        return {
            ...super.damageStates,
            wrecked: live && (hits.damage >= hits.max),
            destroyed: live && (hits.damage >= (2 * hits.max))
        };
    }

    /**
     * RH p.9, p.14: Size 4 and below is Small, Size 6 and above is Large, and the figure is the same
     * attacker-side ranged DM a creature's size trait carries.
     */
    get attackDM() {
        return this.sizeRow.attackDM;
    }

    /** RH p.15: a Slot is about 3 kg, and a spacecraft ton is 4 Spaces or 256 Slots. */
    get spaces() {
        return this.sizeRow.spaces;
    }

    /** RH p.74: the level a skill package may be bought to; the printed number folds in the DM. */
    get skillLevelCap() {
        return SKILL_LEVEL_CAP;
    }

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /**
     * The four projections. They are things the system computes rather than an author entering, so
     * they land in `auto` exactly as a species modifier does (§9.9) — which is why nothing here is a
     * phase exception: an Active Effect on a robot's STR targets `.effect` in the `initial` phase,
     * like every other characteristic on every other Actor type.
     *
     * Here rather than in `prepareDerivedData` because the base reads `auto` on its first line, and
     * because `super.prepareBaseData()` is what zeroes it.
     * @inheritDoc
     */
    prepareBaseData() {
        super.prepareBaseData();
        const c = this.characteristics;

        // RH p.14, p.21: the Size table's Hits, plus or minus whatever resiliency was bought.
        c.hits.auto = Math.max(0, this.sizeRow.hits + this.resiliency);

        c.strength.auto = this.strongestManipulator?.strength ?? 0;
        c.dexterity.auto = (this.mostDexterousManipulator?.dexterity ?? 0) + this.agilityEnhancement;
        c.endurance.auto = this.travellerEndurance;
        c.intellect.auto = this.brainIntellect + this.brain.intellect;
    }

    /**
     * RH p.116: the greater of 6 or Size, overridden outright by a power pack, +1 for efficiency,
     * and 16 flat off an RTG.
     */
    get travellerEndurance() {
        if (this.endurance.source === "rtg") return TRAVELLER_ENDURANCE.rtg;
        const packs = this.endurance.powerPacks;
        const base = (packs > 0) ? TRAVELLER_ENDURANCE.packs[packs - 1]
            : Math.max(TRAVELLER_ENDURANCE.floor, this.size);
        return base + (this.endurance.efficiency ? TRAVELLER_ENDURANCE.efficiency : 0);
    }

    /** @inheritDoc */
    prepareDerivedData() {
        super.prepareDerivedData();

        this.slots = Object.assign(this.slots, this.slotBudget);
        this.zeroSlot = this.slots.zero;
        this.baseCost = this.baseChassisCost;

        this.speed.metres = this.speedMetres;
        this.speed.band = this.speed.vehicleBand;
        this.#prepareEndurance();
        this.#prepareBrain();

        this.inventory = { armor: 0, weight: 0, encumbrance: { normal: 0, heavy: 0 } };
        this.prepareArmor();
        this.prepareWeight();
        this.prepareEncumbrance();
        this.#prepareArmour();

        // RH p.17, p.24: each mode grants its own traits, and a robot carrying two carries both.
        this.locomotionTraits = [...new Set(this.locomotion
            .flatMap(mode => MGT2.RobotLocomotion[mode.type]?.traits ?? []))];
    }

    #prepareEndurance() {
        const endurance = this.endurance;
        endurance.hours = this.enduranceHours;
        endurance.chain = this.enduranceChain;
        endurance.recharge = RECHARGE_HOURS;
        // "While in use" and not instead of: a robot with Vehicle Speed Movement still has its own
        // figure the rest of the time (RH p.24).
        endurance.vehicleHours = (this.speed.vehicleBand === null)
            ? null : Math.round(endurance.hours / VEHICLE_SPEED_DIVISOR);
    }

    /**
     * The `computer` pattern at a third scale. The brain Item's `processing` is the total Bandwidth
     * when one is present, so a storage module raises it by raising the Item (RH p.68); with no Item
     * the grade's own `Computer/X` stands. Skill packages are `item`/`software` and spend it exactly
     * as a starship's software spends Processing.
     */
    #prepareBrain() {
        const brain = this.brain;
        const item = this.brainItem;

        let used = INTELLECT_BANDWIDTH[brain.intellect] ?? 0;
        const packages = [];
        for (const entry of this.parent.items) {
            if ((entry.type !== "item") || (entry.system.subType !== "software")) continue;
            const bandwidth = entry.system.software.bandwidth ?? 0;
            used += bandwidth;
            packages.push({ _id: entry.id, name: entry.name, bandwidth });
        }

        const inherent = this.inherentBandwidth;
        brain.bandwidth = {
            inherent,
            total: item ? item.system.processing : inherent,
            used,
            // The inherent figure is an absolute limit on any SINGLE package, whatever storage
            // modules have raised the total to (RH p.68).
            oversized: packages.filter(entry => entry.bandwidth > inherent).map(entry => entry.name)
        };
        brain.packages = packages;
        brain.item = item ? { _id: item.id, name: item.name, processing: item.system.processing } : null;
        brain.overload = used > brain.bandwidth.total;
        // RH p.67 reads "for each point of inherent Bandwidth, X zero-level skills", but its own
        // examples make the total equal the inherent figure — a Bandwidth 5 brain gets five, not
        // twenty-five (p.69) — and an upgrade buys none, because only the inherent value counts.
        brain.freeSkills = inherent;
        brain.skillDM = this.brainRow.skillDM ?? 0;
        // An Advanced or better brain simply cannot attempt a task above this difficulty, and the
        // ceiling survives every INT upgrade (RH p.66, p.67, p.116).
        brain.taskCeiling = this.brainRow.taskCeiling ?? "";
        brain.taskCeilingTarget = brain.taskCeiling
            ? (MGT2.DifficultyTargets[brain.taskCeiling] ?? null) : null;
        // RH p.116: EDU equals INT for package skills and is otherwise capped at what Bandwidth the
        // INT upgrades left. A cap is not a value, so it is shown beside the authored score.
        brain.educationCap = Math.max(0, brain.bandwidth.total - (INTELLECT_BANDWIDTH[brain.intellect] ?? 0));
    }

    /**
     * RH p.20: a robot has a base Protection from its TL band, and the design buys more on top. The
     * printed `Armour (+X)` trait is the **total** — the StarTek prints +10 at TL 14, where the band
     * gives +4 and six points were bought — so the trait wins outright wherever one is written and
     * the band answers only when none is. Adding both would double-count every transcription.
     */
    #prepareArmour() {
        const band = this.armourBand;
        const printed = MGT2Helper.hasTrait(this.traits, "armour");
        if (!printed) this.inventory.armor += band?.protection ?? 0;
        this.armour = {
            band: band?.label ?? "",
            base: band?.protection ?? 0,
            maxAdded: band?.maxAdded ?? 0,
            slotsPerPoint: band?.slotsPerPoint ?? 0,
            costPerSlot: band?.costPerSlot ?? 0,
            printed
        };
    }

    /* -------------------------------------------- */
    /*  Document Lifecycle                          */
    /* -------------------------------------------- */

    /**
     * RH p.27: two manipulators at the robot's own Size come free, so a blank robot starts with the
     * pair rather than with none — and their scores are the formulas' output, which is exactly the
     * starting point the design rules then let a builder buy up from.
     * @inheritDoc
     */
    /**
     * The six are declared on every robot and hidden until the flag is set (§1.3). `show` is what
     * carries that: it gates the characteristics column, the roll prompt's dropdown and the config
     * dialog alike, and none of the three has any business knowing what a robot is.
     */
    travellerSource(enabled) {
        const characteristics = {};
        for (const key of RobotData.TRAVELLER_KEYS) characteristics[key] = { show: enabled };
        return { characteristics };
    }

    /** @inheritDoc */
    async _preCreate(data, options, user) {
        const source = { system: this.travellerSource(this.traveller.enabled) };
        if (!data.system?.manipulators?.length) {
            source.system.manipulators = [{
                count: 2, size: this.size,
                strength: manipulatorStrength(this.size),
                dexterity: manipulatorDexterity(this.tl)
            }];
        }
        // A robot is a thing on the map that several of may be dropped at once, and each takes its
        // own damage; the flag makes a robot player character the exception the referee sets.
        if (data.prototypeToken?.actorLink === undefined) source.prototypeToken = { actorLink: false };
        this.parent.updateSource(source);
    }

    /**
     * Setting the flag reveals the six in the same update. Without this the checkbox would change a
     * boolean and nothing else, since `_preCreate` is the only other place `show` is written.
     * @inheritDoc
     */
    async _preUpdate(changes, options, user) {
        const enabled = changes.system?.traveller?.enabled;
        if ((enabled === undefined) || (enabled === this.traveller.enabled)) return;
        changes.system = foundry.utils.mergeObject(this.travellerSource(enabled), changes.system);
    }
}
