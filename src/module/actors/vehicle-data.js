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

/** What the 2017 edition calls a face, and the 2026 face it is (VH2026 p.56). */
const FACING_ALIAS = Object.freeze({ front: "forward", rear: "aft", sides: "port", left: "port",
    right: "starboard", top: "dorsal", bottom: "ventral" });

/** VH2026 p.6: Structure is a tenth of the Hull, rounded up. */
const STRUCTURE_DIVISOR = 10;

/** VH2026 p.7: Structure exceeded this many times over, cumulatively, and the vehicle is disabled. */
const DISABLED_AT = 10;

/** VH2026 p.11: Cr500 × Structure × Severity to repair a critical, Cr1000 per point of Structure. */
const REPAIR_PER_SEVERITY = 500;
const REPAIR_PER_STRUCTURE = 1000;

/** VH2026 p.19: how many points of negative Agility a round of Minor Actions can cancel. */
const MINOR_ACTION_CANCEL = 3;

/**
 * Schema and behaviour of the `vehicle` Actor sub-type — the eleven printed statblock lines, the
 * six-line systems block, six armour facings and a critical track.
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

    /**
     * The three printed faces became six. sides feeds both beams, and the two the old schema left
     * null take the halves it used to infer, so nothing a vehicle already read changes.
     * @inheritDoc
     */
    static migrateData(source, options) {
        const armour = source.armour;
        if ( armour && (armour.forward === undefined) && (armour.front !== undefined) ) {
            armour.forward = armour.front;
            armour.aft = armour.rear;
            armour.port = armour.starboard = armour.sides;
            // A 2017 record that named a roof or a floor keeps that number; one that named neither
            // says nothing and folio 140 answers at read time. Baking the halves in here would make
            // a stated 5 and an inferred 5 the same record for ever.
            armour.dorsal = armour.top ?? null;
            armour.ventral = armour.bottom ?? null;
            const reactive = armour.reactive;
            if ( reactive && (reactive.forward === undefined) ) {
                reactive.forward = reactive.front;
                reactive.aft = reactive.rear;
                reactive.port = reactive.starboard = reactive.sides;
            }
        }
        return super.migrateData(source, options);
    }

    static defineSchema() {
        const schema = super.defineSchema();
        // The registry's `vehicle` family is nine flag traits and that is complete: the six lines
        // that look missing are the systems block below, not traits.
        schema.traits = createTraitsField("vehicle");

        const facing = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, initial: 0 });
        // Core folio 140 lets the roof and the floor go unstated, so those two need a value that
        // MEANS unstated: `null` is the book's "unless otherwise stated" and a number is a
        // statement — 0 among them, which an `initial: 0` could never tell from silence.
        const inferable = () => new fields.NumberField({
            required: false, nullable: true, integer: true, min: 0, initial: null });
        const band = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, max: 11, initial: 0 });
        const worldDigit = () => new fields.NumberField({
            required: false, nullable: true, integer: true, min: 0, max: 15, initial: null });

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

            // VH2026 p.5 prints it on the TYPE line, where the 2017 statblock never did, and four
            // runtime rules read it: the target-size DM, the towing cost per 25 % towed, and the
            // per-Space price of armour, camouflage and stealth.
            spaces: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 0 }),

            // VH2026 p.7: how many times over this vehicle's Structure has been exceeded, summed
            // across every attack, and how many Hull criticals have halved the Structure itself.
            // Null derives it from the Hull; a 2026 statblock prints STRUCTURE and no HULL at all,
            // so the printed figure is what a vehicle written from one carries (VH2026 p.6).
            structurePrinted: new fields.NumberField({
                required: false, nullable: true, integer: true, min: 1, initial: null }),
            comfort: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.ComfortLevels }),
            terrain: new fields.StringField({
                required: false, blank: false, initial: "clear", choices: MGT2.VehicleTerrain }),
            smartWheels: new fields.BooleanField({ required: false, initial: false }),
            // The design feature, stored because the G-force limit names it and no trait records it
            // (VH2026 p.36).
            agile: new fields.BooleanField({ required: false, initial: false }),

            // VH2026 p.20-22: an aircraft is built for one Atmosphere and one world Size and pays
            // for every step it flies away from them. `design` is what it was built for, and
            // `environment` is where the referee has put it. Null on either side reads nothing.
            design: new fields.SchemaField({ atmosphere: worldDigit(), size: worldDigit() }),
            environment: new fields.SchemaField({ atmosphere: worldDigit(), size: worldDigit() }),

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

            // VH2026 p.56: six faces, every one printed and every one stored. The 2017 edition's
            // three arrive through migrateData, which is what keeps a packed vehicle readable.
            armour: new fields.SchemaField({
                forward: facing(), aft: facing(), port: facing(), starboard: facing(),
                dorsal: inferable(), ventral: inferable(),
                // A second number per face that drops by 1 per hit and is destroyed outright by a
                // Destructive or spacecraft-scale weapon (VH p.51), so it is mutable in play.
                reactive: new fields.SchemaField({
                    forward: facing(), aft: facing(), port: facing(), starboard: facing(),
                    dorsal: facing(), ventral: facing() })
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
        const terrain = this.terrainEffect;
        if (terrain.dm) {
            penalties.push({ label: MGT2.VehicleTerrain[terrain.key]?.label ?? "", dm: terrain.dm });
        }
        const air = this.airborne;
        if (air?.agility) penalties.push({ label: "MGT2.Actor.vehicle.Atmosphere", dm: air.agility });
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

    /** VH2026 p.6: the printed figure, or a tenth of the Hull rounded up, before a critical halves it. */
    get structureBase() {
        return this.structurePrinted ?? Math.ceil(this.characteristics.hull.max / STRUCTURE_DIVISOR);
    }

    /** The Comfort Level a 2026 statblock prints, with the effect VH2026 p.24 hangs on it. */
    get comfortLevel() {
        const level = MGT2.ComfortLevels[this.comfort];
        return level ? { key: this.comfort, label: level.label, effect: level.effect } : null;
    }

    /** What the Structure stands at now, halved again per Hull critical that said so. */
    get structure() {
        return Math.max(0, Math.floor(this.structureBase / (2 ** this.structureHalvings)));
    }

    /** VH2026 p.11: what putting this vehicle right costs and takes, per standing critical. */
    get repairs() {
        if (!this.runs2026) return null;
        const rows = this.criticalLocations.map(location => {
            const severity = this.criticals[location];
            return { location, severity, hours: `1D×${severity}`,
                cost: REPAIR_PER_SEVERITY * this.structure * severity };
        });
        const structureCost = REPAIR_PER_STRUCTURE * (this.structureBase - this.structure);
        return { rows, structureCost,
            total: rows.reduce((sum, row) => sum + row.cost, 0) + structureCost };
    }

    /**
     * VH2026 p.20: what the ground under this vehicle costs it. One number, and the caller lands it
     * three times — on the check, on Agility and on both Speed Bands. `allowed: false` is terrain
     * it may not enter, which Smart Wheels never unlocks.
     */
    get terrainEffect() {
        if (!this.runs2026) return { dm: 0, allowed: true, key: this.terrain };
        const row = MGT2.VehicleTerrain[this.terrain] ?? MGT2.VehicleTerrain.clear;
        const best = ["tracked", "atv", "off-roader"]
            .filter(trait => MGT2Helper.hasTrait(this.traits, trait))
            .map(trait => row[trait]);
        const dm = best.length ? Math.max(...best.map(v => (v === null) ? -Infinity : v)) : row.none;
        if ((dm === null) || (dm === -Infinity)) return { dm: 0, allowed: false, key: this.terrain };
        return { dm: this.smartWheels ? Math.min(0, dm + 1) : dm, allowed: true, key: this.terrain };
    }

    /** VH2026 p.16-17: Responsive halves every band change, Unresponsive doubles it, both cancel. */
    get bandChangeFactor() {
        const quick = MGT2Helper.hasTrait(this.traits, "responsive");
        const slow = MGT2Helper.hasTrait(this.traits, "unresponsive");
        return (quick === slow) ? 1 : (quick ? 0.5 : 2);
    }

    /**
     * VH2026 p.18's Rounds to Reach column, which is cumulative from a standstill — so the cost of
     * any change is the gap between two of its cells, in either direction.
     * @returns {number|null}   Null for Orbital with no world Size stated
     */
    roundsToReach(band) {
        const rows = MGT2.SpeedBandRows;
        const orbital = rows.length - 1;
        const wanted = Math.min(Math.max(0, Math.trunc(band) || 0), orbital);
        if (wanted < orbital) return rows[wanted].rounds * this.bandChangeFactor;
        const size = this.environment.size;
        return (size === null) ? null
            : (rows[orbital - 1].rounds + (MGT2.SpeedBandOrbitalRounds * size)) * this.bandChangeFactor;
    }

    /** What moving between two Speed Bands costs this vehicle, accelerating or slowing. */
    bandChangeRounds(from, to) {
        const start = this.roundsToReach(from);
        const end = this.roundsToReach(to);
        return ((start === null) || (end === null)) ? null : Math.abs(end - start);
    }

    /** VH2026 p.19: degrees per round and the rounds a 180° turn takes, at the Agility in play. */
    get turning() {
        if (!this.runs2026) return null;
        const rows = MGT2.VehicleTurning;
        const agility = Math.min(rows[0].agility,
            Math.max(rows.at(-1).agility, this.agilityEffective));
        return rows.find(row => row.agility === agility);
    }

    /** VH2026 p.19: negative Agility costs a timed task an extra round per point, not a DM. */
    get agilityDelay() {
        return this.runs2026 ? Math.max(0, -this.agilityEffective) : 0;
    }

    /** How much of a one-round task's Agility DM a round of Minor Actions can buy off. */
    get agilityCancellable() {
        return this.runs2026
            ? Math.max(Math.min(0, this.agilityEffective), -MINOR_ACTION_CANCEL) : 0;
    }

    /** VH2026 p.19: the Speed Band over the rounds a 180° takes, scaled by the band it is taken at. */
    gForceAt(band) {
        const turn = this.turning;
        if (!turn || !(band > 0)) return 0;
        return (band / turn.rounds) * MGT2.VehicleGForce.scale.find(row => band >= row.from).factor;
    }

    /** VH2026 p.20: TL × 1.5 G, a point for the Agile feature and a point for AFV, then criticals. */
    get gForce() {
        if (!this.runs2026) return null;
        const rule = MGT2.VehicleGForce;
        const limit = (this.tl * rule.perTL) + (this.agile ? rule.agile : 0)
            + (MGT2Helper.hasTrait(this.traits, "afv") ? rule.afv : 0);
        const pulled = this.gForceAt(this.speed.effective);
        return { limit, pulled, criticals: Math.max(0, Math.ceil(pulled - limit)) };
    }

    /** Which density rung an Atmosphere digit sits on, or -1 where the book puts it on none. */
    static atmosphereRung(digit) {
        return MGT2.VehicleAtmosphereBands.findIndex(band => band.digits.includes(digit));
    }

    /** "Any flying vehicle except grav vehicles" needs air to fly at all (VH2026 p.20). */
    get isAerodynamic() {
        return this.skill.some(pair => (pair.skill === "flyer") && (pair.speciality !== "grav"));
    }

    /**
     * VH2026 p.21-22: what flying away from the world it was designed for costs. Both worlds have
     * to be stated — nothing here is inferred from a blank — and the two halves are additive.
     */
    get airborne() {
        if (!this.runs2026 || !this.isAerodynamic) return null;
        const home = this.design;
        const here = this.environment;
        if ([home.atmosphere, home.size, here.atmosphere, here.size].includes(null)) return null;

        const rule = MGT2.VehicleAirborne;
        const from = VehicleData.atmosphereRung(home.atmosphere);
        const to = VehicleData.atmosphereRung(here.atmosphere);
        // Same digit is the same world type whether or not the book rates its density.
        const steps = (home.atmosphere === here.atmosphere) ? 0
            : ((from < 0) || (to < 0)) ? null : Math.abs(to - from);

        const diff = here.size - home.size;
        const size = (diff > 0) ? rule.larger : (diff < 0) ? rule.smaller : null;
        let dm = Math.abs(diff) * (size?.dm ?? 0);
        // A bigger world charges per point of Size; a smaller one pays once, whatever the gap.
        let bands = (diff > 0) ? (diff * rule.larger.band) : (diff < 0) ? rule.smaller.band : 0;
        let range = 1 + ((diff > 0) ? (Math.abs(diff) * rule.larger.range)
            : (diff < 0) ? rule.smaller.range : 0);
        if (steps === 1) {
            dm += rule.step.dm;
            bands += rule.step.band;
            range += rule.step.range;
        }

        const ceiling = Math.max(this.speed.max, rule.ceiling);
        bands = Math.min(this.speed.max + bands, ceiling) - this.speed.max;
        const adjusted = this.speed.max + bands;
        return {
            from, to, steps, sizeDiff: diff, dm, bands, adjusted,
            agility: (steps === 1) ? rule.step.agility : 0,
            range: Math.max(0, range),
            grounded: steps > 1,
            unrated: steps === null,
            lift: this.skill.some(pair => pair.speciality === "wing")
                && !MGT2Helper.hasTrait(this.traits, "vtol") && (adjusted <= rule.liftBand)
        };
    }

    /** VH2026 p.11: the Speed Band of the impact, halved by a barrier built to absorb it. */
    collisionBand({ mode = "object", otherBand = 0, crumple = false } = {}) {
        const own = this.speed.effective;
        const combine = MGT2.CollisionModes[mode]?.combine ?? "own";
        const band = (combine === "sum") ? own + otherBand
            : (combine === "difference") ? Math.abs(own - otherBand) : own;
        return crumple ? Math.floor(band / 2) : band;
    }

    /**
     * VH2026 p.12: one 1D per potential critical, every roll above the count discarded, then the
     * hull and AFV DMs, a seven read as six and anything under one dropped.
     */
    async resolveCollision({ mode, otherBand, crumple, hull = "standard",
        restrained = false, protection = 0 } = {}) {
        const potential = this.collisionBand({ mode, otherBand, crumple });
        if (potential < 1) return { potential, dm: 0, criticals: [], occupant: null };

        const dm = (MGT2.CollisionHulls[hull]?.dm ?? 0)
            + (MGT2Helper.hasTrait(this.traits, "afv") ? -1 : 0);
        const rolled = await new Roll(`${potential}d6`).roll();
        const kept = rolled.dice[0].results.map(die => die.result).filter(result => result <= potential);
        const severities = kept.map(result => Math.min(MAX_SEVERITY, result + dm))
            .filter(severity => severity >= 1);

        const table = Object.entries(this.criticalTable);
        const criticals = [];
        for (const severity of severities) {
            const where = await new Roll("2d6").roll();
            const found = table.find(([, location]) =>
                (where.total >= location.roll[0]) && (where.total <= location.roll[1]));
            criticals.push({ location: found?.[0] ?? null, severity, roll: where.total });
        }
        const occupant = await this.#collisionOccupants(criticals.length, restrained, protection);
        if (occupant && !restrained && MGT2Helper.hasTrait(this.traits, "open-vehicle")) {
            const thrown = await new Roll(`${potential}d6`).roll();
            occupant.thrown = { metres: 10 * this.speed.effective, formula: `${potential}D`,
                damage: thrown.total };
        }
        return { potential, dm, rolled: rolled.dice[0].results.map(die => die.result), criticals,
            occupant };
    }

    /**
     * VH2026 p.12: 1D per critical inflicted, quartered for a restraint before the collision
     * protection system is deducted; personal armour does not apply.
     */
    async #collisionOccupants(count, restrained, protection) {
        if (count < 1) return null;
        const rolled = await new Roll(`${count}d6`).roll();
        const afterRestraint = restrained ? Math.floor(rolled.total / 4) : rolled.total;
        return { formula: `${count}D`, rolled: rolled.total, restrained,
            damage: Math.max(0, afterRestraint - protection) };
    }

    /** VH2026 p.11: `larger`, `smaller` or `even` against another vehicle's Spaces. */
    collisionSize(otherSpaces) {
        if (!(otherSpaces > 0) || !(this.spaces > 0)) return "even";
        if (this.spaces >= otherSpaces * 2) return "larger";
        return (otherSpaces >= this.spaces * 2) ? "smaller" : "even";
    }

    /** VH2026 p.11: what a rammer inflicts on the larger vehicle it struck. */
    async ramDamage({ band = 0, effect = 0, spaces = this.spaces } = {}) {
        const dice = Math.max(0, band) + Math.floor(Math.max(0, spaces) / MGT2.CollisionRamSpaces);
        if (dice < 1) return { formula: null, total: 0 };
        const rolled = await new Roll(`${dice}d6`).roll();
        return { formula: `${dice}D${effect ? MGT2Helper.signed(effect) : ""}`,
            total: Math.max(0, rolled.total + effect) };
    }

    /** VH2026 p.13: a weapon on an external hardpoint degrades a stealth rating, never past zero. */
    get stealthEffective() {
        const stealth = this.systems.stealth ?? 0;
        if (!stealth) return 0;
        const external = this.mounts.some(mount => (mount.type === "hardPoint") && mount.weapons.length);
        return external ? Math.min(0, stealth + 1) : stealth;
    }

    /** VH2026 p.13-14: what this vehicle itself brings to a sensor check made against it. */
    get detection() {
        if (!this.runs2026) return null;
        const sources = [];
        if (this.toHitBonus) sources.push({ key: "size", dm: this.toHitBonus });
        if (this.stealthEffective) sources.push({ key: "stealth", dm: this.stealthEffective });
        return { sources, dm: sources.reduce((total, source) => total + source.dm, 0) };
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
        // fallbacks are asymmetric on purpose. `null` is the book's "unless otherwise stated"; a
        // number, 0 included, is a statement and displaces it. VH2026 states all six on every card,
        // so this answers for a hand-typed vehicle and for a 2017 record that named neither face.
        // Which side: `FACING_ALIAS` already resolves the 2017 `sides` to `port`, and the two are
        // equal on every published card.
        const armour = this.armour;
        armour.inferred = { dorsal: armour.dorsal === null, ventral: armour.ventral === null };
        armour.dorsal ??= Math.floor(armour.port / 2);
        armour.ventral ??= Math.floor(armour.aft / 2);
        // Core folio 140: against a weapon under 4D or with Stun, every facing gains the vehicle's
        // TL.
        armour.vsLight = this.tl;

        this.agilityEffective = this.agilityPenalties
            .reduce((total, penalty) => total + penalty.dm, this.agility);

        this.criticalEffects = this.#foldCriticals();
        const ground = this.terrainEffect;
        const air = this.airborne;
        const shift = ground.dm + (air?.bands ?? 0);
        this.speed.effective = this.criticalEffects.speedZero
            ? 0 : Math.max(0, this.speed.max - this.criticalEffects.speedBands + shift);
        this.speed.cruiseEffective = Math.max(0, this.speed.cruise + shift);
        this.terrainImpassible = !ground.allowed;
        // VH2026 p.21-22: the Range percentages are shares of the printed figure and add, so one
        // step of Atmosphere onto a smaller world leaves 75 % rather than 93.75 %.
        this.range.factor = air?.range ?? 1;
        this.range.effective = Math.round(this.range.max * this.range.factor);
        this.range.cruiseEffective = Math.round(this.range.cruise * this.range.factor);

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

    /** The armour on the face that was hit, named in either book's vocabulary. */
    armourAt(facing) {
        return this.armour[FACING_ALIAS[facing] ?? facing] ?? this.armour.forward;
    }

    /** Reactive armour sits on the face that was hit, named in either book's vocabulary. */
    reactiveAt(facing) {
        return this.armour.reactive[FACING_ALIAS[facing] ?? facing] ?? 0;
    }

    /**
     * Core folio 140: the wound is taken behind the armour of the facing the attack came from, and
     * with no facing named the front is the one that answers.
     * @inheritDoc
     */
    protectionAgainst(options = {}) {
        if (options.ignoreArmour) return 0;
        const facing = options.facing ?? "forward";
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
                disrupted: true, armour: this.armourAt(options.facing ?? "forward") };
        }
        const result = await super.applyDamage(amount, options);
        if (!result || !this.runs2026) return result;
        // VH2026 p.6-7: the multiple is what raises a critical, and the running total is what
        // disables — the book counts seven exceedances from a wound whose severity caps at six.
        const multiple = this.structureMultiple(result.wound);
        result.structureMultiple = multiple;
        result.structureSeverity = Math.min(MAX_SEVERITY, multiple);
        if (multiple > 0) {
            result.structureExceeded = this.parent.system.structureExceeded + multiple;
            await this.parent.update({ "system.structureExceeded": result.structureExceeded });
        }
        // VH2026 p.6, worked at p.11: one attack raises one critical, at whichever of the two
        // severities is higher, and the Structure multiple is counted whichever of them wins.
        const byEffect = (result.wound > 0) ? this.constructor.severityFor(options.effect ?? 0) : 0;
        result.criticalSeverity = Math.max(byEffect, result.structureSeverity);
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
