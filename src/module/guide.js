/**
 * The `?` in a window's title bar, and the guide page it opens. A sheet names a topic, a page
 * answers it, and `CONFIG.MGT2.GuideTopics` is the vocabulary both are checked against. Any pack
 * whose manifest entry carries `flags.mgt2.guide` may answer, this system's own first.
 */

/** Language → topic → the page answering it, once the flagged packs have been read. */
let index = null;
let loading = null;

/** Read once, on the first sheet that asks: finding the packs is free, reading their journals is not. */
async function readGuides() {
    const byLanguage = new Map();
    for ( const pack of game.packs ) {
        if ( (pack.metadata.type !== "JournalEntry") || !pack.metadata.flags?.mgt2?.guide ) continue;
        for ( const journal of await pack.getDocuments() ) {
            const language = journal.flags?.mgt2?.lang;
            if ( !language ) continue;
            const topics = byLanguage.get(language) ?? new Map();
            byLanguage.set(language, topics);
            for ( const page of journal.pages ) {
                const topic = page.flags?.mgt2?.topic;
                // First pack answering wins, so a module never displaces this system's own page.
                if ( topic && !topics.has(topic) ) topics.set(topic, { uuid: journal.uuid, pageId: page.id });
            }
        }
    }
    return byLanguage;
}

function pageFor(topic) {
    if ( !topic || !index ) return null;
    return index.get(game.i18n.lang)?.get(topic) ?? index.get("en")?.get(topic) ?? null;
}

export async function guidePage(topic) {
    if ( !topic ) return null;
    index ??= await (loading ??= readGuides());
    return pageFor(topic);
}

/**
 * ⚠ A frame button is built on the first render only (`_renderFrame`), so re-rendering can neither
 * add nor remove one. A body class hides it, and `display: none` takes it out of the tab order.
 */
export function applyGuideButton(show = game.settings.get("mgt2", "showGuideButton")) {
    const bodies = [document.body, ...foundry.applications.detached.windows.values()
        .map(window => window.window?.document?.body).filter(body => body)];
    for ( const body of bodies ) body.classList.toggle("mgt2-guide-off", !show);
}

async function onOpenGuide() {
    const found = await guidePage(this.constructor.GUIDE_TOPIC);
    if ( !found ) return;
    const journal = await fromUuid(found.uuid);
    journal?.sheet.render({ force: true, pageId: found.pageId, anchor: this.guideAnchor });
}

/**
 * One `?` beside the window's own controls, against core's advice on `_getFrameButtons`: a header
 * control sits inside the `⋮` menu, and this is the control whose job is to be found.
 * @returns {typeof DocumentSheetV2}
 */
export const GuideButtonMixin = Base => class extends Base {

    /** The topic this screen's page answers, or null while that page is unwritten. */
    static GUIDE_TOPIC = null;

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        actions: { openGuide: onOpenGuide }
    };

    /** A declared anchor key, never a slugified title. @type {string|null} */
    get guideAnchor() {
        return null;
    }

    /** @inheritDoc */
    _getFrameButtons(options) {
        const buttons = super._getFrameButtons(options);
        if ( this.constructor.GUIDE_TOPIC ) buttons.push({
            icon: "fa-solid fa-circle-question",
            label: "MGT2.Guide.Open",
            action: "openGuide"
        });
        return buttons;
    }

    /** Hidden once nothing answers, which covers a compiled pack older than the code. @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        const button = this.element.querySelector('button[data-action="openGuide"]');
        if ( !button ) return;
        if ( index ) button.hidden = !pageFor(this.constructor.GUIDE_TOPIC);
        else guidePage(this.constructor.GUIDE_TOPIC).then(found => { button.hidden = !found; });
    }
};
