const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Build the dialog body as a bare <div> with no attributes: DialogV2 runs `cleanHTML` on string
 * content, which would strip attributes off the rendered form controls.
 * @param {string} path   Template path
 * @param {object} data   Template context
 * @returns {Promise<HTMLDivElement>}
 */
async function buildContent(path, data) {
    const content = document.createElement("div");
    content.innerHTML = await foundry.applications.handlebars.renderTemplate(path, data);
    return content;
}

/** The mgt2 theme classes applied to every prompt. */
function themeClasses() {
    return ["mgt2", game.settings.get("mgt2", "theme"), "themed", "theme-light"];
}

/* -------------------------------------------- */

/**
 * A read-only pop-out showing the full species description.
 * This is a viewer rather than a form, so it is a small ApplicationV2 instead of a DialogV2
 * (which requires at least one button).
 * @extends {ApplicationV2}
 * @mixes HandlebarsApplication
 */
class EditorFullView extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mgt2"],
        position: { width: 640, height: 520 },
        window: { resizable: true, title: "" }
    };

    /** @inheritDoc */
    // Not a root part: a root part that renders a single element gets replaced by its children,
    // which would drop the wrapper and its class.
    static PARTS = {
        body: { template: "systems/mgt2/templates/editor-fullview.html", scrollable: [""] }
    };

    /** @inheritDoc */
    _initializeApplicationOptions(options) {
        options = super._initializeApplicationOptions(options);
        const theme = game.settings.get("mgt2", "theme");
        if ( theme && !options.classes.includes(theme) ) options.classes.push(theme);
        return options;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.config = CONFIG.MGT2;
        context.html = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            this.options.rawHtml ?? "", { secrets: false });
        return context;
    }
}

/* -------------------------------------------- */

export class CharacterPrompts {

    /**
     * Configure initiative and damage order.
     * @param {object} system   The actor's system data
     * @returns {Promise<object|null>}
     */
    static async openConfig(system) {
        const content = await buildContent("systems/mgt2/templates/actors/actor-config-sheet.html", {
            config: CONFIG.MGT2,
            system
        });

        return DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Actor.Configuration") },
            classes: themeClasses(),
            position: { width: 420 },
            content,
            ok: { label: "MGT2.Save", icon: "fa-solid fa-floppy-disk" },
            rejectClose: false
        });
    }

    /**
     * Configure the visibility of one characteristic.
     * @returns {Promise<object|null>}
     */
    static async openCharacteristic(name, show, showMax, showAll = false) {
        const content = await buildContent(
            "systems/mgt2/templates/actors/actor-config-characteristic-sheet.html",
            { name, show, showMax, showAll });

        return DialogV2.input({
            window: { title: `${game.i18n.localize("MGT2.Actor.Configuration")}: ${name}` },
            classes: themeClasses(),
            position: { width: 400 },
            content,
            ok: { label: "MGT2.Save", icon: "fa-solid fa-floppy-disk" },
            rejectClose: false
        });
    }

    /**
     * Edit a single character trait.
     * @param {{name: string, description: string}} data
     * @returns {Promise<object|null>}
     */
    static async openTraitEdit(data) {
        const content = await buildContent("systems/mgt2/templates/actors/trait-sheet.html", {
            config: CONFIG.MGT2,
            data
        });

        const title = data?.name || game.i18n.localize("MGT2.Actor.EditTrait");
        return DialogV2.input({
            window: { title },
            classes: themeClasses(),
            position: { width: 520 },
            content,
            ok: { label: "MGT2.Save", icon: "fa-solid fa-floppy-disk" },
            rejectClose: false
        });
    }

    /**
     * Show the full species description.
     * @param {string} title
     * @param {string} html
     */
    static async openEditorFullView(title, html) {
        return new EditorFullView({ window: { title: title || "" }, rawHtml: html }).render({ force: true });
    }
}
