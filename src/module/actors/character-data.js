import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { ActorBaseData, createCharacteristicField, withPersonal } from "./actor-base-data.js";
import { migrateTraitArray } from "../traits.js";

const fields = foundry.data.fields;

/**
 * Schema and behaviour of the `character` Actor sub-type.
 *
 * The document (`TravellerActor`) only forwards to this model — every rule lives here, so a new
 * actor sub-type is a new class rather than another branch in the document.
 *
 * @extends {ActorBaseData}
 */
export class CharacterData extends ActorBaseData {

    // Core p.78: "Damage is initially applied to a target's END", and only the excess reaches STR
    // or DEX. `initial` only — an existing actor keeps the chain it stored.
    static DEFAULT_DAMAGE_ORDER = ["endurance", "strength", "dexterity"];

    static STUN_LINK = "endurance";

    static DEFAULT_INITIATIVE = "dexterity";

    // Core p.84 names INT and EDU as the mental characteristics that heal a point a day, and names
    // PSI as the exception.
    static MENTAL_LINKS = ["intellect", "education"];

    // Core p.56: "A Study Period is equal to eight weeks (or two months) of study and practice."
    static STUDY_PERIOD_WEEKS = 8;

    /** The six the core rulebook defines, in the order the UPP prints them. */
    static UPP_ORDER = ["strength", "dexterity", "endurance", "intellect", "education", "social"];

    static defineSchema() {
        const schema = super.defineSchema();
        schema.config.extendFields({
            psionic: new fields.BooleanField({ required: false, initial: true })
        });

        return Object.assign(schema, withPersonal(), {
            biography: new fields.HTMLField({ required: false, blank: true, trim: true }),

            characteristics: new fields.SchemaField({
                strength: createCharacteristicField(true),
                dexterity: createCharacteristicField(true),
                endurance: createCharacteristicField(true),
                intellect: createCharacteristicField(true),
                education: createCharacteristicField(true),
                social: createCharacteristicField(true),
                // Morale and Sanity have zero occurrences in the core rulebook, and Charm, Luck and
                // Other none either: a new actor does not show them. `initial` only, so an existing
                // actor keeps whatever it stored.
                morale: createCharacteristicField(false),
                luck: createCharacteristicField(false),
                sanity: createCharacteristicField(false),
                charm: createCharacteristicField(false),
                psionic: createCharacteristicField(true),
                other: createCharacteristicField(false)
            }),

            health: new fields.SchemaField({
                radiations: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
            }),
            study: new fields.SchemaField({
                skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                total: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
                completed: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
            }),
            finance: new fields.SchemaField({
                pension: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                credits: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                cashOnHand: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                debt: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                livingCost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                monthlyShipPayments: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                notes: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            }),

            states: new fields.SchemaField({
                fatigue: new fields.BooleanField({ required: false, initial: false }),
                unconscious: new fields.BooleanField({ required: false, initial: false }),
                // The referee's override, kept beside the derived condition below.
                surgeryRequired: new fields.BooleanField({ required: false, initial: false }),
                // Core p.83: first aid "can only be successfully applied once", which no reading of
                // the wound can tell you — so it is stored.
                firstAidUsed: new fields.BooleanField({ required: false, initial: false }),
                // Core p.84: the cumulative DM+1 an unconscious Traveller earns per failed END
                // check, and the wound level the successful one was passed at. -1 is "never".
                reviveFailures: new fields.NumberField({ required: false, nullable: false, initial: 0, min: 0, integer: true }),
                consciousWound: new fields.NumberField({ required: false, nullable: false, initial: -1, integer: true })
            })
        });
    }

    /**
     * Reads the pre-0.2.0 shape three times over. `damages` held three named ranks that could name the
     * same characteristic twice, which applyDamage silently collapsed; the ordered list makes that
     * collapse explicit instead. `MGT2.Characteristics` is the right filter there: it is the
     * twelve-key `character` roster the old field was written against.
     *
     * A characteristic then stored its current value and, on three of the twelve, a maximum; it now
     * stores the score and the wound.
     * @inheritDoc
     */
    static migrateData(source, options) {
        // `personal.traits` moved up to the base model's shared `traits`, and its entries were
        // `{name, description}`. The old key is left where it is: it is inert once the schema no
        // longer declares it, and deleting it here would strand a partial payload.
        if (Array.isArray(source.personal?.traits) && (source.traits === undefined)) {
            source.traits = source.personal.traits.map(t => ({ ...t }));
            migrateTraitArray(source.traits, "species");
        }

        // `config.initiative` was the key of a characteristic and is now that key beside a flat DM.
        // The type test is what makes the shim a no-op on a payload that already carries the pair,
        // and on the partial updates v14 also runs this over.
        if (typeof source.config?.initiative === "string") {
            source.config.initiative = { characteristic: source.config.initiative, flat: 0 };
        }

        const damages = source.config?.damages;
        if (damages && !source.config.damageOrder) {
            source.config.damageOrder = [...new Set(
                [damages.rank1, damages.rank2, damages.rank3].filter(k => k && k in MGT2.Characteristics)
            )];
        }

        // v14 runs migrateData over update payloads as well as stored documents
        // (client-backend.mjs `cleanData(update, {migrate: true})`), and a `-=value` deletion
        // arrives here as an undefined `value` — hence the type test rather than `"value" in c`.
        for (const c of Object.values(source.characteristics ?? {})) {
            if (typeof c?.value !== "number") continue;
            const split = ("base" in c) || ("damage" in c);
            // Nine of the twelve never set a maximum, so `max - value` would read INT 8 as a wound
            // of -8: the score has to be backfilled from the current value first.
            c.base ??= Math.max(c.max ?? 0, c.value);
            // `base` and `damage` are new keys, so either one means the split already ran and was
            // written back. Until the old keys are dropped from the database the `value` beside
            // them is stale, and deriving the wound from it again would undo what has been applied.
            c.damage ??= split ? 0 : c.base - c.value;
            // The stale `value` and `max` are left alone: every prepare overwrites them, whereas
            // deleting them here strands the source whenever the clean is partial, and the next
            // full validation rejects the missing key as undefined.
        }

        return super.migrateData(source, options);
    }

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /**
     * Everything below is recomputed from the characteristics and the carried items on every
     * prepare, so none of it is written to the database and none of it can go stale.
     * Runs after prepareEmbeddedDocuments, so the items are ready.
     * @inheritDoc
     */
    prepareDerivedData() {
        super.prepareDerivedData();

        // The identity code is the six canonical maxima, not a stored string: a typed one and six
        // typed characteristics are two sources of truth for the same fact.
        this.upp = CharacterData.UPP_ORDER
            .map(key => MGT2Helper.uppDigit(this.characteristics[key].max)).join("");

        this.#prepareTreatment();
        this.#prepareStudy();

        this.inventory = { armor: 0, weight: 0, encumbrance: { normal: 0, heavy: 0 } };
        this.prepareArmor();
        this.#prepareContainers();
        this.#prepareComputers();
        this.prepareWeight();
        this.prepareEncumbrance();
        this.#prepareCheckModifiers();
    }

    /* -------------------------------------------- */

    /**
     * The standing DMs a check carries before anything situational. Each stays named beside the
     * accumulator it feeds: the roll prompt prints them and lets the player waive one, which an
     * anonymous `auto` total could not support.
     */
    #prepareCheckModifiers() {
        const sources = [];
        // Core p.81 fatigue, and Core p.99's second encumbrance band.
        if (this.states.fatigue) sources.push({ key: "fatigue", label: "MGT2.Actor.Fatigue", dm: -2 });
        if (this.states.encumbrance) {
            sources.push({ key: "encumbrance", label: "MGT2.Actor.Encumbrance", dm: -2 });
        }
        sources.push(...this.#armorSkillModifiers());

        this.modifiers.check.auto = sources.reduce((sum, source) => sum + source.dm, 0);
        this.modifiers.check.sources = sources;
        this.sumModifiers();
    }

    /**
     * Core p.101: armour with a required skill costs DM-1 to every check per level the wearer is
     * short, and the flat DM-3 unskilled penalty to a wearer who has no such skill at all.
     */
    #armorSkillModifiers() {
        const sources = [];
        for (const item of this.parent.items) {
            if ((item.type !== "armor") || (item.system.equipped !== true)) continue;
            const required = item.system.requireSkill?.trim();
            if (!required) continue;

            const level = this.#skillLevel(required);
            const dm = (level === null) ? -3
                : -Math.max(0, (Math.trunc(item.system.requireSkillLevel) || 0) - level);
            if (dm === 0) continue;
            // Hyphenated, never dotted: the prompt names a form control after this key.
            sources.push({ key: `armor-${item.id}`, label: "MGT2.Actor.ArmorSkill", dm,
                params: { armor: item.name, skill: required } });
        }
        return sources;
    }

    /** The best level in a named skill, or null when the actor does not have that skill at all. */
    #skillLevel(name) {
        let best = null;
        for (const item of this.parent.items) {
            if ((item.type !== "talent") || (item.system.subType !== "skill")) continue;
            if (!MGT2Helper.matchesSkill(item.name, name)) continue;
            best = Math.max(best ?? 0, item.system.level ?? 0);
        }
        return best;
    }

    /* -------------------------------------------- */

    /**
     * Which of the two treatment procedures the patient qualifies for (Core p.83-84). Both gates
     * count the same thing — the damaged links still standing once first aid has been spent — so
     * they derive rather than being ticked. `surgeryRequired` stays stored beside them as the
     * referee's override: it can force the condition on, never off, because a wound taken with no
     * medic in reach is a fact the sheet cannot see.
     */
    #prepareTreatment() {
        const damaged = this.damagedLinks.length;
        const spent = this.states.firstAidUsed;
        this.states.surgeryByRule = spent && (damaged >= 3);
        this.states.needsSurgery = this.states.surgeryRequired || this.states.surgeryByRule;
        // Restoring one of the three to its maximum is what moves the patient here from surgery, so
        // "one or two damaged" covers both routes the rule names.
        this.states.canMedicalCare = spent && (damaged >= 1) && (damaged <= 2);
    }

    /* -------------------------------------------- */

    /**
     * Core p.56: eight weeks make a Study Period, a completed one is settled by an Average (8+) EDU
     * check, and reaching a level costs as many *successful* periods as the level itself — one for a
     * skill the Traveller does not have at all, which the first success grants at level 0.
     *
     * The two stored counters mean nothing apart: weeks answer "when is the check", periods answer
     * "how many more". Neither is a total, so both totals derive from the trained skill instead.
     */
    #prepareStudy() {
        const period = CharacterData.STUDY_PERIOD_WEEKS;
        const level = this.study.skill ? this.#skillLevel(this.study.skill) : null;

        this.study.hasSkill = level !== null;
        this.study.target = (level === null) ? 0 : level + 1;
        this.study.periodsNeeded = Math.max(1, this.study.target);
        this.study.periodsLeft = Math.max(0, this.study.periodsNeeded - this.study.completed);
        this.study.weeksPerPeriod = period;
        this.study.percent = Math.min(100, Math.round((this.study.total / period) * 100));
        this.study.checkDue = this.study.total >= period;
    }

    /* -------------------------------------------- */

    /** Containers aggregate the weight and quantity of whatever references them. */
    #prepareContainers() {
        const containers = new Map();
        for (const item of this.parent.items) {
            if (item.type !== "container") continue;
            item.system.weight = 0;
            item.system.count = 0;
            containers.set(item.id, item);
        }

        for (const item of this.parent.items) {
            if (item.type === "container") continue;
            const container = containers.get(item.system.container?.id);
            if (!container) continue;   // loose, or the container was deleted
            container.system.weight += MGT2Helper.roundWeight(this.itemWeight(item));
            container.system.count += item.system.quantity;
        }
    }

    /** Software occupies bandwidth on the computer it is installed in. */
    #prepareComputers() {
        const computers = new Map();
        for (const item of this.parent.items) {
            if (item.type !== "computer") continue;
            item.system.processingUsed = 0;
            computers.set(item.id, item);
        }

        for (const item of this.parent.items) {
            if (item.type !== "item" || item.system.subType !== "software") continue;
            const computer = computers.get(item.system.software.computerId);
            if (computer) computer.system.processingUsed += item.system.software.bandwidth;
        }

        for (const computer of computers.values()) {
            computer.system.overload = computer.system.processingUsed > computer.system.processing;
        }
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /** Core p.84: 3 + the patient's END DM + the doctor's Medic skill, per day. */
    medicalCarePoints(medic) {
        return 3 + this.enduranceDM + (Math.trunc(medic) || 0);
    }

    /**
     * Core p.84: a day of full rest returns 1D + END DM, but only the END DM while surgery is
     * required — which on a negative DM makes them worse instead. A bare "+0" is not a formula
     * Foundry's parser accepts, so the sign is only ever written beside a die.
     */
    get naturalHealingFormula() {
        const dm = this.enduranceDM;
        if (this.states.needsSurgery) return String(dm);
        return (dm === 0) ? "1d6" : `1d6${MGT2Helper.signed(dm)}`;
    }

    /**
     * Core p.84: medical care and surgery take DM− equal to the Tech Level gap between the facility
     * and the highest *relevant* implant. Which one is relevant is the referee's call and no sheet
     * holds the facility's TL, so this reports the highest an augment carries and nothing more.
     * @returns {{tl: number, name: string}|null}   Null when no augment states one
     */
    get augmentTL() {
        let best = null;
        for (const item of this.parent.items) {
            if ((item.type !== "equipment") || (item.system.subType !== "augment")) continue;
            const tl = Number(/(\d+)/.exec(item.system.tl ?? "")?.[1]);
            if (isNaN(tl)) continue;
            if (!best || (tl > best.tl)) best = { tl, name: item.name };
        }
        return best;
    }

    /** @type {Item[]} */
    get containers() {
        return this.parent.items.filter(i => i.type === "container").sort(MGT2Helper.compareByName);
    }

    /** @type {Item[]} */
    get computers() {
        return this.parent.items.filter(i => i.type === "computer").sort(MGT2Helper.compareByName);
    }

    /* -------------------------------------------- */
    /*  Document Lifecycle                          */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _preCreate(data, options, user) {
        this.parent.updateSource({ prototypeToken: { actorLink: true } }); // QoL
    }

    /**
     * Deleting a container takes its contents with it, and deleting a computer ejects its software.
     * This is a cascade, not derived data, so it stays an explicit write.
     */
    async onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
        const toDeleteIds = [];
        const itemToUpdates = [];

        for (const d of documents) {
            if (d.type === "container") {
                for (const item of this.parent.items) {
                    if (item.system.container?.id === d._id) toDeleteIds.push(item.id);
                }
            } else if (d.type === "computer") {
                for (const item of this.parent.items) {
                    if (item.system.software?.computerId === d._id) {
                        itemToUpdates.push({ _id: item.id, "system.software.computerId": "" });
                    }
                }
            }
        }

        if (toDeleteIds.length > 0) await this.parent.deleteEmbeddedDocuments("Item", toDeleteIds);
        if (itemToUpdates.length > 0) await this.parent.updateEmbeddedDocuments("Item", itemToUpdates);
    }
}
