import { CHECK, checkOf } from "./chat-message.js";
import { MGT2Helper } from "./helper.js";

/** The one card a check posts, and the one a roll that scores no Effect posts too. */
const CARD = "systems/mgt2/templates/chat/roll.html";

/**
 * A task check once the prompt has been answered: the dice, the number Core p.61 measures them
 * against, and the card that states both. Four callers score one — a Traveller's sheet, a ship's
 * station roster, a vehicle's folio 138 actions and a hotbar macro — and none of them may hold a
 * copy of the arithmetic, because the Effect is what every later rule reads.
 */
export class Checks {

    /**
     * The rows of a check, reduced once: the terms the formula reads, the labels the card prints,
     * and the total the prompt previews. Both totalling paths end here, which is what makes the
     * preview and the roll the same arithmetic rather than two that happen to agree.
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

    /* -------------------------------------------- */

    /**
     * Core p.62: both sides roll as normal and the higher Effect wins; a draw is a standstill in
     * which neither gains an advantage. Nothing is modified — this is a comparison, and it runs
     * after the dice because that is when both numbers exist.
     * @param {object} data      What `RollPromptHelper.roll` came back with
     * @param {number} effect
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

    /* -------------------------------------------- */

    /**
     * Roll the formula and score it. Effect is what the NEXT action reads — initiative, damage,
     * first aid, psionic duration — and those run later, on another actor, with no sheet rendered,
     * so it is computed here beside the dice. Core p.61: a check with no stated difficulty is
     * measured against Average (8+) rather than scoring no Effect at all.
     *
     * @param {object} options
     * @param {string} options.formula
     * @param {object} [options.rollData]     `@` references for the formula
     * @param {string} [options.difficulty]   A `MGT2.DifficultyTargets` key
     * @param {object} [options.prompt]       The prompt's answer, for its Opposed row
     * @returns {Promise<object|null>}        null when the formula does not parse
     */
    static async resolve({ formula, rollData = {}, difficulty = null, prompt = null } = {}) {
        if ( !Roll.validate(formula) ) {
            ui.notifications.error(game.i18n.localize("MGT2.Errors.InvalidRollFormula"));
            return null;
        }
        const roll = await new Roll(formula, rollData).roll();
        const target = MGT2Helper.getEffectTarget(difficulty);
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

    /* -------------------------------------------- */

    /**
     * Post what `resolve` scored. The Effect is the message's own validated data rather than a
     * reading of the rendered card, which is what makes a chain auditable after the fact
     * (`DOCUMENT-TYPES.md` #16).
     *
     * @param {object} outcome              What `resolve` returned
     * @param {object} options              The rest goes to `buildRollCardContext`
     * @param {Actor} [options.actor]       Whose name the card speaks under
     * @param {string} [options.label]      What `system.label` calls this check
     * @param {object} [options.flags]      Offers resolved later and on another actor
     * @param {string} [options.mode]       A `CONFIG.ChatMessage.modes` key
     * @returns {Promise<ChatMessage>}
     */
    static async post(outcome, { actor = null, label = "", flags = null, mode, ...card } = {}) {
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
        return outcome.roll.toMessage(message, { messageMode: mode });
    }
}

/* -------------------------------------------- */

/**
 * The context `templates/chat/roll.html` reads. Seven callers build one and only three of them
 * score anything: a duration roll, a recovery, a reaction and a grapple outcome are the same card
 * with the Effect block missing, which is why every part of it is optional.
 *
 * @param {object} options
 * @param {Roll} [options.roll]           The dice, where any were rolled
 * @param {object} [options.outcome]      What `Checks.resolve` returned
 * @param {string} [options.difficulty]
 * @param {string[]} [options.modifiers]  The named terms, in the order the formula reads them
 * @param {object[]} [options.chainSources]
 * @param {string[]} [options.lines]      Sentences appended to the opposed verdict
 * @returns {Promise<object>}
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
        // The tone stays the roll's OWN band. An opposed check that was lost can still have been a
        // success against its difficulty, and both facts are true — colouring the card by the
        // verdict would hide the one the rules actually scored.
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
