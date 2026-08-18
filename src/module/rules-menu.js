import { MENU_ID, RULE_GROUPS, RULES, Rules, ruleSetting } from "./rules.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Where a rule is printed, in the three states a registry row can be in. */
function sourceLine(rule) {
    if ( rule.book ) return rule.page
        ? game.i18n.format("MGT2.Rules.Source",
            { book: game.i18n.localize(`MGT2.Books.${rule.book}`), page: rule.page })
        : game.i18n.localize(`MGT2.Books.${rule.book}`);
    if ( rule.unofficial ) return game.i18n.format("MGT2.Rules.Unofficial", { year: rule.unofficial });
    return game.i18n.localize("MGT2.Rules.HouseRule");
}

/**
 * The switchboard — a file of its own, and that is load-bearing rather than tidy.
 * @extends {ApplicationV2}
 */
export class OptionalRulesMenu extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: MENU_ID,
        tag: "form",
        classes: ["mgt2", "mgt2-rules"],
        position: { width: 560, height: "auto" },
        window: { title: "MGT2.Rules.Title", icon: "fa-solid fa-sliders", resizable: true },
        // Each control writes as it is clicked: a switch that has to be saved afterwards is a
        // switch whose effect nobody sees, and the window stays open because these are read
        // together.
        form: { handler: OptionalRulesMenu.#onSubmit, submitOnChange: true, closeOnSubmit: false }
    };

    /** @inheritDoc */
    static PARTS = {
        body: { template: "systems/mgt2/templates/optional-rules.html", scrollable: [""] }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.groups = RULE_GROUPS.map(group => ({
            key: group,
            label: `MGT2.Rules.Groups.${group}`,
            rules: Object.entries(RULES).filter(([, rule]) => rule.group === group)
                .map(([key, rule]) => this.#row(key, rule))
        })).filter(section => section.rules.length);
        return context;
    }

    /** One row, in whichever of the three shapes the rule is. */
    #row(key, rule) {
        const stored = Rules.get(key);
        return {
            key,
            name: `MGT2.Rules.${key}.name`,
            hint: `MGT2.Rules.${key}.hint`,
            source: sourceLine(rule),
            checked: stored === true,
            // The field name is built here and not in the template: a nested `{{#each}}` under a
            // named block param cannot reach the outer row, and the names came out as `.sanity`.
            choices: rule.choices?.map(choice => ({
                name: `${key}.${choice}`,
                label: rule.choiceLabel.replace("{key}", choice),
                checked: stored.has(choice)
            })) ?? null,
            options: rule.options
                ? Object.entries(rule.options).map(([value, label]) =>
                    ({ value, label, selected: value === stored }))
                : null,
            number: rule.number ? { ...rule.number, value: stored } : null
        };
    }

    /**
     * Read through the DOM rather than off the submitted object: a picker's cells submit a string
     * when one is ticked, an array when several are, and nothing at all when none is — three shapes
     * for one control, where the checkboxes themselves have only two states.
     */
    static async #onSubmit(event, form) {
        for ( const [key, rule] of Object.entries(RULES) ) {
            const stored = Rules.get(key);
            if ( rule.options ) {
                const picked = form.querySelector(`select[name="${key}"]`)?.value;
                if ( picked && (picked !== stored) ) await game.settings.set(...ruleSetting(key), picked);
            }
            else if ( rule.number ) {
                // A blank box is not a zero — it is a referee mid-edit, and writing 0 there would
                // silently lift the cap they were about to set.
                const raw = form.querySelector(`input[name="${key}"]`)?.value;
                const typed = Number(raw);
                if ( (raw !== "") && Number.isFinite(typed) && (typed !== stored) ) {
                    await game.settings.set(...ruleSetting(key), typed);
                }
            }
            else if ( rule.choices ) {
                const ticked = rule.choices.filter(choice =>
                    form.querySelector(`input[name="${key}.${choice}"]`)?.checked);
                const same = (ticked.length === stored.size) && ticked.every(c => stored.has(c));
                if ( !same ) await game.settings.set(...ruleSetting(key), ticked);
            }
            else {
                const ticked = form.querySelector(`input[name="${key}"]`)?.checked === true;
                if ( ticked !== stored ) await game.settings.set(...ruleSetting(key), ticked);
            }
        }
    }
}
