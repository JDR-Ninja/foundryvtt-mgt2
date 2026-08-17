import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { ActorBaseData, createCharacteristicField, withPersonal } from "./actor-base-data.js";
import { Rules } from "../rules.js";
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

    // Core p.77: "Damage is initially applied to a target's END", and only the excess reaches STR
    // or DEX. `initial` only — an existing actor keeps the chain it stored.
    static DEFAULT_DAMAGE_ORDER = ["endurance", "strength", "dexterity"];

    static STUN_LINK = "endurance";

    static DEFAULT_INITIATIVE = "dexterity";

    // Core p.83 names INT and EDU as the mental characteristics that heal a point a day, and names
    // PSI as the exception.
    static MENTAL_LINKS = ["intellect", "education"];

    // Core p.55: "A Study Period is equal to eight weeks (or two months) of study and practice."
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
                // `credits` IS the cash on hand — the inventory tab draws it under that label, and it
                // is the field mustering out banks into, a medical bill is paid from and a creation
                // event's cash grant raises. `cashOnHand` beside it is a second name for the same
                // money that no sheet ever drew: three writers had reached for it and the player could
                // see none of them. Nothing writes it now and it wants deleting in a migration pass.
                credits: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                cashOnHand: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                debt: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                livingCost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                // What THIS Traveller pays towards a hull the crew owns collectively (Core p.155):
                // the mortgage belongs to the ship and how the crew splits it is a table agreement.
                monthlyShipPayments: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                // Core p.150: earned in careers, each worth MCr1 and deducted from a ship's purchase
                // price BEFORE the mortgage is calculated. They exist before any ship does, which is
                // why they cannot live on one (§9.13).
                shipShares: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                notes: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            }),

            // Ageing, creation injuries and the medical care that undoes them, in ONE signed log
            // whose sum derives into `characteristics.<k>.auto` — so `base` holds the characteristics
            // as first rolled and nothing ever writes it again (§9.39). Ageing repeats every term
            // from the fourth on and the PLAYER chooses which characteristic takes each loss, so
            // after the fact there is no way to infer what a roll took: record the choice, derive the
            // total, and removal is correct by construction. A restoration is a new entry, never an
            // edit to a previous one.
            characteristicLog: new fields.ArrayField(new fields.SchemaField({
                source: new fields.StringField({
                    required: false, blank: false, initial: "ageing",
                    choices: MGT2.CharacteristicLossSources }),
                term: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                age: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                // What was rolled, kept beside the outcome so a mis-rolled row can be recognised.
                roll: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                // Signed, keyed by characteristic: −2 is a loss and +1 a point bought back.
                changes: new fields.TypedObjectField(
                    new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
                    { initial: {}, validateKey: key => key in MGT2.Characteristics }),
                // Cr paid, where a source has a price: Cr5000 per point restored, or the rolled
                // 1D × Cr10000 of an ageing crisis. What the Traveller could not pay becomes debt.
                cost: new fields.NumberField({ required: false, nullable: false, min: 0, integer: true, initial: 0 }),
                note: new fields.StringField({ required: false, blank: true, trim: true })
            }), { initial: [] }),

            // §9.40's Other Benefits are RIGHTS WITH LIMITS and not objects — "any armour up to
            // Cr10000 and TL12", "any augmentation up to Cr75000" — and the system cannot create
            // those, because it has no catalogue and never will (§9.36). So a benefit is recorded as
            // a VOUCHER the player redeems against the referee's own library, which is also what
            // lets a group finish creation and shop afterwards.
            //
            // **It lives on the actor and not on `flags.mgt2.chargen`**, and that is the whole
            // reason it is here: mustering out CONSUMES the flag and the teardown follows it
            // (§9.50), so anything the flag held is gone one action later. A voucher outlives
            // creation by definition.
            entitlements: new fields.ArrayField(new fields.SchemaField({
                kind: new fields.StringField({
                    required: false, blank: false, initial: "voucher", choices: MGT2.BenefitKinds }),
                // What the row entitles you to, as the book prints it — "any common or military
                // ranged weapon", "one piece of scientific equipment". Free text and never a closed
                // list: the categories are the referee's benefit definitions, which ride in the
                // library file rather than in this system (§9.40).
                category: new fields.StringField({ required: false, blank: true, trim: true }),
                // The two ceilings, null where the row prints none. An improved cybernetic implant
                // explicitly exceeds both, which is why they are nullable rather than 0.
                credits: new fields.NumberField({
                    required: false, nullable: true, initial: null, min: 0, integer: true }),
                tl: new fields.NumberField({
                    required: false, nullable: true, initial: null, min: 0, integer: true }),
                // "Unarmed" on the Personal Vehicle is neither a credit nor a TL ceiling (§9.40).
                constraint: new fields.StringField({ required: false, blank: true, trim: true }),
                // How a second roll of the same row reads (§9.40's four shapes, not one).
                onRepeat: new fields.StringField({
                    required: false, blank: false, initial: "another", choices: MGT2.BenefitRepeats }),
                count: new fields.NumberField({ required: false, initial: 1, min: 0, integer: true }),
                // Redeemed rather than deleted: what a Traveller was owed is part of their history,
                // and a referee auditing a sheet mid-campaign needs the row that paid for the gun.
                redeemed: new fields.BooleanField({ required: false, initial: false }),
                // Given up rather than taken, which is a different state from redeemed and exists for
                // one printed rule: *only one Traveller may start the campaign owning a ship*, and each
                // of the others takes Cr25000 a year instead, per ship rolled (folio 48). It is a
                // FIELD because the group's decision has to be re-readable — the pension arithmetic
                // counts these rows — and a note saying "gave it up" would have to be matched as text.
                surrendered: new fields.BooleanField({ required: false, initial: false }),
                note: new fields.StringField({ required: false, blank: true, trim: true }),
                provenance: new fields.SchemaField({
                    term: new fields.NumberField({
                        required: false, nullable: true, initial: null, min: 0, integer: true }),
                    career: new fields.StringField({ required: false, blank: true, trim: true }),
                    table: new fields.StringField({ required: false, blank: true, trim: true }),
                    note: new fields.StringField({ required: false, blank: true, trim: true })
                })
            }), { initial: [] }),

            // State that outlives a dose and therefore cannot live on the `drug` Item: stims escalate
            // per dose since sleep, anti-rad counts doses taken that day (Core p.115). Hand-held like
            // every other counter in the system — nothing schedules the reset (§9.35).
            drugCounters: new fields.ArrayField(new fields.SchemaField({
                drug: new fields.StringField({ required: false, blank: true, trim: true }),
                doses: new fields.NumberField({
                    required: false, nullable: false, min: 0, integer: true, initial: 0 }),
                resetOn: new fields.StringField({
                    required: false, blank: false, initial: "never", choices: MGT2.DoseResets })
            }), { initial: [] }),

            states: new fields.SchemaField({
                fatigue: new fields.BooleanField({ required: false, initial: false }),
                // Core folio 81: the 51-150 rad band inflicts "Nausea (-1 to all checks until
                // medical treatment received)". Stored like fatigue, because the rads that caused it
                // stay on the sheet for good and so cannot say whether it has been treated.
                nausea: new fields.BooleanField({ required: false, initial: false }),
                unconscious: new fields.BooleanField({ required: false, initial: false }),
                // The referee's override, kept beside the derived condition below.
                surgeryRequired: new fields.BooleanField({ required: false, initial: false }),
                // Core p.82: first aid "can only be successfully applied once", which no reading of
                // the wound can tell you — so it is stored.
                firstAidUsed: new fields.BooleanField({ required: false, initial: false }),
                // Core p.83: the cumulative DM+1 an unconscious Traveller earns per failed END
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
     * Core folio 81's cumulative radiation column costs END permanently, and the table prints the
     * TOTAL at each band rather than a step — so it derives from the rad count here instead of being
     * written to the score once per crossing. `auto` is the derivation sink, which is what makes a
     * dose of anti-rad give the points straight back.
     * @inheritDoc
     */
    prepareBaseData() {
        super.prepareBaseData();
        // With the rule off the penalty is not drawn and not applied; `health.radiations` is stored
        // and untouched, so switching it back on restores the loss exactly.
        if ( !Rules.on("radiation") ) return;
        this.characteristics.endurance.auto += CharacterData.radiationBand(this.health.radiations).endurance;
    }

    /**
     * A species modifier and the permanent-loss log both move the score, and neither may ever be
     * written to it. An Active Effect would be the wrong machinery for either: an effect is for
     * things that start and stop, and a species is a fact of character generation while a lost point
     * is gone (§9.18, §9.39). Derived here, both are removable by construction — delete the Item or
     * the row and the number goes with it.
     * @inheritDoc
     */
    prepareCharacteristicAuto() {
        // §9.56 item 8: **replace, not stack** — no volume states which, one published line is a
        // third bespoke set that is neither parent nor sum, and the corpus says "ADDITIONAL
        // modifiers" on the one occasion it means to add. So off, only the first species Item speaks,
        // which is the same Item `Chargen.frame` reads as the creation frame (§9.54).
        const species = this.parent.items.filter(item => item.type === "species");
        const speaking = Rules.on("speciesModifiersStack") ? species : species.slice(0, 1);
        for ( const item of speaking ) {
            for ( const modifier of item.system.modifiers ?? [] ) {
                const c = this.characteristics[modifier.characteristic];
                if ( !c || !Number.isFinite(modifier.value) ) continue;
                // Folio 52: species modifiers may take a characteristic ABOVE 15 but never below 1,
                // so the ceiling does not bind them at all and the floor is a second clamp the shared
                // `max` never had — it is floored at 0, which is right for a damage track and wrong
                // here (§9.54). A base of 0 is a characteristic the species does not have, and the
                // floor must not conjure one.
                const floor = (c.base > 0) ? 1 - c.base : c.auto + modifier.value;
                c.auto = Math.max(floor, c.auto + modifier.value);
            }
        }
        for ( const item of this.parent.items ) {
            // Core p.106: an augment is a fact of the body, but only once it is fitted — carrying one
            // in a bag improves nothing, which is what `equipped` already distinguishes.
            if ( (item.system.subType !== "augment") || !item.system.equipped ) continue;
            for ( const modifier of item.system.augment?.modifiers ?? [] ) {
                const c = this.characteristics[modifier.characteristic];
                if ( c && Number.isFinite(modifier.value) ) c.auto += modifier.value;
            }
        }
        for ( const entry of this.characteristicLog ) {
            for ( const [key, delta] of Object.entries(entry.changes ?? {}) ) {
                if ( this.characteristics[key] ) this.characteristics[key].auto += delta;
            }
        }
    }

    /**
     * Everything below is recomputed from the characteristics and the carried items on every
     * prepare, so none of it is written to the database and none of it can go stale.
     * Runs after prepareEmbeddedDocuments, so the items are ready.
     * @inheritDoc
     */
    prepareDerivedData() {
        super.prepareDerivedData();
        this.#prepareLossLog();

        // The identity code is the six canonical maxima, not a stored string: a typed one and six
        // typed characteristics are two sources of truth for the same fact.
        this.upp = CharacterData.UPP_ORDER
            .map(key => MGT2Helper.uppDigit(this.characteristics[key].max)).join("");

        this.#prepareTreatment();
        this.#prepareStudy();

        this.inventory = { armor: 0, weight: 0, encumbrance: { normal: 0, heavy: 0 } };
        this.prepareArmor();
        this.#prepareComputers();
        this.prepareWeight();
        this.prepareEncumbrance();
        this.prepareCheckModifiers();
    }

    /* -------------------------------------------- */

    /**
     * Folio 49: a characteristic reduced to 0 by ageing is death unless 1D × Cr10000 buys medical
     * care, and a Traveller who has suffered such a crisis automatically fails every later
     * qualification roll. That is *visible in the log*, so it derives rather than being a second
     * stored flag — which is the whole return on storing the log signed and in order.
     *
     * Replayed rather than summed: only a running total can say which entry took a score to zero.
     */
    #prepareLossLog() {
        const running = {};
        let crisis = false;
        for ( const entry of this.characteristicLog ) {
            for ( const [key, delta] of Object.entries(entry.changes ?? {}) ) {
                const c = this.characteristics[key];
                if ( !c ) continue;
                running[key] = (running[key] ?? c.base) + delta;
                if ( (entry.source === "ageing") && (running[key] <= 0) ) crisis = true;
            }
        }
        this.states.ageingCrisis = crisis;
        this.characteristicLoss = { crisis, entries: this.characteristicLog.length };
    }

    /* -------------------------------------------- */

    /**
     * Which of the two treatment procedures the patient qualifies for (Core p.82-83). Both gates
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
     * Core p.55: eight weeks make a Study Period, a completed one is settled by an Average (8+) EDU
     * check, and reaching a level costs as many *successful* periods as the level itself — one for a
     * skill the Traveller does not have at all, which the first success grants at level 0.
     *
     * The two stored counters mean nothing apart: weeks answer "when is the check", periods answer
     * "how many more". Neither is a total, so both totals derive from the trained skill instead.
     */
    #prepareStudy() {
        const period = CharacterData.STUDY_PERIOD_WEEKS;
        const level = this.study.skill ? this.skillLevel(this.study.skill) : null;

        this.study.hasSkill = level !== null;
        this.study.target = (level === null) ? 0 : level + 1;
        this.study.periodsNeeded = Math.max(1, this.study.target);
        this.study.periodsLeft = Math.max(0, this.study.periodsNeeded - this.study.completed);
        this.study.weeksPerPeriod = period;
        this.study.percent = Math.min(100, Math.round((this.study.total / period) * 100));
        this.study.checkDue = this.study.total >= period;
    }

    /* -------------------------------------------- */

    /**
     * Core folio 110's four clauses about running software. The Bandwidth sum is one of them; the
     * Tech Level gate, the downgrade and the package count at Processing 0 are the other three.
     *
     * Every one of them is **advisory**: a package the host cannot run keeps its `computerId` and is
     * marked, the way a design check reports rather than refuses (§9.92) and an inert mount is
     * surfaced rather than emptied (§9.114).
     */
    #prepareComputers() {
        // A host is a `computer` Item or a fitted augment carrying Processing — Core p.107's wafer
        // jack is both a computer and an implant, and `computerId` is a bare Item id that never
        // required the target to be one type (§9.84).
        const hosts = new Map();
        const running = new Map();
        for (const item of this.parent.items) {
            if (!MGT2Helper.runsSoftware(item)) continue;
            item.system.processingUsed = 0;
            item.system.blockedSoftware = 0;
            hosts.set(item.id, item);
            running.set(item.id, 0);
        }

        for (const item of this.parent.items) {
            if (item.type !== "item" || item.system.subType !== "software") continue;
            const host = hosts.get(item.system.software.computerId);
            if (!host) continue;

            // "regardless of available Bandwidth" — under the software's Tech Level the host does not
            // run it at all, so it spends no Processing. A TL neither side states gates nothing.
            const softwareTL = MGT2Helper.tlNumber(item.system.tl);
            const hostTL = MGT2Helper.tlNumber(host.system.tl);
            item.system.software.tlBlocked = (softwareTL !== null) && (hostTL !== null) && (softwareTL > hostTL);
            if (item.system.software.tlBlocked) {
                host.system.blockedSoftware += 1;
                continue;
            }

            host.system.processingUsed += item.system.software.bandwidthRun;
            // CSC folio 66's exception: Interface runs "in conjunction with one other Bandwidth 0
            // program", so it is not one of the packages the count below is counting (§9.130).
            if (!MGT2Helper.isInterfaceSoftware(item.name)) running.set(host.id, running.get(host.id) + 1);
        }

        for (const host of hosts.values()) {
            const processing = MGT2Helper.processing(host);
            host.system.overload = host.system.processingUsed > processing;
            // "A computer with Processing 0 can only run one software package of Bandwidth 0 at a
            // time" — a count, and the sum cannot reach it: two Bandwidth-0 packages still sum to 0.
            host.system.overCrowded = (processing === 0) && (running.get(host.id) > 1);
        }
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /** Core p.83: 3 + the patient's END DM + the doctor's Medic skill, per day. */
    medicalCarePoints(medic) {
        return 3 + this.enduranceDM + (Math.trunc(medic) || 0);
    }

    /* -------------------------------------------- */
    /*  Radiation (Core folio 81)                   */
    /* -------------------------------------------- */

    /** The Radiation Effects row a number of rads falls in. @returns {object} */
    static radiationBand(rads) {
        const total = Math.max(0, Math.trunc(rads) || 0);
        return MGT2.RadiationEffects.find(row => total >= row.min) ?? MGT2.RadiationEffects.at(-1);
    }

    /**
     * Take a dose. Core folio 81 reads its two columns off two different numbers — the immediate
     * effects against this exposure, the permanent ones against the running total — so both bands
     * are handed back and the caller rolls the dice the immediate one names. The count itself only
     * ever rises: "accumulated rads can only be removed by using anti-rad drugs", which is the field
     * being edited rather than a procedure.
     * @param {number} rads   The dose after folio 100's armour deduction
     * @returns {Promise<{dose: number, total: number, immediate: object, before: object, after: object}|null>}
     */
    async applyRadiation(rads) {
        // The one sink every dose passes through — the exposure control, a Radiation-trait weapon
        // (`chatHelper.js`) and a radiation region (`region-behaviors.js`) all end here. Gating it
        // rather than each caller is what stops a table that switched the rule off from accumulating
        // a count it is never shown.
        if ( !Rules.on("radiation") ) return null;
        const dose = Math.max(0, Math.trunc(rads) || 0);
        if (dose === 0) return null;
        const before = CharacterData.radiationBand(this.health.radiations);
        const total = this.health.radiations + dose;
        const immediate = CharacterData.radiationBand(dose);
        // Nausea lasts "until medical treatment received", which no reading of the rads can tell.
        const states = immediate.state ? { [immediate.state]: true } : {};
        await this.parent.update({ system: { states, health: { radiations: total } } });
        return { dose, total, immediate, before, after: CharacterData.radiationBand(total) };
    }

    /**
     * Core p.83: a day of full rest returns 1D + END DM, but only the END DM while surgery is
     * required — which on a negative DM makes them worse instead. A bare "+0" is not a formula
     * Foundry's parser accepts, so the sign is only ever written beside a die.
     */
    get naturalHealingFormula() {
        const dm = this.enduranceDM;
        if (this.states.needsSurgery) return String(dm);
        return (dm === 0) ? "1d6" : `1d6${MGT2Helper.signed(dm)}`;
    }

    /**
     * Core p.83: medical care and surgery take DM− equal to the Tech Level gap between the facility
     * and the highest *relevant* implant. Which one is relevant is the referee's call and no sheet
     * holds the facility's TL, so this reports the highest an augment carries and nothing more.
     * @returns {{tl: number, name: string}|null}   Null when no augment states one
     */
    get augmentTL() {
        let best = null;
        for (const item of this.parent.items) {
            if ((item.type !== "equipment") || (item.system.subType !== "augment")) continue;
            const tl = MGT2Helper.tlNumber(item.system.tl);
            if (tl === null) continue;
            if (!best || (tl > best.tl)) best = { tl, name: item.name };
        }
        return best;
    }

    /** @type {Item[]} */
    get containers() {
        return this.parent.items.filter(i => i.type === "container").sort(MGT2Helper.compareByName);
    }

    /** Everything software can be loaded onto, which is what the software select offers. @type {Item[]} */
    get computers() {
        return this.parent.items.filter(i => MGT2Helper.runsSoftware(i)).sort(MGT2Helper.compareByName);
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
            } else if (MGT2Helper.runsSoftware(d)) {
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
