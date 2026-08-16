import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { WorldData } from "./actors/world-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A sector table prints the travel zone in a column of its own (Core p.248), so the field accepts it
 * appended — `A788899-C A` is how a referee copies a line. The profile proper ends at the Tech Level.
 */
const ZONE_SUFFIX = /\s+([AR])$/i;

const SUFFIX_ZONES = Object.freeze({ A: "amber", R: "red" });

/** The widest a traffic table can return (Core p.239, p.241), and therefore one row's slot. */
const DICE_PER_ROW = 10;

/** Four passenger classes and three freight sizes, each with a slot of its own. */
const ROWS = 7;

/**
 * The three printed tables of a commercial stop, computed and never written down.
 *
 * Pure: every method takes the referee's typed values and the dice already rolled, and returns a
 * reading. Nothing here touches a document, and the dialog below is the only caller with a DOM.
 */
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
     * What ONE end contributes to ONE column. `split` marks a line the other column scores
     * differently — population, Tech Level and the travel zone — which is the whole reason the
     * dialog draws two columns instead of one world modifier.
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

    /**
     * One traffic row. 2D + the DMs is read on the table, and what the table hands back is a dice
     * expression — so the count it returns is spent out of the row's own slot of already-rolled
     * dice. `perDie` turns a lot count into tons (Core p.240: 1D, 1D×5 and 1D×10 per lot).
     */
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
        // One check leads both tables (§33.9), so a Carouse night out reaches the passenger column
        // alone rather than being silently spent on cargo it cannot find.
        const leads = side => side.skills.includes(input.checkSkill);
        const skill = game.i18n.localize(`MGT2.Trade.Skills.${input.checkSkill}`);
        const effectTerm = StopTraffic.term(
            game.i18n.format("MGT2.Trade.Terms.Check", { skill }), input.effect);
        const worldTerm = total => StopTraffic.term(game.i18n.localize("MGT2.Trade.Terms.WorldTotal"), total);

        // Core p.239: the number available "cannot usually exceed the number of people resident".
        // The population code is an order of magnitude, so the cap is 10^code — it never binds on a
        // hub and binds hard on a pop-2 world, which is exactly the case a hub fixture never shows.
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

/* -------------------------------------------- */

/**
 * Traffic at the stop — the passenger, freight and mail rolls of one commercial call.
 *
 * It owns no document and creates none (§33.9 step 1). Two profiles are typed rather than read off a
 * `world` Actor on purpose: the dialog exists so that a referee does not need one, and step 2 is to
 * measure how often the profiles get retyped before deciding the Actor is worth the entry.
 *
 * The form part renders once and the results part re-renders on every keystroke, which is what keeps
 * a caret in the field being typed into.
 *
 * @extends {ApplicationV2}
 * @mixes HandlebarsApplication
 */
export class StopTrafficDialog extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-stop-traffic",
        classes: ["mgt2", "stoptraffic"],
        position: { width: 760, height: 760 },
        window: { resizable: true, icon: "fa-solid fa-cart-flatbed-suitcase",
            title: "MGT2.Trade.StopTraffic" },
        actions: {
            rollCheck: StopTrafficDialog.#onRollCheck,
            rollTraffic: StopTrafficDialog.#onRollTraffic,
            post: StopTrafficDialog.#onPost
        }
    };

    /** @inheritDoc */
    static PARTS = {
        form: { template: "systems/mgt2/templates/stop-traffic.html" },
        results: { template: "systems/mgt2/templates/stop-traffic-results.html", scrollable: [""] }
    };

    /* -------------------------------------------- */

    /**
     * The seven typed values and the leading check. The only state the dialog has, and none of it is
     * persisted: a stop is answered once and the answer is the referee's to write down.
     */
    #input = {
        here: "", next: "", hereZone: "green", nextZone: "green", parsecs: 1,
        steward: 0, checkSkill: "broker", checkDM: 0, effect: 0,
        armed: false, rank: 0, socialDM: 0
    };

    /**
     * Every die of the current offer, rolled once and kept. Each row owns a fixed slot of ten, so a
     * corrected modifier re-reads the dice already on the table instead of quietly producing a
     * different offer — and correcting row one never shifts row two.
     * @type {{traffic: number[], quantity: number[][], mail: number, containers: number}|null}
     */
    #dice = null;

    /** One window: a second one would answer the same stop twice with different dice. */
    static open() {
        const existing = foundry.applications.instances.get("mgt2-stop-traffic");
        return (existing ?? new StopTrafficDialog()).render({ force: true });
    }

    /* -------------------------------------------- */
    /*  Context                                     */
    /* -------------------------------------------- */

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
            socialDM: Math.trunc(Number(this.#input.socialDM) || 0)
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
            // The union of the two skill lists: which of them leads which table is Core p.239-240's
            // business and is read off `MGT2.Traffic.<side>.skills`, not off this control.
            skills: Object.fromEntries(MGT2.Traffic.passenger.skills
                .map(key => [key, `MGT2.Trade.Skills.${key}`])),
            here: input.here,
            next: input.next,
            glossHere: StopTrafficDialog.glossOf(input.here),
            glossNext: StopTrafficDialog.glossOf(input.next),
            ready: Boolean(input.here.uwp && input.next.uwp),
            rolled: this.#dice !== null
        });
        context.canPost = context.ready && context.rolled;
        if ( context.ready ) {
            context.offer = StopTraffic.offer(input, this.#dice);
            const mail = context.offer.mail;
            if ( mail.offered ) mail.credits = MGT2Helper.credits(mail.credits);
        }
        return context;
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
        // `input` alone: a select fires it too, and adding `change` would render every pick twice.
        this.element.addEventListener("input", event => {
            const field = event.target.closest("[data-field]")?.dataset.field;
            if ( !field ) return;
            this.#input[field] = (event.target.type === "checkbox") ? event.target.checked : event.target.value;
            this.#syncGlosses();
            this.render({ parts: ["results"] });
        });
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

    /* -------------------------------------------- */

    /**
     * The Average (8+) check whose Effect leads both tables. A table that has already rolled on paper
     * types the Effect straight into the field instead and never touches this.
     */
    static async #onRollCheck(event, target) {
        const input = this.reading;
        const roll = await new Roll(`2d6 ${MGT2Helper.getFormulaDM(input.checkDM)}`).roll();
        this.#input.effect = roll.total - MGT2.DifficultyTargets.Average;
        const field = this.element.querySelector('[data-field="effect"]');
        if ( field ) field.value = String(this.#input.effect);
        this.render({ parts: ["results"] });
    }

    /**
     * Eight 2D and the dice each table hands back. Everything is rolled in one pass and kept: the
     * seventy quantity dice are the widest the two tables can ever call for, which is what lets a
     * corrected modifier be re-read against the dice already on the table.
     */
    static async #onRollTraffic(event, target) {
        const traffic = await new Roll("16d6").roll();
        const quantity = await new Roll(`${ROWS * DICE_PER_ROW}d6`).roll();
        const containers = await new Roll(MGT2.MailTraffic.containers).roll();

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
        this.render({ parts: ["results"] });
    }

    /* -------------------------------------------- */
    /*  Chat                                        */
    /* -------------------------------------------- */

    /**
     * The offer, on the log. Nothing is written to any document — §9.35 has the system report and the
     * referee apply — so the card is the only record and it carries the same readout the dialog does.
     */
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
            content: `<div class="mgt2 theme-light card stoptraffic">
                <div class="chd"><div class="what"><h4>${
                    foundry.utils.escapeHTML(game.i18n.localize("MGT2.Trade.StopTraffic"))
                }</h4><span class="tgt">${route}</span></div></div>${body}</div>`
        });
    }
}

/* -------------------------------------------- */

/**
 * Core p.238 hands the trade chapter to the Travellers, so the control is not GM-only: it sits in the
 * token controls, where every user has it, and opens the same window for all of them.
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
