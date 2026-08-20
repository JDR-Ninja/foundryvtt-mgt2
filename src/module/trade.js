import { MGT2 } from "./config.js";
import { CreditSplit } from "./credit-split.js";
import { CargoData } from "./datamodels.js";
import { MGT2Helper } from "./helper.js";
import { StopTraffic } from "./stop-traffic.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

/** One market and one hull: the screen reads a world and delivers into a ship, and takes nothing else. */
const WORLD_TYPE = "Actor.world";
const SHIP_TYPE = "Actor.spacecraft";

/**
 * The `mgt2-data` module ships the same thirty-six rows as `cargo` Items, keyed by their D66 and
 * carrying an icon and the printed blurb.
 */
const GOODS_PACK = "mgt2-data.items";
const GOODS_KEY = "flags.mgt2-data.d66";

/** The Trade Goods table in D66 order, so a row can own a fixed slot of the dice pool. */
const D66_KEYS = Object.freeze(Object.keys(MGT2.TradeGoods));

/** The widest Tons column is `2D × 20`, and therefore one row's slot. */
const DICE_PER_ROW = 2;

/**
 * Attempts drawn per random row, so that a legal supplier's 61-65 can be skipped rather than
 * re-rolled one await at a time.
 */
const STOCK_TRIES = 4;

/** Speculative trade: the shelf a supplier has, and what one lot costs or fetches. */
export class SpecTrade {

    /** Every key a Purchase or Sale DM column can name. */
    static codesOf(uwp, zone) {
        const codes = MGT2.TradeCodes.filter(row => row.test(uwp)).map(row => row.code);
        return ((zone === "amber") || (zone === "red")) ? [...codes, zone] : codes;
    }

    /** What a code prints as, whichever of the two lists it came from. */
    static codeLabel(code) {
        return MGT2.TradeCodes.find(row => row.code === code)?.label
            ?? MGT2.TravelZones[code]?.label ?? code;
    }

    /**
     * Core p.242: a supplier stocks every Common good, plus every good one of the world's codes
     * matches.
     */
    static stock(codes, blackMarket) {
        return Object.values(MGT2.TradeGoods).filter(row => !row.exotic
            && (blackMarket || !row.illegal)
            && ((row.availability === null) || row.availability.some(code => codes.includes(code))));
    }

    /** The winning row of one DM column. */
    static best(rows, codes) {
        const dm = CargoData.bestDM(rows, codes);
        const row = rows.find(entry => codes.includes(entry.code) && (entry.dm === dm));
        return { dm, code: row?.code ?? null };
    }

    /**
     * Both DM columns of one good against one world, with the smuggler's overlay on the sale side.
     */
    static columns(goods, codes, { lawLevel, bannedAt }) {
        const purchase = SpecTrade.best(goods.purchase, codes);
        const sale = SpecTrade.best(goods.sale, codes);
        const local = (bannedAt === null) ? 0 : Math.max(0, lawLevel - bannedAt);
        return {
            purchase,
            sale: (local > sale.dm) ? { dm: local, code: "law", banned: bannedAt } : sale
        };
    }

    /** One transaction. */
    static reading(side, goods, columns, input, roll) {
        const own = (side === "purchase") ? columns.purchase : columns.sale;
        const other = (side === "purchase") ? columns.sale : columns.purchase;
        const terms = [StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.Broker"), input.broker)];

        // Core p.242: the hired local broker's own DM, printed as a term of its own so a table can
        // see whether it has already been typed into the Broker box beside it.
        if ( input.localBroker ) {
            terms.push(StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.LocalBroker"),
                MGT2.SpeculativeTrade.localBrokerDM));
        }
        if ( own.code ) terms.push(StopTraffic.term(SpecTrade.termLabel(own), own.dm, true));
        if ( other.code ) terms.push(StopTraffic.term(SpecTrade.termLabel(other), -other.dm));
        terms.push(StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.OtherBroker"), -input.otherBroker));

        const dm = terms.reduce((sum, term) => sum + term.dm, 0);
        const label = `MGT2.Trade.Side.${side}`;
        if ( roll === null ) return { side, label, terms, dm };

        const total = roll + dm;
        const percent = MGT2.readTable(MGT2.ModifiedPrice, total)[side];
        const perTon = Math.round(goods.basePrice * percent / 100);
        return { side, label, terms, dm, roll, total, percent,
            perTon: MGT2Helper.credits(perTon) };
    }

    /**
     * Core p.242's local broker charges "a flat fee of 10% of the gross proceeds of a transaction",
     * and a fixer handling illegal goods charges 20%.
     * @param {number} gross     What the goods themselves change hands at
     * @param {object} input     The screen's reading — `localBroker` decides whether any fee is due
     * @param {boolean} illegal  Whether this transaction is the fixer's rather than the broker's
     * @returns {{rate: number, fee: number, due: number, net: number}}
     */
    static brokerFee(gross, input, illegal) {
        const rate = !input.localBroker ? 0
            : (illegal ? MGT2.SpeculativeTrade.fixerFee : MGT2.SpeculativeTrade.brokerFee);
        const fee = Math.round(gross * rate / 100);
        return { rate, fee, due: gross + fee, net: gross - fee };
    }

    /** A DM row names its code, or the Law Level a smuggled cargo is banned at. */
    static termLabel(column) {
        return (column.code === "law")
            ? game.i18n.format("MGT2.Trade.Terms.Banned", { law: column.banned })
            : game.i18n.localize(SpecTrade.codeLabel(column.code));
    }

    /** The Tons column, rolled. */
    static tons(goods, population, dice) {
        const dm = MGT2.readTable(MGT2.SpeculativeTrade.population, population).dm;
        const parts = dice.slice(0, goods.dice);
        const raw = parts.reduce((sum, die) => sum + die, 0) + dm;
        return { parts, dm, raw, tons: Math.max(0, raw) * goods.multiplier };
    }

    /** Finding the supplier at all. */
    static search(uwp, attempts, roll = null) {
        const port = MGT2.Starports[uwp.starport] ?? MGT2.Starports.X;
        const terms = [StopTraffic.term(
            game.i18n.format("MGT2.Trade.Terms.Starport", { port: uwp.starport }), port.searchDM)];
        if ( attempts ) {
            terms.push(StopTraffic.term(MGT2Helper.plural("MGT2.Trade.Terms.Attempts", attempts),
                attempts * MGT2.SpeculativeTrade.attemptDM));
        }
        const dm = terms.reduce((sum, term) => sum + term.dm, 0);
        const target = MGT2.DifficultyTargets.Average;
        if ( roll === null ) return { terms, dm, target };
        const total = roll + dm;
        return { terms, dm, target, roll, total, effect: total - target, found: total >= target };
    }
}

/**
 * The speculative block — the shelf, the tonnage and both prices of one stop.
 * @extends {ApplicationV2}
 */
export class SpecTradeDialog extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-spec-trade",
        classes: ["mgt2", "spectrade"],
        position: { width: 780, height: 860 },
        window: { resizable: true, icon: "fa-solid fa-scale-balanced",
            title: "MGT2.Trade.Speculative" },
        actions: {
            rollSearch: SpecTradeDialog.#onRollSearch,
            rollStock: SpecTradeDialog.#onRollStock,
            rollPrice: SpecTradeDialog.#onRollPrice,
            buyLot: SpecTradeDialog.#onBuyLot,
            sellLot: SpecTradeDialog.#onSellLot,
            walkAway: SpecTradeDialog.#onWalkAway,
            slotClear: SpecTradeDialog.#onSlotClear,
            openDocument: SpecTradeDialog.#onOpenDocument,
            pick: SpecTradeDialog.#onPick,
            post: SpecTradeDialog.#onPost
        }
    };

    /** @inheritDoc */
    static PARTS = {
        form: { template: "systems/mgt2/templates/trade.html" },
        results: { template: "systems/mgt2/templates/trade-results.html", scrollable: [""] }
    };

    /** The typed values. None of it is persisted: a stop is answered once. */
    #input = {
        world: "", zone: "green", goods: "11",
        broker: 0, otherBroker: MGT2.SpeculativeTrade.otherBroker,
        attempts: 0, blackMarket: false, bannedAt: "", localBroker: false
    };

    /**
     * The shelf's dice, rolled once and kept.
     * @type {{quantity: number[], stock: string[]}|null}
     */
    #dice = null;

    /**
     * The two 3D, kept apart from the shelf's: they are different acts a stop apart, and folding
     * them into one store would make a rolled shelf read as a price of zero.
     * @type {{purchase: number, sale: number}|null}
     */
    #price = null;

    /** The `Roll` behind `#price`, kept so the posted card can carry it. */
    #priceRoll = null;

    /**
     * The supplier search, kept as the 2D AND the attempt count it was rolled at.
     * @type {{attempts: number, roll: number}|null}
     */
    #search = null;

    /** The `Roll` behind `#search`, on the card for the same reason as the price's. */
    #searchRoll = null;

    /** The market, when one was dropped. @type {Actor|null} */
    #world = null;

    /** The hull that takes delivery. @type {Actor|null} */
    #ship = null;

    /**
     * What this supplier has already sold, by D66. Core p.242 rolls the tonnage as the stock the
     * supplier HAS, so a lot bought is a lot gone — a second press would buy cargo that is not
     * there.
     * @type {Set<string>}
     */
    #bought = new Set();

    /** One counter, one transaction: a second split window open beside the first would debit twice. */
    #busy = false;

    /** @type {Actor|null} */
    get world() {
        return this.#world;
    }

    /** @type {Actor|null} */
    get ship() {
        return this.#ship;
    }

    /**
     * One window: a second would answer the same market twice with different dice.
     * @param {Actor} [options.world]   A `world` to put in the slot before the window opens
     */
    static open({ world } = {}) {
        const screen = foundry.applications.instances.get("mgt2-spec-trade") ?? new SpecTradeDialog();
        if ( world ) screen.seed(world);
        return screen.render({ force: true });
    }

    /**
     * Put a world in the slot, which fills the typed fields from it and keeps the handle.
     * @returns {Actor|null}
     */
    seed(actor) {
        if ( actor?.type !== "world" ) return null;
        if ( actor.uuid !== this.#world?.uuid ) this.#forget();
        this.#world = actor;
        this.#input.world = actor.system.profile;
        this.#input.zone = actor.system.zone;
        return actor;
    }

    /** Back to hand mode. The typed count inherits what the world was showing, so no DM moves. */
    #unseed() {
        this.#input.attempts = this.standing?.attemptsThisMonth ?? this.#input.attempts;
        this.#world = null;
    }

    /** A different market is a different shelf, a different price and a different supplier. */
    #forget() {
        this.#dice = null;
        this.#price = null;
        this.#priceRoll = null;
        this.#search = null;
        this.#searchRoll = null;
        this.#bought.clear();
    }

    /** Every document this screen has written into `apps`, which is not the same as the two slots. */
    #registered = new Set();

    /**
     * `document.apps` is the only re-render mechanism there is, and here it is what keeps the two
     * counters from being two: a stamp made on the world sheet redraws this screen's standing, so
     * the count that drives the DM is never a stale copy of the document's.
     */
    #syncRegistrations(documents) {
        const wanted = new Set(documents.filter(document => document));
        for ( const document of this.#registered ) {
            if ( !wanted.has(document) ) delete document.apps[this.id];
        }
        for ( const document of wanted ) document.apps[this.id] = this;
        this.#registered = wanted;
    }

    /**
     * `_tearDown` and not `_onClose`: it runs synchronously before the state flips to CLOSED, while
     * `_onClose` is dispatched unawaited.
     * @inheritDoc
     */
    _tearDown(options) {
        super._tearDown(options);
        for ( const document of this.#registered ) delete document.apps[this.id];
        this.#registered = new Set();
    }

    /** What the dropped world says about its suppliers, against the campaign's own *now*. */
    get standing() {
        return this.#world ? this.#world.system.tradeStanding(campaignDay()) : null;
    }

    /**
     * The gate the world sheet's own four buttons take, said out loud: `DocumentSheetV2` disables
     * the whole form below OWNER, and a `world` hands the players OBSERVER.
     */
    get canWrite() {
        return Boolean(this.#world?.canUserModify(game.user, "update"));
    }

    /** The gate on the two acts that move money. */
    get canTrade() {
        return game.user.isGM && Boolean(this.#ship?.canUserModify(game.user, "update"));
    }

    /** The profile parsed and the numbers coerced once, so nothing below has to. */
    get reading() {
        const parsed = StopTraffic.parseLine(this.#input.world);
        const banned = String(this.#input.bannedAt).trim();
        const standing = this.standing;
        return {
            ...parsed,
            zone: parsed.zone ?? this.#input.zone,
            goods: this.#input.goods,
            broker: Math.trunc(Number(this.#input.broker) || 0),
            otherBroker: Math.trunc(Number(this.#input.otherBroker) || 0),
            // A dropped world OWNS the count: Core p.241 keys it to the planet and the month, and
            // two independent counters for one rule is what stamps a single search twice.
            attempts: standing ? standing.attemptsThisMonth
                : Math.max(0, Math.trunc(Number(this.#input.attempts) || 0)),
            blackMarket: this.#input.blackMarket === true,
            localBroker: this.#input.localBroker === true,
            // Blank is "nobody bans this", which is a different statement from Law Level 0.
            bannedAt: banned === "" ? null : Math.max(0, Math.trunc(Number(banned) || 0))
        };
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const input = this.reading;
        this.#syncRegistrations([this.#world, this.#ship]);
        Object.assign(context, {
            config: MGT2,
            // The count is the world's while one is in the slot, so the box shows what drives the DM.
            input: { ...this.#input, attempts: input.attempts },
            zones: MGT2.TravelZones,
            goodsList: Object.fromEntries(Object.values(MGT2.TradeGoods)
                .map(row => [row.d66, `${row.d66} · ${game.i18n.localize(row.label)}`])),
            gloss: marketGloss(input),
            worldType: WORLD_TYPE,
            shipType: SHIP_TYPE,
            slot: this.#slot(),
            hold: SpecTradeDialog.#hold(this.#ship),
            linked: this.#world !== null,
            canWrite: this.canWrite,
            ready: Boolean(input.uwp),
            rolled: this.#dice !== null,
            priced: this.#price !== null
        });
        if ( !context.ready ) return context;

        const codes = SpecTrade.codesOf(input.uwp, input.zone);
        const goods = MGT2.TradeGoods[input.goods] ?? MGT2.TradeGoods["11"];
        const columns = SpecTrade.columns(goods, codes,
            { lawLevel: input.uwp.lawLevel, bannedAt: input.bannedAt });

        context.codes = codes.map(code => ({ code, label: SpecTrade.codeLabel(code),
            zone: !MGT2.TradeCodes.some(row => row.code === code) }));
        // Two readings of the same rule: what the NEXT search costs, and the one already rolled
        // read against the count it was rolled at.
        context.search = SpecTrade.search(input.uwp, input.attempts);
        context.searched = this.#search
            ? SpecTrade.search(input.uwp, this.#search.attempts, this.#search.roll) : null;
        context.shelf = SpecTrade.stock(codes, input.blackMarket)
            .map(row => this.#shelfRow(row, input, codes));
        context.drawn = (this.#dice?.stock ?? [])
            .map(d66 => this.#shelfRow(MGT2.TradeGoods[d66], input, codes));
        context.goods = goods;
        const readings = ["purchase", "sale"].map(side => SpecTrade.reading(side, goods, columns,
            input, this.#price ? this.#price[side] : null));
        context.readings = readings;
        context.lot = this.#shelfRow(goods, input, codes);
        context.offer = this.#offer(goods, input, readings.find(read => read.side === "purchase"));
        context.lots = this.#lots(input, codes);
        // Every figure in the hold column already has the broker's cut out of it, which the column
        // itself cannot say.
        context.brokered = input.localBroker;
        context.canTrade = this.canTrade;
        context.canPost = context.rolled || context.priced || (context.searched !== null);
        return context;
    }

    /**
     * The lot on the table: the rolled tonnage of the selected good, and what the settled purchase
     * percentage makes it cost.
     */
    #offer(goods, input, purchase) {
        if ( !this.#dice || !this.#price || (goods.exotic === true) ) return null;
        const slot = D66_KEYS.indexOf(goods.d66) * DICE_PER_ROW;
        const { tons } = SpecTrade.tons(goods, input.uwp.population,
            this.#dice.quantity.slice(slot, slot + DICE_PER_ROW));
        const total = Math.round(tons * goods.basePrice * purchase.percent / 100);
        // Core p.242: the broker's cut rides on top of a purchase, so what the crew is debited is
        // not what the goods cost.
        const fee = SpecTrade.brokerFee(total, input, input.blackMarket || (goods.illegal === true));
        const hold = this.#ship ? this.#ship.system.cargo : null;
        // What stops the purchase, in the order a referee would fix it.
        const blocked = !hold ? "MGT2.Trade.NeedAShip"
            : (total <= 0) ? "MGT2.Trade.NoneInStock"
                : this.#bought.has(goods.d66) ? "MGT2.Trade.LotTaken"
                    : !this.canTrade ? "MGT2.Trade.RefereeTrades" : null;
        return {
            tons, total, percent: purchase.percent, credits: MGT2Helper.credits(total), blocked,
            rate: fee.rate, fee: fee.fee, due: fee.due,
            feeCredits: MGT2Helper.credits(fee.fee), dueCredits: MGT2Helper.credits(fee.due),
            capacity: hold?.capacity ?? 0, free: hold?.free ?? 0,
            // Core p.241: a lot cannot be broken up, so a hold with room for part of it has room
            // for none of it.
            overFree: Boolean(hold) && (tons > hold.free),
            overHold: Boolean(hold) && (tons > hold.capacity),
            ready: !blocked && !this.#busy
        };
    }

    /** What the hold is carrying, each lot priced against THIS market. */
    #lots(input, codes) {
        if ( !this.#ship ) return [];
        const capacity = this.#ship.system.cargo.capacity;
        return this.#ship.items.filter(item => item.type === "cargo").map(item => {
            const lot = item.system;
            const row = { purchase: lot.purchaseDM, sale: lot.saleDM, basePrice: lot.basePrice };
            const columns = SpecTrade.columns(row, codes,
                // Blank on the form falls back to what the lot itself records, which is the same
                // statement stored rather than typed.
                { lawLevel: input.uwp.lawLevel, bannedAt: input.bannedAt ?? lot.legality });
            const read = SpecTrade.reading("sale", row, columns, input,
                this.#price ? this.#price.sale : null);
            const priced = lot.speculative && read.percent;
            const total = priced ? Math.round(lot.tons * lot.basePrice * read.percent / 100) : 0;
            // The fee comes OUT of a sale (Core p.242).
            const fee = SpecTrade.brokerFee(total, input,
                input.blackMarket || (lot.illegal === true) || (lot.legality !== null));
            return {
                id: item.id, name: item.name, tons: lot.tons, speculative: lot.speculative,
                sale: SpecTradeDialog.tone(read.dm), percent: priced ? read.percent : null,
                total, net: fee.net, fee: fee.fee, rate: fee.rate,
                credits: MGT2Helper.credits(fee.net),
                over: lot.tons > capacity,
                sellable: (total > 0) && !this.#busy && this.canTrade
            };
        });
    }

    /** The market slot: which document is in it, and the two facts this screen can write to it. */
    #slot() {
        const standing = this.standing;
        if ( !standing ) return { linked: false };
        const system = this.#world.system;
        return {
            linked: true,
            uuid: this.#world.uuid,
            name: this.#world.name,
            profile: system.profile,
            codes: system.codes.join(" "),
            attempts: standing.attemptsThisMonth,
            searchDM: standing.searchDM,
            closedUntil: standing.closedUntil
        };
    }

    /**
     * The hull slot: the designed `cargo.capacity` against the tonnage the ship's own manifest sums
     * out of its `cargo` Items.
     */
    static #hold(ship) {
        if ( !ship ) return { linked: false };
        const cargo = ship.system.cargo;
        return { linked: true, uuid: ship.uuid, name: ship.name,
            capacity: cargo.capacity, used: cargo.used, free: cargo.free, over: cargo.over === true };
    }

    /** One shelf line: what it is, how much of it there is and what the two columns say. */
    #shelfRow(goods, input, codes) {
        const columns = SpecTrade.columns(goods, codes,
            { lawLevel: input.uwp.lawLevel, bannedAt: input.bannedAt });
        const slot = D66_KEYS.indexOf(goods.d66) * DICE_PER_ROW;
        const rolled = this.#dice
            ? SpecTrade.tons(goods, input.uwp.population, this.#dice.quantity.slice(slot, slot + DICE_PER_ROW))
            : null;
        // Exotics carry no statistics at all, so the row prints none rather than a row of zeroes.
        const exotic = goods.exotic === true;
        return {
            d66: goods.d66, label: goods.label, illegal: goods.illegal, exotic,
            size: exotic ? "—"
                : (goods.multiplier > 1) ? `${goods.dice}D×${goods.multiplier}` : `${goods.dice}D`,
            basePrice: exotic ? "—" : MGT2Helper.credits(goods.basePrice),
            purchase: SpecTradeDialog.tone(columns.purchase.dm),
            sale: SpecTradeDialog.tone(columns.sale.dm),
            selected: goods.d66 === input.goods,
            tons: exotic ? "—" : (rolled?.tons ?? null),
            empty: rolled ? (rolled.tons === 0) : false
        };
    }

    /** The three colours a DM cell takes, shared by every column on the page. */
    static tone(dm) {
        return { dm, tone: (dm > 0) ? "pos" : ((dm < 0) ? "neg" : "nil") };
    }

    /**
     * One delegated listener on the application root, so it survives the results part being
     * replaced on every keystroke.
     * @inheritDoc
     */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this.element.addEventListener("input", event => {
            const field = event.target.closest("[data-field]")?.dataset.field;
            if ( !field ) return;
            this.#input[field] = (event.target.type === "checkbox") ? event.target.checked : event.target.value;
            this.#syncGloss();
            this.render({ parts: ["results"] });
        });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        // Re-bound on every render because the form part carries the slots and is replaced.
        this.dragDrop.bind(this.element);
    }

    /** The readout beside the profile field lives in the part that never re-renders, so it is patched. */
    #syncGloss() {
        const parsed = StopTraffic.parseLine(this.#input.world);
        const field = this.element.querySelector(".fld.world");
        if ( !field ) return;
        field.classList.toggle("bad", Boolean(this.#input.world) && !parsed.uwp);
        const gloss = field.querySelector(".g");
        if ( gloss ) gloss.textContent = marketGloss(parsed);
        const zone = field.parentElement.querySelector('[data-field="zone"]');
        if ( zone && parsed.zone ) {
            zone.value = parsed.zone;
            this.#input.zone = parsed.zone;
        }
    }

    /** Clicking a shelf line selects it; the select in the header is the same control by another name. */
    static #onPick(event, target) {
        this.#input.goods = target.dataset.d66;
        const select = this.element.querySelector('[data-field="goods"]');
        if ( select ) select.value = this.#input.goods;
        this.render({ parts: ["results"] });
    }

    /**
     * Finding a supplier at all: an Average (8+) check at the Starport DM (Core p.242), less one
     * per search already made here this month (Core p.241).
     */
    static async #onRollSearch() {
        const input = this.reading;
        if ( !input.uwp ) return;
        this.#searchRoll = await new Roll("2d6").roll();
        this.#search = { attempts: input.attempts, roll: this.#searchRoll.total };
        // The stamp redraws every client through `apps`; with no world there is nothing to write
        // and the typed count keeps driving the DM.
        if ( this.canWrite ) await this.#world.system.recordSearch(campaignDay());
        else this.render({ parts: ["results"] });
    }

    /**
     * Core p.243: a crew unwilling to pay may walk away, and cannot deal with that supplier again
     * for at least a month.
     */
    static async #onWalkAway() {
        if ( !this.canWrite ) return;
        return this.#world.system.refuseSupplier(campaignDay());
    }

    /** Back to hand mode for that slot; nothing is written and nothing rolled is discarded. */
    static #onSlotClear(event, target) {
        if ( target.dataset.slot === "ship" ) this.#ship = null;
        else this.#unseed();
        return this.render();
    }

    /** @this {SpecTradeDialog} */
    static async #onOpenDocument(event, target) {
        const uuid = target.closest("[data-uuid]")?.dataset.uuid;
        const document = uuid ? await fromUuid(uuid) : null;
        return document?.sheet?.render({ force: true });
    }

    /** The shelf. */
    static async #onRollStock(event, target) {
        const input = this.reading;
        if ( !input.uwp ) return;
        const faces = roll => roll.dice[0].results.map(result => result.result);

        const quantity = faces(await new Roll(`${D66_KEYS.length * DICE_PER_ROW}d6`).roll());
        const draws = input.uwp.population;
        const perDraw = input.blackMarket ? 1 : 2;
        const stock = [];
        if ( draws ) {
            const pool = faces(await new Roll(`${draws * perDraw * STOCK_TRIES}d6`).roll());
            for ( let i = 0; (i + perDraw <= pool.length) && (stock.length < draws); i += perDraw ) {
                const d66 = input.blackMarket
                    ? `${MGT2.SpeculativeTrade.illegalTens}${pool[i]}`
                    : `${pool[i]}${pool[i + 1]}`;
                if ( !input.blackMarket && MGT2.TradeGoods[d66]?.illegal ) continue;
                stock.push(d66);
            }
        }
        this.#dice = { quantity, stock };
        // A re-rolled shelf is a new stock list, so what an earlier one sold is on offer again.
        this.#bought.clear();
        this.render({ parts: ["results"] });
    }

    /** Both 3D at once: a stop sells the hold and buys the next cargo at the same counter. */
    static async #onRollPrice(event, target) {
        const dice = MGT2.SpeculativeTrade.priceDice;
        const roll = await new Roll(`${dice * 2}d6`).roll();
        const faces = roll.dice[0].results.map(result => result.result);
        const sum = from => faces.slice(from, from + dice).reduce((total, die) => total + die, 0);
        this.#price = { purchase: sum(0), sale: sum(dice) };
        // The two 3D the card is actually about.
        this.#priceRoll = roll;
        this.render({ parts: ["results"] });
    }

    /** The purchase. */
    static async #onBuyLot() {
        if ( this.#busy ) return;
        const context = await this._prepareContext({});
        const offer = context.offer;
        if ( !offer?.ready ) return;
        const goods = context.goods;
        const name = game.i18n.localize(goods.label);

        this.#busy = true;
        this.render({ parts: ["results"] });
        try {
            const split = await CreditSplit.open({
                total: offer.due,
                direction: "debit",
                spacecraft: this.#ship.uuid,
                reason: game.i18n.format("MGT2.Trade.BuyReason", { tons: offer.tons, goods: name,
                    world: this.#marketName(), percent: offer.percent })
            });
            if ( !split ) return;
            // Marked before the Item exists: the money is gone either way, so the supplier's stock
            // of that good is spent whatever happens next.
            this.#bought.add(goods.d66);
            const item = await this.#createLot(goods, offer).catch(error => {
                console.error(error);
                ui.notifications.error(game.i18n.format("MGT2.Trade.Errors.LotFailed", { goods: name }));
                return null;
            });
            if ( item ) await this.#postLot({ goods: name, tons: offer.tons, percent: offer.percent,
                base: goods.basePrice, total: offer.total, fee: offer.fee, rate: offer.rate,
                settled: offer.due, sold: false });
        }
        finally {
            this.#busy = false;
            this.render({ parts: ["results"] });
        }
    }

    /**
     * The mirror, and the reason the screen draws a sale reading at all: the crew sells the hold
     * and buys the next cargo at the same counter (Core p.241).
     */
    static async #onSellLot(event, target) {
        if ( this.#busy ) return;
        const id = target.closest("[data-lot]")?.dataset.lot;
        const item = this.#ship?.items.get(id);
        const context = await this._prepareContext({});
        const row = context.lots?.find(lot => lot.id === id);
        if ( !item || !row?.sellable ) return;
        // Read off the lot before it is deleted, because the card describes what left the hold.
        const name = item.name;
        const base = item.system.basePrice;

        this.#busy = true;
        this.render({ parts: ["results"] });
        try {
            const split = await CreditSplit.open({
                total: row.net,
                direction: "credit",
                spacecraft: this.#ship.uuid,
                reason: game.i18n.format("MGT2.Trade.SellReason", { tons: row.tons, goods: name,
                    world: this.#marketName(), percent: row.percent })
            });
            if ( !split ) return;
            await item.delete();
            await this.#postLot({ goods: name, tons: row.tons, percent: row.percent,
                base, total: row.total, fee: row.fee, rate: row.rate,
                settled: row.net, sold: true });
        }
        finally {
            this.#busy = false;
            this.render({ parts: ["results"] });
        }
    }

    /** The lot, on the ship. */
    async #createLot(goods, offer) {
        const packed = await SpecTradeDialog.#goodsDocument(goods.d66);
        const data = {
            name: game.i18n.localize(goods.label),
            type: "cargo",
            system: {
                tons: offer.tons,
                basePrice: goods.basePrice,
                // What was actually paid, as a percentage: the margin at the next port is
                // unreadable without it (Core p.243).
                purchasePct: offer.percent,
                purchaseDM: goods.purchase.map(row => ({ ...row })),
                saleDM: goods.sale.map(row => ({ ...row })),
                // The Trade Goods table prints no Law Level.
                legality: null,
                // Core p.243's "illegal throughout the Imperium", which `legality` cannot state.
                illegal: goods.illegal === true
            }
        };
        // `destination`, `dueDay` and `farePerTon` are left at their defaults: having no
        // destination at all IS being speculative, which is what `CargoData` derives `speculative`
        // from.
        if ( packed ) {
            data.img = packed.img;
            data.system.description = packed.system.description;
            data.system.source = packed.system.source;
        }
        const [item] = await this.#ship.createEmbeddedDocuments("Item", [data]);
        return item ?? null;
    }

    /**
     * The same row as an Item, where the module is installed.
     * @returns {Promise<object|null>}   The Item's source data, or null wherever the lookup fails
     */
    static async #goodsDocument(d66) {
        const pack = game.packs.get(GOODS_PACK);
        if ( pack?.documentName !== "Item" ) return null;
        try {
            const index = await pack.getIndex({ fields: [GOODS_KEY] });
            const entry = index.find(row => (row.type === "cargo")
                && (foundry.utils.getProperty(row, GOODS_KEY) === d66));
            const document = entry ? await pack.getDocument(entry._id) : null;
            return document ? document.toObject() : null;
        }
        catch ( error ) {
            console.error(error);
            return null;
        }
    }

    /**
     * A plain `ApplicationV2` inherits no drag-drop plumbing, so the controller is supplied here as
     * the chargen and voyage screens' are.
     * @type {DragDrop}
     */
    get dragDrop() {
        return this.#dragDrop ??= new DragDrop.implementation({
            dropSelector: "[data-accept]",
            callbacks: {
                dragover: this.#onDragOver.bind(this),
                dragleave: this.#onDragLeave.bind(this),
                drop: this.#onDrop.bind(this)
            }
        });
    }

    /** @type {DragDrop|null} */
    #dragDrop = null;

    /** A zone refuses at the pointer or not at all — after the drop is too late to be feedback. */
    #onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        for ( const node of this.element.querySelectorAll(".over, .deny") ) {
            if ( node !== zone ) node.classList.remove("over", "deny");
        }
        if ( !zone ) return;
        zone.classList.add(MGT2Helper.dropAccepted(zone) ? "over" : "deny");
    }

    #onDragLeave(event) {
        const zone = event.target.closest("[data-accept]");
        if ( zone && !zone.contains(event.relatedTarget) ) zone.classList.remove("over", "deny");
    }

    /** Two zones, two documents: the market this stop is at, and the hull that will take delivery. */
    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        const data = MGT2Helper.getDataFromDropEvent(event);
        zone?.classList.remove("over", "deny");
        if ( !zone || !MGT2Helper.dropAccepted(zone, data) ) return;
        // Awaited end to end: a packed Actor answers `fromUuidSync` with an index entry.
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor ) return;
        if ( zone.dataset.slot === "ship" ) {
            if ( actor.type !== "spacecraft" ) return;
            this.#ship = actor;
        }
        else if ( !this.seed(actor) ) return;
        return this.render();
    }

    /** A dropped world is named; a typed one is only ever its own profile line. */
    #marketName() {
        return this.#world?.name || this.#input.world;
    }

    /** ONE card, and it is about the CARGO. */
    async #postLot({ goods, tons, percent, base, total, fee, rate, settled, sold }) {
        const hold = this.#ship.system.cargo;
        const content = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/chat/trade-lot.html", {
                title: sold ? "MGT2.Trade.Card.Sold" : "MGT2.Trade.Card.Bought",
                where: game.i18n.format("MGT2.Trade.At", { world: this.#marketName(), goods }),
                goods, tons, percent, rate,
                base: MGT2Helper.credits(base),
                credits: MGT2Helper.credits(total),
                // Named on the card because the split screen posted the sum that MOVED and this is
                // the line that explains why it is not the price.
                fee: fee ? MGT2Helper.credits(fee) : null,
                settled: MGT2Helper.credits(settled),
                sold,
                ship: this.#ship.name,
                used: hold.used, capacity: hold.capacity, over: hold.over === true
            });
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content
        });
    }

    /** The same readout with nothing left to press, so the card and the dialog cannot drift. */
    static async #onPost(event, target) {
        const context = await this._prepareContext({});
        if ( !context.ready ) return;
        const body = await foundry.applications.handlebars.renderTemplate(
            SpecTradeDialog.PARTS.results.template, { ...context, card: true });
        const where = foundry.utils.escapeHTML(game.i18n.format("MGT2.Trade.At", {
            world: this.#marketName(),
            goods: game.i18n.localize(context.goods.label) }));

        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            // v14 appends no display of its own once `content` is set, so this costs the card
            // nothing and buys Dice So Nice and an auditable record.
            rolls: [this.#searchRoll, this.#priceRoll].filter(roll => roll),
            content: `<div class="mgt2 theme-light card spectrade">
                <div class="chd"><div class="what"><h4>${
                    foundry.utils.escapeHTML(game.i18n.localize("MGT2.Trade.Speculative"))
                }</h4><span class="tgt">${where}</span></div></div>${body}</div>`
        });
    }
}

/** The campaign's own *now*, in days, and the only clock the system has. */
function campaignDay() {
    return game.settings.get("mgt2", "campaignDay");
}

/** What the digits that matter here say — the port, the market's size and the law. */
function marketGloss(parsed) {
    if ( !parsed.uwp ) return game.i18n.localize("MGT2.Trade.NotAProfile");
    return game.i18n.format("MGT2.Trade.MarketGloss", {
        port: parsed.uwp.starport, pop: parsed.uwp.population, law: parsed.uwp.lawLevel });
}

/**
 * Beside the traffic control and on the same grounds: Core p.238 hands the chapter to the
 * Travellers, so this is not GM-only either.
 */
export function registerSpecTrade() {
    Hooks.on("getSceneControlButtons", controls => {
        const tools = controls.tokens?.tools;
        if ( !tools ) return;
        tools.specTrade = {
            name: "specTrade",
            order: Math.max(...Object.values(tools).map(tool => tool.order ?? 0)) + 1,
            title: "MGT2.Trade.Speculative",
            icon: "fa-solid fa-scale-balanced",
            button: true,
            onChange: () => SpecTradeDialog.open()
        };
    });
}
