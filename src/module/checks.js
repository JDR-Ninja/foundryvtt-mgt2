import { CHECK, checkOf } from "./chat-message.js";
import { MGT2Helper } from "./helper.js";

/** The one card a check posts, and the one a roll that scores no Effect posts too. */
const CARD = "systems/mgt2/templates/chat/roll.html";

/**
 * A task check once the prompt has been answered: the dice, the number Core p.61 measures them
 * against, and the card that states both.
 */
export class Checks {

    /**
     * The rows of a check, reduced once: the terms the formula reads, the labels the card prints,
     * and the total the prompt previews.
     * @param {[string, number][]} rows   Each name already localised, with its DM
     * @returns {{parts: string[], labels: string[], total: number}}
     */
    static modifiers(rows) {
        const parts = [];
        const labels = [];
        let total = 0;
        for ( const [name, dm] of rows ) {
            // A row worth nothing is still named — it was offered and taken — but adds no term.
            if ( dm !== 0 ) parts.push(MGT2Helper.getFormulaDM(dm));
            labels.push(dm === 0 ? name : name + MGT2Helper.getDisplayDM(dm));
            total += dm;
        }
        return { parts, labels, total };
    }

    /**
     * Core p.62: both sides roll as normal and the higher Effect wins; a draw is a standstill in
     * which neither gains an advantage.
     * @param {object} data      What `RollPromptHelper.roll` came back with
     * @returns {object|null}
     */
    static opposed(data, effect) {
        if ( !MGT2Helper.hasValue(data, "opposed") ) return null;
        const against = checkOf(game.messages.get(data.opposed));
        if ( !Number.isInteger(against?.effect) ) return null;
        return {
            message: data.opposed,
            label: against.label,
            effect: against.effect,
            outcome: (effect > against.effect) ? "won" : (effect < against.effect) ? "lost" : "tie"
        };
    }

    /**
     * Roll the formula and score it.
     * @param {object} [options.rollData]     `@` references for the formula
     * @param {string} [options.difficulty]   A `MGT2.DifficultyTargets` key
     * @param {number} [options.target]       A bare number to measure against, where the rule
     *     states one instead of naming a rung — character creation rolls against 5+, 7+ and 9+,
     *     which no rung expresses
     * @param {object} [options.prompt]       The prompt's answer, for its Opposed row
     * @returns {Promise<object|null>}        null when the formula does not parse
     */
    static async resolve({ formula, rollData = {}, difficulty = null, target: stated = null,
        prompt = null } = {}) {
        if ( !Roll.validate(formula) ) {
            ui.notifications.error(game.i18n.localize("MGT2.Errors.InvalidRollFormula"));
            return null;
        }
        const roll = await new Roll(formula, rollData).roll();
        const target = Number.isFinite(stated)
            ? { value: stated, assumed: false } : MGT2Helper.getEffectTarget(difficulty);
        const effect = roll.total - target.value;
        return {
            roll,
            effect,
            target: target.value,
            assumed: target.assumed,
            band: MGT2Helper.getEffectBand(effect),
            opposed: prompt ? this.opposed(prompt, effect) : null
        };
    }

    /**
     * Post what `resolve` scored. @returns {Promise<ChatMessage>}
     * @param {object} outcome              What `resolve` returned
     * @param {object} options              The rest goes to `buildRollCardContext`
     * @param {Actor} [options.actor]       Whose name the card speaks under
     * @param {string} [options.label]      What `system.label` calls this check
     * @param {object} [options.flags]      Offers resolved later and on another actor
     * @param {string} [options.mode]       A `CONFIG.ChatMessage.modes` key
     * @param {boolean} [options.secret]    Companion p.7's referee roll — see below
     */
    static async post(outcome, { actor = null, label = "", flags = null, mode, secret = false, ...card } = {}) {
        const message = {
            author: game.user.id,
            speaker: actor ? ChatMessage.getSpeaker({ actor }) : null,
            type: CHECK,
            system: {
                effect: outcome.effect,
                target: outcome.target,
                assumed: outcome.assumed,
                label,
                previous: (card.chainSources ?? []).map(source => source.id),
                opposed: outcome.opposed
            },
            content: await renderRollCard({ roll: outcome.roll, outcome, ...card })
        };
        if ( flags ) message.flags = flags;

        // Companion p.7's secret referee check.
        if ( secret ) {
            message.rolls = [];
            message.whisper = ChatMessage.getWhisperRecipients("GM").map(user => user.id);
            return getDocumentClass("ChatMessage").create(message);
        }
        return outcome.roll.toMessage(message, { messageMode: mode });
    }
}

/**
 * The context `templates/chat/roll.html` reads. @returns {Promise<object>}
 * @param {Roll} [options.roll]           The dice, where any were rolled
 * @param {object} [options.outcome]      What `Checks.resolve` returned
 * @param {string[]} [options.modifiers]  The named terms, in the order the formula reads them
 * @param {string[]} [options.lines]      Sentences appended to the opposed verdict
 */
export async function buildRollCardContext({
    roll = null, outcome = null, difficulty = null,
    rollTypeName = "", rollObjectName = "",
    modifiers = [], chainSources = [], lines = [], ...card
} = {}) {
    const context = {
        rollTypeName,
        rollObjectName,
        rollModifiers: modifiers,
        rollDifficulty: difficulty,
        rollDifficultyLabel: MGT2Helper.getDifficultyDisplay(difficulty),
        // The lineage the card can be clicked back through: the chain names each source rather than
        // storing only its id, because the strip links back to it.
        chainedFrom: chainSources,
        chainTotal: MGT2Helper.signed(chainSources.reduce((sum, source) => sum + source.dm, 0), "+0"),
        ...card
    };

    if ( roll ) {
        context.formula = roll.formula;
        context.tooltip = await roll.getTooltip();
        context.total = Math.round(roll.total * 100) / 100;
    }

    if ( outcome ) {
        context.rollTarget = outcome.target;
        context.rollTargetAssumed = outcome.assumed;
        context.effect = outcome.effect;
        context.effectDisplay = MGT2Helper.signed(outcome.effect, "+0");
        context.effectBand = outcome.band.label;
        // The tone stays the roll's OWN band.
        context.effectTone = outcome.band.tone;
    }

    const opposed = outcome?.opposed ?? null;
    const sentences = opposed ? [game.i18n.format("MGT2.Chat.Roll.OpposedLine", {
        source: opposed.label || game.i18n.localize("MGT2.RollPrompt.Opposed"),
        effect: MGT2Helper.signed(opposed.effect, "+0"),
        outcome: game.i18n.localize(`MGT2.Chat.Roll.Opposed.${opposed.outcome}`)
    })] : [];
    sentences.push(...lines.filter(line => line));
    context.rollMessage = sentences.length ? sentences.join(" · ") : null;
    // The opposed line carries its id on the sentence rather than inside it, which keeps the label
    // escaped — it is a document name and belongs nowhere near raw HTML.
    context.opposedMessage = opposed?.message ?? null;

    return context;
}

/** @see buildRollCardContext */
export async function renderRollCard(options) {
    return foundry.applications.handlebars.renderTemplate(CARD, await buildRollCardContext(options));
}
