import { ChatHelper } from "./chatHelper.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const fields = foundry.data.fields;
const { RegionBehaviorType } = foundry.data.regionBehaviors;
const EVENTS = CONST.REGION_EVENTS;

/**
 * Environmental hazards as `RegionBehavior` sub-types — six Companion chapters of "while you are
 * *here*, this happens to you", which is what a Region is for.
 * @param {string} formula   The damage expression the referee typed
 * @param {string} label     An i18n key naming the row on the card
 * @param {string} [note]    An already-localised fragment placed before the damage
 */

/** A hazard row, rolled and taken through the pipeline. */
async function applyHazard(actor, formula, label, note = "") {
    const expression = MGT2Helper.damageFormula(formula);
    if ( !expression || !Roll.validate(expression) ) return;
    const roll = await new Roll(expression).roll();
    if ( roll.total <= 0 ) return;

    await actor.applyDamage(roll.total, { raw: true });
    // The card carries the roll itself, so the message says only what the dice cannot.
    const parts = [note, game.i18n.format("MGT2.Region.Damage", { points: roll.total })];
    return ChatHelper.postRecovery(actor, label, parts.filter(part => part).join(" · "),
        roll, "MGT2.Region.Hazard");
}

/** Whether this actor is one an environmental row can reach at all. */
function canBeHurt(actor) {
    return (actor?.isOwner === true) && (typeof actor.system.applyDamage === "function");
}

/**
 * The gear the referee named as protection, as worn — the item and not a yes, because the vacuum
 * table reads a breach off the suit it finds.
 * @param {Set<string>} named   Gear names, as typed on the behaviour
 */
function protectingItem(named, actor) {
    if ( named.size === 0 ) return null;
    const wanted = new Set([...named].map(gear => gear.toLowerCase()));
    // Core p.82: a Traveller is protected by what they are wearing, never by what is in their
    // pack. `=== true` is also the type test — the skill and the suit share a name.
    return actor.items.find(item =>
        wanted.has(item.name.trim().toLowerCase()) && (item.system.equipped === true)) ?? null;
}

/** Companion p.59-64. A standing modifier, and the one hazard that outlives leaving the region. */
export class GravityBehaviorData extends RegionBehaviorType {

    static LOCALIZATION_PREFIXES = ["MGT2.Region.gravity"];

    static defineSchema() {
        return {
            band: new fields.StringField({
                required: false, blank: false, initial: "standard", choices: MGT2.GravityBands })
        };
    }

    prepareDerivedData() {
        const band = MGT2.GravityBands[this.band] ?? MGT2.GravityBands.standard;
        this.dm = band.dm;
        this.physicalOnly = band.physicalOnly;
    }

    /**
     * Core p.80-81: DM−1 to every skill check on a high-gravity world, to the physical ones on a
     * low-gravity one.
     */
    #effectData() {
        const scope = this.physicalOnly ? "PhysicalChecks" : "AllChecks";
        return {
            name: game.i18n.localize(MGT2.GravityBands[this.band]?.label ?? "MGT2.Region.Hazard"),
            img: "icons/svg/falling.svg",
            origin: this.behavior.uuid,
            description: game.i18n.format(`MGT2.Region.gravity.${scope}`,
                { dm: MGT2Helper.signed(this.dm) }),
            // Two silent failures in one line: v14 moved `changes` under `system`
            // (`common/data/active-effect.mjs:17`) and a top-level array is accepted and then never
            // applied, and the `final` phase would write the sink after `sumModifiers` has read it.
            system: {
                changes: [{
                    key: "system.modifiers.check.effect", type: "add", value: this.dm, phase: "initial"
                }]
            },
            // The low-gravity bands reach physical checks only, and no accumulator is narrower than
            // `modifiers.check`.
            flags: { mgt2: { region: { band: this.band, physicalOnly: this.physicalOnly } } }
        };
    }

    static async #onTokenEnter(event) {
        if ( !event.user.isSelf ) return;
        const { token, movement } = event.data;
        const actor = token.actor;
        // Standard gravity is the absence of the rule rather than a modifier of zero, and a
        // sub-type with no check accumulator — `world`, `stash` — has nothing for the change to
        // land on.
        if ( !actor?.isOwner || (this.dm === 0) || !actor.system.modifiers?.check ) return;
        if ( actor.effects.some(effect => effect.origin === this.behavior.uuid) ) return;

        const resumeMovement = movement ? token.pauseMovement() : undefined;
        await actor.createEmbeddedDocuments("ActiveEffect", [this.#effectData()]);
        await resumeMovement?.();
    }

    // No TOKEN_EXIT, deliberately: the DM lasts "until they acclimatise", 1D weeks (Core p.80), so
    // the effect outlives the boundary and only the referee ends it.
    static events = {
        [EVENTS.TOKEN_ENTER]: this.#onTokenEnter
    };
}

/** Companion p.83-84. Two intervals, and only one of them has an event behind it. */
export class TemperatureBehaviorData extends RegionBehaviorType {

    static LOCALIZATION_PREFIXES = ["MGT2.Region.temperature"];

    static defineSchema() {
        return {
            celsius: new fields.NumberField({ required: false, nullable: false, integer: true, initial: 20 }),
            damage: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            interval: new fields.StringField({
                required: false, blank: false, initial: "hour", choices: MGT2.HazardClocks }),
            // Gear that negates it outright — a vacc suit on a hot plain.
            protectedBy: new fields.SetField(
                new fields.StringField({ required: true, blank: false, trim: true }),
                { required: false, initial: [] })
        };
    }

    prepareDerivedData() {
        this.scheduled = MGT2.HazardClocks[this.interval]?.scheduled === true;
    }

    /** Whether this actor carries what the referee named as negating the row. */
    protects(actor) {
        return protectingItem(this.protectedBy, actor) !== null;
    }

    static async #onTokenRoundStart(event) {
        if ( !event.user.isSelf ) return;
        // 50°C is 1D per *hour* and no event says an hour passed, so the row is a readout the
        // referee applies.
        if ( !this.scheduled || event.data.skipped || !this.damage ) return;

        const actor = event.data.token.actor;
        if ( !canBeHurt(actor) || this.protects(actor) ) return;
        return applyHazard(actor, this.damage, "TYPES.RegionBehavior.temperature",
            game.i18n.format("MGT2.Region.Ambient", { celsius: this.celsius }));
    }

    static events = {
        [EVENTS.TOKEN_ROUND_START]: this.#onTokenRoundStart
    };
}

/**
 * Companion p.65-71. Two books print two vacuum systems and `vacuumRuleset` picks one: Core
 * escalates a die per round, the Companion reads a flat table off the state of the worn suit.
 */
export class VacuumBehaviorData extends RegionBehaviorType {

    static LOCALIZATION_PREFIXES = ["MGT2.Region.vacuum"];

    static defineSchema() {
        return {
            pressure: new fields.StringField({
                required: false, blank: false, initial: "hard", choices: MGT2.VacuumPressures }),
            damage: new fields.StringField({ required: false, blank: true, trim: true, initial: "1D" }),
            // Which worn item the Companion's table reads its breach off; Core never looks.
            protectedBy: new fields.SetField(
                new fields.StringField({ required: true, blank: false, trim: true }),
                { required: false, initial: [] })
        };
    }

    prepareDerivedData() {
        this.cumulative = MGT2.VacuumPressures[this.pressure]?.cumulative === true;
    }

    /** The token flag holding the round this exposure began. One segment, so it never needs a path. */
    get #counter() {
        return `vacuum-${this.behavior.id}`;
    }

    /** Which round of this exposure the token is in. */
    async #exposureRound(token, round) {
        const first = token.getFlag("mgt2", this.#counter);
        if ( first === undefined ) {
            if ( token.isOwner ) await token.setFlag("mgt2", this.#counter, round);
            return 1;
        }
        return Math.max(1, round - first + 1);
    }

    static async #onTokenRoundStart(event) {
        if ( !event.user.isSelf ) return;
        // A skipped round is one the referee jumped over; the escalation still reads off the round
        // number, so landing on round 5 hits at round 5's severity and not four times over.
        if ( event.data.skipped ) return;

        const { token, round } = event.data;
        if ( !canBeHurt(token.actor) ) return;
        // Read here and never derived: `refreshRuleUI` re-prepares actors, not scenes, so a flip
        // would leave a cached answer on the behaviour until the page reloads.
        return (Rules.get("vacuumRuleset") === "companion")
            ? this.#companionRound(token, round) : this.#coreRound(token, round);
    }

    /** The pressure's own free-text row, escalated where the pressure says to. */
    async #coreRound(token, round) {
        if ( !this.damage ) return;
        const exposure = await this.#exposureRound(token, round);
        // Core p.82: "a cumulative 1D damage every round" — 1D, then 2D, then 3D.
        const formula = this.cumulative ? VacuumBehaviorData.#escalate(this.damage, exposure) : this.damage;
        return applyHazard(token.actor, formula, this.#label(),
            game.i18n.format("MGT2.Region.Exposure", { round: exposure }));
    }

    /**
     * Companion p.67: a flat `[breach][pressure]` cell, where the row is the state of the suit this
     * region names as its protection and no such suit at all is the No Protection row.
     */
    async #companionRound(token, round) {
        const suit = protectingItem(this.protectedBy, token.actor);
        const breach = suit ? (suit.system.breach ?? "intact") : "none";
        // An unbreached sealed suit is complete protection, which is the whole point of wearing one.
        const row = MGT2.VacuumDamage[breach];
        if ( !row ) return;

        const exposure = await this.#exposureRound(token, round);
        const note = [game.i18n.format("MGT2.Region.Exposure", { round: exposure }),
            game.i18n.localize(row.label)].join(" · ");

        // The minimal column is an interval longer than a round, so it is stated once on the round
        // the exposure begins and never scheduled.
        const formula = row[this.pressure];
        if ( formula ) return applyHazard(token.actor, formula, this.#label(), note);
        if ( exposure > 1 ) return;
        const interval = game.i18n.format("MGT2.Region.Interval",
            { rule: game.i18n.localize(row.interval) });
        return ChatHelper.postRecovery(token.actor, this.#label(),
            [note, interval].join(" · "), null, "MGT2.Region.Hazard");
    }

    /** The card's title: which of the three pressures this region is. */
    #label() {
        return MGT2.VacuumPressures[this.pressure]?.label ?? "MGT2.Region.Hazard";
    }

    /** @param {RegionTokenExitEvent} event @this {VacuumBehaviorData} */
    static async #onTokenExit(event) {
        if ( !event.user.isSelf ) return;
        const { token, movement } = event.data;
        if ( !token.isOwner || (token.getFlag("mgt2", this.#counter) === undefined) ) return;

        const resumeMovement = movement ? token.pauseMovement() : undefined;
        await token.unsetFlag("mgt2", this.#counter);
        await resumeMovement?.();
    }

    /** Multiply every die count in the expression, which is what "cumulative 1D" means. */
    static #escalate(formula, rounds) {
        return MGT2Helper.damageFormula(formula)
            .replace(/(\d*)d(\d+)/gi, (match, count, faces) => `${(Number(count) || 1) * rounds}d${faces}`);
    }

    static events = {
        [EVENTS.TOKEN_ROUND_START]: this.#onTokenRoundStart,
        // Unlike gravity's, this exit handler resets a counter and removes nothing: the wound stays.
        [EVENTS.TOKEN_EXIT]: this.#onTokenExit
    };
}

/** Core p.82. One shot on entry, and the only kind that fits Foundry's model unchanged. */
export class RadiationBehaviorData extends RegionBehaviorType {

    static LOCALIZATION_PREFIXES = ["MGT2.Region.radiation"];

    static defineSchema() {
        return {
            // A formula, rolled on entry: the books print doses as dice, never as a fixed number.
            rads: new fields.StringField({ required: false, blank: true, trim: true, initial: "2D×20" }),
            // Rads the region itself absorbs, before folio 100's armour deduction on the Traveller.
            shielded: new fields.NumberField({
                required: false, nullable: false, min: 0, integer: true, initial: 0 })
        };
    }

    static async #onTokenEnter(event) {
        if ( !event.user.isSelf ) return;
        const { token, movement } = event.data;
        const actor = token.actor;
        if ( !actor?.isOwner || !this.rads ) return;
        if ( typeof actor.system.applyRadiation !== "function" ) return;

        // ⚠ Validated before the token is paused: `pauseMovement` holds the move until its resume
        // runs, and a throw between the two leaves the token stopped until the page reloads.
        const formula = RadiationBehaviorData.#doseFormula(this.rads);
        if ( !Roll.validate(formula) ) {
            return void ui.notifications.warn(
                game.i18n.format("MGT2.Region.BadDose", { dose: this.rads }));
        }

        const resumeMovement = movement ? token.pauseMovement() : undefined;
        try {
            const roll = await new Roll(formula).roll();
            // The region absorbs first; folio 100's armour Rad score comes off inside
            // `resolveExposure`, which is also where the two columns of folio 81 are read.
            const dose = roll.total - this.shielded;
            if ( dose > 0 ) await ChatHelper.resolveExposure(actor, { dose, roll });
            else {
                await ChatHelper.postRadiation(actor, MGT2Helper.plural("MGT2.Region.Shielded", roll.total,
                    { rads: roll.total, shielded: this.shielded }), roll);
            }
        }
        finally {
            await resumeMovement?.();
        }
    }

    /** The books print a dose as `2D×20`, and Foundry's parser only knows the ASCII operator. */
    static #doseFormula(rads) {
        return MGT2Helper.damageFormula(String(rads ?? "").replace(/(?<=[0-9Dd])\s*[×xX]\s*(?=\d)/g, "*"));
    }

    static events = {
        [EVENTS.TOKEN_ENTER]: this.#onTokenEnter
    };
}
