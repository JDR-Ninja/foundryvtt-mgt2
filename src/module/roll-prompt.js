import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

/** The average of 2D, and the roll the Effect ladder reads. */
const AVERAGE_2D = 7;

/** The strip spans this many bands either side of zero; anything beyond clamps onto the end. */
const LADDER_REACH = 6;

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
                // Built here so the timeframe DM has one home, shared with the roll path.
                timeframes: Object.entries(CONFIG.MGT2.Timeframes).map(([key, label]) => ({
                    key,
                    label: game.i18n.localize(label),
                    dm: MGT2Helper.getTimeframeDM(key)
                })),
                timeframeTerm: game.i18n.localize("MGT2.RollPrompt.Timeframes"),
                checkModifiers: (options.checkModifiers ?? []).map(source => ({
                    key: source.key,
                    label: MGT2Helper.modifierLabel(source),
                    dm: source.dm,
                    display: MGT2Helper.signed(source.dm)
                })),
                difficulty: options.difficulty,
                traits: MGT2Helper.weaponTraitRows(options.weapon, options.strengthDM),
                // Core p.75's table is headed "Common Modifiers to Ranged Attacks"; a melee weapon
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

        return DialogV2.wait({
            window: { title: options.rollTypeName || game.i18n.localize("MGT2.RollPrompt.Roll") },
            classes: ["mgt2", "mgt2-prompt"],
            position: { width: 440 },
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
    }

    /* -------------------------------------------- */

    /**
     * What the Range block needs: the weapon's own Range score, the aiming ladder and the two
     * thresholds Core p.78 names. The thresholds are offered and never picked — they hinge on the
     * Scope trait, which no weapon carries yet.
     */
    static #rangeContext(weapon) {
        if (!weapon) return {};
        const range = weapon.system.range;
        const unit = range.unit ? game.i18n.localize(MGT2.MetricRange[range.unit]).toLowerCase() : "";
        const aimTerm = game.i18n.localize(MGT2.AttackModifiers.aiming.label);

        return {
            weapon: {
                range: range.value,
                unit,
                // A weapon with no Range score names no bands, and "0 m" would read like one.
                name: [weapon.name, range.value ? MGT2Helper.getRangeDisplay(range) : null]
                    .filter(part => part).join(" · "),
                // Core p.78 states the rule in metres, so a weapon ranged in kilometres is not offered it.
                thresholds: (range.unit === "kilometer") ? null
                    : Object.values(MGT2.ExtremeRangeThresholds).map(threshold => ({
                        metres: threshold.metres,
                        label: game.i18n.format(threshold.label, { metres: threshold.metres })
                    }))
            },
            metre: game.i18n.localize(MGT2.MetricRange.meter).toLowerCase(),
            aiming: Array.fromRange(MGT2.AttackModifiers.aiming.max + 1).map(steps => ({
                value: steps,
                dm: steps * MGT2.AttackModifiers.aiming.dm,
                label: MGT2Helper.signed(steps * MGT2.AttackModifiers.aiming.dm, "—"),
                term: aimTerm
            }))
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

        const update = () => this.#readout(form);
        form.addEventListener("change", update);
        form.addEventListener("input", update);
        update();
    }

    /* -------------------------------------------- */

    /**
     * The Weapon traits block's live half: the conditions an offered trait watches, and the rows
     * one voids. Core p.80 rules Auto out of the same action as Scope or an aiming action, so an
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
            const status = form.querySelector(`[data-readout="${box.name}-status"]`);
            if ( status ) {
                status.textContent = game.i18n.localize(met
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

        for ( const select of form.querySelectorAll("select.dm-source") ) {
            const option = select.selectedOptions[0];
            const void_ = suppressed.has(select.name);
            const dm = void_ ? 0 : Number(option?.dataset.dm ?? 0);
            const row = select.closest(".drow");
            cell(row?.querySelector(".dm"), dm);
            row?.classList.toggle("voided", void_);
            if ( dm ) terms.push([option.dataset.term ?? option.textContent, dm]);
        }

        // Applied traits have no control of their own: the row is the readout's only input.
        for ( const node of form.querySelectorAll("[data-applied-dm]") ) {
            const dm = Number(node.dataset.appliedDm);
            if ( dm ) terms.push([node.dataset.term, dm]);
        }

        const band = this.#band(form, suppressed);
        if ( band?.dm ) terms.push([band.term, band.dm]);

        // Core p.75 buys a DM per full ten metres of target movement, not per metre.
        for ( const input of form.querySelectorAll("input[data-per]") ) {
            const steps = Math.floor(
                Math.max(0, MGT2Helper.getNumberFromInput(input.value)) / Number(input.dataset.per));
            const dm = steps * Number(input.dataset.dm);
            cell(out(input.name), dm);
            if ( dm ) terms.push([input.dataset.term, dm]);
        }

        for ( const box of form.querySelectorAll("input[type=checkbox][data-dm]") ) {
            // Core p.75: a laser sight is worth nothing to an attacker who is not aiming.
            const requires = box.dataset.requires;
            const live = !requires || (!suppressed.has(requires)
                && (MGT2Helper.getNumberFromInput(form.elements[requires]?.value) > 0));
            box.disabled = !live;
            box.closest("label")?.classList.toggle("disabled", !live);
            // A box the player cannot reach is not an offer, and "your call" beside a greyed control
            // says the opposite of what the row is doing. Name what is missing instead.
            const status = requires && form.querySelector(`[data-readout="${box.name}-status"]`);
            if ( status ) {
                status.textContent = live ? game.i18n.localize("MGT2.RollPrompt.TraitOffered")
                    : game.i18n.format("MGT2.RollPrompt.TraitUnmet",
                        { requirement: game.i18n.localize(MGT2.AttackModifiers[requires]?.label ?? requires) });
            }
            // A chip is solid while it is in the roll and struck through while it is not.
            const chip = box.closest(".traitrow")?.querySelector(".code");
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
     * Paint the range band the typed distance falls in and hand its DM back to the readout. The
     * distance is typed: nothing here reads the canvas, a target or a measurement.
     * @returns {{dm: number, term: string}|null}
     */
    static #band(form, suppressed = new Set()) {
        const node = form.querySelector('[data-readout="band"]');
        if ( !node ) return null;

        const unit = node.dataset.unit ?? "";
        // Core p.80: a scoped weapon aimed before shooting is not held to the 100 m rule.
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
