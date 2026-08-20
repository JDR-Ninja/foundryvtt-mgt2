import { PACKAGE_SETTING } from "./chargen-close.js";
import { PACKS_SETTING, WorldPacksMenu } from "./packs.js";
import { NUDGE_MODES, VISIBILITY_MODES } from "./request.js";
import { refreshRuleUI, RULES, ruleSetting, SEEDED_SETTING } from "./rules.js";
import { OptionalRulesMenu } from "./rules-menu.js";

const { fields } = foundry.data;

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

/**
 * The stored field of a picker, a choice or a **count**; a switch needs none and registers as a
 * plain Boolean.
 */
function ruleField(rule) {
    if ( rule.options ) return new fields.StringField({
        required: true, blank: false, choices: rule.options, initial: rule.default });
    if ( rule.number ) return new fields.NumberField({
        required: true, nullable: false, integer: true, initial: rule.default, ...rule.number });
    return new fields.SetField(
        new fields.StringField({ required: true, blank: false, choices: rule.choices }),
        { initial: () => [...rule.default] });
}

/** Every setting and menu the system has; nothing is registered anywhere else. */
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
    game.settings.register("mgt2", "usePronouns", {
        name: "MGT2.Settings.usePronouns.name",
        hint: "MGT2.Settings.usePronouns.hint",
        default: false,
        scope: "world",
        type: Boolean,
        config: true,
        requiresReload: false,
        onChange: refreshRuleUI
    });

    game.settings.register("mgt2", "useGender", {
        name: "MGT2.Settings.useGender.name",
        hint: "MGT2.Settings.useGender.hint",
        default: false,
        scope: "world",
        type: Boolean,
        config: true,
        requiresReload: false,
        onChange: refreshRuleUI
    });

    // The campaign's *now*, in days, and nothing schedules it: speculative trade needs a
    // day to compare against — "cannot deal with that supplier again for at least a month" (Core
    // p.243) — and `game.time.worldTime` stays at 0 without a calendar module, which would read as
    // permanently closed.
    game.settings.register("mgt2", "campaignDay", {
        name: "MGT2.Settings.campaignDay.name",
        hint: "MGT2.Settings.campaignDay.hint",
        default: 0,
        scope: "world",
        type: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        config: true,
        requiresReload: false,
        onChange: refreshRuleUI
    });

    game.settings.register("mgt2", "showLife", {
        name: "MGT2.Settings.showLife.name",
        hint: "MGT2.Settings.showLife.hint",
        default: false,
        scope: "world",
        type: Boolean,
        config: true,
        requiresReload: false,
        onChange: refreshRuleUI
    });

    // Not user-facing: which rules this world has already been through seeding for.
    game.settings.register("mgt2", SEEDED_SETTING, {
        scope: "world",
        config: false,
        type: new fields.SetField(new fields.StringField({ required: true, blank: false }),
            { initial: () => [] })
    });

    for ( const [key, rule] of Object.entries(RULES) ) {
        game.settings.register(...ruleSetting(key), {
            name: `MGT2.Rules.${key}.name`,
            hint: `MGT2.Rules.${key}.hint`,
            scope: "world",
            // The grouped menu below is where these are set: Foundry's settings pane cannot group,
            // and an ungrouped list of switches is the noise this feature exists to remove.
            config: false,
            type: (rule.choices || rule.options || rule.number) ? ruleField(rule) : Boolean,
            default: rule.default,
            requiresReload: false,
            onChange: refreshRuleUI
        });
    }

    game.settings.register("mgt2", "request.visibility", {
        name: "MGT2.Request.Settings.visibility.name",
        hint: "MGT2.Request.Settings.visibility.hint",
        scope: "world",
        config: true,
        type: String,
        choices: VISIBILITY_MODES,
        default: "public",
        requiresReload: false
    });

    // Not user-facing: the last demands, held as their own PAYLOAD rather than as message ids.
    game.settings.register("mgt2", "request.recent", {
        scope: "world",
        config: false,
        type: new fields.ArrayField(new fields.ObjectField()),
        default: []
    });

    // Client scope, and that is the direct correction of the module this design was read against: a
    // world-scoped alert with no opt-out.
    game.settings.register("mgt2", "request.nudge", {
        name: "MGT2.Request.Settings.nudge.name",
        hint: "MGT2.Request.Settings.nudge.hint",
        scope: "client",
        config: true,
        type: String,
        choices: NUDGE_MODES,
        default: "flash",
        requiresReload: false
    });

    // What the table's transfer cards say by default; either is overridden on any one transfer.
    game.settings.register("mgt2", "credit.balances", {
        name: "MGT2.CreditSplit.Settings.balances.name",
        hint: "MGT2.CreditSplit.Settings.balances.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });

    game.settings.register("mgt2", "credit.visibility", {
        name: "MGT2.CreditSplit.Settings.visibility.name",
        hint: "MGT2.CreditSplit.Settings.visibility.hint",
        scope: "world",
        config: true,
        type: String,
        choices: VISIBILITY_MODES,
        default: "public",
        requiresReload: false
    });

    // Not user-facing: Folio 50's shared skills package, the pool the table chose, edited from the
    // closing screen where it is used.
    game.settings.register("mgt2", PACKAGE_SETTING, {
        scope: "world",
        config: false,
        type: new fields.ObjectField(),
        default: { name: "", skills: [] }
    });

    // Not user-facing: the folder and the collection ids the compendium button has created.
    game.settings.register("mgt2", PACKS_SETTING, {
        scope: "world",
        config: false,
        type: new fields.ObjectField()
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
