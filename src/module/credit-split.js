import { MGT2Helper } from "./helper.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const TEMPLATES = "systems/mgt2/templates";

/** What the roster takes, tested AFTER the uuid resolves. */
const ROSTER_TYPES = "Actor.character Actor.spacecraft";

/** The two ways money moves. Not a CONFIG list: nothing outside this screen reads it. */
const DIRECTIONS = ["debit", "credit"];

/** These controls live in no `<form>`: the screen submits nowhere and reads its own state. */
const FIELD = "cs";

/** A player owns one purse, so the write is asked of a referee's client — `request-answer.js`'s seam. */
export const GIFT_QUERY = "mgt2.gift";
const GIFT_TIMEOUT = 15000;

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
 * @extends {ApplicationV2}
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
     * ONCE so a caret survives a keystroke, while the roster and the foot are a reading of them.
     * @inheritDoc
     */
    static PARTS = {
        form: { template: `${TEMPLATES}/credit-split.html` },
        roster: { template: `${TEMPLATES}/credit-split-roster.html`, scrollable: [""] },
        foot: { template: `${TEMPLATES}/credit-split-foot.html` }
    };

    /**
     * Open the screen and wait for what it applies.
     * @param {number} [seed.total]        The sum, in credits
     * @param {string} [seed.direction]    `debit` (default) or `credit`
     * @param {string[]} [seed.actors]     Actor uuids to seed the roster with; non-characters drop out
     * @param {string} [seed.spacecraft]   A spacecraft uuid — its crew roster seeds the roster, and
     *     the CREW button stays live against that hull afterwards
     * @param {string} [seed.reason]       A line carried onto the chat card
     * @param {string} [seed.source]       An Actor uuid — GIFT MODE: the sum leaves that purse and
     *     the roster receives it. Its owner may open the screen.
     * @returns {Promise<CreditSplitResult|null>}  What was applied, or `null` where the referee closed
     */
    static async open(seed = {}) {
        const source = seed.source ? await CreditSplit.#resolve(seed.source) : null;
        if ( !game.user.isGM && !source?.isOwner ) {
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
        this.#source = seed.source ?? null;
        this.#balances = seed.balances ?? game.settings.get("mgt2", "credit.balances");
        this.#visibility = seed.visibility ?? game.settings.get("mgt2", "credit.visibility");
    }

    /** @inheritDoc */
    _canRender(options) {
        if ( !this.canEdit ) return false;
        return super._canRender(options);
    }

    #source = null;

    get source() {
        return this.#source ? CreditSplit.#actorOf(this.#source) : null;
    }

    /** A gift is its owner's to make; anything else moves other people's money. @type {boolean} */
    get canEdit() {
        return game.user.isGM || (this.source?.isOwner === true);
    }

    /** The sum to move, in whole credits. */
    #total = 0;

    /** @type {"debit"|"credit"} */
    #direction = "debit";

    /** What the transfer is for, carried onto the card and nowhere else. */
    #reason = "";

    /** Both asked per transfer: neither answer holds for every payment a Traveller makes. */
    #balances = false;
    #visibility = "public";

    /** The hull the CREW button seeds from, if one was named or dropped. @type {string|null} */
    #ship = null;

    /**
     * The roster, per-client and never persisted.
     * @type {{id: string, uuid: string, name: string, share: number, locked: boolean}[]}
     */
    #rows = [];

    /** Set before the first await of the write: validating twice must not debit twice. */
    #applying = false;

    /** @type {CreditSplitResult|null} */
    #result = null;

    /** @type {((result: CreditSplitResult|null) => void)|null} */
    #settle = null;

    /** What the window opens on. */
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

    /** A hull's crew as payers. */
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
     */
    #add(actors) {
        const held = new Set(this.#rows.map(row => row.uuid));
        let added = false;
        for ( const actor of actors ) {
            if ( (actor?.type !== "character") || held.has(actor.uuid) ) continue;
            if ( actor.uuid === this.#source ) continue;   // giving to yourself moves nothing
            held.add(actor.uuid);
            this.#rows.push({ id: foundry.utils.randomID(), uuid: actor.uuid, name: actor.name,
                share: 0, locked: false });
            added = true;
        }
        if ( added ) this.#even();
    }

    /** Equal shares over the unlocked rows, of whatever the locks leave. */
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

    /** One row moved, and the whole mechanism. */
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
     * `total` credits divided by `shares`, in whole credits, and the answer to "who gets the odd
     * one".
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
     * What a payer cannot pay, moved onto the payers who can.
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

    /** `total` credits over integer weights. */
    static #byWeight(weights, total) {
        const sum = weights.reduce((value, weight) => value + weight, 0);
        if ( !sum || !total ) return weights.map(() => 0);
        return CreditSplit.allocate(weights.map(weight => weight / sum), total).amounts;
    }

    /** The transfer resolved against every row, once. */
    #reading() {
        const total = this.#total;
        const source = this.source;
        const gift = Boolean(this.#source);
        // A gift reads exactly one purse and never ends in debt: nobody gives what they do not have.
        const purse = source ? source.system.finance.credits : null;
        const overdrawn = gift && (total > (purse ?? 0));
        const debit = !gift && (this.#direction === "debit");
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
            gift, overdrawn,
            sourceName: source?.name ?? null,
            sourceCash: (purse === null) ? null : MGT2Helper.credits(purse),
            unassigned: total - assigned,
            orphans: orphans.map(index => rows[index].name),
            orphanCount: orphans.length,
            payers: rows.filter(row => row.short).length,
            // The button only moves money between UNLOCKED rows, so it goes dead when there is
            // nothing there for it to move rather than when the roster happens to be short.
            canCover: debit && (Math.min(add(rows, owed), add(rows, spare)) > 0),
            lost: rows.some(row => row.lost),
            ready: Boolean(rows.length) && (total > 0) && (assigned === total)
                && !rows.some(row => row.lost) && !overdrawn && (!gift || Boolean(source))
        };
    }

    /** A row that cannot be read degrades to its stored name and never throws — the roster contract. */
    static #actorOf(uuid) {
        let actor = null;
        try { actor = foundry.utils.fromUuidSync(uuid); } catch { return null; }
        // A packed Actor answers with an index record: a name and a type, and no purse to read.
        return (actor?.type === "character") && actor.system?.finance ? actor : null;
    }

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
            showPurses: game.user.isGM,
            balances: this.#balances,
            addressed: this.#visibility === "addressed",
            applyLabel: this.#source
                ? "MGT2.CreditSplit.Give" : `MGT2.CreditSplit.Direction.${this.#direction}`,
            directions: DIRECTIONS.map(key => ({
                key,
                label: game.i18n.localize(`MGT2.CreditSplit.Direction.${key}`),
                hint: game.i18n.localize(`MGT2.CreditSplit.DirectionHint.${key}`),
                active: key === this.#direction
            }))
        });
        return context;
    }

    /** The four sentences the foot prints. */
    #lines(reading) {
        const money = value => MGT2Helper.credits(value);
        const what = reading.gift ? "gift" : this.#direction;
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
            whatLine: game.i18n.format(`MGT2.CreditSplit.What.${what}`,
                { credits: money(reading.assigned), n: reading.rows.length })
        };
    }

    /** The frame outlives every re-render, so this binds once. @inheritDoc */
    _attachFrameListeners() {
        super._attachFrameListeners();
        // `input` alone.
        this.element.addEventListener("input", this.#onField.bind(this));
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        // Re-bound on every render because the roster part carries the zones and is replaced.
        this.dragDrop.bind(this.element);
        this.#sync();
    }

    /** One delegated reader for the whole window. */
    #onField(event) {
        const input = event.target;
        const gauge = input.dataset.gauge;
        if ( gauge ) {
            const id = input.dataset.row;
            if ( gauge === "credits" ) {
                // No sum typed yet, so credits name no fraction of anything: the field is left
                // where it is rather than resolving to a share of zero and flattening the whole
                // split.
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
            case "Balances": this.#balances = input.checked; return;
            case "Private": this.#visibility = input.checked ? "addressed" : "public"; return;
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
     * mid-drag loses the pointer and a field replaced mid-word loses the caret.
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
        const giver = this.element.querySelector(".giver");
        if ( giver ) {
            giver.classList.toggle("bad", reading.overdrawn);
            giver.querySelector('[data-readout="sourceCash"]').textContent =
                game.i18n.format("MGT2.CreditSplit.Holds", { credits: reading.sourceCash ?? "0" });
        }
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

    /**
     * A plain `ApplicationV2` inherits no drag-drop plumbing, so the controller is supplied here as
     * the Docket's is.
     * @type {DragDrop}
     */
    get dragDrop() {
        return this.#dragDrop ??= new DragDrop.implementation({
            dropSelector: "[data-accept]",
            permissions: { drop: () => this.canEdit },
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
        if ( !zone || !this.canEdit || !MGT2Helper.dropAccepted(zone, data) ) return;
        // Awaited end to end: a packed Actor answers `fromUuidSync` with an index entry.
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor ) return;
        // A hull is the crew source, and dropping one is the ship picker this window deliberately
        // does not build.
        if ( actor.type === "spacecraft" ) {
            this.#ship = actor.uuid;
            this.#add(await CreditSplit.#crewOf(actor.uuid));
        }
        else this.#add([actor]);
        return this.render({ parts: ["roster", "foot"] });
    }

    /**
     * The one write this window makes, on one explicit press and never as a side effect of a
     * render.
     */
    static async #onApply() {
        if ( this.#applying ) return;
        const reading = this.#reading();
        if ( !reading.ready ) {
            return void ui.notifications.error(game.i18n.localize(CreditSplit.#refusal(reading)));
        }
        this.#applying = true;
        this.#sync();

        if ( reading.gift ) {
            const result = await CreditSplit.#giveAway(
                this.#source, reading, this.#reason, this.#balances, this.#visibility);
            if ( !result ) { this.#applying = false; return void this.#sync(); }
            this.#result = result;
            return this.close();
        }

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
                // Folio 52's shape, verbatim: pay what you have and the remainder is carried as
                // debt.
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

    static #giftPayload(source, reading, reason, balances, visibility) {
        return { source, reason: String(reason ?? "").trim(), balances: balances === true, visibility,
            entries: reading.rows.filter(row => row.amount > 0)
                .map(row => ({ uuid: row.uuid, amount: row.amount })) };
    }

    /**
     * A player owns their own purse and nobody else's, so the write happens on a referee's client.
     * @returns {Promise<CreditSplitResult|null>}
     */
    static async #giveAway(source, reading, reason, balances, visibility) {
        const payload = CreditSplit.#giftPayload(source, reading, reason, balances, visibility);
        if ( game.user.isGM ) return CreditSplit.applyGift(payload, { user: game.user });

        const gm = game.users.activeGM;
        if ( !gm ) {
            ui.notifications.error(game.i18n.localize("MGT2.CreditSplit.Errors.NoGM"));
            return null;
        }
        try {
            return await gm.query(GIFT_QUERY, payload, { timeout: GIFT_TIMEOUT });
        } catch(err) {
            ui.notifications.error(game.i18n.localize("MGT2.CreditSplit.Errors.GiftRefused"));
            console.warn(`mgt2 | the gift was refused by the referee's client: ${err.message}`);
            return null;
        }
    }

    /**
     * The only place a gift is written, and it re-checks everything the sending client claimed —
     * that client is trusted with no purse but its own.
     * @param {object} context   The query context; `user` is the server's word for who asked
     * @returns {Promise<CreditSplitResult|null>}
     */
    static async applyGift({ source, reason, entries, balances, visibility } = {}, { user } = {}) {
        const giver = source ? await CreditSplit.#resolve(source) : null;
        if ( (giver?.type !== "character") || !user ) throw new Error("the giver is not a Traveller");
        if ( !giver.testUserPermission(user, "OWNER") ) throw new Error(`${user.name} does not own ${giver.name}`);

        const rows = [];
        let total = 0;
        for ( const entry of entries ?? [] ) {
            const actor = await CreditSplit.#resolve(entry.uuid);
            const amount = Math.max(0, Math.trunc(Number(entry.amount) || 0));
            if ( (actor?.type !== "character") || !amount ) continue;
            rows.push({ actor, amount });
            total += amount;
        }
        const purse = giver.system.finance.credits;
        // Re-read here: the purse may have moved since the window opened, and a gift owes no debt.
        if ( !rows.length || (total > purse) ) throw new Error("the purse no longer covers the gift");

        await giver.update({ "system.finance.credits": purse - total });
        const applied = [];
        for ( const row of rows ) {
            const before = row.actor.system.finance.credits;
            await row.actor.update({ "system.finance.credits": before + row.amount });
            applied.push({ uuid: row.actor.uuid, name: row.actor.name, amount: row.amount,
                paid: row.amount, debt: 0, before, after: before + row.amount });
        }

        const message = await CreditSplit.#postGift(
            giver, purse - total, applied, reason, balances === true, visibility);
        return { direction: "gift", total, entries: applied, message: message?.id ?? null };
    }

    /** What stops the transfer, in the order a referee would fix it. */
    static #refusal(reading) {
        if ( reading.gift && reading.overdrawn ) return "MGT2.CreditSplit.Errors.Overdrawn";
        if ( !reading.rows.length ) return "MGT2.CreditSplit.Errors.NoRoster";
        if ( reading.total <= 0 ) return "MGT2.CreditSplit.Errors.NoSum";
        if ( reading.lost ) return "MGT2.CreditSplit.Errors.Unreachable";
        return "MGT2.CreditSplit.Errors.Unassigned";
    }

    /** `Addressed` reaches the referees and whoever owns a purse the transfer touched. */
    static #audience(visibility, actors) {
        if ( visibility !== "addressed" ) return {};
        const recipients = new Set(ChatMessage.getWhisperRecipients("GM").map(user => user.id));
        for ( const user of game.users ) {
            if ( actors.some(actor => actor?.testUserPermission(user, "OWNER")) ) recipients.add(user.id);
        }
        return { whisper: [...recipients] };
    }

    static async #postGift(giver, left, entries, reason, balances, visibility) {
        const money = value => MGT2Helper.credits(value);
        const content = await foundry.applications.handlebars.renderTemplate(
            `${TEMPLATES}/chat/credit-split.html`, {
                gift: true,
                balances,
                giver: giver.name,
                giverLeft: balances ? money(left) : null,
                direction: "MGT2.CreditSplit.Give",
                total: money(entries.reduce((sum, entry) => sum + entry.amount, 0)),
                reason: String(reason ?? "").trim(),
                rows: entries.map(entry => ({ ...entry,
                    amountDisplay: money(entry.amount),
                    afterDisplay: money(entry.after) }))
            });
        const touched = [giver, ...entries.map(entry => CreditSplit.#actorOf(entry.uuid))];
        return getDocumentClass("ChatMessage").create({
            author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: giver }), content,
            ...CreditSplit.#audience(visibility, touched) });
    }

    /** The card, and it is what makes the write honest. */
    async #post(entries) {
        const money = value => MGT2Helper.credits(value);
        const debt = entries.reduce((sum, entry) => sum + entry.debt, 0);
        const content = await foundry.applications.handlebars.renderTemplate(
            `${TEMPLATES}/chat/credit-split.html`, {
                debit: this.#direction === "debit",
                balances: this.#balances,
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
            content,
            ...CreditSplit.#audience(this.#visibility, entries.map(entry => CreditSplit.#actorOf(entry.uuid)))
        });
    }

    /** Closing without validating settles the caller with `null`, which is the cancel it waits on. */
    _onClose(options) {
        super._onClose(options);
        this.#settle?.(this.#result);
        this.#settle = null;
    }
}

/**
 * The referee's door onto it, beside the trade tools and unlike them GATED: those hand a chapter to
 * the Travellers (Core p.238), and this one moves other people's purses.
 */
export function registerCreditSplit() {
    CONFIG.queries[GIFT_QUERY] = CreditSplit.applyGift;

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
