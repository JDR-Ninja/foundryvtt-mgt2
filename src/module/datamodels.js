// https://foundryvtt.com/article/system-data-models/
// https://foundryvtt.com/api/classes/foundry.data.fields.NumberField.html
// https://foundryvtt.com/api/v10/classes/foundry.data.fields.DataField.html
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { buildTraitMap, createTraitsField, migrateTraitArray } from "./traits.js";

const fields = foundry.data.fields;

class ItemBaseData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {
            description: new fields.StringField({ required: false, blank: true, trim: true, nullable: true }),
            subType: new fields.StringField({ required: false, blank: false, nullable: true })
        };

        return schema;
    }
}

class PhysicalItemData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();
        schema.quantity = new fields.NumberField({ required: true, initial: 1, min: 0, integer: true });
        schema.weight = new fields.NumberField({ required: true, initial: 0, min: 0, integer: false });
        schema.weightless = new fields.BooleanField({ required: false, initial: false });
        schema.cost = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });
        schema.tl = new fields.StringField({ required: true, blank: false, initial: "TL12" });
        // The Law Level at which the item becomes restricted (Core p.255, CSC p.4).
        schema.legality = new fields.NumberField({ required: false, initial: 9, min: 0, integer: true });
        schema.container = new fields.SchemaField({
            id: new fields.StringField({ required: false, blank: true })
        });

        schema.roll = new fields.SchemaField({
            characteristic: new fields.StringField({ required: false, blank: true, trim: true }),
            skill: new fields.StringField({ required: false, blank: true, trim: true }),
            difficulty: new fields.StringField({ required: false, blank: true, trim: true })
        });


        return schema;
    }
}

export class ItemData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();
        schema.subType.initial = "loot";
        schema.software = new fields.SchemaField({
            bandwidth: new fields.NumberField({ required: false, initial: 0, min: 0, max: 10, integer: true }),
            effect: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            computerId: new fields.StringField({ required: false, blank: true, initial: "" })
        });
        return schema;
    }
}

export class EquipmentData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();
        // augment, clothes
        schema.equipped = new fields.BooleanField({ required: false, initial: false });

        schema.augment = new fields.SchemaField({
            improvement: new fields.StringField({ required: false, blank: true, trim: true })
        });

        schema.subType.initial = "equipment"; // augment, clothing, trinket, toolkit, equipment

        return schema;
    }
}

export class DiseaseData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();
        schema.subType.initial = "disease"; // disease;poison
        schema.difficulty = new fields.StringField({ required: true, initial: "Average" });
        schema.damage = new fields.StringField({ required: false, blank: true });
        // The named condition, third of the four slots the Poison and Diseased traits print. It
        // holds the referee's own word — `paralysis` — and never what that word does.
        schema.effect = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.interval = new fields.StringField({ required: false, blank: true });
        return schema;
    }
}

export class CareerData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.difficulty = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });
        schema.damage = new fields.StringField({ required: false, blank: true });
        schema.interval = new fields.StringField({ required: false, blank: true });

        schema.assignment = new fields.StringField({ required: false, blank: true });
        schema.terms = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.rank = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.events = new fields.ArrayField(
            new fields.SchemaField({
                age: new fields.NumberField({ required: false, integer: true }),
                description: new fields.StringField({ required: false, blank: true, trim: true })
            })
        );

        return schema;
    }
}

export class TalentData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.subType.initial = "skill";
        schema.cost = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true })
        schema.level = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true })
        schema.skill = new fields.SchemaField({
            speciality: new fields.StringField({ required: false, blank: true, trim: true }),
            reduceEncumbrance: new fields.BooleanField({ required: false, initial: false })
        });

        schema.psionic = new fields.SchemaField({
            reach: new fields.StringField({ required: false, blank: true, trim: true }),
            cost: new fields.NumberField({ required: false, initial: 1, min: 0, integer: true }),
            duration: new fields.StringField({ required: false, blank: true, trim: true }),
            durationUnit: new fields.StringField({ required: false })
        });

        schema.roll = new fields.SchemaField({
            characteristic: new fields.StringField({ required: false, blank: true, trim: true }),
            skill: new fields.StringField({ required: false, blank: true, trim: true }),
            difficulty: new fields.StringField({ required: false, blank: true, trim: true })
        });

        return schema;
    }
}

export class ContactData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.subType.initial = "contact";
        schema.cost = new fields.NumberField({ required: true, initial: 1, min: 0, integer: true })

        schema.skill = new fields.SchemaField({
            speciality: new fields.StringField({ required: false, blank: true, trim: true }),
            characteristic: new fields.StringField({ required: false, blank: true, trim: true })
        });

        schema.status = new fields.StringField({ required: false, blank: true, trim: true, initial: "Alive" });
        schema.attitude = new fields.StringField({ required: false, blank: true, trim: true, initial: "Unknow" });
        schema.relation = new fields.StringField({ required: false, blank: true, trim: true, initial: "Contact" });
        schema.title = new fields.StringField({ required: false, blank: true, trim: true });
        schema.nickname = new fields.StringField({ required: false, blank: true, trim: true });
        schema.species = new fields.StringField({ required: false, blank: true, trim: true });
        schema.gender = new fields.StringField({ required: false, blank: true, trim: true });
        schema.pronouns = new fields.StringField({ required: false, blank: true, trim: true });
        schema.homeworld = new fields.StringField({ required: false, blank: true, trim: true });
        schema.location = new fields.StringField({ required: false, blank: true, trim: true });
        schema.occupation = new fields.StringField({ required: false, blank: true, trim: true });
        schema.notes = new fields.HTMLField({ required: false, blank: true, trim: true });

        return schema;
    }
}

export class WeaponData extends PhysicalItemData {
    /** Traits were `{name, description}`; a weapon's speak the `weapon` vocabulary. @inheritDoc */
    static migrateData(source, options) {
        migrateTraitArray(source.traits, "weapon");
        migrateTraitArray(source.options, "custom");
        // `range.unit` was a free string and now validates against MGT2.MetricRange, so a value
        // the vocabulary does not have would fail on load. The scale already decides which unit a
        // weapon speaks, so an unrecognised one is corrected from it rather than dropped.
        if (source.range?.unit && !(source.range.unit in MGT2.MetricRange)) {
            source.range.unit = MGT2.WeaponScales[source.scale]?.range ?? "meter";
        }
        return super.migrateData(source, options);
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.traits);
        // Core folio 77: the magazine is "how many shots can be fired before reloading is
        // necessary", so what is left in it is only a number where there is a magazine at all.
        // A stored count above a magazine that has since been lowered reads as full.
        this.ammo = (this.magazine > 0)
            ? Math.min(this.magazine, this.loaded ?? this.magazine) : 0;
    }

    static defineSchema() {
        const schema = super.defineSchema();
        schema.equipped = new fields.BooleanField({ required: false, initial: false });
        schema.range = new fields.SchemaField({
            isMelee: new fields.BooleanField({ required: false, initial: false }),
            value: new fields.NumberField({ required: false, integer: true, nullable: true }),
            unit: new fields.StringField({
                required: false, blank: true, nullable: true, choices: MGT2.MetricRange }),
            // Core p.165-167: a spacecraft weapon is printed with the furthest RANGE BAND it
            // reaches, not with a Range score, so the personal quarter/once/twice/four-times rule
            // is the wrong one for it. Blank on a ground weapon, which has no band.
            band: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.ShipRangeBands })
        });
        schema.damage = new fields.StringField({ required: false, blank: true, trim: true });
        // Companion p.93-94. A set because the printed vocabulary is not a partition — "blades" and
        // "stabbing" overlap — and empty because no book types every weapon: an empty set means a
        // defender's damage transform applies, and guessing a type would be inventing a rule.
        schema.damageType = new fields.SetField(
            new fields.StringField({ required: true, blank: false, choices: MGT2.DamageTypes }),
            { required: false, initial: [] });
        schema.magazine = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.magazineCost = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        // What is in the weapon, against the capacity above. **Nullable, and null means full**: a
        // weapon nobody has fired is loaded, so every transcribed weapon keeps working and nothing
        // had to be migrated. Core folio 77 makes a reload a whole spare magazine, so the reload
        // control writes the capacity back rather than counting rounds in.
        schema.loaded = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        // One enum selects which range vocabulary the weapon speaks and which accuracy fields it
        // has (Core p.139, p.142; VH p.45), instead of a vehicleWeapon type duplicating the whole
        // roll path. The keys are MGT2.Scales', so the value drops straight into the damage
        // pipeline's cross-scale step.
        schema.scale = new fields.StringField({
            required: false, blank: false, initial: "ground", choices: MGT2.WeaponScales });
        // The vehicle and spacecraft accuracy grade, which stands in for a scope (VH p.45).
        schema.fireControl = new fields.NumberField({ required: false, initial: 0, min: 0, max: 4, integer: true });
        // A spacecraft weapon draws against the ship's power budget (HG p.26).
        schema.power = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        // A creature's Claw or Charge is a weapon it cannot drop, store or be disarmed of.
        schema.natural = new fields.BooleanField({ required: false, initial: false });
        schema.traits = createTraitsField("weapon");
        // Accessories, not traits: no family in the registry covers them, so they declare `custom`.
        schema.options = createTraitsField("custom");

        return schema;
    }
}

export class ArmorData extends PhysicalItemData {
    /** protection was a StringField; blank and non-numeric values become 0. @inheritDoc */
    static migrateData(source, options) {
        if (typeof source.protection === "string") {
            const value = Number.parseInt(source.protection, 10);
            source.protection = Number.isFinite(value) && value > 0 ? value : 0;
        }
        migrateTraitArray(source.options, "custom");
        return super.migrateData(source, options);
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.options);
    }

    static defineSchema() {
        const schema = super.defineSchema();
        schema.equipped = new fields.BooleanField({ required: false, initial: false });
        schema.radiations = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.protection = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });

        // Some armours have a required skill. A Traveller suffers DM-1 to all checks taken in the armour per missing
        // skill level. For example, a Traveller with Vacc Suit skill 0 who is in a suit that requires Vacc Suit 2 would have
        // DM-2 to all their checks. Not having the skill at all inflicts the usual DM-3 unskilled penalty instead.
        schema.requireSkill = new fields.StringField({ required: false, blank: false });
        schema.requireSkillLevel = new fields.NumberField({ required: false, min: 0, integer: true });


        // As powered armour, battle dress supports its own weight. While powered and active, the mass of battle dress
        // does not count against the encumbrance of the wearer and is effectively weightless.
        schema.powered = new fields.BooleanField({ required: false, initial: false });
        schema.options = createTraitsField("custom");

        // Characteristics Modifiers (Pirate of Drinax - ASLAN BATTLE DRESS STR/DEX, Slot)

        return schema;
    }
}

export class ComputerData extends PhysicalItemData {
    /** @inheritDoc */
    static migrateData(source, options) {
        migrateTraitArray(source.options, "custom");
        return super.migrateData(source, options);
    }

    /** Derived by the owning actor; reset here so a loose computer still reads sanely. */
    prepareBaseData() {
        this.processingUsed = 0;
        this.overload = false;
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.options);
    }

    static defineSchema() {
        const schema = super.defineSchema();

        schema.processing = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.options = createTraitsField("custom");

        return schema;
    }
}

export class SpeciesData extends foundry.abstract.TypeDataModel {
    /** @inheritDoc */
    static migrateData(source, options) {
        migrateTraitArray(source.traits, "species");
        return super.migrateData(source, options);
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.traits);
    }

    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {
            description: new fields.StringField({ required: false, blank: true, trim: true, nullable: true }),
            descriptionLong: new fields.HTMLField({ required: false, blank: true, trim: true }),
            traits: createTraitsField("species"),
            modifiers: new fields.ArrayField(
                new fields.SchemaField({
                    characteristic: new fields.StringField({ required: false, blank: true, trim: true }),
                    value: new fields.NumberField({ required: false, integer: true, nullable: true })
                })
            )
        };

        return schema;
    }
}

export class ItemContainerData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.onHand = new fields.BooleanField({ required: false, initial: false });
        schema.location = new fields.StringField({ required: false, blank: true, trim: true });
        schema.weightless = new fields.BooleanField({ required: false, initial: false });
        // A container is stored like anything else: a bag inside a bag is the same reference.
        schema.container = new fields.SchemaField({
            id: new fields.StringField({ required: false, blank: true })
        });

        schema.locked = new fields.BooleanField({ required: false, initial: false }); // GM only
        schema.lockedDescription = new fields.StringField({ required: false, blank: true, trim: true, nullable: true });
        return schema;
    }

    /**
     * A container has no mass of its own: what it weighs is what is in it. Read at each access
     * rather than derived once, because the contents are sibling documents — on a world load the
     * container is built before the items pointing at it exist.
     * @type {number}
     */
    get weight() {
        return this.parent.getContentsWeight();
    }

    /** Direct contents only: a nested container counts as the one thing it is. @type {number} */
    get count() {
        return this.parent.contents.reduce((sum, item) => sum + (item.system.quantity ?? 1), 0);
    }
}

/**
 * A station on a ship, not a person in it. An Item rather than a config enum for one reason: the
 * eight combat duties are a closed list (Core p.164) but the stations are not, and a referee should
 * be able to add a Flight Deck Chief without a system release.
 *
 * The station carries its own actions, which is what the crew roster's buttons are built from.
 */
export class RoleData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.positions = new fields.NumberField({ required: false, initial: 1, min: 0, integer: true });
        // Which row of HG p.23's Crew Requirements table this station is. Blank is legitimate — a
        // referee's "Flight Deck Chief" answers to no printed position — but when it is set it is
        // the only locale-independent handle on the station: the name is whatever the user typed,
        // in whatever language, and `department` is too coarse (one `flight` holds pilot,
        // astrogator and navigator alike).
        schema.crewRole = new fields.StringField({
            required: false, blank: true, initial: "", choices: MGT2.CrewRoles });
        schema.department = new fields.StringField({
            required: false, blank: false, initial: "command", choices: MGT2.Departments });
        // HG p.23 prints a monthly average for a skill-1 crewman; the eleven construction roles
        // ship as names AND numbers, and this is the number.
        schema.salary = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.colour = new fields.ColorField({ required: false, nullable: true, initial: null });
        schema.show = new fields.BooleanField({ required: false, initial: true });

        schema.actions = new fields.ArrayField(new fields.SchemaField({
            label: new fields.StringField({ required: false, blank: true, trim: true }),
            // `skill` needs a sheet to read the level off, so the roster refuses it on a vacant or
            // unstatted slot; `special` is a referee's call and is always offered.
            kind: new fields.StringField({
                required: false, blank: false, initial: "skill", choices: MGT2.RoleActions }),
            // Both were free strings, and `characteristic` had no control on the item sheet at
            // all — so `actor.system.characteristics[action.characteristic]` never resolved and
            // every station action silently rolled with a characteristic DM of zero.
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            skill: new fields.StringField({ required: false, blank: true, trim: true }),
            difficulty: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Difficulty }),
            dm: new fields.NumberField({ required: false, initial: 0, integer: true }),
            // Core p.164: which of the round's three steps this action belongs to. It is what lets
            // a screen render the actions that are legal now instead of greying the rest.
            step: new fields.StringField({
                required: false, blank: true, initial: "actions", choices: MGT2.CombatSteps }),
            // And how often it may be taken, which the rules set per action rather than per kind.
            cap: new fields.StringField({
                required: false, blank: true, initial: "none", choices: MGT2.ActionCaps })
        }), { initial: [] });

        return schema;
    }

    /**
     * The station's construction position, stored key first. The fallback reads the Item's own name
     * against both the config key and its *localised* label, so a station a French world called
     * "Pilote" still answers — but it is only ever a fallback, because a name is user text and
     * "Chief Pilot" matches nothing. Whatever reads this must tolerate an empty string.
     */
    prepareDerivedData() {
        this.crewRoleKey = this.crewRole || RoleData.matchCrewRole(this.parent?.name);
    }

    /** @returns {string}   A key of `MGT2.CrewRoles`, or "" when the name answers to none. */
    static matchCrewRole(name) {
        const slug = MGT2Helper.skillSlug(name);
        if ( !slug ) return "";
        return Object.keys(MGT2.CrewRoles).find(key => (MGT2Helper.skillSlug(key) === slug)
            || (MGT2Helper.skillSlug(game.i18n.localize(MGT2.CrewRoles[key].label)) === slug)) ?? "";
    }
}
