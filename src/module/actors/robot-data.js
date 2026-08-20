import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { ActorBaseData, createCharacteristicField } from "./actor-base-data.js";
import { createTraitsField } from "../traits.js";

const fields = foundry.data.fields;

/** RH p.7, p.31: the Default Suite pays for this many zero-slot options before Size and TL. */
const ZERO_SLOT_BASE = 5;

/** RH p.16: locomotion `None` adds a quarter to the available Slots without raising Base Slots. */
const NO_LOCOMOTION_BONUS = 0.25;

/** RH p.16, p.22, p.55: 5 m per Minor Action by Agility, capped at 12, halved on sole power. */
const SPEED_BASE = 5;
const SPEED_CAP = 12;
const SOLE_SOURCE_DIVISOR = 2;
const SOLE_SOURCE_AGILITY = -2;

/** RH p.23: Vehicle Speed Movement quarters the endurance while it is in use. */
const VEHICLE_SPEED_DIVISOR = 4;

/** RH p.23: recharging takes eight hours whatever the endurance was. */
const RECHARGE_HOURS = 8;

/** RH p.20: the efficiency option doubles the endurance; a tactical speed step costs a tenth. */
const EFFICIENCY_FACTOR = 2;
const SPEED_STEP_ENDURANCE = 0.1;

/** RH p.67: Bandwidth spent to buy +1, +2 or +3 INT, capped at +3 and costing no Slot. */
const INTELLECT_BANDWIDTH = [0, 1, 3, 6];

/** RH p.73: a robot's stored skill level never exceeds 3; the printed one may, via the DM. */
const SKILL_LEVEL_CAP = 3;

/** RH p.26: `STR = 2 × size − 1`, `DEX = ceil(TL / 2) + 1` — the starting point, not the value. */
const manipulatorStrength = size => Math.max(0, (2 * size) - 1);
const manipulatorDexterity = tl => Math.ceil(tl / 2) + 1;

/** RH folio 106: every 1,000 rads reaching the brain costs INT -1 and Bandwidth -1, for good. */
const RADS_PER_BRAIN_POINT = 1000;

/**
 * RH folio 106: "Basic or Hunter/Killer brains suffer DM-1 on all checks when INT is reduced to 2
 * and DM-2 when INT is reduced to 1." The two grades the sentence names, and the INT it names them
 * at; an Advanced brain's deterioration is a lowered skill the same paragraph leaves to the
 * referee.
 */
const DEGRADED_GRADES = Object.freeze(["basic", "hunterKiller"]);
const DEGRADED_BRAIN_DM = Object.freeze({ 1: -2, 2: -1 });

/** RH p.115: END is the greater of 6 or Size, overridden outright by a power pack. */
const TRAVELLER_ENDURANCE = Object.freeze({ floor: 6, packs: [9, 12, 15], efficiency: 1, rtg: 16 });

/** RH p.19-20: the endurance multiplier for the robot's own Tech Level, best band first. */
const ENDURANCE_TL = Object.freeze([{ minTL: 15, factor: 2 }, { minTL: 12, factor: 1.5 }]);

/** Schema and behaviour of the `robot` Actor sub-type. @extends {ActorBaseData} */
export class RobotData extends ActorBaseData {

    static DEFAULT_DAMAGE_ORDER = ["hits"];

    /** Every robot has manipulators, so the DEX projection is the one score always worth rolling. */
    static DEFAULT_INITIATIVE = "dexterity";

    /** The six the flag reveals, in the order the UPP prints them. */
    static TRAVELLER_KEYS = ["strength", "dexterity", "endurance", "intellect", "education", "social"];

    /** The four the design computes into `auto` on every robot, flag or no flag. */
    static PROJECTED_KEYS = ["strength", "dexterity", "endurance", "intellect"];

    /** RH folio 115: the three the brain's task ceiling reaches, and no others. */
    static CEILING_KEYS = ["intellect", "education", "social"];

    /** None of the three standing states is a robot's. */
    static CHECK_STATES = Object.freeze([]);

    static defineSchema() {
        const schema = super.defineSchema();
        schema.traits = createTraitsField("robot");

        const count = (initial = 0) => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, initial });

        Object.assign(schema, {
            // `hits` carries the whole pool and the six canonical characteristics are declared on
            // every robot but hidden until `traveller.enabled`.
            characteristics: new fields.SchemaField({
                hits: createCharacteristicField(true),
                strength: createCharacteristicField(false),
                dexterity: createCharacteristicField(false),
                endurance: createCharacteristicField(false),
                intellect: createCharacteristicField(false),
                education: createCharacteristicField(false),
                social: createCharacteristicField(false)
            }),

            // The Robot Size table is the spine (RH p.13): one stored number gives Base Slots, Base
            // Hits, the attack DM, Spaces and the basic cost.
            size: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 1, max: 8, initial: 5 }),
            tl: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 12 }),

            slots: new fields.SchemaField({
                // Permanently deleted at design time, −Cr100 each and unrestorable (RH p.13).
                removed: count(0),
                // Declared although derived, so a chassis modification reaching it as a
                // `final`-phase Active Effect is coerced and validated rather than written raw
                //.
                total: count(0)
            }),

            // Options are rows rather than `equipment` Items: a robot option has no use for weight,
            // quantity or an equipped flag.
            options: new fields.ArrayField(new fields.SchemaField({
                name: new fields.StringField({ required: false, blank: true, trim: true }),
                slots: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 1 }),
                zeroSlot: new fields.BooleanField({ required: false, initial: false }),
                note: new fields.StringField({ required: false, blank: true, trim: true })
            }), { initial: [] }),

            // A robot may carry a primary and a secondary mode, each granting its own traits (RH
            // p.23), so this is an array and not an enum — and the primary is what Agility, the
            // base endurance and the chassis cost multiplier all read.
            locomotion: new fields.ArrayField(new fields.SchemaField({
                type: new fields.StringField({
                    required: false, blank: false, initial: "walker", choices: MGT2.RobotLocomotion }),
                primary: new fields.BooleanField({ required: false, initial: false })
            }), { initial: [{ type: "walker", primary: true }] }),

            // `strength` and `dexterity` are stored and not derived: the formulas are the starting
            // point and each limb may be bought up independently (RH p.26).
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
                // of the endurance, a reduction sells one back (RH p.22).
                tactical: new fields.NumberField({
                    required: false, nullable: false, integer: true, initial: 0 }),
                // Vehicle Speed Movement replaces metres with a Speed Band entirely (RH p.23), so
                // the two readouts below are exclusive.
                vehicleBand: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, max: 10, initial: null })
            }),

            endurance: new fields.SchemaField({
                // RTG and solar replace the chain and print a half-life in years (RH p.20, p.76).
                source: new fields.StringField({
                    required: false, blank: false, initial: "internal", choices: MGT2.RobotPower }),
                redundant: new fields.BooleanField({ required: false, initial: false }),
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
                // none of them costs a Slot (RH p.67).
                intellect: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 0, max: 3, initial: 0 }),
                // The `/fib` designation (RH p.67).
                hardened: new fields.BooleanField({ required: false, initial: false }),
                // RH folio 106: the rads that have reached the brain, cumulative and unrepairable.
                rads: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 0, initial: 0 })
            }),

            // One type with a flag, not a chassis Item and not a second sub-type.
            traveller: new fields.SchemaField({
                enabled: new fields.BooleanField({ required: false, initial: false }),
                // SOC is 0 where robots are property and 2D where one is a citizen (RH p.117); this
                // seeds the authored `base` and never overwrites it.
                society: new fields.StringField({
                    required: false, blank: false, initial: "property", choices: MGT2.RobotSociety })
            }),

            // Increased Resiliency buys a point of Hits for a Slot; Decreased Resiliency sells one
            // back (RH p.20).
            resiliency: new fields.NumberField({
                required: false, nullable: false, integer: true, initial: 0 }),
            // The Agility Enhancement the DEX projection adds on top of the manipulator (RH p.115).
            agilityEnhancement: new fields.NumberField({
                required: false, nullable: false, integer: true, initial: 0 }),

            cost: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            owner: new fields.StringField({ required: false, blank: true, trim: true }),
            description: new fields.HTMLField({ required: false, blank: true, trim: true })
        });
        return schema;
    }

    /** The Robot Size row (RH p.13) — Base Slots, Base Hits, the attack DM, Spaces and the cost. */
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

    /** RH p.16: Agility comes from the locomotion type. `None` has none rather than zero. */
    get agility() {
        return this.primaryLocomotion?.agility ?? null;
    }

    /**
     * RH p.16. The denominator for armour reduction, resiliency, efficiency, agility, tactical
     * speed and vehicle speed — a named field, because otherwise five derivations recompute it.
     */
    get baseChassisCost() {
        return this.sizeRow.cost * (this.primaryLocomotion?.costMultiplier ?? 1);
    }

    /** The armour band the robot's Tech Level falls in (RH p.19). */
    get armourBand() {
        return Object.values(MGT2.RobotArmour).find(band =>
            (this.tl >= band.minTL) && ((band.maxTL === null) || (this.tl <= band.maxTL))) ?? null;
    }

    /** The brain's ladder row; `drone` is a printed grade with no row of its own (RH p.208-215). */
    get brainRow() {
        return MGT2.RobotBrains[this.brain.grade] ?? MGT2.RobotBrains.basic;
    }

    /** Which step of the grade the robot's Tech Level buys. */
    get brainStep() {
        const row = this.brainRow;
        if (!row.tl?.length) return -1;
        return Math.min(row.tl.length - 1, Math.max(0, this.tl - row.tl[0]));
    }

    /** RH p.66: `Computer/X` **is** Bandwidth, and it caps any single skill package. */
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
     * The `computer` Item standing in for the brain — the third use of the type, after a
     * Traveller's handcomp and a starship's Computer/25.
     */
    get brainItem() {
        return this.parent.items.find(item => item.type === "computer") ?? null;
    }

    /** RH p.115: STR is the strongest manipulator's, and per check it is the limb actually used. */
    get strongestManipulator() {
        return this.manipulators.reduce((best, limb) =>
            (!best || (limb.strength > best.strength)) ? limb : best, null);
    }

    /** RH p.115: DEX is the most dexterous manipulator's, plus the agility enhancement. */
    get mostDexterousManipulator() {
        return this.manipulators.reduce((best, limb) =>
            (!best || (limb.dexterity > best.dexterity)) ? limb : best, null);
    }

    /** How many limbs there are in total; the rows carry a count each (`2 × (STR 12 DEX 8)`). */
    get manipulatorCount() {
        return this.manipulators.reduce((total, limb) => total + limb.count, 0);
    }

    /** RH p.55: RTG or solar alone degrades the robot; a second such unit clears it. */
    get soleSourcePower() {
        return (this.endurance.source !== "internal") && !this.endurance.redundant;
    }

    /** RH p.16, p.22, p.55: 5 m by Agility and tactical, halved and -2 on sole power. */
    get speedMetres() {
        if ((this.speed.vehicleBand !== null) || (this.agility === null)) return null;
        const metres = SPEED_BASE + this.agility + this.speed.tactical;
        const rate = this.soleSourcePower
            ? Math.floor(metres / SOLE_SOURCE_DIVISOR) + SOLE_SOURCE_AGILITY : metres;
        return Math.max(0, Math.min(SPEED_CAP, rate));
    }

    /**
     * RH p.19-20, p.23: base × TL band × efficiency × 2^power packs × the tactical speed penalty,
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

    /**
     * RH p.13, p.31. `slots.base` is the Size table's figure and never moves: it stays the
     * multiplier for every "per Base Slot" cost and every "% of Slots" rounding, even when
     * modifications have changed what is actually available.
     */
    get slotBudget() {
        const base = this.sizeRow.slots;
        const bonus = (this.primaryLocomotionKey === "none") ? NO_LOCOMOTION_BONUS : 0;
        // Rounded up, and the bonus never raises `base` — it is available Slots only (RH p.16).
        const total = Math.ceil(Math.max(0, base - this.slots.removed) * (1 + bonus));

        let used = 0, zeroUsed = 0;
        for (const option of this.options) {
            if (option.zeroSlot) zeroUsed += 1;
            else used += option.slots;
        }
        // Past the Default Suite's allowance every further zero-slot option costs a real Slot (RH
        // p.31), which is what couples the two panels.
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

    /**
     * RH p.13: wrecked at Hits 0, irreparably destroyed at cumulative damage twice its Hits.
     * @inheritDoc
     */
    damageStatesFor(characteristics) {
        const hits = characteristics.hits;
        const live = (hits.max > 0) && this.damageChain.includes("hits");
        return {
            // Never unconscious and never dead; false rather than absent clears a stale icon.
            unconscious: false,
            dead: false,
            wrecked: live && (hits.damage >= hits.max),
            destroyed: live && (hits.damage >= (2 * hits.max)),
            // RH folio 106: "Robots reduced to INT 0 are inoperable" — reduced, so a grade that
            // never had an INT to lose (a drone brain) is not one of them.
            inoperable: (this.radiationLoss > 0) && (characteristics.intellect.value <= 0)
        };
    }

    /**
     * A robot is wrecked and then destroyed; it is never unconscious and never dead.
     * @inheritDoc
     */
    get damageStateLabels() {
        return { wrecked: "MGT2.Actor.robot.Wrecked", destroyed: "MGT2.Actor.robot.Destroyed" };
    }

    /**
     * RH p.8, p.13: Size 4 and below is Small, Size 6 and above is Large, and the figure is the
     * same attacker-side ranged DM a creature's size trait carries.
     */
    get attackDM() {
        return this.sizeRow.attackDM;
    }

    /** RH p.14: a Slot is about 3 kg, and a spacecraft ton is 4 Spaces or 256 Slots. */
    get spaces() {
        return this.sizeRow.spaces;
    }

    /** RH p.73: the level a skill package may be bought to; the printed number folds in the DM. */
    get skillLevelCap() {
        return SKILL_LEVEL_CAP;
    }

    /**
     * RH folio 8's printed `Hardened` trait — "the robot's brain is immune to ion weapons.
     * @type {boolean}
     */
    get hardened() {
        return (this.brain.hardened === true) || MGT2Helper.hasTrait(this.traits, "hardened");
    }

    /** RH folio 106: "Every 1,000 rads affecting the robot's brain removes INT -1 and Bandwidth -1." */
    get radiationLoss() {
        return Math.floor(this.brain.rads / RADS_PER_BRAIN_POINT);
    }

    /**
     * RH folio 66: "For skills normally modified by INT or EDU, the skill DM of a robot brain is
     * associated with its INT modifier" — and an intellect upgrade raises that DM, which is why the
     * characteristic and not `brain.skillDM` is the number a check reads.
     * @inheritDoc
     */
    get rollableCharacteristics() {
        return [...new Set([...RobotData.PROJECTED_KEYS, ...super.rollableCharacteristics])];
    }

    /**
     * RH folio 115, quoted whole because both qualifications live in the same sentence: "An
     * Advanced brain can only attempt Difficult (10+) and simpler tasks, a Very Advanced brain can
     * attempt Very Difficult (12+) and a Self-Aware brain, Formidable (14+).
     * @inheritDoc
     */
    get taskCeiling() {
        const key = this.brainRow.taskCeiling;
        const target = key ? MGT2.DifficultyTargets[key] : null;
        if (!target) return null;
        return { key, target, grade: this.brainRow.label, characteristics: RobotData.CEILING_KEYS };
    }

    /** The four projections. @inheritDoc */
    prepareBaseData() {
        super.prepareBaseData();
        const c = this.characteristics;

        // RH p.13, p.20: the Size table's Hits, plus or minus whatever resiliency was bought.
        c.hits.auto = Math.max(0, this.sizeRow.hits + this.resiliency);

        const strength = this.strongestManipulator?.strength ?? 0;
        c.strength.auto = this.soleSourcePower
            ? Math.floor(strength / SOLE_SOURCE_DIVISOR) : strength;
        c.dexterity.auto = (this.mostDexterousManipulator?.dexterity ?? 0) + this.agilityEnhancement;
        c.endurance.auto = this.travellerEndurance;
        // RH folio 106's brain damage lands in the same sink and is never written: the folio prices
        // it per 1,000 rads, so it is a reading of the count rather than a step applied once.
        c.intellect.auto = this.brainIntellect + this.brain.intellect - this.radiationLoss;
    }

    /**
     * RH p.115: the greater of 6 or Size, overridden outright by a power pack, +1 for efficiency,
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
        this.prepareCheckModifiers(this.#brainDamageModifiers());

        // RH p.16, p.23: each mode grants its own traits, and a robot carrying two carries both.
        this.locomotionTraits = [...new Set(this.locomotion
            .flatMap(mode => MGT2.RobotLocomotion[mode.type]?.traits ?? []))];
    }

    #prepareEndurance() {
        const endurance = this.endurance;
        endurance.hours = this.enduranceHours;
        endurance.chain = this.enduranceChain;
        endurance.recharge = RECHARGE_HOURS;
        // "While in use" and not instead of: a robot with Vehicle Speed Movement still has its own
        // figure the rest of the time (RH p.23).
        endurance.vehicleHours = (this.speed.vehicleBand === null)
            ? null : Math.round(endurance.hours / VEHICLE_SPEED_DIVISOR);
    }

    /** The `computer` pattern at a third scale. */
    #prepareBrain() {
        const brain = this.brain;
        const item = this.brainItem;

        let used = INTELLECT_BANDWIDTH[brain.intellect] ?? 0;
        const packages = [];
        let downgradesIgnored = 0;
        let freeSkills = 0;
        for (const entry of this.parent.items) {
            if ((entry.type !== "item") || (entry.system.subType !== "software")) continue;
            // The PRINTED figure and never `bandwidthRun`: where Core p.110 lets a Traveller run
            // high-Bandwidth software lower, RH p.67 makes the inherent Bandwidth "an absolute
            // limit on the size of any singular skill package" and RH p.73 says "robot brains
            // cannot process skills that require more than a brain's inherent (not expanded)
            // Bandwidth" — a refusal, not a downgrade, and honouring one here would put `oversized`
            // below out of reach for ever.
            const bandwidth = entry.system.software.bandwidth ?? 0;
            if (entry.system.software.downgraded) downgradesIgnored += 1;
            if (bandwidth === 0) freeSkills += 1;
            used += bandwidth;
            packages.push({ _id: entry.id, name: entry.name, bandwidth });
        }

        // RH folio 106 takes a point of Bandwidth per 1,000 rads off the CORE figure, and says the
        // loss "can be alleviated by installing a new Bandwidth upgrade but this does not heal
        // damage done to the core Bandwidth" — which is exactly what a brain Item already does to
        // the total below, so the loss is subtracted here and the Item's own figure still stands.
        const inherent = Math.max(0, this.inherentBandwidth - this.radiationLoss);
        // RH p.73: "A brain can hold as many Bandwidth 0 level 0 skills as its base brain Bandwidth
        // score; beyond this, additional Bandwidth 0 skills require Bandwidth 1." Countable with no
        // new field, because a brain's software IS its skill packages (RH p.73 is the packages
        // chapter) — so every Bandwidth 0 package here is one of the level 0 skills that sentence
        // counts, and the allowance is the same `inherent` figure `freeSkills` already published.
        const surcharged = Math.max(0, freeSkills - inherent);
        used += surcharged;
        brain.bandwidth = {
            inherent,
            total: item ? item.system.processing : inherent,
            used,
            freeSkillsUsed: freeSkills,
            surcharged,
            // The inherent figure is an absolute limit on any SINGLE package, whatever storage
            // modules have raised the total to (RH p.67).
            oversized: packages.filter(entry => entry.bandwidth > inherent).map(entry => entry.name),
            downgradesIgnored
        };
        brain.packages = packages;
        brain.item = item ? { _id: item.id, name: item.name, processing: item.system.processing } : null;
        brain.overload = used > brain.bandwidth.total;
        // RH p.66 reads "for each point of inherent Bandwidth, X zero-level skills", but its own
        // examples make the total equal the inherent figure — a Bandwidth 5 brain gets five, not
        // twenty-five (p.68) — and an upgrade buys none, because only the inherent value counts.
        brain.freeSkills = inherent;
        brain.skillDM = this.brainRow.skillDM ?? 0;
        // The hardest difficulty the grade may attempt, surviving every INT upgrade (RH folio 115).
        brain.taskCeiling = this.brainRow.taskCeiling ?? "";
        brain.taskCeilingTarget = brain.taskCeiling
            ? (MGT2.DifficultyTargets[brain.taskCeiling] ?? null) : null;
        // RH p.115: EDU equals INT for package skills and is otherwise capped at what Bandwidth the
        // INT upgrades left.
        brain.educationCap = Math.max(0, brain.bandwidth.total - (INTELLECT_BANDWIDTH[brain.intellect] ?? 0));
    }

    /**
     * RH folio 106: a Basic or Hunter/Killer brain whose INT radiation has cut to 2 or 1 takes a DM
     * on **all** checks — so this modifier names no characteristic, the same way fatigue does not.
     */
    #brainDamageModifiers() {
        const dm = ((this.radiationLoss > 0) && DEGRADED_GRADES.includes(this.brain.grade))
            ? (DEGRADED_BRAIN_DM[this.characteristics.intellect.value] ?? 0) : 0;
        return (dm === 0) ? []
            : [{ key: "brainDamage", label: "MGT2.Actor.robot.BrainDamageDM", dm }];
    }

    /** RH p.19: a robot has a base Protection from its TL band, and the design buys more on top. */
    #prepareArmour() {
        const band = this.armourBand;
        const printed = MGT2Helper.hasTrait(this.traits, "armour");
        if (!printed) this.inventory.armor += band?.protection ?? 0;
        this.armour = { base: band?.protection ?? 0, printed };
    }

    /** Two robot-only readings of the Protection a wound meets. @inheritDoc */
    protectionAgainst(options = {}) {
        if (options.ion) return 0;
        const protection = super.protectionAgainst(options);
        return options.stun ? Math.floor(protection / 2) : protection;
    }

    /**
     * The two rules that change what the pipeline *does* rather than what it is handed, so both
     * reduce the wound here and hand the result to the base raw.
     * @returns {Promise<{wound: number, rounds: number, shutdown?: number, immune?: boolean}|undefined>}
     */
    async applyDamage(amount, options = {}) {
        if (options.raw || !(amount > 0) || !(options.ion || options.stun)) {
            return super.applyDamage(amount, options);
        }
        if (options.ion) {
            if (this.hardened) return { wound: 0, rounds: 0, shutdown: 0, immune: true };
            return { wound: 0, rounds: 0, shutdown: this.reduceDamage(amount, options) };
        }
        return super.applyDamage(this.reduceDamage(amount, options),
            { ...options, stun: false, raw: true });
    }

    /**
     * "Radiation weapons cause permanent damage to a robot's brain … A hardened brain halves the
     * effective radiation dose that penetrates this shielding … Every 1,000 rads affecting the
     * robot's brain removes INT -1 and Bandwidth -1. Robots reduced to INT 0 are inoperable." A
     * different ladder from Core folio 81's, reached through the same door: `resolveExposure` is
     * the one notion of a dose arriving, and it has already taken the armour's Rad score off —
     * which is the shielding the halving comes after.
     * @param {number} rads   The dose after the armour deduction
     * @returns {Promise<{dose: number, total: number, lines: string[]}|null>}
     */
    async applyRadiation(rads) {
        const reaching = Math.max(0, Math.trunc(rads) || 0);
        const dose = this.hardened ? Math.floor(reaching / 2) : reaching;
        if (dose === 0) return null;

        // Every figure is read before the write: an update replaces this model instance.
        const total = this.brain.rads + dose;
        const lost = Math.floor(total / RADS_PER_BRAIN_POINT) - this.radiationLoss;
        const lines = [];
        if (dose < reaching) lines.push(game.i18n.format("MGT2.Radiation.Hardened", { reaching, dose }));
        if (lost > 0) lines.push(game.i18n.format("MGT2.Radiation.Brain", { points: lost }));

        await this.parent.update({ "system.brain.rads": total });
        return { dose, total, lines };
    }

    /**
     * RH p.26: two manipulators at the robot's own Size come free, so a blank robot starts with the
     * pair rather than with none — and their scores are the formulas' output, which is exactly the
     * starting point the design rules then let a builder buy up from.
     * @inheritDoc
     */
    /** The six are declared on every robot and hidden until the flag is set. */
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

    /** Setting the flag reveals the six in the same update. @inheritDoc */
    async _preUpdate(changes, options, user) {
        const enabled = changes.system?.traveller?.enabled;
        if ((enabled === undefined) || (enabled === this.traveller.enabled)) return;
        changes.system = foundry.utils.mergeObject(this.travellerSource(enabled), changes.system);
    }
}
