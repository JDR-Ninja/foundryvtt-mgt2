import { Chargen } from "./chargen.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/**
 * The one rule that simplifies every roll character creation makes, and the one that is easiest to
 * get wrong (§9.40).
 *
 * **A creation roll is `2D + the named term's DM against a target, and nothing else`** (folio 11).
 * No DEX DM on a Gun Combat roll, nothing from the equipment chapter, nothing from a trait, nothing
 * from an Active Effect — only the DMs the creation rules themselves grant. So this composer exists
 * precisely so that the ledger does **not** reuse the play-time modifier stack: it never reads
 * `system.modifiers.check`, never asks `RollPromptHelper`, and never touches an Item's traits. Two
 * totalling engines would be a defect; two *modifier sets* is what the rules print.
 *
 * **The named term is a discriminated union.** Most rows are a characteristic — `INT 6+` is
 * `2D + INT DM` — but a few are skill checks, where `Gun Combat 8+` means `2D + your Gun Combat
 * level`. That is the only thing that varies; the exclusion above is unchanged either way.
 */
export const CreationRoll = {

    /**
     * Compose one creation check. The caller supplies what the book prints on that line; everything
     * else is read off the Traveller.
     *
     * @param {Actor} actor
     * @param {object} options
     * @param {string} [options.characteristic]  A `MGT2.Characteristics` key — the usual named term
     * @param {string} [options.skill]           A skill name, for the rows that are skill checks
     * @param {string} [options.check]           A `MGT2.TrayChecks` key, which is what a tray entry
     *                                           and a standing modifier are filtered by
     * @param {string} [options.career]          The career record or template id being played
     * @param {number|null} [options.target]     The printed target number
     * @param {[string, number][]} [options.rows]  Rows the printed line grants and nothing derives —
     *                                           `−1 per previous career`, an age DM, a species DM
     * @returns {{formula: string, rows: [string, number][], parts: string[], labels: string[],
     *           total: number, target: number|null, untrained: boolean}}
     */
    compose(actor, { characteristic = "", skill = "", check = "", career = "", target = null, rows = [] } = {}) {
        const composed = [];
        let untrained = false;

        if ( skill ) {
            const held = CreationRoll.skillLevel(actor, skill);
            // §9.56 item 2: a 2018 Mongoose staff answer says the untrained DM−3 applies during
            // creation and that characteristic DMs do not. An unverified 2026 claim reports the
            // opposite, so the sourced one wins — and this is the toggle most worth surfacing,
            // because an official clarification would flip a default touching every skill-named
            // check in the chapter.
            untrained = (held === null) && Rules.on("untrainedDMInCreation");
            composed.push([skill, untrained ? MGT2.Untrained.dm : (held ?? 0)]);
        }
        else if ( characteristic ) {
            composed.push([game.i18n.localize(MGT2.Characteristics[characteristic] ?? characteristic),
                actor?.system.characteristics?.[characteristic]?.dm ?? 0]);
        }

        composed.push(...rows.filter(row => row));
        composed.push(...CreationRoll.standing(actor, check, career));
        composed.push(...CreationRoll.tray(actor, check, career));

        const { parts, labels, total } = Checks.modifiers(composed);
        return {
            // `2d6` and not the books' `2D`: the parser reads none of the printed forms, which is
            // what `MGT2Helper.damageFormula` exists to normalise everywhere a page is transcribed.
            formula: ["2d6", ...parts].join(""),
            rows: composed, parts, labels, total, target, untrained
        };
    },

    /**
     * The level a Traveller holds in a named skill, or **null for not proficient at all** — which is
     * a different fact from level 0 and the only reason the untrained DM exists. A speciality answers
     * for its parent skill, which is what `matchesSkill` already settles for the play-time prompt.
     * @returns {number|null}
     */
    skillLevel(actor, skill) {
        let best = null;
        for ( const item of actor?.items ?? [] ) {
            if ( (item.type !== "talent") || (item.system.subType !== "skill") ) continue;
            if ( !MGT2Helper.matchesSkill(item.name, skill) ) continue;
            best = Math.max(best ?? 0, item.system.level ?? 0);
        }
        return best;
    },

    /**
     * The tray's DM entries bearing on this check (§9.51). Only `dm` entries add a number — an
     * `unlock`, a `careerBlock` or a `grant` changes what is *possible* rather than what is rolled,
     * and reading them here would silently add zero to a total that should never have seen them.
     * @returns {[string, number][]}
     */
    tray(actor, check, career) {
        if ( !check ) return [];
        return Chargen.pending(actor, check, career)
            .filter(entry => (entry.kind === "dm") && entry.dm)
            .map(entry => [entry.note || game.i18n.localize("MGT2.Chargen.Roll.Pending"), entry.dm]);
    },

    /**
     * §9.54's standing modifiers: the tray with its lifetime removed — permanent, per-Traveller,
     * career-scoped. A species' racial background, another's sex matrix and a third's per-career DMs
     * are all this and nothing more, and a blank `career` on the entry means every career.
     *
     * **Two sources, one shape.** The species frame declares them, and so does the career being
     * served: one printed career carries a standing footnote of its own — *"Travellers with FOL 10+
     * add +1 to their Benefit rolls"* — which is career-level rather than row-level and therefore
     * never reached the tray. A gate is read HERE and never stored, which is what lets it switch off
     * again when the characteristic falls.
     * @returns {[string, number][]}
     */
    standing(actor, check, career) {
        const frame = Chargen.frame(actor);
        const record = career ? actor?.items.get(career) : null;
        const rows = [];
        const sources = [[frame, frame?.system.frame.standingModifiers],
            [record, record?.system.standingModifiers]];
        for ( const [source, entries] of sources ) {
            for ( const entry of entries ?? [] ) {
                if ( !entry.dm ) continue;
                if ( check && entry.appliesTo.size && !entry.appliesTo.has(check) ) continue;
                if ( entry.career && career && (entry.career !== career) ) continue;
                if ( !CreationRoll.gated(actor, entry.gate) ) continue;
                rows.push([entry.note || source.name, entry.dm]);
            }
        }
        return rows;
    },

    /** A precondition over a characteristic, evaluated now: blank is ungated and passes. */
    gated(actor, gate) {
        if ( !gate?.characteristic || (gate.min === null) ) return true;
        return (actor?.system.characteristics?.[gate.characteristic]?.value ?? 0) >= gate.min;
    },

    /**
     * Roll a composed check and post it. The card is the system's one roll card, so a creation roll
     * reads back in the log exactly like every other — which is what makes an interrupted session
     * auditable and a failed Survival impossible to quietly re-roll after the fact (§9.38).
     *
     * @param {Actor} actor
     * @param {object} composed   What `compose` returned
     * @param {object} [options]
     * @param {string} [options.label]        What the card calls this check
     * @param {string} [options.difficulty]   A `MGT2.DifficultyTargets` key, where the line has one
     * @param {number|null} [options.target]  The bare number the creation line prints, where it has
     *                                        one — no rung expresses 5+, 7+ or 9+
     * @param {string[]} [options.lines]
     * @returns {Promise<{outcome: object, passed: boolean|null, message: ChatMessage}|null>}
     */
    async post(actor, composed, { label = "", difficulty = null, target = null, lines = [] } = {}) {
        // The number the BOOK printed, measured against directly: `Checks.resolve` takes a bare target
        // beside its difficulty rung precisely so a creation check scores its Effect against its own
        // line rather than against an assumed Average.
        const printed = Number.isFinite(target) ? target
            : (Number.isFinite(composed.target) ? composed.target : null);
        // **A table roll is not a task check**: an Events or Mishap roll indexes a row and has no
        // target, no verdict and no Effect. `Checks.resolve` assumes Average 8+ where neither a rung
        // nor a printed number is given — right for a play-time check made without a difficulty, and
        // wrong here, where it printed "Average failure · Effect -3" over a 1D table lookup. So the
        // untargeted case posts the plain card `Muster.roll` already uses.
        if ( (printed === null) && !difficulty ) return this.index(actor, composed, { label, lines });
        const outcome = await Checks.resolve({
            formula: composed.formula, rollData: actor?.getRollData() ?? {}, difficulty,
            target: printed });
        if ( !outcome ) return null;
        const message = await Checks.post(outcome, {
            actor, label,
            rollTypeName: game.i18n.localize("MGT2.Chargen.Roll.Title"),
            rollObjectName: label,
            difficulty,
            rollDifficultyLabel: (printed === null)
                ? "" : game.i18n.format("MGT2.Chargen.Term.Target", { n: printed }),
            modifiers: composed.labels,
            lines
        });
        const passed = (printed === null) ? null : (outcome.roll.total >= printed);
        return { outcome, passed, message };
    },

    /**
     * A table index, posted as dice and nothing else — same card shape as a Benefit roll. It returns
     * the same `{outcome, passed}` the caller reads, with `passed` null: what a row *means* is the
     * referee's table and never a verdict on the dice.
     */
    async index(actor, composed, { label = "", lines = [] } = {}) {
        const roll = await new Roll(composed.formula, actor?.getRollData() ?? {}).roll();
        const message = await ChatMessage.create({
            author: game.user.id,
            speaker: actor ? ChatMessage.getSpeaker({ actor }) : null,
            rolls: [roll],
            content: await renderRollCard({
                roll,
                rollTypeName: game.i18n.localize("MGT2.Chargen.Roll.Title"),
                rollObjectName: label,
                modifiers: composed.labels,
                lines
            })
        });
        return { outcome: { roll, effect: null, target: null, assumed: false }, passed: null, message };
    }
};

/* -------------------------------------------- */

/**
 * The Companion's optional creation rules, which are **session configuration and not per-actor
 * state** (§9.46): a table plays one way for everybody, and §9.38's "no session document" was about
 * session *state*, never about configuration. Six world settings, registered beside §9.56's sixteen
 * and printed with their folio, which is what separates a printed option from a house rule (§9.99).
 */
export const CreationOptions = {

    /** Every option at once, for a screen that states the table's terms before anyone rolls. */
    all() {
        return {
            ironMan: this.ironMan(),
            boonDice: Rules.get("creationBoonDice"),
            assignment: Rules.get("creationAssignment"),
            maximumTerms: this.maximumTerms(),
            pickedSkills: this.pickedSkills(),
            solo: this.solo()
        };
    },

    /**
     * A failed Survival **kills** the Traveller instead of causing a Mishap. It is the only option
     * that destroys work, so the rule the system attaches to it is stated here rather than in the
     * caller: under §9.38's write-as-you-go policy the killed Traveller's history is already on the
     * actor, so *"start again"* is the referee's decision about that document. **The system never
     * deletes it silently.**
     */
    ironMan() {
        return Rules.on("creationIronMan");
    },

    /** 0 is no cap, which is the printed game — the referee sets one before anyone starts. */
    maximumTerms() {
        return Rules.get("creationMaximumTerms") || 0;
    },

    /**
     * Skills are **picked** from the tables instead of rolled. The tables and the gates are unchanged;
     * only the die is removed, which is why the skill step reads this and nothing else does.
     */
    pickedSkills() {
        return Rules.on("creationSkillSelection");
    },

    /**
     * **The option that contradicts the thesis, and it earns its row by doing so** (§9.46). Solo
     * generation switches off the Connections Rule and both of §9.40's group-level closing steps,
     * degenerating the grid to a single column. A feature argued from "the group is the unit" should
     * name the option that removes the group.
     */
    solo() {
        return Rules.on("creationSolo");
    },

    /**
     * How many characteristics roll 3D and drop the lowest, and the dice they roll. `none` is the
     * printed game.
     * @returns {{count: number, formula: string}}
     */
    boon() {
        const picked = Rules.get("creationBoonDice");
        const count = { none: 0, two: 2, four: 4, all: Number.POSITIVE_INFINITY }[picked] ?? 0;
        return { count, formula: "3dckh2" };
    }
};
