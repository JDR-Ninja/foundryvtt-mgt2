import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { CreationRoll } from "./chargen-rolls.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const TRAINING_TRACK = "psionicTraining";

// PSI 0 is a result and not an absence, and `base` reads 0 for both — so the test records itself.
const TEST_TRACK = "psionicTest";

/**
 * Psionics in creation, which needs **no new machinery** — and proving that is the point.
 * The PSI test is an ordinary first roll into `base` with a DM read off the history; the two Core
 * openings are tray entries differing only in **scope**; the Psion career is a `career`
 * template with three flags the generic loop already reads (`basicFrom: assignment`,
 * `assignmentChange: separateCareers`, and its qualification mode); and talents are the `talent`
 * Items that already ship.
 */
export const Psionics = {

    /**
     * `2D − the terms served so far` (folio 228), so PSI decays with every term and **when** a
     * Traveller tests is the whole decision.
     * @returns {{formula: string, terms: number, penalty: number, exempt: boolean}}
     */
    test(actor) {
        const exempt = Chargen.frame(actor)?.system.psiWithoutTermPenalty === true;
        const terms = Chargen.termsServed(actor);
        const penalty = exempt ? 0 : -terms;
        return {
            formula: MGT2Helper.damageFormula(MGT2.PsionicTraining.formula)
                + (penalty ? MGT2Helper.getFormulaDM(penalty) : ""),
            terms, penalty, exempt
        };
    },

    /** Roll PSI and write it. */
    async rollPsi(actor) {
        const test = this.test(actor);
        const roll = await new Roll(test.formula).roll();
        const ceiling = this.ceiling(actor);
        const score = Math.max(0, ceiling === null ? roll.total : Math.min(roll.total, ceiling));
        await Grants.assignCharacteristics(actor, { psionic: score });
        // Outside creation there is no ledger to write, and `Chargen.update` would open one.
        if ( Chargen.isInCreation(actor) ) {
            const tracks = foundry.utils.deepClone(Chargen.read(actor).tracks);
            const taken = (tracks[TEST_TRACK]?.value ?? 0) + 1;
            tracks[TEST_TRACK] = { value: taken, rung: "", high: taken };
            await Chargen.update(actor, { tracks });
        }
        await ChatMessage.create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            rolls: [roll],
            content: await renderRollCard({
                roll,
                rollTypeName: game.i18n.localize("MGT2.Chargen.Psi.Title"),
                rollObjectName: game.i18n.localize("MGT2.Characteristics.psionic.name"),
                lines: [MGT2Helper.plural(score > 0 ? "MGT2.Chargen.Psi.Result" : "MGT2.Chargen.Psi.None",
                    test.terms, { score, terms: test.terms })]
            })
        });
        return { roll, score, ...test };
    },

    /** Null is no ceiling at all, which is what the rule switched off means. */
    ceiling(actor) {
        if ( !Rules.on("psiCeiling") ) return null;
        return Chargen.frame(actor)?.system.racialMaximum ?? MGT2.CreationDefaults.racialMaximum;
    },

    /**
     * Folio 228's training ladder, as rows a screen can draw: each talent, its learning DM, the
     * cumulative penalty for checks already attempted, and whether this Traveller already holds it.
     * @returns {{attempts: number, rows: object[]}}
     */
    ladder(actor) {
        const attempts = this.attempts(actor);
        const psiDM = actor?.system.characteristics?.psionic?.dm ?? 0;
        const held = Grants.skills(actor);
        const anyHeld = MGT2.PsionicTraining.talents.some(talent =>
            held.some(skill => talent.skills.some(name => MGT2Helper.matchesSkill(skill.name, name))));
        return {
            attempts,
            rows: MGT2.PsionicTraining.talents.map(talent => {
                const already = held.some(skill =>
                    talent.skills.some(name => MGT2Helper.matchesSkill(skill.name, name)));
                return {
                    key: talent.key,
                    name: talent.skills[0],
                    learningDM: talent.dm,
                    attemptDM: attempts * MGT2.PsionicTraining.perAttempt,
                    total: psiDM + talent.dm + (attempts * MGT2.PsionicTraining.perAttempt),
                    held: already,
                    free: (talent.key === MGT2.PsionicTraining.freeFirst) && !already && !anyHeld
                };
            })
        };
    },

    /** How many learning checks this Traveller has made. */
    attempts(actor) {
        return Chargen.read(actor).tracks[TRAINING_TRACK]?.value ?? 0;
    },

    /** Whether the test has been taken, which is the one thing a PSI of 0 cannot say for itself. */
    tested(actor) {
        return (Chargen.read(actor).tracks[TEST_TRACK]?.value ?? 0) > 0;
    },

    /** Wipe the counter, which is what starting a fresh course of training means. */
    async beginTraining(actor) {
        if ( !Rules.on("psionicTrainingReset") ) return actor;
        const tracks = foundry.utils.deepClone(Chargen.read(actor).tracks);
        tracks[TRAINING_TRACK] = { value: 0, rung: "", high: null };
        return Chargen.update(actor, { tracks });
    },

    /**
     * Attempt one talent.
     * @param {string} key   A `MGT2.PsionicTraining.talents` key
     */
    async learn(actor, key) {
        const talent = MGT2.PsionicTraining.talents.find(row => row.key === key);
        if ( !talent ) return null;
        const row = this.ladder(actor).rows.find(entry => entry.key === key);
        if ( row?.held ) return null;

        const grant = () => Grants.grantSkill(actor, { name: talent.skills[0],
            level: MGT2.PsionicTraining.level, mode: "atLeast",
            provenance: { table: "psionicTraining" } });

        // Automatic, no roll, and no attempt spent — the free first talent is not a check.
        if ( row?.free ) return { free: true, passed: true, granted: await grant() };

        const composed = CreationRoll.compose(actor, {
            characteristic: "psionic",
            rows: [[talent.skills[0], talent.dm],
                [game.i18n.localize("MGT2.Chargen.Psi.Attempts"), row.attemptDM]]
        });
        const outcome = await Checks.resolve({
            formula: composed.formula, difficulty: MGT2.PsionicTraining.difficulty });
        if ( !outcome ) return null;
        const passed = outcome.effect >= 0;
        await Checks.post(outcome, {
            actor,
            label: talent.skills[0],
            rollTypeName: game.i18n.localize("MGT2.Chargen.Psi.Training"),
            rollObjectName: talent.skills[0],
            difficulty: MGT2.PsionicTraining.difficulty,
            modifiers: composed.terms
        });

        // Outside creation there is no ledger to write, and `Chargen.update` would open one.
        if ( Chargen.isInCreation(actor) ) {
            const tracks = foundry.utils.deepClone(Chargen.read(actor).tracks);
            const spent = (tracks[TRAINING_TRACK]?.value ?? 0) + 1;
            tracks[TRAINING_TRACK] = { value: spent, rung: "", high: spent };
            await Chargen.update(actor, { tracks });
        }

        return { free: false, passed, granted: passed ? await grant() : null, outcome };
    }
};
