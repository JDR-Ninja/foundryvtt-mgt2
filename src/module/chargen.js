import { MGT2 } from "./config.js";
import { createTrayEntryField } from "./datamodels.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const fields = foundry.data.fields;

/**
 * `flags.mgt2.chargen` — character creation's ledger, and the convention every later layer reads.
 * @extends {foundry.abstract.DataModel}
 */
export class ChargenState extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            // The term being played NOW, one-based.
            term: new fields.NumberField({ required: false, initial: 1, min: 1, integer: true }),

            // Where inside that term the loop is — the same fact as `term`, one level finer, and it
            // belongs here for the same reason: it is the term IN PROGRESS and must not outlive
            // creation.
            step: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.CreationSteps }),

            // The tray of decisions creation defers.
            tray: new fields.ArrayField(createTrayEntryField(), { initial: [] }),

            // Two ledgers, and neither can be derived.
            benefitRolls: new fields.ArrayField(createCounterEntryField(), { initial: [] }),
            skillRolls: new fields.ArrayField(createCounterEntryField(), { initial: [] }),

            // Named tracks scoped to the Traveller rather than to one career — a species
            // status that gates career access and moves NON-monotonically.
            tracks: new fields.TypedObjectField(new fields.SchemaField({
                value: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                rung: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                // The high-water mark "highest rank reached" has to read, kept because a
                // track that falls cannot reconstruct it afterwards.
                high: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
            }), { initial: {} }),

            // Folio 19's Connections Rule, which is an ALLOWANCE and not an outcome: two at most,
            // each with a different Traveller.
            connections: new fields.ArrayField(new fields.SchemaField({
                with: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            }), { initial: [] }),

            // Folio 50's shared skills package, and only the half that is spent: what a Traveller
            // has already taken out of the pool the table chose.
            packagePicks: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] })
        };
    }
}

/** One signed row of a counter ledger. */
function createCounterEntryField() {
    return new fields.SchemaField({
        value: new fields.NumberField({ required: false, initial: 1, integer: true }),
        // Which career record earned or lost it, so a row that wipes a career's rolls can be
        // applied to that career and no other.
        career: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        term: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
        note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
    });
}

export const CHARGEN_SCOPE = "mgt2";
export const CHARGEN_KEY = "chargen";

/**
 * Reading and writing creation state, and the four derivations the term loop is not allowed to
 * write by hand.
 */
export const Chargen = {

    /**
     * Never null: an actor not in creation reads as a blank ledger, so a caller asks one question
     * rather than two.
     * @returns {ChargenState}
     */
    read(actor) {
        const stored = actor?.getFlag(CHARGEN_SCOPE, CHARGEN_KEY);
        return new ChargenState(stored ?? {}, { strict: false });
    },

    isInCreation(actor) {
        return actor?.getFlag(CHARGEN_SCOPE, CHARGEN_KEY) !== undefined;
    },

    /** A Traveller nothing has been written on: no frame, no career, no skill, no score. */
    isBlank(actor) {
        if ( actor?.type !== "character" ) return false;
        if ( actor.items.some(item => ["species", "career", "talent"].includes(item.type)) ) return false;
        return actor.system.characteristicKeys.every(key => actor.system.characteristics[key].base === 0);
    },

    /** **The roster, with no session document behind it**. @returns {Actor[]} */
    roster() {
        return game.actors.filter(actor => this.isInCreation(actor));
    },

    async start(actor, state = {}) {
        if ( this.isInCreation(actor) ) return actor;
        await actor.setFlag(CHARGEN_SCOPE, CHARGEN_KEY, new ChargenState(state, { strict: false }).toObject());
        // The frame's tracks are born here, because a caste number rolled at the first step it is
        // read at would be rolled after the check that reads it.
        await this.ensureTracks(actor);
        return actor;
    },

    /** The whole model is written back, so an array field replaces rather than merges. */
    async update(actor, changes) {
        const next = this.read(actor);
        next.updateSource(changes);
        return actor.setFlag(CHARGEN_SCOPE, CHARGEN_KEY, next.toObject());
    },

    /** The "finished" action, discarding exactly the state that should not survive creation. */
    async finish(actor) {
        if ( !this.isInCreation(actor) ) return actor;
        return actor.unsetFlag(CHARGEN_SCOPE, CHARGEN_KEY);
    },

    /**
     * The species Item, which IS the creation frame and the ONLY route to the term loop
     *.
     * @returns {Item|undefined}
     */
    frame(actor) {
        return actor?.items.find(item => item.type === "species");
    },

    /**
     * The term as this Traveller's frame declares it, plus what that frame adds to the Core
     * sequence and what it deletes from it.
     * @returns {{sequence: string[], own: Set<string>, cut: Set<string>}}
     */
    steps(actor) {
        // The derivation belongs to the frame, so the item sheet's readout and the loop cannot
        // disagree; a Traveller with no species Item at all still runs the Core term.
        return this.frame(actor)?.system.termSequence
            ?? { sequence: [...MGT2.CoreTermSequence], own: new Set(), cut: new Set() };
    },

    /** The first law row that answers: sex is the Traveller's, role a rung on a declared track. */
    law(actor, rows) {
        if ( !rows?.length ) return null;
        const sex = fold(actor?.system.personal?.gender);
        const roles = rows.some(row => row.role)
            ? Object.values(this.read(actor).tracks).map(track => fold(track.rung)) : [];
        return rows.find(row => (!row.sex || (fold(row.sex) === sex))
            && (!row.role || roles.includes(fold(row.role)))) ?? null;
    },

    /** Age as a **sum over the term log**, and never `18 + 4 × terms`. @returns {number} */
    age(actor, { open = false } = {}) {
        const frame = this.frame(actor)?.system.frame;
        const startAge = this.law(actor, frame?.startAge)?.age ?? MGT2.CreationDefaults.startAge;
        const termYears = frame?.termYears ?? MGT2.CreationDefaults.termYears;
        let years = 0;
        for ( const career of this.careers(actor) ) {
            for ( const term of servedRows(career.system, open) ) {
                if ( term.ages ) years += term.years ?? termYears;
            }
        }
        return startAge + years;
    },

    /** The terms one record counts as served. @returns {number} */
    termsIn(record, { open = false } = {}) {
        return record ? servedRows(record.system, open).length : 0;
    },

    /** Every term served, across every career record — the DM the ageing roll and PSI both read. */
    termsServed(actor, { open = false } = {}) {
        return this.careers(actor).reduce((count, career) =>
            count + this.termsIn(career, { open }), 0);
    },

    /**
     * The career records, in the order they were created — which is the order they were served, and
     * the order age accumulates in.
     * @returns {Item[]}
     */
    careers(actor) {
        return (actor?.items ?? []).filter(item => item.type === "career");
    },

    /** The drafts the records show, event drafts apart. @returns {{drafted: number, byEvent: number}} */
    draftsTaken(actor) {
        let drafted = 0;
        let byEvent = 0;
        for ( const career of this.careers(actor) ) {
            if ( career.system.entryMode === "drafted" ) drafted++;
            else if ( career.system.entryMode === "draftedByEvent" ) byEvent++;
        }
        return { drafted, byEvent };
    },

    /** Is any career still open? */
    isServing(actor) {
        return this.careers(actor).some(career => career.system.exitMode === "stillServing");
    },

    /** A Traveller who has stopped but has not been torn down. */
    isDone(actor) {
        const careers = this.careers(actor);
        return (careers.length > 0) && !careers.some(c => c.system.exitMode === "stillServing");
    },

    /**
     * Every term this Traveller has served, in order, each with the age it was served at and the
     * events that fall inside it.
     * @returns {object[]}
     */
    timeline(actor) {
        const frame = this.frame(actor)?.system.frame;
        const termYears = frame?.termYears ?? MGT2.CreationDefaults.termYears;
        let age = this.law(actor, frame?.startAge)?.age ?? MGT2.CreationDefaults.startAge;
        let index = 0;
        const rows = [];
        for ( const career of this.careers(actor) ) {
            const system = career.system;
            const log = system.termLog?.length ? system.termLog : countOnlyTerms(system.terms);
            const first = rows.length;
            for ( const entry of log ) {
                const years = entry.ages ? (entry.years ?? termYears) : 0;
                rows.push({
                    index: ++index,
                    career, careerId: career.id, careerName: career.name,
                    assignment: system.assignment, rank: system.rank, ladder: system.ladder,
                    from: age, to: age + years, years,
                    survived: entry.survived, ejected: entry.ejected,
                    kind: entry.kind, note: entry.note,
                    // The track as of THIS term: the record stores the current value and every
                    // adjustment carries the term it was made in, so a
                    // past term reads by unwinding the ones that came after it.
                    track: trackAt(system.track, index),
                    events: []
                });
                age += years;
            }
            // `events[]` is dated by age and not by term, so each one lands in the term its age
            // falls in — the last term taking anything past the end or undated, because dropping a
            // line silently is worse than printing it late.
            const mine = rows.slice(first);
            if ( !mine.length ) continue;
            for ( const event of system.events ?? [] ) {
                const row = Number.isFinite(event.age) ? mine.find(one => one.to > event.age) : null;
                (row ?? mine.at(-1)).events.push(event);
            }
        }
        return rows;
    },

    /**
     * The check the frame runs at a named step, or null. @returns {object|null}
     * @param {string} key   A `MGT2.CreationSteps` key
     */
    stepCheck(actor, key) {
        return this.frame(actor)?.system.stepCheck(key) ?? null;
    },

    /**
     * The frame's declared tracks, materialised on the ledger.
     * @returns {Promise<object>}   The tracks, whether or not anything was written
     */
    async ensureTracks(actor) {
        const declared = this.frame(actor)?.system.frame.tracks ?? [];
        const tracks = foundry.utils.deepClone(this.read(actor).tracks);
        let wrote = false;
        for ( const definition of declared ) {
            if ( !definition.key || tracks[definition.key] ) continue;
            tracks[definition.key] = await initialTrack(definition);
            wrote = true;
        }
        if ( wrote ) await this.update(actor, { tracks });
        return tracks;
    },

    /**
     * One Traveller-scoped track, and the rung that answers for it — the highest ever held where a
     * rung once attained is kept.
     * @returns {{value: number, rung: string, high: number|null}}
     */
    track(actor, key) {
        const held = this.read(actor).tracks[key];
        const value = held?.value ?? 0;
        const high = held?.high ?? null;
        if ( (Rules.get("trackRungPermanence") !== "heldThenPermanent") || !(high > value) ) {
            return { value, rung: held?.rung ?? "", high };
        }
        const definition = this.frame(actor)?.system.frame.tracks.find(entry => entry.key === key);
        const rung = (definition?.kind === "enumerated") ? definition.values[high] : held.rung;
        return { value: high, rung: rung ?? held.rung ?? "", high };
    },

    /**
     * Move a frame-declared track, by rungs on an enumerated one and by points on a numeric one.
     * @returns {Promise<{value: number, rung: string, label: string, moved: boolean}|null>}   Null
     */
    async moveTrack(actor, key, delta) {
        const definition = this.frame(actor)?.system.frame.tracks.find(entry => entry.key === key);
        if ( !definition ) return null;
        const next = foundry.utils.deepClone(await this.ensureTracks(actor));
        const held = next[key];
        const floor = (Rules.get("trackRungPermanence") === "permanent") ? (held.value ?? 0) : -Infinity;
        const value = Math.max(clampToTrack((held.value ?? 0) + delta, definition), floor);
        next[key] = {
            value,
            rung: (definition.kind === "enumerated") ? (definition.values[value] ?? held.rung) : held.rung,
            high: Math.max(held.high ?? value, value)
        };
        await this.update(actor, { tracks: next });
        return { ...next[key], label: definition.label || key, moved: value !== held.value,
            held: (delta < 0) && (floor !== -Infinity) && (value === (held.value ?? 0)) };
    },

    /**
     * The Benefit-roll total: a LEDGER and not a derivation.
     * @param {string} [career]   A career record id.
     */
    benefitRolls(actor, career) {
        return sumLedger(this.read(actor).benefitRolls, career);
    },

    /** The skill-roll total, same shape and for the same reason. */
    skillRolls(actor, career) {
        return sumLedger(this.read(actor).skillRolls, career);
    },

    /**
     * The tray entries that bear on one check, in the order they were written.
     * @param {string} check      One of `MGT2.TrayChecks`.
     * @param {string} [career]   The career being played, matched against a scoped entry.
     */
    pending(actor, check, career) {
        return this.read(actor).tray.filter(entry => bears(entry, check, career));
    },

    /** Spend what a roll on this check consumes. @returns {Promise<Actor>} */
    async spendPending(actor, check, career) {
        if ( !check ) return actor;
        const state = this.read(actor);
        const tray = [];
        let spent = false;
        for ( const entry of state.tray ) {
            if ( !bears(entry, check, career) || (entry.duration !== "oneShot") || (entry.uses === null) ) {
                tray.push(plain(entry));
                continue;
            }
            spent = true;
            if ( entry.uses > 1 ) tray.push({ ...plain(entry), uses: entry.uses - 1 });
        }
        return spent ? this.update(actor, { tray }) : actor;
    },

    /**
     * The field that broke *"a value, a condition and a scope"*: an entry
     * may expire on HOW a career ended rather than on a term count, because a printed penalty runs
     * until the first career is left and then asks whether that was voluntary.
     */
    async expirePending(actor, career, exitMode) {
        if ( !exitMode ) return actor;
        const state = this.read(actor);
        const key = MGT2Helper.skillSlug(career);
        const tray = state.tray.filter(entry => {
            if ( entry.expiresWhen === exitMode ) return false;
            return !((entry.duration === "thisCareer")
                && (!entry.career || (MGT2Helper.skillSlug(entry.career) === key)));
        }).map(plain);
        return (tray.length === state.tray.length) ? actor : this.update(actor, { tray });
    },

    async pushPending(actor, entry) {
        return this.update(actor, { tray: [...this.read(actor).tray.map(plain), entry] });
    },

    /** The career records still open. @returns {Item[]} */
    serving(actor) {
        return this.careers(actor).filter(career => career.system.exitMode === "stillServing");
    },

    /** The assignment being served, off the record's own copy of its template's tables. */
    assignment(record) {
        const assignments = record?.system.assignments ?? [];
        return assignments.find(entry => entry.name === record.system.assignment) ?? assignments[0] ?? null;
    },

    /**
     * How many careers came BEFORE this one, which is what a template's `perPreviousCareer` DM
     * multiplies.
     * @param {Item} [exclude]   The record being qualified for, which is not previous to itself
     */
    previousCareers(actor, exclude = null) {
        return this.careers(actor).filter(career => career !== exclude).length;
    },

    /** The rank number a later rule reads. */
    effectiveRank(record) {
        const rank = record?.system.rank ?? 0;
        if ( Rules.get("officerRankNumbering") !== "combined" ) return rank;
        return rank + (record?.system.enlistedRank ?? 0);
    },

    /**
     * Whether this Traveller owes an ageing roll at the end of the term just played.
     * @returns {boolean}
     */
    ageingDue(actor) {
        const defaults = MGT2.CreationDefaults;
        const ageing = this.law(actor, this.frame(actor)?.system.ageing);
        const byTerm = ageing ? ageing.fromTerm : defaults.ageingFromTerm;
        const byAge = ageing ? ageing.fromAge : defaults.ageingFromAge;
        const prefersTerms = Rules.get("ageingTriggerPrecedence") !== "age";
        // Folio 48 asks at the END of a term, so the one being played counts: 34 lands inside it.
        if ( (byTerm !== null) && (prefersTerms || (byAge === null)) ) {
            return this.termsServed(actor, { open: true }) >= byTerm;
        }
        if ( byAge !== null ) return this.age(actor, { open: true }) >= byAge;
        return false;
    }
};

/** Whether one tray entry bears on this check for this career — the predicate `pending` and
 *  `spendPending` must not disagree about. */
function bears(entry, check, career) {
    if ( check && entry.appliesTo.size && !entry.appliesTo.has(check) ) return false;
    if ( !career || (entry.scope === "anyCareer") ) return true;
    const key = MGT2Helper.skillSlug(career);
    // "The qualification roll for your NEXT career": every career but the one that granted it,
    // which is the whole difference from `anyCareer` and the reason the value exists.
    if ( entry.scope === "nextCareer" ) return !entry.career || (MGT2Helper.skillSlug(entry.career) !== key);
    return !entry.career || (MGT2Helper.skillSlug(entry.career) === key);
}

const fold = value => (value ?? "").trim().toLowerCase();

/** A row of the flag read back as something the flag will take again. */
function plain(entry) {
    const copy = { ...entry };
    if ( copy.appliesTo instanceof Set ) copy.appliesTo = [...copy.appliesTo];
    return copy;
}

/**
 * A declared track's opening value.
 * @returns {Promise<{value: number, rung: string, high: number|null}>}
 */
async function initialTrack(definition) {
    if ( definition.kind === "enumerated" ) {
        const at = Math.max(definition.values.indexOf(definition.initial), 0);
        return { value: at, rung: definition.values[at] ?? definition.initial ?? "", high: at };
    }
    // The declaration carries the book's own `1D`, which the parser reads as an unresolved term and
    // throws on — the normalisation every transcribed page goes through.
    const rolled = definition.initial
        ? (await new Roll(MGT2Helper.damageFormula(definition.initial)).roll()).total : 0;
    const value = clampToTrack(rolled, definition);
    return { value, rung: "", high: value };
}

/**
 * An enumerated track is bounded by its own rungs at both ends — the value IS the index — while a
 * numeric one has only the cap its declaration prints.
 * @returns {number}
 */
function clampToTrack(value, definition) {
    if ( definition.kind === "enumerated" ) {
        return Math.min(Math.max(value, 0), Math.max(definition.values.length - 1, 0));
    }
    return (definition.cap === null) ? value : Math.min(value, definition.cap);
}

/** @returns {number} */
function sumLedger(entries, career) {
    return entries.reduce((total, entry) =>
        (career && entry.career && (entry.career !== career)) ? total : total + entry.value, 0);
}

/** A record written before `termLog` existed carries only a count. @returns {object[]} */
function countOnlyTerms(terms) {
    return Array.fromRange(terms ?? 0, 1).map(term =>
        ({ term, years: null, ages: true, survived: null, ejected: false, closed: true, kind: "",
            note: "" }));
}

/** The rows of one record that count as served: closed ones, and the open one only when asked. */
function servedRows(system, open) {
    const log = system?.termLog?.length ? system.termLog : countOnlyTerms(system?.terms);
    return open ? log : log.filter(entry => entry.closed);
}

/** @returns {{key: string, value: number, cap: number|null}|null} */
function trackAt(track, term) {
    if ( !track?.key ) return null;
    const later = (track.adjustments ?? []).reduce((sum, adjustment) =>
        ((adjustment.term !== null) && (adjustment.term > term)) ? sum + adjustment.value : sum, 0);
    return { key: track.key, value: (track.value ?? 0) - later, cap: track.cap };
}
