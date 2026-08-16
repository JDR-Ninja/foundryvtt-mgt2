// https://foundryvtt.com/article/system-data-models/
// https://foundryvtt.com/api/classes/foundry.data.fields.NumberField.html
// https://foundryvtt.com/api/v10/classes/foundry.data.fields.DataField.html
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { buildTraitMap, createTraitsField, migrateTraitArray } from "./traits.js";

const fields = foundry.data.fields;

/**
 * A dice expression — `3D`, `2D+2`, `1D6` — edited through v14's formula editor rather than a bare
 * text box, so the lambda button opens the editor and its `@` autocompletion.
 *
 * The element cannot be asked for from the template: `StringField#_toInput` switches over a closed
 * list of element types and **throws** on anything else (`common/data/fields.mjs:1817`), and
 * `formula-input` is not in it. Declaring it on the field instead keeps every call site as a plain
 * `{{formInput systemFields.damage}}` and puts "this string is a formula" in the schema, where the
 * other renderers can read it too.
 * @extends {fields.StringField}
 */
export class FormulaField extends fields.StringField {

    /** @inheritDoc */
    _toInput(config) {
        // `create` writes the value through `setAttribute`, so a null or undefined would reach the
        // control as the text "null". A blank formula is the empty string.
        config.value = config.value ?? this.getInitialValue({}) ?? "";
        return foundry.applications.elements.HTMLFormulaInputElement.create(config);
    }
}

/**
 * Where the entry is printed (§6.1). Two strings rather than one formatted citation, so a reference
 * can be rendered, sorted and linked; blank on both halves is the normal state and reads as nothing.
 *
 * `page` is a string and never a number: the books print `p.150-152` and `inside back cover` as
 * readily as `79`, and a NumberField would clean all three away without complaining (§1.12).
 *
 * A factory rather than a field on `ItemBaseData` alone, because `SpeciesData` extends
 * `TypeDataModel` directly — the same reason `createTraitsField` is one.
 */
function createSourceField() {
    return new fields.SchemaField({
        book: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        page: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
    });
}

class ItemBaseData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {
            description: new fields.StringField({ required: false, blank: true, trim: true, nullable: true }),
            subType: new fields.StringField({ required: false, blank: false, nullable: true }),
            source: createSourceField()
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

    /**
     * Only an augment carrying Processing ever uses these, but they are reset for every equipment
     * for the reason `ComputerData` gives: the owning actor derives them, so a loose Item has to
     * read sanely without one (§9.84).
     */
    prepareBaseData() {
        this.processingUsed = 0;
        this.overload = false;
    }

    static defineSchema() {
        const schema = super.defineSchema();
        // augment, clothes
        schema.equipped = new fields.BooleanField({ required: false, initial: false });

        // Core p.106's IMPROVEMENTS column holds five incompatible kinds of cell across its
        // twenty-one rows — a characteristic, a skill DM, Protection, computer capacity and prose —
        // so the printed cell stays a string and each computable kind is declared beside it (§9.84).
        // Same shape and same argument as `SpeciesData.modifiers`: a fact of the body while the Item
        // is worn, and gone when it is deleted (§1.2).
        schema.augment = new fields.SchemaField({
            improvement: new fields.StringField({ required: false, blank: true, trim: true }),
            modifiers: new fields.ArrayField(
                new fields.SchemaField({
                    characteristic: new fields.StringField({ required: false, blank: true, trim: true }),
                    value: new fields.NumberField({ required: false, integer: true, nullable: true })
                })
            ),
            // Core p.107 names the skill the table would not: the augment is bought FOR a skill, so
            // the buyer names it. Free text and not a `choices` list, because a skill is an Item in
            // this system and `MGT2Helper.matchesSkill` is what resolves the two.
            skill: new fields.SchemaField({
                name: new fields.StringField({ required: false, blank: true, trim: true }),
                value: new fields.NumberField({ required: false, initial: 0, integer: true })
            }),
            // Core p.107: subdermal armour "stacks with other protection", so this is an additive
            // term over worn armour and never an alternative to an `armor` Item.
            protection: new fields.NumberField({ required: false, initial: 0, integer: true, min: 0 }),
            // Core p.110 glosses `Computer/N` as the Processing score, so this is the same scale as
            // `ComputerData.processing` rather than a unit of its own. A READOUT: software is
            // assigned to a computer Item by id, so nothing runs on this figure — whether a wafer
            // jack should instead BE a `computer` Item is the road §9.84 left open.
            processing: new fields.NumberField({ required: false, initial: 0, integer: true, min: 0 })
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
        schema.damage = new FormulaField({ required: false, blank: true });
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
        schema.damage = new FormulaField({ required: false, blank: true });
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
        // What the weapon is while the loaded round is in it. A DERIVATION and not an Active Effect,
        // and the Foundry source settles it rather than taste: only `Actor` carries
        // `applyActiveEffects` (`client/documents/actor.mjs:212`), so no effect anywhere can change
        // an Item's own data — and a round changes the WEAPON, not the shooter (§9.90).
        this.round = this.#round();
        this.effective = this.#effective();
        // Core folio 77: the magazine is "how many shots can be fired before reloading is
        // necessary", so what is left in it is only a number where there is a magazine at all.
        // A stored count above a magazine that has since been lowered reads as full — which is also
        // what a 40mm grenade does to a rifle, taking the magazine from 40 to 1 (Core p.127).
        this.ammo = (this.effective.magazine > 0)
            ? Math.min(this.effective.magazine, this.loaded ?? this.effective.magazine) : 0;
    }

    /** The round loaded, where the weapon is owned and the id still resolves to one. */
    #round() {
        const round = this.ammunition ? this.parent?.actor?.items.get(this.ammunition) : null;
        return (round?.type === "ammunition") ? round : null;
    }

    /**
     * The weapon's own values with the round's overrides laid over them. Every override is nullable
     * and null means "the weapon's own", so this is four independent substitutions and no
     * discriminator — the shape §6.2 chose for the tonnage triple.
     *
     * The round's **stored** traits are read rather than its `traitMap`: a sibling Item's derived
     * data is not guaranteed prepared when this runs, and the stored array is there from
     * `prepareBaseData` onwards.
     */
    #effective() {
        const round = this.round?.system;
        if (!round) {
            return { damage: this.damage, magazine: this.magazine, magazineCost: this.magazineCost,
                traits: this.traits, traitMap: this.traitMap, rules: [] };
        }
        // CSC p.179-182: a few rounds REPLACE the weapon's trait list rather than adding to it, and
        // nothing in a list of traits could ever have said which — hence the stored boolean.
        const traits = round.replaceTraits
            ? [...(round.traits ?? [])] : [...this.traits, ...(round.traits ?? [])];
        return {
            damage: round.damage || this.damage,
            magazine: round.magazine ?? this.magazine,
            magazineCost: round.magazineCost ?? this.magazineCost,
            traits,
            traitMap: buildTraitMap(traits),
            // "Pellets ignore Dodge and double Protection" — a rule with no trait vocabulary behind
            // it, so it is carried to the sheet as the referee typed it and applied by nobody.
            rules: round.rules ?? []
        };
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
        schema.damage = new FormulaField({ required: false, blank: true, trim: true });
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
        // WHICH round is in it — an `ammunition` Item on the same actor, by id, blank for the
        // weapon's own. A reference and not a flag, because one weapon takes several rounds and a
        // crew carries several magazines of each (§9.90); the same shape `software.computerId` uses.
        schema.ammunition = new fields.StringField({ required: false, blank: true });
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

/**
 * A lot in the hold: a freight consignment, a speculative purchase or a bag of mail.
 *
 * There is no `kind` discriminator, deliberately. A freight lot has a destination and a deadline and
 * a speculative one has neither, so the nullability *is* the discriminator — the same move §6.2
 * makes with the tonnage triple, and one fewer field that can disagree with the others.
 *
 * @extends {ItemBaseData}
 */
export class CargoData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        // Core p.240-241: a lot is rolled as a tonnage and "cannot be broken up".
        schema.tons = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        // The degradation pattern of `crew[]`: a uuid where the world exists as an Actor, a bare
        // name where it does not. Null on a speculative lot, which is bought and not delivered.
        schema.destination = new fields.SchemaField({
            world: new fields.DocumentUUIDField({
                type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
            name: new fields.StringField({ required: false, blank: true, trim: true })
        });
        // In campaign days, against `mgt2.campaignDay`. Core p.241 docks a late delivery 1D+4 × 10%.
        schema.dueDay = new fields.NumberField({
            required: false, nullable: true, initial: null, integer: true });
        schema.farePerTon = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });

        // Speculative only (Core p.243): the sale price is a percentage of the base, so what was
        // actually paid has to be recorded as one too or the margin cannot be read back.
        schema.basePrice = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        schema.purchasePct = new fields.NumberField({ required: false, nullable: true, initial: null });

        // Core p.243 applies the LARGEST applicable DM rather than their sum, which is why these are
        // lists of (trade code, DM) pairs and not one number.
        schema.purchaseDM = new fields.ArrayField(new fields.SchemaField({
            code: new fields.StringField({ required: false, blank: true, trim: true }),
            dm: new fields.NumberField({ required: false, nullable: false, integer: true, initial: 0 })
        }), { initial: [] });
        schema.saleDM = new fields.ArrayField(new fields.SchemaField({
            code: new fields.StringField({ required: false, blank: true, trim: true }),
            dm: new fields.NumberField({ required: false, nullable: false, integer: true, initial: 0 })
        }), { initial: [] });

        // The Law Level this is banned at or above; null is a lot nobody restricts. Distinct from
        // the `legality` every physical item carries, which defaults to 9 (§6.1).
        schema.legality = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });

        return schema;
    }

    /**
     * What the lot is worth and which kind of lot it is. A freight lot pays a flat rate per ton on
     * delivery (Core p.239), a speculative one paid a percentage of the base price up front
     * (Core p.243) and is owed nothing — and having no destination at all IS being speculative, which
     * is the discriminator the schema deliberately does not store.
     */
    prepareDerivedData() {
        this.speculative = (this.destination.world === null) && !this.destination.name;
        this.fare = this.speculative ? 0 : Math.round(this.tons * this.farePerTon);
        this.paid = (this.purchasePct === null) ? null
            : Math.round(this.tons * this.basePrice * this.purchasePct / 100);
    }

    /** Core p.243: the best row wins, not the sum. */
    static bestDM(rows, codes) {
        const applicable = rows.filter(row => codes.includes(row.code)).map(row => row.dm);
        return applicable.length ? Math.max(...applicable) : 0;
    }
}

/**
 * A booking, not a passenger: one Item per booking rather than per head, because Core p.238-239
 * prices a passage per parsec for a single jump and the fare is what the ship is owed.
 * @extends {ItemBaseData}
 */
export class PassageData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.grade = new fields.StringField({
            required: false, blank: false, initial: "middle", choices: MGT2.PassageClasses });
        schema.count = new fields.NumberField({
            required: false, nullable: false, min: 0, integer: true, initial: 1 });
        schema.destination = new fields.SchemaField({
            world: new fields.DocumentUUIDField({
                type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
            name: new fields.StringField({ required: false, blank: true, trim: true })
        });
        schema.farePerHead = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });

        return schema;
    }

    /**
     * The baggage allowance is the grade's own number and has no printed competitor, so it derives
     * rather than being stored beside a grade that could disagree with it (§9.20).
     */
    prepareDerivedData() {
        const grade = MGT2.PassageClasses[this.grade] ?? MGT2.PassageClasses.middle;
        this.baggage = grade.baggage * this.count;
        this.fare = grade.unpaid ? 0 : this.farePerHead * this.count;
        // Core p.158 puts every low passenger through a revival check on arrival.
        this.lowBerth = grade.lowBerth === true;
    }
}

/**
 * A transcribed row of a ship's design. Optional by construction: a `spacecraft` stores its own
 * ratings, so a component feeds `budget` and nothing else and a ship with no components is complete
 * (§4.1, §6.2). Every derivation on the ship has to tolerate its absence.
 * @extends {ItemBaseData}
 */
export class ComponentData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.category = new fields.StringField({
            required: false, blank: false, initial: "option", choices: MGT2.ComponentCategories });
        // Numeric like the ship's own `tl`, not the `TL12` string a personal item carries.
        schema.tl = new fields.NumberField({ required: false, nullable: false, min: 0, integer: true, initial: 12 });

        // A triple and not a number: almost every High Guard system is priced as a flat tonnage, as
        // a percentage of the hull, or as a percentage with a floor — and drives, armour, fuel and
        // bridges all use one of the last two. One SchemaField covers the three with no
        // discriminator; whichever arm is non-zero is the one that priced this row.
        schema.tonnage = new fields.SchemaField({
            tons: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            percent: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            minimum: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 })
        });

        schema.cost = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        // What this row DRAWS, and never what it makes: a power plant's output is its `rating`, the
        // same way a drive's is Thrust-N. `min: 0` is that rule and not an oversight — storing
        // generation as a negative draw would put the plant's output in two fields at once, and
        // `sketch-component.html` shows why it is tempting and wrong: its fixture carries both
        // `pw: -405` and `rating: 405`, and its own sum then has to say `Math.max(0, pw)` to avoid
        // counting the plant twice. `generates` below reads the one field that holds it.
        schema.power = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        schema.powerPerTon = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        // Thrust-N, Jump-N, Computer/N, Armour-N, Power-N — whichever the category means.
        schema.rating = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        schema.quantity = new fields.NumberField({
            required: false, nullable: false, min: 0, integer: true, initial: 1 });
        // A grade, not a `damaged` flag: ship criticals run severity 1-6, so a turret at DM−1 is a
        // turret that still fires, and the number is what the rules print.
        schema.dm = new fields.NumberField({
            required: false, nullable: false, integer: true, initial: 0 });

        return schema;
    }

    /** What this row costs a hull of `hullTons`, whichever of the three arms priced it. */
    tonsFor(hullTons) {
        const percent = (this.tonnage.percent > 0) ? (hullTons * this.tonnage.percent / 100) : 0;
        const tons = Math.max(this.tonnage.tons, percent, this.tonnage.minimum);
        return tons * Math.max(1, this.quantity);
    }

    /**
     * What this row draws on a hull of `hullTons`. Two arms like the tonnage: HG prices a system's
     * draw as a flat figure or per ton of the system itself, and a few carry both.
     */
    drawFor(hullTons) {
        return (this.power * Math.max(1, this.quantity))
            + (this.powerPerTon * this.tonsFor(hullTons));
    }

    /**
     * What this row makes, which is only ever a power plant's `rating` (HG p.17). Every other
     * category returns 0, so a design's balance is `sum(generates) − sum(drawFor)` with no branch on
     * the category at the call site — which is the whole reason this is here rather than in the
     * validation pass §6.2 still owes.
     */
    get generates() {
        return (this.category === "powerPlant") ? this.rating * Math.max(1, this.quantity) : 0;
    }
}

/**
 * A dose, and a timed effect rather than a possession (CSC p.93-97). The three timing fields are
 * nullable with no defaults, because most drugs state none: a null `duration` is a drug that is not
 * a clock at all — Fast Drug and anti-rad — rather than one whose duration nobody typed.
 * @extends {PhysicalItemData}
 */
export class DrugData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.dose = new fields.StringField({ required: false, blank: true, trim: true });
        schema.onset = new fields.StringField({ required: false, blank: true, trim: true, nullable: true });
        schema.duration = new fields.StringField({ required: false, blank: true, trim: true, nullable: true });

        // What it leaves behind, and which pipeline that goes down. `afterKind` is the
        // discriminator here because "Fatigued" and "2D damage" are read by different code.
        schema.afterEffect = new fields.StringField({
            required: false, blank: true, trim: true, nullable: true });
        schema.afterKind = new fields.StringField({
            required: false, blank: false, initial: "none", choices: MGT2.DrugAfterKinds });

        // CSC p.97 is optional at the table, so an empty block means the referee has not switched
        // addiction on — not that the numbers are missing.
        schema.addiction = new fields.SchemaField({
            dosesBefore: new fields.NumberField({
                required: false, nullable: true, initial: null, min: 0, integer: true }),
            checkInterval: new fields.StringField({
                required: false, blank: true, trim: true, nullable: true }),
            cravingDM: new fields.NumberField({
                required: false, nullable: true, initial: null, integer: true })
        });

        return schema;
    }
}

/**
 * Rounds for a weapon, and the fields it overrides on the one it is loaded into. Every override is
 * nullable and null means "the weapon's own": standard rounds override nothing, which is the common
 * case and the reason none of them carries a default.
 * @extends {PhysicalItemData}
 */
export class AmmunitionData extends PhysicalItemData {
    /** @inheritDoc */
    static migrateData(source, options) {
        migrateTraitArray(source.traits, "weapon");
        return super.migrateData(source, options);
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.traits);
    }

    static defineSchema() {
        const schema = super.defineSchema();

        // Free text: what a magazine fits is a catalogue fact and no book prints a closed list.
        schema.weaponType = new fields.StringField({ required: false, blank: true, trim: true });
        schema.magazine = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        schema.magazineCost = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        schema.damage = new FormulaField({
            required: false, blank: true, trim: true, nullable: true });
        schema.traits = createTraitsField("weapon");
        // CSC p.179-182: a few rounds REPLACE the weapon's trait list rather than adding to it, and
        // which of the two it is cannot be read off the list itself.
        schema.replaceTraits = new fields.BooleanField({ required: false, initial: false });
        // The rules a round carries that are neither damage nor a trait — "pellets ignore Dodge and
        // double Protection". Typed by the referee, because no vocabulary in the registry covers it.
        schema.rules = new fields.ArrayField(
            new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] });

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
            // Declared rather than inherited: a species is printed on a page like every other Item,
            // and this class is the one that does not extend `ItemBaseData` (§9.96).
            source: createSourceField(),
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
