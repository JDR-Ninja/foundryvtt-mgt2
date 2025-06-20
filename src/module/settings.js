export const registerSettings = function () {

    game.settings.register("mgt2", "theme", {
        name: "MGT2.Settings.theme.name",
        hint: "MGT2.Settings.theme.hint",
        scope: "client",
        config: true,
        default: "black-and-red",
        type: String,
        choices: {
            "black-and-red": "MGT2.Themes.BlackAndRed",
            "mwamba": "MGT2.Themes.Mwamba",
            "blue": "MGT2.Themes.Blue"
        },
        requiresReload: true
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

    // game.settings.register('mgt2', 'useWeightMetric', {
    //     name: "MGT2.Settings.useWeightMetric.name",
    //     hint: "MGT2.Settings.useWeightMetric.hint",
    //     default: true,
    //     scope: 'world',
    //     type: Boolean,
    //     config: true,
    //     requiresReload: true
    // });

    // game.settings.register('mgt2', 'useDistanceMetric', {
    //     name: "MGT2.Settings.useDistanceMetric.name",
    //     hint: "MGT2.Settings.useDistanceMetric.hint",
    //     default: true,
    //     scope: 'world',
    //     type: Boolean,
    //     config: true,
    //     requiresReload: true
    // });

    // game.settings.register('mgt2', 'showTrash', {
    //     name: "Show Trash tab to Player",
    //     hint: "Player can see the Trash tab and recover item",
    //     default: false,
    //     scope: 'world',
    //     type: Boolean,
    //     config: true,
    //     requiresReload: false
    // });

    /*game.settings.register('mgt2', 'containerDropIn', {
        name: "Test",
        hint: "Mon hint",
        default: true,
        scope: 'client',
        type: Boolean,
        config: true
    });*/
};
