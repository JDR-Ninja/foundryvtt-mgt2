class RollPromptDialog extends Dialog {
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet", "dialog"];
    }

    static async create(options) {

        const htmlContent = await renderTemplate('systems/mgt2/templates/roll-prompt.html', {
            config: CONFIG.MGT2,
            //formula: formula,
            characteristics: options.characteristics,
            characteristic: options.characteristic,
            skills: options.skills,
            skill: options.skill,
            fatigue: options.fatigue,
            encumbrance: options.encumbrance,
            difficulty: options.difficulty
        });

        const results = new Promise(resolve => {
            new this({
                title: options.title,
                content: htmlContent,
                buttons: {
                    boon: {
                        label: game.i18n.localize("MGT2.RollPrompt.Boon"),
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            formData.diceModifier = "dl";
                            resolve(formData);
                        }
                    },
                    submit: {
                        label: game.i18n.localize("MGT2.RollPrompt.Roll"),
                        icon: '<i class="fa-solid fa-dice"></i>',
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            resolve(formData);
                        },
                    },
                    bane: {
                        label: game.i18n.localize("MGT2.RollPrompt.Bane"),
                        //icon: '<i class="fa-solid fa-dice"></i>',
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            formData.diceModifier = "dh";
                            resolve(formData);
                        }
                    }
                }
                //close: () => { resolve(false) }
            }).render(true);
        });

        //console.log(Promise.resolve(results));
        return results;
    }
}

export class RollPromptHelper {

    static async roll(options) {
        return await RollPromptDialog.create(options);
    }

    static async promptForFruitTraits() {
        const htmlContent = await renderTemplate('systems/mgt2/templateschat/chat/roll-prompt.html');

        return new Promise((resolve, reject) => {
            const dialog = new Dialog({
                title: "Fruit Traits",
                content: htmlContent,
                buttons: {
                    submit: {
                        label: "Roll",
                        icon: '<i class="fa-solid fa-dice"></i>',
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form'))
                                .toObject();

                            //verifyFruitInputs(formData);

                            resolve(formData);
                        },
                    },
                    skip: {
                        label: "Cancel",
                        callback: () => resolve(null),
                    }
                },
                render: (html) => {
                    //html.on('click', 'button[data-preset]', handleFruitPreset);
                },
                close: () => {
                    reject('User closed dialog without making a selection.');
                },
            });

            dialog.render(true);
        });
    }
}