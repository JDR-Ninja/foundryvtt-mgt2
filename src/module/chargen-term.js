import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { CreationOptions, CreationRoll } from "./chargen-rolls.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const { DialogV2 } = foundry.applications.api;

/** The term loop: one Traveller, one term, walked **entirely from the frame's declared steps**. */
export class ChargenTerm {

    /** The steps this Traveller's term runs, in the frame's own order. @returns {string[]} */
    static sequence(actor) {
        return Chargen.steps(actor).sequence;
    }

    /** Where the loop is. @returns {string} */
    static current(actor) {
        const sequence = this.sequence(actor);
        const stored = Chargen.read(actor).step;
        return sequence.includes(stored) ? stored : (sequence[0] ?? "");
    }

    /** Move the cursor, which is the only thing about the loop that is stored. */
    static async setStep(actor, step) {
        return Chargen.update(actor, { step: step ?? "" });
    }

    /**
     * Run one step and leave the cursor on the next the frame declares.
     * @param {string} [step]   Defaults to the cursor
     * @returns {Promise<object|null>}
     */
    static async run(actor, step = null) {
        if ( !Chargen.isInCreation(actor) ) return null;
        // The owner rolls.
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        const key = step ?? this.current(actor);
        if ( !this.sequence(actor).includes(key) ) return null;

        // A step the frame declares and this build has no procedure of its own for — the nest
        // transition, the status check, the continuation check.
        const handler = STEPS[key] ?? declaredStep;
        const result = await handler(reading(actor), key) ?? {};
        if ( result.advance === false ) return result;
        await this.#advance(actor, key, result.skip ?? []);
        return result;
    }

    /**
     * The cursor walks the frame's own sequence and empties at its end, which is what `decide` then
     * turns into the next term.
     */
    static async #advance(actor, from, skip = []) {
        const sequence = this.sequence(actor);
        const rest = sequence.slice(sequence.indexOf(from) + 1).filter(key => !skip.includes(key));
        return this.setStep(actor, rest[0] ?? "");
    }

    /**
     * Close the term: write what it was worth, credit the Benefit roll it earned, move the clock,
     * and expire whatever the ending of a career expires.
     * @param {string} [options.exitMode]   Where the term also ended the career
     */
    static async closeTerm(actor, { exitMode = "" } = {}) {
        const view = reading(actor);
        const { record, term } = view;
        if ( record ) {
            const kind = termKind(view);
            const entry = logEntry(record, term);
            await logTerm(record, term, {
                years: kind?.years ?? null,
                ages: kind ? kind.ages : true,
                kind: kind?.key ?? ""
            });
            // Folio 18: a term whose Survival failed loses that term's Benefit roll — unless the
            // mishap row said to keep it, which is `benefit: keep` and is credited back where the
            // row is read.
            const earns = (entry.survived !== false) && (kind ? kind.yieldsBenefit : true);
            if ( earns ) {
                await credit(actor, "benefitRolls", { value: 1, career: record.id, term,
                    note: game.i18n.localize("MGT2.Chargen.Term.BenefitTermServed") }, { once: true });
            }
            // `terms` is kept beside `termLog` and is what a record written before the log had
            //, so the loop keeps the two agreeing rather than leaving one stale.
            await record.update({ "system.terms": record.system.termLog.length,
                ...(exitMode ? { "system.exitMode": exitMode } : {}) });
        }
        await Chargen.update(actor, { term: term + 1, step: "" });
        await Chargen.expirePending(actor, record?.id, exitMode);
        // The hand-off, and it is a sentence rather than a screen: mustering out CONSUMES this
        // ledger and the teardown follows it, so a Traveller whose last career has closed
        // is not finished — they are owed the closing screen, and nothing else in the loop would
        // say so.
        if ( exitMode && Chargen.isDone(actor) ) {
            ui.notifications.info(game.i18n.format("MGT2.Chargen.Close.Ready", { name: actor.name }));
        }
        return actor;
    }
}

/** The start-of-term elections. */
async function elect(view) {
    const { system, record, term } = view;
    if ( system?.blocksAnagathics ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.AnagathicsBlocked"));
        return { advance: true };
    }
    const take = await DialogV2.confirm({
        window: { title: "MGT2.Chargen.Steps.elect" },
        classes: ["mgt2"],
        content: `<p>${game.i18n.localize("MGT2.Chargen.Term.AnagathicsAsk")}</p>`,
        rejectClose: false
    });
    if ( !take ) return { advance: true };

    const gate = MGT2.CommissionGate;
    const rolled = await roll(view, { check: "elections", step: "elect",
        characteristic: gate.characteristic, target: 10 });
    if ( !rolled ) return { advance: false };
    // An exact 2 sends the Traveller to a forced-entry career this term.
    const note = (rolled.natural === 2) ? "MGT2.Chargen.Term.AnagathicsForced"
        : (rolled.passed ? "MGT2.Chargen.Term.AnagathicsTaken" : "MGT2.Chargen.Term.AnagathicsRefused");
    ui.notifications.info(game.i18n.localize(note));
    if ( record ) await logTerm(record, term, { outcomes: ["elected"], note: game.i18n.localize(note) });
    return { advance: true };
}

/**
 * Qualification. Five of the six modes reach it as data rather than as a branch: a target
 * with one or more characteristics, an unconditional automatic, a score threshold that bypasses the
 * roll, a forced-only entry, and the referee's permission.
 */
async function qualify(view) {
    const { actor, record, system, term } = view;
    if ( !record ) return needCareer();
    // Continuing is not re-qualifying: the roll exists to ENTER a career (folio 18).
    if ( system.termLog.length ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.Continuing", { career: record.name }));
        return { advance: true };
    }
    // An ageing crisis fails every later qualification roll automatically.
    if ( actor.system.states?.ageingCrisis ) {
        return failQualification(view, game.i18n.localize("MGT2.Chargen.Term.CrisisFails"));
    }

    const automatic = automaticEntry(view);
    if ( automatic ) {
        await record.update({ "system.entryMode": automatic.mode });
        await logTerm(record, term, { note: game.i18n.localize(automatic.note) });
        await applyRankBonus(view, system.ladder, 0);
        ui.notifications.info(game.i18n.localize(automatic.note));
        return { advance: true };
    }
    if ( system.qualification.requiresPermission ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NeedsPermission"));
    }
    // Folio 18: you may not return to the career you just left, and both exceptions are fields
    // rather than names — a template that is always available beats the check, and so does a draft
    // entry.
    if ( leftLastTerm(view) && !system.alwaysAvailable
        && !["drafted", "draftedByEvent"].includes(system.entryMode) ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.NoReturn", { career: record.name }));
        return { advance: false };
    }

    const rows = [];
    // "DM-1 for every previous career", printed on this career's own Qualification line and absent
    // from two of the twelve — which is why it is a field rather than a general rule.
    const previous = Chargen.previousCareers(actor, record);
    if ( previous && system.qualification.perPreviousCareer ) {
        rows.push([game.i18n.format("MGT2.Chargen.Term.PreviousCareers", { n: previous }),
            system.qualification.perPreviousCareer * previous]);
    }
    // "DM-2 if you are aged 30 or more" — three career names and two numbers, as one typed pair.
    if ( (system.ageDM.from !== null) && (Chargen.age(actor) >= system.ageDM.from) && system.ageDM.dm ) {
        rows.push([game.i18n.format("MGT2.Chargen.Term.AgeDM", { age: system.ageDM.from }), system.ageDM.dm]);
    }

    const override = speciesQualification(view);
    const rolled = await roll(view, {
        check: "qualification", step: "qualify", target: system.difficulty,
        characteristic: override.characteristic
            ?? bestCharacteristic(actor, system.qualification.characteristics),
        rows: [...rows, ...override.rows], formula: override.formula
    });
    if ( !rolled ) return { advance: false };
    if ( !rolled.passed ) return failQualification(view, game.i18n.localize("MGT2.Chargen.Term.QualifyFailed"));

    await record.update({ "system.entryMode": "qualified" });
    await logTerm(record, term, { note: game.i18n.localize("MGT2.Chargen.Term.Qualified") });
    // **Rank 0 can carry a bonus, granted on entry**, and the books never place it relative to
    // basic training.
    await applyRankBonus(view, system.ladder, 0);
    return { advance: true };
}

/** The entry modes that need no roll, each of them a field. */
function automaticEntry({ actor, system }) {
    if ( system.qualification.entry === "automatic" ) {
        return { mode: "automatic", note: "MGT2.Chargen.Term.AutomaticEntry" };
    }
    // "One does not qualify for prison — you were sentenced there".
    if ( system.qualification.entry === "forcedOnly" ) {
        return { mode: "automatic", note: "MGT2.Chargen.Term.ForcedEntry" };
    }
    if ( system.alwaysAvailable ) return { mode: "automatic", note: "MGT2.Chargen.Term.AlwaysOpen" };
    // "Automatic qualification if your SOC is 10 or higher", printed on the same line as that
    // career's own target — both clauses the book's own, so this is populated and needs no ruling
    // marker.
    const auto = system.qualification.autoIf;
    if ( auto.characteristic && (auto.min !== null)
        && ((actor.system.characteristics[auto.characteristic]?.value ?? 0) >= auto.min) ) {
        return { mode: "qualified", note: "MGT2.Chargen.Term.AutoThreshold" };
    }
    return null;
}

/**
 * A failed qualification means the career was never entered, so the record goes: a Traveller must
 * not carry a career they were refused, and it holds no term to lose.
 */
async function failQualification({ actor, record }, reason) {
    const state = Chargen.read(actor);
    // Two budgets and not one: the draft is once per lifetime "unless otherwise stated", and the
    // errata prints the otherwise as a general statement.
    const spent = Rules.on("eventDraftBudget")
        ? state.draft.applied : (state.draft.applied + state.draft.byEvent);
    const key = spent ? "MGT2.Chargen.Term.QualifyFailedNoDraft" : "MGT2.Chargen.Term.QualifyFailedDraft";
    ui.notifications.warn(`${reason} ${game.i18n.localize(key)}`);
    await record.delete();
    return { advance: false };
}

/**
 * Four qualification overrides, and they are four shapes rather than one parameter:
 * substitute the whole roll, substitute the characteristic that supplies the DM, ADD a DM to the
 * usual one, or none.
 */
function speciesQualification(view) {
    const none = { characteristic: null, formula: "", rows: [] };
    const override = Chargen.frame(view.actor)?.system.qualificationOverride;
    if ( !override || (override.kind === "none") ) return none;
    if ( namesThisCareer(view.record, override.exceptCareers) ) return none;

    if ( (override.kind === "wholeRoll") && override.formula ) {
        return { characteristic: "", formula: override.formula, rows: [] };
    }
    if ( (override.kind === "characteristic") && override.characteristic ) {
        return { characteristic: override.characteristic, formula: "", rows: [] };
    }
    if ( (override.kind === "addDM") && override.characteristic ) {
        return { characteristic: null, formula: "", rows: [[
            game.i18n.localize("MGT2.Chargen.Term.SpeciesOverride"),
            view.actor.system.characteristics[override.characteristic]?.dm ?? 0]] };
    }
    return none;
}

/** Basic training. */
async function basic(view) {
    const { actor, record, system, assignment, term } = view;
    if ( !record ) return needCareer();
    // **Once per CAREER and not once per term**, even though the frame lists it as a step of the
    // term: folio 18 gives basic training on entering a career, and every later term of that career
    // simply rolls for a skill.
    if ( system.termLog.some(entry => entry.outcomes.has("basicTraining")) ) return { advance: true };
    if ( !system.basicFrom ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoBasicTraining"));
        return { advance: true };
    }
    const rows = (system.basicFrom === "service") ? system.tables.service.rows : (assignment?.skills ?? []);
    if ( !rows.length ) {
        ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Term.NoBasicTable"));
        return { advance: true };
    }

    const first = Chargen.previousCareers(actor, record) === 0;
    const provenance = { term, career: record.id, table: "basic" };
    const applied = [];
    if ( first ) {
        for ( const row of rows ) applied.push(...await applyCell(actor, row, { level: 0, provenance }));
    }
    else {
        const picked = await pickOne(rows.map((row, index) => [String(index), cellLabel(row)]),
            "MGT2.Chargen.Term.PickBasicSkill");
        if ( picked === null ) return { advance: false };
        applied.push(...await applyCell(actor, rows[Number(picked)], { level: 0, provenance }));
    }

    // *"instead of rolling"* binds only the first-career sentence, so the option is
    // ADDITIONAL — a later career's basic training is beside the term's own skill roll rather than
    // in place of it, which hands one extra skill per career after the first and is one of the two
    // a player will feel.
    if ( !first && Rules.on("secondCareerBasicTraining") ) {
        await credit(actor, "skillRolls", { value: 1, career: record.id, term,
            note: game.i18n.localize("MGT2.Chargen.Term.SkillTermRoll") });
    }
    await logTerm(record, term, {
        outcomes: ["basicTraining"],
        note: game.i18n.format(first ? "MGT2.Chargen.Term.BasicFirst" : "MGT2.Chargen.Term.BasicLater",
            { skills: applied.join(", ") || "—" })
    });
    return { advance: true };
}

/**
 * Survival, and a branch that is content-free: *"if still in the career after Survival, roll
 * on the Events table"*, so a failure costs the Event, the Commission and the Advancement and the
 * rest of the term still runs.
 */
async function survival(view) {
    const { record, assignment, term } = view;
    if ( !record ) return needCareer();
    if ( logEntry(record, term).survived !== null ) return { advance: true };
    const target = assignment?.survival.target ?? null;
    if ( target === null ) {
        // A frame with no printed survival number anywhere is a published case and not an error:
        // the term has no check, which is NOT the same fact as one that was passed.
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoSurvivalTarget"));
        return { advance: true };
    }

    const rolled = await roll(view, { check: "survival", step: "survival",
        characteristic: assignment.survival.characteristic, target });
    if ( !rolled ) return { advance: false };
    const survived = rolled.passed && (rolled.natural !== 2);
    await logTerm(record, term, { survived,
        note: game.i18n.localize(survived ? "MGT2.Chargen.Term.Survived"
            : ((rolled.natural === 2) ? "MGT2.Chargen.Term.NaturalTwo"
                : "MGT2.Chargen.Term.SurvivalFailed")) });
    if ( survived ) return { advance: true };

    // Iron Man: a failed Survival **kills** the Traveller rather than causing a Mishap, so
    // the mishap roll does not happen at all.
    if ( CreationOptions.ironMan() ) {
        const died = game.i18n.format("MGT2.Chargen.Term.IronMan", { name: view.actor.name });
        await logTerm(record, term, { note: died });
        ui.notifications.warn(died);
        return { advance: true, skip: SURVIVAL_SKIPS };
    }
    await rollTable(view, "mishap");
    return { advance: true, skip: SURVIVAL_SKIPS };
}

/** The Events table, and its routing as data rather than as hard-coded branches. */
async function event(view) {
    const { record, term } = view;
    if ( !record ) return needCareer();
    if ( logEntry(record, term).ejected ) return { advance: true };
    return rollTable(view, "event");
}

/** One roll on a career's own Events or Mishaps table, and everything the row then does. */
async function rollTable(view, which) {
    const { system } = view;
    const mishap = which === "mishap";
    const rows = mishap ? system.mishapTable : system.eventTable;
    if ( !rows.length ) {
        ui.notifications.warn(game.i18n.localize(mishap
            ? "MGT2.Chargen.Term.NoMishapTable" : "MGT2.Chargen.Term.NoEventTable"));
        return { advance: true };
    }
    const rolled = await roll(view, { step: mishap ? "survival" : "event",
        formula: mishap ? "1d6" : "2d6", target: null });
    if ( !rolled ) return { advance: false };

    const row = rows.find(entry => entry.roll === rolled.total);
    // The routing is data: a 7 is the shared Life Events table unless the template says this
    // career owns that row.
    if ( !mishap && (rolled.total === 7) && (system.eventRow7 !== "own") ) {
        const named = row?.subTable || game.i18n.localize("MGT2.Chargen.Term.LifeEvents");
        const line = game.i18n.format("MGT2.Chargen.Term.RollShared", { table: named });
        ui.notifications.info(line);
        await logTerm(view.record, view.term, { note: line });
        await noteEvent(view, line);
        return { advance: true };
    }
    if ( !row ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.NoRow", { n: rolled.total }));
        return { advance: true };
    }

    await applyRow(view, row, { mishap });
    // A row that sends the Traveller to the Mishap table WITHOUT ejecting is row 2 everywhere and
    // two more rows in some careers — the row says so, and this reads it rather than testing for a
    // 2.
    if ( !mishap && (row.subTable === OWN_MISHAP_TABLE) ) await rollTable(view, "mishap");
    return { advance: true };
}

/** Everything one event or mishap row does, each of it a field rather than a phrase. */
async function applyRow(view, row, { mishap }) {
    const { actor, record, system, term } = view;
    const lines = [row.text].filter(text => text);

    // Ejection is a per-row FACT and not a rule with exceptions, and `neverEjects` on the
    // template flips the default for every row at once.
    let ejected = false;
    if ( system.neverEjects ) {
        if ( row.ejects !== "stays" ) lines.push(game.i18n.localize("MGT2.Chargen.Term.CannotEject"));
    }
    else if ( row.ejects === "ejects" ) ejected = true;
    else if ( row.ejects === "choice" ) {
        ejected = await DialogV2.confirm({
            window: { title: "MGT2.Chargen.Term.EjectChoice" },
            classes: ["mgt2"],
            content: `<p>${foundry.utils.escapeHTML(row.text || "")}</p>
                <p>${game.i18n.localize("MGT2.Chargen.Term.EjectChoiceHint")}</p>`,
            rejectClose: false
        }) === true;
    }

    // Rows keep, lose, wipe or grant Benefit rolls, and two let a player wager them — which
    // needs the pending total to exist mid-term and is the whole reason the count is a ledger.
    const count = row.benefitFormula
        ? (await new Roll(MGT2Helper.damageFormula(row.benefitFormula)).roll()).total : row.benefitCount;
    if ( row.benefit === "grant" ) {
        await credit(actor, "benefitRolls", { value: count, career: record.id, term,
            note: row.text || game.i18n.localize("MGT2.Chargen.Term.BenefitGranted") });
    }
    else if ( row.benefit === "lose" ) {
        await credit(actor, "benefitRolls", { value: -count, career: record.id, term,
            note: row.text || game.i18n.localize("MGT2.Chargen.Term.BenefitLost") });
    }
    else if ( row.benefit === "wipe" ) {
        const held = Chargen.benefitRolls(actor, record.id);
        if ( held ) {
            await credit(actor, "benefitRolls", { value: -held, career: record.id, term,
                note: row.text || game.i18n.localize("MGT2.Chargen.Term.BenefitWiped") });
        }
    }
    // A term whose Survival failed loses its Benefit roll unless the row retains it, so `keep`
    // credits the roll `closeTerm` will not.
    else if ( (row.benefit === "keep") && mishap ) {
        await credit(actor, "benefitRolls", { value: 1, career: record.id, term,
            note: row.text || game.i18n.localize("MGT2.Chargen.Term.BenefitKept") });
    }

    // Three senses, now that `careerMode` says which: send the Traveller there, offer it
    // with qualification waived, or borrow its tables for a single roll without entering it.
    if ( row.career && (row.careerMode === "borrow") ) {
        lines.push(game.i18n.format("MGT2.Chargen.Term.CareerBorrowed", { career: row.career }));
    }
    else if ( row.career ) {
        const forced = row.careerMode === "force";
        await Chargen.pushPending(actor, { kind: forced ? "careerForce" : "careerOffer",
            value: row.career, appliesTo: ["qualification"], scope: "namedCareer", career: row.career,
            duration: "restOfCreation", uses: 1, note: row.text });
        lines.push(game.i18n.format(forced ? "MGT2.Chargen.Term.CareerForced" : "MGT2.Chargen.Term.CareerOffered",
            { career: row.career }));
    }

    // The row's own sub-roll, and the only creation check that names a skill (folio 11).
    let subPassed = null;
    if ( row.check.target !== null ) {
        const sub = await roll(view, { check: mishap ? "survival" : "advancement",
            step: mishap ? "survival" : "event",
            characteristic: row.check.characteristic, skill: row.check.skill, target: row.check.target });
        if ( sub ) {
            subPassed = sub.passed;
            lines.push(game.i18n.localize(sub.passed
                ? "MGT2.Chargen.Term.SubRollPassed" : "MGT2.Chargen.Term.SubRollFailed"));
        }
    }
    if ( row.track.key ) lines.push(await adjustTrack(view, row.track));
    const granted = await applyCell(actor, row.grant,
        { provenance: { term, career: record.id, table: mishap ? "mishap" : "event" } });
    if ( granted.length ) lines.push(granted.join(", "));

    // *DM+1 to one Benefit roll* modifies a roll rather than awarding one, so the row hands the
    // ledger a tray entry.
    for ( const pending of row.tray ) {
        if ( !await earned(pending, row, subPassed) ) continue;
        await Chargen.pushPending(actor, { ...pending, appliesTo: [...pending.appliesTo],
            career: pending.career || (SELF_SCOPES.has(pending.scope) ? record.id : "") });
        lines.push(game.i18n.format("MGT2.Chargen.Term.Pending",
            { what: game.i18n.localize(MGT2.TrayKinds[pending.kind] ?? pending.kind) }));
    }
    if ( row.awards.outcomes.size ) lines.push(...await applyAwards(view, row.awards));

    const note = lines.filter(line => line).join(" · ");
    await logTerm(record, term, {
        ejected: ejected || logEntry(record, term).ejected,
        outcomes: mishap ? ["mishap"] : [],
        note
    });
    if ( ejected ) {
        await record.update({ "system.exitMode": "ejectedByMishap" });
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.Ejected", { career: record.name }));
    }
    return noteEvent(view, note);
}

/**
 * The two scopes that mean *the career being served*, and only the record knows which that is: one
 * bears on it and the other bears on everything else.
 */
const SELF_SCOPES = new Set(["thisCareer", "nextCareer"]);

/** Whether the branch that earns this tray entry was taken. */
async function earned(entry, row, subPassed) {
    if ( entry.condition === "always" ) return true;
    if ( (entry.condition === "checkPassed") && (subPassed !== null) ) return subPassed;
    if ( (entry.condition === "checkFailed") && (subPassed !== null) ) return !subPassed;
    const what = game.i18n.localize(MGT2.TrayKinds[entry.kind] ?? entry.kind);
    return await DialogV2.confirm({
        window: { title: "MGT2.Chargen.Term.TrayConditionTitle" },
        classes: ["mgt2"],
        content: `<p>${foundry.utils.escapeHTML(row.text || "")}</p>
            <p>${game.i18n.format("MGT2.Chargen.Term.TrayConditionAsk",
        { what, detail: entry.note || what })}</p>`,
        rejectClose: false
    }) === true;
}

/**
 * What a row awards OUTRIGHT, with no roll — row 12 on six careers promotes or commissions
 *.
 */
async function applyAwards(view, awards) {
    // The vocabulary's own order, so a commission is granted before the promotion that follows it,
    // which is the order the term's own steps run in.
    let keys = Object.keys(MGT2.TermOutcomes).filter(key => awards.outcomes.has(key));
    // An arm the Traveller cannot legally take is not an arm: "a promotion or a commission"
    // collapses to the promotion for an officer, and offering the other one would be an illegal
    // choice about half the time.
    if ( keys.includes("commissioned") && !commissionAvailable(view) ) {
        keys = keys.filter(key => key !== "commissioned");
    }
    if ( (awards.mode === "oneOf") && (keys.length > 1) ) {
        const offered = keys.map(key => [key, game.i18n.localize(MGT2.TermOutcomes[key])]);
        if ( awards.optional ) offered.push(["", game.i18n.localize("MGT2.Chargen.Term.DeclineAward")]);
        const picked = await pickOne(offered, "MGT2.Chargen.Term.PickAward");
        keys = picked ? [picked] : [];
    }
    else if ( awards.optional && keys.length ) {
        const take = await DialogV2.confirm({
            window: { title: "MGT2.Chargen.Term.PickAward" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.Chargen.Term.OptionalAwardAsk",
                { what: keys.map(key => game.i18n.localize(MGT2.TermOutcomes[key])).join(", ") })}</p>`,
            rejectClose: false
        });
        if ( !take ) keys = [];
    }
    const lines = [];
    for ( const key of keys ) {
        // Re-read between awards: both write to the record, and a commission that has just reset
        // the rank to 1 is what the promotion after it must count from.
        const fresh = reading(view.actor);
        if ( !fresh.record ) break;
        if ( key === "commissioned" ) lines.push(await commissionRecord(fresh));
        else if ( key === "advanced" ) lines.push(await promote(fresh));
        else if ( key === "demoted" ) lines.push(await demote(fresh));
        else {
            await logTerm(fresh.record, fresh.term, { outcomes: [key] });
            // The one outcome whose meaning lives in the ledger rather than in the log: several
            // rows grant a free roll on the Skills and Training tables.
            if ( key === "skillRoll" ) {
                await credit(view.actor, "skillRolls", { value: 1, career: fresh.record.id,
                    term: fresh.term, note: game.i18n.localize("MGT2.Chargen.Term.SkillFromRow") });
            }
            lines.push(game.i18n.localize(MGT2.TermOutcomes[key]));
        }
    }
    return lines;
}

/** The career record's own dated event log, which is what the grid prints inside a cell. */
async function noteEvent({ actor, record }, description) {
    if ( !description ) return record;
    const events = record.system.events.map(entry => ({ ...entry }));
    events.push({ age: Chargen.age(actor), description });
    return record.update({ "system.events": events });
}

/** A named track, moved by a row. */
async function adjustTrack(view, move) {
    const { record, system, term } = view;
    if ( system.track.key !== move.key ) return "";
    if ( move.reroll ) {
        const definition = system.tracks.find(entry => entry.key === move.key);
        const rerolled = definition?.initial
            ? (await new Roll(MGT2Helper.damageFormula(definition.initial)).roll()).total
            : (system.track.value ?? 0);
        await record.update({ "system.track.value": clampTrack(rerolled, system.track.cap) });
        return game.i18n.format("MGT2.Chargen.Term.TrackReroll", { track: move.key, value: rerolled });
    }
    const delta = move.formula
        ? (await new Roll(MGT2Helper.damageFormula(move.formula)).roll()).total : move.value;
    const value = clampTrack((system.track.value ?? 0) + delta, system.track.cap);
    const adjustments = system.track.adjustments.map(entry => ({ ...entry }));
    adjustments.push({ value: delta, term, note: game.i18n.localize("MGT2.Chargen.Term.TrackMoved") });
    await record.update({ "system.track.value": value, "system.track.adjustments": adjustments });
    return game.i18n.format("MGT2.Chargen.Term.TrackAdjusted",
        { track: move.key, dm: MGT2Helper.signed(delta), value });
}

function clampTrack(value, cap) {
    return (cap === null) ? value : Math.min(value, cap);
}

/**
 * The commission, and `commission` is the field that replaced *"this only applies to the military
 * careers of Army, Navy and Marines"*.
 */
async function commission(view) {
    const { actor, record, system, term } = view;
    if ( !record ) return needCareer();
    if ( logEntry(record, term).outcomes.has("commissioned") ) return { advance: true };
    // The career prints no commission, or the record is already an officer and there is nothing
    // left to gain (folio 19).
    if ( !commissionAvailable(view) ) return { advance: true };
    if ( system.commissionCheck.target === null ) {
        ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Term.NoCommissionTarget"));
        return { advance: true };
    }

    const gate = MGT2.CommissionGate;
    // Terms served BEFORE this one, and the distinction is the whole rule: the row for the term in
    // progress is already in the log by the time this step runs — `qualify` writes it — so
    // `termLog.length` would read 1 in the first term and refuse the only term folio 19 allows.
    const served = system.termLog.filter(entry => entry.term < term).length;
    if ( served && ((actor.system.characteristics[gate.characteristic]?.value ?? 0) < gate.min) ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.CommissionFirstTerm", {
            characteristic: game.i18n.localize(MGT2.Characteristics[gate.characteristic]), n: gate.min }));
        return { advance: true };
    }
    // Trying for a commission is optional (folio 19), so it is asked rather than rolled.
    const attempt = await DialogV2.confirm({
        window: { title: "MGT2.Chargen.Steps.commission" },
        classes: ["mgt2"],
        content: `<p>${game.i18n.localize("MGT2.Chargen.Term.CommissionAsk")}</p>`,
        rejectClose: false
    });
    if ( !attempt ) return { advance: true };

    const rolled = await roll(view, {
        check: "commission", step: "commission",
        characteristic: system.commissionCheck.characteristic,
        target: system.commissionCheck.target,
        rows: served ? [[game.i18n.format("MGT2.Chargen.Term.CommissionLater", { n: served }),
            gate.laterTermDM * served]] : []
    });
    if ( !rolled ) return { advance: false };
    if ( !rolled.passed ) {
        await logTerm(record, term, { note: game.i18n.localize("MGT2.Chargen.Term.CommissionFailed") });
        return { advance: true };
    }

    await logTerm(record, term, { note: await commissionRecord(view) });
    return { advance: true };
}

/**
 * The commission itself, reached by the roll above and by a row that awards one outright.
 */
async function commissionRecord(view) {
    const { record, system, assignment, term } = view;
    const ladder = assignment?.officerLadder || system.ladder;
    await record.update({ "system.enlistedRank": system.rank, "system.ladder": ladder, "system.rank": 1 });
    await logTerm(record, term, { outcomes: ["commissioned"] });
    await applyRankBonus(view, ladder, 1);
    return game.i18n.localize("MGT2.Chargen.Term.Commissioned");
}

/**
 * Advancement, which is three separate outcomes on one roll (folio 18): success promotes and grants
 * an extra skill roll, a result at or under the terms served in this career ends it after this
 * term, and a natural 12 forces the Traveller to stay.
 */
async function advance(view) {
    const { record, system, assignment, term } = view;
    if ( !record ) return needCareer();
    const entry = logEntry(record, term);
    if ( entry.outcomes.has("advanced") || entry.outcomes.has("forcedOut") ) return { advance: true };
    const kind = termKind(view);
    if ( kind && !kind.yieldsAdvancement ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoAdvancement"));
        return { advance: true };
    }
    const target = assignment?.advancement.target ?? null;
    if ( target === null ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoAdvancementTarget"));
        return { advance: true };
    }

    const served = system.termLog.length;
    const tracked = !!system.exitRule.track && (system.exitRule.track === system.track.key);
    const threshold = system.track.value ?? 0;

    // **A frame may govern advancement with a characteristic of its own**, whatever each career's
    // line prints — one published species advances on the same score in every career it can enter.
    const framed = Chargen.stepCheck(view.actor, "advance");
    const rolled = await roll(view, { check: "advancement", step: "advance",
        characteristic: framed?.characteristic || assignment.advancement.characteristic, target });
    if ( !rolled ) return { advance: false };

    const outcomes = [];
    const lines = [];
    if ( rolled.passed && (!tracked || Rules.on("trackedAdvancementPromotes")) ) {
        lines.push(await promote(view));
    }
    if ( tracked ) {
        // The printed sentence is exhaustive: greater than the threshold releases, everything else
        // continues.
        if ( rolled.total > threshold ) {
            outcomes.push("released");
            lines.push(game.i18n.format("MGT2.Chargen.Term.Released", { track: system.track.key }));
        }
        else lines.push(game.i18n.format("MGT2.Chargen.Term.Held", { track: system.track.key }));
    }
    else {
        if ( rolled.total <= served ) {
            outcomes.push("forcedOut");
            lines.push(game.i18n.format("MGT2.Chargen.Term.ForcedOut", { n: served }));
        }
        if ( rolled.natural === 12 ) {
            outcomes.push("mustContinue");
            lines.push(game.i18n.localize("MGT2.Chargen.Term.MustContinue"));
        }
    }
    await logTerm(record, term, { outcomes, note: lines.filter(line => line).join(" · ") });
    return { advance: true };
}

/**
 * A promotion: the next rung, the extra skill roll folio 18 attaches to it, and the ladder's own
 * bonus row.
 */
async function promote(view) {
    const { actor, record, system, term } = view;
    const rank = system.rank + 1;
    await record.update({ "system.rank": rank });
    await credit(actor, "skillRolls", { value: 1, career: record.id, term,
        note: game.i18n.localize("MGT2.Chargen.Term.SkillFromAdvance") });
    await logTerm(record, term, { outcomes: ["advanced"] });
    await applyRankBonus(view, system.ladder, rank);
    return game.i18n.format("MGT2.Chargen.Term.Advanced", { rank: Chargen.effectiveRank(record) });
}

/** A demotion: *"Lose 1 rank … but you are not ejected from this career"*. */
async function demote(view) {
    const { actor, record, system, term } = view;
    const rank = Math.max(0, system.rank - 1);
    const tracks = foundry.utils.deepClone(Chargen.read(actor).tracks);
    const key = system.ladder;
    if ( key ) {
        const held = tracks[key] ?? { value: null, rung: "", high: null };
        tracks[key] = { ...held, high: Math.max(held.high ?? 0, system.rank) };
        await Chargen.update(actor, { tracks });
    }
    await record.update({ "system.rank": rank });
    await logTerm(record, term, { outcomes: ["demoted"] });
    return game.i18n.format("MGT2.Chargen.Term.Demoted", { rank });
}

/**
 * Whether a commission is still there to be gained — the career prints one and the record is not
 * already on its officer ladder (folio 19).
 */
function commissionAvailable({ system, assignment }) {
    if ( !system.commission ) return false;
    return !(system.enlistedRank
        || (assignment?.officerLadder && (system.ladder === assignment.officerLadder)));
}

/** Rank 0 can carry a bonus too, granted on entry — which the design never placed relative to basic training. */
async function applyRankBonus(view, ladder, rank) {
    const { actor, record, system, term } = view;
    const row = (system.rankLadders.find(entry => entry.id === ladder)?.rows ?? [])
        .find(entry => entry.rank === rank);
    if ( !row?.bonus ) return [];
    return applyCell(actor, row.bonus, { provenance: { term, career: record.id, table: "rank" } });
}

/**
 * The skill roll: one per term plus one per successful advancement, spent from the ledger.
 */
async function skill(view) {
    const { actor, record, term } = view;
    if ( !record ) return needCareer();
    const kind = termKind(view);
    if ( kind && !kind.yieldsSkills ) return { advance: true };
    // The term's own roll, credited here where no basic-training step claimed it.
    if ( !logEntry(record, term).outcomes.has("basicTraining") ) {
        await credit(actor, "skillRolls", { value: 1, career: record.id, term,
            note: game.i18n.localize("MGT2.Chargen.Term.SkillTermRoll") }, { once: true });
    }
    const available = Chargen.skillRolls(actor);
    if ( available <= 0 ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoSkillRolls"));
        return { advance: true };
    }

    const tables = skillTables(view);
    if ( !tables.length ) {
        ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Term.NoSkillTables"));
        return { advance: true };
    }
    const picked = await pickOne(tables.map(table => [table.key, table.label]),
        game.i18n.format("MGT2.Chargen.Term.PickTable", { n: available }));
    if ( picked === null ) return { advance: false };
    const rows = tables.find(table => table.key === picked).rows;

    // The table is chosen as always and gated as always — only the die is
    // removed, which is the whole of what the option changes.
    let row;
    if ( CreationOptions.pickedSkills() ) {
        const chosen = await pickOne(rows.map((entry, index) => [String(index), cellLabel(entry)]),
            "MGT2.Chargen.Term.PickSkillRow");
        if ( chosen === null ) return { advance: false };
        row = rows[Number(chosen)];
    }
    else {
        const rolled = await roll(view, { step: "skill", formula: "1d6", target: null });
        if ( !rolled ) return { advance: false };
        row = rows[rolled.total - 1];
        if ( !row ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.NoRow", { n: rolled.total }));
            return { advance: false };
        }
    }
    const applied = await applyCell(actor, row,
        { provenance: { term, career: record.id, table: picked } });
    await credit(actor, "skillRolls", { value: -1, career: record.id, term,
        note: game.i18n.localize("MGT2.Chargen.Term.SkillSpent") });
    await logTerm(record, term, { outcomes: ["skillRoll"],
        note: game.i18n.format("MGT2.Chargen.Term.SkillGained", { skills: applied.join(", ") || "—" }) });
    return { advance: true };
}

/** Which of a career's tables this Traveller may roll on now — missing, gated and commissioned alike. */
function skillTables({ actor, system, assignment }) {
    const officer = !!system.enlistedRank || (!!system.ladder && system.rankLadders.some(
        entry => (entry.id === system.ladder) && entry.officer));
    const tables = [];
    for ( const [key, table] of Object.entries(system.tables) ) {
        if ( !table.present || !table.rows.length ) continue;
        if ( table.requiresCommission && !officer ) continue;
        const gate = table.gate;
        if ( gate.characteristic && (gate.min !== null)
            && ((actor.system.characteristics[gate.characteristic]?.value ?? 0) < gate.min) ) continue;
        tables.push({ key, label: game.i18n.localize(`MGT2.Chargen.Tables.${key}`), rows: table.rows });
    }
    if ( assignment?.skills.length ) {
        tables.push({ key: "assignment", rows: assignment.skills,
            label: game.i18n.format("MGT2.Chargen.Tables.assignment", { name: assignment.name }) });
    }
    return tables;
}

/**
 * Ageing, and the roll is a table index rather than a pass or a fail: `2D` with the Traveller's own
 * ageing law as its DM, read against Core p.49's eight rows.
 */
async function ageing(view) {
    const { actor, record, term } = view;
    const kind = termKind(view);
    if ( kind && !kind.ages ) return { advance: true };
    if ( record && logEntry(record, term).outcomes.has("aged") ) return { advance: true };
    if ( !Chargen.ageingDue(actor) ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoAgeingYet"));
        return { advance: true };
    }

    const law = Chargen.frame(actor)?.system.ageing;
    const defaults = MGT2.CreationDefaults;
    const terms = Chargen.termsServed(actor);
    // The law is an EXPRESSION and not a switch: the published values run -1, -2, -1/2, +1 and ±1
    // by sex.
    const dm = Math.trunc(((law ? law.perTerm : defaults.ageingPerTerm) * terms)
        + (law ? law.flat : defaults.ageingFlat));
    // Target 1 because the table's top row IS "1+, no effect": the pass line is the book's own.
    const rolled = await roll(view, { check: "survival", step: "ageing", target: 1,
        rows: dm ? [[game.i18n.format("MGT2.Chargen.Term.AgeingDM", { n: terms }), dm]] : [] });
    if ( !rolled ) return { advance: false };

    const row = ageingRow(rolled.total);
    if ( !row ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.AgeingNoRow", { n: rolled.total }));
        return { advance: true };
    }
    const changes = await pickLosses(actor, row);
    if ( changes === null ) return { advance: false };
    if ( Object.keys(changes).length ) {
        const log = actor.system.characteristicLog.map(entry => ({ ...entry }));
        log.push({ source: "ageing", term, age: Chargen.age(actor), roll: rolled.total, changes,
            cost: 0, note: "" });
        await actor.update({ "system.characteristicLog": log });
    }
    if ( record ) {
        await logTerm(record, term, { outcomes: ["aged"],
            note: game.i18n.format("MGT2.Chargen.Term.Aged",
                { n: rolled.total, changes: describeChanges(changes) }) });
    }
    // The crisis is derived from the log the moment it is written, so it is read back rather than
    // decided here: any characteristic at 0 means death unless the care is paid for.
    if ( actor.system.states?.ageingCrisis ) {
        ui.notifications.error(game.i18n.localize("MGT2.Chargen.Term.AgeingCrisis"));
    }
    return { advance: true };
}

/**
 * The table stops at -6, printed bare — while the DM is the total terms served, so a
 * nine-term Traveller rolling snake-eyes sits at -7 and the book prints neither a row nor an
 * instruction to floor.
 */
function ageingRow(total) {
    const rows = MGT2.AgeingEffects;
    if ( total >= rows.at(-1).roll ) return rows.at(-1);
    return rows.find(row => row.roll === total)
        ?? (Rules.on("ageingTableFloor") ? rows[0] : null);
}

/** The player's own choice, one select per point the row takes, so nothing is inferred afterwards. */
async function pickLosses(actor, row) {
    const groups = [
        ...row.physical.map(points => ({ points, keys: MGT2.PhysicalCharacteristics })),
        ...row.mental.map(points => ({ points, keys: mentalCharacteristics(actor) }))
    ].filter(group => group.keys.length);
    if ( !groups.length ) return {};
    const fields = groups.map((group, index) => {
        const options = group.keys.map(key =>
            `<option value="${key}">${game.i18n.localize(MGT2.Characteristics[key])}</option>`).join("");
        return `<div class="form-group"><label>${game.i18n.format("MGT2.Chargen.Term.LosePoints",
            { n: group.points })}</label><select name="g${index}">${options}</select></div>`;
    }).join("");
    const picked = await DialogV2.prompt({
        window: { title: "MGT2.Chargen.Steps.ageing" },
        classes: ["mgt2"],
        content: `<p>${game.i18n.localize("MGT2.Chargen.Term.AgeingChoose")}</p>${fields}`,
        ok: { label: "MGT2.Chargen.Term.Apply",
            callback: (event, button) => groups.map((group, index) =>
                [button.form.elements[`g${index}`].value, group.points]) },
        rejectClose: false
    });
    if ( !picked ) return null;
    const changes = {};
    for ( const [key, points] of picked ) changes[key] = (changes[key] ?? 0) - points;
    return changes;
}

/** Everything this Traveller has that is not physical — the only partition the books state (folio 9). */
function mentalCharacteristics(actor) {
    return Object.keys(actor.system.characteristics ?? {})
        .filter(key => !MGT2.PhysicalCharacteristics.includes(key)
            && (actor.system.isCharacteristicShown?.(key) !== false));
}

function describeChanges(changes) {
    return Object.entries(changes).map(([key, value]) =>
        `${game.i18n.localize(MGT2.Characteristics[key])} ${MGT2Helper.signed(value)}`).join(", ") || "—";
}

/** Continue or leave — the step that closes the term and the only one that moves the clock. */
async function decide(view) {
    const { actor, record, system, term } = view;
    if ( !record ) {
        await ChargenTerm.closeTerm(actor);
        return { advance: true };
    }
    const entry = logEntry(record, term);
    for ( const [outcome, mode] of FORCED_EXITS ) {
        if ( !entry[outcome] && !entry.outcomes.has(outcome) ) continue;
        await ChargenTerm.closeTerm(actor, { exitMode: mode });
        return { advance: true };
    }
    if ( entry.outcomes.has("mustContinue") ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.MustContinue"));
        await ChargenTerm.closeTerm(actor);
        return { advance: true };
    }

    const forced = entry.outcomes.has("forcedOut");
    // The maximum-terms cap is the table's own ceiling rather than an outcome of this
    // term: it takes the offer of another term away without making the ending a forced one, so the
    // exit mode below stays voluntary.
    const cap = CreationOptions.maximumTerms();
    const capped = (cap > 0) && (Chargen.termsServed(actor) >= cap);
    if ( capped ) ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.MaximumTerms", { n: cap }));
    const done = forced || capped;
    // The book's own two groups leave one career in neither, hence the fourth value.
    const changeRule = system.assignmentChange || Rules.get("undeclaredAssignmentChange");
    const buttons = [];
    if ( !done ) buttons.push({ action: "stay", label: "MGT2.Chargen.Term.Continue", default: true });
    if ( !done && (system.assignments.length > 1) ) {
        buttons.push({ action: "assignment",
            label: game.i18n.format("MGT2.Chargen.Term.ChangeAssignment",
                { rule: game.i18n.localize(MGT2.AssignmentChangeRules[changeRule]) }) });
    }
    buttons.push({ action: "leave", label: "MGT2.Chargen.Term.LeaveCareer", default: done });

    const choice = await DialogV2.wait({
        window: { title: "MGT2.Chargen.Steps.decide" },
        classes: ["mgt2"],
        content: `<p>${game.i18n.format("MGT2.Chargen.Term.DecideHint",
            { career: record.name, n: system.termLog.length })}</p>`,
        buttons, rejectClose: false
    });
    if ( !choice ) return { advance: false };

    if ( choice === "assignment" ) await changeAssignment(view, changeRule);
    if ( choice === "leave" ) {
        await ChargenTerm.closeTerm(actor,
            { exitMode: forced ? "forcedOutByAdvancement" : "voluntary" });
        return { advance: true };
    }
    await ChargenTerm.closeTerm(actor);
    return { advance: true };
}

/** Changing assignment, whose behaviour is a field with four values. */
async function changeAssignment(view, rule) {
    const { actor, record, system } = view;
    const picked = await pickOne(system.assignments
        .filter(entry => entry.name !== system.assignment).map(entry => [entry.name, entry.name]),
    "MGT2.Chargen.Term.PickAssignment");
    if ( picked === null ) return;

    if ( rule === "free" ) return record.update({ "system.assignment": picked });
    if ( rule === "requalifyKeepRank" ) {
        const rolled = await roll(view, { check: "qualification", step: "qualify",
            characteristic: bestCharacteristic(actor, system.qualification.characteristics),
            target: system.difficulty });
        if ( !rolled ) return;
        // Succeed and you adopt the new assignment KEEPING your rank; fail and you simply continue
        // in the old one, without penalty (folio 20).
        if ( rolled.passed ) {
            return record.update({ "system.assignment": picked, "system.entryMode": "assignmentChange" });
        }
        return void ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.AssignmentKept"));
    }
    ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.AssignmentNewCareer"));
}

/**
 * A step the frame declares and this build has no procedure of its own for — the nest transition,
 * the status check, the continuation check, the household timetable.
 */
async function declaredStep(view, key) {
    const label = game.i18n.localize(MGT2.CreationSteps[key] ?? key);
    const check = Chargen.stepCheck(view.actor, key);
    if ( !check || !checkRolls(check) ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.RefereeStep", { step: label }));
        if ( view.record ) await logTerm(view.record, view.term, { note: label });
        return { advance: true };
    }

    // A check the term did not trigger is not a check that was passed, and not one the referee owes
    // either: it simply does not fire.
    if ( (check.when === "afterMishap") && !logEntry(view.record, view.term).outcomes.has("mishap") ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.StepNotTriggered", { step: label }));
        return { advance: true };
    }

    const { target, row, missing } = stepTarget(view, check);
    // A printed table with a hole in it — the SOC Rank table skips one score entirely — leaves a
    // Traveller at that score with no printed difficulty.
    if ( missing ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.NoStepTarget", { step: label }));
        if ( view.record ) await logTerm(view.record, view.term, { note: label });
        return { advance: true };
    }

    await Chargen.ensureTracks(view.actor);
    // The step key IS the check key here, which is what lets a standing modifier printed against a
    // frame-owned step reach it — `MGT2.CreationChecks` carries the four.
    const rolled = await roll(view, {
        check: key, step: key, target,
        characteristic: check.characteristic,
        skill: bestSkill(view.actor, check.skills),
        rows: trackRows(view.actor, check.trackModifiers)
    });
    if ( !rolled ) return { advance: false };

    // The row's award is the printed table's own column and is NOT conditioned on the roll — what
    // the roll buys is the check's arm — so it applies either way and the two are read together.
    const arms = [rolled.passed ? check.onPass : check.onFail, row?.award];
    const lines = [];
    for ( const arm of arms ) lines.push(...await applyStepOutcome(view, arm, key));
    const note = [label, ...lines].filter(line => line).join(" · ");
    if ( view.record ) await logTerm(view.record, view.term, { note });
    return { advance: true };
}

/** Enough of a check to roll: a named term, and a target the ladder or the line supplies. */
function checkRolls(check) {
    return !!(check.characteristic || check.skills.length)
        && ((check.target !== null) || (check.ladder.length > 0));
}

/**
 * The target this term's check is measured against.
 * @returns {{target: number|null, row: object|null, missing: boolean}}
 */
function stepTarget(view, check) {
    if ( !check.ladder.length ) return { target: check.target, row: null, missing: false };
    const index = (check.index === "characteristic")
        ? (view.actor.system.characteristics[check.indexCharacteristic]?.value ?? null)
        : view.term;
    const row = (index === null) ? null : check.ladder.find(entry =>
        ((entry.from === null) || (index >= entry.from)) && ((entry.to === null) || (index <= entry.to)));
    if ( !row ) return { target: check.target, row: null, missing: check.target === null };
    return { target: row.target ?? check.target, row, missing: (row.target === null) && (check.target === null) };
}

/** The best of the skills a printed line offers — *"a Diplomat or Persuade check"* is the Traveller's pick. */
function bestSkill(actor, skills) {
    if ( skills.length < 2 ) return skills[0] ?? "";
    return skills.reduce((best, skill) =>
        ((CreationRoll.skillLevel(actor, skill) ?? -Infinity) > (CreationRoll.skillLevel(actor, best) ?? -Infinity))
            ? skill : best);
}

/**
 * The DMs a printed step check reads off a track — *"caste number as a negative DM"* — which no
 * characteristic and no skill supplies.
 * @returns {[string, number][]}
 */
function trackRows(actor, modifiers) {
    const declared = Chargen.frame(actor)?.system.frame.tracks ?? [];
    const rows = [];
    for ( const modifier of modifiers ) {
        if ( !modifier.track || !modifier.per ) continue;
        const value = Chargen.track(actor, modifier.track).value;
        if ( !value ) continue;
        const label = declared.find(entry => entry.key === modifier.track)?.label;
        rows.push([label || modifier.track, modifier.per * value]);
    }
    return rows;
}

/** One arm of a step check, applied. @returns {Promise<string[]>} */
async function applyStepOutcome(view, arm, key) {
    if ( !arm ) return [];
    const { actor, record, term } = view;
    const lines = [];

    if ( arm.track.key ) {
        const delta = arm.track.formula
            ? (await new Roll(MGT2Helper.damageFormula(arm.track.formula)).roll()).total : arm.track.value;
        const moved = delta ? await Chargen.moveTrack(actor, arm.track.key, delta) : null;
        // A track at its last rung is a printed state — *"one attempt at promotion each term until
        // the Traveller reaches the status of rankholder"* — and it is said rather than logged as a
        // move that did not happen.
        if ( moved?.moved ) {
            lines.push(game.i18n.format("MGT2.Chargen.Term.TrackAdjusted", { track: moved.label,
                dm: MGT2Helper.signed(delta), value: moved.rung || moved.value }));
        }
        else if ( moved ) lines.push(game.i18n.format("MGT2.Chargen.Term.TrackAtCap", { track: moved.label }));
    }
    const granted = await applyCell(actor, arm.grant,
        { provenance: { term, career: record?.id ?? "", table: key } });
    if ( granted.length ) lines.push(granted.join(", "));
    if ( arm.outcomes.size && record ) {
        lines.push(...await applyAwards(view, { outcomes: arm.outcomes, mode: "all", optional: false }));
    }

    // Ejection is the same fact here as on a row, and `neverEjects` on the career flips it for the
    // same reason: a career that cannot eject cannot be left by a species' own check either
    //.
    if ( record && (arm.ejects !== "stays") ) {
        const ejected = (arm.ejects === "ejects") || (await DialogV2.confirm({
            window: { title: "MGT2.Chargen.Term.EjectChoice" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.localize("MGT2.Chargen.Term.EjectChoiceHint")}</p>`,
            rejectClose: false
        }) === true);
        if ( ejected && view.system.neverEjects ) lines.push(game.i18n.localize("MGT2.Chargen.Term.CannotEject"));
        else if ( ejected ) {
            await logTerm(record, term, { ejected: true });
            await record.update({ "system.exitMode": "ejectedByMishap" });
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.Ejected", { career: record.name }));
            lines.push(game.i18n.format("MGT2.Chargen.Term.Ejected", { career: record.name }));
        }
    }
    return lines;
}

function needCareer() {
    ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Term.NoCareer"));
    return { advance: false };
}

const STEPS = Object.freeze({
    elect, qualify, basic, survival, event, commission, advance, skill, ageing, decide
});

/**
 * *"if still in the career after Survival, roll on the Events table"* — so a failed Survival
 * costs the Event, the Commission and the Advancement, and the rest of the term still runs.
 */
const SURVIVAL_SKIPS = Object.freeze(["event", "commission", "advance"]);

/** The endings no one chooses, read off the term's own facts and in the order they displace each other. */
const FORCED_EXITS = Object.freeze([["ejected", "ejectedByMishap"], ["released", "paroled"]]);

/** The one sub-table a record carries itself; every other name addresses the shared block. */
const OWN_MISHAP_TABLE = "mishap";

/**
 * One creation check, composed and posted by `CreationRoll` so that the ledger has exactly one
 * modifier set and the system exactly one card.
 * @param {string} [options.check]      A `MGT2.TrayChecks` key — what the tray and the standing
 *     modifiers are filtered by
 * @param {string} options.step         A `MGT2.CreationSteps` key, for the card's headline
 * @param {number|null} options.target  The number the rule prints, or null for a roll that indexes a table
 * @returns {Promise<{total: number, natural: number, passed: boolean}|null>}
 */
async function roll(view, { check = "", step, target = null, characteristic = "", skill: named = "",
    rows = [], formula = "" } = {}) {
    const { actor, record } = view;
    const composed = CreationRoll.compose(actor, {
        characteristic, skill: named, check, career: record?.id, target, rows });
    // A table roll indexes rather than passes: 1D on a Mishap table, 2D on an Events table.
    if ( formula ) composed.formula = [formula, ...composed.parts].join("");

    const label = game.i18n.localize(MGT2.CreationSteps[step] ?? step);
    const posted = await CreationRoll.post(actor, composed, {
        label: record ? `${label} · ${record.name}` : label, target });
    if ( !posted ) return null;

    const total = posted.outcome.roll.total;
    if ( target !== null ) await Chargen.spendPending(actor, check, record?.id);
    return {
        total,
        // Three rules read the DICE and not the total: a natural 2 always fails Survival, a natural
        // 12 forces a stay, and an exact 2 on the anagathics roll forces a career change.
        natural: posted.outcome.roll.dice[0]?.total ?? total,
        passed: posted.passed === true
    };
}

/**
 * One printed cell applied, which is a small EXPRESSION and not a scalar.
 * @returns {Promise<string[]>}   What was granted, already localised, for the term log
 */
async function applyCell(actor, cell, { level = null, provenance = {} } = {}) {
    if ( !cell ) return [];
    let grants = cell.grants ?? [];
    if ( !grants.length ) return cell.text ? [cell.text] : [];
    if ( (cell.mode === "oneOf") && (grants.length > 1) ) {
        const picked = await pickOne(grants.map((grant, index) => [String(index), grantLabel(grant)]),
            "MGT2.Chargen.Term.PickGrant");
        if ( picked === null ) return [];
        grants = [grants[Number(picked)]];
    }
    const applied = [];
    for ( const grant of grants ) {
        const line = await applyGrant(actor, grant, { level, provenance });
        if ( line ) applied.push(line);
    }
    return applied;
}

async function applyGrant(actor, grant, { level, provenance }) {
    if ( grant.kind === "skill" ) {
        const named = await resolveSkill(grant);
        if ( !named ) return "";
        const written = await Grants.grantSkill(actor, {
            name: named.name, speciality: named.speciality,
            // Basic training grants every listed skill AT LEVEL 0, which is a different arithmetic
            // from a table row and the reason the level is passed rather than read off the cell.
            level: (level === null) ? grant.value : level,
            mode: (level === null) ? grant.mode : "atLeast",
            floor: grant.floor, provenance });
        if ( !written ) return "";
        if ( written.degraded ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.CapBreached", { skill: named.name }));
        }
        return `${written.item.name} ${written.to}`;
    }
    if ( grant.kind === "characteristic" ) return grantCharacteristic(actor, grant, provenance);
    if ( (grant.kind === "cash") || (grant.kind === "shipShare") ) return grantFinance(actor, grant);
    if ( grant.kind === "contact" ) {
        const count = grant.formula
            ? (await new Roll(MGT2Helper.damageFormula(grant.formula)).roll()).total : grant.value;
        for ( let i = 0; i < count; i++ ) await Grants.contact(actor, { provenance });
        return `${game.i18n.localize(MGT2.CreationGrantKinds.contact)} ×${count}`;
    }
    // A voucher and a bare note are the referee's to resolve: the system has no catalogue and never
    // will.
    return grantLabel(grant);
}

/** A characteristic change is a signed row in the log and never a write to `base`. */
async function grantCharacteristic(actor, grant, provenance) {
    if ( !grant.characteristic ) return "";
    const current = actor.system.characteristics[grant.characteristic]?.value ?? 0;
    // The one form that lives on rank rows: `SOC 10 or SOC +1, whichever is higher` is max(current
    // + 1, floor), and the floor is per ROW because one ladder prints 10 then 12.
    const delta = (grant.mode === "floor")
        ? Math.max(current + 1, grant.floor ?? 0) - current : grant.value;
    if ( !delta ) return "";
    const log = actor.system.characteristicLog.map(entry => ({ ...entry }));
    log.push({ source: "event", term: provenance.term ?? null, age: Chargen.age(actor), roll: null,
        changes: { [grant.characteristic]: delta }, cost: 0, note: provenance.table ?? "" });
    await actor.update({ "system.characteristicLog": log });
    return `${game.i18n.localize(MGT2.Characteristics[grant.characteristic])} ${MGT2Helper.signed(delta)}`;
}

async function grantFinance(actor, grant) {
    const amount = grant.formula
        ? (await new Roll(MGT2Helper.damageFormula(grant.formula)).roll()).total : grant.value;
    if ( !amount ) return "";
    const key = (grant.kind === "cash") ? "credits" : "shipShares";
    await actor.update({ [`system.finance.${key}`]: (actor.system.finance[key] ?? 0) + amount });
    return `${game.i18n.localize(MGT2.CreationGrantKinds[grant.kind])} ${MGT2Helper.signed(amount)}`;
}

/**
 * The skill a grant names, once the player has answered whatever the printed cell leaves open: a
 * family wildcard (`Gun Combat (any)`) and a `choose` speciality are the two, and both are the
 * book's own way of writing a choice rather than a value.
 * @returns {Promise<{name: string, speciality: string}|null>}
 */
async function resolveSkill(grant) {
    const base = grant.skill?.trim();
    if ( !base ) return null;
    const open = grant.family || (grant.speciality === "choose") || (grant.specialities.length > 1);
    if ( !open ) return { name: base, speciality: (grant.speciality === "choose") ? "" : grant.speciality };
    if ( grant.specialities.length ) {
        const picked = await pickOne(grant.specialities.map(name => [name, `${base} (${name})`]),
            "MGT2.Chargen.Term.PickSpeciality");
        return picked === null ? null : { name: base, speciality: picked };
    }
    // A family wildcard names no shortlist at all, so the player types the member.
    const typed = await DialogV2.prompt({
        window: { title: "MGT2.Chargen.Term.PickSpeciality" },
        classes: ["mgt2"],
        content: `<div class="form-group"><label>${foundry.utils.escapeHTML(base)}</label>
            <input type="text" name="name" value=""></div>`,
        ok: { label: "MGT2.Chargen.Term.Apply",
            callback: (event, button) => button.form.elements.name.value.trim() },
        rejectClose: false
    });
    return typed ? { name: base, speciality: typed } : { name: base, speciality: "" };
}

function grantLabel(grant) {
    if ( grant.kind === "skill" ) {
        const speciality = grant.speciality ? ` (${grant.speciality})` : "";
        return `${grant.skill}${speciality}${(grant.value === 1) ? "" : ` ${grant.value}`}`;
    }
    if ( grant.kind === "characteristic" ) {
        return `${game.i18n.localize(MGT2.Characteristics[grant.characteristic] ?? grant.characteristic)} `
            + MGT2Helper.signed(grant.value);
    }
    return grant.ref || game.i18n.localize(MGT2.CreationGrantKinds[grant.kind] ?? grant.kind);
}

function cellLabel(cell) {
    return cell.text
        || (cell.grants ?? []).map(grantLabel).join((cell.mode === "oneOf") ? " / " : ", ")
        || "—";
}

/** One reading of everything a step needs, taken once so that no two steps can disagree. */
function reading(actor) {
    const state = Chargen.read(actor);
    const record = Chargen.serving(actor)[0] ?? null;
    return {
        actor, state, record,
        system: record?.system ?? null,
        assignment: Chargen.assignment(record),
        term: state.term
    };
}

/** What the frame says this kind of term yields — benefit rolls, advancement, skills, years. */
function termKind(view) {
    const key = logEntry(view.record, view.term).kind;
    if ( !key ) return null;
    return (Chargen.frame(view.actor)?.system.frame.termKinds ?? [])
        .find(entry => entry.key === key) ?? null;
}

/** The term log row for one term, present or not — the reader, never the writer. */
function logEntry(record, term) {
    return record?.system.termLog.find(entry => entry.term === term)
        ?? { term, years: null, ages: true, survived: null, ejected: false, kind: "",
            outcomes: new Set(), note: "" };
}

/**
 * Upsert one term of the log, which is where every step writes its own outcome the moment it is
 * decided.
 */
async function logTerm(record, term, patch) {
    const log = record.system.termLog.map(entry => ({ ...entry, outcomes: [...entry.outcomes] }));
    let row = log.find(entry => entry.term === term);
    if ( !row ) {
        row = { term, years: null, ages: true, survived: null, ejected: false, kind: "",
            outcomes: [], note: "" };
        log.push(row);
    }
    const outcomes = new Set([...row.outcomes, ...(patch.outcomes ?? [])]);
    const note = patch.note ? [row.note, patch.note].filter(text => text).join(" · ") : row.note;
    Object.assign(row, patch, { outcomes: [...outcomes], note });
    await record.update({ "system.termLog": log });
    return row;
}

/**
 * One signed row of a counter ledger — a delta and never a total.
 * @param {boolean} [options.once]   Refuse a repeat row. Only the automatic once-per-term entries
 *     want it: two skills bought in one term are two identical rows.
 */
async function credit(actor, ledger, entry, { once = false } = {}) {
    const rows = Chargen.read(actor)[ledger].map(row => ({ ...row }));
    if ( once && rows.some(row => (row.career === entry.career) && (row.term === entry.term)
        && (row.note === entry.note) && (row.value === entry.value)) ) return actor;
    rows.push(entry);
    return Chargen.update(actor, { [ledger]: rows });
}

/** The highest-scoring of the characteristics a career offers — the printed `DEX or INT 5+`. */
function bestCharacteristic(actor, keys) {
    const offered = (keys ?? []).filter(key => key);
    if ( !offered.length ) return "";
    return offered.reduce((best, key) =>
        ((actor.system.characteristics[key]?.value ?? 0) > (actor.system.characteristics[best]?.value ?? 0))
            ? key : best);
}

/** Whether the Traveller left a career last term, which folio 18 closes to them for one term. */
function leftLastTerm({ actor, record }) {
    const previous = Chargen.careers(actor).filter(career => career !== record).at(-1);
    if ( !previous || (previous.system.exitMode === "stillServing") ) return false;
    return namesThisCareer(record, [previous.name, previous._stats?.compendiumSource ?? ""]);
}

/** Whether a referee-typed list of template ids names this record. */
function namesThisCareer(record, ids) {
    if ( !record ) return false;
    const source = record._stats?.compendiumSource ?? "";
    return (ids ?? []).filter(id => id).some(id =>
        (id === record.name) || (id === record.id) || (id === source)
        || (!!source && source.endsWith(`.${id}`)));
}

/** One select, one answer. Null is the player closing the dialog rather than choosing. */
async function pickOne(options, title) {
    if ( !options.length ) return null;
    if ( options.length === 1 ) return options[0][0];
    const markup = options.map(([value, label]) =>
        `<option value="${foundry.utils.escapeHTML(String(value))}">${foundry.utils.escapeHTML(label)}</option>`)
        .join("");
    const picked = await DialogV2.prompt({
        window: { title },
        classes: ["mgt2"],
        content: `<div class="form-group"><select name="pick">${markup}</select></div>`,
        ok: { label: "MGT2.Chargen.Term.Apply",
            callback: (event, button) => button.form.elements.pick.value },
        rejectClose: false
    });
    return picked ?? null;
}
