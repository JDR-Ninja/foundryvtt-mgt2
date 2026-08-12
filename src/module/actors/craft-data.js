import { ActorBaseData, createCharacteristicField } from "./actor-base-data.js";

const fields = foundry.data.fields;

/** Severity runs 1–6; 0 is "this location has not been hit" (Core p.141). */
const MAX_SEVERITY = 6;

/** Core p.141: a further critical on a location already at 6 deals this instead of a seventh step. */
const OVERFLOW_DAMAGE = "6d6";

/**
 * What a vehicle and a spacecraft share: a hull that takes damage behind armour, a Tech Level, a
 * registry entry, and a critical track keyed by location. Everything else differs in **unit** — a
 * vehicle's crew is a count where a ship's is a roster of stations — so only the shape lives here.
 *
 * Abstract: never registered in `CONFIG.Actor.dataModels`.
 *
 * @extends {ActorBaseData}
 */
export class CraftData extends ActorBaseData {

    static DEFAULT_DAMAGE_ORDER = ["hull"];

    /**
     * The critical table this craft rolls on — `MGT2.VehicleCriticals` or `MGT2.ShipCriticals`. Its
     * keys are the locations `criticals` declares, so the subclass chooses both at once.
     */
    static CRITICALS = {};

    /** Core p.141, p.170: the ladder fires each time the wound passes another tenth of the hull. */
    static SUSTAINED_FRACTION = 0.1;

    static defineSchema() {
        const schema = super.defineSchema();
        const severity = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, max: MAX_SEVERITY, initial: 0 });

        Object.assign(schema, {
            // One pool for both craft. A vehicle's Hull is transcribed off the printed statblock and
            // is a genuine `base`; a ship's is computed from tonnage and lands in `auto` instead
            // (§4.2). Same field, two writers.
            characteristics: new fields.SchemaField({
                hull: createCharacteristicField(true)
            }),

            tl: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 12 }),

            // Severity per location, stored; what a severity *does* is a lookup in `CRITICALS`
            // (§1.11), which keeps the books' prose out of the document.
            criticals: new fields.SchemaField(Object.fromEntries(
                Object.keys(this.CRITICALS).map(location => [location, severity()]))),
            // Its own track rather than a tenth location: eight of the vehicle's cells and sixteen
            // of the ship's raise this instead of damaging the location that was hit.
            hullSeverity: severity(),

            registration: new fields.StringField({ required: false, blank: true, trim: true }),
            owner: new fields.StringField({ required: false, blank: true, trim: true }),
            description: new fields.HTMLField({ required: false, blank: true, trim: true })
        });
        return schema;
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /**
     * Core p.141, p.169: a hull at zero is wrecked and there is no state under it. The inherited
     * pair still derives — a single-link chain can never be `unconscious` — because the shared
     * header renders them.
     * @inheritDoc
     */
    get damageStates() {
        const hull = this.characteristics.hull;
        return { ...super.damageStates, wrecked: (hull.max > 0) && (hull.damage >= hull.max) };
    }

    /** Core p.141: Effect − 5, so Effect 6 is severity 1 and Effect 11+ is severity 6. */
    static severityFor(effect) {
        return Math.min(MAX_SEVERITY, Math.max(0, (Math.trunc(effect) || 0) - 5));
    }

    /**
     * How many sustained-damage thresholds a wound moving from `before` to `after` crossed. Core
     * p.141 asks for a Severity 1 critical at every tenth of starting Hull, and with the wound
     * stored that is a subtraction rather than a counter to keep in step (§1.2).
     */
    sustainedCrossings(before, after) {
        const step = this.constructor.SUSTAINED_FRACTION * this.characteristics.hull.max;
        if (!(step > 0)) return 0;
        return Math.floor(after / step) - Math.floor(before / step);
    }

    get sustainedCrossed() {
        return this.sustainedCrossings(0, this.characteristics.hull.damage);
    }

    /** The denominator the sheet prints beside the crossings. */
    get sustainedSteps() {
        return Math.round(1 / this.constructor.SUSTAINED_FRACTION);
    }

    /** The config cell a stored severity resolves to, or null where the location is untouched. */
    criticalEffect(location) {
        const severity = this.criticals?.[location] ?? 0;
        if (severity <= 0) return null;
        return this.constructor.CRITICALS[location]?.severities?.[severity - 1] ?? null;
    }

    /** Every location carrying a severity, worst first. */
    get criticalLocations() {
        return Object.entries(this.criticals ?? {})
            .filter(([, severity]) => severity > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([location]) => location);
    }

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /** @inheritDoc */
    prepareDerivedData() {
        super.prepareDerivedData();
        // The shared sheet reads `inventory.encumbrance` unconditionally, and a craft carries items
        // like anything else; the numbers are simply never a constraint here.
        this.inventory = { armor: 0, weight: 0, encumbrance: { normal: 0, heavy: 0 } };
        this.prepareArmor();
        this.prepareWeight();
        this.prepareEncumbrance();
    }

    /* -------------------------------------------- */
    /*  Rules                                       */
    /* -------------------------------------------- */

    /** Core p.141, p.170: critical damage ignores armour entirely. @inheritDoc */
    protectionAgainst(options = {}) {
        return options.ignoreArmour ? 0 : super.protectionAgainst(options);
    }

    /**
     * The wound, plus how many sustained-damage thresholds it crossed. The count is reported rather
     * than acted on: the location is a 2D roll the referee makes.
     * @inheritDoc
     */
    async applyDamage(amount, options = {}) {
        const before = this.characteristics.hull.damage;
        const result = await super.applyDamage(amount, options);
        // Through the document, because `Actor#update` re-initialises `system` and leaves this
        // instance behind: `this.characteristics` here would still hold the pre-update wound.
        if (result) {
            result.crossings = this.parent.system.sustainedCrossings(
                before, this.parent.system.characteristics.hull.damage);
        }
        return result;
    }

    /**
     * Core p.141: a repeat hit on a location takes `max(new, old + 1)` and caps at 6; a further
     * critical on a location already at 6 deals 6D extra damage instead, and that damage ignores
     * armour like every other critical.
     * @param {string} location   A key of this craft's `criticals`
     * @param {number} severity   1–6, normally `severityFor(effect)`
     * @returns {Promise<{location: string, severity: number, overflow: Roll|null}|null>}
     */
    async applyCritical(location, severity) {
        const current = this.criticals?.[location];
        if (current === undefined) return null;

        if (current >= MAX_SEVERITY) {
            const roll = await new Roll(OVERFLOW_DAMAGE).roll();
            await this.applyDamage(roll.total, { ignoreArmour: true });
            return { location, severity: current, overflow: roll };
        }

        const wanted = Math.min(MAX_SEVERITY, Math.max(1, Math.trunc(severity) || 0));
        const next = Math.min(MAX_SEVERITY, Math.max(wanted, current + 1));
        await this.parent.update({ [`system.criticals.${location}`]: next });
        return { location, severity: next, overflow: null };
    }
}
