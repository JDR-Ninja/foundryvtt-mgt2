import { MGT2 } from "./config.js";
import { CargoData } from "./datamodels.js";
import { MGT2Helper } from "./helper.js";
import { StopTraffic } from "./stop-traffic.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The Trade Goods table in D66 order, so a row can own a fixed slot of the dice pool. */
const D66_KEYS = Object.freeze(Object.keys(MGT2.TradeGoods));

/** The widest Tons column is `2D × 20`, and therefore one row's slot. */
const DICE_PER_ROW = 2;

/**
 * Attempts drawn per random row, so that a legal supplier's 61-65 can be skipped rather than
 * re-rolled one await at a time. Four is enough that exhausting them is a 1 in 2700 event.
 */
const STOCK_TRIES = 4;

/**
 * Speculative trade: the shelf a supplier has, and what one lot costs or fetches.
 *
 * Pure, on the shape `StopTraffic` established — every method takes the referee's typed values and
 * the dice already rolled and returns a reading. Nothing here touches a document.
 */
export class SpecTrade {

    /**
     * Every key a Purchase or Sale DM column can name. The eighteen trade codes derive from the
     * profile, and the travel zone joins them: Core p.244 prices Advanced Weapons by Amber and Red,
     * which are not facts about the world's economy and are on the same column regardless.
     */
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
     * matches. Rows 61-65 are a black market's alone, which is the only thing the toggle changes
     * about the shelf.
     */
    static stock(codes, blackMarket) {
        return Object.values(MGT2.TradeGoods).filter(row => !row.exotic
            && (blackMarket || !row.illegal)
            && ((row.availability === null) || row.availability.some(code => codes.includes(code))));
    }

    /**
     * The winning row of one DM column. Core p.243 takes the LARGEST applicable and never the sum —
     * a rule with exactly one implementation, `CargoData.bestDM`; this adds only the name of the row
     * that won it, because a DM whose source is not printed cannot be argued with at the table.
     */
    static best(rows, codes) {
        const dm = CargoData.bestDM(rows, codes);
        const row = rows.find(entry => codes.includes(entry.code) && (entry.dm === dm));
        return { dm, code: row?.code ?? null };
    }

    /**
     * Both DM columns of one good against one world, with the smuggler's overlay on the sale side.
     *
     * Core p.243 gives a locally banned good a Sale DM of the world's Law Level minus the Level it is
     * banned at, and takes the HIGHER where a good is banned everywhere as well. Below the ban the
     * difference is negative and the good is simply legal there, so the local term floors at zero —
     * a ruling, since the printed sentence subtracts without saying what a negative means.
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

    /**
     * One transaction. Core p.243: 3D, plus the trader's Broker, minus the other side's, plus the
     * largest DM in this side's own column and minus the largest in the other's. That sign flip is
     * the whole mechanism — the world which is cheapest to buy a cargo on is the world which pays
     * worst for it, and no world is good for both.
     */
    static reading(side, goods, columns, input, roll) {
        const own = (side === "purchase") ? columns.purchase : columns.sale;
        const other = (side === "purchase") ? columns.sale : columns.purchase;
        const terms = [StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.Broker"), input.broker)];

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

    /** A DM row names its code, or the Law Level a smuggled cargo is banned at. */
    static termLabel(column) {
        return (column.code === "law")
            ? game.i18n.format("MGT2.Trade.Terms.Banned", { law: column.banned })
            : game.i18n.localize(SpecTrade.codeLabel(column.code));
    }

    /**
     * The Tons column, rolled. Core p.242 bands the size of the market onto the ROLL and not onto the
     * total — "this can result in a number of zero or less", which is no availability at all, and a
     * multiplier applied afterwards could never produce it.
     */
    static tons(goods, population, dice) {
        const dm = MGT2.readTable(MGT2.SpeculativeTrade.population, population).dm;
        const parts = dice.slice(0, goods.dice);
        const raw = parts.reduce((sum, die) => sum + die, 0) + dm;
        return { parts, dm, raw, tons: Math.max(0, raw) * goods.multiplier };
    }

    /**
     * Finding the supplier at all. The starport's size helps (Core p.242) and every search already
     * made here this month costs a further DM−1 (Core p.241) — the count `world.system.trade.attempts`
     * keeps, and which is typed here because the dialog is built to need no `world` Actor.
     */
    static search(uwp, attempts) {
        const port = MGT2.Starports[uwp.starport] ?? MGT2.Starports.X;
        const terms = [StopTraffic.term(
            game.i18n.format("MGT2.Trade.Terms.Starport", { port: uwp.starport }), port.searchDM)];
        if ( attempts ) {
            terms.push(StopTraffic.term(game.i18n.format("MGT2.Trade.Terms.Attempts", { n: attempts }),
                attempts * MGT2.SpeculativeTrade.attemptDM));
        }
        return { terms, dm: terms.reduce((sum, term) => sum + term.dm, 0),
            target: MGT2.DifficultyTargets.Average };
    }
}

/* -------------------------------------------- */

/**
 * The speculative block — the shelf, the tonnage and both prices of one stop (§33.9 step 7).
 *
 * ONE world, not two. Traffic is a route and needs both ends; a speculative trade is a market, and
 * the crew sells the hold and buys the next cargo at the same counter. Both readings are drawn
 * because the same trade codes feed them with opposite signs, which is the fact a referee reads off
 * the printed table wrong.
 *
 * It owns no document and creates none. The per-planet, per-month state that Core p.241 and p.243
 * describe lives on the `world` Actor and nowhere else; the attempt count is typed here so that a
 * table with no documents at all still gets the DM.
 *
 * @extends {ApplicationV2}
 * @mixes HandlebarsApplication
 */
export class SpecTradeDialog extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-spec-trade",
        classes: ["mgt2", "spectrade"],
        position: { width: 780, height: 820 },
        window: { resizable: true, icon: "fa-solid fa-scale-balanced",
            title: "MGT2.Trade.Speculative" },
        actions: {
            rollStock: SpecTradeDialog.#onRollStock,
            rollPrice: SpecTradeDialog.#onRollPrice,
            pick: SpecTradeDialog.#onPick,
            post: SpecTradeDialog.#onPost
        }
    };

    /** @inheritDoc */
    static PARTS = {
        form: { template: "systems/mgt2/templates/trade.html" },
        results: { template: "systems/mgt2/templates/trade-results.html", scrollable: [""] }
    };

    /* -------------------------------------------- */

    /** The typed values. None of it is persisted: a stop is answered once (§9.35). */
    #input = {
        world: "", zone: "green", goods: "11",
        broker: 0, otherBroker: MGT2.SpeculativeTrade.otherBroker,
        attempts: 0, blackMarket: false, bannedAt: ""
    };

    /**
     * The shelf's dice, rolled once and kept. Each of the thirty-six rows owns a fixed slot of the
     * quantity pool, so correcting the Population code re-reads the dice already on the table instead
     * of quietly producing a different shelf.
     * @type {{quantity: number[], stock: string[]}|null}
     */
    #dice = null;

    /**
     * The two 3D, kept apart from the shelf's: they are different acts a stop apart, and folding them
     * into one store would make a rolled shelf read as a price of zero.
     * @type {{purchase: number, sale: number}|null}
     */
    #price = null;

    /** The `Roll` behind `#price`, kept so the posted card can carry it (§9.117). */
    #priceRoll = null;

    /** One window: a second would answer the same market twice with different dice. */
    static open() {
        const existing = foundry.applications.instances.get("mgt2-spec-trade");
        return (existing ?? new SpecTradeDialog()).render({ force: true });
    }

    /* -------------------------------------------- */
    /*  Context                                     */
    /* -------------------------------------------- */

    /** The profile parsed and the numbers coerced once, so nothing below has to. */
    get reading() {
        const parsed = StopTraffic.parseLine(this.#input.world);
        const banned = String(this.#input.bannedAt).trim();
        return {
            ...parsed,
            zone: parsed.zone ?? this.#input.zone,
            goods: this.#input.goods,
            broker: Math.trunc(Number(this.#input.broker) || 0),
            otherBroker: Math.trunc(Number(this.#input.otherBroker) || 0),
            attempts: Math.max(0, Math.trunc(Number(this.#input.attempts) || 0)),
            blackMarket: this.#input.blackMarket === true,
            // Blank is "nobody bans this", which is a different statement from Law Level 0.
            bannedAt: banned === "" ? null : Math.max(0, Math.trunc(Number(banned) || 0))
        };
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const input = this.reading;
        Object.assign(context, {
            config: MGT2,
            input: this.#input,
            zones: MGT2.TravelZones,
            goodsList: Object.fromEntries(Object.values(MGT2.TradeGoods)
                .map(row => [row.d66, `${row.d66} · ${game.i18n.localize(row.label)}`])),
            gloss: marketGloss(input),
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
        context.search = SpecTrade.search(input.uwp, input.attempts);
        context.shelf = SpecTrade.stock(codes, input.blackMarket)
            .map(row => this.#shelfRow(row, input, codes));
        context.drawn = (this.#dice?.stock ?? [])
            .map(d66 => this.#shelfRow(MGT2.TradeGoods[d66], input, codes));
        context.goods = goods;
        context.readings = ["purchase", "sale"].map(side => SpecTrade.reading(side, goods, columns,
            input, this.#price ? this.#price[side] : null));
        context.lot = this.#shelfRow(goods, input, codes);
        context.canPost = context.rolled || context.priced;
        return context;
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

    /* -------------------------------------------- */
    /*  Events                                      */
    /* -------------------------------------------- */

    /**
     * One delegated listener on the application root, so it survives the results part being replaced
     * on every keystroke. `data-field` rather than `name`: nothing here is submitted anywhere.
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

    /* -------------------------------------------- */

    /** Clicking a shelf line selects it; the select in the header is the same control by another name. */
    static #onPick(event, target) {
        this.#input.goods = target.dataset.d66;
        const select = this.element.querySelector('[data-field="goods"]');
        if ( select ) select.value = this.#input.goods;
        this.render({ parts: ["results"] });
    }

    /**
     * The shelf. Thirty-six tonnages in one pool, plus the random rows a supplier turns up beyond
     * their codes — Core p.242 gives as many of those as the Population code, and 61-65 never appear
     * unless the supplier is a black market, which instead rolls 1D under a leading 6.
     */
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
        this.render({ parts: ["results"] });
    }

    /** Both 3D at once: a stop sells the hold and buys the next cargo at the same counter. */
    static async #onRollPrice(event, target) {
        const dice = MGT2.SpeculativeTrade.priceDice;
        const roll = await new Roll(`${dice * 2}d6`).roll();
        const faces = roll.dice[0].results.map(result => result.result);
        const sum = from => faces.slice(from, from + dice).reduce((total, die) => total + die, 0);
        this.#price = { purchase: sum(0), sale: sum(dice) };
        // The two 3D the card is actually about (§9.117). The shelf's pools are left out for the
        // same reason as the traffic dialog's: they are sliced per row and mostly never read.
        this.#priceRoll = roll;
        this.render({ parts: ["results"] });
    }

    /* -------------------------------------------- */
    /*  Chat                                        */
    /* -------------------------------------------- */

    /** The same readout with nothing left to press, so the card and the dialog cannot drift. */
    static async #onPost(event, target) {
        const context = await this._prepareContext({});
        if ( !context.ready ) return;
        const body = await foundry.applications.handlebars.renderTemplate(
            SpecTradeDialog.PARTS.results.template, { ...context, card: true });
        const where = foundry.utils.escapeHTML(game.i18n.format("MGT2.Trade.At", {
            world: context.input.world, goods: game.i18n.localize(context.goods.label) }));

        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            // v14 appends no display of its own once `content` is set, so this costs the card
            // nothing and buys Dice So Nice and an auditable record (§9.117).
            rolls: this.#priceRoll ? [this.#priceRoll] : [],
            content: `<div class="mgt2 theme-light card spectrade">
                <div class="chd"><div class="what"><h4>${
                    foundry.utils.escapeHTML(game.i18n.localize("MGT2.Trade.Speculative"))
                }</h4><span class="tgt">${where}</span></div></div>${body}</div>`
        });
    }
}

/* -------------------------------------------- */

/** What the digits that matter here say — the port, the market's size and the law. */
function marketGloss(parsed) {
    if ( !parsed.uwp ) return game.i18n.localize("MGT2.Trade.NotAProfile");
    return game.i18n.format("MGT2.Trade.MarketGloss", {
        port: parsed.uwp.starport, pop: parsed.uwp.population, law: parsed.uwp.lawLevel });
}

/* -------------------------------------------- */

/**
 * Beside the traffic control and on the same grounds: Core p.238 hands the chapter to the Travellers,
 * so this is not GM-only either.
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
