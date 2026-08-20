import { ActorBaseData, createCharacteristicField } from "./actor-base-data.js";

const fields = foundry.data.fields;

/** Severity runs 1–6; 0 is "this location has not been hit" (Core p.140). */
const MAX_SEVERITY = 6;

/** Core p.140: a further critical on a location already at 6 deals this instead of a seventh step. */
const OVERFLOW_DAMAGE = "6d6";

/**
 * What a vehicle and a spacecraft share: a hull that takes damage behind armour, a Tech Level, a
 * registry entry, and a critical track keyed by location.
 * @extends {ActorBaseData}
 */
export class CraftData extends ActorBaseData {

    static DEFAULT_DAMAGE_ORDER = ["hull"];

    /** The critical table this craft rolls on — `MGT2.VehicleCriticals` or `MGT2.ShipCriticals`. */
    static CRITICALS = {};

    /** Core p.140, p.169: the ladder fires each time the wound passes another tenth of the hull. */
    static SUSTAINED_FRACTION = 0.1;

    /** What this craft is called once its hull is gone — the subclass owns the word. */
    static WRECKED_LABEL = "";

    /** Core p.98 weighs a Traveller; a hull's load is a tonnage budget. @inheritDoc */
    static ENCUMBRANCE_LINKS = [];

    static defineSchema() {
        const schema = super.defineSchema();
        const severity = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, max: MAX_SEVERITY, initial: 0 });

        Object.assign(schema, {
            // One pool for both craft.
            characteristics: new fields.SchemaField({
                hull: createCharacteristicField(true)
            }),

            tl: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 12 }),

            // Severity per location, stored; what a severity *does* is a lookup in `CRITICALS`
            //, which keeps the books' prose out of the document.
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

    /** Core p.140, p.168: a hull at zero is wrecked and there is no state under it. @inheritDoc */
    damageStatesFor(characteristics) {
        const hull = characteristics.hull;
        // The base's pair is a person's: over a one-link chain `dead` would mean `wrecked` and skull
        // the token. False rather than absent clears a stale icon.
        return { unconscious: false, dead: false,
            wrecked: (hull.max > 0) && (hull.damage >= hull.max) };
    }

    /** One word, and it is the craft's own. @inheritDoc */
    get damageStateLabels() {
        return { wrecked: this.constructor.WRECKED_LABEL };
    }

    /** Core p.140: Effect − 5, so Effect 6 is severity 1 and Effect 11+ is severity 6. */
    static severityFor(effect) {
        return Math.min(MAX_SEVERITY, Math.max(0, (Math.trunc(effect) || 0) - 5));
    }

    /** How many sustained-damage thresholds a wound moving from `before` to `after` crossed. */
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

    /** The wound, plus how many sustained-damage thresholds it crossed. @inheritDoc */
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
     * Core p.140: a repeat hit on a location takes `max(new, old + 1)` and caps at 6; a further
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

    /** Core p.140, p.169: a cell reading `+1` or `+1D`, capped like every other severity. */
    async raiseHullSeverity(amount) {
        const roll = Number.isInteger(amount)
            ? amount : (await new Roll(String(amount).replace(/D$/i, "d6")).roll()).total;
        const next = Math.min(MAX_SEVERITY, this.parent.system.hullSeverity + roll);
        return this.parent.update({ "system.hullSeverity": next });
    }
}
