import { registerChargenSettings } from "./chargen-close.js";
import { registerCreditSettings } from "./credit-split.js";
import { PACKS_SETTING, WorldPacksMenu } from "./packs.js";
import { registerRequestSettings } from "./request.js";
import { refreshRuleUI, registerRules } from "./rules.js";
import { OptionalRulesMenu } from "./rules-menu.js";

const THEMES = {
    "black-and-red": "MGT2.Themes.BlackAndRed",
    "mwamba": "MGT2.Themes.Mwamba",
    "blue": "MGT2.Themes.Blue"
};

/**
 * A theme is only an accent colour now, and it is declared on the body: swapping the class
 * re-colours every open sheet, dialog and chat card, so the setting needs no reload.
 * @param {string} [theme]   The theme id; defaults to the current setting.
 */
export function applyTheme(theme = game.settings.get("mgt2", "theme")) {
    document.body.classList.remove(...Object.keys(THEMES));
    if ( theme ) document.body.classList.add(theme);
}

export const registerSettings = function () {

    // Not user-facing: the last migration this world has run.
    game.settings.register("mgt2", "migrationVersion", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register("mgt2", "theme", {
        name: "MGT2.Settings.theme.name",
        hint: "MGT2.Settings.theme.hint",
        scope: "client",
        config: true,
        default: "black-and-red",
        type: String,
        choices: THEMES,
        onChange: applyTheme
    });

    // The three display settings below are read into the render context and nowhere else, so
    // without an onChange a flipped one did nothing until every sheet was reopened.
    game.settings.register('mgt2', 'usePronouns', {
        name: "MGT2.Settings.usePronouns.name",
        hint: "MGT2.Settings.usePronouns.hint",
        default: false,
        scope: 'world',
        type: Boolean,
        config: true,
        requiresReload: false,
        onChange: refreshRuleUI
    });

    game.settings.register('mgt2', 'useGender', {
        name: "MGT2.Settings.useGender.name",
        hint: "MGT2.Settings.useGender.hint",
        default: false,
        scope: 'world',
        type: Boolean,
        config: true,
        requiresReload: false,
        onChange: refreshRuleUI
    });

    // The campaign's *now*, in days, and nothing schedules it: speculative trade needs a
    // day to compare against — "cannot deal with that supplier again for at least a month" (Core
    // p.243) — and `game.time.worldTime` stays at 0 without a calendar module, which would read as
    // permanently closed.
    game.settings.register('mgt2', 'campaignDay', {
        name: "MGT2.Settings.campaignDay.name",
        hint: "MGT2.Settings.campaignDay.hint",
        default: 0,
        scope: 'world',
        type: new foundry.data.fields.NumberField({ required: true, integer: true, initial: 0 }),
        config: true,
        requiresReload: false
    });

    game.settings.register('mgt2', 'showLife', {
        name: "MGT2.Settings.showLife.name",
        hint: "MGT2.Settings.showLife.hint",
        default: false,
        scope: 'world',
        type: Boolean,
        config: true,
        requiresReload: false,
        onChange: refreshRuleUI
    });

    registerRules();
    registerRequestSettings();
    registerCreditSettings();
    // Folio 50's shared skills package: the pool the table chose, edited from the closing screen
    // and never shown in the settings pane, because it is data the referee typed and not a rule.
    registerChargenSettings();

    // Not user-facing: the folder and the collection ids the compendium button has created.
    game.settings.register("mgt2", PACKS_SETTING, {
        scope: "world",
        config: false,
        type: new foundry.data.fields.ObjectField()
    });

    game.settings.registerMenu("mgt2", "rules", {
        name: "MGT2.Rules.Title",
        hint: "MGT2.Rules.MenuHint",
        label: "MGT2.Rules.MenuLabel",
        icon: "fa-solid fa-sliders",
        type: OptionalRulesMenu,
        restricted: true
    });

    game.settings.registerMenu("mgt2", "packs", {
        name: "MGT2.Settings.worldPacks.name",
        hint: "MGT2.Settings.worldPacks.hint",
        label: "MGT2.Settings.worldPacks.label",
        icon: "fa-solid fa-book-atlas",
        type: WorldPacksMenu,
        restricted: true
    });

};
