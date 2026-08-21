import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { CraftData, MAX_SEVERITY } from "./craft-data.js";
import { createTraitsField } from "../traits.js";
import { Rules } from "../rules.js";

const fields = foundry.data.fields;

/** VH p.6: a Space given over to cargo carries 250 kg. Shipping is a different rate entirely. */
const CARGO_TONS_PER_SPACE = 0.25;

/** How far a printed Shipping may sit outside its band before the row reports, for rounding. */
const SHIPPING_SLACK = 0.05;

/** VH p.3: a vehicle costs half a per cent of its purchase price to keep running each month. */
const MAINTENANCE_RATE = 0.005;

/** Core p.143: one mounted weapon per ten points of Hull. */
const HULL_PER_WEAPON = 10;

/** VH p.24: an airship's gas envelope may not exceed a tenth of its Spaces. */
const ENVELOPE_FRACTION = 0.1;

/** Core folio 140: the dice a weapon must fall below for a vehicle's TL to count as extra armour. */
const LIGHT_WEAPON_DICE = 4;

const VH2026_COMBAT = "vehicle2026";

/** VH2026 p.6: Structure is a tenth of the Hull, rounded up. */
const STRUCTURE_DIVISOR = 10;

/** VH2026 p.7: Structure exceeded this many times over, cumulatively, and the vehicle is disabled. */
const DISABLED_AT = 10;

/**
 * Schema and behaviour of the `vehicle` Actor sub-type — the eleven printed statblock lines, the
 * six-line systems block, five armour facings and a critical track.
 * @extends {CraftData}
 */
export class VehicleData extends CraftData {

    static CRITICALS = MGT2.VehicleCriticals;

    static CRITICALS_2026 = MGT2.VehicleCriticals2026;

    /** Both books' locations, because a world setting cannot change a schema. @inheritDoc */
    static get CRITICAL_KEYS() {
        return [...new Set([...Object.keys(this.CRITICALS), ...Object.keys(this.CRITICALS_2026)])];
    }

    static WRECKED_LABEL = "MGT2.Actor.vehicle.Wrecked";

    /** The medium a vehicle with no chassis skill stored is assumed to be built for. */
    static DEFAULT_MODE = "ground";

    static defineSchema() {
        const schema = super.defineSchema();
        // The registry's `vehicle` family is nine flag traits and that is complete: the six lines
        // that look missing are the systems block below, not traits.
        schema.traits = createTraitsField("vehicle");

        const facing = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, initial: 0 });
        const band = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, max: 11, initial: 0 });

        Object.assign(schema, {
            // The chassis sets skill and speciality (VH p.14-33), and an array because a multi-mode
            // vehicle has more than one: the Peswab Marsh Hopper prints `Flyer (grav), Seafarer
            // (submarine)` (Aliens 3 p.266).
            skill: new fields.ArrayField(new fields.SchemaField({
                skill: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.VehicleSkills }),
                speciality: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.VehicleSpecialities })
            }), { initial: [] }),

            // Never printed, and four runtime rules read it: the detection DM per 25 Spaces, the
            // towing cost per 25 % towed, and the per-Space price of armour, camouflage and
            // stealth.
            spaces: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 0 }),

            // VH2026 p.7: how many times over this vehicle's Structure has been exceeded, summed
            // across every attack, and how many Hull criticals have halved the Structure itself.
            structureExceeded: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 0 }),
            structureHalvings: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 0 }),

            // Signed: 36 of the 78 Vehicle Handbook statblocks print a negative Agility.
            agility: new fields.NumberField({
                required: false, nullable: false, integer: true, initial: 0 }),
            operatingMode: new fields.StringField({
                required: false, blank: false, initial: "ground", choices: MGT2.OperatingModes }),
            // Orthogonal to the mode: a vehicle tows *while* it is on the ground (VH p.3).
            towing: new fields.BooleanField({ required: false, initial: false }),

            // Band numbers, not names: collision damage is 1D per band, Weave picks a negative DM
            // up to the current band, and an attack takes DM-1 per band of difference (Core
            // p.136-142).
            speed: new fields.SchemaField({ max: band(), cruise: band() }),

            range: new fields.SchemaField({
                max: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                cruise: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                // Five of the 78 print a service life instead of a distance (VH p.49).
                unit: new fields.StringField({
                    required: false, blank: false, initial: "km", choices: MGT2.RangeUnits })
            }),

            crew: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 1 }),
            passengers: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 0 }),
            cargo: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            shipping: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
            cost: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),

            armour: new fields.SchemaField({
                front: facing(), rear: facing(), sides: facing(),
                // Nullable and null by default.
                top: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, initial: null }),
                bottom: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, initial: null }),
                // A second number per facing that drops by 1 per hit and is destroyed outright by a
                // Destructive or spacecraft-scale weapon (VH p.51), so it is mutable in play.
                reactive: new fields.SchemaField({ front: facing(), rear: facing(), sides: facing() })
            }),

            // Six lines, six kinds of number (VH p.12).
            systems: new fields.SchemaField({
                autopilot: new fields.NumberField({ integer: true, min: 0, max: 3, nullable: true, initial: null }),
                comms: new fields.NumberField({ min: 0, nullable: true, initial: null }),
                navigation: new fields.NumberField({ integer: true, nullable: true, initial: null }),
                sensors: new fields.NumberField({ integer: true, nullable: true, initial: null }),
                // Both are a negative DM on the OBSERVER's roll, and they oppose different skills:
                // camouflage opposes Recon, stealth opposes Electronics (sensors) (VH p.54-55).
                camouflage: new fields.NumberField({ integer: true, max: 0, nullable: true, initial: null }),
                stealth: new fields.NumberField({ integer: true, max: 0, nullable: true, initial: null })
            }),

            // The mount belongs to the vehicle: it supplies the fire arc and the fire control, and
            // one mount can hold several weapons (VH p.37-38).
            mounts: new fields.ArrayField(new fields.SchemaField({
                type: new fields.StringField({
                    required: false, blank: false, initial: "fixed", choices: MGT2.VehicleMounts }),
                arc: new fields.StringField({
                    required: false, blank: false, initial: "front", choices: MGT2.FireArcs }),
                fireControl: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 0, max: 4, initial: 0 }),
                weapons: new fields.ArrayField(new fields.DocumentIdField(), { initial: [] })
            }), { initial: [] }),

            // Core folio 138: "the drivers of both vehicles make opposed skill checks using the
            // skill appropriate to their vehicle … modified by their vehicle's Agility as normal."
            // The check is a person's and the Agility is the vehicle's, so the vehicle has to know
            // who is at the controls — a UUID, the shape a ship's crew station already stores.
            driver: new fields.DocumentUUIDField({
                type: "Actor", embedded: false, required: false, nullable: true, initial: null }),

            // What Core folio 138's two vehicular actions leave standing.
            combat: new fields.SchemaField({
                // "The winner of a dogfight gains DM+2 to all their attack rolls for this round
                // while the loser suffers DM-2." Signed, and zero is "no dogfight standing".
                dogfight: new fields.NumberField({
                    required: false, nullable: false, integer: true, initial: 0 }),
                // "The winner of the previous dogfight applies the difference between that round's
                // opposed check as a positive DM to this round's opposed check."
                carry: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 0, initial: 0 }),
                // The Effect of the evasive check, kept as the Effect: the rule turns it into a
                // negative DM, and a failed check's Effect is negative and applies as it stands —
                // the same call Tactics makes, and for the same reason (no book caps it).
                evasive: new fields.NumberField({
                    required: false, nullable: false, integer: true, initial: 0 })
            }),

            // Submersibles, airships and drones are one type with two nullable sub-objects, not
            // sub-types: no behaviour differs at the type level.
            submersible: new fields.SchemaField({
                safeDepth: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                // "The depth to which they can go before being automatically destroyed" (VH p.23).
                crushDepth: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                lifeSupportDays: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 })
            }, { required: false, nullable: true, initial: null }),

            remote: new fields.SchemaField({
                interface: new fields.StringField({
                    required: false, blank: false, initial: "basic", choices: MGT2.RemoteInterfaces }),
                // Two ranges, not one: "it is perfectly possible for the drone to be within range
                // of control but be out of range to send any information back" (VH p.67).
                commsRange: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                telemetryRange: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 })
            }, { required: false, nullable: true, initial: null })
        });
        return schema;
    }

    /**
     * The media this chassis is built for, read off its skills rather than stored twice.
     * @type {Set<string>}
     */
    get nativeModes() {
        const modes = new Set();
        for (const pair of this.skill) {
            const mode = MGT2.VehicleNativeModes[pair.skill];
            if (mode) modes.add(mode);
        }
        return modes.size ? modes : new Set([VehicleData.DEFAULT_MODE]);
    }

    /**
     * Every penalty standing between the printed Agility and the one in play.
     * @type {Array<{label: string, dm: number}>}
     */
    get agilityPenalties() {
        const penalties = [];
        const mode = MGT2.OperatingModes[this.operatingMode];
        if (mode && !this.nativeModes.has(this.operatingMode)) {
            penalties.push({ label: mode.label, dm: mode.agility });
        }
        if (this.towing) penalties.push({ label: "MGT2.Actor.vehicle.Towing", dm: -2 });
        return penalties;
    }

    /** Core p.140: DM+1, and DM+1 per full 10 tons of Shipping, max DM+6; VH2026 p.5 uses Spaces. */
    get toHitBonus() {
        if (Rules.get("vehicleCombat") === VH2026_COMBAT) {
            return MGT2.VehicleTargetSize.find(row => this.spaces <= row.max).dm;
        }
        return Math.min(6, 1 + Math.floor(this.shipping / 10));
    }

    /** Whether the Vehicle Handbook 2026 procedures are the ones in force. */
    get runs2026() {
        return Rules.get("vehicleCombat") === VH2026_COMBAT;
    }

    /** VH2026 p.6: a tenth of the Hull, rounded up, halved again by each Hull critical that says so. */
    get structure() {
        const base = Math.ceil(this.characteristics.hull.max / STRUCTURE_DIVISOR);
        return Math.max(0, Math.floor(base / (2 ** this.structureHalvings)));
    }

    /** VH2026 p.6: how many times a wound past armour covers the Structure. Uncapped, unlike severity. */
    structureMultiple(wound) {
        const structure = this.structure;
        return (structure > 0) ? Math.floor(wound / structure) : 0;
    }

    /** `null`, or how far past disabled the accumulated exceedances have taken it (VH2026 p.7). */
    get structureState() {
        const times = this.structureExceeded;
        if (times >= DISABLED_AT * 4) return "obliterated";
        if (times >= DISABLED_AT * 2) return "brokenUp";
        return (times >= DISABLED_AT) ? "disabled" : null;
    }

    /** VH2026 p.7: what an Effect critical's weapon must be to affect a vehicle this large, or null. */
    get criticalImmunity() {
        if (!this.runs2026) return null;
        return MGT2.VehicleCriticalImmunity.find(row => this.spaces >= row.from)?.key ?? null;
    }

    /** The table in force, which decides both what a location does and which ones are rolled. */
    get criticalTable() {
        return this.runs2026 ? this.constructor.CRITICALS_2026 : this.constructor.CRITICALS;
    }

    /** @inheritDoc */
    criticalEffect(location) {
        const severity = this.criticals?.[location] ?? 0;
        if (severity <= 0) return null;
        return this.criticalTable[location]?.severities?.[severity - 1] ?? null;
    }

    /** VH2026 p.6: severity is not cumulative, so a repeat hit stands at the worse of the two. @inheritDoc */
    async applyCritical(location, severity) {
        if (!this.runs2026) return super.applyCritical(location, severity);
        const current = this.criticals?.[location];
        if (current === undefined) return null;
        const next = Math.min(MAX_SEVERITY, Math.max(1, Math.trunc(severity) || 0));
        if (next > current) await this.parent.update({ [`system.criticals.${location}`]: next });
        return { location, severity: Math.max(next, current), overflow: null };
    }

    /** VH2026 p.7: ten exceedances disable the vehicle, whatever the hull still reads. @inheritDoc */
    damageStatesFor(characteristics) {
        const states = super.damageStatesFor(characteristics);
        if (!this.runs2026) return states;
        return { ...states, wrecked: states.wrecked || (this.structureExceeded >= DISABLED_AT) };
    }

    /** Core p.143: one mounted weapon per ten points of Hull. */
    get weaponCap() {
        return Math.floor(this.characteristics.hull.max / HULL_PER_WEAPON);
    }

    /** How many weapons the mounts actually carry, against that cap. */
    get mountedWeapons() {
        return this.mounts.reduce((total, mount) => total + mount.weapons.length, 0);
    }

    /** Shipping per Space, widest span of its media, or null where no edition prints a rate. */
    get shippingBand() {
        // `hasOwn`, not `??`: the airship's entry IS null, which a nullish fallback would replace.
        const rates = this.skill.map(pair => Object.hasOwn(MGT2.VehicleShipping, pair.speciality)
            ? MGT2.VehicleShipping[pair.speciality] : MGT2.VehicleShipping.default);
        if (!rates.length) rates.push(MGT2.VehicleShipping.default);
        if (rates.includes(null)) return null;
        // Open Frame halves what the type ships at, and Open Vehicle is what records it (VH 2026 p.40).
        const open = MGT2Helper.hasTrait(this.traits, "open-vehicle") ? 0.5 : 1;
        return {
            nominal: Math.max(...rates.map(rate => rate.nominal)) * open,
            min: Math.min(...rates.map(rate => rate.min)) * open,
            max: Math.max(...rates.map(rate => rate.max))
        };
    }

    /**
     * Stored beside computed, for the lines the design system also produces.
     * @type {Array<{key: string, printed: number, derived: number, agrees: boolean}>}
     */
    get crossCheck() {
        if (!(this.spaces > 0)) return [];
        const capacity = this.spaces * CARGO_TONS_PER_SPACE;
        const perSpace = this.characteristics.hull.max / this.spaces;
        const band = this.shippingBand;
        const rows = [];
        // A rate per medium, and the two editions differ: the band decides, `derived` only shows.
        if (band) {
            rows.push({ key: "shipping", printed: this.shipping,
                derived: this.spaces * band.nominal,
                agrees: (this.shipping >= this.spaces * band.min * (1 - SHIPPING_SLACK))
                    && (this.shipping <= this.spaces * band.max * (1 + SHIPPING_SLACK)) });
        }
        rows.push(
            { key: "cargo", printed: this.cargo, derived: capacity, agrees: this.cargo <= capacity },
            { key: "hullPerSpace", printed: this.characteristics.hull.max,
                derived: Math.round(perSpace * 100) / 100,
                agrees: (perSpace >= 0.2) && (perSpace <= 4) });
        return rows;
    }

    /** Whoever is at the controls, or null. @type {Actor|null} */
    get driverActor() {
        if (!this.driver) return null;
        // fromUuidSync only answers for documents already loaded; a compendium driver degrades to
        // null rather than throwing, which is how the ship's roster reads its own stations.
        try { return foundry.utils.fromUuidSync(this.driver); } catch { return null; }
    }

    /** VH p.24: the gas envelope may not exceed a tenth of the Spaces. Airships only. */
    get gasEnvelope() {
        return this.skill.some(pair => pair.speciality === "airship")
            ? this.spaces * ENVELOPE_FRACTION : null;
    }

    /** @inheritDoc */
    prepareDerivedData() {
        super.prepareDerivedData();

        // Core p.140: the roof takes half the sides and the floor half the rear, and the two
        // fallbacks are asymmetric on purpose.
        const armour = this.armour;
        armour.effectiveRoof = armour.top ?? Math.floor(armour.sides / 2);
        armour.effectiveFloor = armour.bottom ?? Math.floor(armour.rear / 2);
        // Core folio 140: against a weapon under 4D or with Stun, every facing gains the vehicle's
        // TL.
        armour.vsLight = this.tl;

        this.agilityEffective = this.agilityPenalties
            .reduce((total, penalty) => total + penalty.dm, this.agility);

        this.criticalEffects = this.#foldCriticals();
        this.speed.effective = this.criticalEffects.speedZero
            ? 0 : Math.max(0, this.speed.max - this.criticalEffects.speedBands);

        this.#prepareCheckModifiers();
        this.sumModifiers();

        this.toHit = this.toHitBonus;
        this.maintenance = this.cost * MAINTENANCE_RATE;
        this.remoteControlDM = this.remote ? (MGT2.RemoteInterfaces[this.remote.interface]?.dm ?? 0) : null;
    }

    /**
     * The standing DMs that belong to an **attack made from this vehicle**, each a named source so
     * the prompt lists it and the referee can waive it.
     */
    #prepareCheckModifiers() {
        const sources = [];
        if (this.combat.dogfight !== 0) {
            sources.push({ key: "dogfight", label: "MGT2.Actor.vehicle.DogfightDM",
                dm: this.combat.dogfight });
        }
        if (this.combat.evasive !== 0) {
            sources.push({ key: "evasive", label: "MGT2.Actor.vehicle.EvasiveDM",
                dm: -this.combat.evasive });
        }
        this.modifiers.check.auto = sources.reduce((total, source) => total + source.dm, 0);
        this.modifiers.check.sources = sources;
    }

    /** The standing criticals as four numbers. */
    #foldCriticals() {
        const totals = { controlDM: 0, systemsDM: 0, speedBands: 0, speedZero: false };
        for (const location of this.criticalLocations) {
            const cell = this.criticalEffect(location);
            if (!cell) continue;
            totals.controlDM += Number.isInteger(cell.controlDM) ? cell.controlDM : 0;
            totals.systemsDM += Number.isInteger(cell.systemsDM) ? cell.systemsDM : 0;
            if (cell.speedBands === 0) totals.speedZero = true;
            else if (Number.isInteger(cell.speedBands)) totals.speedBands -= cell.speedBands;
        }
        return totals;
    }

    /** The five facings as one lookup, the two derived ones included. */
    armourAt(facing) {
        const armour = this.armour;
        switch (facing) {
            case "rear": return armour.rear;
            case "sides": case "left": case "right": return armour.sides;
            case "top": return armour.effectiveRoof;
            case "bottom": return armour.effectiveFloor;
            default: return armour.front;
        }
    }

    /** Reactive armour only exists on the three printed facings (VH p.51). */
    reactiveAt(facing) {
        const reactive = this.armour.reactive;
        switch (facing) {
            case "rear": return reactive.rear;
            case "sides": case "left": case "right": return reactive.sides;
            default: return facing === "front" ? reactive.front : 0;
        }
    }

    /**
     * Core folio 140: the wound is taken behind the armour of the facing the attack came from, and
     * with no facing named the front is the one that answers.
     * @inheritDoc
     */
    protectionAgainst(options = {}) {
        if (options.ignoreArmour) return 0;
        const facing = options.facing ?? "front";
        return this.armourAt(facing) + this.reactiveAt(facing) + this.lightWeaponArmour(options);
    }

    /**
     * Core folio 140: "against any weapon that has less than Damage 4D or has the Stun trait, a
     * vehicle will have an extra amount of armour equal to its TL on each facing." The dice are
     * counted off the attack's own expression, so a wound typed by hand or dragged onto a token bar
     * — which names no weapon and states no dice — earns nothing.
     * @param {object} options   `applyDamage`'s: `formula`, `stun`, `destructive`, `blast`, `effect`
     */
    lightWeaponArmour({ formula, stun, destructive, blast, effect } = {}) {
        if (Rules.get("vehicleCombat") === VH2026_COMBAT) {
            // The Critical Hit here is the Effect trigger: the damage trigger is computed from the
            // wound this armour produces, so reading it that way would be circular.
            if (destructive || (blast && (stun !== true))) return 0;
            return (this.constructor.severityFor(effect) > 0) ? 0 : this.armour.vsLight;
        }
        if (stun === true) return this.armour.vsLight;
        const dice = MGT2Helper.damageDice(formula);
        return ((dice > 0) && (dice < LIGHT_WEAPON_DICE)) ? this.armour.vsLight : 0;
    }

    /** CSC p.151: an ion weapon disrupts a vehicle's electronics; no book wounds its hull. @inheritDoc */
    async applyDamage(amount, options = {}) {
        if (options.ion && !options.raw && (amount > 0)) {
            return { wound: 0, rounds: 0, crossings: 0,
                disrupted: true, armour: this.armourAt(options.facing ?? "front") };
        }
        const result = await super.applyDamage(amount, options);
        if (!result || !this.runs2026) return result;
        // VH2026 p.6-7: the multiple is what raises a critical, and the running total is what
        // disables — the book counts seven exceedances from a wound whose severity caps at six.
        const multiple = this.structureMultiple(result.wound);
        if (multiple > 0) {
            result.structureMultiple = multiple;
            result.structureSeverity = Math.min(MAX_SEVERITY, multiple);
            result.structureExceeded = this.parent.system.structureExceeded + multiple;
            await this.parent.update({ "system.structureExceeded": result.structureExceeded });
        }
        return result;
    }

    /**
     * A vehicle is a thing on the map, not a person: several of the same model are dropped at once
     * and each takes its own damage, so its token is unlinked.
     * @inheritDoc
     */
    async _preCreate(data, options, user) {
        if (data.prototypeToken?.actorLink !== undefined) return;
        this.parent.updateSource({ prototypeToken: { actorLink: false } });
    }
}
