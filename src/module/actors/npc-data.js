import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { ActorBaseData, createCharacteristicField, withPersonal } from "./actor-base-data.js";
import { createTraitsField } from "../traits.js";

const fields = foundry.data.fields;

/**
 * Schema and behaviour of the `npc` Actor sub-type — a person and a creature at once.
 * @extends {ActorBaseData}
 */
export class NpcData extends ActorBaseData {

    // Core folio 77: "Damage is initially applied to a target's END", and only the excess reaches
    // STR or DEX.
    static DEFAULT_DAMAGE_ORDER = ["endurance", "strength", "dexterity"];

    static DEFAULT_INITIATIVE = "dexterity";

    static STUN_LINK = "endurance";

    static MENTAL_LINKS = ["intellect", "education"];

    // `MGT2.Actor.npc.FIELDS` fills in `field.label` and `.hint`.
    static LOCALIZATION_PREFIXES = ["MGT2.Actor.npc"];

    /** The six the core rulebook defines, in the order the UPP prints them. */
    static UPP_ORDER = ["strength", "dexterity", "endurance", "intellect", "education", "social"];

    /** What each preset is. Everything else about the two is the same. */
    static PRESETS = Object.freeze({
        person: {
            show: ["strength", "dexterity", "endurance", "intellect", "education", "social"],
            // The constant rather than a second literal: the two said different things for a
            // release, and the schema initial and the preset have to be the same chain.
            damageOrder: this.DEFAULT_DAMAGE_ORDER,
            initiative: { characteristic: "dexterity", flat: 0 },
            actorLink: true
        },
        creature: {
            show: ["hits"],
            damageOrder: ["hits"],
            initiative: { characteristic: "", flat: 0 },
            actorLink: false
        }
    });

    static defineSchema() {
        const schema = super.defineSchema();
        // A creature's traits are the animal vocabulary; `traitFamily` below moves a person's back
        // to the species one, which is the only thing the stored `family` initial decides.
        schema.traits = createTraitsField("animal");

        Object.assign(schema, withPersonal(), {
            subType: new fields.StringField({
                required: true, blank: false, initial: "person", choices: MGT2.NpcSubTypes }),
            biography: new fields.HTMLField({ required: false, blank: true, trim: true }),

            characteristics: new fields.SchemaField({
                strength: createCharacteristicField(true),
                dexterity: createCharacteristicField(true),
                endurance: createCharacteristicField(true),
                intellect: createCharacteristicField(true),
                education: createCharacteristicField(true),
                social: createCharacteristicField(true),
                morale: createCharacteristicField(false),
                luck: createCharacteristicField(false),
                sanity: createCharacteristicField(false),
                charm: createCharacteristicField(false),
                psionic: createCharacteristicField(false),
                other: createCharacteristicField(false),
                reputation: createCharacteristicField(false),
                // Core p.85 calls this "the Hits characteristic" in its own words, which is why it
                // sits in the record rather than beside it: `damageOrder`, `life`, the token bar
                // and the chain editor then need no special case.
                hits: createCharacteristicField(false)
            }),

            // Core p.84: how far the animal moves with one Minor Action. 6 m is a human's Movement
            // (p.75).
            speed: new fields.SchemaField({
                ground: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 6 }),
                swim: new fields.NumberField({ required: false, nullable: true, min: 0, initial: null }),
                fly: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, max: 10, initial: null }),
                note: new fields.StringField({ required: false, blank: true, trim: true })
            }),

            // Core p.89-90. The two are independent: the published statblocks pair them freely —
            // Carnivore, Grazer (p.87) is not a row of the Fight or Flight table — so the reaction
            // lookup keys on `pattern` alone and `diet` is flavour.
            behaviour: new fields.SchemaField({
                diet: new fields.StringField({ required: false, blank: true, initial: "", choices: MGT2.Diets }),
                pattern: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Reactions })
            }),

            role: new fields.StringField({ required: false, blank: true, trim: true }),
            attitude: new fields.StringField({
                required: false, blank: true, initial: "Unknow", choices: MGT2.Attitudes }),

            // Core p.92, the other axis of the Experience ladder being `combatant`.
            experience: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.ExperienceLevels }),
            combatant: new fields.BooleanField({ required: false, initial: false }),

            // No statblock prints a number appearing.
            group: new fields.SchemaField({
                count: new fields.SchemaField({
                    value: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 1 }),
                    max: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 1 })
                })
            }),

            states: new fields.SchemaField({
                fatigue: new fields.BooleanField({ required: false, initial: false })
            })
        });

        // The printed identity code is kept here and derived on `character`: a referee transcribing
        // an NPC has the code and may never type the six characteristics.
        schema.personal.extendFields({
            ucp: new fields.StringField({ required: false, blank: true, trim: true })
        });
        return schema;
    }

    /** @inheritDoc */
    get traitFamily() {
        return this.subType === "creature" ? "animal" : "species";
    }

    /**
     * Core p.85, restated p.84: four states off one number, because the wound is what is stored.
     * @inheritDoc
     */
    damageStatesFor(characteristics) {
        const hits = characteristics.hits;
        if (!(hits.max > 0) || !this.damageChain.includes("hits")) return super.damageStatesFor(characteristics);
        return {
            // "at the referee's option" — reported, never acted on.
            drivenOff: hits.damage >= (hits.max / 2),
            unconscious: hits.damage >= (0.9 * hits.max),
            dead: hits.damage >= hits.max,
            destroyed: hits.damage >= (2 * hits.max)
        };
    }

    /** The creature ladder names four rungs and the dialog states all of them. @inheritDoc */
    get damageStateLabels() {
        return (this.subType === "creature")
            ? {
                drivenOff: "MGT2.Actor.npc.DrivenOff",
                unconscious: "MGT2.Actor.Unconscious",
                dead: "MGT2.Actor.Dead",
                destroyed: "MGT2.Actor.npc.Destroyed"
            }
            : super.damageStateLabels;
    }

    /**
     * Core p.84 gives a creature no STR at all, so its melee attacks add nothing: the Animal Size
     * ladder (p.89) is what stands in for the STR DM every other attacker adds.
     * @inheritDoc
     */
    get meleeDamageDM() {
        return (this.subType === "creature") ? 0 : super.meleeDamageDM;
    }

    /**
     * Core p.84: a Stun weapon incapacitates an animal once the cumulative damage it has dealt
     * reaches half its Hits — where a Traveller's comes off END alone (p.79).
     */
    get stunIncapacitated() {
        const hits = this.characteristics.hits;
        return (hits.max > 0) && this.damageChain.includes("hits") && (this.stun >= (hits.max / 2));
    }

    /**
     * The size DM the creature carries, attacker-side: "all ranged attacks made against the animal
     * gain a DM equal to the score" (Core p.85).
     */
    get sizeDM() {
        return MGT2Helper.traitScore(this.traits, "large")
            - Math.abs(MGT2Helper.traitScore(this.traits, "small"));
    }

    /** The Animal Size row the stored Hits fall in (Core p.89). */
    get sizeBand() {
        const hits = this.characteristics.hits.max;
        if (!(hits > 0)) return null;
        return Object.values(MGT2.AnimalSize)
            .find(band => (hits >= band.min) && ((band.max === null) || (hits <= band.max))) ?? null;
    }

    /** The Experience row (Core p.92) the stored level and combatant flag name together. */
    get experienceRow() {
        if (!this.experience) return null;
        const key = `${this.experience}${this.combatant ? "Combatant" : "NonCombatant"}`;
        return MGT2.Experience[key] ?? null;
    }

    /** @inheritDoc */
    prepareDerivedData() {
        super.prepareDerivedData();

        // Core p.85: Fast Metabolism (+X) "gains a DM to Initiative rolls equal to the figure
        // shown", and its mirror the other way.
        this.initiative += MGT2Helper.traitScore(this.traits, "fast-metabolism")
            - Math.abs(MGT2Helper.traitScore(this.traits, "slow-metabolism"));

        // Fight or Flight (Core p.90), keyed on the pattern alone.
        this.reaction = MGT2.Reactions[this.behaviour.pattern] ?? null;

        this.inventory = { armor: 0, weight: 0, encumbrance: { normal: 0, heavy: 0 } };
        this.prepareArmor();
        this.prepareWeight();
        this.prepareEncumbrance();
        this.prepareCheckModifiers();

        this.states.incapacitated = this.stunIncapacitated;

        // Stored on this type and derived on `character`: a referee transcribing an NPC has
        // a printed code and may never type the six characteristics.
        this.upp = this.personal.ucp?.trim()
            || NpcData.UPP_ORDER.map(key => MGT2Helper.uppDigit(this.characteristics[key].max)).join("");
    }

    /** The preset's own fields, as an update payload. */
    presetSource(subType) {
        const preset = NpcData.PRESETS[subType] ?? NpcData.PRESETS.person;
        const characteristics = {};
        for (const key of this.characteristicKeys) {
            characteristics[key] = { show: preset.show.includes(key) };
        }
        return {
            characteristics,
            config: { damageOrder: [...preset.damageOrder], initiative: { ...preset.initiative } }
        };
    }

    /** @inheritDoc */
    async _preCreate(data, options, user) {
        // A duplicate arrives with its own chain already written; only a blank actor takes the preset.
        if (data.system?.config?.damageOrder) return;
        const preset = NpcData.PRESETS[this.subType] ?? NpcData.PRESETS.person;
        this.parent.updateSource({
            prototypeToken: { actorLink: preset.actorLink },
            system: this.presetSource(this.subType)
        });
    }

    /** Switching the preset re-applies it in the same update. @inheritDoc */
    async _preUpdate(changes, options, user) {
        const subType = changes.system?.subType;
        if (!subType || (subType === this.subType)) return;
        changes.system = foundry.utils.mergeObject(this.presetSource(subType), changes.system);
    }
}
