import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { CreationRoll } from "./chargen-rolls.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const TRAINING_TRACK = "psionicTraining";

/**
 * Psionics in creation, which needs **no new machinery** — and checking that is the point of §9.43.
 *
 * The PSI test is an ordinary first roll into `base` with a DM read off the history; the two Core
 * openings are §9.51 tray entries differing only in **scope**; the Psion career is a `career`
 * template with three flags the generic loop already reads (`basicFrom: assignment`,
 * `assignmentChange: separateCareers`, and its qualification mode); and talents are the `talent`
 * Items that already ship. Nothing here is a new document, a new field or a new loop step.
 */
export const Psionics = {

    /**
     * `2D − the terms served so far` (folio 228), so PSI decays with every term and **when** a
     * Traveller tests is the whole decision. PSI 0 means no potential at all.
     *
     * One species tests at creation with **no term loss**, which is a parameter on its frame and not
     * a branch here (§9.42, §9.54).
     *
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

    /**
     * Roll PSI and write it. It is a **first** roll for a characteristic, so it writes `base` through
     * the one writer and leaves §9.39's log untouched (§9.43).
     *
     * The ceiling is §9.56 item 11: 15, like any characteristic — the general ceiling is printed and
     * nothing exempts PSI, and no species maximum is printed for anyone, so a frame that declares one
     * is the referee's own. Off, nothing binds the roll.
     */
    async rollPsi(actor) {
        const test = this.test(actor);
        const roll = await new Roll(test.formula).roll();
        const ceiling = this.ceiling(actor);
        const score = Math.max(0, ceiling === null ? roll.total : Math.min(roll.total, ceiling));
        await Grants.assignCharacteristics(actor, { psionic: score });
        await ChatMessage.create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            rolls: [roll],
            content: await renderRollCard({
                roll,
                rollTypeName: game.i18n.localize("MGT2.Chargen.Psi.Title"),
                rollObjectName: game.i18n.localize("MGT2.Characteristics.psionic.name"),
                lines: [game.i18n.format(score > 0 ? "MGT2.Chargen.Psi.Result" : "MGT2.Chargen.Psi.None",
                    { score, terms: test.terms })]
            })
        });
        return { roll, score, ...test };
    },

    /** §9.56 item 11. Null is no ceiling at all, which is what the rule switched off means. */
    ceiling(actor) {
        if ( !Rules.on("psiCeiling") ) return null;
        return Chargen.frame(actor)?.system.racialMaximum ?? MGT2.CreationDefaults.racialMaximum;
    },

    /**
     * Qualification for the psionic career: **PSI 6+ at DM−1 per previous career** (folio 236) —
     * against a PSI that was itself `2D − terms`. A screen showing both numbers live is doing
     * something no sheet does.
     *
     * The target and the DM come from the career TEMPLATE, not from here: this composes the roll the
     * template describes, which is why no career name reaches it (§9.47).
     */
    qualification(actor, template) {
        const previous = Chargen.careers(actor).length;
        return CreationRoll.compose(actor, {
            characteristic: template?.system.qualification.characteristics[0] ?? "psionic",
            check: "qualification",
            target: template?.system.difficulty ?? null,
            rows: previous
                ? [[game.i18n.localize("MGT2.Chargen.Roll.PreviousCareers"), -previous]] : []
        });
    },

    /* -------------------------------------------- */

    /**
     * Folio 228's training ladder, as rows a screen can draw: each talent, its learning DM, the
     * cumulative penalty for checks already attempted, and whether this Traveller already holds it.
     *
     * **Choosing Telepathy first is automatic with no roll**, so its row says so rather than
     * offering a check that cannot fail.
     *
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

    /**
     * How many learning checks this Traveller has made. **§9.56 item 13 resets it each training**:
     * the penalty is *per check attempted* within one session of it, and a lifetime counter would
     * make the second training — which the book prices at Cr100000 — pointless. With the rule off it
     * accumulates for good.
     *
     * The count lives on the ledger flag as a per-Traveller track, which is what that field is for
     * (§9.54). Training taken **in play** has no home for it yet, which is a real gap and not a
     * simplification: outside creation the flag does not exist.
     */
    attempts(actor) {
        return Chargen.read(actor).tracks[TRAINING_TRACK]?.value ?? 0;
    },

    /** Wipe the counter, which is what starting a fresh training means under §9.56 item 13. */
    async beginTraining(actor) {
        if ( !Rules.on("psionicTrainingReset") ) return actor;
        const tracks = foundry.utils.deepClone(Chargen.read(actor).tracks);
        tracks[TRAINING_TRACK] = { value: 0, rung: "", high: null };
        return Chargen.update(actor, { tracks });
    },

    /**
     * Attempt one talent. A PSI check against Average (8+) — the psionics chapter prints no
     * difficulty and folio 61 prints the rule for that case, so this is a citation and not a marked
     * ruling (§9.43). A learned talent arrives at **level 0**.
     *
     * @param {Actor} actor
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
            modifiers: composed.labels
        });

        const tracks = foundry.utils.deepClone(Chargen.read(actor).tracks);
        const spent = (tracks[TRAINING_TRACK]?.value ?? 0) + 1;
        tracks[TRAINING_TRACK] = { value: spent, rung: "", high: spent };
        await Chargen.update(actor, { tracks });

        return { free: false, passed, granted: passed ? await grant() : null, outcome };
    }
};
