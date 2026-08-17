import { MGT2 } from "./config.js";
import { createTrayEntryField } from "./datamodels.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const fields = foundry.data.fields;

/**
 * `flags.mgt2.chargen` — character creation's ledger, and the convention every later layer reads.
 *
 * **The flag IS the roster** (§9.38). The set of actors carrying it is the session, which is why
 * creation needs no session document to know who is at the table and what term each column is on. If
 * two groups ever create in one world, the flag grows a key — not a document.
 *
 * **Why a flag and not schema.** Every DECIDED outcome is written to the actor as it is decided — the
 * `career` records, the `talent` Items, the `contact` Items, the characteristic log — so resuming is
 * free because there is nothing to resume. What is left over is state that must not outlive creation,
 * which has no business in a data model that does; `flags.mgt2.suspended` on an ActiveEffect
 * (`effects.js`) is the same call already made once.
 *
 * **Who writes it.** The creation screen, and nothing else: `start` puts it on, the term loop amends
 * it, `finish` takes it off.
 *
 * **What is deliberately not here.** The completed history: the `career` records' `terms` and
 * `termLog` are what happened, and `term` below is a cursor saying what is happening. They are
 * different facts and the redundancy is not a bug to fix (§9.38). Nor the session's options — a table
 * plays one way for everybody, so those are world settings (§9.46, §9.97).
 *
 * @extends {foundry.abstract.DataModel}
 */
export class ChargenState extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            // The term being played NOW, one-based.
            term: new fields.NumberField({ required: false, initial: 1, min: 1, integer: true }),

            // Where inside that term the loop is — the same fact as `term`, one level finer, and it
            // belongs here for the same reason: it is the term IN PROGRESS and must not outlive
            // creation. Blank is a term not started; the value is a key of `MGT2.CreationSteps` and
            // the ORDER is the frame's, so this says which step and never which position.
            step: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.CreationSteps }),

            // §9.51's tray. The entry shape is `datamodels.js`'s, because a `career` template's event
            // rows write the same entries this holds (§9.109).
            tray: new fields.ArrayField(createTrayEntryField(), { initial: [] }),

            // §9.50's two counters, and neither can be derived. Some thirty printed rows wipe, grant,
            // remove or retain Benefit rolls, and two let a player WAGER any number of them mid-term —
            // which needs the pending total to exist before mustering out, where a derive-at-muster-out
            // model has nothing to wager.
            benefitRolls: new fields.ArrayField(createCounterEntryField(), { initial: [] }),
            skillRolls: new fields.ArrayField(createCounterEntryField(), { initial: [] }),

            // §9.54's named tracks whose scope is the Traveller rather than one career — a species
            // status that gates career access and moves NON-monotonically. A career-scoped track lives
            // on the `career` record instead, because it dies with the career.
            tracks: new fields.TypedObjectField(new fields.SchemaField({
                value: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
                rung: new fields.StringField({ required: false, blank: true, trim: true }),
                // The high-water mark §9.40's "highest rank reached" has to read, kept because a track
                // that falls cannot reconstruct it afterwards.
                high: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true })
            }), { initial: {} }),

            // Folio 19's Connections Rule, which is an ALLOWANCE and not an outcome: two at most,
            // each with a different Traveller. What the agreement bought is a `talent` Item carrying
            // its provenance and outliving creation; what is spent is here, and means nothing once
            // the last term is entered (§9.44).
            connections: new fields.ArrayField(new fields.SchemaField({
                with: new fields.StringField({ required: false, blank: true, trim: true }),
                skill: new fields.StringField({ required: false, blank: true, trim: true }),
                note: new fields.StringField({ required: false, blank: true, trim: true })
            }), { initial: [] }),

            // Folio 50's shared skills package, and only the half that is spent: what a Traveller has
            // already taken out of the pool the table chose. The pool itself is the group's and lives
            // beside the roster; what is LEFT is that pool minus these, summed over the roster — so the
            // draft needs no shared cursor and no document, and each pick is a write to the picker's
            // own Traveller (§9.38, §9.40).
            packagePicks: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, trim: true }), { initial: [] }),

            // Two budgets and not one. The draft is once per lifetime "unless otherwise stated", and
            // the otherwise is printed as a general statement: an event-forced draft does not consume
            // the voluntary allowance (§9.51, §9.55, §9.56 item 16).
            draft: new fields.SchemaField({
                applied: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
                byEvent: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
            })
        };
    }
}

/**
 * One signed row of a counter ledger. `value` is a delta and never a total: a restoration is an entry,
 * not an edit, and nothing is ever subtracted from a previous row.
 */
function createCounterEntryField() {
    return new fields.SchemaField({
        value: new fields.NumberField({ required: false, initial: 1, integer: true }),
        // Which career record earned or lost it, so a row that wipes a career's rolls can be applied
        // to that career and no other.
        career: new fields.StringField({ required: false, blank: true, trim: true }),
        term: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
        note: new fields.StringField({ required: false, blank: true, trim: true })
    });
}

/* -------------------------------------------- */

export const CHARGEN_SCOPE = "mgt2";
export const CHARGEN_KEY = "chargen";

/**
 * Reading and writing creation state, and the four derivations the term loop is not allowed to write
 * by hand.
 *
 * **Nothing in this module compares a career or a species name** (§9.47). Every rule the book states
 * as a list of names is a field on the `career` template or on the species frame; the invariant is the
 * design's own and it is testable, which is why the sketch swaps a species Item at run time and
 * watches the loop follow.
 */
export const Chargen = {

    /**
     * Never null: an actor not in creation reads as a blank ledger, so a caller asks one question
     * rather than two. Non-strict because a flag is hand-editable in a way a document field is not.
     * @param {Actor} actor
     * @returns {ChargenState}
     */
    read(actor) {
        const stored = actor?.getFlag(CHARGEN_SCOPE, CHARGEN_KEY);
        return new ChargenState(stored ?? {}, { strict: false });
    },

    isInCreation(actor) {
        return actor?.getFlag(CHARGEN_SCOPE, CHARGEN_KEY) !== undefined;
    },

    /**
     * **The roster, with no session document behind it** (§9.38). Every Traveller carrying the flag is
     * at this table; the columns go ragged when one musters out and the flag comes off.
     * @returns {Actor[]}
     */
    roster() {
        return game.actors.filter(actor => this.isInCreation(actor));
    },

    async start(actor, state = {}) {
        if ( this.isInCreation(actor) ) return actor;
        await actor.setFlag(CHARGEN_SCOPE, CHARGEN_KEY, new ChargenState(state, { strict: false }).toObject());
        // The frame's tracks are born here, because a caste number rolled at the first step it is read
        // at would be rolled after the check that reads it (§9.120).
        await this.ensureTracks(actor);
        return actor;
    },

    /** The whole model is written back, so an array field replaces rather than merges. */
    async update(actor, changes) {
        const next = this.read(actor);
        next.updateSource(changes);
        return actor.setFlag(CHARGEN_SCOPE, CHARGEN_KEY, next.toObject());
    },

    /**
     * The "finished" action, discarding exactly the state that should not survive creation.
     * **Strictly after mustering out and never at it** (§9.50): mustering out consumes the benefit
     * ledger this flag holds, so the teardown cannot precede it.
     */
    async finish(actor) {
        if ( !this.isInCreation(actor) ) return actor;
        return actor.unsetFlag(CHARGEN_SCOPE, CHARGEN_KEY);
    },

    /* -------------------------------------------- */

    /**
     * The species Item, which IS the creation frame (§9.54) and the ONLY route to the term loop
     * (§9.99). `personal.species` is a display string written beside the Item and must never be read
     * for this — the string a sheet shows and the Item carrying the rules are already two objects.
     * @param {Actor} actor
     * @returns {Item|undefined}
     */
    frame(actor) {
        return actor?.items.find(item => item.type === "species");
    },

    /**
     * The term as this Traveller's frame declares it, plus what that frame adds to the Core sequence
     * and what it deletes from it. Both are DERIVED against `MGT2.CoreTermSequence` and never authored:
     * a frame that drops ranks drops the commission step with them, without anyone having to remember.
     * @param {Actor} actor
     * @returns {{sequence: string[], own: Set<string>, cut: Set<string>}}
     */
    steps(actor) {
        // The derivation belongs to the frame, so the item sheet's readout and the loop cannot
        // disagree; a Traveller with no species Item at all still runs the Core term (§9.99).
        return this.frame(actor)?.system.termSequence
            ?? { sequence: [...MGT2.CoreTermSequence], own: new Set(), cut: new Set() };
    },

    /**
     * Age as a **sum over the term log**, and never `18 + 4 × terms` (§9.53). A frame may start its
     * Traveller at a different age, a Companion pre-career starts one at 22 + 2D3, and one printed term
     * explicitly "is not counted toward your physical age" — a formula would be wrong the first time a
     * table used any of them.
     *
     * A record written before `termLog` existed carries only a count, so it is worth its terms at the
     * frame's own term length. That fallback is the one place the arithmetic looks like the formula,
     * and it is reading a record that has no finer information rather than assuming one.
     * @param {Actor} actor
     * @returns {number}
     */
    age(actor) {
        const frame = this.frame(actor)?.system.frame;
        const startAge = frame?.startAge ?? MGT2.CreationDefaults.startAge;
        const termYears = frame?.termYears ?? MGT2.CreationDefaults.termYears;
        let years = 0;
        for ( const career of actor?.items ?? [] ) {
            if ( career.type !== "career" ) continue;
            const log = career.system.termLog ?? [];
            if ( !log.length ) {
                years += (career.system.terms ?? 0) * termYears;
                continue;
            }
            for ( const term of log ) if ( term.ages ) years += term.years ?? termYears;
        }
        return startAge + years;
    },

    /** Every term served, across every career record — the DM the ageing roll and PSI both read. */
    termsServed(actor) {
        let count = 0;
        for ( const career of actor?.items ?? [] ) {
            if ( career.type !== "career" ) continue;
            count += career.system.termLog?.length || (career.system.terms ?? 0);
        }
        return count;
    },

    /**
     * The career records, in the order they were created — which is the order they were served, and
     * the order age accumulates in.
     * @param {Actor} actor
     * @returns {Item[]}
     */
    careers(actor) {
        return (actor?.items ?? []).filter(item => item.type === "career");
    },

    /**
     * Is any career still open? The record's EXIT MODE is the fact (§9.53), never a phrase and never
     * an absence: a career that cannot eject still reads `stillServing` until it is left.
     * @param {Actor} actor
     */
    isServing(actor) {
        return this.careers(actor).some(career => career.system.exitMode === "stillServing");
    },

    /**
     * A Traveller who has stopped but has not been torn down. **Mustering out consumes the ledger, so
     * the teardown is strictly after it** (§9.50) — which is exactly the window in which a column goes
     * ragged: no cell where the others still have one, while the flag is still on.
     * @param {Actor} actor
     */
    isDone(actor) {
        const careers = this.careers(actor);
        return (careers.length > 0) && !careers.some(c => c.system.exitMode === "stillServing");
    },

    /**
     * Every term this Traveller has served, in order, each with the age it was served at and the
     * events that fall inside it. One reading, so the grid, the age and the ageing DM cannot disagree.
     *
     * **The row's `index` is its position in the timeline, not `termLog[].term`.** A record numbers
     * its own terms; the grid is a table's shared clock and counts across every record, which is what
     * makes four columns line up. The two coincide for a Traveller who never changed career, and only
     * the position is safe when one did.
     *
     * @param {Actor} actor
     * @returns {object[]}
     */
    timeline(actor) {
        const frame = this.frame(actor)?.system.frame;
        const termYears = frame?.termYears ?? MGT2.CreationDefaults.termYears;
        let age = frame?.startAge ?? MGT2.CreationDefaults.startAge;
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
                    // adjustment carries the term it was made in (§9.38's provenance rule), so a past
                    // term reads by unwinding the ones that came after it.
                    track: trackAt(system.track, index),
                    events: []
                });
                age += years;
            }
            // `events[]` is dated by age and not by term, so each one lands in the term its age falls
            // in — the last one taking whatever runs past the end, because dropping a line silently is
            // worse than printing it late.
            const mine = rows.slice(first);
            if ( !mine.length ) continue;
            for ( const event of system.events ?? [] ) {
                (mine.find(row => row.to > event.age) ?? mine.at(-1)).events.push(event);
            }
        }
        return rows;
    },

    /**
     * The check the frame runs at a named step, or null (§9.120). Read off the model so the item
     * sheet's readout and the term loop cannot disagree, exactly as `steps` is.
     * @param {Actor} actor
     * @param {string} key   A `MGT2.CreationSteps` key
     * @returns {object|null}
     */
    stepCheck(actor, key) {
        return this.frame(actor)?.system.stepCheck(key) ?? null;
    },

    /**
     * The frame's declared tracks, materialised on the ledger (§9.120).
     *
     * **A track was declared and never born.** §9.54 puts the DECLARATION on the frame and the value on
     * the ledger, and nothing ever rolled the declaration's initial — so a Droyne caste number read as a
     * DM was silently zero from the day the field shipped. Called when creation starts and again before
     * any step touches a track, because a Traveller can be given their species Item after starting.
     *
     * Idempotent: a key that already has a row is left exactly as it is, initial and all.
     * @param {Actor} actor
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
     * One Traveller-scoped track as it stands. Never null: a track nothing has written reads as an
     * empty rung and a zero, which is what a DM composed from it has to be able to add.
     * @param {Actor} actor
     * @param {string} key
     * @returns {{value: number, rung: string, high: number|null}}
     */
    track(actor, key) {
        const held = this.read(actor).tracks[key];
        return { value: held?.value ?? 0, rung: held?.rung ?? "", high: held?.high ?? null };
    },

    /**
     * Move a frame-declared track, by rungs on an enumerated one and by points on a numeric one — the
     * single reading that lets a caste degree and a parole threshold share one field (§9.120).
     *
     * The high-water mark is kept whatever the direction, because a track that falls cannot reconstruct
     * it afterwards and §9.40's *"highest rank reached"* has to read it (§9.54).
     * @param {Actor} actor
     * @param {string} key
     * @param {number} delta
     * @returns {Promise<{value: number, rung: string, label: string, moved: boolean}|null>}   Null
     *          where no frame declares the track: a career-scoped one is moved by its own record.
     */
    async moveTrack(actor, key, delta) {
        const definition = this.frame(actor)?.system.frame.tracks.find(entry => entry.key === key);
        if ( !definition ) return null;
        const next = foundry.utils.deepClone(await this.ensureTracks(actor));
        const held = next[key];
        const value = clampToTrack((held.value ?? 0) + delta, definition);
        next[key] = {
            value,
            rung: (definition.kind === "enumerated") ? (definition.values[value] ?? held.rung) : held.rung,
            high: Math.max(held.high ?? value, value)
        };
        await this.update(actor, { tracks: next });
        return { ...next[key], label: definition.label || key, moved: value !== held.value };
    },

    /**
     * The Benefit-roll total: a LEDGER and not a derivation (§9.50). Optionally scoped to one career
     * record, which is what a row that wipes a career's rolls needs.
     * @param {Actor} actor
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
     * @param {Actor} actor
     * @param {string} check      One of `MGT2.TrayChecks`.
     * @param {string} [career]   The career being played, matched against a scoped entry.
     */
    pending(actor, check, career) {
        return this.read(actor).tray.filter(entry => bears(entry, check, career));
    },

    /**
     * Spend what a roll on this check consumes. **It lives beside `pending` and not inside whichever
     * module rolled**, because the two are one transaction: every composer that reads a tray DM owes
     * this call, and a second copy of the predicate is how one of them silently stops paying. A
     * one-shot entry is consumed by the roll it was made into and never by a window opening (§9.51).
     * @returns {Promise<Actor>}
     */
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
     * §9.51's seventh field, and the one that broke *"a value, a condition and a scope"*: an entry may
     * expire on HOW a career ended rather than on a term count, because a printed penalty runs until
     * the first career is left and then asks whether that was voluntary.
     */
    async expirePending(actor, career, exitMode) {
        if ( !exitMode ) return actor;
        const state = this.read(actor);
        const tray = state.tray.filter(entry => {
            if ( entry.expiresWhen === exitMode ) return false;
            return !((entry.duration === "thisCareer") && (!entry.career || (entry.career === career)));
        }).map(plain);
        return (tray.length === state.tray.length) ? actor : this.update(actor, { tray });
    },

    async pushPending(actor, entry) {
        return this.update(actor, { tray: [...this.read(actor).tray.map(plain), entry] });
    },

    /* -------------------------------------------- */

    /**
     * The career records still open. **A list and not one record**, because §9.54's parallel records
     * are a printed case: one species runs a reserve career concurrently with its primary and hooks
     * that career's natural 2 and natural 12. The loop plays the first and the shape does not have to
     * change when the second arrives.
     * @param {Actor} actor
     * @returns {Item[]}
     */
    serving(actor) {
        return this.careers(actor).filter(career => career.system.exitMode === "stillServing");
    },

    /**
     * The assignment being served, off the record's own copy of its template's tables. A record with
     * no matching name falls back to the first, because a survival target has to exist for the term
     * to be playable at all and a blank assignment is what a record dragged from a pack starts with.
     * @param {Item} record
     */
    assignment(record) {
        const assignments = record?.system.assignments ?? [];
        return assignments.find(entry => entry.name === record.system.assignment) ?? assignments[0] ?? null;
    },

    /**
     * How many careers came BEFORE this one, which is what a template's `perPreviousCareer` DM
     * multiplies. Counted over the records, so it is the Traveller's own history and not a number
     * anybody stores.
     * @param {Actor} actor
     * @param {Item} [exclude]   The record being qualified for, which is not previous to itself
     */
    previousCareers(actor, exclude = null) {
        return this.careers(actor).filter(career => career !== exclude).length;
    },

    /**
     * The rank number a later rule reads. The two ladders are numbered independently and a commission
     * restarts at 1, so the printed number is the number — but a table that reads them as one line of
     * service says so through `officerRankNumbering`, and then an officer's rank is added to the
     * highest enlisted rank the record reached (§9.56 item 4).
     * @param {Item} record
     */
    effectiveRank(record) {
        const rank = record?.system.rank ?? 0;
        if ( Rules.get("officerRankNumbering") !== "combined" ) return rank;
        return rank + (record?.system.enlistedRank ?? 0);
    },

    /**
     * Whether this Traveller owes an ageing roll at the end of the term just played. The trigger
     * takes four states and not two (§9.54): a term count and an age together, a term count alone, an
     * age alone, and none printed anywhere — which is one whole published species. Where a frame
     * prints both and they do not produce each other, `ageingTriggerPrecedence` says which is
     * authoritative.
     * @param {Actor} actor
     * @returns {boolean}
     */
    ageingDue(actor) {
        const defaults = MGT2.CreationDefaults;
        const ageing = this.frame(actor)?.system.ageing;
        const byTerm = ageing ? ageing.fromTerm : defaults.ageingFromTerm;
        const byAge = ageing ? ageing.fromAge : defaults.ageingFromAge;
        const prefersTerms = Rules.get("ageingTriggerPrecedence") !== "age";
        if ( (byTerm !== null) && (prefersTerms || (byAge === null)) ) return this.termsServed(actor) >= byTerm;
        if ( byAge !== null ) return this.age(actor) >= byAge;
        return false;
    }
};

/** Whether one tray entry bears on this check for this career — the predicate `pending` and `spendPending` must not disagree about. */
function bears(entry, check, career) {
    if ( check && entry.appliesTo.size && !entry.appliesTo.has(check) ) return false;
    if ( !career || (entry.scope === "anyCareer") ) return true;
    // "The qualification roll for your NEXT career": every career but the one that granted it, which
    // is the whole difference from `anyCareer` and the reason the value exists.
    if ( entry.scope === "nextCareer" ) return !entry.career || (entry.career !== career);
    return !entry.career || (entry.career === career);
}

/**
 * A row of the flag read back as something the flag will take again. **An `ArrayField` of
 * `SchemaField`s yields PLAIN OBJECTS and not DataModels**, so there is no `toObject` to call — and
 * `appliesTo` inside one is a live `Set`, which has to be spread or the write refuses it.
 */
function plain(entry) {
    const copy = { ...entry };
    if ( copy.appliesTo instanceof Set ) copy.appliesTo = [...copy.appliesTo];
    return copy;
}

/**
 * A declared track's opening value (§9.120). A numeric one rolls its initial — the Droyne caste number
 * is `1D` and is read as a DM for the rest of creation — and an enumerated one starts at the rung the
 * declaration names, or at the first one it lists.
 * @returns {Promise<{value: number, rung: string, high: number|null}>}
 */
async function initialTrack(definition) {
    if ( definition.kind === "enumerated" ) {
        const at = Math.max(definition.values.indexOf(definition.initial), 0);
        return { value: at, rung: definition.values[at] ?? definition.initial ?? "", high: at };
    }
    // The declaration carries the book's own `1D`, which the parser reads as an unresolved term and
    // throws on — the normalisation every transcribed page goes through (§9.120).
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

/**
 * A record written before `termLog` existed carries only a count. Its terms are reconstructed at the
 * frame's own length rather than dropped off the grid — the one place the arithmetic looks like
 * §9.53's forbidden formula, and it is reading a record with no finer information (§9.103).
 * @returns {object[]}
 */
function countOnlyTerms(terms) {
    return Array.fromRange(terms ?? 0, 1).map(term =>
        ({ term, years: null, ages: true, survived: null, ejected: false, kind: "", note: "" }));
}

/** @returns {{key: string, value: number, cap: number|null}|null} */
function trackAt(track, term) {
    if ( !track?.key ) return null;
    const later = (track.adjustments ?? []).reduce((sum, adjustment) =>
        ((adjustment.term !== null) && (adjustment.term > term)) ? sum + adjustment.value : sum, 0);
    return { key: track.key, value: (track.value ?? 0) - later, cap: track.cap };
}
