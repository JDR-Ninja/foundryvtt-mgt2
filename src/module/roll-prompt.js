import { checkOf } from "./chat-message.js";
import { Checks } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

/** The average of 2D, and the roll the Effect ladder reads. */
const AVERAGE_2D = 7;

/** The strip spans this many bands either side of zero; anything beyond clamps onto the end. */
const LADDER_REACH = 6;

/** Checks a card has offered to the next roll — what the card's "Chain into…" control arms. */
const armedHere = new Set();

/** Offer a check to whatever is rolled next. @param {string} id   A ChatMessage id */
export function armChain(id) {
    armedHere.add(id);
    return armedHere.size;
}

/**
 * Core p.61's tri-state as a number, so the imposed one and the chosen one can be resolved against
 * each other by arithmetic rather than by a table: a Boon is +1, a Bane is −1, and 2D is neither.
 */
function stanceValue(stance) {
    return (stance === "boon") ? 1 : ((stance === "bane") ? -1 : 0);
}

/** The same tri-state as the footer's own dice modifier — `dh` drops the high die, `dl` the low. */
function chosenStance(diceModifier) {
    return (diceModifier === "dl") ? 1 : ((diceModifier === "dh") ? -1 : 0);
}

/**
 * Core p.61: "if a Traveller has both a Boon and a Bane on the same check, they cancel each other
 * out and the check is rolled normally".
 * @param {string} imposed        What the referee asked for
 * @param {string} diceModifier   What the footer button chose
 */
export function resolveStance(imposed, diceModifier) {
    const asked = stanceValue(imposed);
    const chosen = chosenStance(diceModifier);
    const value = Math.sign(asked + chosen);
    return {
        value,
        dice: value ? ((value < 0) ? "dh" : "dl") : null,
        cancelled: (asked !== 0) && (chosen !== 0) && (value === 0)
    };
}

/** The dice-roll configuration prompt. */
export class RollPromptHelper {

    /**
     * Ask the user to configure a roll.
     * @param {object} options   Roll options used to seed the form
     * @returns {Promise<object|null>}   The submitted form data, or null if the dialog was dismissed
     */
    static async roll(options) {
        // A bare <div> with no attributes bypasses DialogV2's cleanHTML pass, which would otherwise
        // strip attributes from the rendered form controls.
        const content = document.createElement("div");
        content.innerHTML = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/roll-prompt.html", {
                config: CONFIG.MGT2,
                blocks: options.blocks ?? {},
                characteristics: options.characteristics,
                characteristic: options.characteristic,
                skills: options.skills,
                skill: options.skill,
                // Built here so the timeframe DM has one home, shared with the roll path.
                timeframes: Object.entries(CONFIG.MGT2.Timeframes).map(([key, label]) => ({
                    key,
                    label: game.i18n.localize(label),
                    dm: MGT2Helper.getTimeframeDM(key),
                    display: MGT2Helper.signed(MGT2Helper.getTimeframeDM(key))
                })).sort((a, b) => a.dm - b.dm),
                timeframeTerm: game.i18n.localize("MGT2.RollPrompt.Timeframes"),
                checkModifiers: (options.checkModifiers ?? []).map(source => ({
                    key: source.key,
                    label: MGT2Helper.modifierLabel(source),
                    dm: source.dm,
                    negative: source.dm < 0,
                    display: MGT2Helper.signed(source.dm),
                    // A source whose rule names the checks it reaches follows the select that
                    // decides them instead of standing on every roll: the characteristic for Core
                    // folio 98's encumbrance, the skill for folio 107's augment.
                    scope: source.characteristics?.join(" ") ?? "",
                    skillScope: source.skills?.join(" ") ?? ""
                })),
                difficulty: options.difficulty,
                // The rungs that have a target number; "not applicable" is the strip's empty cell.
                difficulties: Object.entries(CONFIG.MGT2.DifficultyTargets).map(([key, target]) => ({
                    key,
                    target,
                    label: game.i18n.localize(CONFIG.MGT2.Difficulty[key])
                })),
                // What the referee fixed, stated and not offered.
                imposed: this.#imposedContext(options),
                traits: MGT2Helper.weaponTraitRows(options.weapon, options.strengthDM),
                // Core folio 78 and folio 75, both folded into the Modifiers row rather than given
                // rows of their own — and never both at once, since one belongs to a weapon attack
                // and the other to the skill checks that are not one.
                dualWeapons: options.blocks?.attack ? {
                    dm: MGT2.AttackModifiers.dualWeapons.dm,
                    display: MGT2Helper.signed(MGT2.AttackModifiers.dualWeapons.dm),
                    suppress: MGT2.AttackModifiers.dualWeapons.suppress,
                    label: game.i18n.localize(MGT2.AttackModifiers.dualWeapons.label)
                } : null,
                calledShot: this.#calledShotContext(options),
                extended: options.blocks?.extended
                    ? { dm: MGT2.ExtendedAction.dm, per: MGT2.ExtendedAction.per } : null,
                microgravity: this.#microgravityContext(options.microgravity),
                priorChecks: this.#priorChecks(6, options.armed),
                ...this.#ceilingContext(options.ceiling),
                ...this.#reachContext(options.blocks?.psionic ? options.talent : null),
                // Core p.74's table is headed "Common Modifiers to Ranged Attacks"; a melee weapon
                // still brings its traits.
                ...this.#rangeContext(options.blocks?.range ? options.weapon : null, options.measured)
            });

        /** Read the dialog form, optionally tagging the roll with a boon/bane die modifier. */
        const read = (button, diceModifier) => {
            const data = new FormDataExtended(button.form).object;
            if ( diceModifier ) data.diceModifier = diceModifier;
            return data;
        };

        const result = await DialogV2.wait({
            // What is being rolled, not what kind of thing it is: the gutter form has no block
            // caption to carry the weapon's name, and "Weapon" never identified which one anyway.
            window: {
                title: options.rollObjectName || options.rollTypeName
                    || game.i18n.localize("MGT2.RollPrompt.Roll")
            },
            classes: ["mgt2", "mgt2-prompt"],
            // Wider than it was, and much shorter for it: the gutter form pays for two controls a
            // line with width, which is the dimension a 16:9 screen has to spare.
            position: { width: 500 },
            content,
            buttons: [
                {
                    action: "bane",
                    label: "MGT2.RollPrompt.Bane",
                    callback: (event, button) => read(button, "dh")
                },
                {
                    action: "submit",
                    label: "MGT2.RollPrompt.Roll",
                    icon: "fa-solid fa-dice",
                    default: true,
                    callback: (event, button) => read(button)
                },
                {
                    action: "boon",
                    label: "MGT2.RollPrompt.Boon",
                    callback: (event, button) => read(button, "dl")
                }
            ],
            render: (event, dialog) => this.#activate(dialog.element),
            rejectClose: false
        });

        // An offer is consumed by the roll it was made into, not by a window opening.
        if ( result ) armedHere.clear();
        return result;
    }

    /** Core p.81's zero-gravity requirement, stated with its target number. */
    static #microgravityContext(microgravity) {
        if ( !microgravity ) return null;
        return { exempt: microgravity.exempt === true,
            target: MGT2Helper.getDifficultyValue(MGT2.Microgravity.difficulty) };
    }

    /** VH2026 p.10: offered on an attack under that book, and never to artillery. */
    static #calledShotContext(options) {
        if ( !options.blocks?.attack ) return null;
        if ( Rules.get("vehicleCombat") !== "vehicle2026" ) return null;
        if ( MGT2Helper.hasTrait(options.weapon?.system?.traits, "artillery") ) return null;
        const rule = MGT2.AttackModifiers.calledShot;
        return { dm: rule.dm, display: MGT2Helper.signed(rule.dm),
            label: game.i18n.localize(rule.label) };
    }

    /**
     * What a roll request fixed, resolved against the roller's own numbers so the readout and the
     * formula read the same source.
     */
    static #imposedContext(options) {
        const imposed = options.imposed;
        if ( !imposed ) return null;
        const sign = value => MGT2Helper.signed(value, "+0");
        const context = { flavor: imposed.flavor ?? "", stance: imposed.stance ?? "none" };

        const chars = imposed.chars ?? [];
        const characteristic = (chars.length === 1)
            ? options.characteristics?.find(entry => entry._id === chars[0]) : null;
        if ( characteristic ) {
            context.characteristic = { key: characteristic._id, label: characteristic.name,
                term: characteristic.term, dm: characteristic.dm, display: sign(characteristic.dm) };
        }
        else context.narrowChars = chars.length > 1;

        // `null` is the referee choosing untrained, which is the prompt's own `NP` sentinel; an id
        // is a resolution frozen on the referee's client.
        if ( imposed.skillItem !== undefined ) {
            const key = (imposed.skillItem === null) ? "NP" : imposed.skillItem;
            const skill = options.skills?.find(entry => entry._id === key);
            if ( skill ) {
                context.skill = { key, label: skill.name, term: skill.term, dm: skill.dm,
                    display: sign(skill.dm) };
            }
        }

        if ( imposed.timeframe ) {
            const dm = MGT2Helper.getTimeframeDM(imposed.timeframe);
            context.timeframe = {
                key: imposed.timeframe,
                label: game.i18n.localize(MGT2.Timeframes[imposed.timeframe]),
                term: game.i18n.localize("MGT2.RollPrompt.Timeframes"),
                dm, display: sign(dm)
            };
        }

        // Core p.61 permits a check with no stated difficulty, and that is itself imposed: leaving
        // the ladder live would let the answer pick a rung the referee declined to state.
        if ( imposed.difficulty !== undefined ) {
            context.difficulty = { key: imposed.difficulty ?? "",
                label: MGT2Helper.getDifficultyDisplay(imposed.difficulty)
                    ?? game.i18n.localize("MGT2.Difficulty.NA") };
        }

        // Core p.64 constrains a DM's provenance, so the label IS the row.
        if ( imposed.dm?.value ) {
            context.dm = {
                term: imposed.dm.label,
                label: `${imposed.dm.label} ${MGT2Helper.signed(imposed.dm.value)}`,
                dm: imposed.dm.value,
                negative: imposed.dm.value < 0
            };
        }

        // Core p.73's ambush: a second imposed DM, because its sign belongs to the side rather than
        // to the demand and one row cannot hold both signs.
        if ( imposed.ambush ) {
            const term = game.i18n.localize("MGT2.Request.Ambush");
            context.ambush = { term, label: `${term} ${MGT2Helper.signed(imposed.ambush)}`,
                dm: imposed.ambush, negative: imposed.ambush < 0 };
        }

        // What pressing ROLL rolls, which is what the readout has to say — the stance is imposed by
        // the form and the footer only ever adds to it.
        if ( context.stance !== "none" ) {
            context.dice = game.i18n.localize((context.stance === "bane")
                ? "MGT2.RollPrompt.BaneDice" : "MGT2.RollPrompt.BoonDice");
        }
        context.asked = Boolean(context.flavor || context.dm || context.ambush || context.dice);
        return context;
    }

    /**
     * The characteristic options a given actor offers, with the blank first entry that means "no
     * characteristic".
     */
    static actorCharacteristics(actor) {
        const options = [{ _id: "", name: "", dm: 0 }];
        for ( const key of actor.system.rollableCharacteristics ) {
            const c = actor.system.characteristics[key];
            const label = game.i18n.localize(MGT2.Characteristics[key] ?? MGT2.DamageTracks[key] ?? key);
            options.push({ _id: key, name: `${label} — ${c.value}`, term: label, dm: c.dm });
        }
        return options;
    }

    /**
     * The skills a given actor offers, "Not proficient" first.
     *
     * Core folio 69's Jack-of-All-Trades is **not** among them, and neither is Modül's Polyvalent:
     * the book makes it a reduction of the unskilled penalty, never a skill a Traveller rolls, and
     * this prompt already spends it that way in the "Not proficient" row above. Offering it a
     * second time as an ordinary row let a player roll it at its own level against any check —
     * counting it twice, once as the reduction and once as a bonus. Matched through
     * `MGT2.Untrained.skills`, the same list `untrained()` reads, so the two can never disagree.
     */
    static actorSkills(actor) {
        const reducers = MGT2.Untrained.skills;
        const skills = actor.items
            .filter(item => (item.type === "talent") && (item.system.subType === "skill")
                && !reducers.some(name => MGT2Helper.matchesSkill(item.name, name)))
            // The prompt prints every row's DM in its own cell, so the option names the skill only.
            .map(item => ({ _id: item.id, name: item.getRollDisplay(false), term: item.name,
                dm: item.system.level }))
            .sort(MGT2Helper.compareByName);
        const untrained = this.untrained(actor);
        return [{ _id: "NP", name: untrained.label, term: untrained.label, dm: untrained.dm },
            ...skills];
    }

    /**
     * Core folio 59's DM−3 for an unskilled check, as folio 69's Jack-of-All-Trades leaves it: one
     * point of the penalty per level, no benefit past level 3, and never a bonus.
     * @returns {{dm: number, level: number, label: string}}
     */
    static untrained(actor) {
        const rule = MGT2.Untrained;
        let level = 0;
        let named = "";
        for ( const item of actor?.items ?? [] ) {
            if ( (item.type !== "talent") || (item.system.subType !== "skill") ) continue;
            if ( !rule.skills.some(name => MGT2Helper.matchesSkill(item.name, name)) ) continue;
            if ( (item.system.level ?? 0) <= level ) continue;
            level = item.system.level;
            named = item.name;
        }
        const notProficient = game.i18n.localize("MGT2.Items.NotProficient");
        return {
            level,
            dm: rule.dm + Math.min(level, rule.max),
            label: level ? game.i18n.format("MGT2.RollPrompt.UntrainedReduced",
                { untrained: notProficient, skill: named, level }) : notProficient
        };
    }

    /**
     * Everything the prompt's answer contributes to one check: the dice, the characteristic, the
     * skill, the timeframe, the modifiers that were not waived, the chain, and the free DM — in
     * that order, because the card lists them in the order the formula reads them.
     * @param {object} data              What `RollPromptHelper.roll` came back with
     * @param {Actor} actor              Whose characteristics and skills the prompt offered
     * @param {object[]} checkModifiers  The sources the prompt listed, with their `key`
     * @returns {{formula: string, modifiers: {name: string, dm: number}[],
     *     chainSources: object[], stance: object}}
     */
    static terms(data, actor, checkModifiers = [], extra = []) {
        const modifiers = [];
        const parts = [];
        // Core p.61's tri-state, resolved once: the referee's own Boon or Bane rides the form as
        // `imposedStance`, the player's rides the footer button, and one of each cancels.
        const stance = resolveStance(data.imposedStance, data.diceModifier);
        if ( stance.dice ) {
            parts.push("3d6");
            parts.push(stance.dice);
        }
        else parts.push("2d6");

        if ( Object.hasOwn(data, "characteristic") && (data.characteristic !== "") ) {
            const dm = actor.system.characteristics[data.characteristic]?.dm ?? 0;
            parts.push(MGT2Helper.getFormulaDM(dm));
            modifiers.push({ name: game.i18n.localize(
                `MGT2.Characteristics.${data.characteristic}.name`), dm });
        }

        if ( Object.hasOwn(data, "skill") && (data.skill !== "") ) {
            if ( data.skill === "NP" ) {
                const untrained = this.untrained(actor);
                parts.push(MGT2Helper.getFormulaDM(untrained.dm));
                modifiers.push({ name: untrained.label, dm: untrained.dm });
            }
            else {
                const skillObj = actor.getEmbeddedDocument("Item", data.skill);
                if ( skillObj ) {
                    parts.push(MGT2Helper.getFormulaDM(skillObj.system.level));
                    modifiers.push({ name: skillObj.getRollDisplay(false),
                        dm: skillObj.system.level });
                }
            }
        }

        const timeframeDM = MGT2Helper.getTimeframeDM(data.timeframes);
        if ( timeframeDM !== 0 ) {
            modifiers.push({ name: game.i18n.localize(`MGT2.Timeframes.${data.timeframes}`),
                dm: timeframeDM });
            parts.push(MGT2Helper.getFormulaDM(timeframeDM));
        }

        // The accumulator's own numbers, minus whatever the player waived in the prompt.
        const rows = checkModifiers.filter(source => data[`check-${source.key}`] === true)
            .map(source => [MGT2Helper.modifierLabel(source), source.dm]);
        rows.push(...extra);

        // Core folio 75: the damage that interrupted an Extended Action is the negative DM on the
        // check made to keep the round's work, one point for one point.
        const sustained = MGT2Helper.getIntegerFromInput(data.damageSustained);
        if ( sustained > 0 ) {
            rows.push([game.i18n.localize("MGT2.RollPrompt.DamageSustained"),
                sustained * MGT2.ExtendedAction.dm]);
        }

        // Core p.63: the Effect of a previous check is a DM on this one, and the working together
        // rule on the same page is that table read once per contributor.
        const chainSources = [];
        for ( const id of [data.chain ?? []].flat().filter(value => value) ) {
            const message = game.messages.get(id);
            const source = checkOf(message);
            if ( !Number.isInteger(source?.effect) ) continue;
            const dm = MGT2Helper.taskChainDM(source.effect);
            const label = source.label || message.speaker?.alias
                || game.i18n.localize("MGT2.RollPrompt.Roll");
            chainSources.push({ id, label, dm });
            rows.push([game.i18n.format("MGT2.RollPrompt.ChainTerm", { source: label }), dm]);
        }

        const reduced = Checks.modifiers(rows);
        parts.push(...reduced.parts);
        modifiers.push(...reduced.terms);

        if ( Object.hasOwn(data, "customDM") && (data.customDM !== "") ) {
            const typed = String(data.customDM).trim();
            if ( /^[0-9]/.test(typed) ) parts.push("+");
            parts.push(typed);
        }

        return { formula: parts.join(""), modifiers, chainSources, stance };
    }

    /** Checks this one can be measured against: chained from (Core p.63) or opposed (Core p.62). */
    static #priorChecks(limit = 6, extra = []) {
        const messages = game.messages?.contents ?? [];
        const armed = new Set([...armedHere, ...(extra ?? [])]);
        // A source that has already fed a check is still legal to reuse — the rule says nothing —
        // so this is a note beside the option and never a reason to withhold it.
        const consumed = new Set(messages.flatMap(m => checkOf(m)?.previous ?? []));
        const row = message => {
            const check = checkOf(message);
            if ( !Number.isInteger(check?.effect) || !message.visible ) return null;
            const name = [message.speaker?.alias, check.label].filter(x => x).join(" · ");
            return {
                id: message.id,
                selected: armed.has(message.id),
                label: `${name} · ${MGT2Helper.signed(check.effect, "+0")}`
                    + (consumed.has(message.id) ? ` · ${game.i18n.localize("MGT2.RollPrompt.ChainUsed")}` : ""),
                term: game.i18n.format("MGT2.RollPrompt.ChainTerm", { source: check.label || name }),
                // The chain reads the rung; the opposed row reads the Effect itself, because Core
                // p.62 compares the two numbers and modifies neither.
                dm: MGT2Helper.taskChainDM(check.effect), effect: check.effect
            };
        };

        const rows = [...armed].map(id => row(game.messages.get(id))).filter(entry => entry);
        for ( let i = messages.length - 1; (i >= 0) && (rows.length < limit); i-- ) {
            if ( armed.has(messages[i].id) ) continue;
            const entry = row(messages[i]);
            if ( entry ) rows.push(entry);
        }
        return rows;
    }

    /** RH folio 115's task ceiling as two sentences the readout picks between. */
    static #ceilingContext(ceiling) {
        if (!ceiling?.target || !Rules.on("taskCeiling")) return {};
        const params = {
            grade: game.i18n.localize(ceiling.grade),
            ceiling: game.i18n.localize(MGT2.Difficulty[ceiling.key])
        };
        return { ceiling: {
            scope: ceiling.characteristics.join(" "),
            target: ceiling.target,
            within: game.i18n.format("MGT2.RollPrompt.Ceiling", params),
            over: game.i18n.format("MGT2.RollPrompt.CeilingOver", params)
        } };
    }

    /**
     * Core folio 229's Reach row: the band the power is printed at, and the two a psion can push it
     * to — "increased by one Range Band if twice the PSI Cost is paid and increased by two Range
     * Bands if the PSI Cost is multiplied by four".
     */
    static #reachContext(talent) {
        const psionic = talent?.system.psionic;
        if (!psionic?.reach || (psionic.reach === "NA")) return {};
        const bands = Object.keys(MGT2.PsionicReach).filter(key => key !== "NA");
        const at = bands.indexOf(psionic.reach);
        if (at < 0) return {};

        const listed = Math.max(0, psionic.cost ?? 0);
        return { reach: MGT2.PsionicBoosts
            .filter(boost => (at + boost.bands) < bands.length)
            .map(boost => ({
                cost: boost.cost,
                points: listed * boost.cost,
                band: game.i18n.localize(MGT2.PsionicReach[bands[at + boost.bands]]),
                checked: boost.bands === 0
            })) };
    }

    /**
     * What the Range block needs: the weapon's own Range score, the aiming ladder, the two
     * thresholds Core folio 77 names and — for a weapon with Auto — the fire mode.
     */
    static #rangeContext(weapon, measured = null) {
        if (!weapon) return {};
        const inForce = Rules.get("extremeRange");
        const range = weapon.system.range;
        const unit = range.unit ? game.i18n.localize(MGT2.MetricRange[range.unit]).toLowerCase() : "";
        const aimTerm = game.i18n.localize(MGT2.AttackModifiers.aiming.label);
        const auto = MGT2Helper.traitScore(weapon.system.effective.traits, "auto");
        // Core folio 167: the to-hit half of the Damage Scale table.
        const crossScale = MGT2.CrossScaleAttack[
            (weapon.system.scale === "spacecraft") ? "spacecraft" : "ground"];

        return {
            weapon: {
                range: range.value,
                unit,
                distance: measured?.distance ?? "",
                // Under the gutter word, so the band can be read against the score it came from.
                rangeLabel: range.value ? MGT2Helper.getRangeDisplay(range) : "",
                // Core folio 77 states the rule in metres, so a weapon ranged in kilometres is not offered it.
                thresholds: (range.unit === "kilometer") ? null
                    : Object.entries(MGT2.ExtremeRangeThresholds).map(([key, threshold]) => ({
                        metres: threshold.metres,
                        checked: key === inForce,
                        label: game.i18n.format(threshold.label, { metres: threshold.metres })
                    })),
                // The waived reading has no threshold to name, so it is the strip's empty cell.
                thresholdWaived: inForce === "none"
            },
            metre: game.i18n.localize(MGT2.MetricRange.meter).toLowerCase(),
            // A snapshot can go stale, so the band says where the figure came from until the field
            // is typed into — at which point it is the player's number and the caption is dropped.
            measuredFrom: measured?.target
                ? game.i18n.format("MGT2.RollPrompt.RangeMeasured", { target: measured.target }) : "",
            crossScale: {
                dm: crossScale.dm,
                negative: crossScale.dm < 0,
                display: MGT2Helper.signed(crossScale.dm),
                label: game.i18n.localize(crossScale.label)
            },
            aiming: Array.fromRange(MGT2.AttackModifiers.aiming.max + 1).map(steps => ({
                value: steps,
                dm: steps * MGT2.AttackModifiers.aiming.dm,
                label: MGT2Helper.signed(steps * MGT2.AttackModifiers.aiming.dm, "—"),
                term: aimTerm
            })),
            // Core folio 79: the strip exists only where the Auto score does, and what each mode is
            // worth is that score read two ways — added to damage, or counted in attacks.
            fireModes: (auto > 0) ? Object.entries(MGT2.FireModes).map(([key, mode]) => ({
                key,
                label: game.i18n.localize(mode.label),
                suppress: mode.suppress ?? "",
                rounds: mode.rounds ? mode.rounds * auto : 0,
                display: mode.damage ? MGT2Helper.signed(auto)
                    : (mode.attacks ? game.i18n.format("MGT2.RollPrompt.FireModeAttacks", { count: auto }) : "")
            })) : null
        };
    }

    /** Wire the live readout and hang the dice each button rolls under its label. */
    static #activate(root) {
        const form = root.querySelector("form");
        if ( !form ) return;

        // Each button says what IT rolls, which on a request is the referee's stance resolved
        // against that button's own (Core p.61).
        const imposed = form.elements.imposedStance?.value ?? "";
        const dice = { bane: "dh", submit: "", boon: "dl" };
        for ( const [action, chosen] of Object.entries(dice) ) {
            const button = form.querySelector(`button[data-action="${action}"]`);
            if ( !button || button.querySelector(".d") ) continue;
            const sub = document.createElement("span");
            sub.className = "d";
            sub.textContent = game.i18n.localize(this.#diceLabel(imposed, chosen));
            button.append(sub);
        }

        // An offered trait tracks its own rule until the player touches it, and then stops: a box
        // that keeps re-deciding after being clicked is not an offer.
        for ( const box of form.querySelectorAll('input[data-auto="true"]') ) {
            box.addEventListener("change", () => { box.dataset.auto = "false"; });
        }

        // The measured caption names where the seeded distance came from; a typed one came from
        // nowhere but the player, so the attribution goes at the first keystroke.
        form.elements.distance?.addEventListener("input", () => {
            form.querySelector('[data-readout="band"]')?.removeAttribute("data-from");
        }, { once: true });

        // The difficulty cells carry the target number; the word sits beside them and follows the
        // pointer, so the ladder names its own rungs without ever being opened.
        const ladder = form.querySelector('[data-name="difficulty"]');
        const name = form.querySelector('[data-readout="difficultyName"]');
        const showDifficulty = peeked => {
            if ( !ladder || !name ) return;
            const chosen = ladder.querySelector("input:checked")?.closest("label");
            name.textContent = (peeked ?? chosen)?.dataset.name ?? "";
            name.classList.toggle("peek", Boolean(peeked) && (peeked !== chosen));
        };
        ladder?.addEventListener("pointerover", event => {
            const cell = event.target.closest("label");
            if ( cell ) showDifficulty(cell);
        });
        ladder?.addEventListener("pointerleave", () => showDifficulty());

        const update = () => { this.#readout(form); showDifficulty(); };
        form.addEventListener("change", update);
        form.addEventListener("input", update);
        update();
    }

    /** The dice one stance pairing actually rolls, as an i18n key. */
    static #diceLabel(imposed, diceModifier) {
        const { value } = resolveStance(imposed, diceModifier);
        if ( value < 0 ) return "MGT2.RollPrompt.BaneDice";
        if ( value > 0 ) return "MGT2.RollPrompt.BoonDice";
        return "MGT2.RollPrompt.RollDice";
    }

    /**
     * The Weapon traits block's live half: the conditions an offered trait watches, and the rows
     * one voids.
     * @returns {Set<string>}   The form controls whose contribution is void
     */
    static #traits(form) {
        const distance = MGT2Helper.getNumberFromInput(form.elements.distance?.value);
        for ( const box of form.querySelectorAll("input[data-when]") ) {
            const bound = Number(box.dataset.whenValue);
            if ( !box.dataset.when ) continue;
            const met = (box.dataset.when === "beyond")
                ? (distance > bound)
                : ((distance > 0) && (bound > 0) && (distance <= bound));
            if ( box.dataset.auto === "true" ) box.checked = met;
            const status = form.querySelector(`[data-status="${box.name}"]`);
            if ( status ) {
                status.title = game.i18n.localize(met
                    ? "MGT2.RollPrompt.TraitConditionMet" : "MGT2.RollPrompt.TraitOffered");
            }
        }

        const suppressed = new Set();
        const boxes = [...form.querySelectorAll("input[data-suppress]")].filter(b => b.dataset.suppress);
        for ( const box of boxes ) {
            if ( !box.dataset.requires && box.checked ) suppressed.add(box.dataset.suppress);
        }
        for ( const box of boxes ) {
            const required = box.dataset.requires;
            if ( !required ) continue;
            const live = !suppressed.has(required)
                && (MGT2Helper.getNumberFromInput(form.elements[required]?.value) > 0);
            if ( box.checked && live ) suppressed.add(box.dataset.suppress);
        }
        return suppressed;
    }

    /** A trait whose DM is a function of the shot: the row's DM is rewritten before it is summed. */
    static #scaleTraits(form, suppressed) {
        const distance = MGT2Helper.getNumberFromInput(form.elements.distance?.value);
        const range = form.querySelector('[data-readout="band"]')?.dataset.range;
        // Core p.79: a scoped weapon that aimed is not held to the 100 m rule, and Accurate follows it.
        const threshold = suppressed.has("rangeThreshold") ? 0
            : MGT2Helper.getIntegerFromInput(form.elements.rangeThreshold?.value);
        for ( const box of form.querySelectorAll("input[data-tiers], input[data-bands]") ) {
            const rule = { tiers: box.dataset.tiers ? JSON.parse(box.dataset.tiers) : null,
                bands: box.dataset.bands ? JSON.parse(box.dataset.bands) : null };
            if ( !rule.tiers && !rule.bands ) continue;
            const dm = MGT2Helper.tieredDM(rule, { distance, range, threshold });
            box.dataset.dm = String(dm);
            if ( box.dataset.auto === "true" ) box.checked = dm !== 0;
            const cell = box.closest("label")?.querySelector(".v");
            if ( cell ) cell.textContent = dm ? MGT2Helper.signed(dm) : "—";
        }
    }

    /** A modifier whose rule reaches only some checks follows the select that decides them. */
    static #scoped(form) {
        const chosen = {
            scope: form.elements.characteristic?.value ?? "",
            skillScope: form.elements.skill?.value ?? ""
        };
        for ( const box of form.querySelectorAll("input[data-auto='true']") ) {
            for ( const [attr, value] of Object.entries(chosen) ) {
                if ( box.dataset[attr] === undefined ) continue;
                box.checked = box.dataset[attr].split(" ").includes(value);
            }
        }
    }

    /** Recompute the formula, the target and the Effect ladder from the form as it stands. */
    static #readout(form) {
        const out = key => form.querySelector(`[data-readout="${key}"]`);
        // Every number in the readout is a modifier, so zero reads "+0" rather than "0".
        const sign = value => MGT2Helper.signed(value, "+0");
        const cell = (node, dm) => {
            if ( !node ) return;
            node.textContent = sign(dm);
            node.classList.toggle("zero", dm === 0);
        };
        const terms = [];

        const suppressed = this.#traits(form);
        this.#scaleTraits(form, suppressed);
        this.#scoped(form);

        // A DM source is either a select or a segmented radio group; both name a chosen node that
        // carries the DM, so the only difference is how the choice is read off.
        for ( const control of form.querySelectorAll(".dm-source") ) {
            const isSelect = control.matches("select");
            const chosen = isSelect
                ? (control.multiple ? [...control.selectedOptions] : [control.selectedOptions[0]])
                : [control.querySelector("input:checked")];
            const source = isSelect ? control.name : control.dataset.name;
            const void_ = suppressed.has(source);
            let dm = 0;
            for ( const node of chosen ) {
                if ( !node ) continue;
                const value = void_ ? 0 : Number(node.dataset.dm ?? 0);
                dm += value;
                if ( value ) terms.push([node.dataset.term || node.textContent, value]);
            }
            cell(out(source), dm);
            (control.closest(".seggrp") ?? control).classList.toggle("voided", void_);
        }

        // Applied traits have no control of their own: the row is the readout's only input.
        for ( const node of form.querySelectorAll("[data-applied-dm]") ) {
            const dm = Number(node.dataset.appliedDm);
            if ( dm ) terms.push([node.dataset.term, dm]);
        }

        const band = this.#band(form, suppressed);
        if ( band?.dm ) terms.push([band.term, band.dm]);

        // Core p.74 buys a DM per full ten metres of target movement, not per metre.
        for ( const input of form.querySelectorAll("input[data-per]") ) {
            const steps = Math.floor(
                Math.max(0, MGT2Helper.getNumberFromInput(input.value)) / Number(input.dataset.per));
            const dm = steps * Number(input.dataset.dm);
            cell(out(input.name), dm);
            if ( dm ) terms.push([input.dataset.term, dm]);
        }

        for ( const box of form.querySelectorAll("input[type=checkbox][data-dm]") ) {
            // Core p.74: a laser sight is worth nothing to an attacker who is not aiming.
            const requires = box.dataset.requires;
            const live = !requires || (!suppressed.has(requires)
                && (MGT2Helper.getNumberFromInput(form.elements[requires]?.value) > 0));
            box.disabled = !live;
            box.closest("label")?.classList.toggle("disabled", !live);
            // A box the player cannot reach is not an offer, and "your call" on a greyed control
            // says the opposite of what it is doing.
            const status = requires && form.querySelector(`[data-status="${box.name}"]`);
            if ( status ) {
                status.title = live ? game.i18n.localize("MGT2.RollPrompt.TraitOffered")
                    : game.i18n.format("MGT2.RollPrompt.TraitUnmet",
                        { requirement: game.i18n.localize(MGT2.AttackModifiers[requires]?.label ?? requires) });
            }
            // A chip is solid while it is in the roll and struck through while it is not.
            const chip = box.closest(".code");
            chip?.classList.toggle("hot", box.checked && live);
            chip?.classList.toggle("off", !(box.checked && live));
            if ( box.checked && live && Number(box.dataset.dm) ) {
                terms.push([box.dataset.term, Number(box.dataset.dm)]);
            }
        }

        const custom = MGT2Helper.getIntegerFromInput(form.elements.customDM?.value);
        cell(out("customDM"), custom);
        if ( custom ) terms.push([game.i18n.localize("MGT2.RollPrompt.CustomDM"), custom]);

        // The preview totals through the same reducer the formula does, so the number on the strip
        // and the number rolled cannot drift apart.
        const { total } = Checks.modifiers(terms);

        // The dice the formula reads are the ones ROLL would roll, so an imposed Bane shows as 3D
        // drop high before a button is touched rather than only after one is.
        const diceName = game.i18n.localize(
            this.#diceLabel(form.elements.imposedStance?.value ?? "", ""));
        out("formula").textContent = (total === 0) ? diceName : `${diceName} ${sign(total)}`;

        const target = MGT2Helper.getEffectTarget(form.elements.difficulty?.value);
        out("target").textContent = `${target.value}+`;
        out("target").closest(".vs").classList.toggle("assumed", target.assumed);
        this.#ceiling(form, target.value);

        out("terms").replaceChildren(...terms.map(([name, dm]) => {
            const span = document.createElement("span");
            if ( dm < 0 ) span.className = "neg";
            span.textContent = `${name} ${sign(dm)}`;
            return span;
        }));
        if ( !terms.length ) {
            const span = document.createElement("span");
            span.textContent = game.i18n.localize("MGT2.RollPrompt.NoModifiers");
            out("terms").append(span);
        }

        // Effect before the dice: a player choosing between options is choosing an Effect, and the
        // reading only means anything against an assumed roll, so the caption states the 7.
        const effect = AVERAGE_2D + total - target.value;
        const marker = Math.max(-LADDER_REACH, Math.min(LADDER_REACH, effect));
        const cells = [];
        for ( let e = -LADDER_REACH; e <= LADDER_REACH; e++ ) {
            const cell = document.createElement("span");
            cell.className = e >= 0 ? "s" : "f";
            if ( e === marker ) cell.classList.add("here");
            if ( e === -LADDER_REACH ) cell.textContent = `≤${sign(e)}`;
            else if ( e === LADDER_REACH ) cell.textContent = `${sign(e)}≤`;
            else cell.textContent = sign(e);
            cells.push(cell);
        }
        out("ladder").replaceChildren(...cells);
        out("effect").textContent = sign(effect);
        out("effectBand").textContent = game.i18n.localize(MGT2Helper.getEffectBand(effect).label);
    }

    /** RH folio 115's ceiling against the check as it stands. */
    static #ceiling(form, target) {
        const node = form.querySelector('[data-readout="ceiling"]');
        if ( !node ) return;
        const chosen = form.elements.characteristic?.value ?? "";
        const applies = node.dataset.scope.split(" ").includes(chosen);
        const slower = Math.max(0, MGT2Helper.getTimeframeDM(form.elements.timeframes?.value));
        const over = applies && ((target - slower) > Number(node.dataset.target));
        node.textContent = applies ? (over ? node.dataset.over : node.dataset.within) : "";
        node.classList.toggle("over", over);
    }

    /**
     * Paint the range band the typed distance falls in and hand its DM back to the readout.
     * @returns {{dm: number, term: string}|null}
     */
    static #band(form, suppressed = new Set()) {
        const node = form.querySelector('[data-readout="band"]');
        if ( !node ) return null;

        const unit = node.dataset.unit ?? "";
        // Core p.79: a scoped weapon aimed before shooting is not held to the 100 m rule.
        const threshold = suppressed.has("rangeThreshold") ? 0
            : MGT2Helper.getIntegerFromInput(form.elements.rangeThreshold?.value);
        const band = MGT2Helper.rangeBand(form.elements.distance?.value, node.dataset.range, threshold);
        node.className = "band";
        if ( !band ) {
            node.replaceChildren();
            return null;
        }

        const round = value => Math.round(value * 100) / 100;
        const term = game.i18n.localize(MGT2.RangeBands[band.key].label);
        let why;
        if ( band.forced ) {
            why = game.i18n.format("MGT2.RollPrompt.RangeForced", { distance: threshold, unit });
        } else if ( band.max === null ) {
            why = game.i18n.format("MGT2.RollPrompt.RangeBeyond", { min: round(band.min), unit });
        } else if ( band.min === 0 ) {
            why = game.i18n.format("MGT2.RollPrompt.RangeUpTo", { max: round(band.max), unit });
        } else {
            why = game.i18n.format("MGT2.RollPrompt.RangeSpan",
                { min: round(band.min), max: round(band.max), unit });
        }

        const parts = [["b", term]];
        // Out of range prints no DM: the band is shown and the player rolls anyway.
        if ( band.key !== "out" ) parts.push(["dmv", MGT2Helper.signed(band.dm, "+0")]);
        parts.push(["why", node.dataset.from ? `${why} · ${node.dataset.from}` : why]);
        node.replaceChildren(...parts.map(([className, text]) => {
            const span = document.createElement("span");
            span.className = className;
            span.textContent = text;
            return span;
        }));
        const tone = (band.key === "out") ? "out" : (band.dm > 0 ? "pos" : (band.dm < 0 ? "neg" : ""));
        if ( tone ) node.classList.add(tone);
        if ( band.forced ) node.classList.add("forced");

        return { dm: band.dm, term };
    }
}
