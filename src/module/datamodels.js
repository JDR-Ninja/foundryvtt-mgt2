// Compendium packs marked `authored` in tools/packs.config.mjs are JSON written by hand against
// these schemas: a field renamed here leaves a dead key there, which Foundry discards in SILENCE.
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";
import { buildTraitMap, createTraitsField, migrateTraitArray } from "./traits.js";

const fields = foundry.data.fields;

/**
 * A dice expression — `3D`, `2D+2`, `1D6` — edited through v14's formula editor. ⚠ The element
 * cannot be asked for from the template: `StringField#_toInput` switches over a closed list of
 * element types and THROWS on anything else, and `formula-input` is not in it.
 */
export class FormulaField extends fields.StringField {

    /** @inheritDoc */
    _toInput(config) {
        // `create` writes through `setAttribute`, so a null would reach the control as the text "null".
        config.value = config.value ?? this.getInitialValue({}) ?? "";
        return foundry.applications.elements.HTMLFormulaInputElement.create(config);
    }
}

/**
 * An id for a Document embedded in the same parent, reading back as that Document. `fallback` hands
 * an unresolved id back as the stored string, and a resolved one stringifies to its name.
 */
export class LocalDocumentField extends fields.DocumentIdField {
    constructor(model, options = {}, context = {}) {
        super(options, context);
        this.model = model;
    }

    /** @inheritDoc */
    static get _defaults() {
        return Object.assign(super._defaults, { nullable: true, readonly: false, fallback: false });
    }

    /** @override */
    _cast(value) {
        if ( value instanceof foundry.abstract.Document ) return value._id;
        return String(value);
    }

    /** A typed name is not an id, and with `fallback` it is a legal value. @override */
    _validateType(value, options) {
        if ( !this.fallback ) super._validateType(value, options);
    }

    /** @override */
    initialize(value, model) {
        const collection = model?.parent?.getEmbeddedCollection?.(this.model.metadata.collection);
        return () => {
            const document = collection?.get(value);
            if ( !document ) return this.fallback ? value : null;
            Object.defineProperty(document, "toString", {
                value: () => document.name, configurable: true, enumerable: false });
            return document;
        };
    }

    /** @override */
    toObject(value) {
        return value?._id ?? value;
    }
}

/**
 * Core p.112: a computer "designed for a specific purpose" runs one named program at a Processing
 * score +1 or +2 higher. The same ring-fenced pool HG p.20 gives a ship's `/bis`, one scale down.
 */
function createSpecialisedField() {
    return new fields.SchemaField({
        // The printed program name the bonus is reserved for; blank is a general-purpose host.
        software: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        // No `max`: a `NumberField` CLEANS before it validates, so a typed 3 would silently read 2.
        bonus: new fields.NumberField({
            required: false, nullable: false, min: 0, integer: true, initial: 0 })
    });
}

/** Where the entry is printed. */
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
            description: new fields.StringField({
                required: false, blank: true, trim: true, nullable: true, initial: "" }),
            subType: new fields.StringField({ required: false, blank: false, nullable: true, initial: null }),
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
            id: new fields.StringField({ required: false, blank: true, initial: "" })
        });

        schema.roll = new fields.SchemaField({
            characteristic: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            difficulty: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });


        return schema;
    }
}

export class ItemData extends PhysicalItemData {

    /**
     * Reset for every `item` and not only software: the owning actor decides `tlBlocked`, so a
     * loose package has to read sanely without one.
     */
    prepareBaseData() {
        const bandwidth = this.software.bandwidth;
        this.software.bandwidthRun = Math.min(this.software.runAt ?? bandwidth, bandwidth);
        this.software.downgraded = this.software.bandwidthRun < bandwidth;
        this.software.tlBlocked = false;
    }

    static defineSchema() {
        const schema = super.defineSchema();
        schema.subType.initial = "loot";
        schema.software = new fields.SchemaField({
            // No `max`: a `NumberField` CLEANS before it validates, so HG p.73's Advanced Fire
            // Control/3 stored as Bandwidth 10 with no error at all.
            bandwidth: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
            // Core p.110: high-Bandwidth software may run lower, "to a minimum of the lowest
            // Bandwidth shown" — a choice, so it is stored, and null runs at the printed figure.
            runAt: new fields.NumberField({ required: false, initial: null, nullable: true, min: 0, integer: true }),
            effect: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            computerId: new fields.StringField({ required: false, blank: true, initial: "" })
        });
        return schema;
    }
}

export class EquipmentData extends PhysicalItemData {

    /** The rating left `augment` once gear that is not one turned out to carry it. @inheritDoc */
    static migrateData(source, options) {
        for ( const key of ["processing", "specialised"] ) {
            if ( (source.augment?.[key] !== undefined) && (source[key] === undefined) ) {
                source[key] = source.augment[key];
            }
        }
        return super.migrateData(source, options);
    }

    /**
     * Reset for every equipment and not only an augment: the owning actor derives them, so a loose
     * Item has to read sanely without one.
     */
    prepareBaseData() {
        this.processingUsed = 0;
        this.processingCap = this.processing ?? 0;
        this.overload = false;
        this.overCrowded = false;
        this.blockedSoftware = 0;
    }

    static defineSchema() {
        const schema = super.defineSchema();
        // augment, clothes
        schema.equipped = new fields.BooleanField({ required: false, initial: false });

        // Core p.106's IMPROVEMENTS column holds five incompatible kinds of cell across its rows —
        // a characteristic, a skill DM, Protection, computer capacity and prose — so the printed
        // cell stays a string and each computable kind is declared beside it.
        schema.augment = new fields.SchemaField({
            improvement: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            modifiers: new fields.ArrayField(
                new fields.SchemaField({
                    characteristic: new fields.StringField({
                        required: false, blank: true, trim: true, initial: "" }),
                    value: new fields.NumberField({
                        required: false, integer: true, nullable: true, initial: null })
                })
            ),
            // Core p.107 names the skill the table would not: the augment is bought FOR one.
            skill: new fields.SchemaField({
                name: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                value: new fields.NumberField({ required: false, initial: 0, integer: true })
            }),
            // Core p.107: subdermal armour "stacks with other protection" — additive over worn armour.
            protection: new fields.NumberField({ required: false, initial: 0, integer: true, min: 0 })
        });

        // Core p.110 glosses `Computer/N` as the Processing score, the same scale `ComputerData`
        // and `ArmorData` store: `null` is no computer, `0` is Computer/0. Not an augment field —
        // CSC p.64 rates every transceiver from TL10 up, and Core p.109 the mobile comms.
        schema.processing = new fields.NumberField({
            required: false, nullable: true, initial: null, integer: true, min: 0 });
        schema.specialised = createSpecialisedField();

        schema.subType.initial = "equipment"; // augment, clothing, trinket, toolkit, equipment

        return schema;
    }
}

export class DiseaseData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();
        schema.subType.initial = "disease"; // disease;poison
        schema.difficulty = new fields.StringField({ required: true, initial: "Average" });
        schema.damage = new FormulaField({ required: false, blank: true, initial: "" });
        // The referee's own word — `paralysis` — and never what that word does.
        schema.effect = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.interval = new fields.StringField({ required: false, blank: true, initial: "" });
        return schema;
    }
}

/**
 * One printed cell of a creation table, which is a small EXPRESSION and not a scalar: alternations
 * (`Drive or Vacc Suit`), conjunctions, family wildcards, speciality choices and dice quantities.
 */
function createCellField(options = {}) {
    return new fields.SchemaField({
        text: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        mode: new fields.StringField({
            required: false, blank: false, initial: "all", choices: MGT2.CellModes }),
        grants: new fields.ArrayField(new fields.SchemaField({
            kind: new fields.StringField({
                required: false, blank: false, initial: "skill", choices: MGT2.CreationGrantKinds }),
            // Free text and never a `choices` list: no skill list ships at all, so a grant names
            // one and `MGT2Helper.matchesSkill` resolves it against whatever the referee's library
            // holds.
            skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            // Blank picks none, which is what a level-0 grant does: the choice happens when the
            // skill reaches level 1 (folio 58).
            speciality: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            specialities: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
            // `Gun Combat (any)`, `Science (any)`, and the Psion's `Any Talent`.
            family: new fields.BooleanField({ required: false, initial: false }),
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            // `1D Ship Shares`, `D3 Enemies` — a quantity that is rolled rather than counted.
            formula: new FormulaField({ required: false, blank: true, initial: "" }),
            value: new fields.NumberField({ required: false, initial: 1, integer: true }),
            mode: new fields.StringField({
                required: false, blank: false, initial: "raise", choices: MGT2.GrantModes }),
            // The per-row floor of `SOC 10 or SOC +1, whichever is higher`. Null is the ordinary case.
            floor: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
            // Which shared Other Benefits definition a `benefit` grant points at, typed by the referee.
            ref: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            // Which relationship a `contact` grant makes: an Ally is a benefit row of its own.
            relation: new fields.StringField({
                required: false, blank: true, trim: true, initial: "", choices: MGT2.ContactRelations })
        }), { initial: [] })
    }, options);
}

/** One of a career's skill tables. */
function createCareerTableField() {
    return new fields.SchemaField({
        present: new fields.BooleanField({ required: false, initial: false }),
        gate: new fields.SchemaField({
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            min: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
        }),
        requiresCommission: new fields.BooleanField({ required: false, initial: false }),
        rows: new fields.ArrayField(createCellField(), { initial: [] })
    });
}

/**
 * A modifier with the tray's lifetime removed: permanent, per-Traveller, and GATED rather than
 * spent.
 */
function createStandingModifierField() {
    return new fields.SchemaField({
        dm: new fields.NumberField({ required: false, initial: 0, integer: true }),
        // A printed DM is not always a number: "a negative DM equal to the highest skill level the
        // Droyne has in a Black Skill" is read at the moment of the roll.
        per: new fields.NumberField({ required: false, initial: 0, integer: true }),
        skills: new fields.ArrayField(
            new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
        // The tray's seven plus the frame-owned steps, which no tray entry can ever be spent on.
        appliesTo: new fields.SetField(new fields.StringField({
            required: true, blank: false, choices: MGT2.CreationChecks }), { initial: [] }),
        // A career NAME the referee typed, matched case- and space-insensitively; blank is every career.
        career: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        // Blank is ungated, which is what every frame entry written before this field meant.
        gate: new fields.SchemaField({
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            min: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
        }),
        note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
    });
}

/** One entry of the tray — a decision creation defers, wherever it was made. */
export function createTrayEntryField() {
    return new fields.SchemaField({
        kind: new fields.StringField({
            required: false, blank: false, initial: "dm", choices: MGT2.TrayKinds }),
        // The number a `dm` carries. Every other kind reads `value` instead.
        dm: new fields.NumberField({ required: false, initial: 0, integer: true }),
        // What an `unlock`, `careerOffer`, `careerBlock` or `grant` names — a career name or a skill.
        value: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        // A SET: "event bonuses to advancement rolls may be applied to commission rolls instead".
        appliesTo: new fields.SetField(new fields.StringField({
            required: true, blank: false, choices: MGT2.TrayChecks }), { initial: [] }),
        scope: new fields.StringField({
            required: false, blank: false, initial: "thisCareer", choices: MGT2.TrayScopes }),
        // Which career, when the scope is a named one or this one.
        career: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        duration: new fields.StringField({
            required: false, blank: false, initial: "oneShot", choices: MGT2.TrayDurations }),
        // Null is unlimited. A `thisCareer` DM on every Survival roll has no count.
        uses: new fields.NumberField({
            required: false, nullable: true, initial: 1, min: 0, integer: true }),
        // A predicate over the record's EXIT MODE and not over a term count: a printed penalty
        // expires according to whether the first career was left voluntarily.
        expiresWhen: new fields.StringField({
            required: false, blank: true, initial: "", choices: MGT2.CareerExitModes }),
        // What EARNS the entry, which `expiresWhen` cannot say — that field is about when a live
        // modifier stops applying.
        condition: new fields.StringField({
            required: false, blank: false, initial: "always", choices: MGT2.TrayConditions }),
        note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
    });
}

/** One row of a career's Events or Mishaps table. */
function createEventRowField({ ejects = "stays", ...options } = {}) {
    return new fields.SchemaField({
        roll: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
        text: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        ejects: new fields.StringField({
            required: false, blank: false, initial: ejects, choices: MGT2.EjectionOutcomes }),
        benefit: new fields.StringField({
            required: false, blank: false, initial: "none", choices: MGT2.BenefitRowEffects }),
        benefitCount: new fields.NumberField({ required: false, initial: 1, integer: true }),
        // One printed row awards `D3 Benefit rolls`, so the count is rolled rather than counted.
        benefitFormula: new FormulaField({ required: false, blank: true, initial: "" }),
        // A career NAME the referee typed: a row may send a Traveller to another career, offer one
        // with qualification waived, or borrow another career's tables for a single roll.
        career: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        // WHICH of the three senses the reference above carries.
        careerMode: new fields.StringField({
            required: false, blank: false, initial: "offer", choices: MGT2.RowCareerModes }),
        // Sub-tables must be ADDRESSABLE: two careers' rows jump straight to the Unusual Event 1D
        // branch, skipping the 2D Life Event roll above it.
        subTable: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        // The sub-roll printed INSIDE the prose: "roll 9+ on any skill you have learned during this
        // term".
        check: new fields.SchemaField({
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
        }),
        // A named track this row moves, and by how much: prison events shift a parole threshold by
        // +2, +1, -1, -2, -1D or a full re-roll.
        track: new fields.SchemaField({
            key: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            formula: new FormulaField({ required: false, blank: true, initial: "" }),
            value: new fields.NumberField({ required: false, initial: 0, integer: true }),
            // A row that re-rolls the track from its own definition rather than adjusting it.
            reroll: new fields.BooleanField({ required: false, initial: false })
        }),
        // Row 12 on six careers awards a promotion or a commission OUTRIGHT, with no roll.
        awards: new fields.SchemaField({
            outcomes: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: MGT2.TermOutcomes }), { initial: [] }),
            mode: new fields.StringField({
                required: false, blank: false, initial: "oneOf", choices: MGT2.CellModes }),
            // "You MAY gain a promotion or a commission" — a different fact from which arm is
            // taken, so it rides beside `mode`: no cell in the books offers "or nothing".
            optional: new fields.BooleanField({ required: false, initial: false })
        }),
        grant: createCellField({ required: false }),
        // A DM on a Benefit roll is a MODIFIER and not an award, so it is none of `benefit`'s five
        // values: at least six printed rows carry one, and the tray already models it exactly.
        tray: new fields.ArrayField(createTrayEntryField(), { initial: [] })
    }, options);
}

/**
 * Where a grant came from, written at the moment it is written: a few bytes then, and impossible to
 * reconstruct later.
 */
function createProvenanceField() {
    return new fields.SchemaField({
        term: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
        career: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        table: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
    });
}

/**
 * A named track, as the template or the frame DECLARES it — the value it reaches lives on the
 * record or on the ledger.
 */
function createTrackDefinitionField() {
    return new fields.SchemaField({
        key: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        kind: new fields.StringField({
            required: false, blank: false, initial: "numeric", choices: MGT2.TrackKinds }),
        initial: new FormulaField({ required: false, blank: true, initial: "" }),
        cap: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
        monotone: new fields.BooleanField({ required: false, initial: false }),
        // The rungs of an enumerated track, in order, so "fell to the one below" is computable.
        values: new fields.ArrayField(
            new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] })
    });
}

/** One declared step of a frame's term, and the check the printed frame runs at it. */
function createStepField() {
    return new fields.SchemaField({
        key: new fields.StringField({
            required: true, blank: false, initial: "elect", choices: MGT2.CreationSteps }),
        check: new fields.SchemaField({
            // A step is a position in the term and most checks are simply made there.
            when: new fields.StringField({
                required: false, blank: false, initial: "everyTerm", choices: MGT2.StepCheckTriggers }),
            // An `index` check adds its total to a printed table rather than beating a target, so it
            // takes neither arm below and the step names the table.
            kind: new fields.StringField({
                required: false, blank: false, initial: "beat", choices: MGT2.CreationCheckKinds }),
            // The named term.
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            skills: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
            // The printed target.
            target: new fields.NumberField({
                required: false, nullable: true, initial: null, integer: true }),

            // What the LADDER is read against, blank for a check with one printed target.
            index: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.StepCheckIndices }),
            indexCharacteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            // The printed table, one row as printed; a last row reading `8+` is `to` left null.
            ladder: new fields.ArrayField(new fields.SchemaField({
                from: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                to: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                // What this row awards over what the check awards on every row, and NOT conditioned
                // on the roll — one row of the household timetable separates its two clauses
                // explicitly ("if the Patriarchy check is successful"), so a column the book
                // conditions where it means to is read as unconditional where it does not.
                award: createStepOutcomeField()
            }), { initial: [] }),

            // A DM the named term does not supply and no characteristic derives: "caste number as a
            // negative DM" reads a track the frame itself declared.
            trackModifiers: new fields.ArrayField(new fields.SchemaField({
                track: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                per: new fields.NumberField({ required: false, initial: 1, integer: true })
            }), { initial: [] }),

            onPass: createStepOutcomeField(),
            onFail: createStepOutcomeField()
        })
    });
}

/** What one arm of a declared step's check does. */
function createStepOutcomeField() {
    return new fields.SchemaField({
        ejects: new fields.StringField({
            required: false, blank: false, initial: "stays", choices: MGT2.EjectionOutcomes }),
        outcomes: new fields.SetField(new fields.StringField({
            required: true, blank: false, choices: MGT2.TermOutcomes }), { initial: [] }),
        // "Elevated one degree": `value` is RUNGS on an enumerated track and points on a numeric one.
        track: new fields.SchemaField({
            key: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            value: new fields.NumberField({ required: false, initial: 0, integer: true }),
            formula: new FormulaField({ required: false, blank: true, initial: "" })
        }),
        // A cell with text and no grants is legitimate and is what the unwritable half looks like.
        grant: createCellField()
    });
}

/** `frame.steps` was a bare `string[]` and each entry is now a row carrying its own check. */
function migrateStepArray(steps) {
    if ( !Array.isArray(steps) ) return;
    for ( let i = 0; i < steps.length; i++ ) {
        if ( typeof steps[i] === "string" ) steps[i] = { key: steps[i] };
    }
}

/** A law that stated one block of values now states a list of them. */
function liftLaw(source, key, leaves) {
    // ⚠ An indexed update payload is cleaned through here and is a plain object too, so only a
    // block carrying one of the law's own leaf keys is lifted.
    const law = source?.[key];
    if ( !law || Array.isArray(law) || !leaves.some(leaf => leaf in law) ) return;
    source[key] = [law];
}

/** A law printed once per sex or per role: a row naming neither is the default, first match wins. */
function createRoleAxisField(values) {
    return new fields.ArrayField(new fields.SchemaField({
        sex: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        role: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        ...values
    }), { initial: [] });
}

/**
 * A career, in either of its two roles: a `career` embedded in an Actor is the RECORD of a career
 * served, the same type in a pack or the world is the TEMPLATE carrying that career's tables.
 */
export class CareerData extends ItemBaseData {

    /**
     * An Item's parent is the Actor it is embedded in, or null in a pack or the world directory.
     * @type {boolean}
     */
    get isTemplate() {
        return !this.parent?.parent;
    }

    static defineSchema() {
        const schema = super.defineSchema();

        /* ---- TEMPLATE: what the career DOES. Empty on a record. ---- */

        // University and the military academy are a kind on this same Item: what a Traveller ends
        // up with is a term served, an assignment and an event log either way, and only the rolls
        // differ.
        schema.kind = new fields.StringField({
            required: false, blank: false, initial: "career", choices: MGT2.CareerKinds });

        // 0 where the career takes anyone.
        schema.difficulty = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });

        // `characteristics` is a LIST because the Entertainer prints "DEX or INT 5+"; `autoIf` is
        // the Noble's automatic qualification at SOC 10+, printed on the same line as its own
        // target.
        schema.qualification = new fields.SchemaField({
            entry: new fields.StringField({
                required: false, blank: false, initial: "target", choices: MGT2.QualificationEntry }),
            characteristics: new fields.ArrayField(new fields.StringField({
                required: true, blank: false, choices: MGT2.Characteristics }), { initial: [] }),
            autoIf: new fields.SchemaField({
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                min: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
            }),
            // "DM-1 for every previous career" is printed on each career's own Qualification line
            // and is ABSENT from four of the sixteen, so it is not a general rule.
            perPreviousCareer: new fields.NumberField({ required: false, initial: 0, integer: true }),
            // The two shapes the corpus prints beyond the count and the age: "DM+2 if SOC 9+"
            // and "DM+2 if the last term was in the Agent or Rogue careers".
            conditionalDMs: new fields.ArrayField(new fields.SchemaField({
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                min: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                // Template ids, as `qualificationOverride.exceptCareers` names them.
                afterCareers: new fields.ArrayField(new fields.StringField({
                    required: true, blank: false, trim: true }), { initial: [] }),
                dm: new fields.NumberField({ required: false, initial: 0, integer: true })
            }), { initial: [] }),
            requiresPermission: new fields.BooleanField({ required: false, initial: false })
        });

            // "The Army and Marines at 30+, the Navy at 34+" as two numbers rather than three
            // career names.
        schema.ageDM = new fields.SchemaField({
            from: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
            dm: new fields.NumberField({ required: false, initial: 0, integer: true })
        });

        schema.commission = new fields.BooleanField({ required: false, initial: false });
        // The books print "Commission: SOC 8+" on the career's own line, so the target and the
        // characteristic are the template's too.
        schema.commissionCheck = new fields.SchemaField({
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
        });
        // The four careers excluded from the pension are a boolean here, not a name list.
        schema.pensionable = new fields.BooleanField({ required: false, initial: true });
        // BLANK is a template that declares no rule — the book groups the careers two ways and
        // leaves one in neither list — and falls back to the `undeclaredAssignmentChange` world
        // setting.
        schema.assignmentChange = new fields.StringField({ required: false, blank: true,
            initial: "", choices: MGT2.AssignmentChangeRules });
        // Blank is a career granting no basic training, which a frame with no such step needs.
        schema.basicFrom = new fields.StringField({ required: false, blank: true,
            initial: "service", choices: MGT2.BasicTrainingTables });
        // Beats the generic no-return check rather than being filtered by it, and it must: this is
        // the fallback, and closing it leaves a Traveller with nowhere to go.
        schema.alwaysAvailable = new fields.BooleanField({ required: false, initial: false });
        // "May not leave or be ejected from this career, not even by a Mishap".
        schema.neverEjects = new fields.BooleanField({ required: false, initial: false });
        schema.blocksAnagathics = new fields.BooleanField({ required: false, initial: false });
        schema.eventRow7 = new fields.StringField({
            required: false, blank: false, initial: "lifeEvent", choices: MGT2.EventRow7 });
        // The template-named leaving rule that DISPLACES the generic outcomes rather than layering
        // on them: a roll under the terms served cannot end the career, and a natural 12 releases.
        schema.exitRule = new fields.SchemaField({
            track: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            test: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });
        // Which row of the Medical Bills table this career's employer sits on — the three rows are
        // career GROUPS.
        schema.medicalBillsRow = new fields.StringField({
            required: false, blank: true, trim: true, initial: "" });
        // Species careers are ordinary templates carrying a restriction, and for the Aslan a sex
        // gate — one of the strings that species declares in `frame.sexes`, never the identity field.
        schema.restrictedTo = new fields.SchemaField({
            species: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            sex: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });

        // Rank ladders are a NAMED SET the assignments point at, which dissolves four apparent
        // exceptions: three services share one enlisted and one officer ladder, one career runs two
        // ladders for three assignments, and one runs three whose rank numbers do not line up.
        schema.rankLadders = new fields.ArrayField(new fields.SchemaField({
            id: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            name: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            officer: new fields.BooleanField({ required: false, initial: false }),
            rows: new fields.ArrayField(new fields.SchemaField({
                rank: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
                title: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                bonus: createCellField({ required: false })
            }), { initial: [] })
        }), { initial: [] });

        // The survival and advancement targets are per ASSIGNMENT and Assignment Skills is one
        // sub-table per assignment, which is why the tables number up to seven rather than five.
        schema.assignments = new fields.ArrayField(new fields.SchemaField({
            name: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            ladder: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            officerLadder: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            survival: new fields.SchemaField({
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
            }),
            advancement: new fields.SchemaField({
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
            }),
            skills: new fields.ArrayField(createCellField(), { initial: [] })
        }), { initial: [] });

        schema.tables = new fields.SchemaField({
            personalDevelopment: createCareerTableField(),
            service: createCareerTableField(),
            advancedEducation: createCareerTableField(),
            officer: createCareerTableField()
        });

        // `Cr50000`, `SOC +1`, `Ship Share` and `Gun` are effects rather than text, so the
        // per-career roll → row map is structured like the skill tables.
        schema.benefits = new fields.SchemaField({
            cash: new fields.ArrayField(
                new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }), { initial: [] }),
            other: new fields.ArrayField(createCellField(), { initial: [] })
        });

        schema.eventTable = new fields.ArrayField(createEventRowField(), { initial: [] });
        schema.mishapTable = new fields.ArrayField(
            createEventRowField({ ejects: "ejects" }), { initial: [] });

        // A career may print a standing FOOTNOTE rather than an event row — "Travellers with FOL
        // 10+ add +1 to their Benefit rolls" — which is never granted, never spent and never
        // expires: its gate switches it on and off as the score moves.
        schema.standingModifiers = new fields.ArrayField(createStandingModifierField(), { initial: [] });

        // Career-scoped tracks, which `exitRule.track` names.
        schema.tracks = new fields.ArrayField(createTrackDefinitionField(), { initial: [] });

        /* ---- RECORD: what this Traveller DID. Empty on a template. ---- */

        schema.assignment = new fields.StringField({ required: false, blank: true, initial: "" });
        schema.terms = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.rank = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        // Which of the template's ladders this record is on, because a commission moves it.
        schema.ladder = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        // The rank reached before a commission moved the record to the officer ladder, which resets
        // `rank` to 1 — so the number is gone the moment it is needed, and cannot be reconstructed.
        schema.enlistedRank = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.events = new fields.ArrayField(
            new fields.SchemaField({
                age: new fields.NumberField({ required: false, integer: true, initial: null }),
                description: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            })
        );

        // Four rules read the MANNER of entering or leaving rather than the fact, and
        // `stillServing` is what makes parallel records possible: the loop iterates the records
        // that are still open.
        schema.entryMode = new fields.StringField({ required: false, blank: false,
            initial: "qualified", choices: MGT2.CareerEntryModes });
        schema.exitMode = new fields.StringField({ required: false, blank: false,
            initial: "stillServing", choices: MGT2.CareerExitModes });

        // Age is a SUM over this log and never `18 + 4 × terms`: a Companion pre-career starts at
        // 22 + 2D3, and a term that "is not counted toward your physical age" sets `ages` false.
        schema.termLog = new fields.ArrayField(new fields.SchemaField({
            term: new fields.NumberField({ required: false, initial: 1, min: 0, integer: true }),
            years: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
            ages: new fields.BooleanField({ required: false, initial: true }),
            // Null is a term with no survival check at all, which is not the same fact as a failed one.
            survived: new fields.BooleanField({ required: false, nullable: true, initial: null }),
            ejected: new fields.BooleanField({ required: false, initial: false }),
            // Core folio 48 puts 34 "at the end of" the fourth term: a term is served once it closes.
            closed: new fields.BooleanField({ required: false, initial: false }),
            // What the frame said this term yields, so a term that grants nothing stays legible.
            kind: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            // What the term PRODUCED, as facts a later step reads rather than as prose: a
            // commission and an advancement in the same term are two members here.
            outcomes: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: MGT2.TermOutcomes }), { initial: [] }),
            steps: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: MGT2.CreationSteps }), { initial: [] }),
            note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        }), { initial: [] });

        // The Parole Threshold: a possibly-dice initial, a cap, named adjustments carrying
        // provenance.
        schema.track = new fields.SchemaField({
            key: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            value: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
            cap: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
            adjustments: new fields.ArrayField(new fields.SchemaField({
                value: new fields.NumberField({ required: false, initial: 0, integer: true }),
                term: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            }), { initial: [] })
        });

        return schema;
    }

    /**
     * Whether the names this template points at are names it declares.
     * @type {{checks: object[], failed: number}}
     */
    get templateIssues() {
        const ladders = new Map(this.rankLadders.filter(one => one.id).map(one => [one.id, one]));
        const tracks = new Set(this.tracks.map(one => one.key).filter(Boolean));
        const named = (rows, read) => rows.map(read).filter(Boolean);
        const check = (key, wanted, resolves) => ({
            key,
            applies: wanted.length > 0,
            ok: wanted.every(resolves),
            used: wanted.filter(resolves).length,
            cap: wanted.length,
            missing: [...new Set(wanted.filter(one => !resolves(one)))]
        });

        // A ladder nobody can point at, which is the one issue whose name is the missing thing.
        const blankIds = this.rankLadders.filter(one => !one.id).length;
        const duplicated = this.rankLadders.map(one => one.id).filter((id, index, all) =>
            id && (all.indexOf(id) !== index));
        const rows = [...this.eventTable, ...this.mishapTable];

        const checks = [
            {
                key: "ladderIds", applies: this.rankLadders.length > 0,
                ok: (blankIds === 0) && (duplicated.length === 0),
                used: this.rankLadders.length - blankIds - duplicated.length,
                cap: this.rankLadders.length,
                missing: [...new Set(duplicated)]
            },
            check("assignmentLadder", named(this.assignments, one => one.ladder),
                id => ladders.has(id)),
            // An officer ladder must also BE one: a commission onto an enlisted ladder is the
            // defect this half catches and the one above cannot.
            check("officerLadder", named(this.assignments, one => one.officerLadder),
                id => ladders.get(id)?.officer === true),
            check("exitTrack", this.exitRule.track ? [this.exitRule.track] : [],
                key => tracks.has(key)),
            check("rowTrack", named(rows, one => one.track?.key), key => tracks.has(key))
        ];
        return { checks, failed: checks.filter(one => one.applies && !one.ok).length };
    }
}

export class TalentData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.subType.initial = "skill";
        schema.cost = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true })
        schema.level = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true })
        schema.skill = new fields.SchemaField({
            speciality: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            reduceEncumbrance: new fields.BooleanField({ required: false, initial: false })
        });

        schema.psionic = new fields.SchemaField({
            reach: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            cost: new fields.NumberField({ required: false, initial: 1, min: 0, integer: true }),
            duration: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            durationUnit: new fields.StringField({ required: false, initial: "" })
        });

        schema.roll = new fields.SchemaField({
            characteristic: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            difficulty: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });

        // Creation grants skills faster than a player can invent fiction, and a level raised twice
        // cannot be unwound afterwards by inspection.
        schema.provenance = createProvenanceField();

        return schema;
    }
}

export class ContactData extends ItemBaseData {

    /**
     * `relation` and `status` were free strings and now carry `choices`, so an outside value would
     * fail validation on load.
     * @inheritDoc
     */
    static migrateData(source, options) {
        if ( source.relation && !(source.relation in MGT2.ContactRelations) ) source.relation = "Contact";
        if ( source.status && !(source.status in MGT2.ContactStatus) ) source.status = "Alive";
        return super.migrateData(source, options);
    }

    static defineSchema() {
        const schema = super.defineSchema();

        schema.subType.initial = "contact";
        schema.cost = new fields.NumberField({ required: true, initial: 1, min: 0, integer: true })

        schema.skill = new fields.SchemaField({
            speciality: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            characteristic: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });

        // `choices` on the two the LEDGER writes, because a bad key from code renders as a raw i18n
        // miss where a human picking from a list could never produce one.
        schema.status = new fields.StringField({
            required: false, blank: true, trim: true, initial: "Alive", choices: MGT2.ContactStatus });
        schema.attitude = new fields.StringField({ required: false, blank: true, trim: true, initial: "Unknow" });
        schema.relation = new fields.StringField({
            required: false, blank: true, trim: true, initial: "Contact", choices: MGT2.ContactRelations });
        schema.title = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.nickname = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.species = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.gender = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.pronouns = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.homeworld = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.location = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.occupation = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.notes = new fields.HTMLField({ required: false, blank: true, trim: true, initial: "" });

        // Exactly two cases: the Connections Rule, where the contact IS another Traveller at the
        // table, and ordinary play, where the referee eventually statblocks them.
        schema.actor = new fields.DocumentUUIDField({ type: "Actor", required: false });
        schema.provenance = createProvenanceField();

        return schema;
    }
}

/**
 * A person or an organisation named by a job: the world Actor where one exists, and the name
 * always. The two cases `ContactData.actor` names, one field down — the person IS a document at
 * this table, or the referee statblocks them later.
 */
function createReferenceField() {
    return new fields.SchemaField({
        // ⚠ `embedded: false` on purpose: a job names a person, not an instance on a map, and the
        // sheet resolves a dropped token to its base Actor before storing this.
        uuid: new fields.DocumentUUIDField({
            type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
        // Nothing is copied: this is what the reference reads as where the Actor is gone, or where
        // the viewer cannot observe it.
        name: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
    });
}

/**
 * A job with terms, a fee, a success condition and a referee's tail — a bounty contract and a
 * mercenary ticket, which are two books' names for the same document. `priority` is deliberately
 * NOT here: a ticket has no priority ladder.
 * @extends {ItemBaseData}
 */
export class JobData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        // Who is paying, and whether the party is told. Bounty Hunter p.18: handled through a
        // guild, the issuer may be listed as classified — a third state, not a name and not empty.
        schema.employer = new fields.SchemaField({
            person: createReferenceField(),
            classified: new fields.BooleanField({ required: false, initial: false }),
            note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });
        // Free text: the system states an interval and never schedules one.
        schema.issued = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.status = new fields.StringField({
            required: false, blank: false, initial: "offered", choices: MGT2.JobStatus });

        schema.fee = new fields.NumberField({
            required: false, nullable: false, min: 0, integer: true, initial: 0 });
        // Null until a negotiation settles one, and it can settle LOWER than the fee.
        schema.agreed = new fields.NumberField({
            required: false, nullable: true, min: 0, integer: true, initial: null });
        schema.paid = new fields.BooleanField({ required: false, initial: false });

        // `shown` is the mechanism and stored: what the party has been told is a fact about the
        // campaign, not a render. Who may see an unshown row is the sub-type's policy.
        schema.referee = new fields.ArrayField(new fields.SchemaField({
            key: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            value: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            // A row whose value is also a quantity a rule reads — the REP floor is the only one.
            number: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null }),
            shown: new fields.BooleanField({ required: false, initial: false })
        }), { required: false, initial: () => [] });

        schema.parties = new fields.ArrayField(new fields.SchemaField({
            relation: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            person: createReferenceField(),
            note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        }), { required: false, initial: () => [] });

        // Mirrored in `system.json`'s `htmlFields`: the SERVER builds its sanitisation rules there
        // and knows nothing about these classes. `initial` because `blank` alone starts `undefined`.
        schema.notes = new fields.HTMLField({ required: false, blank: true, trim: true, initial: "" });

        return schema;
    }

    /** What the job actually pays: the negotiated figure where there is one. */
    get payout() {
        return this.agreed ?? this.fee;
    }
}

/**
 * Bounty Hunter p.18-19's contract. It is the PLAYERS' document — folio 18 has the referee hand it
 * over — and the referee's five rows fold behind the sheet as a courtesy rather than a permission.
 * @extends {JobData}
 */
export class ContractData extends JobData {

    /** The five rows folio 19 prints, in its order; `repMin` is the one a rule reads. */
    static REFEREE_ROWS = Object.freeze(Object.keys(MGT2.ContractRefereeRows));

    static defineSchema() {
        const schema = super.defineSchema();
        schema.subType.initial = "bounty";

        // Bounty Hunter p.18 pays for the individual "or finding a place or thing", and p.30 prints
        // a contract whose MARK line is EMPTY because the subject is a file. A blank mark is the
        // kind of contract this is, never a field somebody forgot.
        schema.subject = new fields.SchemaField({
            kind: new fields.StringField({
                required: false, blank: false, initial: "person", choices: MGT2.ContractSubjectKinds }),
            person: createReferenceField(),
            // What a place or a thing is called, since neither is an Actor.
            label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });

        schema.client = new fields.StringField({
            required: false, blank: false, initial: "patron", choices: MGT2.ContractClients });
        schema.priority = new fields.StringField({
            required: false, blank: false, initial: "low", choices: MGT2.ContractPriorities });
        schema.wantedFor = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.alive = new fields.StringField({
            required: false, blank: false, initial: "alive", choices: MGT2.ContractWanted });

        // Folio 18's handover, expressed in the one mechanism Foundry has. The sheet raises the
        // Item's ownership with it; an embedded Item inherits its Actor's and cannot express either
        // state, which is why a contract is a world Item.
        schema.given = new fields.BooleanField({ required: false, initial: false });

        // Folio 10's REP-1 and the paid bounty are both writes to a Traveller, so both rules need
        // this link. REP is READ off the Actor and never stored here.
        schema.hunter = createReferenceField();

        // Folio 10, rolled once: the total, what the table returned, and the offer it was read
        // against. `total === null` is "not negotiated".
        schema.negotiation = new fields.SchemaField({
            total: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null }),
            percent: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null }),
            offered: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null })
        });
        // Folio 10, rolled once. ⚠ `target` is STORED rather than re-derived: the failure's REP-1
        // widens the difference the difficulty was read from, so a difficulty computed afterwards
        // reports a harder check than the one that was made.
        schema.qualification = new fields.SchemaField({
            target: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null }),
            total: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null }),
            passed: new fields.BooleanField({ required: false, initial: false })
        });

        // A function, so each document gets its own array: `DataField#getInitialValue` hands a bare
        // literal back BY REFERENCE and every contract would share one.
        schema.referee.initial = () => ContractData.REFEREE_ROWS.map(key => ({ key }));

        return schema;
    }

    prepareDerivedData() {
        this.bounty = this.payout;
        this.negotiated = this.negotiation.total !== null;
        this.qualificationRolled = this.qualification.target !== null;
        const floor = this.referee.find(row => row.key === "repMin");
        this.repFloor = floor?.number ?? 0;
        this.repFloorShown = floor?.shown === true;
        // Folio 19 leaves the last known location blank where the goal is to find a location, and
        // that blank reads as the kind of contract this is.
        this.alternate = this.subject.kind !== "person";
    }

    /**
     * The Actor who took the job, where one is linked and this client can see it.
     * @returns {Actor|null}
     */
    get hunterActor() {
        return this.hunter.uuid ? (foundry.utils.fromUuidSync(this.hunter.uuid) ?? null) : null;
    }

    /** Bounty Hunter p.10 reads REP off the Traveller. @returns {number|null} */
    get hunterRep() {
        const rep = this.hunterActor?.system?.characteristics?.reputation;
        return Number.isFinite(rep?.value) ? rep.value : null;
    }

    /** REP is optional and unseeded, so a linked hunter may carry no reputation at all. */
    get hunterShowsRep() {
        return this.hunterActor?.system?.isCharacteristicShown?.("reputation") === true;
    }
}

export class WeaponData extends PhysicalItemData {
    /** Traits were `{name, description}`; a weapon's speak the `weapon` vocabulary. @inheritDoc */
    static migrateData(source, options) {
        migrateTraitArray(source.traits, "weapon");
        migrateTraitArray(source.options, "custom");
        // `range.unit` now validates against MGT2.MetricRange, so an outside value would fail on
        // load.
        if (source.range?.unit && !(source.range.unit in MGT2.MetricRange)) {
            source.range.unit = MGT2.WeaponScales[source.scale]?.range ?? "meter";
        }
        return super.migrateData(source, options);
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.traits);
        // What the weapon is while the loaded round is in it.
        this.round = this.#round();
        this.effective = this.#effective();
        // Core folio 77: the magazine is "how many shots can be fired before reloading", so what is
        // left in it is only a number where there is a magazine.
        this.ammo = (this.effective.magazine > 0)
            ? Math.min(this.effective.magazine, this.loaded ?? this.effective.magazine) : 0;
    }

    /** The round loaded, where the weapon is owned and the id still resolves to one. */
    #round() {
        const round = this.ammunition ? this.parent?.actor?.items.get(this.ammunition) : null;
        return (round?.type === "ammunition") ? round : null;
    }

    /** The weapon's own values with the round's overrides laid over them. */
    #effective() {
        const round = this.round?.system;
        if (!round) {
            return { damage: this.damage, magazine: this.magazine, magazineCost: this.magazineCost,
                traits: this.traits, traitMap: this.traitMap, rules: [] };
        }
        // CSC p.179-182: a few rounds REPLACE the weapon's trait list, and no list could ever say which.
        const traits = round.replaceTraits
            ? [...(round.traits ?? [])] : [...this.traits, ...(round.traits ?? [])];
        return {
            damage: round.damage || this.damage,
            magazine: round.magazine ?? this.magazine,
            magazineCost: round.magazineCost ?? this.magazineCost,
            traits,
            traitMap: buildTraitMap(traits),
            // "Pellets ignore Dodge and double Protection" — no trait vocabulary covers it, so it
            // is carried to the sheet as the referee typed it and applied by nobody.
            rules: round.rules ?? []
        };
    }

    static defineSchema() {
        const schema = super.defineSchema();
        schema.equipped = new fields.BooleanField({ required: false, initial: false });
        schema.range = new fields.SchemaField({
            isMelee: new fields.BooleanField({ required: false, initial: false }),
            value: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null }),
            unit: new fields.StringField({
                required: false, blank: true, nullable: true, choices: MGT2.MetricRange, initial: "" }),
            // Core p.165-167: a spacecraft weapon is printed with the furthest RANGE BAND it
            // reaches and not with a Range score.
            band: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.ShipRangeBands })
        });
        schema.damage = new FormulaField({ required: false, blank: true, trim: true, initial: "" });
        // Companion p.93-94. A set because the printed vocabulary is not a partition, and empty
        // because no book types every weapon: guessing a type would be inventing a rule.
        schema.damageType = new fields.SetField(
            new fields.StringField({ required: true, blank: false, choices: MGT2.DamageTypes }),
            { required: false, initial: [] });
        schema.magazine = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.magazineCost = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        // What is in the weapon, against the capacity above.
        schema.loaded = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        // WHICH round is in it — an `ammunition` Item on the same actor, by id, blank for the
        // weapon's own.
        schema.ammunition = new fields.StringField({ required: false, blank: true, initial: "" });
        // One enum selects which range vocabulary the weapon speaks and which accuracy fields it
        // has, instead of a vehicleWeapon type duplicating the whole roll path.
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
        this.processingUsed = 0;
        this.processingCap = this.processing ?? 0;
    }

    static defineSchema() {
        const schema = super.defineSchema();
        schema.equipped = new fields.BooleanField({ required: false, initial: false });
        schema.radiations = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.protection = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        // Core p.102's battle dress carries a Computer/2 and p.104's Computer Weave adds a
        // Computer/0: `null` is no computer system, `0` is Computer/0, and the two are a rung apart.
        schema.processing = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        schema.specialised = createSpecialisedField();

        // DM-1 to every check per missing level of the required skill; not having the skill at all
        // inflicts the usual DM-3 unskilled penalty instead.
        schema.requireSkill = new fields.StringField({ required: false, blank: false });
        schema.requireSkillLevel = new fields.NumberField({
            required: false, min: 0, integer: true, initial: null });


        // Powered battle dress supports its own weight and is effectively weightless while active.
        schema.powered = new fields.BooleanField({ required: false, initial: false });
        // Companion p.68: a breached sealed suit still protects, by less. Read only where a vacuum
        // region names this suit as its protection, and only under the Companion reading.
        schema.breach = new fields.StringField({
            required: false, blank: false, initial: "intact", choices: MGT2.SuitBreaches });
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
        this.processingCap = this.processing;
        this.overload = false;
        this.overCrowded = false;
        this.blockedSoftware = 0;
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.options);
    }

    static defineSchema() {
        const schema = super.defineSchema();

        schema.processing = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.specialised = createSpecialisedField();
        schema.options = createTraitsField("custom");

        return schema;
    }
}

/**
 * A lot in the hold: a freight consignment, a speculative purchase or a bag of mail.
 * @extends {ItemBaseData}
 */
export class CargoData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        // Core p.240-241: a lot is rolled as a tonnage and "cannot be broken up".
        schema.tons = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        // A uuid where the world exists as an Actor, a bare name where it does not.
        schema.destination = new fields.SchemaField({
            world: new fields.DocumentUUIDField({
                type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
            name: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });
        // In campaign days, against `mgt2.campaignDay`. Core p.241 docks a late delivery 1D+4 × 10%.
        schema.dueDay = new fields.NumberField({
            required: false, nullable: true, initial: null, integer: true });
        schema.farePerTon = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });

        // Core p.243 prices a sale as a percentage of the base, so what was paid is recorded as one too.
        schema.basePrice = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        schema.purchasePct = new fields.NumberField({ required: false, nullable: true, initial: null });

        // Core p.243 applies the LARGEST applicable DM rather than their sum, hence pairs and not a sum.
        schema.purchaseDM = new fields.ArrayField(new fields.SchemaField({
            code: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            dm: new fields.NumberField({ required: false, nullable: false, integer: true, initial: 0 })
        }), { initial: [] });
        schema.saleDM = new fields.ArrayField(new fields.SchemaField({
            code: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            dm: new fields.NumberField({ required: false, nullable: false, integer: true, initial: 0 })
        }), { initial: [] });

        // The Law Level this is banned at or above; null is a lot nobody restricts.
        schema.legality = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        // Core p.243's OTHER kind of illegal: rows 61-65 are banned "throughout the Imperium" and
        // print no Law Level, so `legality` cannot say it — a stored 0 would read as Law Level 0,
        // the most permissive there is, and manufacture a smuggler's Sale DM the book never prints.
        schema.illegal = new fields.BooleanField({ required: false, initial: false });

        return schema;
    }

    /** What the lot is worth and which kind of lot it is. */
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
 * A booking, not a passenger: one Item per booking, because Core p.238-239 prices a passage per
 * parsec for a single jump and the fare is what the ship is owed.
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
            name: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
        });
        schema.farePerHead = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });

        return schema;
    }

    /**
     * The baggage allowance is the grade's own number and has no printed competitor, so it derives
     * rather than being stored beside a grade that could disagree with it.
     */
    prepareDerivedData() {
        const grade = MGT2.PassageClasses[this.grade] ?? MGT2.PassageClasses.middle;
        this.baggage = grade.baggage * this.count;
        this.fare = grade.unpaid ? 0 : this.farePerHead * this.count;
        // Core p.158 puts every low passenger through a revival check on arrival.
        this.lowBerth = grade.lowBerth === true;
    }
}

/** A transcribed row of a ship's design. @extends {ItemBaseData} */
export class ComponentData extends ItemBaseData {

    /**
     * Reset for every component and not only software: the owning ship decides `tlBlocked`, so a
     * loose part has to read sanely without one.
     */
    prepareBaseData() {
        this.bandwidthRun = Math.min(this.runAt ?? this.bandwidth, this.bandwidth);
        this.downgraded = this.bandwidthRun < this.bandwidth;
        this.tlBlocked = false;
    }

    static defineSchema() {
        const schema = super.defineSchema();

        schema.category = new fields.StringField({
            required: false, blank: false, initial: "option", choices: MGT2.ComponentCategories });
        // Numeric like the ship's own `tl`, not the `TL12` string a personal item carries.
        schema.tl = new fields.NumberField({ required: false, nullable: false, min: 0, integer: true, initial: 12 });

        // A triple and not a number: almost every High Guard system is priced as a flat tonnage, as
        // a percentage of the hull, or as a percentage with a floor.
        schema.tonnage = new fields.SchemaField({
            tons: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            percent: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            minimum: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 })
        });

        schema.cost = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        // What this row DRAWS, and never what it makes: a power plant's output is its `rating`, the
        // same way a drive's is Thrust-N. `min: 0` is that rule and not an oversight — storing
        // generation as a negative draw would put the plant's output in two fields at once.
        schema.power = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        schema.powerPerTon = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        // HG p.61: any system drawing from the power plant can be Hardened against Ion weapons.
        schema.hardened = new fields.BooleanField({ required: false, initial: false });
        // Thrust-N, Jump-N, Computer/N, Armour-N, Power-N — whichever the category means.
        schema.rating = new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 });
        // What a `software` row spends of the ship's Processing.
        schema.bandwidth = new fields.NumberField({
            required: false, nullable: false, min: 0, integer: true, initial: 0 });
        // Core p.110's downgrade: a choice, so it is stored; null runs at the printed figure.
        schema.runAt = new fields.NumberField({
            required: false, initial: null, nullable: true, min: 0, integer: true });
        schema.quantity = new fields.NumberField({
            required: false, nullable: false, min: 0, integer: true, initial: 1 });
        // A grade, not a `damaged` flag: ship criticals run severity 1-6, so a turret at DM−1 still fires.
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

    /** What this row draws on a hull of `hullTons`. */
    drawFor(hullTons) {
        return (this.power * Math.max(1, this.quantity))
            + (this.powerPerTon * this.tonsFor(hullTons));
    }

    /** What this row makes, which is only ever a power plant's `rating` (HG p.17). */
    get generates() {
        return (this.category === "powerPlant") ? this.rating * Math.max(1, this.quantity) : 0;
    }
}

/**
 * A dose, and a timed effect rather than a possession (CSC p.93-97).
 * @extends {PhysicalItemData}
 */
export class DrugData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.dose = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.onset = new fields.StringField({
            required: false, blank: true, trim: true, nullable: true, initial: "" });
        schema.duration = new fields.StringField({
            required: false, blank: true, trim: true, nullable: true, initial: "" });

        // What it leaves behind, and which pipeline that goes down: "Fatigued" and "2D damage" differ.
        schema.afterEffect = new fields.StringField({
            required: false, blank: true, trim: true, nullable: true, initial: "" });
        schema.afterKind = new fields.StringField({
            required: false, blank: false, initial: "none", choices: MGT2.DrugAfterKinds });

        // CSC p.97 is optional at the table, so an empty block means addiction is off, not unfilled.
        schema.addiction = new fields.SchemaField({
            dosesBefore: new fields.NumberField({
                required: false, nullable: true, initial: null, min: 0, integer: true }),
            checkInterval: new fields.StringField({
                required: false, blank: true, trim: true, nullable: true, initial: "" }),
            cravingDM: new fields.NumberField({
                required: false, nullable: true, initial: null, integer: true })
        });

        return schema;
    }
}

/**
 * Rounds for a weapon, and the fields it overrides on the one it is loaded into.
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
        schema.weaponType = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.magazine = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        schema.magazineCost = new fields.NumberField({
            required: false, nullable: true, initial: null, min: 0, integer: true });
        schema.damage = new FormulaField({
            required: false, blank: true, trim: true, nullable: true, initial: "" });
        schema.traits = createTraitsField("weapon");
        // CSC p.179-182: a few rounds REPLACE the weapon's traits, which the list itself cannot say.
        schema.replaceTraits = new fields.BooleanField({ required: false, initial: false });
        // Rules that are neither damage nor a trait — "pellets ignore Dodge and double Protection".
        schema.rules = new fields.ArrayField(
            new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] });

        return schema;
    }
}

/** A species — and the CREATION FRAME a Traveller's term loop is read from. */
export class SpeciesData extends foundry.abstract.TypeDataModel {
    /** @inheritDoc */
    static migrateData(source, options) {
        migrateTraitArray(source.traits, "species");
        migrateStepArray(source.frame?.steps);
        if ( typeof source.frame?.startAge === "number" ) source.frame.startAge = [{ age: source.frame.startAge }];
        liftLaw(source, "ageing", ["fromTerm", "fromAge", "perTerm", "flat"]);
        liftLaw(source, "backgroundSkills", ["formula", "mandatory", "choices"]);
        return super.migrateData(source, options);
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.traits);
    }

    get #owner() {
        const actor = this.parent?.actor;
        return (actor && ("personal" in actor.system)) ? actor : null;
    }

    /** One per Traveller: a second is refused rather than replacing the first in silence. @inheritDoc */
    async _preCreate(data, options, user) {
        // The sub-variant rule is the one case where a second entry is meant to speak.
        if ( Rules.on("speciesModifiersStack") ) return;
        const existing = this.#owner?.items.find(item => item.type === "species");
        if ( !existing ) return;
        ui.notifications.error(game.i18n.format("MGT2.Actor.SpeciesSingleton", { species: existing.name }));
        return false;
    }

    /** Here and not in the sheet's drop handler, so every creation path points the field at this
     *  Item — a drop, a macro, an import, the creation screen. @inheritDoc */
    _onCreate(data, options, userId) {
        const actor = this.#owner;
        if ( (game.user.id !== userId) || !actor ) return;
        if ( actor.system.personal.species?.id === this.parent.id ) return;
        actor.update({ "system.personal.species": this.parent.id });
    }

    /** @inheritDoc */
    async _preDelete(options, user) {
        const actor = this.#owner;
        if ( !actor || (actor.system.personal.species?.id !== this.parent.id) ) return;
        await actor.update({ "system.personal.species": "" });
    }

    /**
     * The term this frame runs, with what it ADDS to the Core sequence and what it CUTS from it.
     * @type {{sequence: string[], own: Set<string>, cut: Set<string>}}
     */
    get termSequence() {
        const declared = this.frame.steps.map(step => step.key);
        const sequence = declared.length ? declared : [...MGT2.CoreTermSequence];
        return {
            sequence,
            own: new Set(sequence.filter(step => !MGT2.CoreTermSequence.includes(step))),
            cut: new Set(MGT2.CoreTermSequence.filter(step => !sequence.includes(step)))
        };
    }

    /**
     * The check this frame runs at a named step, or null where the frame declares no such step.
     * @param {string} key   A `MGT2.CreationSteps` key
     */
    stepCheck(key) {
        return this.frame.steps.find(step => step.key === key)?.check ?? null;
    }

    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {
            description: new fields.StringField({
                required: false, blank: true, trim: true, nullable: true, initial: "" }),
            descriptionLong: new fields.HTMLField({ required: false, blank: true, trim: true, initial: "" }),
            // Declared rather than inherited: this class is the one that does not extend `ItemBaseData`.
            source: createSourceField(),
            traits: createTraitsField("species"),
            modifiers: new fields.ArrayField(
                new fields.SchemaField({
                    characteristic: new fields.StringField({
                        required: false, blank: true, trim: true, initial: "" }),
                    value: new fields.NumberField({
                        required: false, integer: true, nullable: true, initial: null })
                })
            ),

            frame: new fields.SchemaField({
                // Empty runs the Core sequence.
                steps: new fields.ArrayField(createStepField(), { initial: [] }),
                // The closed set `personal.sex` may hold, declared because a scrape of the `sex`
                // strings the laws below use answers nothing for a species whose only sexed rule is
                // a career gate. The `role` half of the same axis is declared by `tracks`.
                sexes: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
                startAge: createRoleAxisField({
                    age: new fields.NumberField({ required: false, initial: 18, min: 0, integer: true })
                }),
                termYears: new fields.NumberField({ required: false, initial: 4, min: 0, integer: true }),
                // The frame's own justification: a frame that deletes three steps owes the table a why.
                why: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),

                // A term declares what it YIELDS: re-education burns terms and yields nothing, and
                // one printed term explicitly "is not counted toward your physical age".
                termKinds: new fields.ArrayField(new fields.SchemaField({
                    key: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                    label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                    // WHICH TERM NUMBERS the kind governs, because one published table is indexed
                    // by term number: its first term is one thing and every term after it another.
                    fromTerm: new fields.NumberField({ required: false, nullable: true, initial: null, min: 1, integer: true }),
                    toTerm: new fields.NumberField({ required: false, nullable: true, initial: null, min: 1, integer: true }),
                    years: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
                    ages: new fields.BooleanField({ required: false, initial: true }),
                    yieldsBenefit: new fields.BooleanField({ required: false, initial: true }),
                    yieldsAdvancement: new fields.BooleanField({ required: false, initial: true }),
                    yieldsSkills: new fields.BooleanField({ required: false, initial: true })
                }), { initial: [] }),

                tracks: new fields.ArrayField(createTrackDefinitionField(), { initial: [] }),

                // The tray with its LIFETIME removed: permanent, per-Traveller, career-scoped.
                standingModifiers: new fields.ArrayField(createStandingModifierField(), { initial: [] })
            }),

            // Which characteristics this species rolls, with which dice, and which of the six each
            // one replaces.
            characteristicRolls: new fields.ArrayField(new fields.SchemaField({
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                formula: new FormulaField({ required: false, blank: true, initial: "2D" }),
                replaces: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                // The book's own name for a slot: BOL, RES and FOL read as Other or Charm without it.
                // `label` is the full name and `short` the printed abbreviation; the sheet needs both,
                // because the cell prints one and its tooltip the other.
                label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                short: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            }), { initial: [] }),
            // Characteristics this species does not have at all, which is not one it does not roll for.
            withoutCharacteristics: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: MGT2.Characteristics }), { initial: [] }),
            // "Up to your racial maximum" is given a value only for humans, so null is the honest
            // default and it means the general ceiling, not "unlimited".
            racialMaximum: new fields.NumberField({
                required: false, nullable: true, initial: null, min: 1, integer: true }),

            // The ageing law is an EXPRESSION — `a × terms + b` — and not a switch: the published
            // values run −1, −2, −½, +1 and ±1 by sex.
            ageing: createRoleAxisField({
                fromTerm: new fields.NumberField({ required: false, nullable: true, initial: 4, min: 0, integer: true }),
                fromAge: new fields.NumberField({ required: false, nullable: true, initial: 34, min: 0, integer: true }),
                perTerm: new fields.NumberField({ required: false, initial: -1 }),
                flat: new fields.NumberField({ required: false, initial: 0 })
            }),

            // Three species-level rules that stay parameters: they substitute a value into a Core step.
            careerChange: new fields.SchemaField({
                // The Core rule is only that you may not return to the career you just left; one
                // species must serve three terms before attempting another at all.
                minimumTerms: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
            }),
            qualificationOverride: new fields.SchemaField({
                kind: new fields.StringField({
                    required: false, blank: false, initial: "none", choices: MGT2.QualificationOverrides }),
                formula: new FormulaField({ required: false, blank: true, initial: "" }),
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                // Template ids the referee typed — every override is printed with its own exceptions.
                exceptCareers: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] })
            }),
            // `EDU DM + 3` is a DEFAULT and not arithmetic: every published species prints its own
            // count and its own mandatory skills.
            backgroundSkills: createRoleAxisField({
                formula: new FormulaField({ required: false, blank: true, initial: "" }),
                mandatory: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
            // The list the count draws from, typed by the referee: the Core's seventeen are the
            // HUMAN list.
                choices: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] })
            }),
            // One species tests PSI at creation with no term penalty, against `2D − terms served`.
            psiWithoutTermPenalty: new fields.BooleanField({ required: false, initial: false })
        };

        return schema;
    }
}

export class ItemContainerData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.onHand = new fields.BooleanField({ required: false, initial: false });
        schema.location = new fields.StringField({ required: false, blank: true, trim: true, initial: "" });
        schema.weightless = new fields.BooleanField({ required: false, initial: false });
        // A container is stored like anything else: a bag inside a bag is the same reference.
        schema.container = new fields.SchemaField({
            id: new fields.StringField({ required: false, blank: true, initial: "" })
        });

        schema.locked = new fields.BooleanField({ required: false, initial: false }); // GM only
        schema.lockedDescription = new fields.StringField({
            required: false, blank: true, trim: true, nullable: true, initial: "" });
        return schema;
    }

    /** A container has no mass of its own: what it weighs is what is in it. @type {number} */
    get weight() {
        return this.parent.getContentsWeight();
    }

    /** Direct contents only: a nested container counts as the one thing it is. @type {number} */
    get count() {
        return this.parent.contents.reduce((sum, item) => sum + (item.system.quantity ?? 1), 0);
    }
}

/** A station on a ship, not a person in it. */
export class RoleData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.positions = new fields.NumberField({ required: false, initial: 1, min: 0, integer: true });
        // Which row of HG p.23's Crew Requirements table this station is.
        schema.crewRole = new fields.StringField({
            required: false, blank: true, initial: "", choices: MGT2.CrewRoles });
        schema.department = new fields.StringField({
            required: false, blank: false, initial: "command", choices: MGT2.Departments });
        // HG p.23's monthly average for a skill-1 crewman; the eleven construction roles ship the number.
        schema.salary = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.colour = new fields.ColorField({ required: false, nullable: true, initial: null });
        schema.show = new fields.BooleanField({ required: false, initial: true });

        schema.actions = new fields.ArrayField(new fields.SchemaField({
            label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            // `skill` needs a sheet to read the level off, so the roster refuses it on a vacant slot.
            kind: new fields.StringField({
                required: false, blank: false, initial: "skill", choices: MGT2.RoleActions }),
            // Both were free strings and `characteristic` had no control at all, so the lookup
            // never resolved and every station action silently rolled with a characteristic DM of
            // zero.
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            difficulty: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Difficulty }),
            dm: new fields.NumberField({ required: false, initial: 0, integer: true }),
            // Core p.164: which of the round's three steps this action belongs to, so a screen can
            // render the actions that are legal now.
            step: new fields.StringField({
                required: false, blank: true, initial: "actions", choices: MGT2.CombatSteps }),
            // And how often it may be taken, which the rules set per action rather than per kind.
            cap: new fields.StringField({
                required: false, blank: true, initial: "none", choices: MGT2.ActionCaps })
        }), { initial: [] });

        return schema;
    }

    /** The station's construction position, stored key first. */
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
