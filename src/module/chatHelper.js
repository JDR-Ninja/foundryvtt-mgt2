import { CharacterPrompts } from "./actors/character-prompts.js";
import { checkOf, jumpToMessage } from "./chat-message.js";
import { renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { injectAskTheSame, REQUEST, setupRequestCard } from "./request.js";
import { injectAskedStrip } from "./request-answer.js";
import { armChain } from "./roll-prompt.js";

export class ChatHelper {

    /**
     * Wire up the interactive buttons of a rendered chat card.
     * @param {ChatMessage} message   The message being rendered
     * @param {HTMLElement} html      The rendered message element
     */
    static setupCardListeners(message, html) {
        if (!message || !html) {
            return;
        }

        // The request card owns its own controls, and it is the only sub-type that renders its
        // whole `li` — so it takes the branch before anything reaches for a `.card` inside it.
        if (message.type === REQUEST) {
            return setupRequestCard(message, html);
        }
        // The third door onto the Docket, and — on a check that answered one — the strip naming the
        // request it came from.
        injectAskTheSame(message, html);
        injectAskedStrip(message, html);

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

        // Core folio 78: the winner of the opposed check picks what the grapple did, so the menu
        // hangs off the card that holds the comparison rather than off either sheet.
        const grapple = html.querySelector('button[data-action="grapple"]');
        if (grapple) {
            grapple.addEventListener("click", async event => {
                await this._resolveGrapple(message, event);
            });
        }

        // The offering side of the chain: this check is held for whatever is rolled next.
        const chainInto = html.querySelector('button[data-action="chainInto"]');
        if (chainInto) {
            chainInto.addEventListener("click", event => {
                event.preventDefault();
                const check = checkOf(message);
                const count = armChain(message.id);
                ui.notifications.info(game.i18n.format("MGT2.Chat.Roll.ChainArmed", {
                    source: check?.label || message.speaker?.alias || "",
                    dm: MGT2Helper.signed(MGT2Helper.taskChainDM(check?.effect ?? 0), "+0"),
                    count
                }));
            });
        }

        // The lineage links: the chain strip's sources and the opposed line's one source.
        for (const link of html.querySelectorAll('[data-action="chainSource"]')) {
            link.addEventListener("click", event => {
                event.preventDefault();
                jumpToMessage(link.dataset.messageId);
            });
        }

        // Indexed buttons are meaningless without the flag that describes them, and a third-party
        // module may well render its own button[data-index].
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

        return roll.toMessage({
            author: game.user.id,
            speaker: message.speaker,
            content: await renderRollCard({
                roll,
                rollObjectName: button.message.objectName,
                lines: [MGT2Helper.format(button.message.flavor, total)]
            })
        });
    }

    /** Roll the attack's three readings into one message. */
    static async _processRollDamageButtonEvent(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const damage = message.flags?.mgt2?.damage;
        if (!damage?.formula) return;

        // Core p.77: damage is rolled with the attack's Effect added to the total, and a melee
        // attack adds the attacker's STR DM on top.
        const attackBonus = [];
        if (damage.effect) attackBonus.push(MGT2Helper.getFormulaDM(damage.effect));
        if (damage.strengthDM) attackBonus.push(MGT2Helper.getFormulaDM(damage.strengthDM));
        if (damage.burst) attackBonus.push(MGT2Helper.getFormulaDM(damage.burst));
        const bonus = attackBonus.join("");
        const flat = (damage.effect ?? 0) + (damage.strengthDM ?? 0) + (damage.burst ?? 0);

        // The books print `3D`, `3DD` and `3D3` and Foundry parses none of the three, so the stored
        // score is normalised here; an unresolved term throws out of the click handler rather than
        // reporting anything.
        const formula = MGT2Helper.damageFormula(damage.formula);
        if (!Roll.validate(formula + bonus)) {
            return ui.notifications.error(
                game.i18n.format("MGT2.Errors.InvalidDamageFormula", { formula: damage.formula }));
        }

        // Core p.78: a Destructive weapon multiplies the total rolled by 10 — written either as the
        // doubled D of `3DD` or as the trait.
        const boost = (MGT2Helper.isDestructive(damage.formula) || damage.destructive) ? 10 : 1;

        const full = await new Roll(formula + bonus, {}).roll();
        const reduced = await new Roll(MGT2Helper.reduceDamageFormula(formula) + bonus, {}).roll();
        const minimum = MGT2Helper.minimumDamage(formula) + flat;

        const payload = {
            // Read back on the apply path by Core folio 140's anti-light-weapon rule, which counts
            // the attack's dice — the same count either way round, since the bonus adds no die.
            formula: full.formula, total: full.total * boost,
            reduced: { formula: reduced.formula, total: reduced.total * boost },
            minimum: minimum * boost,
            destructive: boost > 1,
            effect: damage.effect ?? 0,
            scale: damage.scale ?? "ground",
            ap: damage.ap ?? 0,
            loPen: damage.loPen ?? 0,
            // HG p.29: what the MOUNT multiplies the wound by, applied after armour rather than
            // rolled into the dice — which is why it travels as a number instead of a formula.
            multiple: damage.multiple ?? 1,
            damageType: damage.damageType ?? [],
            stun: damage.stun === true,
            // Core folio 79: a Radiation weapon also delivers a dose, which needs the target and so
            // rides to the apply path with the rest of the pipeline's inputs.
            radiation: damage.radiation === true,
            // RH folio 106: an ion hit meets no armour and shuts a robot's brain down.
            ion: damage.ion === true,
            // The Poison or Diseased trait stays on the attacker; what the defender gets is a
            // `disease` Item built from its parameters, named after whatever carried it.
            hazards: damage.hazards ?? [],
            sourceName: damage.rollObjectName ?? ""
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
        if (damage.burst) {
            added.push(game.i18n.localize("MGT2.FireModes.burst") + " "
                + MGT2Helper.signed(damage.burst));
        }
        if (payload.destructive) added.push(game.i18n.localize("MGT2.Chat.Damage.Destructive"));

        const context = Object.assign({
            who: [message.speaker?.alias, damage.rollObjectName].filter(x => x).join(" · "),
            effectDisplay: MGT2Helper.signed(payload.effect, "+0"),
            // MGT2.Scales is the damage-ratio table and carries only the two scales that have a
            // ratio, so a vehicle weapon has to name itself out of the weapon vocabulary instead.
            scaleLabel: (MGT2.Scales[payload.scale] ?? MGT2.WeaponScales[payload.scale])?.label ?? payload.scale,
            typeLabels: payload.damageType.map(type => MGT2.DamageTypes[type] ?? type),
            floor: payload.effect >= 6,
            options: ChatHelper.#transformOptions(formula,
                { full: full.total, reduced: reduced.total, minimum }, boost, flat, added)
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
    static #transformOptions(formula, raw, boost, flat, added) {
        const detail = (expression, dice) => [`${expression} = ${dice}`, ...added].join(" · ");
        return [
            { key: "full", label: MGT2.DamageTransforms.full, total: raw.full * boost,
                detail: detail(formula, raw.full - flat) },
            { key: "reduced", label: MGT2.DamageTransforms.reduced, total: raw.reduced * boost,
                detail: detail(MGT2Helper.reduceDamageFormula(formula), raw.reduced - flat) },
            { key: "minimum", label: MGT2.DamageTransforms.minimum, total: raw.minimum * boost,
                detail: detail(game.i18n.localize("MGT2.Chat.Damage.PerDie"), raw.minimum - flat) }
        ];
    }

    static #applyLabel(option) {
        return game.i18n.format("MGT2.Chat.Damage.Apply",
            { amount: option.total, transform: game.i18n.localize(option.label) });
    }

    /**
     * Mark the reading the selected target's traits select, and move the pick onto it while the
     * viewer has not made one of their own.
     */
    static #markTransform(message, html) {
        const pick = html.querySelector(".dmgpick");
        if (!message.flags?.mgt2?.apply) return;

        const types = message.flags.mgt2.apply.damageType ?? [];
        // The canvas may answer "who am I applying this to"; it may never answer "what is the
        // answer".
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

        // A card that offers no reading — the grapple's own damage — is applied at face value, so
        // the two it does not carry must not be dereferenced.
        const picked = event.currentTarget.closest(".card")
            ?.querySelector(".dmgpick > [data-transform].on")?.dataset.transform ?? "full";
        const amount = { full: payload.total, reduced: payload.reduced?.total, minimum: payload.minimum }[picked];

        for (const token of targets) {
            const result = await token.actor.applyDamage(amount, {
                scale: payload.scale, ap: payload.ap, loPen: payload.loPen,
                effect: payload.effect, stun: payload.stun, formula: payload.formula,
                multiple: payload.multiple, damageType: payload.damageType, ion: payload.ion,
                ignoreArmour: payload.ignoreArmour
            });
            // Core p.79: what a Stun weapon deals past END is rounds of incapacitation, not injury.
            if (result?.rounds > 0) {
                ui.notifications.info(game.i18n.format("MGT2.Actor.StunIncapacitated",
                    { name: token.actor.name, rounds: result.rounds }));
            }
            // RH folio 106: an ion hit shuts a robot's brain down for as many rounds as it
            // inflicted and a hardened one shrugs it off — the same kind of fact as the Stun rounds
            // above, and reported the same way, because neither is a wound anything on the sheet
            // can hold.
            if (result?.shutdown > 0) {
                ui.notifications.info(game.i18n.format("MGT2.Actor.robot.IonShutdown",
                    { name: token.actor.name, rounds: result.shutdown }));
            } else if (result?.immune) {
                ui.notifications.info(game.i18n.format("MGT2.Actor.robot.IonImmune",
                    { name: token.actor.name }));
            }
            // HG folio 30, one scale up: the hit moves no hull damage at all — it comes off Power
            // and off the computer bandwidth, both of which the ship's own sheet then prints.
            if (result?.hardened) {
                ui.notifications.info(game.i18n.format("MGT2.Actor.spacecraft.IonImmune",
                    { name: token.actor.name }));
            } else if (result?.ion > 0) {
                const lasting = (payload.effect ?? 0) >= 6;
                ui.notifications.info(game.i18n.format(
                    lasting ? "MGT2.Actor.spacecraft.IonDrainRounds" : "MGT2.Actor.spacecraft.IonDrain",
                    { name: token.actor.name, n: result.ion }));
            }
            if (payload.radiation) await ChatHelper.#applyRadiation(token.actor, payload.scale);
            if (payload.hazards?.length) {
                await token.actor.system.applyHazards(payload.hazards, payload.sourceName);
            }
        }
    }

    /** The winner's menu. */
    static async _resolveGrapple(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const grapple = message.flags?.mgt2?.grapple;
        if (!grapple) return;

        const picked = await CharacterPrompts.openGrapple(grapple);
        const rule = MGT2.Grapple.outcomes[picked?.outcome];
        if (!rule) return;

        const metre = game.i18n.localize(MGT2.MetricRange.meter).toLowerCase();
        const lines = [game.i18n.format("MGT2.Grapple.Won",
            { winner: grapple.winner, effect: MGT2Helper.signed(grapple.effect, "+0") })];
        const rolls = [];
        let wound = null;

        // "Throw an opponent 1D metres, causing 1D damage" — two separate dice, and only the second
        // is the one anybody applies.
        if (rule.distance) {
            const thrown = await new Roll(MGT2Helper.damageFormula(rule.distance)).roll();
            rolls.push(thrown);
            lines.push(game.i18n.format("MGT2.Grapple.Thrown", { distance: thrown.total, unit: metre }));
        }
        if (rule.damage) {
            const rolled = await new Roll(MGT2Helper.damageFormula(rule.damage)).roll();
            rolls.push(rolled);
            wound = rolled.total;
        }
        // "Inflict damage equal to 2 + the Effect of the Melee check." A win can still be a failure
        // against a difficulty, so the sum is floored: no outcome of this menu heals anybody.
        if (rule.base !== undefined) {
            wound = Math.max(0, rule.base + grapple.effect);
            lines.push(game.i18n.localize("MGT2.Grapple.NoArmour"));
        }
        if (rule.metres) lines.push(game.i18n.format("MGT2.Grapple.Dragged", { metres: rule.metres, unit: metre }));
        // "If the Effect is 6+, they may take their opponent's weapon."
        if (rule.takes !== undefined) {
            lines.push(game.i18n.localize(
                (grapple.effect >= rule.takes) ? "MGT2.Grapple.Taken" : "MGT2.Grapple.Held"));
        }
        if (rule.attack) lines.push(game.i18n.localize("MGT2.Grapple.WeaponAttack"));
        if (rule.ends) lines.push(game.i18n.localize("MGT2.Grapple.Ends"));

        const chatData = {
            author: game.user.id,
            speaker: message.speaker
        };
        // The wound rides the same flag every other damage offer does, so the existing Apply button
        // resolves it against whichever token the referee has selected.
        const card = {
            roll: (wound > 0) ? rolls.at(-1) ?? null : null,
            showButtons: true,
            rollTypeName: game.i18n.localize("MGT2.Grapple.Title"),
            rollObjectName: game.i18n.localize(rule.label),
            lines
        };
        if (wound > 0) card.applyLabel = game.i18n.format("MGT2.Grapple.Apply", { amount: wound });

        chatData.content = await renderRollCard(card);
        if (wound > 0) {
            chatData.flags = { mgt2: { apply: { total: wound, ignoreArmour: rule.ignoreArmour === true } } };
        }
        if (rolls.length > 0) chatData.rolls = rolls;
        return getDocumentClass("ChatMessage").create(chatData);
    }

    /**
     * Core folio 79: "the target will receive 2D x 20 rads, multiplied by three for Spacecraft
     * scale weapons".
     */
    static async #applyRadiation(actor, scale) {
        const source = MGT2.RadiationSources.weapon;
        const roll = await new Roll((scale === "spacecraft") ? source.spacecraft : source.formula).roll();
        return ChatHelper.resolveExposure(actor, { dose: roll.total, roll });
    }

    /**
     * One exposure, read the way folio 81 reads it: the immediate column against this dose, the
     * permanent one against the running total.
     * @param {object} exposure   `{dose, roll}` — the dose before the armour deduction
     */
    static async resolveExposure(actor, { dose, roll = null }) {
        if ((dose <= 0) || (typeof actor.system.applyRadiation !== "function")) return;
        const protection = actor.system.radiationProtection;
        const applied = await actor.system.applyRadiation(dose - protection);
        if (!applied) {
            return ChatHelper.postRadiation(actor,
                game.i18n.format("MGT2.Radiation.Absorbed", { dose, protection }), roll);
        }

        const parts = [game.i18n.format("MGT2.Radiation.Dose", applied)];
        if (applied.immediate?.damage) {
            const damage = await new Roll(MGT2Helper.damageFormula(applied.immediate.damage)).roll();
            // Read off the actor, never off a model held across the write above: an update replaces
            // `actor.system` with a fresh instance, and the old one still answers with the END the
            // cumulative penalty has just taken away.
            await actor.system.applyDamage(damage.total, { raw: true });
            parts.push(game.i18n.format("MGT2.Radiation.Immediate",
                { formula: applied.immediate.damage, points: damage.total }));
        }
        if (applied.immediate?.condition) parts.push(game.i18n.localize(applied.immediate.condition));
        // Stated only when it moved: the penalty is a standing figure the sheet already prints.
        if (applied.after?.endurance !== applied.before?.endurance) {
            parts.push(game.i18n.format("MGT2.Radiation.Permanent",
                { endurance: MGT2Helper.signed(applied.after.endurance) }));
        }
        // A sub-type whose ladder is not folio 81's says so in sentences of its own: RH folio 106
        // prices a robot's brain in INT and Bandwidth, and has no immediate column at all.
        parts.push(...(applied.lines ?? []));
        return ChatHelper.postRadiation(actor, parts.join(" · "), roll);
    }

    /** A dose is not a recovery, so the card names itself; everything else about it is the same. */
    static postRadiation(actor, message, roll = null) {
        return ChatHelper.postRecovery(actor, "MGT2.Radiation.Exposure", message, roll, "MGT2.Actor.Rads");
    }

    /** The card knows the Effect; who was treated is the referee's pick, as it is for damage. */
    static async _applyChatCardFirstAid(message, event) {
        event.preventDefault();
        event.stopPropagation();
        const points = message.flags?.mgt2?.firstAid?.points;
        if (!points) return;
        for (const token of ChatHelper.#targets()) await ChatHelper.applyFirstAid(token.actor, points);
    }

    /** Core p.82: the Effect of a Medic check, minimum one point, once only. */
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

    /** Hand the referee a pool and let them place it. */
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

        // The procedure was carried out the moment it was confirmed, whatever the referee then
        // chose to place — so that is what spends the one attempt the rule allows.
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
    static async postRecovery(actor, procedure, message, roll = null, title = "MGT2.Recovery.Title") {
        const chatData = {
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            content: await renderRollCard({
                roll,
                rollTypeName: game.i18n.localize(title),
                rollObjectName: game.i18n.localize(procedure),
                lines: [message]
            })
        };
        return roll ? roll.toMessage(chatData) : getDocumentClass("ChatMessage").create(chatData);
    }
}
