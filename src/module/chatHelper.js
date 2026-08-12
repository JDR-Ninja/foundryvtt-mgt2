import { CharacterPrompts } from "./actors/character-prompts.js";
import { MGT2 } from "./config.js";
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

        const firstAid = html.querySelector('button[data-action="firstAid"]');
        if (firstAid) {
            firstAid.addEventListener("click", async event => {
                await this._applyChatCardFirstAid(message, event);
            });
        }

        // Which reading applies is the defender's call, and each viewer makes it for themselves —
        // so the pick lives in the DOM and never touches the message.
        for (const option of html.querySelectorAll(".dmgpick > [data-transform]")) {
            option.addEventListener("click", () => this._pickTransform(message, option, true));
        }

        // The defender's traits answer which reading is right, and the defender is whichever token
        // the referee has selected — a question asked here and never at attack time, so the mark is
        // recomputed as the card is approached rather than baked into the message.
        if (html.querySelector(".dmgpick")) {
            html.addEventListener("pointerenter", () => this.#markTransform(message, html));
            this.#markTransform(message, html);
        }

        // Indexed buttons are meaningless without the flag that describes them, and a
        // third-party module may well render its own button[data-index].
        if (message.flags?.mgt2?.buttons?.length) {
            for (const button of html.querySelectorAll("button[data-index]")) {
                button.addEventListener("click", async event => {
                    await this._processRollButtonEvent(message, event);
                });
            }
        }
    }

    static async _processRollButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const button = message.flags?.mgt2?.buttons?.[event.currentTarget.dataset.index];
        if (!button) return;

        const roll = await new Roll(button.formula, {}).roll();
        const total = Math.round(roll.total * 100) / 100;

        const chatData = {
            author: game.user.id,
            speaker: message.speaker,
            formula: roll.formula,
            tooltip: await roll.getTooltip(),
            total,
            rollObjectName: button.message.objectName,
            rollMessage: MGT2Helper.format(button.message.flavor, total)
        };

        chatData.content = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/chat/roll.html", chatData);
        return roll.toMessage(chatData);
    }

    /**
     * Roll the attack's three readings into one message. Reduced Damage substitutes into the damage
     * expression (`4D` → `4D3`) rather than scaling a total, so it cannot be computed after the
     * fact and has to be rolled here; Minimum is one point per die and is deterministic. Which one
     * applies is decided by the *defender's* traits, which the system does not read — so all three
     * are offered and the defender picks.
     */
    static async _processRollDamageButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const damage = message.flags?.mgt2?.damage;
        if (!damage?.formula) return;

        // Core p.78: damage is rolled with the attack's Effect added to the total, and a melee
        // attack adds the attacker's STR DM on top. Both were captured with the attack roll, and
        // both sit outside the transform: Companion p.94 scopes "any plus or minus" to the weapon's
        // printed damage, and neither of these is one.
        const attackBonus = [];
        if (damage.effect) attackBonus.push(MGT2Helper.getFormulaDM(damage.effect));
        if (damage.strengthDM) attackBonus.push(MGT2Helper.getFormulaDM(damage.strengthDM));
        const bonus = attackBonus.join("");
        const flat = (damage.effect ?? 0) + (damage.strengthDM ?? 0);

        // Foundry's parser has no `4D` shorthand — a weapon has to store `4d6` — and an unresolved
        // term throws out of the click handler rather than reporting anything.
        if (!Roll.validate(damage.formula + bonus)) {
            return ui.notifications.error(game.i18n.localize("MGT2.Errors.InvalidRollFormula"));
        }

        const full = await new Roll(damage.formula + bonus, {}).roll();
        const reduced = await new Roll(MGT2Helper.reduceDamageFormula(damage.formula) + bonus, {}).roll();
        const minimum = MGT2Helper.minimumDamage(damage.formula) + flat;

        const payload = {
            formula: full.formula, total: full.total,
            reduced: { formula: reduced.formula, total: reduced.total },
            minimum,
            effect: damage.effect ?? 0,
            scale: damage.scale ?? "ground",
            ap: damage.ap ?? 0,
            loPen: damage.loPen ?? 0,
            damageType: damage.damageType ?? [],
            stun: damage.stun === true
        };

        // What the card spells out under each reading: the dice alone, then the attack's own
        // additions, so that "the Effect survives the transform" is visible rather than asserted.
        const added = [];
        if (damage.effect) {
            added.push(game.i18n.localize("MGT2.Chat.Roll.Effect") + " " + MGT2Helper.signed(damage.effect));
        }
        if (damage.strengthDM) {
            added.push(game.i18n.localize("MGT2.Characteristics.strength.name") + " "
                + MGT2Helper.signed(damage.strengthDM));
        }

        const context = Object.assign({
            who: [message.speaker?.alias, damage.rollObjectName].filter(x => x).join(" · "),
            effectDisplay: MGT2Helper.signed(payload.effect, "+0"),
            // MGT2.Scales is the damage-ratio table and carries only the two scales that have a
            // ratio, so a vehicle weapon has to name itself out of the weapon vocabulary instead.
            scaleLabel: (MGT2.Scales[payload.scale] ?? MGT2.WeaponScales[payload.scale])?.label ?? payload.scale,
            typeLabels: payload.damageType.map(type => MGT2.DamageTypes[type] ?? type),
            floor: payload.effect >= 6,
            options: ChatHelper.#transformOptions(damage, payload, flat, added)
        }, payload);
        context.applyLabel = ChatHelper.#applyLabel(context.options[0]);

        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: message.speaker,
            rolls: [full, reduced],
            sound: CONFIG.sounds.dice,
            flags: { mgt2: { apply: payload } },
            content: await foundry.applications.handlebars.renderTemplate(
                "systems/mgt2/templates/chat/damage.html", context)
        });
    }

    /** The three readings, in the order the card offers them; the first is the one preselected. */
    static #transformOptions(damage, payload, flat, added) {
        const detail = (expression, dice) => [`${expression} = ${dice}`, ...added].join(" · ");
        return [
            { key: "full", label: MGT2.DamageTransforms.full, total: payload.total,
                detail: detail(damage.formula, payload.total - flat) },
            { key: "reduced", label: MGT2.DamageTransforms.reduced, total: payload.reduced.total,
                detail: detail(MGT2Helper.reduceDamageFormula(damage.formula), payload.reduced.total - flat) },
            { key: "minimum", label: MGT2.DamageTransforms.minimum, total: payload.minimum,
                detail: detail(game.i18n.localize("MGT2.Chat.Damage.PerDie"), payload.minimum - flat) }
        ];
    }

    static #applyLabel(option) {
        return game.i18n.format("MGT2.Chat.Damage.Apply",
            { amount: option.total, transform: game.i18n.localize(option.label) });
    }

    /**
     * Mark the reading the selected target's traits select, and move the pick onto it while the
     * viewer has not made one of their own. **Their pick always wins** — the traits answer a
     * question, they do not take the choice away.
     */
    static #markTransform(message, html) {
        const pick = html.querySelector(".dmgpick");
        if (!message.flags?.mgt2?.apply) return;

        const types = message.flags.mgt2.apply.damageType ?? [];
        // The canvas may answer "who am I applying this to"; it may never answer "what is the
        // answer" (REDESIGN-PLAN.md §1). A referee's own selection is the first question.
        const found = new Set((canvas.tokens?.controlled ?? [])
            .filter(token => token.actor?.isOwner)
            .map(token => token.actor.system.damageTransform?.(types))
            .filter(transform => transform));
        // Two targets that disagree have no one answer, so the card offers all three again.
        const transform = (found.size === 1) ? [...found][0] : null;

        html.querySelector(".card")?.classList.toggle("immune", transform === "immune");
        let chosen = null;
        for (const option of pick.children) {
            const marked = option.dataset.transform === transform;
            option.classList.toggle("bytraits", marked);
            if (marked) chosen = option;
        }
        if (chosen && (pick.dataset.picked !== "true")) ChatHelper._pickTransform(message, chosen);
    }

    static _pickTransform(message, option, byHand = false) {
        const pick = option.parentElement;
        if (byHand) pick.dataset.picked = "true";
        for (const other of pick.children) other.classList.toggle("on", other === option);

        const button = pick.parentElement.querySelector('button[data-action="damage"]');
        if (!button) return;
        const label = button.querySelector("span");
        const text = ChatHelper.#applyLabel({
            total: Number(option.dataset.total),
            label: MGT2.DamageTransforms[option.dataset.transform]
        });
        if (label) label.textContent = text;
        else button.textContent = text;
    }

    /** Only ever write to actors the user is allowed to modify. */
    static #targets() {
        const targets = canvas.tokens.controlled.filter(t => t.actor?.isOwner);
        if (targets.length === 0) ui.notifications.warn(game.i18n.localize("MGT2.Errors.NoOwnedTokenSelected"));
        return targets;
    }

    static async _applyChatCardDamage(message, event) {
        const targets = ChatHelper.#targets();
        if (targets.length === 0) return;

        const payload = message.flags?.mgt2?.apply;
        if (!payload) {
            // A card from before the pipeline carries only its roll, and applied it untouched.
            const total = message.rolls?.[0]?.total;
            if (total === undefined) return;
            return Promise.all(targets.map(t => t.actor.applyDamage(total, { raw: true })));
        }

        const picked = event.currentTarget.closest(".card")
            ?.querySelector(".dmgpick > [data-transform].on")?.dataset.transform ?? "full";
        const amount = { full: payload.total, reduced: payload.reduced.total, minimum: payload.minimum }[picked];

        for (const token of targets) {
            const result = await token.actor.applyDamage(amount, {
                scale: payload.scale, ap: payload.ap, effect: payload.effect, stun: payload.stun,
                damageType: payload.damageType
            });
            // Core p.80: what a Stun weapon deals past END is rounds of incapacitation, not injury.
            if (result?.rounds > 0) {
                ui.notifications.info(game.i18n.format("MGT2.Actor.StunIncapacitated",
                    { name: token.actor.name, rounds: result.rounds }));
            }
        }
    }

    /* -------------------------------------------- */
    /*  Recovery (Core p.83-84)                     */
    /* -------------------------------------------- */

    /** The card knows the Effect; who was treated is the referee's pick, as it is for damage. */
    static async _applyChatCardFirstAid(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const points = message.flags?.mgt2?.firstAid?.points;
        if (!points) return;
        for (const token of ChatHelper.#targets()) await ChatHelper.applyFirstAid(token.actor, points);
    }

    /**
     * Core p.83: the Effect of a Medic check, minimum one point, once only. The two conditions it
     * also names are facts no sheet holds, so the dialog has the referee confirm them.
     */
    static applyFirstAid(actor, points) {
        if (actor.system.states?.firstAidUsed) {
            return ui.notifications.warn(game.i18n.format("MGT2.Recovery.AlreadyApplied", { name: actor.name }));
        }
        return ChatHelper.applyRestore(actor, {
            procedure: "MGT2.Recovery.FirstAid",
            points: Math.max(1, points),
            spendFirstAid: true,
            conditions: [
                game.i18n.localize("MGT2.Recovery.NeedEquipment"),
                game.i18n.localize("MGT2.Recovery.WithinMinute")
            ]
        });
    }

    /**
     * Hand the referee a pool and let them place it. Both procedures that divide "as desired" end
     * here, from the sheet and from a chat card alike — neither caller may decide where the points
     * land, so neither of them owns this.
     */
    static async applyRestore(actor, { procedure, points, conditions = [], spendFirstAid = false }) {
        const system = actor.system;
        const rows = system.damagedLinks.map(key => ({
            key, label: MGT2.Characteristics[key] ?? MGT2.DamageTracks[key] ?? key,
            damage: system.characteristics[key].damage
        }));
        if (rows.length === 0) {
            return ui.notifications.warn(game.i18n.format("MGT2.Recovery.Undamaged", { name: actor.name }));
        }

        const distribution = await CharacterPrompts.openDistribution({
            title: procedure, points, rows, conditions, opening: system.fillInOrder(points)
        });
        if (!distribution) return;

        // The procedure was carried out the moment it was confirmed, whatever the referee then chose
        // to place — so that is what spends the one attempt the rule allows.
        const extra = spendFirstAid ? { states: { firstAidUsed: true } } : {};
        const healed = await system.applyHeal(distribution, extra);
        return ChatHelper.postRecovery(actor, procedure, ChatHelper.restoredMessage(healed, distribution));
    }

    /** What actually landed, per characteristic — the total alone where the rule divided nothing. */
    static restoredMessage(healed, distribution) {
        const detail = Object.entries(distribution ?? {})
            .filter(([, points]) => points > 0)
            .map(([key, points]) => `${game.i18n.localize(MGT2.Characteristics[key] ?? key)} ${points}`)
            .join(" · ");
        return detail
            ? game.i18n.format("MGT2.Recovery.Restored", { points: healed, detail })
            : game.i18n.format("MGT2.Recovery.RestoredPlain", { points: healed });
    }

    /** One compact card per procedure, so a day of healing leaves a trace the table can read back. */
    static async postRecovery(actor, procedure, message, roll = null) {
        const chatData = {
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            rollTypeName: game.i18n.localize("MGT2.Recovery.Title"),
            rollObjectName: game.i18n.localize(procedure),
            rollMessage: message
        };

        if (roll) {
            chatData.formula = roll.formula;
            chatData.tooltip = await roll.getTooltip();
            chatData.total = roll.total;
        }

        chatData.content = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/chat/roll.html", chatData);
        return roll ? roll.toMessage(chatData) : getDocumentClass("ChatMessage").create(chatData);
    }
}
