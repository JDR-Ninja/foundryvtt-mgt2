import { ChatHelper } from "./chatHelper.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const fields = foundry.data.fields;
const { RegionBehaviorType } = foundry.data.regionBehaviors;
const EVENTS = CONST.REGION_EVENTS;

/**
 * Environmental hazards as `RegionBehavior` sub-types — six Companion chapters of "while you are
 * *here*, this happens to you", which is what a Region is for.
 *
 * **Four handlers and no clock, and the emptiness between them is §9.35's decision rather than an
 * omission.** All seventeen `REGION_EVENTS` fire on movement or on a combat round and not one fires
 * because time passed, while MGT2 runs hazards per round, per minute, per 90 or 120 seconds and per
 * hour. Rather than invent a clock the system declined one outright: **it computes what a rule is
 * worth and never decides when it applies.** So a region states its band, its damage and its
 * interval; only the per-round interval is applied, because a `Combat` is already being advanced by
 * hand, and the referee applies the rest — a wrong automatic number is worse than an absent one,
 * because nobody checks it.
 *
 * What is built, and only this: `gravity`'s standing effect on `TOKEN_ENTER`, where `TOKEN_EXIT`
 * must **not** remove it (high gravity is DM−1 until acclimatised, 1D weeks, Core p.80) — Foundry's
 * own `applyActiveEffect` deletes on exit and is therefore not merely insufficient here but wrong;
 * `radiation`'s one-shot dose on `TOKEN_ENTER`; and the per-round rows of `temperature` and `vacuum`
 * on `TOKEN_ROUND_START`. Two traps wait there, both silent: every handler opens with
 * `if ( !event.user.isSelf ) return;` or it fires once per connected client
 * (`region.mjs:2528-2537` emits to everyone), and anything that awaits must call
 * `token.pauseMovement()` first, because a token can walk clear of the region before the `await`
 * resolves.
 */

/* -------------------------------------------- */

/**
 * A hazard row, rolled and taken through the pipeline. Raw, because Protection is what an *attack*
 * meets and a hot plain is not attacking anyone — Core p.82 puts temperature damage on the chain
 * from END, which is where the chain already starts.
 * @param {Actor} actor
 * @param {string} formula   The damage expression the referee typed
 * @param {string} label     An i18n key naming the row on the card
 * @param {string} [note]    An already-localised fragment placed before the damage
 */
async function applyHazard(actor, formula, label, note = "") {
    const expression = MGT2Helper.damageFormula(formula);
    if ( !expression ) return;
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

/* -------------------------------------------- */

/** Companion p.59-64. A standing modifier, and the one hazard that outlives leaving the region. */
export class GravityBehaviorData extends RegionBehaviorType {

    static LOCALIZATION_PREFIXES = ["MGT2.Region.gravity"];

    static defineSchema() {
        return {
            band: new fields.StringField({
                required: false, blank: false, initial: "standard", choices: MGT2.GravityBands }),
            // Where a world is unusually dense the printed figure wins over the band's nominal one.
            gees: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0 }),
            // Core p.81: in zero G, an Average (8+) Athletics (dexterity) check or the recoil spins
            // the shooter. A property of the region, not of the weapon.
            recoil: new fields.BooleanField({ required: false, initial: false })
        };
    }

    prepareDerivedData() {
        const band = MGT2.GravityBands[this.band] ?? MGT2.GravityBands.standard;
        this.dm = band.dm;
        this.physicalOnly = band.physicalOnly;
        this.effectiveGees = this.gees ?? band.gees;
        // Core p.80-81: 1D weeks, or 1D days with the matching Athletics. Never scheduled — it is why
        // the effect must survive TOKEN_EXIT rather than being removed with it.
        this.acclimatises = band.dm !== 0;
    }

    /**
     * Core p.80-81: DM−1 to every skill check on a high-gravity world, to the physical ones on a
     * low-gravity one. The effect is matched by its `origin` and by nothing else, which is what
     * keeps a second entry from stacking a second copy.
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
            // `modifiers.check`. Recorded so the scope is not lost while the DM is the whole answer.
            flags: { mgt2: { region: { band: this.band, physicalOnly: this.physicalOnly } } }
        };
    }

    /**
     * @param {RegionTokenEnterEvent} event
     * @this {GravityBehaviorData}
     */
    static async #onTokenEnter(event) {
        if ( !event.user.isSelf ) return;
        const { token, movement } = event.data;
        const actor = token.actor;
        // Standard gravity is the absence of the rule rather than a modifier of zero, and a sub-type
        // with no check accumulator — `world`, `stash` — has nothing for the change to land on.
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

/* -------------------------------------------- */

/** Companion p.83-84. Two intervals, and only one of them has an event behind it. */
export class TemperatureBehaviorData extends RegionBehaviorType {

    static LOCALIZATION_PREFIXES = ["MGT2.Region.temperature"];

    static defineSchema() {
        return {
            celsius: new fields.NumberField({ required: false, nullable: false, integer: true, initial: 20 }),
            damage: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            interval: new fields.StringField({
                required: false, blank: false, initial: "hour", choices: MGT2.HazardClocks }),
            // Gear that negates it outright — a vacc suit on a hot plain. Free text, because no book
            // prints a closed list and the referee names what their table is carrying.
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
        if ( this.protectedBy.size === 0 ) return false;
        const named = new Set([...this.protectedBy].map(gear => gear.toLowerCase()));
        // Only `armor` declares `equipped`; anything else counts as soon as it is on the sheet.
        return actor.items.some(item =>
            named.has(item.name.trim().toLowerCase()) && (item.system.equipped !== false));
    }

    /**
     * @param {RegionTokenRoundStartEvent} event
     * @this {TemperatureBehaviorData}
     */
    static async #onTokenRoundStart(event) {
        if ( !event.user.isSelf ) return;
        // §9.35 in one line: 50°C is 1D per *hour* and no event says an hour passed, so the row is a
        // readout and the referee applies it. Only `interval: round` may fire on its own.
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

/* -------------------------------------------- */

/** Companion p.65-71. Hard vacuum escalates a die per round; the thinner two do not. */
export class VacuumBehaviorData extends RegionBehaviorType {

    static LOCALIZATION_PREFIXES = ["MGT2.Region.vacuum"];

    static defineSchema() {
        return {
            pressure: new fields.StringField({
                required: false, blank: false, initial: "hard", choices: MGT2.VacuumPressures }),
            damage: new fields.StringField({ required: false, blank: true, trim: true, initial: "1D" }),
            // The suit's state and not the region's: a breach shifts the whole table rather than
            // adding a row to it, so it is declared here where the table is read.
            breach: new fields.StringField({
                required: false, blank: false, initial: "none", choices: MGT2.SuitBreaches })
        };
    }

    prepareDerivedData() {
        this.cumulative = MGT2.VacuumPressures[this.pressure]?.cumulative === true;
    }

    /** The token flag holding the round this exposure began. One segment, so it never needs a path. */
    get #counter() {
        return `vacuum-${this.behavior.id}`;
    }

    /**
     * Which round of this exposure the token is in. The round it started is stored rather than a
     * running count, so one write covers an exposure of any length.
     */
    async #exposureRound(token, round) {
        const first = token.getFlag("mgt2", this.#counter);
        if ( first === undefined ) {
            if ( token.isOwner ) await token.setFlag("mgt2", this.#counter, round);
            return 1;
        }
        return Math.max(1, round - first + 1);
    }

    /**
     * @param {RegionTokenRoundStartEvent} event
     * @this {VacuumBehaviorData}
     */
    static async #onTokenRoundStart(event) {
        if ( !event.user.isSelf ) return;
        // A skipped round is one the referee jumped over; the escalation still reads off the round
        // number, so landing on round 5 hits at round 5's severity and not four times over.
        if ( event.data.skipped || !this.damage ) return;

        const { token, round } = event.data;
        if ( !canBeHurt(token.actor) ) return;
        const exposure = await this.#exposureRound(token, round);
        // Core p.82: "a cumulative 1D damage every round" — 1D, then 2D, then 3D. The die *count*
        // grows, so multiplying the rolled total would be a different and smaller number.
        const formula = this.cumulative ? VacuumBehaviorData.#escalate(this.damage, exposure) : this.damage;
        return applyHazard(token.actor, formula,
            MGT2.VacuumPressures[this.pressure]?.label ?? "MGT2.Region.Hazard",
            game.i18n.format("MGT2.Region.Exposure", { round: exposure }));
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

/* -------------------------------------------- */

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

    /**
     * @param {RegionTokenEnterEvent} event
     * @this {RadiationBehaviorData}
     */
    static async #onTokenEnter(event) {
        if ( !event.user.isSelf ) return;
        const { token, movement } = event.data;
        const actor = token.actor;
        if ( !actor?.isOwner || !this.rads ) return;
        if ( typeof actor.system.applyRadiation !== "function" ) return;

        const resumeMovement = movement ? token.pauseMovement() : undefined;
        const roll = await new Roll(RadiationBehaviorData.#doseFormula(this.rads)).roll();
        // The region absorbs first; folio 100's armour Rad score comes off inside `resolveExposure`,
        // which is also where the two columns of folio 81 are read.
        const dose = roll.total - this.shielded;
        if ( dose > 0 ) await ChatHelper.resolveExposure(actor, { dose, roll });
        else {
            await ChatHelper.postRadiation(actor, game.i18n.format("MGT2.Region.Shielded",
                { rads: roll.total, shielded: this.shielded }), roll);
        }
        await resumeMovement?.();
    }

    /** The books print a dose as `2D×20`, and Foundry's parser only knows the ASCII operator. */
    static #doseFormula(rads) {
        return MGT2Helper.damageFormula(rads).replace(/[×x]/gi, "*");
    }

    static events = {
        [EVENTS.TOKEN_ENTER]: this.#onTokenEnter
    };
}
