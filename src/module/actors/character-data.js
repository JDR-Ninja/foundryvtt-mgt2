import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { ActorBaseData, createCharacteristicField, withPersonal } from "./actor-base-data.js";
import { Rules } from "../rules.js";
import { migrateTraitArray } from "../traits.js";

const fields = foundry.data.fields;

/** Schema and behaviour of the `character` Actor sub-type. @extends {ActorBaseData} */
export class CharacterData extends ActorBaseData {

    // Core p.77: damage lands on END first and only the excess reaches STR or DEX. `initial` only.
    static DEFAULT_DAMAGE_ORDER = ["endurance", "strength", "dexterity"];

    static STUN_LINK = "endurance";

    static DEFAULT_INITIATIVE = "dexterity";

    // Core p.83 names INT and EDU as the mental characteristics, and PSI as the exception.
    static MENTAL_LINKS = ["intellect", "education"];

    // Sixteen alphanumerics, as `training.programmes` validates, and DETERMINISTIC: a fresh
    // `randomID` would give two clients two keys for the same Traveller until the migration
    // persisted one.
    static LEGACY_PROGRAMME = "studyPeriod00000";

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
                // Zero occurrences in the core rulebook, so a new actor does not show them.
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
            // One record per endeavour, keyed by a randomID and never indexed: a week is logged at
            // `training.programmes.<id>.weeks`, so two clients moving two programmes cannot
            // collide.
            training: new fields.SchemaField({
                programmes: new fields.TypedObjectField(new fields.SchemaField({
                    // Stored per programme, not read off the world setting: `both` is legal, and a
                    // table that switches mid-campaign must not re-interpret an older log.
                    engine: new fields.StringField({ required: true, blank: false, initial: "core",
                        choices: MGT2.AdvancementEngines }),
                    // `key` is the printed skill name, speciality included, or a characteristic
                    // key.
                    target: new fields.SchemaField({
                        kind: new fields.StringField({ required: true, blank: false, initial: "skill",
                            choices: MGT2.TrainingTargets }),
                        key: new fields.StringField({ required: true, blank: false, trim: true })
                    }),
                    // ONE log, both engines: something happened, it may have involved a check, and
                    // it moved the programme by an amount.
                    log: new fields.ArrayField(new fields.SchemaField({
                        kind: new fields.StringField({ required: true, blank: false, initial: "period",
                            choices: MGT2.TrainingLogKinds }),
                        ok: new fields.BooleanField({ required: false, nullable: true, initial: null }),
                        amount: new fields.NumberField({ required: false, initial: 0, integer: true }),
                        roll: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                        note: new fields.StringField({ required: false, blank: true, trim: true })
                    }), { initial: [] }),
                    // Core only, and the ONLY stored counter in either engine — the rest is log summed.
                    weeks: new fields.NumberField({ required: false, initial: 0, min: 0, max: 8, integer: true }),
                    // The open period's note, promoted into its `period` row when the check closes it.
                    note: new fields.StringField({ required: false, blank: true, trim: true }),
                    // Core p.55 lets ANY physical characteristic buy Athletics 0, so the choice is
                    // stored.
                    characteristic: new fields.StringField({ required: false, blank: true, trim: true,
                        choices: MGT2.Characteristics }),
                    // Companion p.39's comrade: their level caps what may be learned, so it is read
                    // at the roll and never copied here.
                    teacher: new fields.DocumentUUIDField({ required: false, nullable: true, initial: null,
                        type: "Actor" }),
                    closed: new fields.BooleanField({ required: false, initial: false })
                }), { initial: {}, validateKey: key => /^[a-zA-Z0-9]{16}$/.test(key) })
            }),
            finance: new fields.SchemaField({
                pension: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                // `credits` IS the cash on hand: what mustering out banks into, a medical bill is
                // paid from and a creation event's cash grant raises.
                credits: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                debt: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                livingCost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                // What THIS Traveller pays towards a hull the crew owns collectively (Core p.155).
                monthlyShipPayments: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                // Core p.150: MCr1 each, deducted before the mortgage. They exist before any ship does.
                shipShares: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                notes: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            }),

            // Ageing, creation injuries and the medical care that undoes them in ONE signed log
            // whose sum derives into `characteristics.<k>.auto`, so `base` holds the scores as
            // first rolled.
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
                // Cr paid where a source has a price; what the Traveller could not pay becomes debt.
                cost: new fields.NumberField({ required: false, nullable: false, min: 0, integer: true, initial: 0 }),
                note: new fields.StringField({ required: false, blank: true, trim: true })
            }), { initial: [] }),

            // Other Benefits are RIGHTS WITH LIMITS and not objects — "any armour up to Cr10000 and
            // TL12" — and the system has no catalogue, so a benefit is a VOUCHER redeemed against
            // the referee's own library.
            entitlements: new fields.ArrayField(new fields.SchemaField({
                kind: new fields.StringField({
                    required: false, blank: false, initial: "voucher", choices: MGT2.BenefitKinds }),
                // Which `MGT2.Benefits` definition this row came from; blank is the referee's own.
                ref: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                // What the row entitles you to, as the book prints it.
                category: new fields.StringField({ required: false, blank: true, trim: true }),
                // Null where the row prints no ceiling; an improved cybernetic implant exceeds both.
                credits: new fields.NumberField({
                    required: false, nullable: true, initial: null, min: 0, integer: true }),
                tl: new fields.NumberField({
                    required: false, nullable: true, initial: null, min: 0, integer: true }),
                // "Unarmed" on the Personal Vehicle is neither a credit nor a TL ceiling.
                constraint: new fields.StringField({ required: false, blank: true, trim: true }),
                // How a second roll of the same row reads — four printed shapes, not one.
                onRepeat: new fields.StringField({
                    required: false, blank: false, initial: "another", choices: MGT2.BenefitRepeats }),
                count: new fields.NumberField({ required: false, initial: 1, min: 0, integer: true }),
                // Redeemed rather than deleted: a referee auditing a sheet needs the row that paid.
                redeemed: new fields.BooleanField({ required: false, initial: false }),
                item: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                uuid: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                // Given up rather than taken, for one printed rule: only one Traveller may start
                // owning a ship, and each of the others takes Cr25000 a year instead (folio 48).
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

            // State that outlives a dose and so cannot live on the `drug` Item (Core p.115).
            drugCounters: new fields.ArrayField(new fields.SchemaField({
                drug: new fields.StringField({ required: false, blank: true, trim: true }),
                doses: new fields.NumberField({
                    required: false, nullable: false, min: 0, integer: true, initial: 0 }),
                resetOn: new fields.StringField({
                    required: false, blank: false, initial: "never", choices: MGT2.DoseResets })
            }), { initial: [] }),

            states: new fields.SchemaField({
                fatigue: new fields.BooleanField({ required: false, initial: false }),
                // Core folio 81's 51-150 band.
                nausea: new fields.BooleanField({ required: false, initial: false }),
                // Companion folio 80's second stage, which the referee ticks: the intervals are days.
                starving: new fields.BooleanField({ required: false, initial: false }),
                unconscious: new fields.BooleanField({ required: false, initial: false }),
                // Companion folio 50: written by the blow that emptied END, and inert once it refills.
                knockedOut: new fields.BooleanField({ required: false, initial: false }),
                // The referee's override, kept beside the derived condition below.
                surgeryRequired: new fields.BooleanField({ required: false, initial: false }),
                // Core p.82: first aid applies once, which no reading of the wound can tell you.
                firstAidUsed: new fields.BooleanField({ required: false, initial: false }),
                // Core p.83's cumulative DM+1 per failed END check, and the wound the pass was at.
                reviveFailures: new fields.NumberField({ required: false, nullable: false, initial: 0, min: 0, integer: true }),
                consciousWound: new fields.NumberField({ required: false, nullable: false, initial: -1, integer: true })
            })
        });
    }

    /**
     * Reads the pre-0.2.0 shape several times over: `damages` held three named ranks that could
     * name one characteristic twice, and a characteristic stored its current value plus, on three
     * of the twelve, a maximum — it now stores the score and the wound.
     * @inheritDoc
     */
    static migrateData(source, options) {
        // `personal.traits` moved up to the base model's shared `traits`.
        if (Array.isArray(source.personal?.traits) && (source.traits === undefined)) {
            source.traits = source.personal.traits.map(t => ({ ...t }));
            migrateTraitArray(source.traits, "species");
        }

        // The type test makes the shim a no-op on a payload already carrying the pair, and on the
        // partial updates v14 also runs this over.
        if (typeof source.config?.initiative === "string") {
            source.config.initiative = { characteristic: source.config.initiative, flat: 0 };
        }

        // Guarded on the old subtree being present AND `training` being absent, because v14 runs
        // this over update payloads too: without it, logging a week re-runs the conversion every
        // time.
        if (source.study?.skill && !source.training) {
            const period = MGT2.TrainingPeriodWeeks;
            const total = Math.max(0, Math.trunc(source.study.total) || 0);
            const passed = Math.max(0, Math.trunc(source.study.completed) || 0);
            // Lossy in one direction: the old shape recorded no failures, and weeks past the eighth
            // have nowhere to go.
            const dropped = Math.max(0, total - period);
            source.training = { programmes: { [CharacterData.LEGACY_PROGRAMME]: {
                engine: "core",
                target: { kind: "skill", key: source.study.skill },
                log: Array.from({ length: passed }, () => ({ kind: "period", ok: true, amount: period })),
                weeks: Math.min(total, period),
                note: dropped ? MGT2Helper.plural("MGT2.Training.MigratedWeeks", dropped, { weeks: dropped }) : ""
            } } };
        }

        const damages = source.config?.damages;
        if (damages && !source.config.damageOrder) {
            source.config.damageOrder = [...new Set(
                [damages.rank1, damages.rank2, damages.rank3].filter(k => k && k in MGT2.Characteristics)
            )];
        }

        // ⚠ v14 runs migrateData over update payloads as well as stored documents, and a `-=value`
        // deletion arrives here as an undefined `value` — hence the type test rather than `"value"
        // in c`.
        for (const c of Object.values(source.characteristics ?? {})) {
            if (typeof c?.value !== "number") continue;
            const split = ("base" in c) || ("damage" in c);
            // Nine of the twelve never set a maximum, so `max - value` would read INT 8 as a wound of -8.
            c.base ??= Math.max(c.max ?? 0, c.value);
            // Either new key means the split already ran; the `value` beside them is stale until
            // the old keys are dropped, and deriving from it again would undo what has been
            // applied.
            c.damage ??= split ? 0 : c.base - c.value;
            // The stale `value` and `max` are left alone: every prepare overwrites them, and
            // deleting them here strands the source whenever the clean is partial.
        }

        return super.migrateData(source, options);
    }

    /**
     * Core folio 81's cumulative radiation column costs END permanently, and the table prints the
     * TOTAL at each band rather than a step — so it derives from the rad count instead of being
     * written to the score once per crossing.
     * @inheritDoc
     */
    prepareBaseData() {
        super.prepareBaseData();
        // With the rule off nothing is drawn or applied; `health.radiations` is stored and untouched.
        if ( !Rules.on("radiation") ) return;
        this.characteristics.endurance.auto += CharacterData.radiationBand(this.health.radiations).endurance;
    }

    /**
     * A species modifier and the permanent-loss log both move the score and neither may be written
     * to it.
     * @inheritDoc
     */
    prepareCharacteristicAuto() {
        // Replace, not stack: no volume states which, and the corpus says "ADDITIONAL modifiers" on
        // the one occasion it means to add.
        const species = {};
        for ( const item of this.speciesItems ) {
            for ( const modifier of item.system.modifiers ?? [] ) {
                if ( !this.characteristics[modifier.characteristic] ) continue;
                if ( !Number.isFinite(modifier.value) ) continue;
                species[modifier.characteristic] = (species[modifier.characteristic] ?? 0) + modifier.value;
            }
        }
        for ( const [key, delta] of Object.entries(species) ) {
            const c = this.characteristics[key];
            // Folio 52: the modifier may pass 15 but cannot take the score under 1, and it is applied
            // as the score is rolled — so the floor binds the species delta, not the radiation loss.
            c.auto += (c.base > 0) ? Math.max(1 - c.base, delta) : delta;
        }
        for ( const item of this.parent.items ) {
            // Core p.106: an augment is a fact of the body only once fitted — a bag improves nothing.
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
     * @inheritDoc
     */
    prepareDerivedData() {
        super.prepareDerivedData();
        this.#prepareLossLog();

        // Derived, never typed: a typed code would be a second source of truth for the same fact.
        this.upp = CharacterData.UPP_ORDER
            .map(key => MGT2Helper.uppDigit(this.characteristics[key].max)).join("");

        this.#prepareTreatment();
        this.#prepareTraining();
        this.#prepareWealth();
        // Companion p.80: END days before starvation tells, then twice END more at DM-2.
        const end = this.characteristics.endurance?.value ?? 0;
        this.starvation = { before: end, impaired: end * 2 };

        this.inventory = { armor: 0, weight: 0, encumbrance: { normal: 0, heavy: 0 } };
        this.prepareArmor();
        this.#prepareComputers();
        this.prepareWeight();
        this.prepareEncumbrance();
        this.prepareCheckModifiers();
    }

    /**
     * Folio 49: a characteristic reduced to 0 by ageing — or by a creation injury, where the rule is
     * on — is death unless 1D × Cr10000 buys care, and a crisis fails every later qualification roll.
     */
    #prepareLossLog() {
        const running = {};
        const sources = Rules.on("creationInjuryToZero") ? ["ageing", "injury"] : ["ageing"];
        let crisis = false;
        for ( const entry of this.characteristicLog ) {
            for ( const [key, delta] of Object.entries(entry.changes ?? {}) ) {
                const c = this.characteristics[key];
                if ( !c ) continue;
                running[key] = (running[key] ?? c.base) + delta;
                if ( sources.includes(entry.source) && (running[key] <= 0) ) crisis = true;
            }
        }
        this.states.ageingCrisis = crisis;
    }

    /**
     * Companion p.4's Wealth, read off the cash the ledger already tracks: the highest rung whose
     * printed month's cash the Traveller has. Below the first rung is WLT 0.
     */
    #prepareWealth() {
        if ( !Rules.on("wealth") ) return void (this.wealth = null);
        const credits = this.finance.credits;
        const ladder = MGT2.Wealth.ladder;
        let score = 0;
        for ( const rung of ladder ) if ( credits >= rung.credits ) score = rung.score;
        this.wealth = { score, dm: ActorBaseData.getModifier(score),
            cash: ladder.find(rung => rung.score === score)?.credits ?? 0 };
    }

    /** Which of the two treatment procedures the patient qualifies for (Core p.82-83). */
    #prepareTreatment() {
        const damaged = this.damagedLinks.length;
        const spent = this.states.firstAidUsed;
        this.states.surgeryByRule = spent && (damaged >= 3);
        this.states.needsSurgery = this.states.surgeryRequired || this.states.surgeryByRule;
        // Restoring one of the three to its maximum is what moves a patient here from surgery.
        this.states.canMedicalCare = spent && (damaged >= 1) && (damaged <= 2);
    }

    /**
     * Core p.55's Study Periods and Compagnon p.39-40's Experience Points move the same record, so
     * one pass derives both.
     */
    #prepareTraining() {
        const period = MGT2.TrainingPeriodWeeks;
        Object.assign(this.training, {
            weeksPerPeriod: period, live: 0, due: 0, weeksLogged: 0, pointsDedicated: 0 });

        for ( const programme of Object.values(this.training.programmes) ) {
            const companion = programme.engine === "companion";
            const target = programme.target;

            programme.held = (target.kind === "characteristic")
                ? (this.characteristics[target.key]?.max ?? null) : this.skillLevel(target.key);
            programme.next = (programme.held === null) ? 0 : programme.held + 1;
            programme.cost = CharacterData.trainingCost(target, programme.next);
            // Compagnon p.39's teaching check is INT whatever the programme buys; the stored
            // override is Core's Athletics device.
            programme.checkCharacteristic = companion ? "intellect"
                : (programme.characteristic || CharacterData.trainingCharacteristic(target));
            programme.barred = CharacterData.trainingBarred(target);

            const since = programme.log.slice(
                programme.log.findLastIndex(row => row.kind === "grant") + 1);
            programme.periodsNeeded = Math.max(1, programme.next);
            programme.periodsPassed = since.filter(row => (row.kind === "period") && row.ok).length;
            programme.periodsLeft = Math.max(0, programme.periodsNeeded - programme.periodsPassed);
            programme.weeksSpent = programme.weeks + programme.log.reduce((sum, row) =>
                sum + ((row.kind === "period") ? (row.amount || 0) : 0), 0);
            // Every amount, grants included, which is the Companion's reading.
            programme.xp = programme.log.reduce((sum, row) => sum + (row.amount || 0), 0);

            // Core: the check falls due on the eighth week.
            programme.checkDue = companion ? !!programme.teacher : (programme.weeks >= period);
            programme.complete = companion ? (programme.cost > 0) && (programme.xp >= programme.cost)
                : (programme.periodsPassed >= programme.periodsNeeded);
            programme.ready = programme.complete && !programme.closed && !programme.barred;
            const [done, of] = companion
                ? [programme.xp, programme.cost] : [programme.weeks, period];
            programme.percent = of > 0 ? Math.min(100, Math.round((done / of) * 100)) : 0;

            if ( programme.closed ) continue;
            this.training.live += 1;
            // `checkDue` says a check is AVAILABLE; `due` counts what is waiting on someone.
            if ( programme.ready || ((programme.engine !== "companion") && programme.checkDue) ) {
                this.training.due += 1;
            }
            this.training.weeksLogged += programme.weeksSpent;
            if ( companion ) this.training.pointsDedicated += programme.xp;
        }
    }

    /**
     * Compagnon p.40's two price tables: a skill costs by the level being bought and doubles per
     * level past the sixth; a characteristic costs its new value, and a mental one twice that.
     */
    static trainingCost(target, next) {
        if ( target.kind === "characteristic" ) {
            return MGT2.TrainingCosts.mental.includes(target.key) ? next * 2 : next;
        }
        const table = MGT2.TrainingCosts.skill;
        return table[next] ?? (table.at(-1) * (2 ** (next - table.length + 1)));
    }

    /** What the Core check is rolled on where the programme states nothing. */
    static trainingCharacteristic(target) {
        const athletics = MGT2.AthleticsTraining;
        if ( (target.kind !== "skill")
            || !athletics.skills.some(name => MGT2Helper.matchesSkill(target.key, name)) ) return "education";
        const speciality = /\(([^)]*)\)\s*$/.exec(target.key)?.[1].trim().toLowerCase() ?? "";
        return Object.keys(athletics.specialities).find(key =>
            athletics.specialities[key].includes(speciality)) ?? "education";
    }

    /**
     * What neither book lets a programme reach: Jack-of-all-Trades "may never be learned or
     * improved" (Core p.55), and Compagnon p.40's table names five characteristics — so SOC, PSI
     * and the six the Core Rulebook never defines are not buyable either.
     */
    static trainingBarred(target) {
        if ( target.kind === "characteristic" ) {
            return !MGT2.TrainingCosts.physical.includes(target.key)
                && !MGT2.TrainingCosts.mental.includes(target.key);
        }
        return MGT2.Untrained.skills.some(name => MGT2Helper.matchesSkill(target.key, name));
    }

    /**
     * Core folio 110's four clauses about running software: the Bandwidth sum, the Tech Level gate,
     * the downgrade and the package count at Processing 0. Every one is ADVISORY — a package the
     * host cannot run keeps its `computerId` and is marked rather than refused.
     */
    #prepareComputers() {
        // A host is a `computer` Item, worn armour rated Computer/N, or a fitted augment carrying
        // Processing; `computerId` is a bare Item id that never required one type.
        const hosts = new Map();
        const running = new Map();
        const reserved = new Map();
        for (const item of this.parent.items) {
            if (!MGT2Helper.runsSoftware(item)) continue;
            item.system.processingUsed = 0;
            item.system.blockedSoftware = 0;
            hosts.set(item.id, item);
            running.set(item.id, 0);
            reserved.set(item.id, 0);
        }

        for (const item of this.parent.items) {
            if (item.type !== "item" || item.system.subType !== "software") continue;
            const host = hosts.get(item.system.software.computerId);
            if (!host) continue;

            // Under the software's Tech Level the host does not run it at all, so it spends nothing.
            const softwareTL = MGT2Helper.tlNumber(item.system.tl);
            const hostTL = MGT2Helper.tlNumber(host.system.tl);
            item.system.software.tlBlocked = (softwareTL !== null) && (hostTL !== null) && (softwareTL > hostTL);
            if (item.system.software.tlBlocked) {
                host.system.blockedSoftware += 1;
                continue;
            }

            host.system.processingUsed += item.system.software.bandwidthRun;
            // Core folio 112: the specialised rating is reserved for one named program, matched as
            // a printed name the way HG folio 20's /bis matches Jump Control.
            const named = MGT2Helper.specialised(host)?.software;
            if (named && MGT2Helper.matchesSkill(item.name, named)) {
                reserved.set(host.id, reserved.get(host.id) + item.system.software.bandwidthRun);
            }
            // CSC folio 66's exception: Interface runs alongside one other Bandwidth 0 program.
            if (!MGT2Helper.isInterfaceSoftware(item.name)) running.set(host.id, running.get(host.id) + 1);
        }

        for (const host of hosts.values()) {
            const processing = MGT2Helper.processing(host);
            // A ring-fenced pool and not a bigger one: only what the named program claims of the
            // bonus raises the cap.
            const bonus = Math.min(MGT2Helper.specialised(host)?.bonus ?? 0, reserved.get(host.id));
            host.system.processingCap = processing + bonus;
            host.system.overload = host.system.processingUsed > host.system.processingCap;
            // "Processing 0 can only run one Bandwidth 0 package at a time" — a count, which the
            // sum cannot reach: two Bandwidth-0 packages still sum to 0. Read off the cap, because
            // CSC folio 61's wafer jack is a Computer/2 for Expert programs and a 0 for the rest.
            host.system.overCrowded = (host.system.processingCap === 0) && (running.get(host.id) > 1);
        }
    }

    /** Core p.83: 3 + the patient's END DM + the doctor's Medic skill, per day. */
    medicalCarePoints(medic) {
        return 3 + this.enduranceDM + (Math.trunc(medic) || 0);
    }

    /** The Radiation Effects row a number of rads falls in. @returns {object} */
    static radiationBand(rads) {
        const total = Math.max(0, Math.trunc(rads) || 0);
        return MGT2.RadiationEffects.find(row => total >= row.min) ?? MGT2.RadiationEffects.at(-1);
    }

    /** Take a dose. */
    async applyRadiation(rads) {
        // The one sink every dose passes through — the exposure control, a Radiation-trait weapon
        // (`chatHelper.js`) and a radiation region (`region-behaviors.js`) all end here.
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
     * required — which on a negative DM makes them worse instead.
     */
    get naturalHealingFormula() {
        const dm = this.enduranceDM;
        if (this.states.needsSurgery) return String(dm);
        return (dm === 0) ? "1d6" : `1d6${MGT2Helper.signed(dm)}`;
    }

    /**
     * Core p.83: medical care and surgery take DM− equal to the Tech Level gap between the facility
     * and the highest *relevant* implant.
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

    /** @inheritDoc */
    async _preCreate(data, options, user) {
        this.parent.updateSource({ prototypeToken: { actorLink: true } }); // QoL
    }

    /**
     * Deleting a container takes its contents with it, and deleting a computer ejects its software.
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
