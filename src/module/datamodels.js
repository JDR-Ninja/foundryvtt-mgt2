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

    /**
     * Only a software package uses these, and they are reset for every `item` for the reason
     * `ComputerData` gives — the owning actor decides `tlBlocked`, so a loose package has to read
     * sanely without one. `bandwidthRun` is not one of those: it is a fact of the package alone.
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
            // No `max`: the old ceiling of 10 was a personal-computer assumption (Core p.161's
            // packages top out low) applied to a ship's, and a `NumberField` CLEANS before it
            // validates — so HG p.73's Advanced Fire Control/3 stored as Bandwidth 10 with no error
            // at all, and 15 of the library's 59 programs had their figure stranded in prose (§1.12).
            bandwidth: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
            // Core p.110: "a Traveller can use any high-Bandwidth software at a lower Bandwidth, to a
            // minimum of the lowest Bandwidth shown" — a choice and never an inference, so it is
            // stored. Null is the package running at its printed figure. The floor the rule names is
            // the software *family*'s and no single Item states it, so `min` is 0 (§9.126).
            runAt: new fields.NumberField({ required: false, initial: null, nullable: true, min: 0, integer: true }),
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
        this.overCrowded = false;
        this.blockedSoftware = 0;
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
            // `ComputerData.processing` rather than a unit of its own — and it is spent as one: a
            // fitted augment stating a figure here is a host `MGT2Helper.runsSoftware` accepts, and
            // `CharacterData#prepareComputers` runs software against it (§9.84).
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

/**
 * One printed cell of a creation table, which is a small EXPRESSION and not a scalar (§9.48).
 * Roughly a third of the Core's cells are: alternations (`Drive or Vacc Suit`), conjunctions
 * (`Deception, Persuade and Stealth`), family wildcards (`Gun Combat (any)`), speciality choices
 * (`Pilot (small craft or spacecraft)`) and dice quantities (`1D Ship Shares`).
 *
 * **One level of nesting and no more.** `mode` says whether the grants are alternatives or all of
 * them, and no Core cell is an `oneOf` of `allOf`s. `text` is the cell as the book prints it, because
 * the referee types it and nothing here parses prose — a cell with text and no grants is legitimate
 * and is what an unstructured row looks like.
 */
function createCellField(options = {}) {
    return new fields.SchemaField({
        text: new fields.StringField({ required: false, blank: true, trim: true }),
        mode: new fields.StringField({
            required: false, blank: false, initial: "all", choices: MGT2.CellModes }),
        grants: new fields.ArrayField(new fields.SchemaField({
            kind: new fields.StringField({
                required: false, blank: false, initial: "skill", choices: MGT2.CreationGrantKinds }),
            // Free text and never a `choices` list: the system ships no skill list at all — a skill is
            // a `talent` Item and no content ships (§9.45) — so a grant names one and
            // `MGT2Helper.matchesSkill` resolves it against whatever the referee's library holds.
            skill: new fields.StringField({ required: false, blank: true, trim: true }),
            // Blank picks none, which is what a level-0 grant does: the choice happens at the point
            // the skill reaches level 1 (folio 58). `choose` is the printed
            // `Pilot (small craft or spacecraft)`, and `specialities` is that cell's shortlist —
            // empty means any.
            speciality: new fields.StringField({ required: false, blank: true, trim: true }),
            specialities: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
            // `Gun Combat (any)`, `Science (any)`, and the Psion's `Any Talent`.
            family: new fields.BooleanField({ required: false, initial: false }),
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            // `1D Ship Shares`, `D3 Enemies` — a quantity that is rolled rather than counted.
            formula: new FormulaField({ required: false, blank: true }),
            value: new fields.NumberField({ required: false, initial: 1, integer: true }),
            mode: new fields.StringField({
                required: false, blank: false, initial: "raise", choices: MGT2.GrantModes }),
            // The per-row floor of `SOC 10 or SOC +1, whichever is higher`. Null is the ordinary case.
            floor: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
            // Which shared Other Benefits definition a `benefit` grant points at, typed by the
            // referee: the definitions ride in the library file, not in the code (§9.40).
            ref: new fields.StringField({ required: false, blank: true, trim: true })
        }), { initial: [] })
    }, options);
}

/**
 * One of a career's skill tables. §9.47 established that a table may be MISSING — the Drifter has no
 * Advanced Education table at all, so a template must not assume five; §9.48 adds that a present one
 * may be GATED, on EDU 8 or EDU 10 depending on the career, or on holding a commission.
 */
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
 * A modifier with the tray's lifetime removed: permanent, per-Traveller, and gated rather than spent
 * (§9.54). **A factory with two call sites** — the species frame declares these, and so does a `career`
 * template, because one printed career carries a standing footnote (*"Travellers with FOL 10+ add +1 to
 * their Benefit rolls"*) that hangs off the career and not off any event row.
 *
 * **The gate is what makes it not a tray entry.** A tray entry is *held* and then *spent*, so its
 * lifetime is state — `uses` counts down, `expiresWhen` fires once. A footnote gated on a score is
 * neither: it switches on and off as the characteristic moves, and it has to be **evaluated at the
 * moment of the roll**. Nothing here is stored on the Traveller at all, which is exactly why the gate
 * belongs on this shape and could not have been added to the tray.
 */
function createStandingModifierField() {
    return new fields.SchemaField({
        dm: new fields.NumberField({ required: false, initial: 0, integer: true }),
        // **A printed DM is not always a number** (§9.121): *"a negative DM equal to the highest skill
        // level the Droyne has in a Black Skill"* is read at the moment of the roll, off a value that
        // moves during creation — a skill the Traveller may not even have yet. `per` multiplies the
        // HIGHEST level held among `skills`, so the printed *"highest"* is the shape and not a
        // convention, and it adds to `dm` rather than replacing it: a rule with both halves is
        // sayable, and a Traveller holding none of the named skills adds nothing at all.
        per: new fields.NumberField({ required: false, initial: 0, integer: true }),
        skills: new fields.ArrayField(
            new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
        // The tray's seven plus the frame-owned steps (§9.120), because the one printed rule that
        // needed a variable DM also names a check no tray entry can be spent on.
        appliesTo: new fields.SetField(new fields.StringField({
            required: true, blank: false, choices: MGT2.CreationChecks }), { initial: [] }),
        // A template id the referee typed; blank is every career.
        career: new fields.StringField({ required: false, blank: true, trim: true }),
        // Blank is ungated, which is what every frame entry written before this field meant.
        gate: new fields.SchemaField({
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            min: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
        }),
        note: new fields.StringField({ required: false, blank: true, trim: true })
    });
}

/**
 * One entry of §9.51's tray — a decision creation defers, wherever it was made. The word *one-shot*
 * §9.38 used for it was wrong: printed entries grant DM+1 to every Survival roll in a career, DM−1 to
 * every commission and promotion check for a Traveller's whole life, and one expires on HOW a career
 * ended rather than on a term count.
 *
 * **A factory with two call sites**, because a printed row saying *"DM+1 to one Benefit roll"* grants
 * exactly what the ledger holds (§9.109): the `career` template writes these and `flags.mgt2.chargen`
 * carries them. A second copy of the schema is how the two would silently stop agreeing.
 */
export function createTrayEntryField() {
    return new fields.SchemaField({
        kind: new fields.StringField({
            required: false, blank: false, initial: "dm", choices: MGT2.TrayKinds }),
        // The number a `dm` carries. Every other kind reads `value` instead.
        dm: new fields.NumberField({ required: false, initial: 0, integer: true }),
        // What an `unlock`, a `careerOffer`, a `careerBlock` or a `grant` names — a career template id
        // or a skill, typed by the referee, so §9.47's invariant is untouched.
        value: new fields.StringField({ required: false, blank: true, trim: true }),
        // A SET, because "event bonuses to advancement rolls may be applied to commission rolls
        // instead" makes the holder choose which check to spend it on.
        appliesTo: new fields.SetField(new fields.StringField({
            required: true, blank: false, choices: MGT2.TrayChecks }), { initial: [] }),
        scope: new fields.StringField({
            required: false, blank: false, initial: "thisCareer", choices: MGT2.TrayScopes }),
        // Which career, when the scope is a named one or this one.
        career: new fields.StringField({ required: false, blank: true, trim: true }),
        duration: new fields.StringField({
            required: false, blank: false, initial: "oneShot", choices: MGT2.TrayDurations }),
        // Null is unlimited. A `thisCareer` DM on every Survival roll has no count.
        uses: new fields.NumberField({
            required: false, nullable: true, initial: 1, min: 0, integer: true }),
        // §9.51's seventh field, and the one that broke "a value, a condition and a scope": a predicate
        // over the record's EXIT MODE and not over a term count, because a printed penalty expires
        // according to whether the first career was left voluntarily.
        expiresWhen: new fields.StringField({
            required: false, blank: true, initial: "", choices: MGT2.CareerExitModes }),
        // What EARNS the entry, which `expiresWhen` cannot say: that field is about when a live
        // modifier stops applying, not about whether it was ever granted. Most printed entries are
        // branch-bound — *"if you report your commanding officer"*, *"if you succeed"*, *"either gain
        // Tactics 1 or DM+4"* — and the loop must not push one whose branch was not taken.
        condition: new fields.StringField({
            required: false, blank: false, initial: "always", choices: MGT2.TrayConditions }),
        // The Companion's forced draft is exempt from the once-per-lifetime limit, and the errata says
        // so as a general statement rather than a local exception (§9.51, §9.55).
        overridesOncePerLifetime: new fields.BooleanField({ required: false, initial: false }),
        note: new fields.StringField({ required: false, blank: true, trim: true })
    });
}

/**
 * One row of a career's Events or Mishaps table (§9.49). The prose stays the referee's and nothing
 * parses it — but three facts printed INSIDE that prose are decisions the ledger makes automatically,
 * so they ride beside it: does this eject, what happens to the term's Benefit roll, and does it name
 * another career. A fourth consequence, characteristic loss, is a `characteristicLog` source instead.
 *
 * `ejects` defaults per TABLE and not per field: folio 18's general rule is that a mishap forces you
 * out "unless otherwise stated" while an event does not, so a row the referee has typed no ejection
 * on already says the printed thing (§9.49). `neverEjects` on the template then flips both.
 */
function createEventRowField({ ejects = "stays", ...options } = {}) {
    return new fields.SchemaField({
        roll: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
        text: new fields.StringField({ required: false, blank: true, trim: true }),
        ejects: new fields.StringField({
            required: false, blank: false, initial: ejects, choices: MGT2.EjectionOutcomes }),
        benefit: new fields.StringField({
            required: false, blank: false, initial: "none", choices: MGT2.BenefitRowEffects }),
        benefitCount: new fields.NumberField({ required: false, initial: 1, integer: true }),
        // One printed row awards `D3 Benefit rolls`, so the count is rolled rather than counted. A
        // FORMULA BESIDE THE NUMBER and not a retyped field, which is the shape a cell already carries
        // for `1D Ship Shares` (§9.48). Blank takes the count above.
        benefitFormula: new FormulaField({ required: false, blank: true, initial: "" }),
        // A template id the referee typed, so §9.47's invariant is untouched: a row may send a
        // Traveller to another career, offer one with qualification waived, or borrow another
        // career's tables for a single roll without entering it at all.
        career: new fields.StringField({ required: false, blank: true, trim: true }),
        // WHICH of §9.49's three senses the reference above carries. One field was answering three
        // questions and therefore answering all of them "offer": one printed row offers a career with
        // qualification waived, **seven compel one** — *"you must take the Prisoner career in your next
        // term"*, which no tray kind covered — and one rolls on another career's Events table without
        // entering it at all. `offer` is the initial because it is what every row meant before this.
        careerMode: new fields.StringField({
            required: false, blank: false, initial: "offer", choices: MGT2.RowCareerModes }),
        // Sub-tables must be ADDRESSABLE: two careers' rows jump straight to the Unusual Event 1D
        // branch, skipping the 2D Life Event roll above it, so the shared block is addressed at
        // sub-table granularity and not as one table per name.
        subTable: new fields.StringField({ required: false, blank: true, trim: true }),
        // The sub-roll printed INSIDE the prose, which §9.49 names and left unshaped: *"roll 9+ on any
        // skill you have learned during this term"*. It is the one place a creation check names a
        // SKILL rather than a characteristic — folio 11's *"a few are skill checks"* — and therefore
        // the one place the untrained DM can apply at all. What the outcome then means stays the
        // referee's prose; the loop rolls it and says whether it passed.
        check: new fields.SchemaField({
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            skill: new fields.StringField({ required: false, blank: true, trim: true }),
            target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
        }),
        // A named track this row moves, and by how much: prison events shift a parole threshold by
        // +2, +1, -1, -2, -1D or a full re-roll, which is neither a tray entry nor a characteristic
        // (§9.52). Blank leaves every track alone.
        track: new fields.SchemaField({
            key: new fields.StringField({ required: false, blank: true, trim: true }),
            formula: new FormulaField({ required: false, blank: true }),
            value: new fields.NumberField({ required: false, initial: 0, integer: true }),
            // A row that re-rolls the track from its own definition rather than adjusting it.
            reroll: new fields.BooleanField({ required: false, initial: false })
        }),
        // Row 12 on six careers awards a promotion or a commission OUTRIGHT, with no roll — which is
        // neither a grant, nor a benefit, nor an ejection (§9.109). The vocabulary is the term log's
        // own, so a row writes what a later step already reads. **The mode is load-bearing**: one
        // career prints "a promotion **or** a commission", which is a choice, while §9.55's errata is
        // precisely that the two may both fall in one term.
        awards: new fields.SchemaField({
            outcomes: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: MGT2.TermOutcomes }), { initial: [] }),
            mode: new fields.StringField({
                required: false, blank: false, initial: "oneOf", choices: MGT2.CellModes }),
            // *"You **may** gain a promotion or a commission"* — the Traveller can decline both arms,
            // and that is a different fact from which arm they take. It rides BESIDE `mode` rather
            // than becoming a third value of it: `mode` is `MGT2.CellModes`, shared with every printed
            // table cell, and no cell in the books offers "or nothing".
            optional: new fields.BooleanField({ required: false, initial: false })
        }),
        grant: createCellField({ required: false }),
        // A DM on a Benefit roll is a MODIFIER and not an award, so it is none of `benefit`'s five
        // values: at least six printed rows carry one, and §9.51's tray already models it exactly
        // (§9.109). The row writes ledger entries and the loop pushes them as printed.
        tray: new fields.ArrayField(createTrayEntryField(), { initial: [] })
    }, options);
}

/**
 * Where a grant came from, written at the moment it is written (§9.38).
 *
 * **It is a few bytes at write time and impossible to reconstruct later.** A skill taken at level 1
 * in term 2 and raised in term 4 cannot be unwound by inspection afterwards, so *restarting* a
 * Traveller — as opposed to resuming one — needs this or it needs a deletion. `term` is the position
 * in the timeline, `career` the record's id, `table` whichever of the career's tables paid out.
 *
 * Blank on everything a player typed by hand, which is the ordinary state of every Item in a world
 * that has never run creation.
 */
function createProvenanceField() {
    return new fields.SchemaField({
        term: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
        career: new fields.StringField({ required: false, blank: true, trim: true }),
        table: new fields.StringField({ required: false, blank: true, trim: true }),
        note: new fields.StringField({ required: false, blank: true, trim: true })
    });
}

/**
 * A named track, as the template or the frame DECLARES it — the value it reaches lives on the record
 * or on the ledger (§9.54). §9.52 invented this shape for the Prisoner's Parole Threshold without
 * naming it: a possibly-dice initial, a cap, and named adjustments carrying provenance.
 *
 * `monotone` is the field §9.40 needs and did not have. A track moves in BOTH directions — a Hiver's
 * status falls as readily as it rises, and a Droyne's rank falls too, ejecting them below zero — so
 * "the highest rank reached" reads a high-water mark, and only where the frame says the track climbs.
 */
function createTrackDefinitionField() {
    return new fields.SchemaField({
        key: new fields.StringField({ required: false, blank: true, trim: true }),
        label: new fields.StringField({ required: false, blank: true, trim: true }),
        kind: new fields.StringField({
            required: false, blank: false, initial: "numeric", choices: MGT2.TrackKinds }),
        initial: new FormulaField({ required: false, blank: true }),
        cap: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
        monotone: new fields.BooleanField({ required: false, initial: false }),
        // The rungs of an enumerated track, in order, so "fell to the one below" is computable.
        values: new fields.ArrayField(
            new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] })
    });
}

/**
 * One declared step of a frame's term, and the check the printed frame runs at it (§9.120).
 *
 * **A step was a bare key.** The sequence said where a species' own step fires and nothing said what
 * it rolls, so the Droyne continuation check's `2+`, the K'kree household timetable and the promotion
 * difficulty off the SOC Rank table lived in prose while the schema pretended the step was whole. The
 * key stays the row's identity — the sequence, the derived cut and the term cursor all read it — and
 * the check hangs off it, which is where a check already lives one level down: `assignments[].survival`
 * and an event row's own `check` are the same move (§9.48, §9.49).
 *
 * **The check is folio 11's and nothing more**: `2D + the named term's DM against a target`. There is
 * no dice field because no printed step check rolls anything else, and a step that indexes a table is
 * not a check at all.
 */
function createStepField() {
    return new fields.SchemaField({
        key: new fields.StringField({
            required: true, blank: false, initial: "elect", choices: MGT2.CreationSteps }),
        check: new fields.SchemaField({
            // A step is a position in the term and most checks are simply made there. One is not:
            // *"any time a Mishap occurs the Droyne must make a continuation check"*, which the step
            // list can place but cannot condition.
            when: new fields.StringField({
                required: false, blank: false, initial: "everyTerm", choices: MGT2.StepCheckTriggers }),
            // The named term. A step check names a SKILL more often than a characteristic — Patriarchy,
            // Caste, "Diplomat or Persuade" — and the list is the shape `qualification.characteristics`
            // already carries for "DEX or INT 5+": the best of them is what rolls. Free text for the
            // same reason every other skill reference is (§9.45): no skill list ships.
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            skills: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
            // The printed target, where the line prints one number. **0 is a rung that takes anyone** —
            // the SOC Rank table prints "Automatic" against one band — which is what a career
            // template's `difficulty` already means by 0. Null is a check whose target is elsewhere:
            // the ladder below, or the career's own line.
            target: new fields.NumberField({
                required: false, nullable: true, initial: null, integer: true }),

            // What the LADDER is read against, blank for a check with one printed target. Two states
            // because two are printed: a household timetable indexed by term number, and a promotion
            // difficulty indexed by a SOC band.
            index: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.StepCheckIndices }),
            indexCharacteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            // The printed table, one row as printed. `from`/`to` mirror the index column exactly as
            // `termKinds` does (§9.119), so a last row reading `8+` is `to` left null — and a table
            // with a HOLE in it keeps its hole: the SOC Rank table skips SOC 10 entirely, and a
            // Traveller at that score matches no row, which is the printed state and not an error.
            ladder: new fields.ArrayField(new fields.SchemaField({
                from: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                to: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                // What this row of the table awards, over what the check awards on every row: the
                // household timetable alternates a skill roll against a level in Patriarchy.
                //
                // **Not conditioned on the roll, and the book is what says so**: one row of that table
                // separates its two clauses — *"Gains basic training in career. **If the Patriarchy
                // check is successful**, gain Senior Wife and D3 family members"* — so a column the
                // book conditions where it means to is read as unconditional where it does not. What
                // the roll buys is the check's own `onPass`.
                award: createStepOutcomeField()
            }), { initial: [] }),

            // A DM the named term does not supply and no characteristic derives: *"caste number as a
            // negative DM"* reads a track the frame itself declared. `per` is signed and is a
            // multiplier over the track's value, so −1 is the printed line and −2 would be sayable.
            trackModifiers: new fields.ArrayField(new fields.SchemaField({
                track: new fields.StringField({ required: false, blank: true, trim: true }),
                per: new fields.NumberField({ required: false, initial: 1, integer: true })
            }), { initial: [] }),

            onPass: createStepOutcomeField(),
            onFail: createStepOutcomeField()
        })
    });
}

/**
 * What one arm of a declared step's check does (§9.120).
 *
 * **The vocabulary is the event row's, deliberately and not by coincidence**: a printed row is a line
 * with a check and consequences, and a step check's arms are the same list — this ends the career, that
 * moves a named track, a third grants a cell or writes an outcome the later steps already read (§9.49,
 * §9.109). A second vocabulary for the same four facts is how two readers silently stop agreeing.
 *
 * **Three call sites**, which is why it is a factory: the pass arm, the fail arm, and a ladder row's
 * own award. No `reroll` beside the track move — an event row has one because prison rows re-roll a
 * parole threshold, and no step check prints anything of the kind.
 */
function createStepOutcomeField() {
    return new fields.SchemaField({
        ejects: new fields.StringField({
            required: false, blank: false, initial: "stays", choices: MGT2.EjectionOutcomes }),
        outcomes: new fields.SetField(new fields.StringField({
            required: true, blank: false, choices: MGT2.TermOutcomes }), { initial: [] }),
        // *"Elevated one degree"*: `value` is RUNGS on an enumerated track and points on a numeric one,
        // which is the one reading that lets a caste degree and a parole threshold share a field.
        track: new fields.SchemaField({
            key: new fields.StringField({ required: false, blank: true, trim: true }),
            value: new fields.NumberField({ required: false, initial: 0, integer: true }),
            formula: new FormulaField({ required: false, blank: true })
        }),
        // A cell with text and no grants is legitimate and is what the unwritable half looks like: the
        // K'kree household's *"gain Senior Wife and D3 family members"* emits dependent Actors, and
        // §9.40's output map still has no row for them.
        //
        // Required, unlike an event row's, because the editor for an arm is drawn for every arm: an
        // optional SchemaField initialises to `undefined` and the cell would render off a nothing.
        grant: createCellField()
    });
}

/**
 * `frame.steps` was a bare `string[]` and each entry is now a row carrying its own check (§9.120).
 * Every stored frame written before that — three packed species and whatever a world has typed —
 * hydrates through here, and a row that is already an object is left alone.
 */
function migrateStepArray(steps) {
    if ( !Array.isArray(steps) ) return;
    for ( let i = 0; i < steps.length; i++ ) {
        if ( typeof steps[i] === "string" ) steps[i] = { key: steps[i] };
    }
}

/**
 * A career, in either of its two roles.
 *
 * **One type, two roles, and the discriminator is location** (§9.38): a `career` embedded in an Actor
 * is the RECORD of a career served; the same type sitting in a pack or the world is the TEMPLATE
 * carrying that career's tables. Nothing declares which — `isTemplate` reads it off the parent, and a
 * field that cannot desync is worth more than one that is explicit. Half the schema is null in either
 * role, and the sheet shows the half that applies.
 *
 * A record keeps its own COPY of the tables, and that is the point rather than an accident: a UUID
 * back to the library would put an async pack read inside the term loop (§9.37), and a Traveller built
 * last year still has to read correctly in a world whose library has since been edited.
 *
 * **No career name is written anywhere in this system's code (§9.47).** Every rule the book states as
 * a list of career names — the pension's four exclusions, the commission's three services, the
 * qualification age DM's two numbers, basic training's two exceptions, the three assignment-change
 * groups, the Medical Bills row — is a field below instead.
 */
export class CareerData extends ItemBaseData {

    /**
     * An Item's parent is the Actor it is embedded in, or null in a pack or the world directory. That
     * is the whole discriminator, and it is read rather than stored.
     * @type {boolean}
     */
    get isTemplate() {
        return !this.parent?.parent;
    }

    static defineSchema() {
        const schema = super.defineSchema();

        /* ---- TEMPLATE: what the career DOES. Empty on a record. ---- */

        // §9.41: university and the military academy are a kind on this same Item, because what a
        // Traveller ends up with is a term served, an assignment and an event log either way. What
        // differs is only which rolls exist, and a `kind` says so honestly instead of pretending that
        // entry is a qualification and graduation an advancement.
        schema.kind = new fields.StringField({
            required: false, blank: false, initial: "career", choices: MGT2.CareerKinds });

        // The qualification target number, 0 where the career takes anyone. A NUMBER and not
        // `DiseaseData`'s difficulty string: this one is rolled against, never named.
        schema.difficulty = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });

        // The rest of §9.53's six modes. `characteristics` is a LIST because the Entertainer prints
        // "DEX or INT 5+"; `autoIf` is the Noble's "automatic qualification if your SOC is 10 or
        // higher", printed on the same line as its own target — both clauses the book's own, so this
        // is simply populated and needs no ruling marker.
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
            // "DM-1 for every previous career" is printed on each career's own Qualification line and
            // is ABSENT from one of the twelve — four of the sixteen once the careers printed outside
            // the chapter are counted — which is why §9.38 was wrong to promote it to a general rule.
            // 0 is the honest initial: a template says what its own line prints, and an initial of -1
            // would apply the DM to the careers that print none.
            perPreviousCareer: new fields.NumberField({ required: false, initial: 0, integer: true }),
            requiresPermission: new fields.BooleanField({ required: false, initial: false })
        });

        // "The Army and Marines at 30+, the Navy at 34+" — three career names and two numbers that
        // §9.38 had written into prose. `from` null is a career the DM is not printed on, which is
        // the Drifter's and the Prisoner's state and always was (§9.53).
        schema.ageDM = new fields.SchemaField({
            from: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
            dm: new fields.NumberField({ required: false, initial: 0, integer: true })
        });

        schema.commission = new fields.BooleanField({ required: false, initial: false });
        // The check itself, which §9.53 left out when it made "Army, Navy and Marines only" a
        // boolean: the books print "Commission: SOC 8+" on the career's own line beside its
        // Qualification, so the target and the characteristic are the template's too. The boolean
        // above says whether the step exists at all; a frame that deletes the step deletes it for
        // every career at once (§9.54), which is a different fact and stays where it is.
        schema.commissionCheck = new fields.SchemaField({
            characteristic: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
            target: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
        });
        // The four careers excluded from the pension are a boolean here, not a name list (§9.40).
        schema.pensionable = new fields.BooleanField({ required: false, initial: true });
        // BLANK is a template that declares no rule, which is a real state and the one §9.56 item 6
        // decides for: the book groups the careers two ways and leaves one in neither list. The
        // default a blank falls back to is the `undeclaredAssignmentChange` world setting, so the
        // answer is the referee's and never a name in this file.
        schema.assignmentChange = new fields.StringField({ required: false, blank: true,
            initial: "", choices: MGT2.AssignmentChangeRules });
        // Blank is a career that grants no basic training at all, which a frame with no such step
        // needs (§9.54).
        schema.basicFrom = new fields.StringField({ required: false, blank: true,
            initial: "service", choices: MGT2.BasicTrainingTables });
        // Beats the generic no-return check rather than being filtered by it, and it must: this is
        // the fallback, and closing it leaves a Traveller with nowhere to go (§9.47).
        schema.alwaysAvailable = new fields.BooleanField({ required: false, initial: false });
        // "May not leave or be ejected from this career, not even by a Mishap" (§9.52). It also flips
        // `ejects`' per-row default, which is why the row carries the field and the code carries none.
        schema.neverEjects = new fields.BooleanField({ required: false, initial: false });
        schema.blocksAnagathics = new fields.BooleanField({ required: false, initial: false });
        schema.eventRow7 = new fields.StringField({
            required: false, blank: false, initial: "lifeEvent", choices: MGT2.EventRow7 });
        // The template-named leaving rule that DISPLACES the generic outcomes rather than layering on
        // them (§9.52): every result that is not "greater than the threshold" produces continue, so a
        // roll under the terms served cannot end the career and a natural 12 releases.
        schema.exitRule = new fields.SchemaField({
            track: new fields.StringField({ required: false, blank: true, trim: true }),
            test: new fields.StringField({ required: false, blank: true, trim: true })
        });
        // Which row of the Medical Bills table this career's employer sits on — the three rows are
        // career GROUPS, so the template says which and the grid ships once. Blank is legitimate:
        // neither the Prisoner nor the Psion appears in any row, and a prisoner has no employer to
        // bill (§9.39, §9.52).
        schema.medicalBillsRow = new fields.StringField({ required: false, blank: true, trim: true });
        // §9.42: species careers are ordinary templates carrying a restriction, and for the Aslan a
        // gender gate as well. Both free text, because a species is an Item the referee typed.
        schema.restrictedTo = new fields.SchemaField({
            species: new fields.StringField({ required: false, blank: true, trim: true }),
            gender: new fields.StringField({ required: false, blank: true, trim: true })
        });

        // Rank ladders are a NAMED SET the assignments point at, and that single generalisation
        // dissolves four apparent exceptions (§9.48): three services run one enlisted plus one officer
        // ladder shared by all their assignments, one career runs two ladders for three assignments,
        // and one runs three whose rank numbers do not line up. Rank 0 can carry a bonus, granted on
        // entry — which the design never placed relative to basic training.
        schema.rankLadders = new fields.ArrayField(new fields.SchemaField({
            id: new fields.StringField({ required: false, blank: true, trim: true }),
            name: new fields.StringField({ required: false, blank: true, trim: true }),
            officer: new fields.BooleanField({ required: false, initial: false }),
            rows: new fields.ArrayField(new fields.SchemaField({
                rank: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
                title: new fields.StringField({ required: false, blank: true, trim: true }),
                bonus: createCellField({ required: false })
            }), { initial: [] })
        }), { initial: [] });

        // The survival and advancement targets are per ASSIGNMENT, not per career, and Assignment
        // Skills is one sub-table per assignment — which is why the tables number up to seven rather
        // than five (§9.48).
        schema.assignments = new fields.ArrayField(new fields.SchemaField({
            name: new fields.StringField({ required: false, blank: true, trim: true }),
            ladder: new fields.StringField({ required: false, blank: true, trim: true }),
            officerLadder: new fields.StringField({ required: false, blank: true, trim: true }),
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

        // §9.38's own test — is the entry a text or an effect? — makes `Cr50000`, `SOC +1`,
        // `Ship Share` and `Gun` effects, so the per-career roll → row map is structured like the
        // skill tables and only the shared Other Benefits definitions sit outside it.
        schema.benefits = new fields.SchemaField({
            cash: new fields.ArrayField(
                new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }), { initial: [] }),
            other: new fields.ArrayField(createCellField(), { initial: [] })
        });

        schema.eventTable = new fields.ArrayField(createEventRowField(), { initial: [] });
        schema.mishapTable = new fields.ArrayField(
            createEventRowField({ ejects: "ejects" }), { initial: [] });

        // The same shape §9.54 gave the species frame, one level down: a career may print a standing
        // FOOTNOTE rather than an event row — *"Travellers with FOL 10+ add +1 to their Benefit
        // rolls"* — and a footnote is not a tray entry. It is never granted, never spent and never
        // expires; its gate switches it on and off as the score moves, so it is read at the moment of
        // each roll. One factory serves both levels, which is what stops the two from drifting apart.
        schema.standingModifiers = new fields.ArrayField(createStandingModifierField(), { initial: [] });

        // Career-scoped tracks, which `exitRule.track` names. The Prisoner's Parole Threshold is the
        // only Core one and it is not the tray (neither one-shot nor a modifier), not the
        // characteristic log, and not `terms`, `rank` or `events[]` (§9.52).
        schema.tracks = new fields.ArrayField(createTrackDefinitionField(), { initial: [] });

        /* ---- RECORD: what this Traveller DID. Empty on a template. ---- */

        schema.assignment = new fields.StringField({ required: false, blank: true });
        schema.terms = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.rank = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        // Which of the template's ladders this record is on, because a commission moves it (§9.48).
        schema.ladder = new fields.StringField({ required: false, blank: true, trim: true });
        // The rank reached before a commission moved the record to the officer ladder, which resets
        // `rank` to 1 — so the number is gone the moment it is needed. Kept because
        // `officerRankNumbering` is a live question and a table reading the two ladders as one line
        // of service cannot reconstruct it afterwards (§9.56 item 4).
        schema.enlistedRank = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.events = new fields.ArrayField(
            new fields.SchemaField({
                age: new fields.NumberField({ required: false, integer: true }),
                description: new fields.StringField({ required: false, blank: true, trim: true })
            })
        );

        // Four rules read the MANNER of entering or leaving rather than the fact (§9.53), and
        // `stillServing` is also what makes §9.54's parallel records possible: the loop iterates the
        // records that are still open, not one.
        schema.entryMode = new fields.StringField({ required: false, blank: false,
            initial: "qualified", choices: MGT2.CareerEntryModes });
        schema.exitMode = new fields.StringField({ required: false, blank: false,
            initial: "stillServing", choices: MGT2.CareerExitModes });

        // Age is a SUM over this log and never `18 + 4 × terms` (§9.53): a Companion pre-career starts
        // its Traveller at 22 + 2D3, and a term that "is not counted toward your physical age" sets
        // `ages` false. `years` null takes the frame's own term length. `ejected` is a FIELD and never
        // a phrase (§9.49) — a line of prose saying "not ejected" would fool any text match.
        schema.termLog = new fields.ArrayField(new fields.SchemaField({
            term: new fields.NumberField({ required: false, initial: 1, min: 0, integer: true }),
            years: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
            ages: new fields.BooleanField({ required: false, initial: true }),
            // Null is a term with no survival check at all, which a frame that deletes the step
            // produces (§9.54) — it is not the same fact as a failed one.
            survived: new fields.BooleanField({ required: false, nullable: true, initial: null }),
            ejected: new fields.BooleanField({ required: false, initial: false }),
            // What the frame said this term yields, so a term that grants no benefit roll and no
            // advancement is legible afterwards rather than inferred (§9.54's term kinds).
            kind: new fields.StringField({ required: false, blank: true, trim: true }),
            // What the term PRODUCED, as a set of facts a later step reads rather than as prose
            // (§9.103's owed field). It is what makes §9.55's errata assertable: a commission and an
            // advancement in the same term are two members here, and matching a note for the word
            // would be exactly what §9.49 forbids for `ejects`.
            outcomes: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: MGT2.TermOutcomes }), { initial: [] }),
            note: new fields.StringField({ required: false, blank: true, trim: true })
        }), { initial: [] });

        // §9.52's Parole Threshold, and §9.54 names the shape: a possibly-dice initial, a cap, named
        // adjustments carrying provenance. Career-scoped, so it lives on the record and dies with it —
        // a track whose scope is the Traveller is on the ledger flag instead.
        schema.track = new fields.SchemaField({
            key: new fields.StringField({ required: false, blank: true, trim: true }),
            value: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
            cap: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
            adjustments: new fields.ArrayField(new fields.SchemaField({
                value: new fields.NumberField({ required: false, initial: 0, integer: true }),
                term: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                note: new fields.StringField({ required: false, blank: true, trim: true })
            }), { initial: [] })
        });

        return schema;
    }

    /**
     * Whether the names this template points at are names it declares. Advisory, never a block — the
     * `system.design` ledger's ruling (§9.92) arrived at again from the other end: a career is typed
     * over several sittings and a half-filled form is as common as a mistake.
     *
     * **These are references INSIDE one Item, which is the only reason they can be checked at all.**
     * §9.47 leaves a career name, a species name and a skill name free text at both ends on purpose —
     * the referee types their own careers and nothing in this system may hold a registry of names. A
     * ladder id and a track key are a different kind of thing: both ends are declared in this same
     * document, so resolving one costs that invariant nothing.
     *
     * Blank is never an issue. A career with no ranks names no ladder and a career with no track names
     * no track; what is reported is a name that was typed and resolves to nothing.
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
            // An officer ladder must also BE one: a commission that moves the record onto an enlisted
            // ladder is the defect this half catches and the one above cannot.
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

        // Creation grants skills faster than a player can invent fiction — background skills, basic
        // training, a table roll, a benefit — and a level raised twice cannot be unwound afterwards
        // by inspection (§9.38, §9.45).
        schema.provenance = createProvenanceField();

        return schema;
    }
}

export class ContactData extends ItemBaseData {

    /**
     * `relation` and `status` were free strings and now carry `choices`, so a value from outside the
     * vocabulary would fail validation on load. It is coerced to the field's own initial rather than
     * left to throw: the two lists are what the relations tab already localises through
     * `MGT2.Contact.Relation.<key>`, so a stored value that is not a key was already rendering as a
     * raw i18n miss (§9.44).
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
            speciality: new fields.StringField({ required: false, blank: true, trim: true }),
            characteristic: new fields.StringField({ required: false, blank: true, trim: true })
        });

        // §9.44: `choices` on the two the LEDGER writes, because a bad key from code renders as a raw
        // i18n miss where a human picking from a list could never produce one. `attitude` keeps its
        // free string — nothing in creation writes it.
        schema.status = new fields.StringField({
            required: false, blank: true, trim: true, initial: "Alive", choices: MGT2.ContactStatus });
        schema.attitude = new fields.StringField({ required: false, blank: true, trim: true, initial: "Unknow" });
        schema.relation = new fields.StringField({
            required: false, blank: true, trim: true, initial: "Contact", choices: MGT2.ContactRelations });
        schema.title = new fields.StringField({ required: false, blank: true, trim: true });
        schema.nickname = new fields.StringField({ required: false, blank: true, trim: true });
        schema.species = new fields.StringField({ required: false, blank: true, trim: true });
        schema.gender = new fields.StringField({ required: false, blank: true, trim: true });
        schema.pronouns = new fields.StringField({ required: false, blank: true, trim: true });
        schema.homeworld = new fields.StringField({ required: false, blank: true, trim: true });
        schema.location = new fields.StringField({ required: false, blank: true, trim: true });
        schema.occupation = new fields.StringField({ required: false, blank: true, trim: true });
        schema.notes = new fields.HTMLField({ required: false, blank: true, trim: true });

        // The one field §9.44 found missing, and it has exactly two cases: the Connections Rule, where
        // the contact IS another Traveller at the table, and ordinary play, where the referee
        // eventually statblocks them as an `npc`. **The mirror is never created automatically** — A's
        // Rival need not hold A as anything at all, and a one-sided grudge is the commonest kind.
        schema.actor = new fields.DocumentUUIDField({ type: "Actor", required: false });
        schema.provenance = createProvenanceField();

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
        this.overCrowded = false;
        this.blockedSoftware = 0;
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
        // Core p.243's OTHER kind of illegal: rows 61-65 of the Trade Goods table are banned
        // "throughout the Imperium" and print no Law Level at all, so `legality` cannot say it —
        // a stored 0 would read on the sheet as Law Level 0, the most permissive there is, and
        // would manufacture a smuggler's Sale DM the book never prints (§9.141).
        schema.illegal = new fields.BooleanField({ required: false, initial: false });

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

    /**
     * Only a `software` component uses these, and they are reset for every component for the reason
     * `ItemData` gives — the owning ship decides `tlBlocked`, so a loose part has to read sanely
     * without one. `bandwidthRun` is not one of those: it is a fact of the package alone.
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
        // What a `software` row spends of the ship's Processing. §9.100 B2 made the component the
        // ship's software carrier for the sake of `rating`, which left the four clauses of Core
        // p.110 reading a carrier no ship uses; these two are the pair §9.128 named as the price of
        // the reconciliation, and they mean nothing on any other category. Same shape as
        // `ItemData.software`, deliberately — one concept, and the ship reads both (§9.131).
        schema.bandwidth = new fields.NumberField({
            required: false, nullable: false, min: 0, integer: true, initial: 0 });
        // Core p.110's downgrade: a choice and never an inference, so it is stored, and null is the
        // package running at its printed figure (§9.126).
        schema.runAt = new fields.NumberField({
            required: false, initial: null, nullable: true, min: 0, integer: true });
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

/**
 * A species — and, from §9.54, the CREATION FRAME a Traveller's term loop is read from.
 *
 * §9.42 called for "one small block" of parameters. That was measured against a summary table rather
 * than against the books, and it is the wrong SHAPE and not merely too short: three published species
 * declare their own procedures, deleting and adding steps of the term rather than substituting values
 * into the Core's. So a frame declares the term's steps, its tables and its tracks the way a `career`
 * template declares a career's behaviour, and **the Core sequence is simply the default frame** — a
 * species Item that says nothing runs folio 8 unchanged.
 *
 * §9.47 made this move one level down: a rule the book states as a list of career names becomes a
 * field on the template. This is the same move one level up.
 *
 * **The species Item is the ONLY route to the loop** (§9.99). A Traveller holds one reference to it —
 * the embedded Item — and the label, the starting age, the term length and the step list all resolve
 * through that. `personal.species` is a display string written beside the Item and must never be the
 * route: two parallel fields can desync and one cannot.
 *
 * **The Item is per VARIANT, not per species name** (§9.42): two Vargr statlines exist under one name,
 * STR−1 in the Core and STR−2 in *Aliens of Charted Space 1*, chosen by where the Traveller was
 * raised. That is why `source` is load-bearing here and merely courteous elsewhere — the book is what
 * tells two frames apart when their names are identical, and a referee who picks the wrong one runs a
 * different loop.
 *
 * **No alien content ships.** A referee types their species exactly as they type their careers (§9.36).
 */
export class SpeciesData extends foundry.abstract.TypeDataModel {
    /** @inheritDoc */
    static migrateData(source, options) {
        migrateTraitArray(source.traits, "species");
        migrateStepArray(source.frame?.steps);
        return super.migrateData(source, options);
    }

    prepareDerivedData() {
        this.traitMap = buildTraitMap(this.traits);
    }

    /**
     * The term this frame runs, with what it ADDS to the Core sequence and what it CUTS from it. Both
     * are derived against `MGT2.CoreTermSequence` and never authored (§9.54) — a frame that drops
     * ranks drops the commission step with them, without anyone having to remember to list it — and
     * an empty `steps` IS the Core sequence, so no frame ever enumerates the default.
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
     * The check this frame runs at a named step, or null where the frame declares no such step (§9.120).
     * A step declared twice answers at its first row: the sequence is a list of steps, and which of two
     * identical keys the cursor is on is a question it cannot ask.
     * @param {string} key   A `MGT2.CreationSteps` key
     * @returns {object|null}
     */
    stepCheck(key) {
        return this.frame.steps.find(step => step.key === key)?.check ?? null;
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
            ),

            frame: new fields.SchemaField({
                // Empty runs the Core sequence. What a frame CUTS is derived against that sequence and
                // never authored beside it: a frame that drops ranks drops the commission step with
                // them, without anyone having to remember to list it. A row rather than a key since
                // §9.120: the check a species' own step runs is the step's, not the prose's.
                steps: new fields.ArrayField(createStepField(), { initial: [] }),
                startAge: new fields.NumberField({ required: false, initial: 18, min: 0, integer: true }),
                termYears: new fields.NumberField({ required: false, initial: 4, min: 0, integer: true }),
                // The frame's own justification, shown beside the step strip. A frame that deletes
                // three steps of the term owes the table a sentence saying why.
                why: new fields.StringField({ required: false, blank: true, trim: true }),

                // A term declares what it YIELDS, which is the axis §9.41's pre-career was the first
                // case of and not the only one: re-education burns terms and yields nothing, and one
                // printed term explicitly "is not counted toward your physical age".
                termKinds: new fields.ArrayField(new fields.SchemaField({
                    key: new fields.StringField({ required: false, blank: true, trim: true }),
                    label: new fields.StringField({ required: false, blank: true, trim: true }),
                    // WHICH TERM NUMBERS the kind governs, because one published table is indexed by
                    // term number and nothing else in the frame is: its first term is one thing and
                    // every term after it another. Without this a kind can only be CHOSEN, and a
                    // species that mandates its first term needs one that is simply IS. Null on both
                    // is unscheduled, which is what every entry written before this field meant, so
                    // no stored frame changes meaning. `toTerm` left null against a set `fromTerm` is
                    // how a printed table writes its last row as `8+`.
                    fromTerm: new fields.NumberField({ required: false, nullable: true, initial: null, min: 1, integer: true }),
                    toTerm: new fields.NumberField({ required: false, nullable: true, initial: null, min: 1, integer: true }),
                    years: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
                    ages: new fields.BooleanField({ required: false, initial: true }),
                    yieldsBenefit: new fields.BooleanField({ required: false, initial: true }),
                    yieldsAdvancement: new fields.BooleanField({ required: false, initial: true }),
                    yieldsSkills: new fields.BooleanField({ required: false, initial: true })
                }), { initial: [] }),

                tracks: new fields.ArrayField(createTrackDefinitionField(), { initial: [] }),

                // The tray of §9.51 with the tray's LIFETIME removed: permanent, per-Traveller,
                // career-scoped. One species' racial background, another's sex matrix and a third's
                // per-career DMs are all this and nothing more.
                standingModifiers: new fields.ArrayField(createStandingModifierField(), { initial: [] })
            }),

            // Which characteristics this species rolls, with which dice, and which of the six each
            // one replaces (§9.46). CHA replaces SOC for one species, RES for another, a third has no
            // SOC at all and a fourth gains a seventh characteristic — and the dice differ too, one
            // rolling 1D+1 as its base and another 1D+6. The twelve characteristic slots stop looking
            // vestigial: the spare ones are where an alien characteristic lands.
            characteristicRolls: new fields.ArrayField(new fields.SchemaField({
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                formula: new FormulaField({ required: false, blank: true, initial: "2D" }),
                replaces: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics })
            }), { initial: [] }),
            // Characteristics this species does not have at all, which is not the same fact as one it
            // does not roll for.
            withoutCharacteristics: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: MGT2.Characteristics }), { initial: [] }),
            // "Up to your racial maximum" is printed once and given a value only for humans: NO racial
            // maximum is printed for any non-human species, in the corpus or in the reference (§9.54).
            // So null is the honest default and it means the general ceiling, not "unlimited".
            racialMaximum: new fields.NumberField({
                required: false, nullable: true, initial: null, min: 1, integer: true }),

            // The ageing law is an EXPRESSION — `a × terms + b` — and not a switch: the published
            // values run −1, −2, −½, +1 and ±1 by sex, and one species ages at a flat rate with no
            // term term at all. Its TRIGGER takes four states and not two: a term count and an age
            // together, a term count alone, and none printed anywhere — which is the state of one
            // whole species, whose chapters give no ageing rule and no starting age (§9.54).
            ageing: new fields.SchemaField({
                fromTerm: new fields.NumberField({ required: false, nullable: true, initial: 4, min: 0, integer: true }),
                fromAge: new fields.NumberField({ required: false, nullable: true, initial: 34, min: 0, integer: true }),
                perTerm: new fields.NumberField({ required: false, initial: -1 }),
                flat: new fields.NumberField({ required: false, initial: 0 })
            }),

            // Three species-level rules that stay parameters because they substitute a value into a
            // step the Core already runs (§9.54's verdict on the fourth species).
            careerChange: new fields.SchemaField({
                // The Core rule is only that you may not return to the career you just left; one
                // species must serve three terms before attempting another at all.
                minimumTerms: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
            }),
            qualificationOverride: new fields.SchemaField({
                kind: new fields.StringField({
                    required: false, blank: false, initial: "none", choices: MGT2.QualificationOverrides }),
                formula: new FormulaField({ required: false, blank: true }),
                characteristic: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.Characteristics }),
                // Template ids the referee typed — every override is printed with its own exceptions.
                exceptCareers: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] })
            }),
            // `EDU DM + 3` is a DEFAULT and not arithmetic: every published species prints its own
            // count and its own mandatory skills, and one of them over-subscribes its own allowance
            // (§9.45, §9.54). Blank formula means the human rule.
            backgroundSkills: new fields.SchemaField({
                formula: new FormulaField({ required: false, blank: true }),
                mandatory: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),
                // The list the count draws from, typed by the referee. §9.45 calls the Core's
                // seventeen library data and it is right for a second reason: they are the HUMAN
                // list, and every published species prints its own. Empty means the referee's whole
                // library is open, which is the honest state of a world that has typed no list.
                choices: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] })
            }),
            // One species tests PSI at creation with no term penalty, where the general rule is
            // `2D − the terms served so far` (§9.43).
            psiWithoutTermPenalty: new fields.BooleanField({ required: false, initial: false })
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
