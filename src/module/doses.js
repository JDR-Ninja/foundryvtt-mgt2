import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

/** What a dose leaves on the effect it creates, so the row can offer to end it (§9.90). */
export const DOSE_FLAG = "dose";

/**
 * A dose of a drug, which is a *consumption* and not a possession (§9.90).
 *
 * This is the whole of what `DOCUMENT-TYPES.md` §12 meant by "a drug is a timed effect": the drug
 * Item carries its Active Effects and they reach nobody while it is in a pocket — taking one copies
 * them onto the Traveller, with the printed duration read into a duration Foundry counts down. An
 * equipped/unequipped toggle would be the wrong shape, and it is the single most-repeated complaint
 * against `mgt2e`'s inventory.
 *
 * **Three moments and Foundry has one.** `sketch-consumables.html` is right that an Active Effect
 * models the middle band alone, so the other two are held here: an **onset** creates the effect
 * disabled and says so on the row, and an **after-effect** is a control, because Core p.115's
 * Metabolic Accelerator ends in 2D damage and "the effect expired" cannot run a damage pipeline by
 * itself. Nothing is scheduled either way (§9.35).
 */
export class Doses {

    /**
     * Take one dose of a drug. Everything it does is one of four writes and none of them is
     * reversible by re-running it, which is why the guards are refusals rather than clamps.
     * @param {Item} drug
     * @returns {Promise<ActiveEffect[]|null>}
     */
    static async take(drug) {
        const actor = drug?.actor;
        if ( (drug?.type !== "drug") || !actor ) return null;
        if ( !(drug.system.quantity > 0) ) {
            ui.notifications.warn(game.i18n.format("MGT2.Doses.None", { name: drug.name }));
            return null;
        }

        const onset = await Doses.interval(drug.system.onset);
        const duration = await Doses.interval(drug.system.duration);
        const effects = await Doses.#apply(drug, onset, duration);
        await drug.update({ "system.quantity": drug.system.quantity - 1 });
        const doses = await Doses.#count(actor, drug);
        await Doses.#card(drug, { onset, duration, doses });
        return effects;
    }

    /**
     * End a dose and run whatever the drug leaves behind. The effect is deleted either way: a dose
     * that has run out is not a dose that is suspended, and `disabled` already means the onset.
     * @param {ActiveEffect} effect
     */
    static async end(effect) {
        const dose = effect?.getFlag("mgt2", DOSE_FLAG);
        if ( !dose ) return null;
        const actor = (effect.parent?.documentName === "Actor") ? effect.parent : null;
        await effect.delete();
        if ( !actor || (dose.afterKind === "none") ) return null;

        // CSC p.93-97 writes an after-effect as either a condition or damage, and the two go down
        // different pipelines — which is exactly why `afterKind` is a stored discriminator and not
        // a reading of the text beside it.
        let damage = null;
        if ( dose.afterKind === "damage" ) {
            const formula = MGT2Helper.damageFormula(dose.afterEffect);
            if ( Roll.validate(formula) ) {
                damage = (await new Roll(formula).roll()).total;
                await actor.applyDamage(damage, { raw: true });
            }
        }
        return Doses.#afterCard(actor, dose, damage);
    }

    /** How many doses of this drug the Traveller has taken, or null where nothing counts them. */
    static countOf(actor, name) {
        if ( !Array.isArray(actor?.system.drugCounters) ) return null;
        return actor.system.drugCounters.find(row => row.drug === name)?.doses ?? null;
    }

    /* -------------------------------------------- */

    /**
     * A printed interval as a Foundry duration. The books write `10 minutes`, `three rounds` and
     * `1D hours`; the first and third parse, the second does not and is left as prose — a duration
     * nobody can count is better than a duration invented from a word.
     *
     * A dice expression is ROLLED HERE, once, when the dose is taken: `1D hours` is a length the
     * drug has on this occasion, not a length it always has.
     *
     * @param {string} text
     * @returns {Promise<{value: number, units: string}|null>}   v14's `{value, units}` pair
     */
    static async interval(text) {
        // The `D` has to sit against its count: with a space allowed, "2 days" reads as a `2d`
        // expression and loses its own unit to the dice.
        const match = /^\s*(\d+(?:[dD]\d*)?(?:\s*[+-]\s*\d+)?)\s*(\p{L}+)/u.exec(String(text ?? ""));
        if ( !match ) return null;
        const unit = Doses.#unit(match[2]);
        if ( !unit ) return null;
        const formula = MGT2Helper.damageFormula(match[1]);
        if ( !Roll.validate(formula) ) return null;
        const count = (await new Roll(formula).roll()).total;
        if ( !(count > 0) ) return null;
        return { value: count * unit.per, units: unit.unit };
    }

    /**
     * The unit a word names. Accents are stripped before the lookup so `journée` finds `journee`,
     * which is the only reason the table can list a French word in ASCII.
     */
    static #unit(word) {
        const key = word.toLocaleLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
        return Object.values(MGT2.DoseUnits).find(unit => unit.words.includes(key)) ?? null;
    }

    /* -------------------------------------------- */

    /**
     * The drug's own effects, copied onto the Traveller. A drug carrying none still produces one
     * marker: the dose is a fact of the session even when the referee applies its numbers by hand,
     * and without it there would be nothing to end and nothing to count down.
     */
    static async #apply(drug, onset, duration) {
        const dose = {
            drug: drug.name, item: drug.id,
            onset: drug.system.onset ?? "", printed: drug.system.duration ?? "",
            afterKind: drug.system.afterKind, afterEffect: drug.system.afterEffect ?? ""
        };
        const sources = drug.effects.contents.length ? drug.effects.contents : [null];
        const data = sources.map(effect => {
            const base = effect ? effect.toObject() : { name: drug.name, img: drug.img };
            delete base._id;
            // ASSIGNED, never merged. `ActiveEffect#toObject()` hands back a `duration` whose
            // `seconds` is a getter with no setter, so `mergeObject` recurses into it and throws
            // "Cannot set property seconds" — a v14 trap that fires only on a drug that carries an
            // effect of its own, which is the common case and not the edge one.
            base.transfer = false;                     // the copy belongs to the Traveller
            base.origin = drug.uuid;
            // Core p.115's Combat Drugs do nothing for three rounds. Disabled is the only state
            // Foundry has for "real but not yet", and the row says which of the two it is.
            base.disabled = Boolean(onset);
            // A printed duration nobody can read leaves whatever the effect's author set.
            if ( duration ) base.duration = { ...duration };
            base.flags = foundry.utils.mergeObject(base.flags ?? {}, { mgt2: { [DOSE_FLAG]: dose } });
            return base;
        });
        return CONFIG.ActiveEffect.documentClass.createDocuments(data, { parent: drug.actor });
    }

    /**
     * The counter this drug feeds, and the reason it lives on the Traveller: stims escalate per dose
     * taken without sleep between and anti-rad counts doses that day (Core p.115), so the count has
     * to survive the last dose being swallowed. Matched on the drug's NAME rather than on its id —
     * two boxes of the same drug are the same drug.
     */
    static async #count(actor, drug) {
        if ( !Array.isArray(actor.system.drugCounters) ) return null;
        const counters = actor.system.drugCounters.map(row => ({ ...row }));
        const row = counters.find(entry => entry.drug === drug.name);
        if ( row ) row.doses += 1;
        else counters.push({ drug: drug.name, doses: 1, resetOn: "never" });
        await actor.update({ "system.drugCounters": counters });
        return row?.doses ?? 1;
    }

    /* -------------------------------------------- */

    /** What a dose is, on the log: the three moments, and how many have been taken. */
    static async #card(drug, { onset, duration, doses }) {
        const lines = [];
        if ( drug.system.onset ) {
            lines.push(game.i18n.format("MGT2.Doses.OnsetLine", { onset: drug.system.onset }));
        }
        if ( drug.system.duration ) {
            lines.push(game.i18n.format("MGT2.Doses.DurationLine", { duration: drug.system.duration }));
        }
        if ( !duration && !onset ) lines.push(game.i18n.localize("MGT2.Doses.NoClock"));
        if ( drug.system.afterEffect ) {
            lines.push(game.i18n.format("MGT2.Doses.AfterLine", { after: drug.system.afterEffect }));
        }
        const escape = foundry.utils.escapeHTML;
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: drug.actor }),
            content: `<div class="mgt2 theme-light card dose">
                <div class="chd"><div class="what"><h4>${escape(drug.name)}</h4>
                    <span class="tgt">${escape(game.i18n.format("MGT2.Doses.Taken", { n: doses }))}</span>
                </div></div>
                <p class="dose-line">${lines.map(escape).join(" · ")}</p></div>`
        });
    }

    /** And what it left behind, which is the half no duration can carry. */
    static async #afterCard(actor, dose, damage) {
        const escape = foundry.utils.escapeHTML;
        const text = (damage === null)
            ? dose.afterEffect
            : game.i18n.format("MGT2.Doses.AfterDamage", { n: damage, formula: dose.afterEffect });
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="mgt2 theme-light card dose">
                <div class="chd"><div class="what"><h4>${escape(dose.drug)}</h4>
                    <span class="tgt">${escape(game.i18n.localize("MGT2.Doses.WoreOff"))}</span>
                </div></div>
                <p class="dose-line">${escape(text)}</p></div>`
        });
    }
}
