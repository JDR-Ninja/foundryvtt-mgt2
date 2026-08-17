import { MGT2Helper } from "./helper.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const TEMPLATES = "systems/mgt2/templates";

/**
 * What the roster takes, tested AFTER the uuid resolves. A `spacecraft` is a crew SOURCE and never a
 * payer: no hull holds money — its `finance` is purchase, mortgage and periods paid, with no balance
 * — and neither does a `stash`. `character.system.finance.credits` is the only purse in the system.
 */
const ROSTER_TYPES = "Actor.character Actor.spacecraft";

/** The two ways money moves. Not a CONFIG list: nothing outside this screen reads it. */
const DIRECTIONS = ["debit", "credit"];

/**
 * These controls live in no `<form>`: the screen submits nowhere and reads its own state. Radios with
 * no form owner group by name across the whole document, so every name here is prefixed.
 */
const FIELD = "cs";

/**
 * One transfer, as it was applied.
 * @typedef {object} CreditSplitResult
 * @property {"debit"|"credit"} direction  Which way the money went
 * @property {number} total                Credits actually moved — the sum of `entries[].amount`
 * @property {CreditSplitEntry[]} entries  One per roster row, in roster order, zero shares included
 * @property {string|null} message         The id of the chat card the transfer posted
 */

/**
 * One participant's line of a transfer.
 * @typedef {object} CreditSplitEntry
 * @property {string} uuid    The Actor
 * @property {string} name
 * @property {number} amount  Credits assigned to them, always positive
 * @property {number} paid    Credits the purse actually moved
 * @property {number} debt    Credits that became debt because the purse was short — a debit only
 * @property {number} before  The purse before
 * @property {number} after   The purse after
 */

/**
 * The referee's transfer screen: a sum, a direction, a roster of Travellers and the split between
 * them, applied on one explicit validation.
 *
 * **The first thing in this system that writes money on demand**, so the whole design is about
 * making that write visible before and after it happens. §9.35's doctrine — *the referee types it and
 * NOTHING here writes it* — is bent deliberately, and the chat card is what makes the bend honest:
 * the direction, the sum, every participant's share and every shortfall that became debt are on the
 * log, whether the transfer was typed here or handed in by another screen.
 *
 * Three mechanics carry it, and they are the feature:
 *
 * 1. **Weights, never raw percentages.** Dragging one row rescales the *unlocked* others in
 *    proportion; a lock pin fixes a share against every later move. N sliders that must be made to
 *    total 100 % by hand is the shape this avoids.
 * 2. **Every row is typable in credits or in percent**, each following the other, because the table
 *    case is "Alice puts in Cr50000, split the rest" and the alternative is arithmetic in the head.
 * 3. **The rounding remainder is named.** Whole credits do not divide three ways, and `allocate`
 *    says out loud who took the odd one.
 *
 * GM-only, screen and entry points alike: it moves other people's purses.
 *
 * @extends {ApplicationV2}
 * @mixes HandlebarsApplication
 */
export class CreditSplit extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mgt2", "creditsplit"],
        position: { width: 720, height: 600 },
        window: { resizable: true, icon: "fa-solid fa-money-bill-transfer",
            title: "MGT2.CreditSplit.Title" },
        actions: {
            apply: CreditSplit.#onApply,
            cover: CreditSplit.#onCover,
            evenSplit: CreditSplit.#onEvenSplit,
            toggleLock: CreditSplit.#onToggleLock,
            seedControlled: CreditSplit.#onSeedControlled,
            seedParty: CreditSplit.#onSeedParty,
            seedCrew: CreditSplit.#onSeedCrew,
            clearRoster: CreditSplit.#onClearRoster,
            dropRow: CreditSplit.#onDropRow,
            openDocument: CreditSplit.#onOpenDocument
        }
    };

    /**
     * Three parts, and the split is the Docket's for the Docket's reason: the typed values render
     * ONCE so a caret survives a keystroke, while the roster and the foot are a reading of them. The
     * roster goes further still — it is patched in place rather than re-rendered, because a gauge
     * replaced mid-drag loses the pointer.
     * @inheritDoc
     */
    static PARTS = {
        form: { template: `${TEMPLATES}/credit-split.html` },
        roster: { template: `${TEMPLATES}/credit-split-roster.html`, scrollable: [""] },
        foot: { template: `${TEMPLATES}/credit-split-foot.html` }
    };

    /**
     * Open the screen and wait for what it applies.
     *
     * **One window per transfer, and not one window for the system.** A caller's seeded sum is its own
     * transaction, and two screens open at once are safe: every purse is read at the moment the
     * transfer is validated, never at the moment the window opened.
     *
     * @param {object} [seed]
     * @param {number} [seed.total]        The sum, in credits
     * @param {string} [seed.direction]    `debit` (default) or `credit`
     * @param {string[]} [seed.actors]     Actor uuids to seed the roster with; non-characters drop out
     * @param {string} [seed.spacecraft]   A spacecraft uuid — its crew roster seeds the roster, and
     *                                     the CREW button stays live against that hull afterwards
     * @param {string} [seed.reason]       A line carried onto the chat card
     * @returns {Promise<CreditSplitResult|null>}  What was applied, or `null` where the referee closed
     *                                             the window without validating and for a non-GM
     */
    static async open(seed = {}) {
        if ( !game.user.isGM ) {
            ui.notifications.warn(game.i18n.localize("MGT2.CreditSplit.Errors.GMOnly"));
            return null;
        }
        const app = new CreditSplit(seed);
        await app.#seedRoster(seed);
        const settled = new Promise(resolve => { app.#settle = resolve; });
        await app.render({ force: true });
        return settled;
    }

    constructor(seed = {}, options = {}) {
        super({ ...options, id: `mgt2-credit-split-${foundry.utils.randomID()}` });
        this.#total = Math.max(0, MGT2Helper.getIntegerFromInput(seed.total));
        if ( DIRECTIONS.includes(seed.direction) ) this.#direction = seed.direction;
        this.#reason = String(seed.reason ?? "");
        this.#ship = seed.spacecraft ?? null;
    }

    /** It never renders for anyone else, and the entry points are GM-gated too. @inheritDoc */
    _canRender(options) {
        if ( !game.user.isGM ) return false;
        return super._canRender(options);
    }

    /* -------------------------------------------- */

    /** The sum to move, in whole credits. */
    #total = 0;

    /** @type {"debit"|"credit"} */
    #direction = "debit";

    /** What the transfer is for, carried onto the card and nowhere else. */
    #reason = "";

    /** The hull the CREW button seeds from, if one was named or dropped. @type {string|null} */
    #ship = null;

    /**
     * The roster, per-client and never persisted. `share` is a fraction of the whole and the rows sum
     * to 1 by construction; `locked` pins one against every later move.
     * @type {{id: string, uuid: string, name: string, share: number, locked: boolean}[]}
     */
    #rows = [];

    /** Set before the first await of the write: validating twice must not debit twice. */
    #applying = false;

    /** @type {CreditSplitResult|null} */
    #result = null;

    /** @type {((result: CreditSplitResult|null) => void)|null} */
    #settle = null;

    /* -------------------------------------------- */
    /*  Seeding                                     */
    /* -------------------------------------------- */

    /**
     * What the window opens on. A caller that names a source gets exactly that source; a referee who
     * opens it by hand gets the epic-rolls heuristic the Docket uses — whoever is selected, and
     * otherwise the active table.
     */
    async #seedRoster(seed) {
        const actors = [];
        for ( const uuid of seed.actors ?? [] ) {
            const actor = await CreditSplit.#resolve(uuid);
            if ( actor ) actors.push(actor);
        }
        if ( seed.spacecraft ) actors.push(...await CreditSplit.#crewOf(seed.spacecraft));
        if ( !seed.actors && !seed.spacecraft ) {
            const controlled = CreditSplit.#controlledActors();
            actors.push(...(controlled.length ? controlled : CreditSplit.#partyActors()));
        }
        this.#add(actors);
    }

    /** Whoever the referee has selected. Naming documents is the permitted side of the canvas line. */
    static #controlledActors() {
        return (canvas?.tokens?.controlled ?? []).map(token => token.actor).filter(actor => actor);
    }

    /** Every active non-GM user's assigned character. */
    static #partyActors() {
        return game.users.filter(user => user.active && !user.isGM && user.character)
            .map(user => user.character);
    }

    /**
     * A hull's crew as payers. `spacecraft.system.crew[]` is a list of STATIONS carrying an optional
     * Actor uuid, so a station nobody mans contributes nothing and one Traveller at two stations is
     * one row — `#add` deduplicates on the uuid.
     */
    static async #crewOf(uuid) {
        const ship = await CreditSplit.#resolve(uuid);
        if ( ship?.type !== "spacecraft" ) return [];
        const actors = [];
        for ( const station of ship.system.crew ?? [] ) {
            const actor = station.actor ? await CreditSplit.#resolve(station.actor) : null;
            if ( actor ) actors.push(actor);
        }
        return actors;
    }

    static async #resolve(uuid) {
        try { return await fromUuid(uuid); } catch { return null; }
    }

    /**
     * Appended, never replaced, and deduplicated on the uuid: adding the party twice adds nobody.
     * Anything that is not a `character` drops out here rather than sitting on the roster as a row
     * with no purse behind it.
     */
    #add(actors) {
        const held = new Set(this.#rows.map(row => row.uuid));
        let added = false;
        for ( const actor of actors ) {
            if ( (actor?.type !== "character") || held.has(actor.uuid) ) continue;
            held.add(actor.uuid);
            this.#rows.push({ id: foundry.utils.randomID(), uuid: actor.uuid, name: actor.name,
                share: 0, locked: false });
            added = true;
        }
        if ( added ) this.#even();
    }

    /* -------------------------------------------- */
    /*  The split                                   */
    /* -------------------------------------------- */

    /**
     * Equal shares over the unlocked rows, of whatever the locks leave. **Every structural change goes
     * through it** — adding or removing a Traveller re-splits — so the rule is one sentence a referee
     * can hold, and a share that has to survive that is what the lock pin is for.
     */
    #even() {
        const free = this.#rows.filter(row => !row.locked);
        if ( !free.length ) return;
        const pool = Math.max(0, 1 - this.#lockedSum());
        for ( const row of free ) row.share = pool / free.length;
    }

    #lockedSum(except) {
        return this.#rows.reduce((sum, row) =>
            (row.locked && (row !== except)) ? sum + row.share : sum, 0);
    }

    /**
     * One row moved, and the whole mechanism. The unlocked others rescale IN PROPORTION to absorb the
     * difference — never re-evened, which would flatten a split the referee had already shaped.
     *
     * The row is clamped by what the locks leave. Where every other row is locked there is nowhere for
     * the difference to go, so it stays unassigned and the foot says so — better than a drag that
     * silently refuses to move.
     */
    #setShare(id, share) {
        const row = this.#rows.find(entry => entry.id === id);
        if ( !row ) return;
        const ceiling = Math.max(0, 1 - this.#lockedSum(row));
        const value = Math.min(ceiling, Math.max(0, share));
        const free = this.#rows.filter(entry => (entry !== row) && !entry.locked);
        const pool = ceiling - value;
        const held = free.reduce((sum, entry) => sum + entry.share, 0);
        // Scaling zero by anything leaves it at zero, so a pool of unlocked rows that are all at
        // nothing comes back evenly instead of being stuck there for the rest of the window.
        if ( held > 0 ) for ( const entry of free ) entry.share = (entry.share * pool) / held;
        else if ( free.length ) for ( const entry of free ) entry.share = pool / free.length;
        row.share = value;
    }

    /**
     * `total` credits divided by `shares`, in whole credits, and the answer to "who gets the odd one".
     *
     * Largest remainder: every row takes the whole credits its share is worth, and the credits the
     * division leaves over go one each to the largest fractions dropped — ties to the largest share,
     * then to the first row on the list. Cr1000 three ways is therefore 334/333/333 and never
     * 333/333/333, and `orphans` names the rows that took one.
     *
     * The pool is what the shares CLAIM rather than the whole sum, so a roster whose shares no longer
     * reach 100 % leaves the difference unassigned instead of having it dumped on the first rows.
     *
     * @param {number[]} shares  Fractions of the whole, summing to 1 or less
     * @param {number} total     Whole credits
     * @returns {{amounts: number[], orphans: number[]}}
     */
    static allocate(shares, total) {
        const raw = shares.map(share => share * total);
        const amounts = raw.map(value => Math.floor(value));
        const pool = Math.round(raw.reduce((sum, value) => sum + value, 0));
        let left = pool - amounts.reduce((sum, value) => sum + value, 0);
        const order = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
            .sort((a, b) => (b.fraction - a.fraction)
                || (shares[b.index] - shares[a.index]) || (a.index - b.index));
        const orphans = [];
        for ( const entry of order ) {
            if ( left <= 0 ) break;
            amounts[entry.index] += 1;
            orphans.push(entry.index);
            left -= 1;
        }
        return { amounts, orphans };
    }

    /**
     * What a payer cannot pay, moved onto the payers who can. Two proportional splits of the same
     * figure — taken off the short rows in proportion to how short they are, handed to the others in
     * proportion to the cash they have spare — so the transfer stays exactly the sum it was.
     *
     * **A locked row is never moved, in either direction.** The pin is what the referee set by hand,
     * and a share that cannot survive this button is not a pin — so a locked payer who is short keeps
     * their shortfall, and the foot goes on naming the debt it will become.
     *
     * @param {{amount: number, cash: number, locked: boolean}[]} rows
     * @returns {number[]}   The amounts after the move, in the same order
     */
    static cover(rows) {
        const amounts = rows.map(row => row.amount);
        const over = rows.map((row, index) => row.locked ? 0 : Math.max(0, amounts[index] - row.cash));
        const slack = rows.map((row, index) => row.locked ? 0 : Math.max(0, row.cash - amounts[index]));
        const sum = values => values.reduce((total, value) => total + value, 0);
        const moved = Math.min(sum(over), sum(slack));
        if ( !moved ) return amounts;
        const taken = CreditSplit.#byWeight(over, moved);
        const given = CreditSplit.#byWeight(slack, moved);
        return amounts.map((amount, index) => amount - taken[index] + given[index]);
    }

    /**
     * `total` credits over integer weights. No row can receive more than its own weight — the largest
     * remainder never rounds a row past its weight while `total` is no larger than their sum, which is
     * what keeps a payer from being handed more slack than they have.
     */
    static #byWeight(weights, total) {
        const sum = weights.reduce((value, weight) => value + weight, 0);
        if ( !sum || !total ) return weights.map(() => 0);
        return CreditSplit.allocate(weights.map(weight => weight / sum), total).amounts;
    }

    /* -------------------------------------------- */
    /*  The reading                                 */
    /* -------------------------------------------- */

    /**
     * The transfer resolved against every row, once. The roster draws it, the foot counts it, the
     * validation gates on it and the write spends it, so the four cannot disagree.
     */
    #reading() {
        const total = this.#total;
        const debit = this.#direction === "debit";
        const held = this.#rows.map(row => {
            const actor = CreditSplit.#actorOf(row.uuid);
            return { ...row, actor, name: actor?.name || row.name,
                cash: actor ? actor.system.finance.credits : null };
        });

        const { amounts, orphans } = CreditSplit.allocate(held.map(row => row.share), total);
        const orphaned = new Set(orphans);
        const rows = held.map((row, index) => {
            const amount = amounts[index];
            const shortfall = (debit && (row.cash !== null)) ? Math.max(0, amount - row.cash) : 0;
            return { ...row, amount,
                percent: (row.share * 100).toFixed(1),
                amountDisplay: MGT2Helper.credits(amount),
                cashDisplay: (row.cash === null) ? null : MGT2Helper.credits(row.cash),
                short: shortfall > 0,
                shortfall,
                shortfallDisplay: MGT2Helper.credits(shortfall),
                orphan: orphaned.has(index),
                // A row whose sheet this client cannot reach would be money going nowhere, so it is
                // a refusal rather than a silent skip — but only once it is owed something.
                lost: !row.actor && (amount > 0) };
        });

        const spare = row => (row.locked || (row.cash === null)) ? 0 : Math.max(0, row.cash - row.amount);
        const owed = row => (row.locked || (row.cash === null)) ? 0 : Math.max(0, row.amount - row.cash);
        const add = (values, read) => values.reduce((sum, value) => sum + read(value), 0);
        const assigned = add(rows, row => row.amount);
        const debt = add(rows, row => row.shortfall);

        return {
            debit, total, rows, assigned, debt,
            unassigned: total - assigned,
            orphans: orphans.map(index => rows[index].name),
            orphanCount: orphans.length,
            payers: rows.filter(row => row.short).length,
            // The button only moves money between UNLOCKED rows, so it goes dead when there is
            // nothing there for it to move rather than when the roster happens to be short.
            canCover: debit && (Math.min(add(rows, owed), add(rows, spare)) > 0),
            lost: rows.some(row => row.lost),
            ready: Boolean(rows.length) && (total > 0) && (assigned === total)
                && !rows.some(row => row.lost)
        };
    }

    /** A row that cannot be read degrades to its stored name and never throws — the roster contract. */
    static #actorOf(uuid) {
        let actor = null;
        try { actor = foundry.utils.fromUuidSync(uuid); } catch { return null; }
        // A packed Actor answers with an index record: a name and a type, and no purse to read.
        return (actor?.type === "character") && actor.system?.finance ? actor : null;
    }

    /* -------------------------------------------- */
    /*  Context                                     */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const reading = this.#reading();
        Object.assign(context, reading, this.#lines(reading), {
            field: FIELD,
            total: this.#total,
            reason: this.#reason,
            rosterTypes: ROSTER_TYPES,
            hasShip: Boolean(this.#ship),
            applyLabel: `MGT2.CreditSplit.Direction.${this.#direction}`,
            directions: DIRECTIONS.map(key => ({
                key,
                label: game.i18n.localize(`MGT2.CreditSplit.Direction.${key}`),
                hint: game.i18n.localize(`MGT2.CreditSplit.DirectionHint.${key}`),
                active: key === this.#direction
            }))
        });
        return context;
    }

    /**
     * The four sentences the foot prints. Built here rather than in the template because `#sync`
     * patches the same four in place, and two sources for one sentence is two sentences.
     */
    #lines(reading) {
        const money = value => MGT2Helper.credits(value);
        return {
            assignedLine: game.i18n.format("MGT2.CreditSplit.OfTotal",
                { assigned: money(reading.assigned), total: money(reading.total) }),
            unassignedLine: reading.unassigned
                ? game.i18n.format("MGT2.CreditSplit.Unassigned", { credits: money(reading.unassigned) })
                : "",
            roundingLine: reading.orphanCount
                ? game.i18n.format("MGT2.CreditSplit.Orphans",
                    { credits: money(reading.orphanCount), names: reading.orphans.join(", ") })
                : "",
            debtLine: reading.debt
                ? game.i18n.format("MGT2.CreditSplit.DebtLine",
                    { credits: money(reading.debt), n: reading.payers })
                : "",
            whatLine: game.i18n.format(`MGT2.CreditSplit.What.${this.#direction}`,
                { credits: money(reading.assigned), n: reading.rows.length })
        };
    }

    /* -------------------------------------------- */
    /*  Listeners                                   */
    /* -------------------------------------------- */

    /** The frame outlives every re-render, so this binds once. @inheritDoc */
    _attachFrameListeners() {
        super._attachFrameListeners();
        // `input` alone. Every control here fires it, a radio included, and adding `change` would
        // renormalise the whole roster twice per drag.
        this.element.addEventListener("input", this.#onField.bind(this));
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        // Re-bound on every render because the roster part carries the zones and is replaced.
        // `DragDrop#bind` ASSIGNS `element.ondragover` rather than adding a listener, so it never
        // stacks.
        this.dragDrop.bind(this.element);
        this.#sync();
    }

    /**
     * One delegated reader for the whole window. A gauge, a percent and a credit figure are three
     * spellings of one number, so all three land on `#setShare` — which is what makes "Alice puts in
     * Cr50000, split the rest" one keystroke rather than a division.
     */
    #onField(event) {
        const input = event.target;
        const gauge = input.dataset.gauge;
        if ( gauge ) {
            const id = input.dataset.row;
            if ( gauge === "credits" ) {
                // No sum typed yet, so credits name no fraction of anything: the field is left where
                // it is rather than resolving to a share of zero and flattening the whole split.
                if ( !this.#total ) return;
                this.#setShare(id, Math.max(0, MGT2Helper.getIntegerFromInput(input.value)) / this.#total);
            }
            else this.#setShare(id, MGT2Helper.getNumberFromInput(input.value) / 100);
            return this.#sync(input);
        }

        const name = input.name;
        if ( !name?.startsWith(FIELD) ) return;
        switch ( name.slice(FIELD.length) ) {
            case "Total":
                this.#total = Math.max(0, MGT2Helper.getIntegerFromInput(input.value));
                break;
            // Nothing derives from it: it is carried onto the card and read by no arithmetic.
            case "Reason": this.#reason = input.value; return;
            // The direction changes what every purse cell MEANS, so the roster is redrawn rather
            // than patched — and it is a click, with no caret to protect.
            case "Direction":
                this.#direction = input.value;
                this.render({ parts: ["roster", "foot"] });
                return;
            default: return;
        }
        this.#sync(input);
    }

    /**
     * The window patched in place rather than re-rendered, and it has to be: a range input replaced
     * mid-drag loses the pointer and a field replaced mid-word loses the caret. Everything below reads
     * the same `#reading()` the roster part renders from, so the two cannot drift.
     * @param {HTMLElement} [skip]   The control the referee is in — never written back over them
     */
    #sync(skip) {
        if ( !this.element ) return;
        const reading = this.#reading();
        for ( const row of reading.rows ) {
            const line = this.element.querySelector(`tr[data-row-id="${row.id}"]`);
            if ( !line ) continue;
            for ( const control of line.querySelectorAll("[data-gauge]") ) {
                if ( control === skip ) continue;
                control.value = (control.dataset.gauge === "credits") ? row.amount : row.percent;
            }
            const purse = line.querySelector('[data-readout="purse"]');
            if ( purse ) purse.textContent = row.cashDisplay ?? "—";
            const shortfall = line.querySelector('[data-readout="shortfall"]');
            if ( shortfall ) shortfall.textContent = row.short ? row.shortfallDisplay : "";
            line.classList.toggle("short", row.short);
            line.classList.toggle("orphan", row.orphan);
            // Only true once the row is owed something, so it appears the moment a sum is typed.
            line.classList.toggle("lost", row.lost);
        }

        const lines = this.#lines(reading);
        for ( const [key, text] of Object.entries(lines) ) {
            const node = this.element.querySelector(`[data-readout="${key}"]`);
            if ( node ) node.textContent = text;
        }
        const asked = this.element.querySelector('[data-readout="asked"]');
        if ( asked ) asked.textContent = String(reading.rows.length);
        this.#show("rounding", reading.orphanCount > 0);
        this.#show("short", reading.debt > 0);
        this.#enable("seedCrew", Boolean(this.#ship));
        this.#enable("cover", reading.canCover);
        this.#enable("apply", reading.ready && !this.#applying);
    }

    #show(block, on) {
        const node = this.element.querySelector(`[data-block="${block}"]`);
        if ( node ) node.hidden = !on;
    }

    #enable(action, on) {
        const node = this.element.querySelector(`button[data-action="${action}"]`);
        if ( node ) node.disabled = !on;
    }

    /* -------------------------------------------- */

    static #onSeedControlled() {
        this.#add(CreditSplit.#controlledActors());
        this.render({ parts: ["roster", "foot"] });
    }

    static #onSeedParty() {
        this.#add(CreditSplit.#partyActors());
        this.render({ parts: ["roster", "foot"] });
    }

    static async #onSeedCrew() {
        if ( !this.#ship ) return;
        this.#add(await CreditSplit.#crewOf(this.#ship));
        this.render({ parts: ["roster", "foot"] });
    }

    static #onClearRoster() {
        this.#rows = [];
        this.render({ parts: ["roster", "foot"] });
    }

    static #onEvenSplit() {
        this.#even();
        this.render({ parts: ["roster", "foot"] });
    }

    /**
     * The pin. What it promises is narrow and exact: no OTHER row's move ever changes this share.
     * The row itself stays live, because re-pinning it is the same act as pinning it.
     */
    static #onToggleLock(event, target) {
        const row = this.#row(target);
        if ( !row ) return;
        row.locked = !row.locked;
        this.render({ parts: ["roster", "foot"] });
    }

    static #onDropRow(event, target) {
        const row = this.#row(target);
        if ( !row ) return;
        this.#rows = this.#rows.filter(entry => entry !== row);
        this.#even();
        this.render({ parts: ["roster", "foot"] });
    }

    #row(target) {
        const id = target.closest("[data-row-id]")?.dataset.rowId;
        return this.#rows.find(entry => entry.id === id) ?? null;
    }

    static async #onOpenDocument(event, target) {
        const actor = await fromUuid(target.dataset.uuid);
        actor?.sheet?.render({ force: true });
    }

    /** The shortfall spread over the payers who have the cash, as whole credits and back into shares. */
    static #onCover() {
        const reading = this.#reading();
        if ( !reading.canCover ) return;
        const amounts = CreditSplit.cover(reading.rows.map(row => ({
            amount: row.amount,
            cash: row.cash ?? 0,
            // A row whose sheet cannot be reached has no purse to read, so it is left where it is.
            locked: row.locked || (row.cash === null)
        })));
        reading.rows.forEach((line, index) => {
            if ( amounts[index] === line.amount ) return;
            const row = this.#rows.find(entry => entry.id === line.id);
            // Only the rows that actually moved are rewritten: rounding a share that did not move
            // back through the credit would drift a pin the referee set by hand.
            if ( row ) row.share = this.#total ? (amounts[index] / this.#total) : 0;
        });
        this.render({ parts: ["roster", "foot"] });
    }

    /* -------------------------------------------- */
    /*  Drag and drop                               */
    /* -------------------------------------------- */

    /**
     * A plain `ApplicationV2` inherits no drag-drop plumbing, so the controller is supplied here as
     * the Docket's is. The refusal at the pointer is free: `MGT2Helper.watchDrags` reads the payload
     * inside `DragDrop`, which is the only place it is readable during `dragover`.
     * @type {DragDrop}
     */
    get dragDrop() {
        return this.#dragDrop ??= new DragDrop.implementation({
            dropSelector: "[data-accept]",
            permissions: { drop: () => game.user.isGM },
            callbacks: {
                dragover: this.#onDragOver.bind(this),
                dragleave: this.#onDragLeave.bind(this),
                drop: this.#onDrop.bind(this)
            }
        });
    }

    /** @type {DragDrop|null} */
    #dragDrop = null;

    #onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        this.#clearDropState(zone);
        if ( !zone ) return;
        zone.classList.add(MGT2Helper.dropAccepted(zone) ? "over" : "deny");
    }

    #onDragLeave(event) {
        const zone = event.target.closest("[data-accept]");
        if ( zone && !zone.contains(event.relatedTarget) ) zone.classList.remove("over", "deny");
    }

    #clearDropState(keep) {
        for ( const node of this.element.querySelectorAll(".over, .deny") ) {
            if ( node !== keep ) node.classList.remove("over", "deny");
        }
    }

    /** The type is tested AFTER the uuid resolves, which is what `data-accept` names a type for. */
    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        const data = MGT2Helper.getDataFromDropEvent(event);
        this.#clearDropState();
        // No `preventDefault`: `DragDrop#_handleDrop` has already called it before dispatching.
        if ( !zone || !game.user.isGM || !MGT2Helper.dropAccepted(zone, data) ) return;
        // Awaited end to end: a packed Actor answers `fromUuidSync` with an index entry.
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor ) return;
        // A hull is the crew source, and dropping one is the ship picker this window deliberately
        // does not build. It holds no purse, so it never becomes a row of its own.
        if ( actor.type === "spacecraft" ) {
            this.#ship = actor.uuid;
            this.#add(await CreditSplit.#crewOf(actor.uuid));
        }
        else this.#add([actor]);
        return this.render({ parts: ["roster", "foot"] });
    }

    /* -------------------------------------------- */
    /*  The write                                   */
    /* -------------------------------------------- */

    /**
     * The one write this window makes, on one explicit press and never as a side effect of a render.
     * Validating twice cannot debit twice: the guard is set before the first await, the button greys
     * with it, and the window closes on the way out.
     * @this {CreditSplit}
     */
    static async #onApply() {
        if ( this.#applying ) return;
        const reading = this.#reading();
        if ( !reading.ready ) {
            return void ui.notifications.error(game.i18n.localize(CreditSplit.#refusal(reading)));
        }
        this.#applying = true;
        this.#sync();

        const debit = reading.debit;
        const entries = [];
        for ( const row of reading.rows ) {
            // The purse is read HERE and not when the window opened: a sheet, a second screen or
            // another referee may have moved it in between.
            const finance = row.actor?.system.finance;
            const before = finance?.credits ?? 0;
            const paid = debit ? Math.min(before, row.amount) : row.amount;
            const debt = debit ? (row.amount - paid) : 0;
            const after = debit ? (before - paid) : (before + row.amount);
            if ( row.actor && row.amount ) {
                const update = { "system.finance.credits": after };
                // Folio 52's shape, verbatim: pay what you have and the remainder is carried as debt.
                // `credits` is `min: 0`, so a naive subtraction would clamp at zero with no error at
                // all and report a payment nobody made. A credit repays no debt — no book prints
                // that, so the figure is shown and left alone.
                if ( debt ) update["system.finance.debt"] = finance.debt + debt;
                await row.actor.update(update);
            }
            entries.push({ uuid: row.uuid, name: row.name, amount: row.amount, paid, debt, before, after });
        }

        const message = await this.#post(entries);
        this.#result = { direction: this.#direction, total: reading.assigned, entries,
            message: message?.id ?? null };
        return this.close();
    }

    /** What stops the transfer, in the order a referee would fix it. */
    static #refusal(reading) {
        if ( !reading.rows.length ) return "MGT2.CreditSplit.Errors.NoRoster";
        if ( reading.total <= 0 ) return "MGT2.CreditSplit.Errors.NoSum";
        if ( reading.lost ) return "MGT2.CreditSplit.Errors.Unreachable";
        return "MGT2.CreditSplit.Errors.Unassigned";
    }

    /**
     * The card, and it is what makes the write honest. §9.35's doctrine is that the referee types it
     * and nothing here writes it; this screen bends that deliberately, so the direction, the sum,
     * every participant's share and every shortfall that became debt go on the log where the table
     * can argue with them.
     */
    async #post(entries) {
        const money = value => MGT2Helper.credits(value);
        const debt = entries.reduce((sum, entry) => sum + entry.debt, 0);
        const content = await foundry.applications.handlebars.renderTemplate(
            `${TEMPLATES}/chat/credit-split.html`, {
                debit: this.#direction === "debit",
                direction: `MGT2.CreditSplit.Direction.${this.#direction}`,
                total: money(entries.reduce((sum, entry) => sum + entry.amount, 0)),
                reason: this.#reason.trim(),
                debt: money(debt),
                hasDebt: debt > 0,
                rows: entries.map(entry => ({ ...entry,
                    amountDisplay: money(entry.amount),
                    debtDisplay: money(entry.debt),
                    afterDisplay: money(entry.after) }))
            });
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content
        });
    }

    /** Closing without validating settles the caller with `null`, which is the cancel it waits on. */
    _onClose(options) {
        super._onClose(options);
        this.#settle?.(this.#result);
        this.#settle = null;
    }
}

/* -------------------------------------------- */

/**
 * The referee's door onto it, beside the trade tools and unlike them GATED: those hand a chapter to
 * the Travellers (Core p.238), and this one moves other people's purses.
 */
export function registerCreditSplit() {
    Hooks.on("getSceneControlButtons", controls => {
        const tools = controls.tokens?.tools;
        if ( !tools || !game.user.isGM ) return;
        tools.creditSplit = {
            name: "creditSplit",
            order: Math.max(...Object.values(tools).map(tool => tool.order ?? 0)) + 1,
            title: "MGT2.CreditSplit.Title",
            icon: "fa-solid fa-money-bill-transfer",
            button: true,
            onChange: () => CreditSplit.open()
        };
    });
}
