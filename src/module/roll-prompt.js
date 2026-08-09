const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

/**
 * The dice-roll configuration prompt.
 */
export class RollPromptHelper {

    /**
     * Ask the user to configure a roll.
     * @param {object} options   Roll options used to seed the form
     * @returns {Promise<object|null>}   The submitted form data, or null if the dialog was dismissed
     */
    static async roll(options) {
        // A bare <div> with no attributes bypasses DialogV2's cleanHTML pass, which would
        // otherwise strip attributes from the rendered form controls.
        const content = document.createElement("div");
        content.innerHTML = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/roll-prompt.html", {
                config: CONFIG.MGT2,
                characteristics: options.characteristics,
                characteristic: options.characteristic,
                skills: options.skills,
                skill: options.skill,
                fatigue: options.fatigue,
                encumbrance: options.encumbrance,
                difficulty: options.difficulty
            });

        /**
         * Read the dialog form, optionally tagging the roll with a boon/bane die modifier.
         * @param {HTMLButtonElement} button
         * @param {string} [diceModifier]
         */
        const read = (button, diceModifier) => {
            const data = new FormDataExtended(button.form).object;
            if ( diceModifier ) data.diceModifier = diceModifier;
            return data;
        };

        return DialogV2.wait({
            window: { title: options.rollTypeName || game.i18n.localize("MGT2.RollPrompt.Roll") },
            classes: ["mgt2", game.settings.get("mgt2", "theme"), "themed", "theme-light"],
            position: { width: 420 },
            content,
            buttons: [
                {
                    action: "boon",
                    label: "MGT2.RollPrompt.Boon",
                    callback: (event, button) => read(button, "dl")
                },
                {
                    action: "submit",
                    label: "MGT2.RollPrompt.Roll",
                    icon: "fa-solid fa-dice",
                    default: true,
                    callback: (event, button) => read(button)
                },
                {
                    action: "bane",
                    label: "MGT2.RollPrompt.Bane",
                    callback: (event, button) => read(button, "dh")
                }
            ],
            rejectClose: false
        });
    }
}
