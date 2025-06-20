class EditorFullViewDialog extends Dialog {
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
        this.options.resizable = true;
    }

    static async create(title, html) {
        const htmlContent = await renderTemplate("systems/mgt2/templates/editor-fullview.html", {
            config: CONFIG.MGT2,
            html: html
        });

        const results = new Promise(resolve => {
            new this({
                title: title,
                content: htmlContent,
                buttons: {
                    //close: { label: game.i18n.localize("MGT2.Close") }
                  }
            }).render(true);
        });

        return results;
    }
}

class ActorConfigDialog extends Dialog {
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
    }

    static async create(system) {
        const htmlContent = await renderTemplate("systems/mgt2/templates/actors/actor-config-sheet.html", {
            config: CONFIG.MGT2,
            system: system
        });

        const results = new Promise(resolve => {
            new this({
                title: "Configuration",
                content: htmlContent,
                buttons: {
                    submit: {
                        label: game.i18n.localize("MGT2.Save"),
                        icon: '<i class="fa-solid fa-floppy-disk"></i>',
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            resolve(formData);
                        },
                    }
                }
            }).render(true);
        });

        return results;
    }
}

class ActorCharacteristicDialog extends Dialog {
    // https://foundryvtt.wiki/en/development/api/dialog
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
    }

    static async create(name, show, showMax, showAll = false) {
        const htmlContent = await renderTemplate("systems/mgt2/templates/actors/actor-config-characteristic-sheet.html", {
            name: name,
            show: show,
            showMax: showMax,
            showAll: showAll
        });

        const results = new Promise(resolve => {
            new this({
                title: "Configuration: " + name,
                content: htmlContent,
                buttons: {
                    submit: {
                        label: game.i18n.localize("MGT2.Save"),
                        icon: '<i class="fa-solid fa-floppy-disk"></i>',
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            resolve(formData);
                        },
                    }
                }
            }).render(true);
        });

        return results;
    }
}

class TraitEditDialog extends Dialog {
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
    }

    static async create(data) {
        const htmlContent = await renderTemplate("systems/mgt2/templates/actors/trait-sheet.html", {
            config: CONFIG.MGT2,
            data: data
        });
        const title = data.hasOwnProperty("name") && data.name !== undefined ? data.name : game.i18n.localize("MGT2.Actor.EditTrait");
        const results = new Promise(resolve => {
            new this({
                title: title,
                content: htmlContent,
                buttons: {
                    submit: {
                        label: game.i18n.localize("MGT2.Save"),
                        icon: '<i class="fa-solid fa-floppy-disk"></i>',
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            resolve(formData);
                        },
                    }
                    //cancel: { label: "Cancel" }
                }
                // close: (html) => {
                //     console.log("This always is logged no matter which option is chosen");
                //     const formData = new FormDataExtended(html[0].querySelector('form')).object;
                //     resolve(formData);
                //  }
            }).render(true);
        });

        return results;
    }
}

export class CharacterPrompts {

    static async openConfig(system) {
        return await ActorConfigDialog.create(system);
    }

    static async openCharacteristic(name, hide, showMax, showAll = false) {
        return await ActorCharacteristicDialog.create(name, hide, showMax, showAll);
    }

    static async openTraitEdit(data) {
        return await TraitEditDialog.create(data);
    }

    static async openEditorFullView(title, html) {
        return await EditorFullViewDialog.create(title, html);
    }    
}