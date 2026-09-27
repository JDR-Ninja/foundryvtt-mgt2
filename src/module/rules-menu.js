import { INTERPRETATION_SECTIONS, MENU_ID, RULE_GROUPS, RULES, Rules, ruleSetting } from "./rules.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Where a rule is printed; a house rule prints nothing, the page it sits on says so. */
function sourceLine(rule) {
    if ( rule.book ) return rule.page
        ? game.i18n.format("MGT2.Rules.Source",
            { book: game.i18n.localize(`MGT2.Books.${rule.book}`), page: rule.page })
        : game.i18n.localize(`MGT2.Books.${rule.book}`);
    if ( rule.unofficial ) return game.i18n.format("MGT2.Rules.Unofficial", { year: rule.unofficial });
    return "";
}

function isDefault(key) {
    const stored = Rules.get(key);
    const initial = RULES[key].default;
    if ( stored instanceof Set ) return (stored.size === initial.length) && initial.every(one => stored.has(one));
    return stored === initial;
}

const fold = text => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** The switchboard — a file of its own, and that is load-bearing rather than tidy. @extends {ApplicationV2} */
export class OptionalRulesMenu extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: MENU_ID,
        tag: "form",
        classes: ["mgt2", "mgt2-rules", "scrollpart"],
        position: { width: 780, height: 640 },
        window: { title: "MGT2.Rules.Title", icon: "fa-solid fa-sliders", resizable: true },
        // Each control writes as it is clicked: a switch that has to be saved afterwards is a
        // switch whose effect nobody sees, and the window stays open because these are read together.
        form: { handler: OptionalRulesMenu.#onSubmit, submitOnChange: true, closeOnSubmit: false },
        actions: { page: OptionalRulesMenu.#onPage, explain: OptionalRulesMenu.#onExplain }
    };

    /** @inheritDoc */
    static PARTS = {
        body: { template: "systems/mgt2/templates/optional-rules.html", scrollable: [".pane"] }
    };

    /** The page on show, the search, the filter and the explanations opened, kept across renders. */
    #view = { page: RULE_GROUPS[0], query: "", changed: false, open: new Set() };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const rows = Object.entries(RULES).map(([key, rule]) => this.#row(key, rule));
        const pages = RULE_GROUPS.map(group => ({
            key: group,
            label: `MGT2.Rules.Groups.${group}`,
            sections: [{ rules: rows.filter(row => row.book && (row.group === group)) }]
        }));
        pages.push({
            key: "interpretations",
            label: "MGT2.Rules.Interpretations",
            intro: "MGT2.Rules.InterpretationsHint",
            sections: INTERPRETATION_SECTIONS.map(section => ({
                label: `MGT2.Rules.Sections.${section}`,
                rules: rows.filter(row => row.section === section)
            }))
        });
        for ( const page of pages ) page.count = page.sections.reduce((sum, section) => sum + section.rules.length, 0);
        context.pages = pages.filter(page => page.count);
        context.view = this.#view;
        return context;
    }

    /** One row, in whichever of the four shapes the rule is. */
    #row(key, rule) {
        const stored = Rules.get(key);
        return {
            key,
            group: rule.group,
            section: rule.section ?? null,
            book: Boolean(rule.book),
            name: `MGT2.Rules.${key}.name`,
            hint: `MGT2.Rules.${key}.hint`,
            source: sourceLine(rule),
            open: this.#view.open.has(key),
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

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this.element.addEventListener("input", event => {
            if ( !event.target.matches("input.q") ) return;
            this.#view.query = event.target.value;
            this.#apply();
        });
        this.element.addEventListener("keydown", event => {
            if ( (event.key === "Enter") && event.target.matches("input.q") ) event.preventDefault();
        });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this.#mark();
        this.#apply();
    }

    /** The search and its filter narrow the list and are no rule, so they submit nothing. @inheritDoc */
    _onChangeForm(formConfig, event) {
        if ( event.target.matches("input.changed") ) {
            this.#view.changed = event.target.checked;
            return this.#apply();
        }
        if ( event.target.matches("input.q") ) return;
        return super._onChangeForm(formConfig, event);
    }

    /** Flags every rule off its default, and counts them on the rail. */
    #mark() {
        const counts = {};
        for ( const row of this.element.querySelectorAll(".rule[data-rule]") ) {
            const changed = !isDefault(row.dataset.rule);
            row.classList.toggle("changed", changed);
            const page = row.closest(".page").dataset.page;
            counts[page] = (counts[page] ?? 0) + Number(changed);
        }
        for ( const badge of this.element.querySelectorAll(".rail .mod") ) {
            const count = counts[badge.closest("[data-page]").dataset.page] ?? 0;
            badge.textContent = count ? String(count) : "";
            badge.hidden = !count;
        }
    }

    /** One page at a time; a search or the filter lists what matches on every page. */
    #apply() {
        const query = fold(this.#view.query.trim());
        const filtering = Boolean(query) || this.#view.changed;
        this.element.querySelector(".rules").classList.toggle("filtering", filtering);
        for ( const button of this.element.querySelectorAll(".rail [data-page]") ) {
            button.classList.toggle("active", !filtering && (button.dataset.page === this.#view.page));
        }
        let shown = 0;
        for ( const page of this.element.querySelectorAll(".page") ) {
            let listed = 0;
            for ( const section of page.querySelectorAll(".sec") ) {
                let kept = 0;
                for ( const row of section.querySelectorAll(".rule") ) {
                    const match = !filtering || ((!query || fold(row.textContent).includes(query))
                        && (!this.#view.changed || row.classList.contains("changed")));
                    row.hidden = !match;
                    kept += Number(match);
                }
                section.hidden = !kept;
                listed += kept;
            }
            page.hidden = filtering ? !listed : (page.dataset.page !== this.#view.page);
            if ( !page.hidden ) shown += listed;
        }
        this.element.querySelector(".none").hidden = shown > 0;
    }

    /** @this {OptionalRulesMenu} */
    static #onPage(event, target) {
        Object.assign(this.#view, { page: target.dataset.page, query: "", changed: false });
        this.element.querySelector("input.q").value = "";
        this.element.querySelector("input.changed").checked = false;
        this.#apply();
    }

    /** @this {OptionalRulesMenu} */
    static #onExplain(event, target) {
        const row = target.closest(".rule");
        const open = row.classList.toggle("open");
        target.setAttribute("aria-expanded", String(open));
        if ( open ) this.#view.open.add(row.dataset.rule);
        else this.#view.open.delete(row.dataset.rule);
    }

    /** Read through the DOM, not the submitted object: a picker's cells submit a string, an array or nothing. */
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
        this.#mark();
    }
}
