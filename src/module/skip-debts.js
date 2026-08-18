import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Core folio 153, *Skipping on Debts* — the consequence half of the mortgage. */
export class SkipDebts {

    /** One printed line: what it is called, what it is worth, and which way it leans. */
    static term(label, dm) {
        return { label, dm, tone: (dm > 0) ? "pos" : ((dm < 0) ? "neg" : "nil") };
    }

    /**
     * The ladder, in the order folio 153 prints it.
     * @param {number} input.parsecs    Distance run since the crew was last discovered
     * @param {number} input.disguise   0-6, positive — the ladder applies the minus
     * @param {number} input.purchase   The hull's price, for the MCr10 rate
     * @param {boolean} input.revisited Seen in this system more than once in three months
     * @param {string} input.overdue    A `MGT2.SkipDebts.overdue` key
     * @param {number} input.lawLevel   The local Law Level, before the −5
     */
    static terms(input) {
        const rules = MGT2.SkipDebts;
        const say = (key, params) => game.i18n.format(`MGT2.SkipDebts.Terms.${key}`, params);
        const steps = Math.floor(Math.max(0, input.purchase) / rules.creditsPerStep);
        const band = rules.overdue[input.overdue] ?? rules.overdue.under4;
        return [
            SkipDebts.term(say("Parsecs", { n: input.parsecs }), input.parsecs * rules.perParsec),
            SkipDebts.term(say("Disguise"), -input.disguise),
            SkipDebts.term(say("Value", { n: steps }), steps * rules.perStep),
            SkipDebts.term(say("Revisited"), input.revisited ? rules.revisited : 0),
            SkipDebts.term(game.i18n.localize(band.label), band.dm),
            SkipDebts.term(say("LawLevel", { n: input.lawLevel }), input.lawLevel + rules.lawLevelOffset)
        ];
    }

    static total(terms) {
        return terms.reduce((sum, term) => sum + term.dm, 0);
    }

    /** The check itself. */
    static async check(dm) {
        const roll = await new Roll(`2d6 ${MGT2Helper.getFormulaDM(dm)}`).roll();
        return {
            roll, dm, total: roll.total,
            dice: roll.dice[0].results.map(result => result.result),
            target: MGT2.SkipDebts.target,
            hunted: roll.total >= MGT2.SkipDebts.target
        };
    }
}

/** The skip check for one hull. @extends {ApplicationV2} */
export class SkipDebtsDialog extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mgt2", "skipdebts"],
        position: { width: 560, height: 620 },
        window: { resizable: true, icon: "fa-solid fa-user-secret", title: "MGT2.SkipDebts.Title" },
        actions: {
            rollSkip: SkipDebtsDialog.#onRollSkip,
            post: SkipDebtsDialog.#onPost
        }
    };

    /** @inheritDoc */
    static PARTS = {
        form: { template: "systems/mgt2/templates/skip-debts.html" },
        results: { template: "systems/mgt2/templates/skip-debts-results.html", scrollable: [""] }
    };

    /** @type {Actor} */
    #ship;

    /** The reading the last roll produced, kept until the referee rolls again. */
    #reading = null;

    #input;

    constructor(ship, options = {}) {
        super({ ...options, id: `mgt2-skip-debts-${ship.id}` });
        this.#ship = ship;
        const finance = ship.system.finance;
        // Seeded from the hull for the two the folio persists, and from the world the ship is at
        // for the Law Level — the voyage leg already resolves it, and a referee who has a `world`
        // Actor should not retype a digit that is on it.
        this.#input = {
            parsecs: finance.skipParsecs,
            disguise: finance.skipDisguise,
            revisited: false,
            overdue: "under4",
            lawLevel: 0
        };
    }

    /** One window per hull: two would answer the same system with different dice. */
    static async open(ship) {
        const existing = foundry.applications.instances.get(`mgt2-skip-debts-${ship.id}`);
        const app = existing ?? new SkipDebtsDialog(ship);
        if ( !existing ) await app.#seedLawLevel();
        return app.render({ force: true });
    }

    /** The current stop's Law Level, when the leg names a `world` Actor that still exists. */
    async #seedLawLevel() {
        const uuid = this.#ship.system.voyage?.here?.world;
        if ( !uuid ) return;
        let world = null;
        try { world = await fromUuid(uuid); } catch { return; }
        if ( world?.type !== "world" ) return;
        this.#input.lawLevel = world.system.uwp.lawLevel ?? 0;
    }

    /** The typed values, coerced once so nothing below has to. */
    get reading() {
        const rules = MGT2.SkipDebts;
        return {
            parsecs: Math.max(0, Math.trunc(Number(this.#input.parsecs) || 0)),
            disguise: Math.min(rules.disguiseMax,
                Math.max(0, Math.trunc(Number(this.#input.disguise) || 0))),
            revisited: this.#input.revisited === true,
            overdue: (this.#input.overdue in rules.overdue) ? this.#input.overdue : "under4",
            lawLevel: Math.max(0, Math.trunc(Number(this.#input.lawLevel) || 0)),
            purchase: this.#ship.system.finance.purchase
        };
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const input = this.reading;
        const terms = SkipDebts.terms(input);
        Object.assign(context, {
            input: this.#input,
            ship: this.#ship.name,
            purchase: MGT2Helper.credits(input.purchase),
            disguiseMax: MGT2.SkipDebts.disguiseMax,
            overdueBands: Object.fromEntries(
                Object.entries(MGT2.SkipDebts.overdue).map(([key, band]) => [key, band.label])),
            terms,
            dm: SkipDebts.total(terms),
            target: MGT2.SkipDebts.target,
            check: this.#reading
        });
        return context;
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
            this.#input[field] = (event.target.type === "checkbox")
                ? event.target.checked : event.target.value;
            // The reading a roll produced belongs to the ladder it was rolled against, so a changed
            // term discards it rather than leaving old dice beside a new DM — `VoyageScreen` keeps
            // its misjump the same way.
            this.#reading = null;
            this.render({ parts: ["results"] });
        });
    }

    /** Roll, and save the two the folio persists. */
    static async #onRollSkip(event, target) {
        const input = this.reading;
        const terms = SkipDebts.terms(input);
        this.#reading = await SkipDebts.check(SkipDebts.total(terms));
        this.#reading.terms = terms;
        await this.#ship.update({
            "system.finance.skipParsecs": input.parsecs,
            "system.finance.skipDisguise": input.disguise
        });
        this.render({ parts: ["results"] });
    }

    /** The reading, on the log. */
    static async #onPost(event, target) {
        if ( !this.#reading ) return;
        const context = await this._prepareContext({});
        // The same readout with nothing left to press: the card and the dialog cannot drift.
        const body = await foundry.applications.handlebars.renderTemplate(
            SkipDebtsDialog.PARTS.results.template, { ...context, card: true });
        const title = foundry.utils.escapeHTML(game.i18n.localize("MGT2.SkipDebts.Title"));
        const ship = foundry.utils.escapeHTML(this.#ship.name);
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.#ship }),
            // The 2D the verdict was read from, so the card is a roll and not a report of one
            //.
            rolls: [this.#reading.roll],
            content: `<div class="mgt2 theme-light card skipdebts">
                <div class="chd"><div class="what"><h4>${title}</h4>
                    <span class="tgt">${ship}</span></div></div>${body}</div>`
        });
    }
}
