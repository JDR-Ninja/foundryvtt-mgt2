import { Psionics } from "./chargen-psionics.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Core p.228's two steps — testing, then training — behind one control. Which one it runs is read
 * off the Traveller, and the rule that the referee must permit PSI at all is the characteristic
 * being adopted in the world.
 */
export const CreationPsi = {

    /** "This characteristic cannot be rolled during Traveller creation without the referee's permission." */
    available() {
        return Rules.characteristic("psionic");
    },

    /**
     * Which of the two steps this Traveller is at.
     * @returns {{step: "test"|"train"|"none", score: number, tested: boolean, formula: string}}
     */
    state(actor) {
        const tested = Psionics.tested(actor);
        const score = actor?.system.characteristics.psionic?.base ?? 0;
        return {
            tested, score,
            step: !tested ? "test" : (score > 0 ? "train" : "none"),
            formula: MGT2Helper.showFormula(Psionics.test(actor).formula)
        };
    },

    /** The control. @returns {Promise<object|null>}   Null wherever the player stopped */
    async run(actor) {
        if ( !actor ) return null;
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        const state = this.state(actor);
        if ( state.step === "none" ) return null;
        if ( state.step === "train" ) return PsiTraining.open(actor);
        // A score standing on an untested Traveller was written by hand or by a frame, and the test
        // overwrites it.
        if ( state.score > 0 ) {
            const again = await DialogV2.confirm({
                window: { title: "MGT2.Chargen.Psi.Title" },
                classes: ["mgt2"],
                content: `<p>${game.i18n.format("MGT2.Chargen.Psi.Again",
                    { name: actor.name, score: state.score })}</p>`,
                rejectClose: false
            });
            if ( !again ) return null;
        }
        return Psionics.rollPsi(actor);
    }
};

/**
 * Folio 228's training ladder, drawn. A row per talent with the DM it would be attempted at, and
 * the course itself as a control, because four months and Cr100000 is not a side effect of looking.
 * @extends {ApplicationV2}
 */
class PsiTraining extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-psi-training",
        classes: ["mgt2"],
        position: { width: 460 },
        window: { icon: "fa-solid fa-brain", title: "MGT2.Chargen.Psi.Training" },
        actions: {
            learn: PsiTraining.#onLearn,
            beginCourse: PsiTraining.#onBeginCourse
        }
    };

    /** @inheritDoc */
    static PARTS = {
        body: { template: "systems/mgt2/templates/chargen/psi-training.html", scrollable: [""] }
    };

    /** @type {Actor|null} */
    #actor = null;

    static open(actor) {
        const window = foundry.applications.instances.get("mgt2-psi-training") ?? new PsiTraining();
        window.#actor = actor;
        return window.render({ force: true });
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.#actor;
        const ladder = Psionics.ladder(actor);
        const resets = Rules.on("psionicTrainingReset");
        const canEdit = actor?.canUserModify(game.user, "update") === true;
        Object.assign(context, {
            who: actor?.name ?? "",
            canEdit,
            score: actor?.system.characteristics.psionic?.base ?? 0,
            psiDM: MGT2Helper.signed(actor?.system.characteristics.psionic?.dm ?? 0),
            spent: MGT2Helper.plural("MGT2.Chargen.Psi.Spent", ladder.attempts, { n: ladder.attempts }),
            resets,
            // The rule off makes the counter a lifetime one, so a new course changes nothing and the
            // control says which rule made it inert rather than disappearing.
            courseWhy: game.i18n.localize(resets
                ? "MGT2.Chargen.Psi.NewCourseHint" : "MGT2.Chargen.Psi.Lifetime"),
            rows: ladder.rows.map(row => ({
                ...row,
                canAttempt: canEdit && !row.held,
                learn: MGT2Helper.signed(row.learningDM),
                attempt: MGT2Helper.signed(row.attemptDM),
                sum: MGT2Helper.signed(row.total),
                target: MGT2Helper.getDifficultyValue(MGT2.PsionicTraining.difficulty)
            }))
        });
        return context;
    }

    /** @this {PsiTraining} */
    static async #onLearn(event, target) {
        if ( !this.#actor?.canUserModify(game.user, "update") ) return;
        await Psionics.learn(this.#actor, target.closest("[data-talent]")?.dataset.talent);
        // Every row's DM moves with the attempt just spent, so the whole ladder is redrawn.
        return this.render();
    }

    /** @this {PsiTraining} */
    static async #onBeginCourse() {
        if ( !this.#actor?.canUserModify(game.user, "update") || !Rules.on("psionicTrainingReset") ) return;
        const confirmed = await DialogV2.confirm({
            window: { title: "MGT2.Chargen.Psi.NewCourse" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.Chargen.Psi.NewCourseAsk",
                { name: this.#actor.name })}</p>`,
            rejectClose: false
        });
        if ( !confirmed ) return;
        await Psionics.beginTraining(this.#actor);
        return this.render();
    }
}
