import { Chargen } from "./chargen.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/**
 * The one rule that simplifies every roll character creation makes, and the one that is easiest to
 * get wrong.
 */
export const CreationRoll = {

    /**
     * Compose one creation check.
     * @param {string} [options.characteristic]  A `MGT2.Characteristics` key — the usual named term
     * @param {string} [options.skill]           A skill name, for the rows that are skill checks
     * @param {string} [options.check]           A `MGT2.TrayChecks` key, which is what a tray entry
     *     and a standing modifier are filtered by
     * @param {string} [options.career]          The career record or template id being played
     * @param {number|null} [options.target]     The printed target number
     * @param {[string, number][]} [options.rows]  Rows the printed line grants and nothing derives
     *     — `−1 per previous career`, an age DM, a species DM
     * @returns {{formula: string, rows: [string, number][], parts: string[], labels: string[],
     *           total: number, target: number|null, untrained: boolean}}
     */
    compose(actor, { characteristic = "", skill = "", check = "", career = "", target = null, rows = [] } = {}) {
        const composed = [];
        let untrained = false;

        if ( skill ) {
            const held = CreationRoll.skillLevel(actor, skill);
            // A 2018 Mongoose staff answer says the untrained DM−3 applies during
            // creation and that characteristic DMs do not.
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
     * The level a Traveller holds in a named skill, or **null for not proficient at all** — which
     * is a different fact from level 0 and the only reason the untrained DM exists.
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

    /** The tray's DM entries bearing on this check. @returns {[string, number][]} */
    tray(actor, check, career) {
        if ( !check ) return [];
        return Chargen.pending(actor, check, career)
            .filter(entry => (entry.kind === "dm") && entry.dm)
            .map(entry => [entry.note || game.i18n.localize("MGT2.Chargen.Roll.Pending"), entry.dm]);
    },

    /**
     * The frame's standing modifiers: the tray with its lifetime removed — permanent,
     * per-Traveller, career-scoped.
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
                if ( check && entry.appliesTo.size && !entry.appliesTo.has(check) ) continue;
                if ( entry.career && career && (entry.career !== career) ) continue;
                if ( !CreationRoll.gated(actor, entry.gate) ) continue;
                const dm = entry.dm + (entry.per * CreationRoll.highestLevel(actor, entry.skills));
                if ( !dm ) continue;
                rows.push([entry.note || source.name, dm]);
            }
        }
        return rows;
    },

    /**
     * The highest level held among a named list of skills, and **0 for a Traveller who holds none**
     * — *"a Droyne **with any levels in** Black Skills suffers…"*, so not holding one is not a
     * penalty of zero, it is no penalty.
     * @returns {number}
     */
    highestLevel(actor, skills) {
        let best = 0;
        for ( const skill of skills ?? [] ) best = Math.max(best, CreationRoll.skillLevel(actor, skill) ?? 0);
        return best;
    },

    /** A precondition over a characteristic, evaluated now: blank is ungated and passes. */
    gated(actor, gate) {
        if ( !gate?.characteristic || (gate.min === null) ) return true;
        return (actor?.system.characteristics?.[gate.characteristic]?.value ?? 0) >= gate.min;
    },

    /**
     * Roll a composed check and post it.
     * @param {object} composed   What `compose` returned
     * @param {string} [options.label]        What the card calls this check
     * @param {string} [options.difficulty]   A `MGT2.DifficultyTargets` key, where the line has one
     * @param {number|null} [options.target]  The bare number the creation line prints, where it has
     *     one — no rung expresses 5+, 7+ or 9+
     * @returns {Promise<{outcome: object, passed: boolean|null, message: ChatMessage}|null>}
     */
    async post(actor, composed, { label = "", difficulty = null, target = null, lines = [] } = {}) {
        // The number the BOOK printed, measured against directly: `Checks.resolve` takes a bare
        // target beside its difficulty rung precisely so a creation check scores its Effect against
        // its own line rather than against an assumed Average.
        const printed = Number.isFinite(target) ? target
            : (Number.isFinite(composed.target) ? composed.target : null);
        // **A table roll is not a task check**: an Events or Mishap roll indexes a row and has no
        // target, no verdict and no Effect.
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

    /** A table index, posted as dice and nothing else — same card shape as a Benefit roll. */
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

/**
 * The Companion's optional creation rules, which are **session configuration and not per-actor
 * state**: a table plays one way for everybody, and having no session document was about session
 * STATE, never about configuration.
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

    /** A failed Survival **kills** the Traveller instead of causing a Mishap. */
    ironMan() {
        return Rules.on("creationIronMan");
    },

    /** 0 is no cap, which is the printed game — the referee sets one before anyone starts. */
    maximumTerms() {
        return Rules.get("creationMaximumTerms") || 0;
    },

    /** Skills are **picked** from the tables instead of rolled. */
    pickedSkills() {
        return Rules.on("creationSkillSelection");
    },

    /** **The option that contradicts the thesis, and it earns its row by doing so**. */
    solo() {
        return Rules.on("creationSolo");
    },

    /**
     * How many characteristics roll 3D and drop the lowest, and the dice they roll.
     * @returns {{count: number, formula: string}}
     */
    boon() {
        const picked = Rules.get("creationBoonDice");
        const count = { none: 0, two: 2, four: 4, all: Number.POSITIVE_INFINITY }[picked] ?? 0;
        return { count, formula: "3dckh2" };
    }
};
