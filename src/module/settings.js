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

    game.settings.register('mgt2', 'usePronouns', {
        name: "MGT2.Settings.usePronouns.name",
        hint: "MGT2.Settings.usePronouns.hint",
        default: false,
        scope: 'world',
        type: Boolean,
        config: true,
        requiresReload: false
    });

    game.settings.register('mgt2', 'useGender', {
        name: "MGT2.Settings.useGender.name",
        hint: "MGT2.Settings.useGender.hint",
        default: false,
        scope: 'world',
        type: Boolean,
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
        requiresReload: false
    });

};
