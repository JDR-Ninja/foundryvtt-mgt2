import { checkOf } from "./chat-message.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

/** The average of 2D, and the roll the Effect ladder reads. */
const AVERAGE_2D = 7;

/** The strip spans this many bands either side of zero; anything beyond clamps onto the end. */
const LADDER_REACH = 6;

/**
 * Checks a card has offered to the next roll — `sketch-task-chain.html`'s "Chain into…". A set,
 * because Core p.63's working together is several contributors offering into one final check, and
 * each of them clicks their own card. Per-client and never persisted: this is the state of an open
 * window, the same boundary the rail and the sheet's play/edit mode sit behind.
 */
const armed = new Set();

/** Offer a check to whatever is rolled next. @param {string} id   A ChatMessage id */
export function armChain(id) {
    armed.add(id);
    return armed.size;
}

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
                blocks: options.blocks ?? {},
                characteristics: options.characteristics,
                characteristic: options.characteristic,
                skills: options.skills,
                skill: options.skill,
                // Built here so the timeframe DM has one home, shared with the roll path. A strip
                // implies an order, so they run from rushed to unhurried rather than in key order.
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
                    // A source whose rule names the checks it reaches follows the characteristic
                    // select instead of standing on every roll (Core folio 98's encumbrance).
                    scope: source.characteristics?.join(" ") ?? ""
                })),
                difficulty: options.difficulty,
                // The rungs that have a target number; "not applicable" is the strip's empty cell.
                difficulties: Object.entries(CONFIG.MGT2.DifficultyTargets).map(([key, target]) => ({
                    key,
                    target,
                    label: game.i18n.localize(CONFIG.MGT2.Difficulty[key])
                })),
                traits: MGT2Helper.weaponTraitRows(options.weapon, options.strengthDM),
                priorChecks: this.#priorChecks(),
                ...this.#ceilingContext(options.ceiling),
                ...this.#reachContext(options.blocks?.psionic ? options.talent : null),
                // Core p.74's table is headed "Common Modifiers to Ranged Attacks"; a melee weapon
                // still brings its traits.
                ...this.#rangeContext(options.blocks?.range ? options.weapon : null)
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

        // An offer is consumed by the roll it was made into, not by a window opening. A prompt
        // opened and dismissed leaves every contributor's card still armed, which matters when
        // three people have offered into one check and the fourth mis-clicks.
        if ( result ) armed.clear();
        return result;
    }

    /* -------------------------------------------- */

    /**
     * The characteristic options a given actor offers, with the blank first entry that means "no
     * characteristic". Each is named with its current score. **The roster is the actor's own**
     * (`rollableCharacteristics`) and not the shown keys: a damage pool is displayed and never
     * rolled, and a robot's INT is rolled whether or not the Traveller flag reveals it.
     * @param {Actor} actor
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
     * The skills a given actor offers, "Not proficient" first. Core p.59 puts an untrained check at
     * DM−3, and the entry has to be choosable rather than assumed — the blank option means a check
     * no skill applies to at all.
     * @param {Actor} actor
     */
    static actorSkills(actor) {
        const skills = actor.items
            .filter(item => (item.type === "talent") && (item.system.subType === "skill"))
            // The prompt prints every row's DM in its own cell, so the option names the skill only.
            .map(item => ({ _id: item.id, name: item.getRollDisplay(false), term: item.name,
                dm: item.system.level }))
            .sort(MGT2Helper.compareByName);
        const notProficient = game.i18n.localize("MGT2.Items.NotProficient");
        return [{ _id: "NP", name: notProficient, term: notProficient, dm: -3 }, ...skills];
    }

    /**
     * Everything the prompt's answer contributes to one check: the dice, the characteristic, the
     * skill, the timeframe, the modifiers that were not waived, the chain, and the free DM — in
     * that order, because the card lists them in the order the formula reads them.
     *
     * `extra` slots in where a caller's own terms belong: after the waivable modifiers and before
     * the chain. That is where `#onRoll` puts Core p.74's attack modifiers and the weapon traits.
     *
     * @param {object} data              What `RollPromptHelper.roll` came back with
     * @param {Actor} actor              Whose characteristics and skills the prompt offered
     * @param {object[]} checkModifiers  The sources the prompt listed, with their `key`
     * @param {[string, number][]} extra
     * @returns {{formula: string, modifiers: string[], chainSources: object[]}}
     */
    static terms(data, actor, checkModifiers = [], extra = []) {
        const modifiers = [];
        const parts = [];
        if ( data.diceModifier ) {
            parts.push("3d6");
            parts.push(data.diceModifier);
        }
        else parts.push("2d6");

        if ( Object.hasOwn(data, "characteristic") && (data.characteristic !== "") ) {
            const dm = actor.system.characteristics[data.characteristic]?.dm ?? 0;
            parts.push(MGT2Helper.getFormulaDM(dm));
            modifiers.push(game.i18n.localize(`MGT2.Characteristics.${data.characteristic}.name`)
                + MGT2Helper.getDisplayDM(dm));
        }

        if ( Object.hasOwn(data, "skill") && (data.skill !== "") ) {
            if ( data.skill === "NP" ) {
                parts.push("-3");
                // The card has no DM column, so each name carries its own number like the others.
                modifiers.push(game.i18n.localize("MGT2.Items.NotProficient")
                    + MGT2Helper.getDisplayDM(-3));
            }
            else {
                const skillObj = actor.getEmbeddedDocument("Item", data.skill);
                if ( skillObj ) {
                    parts.push(MGT2Helper.getFormulaDM(skillObj.system.level));
                    modifiers.push(skillObj.getRollDisplay());
                }
            }
        }

        const timeframeDM = MGT2Helper.getTimeframeDM(data.timeframes);
        if ( timeframeDM !== 0 ) {
            modifiers.push(game.i18n.localize(`MGT2.Timeframes.${data.timeframes}`)
                + MGT2Helper.getDisplayDM(timeframeDM));
            parts.push(MGT2Helper.getFormulaDM(timeframeDM));
        }

        // The accumulator's own numbers, minus whatever the player waived in the prompt. Each keeps
        // its name so the card explains the total the same way the readout did.
        // FormDataExtended does not expand a dotted field name, so the prompt names each checkbox
        // `check-<key>` and it comes back flat.
        const rows = checkModifiers.filter(source => data[`check-${source.key}`] === true)
            .map(source => [MGT2Helper.modifierLabel(source), source.dm]);
        rows.push(...extra);

        // Core p.63: the Effect of a previous check is a DM on this one, and the working together
        // rule on the same page is that table read once per contributor. The sources are kept
        // whole, not just their ids: the card's strip names each one and links back to it.
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

        for ( const [name, dm] of rows ) {
            if ( dm !== 0 ) parts.push(MGT2Helper.getFormulaDM(dm));
            modifiers.push(dm === 0 ? name : name + MGT2Helper.getDisplayDM(dm));
        }

        if ( Object.hasOwn(data, "customDM") && (data.customDM !== "") ) {
            const typed = String(data.customDM).trim();
            if ( /^[0-9]/.test(typed) ) parts.push("+");
            parts.push(typed);
        }

        return { formula: parts.join(""), modifiers, chainSources };
    }

    /**
     * Core p.62: both sides roll as normal and the higher Effect wins; a draw is a standstill in
     * which neither gains an advantage. Nothing is modified — this is a comparison, and it runs
     * after the dice because that is when both numbers exist.
     * @returns {object|null}
     */
    static opposedResult(data, effect) {
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
     * Checks this one can be measured against: chained from (Core p.63) or opposed (Core p.62).
     * One list, because both rows read the same thing — an Effect a second roll can see, which is
     * the whole of what the `check` message sub-type exists for. Newest first and capped, because a
     * list long enough to scroll is one nobody reads.
     *
     * An **armed** source is exempt from the cap and comes first, already selected: the card asked
     * for it by name, and a source that had scrolled past the window would otherwise be unreachable
     * from here at all.
     */
    static #priorChecks(limit = 6) {
        const messages = game.messages?.contents ?? [];
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
                // The chain reads the rung; the opposed row reads the Effect itself, because
                // Core p.62 compares the two numbers and modifies neither.
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

    /* -------------------------------------------- */

    /**
     * RH folio 115's task ceiling as two sentences the readout picks between. The caption states a
     * standing fact about the roller, so both are built here and `#ceiling` decides which one the
     * check in the form is: the rule reaches INT, EDU and SOC alone, and taking longer lowers the
     * difficulty by one level, which can bring a task back inside.
     */
    static #ceilingContext(ceiling) {
        if (!ceiling?.target) return {};
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

    /* -------------------------------------------- */

    /**
     * Core folio 229's Reach row: the band the power is printed at, and the two a psion can push it
     * to — "increased by one Range Band if twice the PSI Cost is paid and increased by two Range
     * Bands if the PSI Cost is multiplied by four". Each cell names the band it buys and the points
     * it costs, so the choice is made against the reserve rather than against a multiplier.
     *
     * The printed reach is the first cell and the default. A power that states none has no row at
     * all — there is nothing to extend — and a band the table has no room past is not offered,
     * because the folio's ladder ends at Planetary.
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

    /* -------------------------------------------- */

    /**
     * What the Range block needs: the weapon's own Range score, the aiming ladder, the two
     * thresholds Core folio 77 names and — for a weapon with Auto — the fire mode. **The 100 m
     * threshold is checked**, because that is the rule; the 300 m cell and the empty one are the
     * concessions the folio and the referee grant, and Scope voids the whole row from its own chip.
     */
    static #rangeContext(weapon) {
        if (!weapon) return {};
        const range = weapon.system.range;
        const unit = range.unit ? game.i18n.localize(MGT2.MetricRange[range.unit]).toLowerCase() : "";
        const aimTerm = game.i18n.localize(MGT2.AttackModifiers.aiming.label);
        const auto = MGT2Helper.traitScore(weapon.system.traits, "auto");
        // Core folio 167: the to-hit half of the Damage Scale table. The weapon states one side of
        // the pair, so the cell offers the other one and nothing is read off a defender.
        const crossScale = MGT2.CrossScaleAttack[
            (weapon.system.scale === "spacecraft") ? "spacecraft" : "ground"];

        return {
            weapon: {
                range: range.value,
                unit,
                // Under the gutter word, so the band can be read against the score it came from.
                // A weapon with no Range score names no bands, and "0 m" would read like one.
                rangeLabel: range.value ? MGT2Helper.getRangeDisplay(range) : "",
                // Core folio 77 states the rule in metres, so a weapon ranged in kilometres is not offered it.
                thresholds: (range.unit === "kilometer") ? null
                    : Object.entries(MGT2.ExtremeRangeThresholds).map(([key, threshold]) => ({
                        metres: threshold.metres,
                        checked: key === "combat",
                        label: game.i18n.format(threshold.label, { metres: threshold.metres })
                    }))
            },
            metre: game.i18n.localize(MGT2.MetricRange.meter).toLowerCase(),
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

    /* -------------------------------------------- */

    /**
     * Wire the live readout and hang the dice each button rolls under its label. DialogV2 renders
     * a button label as text, so the sub-label has to be appended after the fact.
     */
    static #activate(root) {
        const form = root.querySelector("form");
        if ( !form ) return;

        const dice = {
            bane: "MGT2.RollPrompt.BaneDice",
            submit: "MGT2.RollPrompt.RollDice",
            boon: "MGT2.RollPrompt.BoonDice"
        };
        for ( const [action, key] of Object.entries(dice) ) {
            const button = form.querySelector(`button[data-action="${action}"]`);
            if ( !button || button.querySelector(".d") ) continue;
            const sub = document.createElement("span");
            sub.className = "d";
            sub.textContent = game.i18n.localize(key);
            button.append(sub);
        }

        // An offered trait tracks its own rule until the player touches it, and then stops: a box
        // that keeps re-deciding after being clicked is not an offer. Setting `checked` from code
        // fires no change event, so anything arriving here is the player's.
        for ( const box of form.querySelectorAll('input[data-auto="true"]') ) {
            box.addEventListener("change", () => { box.dataset.auto = "false"; });
        }

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

    /* -------------------------------------------- */

    /**
     * The Weapon traits block's live half: the conditions an offered trait watches, and the rows
     * one voids. Core p.79 rules Auto out of the same action as Scope or an aiming action, so an
     * unconditional suppressor is read first and a trait that depends on a row is judged against
     * what is left of it.
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

    /* -------------------------------------------- */

    /**
     * A modifier whose rule reaches only some checks follows the characteristic being rolled. Core
     * folio 98 puts the encumbered DM-2 on "physical actions" and folio 9 heads STR, DEX and END the
     * physical characteristics — no skill in this system carries such a flag and no book prints one,
     * so the characteristic is the printed answer.
     *
     * It stops deciding the moment the player touches the box, the same offer semantics an
     * offered trait has: a referee who calls a check physical says so by ticking it back.
     */
    static #scoped(form) {
        const chosen = form.elements.characteristic?.value ?? "";
        for ( const box of form.querySelectorAll("input[data-scope]") ) {
            if ( box.dataset.auto !== "true" ) continue;
            box.checked = box.dataset.scope.split(" ").includes(chosen);
        }
    }

    /* -------------------------------------------- */

    /**
     * Recompute the formula, the target and the Effect ladder from the form as it stands.
     */
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
        let total = 0;

        const suppressed = this.#traits(form);
        this.#scoped(form);

        // A DM source is either a select or a segmented radio group; both name a chosen node that
        // carries the DM, so the only difference is how the choice is read off. A select that
        // allows several contributes all of them — Core p.63's working together is the task chain
        // rules read once per contributor, not a second rule.
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
            // says the opposite of what it is doing. Name what is missing instead.
            const status = requires && form.querySelector(`[data-status="${box.name}"]`);
            if ( status ) {
                status.title = live ? game.i18n.localize("MGT2.RollPrompt.TraitOffered")
                    : game.i18n.format("MGT2.RollPrompt.TraitUnmet",
                        { requirement: game.i18n.localize(MGT2.AttackModifiers[requires]?.label ?? requires) });
            }
            // A chip is solid while it is in the roll and struck through while it is not. The chip
            // IS the control now, so it is the box's own label.
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

        for ( const [, dm] of terms ) total += dm;

        out("formula").textContent = total === 0
            ? game.i18n.localize("MGT2.RollPrompt.RollDice")
            : `${game.i18n.localize("MGT2.RollPrompt.RollDice")} ${sign(total)}`;

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

    /* -------------------------------------------- */

    /**
     * RH folio 115's ceiling against the check as it stands. Two things narrow it, and both are in
     * the form already: the rule reaches INT-, EDU- and SOC-based checks alone, and "performing a
     * task more slowly can lower difficulty by one level" — the eight rungs are two points apart, so
     * one level is exactly the DM+2 the slower timeframe already grants.
     *
     * **Stated, never enforced.** The same folio allows external modifiers to bring a task "to an
     * equivalent complexity within the capability of the robot's brain", which is a judgement no
     * dictionary here can make for the referee.
     */
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

    /* -------------------------------------------- */

    /**
     * Paint the range band the typed distance falls in and hand its DM back to the readout. The
     * distance is typed: nothing here reads the canvas, a target or a measurement.
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
        parts.push(["why", why]);
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
