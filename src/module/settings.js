import { PACKAGE_SETTING } from "./chargen-close.js";
import { CHAIN_INTO_SETTING, refreshChainInto } from "./chatHelper.js";
import { applyGuideButton } from "./guide.js";
import { PACKS_SETTING, WorldPacksMenu } from "./packs.js";
import { ASK_AGAIN_SETTING, ASK_SAME_SETTING, NUDGE_MODES, refreshAskTheSame, refreshRequestCards,
    VISIBILITY_MODES } from "./request.js";
import { refreshRuleUI, RULES, ruleSetting, SEEDED_SETTING } from "./rules.js";
import { OptionalRulesMenu } from "./rules-menu.js";

const { fields } = foundry.data;

// The grounds and the grain. A preset owns the two anchors, the two clamps, the chrome pair, the
// eight derivation rates and the three status hues; everything else derives from them.
const PRESETS = {
    "classic": "MGT2.Palette.Preset.classic",
    "warm": "MGT2.Palette.Preset.warm",
    "cool": "MGT2.Palette.Preset.cool",
    "contrast": "MGT2.Palette.Preset.contrast"
};

// Eleven, spaced in hue. Only hue and chroma pass the clamp, so two entries differing in lightness
// alone would render identically.
const ACCENTS = {
    "red": "MGT2.Palette.Accent.red",
    "orange": "MGT2.Palette.Accent.orange",
    "gold": "MGT2.Palette.Accent.gold",
    "green": "MGT2.Palette.Accent.green",
    "teal": "MGT2.Palette.Accent.teal",
    "cyan": "MGT2.Palette.Accent.cyan",
    "blue": "MGT2.Palette.Accent.blue",
    "violet": "MGT2.Palette.Accent.violet",
    "magenta": "MGT2.Palette.Accent.magenta",
    "pink": "MGT2.Palette.Accent.pink",
    "steel": "MGT2.Palette.Accent.steel"
};

// Light or dark is Foundry's call by default — its colourScheme drives the body class and the whole
// palette follows it. The two named values overrule that for this system's own windows.
const GROUNDS = {
    "auto": "MGT2.Palette.Ground.auto",
    "light": "MGT2.Palette.Ground.light",
    "dark": "MGT2.Palette.Ground.dark"
};

/** Each preset lands on an accent of its own, so stepping through them reads as four places. */
const PRESET_ACCENT = {
    "classic": "red", "warm": "blue", "cool": "orange", "contrast": "violet"
};

/** The three accent-only themes that preceded the presets, as accents of the one palette. */
const LEGACY_ACCENT = { "black-and-red": "red", "mwamba": "green", "blue": "steel" };

// Under the colour-blind pair only these three stay clear of BOTH halves: every warm accent
// collapses into vermillion under deuteranopia and every cool one into the blue.
const CVD_SAFE = ["teal", "pink", "steel"];

/**
 * The palette is classes on the body — preset, accent, ground and the two switches — so any one of
 * them changing re-colours every open sheet, dialog and chat card with no reload.
 * @param {string} [preset]   Preset id; defaults to the current setting.
 * @param {string} [accent]   Accent id; defaults to the current setting.
 * @param {string} [ground]   Ground id; defaults to the current setting.
 */
export function applyPalette(preset = game.settings.get("mgt2", "palettePreset"),
                             accent = game.settings.get("mgt2", "paletteAccent"),
                             ground = game.settings.get("mgt2", "paletteGround")) {
    // A client still holding the retired `dark` preset paints as the pair it really was, from the
    // first frame — otherwise its class outlives the migration and `onPreset` reads it as current.
    ground = groundFor(preset, ground);
    if ( preset === "dark" ) preset = "classic";
    const off = [...Object.keys(PRESETS).map(id => `mgt2-preset-${id}`),
        ...Object.keys(ACCENTS).map(id => `mgt2-accent-${id}`),
        ...Object.keys(GROUNDS).map(id => `mgt2-ground-${id}`)];
    const on = [`mgt2-preset-${preset}`, `mgt2-accent-${accent}`];
    // The ground and both switches are named for the state that is NOT the default, so a window
    // that never received a class — a detached one — renders the built palette, following Foundry.
    if ( ground !== "auto" ) on.push(`mgt2-ground-${ground}`);
    (game.settings.get("mgt2", "paletteChrome") ? off : on).push("mgt2-chrome-off");
    (game.settings.get("mgt2", "paletteCvd") ? on : off).push("mgt2-cvd");
    // A detached window copies the body's classes when it opens and whenever core reconfigures the
    // UI, never in between, so a palette change reaches a popped-out sheet only if we paint it too.
    const bodies = [document.body, ...foundry.applications.detached.windows.values()
        .map(w => w.window?.document?.body).filter(b => b)];
    for ( const body of bodies ) {
        body.classList.remove(...off);
        body.classList.add(...on);
    }
    for ( const app of foundry.applications.instances.values() ) groundWindow(app.element, ground);
}

/**
 * The ground in force. `dark` was a preset until it became a ground; a client still holding that id
 * reads dark here, which covers the window between load and `migrateDarkPreset` writing the setting.
 */
function groundFor(preset = game.settings.get("mgt2", "palettePreset"),
                   ground = game.settings.get("mgt2", "paletteGround")) {
    return preset === "dark" ? "dark" : ground;
}

/**
 * A ground has to reach core's OWN variables too — its text, tables and form fields — and a body
 * class does not: core declares those from `themed theme-<x>` on the window itself. `data-mgt2-ground`
 * marks the ones we put there, so a per-document sheet theme, which arrives the same way, is left be.
 * @param {HTMLElement} element   An application's root element.
 * @param {string} [ground]       Ground id; defaults to the one in force.
 */
export function groundWindow(element, ground = groundFor()) {
    if ( !element?.classList.contains("mgt2") ) return;
    if ( element.classList.contains("themed") && !("mgt2Ground" in element.dataset) ) return;
    element.classList.remove("theme-light", "theme-dark");
    if ( ground === "auto" ) {
        element.classList.remove("themed");
        delete element.dataset.mgt2Ground;
        return;
    }
    element.classList.add("themed", `theme-${ground}`);
    element.dataset.mgt2Ground = ground;
}

/**
 * The preset picker moves the accent picker WITH IT, inside the form. `onPreset` alone cannot do
 * this: the settings form submits every control, so whichever order it writes them in, its own stale
 * accent lands on top and the preset reads as a repaint of the same place.
 * @param {SettingsConfig} app       The settings form being rendered.
 * @param {HTMLElement} element      Its root element.
 */
export function wirePalettePickers(app, element) {
    const preset = element.querySelector('select[name="mgt2.palettePreset"]');
    const accent = element.querySelector('select[name="mgt2.paletteAccent"]');
    if ( !preset || !accent ) return;
    let previous = preset.value;
    preset.addEventListener("change", () => {
        if ( PRESET_ACCENT[previous] === accent.value ) accent.value = PRESET_ACCENT[preset.value];
        previous = preset.value;
    });
}

/**
 * Turning the colour-blind pair on moves an accent that would collide with it: five of the eleven
 * read as one half of the pair under deuteranopia, and a preset's default is always one of them.
 */
async function onCvd(on) {
    if ( on && !CVD_SAFE.includes(game.settings.get("mgt2", "paletteAccent")) ) {
        await game.settings.set("mgt2", "paletteAccent", "teal");
    }
    applyPalette();
}

/**
 * Move the accent with the preset, but only while it is still the OUTGOING preset's own default:
 * an accent someone chose survives the move. The body class is the record of what was applied.
 */
async function onPreset(preset) {
    const previous = [...document.body.classList].find(c => c.startsWith("mgt2-preset-"))?.slice(12);
    if ( previous && (PRESET_ACCENT[previous] === game.settings.get("mgt2", "paletteAccent")) ) {
        await game.settings.set("mgt2", "paletteAccent", PRESET_ACCENT[preset]);
    }
    applyPalette(preset);
}

/**
 * `dark` was a preset whose whole job was to force the dark ground, which is now an axis of its own.
 * A client that had it keeps that ground, on the palette it was a near-duplicate of.
 */
export function migrateDarkPreset() {
    if ( game.settings.get("mgt2", "palettePreset") !== "dark" ) return;
    Hooks.once("ready", async () => {
        await game.settings.set("mgt2", "paletteGround", "dark");
        await game.settings.set("mgt2", "palettePreset", "classic");
    });
}

/**
 * A client on one of the three themes that preceded the presets keeps the colour it had: two
 * survive by name and the old washed-out blue is Steel. Clears itself once it has run.
 */
export function migrateLegacyTheme() {
    const accent = LEGACY_ACCENT[game.settings.get("mgt2", "theme")];
    if ( !accent ) return;
    Hooks.once("ready", async () => {
        await game.settings.set("mgt2", "paletteAccent", accent);
        await game.settings.set("mgt2", "theme", "");
    });
    applyPalette(undefined, accent);
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

    game.settings.register("mgt2", "palettePreset", {
        name: "MGT2.Settings.palettePreset.name",
        hint: "MGT2.Settings.palettePreset.hint",
        scope: "client",
        config: true,
        default: "classic",
        type: String,
        choices: PRESETS,
        requiresReload: false,
        onChange: onPreset
    });

    game.settings.register("mgt2", "paletteAccent", {
        name: "MGT2.Settings.paletteAccent.name",
        hint: "MGT2.Settings.paletteAccent.hint",
        scope: "client",
        config: true,
        default: "red",
        type: String,
        choices: ACCENTS,
        requiresReload: false,
        onChange: () => applyPalette()
    });

    game.settings.register("mgt2", "paletteGround", {
        name: "MGT2.Settings.paletteGround.name",
        hint: "MGT2.Settings.paletteGround.hint",
        scope: "client",
        config: true,
        default: "auto",
        type: String,
        choices: GROUNDS,
        requiresReload: false,
        onChange: ground => applyPalette(undefined, undefined, ground)
    });

    game.settings.register("mgt2", "paletteChrome", {
        name: "MGT2.Settings.paletteChrome.name",
        hint: "MGT2.Settings.paletteChrome.hint",
        scope: "client",
        config: true,
        default: true,
        type: Boolean,
        requiresReload: false,
        onChange: () => applyPalette()
    });

    game.settings.register("mgt2", "paletteCvd", {
        name: "MGT2.Settings.paletteCvd.name",
        hint: "MGT2.Settings.paletteCvd.hint",
        scope: "client",
        config: true,
        default: false,
        type: Boolean,
        requiresReload: false,
        onChange: onCvd
    });

    // Not user-facing: the theme a client had before the presets, read once by migrateLegacyTheme
    // and then cleared. A fresh client reads the empty default and migrates nothing.
    game.settings.register("mgt2", "theme", {
        scope: "client",
        config: false,
        type: String,
        default: ""
    });

    // Per person and not per table: whether someone still needs the help is not the referee's
    // business. A frame button is built on the first render only, so this cannot add or remove one
    // — `applyGuideButton` toggles a body class and every open window obeys at once.
    game.settings.register("mgt2", "showGuideButton", {
        name: "MGT2.Settings.showGuideButton.name",
        hint: "MGT2.Settings.showGuideButton.hint",
        scope: "client",
        // Out of the pane while no pack answers: a switch for a button nobody can see is noise.
        config: false,
        type: Boolean,
        default: true,
        requiresReload: false,
        onChange: applyGuideButton
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

    game.settings.register("mgt2", CHAIN_INTO_SETTING, {
        name: "MGT2.Settings.chainInto.name",
        hint: "MGT2.Settings.chainInto.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false,
        onChange: refreshChainInto
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

    game.settings.register("mgt2", ASK_SAME_SETTING, {
        name: "MGT2.Request.Settings.askTheSame.name",
        hint: "MGT2.Request.Settings.askTheSame.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false,
        onChange: refreshAskTheSame
    });

    game.settings.register("mgt2", ASK_AGAIN_SETTING, {
        name: "MGT2.Request.Settings.askAgain.name",
        hint: "MGT2.Request.Settings.askAgain.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false,
        onChange: refreshRequestCards
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
