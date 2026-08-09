import { MGT2Helper } from "./helper.js";

export class ChatHelper {

    /**
     * Wire up the interactive buttons of a rendered chat card.
     * Called from the "renderChatMessageHTML" hook, so `html` is a plain HTMLElement.
     * @param {ChatMessage} message   The message being rendered
     * @param {HTMLElement} html      The rendered message element
     */
    static setupCardListeners(message, html) {
        if (!message || !html) {
            return;
        }

        const rollDamage = html.querySelector('button[data-action="rollDamage"]');
        if (rollDamage) {
            rollDamage.addEventListener("click", async event => {
                await this._processRollDamageButtonEvent(message, event);
            });
        }

        const applyDamage = html.querySelector('button[data-action="damage"]');
        if (applyDamage) {
            applyDamage.addEventListener("click", async event => {
                await this._applyChatCardDamage(message, event);
            });
        }

        const applyHealing = html.querySelector('button[data-action="healing"]');
        if (applyHealing) {
            applyHealing.addEventListener("click", async () => {
                ui.notifications.warn("healing");
            });
        }

        for (const button of html.querySelectorAll("button[data-index]")) {
            button.addEventListener("click", async event => {
                await this._processRollButtonEvent(message, event);
            });
        }
    }

    static async _processRollButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const buttons = message.flags.mgt2.buttons;
        const index = event.currentTarget.dataset.index;
        const button = buttons[index];
        const roll = await new Roll(button.formula, {}).roll();

        const chatData = {
            author: game.user.id,
            speaker: message.speaker,
            formula: roll._formula,
            tooltip: await roll.getTooltip(),
            total: Math.round(roll.total * 100) / 100,
            rollObjectName: button.message.objectName,
            rollMessage: MGT2Helper.format(button.message.flavor, Math.round(roll.total * 100) / 100),
        };

        chatData.content = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/chat/roll.html", chatData);
        return roll.toMessage(chatData);
    }

    static async _processRollDamageButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const rollFormula = message.flags.mgt2.damage.formula;

        const roll = await new Roll(rollFormula, {}).roll();

        let speaker;
        const selectTokens = canvas.tokens.controlled;
        if (selectTokens.length > 0) {
            speaker = selectTokens[0].actor;
        } else {
            speaker = game.user.character;
        }

        const rollTypeName = message.flags.mgt2.damage.rollTypeName ? message.flags.mgt2.damage.rollTypeName + " DAMAGE" : null;

        const chatData = {
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: speaker }),
            formula: roll._formula,
            tooltip: await roll.getTooltip(),
            total: Math.round(roll.total * 100) / 100,
            showButtons: true,
            hasDamage: true,
            rollTypeName: rollTypeName,
            rollObjectName: message.flags.mgt2.damage.rollObjectName
        };

        chatData.content = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/chat/roll.html", chatData);

        return roll.toMessage(chatData);
    }

    static _applyChatCardDamage(message) {
        const roll = message.rolls[0];
        return Promise.all(canvas.tokens.controlled.map(t => {
            const a = t.actor;
            return a.applyDamage(roll.total);
        }));
    }
}
