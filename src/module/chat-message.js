import { MGT2Helper } from "./helper.js";

const fields = foundry.data.fields;

/** The ChatMessage sub-type a check posts. */
export const CHECK = "check";

/** What a check leaves behind for the next roll to read. */
export class CheckMessageData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Null, not zero: a recovery card or a duration roll scores no Effect at all, and zero
            // is a real Effect — an exact success (Core p.61).
            effect: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null }),
            // Core p.61: a check with no stated difficulty is measured against Average 8+, and
            // `assumed` is what lets the card say so rather than inventing a difficulty.
            target: new fields.NumberField({ required: true, integer: true, initial: 8 }),
            assumed: new fields.BooleanField({ required: false, initial: false }),
            label: new fields.StringField({ required: false, blank: true, initial: "" }),
            // Core p.63: working together is the task chain rules read once per contributor, so a
            // check may descend from any number of earlier ones.
            previous: new fields.ArrayField(new fields.DocumentIdField({ nullable: false }), { initial: [] }),
            // Core p.62's opposed check modifies nothing — it compares two Effects — so this is a
            // record of the comparison and never an input to the formula.
            opposed: new fields.SchemaField({
                message: new fields.DocumentIdField({ nullable: true, initial: null }),
                label: new fields.StringField({ required: false, blank: true, initial: "" }),
                effect: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null }),
                outcome: new fields.StringField({ required: false, blank: true, initial: "",
                    choices: ["", "won", "lost", "tie"] })
            }, { required: false, nullable: true, initial: null })
        };
    }

    /** The rung this check offers the next one, Core p.63. */
    get chainDM() {
        return Number.isInteger(this.effect) ? MGT2Helper.taskChainDM(this.effect) : 0;
    }
}

/** The check a message carries, whichever form it is in. @returns {CheckMessageData|object|null} */
export function checkOf(message) {
    if (message?.type === CHECK) return message.system;
    return message?.flags?.mgt2?.check ?? null;
}

/**
 * Scroll the chat log to a message and mark it, which is what makes a chain auditable after the
 * fact without storing the chain anywhere.
 * @param {string} id   A ChatMessage id
 */
export function jumpToMessage(id) {
    const message = game.messages.get(id);
    if (!message?.visible) {
        return ui.notifications.warn(game.i18n.localize("MGT2.Errors.MessageGone"));
    }
    const li = document.querySelector(`[data-message-id="${id}"]`);
    if (!li) return ui.notifications.warn(game.i18n.localize("MGT2.Errors.MessageGone"));
    li.scrollIntoView({ behavior: "smooth", block: "center" });
    li.classList.add("mgt2-jumped");
    setTimeout(() => li.classList.remove("mgt2-jumped"), 1600);
}
