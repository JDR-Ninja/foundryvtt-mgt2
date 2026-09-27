import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { CareerLibrary, SharedTables } from "./chargen-tables.js";
import { CreationOptions, CreationRoll } from "./chargen-rolls.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Muster } from "./chargen-muster.js";
import { Psionics } from "./chargen-psionics.js";
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
        if ( Chargen.isDead(actor) ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.IronMan", { name: actor.name }));
            return null;
        }
        // The owner rolls.
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        const key = step ?? this.current(actor);
        if ( !this.sequence(actor).includes(key) ) return null;

        // Taken before the handler runs: closing a term moves the clock and may end the career, so
        // afterwards neither the term number nor the serving record is the one this step belongs to.
        const view = reading(actor);
        // Core p.16-17: education has its own skills, events, graduation and ending, and no Survival,
        // commission or skill roll; a frame's own step has no procedure here at all.
        const handler = ((view.system?.kind === "preCareer") ? EDUCATION[key] : null) ?? STEPS[key] ?? declaredStep;
        // Core p.18-19: every step is attempted once a term; the skill step spends a ledger, one roll a run.
        if ( (key !== "skill") && this.taken(actor).has(key) ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.StepTaken",
                { step: game.i18n.localize(MGT2.CreationSteps[key] ?? key) }));
            return { advance: false };
        }
        const result = await handler(view, key) ?? {};
        if ( result.advance === false ) return result;
        if ( view.record ) {
            await logTerm(view.record, view.term, { steps: [key, ...(result.skip ?? [])] });
        }
        await this.#advance(actor, key, result.skip ?? []);
        return result;
    }

    /** The steps the term in progress has taken, which the loop refuses to roll again. @returns {Set<string>} */
    static taken(actor) {
        const view = reading(actor);
        return new Set(logEntry(view.record, view.term).steps);
    }

    /** The referee's correction: a step rolled again, keeping what it wrote but the verdict a re-roll replaces. */
    static async resetStep(actor, key) {
        if ( !game.user.isGM ) return null;
        const view = reading(actor);
        if ( key === "qualify" ) {
            await Chargen.update(actor, { refusals: Chargen.read(actor).refusals
                .filter(entry => entry.term !== view.term).map(entry => ({ ...entry })) });
        }
        if ( view.record ) {
            const reopened = entry => (entry.term === view.term) && (key === "survival") ? { survived: null } : {};
            await view.record.update({ "system.termLog": view.record.system.termLog.map(entry => ({ ...entry,
                outcomes: [...entry.outcomes], ...reopened(entry),
                steps: [...entry.steps].filter(step => (entry.term !== view.term) || (step !== key)) })) });
        }
        return this.setStep(actor, key);
    }

    /** The cursor walks the frame's own sequence and empties at its end, which `decide` turns into the next term. */
    static async #advance(actor, from, skip = []) {
        const sequence = this.sequence(actor);
        const rest = sequence.slice(sequence.indexOf(from) + 1).filter(key => !skip.includes(key));
        return this.setStep(actor, rest[0] ?? "");
    }

    /** Close the term: log its worth, credit its Benefit roll, move the clock, expire what the ending expires. */
    static async closeTerm(actor, { exitMode = "" } = {}) {
        const view = reading(actor);
        const { record, term } = view;
        if ( record ) {
            const kind = termKind(view);
            const entry = logEntry(record, term);
            // Core p.16: "there is no mustering out" — and the Companion's education may print its own years.
            const education = record.system.kind === "preCareer";
            const years = (education && record.system.preCareer.years)
                ? (await new Roll(MGT2Helper.damageFormula(record.system.preCareer.years)).roll()).total : null;
            await logTerm(record, term, {
                years: years ?? kind?.years ?? null,
                ages: kind ? kind.ages : true,
                kind: kind?.key ?? "",
                closed: true
            });
            // Folio 18: a failed Survival loses the term's Benefit roll; a mishap row's `keep` credits it back.
            const earns = !education && (entry.survived !== false) && (kind ? kind.yieldsBenefit : true);
            if ( earns ) {
                await credit(actor, "benefitRolls", { value: 1, career: record.id, term,
                    note: game.i18n.localize("MGT2.Chargen.Term.BenefitTermServed") }, { once: true });
            }
            // `terms` stays beside `termLog`, for records written before the log.
            await record.update({ "system.terms": record.system.termLog.length,
                ...(exitMode ? { "system.exitMode": exitMode } : {}) });
        }
        await Chargen.update(actor, { term: term + 1, step: "" });
        await Chargen.expirePending(actor, record?.name, exitMode);
        // A Traveller whose last career closed is owed the closing screen, and nothing else says so.
        if ( exitMode && Chargen.isDone(actor) && !Chargen.isDead(actor) ) {
            ui.notifications.info(game.i18n.format("MGT2.Chargen.Close.Ready", { name: actor.name }));
        }
        return actor;
    }
}

/** The start-of-term elections: Core p.49's anagathics, begun, kept up or stopped. */
async function elect(view) {
    const { actor, system, record, term } = view;
    const since = anagathicsSince(actor);
    // Core p.52: none in prison, and a Traveller taken there comes off them.
    if ( system?.blocksAnagathics ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.AnagathicsBlocked"));
        if ( since !== null ) await stopAnagathics(view);
        return { advance: true };
    }
    const ask = key => DialogV2.confirm({ window: { title: "MGT2.Chargen.Steps.elect" }, classes: ["mgt2"],
        content: `<p>${game.i18n.localize(key)}</p>`, rejectClose: false });
    if ( since !== null ) {
        if ( await ask("MGT2.Chargen.Term.AnagathicsContinue") ) await payAnagathics(view);
        else await stopAnagathics(view);
        return { advance: true };
    }
    if ( !await ask("MGT2.Chargen.Term.AnagathicsAsk") ) return { advance: true };

    const rules = MGT2.Anagathics;
    const rolled = await roll(view, { check: "elections", step: "elect",
        characteristic: rules.characteristic, target: rules.target });
    if ( !rolled ) return { advance: false };
    // An exact 2 sends the Traveller to a forced-entry career this term, out of the one they were in.
    const forced = rolled.natural === rules.forcedOn;
    const note = forced ? "MGT2.Chargen.Term.AnagathicsForced"
        : (rolled.passed ? "MGT2.Chargen.Term.AnagathicsTaken" : "MGT2.Chargen.Term.AnagathicsRefused");
    if ( forced ) {
        await Chargen.pushPending(actor, { kind: "careerForce", value: "", appliesTo: ["qualification"],
            scope: "anyCareer", duration: "restOfCreation", uses: 1, note: game.i18n.localize(note) });
        ui.notifications.info(game.i18n.localize(note));
        if ( !record ) return { advance: true };
        // The term was never served in the career left, so it is closed without a row of its own.
        await record.update({ "system.exitMode": "blocked" });
        await ChargenTerm.setStep(actor, stepAfter(actor, "elect"));
        return { advance: false };
    }
    else if ( rolled.passed ) {
        await Chargen.update(actor, { tracks: { ...foundry.utils.deepClone(Chargen.read(actor).tracks),
            [rules.track]: { value: term, rung: "", high: term } } });
        await payAnagathics(view);
    }
    ui.notifications.info(game.i18n.localize(note));
    if ( record ) await logTerm(record, term, { outcomes: ["elected"], note: game.i18n.localize(note) });
    return { advance: true };
}

/** The term the Traveller began anagathics in, or null. */
function anagathicsSince(actor) {
    return Chargen.read(actor).tracks[MGT2.Anagathics.track]?.value ?? null;
}

/** Core p.49: 1D × Cr25000 a term out of eventual cash benefits; a cost that cannot be carried stops them. */
async function payAnagathics(view) {
    const { actor, record, term } = view;
    const cost = (await new Roll(MGT2Helper.damageFormula(MGT2.Anagathics.cost)).roll()).total;
    const spent = await Muster.spend(actor, cost, { note: game.i18n.localize("MGT2.Chargen.Term.AnagathicsCost") });
    if ( spent.refused ) return stopAnagathics(view);
    if ( record ) {
        await logTerm(record, term, { note: game.i18n.format("MGT2.Chargen.Term.AnagathicsPaid",
            { credits: MGT2Helper.credits(cost) }) });
    }
    return cost;
}

/** Core p.49: stopping for any reason forces an ageing roll at once. */
async function stopAnagathics(view) {
    await Chargen.dropTracks(view.actor, [MGT2.Anagathics.track]);
    ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.AnagathicsStopped"));
    return ageNow(view, { forced: true });
}

/** Qualification: a target, automatic entry, a score threshold, forced-only, the referee's permission. */
async function qualify(view, key) {
    const { actor, record, system, term } = view;
    if ( !record ) {
        const open = Chargen.read(actor).refusals.some(entry => (entry.term === term) && !entry.drafted
            && !entry.education);
        return open ? afterRefusal(view) : needCareer();
    }
    // Continuing is not re-qualifying: the roll exists to ENTER a career (folio 18), and a career
    // has been entered once one of its terms has closed.
    if ( system.termLog.some(entry => entry.closed) || logEntry(record, term).steps.has(key) ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.Continuing", { career: record.name }));
        return { advance: true };
    }
    // Core p.16: no education from term four on, and one attempt at one a term.
    if ( system.kind === "preCareer" ) {
        const closed = (term > system.preCareer.lastTerm) ? "MGT2.Chargen.Education.Closed"
            : (Chargen.refusedThisTerm(actor, { education: true }) ? "MGT2.Chargen.Education.OneAttempt" : "");
        if ( closed ) {
            ui.notifications.warn(game.i18n.format(closed, { career: record.name, n: system.preCareer.lastTerm }));
            await record.delete();
            return { advance: false };
        }
    }
    const decided = await entryDecided(view);
    if ( decided === false ) return { advance: false };
    if ( decided ) {
        const assignment = await chooseAssignment(view, decided.assignment);
        if ( !assignment ) return { advance: false };
        await enter(view, assignment, decided);
        ui.notifications.info(game.i18n.format(decided.note, { career: record.name }));
        return { advance: true };
    }
    // Core p.18: refused once this term, the Traveller may take only the draft or a career always open.
    if ( Chargen.refusedThisTerm(actor) && !system.alwaysAvailable ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.RefusedThisTerm", { career: record.name }));
        await record.delete();
        return { advance: false };
    }
    // An ageing crisis fails every later qualification roll automatically.
    if ( actor.system.states?.ageingCrisis ) {
        return failQualification(view, game.i18n.localize("MGT2.Chargen.Term.CrisisFails"));
    }

    const automatic = Chargen.refusedThisTerm(actor)
        ? { mode: "fallbackCareer", note: "MGT2.Chargen.Term.AlwaysOpen" } : automaticEntry(view);
    // Folio 18: no return to the career just left; a template always available and a new-career
    // assignment change beat it.
    if ( !automatic && leftLastTerm(view) && !system.alwaysAvailable && (system.entryMode !== "assignmentChange") ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.NoReturn", { career: record.name }));
        return { advance: false };
    }
    // Core p.11: "Pick one of these assignments when you enter the career" — asked before the roll,
    // so closing the picker rolls nothing.
    const assignment = await chooseAssignment(view);
    if ( !assignment ) return { advance: false };
    if ( automatic ) {
        await enter(view, assignment, automatic);
        ui.notifications.info(game.i18n.localize(automatic.note));
        return { advance: true };
    }

    const rows = [];
    // "DM-1 for every previous career", printed on this career's own Qualification line.
    const previous = Chargen.previousCareers(actor, record);
    if ( previous && system.qualification.perPreviousCareer ) {
        rows.push([game.i18n.format("MGT2.Chargen.Term.PreviousCareers", { n: previous }),
            system.qualification.perPreviousCareer * previous]);
    }
    const served = previousRecord(view);
    for ( const row of system.qualification.conditionalDMs ) {
        if ( !row.dm ) continue;
        if ( row.characteristic && (row.min !== null) ) {
            if ( (actor.system.characteristics[row.characteristic]?.value ?? 0) < row.min ) continue;
            rows.push([game.i18n.format("MGT2.Chargen.Term.ConditionalCharacteristic", {
                characteristic: game.i18n.localize(MGT2.Characteristics[row.characteristic]),
                min: row.min }), row.dm]);
        }
        else if ( served && namesThisCareer(served, row.afterCareers) ) {
            rows.push([game.i18n.format("MGT2.Chargen.Term.ConditionalLastCareer",
                { career: served.name }), row.dm]);
        }
    }
    const termDM = (system.kind === "preCareer") ? (system.preCareer.termDMs[term - 1] ?? 0) : 0;
    if ( termDM ) rows.push([game.i18n.format("MGT2.Chargen.Education.TermDM", { n: term }), termDM]);
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
    await enter(view, assignment, { mode: "qualified", note: "MGT2.Chargen.Term.Qualified" });
    return { advance: true };
}

/** What the tray, a draft or the referee decided about entering: an entry with no roll, false refused, null to roll. */
async function entryDecided(view) {
    const { actor, record, system, term } = view;
    const named = name => MGT2Helper.skillSlug(name) === MGT2Helper.skillSlug(record.name);
    const tray = Chargen.read(actor).tray;
    const refuse = (key, data) => {
        ui.notifications.warn(game.i18n.format(key, { career: record.name, name: actor.name, ...data }));
        return false;
    };
    if ( await prohibits(actor, "qualification", record.name) ) return refuse("MGT2.Chargen.Term.Prohibited");
    // Core p.52's sentence and an event's draft are compelled: that career, and no other, this term.
    const force = tray.find(entry => (entry.kind === "careerForce")
        && (entry.value ? named(entry.value) : (system.qualification.entry === "forcedOnly")));
    if ( force ) {
        await Chargen.spendEntry(actor, entry => (entry.kind === "careerForce") && (entry.value === force.value));
        return { mode: force.entryMode || "automatic", note: "MGT2.Chargen.Term.Forced", assignment: force.assignment };
    }
    const elsewhere = tray.find(entry => entry.kind === "careerForce");
    if ( elsewhere ) return refuse("MGT2.Chargen.Term.MustEnter", { other: elsewhere.value || "—" });
    const refusal = Chargen.read(actor).refusals.find(entry => (entry.term === term) && entry.drafted);
    if ( refusal && named(refusal.drafted) ) {
        return { mode: "drafted", note: "MGT2.Chargen.Term.DraftEntry", assignment: refusal.assignment };
    }
    if ( DRAFTED.includes(system.entryMode) ) return { mode: system.entryMode, note: "MGT2.Chargen.Term.DraftEntry" };
    const offer = tray.find(entry => (entry.kind === "careerOffer") && named(entry.value));
    if ( offer && await DialogV2.confirm({ window: { title: "MGT2.Chargen.Term.OfferTitle" }, classes: ["mgt2"],
        content: `<p>${game.i18n.format("MGT2.Chargen.Term.OfferAsk", { career: record.name })}</p>`,
        rejectClose: false }) ) {
        await Chargen.spendEntry(actor, entry => (entry.kind === "careerOffer") && named(entry.value));
        return { mode: "automatic", note: "MGT2.Chargen.Term.OfferTaken", assignment: offer.assignment };
    }
    // Core p.52: never entered voluntarily — only by a sentence, a draft, or the referee's own hand.
    if ( system.qualification.entry === "forcedOnly" ) {
        return game.user.isGM ? { mode: "automatic", note: "MGT2.Chargen.Term.ForcedEntry" }
            : refuse("MGT2.Chargen.Term.NotVoluntary");
    }
    // Core p.229: the referee's permission, which an event that opens the career grants.
    if ( system.qualification.requiresPermission ) {
        const unlock = tray.find(entry => (entry.kind === "unlock") && named(entry.value));
        if ( unlock ) await Chargen.spendEntry(actor, entry => (entry.kind === "unlock") && named(entry.value));
        else if ( !game.user.isGM ) return refuse("MGT2.Chargen.Term.NeedsPermission");
    }
    return null;
}

/** Whether a `prohibition` forbids this check for this career; "in the first term" is one-shot, spent here. */
async function prohibits(actor, check, career) {
    const entry = Chargen.pending(actor, check, career).find(one => one.kind === "prohibition");
    if ( entry?.duration === "oneShot" ) {
        await Chargen.spendEntry(actor, one => (one.kind === "prohibition") && (one.note === entry.note)
            && (one.career === entry.career));
    }
    return !!entry;
}

/** The assignment the record enters on: one fixed for it, the one it already names, else the player's pick. */
async function chooseAssignment({ system }, fixed = "") {
    const wanted = MGT2Helper.skillSlug(fixed || system.assignment);
    const named = wanted ? system.assignments.find(entry => MGT2Helper.skillSlug(entry.name) === wanted) : null;
    if ( named || !system.assignments.length ) return named ?? { name: "", ladder: "" };
    const picked = await pickOne(system.assignments.map((entry, index) => [String(index), entry.name || "—"]),
        "MGT2.Chargen.Term.PickAssignment");
    return (picked === null) ? null : system.assignments[Number(picked)];
}

/** Entering writes the assignment and its ladder, and pays rank 0 at once: *"acquired immediately"* (folio 19). */
async function enter(view, assignment, { mode, note }) {
    const { record, system, term } = view;
    const enlisted = system.rankLadders.filter(entry => entry.id && !entry.officer);
    const ladder = assignment.ladder || ((enlisted.length === 1) ? enlisted[0].id : "");
    // An entry mode the loop did not decide here — a draft, a new-career assignment change — is kept.
    const kept = [...DRAFTED, "fallbackCareer", "assignmentChange"].includes(system.entryMode) ? system.entryMode : mode;
    await record.update({ "system.entryMode": kept, "system.assignment": assignment.name, "system.ladder": ladder,
        ...await bornTrack(system) });
    await logTerm(record, term, { note: game.i18n.format(note, { career: record.name }) });
    await applyRankBonus(view, ladder, 0);
    if ( system.kind !== "preCareer" ) await Chargen.bindGraduation(view.actor, record, true);
    return grantOnEntry(view);
}

/** Core p.52: a career's leaving track — the Parole Threshold — is rolled at entry from its declaration. */
async function bornTrack(system) {
    const definition = system.tracks.find(entry => entry.key && (entry.key === system.exitRule.track));
    if ( !definition || system.track.key ) return {};
    const rolled = definition.initial ? (await new Roll(MGT2Helper.damageFormula(definition.initial)).roll()).total : 0;
    return { "system.track": { key: definition.key, value: clampTrack(rolled, definition.cap),
        cap: definition.cap, adjustments: [] } };
}

/** A `grant` on the tray for the career just entered: that many rows of its table, each to level 1 (Core p.17). */
async function grantOnEntry(view) {
    const { actor, record, term } = view;
    for ( const entry of Chargen.pending(actor, "qualification", record.name).filter(one => one.kind === "grant") ) {
        const rows = (record.system.tables[entry.value] ?? record.system.tables.service).rows;
        const chosen = new Set();
        for ( let n = 0; (n < (entry.uses ?? 1)) && (chosen.size < rows.length); n++ ) {
            const picked = await pickOne(rows.map((row, index) => [String(index), cellLabel(row)])
                .filter(([index]) => !chosen.has(index)), "MGT2.Chargen.Term.PickGrantedSkill");
            if ( picked === null ) break;
            chosen.add(picked);
            await applyCell(actor, rows[Number(picked)], { level: 1, provenance: { term, career: record.id, table: "grant" } });
        }
        await Chargen.spendEntry(actor, one => (one.kind === "grant") && (one.value === entry.value), { whole: true });
    }
    return record;
}

/** The entry modes that need no roll, each of them a field. */
function automaticEntry({ actor, system }) {
    if ( system.qualification.entry === "automatic" ) {
        return { mode: "automatic", note: "MGT2.Chargen.Term.AutomaticEntry" };
    }
    if ( system.alwaysAvailable ) return { mode: "automatic", note: "MGT2.Chargen.Term.AlwaysOpen" };
    // "Automatic qualification if your SOC is 10 or higher", printed on the same line as that
    // career's own target.
    const auto = system.qualification.autoIf;
    const score = actor.system.characteristics[auto.characteristic]?.value ?? 0;
    // The Companion's "Automatic if SOC 6-" is the same clause under a ceiling.
    if ( auto.characteristic && ((auto.min !== null) || (auto.max !== null))
        && ((auto.min === null) || (score >= auto.min)) && ((auto.max === null) || (score <= auto.max)) ) {
        return { mode: "qualified", note: "MGT2.Chargen.Term.AutoThreshold" };
    }
    return null;
}

/** A refused qualification: the career was never entered, so the record goes and the ledger keeps the refusal. */
async function failQualification(view, reason) {
    const { actor, record, system, term } = view;
    const education = system.kind === "preCareer";
    await Chargen.update(actor, { refusals: [...Chargen.read(actor).refusals.map(entry => ({ ...entry })),
        { term, career: record.name, education }] });
    await record.delete();
    // Core p.16: "the Traveller must immediately attempt entry into a career and, failing that, be drafted".
    if ( education ) {
        ui.notifications.warn(`${reason} ${game.i18n.localize("MGT2.Chargen.Education.Refused")}`);
        return { advance: false };
    }
    await Chargen.bindGraduation(actor, record, false);
    return afterRefusal(view, reason);
}

/** Core p.19's two roads after a refusal, offered again at `qualify` while the choice is put off. */
async function afterRefusal(view, reason = "") {
    // Core p.19: the draft is once per lifetime "unless otherwise stated"; Core p.17 prints the
    // otherwise as a general statement, so an event draft is budgeted apart.
    const drafts = Chargen.draftsTaken(view.actor);
    const spent = Rules.on("eventDraftBudget") ? drafts.drafted : (drafts.drafted + drafts.byEvent);
    const text = [reason, game.i18n.localize(spent ? "MGT2.Chargen.Term.QualifyFailedNoDraft"
        : "MGT2.Chargen.Term.QualifyFailedDraft")].filter(line => line).join(" ");
    ui.notifications.warn(text);
    const choice = await DialogV2.wait({
        window: { title: "MGT2.Chargen.Term.RefusedTitle" },
        classes: ["mgt2"],
        content: `<p>${foundry.utils.escapeHTML(text)}</p>`,
        buttons: [...(spent ? [] : [{ action: "draft", label: "MGT2.Chargen.Term.TakeDraft" }]),
            { action: "drifter", label: "MGT2.Chargen.Term.TakeDrifter" },
            { action: "later", label: "MGT2.Chargen.Term.DecideLater", default: true }],
        rejectClose: false
    });
    if ( choice === "draft" ) await draftNow(view);
    if ( choice === "drifter" ) await enterFallback(view);
    return { advance: false };
}

/** Core p.19's Draft: the shared table drawn, or the career the referee reads off the book. */
async function draftNow(view) {
    const { actor, term } = view;
    const table = await SharedTables.table("draft");
    let career = "";
    let assignment = "";
    if ( table?.system.eventTable.length ) {
        const rolled = await roll({ ...view, record: null, system: null }, { step: "qualify", title: table.name,
            formula: MGT2.SharedCreationTables.draft.dice, target: null });
        const row = table.system.eventTable.find(entry => entry.roll === rolled?.total);
        career = row?.career ?? "";
        assignment = row?.careerAssignment ?? "";
    }
    else career = await promptText("MGT2.Chargen.Term.DraftAsk");
    if ( !career ) return null;
    await Chargen.update(actor, { refusals: Chargen.read(actor).refusals.map(entry =>
        (((entry.term === term) && !entry.education) ? { ...entry, drafted: career, assignment } : { ...entry })) });
    return enterNamed(actor, career, { mode: "drafted", note: "MGT2.Chargen.Term.DraftEntry", assignment });
}

/** Core p.19: refused, the Traveller may spend the term in a career that is always open. */
async function enterFallback(view) {
    const found = await CareerLibrary.fallbacks();
    if ( !found.length ) return void ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoFallback"));
    const picked = await pickOne(found.map((item, index) => [String(index), item.name]), "MGT2.Chargen.Term.PickFallback");
    if ( picked === null ) return null;
    const template = found[Number(picked)];
    return enterNamed(view.actor, template.name, { mode: "fallbackCareer", note: "MGT2.Chargen.Term.AlwaysOpen" },
        template);
}

/** The career a draft or a fallback names, copied onto the Traveller as a drop would, and entered with no roll. */
async function enterNamed(actor, name, decided, template = null) {
    const found = template ?? await CareerLibrary.find(name);
    if ( !found ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.DropNamed", { career: name, name: actor.name }));
        return null;
    }
    const data = MGT2Helper.stripIds(found);
    data._stats = { ...data._stats, compendiumSource: found.pack ? found.uuid : (data._stats?.compendiumSource ?? null) };
    const [created] = await actor.createEmbeddedDocuments("Item", [data]);
    const view = reading(actor);
    if ( view.record !== created ) return created;
    const assignment = await chooseAssignment(view, decided.assignment);
    if ( !assignment ) return created;
    await enter(view, assignment, decided);
    await logTerm(created, view.term, { steps: ["qualify"] });
    await ChargenTerm.setStep(actor, stepAfter(actor, "qualify"));
    ui.notifications.info(game.i18n.format(decided.note, { career: created.name }));
    return created;
}

/** The step the frame's sequence puts after this one, or none. */
function stepAfter(actor, key) {
    const sequence = ChargenTerm.sequence(actor);
    return sequence[sequence.indexOf(key) + 1] ?? "";
}

/** One line of text, or null where the dialog was closed. */
async function promptText(label) {
    const typed = await DialogV2.prompt({
        window: { title: label },
        classes: ["mgt2"],
        content: `<p>${game.i18n.localize(label)}</p><div class="form-group"><input type="text" name="text" value=""></div>`,
        ok: { label: "MGT2.Chargen.Term.Apply", callback: (event, button) => button.form.elements.text.value.trim() },
        rejectClose: false
    });
    return typed || null;
}

/** Four qualification overrides, four shapes: the whole roll, the DM's characteristic, an added DM, or none. */
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
    // Once per CAREER though the frame lists it per term: folio 18 trains on entering a career, and
    // every later term of it simply rolls for a skill.
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

    // *"instead of rolling"* binds only the first career, so a later one's basic training is beside the
    // term's skill roll, not in place of it: one extra skill per career after the first.
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

/** Survival: a mishap that ejects costs the Event, the Commission and the Advancement; the rest of the term runs. */
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

    // Core p.49: on anagathics, two Survival checks a term, and either failure is the Mishap.
    let survived = true;
    let naturalTwo = false;
    for ( let n = (anagathicsSince(view.actor) === null) ? 1 : 2; n > 0; n-- ) {
        const rolled = await roll(view, { check: "survival", step: "survival",
            characteristic: Chargen.stepCheck(view.actor, "survival")?.characteristic || assignment.survival.characteristic, target });
        if ( !rolled ) return { advance: false };
        naturalTwo ||= rolled.natural === 2;
        survived &&= rolled.passed && (rolled.natural !== 2);
    }
    await logTerm(record, term, { survived,
        note: game.i18n.localize(survived ? "MGT2.Chargen.Term.Survived"
            : (naturalTwo ? "MGT2.Chargen.Term.NaturalTwo" : "MGT2.Chargen.Term.SurvivalFailed")) });
    if ( survived ) return { advance: true };

    // Iron Man: a failed Survival **kills** the Traveller rather than causing a Mishap, so
    // the mishap roll does not happen at all.
    if ( CreationOptions.ironMan() ) {
        const died = game.i18n.format("MGT2.Chargen.Term.IronMan", { name: view.actor.name });
        await logTerm(record, term, { note: died, steps: ["survival", ...SURVIVAL_SKIPS] });
        ui.notifications.warn(died);
        // Companion p.13: "your Traveller is killed and you must start again", so the term ends here.
        await ChargenTerm.closeTerm(view.actor, { exitMode: "died" });
        return { advance: false };
    }
    await rollTable(view, "mishap");
    if ( !logEntry(record, term).ejected ) return { advance: true };
    const kept = Rules.on("ejectedTermSkillRoll");
    await logTerm(record, term, { note: game.i18n.localize(kept ? "MGT2.Chargen.Term.EjectedSkillKept"
        : "MGT2.Chargen.Term.EjectedSkillLost") });
    return { advance: true, skip: kept ? SURVIVAL_SKIPS : [...SURVIVAL_SKIPS, "skill"] };
}

/** The Events table, and its routing as data rather than as hard-coded branches. */
async function event(view) {
    const { record, term } = view;
    if ( !record ) return needCareer();
    if ( logEntry(record, term).ejected ) return { advance: true };
    return rollTable(view, "event");
}

/** One roll on a career's own Events or Mishaps table, and everything the row then does. */
async function rollTable(view, which, { nested = false } = {}) {
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
        return followSubTable(view, row?.subTable ?? "", { fallback: "lifeEvents" });
    }
    if ( !row ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.NoRow", { n: rolled.total }));
        return { advance: true };
    }

    await applyRow(view, row, { mishap, nested });
    if ( row.subTable ) await followSubTable(view, row.subTable);
    return { advance: true };
}

/** A row naming another table: the career's own Mishap table, Core p.49's Injury, or a shared one. */
async function followSubTable(view, name, { fallback = "", depth = 0 } = {}) {
    if ( MGT2Helper.skillSlug(name) === OWN_MISHAP_TABLE ) return rollTable(view, "mishap", { nested: true });
    if ( SharedTables.isInjury(name) ) return rollInjury(view);
    const role = SharedTables.role(name) || fallback;
    if ( !role || (depth > 2) ) return { advance: true };
    const table = await SharedTables.table(role);
    const label = table?.name ?? game.i18n.localize(MGT2.SharedCreationTables[role].label);
    if ( !table?.system.eventTable.length ) {
        const line = game.i18n.format("MGT2.Chargen.Term.RollShared", { table: label });
        ui.notifications.info(line);
        if ( view.record ) await logTerm(view.record, view.term, { note: line });
        if ( view.record ) await noteEvent(view, line);
        return { advance: true };
    }
    const rolled = await roll(view, { step: "event", title: label,
        formula: MGT2.SharedCreationTables[role].dice || "2d6", target: null });
    if ( !rolled ) return { advance: false };
    const row = table.system.eventTable.find(entry => entry.roll === rolled.total);
    if ( !row ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.NoRow", { n: rolled.total }));
        return { advance: true };
    }
    // Core p.17: drafted through an event, the Traveller enters the drawn career next term.
    if ( role === "draft" ) return draftNextTerm(view, row, rolled.total);
    await applyRow(view, row, { mishap: false });
    if ( row.subTable ) await followSubTable(view, row.subTable, { depth: depth + 1 });
    return { advance: true };
}

/** An event draft: the career the table drew is compelled at the next qualification. */
async function draftNextTerm(view, row, total) {
    const line = game.i18n.format("MGT2.Chargen.Term.DraftedByEvent",
        { career: row.career || "—", n: total });
    if ( row.career ) {
        await Chargen.pushPending(view.actor, { kind: "careerForce", value: row.career,
            assignment: row.careerAssignment, entryMode: "draftedByEvent", appliesTo: ["qualification"],
            scope: "anyCareer", duration: "restOfCreation", uses: 1, note: row.text || line });
    }
    ui.notifications.info(line);
    if ( view.record ) await logTerm(view.record, view.term, { note: line });
    return { advance: true };
}

/** Core p.49's Injury table: once, or twice keeping the lower or the higher, as the row prints it. */
async function rollInjury(view) {
    const { actor, record, term } = view;
    const how = await insist([["once", game.i18n.localize("MGT2.Chargen.Term.InjuryOnce")],
        ["lower", game.i18n.localize("MGT2.Chargen.Term.InjuryLower")],
        ["higher", game.i18n.localize("MGT2.Chargen.Term.InjuryHigher")],
        ["severe", game.i18n.localize("MGT2.Chargen.Term.InjurySevere")],
        ["none", game.i18n.localize("MGT2.Chargen.Term.InjuryNone")]], "MGT2.Chargen.Term.InjuryHow");
    // A row whose injury hangs on its own check's failure names the table either way; a forfeit is no injury.
    if ( !how || (how === "none") ) return { advance: true };
    let total = 2;
    if ( how !== "severe" ) {
        const rolled = await roll(view, { step: "event", title: game.i18n.localize("MGT2.Chargen.Shared.injury"),
            formula: { lower: "2d6kl1", higher: "2d6kh1" }[how] ?? "1d6", target: null });
        if ( !rolled ) return { advance: false };
        total = rolled.total;
    }
    const effect = MGT2.InjuryEffects.find(row => row.roll === total) ?? MGT2.InjuryEffects.at(-1);
    const points = [];
    for ( const loss of effect.losses ) {
        points.push(Number.isFinite(loss) ? loss : (await new Roll(MGT2Helper.damageFormula(loss)).roll()).total);
    }
    const changes = await pickLosses(actor, { physical: points, mental: [] }, { physical: effect.keys });
    const line = game.i18n.format("MGT2.Chargen.Term.Injured", { n: total, changes: describeChanges(changes) });
    if ( Object.keys(changes).length ) {
        const log = actor.system.characteristicLog.map(entry => ({ ...entry }));
        log.push({ source: "injury", term, age: Chargen.age(actor), roll: total, changes, cost: 0, note: "" });
        await actor.update({ "system.characteristicLog": log });
    }
    if ( record ) await logTerm(record, term, { note: line });
    if ( Object.keys(changes).length && record ) await offerMedicalCare(view, changes);
    return { advance: true };
}

/** Core p.49: Cr5000 a point, less the employer's Medical Bills share on 2D + rank; the rest is a creation cost. */
async function offerMedicalCare(view, changes) {
    const { actor, record, term } = view;
    const points = Object.values(changes).reduce((sum, delta) => sum - Math.min(0, delta), 0);
    const price = points * MGT2.CharacteristicCare.perPoint;
    const take = await DialogV2.confirm({
        window: { title: "MGT2.Chargen.Term.CareTitle" },
        classes: ["mgt2"],
        content: `<p>${MGT2Helper.plural("MGT2.Chargen.Term.CareAsk", points,
            { n: points, credits: MGT2Helper.credits(price) })}</p>`,
        rejectClose: false
    });
    if ( !take ) return null;
    const bills = MGT2.MedicalBills;
    const group = bills.groups[record.system.medicalBillsRow];
    let share = 0;
    if ( group ) {
        const rolled = await roll(view, { step: "event", title: game.i18n.localize("MGT2.Chargen.Term.CareBills"),
            target: null, rows: [[game.i18n.localize("MGT2.Chargen.Term.CareRank"), Chargen.effectiveRank(record)]] });
        const column = bills.columns.filter(at => (rolled?.total ?? 0) >= at).length;
        share = column ? group[column - 1] : 0;
    }
    else ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.CareNoGroup"));
    const cost = Math.round(price * (100 - share) / 100);
    const spent = await Muster.spend(actor, cost, { note: game.i18n.localize("MGT2.Chargen.Term.CareTitle") });
    if ( spent.refused ) return null;
    const restored = Object.fromEntries(Object.entries(changes).map(([key, delta]) => [key, -delta]));
    const log = actor.system.characteristicLog.map(entry => ({ ...entry }));
    log.push({ source: "medicalCare", term, age: Chargen.age(actor), roll: null, changes: restored, cost,
        note: game.i18n.format("MGT2.Chargen.Term.CareShare", { share }) });
    await actor.update({ "system.characteristicLog": log });
    await logTerm(record, term, { note: game.i18n.format("MGT2.Chargen.Term.CarePaid",
        { credits: MGT2Helper.credits(cost), share }) });
    return cost;
}

/** Everything one event or mishap row does, each of it a field rather than a phrase. */
async function applyRow(view, row, { mishap, nested = false }) {
    const { actor, record, system, term } = view;
    const lines = [row.text].filter(text => text);

    // Ejection is a per-row fact that `neverEjects` flips for the whole template; Core p.23: the
    // event row that sends to the Mishap table decides it, not the mishap.
    const ejects = nested ? "stays" : row.ejects;
    let ejected = false;
    if ( system.neverEjects ) {
        if ( ejects !== "stays" ) lines.push(game.i18n.localize("MGT2.Chargen.Term.CannotEject"));
    }
    else if ( ejects === "ejects" ) ejected = true;
    else if ( ejects === "choice" ) {
        ejected = await DialogV2.confirm({
            window: { title: "MGT2.Chargen.Term.EjectChoice" },
            classes: ["mgt2"],
            content: `<p>${foundry.utils.escapeHTML(row.text || "")}</p>
                <p>${game.i18n.localize("MGT2.Chargen.Term.EjectChoiceHint")}</p>`,
            rejectClose: false
        }) === true;
    }

    // Three senses, now that `careerMode` says which: send the Traveller there, offer it
    // with qualification waived, or borrow its tables for a single roll without entering it.
    if ( row.career && (row.careerMode === "borrow") ) {
        lines.push(game.i18n.format("MGT2.Chargen.Term.CareerBorrowed", { career: row.career }));
    }
    else if ( row.career ) {
        const forced = row.careerMode === "force";
        await Chargen.pushPending(actor, { kind: forced ? "careerForce" : "careerOffer",
            value: row.career, assignment: row.careerAssignment, appliesTo: ["qualification"],
            scope: "namedCareer", career: row.career, duration: "restOfCreation", uses: 1, note: row.text });
        lines.push(game.i18n.format(forced ? "MGT2.Chargen.Term.CareerForced" : "MGT2.Chargen.Term.CareerOffered",
            { career: row.career }));
    }

    const provenance = { term, career: record.id, table: mishap ? "mishap" : "event" };
    const grant = async () => {
        const granted = await applyCell(actor, row.grant, { provenance });
        if ( granted.length ) lines.push(granted.join(", "));
    };
    if ( row.grantFirst ) await grant();
    // A wager's stake is set before its throw, and a stake of none is a throw not made.
    const stake = (row.benefit === "wager") ? await wagerStake(view, row) : null;
    // The row's own sub-roll (folio 11), which is no Survival or Advancement roll and takes neither's DMs.
    let subPassed = null;
    // "If you take this opportunity, roll …": declined, neither branch of the check is earned.
    const declined = (row.check.target !== null) && row.check.optional && (stake === null)
        && !(await DialogV2.confirm({ window: { title: "MGT2.Chargen.Term.CheckOptional" }, classes: ["mgt2"],
            content: `<p>${foundry.utils.escapeHTML(row.text || "")}</p>`, rejectClose: false }));
    if ( (row.check.target !== null) && (stake !== 0) && !declined ) {
        const skill = bestSkill(actor, row.check.skills);
        const sub = await roll(view, { step: mishap ? "survival" : "event",
            characteristic: row.check.characteristic, skill, target: row.check.target });
        if ( sub ) {
            subPassed = sub.passed;
            lines.push(game.i18n.localize(sub.passed
                ? "MGT2.Chargen.Term.SubRollPassed" : "MGT2.Chargen.Term.SubRollFailed"));
        }
        if ( sub && skill && row.check.raisesSkill ) {
            lines.push(...await applyCell(actor, { mode: "all", grants: [{ kind: "skill", skill, speciality: "",
                specialities: [], family: false, value: 1, mode: "raise", floor: null }] }, { provenance }));
        }
    }
    lines.push(await applyBenefit(view, row, { mishap, nested, subPassed, stake, declined }));
    if ( row.track.key && await earned({ condition: row.track.condition, kind: row.track.key }, row, subPassed, declined) ) {
        lines.push(await adjustTrack(view, row.track));
    }
    if ( !row.grantFirst ) await grant();

    // *DM+1 to one Benefit roll* modifies a roll rather than awarding one, so the row hands the
    // ledger a tray entry.
    for ( const pending of row.tray ) {
        if ( !await earned(pending, row, subPassed, declined) ) continue;
        await Chargen.pushPending(actor, { ...pending, appliesTo: [...pending.appliesTo],
            career: pending.career || (SELF_SCOPES.has(pending.scope) ? record.name : "") });
        lines.push(game.i18n.format("MGT2.Chargen.Term.Pending",
            { what: game.i18n.localize(MGT2.TrayKinds[pending.kind] ?? pending.kind) }));
    }
    if ( row.awards.outcomes.size && await earned({ condition: row.awards.condition,
        kind: [...row.awards.outcomes].map(key => game.i18n.localize(MGT2.TermOutcomes[key])).join(", ") },
    row, subPassed, declined) ) lines.push(...await applyAwards(view, row.awards));

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

/** A row's Benefit-roll effect: a wager needs the total mid-term, which is why the count is a ledger. */
async function applyBenefit(view, row, { mishap, nested, subPassed, stake, declined }) {
    const { actor, record, term } = view;
    // Core p.35, p.37 and p.41: a win pays half the stake again, rounded up, and a loss takes the stake.
    if ( row.benefit === "wager" ) {
        if ( !stake || (subPassed === null) ) return "";
        const value = subPassed ? Math.ceil(stake / 2) : -stake;
        await credit(actor, "benefitRolls", { value, career: record.id, term, note: row.text });
        return MGT2Helper.plural(subPassed ? "MGT2.Chargen.Term.WagerWon" : "MGT2.Chargen.Term.WagerLost",
            Math.abs(value), { n: Math.abs(value) });
    }
    if ( (row.benefit === "none") || ((row.benefit === "keep") && (!mishap || nested)) ) return "";
    if ( !await earned({ condition: row.benefitCondition, kind: MGT2.BenefitRowEffects[row.benefit] }, row, subPassed, declined) ) {
        return "";
    }
    const count = row.benefitFormula
        ? (await new Roll(MGT2Helper.damageFormula(row.benefitFormula)).roll()).total : row.benefitCount;
    // A term whose Survival failed loses its Benefit roll unless the row retains it, so `keep`
    // credits the roll `closeTerm` will not.
    const value = { grant: count, lose: -count, wipe: -Chargen.benefitRolls(actor, record.id), keep: 1 }[row.benefit];
    if ( !value ) return "";
    const note = { grant: "BenefitGranted", lose: "BenefitLost", wipe: "BenefitWiped", keep: "BenefitKept" }[row.benefit];
    await credit(actor, "benefitRolls", { value, career: record.id, term,
        note: row.text || game.i18n.localize(`MGT2.Chargen.Term.${note}`) });
    return "";
}

/** The Benefit rolls a player stakes: a fixed stake is taken or declined, an open one is chosen. */
async function wagerStake({ actor, record, term }, row) {
    if ( row.benefitCount > 0 ) {
        return (await DialogV2.confirm({
            window: { title: "MGT2.Chargen.Term.WagerTitle" },
            classes: ["mgt2"],
            content: `<p>${foundry.utils.escapeHTML(row.text || "")}</p><p>${MGT2Helper.plural(
                "MGT2.Chargen.Term.WagerFixed", row.benefitCount, { n: row.benefitCount })}</p>`,
            rejectClose: false
        })) ? row.benefitCount : 0;
    }
    // The term in progress still earns its own roll unless its Survival failed.
    const owed = Chargen.benefitRolls(actor, record.id) + ((logEntry(record, term).survived === false) ? 0 : 1);
    const picked = await pickOne(Array.fromRange(Math.max(0, owed) + 1).map(n => [String(n), String(n)]),
        "MGT2.Chargen.Term.WagerAsk");
    return Number(picked ?? 0);
}

/** The two scopes meaning *the career being served*: one bears on it, the other on everything else. */
const SELF_SCOPES = new Set(["thisCareer", "nextCareer"]);

/** Whether the branch that earns this tray entry was taken; a check declined earns neither. */
async function earned(entry, row, subPassed, declined = false) {
    if ( entry.condition === "always" ) return true;
    if ( declined && ["checkPassed", "checkFailed"].includes(entry.condition) ) return false;
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

/** What a row awards OUTRIGHT, with no roll — row 12 on six careers promotes or commissions. */
async function applyAwards(view, awards) {
    // The vocabulary's own order, so a commission is granted before the promotion that follows it,
    // which is the order the term's own steps run in.
    let keys = Object.keys(MGT2.TermOutcomes).filter(key => awards.outcomes.has(key));
    // An arm the Traveller cannot legally take is not an arm: "a promotion or a commission" collapses
    // to the promotion for an officer.
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
    const definition = system.tracks.find(entry => entry.key === move.key);
    const floor = definition?.monotone ? (system.track.value ?? 0) : -Infinity;
    if ( move.reroll ) {
        const rerolled = definition?.initial
            ? (await new Roll(MGT2Helper.damageFormula(definition.initial)).roll()).total
            : (system.track.value ?? 0);
        await record.update({ "system.track.value": clampTrack(Math.max(rerolled, floor), system.track.cap) });
        return game.i18n.format("MGT2.Chargen.Term.TrackReroll", { track: move.key, value: rerolled });
    }
    const delta = move.formula
        ? (await new Roll(MGT2Helper.damageFormula(move.formula)).roll()).total : move.value;
    const value = clampTrack(Math.max((system.track.value ?? 0) + delta, floor), system.track.cap);
    const adjustments = system.track.adjustments.map(entry => ({ ...entry }));
    adjustments.push({ value: delta, term, note: game.i18n.localize("MGT2.Chargen.Term.TrackMoved") });
    await record.update({ "system.track.value": value, "system.track.adjustments": adjustments });
    return game.i18n.format("MGT2.Chargen.Term.TrackAdjusted",
        { track: move.key, dm: MGT2Helper.signed(delta), value });
}

function clampTrack(value, cap) {
    return (cap === null) ? value : Math.min(value, cap);
}

/** The commission, whose field replaced *"this only applies to the military careers of Army, Navy and Marines"*. */
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
    if ( await prohibits(actor, "commission", record.name) ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.Prohibited", { career: record.name, name: actor.name }));
        return { advance: true };
    }

    const gate = MGT2.CommissionGate;
    // Terms served BEFORE this one: `qualify` has already logged the term in progress, so `termLog.length`
    // would read 1 in the first term and refuse the only term folio 19 allows.
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
    // Folio 19: "Some events give a bonus DM to advancement rolls or grant automatic advancement.
    // You can apply these DMs to commission rolls also."
    if ( await useAutoSuccess(view, ["commission", "advancement"]) ) {
        await logTerm(record, term, { note: await commissionRecord(view) });
        return { advance: true };
    }
    const lent = await lendAdvancementDMs(view);
    const rolled = await roll(view, {
        check: "commission", step: "commission",
        characteristic: Chargen.stepCheck(view.actor, "commission")?.characteristic || system.commissionCheck.characteristic,
        target: system.commissionCheck.target,
        rows: [...(served ? [[game.i18n.format("MGT2.Chargen.Term.CommissionLater", { n: served }),
            gate.laterTermDM * served]] : []), ...lent.map(entry => [entry.note || game.i18n.localize(
            "MGT2.Chargen.Roll.Pending"), entry.dm])]
    });
    if ( !rolled ) return { advance: false };
    for ( const entry of lent.filter(one => one.duration === "oneShot") ) {
        await Chargen.spendEntry(actor, one => (one.kind === "dm") && (one.dm === entry.dm) && (one.note === entry.note));
    }
    if ( !rolled.passed ) {
        await logTerm(record, term, { note: game.i18n.localize("MGT2.Chargen.Term.CommissionFailed") });
        return { advance: true };
    }

    await logTerm(record, term, { note: await commissionRecord(view) });
    return { advance: true };
}

/** Core p.37's "you automatically pass your next promotion or commission roll", used when the holder says so. */
async function useAutoSuccess(view, checks) {
    const { actor, record } = view;
    const entry = checks.flatMap(check => Chargen.pending(actor, check, record.name))
        .find(one => one.kind === "autoSuccess");
    if ( !entry ) return false;
    const use = await DialogV2.confirm({
        window: { title: "MGT2.Chargen.TrayKinds.autoSuccess" },
        classes: ["mgt2"],
        content: `<p>${foundry.utils.escapeHTML(entry.note || "")}</p>
            <p>${game.i18n.localize("MGT2.Chargen.Term.AutoSuccessAsk")}</p>`,
        rejectClose: false
    });
    if ( !use ) return false;
    await Chargen.spendEntry(actor, one => (one.kind === "autoSuccess") && (one.note === entry.note));
    return true;
}

/** The event DMs held for an advancement roll, lent to this commission roll where the holder chooses. */
async function lendAdvancementDMs({ actor, record }) {
    const offered = Chargen.pending(actor, "advancement", record.name).filter(entry => (entry.kind === "dm")
        && entry.dm && entry.appliesTo.size && !entry.appliesTo.has("commission"));
    if ( !offered.length ) return [];
    const lines = offered.map(entry =>
        `<li>${foundry.utils.escapeHTML(entry.note || "")} ${MGT2Helper.signed(entry.dm)}</li>`).join("");
    const lend = await DialogV2.confirm({
        window: { title: "MGT2.Chargen.Steps.commission" },
        classes: ["mgt2"],
        content: `<p>${game.i18n.localize("MGT2.Chargen.Term.LendAsk")}</p><ul>${lines}</ul>`,
        rejectClose: false
    });
    return lend ? offered : [];
}

/** The commission itself, reached by the roll above and by a row that awards one outright. */
async function commissionRecord(view) {
    const { record, system, assignment, term } = view;
    const ladder = assignment?.officerLadder || system.ladder;
    await record.update({ "system.enlistedRank": system.rank, "system.ladder": ladder, "system.rank": 1 });
    await logTerm(record, term, { outcomes: ["commissioned"] });
    await applyRankBonus(view, ladder, 1);
    return game.i18n.localize("MGT2.Chargen.Term.Commissioned");
}

/** Advancement, three outcomes on one roll (folio 18): a promotion, a total at or under terms served, a natural 12. */
async function advance(view) {
    const { record, system, assignment, term } = view;
    if ( !record ) return needCareer();
    const entry = logEntry(record, term);
    if ( entry.outcomes.has("advanced") || entry.outcomes.has("forcedOut") ) return { advance: true };
    // Core p.19: "If you gain a commission, you may not roll for advancement in the same term."
    if ( entry.outcomes.has("commissioned") ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoAdvanceAfterCommission"));
        return { advance: true };
    }
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
    if ( await prohibits(view.actor, "advancement", record.name) ) {
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.Prohibited",
            { career: record.name, name: view.actor.name }));
        return { advance: true };
    }
    if ( await useAutoSuccess(view, ["advancement"]) ) {
        await logTerm(record, term, { note: await promote(view) });
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
            lines.push(MGT2Helper.plural("MGT2.Chargen.Term.ForcedOut", served));
        }
        if ( rolled.natural === 12 ) {
            outcomes.push("mustContinue");
            lines.push(game.i18n.localize("MGT2.Chargen.Term.MustContinue"));
        }
    }
    await logTerm(record, term, { outcomes, note: lines.filter(line => line).join(" · ") });
    return { advance: true };
}

/** A promotion: the next rung, the extra skill roll folio 18 attaches to it, and the ladder's own bonus row. */
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

/** Whether a commission is still to be gained: the career prints one and the record is not an officer (folio 19). */
function commissionAvailable({ system, assignment }) {
    if ( !system.commission ) return false;
    return !(system.enlistedRank
        || (assignment?.officerLadder && (system.ladder === assignment.officerLadder)));
}

/** A ladder row's bonus, paid the moment its rank is reached. */
async function applyRankBonus(view, ladder, rank) {
    const { actor, record, system, term } = view;
    const row = (system.rankLadders.find(entry => entry.id === ladder)?.rows ?? [])
        .find(entry => entry.rank === rank);
    if ( !row?.bonus ) return [];
    return applyCell(actor, row.bonus, { provenance: { term, career: record.id, table: "rank" } });
}

/** The skill roll: one per term plus one per successful advancement, spent from the ledger. */
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
        { provenance: { term, career: record.id, table: picked }, rolled: true });
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

/** Ageing: `2D` with the Traveller's own ageing law as its DM, an index into Core p.49's eight rows. */
async function ageing(view) {
    const { actor, record, term } = view;
    const kind = termKind(view);
    if ( kind && !kind.ages ) return { advance: true };
    if ( record && logEntry(record, term).outcomes.has("aged") ) return { advance: true };
    if ( !Chargen.ageingDue(actor) ) {
        ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.NoAgeingYet"));
        return { advance: true };
    }
    return ageNow(view);
}

/** One roll on Core p.49's table: the one owed at a term's end, or the one stopping anagathics forces at once. */
async function ageNow(view, { forced = false } = {}) {
    const { actor, record, term } = view;
    const law = Chargen.law(actor, Chargen.frame(actor)?.system.ageing);
    const defaults = MGT2.CreationDefaults;
    const terms = Chargen.termsServed(actor, { open: !forced });
    // The law is an EXPRESSION and not a switch: the published values run -1, -2, -1/2, +1 and ±1
    // by sex.
    const dm = Math.trunc(((law ? law.perTerm : defaults.ageingPerTerm) * terms)
        + (law ? law.flat : defaults.ageingFlat));
    const since = anagathicsSince(actor);
    const rows = dm ? [[game.i18n.format("MGT2.Chargen.Term.AgeingDM", { n: terms }), dm]] : [];
    if ( since !== null ) rows.push([game.i18n.localize("MGT2.Chargen.Term.AnagathicsDM"), term - since + 1]);
    // Target 1 because the table's top row IS "1+, no effect": the pass line is the book's own.
    const rolled = await roll(view, { step: "ageing", target: 1, rows });
    if ( !rolled ) return { advance: false };

    const row = ageingRow(rolled.total);
    if ( !row ) {
        ui.notifications.warn(game.i18n.format("MGT2.Chargen.Term.AgeingNoRow", { n: rolled.total }));
        return { advance: true };
    }
    const changes = await pickLosses(actor, row);
    if ( Object.keys(changes).length ) {
        const log = actor.system.characteristicLog.map(entry => ({ ...entry }));
        log.push({ source: "ageing", term, age: Chargen.age(actor), roll: rolled.total, changes,
            cost: 0, note: "" });
        await actor.update({ "system.characteristicLog": log });
    }
    if ( record ) {
        await logTerm(record, term, { outcomes: forced ? [] : ["aged"],
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

/** The table stops at -6 while its DM is every term served, so -7 has neither a row nor a printed floor. */
function ageingRow(total) {
    const rows = MGT2.AgeingEffects;
    if ( total >= rows.at(-1).roll ) return rows.at(-1);
    return rows.find(row => row.roll === total)
        ?? (Rules.on("ageingTableFloor") ? rows[0] : null);
}

/** One select per loss, on distinct characteristics (Core p.49); the roll is made, so the picker insists. */
async function pickLosses(actor, row, narrowed = {}) {
    const kinds = { physical: narrowed.physical ?? MGT2.PhysicalCharacteristics, mental: mentalCharacteristics(actor) };
    const groups = Object.entries(kinds).flatMap(([kind, keys]) => row[kind].map((points, index) =>
        ({ kind, points, keys, chosen: keys[index] ?? keys[0] }))).filter(group => group.keys.length);
    if ( !groups.length ) return {};
    for ( ;; ) {
        const fields = groups.map((group, index) => {
            const options = group.keys.map(key => `<option value="${key}"${(key === group.chosen) ? " selected" : ""}>`
                + `${game.i18n.localize(MGT2.Characteristics[key])}</option>`).join("");
            return `<div class="form-group"><label>${game.i18n.format("MGT2.Chargen.Term.LosePoints",
                { n: group.points })}</label><select name="g${index}">${options}</select></div>`;
        }).join("");
        const picked = await DialogV2.prompt({
            window: { title: "MGT2.Chargen.Steps.ageing" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.localize("MGT2.Chargen.Term.AgeingChoose")}</p>${fields}`,
            ok: { label: "MGT2.Chargen.Term.Apply",
                callback: (event, button) => groups.map((group, index) => button.form.elements[`g${index}`].value) },
            rejectClose: false
        });
        if ( picked ) picked.forEach((key, index) => { groups[index].chosen = key; });
        const twice = groups.some((group, index) => groups.findIndex(other =>
            (other.kind === group.kind) && (other.chosen === group.chosen)) !== index);
        if ( picked && !twice ) break;
        ui.notifications.warn(game.i18n.localize(picked ? "MGT2.Chargen.Term.AgeingDistinct" : "MGT2.Chargen.Term.AgeingOwed"));
    }
    const changes = {};
    for ( const group of groups ) changes[group.chosen] = (changes[group.chosen] ?? 0) - group.points;
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
async function decide(view, key) {
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
    // The maximum-terms cap is the table's ceiling, not an outcome of this term: it takes another term
    // away without making the ending a forced one.
    const cap = CreationOptions.maximumTerms();
    const capped = (cap > 0) && (Chargen.termsServed(actor, { open: true }) >= cap);
    if ( capped ) ui.notifications.info(MGT2Helper.plural("MGT2.Chargen.Term.MaximumTerms", cap));
    // Core p.45's "you may not re-enlist", and a career compelled elsewhere next term, end this one.
    const tray = Chargen.read(actor).tray;
    const here = name => !name || (MGT2Helper.skillSlug(name) === MGT2Helper.skillSlug(record.name));
    const blocked = tray.some(one => (one.kind === "careerBlock") && here(one.career || one.value))
        || tray.some(one => (one.kind === "careerForce") && (one.value ? !here(one.value)
            : (system.qualification.entry !== "forcedOnly")));
    // Core p.52: a sentence the advancement roll has not ended cannot be left.
    const held = !!system.exitRule.track && (system.exitRule.track === system.track.key);
    if ( blocked ) ui.notifications.info(game.i18n.format("MGT2.Chargen.Term.Blocked", { career: record.name }));
    const done = forced || capped || blocked;
    // The book's own two groups leave one career in neither, hence the fourth value.
    const changeRule = system.assignmentChange || Rules.get("undeclaredAssignmentChange");
    const short = done ? null : Chargen.changeBarred(actor, record);
    const buttons = [];
    if ( !done || held ) buttons.push({ action: "stay", label: "MGT2.Chargen.Term.Continue", default: true });
    if ( (!done || held) && (system.assignments.length > 1) && !(short && (changeRule !== "free")) ) {
        buttons.push({ action: "assignment",
            label: game.i18n.format("MGT2.Chargen.Term.ChangeAssignment",
                { rule: game.i18n.localize(MGT2.AssignmentChangeRules[changeRule]) }) });
    }
    if ( !held ) buttons.push({ action: "leave", label: "MGT2.Chargen.Term.LeaveCareer", default: done });

    // The strip runs any step at any moment, so a term can arrive here with steps unresolved. Say
    // which, because closing the term buys its four years and its Benefit roll either way.
    const sequence = ChargenTerm.sequence(actor);
    const missed = sequence.slice(0, sequence.indexOf(key))
        .filter(step => !entry.steps.has(step))
        .map(step => game.i18n.localize(MGT2.CreationSteps[step] ?? step));
    const warning = missed.length
        ? `<p class="skipped">${game.i18n.format("MGT2.Chargen.Term.DecideSkipped",
            { steps: missed.join(", ") })}</p>` : "";

    const choice = await DialogV2.wait({
        window: { title: "MGT2.Chargen.Steps.decide" },
        classes: ["mgt2"],
        content: `<p>${MGT2Helper.plural("MGT2.Chargen.Term.DecideHint",
            system.termLog.length, { career: record.name })}</p>${short ? `<p class="hint">${MGT2Helper.plural(
            "MGT2.Chargen.Term.MinimumTerms", short.minimum, { species: Chargen.frame(actor).name })}</p>` : ""}${warning}`,
        buttons, rejectClose: false
    });
    if ( !choice ) return { advance: false };

    const changed = (choice === "assignment") ? await changeAssignment(view, changeRule) : null;
    if ( (choice === "leave") || changed ) {
        await ChargenTerm.closeTerm(actor,
            { exitMode: forced ? "forcedOutByAdvancement" : (blocked ? "blocked" : "voluntary") });
        if ( blocked ) await Chargen.spendEntry(actor, one => (one.kind === "careerBlock") && here(one.career || one.value));
        // Core p.20: for these careers a new assignment is a new career — the next term qualifies for it.
        if ( changed ) await actor.createEmbeddedDocuments("Item", [changed]);
        return { advance: true };
    }
    await ChargenTerm.closeTerm(actor);
    return { advance: true };
}

/** Changing assignment, whose behaviour is a field with four values. @returns {Promise<object|null>} A new career's record */
async function changeAssignment(view, rule) {
    const { actor, record, system } = view;
    const picked = await pickOne(system.assignments
        .filter(entry => entry.name !== system.assignment).map(entry => [entry.name, entry.name]),
    "MGT2.Chargen.Term.PickAssignment");
    if ( picked === null ) return null;

    if ( rule === "free" ) {
        await record.update({ "system.assignment": picked, "system.ladder": ladderAfter(view, picked) });
        return null;
    }
    if ( rule === "requalifyKeepRank" ) {
        const rolled = await roll(view, { check: "qualification", step: "qualify",
            characteristic: bestCharacteristic(actor, system.qualification.characteristics),
            target: system.difficulty });
        // Succeed and you adopt the new assignment KEEPING your rank; fail and you simply continue
        // in the old one, without penalty (folio 20).
        if ( rolled?.passed ) {
            await record.update({ "system.assignment": picked, "system.ladder": ladderAfter(view, picked),
                "system.entryMode": "assignmentChange" });
        }
        else if ( rolled ) ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.AssignmentKept"));
        return null;
    }
    ui.notifications.info(game.i18n.localize("MGT2.Chargen.Term.AssignmentNewCareer"));
    const data = record.toObject();
    delete data._id;
    Object.assign(data.system, { assignment: picked, entryMode: "assignmentChange", exitMode: "stillServing",
        terms: 0, rank: 0, enlistedRank: 0, ladder: "", events: [], termLog: [],
        track: { key: "", value: null, cap: null, adjustments: [] } });
    return data;
}

/** The ladder a new assignment puts the record on: its officer ladder once commissioned, else its own. */
function ladderAfter({ system }, name) {
    const next = system.assignments.find(entry => entry.name === name);
    const officer = system.rankLadders.find(entry => entry.id === system.ladder)?.officer;
    return (officer ? next?.officerLadder : next?.ladder) || system.ladder;
}

/** A step the frame declares and no procedure here covers — the nest, the status, the continuation check. */
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
    const indexes = check.kind === "index";
    const arms = indexes ? [row?.award] : [rolled.passed ? check.onPass : check.onFail, row?.award];
    const lines = [];
    if ( indexes ) {
        const read = game.i18n.format("MGT2.Chargen.Term.ReadOnTable", { step: label, total: rolled.total });
        ui.notifications.info(read);
        lines.push(read);
    }
    for ( const arm of arms ) lines.push(...await applyStepOutcome(view, arm, key));
    const note = [label, ...lines].filter(line => line).join(" · ");
    if ( view.record ) await logTerm(view.record, view.term, { note });
    return { advance: true };
}

/** Enough of a check to roll: a named term, and a target the ladder or the line supplies. */
function checkRolls(check) {
    if ( !(check.characteristic || check.skills.length) ) return false;
    // A check that indexes a table has a total to read and needs no target at all.
    return (check.kind === "index") || (check.target !== null) || (check.ladder.length > 0);
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
        else if ( moved ) {
            lines.push(game.i18n.format(moved.held
                ? "MGT2.Chargen.Term.TrackHeld" : "MGT2.Chargen.Term.TrackAtCap", { track: moved.label }));
        }
    }
    const granted = await applyCell(actor, arm.grant,
        { provenance: { term, career: record?.id ?? "", table: key } });
    if ( granted.length ) lines.push(granted.join(", "));
    if ( arm.outcomes.size && record ) {
        lines.push(...await applyAwards(view, { outcomes: arm.outcomes, mode: "all", optional: false }));
    }

    // Ejection is the same fact here as on a row, and a career that cannot eject cannot be left by a
    // species' own check either.
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

/** Core p.16: the skills an education names — picks from its own tables or its tied career's — and its grant. */
async function educationSkills(view) {
    const { actor, record, system, term } = view;
    if ( !record ) return needCareer();
    if ( logEntry(record, term).outcomes.has("basicTraining") ) return { advance: true };
    const gained = await applyPicks(view, system.preCareer.picks);
    const granted = await applyCell(actor, system.preCareer.grant,
        { provenance: { term, career: record.id, table: "education" } });
    await record.update({ "system.gained": [...new Set([...record.system.gained, ...skillsNamed(actor, [...gained, ...granted])])] });
    await logTerm(record, term, { outcomes: ["basicTraining"], note: game.i18n.format("MGT2.Chargen.Education.Skills",
        { skills: [...gained, ...granted].join(", ") || "—" }) });
    return { advance: true };
}

/** Each pick: every row of a table, or so many chosen or rolled, from this record or the career it is tied to. */
async function applyPicks(view, picks) {
    const { actor, record, system, term } = view;
    const tied = picks.some(pick => pick.tied) ? await CareerLibrary.find(system.preCareer.tied, { kinds: ["career"] }) : null;
    const taken = new Set();
    const applied = [];
    for ( const pick of picks ) {
        const source = pick.tied ? tied?.system : system;
        if ( !source ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Education.NoTied", { career: system.preCareer.tied || "—" }));
            continue;
        }
        const assignment = source.assignments.find(entry =>
            MGT2Helper.skillSlug(entry.name) === MGT2Helper.skillSlug(record.system.assignment));
        const rows = (pick.table === "assignment") ? (assignment?.skills ?? []) : (source.tables[pick.table]?.rows ?? []);
        const open = rows.map((row, index) => [`${pick.tied}.${pick.table}.${index}`, row]).filter(([key]) => !taken.has(key));
        const chosen = [];
        for ( let n = 0; (pick.count ? (n < pick.count) : (n < open.length)) && open.length; n++ ) {
            if ( !pick.count ) { chosen.push(open[n]); continue; }
            const left = open.filter(one => !chosen.includes(one));
            if ( !left.length ) break;
            if ( pick.random ) {
                const rolled = await roll(view, { step: "basic", formula: `1d${rows.length}`, target: null });
                const hit = rolled && open.find(([key]) => key === `${pick.tied}.${pick.table}.${rolled.total - 1}`);
                if ( hit ) chosen.push(hit);
                continue;
            }
            const picked = await pickOne(left.map(([key, row]) => [key, cellLabel(row)]), (pick.level === null)
                ? "MGT2.Chargen.Education.PickSkill" : game.i18n.format("MGT2.Chargen.Education.PickAtLevel", { n: pick.level }));
            if ( picked === null ) break;
            chosen.push(left.find(([key]) => key === picked));
        }
        for ( const [key, row] of chosen ) {
            taken.add(key);
            applied.push(...await applyCell(actor, row,
                { level: pick.level, provenance: { term, career: record.id, table: "education" } }));
        }
    }
    return applied;
}

/** The skill Items the labels of a grant name, which is what graduation later raises. */
function skillsNamed(actor, labels) {
    const held = new Set(Grants.skills(actor).map(skill => skill.name));
    return labels.map(label => String(label).replace(/\s+\d+$/, "")).filter(name => held.has(name));
}

/** Core p.17: an education's term rolls the shared Pre-career Events table, unless the template prints its own. */
async function educationEvent(view) {
    if ( !view.record ) return needCareer();
    if ( view.system.eventTable.length ) return rollTable(view, "event");
    return followSubTable(view, "", { fallback: "preCareerEvents" });
}

/**
 * Core p.16-17's graduation: a pass, honours on top at its threshold, and a failure's arm above the
 * floor ("so long as they did not roll 2 or less"); an event's "you fail to graduate" is that failure.
 */
async function graduate(view) {
    const { actor, record, system, term } = view;
    if ( !record ) return needCareer();
    const entry = logEntry(record, term);
    if ( entry.outcomes.has("graduated") ) return { advance: true };
    const rule = system.preCareer.graduation;
    // A ruling: no roll is a failure above the floor, so the cadet an event kept back may still enlist.
    const barred = await prohibits(actor, "graduation", record.name);
    let total = null;
    let passed = false;
    if ( !barred && (rule.target !== null) ) {
        const rows = rule.conditionalDMs.filter(row => row.dm && row.characteristic && (row.min !== null)
            && ((actor.system.characteristics[row.characteristic]?.value ?? 0) >= row.min))
            .map(row => [game.i18n.format("MGT2.Chargen.Term.ConditionalCharacteristic", {
                characteristic: game.i18n.localize(MGT2.Characteristics[row.characteristic]), min: row.min }), row.dm]);
        const rolled = await roll(view, { check: "graduation", step: "advance", characteristic: rule.characteristic,
            target: rule.target, rows, title: game.i18n.localize("MGT2.Chargen.Education.Graduation") });
        if ( !rolled ) return { advance: false };
        total = rolled.total;
        passed = rolled.passed;
    }
    const honours = passed && (rule.honoursAt !== null) && (total >= rule.honoursAt);
    const floored = !passed && (total !== null) && (rule.failFloor !== null) && (total <= rule.failFloor);
    const arms = passed ? [rule.pass, ...(honours ? [rule.honours] : [])] : (floored ? [] : [rule.fail]);
    const lines = [game.i18n.localize(honours ? "MGT2.Chargen.Education.Honours"
        : (passed ? "MGT2.Chargen.Education.Graduated" : "MGT2.Chargen.Education.NotGraduated"))];
    for ( const arm of arms ) lines.push(...await applyArm(view, arm));
    await logTerm(record, term, { outcomes: [...(passed ? ["graduated"] : []), ...(honours ? ["honours"] : [])],
        note: lines.filter(line => line).join(" · ") });
    return { advance: true };
}

/** One graduation arm: its grant, its picks, the raise of what education gained, and what it leaves on the tray. */
async function applyArm(view, arm) {
    const { actor, record, system, term } = view;
    const tied = system.preCareer.tied;
    const lines = [...await applyCell(actor, arm.grant, { provenance: { term, career: record.id, table: "graduation" } })];
    lines.push(...await applyPicks(view, arm.picks));
    lines.push(...await raiseGained(view, arm.raise));
    const kinds = new Map();
    for ( const entry of arm.tray ) {
        const names = ["careerOffer", "careerForce", "careerBlock", "unlock"].includes(entry.kind);
        await Chargen.pushPending(actor, { ...entry, appliesTo: [...entry.appliesTo],
            value: entry.value || (names ? tied : ""),
            career: entry.career || ((entry.scope === "namedCareer") ? tied : "") });
        kinds.set(entry.kind, (kinds.get(entry.kind) ?? 0) + 1);
    }
    for ( const [kind, count] of kinds ) {
        const what = game.i18n.localize(MGT2.TrayKinds[kind] ?? kind);
        lines.push(game.i18n.format("MGT2.Chargen.Term.Pending", { what: (count > 1) ? `${what} ×${count}` : what }));
    }
    return lines;
}

/** "Increase both of the skills chosen before by one level" — the skills this education gained, raised. */
async function raiseGained({ actor, record, term }, { count, by, below }) {
    if ( !by ) return [];
    const names = new Set(record.system.gained);
    let eligible = Grants.skills(actor).filter(skill => names.has(skill.name)
        && ((below === null) || ((skill.system.level ?? 0) < below)));
    if ( count && (eligible.length > count) ) {
        const chosen = [];
        for ( let n = 0; n < count; n++ ) {
            const picked = await pickOne(eligible.filter(one => !chosen.includes(one))
                .map(skill => [skill.id, `${skill.name} ${skill.system.level ?? 0}`]), "MGT2.Chargen.Education.PickRaise");
            if ( picked === null ) break;
            chosen.push(eligible.find(skill => skill.id === picked));
        }
        eligible = chosen;
    }
    const lines = [];
    for ( const skill of eligible ) {
        const speciality = skill.system.skill?.speciality ?? "";
        const written = await Grants.grantSkill(actor, { name: speciality ? skill.name.replace(/\s*\([^)]*\)\s*$/, "") : skill.name,
            speciality, level: by, mode: "raise", provenance: { term, career: record.id, table: "graduation" } });
        if ( written ) lines.push(`${written.item.name} ${written.to}`);
    }
    return lines;
}

/** An education lasts its one term: the decision closes it, graduated or not, and the next term is a career's. */
async function leaveEducation(view) {
    const { actor, record, term } = view;
    const graduated = !!record && logEntry(record, term).outcomes.has("graduated");
    await ChargenTerm.closeTerm(actor, record ? { exitMode: graduated ? "graduated" : "voluntary" } : {});
    return { advance: true };
}

/** A step education does not have (Core p.16): taken, and nothing rolled. */
function noEducationStep() {
    return { advance: true };
}

function needCareer() {
    ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Term.NoCareer"));
    return { advance: false };
}

const STEPS = Object.freeze({
    elect, qualify, basic, survival, event, commission, advance, skill, ageing, decide
});

/** The steps an education runs its own way (Core p.16-17); `qualify` and `ageing` are shared. */
const EDUCATION = Object.freeze({
    elect: noEducationStep, basic: educationSkills, survival: noEducationStep, event: educationEvent,
    commission: noEducationStep, advance: graduate, skill: noEducationStep, decide: leaveEducation
});

/** What an ejecting mishap costs: *"if still in the career after Survival, roll on the Events table"*. */
const SURVIVAL_SKIPS = Object.freeze(["event", "commission", "advance"]);

/** The endings no one chooses, read off the term's own facts and in the order they displace each other. */
const FORCED_EXITS = Object.freeze([["ejected", "ejectedByMishap"], ["released", "paroled"]]);

/** The one sub-table a record carries itself; every other name addresses the shared block. */
const OWN_MISHAP_TABLE = "mishap";

/** The entry modes a draft writes, which open a career the rules otherwise close. */
const DRAFTED = Object.freeze(["drafted", "draftedByEvent"]);

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
    rows = [], formula = "", title = "" } = {}) {
    const { actor, record } = view;
    const composed = CreationRoll.compose(actor, {
        characteristic, skill: named, check, career: record?.name, target, rows });
    // A table roll indexes rather than passes: 1D on a Mishap table, 2D on an Events table.
    if ( formula ) composed.formula = [formula, ...composed.parts].join("");

    const label = title || game.i18n.localize(MGT2.CreationSteps[step] ?? step);
    const posted = await CreationRoll.post(actor, composed, {
        label: record ? `${label} · ${record.name}` : label, target });
    if ( !posted ) return null;

    const total = posted.outcome.roll.total;
    if ( target !== null ) await Chargen.spendPending(actor, check, record?.name);
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
export async function applyCell(actor, cell, { level = null, provenance = {}, rolled = false } = {}) {
    if ( !cell ) return [];
    let grants = cell.grants ?? [];
    if ( !grants.length ) return cell.text ? [cell.text] : [];
    if ( (cell.mode === "oneOf") && (grants.length > 1) ) {
        const picked = await insist(grants.map((grant, index) => [String(index), grantLabel(grant)]),
            "MGT2.Chargen.Term.PickGrant");
        if ( picked === null ) return [game.i18n.localize("MGT2.Chargen.Term.AwardForfeited")];
        grants = [grants[Number(picked)]];
    }
    const applied = [];
    for ( const grant of grants ) {
        const line = await applyGrant(actor, grant, { level, provenance, rolled });
        if ( line ) applied.push(line);
    }
    return applied;
}

async function applyGrant(actor, grant, { level, provenance, rolled }) {
    if ( grant.kind === "skill" ) {
        const named = await resolveSkill(grant);
        if ( !named ) return "";
        // Core p.229: a talent a Psion does not yet hold, rolled on a skill table, is a roll to learn it.
        const talent = rolled ? Psionics.talentFor(named.name) : null;
        if ( talent && !Psionics.ladder(actor).rows.find(row => row.key === talent.key)?.held ) {
            const learned = await Psionics.learn(actor, talent.key);
            return game.i18n.format(learned?.passed ? "MGT2.Chargen.Term.TalentLearned"
                : "MGT2.Chargen.Term.TalentMissed", { talent: talent.skills[0] });
        }
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
    if ( grant.kind === "characteristic" ) {
        const value = grant.formula ? (await new Roll(MGT2Helper.damageFormula(grant.formula)).roll()).total : grant.value;
        return Grants.grantCharacteristic(actor, { ...grant, value }, provenance);
    }
    if ( (grant.kind === "cash") || (grant.kind === "shipShare") ) return grantFinance(actor, grant, provenance);
    if ( grant.kind === "contact" ) {
        const count = grant.formula
            ? (await new Roll(MGT2Helper.damageFormula(grant.formula)).roll()).total : grant.value;
        const relation = grant.relation || "Contact";
        for ( let i = 0; i < count; i++ ) await Grants.contact(actor, { relation, provenance });
        return `${game.i18n.localize(MGT2.ContactRelations[relation])} ×${count}`;
    }
    if ( grant.kind === "convert" ) return convertAssociate(actor, grant, provenance);
    if ( grant.kind === "benefit" ) {
        const row = await Muster.take(actor, Muster.fromRef(grant.ref, { provenance }), { spend: false });
        return Muster.label(row);
    }
    // A bare note is the referee's to resolve: the system has no catalogue and never will.
    return grantLabel(grant);
}

/**
 * Core p.20: *"One of your Contacts or Allies betrays you… That Contact or Ally becomes a Rival or
 * Enemy. If you have no Contacts or Allies, then you are betrayed by someone you never saw coming
 * and still gain a Rival or Enemy."* The fallback is printed, so an empty list is not a refusal.
 */
async function convertAssociate(actor, grant, provenance) {
    const relation = grant.relation || "Rival";
    const friends = actor.items.filter(item => (item.type === "contact")
        && MGT2.CreationLimits.convertibleRelations.includes(item.system.relation));
    if ( !friends.length ) {
        const made = await Grants.contact(actor, { relation, provenance,
            name: game.i18n.localize("MGT2.Chargen.Term.Unseen") });
        return made ? `${game.i18n.localize(MGT2.ContactRelations[relation])} · ${made.name}` : "";
    }
    const picked = await pickOne(friends.map(item => [item.id, item.name]),
        "MGT2.Chargen.Term.PickAssociate");
    const turned = picked === null ? null : actor.items.get(picked);
    if ( !turned ) return "";
    await Grants.convert(turned, relation, provenance.table ?? "");
    return `${turned.name} → ${game.i18n.localize(MGT2.ContactRelations[relation])}`;
}

async function grantFinance(actor, grant, provenance = {}) {
    const amount = grant.formula
        ? (await new Roll(MGT2Helper.damageFormula(grant.formula)).roll()).total : grant.value;
    if ( !amount ) return "";
    const key = (grant.kind === "cash") ? "credits" : "shipShares";
    // A negative cash grant is a COST, and creation produces no cash before mustering out: `spend`
    // pays what there is, carries the rest as debt, and refuses outright where the rule says so.
    if ( (grant.kind === "cash") && (amount < 0) ) {
        const spent = await Muster.spend(actor, -amount, { note: provenance.table ?? "" });
        if ( spent.refused ) return "";
        return `${game.i18n.localize(MGT2.CreationGrantKinds.cash)} ${MGT2Helper.signed(amount)}`
            + (spent.owed ? ` · ${game.i18n.format("MGT2.Chargen.Muster.Owed",
                { credits: MGT2Helper.credits(spent.owed) })}` : "");
    }
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
    if ( grant.kind === "benefit" ) return Muster.label(Muster.fromRef(grant.ref));
    if ( grant.relation ) return game.i18n.localize(MGT2.ContactRelations[grant.relation]);
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

/** What a term yields, selected by TERM NUMBER; a row with neither bound set is the catch-all. */
function termKind(view) {
    return (Chargen.frame(view.actor)?.system.frame.termKinds ?? []).find(entry =>
        (!entry.fromTerm || (view.term >= entry.fromTerm))
        && (!entry.toTerm || (view.term <= entry.toTerm))) ?? null;
}

/** The term log row for one term, present or not — the reader, never the writer. */
function logEntry(record, term) {
    return record?.system.termLog.find(entry => entry.term === term)
        ?? { term, years: null, ages: true, survived: null, ejected: false, closed: false, kind: "",
            outcomes: new Set(), steps: new Set(), note: "" };
}

/** Upsert one term of the log, where every step writes its outcome the moment it is decided. */
async function logTerm(record, term, patch) {
    const log = record.system.termLog.map(entry =>
        ({ ...entry, outcomes: [...entry.outcomes], steps: [...entry.steps] }));
    let row = log.find(entry => entry.term === term);
    if ( !row ) {
        row = { term, years: null, ages: true, survived: null, ejected: false, closed: false,
            kind: "", outcomes: [], steps: [], note: "" };
        log.push(row);
    }
    const outcomes = new Set([...row.outcomes, ...(patch.outcomes ?? [])]);
    const steps = new Set([...row.steps, ...(patch.steps ?? [])]);
    const note = patch.note ? [row.note, patch.note].filter(text => text).join(" · ") : row.note;
    Object.assign(row, patch, { outcomes: [...outcomes], steps: [...steps], note });
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

/** The career served before this one, which is the one a term-order rule reads. @returns {Item|null} */
function previousRecord({ actor, record }) {
    return Chargen.careers(actor).filter(career => career !== record).at(-1) ?? null;
}

/** Whether the Traveller left a career last term, which folio 18 closes to them for one term. */
function leftLastTerm(view) {
    const previous = previousRecord(view);
    if ( !previous || (previous.system.exitMode === "stillServing") ) return false;
    return namesThisCareer(view.record, [previous.name, previous._stats?.compendiumSource ?? ""]);
}

/** Whether a referee-typed list of template ids names this record. */
function namesThisCareer(record, ids) {
    if ( !record ) return false;
    const source = record._stats?.compendiumSource ?? "";
    return (ids ?? []).filter(id => id).some(id =>
        (id === record.name) || (id === record.id) || (id === source)
        || (!!source && source.endsWith(`.${id}`)));
}

/**
 * The rest of the row is written by the time this picker opens, so closing it cannot rewind the
 * step: a forfeit is confirmed out loud and goes to the term log.
 * @returns {Promise<string|null>}   Null only where the player confirmed the forfeit
 */
async function insist(options, title) {
    for ( ;; ) {
        const picked = await pickOne(options, title);
        if ( picked !== null ) return picked;
        const forfeit = await DialogV2.confirm({
            window: { title },
            classes: ["mgt2"],
            content: `<p>${game.i18n.localize("MGT2.Chargen.Term.ForfeitAsk")}</p>`,
            rejectClose: false
        });
        if ( forfeit ) return null;
    }
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
