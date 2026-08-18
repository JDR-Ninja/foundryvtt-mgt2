import { MGT2 } from "./config.js";
import { CreditSplit } from "./credit-split.js";
import { MGT2Helper } from "./helper.js";
import { WorldData } from "./actors/world-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

/** Two ends and one hull: a route needs both counters, unlike the market a speculative stop is at. */
const WORLD_TYPE = "Actor.world";
const SHIP_TYPE = "Actor.spacecraft";

/**
 * A sector table prints the travel zone in a column of its own (Core p.248), so the field accepts
 * it appended — `A788899-C A` is how a referee copies a line.
 */
const ZONE_SUFFIX = /\s+([AR])$/i;

const SUFFIX_ZONES = Object.freeze({ A: "amber", R: "red" });

/** The widest a traffic table can return (Core p.239, p.241), and therefore one row's slot. */
const DICE_PER_ROW = 10;

/** Four passenger classes and three freight sizes, each with a slot of its own. */
const ROWS = 7;

/** The three printed tables of a commercial stop, computed and never written down. */
export class StopTraffic {

    /**
     * A copied line and the travel zone it may carry as a suffix.
     * @returns {{uwp: object|null, zone: string|null, profile: string}}
     */
    static parseLine(line) {
        const text = String(line ?? "").trim();
        const match = ZONE_SUFFIX.exec(text);
        const profile = match ? text.slice(0, match.index).trim() : text;
        return {
            uwp: WorldData.parseUwp(profile),
            zone: match ? SUFFIX_ZONES[match[1].toUpperCase()] : null,
            profile
        };
    }

    /** One printed line: what it is called, what it is worth, and whether the other column agrees. */
    static term(label, dm, split = false) {
        return { label, dm, split, tone: (dm > 0) ? "pos" : ((dm < 0) ? "neg" : "nil") };
    }

    /**
     * What ONE end contributes to ONE column.
     * @param {object} side   `MGT2.Traffic.passenger` or `.freight`
     */
    static worldTerms(side, uwp, zone) {
        const terms = [
            StopTraffic.term(game.i18n.format("MGT2.Trade.Terms.Population", { n: uwp.population }),
                MGT2.readTable(side.population, uwp.population).dm, true),
            StopTraffic.term(game.i18n.format("MGT2.Trade.Terms.Starport", { port: uwp.starport }),
                MGT2.Starports[uwp.starport]?.trafficDM ?? 0)
        ];
        if ( side.techLevel ) {
            terms.push(StopTraffic.term(game.i18n.format("MGT2.Trade.Terms.TechLevel", { n: uwp.techLevel }),
                MGT2.readTable(side.techLevel, uwp.techLevel).dm, true));
        }
        const travel = MGT2.TravelZones[zone];
        if ( travel?.[side.zone] ) {
            terms.push(StopTraffic.term(game.i18n.localize(travel.label), travel[side.zone], true));
        }
        return terms;
    }

    /**
     * One column: both ends, then the distance. Every DM below is read off this total.
     * @returns {{groups: object[], total: number}}
     */
    static column(side, { here, next, parsecs }) {
        const groups = [
            { label: game.i18n.localize("MGT2.Trade.Here"),
                terms: StopTraffic.worldTerms(side, here.uwp, here.zone) },
            { label: game.i18n.localize("MGT2.Trade.Destination"),
                terms: StopTraffic.worldTerms(side, next.uwp, next.zone) }
        ];
        const far = MGT2.Traffic.perParsec * Math.max(0, parsecs - 1);
        if ( far ) {
            groups.push({ terms: [
                StopTraffic.term(game.i18n.format("MGT2.Trade.Terms.Parsecs", { n: parsecs }), far)] });
        }
        const total = groups.reduce((sum, group) =>
            sum + group.terms.reduce((run, term) => run + term.dm, 0), 0);
        return { groups, total };
    }

    /** One traffic row. */
    static row(table, { roll, dm, dice, perDie = 1, cap = Infinity }) {
        const total = roll + dm;
        const count = MGT2.readTable(table, total).dice;
        const parts = dice.slice(0, count).map(die => die * perDie);
        const raw = parts.reduce((sum, part) => sum + part, 0);
        return {
            roll, dm, total, count, parts, raw,
            quantity: Math.min(raw, cap),
            capped: raw > cap,
            biggest: parts.length ? Math.max(...parts) : 0
        };
    }

    /**
     * The whole offer: two columns, seven rows and the mail 2D.
     * @param {object} input   The referee's typed values, already parsed
     * @param {object|null} dice   What `StopTrafficDialog` last rolled, or null
     */
    static offer(input, dice) {
        const passenger = StopTraffic.column(MGT2.Traffic.passenger, input);
        const freight = StopTraffic.column(MGT2.Traffic.freight, input);

        // Core p.239 allows Broker, Carouse or Streetwise; Core p.240 allows Broker or Streetwise.
        const leads = side => side.skills.includes(input.checkSkill);
        const skill = game.i18n.localize(`MGT2.Trade.Skills.${input.checkSkill}`);
        const effectTerm = StopTraffic.term(
            game.i18n.format("MGT2.Trade.Terms.Check", { skill }), input.effect);
        const worldTerm = total => StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.WorldTotal"), total);

        // Core p.239: the number available "cannot usually exceed the number of people resident".
        const cap = Math.pow(10, input.here.uwp.population);

        const passengers = MGT2.Traffic.passenger.classes.map((cls, index) => {
            const terms = [worldTerm(passenger.total)];
            if ( input.steward ) {
                terms.push(StopTraffic.term(
                    game.i18n.localize("MGT2.Trade.Terms.Steward"), input.steward));
            }
            if ( leads(MGT2.Traffic.passenger) && input.effect ) terms.push(effectTerm);
            if ( cls.dm ) terms.push(StopTraffic.term(game.i18n.localize(cls.label), cls.dm));
            const dm = terms.reduce((sum, term) => sum + term.dm, 0);
            return Object.assign({ key: cls.key, label: cls.label, terms },
                dice ? StopTraffic.row(MGT2.Traffic.passenger.table,
                    { roll: dice.traffic[index], dm, dice: dice.quantity[index], cap }) : { dm });
        });

        const freights = MGT2.Traffic.freight.classes.map((cls, index) => {
            const terms = [worldTerm(freight.total)];
            if ( leads(MGT2.Traffic.freight) && input.effect ) terms.push(effectTerm);
            if ( cls.dm ) terms.push(StopTraffic.term(game.i18n.localize(cls.label), cls.dm));
            const dm = terms.reduce((sum, term) => sum + term.dm, 0);
            return Object.assign({ key: cls.key, label: cls.label, lotSize: cls.lotSize, terms },
                dice ? StopTraffic.row(MGT2.Traffic.freight.table, { roll: dice.traffic[4 + index], dm,
                    dice: dice.quantity[4 + index], perDie: cls.tonsPerLot }) : { dm });
        });

        return { passenger, freight, passengers, freights,
            mail: StopTraffic.mail(input, freight.total, dice),
            carouseSplit: !MGT2.Traffic.freight.skills.includes(input.checkSkill) && (input.effect !== 0) };
    }

    /** Core p.241. Pass or fail on 12+, and the DM is the freight world total banded into five steps. */
    static mail(input, freightTotal, dice) {
        const mail = MGT2.MailTraffic;
        const band = MGT2.readTable(mail.band, freightTotal).dm;
        const terms = [StopTraffic.term(game.i18n.format("MGT2.Trade.Terms.FreightBand",
            { dm: MGT2Helper.signed(freightTotal) }), band)];
        if ( input.armed ) {
            terms.push(StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.Armed"), mail.armedDM));
        }
        if ( input.here.uwp.techLevel <= mail.lowTechAt ) {
            terms.push(StopTraffic.term(
                game.i18n.format("MGT2.Trade.Terms.LowTech", { n: mail.lowTechAt }), mail.lowTechDM));
        }
        if ( input.rank ) {
            terms.push(StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.Rank"), input.rank));
        }
        if ( input.socialDM ) {
            terms.push(StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.SocialDM"), input.socialDM));
        }

        const dm = terms.reduce((sum, term) => sum + term.dm, 0);
        if ( !dice ) return { terms, dm, target: mail.target };
        const total = dice.mail + dm;
        const offered = total >= mail.target;
        return { terms, dm, target: mail.target, roll: dice.mail, total, offered,
            containers: dice.containers,
            tons: dice.containers * mail.tonsPerContainer,
            credits: dice.containers * mail.creditsPerContainer };
    }
}

/**
 * Traffic at the stop — the passenger, freight and mail of one commercial call, from the roll to
 * the booking.
 * @extends {ApplicationV2}
 */
export class StopTrafficDialog extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-stop-traffic",
        classes: ["mgt2", "stoptraffic"],
        position: { width: 760, height: 860 },
        window: { resizable: true, icon: "fa-solid fa-cart-flatbed-suitcase",
            title: "MGT2.Trade.StopTraffic" },
        actions: {
            rollCheck: StopTrafficDialog.#onRollCheck,
            rollTraffic: StopTrafficDialog.#onRollTraffic,
            bookPassage: StopTrafficDialog.#onBookPassage,
            bookFreight: StopTrafficDialog.#onBookFreight,
            bookMail: StopTrafficDialog.#onBookMail,
            slotClear: StopTrafficDialog.#onSlotClear,
            openDocument: StopTrafficDialog.#onOpenDocument,
            post: StopTrafficDialog.#onPost
        }
    };

    /** @inheritDoc */
    static PARTS = {
        form: { template: "systems/mgt2/templates/stop-traffic.html" },
        results: { template: "systems/mgt2/templates/stop-traffic-results.html", scrollable: [""] }
    };

    /**
     * The typed values, the leading check and the one booking parameter the chapter does not print.
     */
    #input = {
        here: "", next: "", hereZone: "green", nextZone: "green", parsecs: 1,
        steward: 0, checkSkill: "broker", checkDM: 0, effect: 0,
        armed: false, rank: 0, socialDM: 0, dueIn: null
    };

    /**
     * The two ends, where a `world` Actor was dropped for one.
     * @type {{here: Actor|null, next: Actor|null}}
     */
    #worlds = { here: null, next: null };

    /** The hull a booking is written onto. Read for its hold and its berths, written only on a book. */
    #ship = null;

    /**
     * What this offer has already handed over, keyed `passage:<grade>`, `<size>:<index>` and
     * `mail`.
     * @type {Set<string>}
     */
    #taken = new Set();

    /** One booking at a time: a second split window open beside the first would credit twice. */
    #busy = false;

    /**
     * Every die of the current offer, rolled once and kept.
     * @type {{traffic: number[], quantity: number[][], mail: number, containers: number}|null}
     */
    #dice = null;

    /** The `Roll` objects behind `#dice`, kept so the posted card can carry them. */
    #rolls = [];

    /**
     * One window: a second one would answer the same stop twice with different dice.
     * @param {Actor} [options.world]   A `world` to put in the near slot before the window opens
     */
    static open({ world } = {}) {
        const screen = foundry.applications.instances.get("mgt2-stop-traffic")
            ?? new StopTrafficDialog();
        if ( world ) screen.seed(world, "here");
        return screen.render({ force: true });
    }

    /**
     * Put a world in one of the two end slots, which fills that end's typed profile and zone.
     * @returns {Actor|null}
     */
    seed(actor, end) {
        if ( (actor?.type !== "world") || !(end in this.#worlds) ) return null;
        this.#worlds[end] = actor;
        this.#input[end] = actor.system.profile;
        this.#input[`${end}Zone`] = actor.system.zone;
        return actor;
    }

    /** Back to hand mode for one end. */
    #unseed(end) {
        if ( end in this.#worlds ) this.#worlds[end] = null;
    }

    /** Every document this screen has written into `apps`, which is not the same as the three slots. */
    #registered = new Set();

    /**
     * `document.apps` is the only re-render mechanism there is, and here it keeps the hold honest:
     * a lot delivered on the ship's own sheet redraws this screen's free tonnage, so the figure a
     * booking is warned against is never a stale copy of the hull's.
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

    /** Both ends parsed, and the numbers coerced once so nothing below has to. */
    get reading() {
        const here = StopTraffic.parseLine(this.#input.here);
        const next = StopTraffic.parseLine(this.#input.next);
        return {
            here: { ...here, zone: here.zone ?? this.#input.hereZone },
            next: { ...next, zone: next.zone ?? this.#input.nextZone },
            parsecs: Math.max(1, Math.trunc(Number(this.#input.parsecs) || 1)),
            steward: Math.trunc(Number(this.#input.steward) || 0),
            checkSkill: this.#input.checkSkill,
            checkDM: Math.trunc(Number(this.#input.checkDM) || 0),
            effect: Math.trunc(Number(this.#input.effect) || 0),
            armed: this.#input.armed === true,
            rank: Math.trunc(Number(this.#input.rank) || 0),
            socialDM: Math.trunc(Number(this.#input.socialDM) || 0),
            // Blank is a consignment with no deadline agreed, and that is NOT zero days: `|| 0`
            // here would make every lot late the moment it was booked.
            dueIn: StopTrafficDialog.#days(this.#input.dueIn)
        };
    }

    /** The gate on every act that writes to the hull. */
    get canTrade() {
        return game.user.isGM && Boolean(this.#ship?.canUserModify(game.user, "update"));
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const input = this.reading;
        this.#syncRegistrations([this.#worlds.here, this.#worlds.next, this.#ship]);
        Object.assign(context, {
            config: MGT2,
            input: this.#input,
            zones: MGT2.TravelZones,
            // The union of the two skill lists: which of them leads which table is Core p.239-240's
            // business and is read off `MGT2.Traffic.<side>.skills`, not off this control.
            skills: Object.fromEntries(MGT2.Traffic.passenger.skills
                .map(key => [key, `MGT2.Trade.Skills.${key}`])),
            here: input.here,
            next: input.next,
            glossHere: StopTrafficDialog.glossOf(input.here),
            glossNext: StopTrafficDialog.glossOf(input.next),
            worldType: WORLD_TYPE,
            shipType: SHIP_TYPE,
            ends: [
                { end: "here", label: "MGT2.Trade.Here",
                    ...StopTrafficDialog.#worldSlot(this.#worlds.here) },
                { end: "next", label: "MGT2.Trade.Destination",
                    ...StopTrafficDialog.#worldSlot(this.#worlds.next) }
            ],
            hull: StopTrafficDialog.#shipSlot(this.#ship),
            ready: Boolean(input.here.uwp && input.next.uwp),
            rolled: this.#dice !== null
        });
        context.canPost = context.ready && context.rolled;
        if ( context.ready ) {
            context.offer = StopTraffic.offer(input, this.#dice);
            const mail = context.offer.mail;
            if ( mail.offered ) mail.creditsDisplay = MGT2Helper.credits(mail.credits);
            context.booking = this.#booking(input, context.offer);
        }
        return context;
    }

    /** What of this offer can actually be taken aboard, and at what rate. */
    #booking(input, offer) {
        const fares = MGT2.readFares(input.parsecs);
        const destination = this.#destination();
        const day = campaignDay();
        const hold = this.#ship ? this.#ship.system.cargo : null;
        const stop = () => !this.#ship ? "MGT2.Trade.NeedAShipHere"
            : !destination.name && !destination.world ? "MGT2.Trade.NeedADestination"
                : !this.canTrade ? "MGT2.Trade.RefereeBooks" : null;

        // A lot cannot be broken up (Core p.241), so a hold with room for part of it has room for
        // none of it.
        const fit = tons => ({
            overFree: Boolean(hold) && (tons > hold.free),
            overHold: Boolean(hold) && (tons > hold.capacity)
        });
        const line = (key, blocked) => {
            const taken = this.#taken.has(key);
            const why = blocked ?? (taken ? "MGT2.Trade.AlreadyBooked" : stop());
            return { key, taken, blocked: why, ready: !why && !this.#busy };
        };

        const passengers = (offer.passengers ?? []).map(row => {
            const available = row.quantity ?? 0;
            const farePerHead = fares[row.key] ?? 0;
            return { ...line(`passage:${row.key}`, available ? null : "MGT2.Trade.NoneOffered"),
                grade: row.key, label: row.label, available, farePerHead,
                fare: MGT2Helper.credits(farePerHead),
                total: MGT2Helper.credits(available * farePerHead) };
        });

        // One button per LOT and never per row: the tonnages a row rolled are separate
        // consignments, and each is taken or left whole.
        const freights = [];
        for ( const row of offer.freights ?? [] ) {
            (row.parts ?? []).forEach((tons, index) => {
                freights.push({ ...line(`${row.key}:${index}`, tons ? null : "MGT2.Trade.NoneOffered"),
                    row: row.key, index, label: row.label, tons, ...fit(tons),
                    fare: MGT2Helper.credits(tons * fares.freight) });
            });
        }

        // Core p.241 calls mail "a special form of freight", so it becomes one `cargo` lot like any
        // other — all the containers at once, because the Travellers "must take them all or none at
        // all", and at a flat rate per ton that reproduces Cr25000 a container without scaling.
        const mail = offer.mail.offered
            ? { ...line("mail", null), containers: offer.mail.containers, tons: offer.mail.tons,
                ...fit(offer.mail.tons), fare: MGT2Helper.credits(offer.mail.credits) }
            : null;

        return { fares, destination, day, passengers, freights, mail,
            dueDay: (input.dueIn === null) ? null : (day + input.dueIn),
            berths: StopTrafficDialog.#berths(this.#ship),
            free: hold?.free ?? 0,
            canTrade: this.canTrade };
    }

    /** The far end as a `CargoData.destination`. @returns {{world: string|null, name: string}} */
    #destination() {
        const world = this.#worlds.next;
        if ( world ) return { world: world.uuid, name: world.name };
        return { world: null, name: StopTraffic.parseLine(this.#input.next).profile };
    }

    /** The agreed delivery window in days, or null where none was agreed. */
    static #days(value) {
        const text = String(value ?? "").trim();
        if ( !text ) return null;
        const days = Math.trunc(Number(text));
        return Number.isFinite(days) ? Math.max(0, days) : null;
    }

    /** What the hull can actually sleep. */
    static #berths(ship) {
        if ( !ship ) return null;
        const rooms = ship.system.staterooms;
        const staterooms = rooms.standard + rooms.high + rooms.luxury;
        const berths = Object.entries(ship.system.lowBerths).reduce((sum, [key, count]) =>
            sum + (count * (MGT2.LowBerths[key]?.holds ?? 1)), 0);
        const booked = ship.system.manifest.passengers;
        const used = booked.high + booked.middle + Math.ceil(booked.basic / 2);
        return { staterooms, berths, used, low: booked.low,
            over: used > staterooms, overLow: booked.low > berths };
    }

    /** One end's slot: the document in it, and the two lines it fills below. */
    static #worldSlot(world) {
        if ( !world ) return { linked: false };
        return { linked: true, uuid: world.uuid, name: world.name,
            profile: world.system.profile, codes: world.system.codes.join(" ") };
    }

    /** The hull slot: the hold a lot has to fit and the berths a booking has to sleep in. */
    static #shipSlot(ship) {
        if ( !ship ) return { linked: false };
        const cargo = ship.system.cargo;
        const berths = StopTrafficDialog.#berths(ship);
        return { linked: true, uuid: ship.uuid, name: ship.name,
            capacity: cargo.capacity, used: cargo.used, free: cargo.free, over: cargo.over === true,
            staterooms: berths.staterooms, berths: berths.berths };
    }

    /**
     * One delegated listener on the application root, so it survives the results part being
     * replaced on every keystroke.
     * @inheritDoc
     */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        // `input` alone: a select fires it too, and adding `change` would render every pick twice.
        this.element.addEventListener("input", event => {
            const field = event.target.closest("[data-field]")?.dataset.field;
            if ( !field ) return;
            this.#input[field] = (event.target.type === "checkbox") ? event.target.checked : event.target.value;
            this.#syncGlosses();
            this.render({ parts: ["results"] });
        });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        // Re-bound on every render because the form part carries the slots and is replaced.
        this.dragDrop.bind(this.element);
    }

    /**
     * The two profile readouts live beside the fields that feed them, in the part that is never
     * re-rendered — so they are patched by hand rather than losing the caret to a full render.
     */
    #syncGlosses() {
        for ( const end of ["here", "next"] ) {
            const parsed = StopTraffic.parseLine(this.#input[end]);
            const field = this.element.querySelector(`.fld.${end}`);
            if ( !field ) continue;
            field.classList.toggle("bad", Boolean(this.#input[end]) && !parsed.uwp);
            const gloss = field.querySelector(".g");
            if ( gloss ) gloss.textContent = StopTrafficDialog.glossOf(parsed);
            // A copied line carrying its zone letter sets the select, and typing one without a
            // letter leaves whatever the referee chose there alone.
            const zone = field.parentElement.querySelector(`[data-field="${end}Zone"]`);
            if ( zone && parsed.zone ) {
                zone.value = parsed.zone;
                this.#input[`${end}Zone`] = parsed.zone;
            }
        }
    }

    /** What the eight digits say, or the hint that they are not eight digits. */
    static glossOf(parsed) {
        if ( !parsed.uwp ) return game.i18n.localize("MGT2.Trade.NotAProfile");
        return game.i18n.format("MGT2.Trade.Gloss", {
            port: parsed.uwp.starport, pop: parsed.uwp.population, tl: parsed.uwp.techLevel });
    }

    /** The Average (8+) check whose Effect leads both tables. */
    static async #onRollCheck(event, target) {
        const input = this.reading;
        const roll = await new Roll(`2d6 ${MGT2Helper.getFormulaDM(input.checkDM)}`).roll();
        this.#input.effect = roll.total - MGT2.DifficultyTargets.Average;
        const field = this.element.querySelector('[data-field="effect"]');
        if ( field ) field.value = String(this.#input.effect);
        this.render({ parts: ["results"] });
    }

    /** Eight 2D and the dice each table hands back. */
    static async #onRollTraffic(event, target) {
        const traffic = await new Roll("16d6").roll();
        const quantity = await new Roll(`${ROWS * DICE_PER_ROW}d6`).roll();
        const containers = await new Roll(MGT2.MailTraffic.containers).roll();
        // What the card carries: the dice that DECIDE — the eight 2D and mail's containers
        // — and not the seventy-die quantity pool, which is sliced per row and mostly never read.
        this.#rolls = [traffic, containers];

        const faces = roll => roll.dice[0].results.map(result => result.result);
        const pairs = faces(traffic);
        const pool = faces(quantity);
        // Seven traffic 2D then mail's, in the order the rows are drawn.
        const twos = Array.from({ length: ROWS + 1 }, (unused, i) => pairs[i * 2] + pairs[i * 2 + 1]);
        this.#dice = {
            traffic: twos.slice(0, ROWS),
            quantity: Array.from({ length: ROWS },
                (unused, i) => pool.slice(i * DICE_PER_ROW, (i + 1) * DICE_PER_ROW)),
            mail: twos[ROWS],
            containers: containers.total
        };
        // A re-rolled offer is a different stop, so what an earlier one booked is on offer again.
        this.#taken.clear();
        this.render({ parts: ["results"] });
    }

    /** Back to hand mode for that slot; nothing is written and nothing rolled is discarded. */
    static #onSlotClear(event, target) {
        if ( target.dataset.slot === "ship" ) this.#ship = null;
        else this.#unseed(target.dataset.slot);
        return this.render();
    }

    /** @this {StopTrafficDialog} */
    static async #onOpenDocument(event, target) {
        const uuid = target.closest("[data-uuid]")?.dataset.uuid;
        const document = uuid ? await fromUuid(uuid) : null;
        return document?.sheet?.render({ force: true });
    }

    /** Passengers aboard. */
    static async #onBookPassage(event, target) {
        if ( this.#busy ) return;
        const grade = target.dataset.grade;
        const context = await this._prepareContext({});
        const row = context.booking?.passengers.find(line => line.grade === grade);
        if ( !row?.ready ) return;
        // The crew takes as many as it wants of what is offered — the berths are a warning and not
        // a cap, so the count is the referee's and only the offer bounds it.
        const field = this.element.querySelector(`[data-take="${grade}"]`);
        const count = Math.min(row.available,
            Math.max(0, MGT2Helper.getIntegerFromInput(field?.value)));
        if ( !count ) return;

        const name = game.i18n.localize(row.label);
        const total = count * row.farePerHead;
        await this.#write(`passage:${grade}`, async () => {
            const split = await CreditSplit.open({
                total,
                direction: "credit",
                spacecraft: this.#ship.uuid,
                reason: game.i18n.format("MGT2.Trade.PassageReason", { n: count, grade: name,
                    world: this.#endName("next") })
            });
            if ( !split ) return false;
            await this.#ship.createEmbeddedDocuments("Item", [{
                name: game.i18n.format("MGT2.Trade.PassageName", { n: count, grade: name }),
                type: "passage",
                system: { grade, count, destination: context.booking.destination,
                    farePerHead: row.farePerHead }
            }]);
            await this.#postBooking({ title: "MGT2.Trade.Card.Booked",
                line: game.i18n.format("MGT2.Trade.Card.Passengers", { n: count, grade: name,
                    credits: MGT2Helper.credits(total) }),
                note: game.i18n.localize("MGT2.Trade.Card.FarePaid") });
            return true;
        });
    }

    /** One freight lot. */
    static async #onBookFreight(event, target) {
        if ( this.#busy ) return;
        const row = target.dataset.row;
        const index = Number(target.dataset.lot);
        const context = await this._prepareContext({});
        const lot = context.booking?.freights.find(line => (line.row === row) && (line.index === index));
        if ( !lot?.ready ) return;
        const label = game.i18n.localize(lot.label);
        return this.#write(lot.key, () => this.#consign({
            name: game.i18n.format("MGT2.Trade.FreightName", { size: label,
                world: this.#endName("next") }),
            tons: lot.tons,
            farePerTon: context.booking.fares.freight,
            booking: context.booking,
            title: "MGT2.Trade.Card.Consigned",
            line: game.i18n.format("MGT2.Trade.Card.Freight", { size: label, tons: lot.tons,
                credits: lot.fare })
        }));
    }

    /** Mail, as **one freight lot like any other**. */
    static async #onBookMail() {
        if ( this.#busy ) return;
        const context = await this._prepareContext({});
        const mail = context.booking?.mail;
        if ( !mail?.ready ) return;
        return this.#write("mail", () => this.#consign({
            name: game.i18n.format("MGT2.Trade.MailName", { n: mail.containers,
                world: this.#endName("next") }),
            tons: mail.tons,
            farePerTon: MGT2.MailTraffic.creditsPerContainer / MGT2.MailTraffic.tonsPerContainer,
            booking: context.booking,
            title: "MGT2.Trade.Card.Consigned",
            line: game.i18n.format("MGT2.Trade.Card.Mail", { n: mail.containers, tons: mail.tons,
                credits: mail.fare })
        }));
    }

    /** A `cargo` lot carried for a fare. */
    async #consign({ name, tons, farePerTon, booking, title, line }) {
        await this.#ship.createEmbeddedDocuments("Item", [{
            name,
            type: "cargo",
            system: { tons, farePerTon, destination: booking.destination, dueDay: booking.dueDay }
        }]);
        await this.#postBooking({ title, line,
            note: game.i18n.format("MGT2.Trade.Card.DueDay", { day: booking.dueDay }) });
        return true;
    }

    /**
     * The guard every act at this counter shares.
     * @param {() => Promise<boolean>} act   False where nothing was written
     */
    async #write(key, act) {
        this.#busy = true;
        this.#taken.add(key);
        this.render({ parts: ["results"] });
        try {
            if ( !await act() ) this.#taken.delete(key);
        }
        catch ( error ) {
            console.error(error);
            this.#taken.delete(key);
            ui.notifications.error(game.i18n.localize("MGT2.Trade.Errors.BookingFailed"));
        }
        finally {
            this.#busy = false;
            this.render();
        }
    }

    /**
     * A plain `ApplicationV2` inherits no drag-drop plumbing, so the controller is supplied here as
     * the speculative and chargen screens' are.
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

    /** Three zones: the two ends of the route, and the hull that carries what is booked on it. */
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
        else if ( !this.seed(actor, zone.dataset.slot) ) return;
        return this.render();
    }

    /** A dropped world is named; a typed one is only ever its own profile line. */
    #endName(end) {
        return this.#worlds[end]?.name || StopTraffic.parseLine(this.#input[end]).profile;
    }

    /** ONE card, and it is about the BOOKING. */
    async #postBooking({ title, line, note }) {
        const hold = this.#ship.system.cargo;
        // Swallowed on purpose: the consignment is already aboard, and a card that failed to render
        // must not report the booking as one that never happened.
        try {
            const content = await foundry.applications.handlebars.renderTemplate(
                "systems/mgt2/templates/chat/traffic-booking.html", {
                    title,
                    where: game.i18n.format("MGT2.Trade.Route", { here: this.#endName("here"),
                        next: this.#endName("next"), parsecs: this.reading.parsecs }),
                    line,
                    note,
                    ship: this.#ship.name,
                    used: hold.used, capacity: hold.capacity, over: hold.over === true
                });
            return await getDocumentClass("ChatMessage").create({
                author: game.user.id,
                speaker: ChatMessage.getSpeaker(),
                content
            });
        }
        catch ( error ) {
            console.error(error);
            return null;
        }
    }

    /** The offer, on the log. */
    static async #onPost(event, target) {
        const context = await this._prepareContext({});
        if ( !context.ready ) return;
        // The same readout with nothing left to press: the card and the dialog cannot drift.
        const body = await foundry.applications.handlebars.renderTemplate(
            StopTrafficDialog.PARTS.results.template, { ...context, card: true });
        const route = foundry.utils.escapeHTML(game.i18n.format("MGT2.Trade.Route", {
            here: context.here.profile, next: context.next.profile, parsecs: context.input.parsecs }));

        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            // v14 appends no display of its own once `content` is set, so this costs the card
            // nothing and buys Dice So Nice and an auditable record.
            rolls: this.#rolls,
            content: `<div class="mgt2 theme-light card stoptraffic">
                <div class="chd"><div class="what"><h4>${
                    foundry.utils.escapeHTML(game.i18n.localize("MGT2.Trade.StopTraffic"))
                }</h4><span class="tgt">${route}</span></div></div>${body}</div>`
        });
    }
}

/** The campaign's own *now*, in days, and the only clock the system has. */
function campaignDay() {
    return game.settings.get("mgt2", "campaignDay");
}

/**
 * Core p.238 hands the trade chapter to the Travellers, so the control is not GM-only: it sits in
 * the token controls, where every user has it, and opens the same window for all of them.
 */
export function registerStopTraffic() {
    Hooks.on("getSceneControlButtons", controls => {
        const tools = controls.tokens?.tools;
        if ( !tools ) return;
        tools.stopTraffic = {
            name: "stopTraffic",
            order: Math.max(...Object.values(tools).map(tool => tool.order ?? 0)) + 1,
            title: "MGT2.Trade.StopTraffic",
            icon: "fa-solid fa-cart-flatbed-suitcase",
            button: true,
            onChange: () => StopTrafficDialog.open()
        };
    });
}
