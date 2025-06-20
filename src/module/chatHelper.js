import { MGT2Helper } from "./helper.js";

export class ChatHelper {


    // _injectContent(message, type, html) {

    //     _setupCardListeners(message, html);

    // }


    static setupCardListeners(message, html, messageData) {
        if (!message || !html) {
            return;
        }
        // if (SettingsUtility.getSettingValue(SETTING_NAMES.MANUAL_DAMAGE_MODE) > 0) {
        //     html.find('.card-buttons').find(`[data-action='rsr-${ROLL_TYPE.DAMAGE}']`).click(async event => {
        //         await _processDamageButtonEvent(message, event);
        //     });
        // }
        html.find('button[data-action="rollDamage"]').click(async event => {
            //ui.notifications.warn("rollDamage");
            await this._processRollDamageButtonEvent(message, event);
        });

        html.find('button[data-action="damage"]').click(async event => {
            //ui.notifications.warn("damage");
            await this._applyChatCardDamage(message, event);
            //await _processApplyButtonEvent(message, event);
        });

        html.find('button[data-action="healing"]').click(async event => {
            ui.notifications.warn("healing");
            //await _processApplyTotalButtonEvent(message, event);
        });

        html.find('button[data-index]').click(async event => {
            
            await this._processRollButtonEvent(message, event);
        });
    }

    static async _processRollButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();
        let buttons = message.flags.mgt2.buttons;
        const index = event.target.dataset.index;
        const button = buttons[index];
        let roll = await new Roll(button.formula, {}).roll({ async: true });
        //console.log(message);

        const chatData = {
            user: game.user.id,
            speaker: message.speaker,
            formula: roll._formula,
            tooltip: await roll.getTooltip(),
            total: Math.round(roll.total * 100) / 100,
            //formula: isPrivate ? "???" : roll._formula,
            //tooltip: isPrivate ? "" : await roll.getTooltip(),
            //total: isPrivate ? "?" : Math.round(roll.total * 100) / 100,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rollObjectName: button.message.objectName,
            rollMessage: MGT2Helper.format(button.message.flavor, Math.round(roll.total * 100) / 100),
          };

          const html = await renderTemplate("systems/mgt2/templates/chat/roll.html", chatData);
          chatData.content = html;
          return roll.toMessage(chatData);
    }

    static async _processRollDamageButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();
        let rollFormula = message.flags.mgt2.damage.formula;

        let roll = await new Roll(rollFormula, {}).roll({ async: true });

        let speaker;
        let selectTokens = canvas.tokens.controlled;
        if (selectTokens.length > 0) {
            speaker = selectTokens[0].actor;
        } else {
            speaker = game.user.character;
        }

        let rollTypeName = message.flags.mgt2.damage.rollTypeName ? message.flags.mgt2.damage.rollTypeName + " DAMAGE" : null;

        const chatData = {
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: speaker }),
            formula: roll._formula,
            tooltip: await roll.getTooltip(),
            total: Math.round(roll.total * 100) / 100,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            showButtons: true,
            hasDamage: true,
            rollTypeName: rollTypeName,
            rollObjectName: message.flags.mgt2.damage.rollObjectName
        };

        const html = await renderTemplate("systems/mgt2/templates/chat/roll.html", chatData);
        chatData.content = html;

        return roll.toMessage(chatData);
    }

    async _processDamageButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();

        //message.flags[MODULE_SHORT].manualDamage = false
        //message.flags[MODULE_SHORT].renderDamage = true;  
        // current user/actor

        await ItemUtility.runItemAction(null, message, ROLL_TYPE.DAMAGE);
    }

    static _applyChatCardDamage(message, event) {
        const roll = message.rolls[0];
        return Promise.all(canvas.tokens.controlled.map(t => {
            const a = t.actor;
            return a.applyDamage(roll.total);
        }));
    }
}