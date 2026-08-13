import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { CraftData } from "./craft-data.js";
import { createTraitsField } from "../traits.js";

const fields = foundry.data.fields;

/** VH p.6, p.10: one Space is 250 kg of capacity, which is what Shipping counts in tons. */
const TONS_PER_SPACE = 0.25;

/** VH p.3: a vehicle costs half a per cent of its purchase price to keep running each month. */
const MAINTENANCE_RATE = 0.005;

/** Core p.143: one mounted weapon per ten points of Hull. */
const HULL_PER_WEAPON = 10;

/** VH p.24: an airship's gas envelope may not exceed a tenth of its Spaces. */
const ENVELOPE_FRACTION = 0.1;

/** Core folio 140: the dice a weapon must fall below for a vehicle's TL to count as extra armour. */
const LIGHT_WEAPON_DICE = 4;

/**
 * Schema and behaviour of the `vehicle` Actor sub-type — the eleven printed statblock lines, the
 * six-line systems block, five armour facings and a critical track.
 *
 * **Printed value wins, derived value warns** (§9.20). Hull, Cargo and Shipping are transcribed off
 * the page and the `spaces`-derived figures beside them exist only to flag a mismatch; nothing here
 * ever writes a computed number over a typed one.
 *
 * @extends {CraftData}
 */
export class VehicleData extends CraftData {

    static CRITICALS = MGT2.VehicleCriticals;

    static WRECKED_LABEL = "MGT2.Actor.vehicle.Wrecked";

    /** The medium a vehicle with no chassis skill stored is assumed to be built for. */
    static DEFAULT_MODE = "ground";

    static defineSchema() {
        const schema = super.defineSchema();
        // The registry's `vehicle` family is five flag traits and that is complete: the six lines
        // that look missing are the systems block below, not traits (§1.4).
        schema.traits = createTraitsField("vehicle");

        const facing = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, initial: 0 });
        const band = () => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, max: 10, initial: 0 });

        Object.assign(schema, {
            // The chassis sets skill and speciality (VH p.14-33), and an array because a multi-mode
            // vehicle has more than one: the Peswab Marsh Hopper prints
            // `Flyer (grav), Seafarer (submarine)` (Aliens 3 p.266).
            skill: new fields.ArrayField(new fields.SchemaField({
                skill: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.VehicleSkills }),
                speciality: new fields.StringField({
                    required: false, blank: true, initial: "", choices: MGT2.VehicleSpecialities })
            }), { initial: [] }),

            // Never printed, and four runtime rules read it: the detection DM per 25 Spaces, the
            // towing cost per 25 % towed, and the per-Space price of armour, camouflage and stealth.
            // It cannot be recovered from Hull — Hull-per-Space runs from 1-per-5 to 4-per-1.
            spaces: new fields.NumberField({
                required: false, nullable: false, integer: true, min: 0, initial: 0 }),

            // Signed: 36 of the 78 Vehicle Handbook statblocks print a negative Agility.
            agility: new fields.NumberField({
                required: false, nullable: false, integer: true, initial: 0 }),
            operatingMode: new fields.StringField({
                required: false, blank: false, initial: "ground", choices: MGT2.OperatingModes }),
            // Orthogonal to the mode: a vehicle tows *while* it is on the ground (VH p.3).
            towing: new fields.BooleanField({ required: false, initial: false }),

            // Band numbers, not names: collision damage is 1D per band, Weave picks a negative DM up
            // to the current band, and an attack takes DM-1 per band of difference (Core p.136-142).
            // Cruise is stored rather than derived from "maximum minus one" — VH p.144 prints two
            // bands down and p.147 prints a cruise *above* maximum, and deriving would correct them.
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
                // Nullable and null by default. Writing a default here would destroy the condition
                // both books rest on — "unless otherwise stated" cannot be told from a stated value
                // once it is stored — and no published vehicle prints either facing (§9.5).
                top: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, initial: null }),
                bottom: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, initial: null }),
                // A second number per facing that drops by 1 per hit and is destroyed outright by a
                // Destructive or spacecraft-scale weapon (VH p.51), so it is mutable in play.
                reactive: new fields.SchemaField({ front: facing(), rear: facing(), sides: facing() })
            }),

            // Six lines, six kinds of number (VH p.12). `null` and not 0: `-` on the page means
            // absent, and Sensors genuinely prints `+0` on five published vehicles.
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
            // one mount can hold several weapons (VH p.37-38). Ids of the vehicle's own embedded
            // weapons, the same shape `PhysicalItemData.container.id` already uses.
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

            // What Core folio 138's two vehicular actions leave standing. Stored and not derived:
            // "for this round" and "until the driver's next action" are facts no sheet can watch,
            // which is the same reason a Reaction's DM lives on the Combatant (§1 C).
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
                // the same call §1 C made for Tactics, and for the same reason (no book caps it).
                evasive: new fields.NumberField({
                    required: false, nullable: false, integer: true, initial: 0 })
            }),

            // Submersibles, airships and drones are one type with two nullable sub-objects, not
            // sub-types: no behaviour differs at the type level (§9.8). Null is "not one of these".
            submersible: new fields.SchemaField({
                safeDepth: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                // "The depth to which they can go before being automatically destroyed" (VH p.23).
                crushDepth: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                lifeSupportDays: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 })
            }, { required: false, nullable: true, initial: null }),

            remote: new fields.SchemaField({
                interface: new fields.StringField({
                    required: false, blank: false, initial: "basic", choices: MGT2.RemoteInterfaces }),
                // Two ranges, not one: "it is perfectly possible for the drone to be within range of
                // control but be out of range to send any information back" (VH p.67).
                commsRange: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                telemetryRange: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 })
            }, { required: false, nullable: true, initial: null })
        });
        return schema;
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /**
     * The media this chassis is built for, read off its skills rather than stored twice. A vehicle
     * with no skill yet is assumed to be a ground vehicle, which is the field's own initial.
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
     * Every penalty standing between the printed Agility and the one in play. Rails is never a
     * native medium and always costs 2; towing costs 2 wherever the vehicle is (VH p.3, p.47-48).
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

    /** Core p.140: DM+1, plus DM+1 per full 10 tons of Shipping, capped at DM+6. */
    get toHitBonus() {
        return Math.min(6, 1 + Math.floor(this.shipping / 10));
    }

    /** Core p.143: one mounted weapon per ten points of Hull. */
    get weaponCap() {
        return Math.floor(this.characteristics.hull.max / HULL_PER_WEAPON);
    }

    /** How many weapons the mounts actually carry, against that cap. */
    get mountedWeapons() {
        return this.mounts.reduce((total, mount) => total + mount.weapons.length, 0);
    }

    /**
     * Stored beside computed, for the three lines the design system also produces (§3.1, §9.20).
     * Shipping is Spaces × 0.25 t; Cargo cannot exceed that same figure, since it is 0.25 t per
     * *unused* Space; and Hull divided by Spaces is the chassis's implied Hull-per-Space, which the
     * Vehicle Handbook's chassis tables run from 0.2 to 4. **Advisory only** — every row reports.
     * @type {Array<{key: string, printed: number, derived: number, agrees: boolean}>}
     */
    get crossCheck() {
        if (!(this.spaces > 0)) return [];
        const capacity = this.spaces * TONS_PER_SPACE;
        const perSpace = this.characteristics.hull.max / this.spaces;
        return [
            { key: "shipping", printed: this.shipping, derived: capacity,
                agrees: Math.abs(this.shipping - capacity) < 0.5 },
            { key: "cargo", printed: this.cargo, derived: capacity, agrees: this.cargo <= capacity },
            { key: "hullPerSpace", printed: this.characteristics.hull.max,
                derived: Math.round(perSpace * 100) / 100,
                agrees: (perSpace >= 0.2) && (perSpace <= 4) }
        ];
    }

    /**
     * Whoever is at the controls, or null. Core folio 138 makes both vehicular actions the driver's
     * own check, so this is who rolls them; the vehicle only supplies the Agility.
     * @type {Actor|null}
     */
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

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /** @inheritDoc */
    prepareDerivedData() {
        super.prepareDerivedData();

        // Core p.140: the roof takes half the sides and the floor half the rear, and the two
        // fallbacks are asymmetric on purpose. A stored override is how VH p.35's design-time
        // reallocation is expressed; null is how the other two rules apply.
        const armour = this.armour;
        armour.effectiveRoof = armour.top ?? Math.floor(armour.sides / 2);
        armour.effectiveFloor = armour.bottom ?? Math.floor(armour.rear / 2);
        // Core folio 140: against a weapon under 4D or with Stun, every facing gains the vehicle's
        // TL. Printed here for the sheet; `protectionAgainst` is where it meets an actual attack.
        armour.vsLight = this.tl;

        this.agilityEffective = this.agilityPenalties
            .reduce((total, penalty) => total + penalty.dm, this.agility);

        this.criticalEffects = this.#foldCriticals();
        this.speed.effective = this.criticalEffects.speedZero
            ? 0 : Math.max(0, this.speed.max - this.criticalEffects.speedBands);

        // §3.4: a critical's ongoing DMs are folded into the accumulators rather than made into
        // Active Effects, and `sumModifiers` assigns rather than adds so this is safe after it ran.
        this.modifiers.check.auto += this.criticalEffects.controlDM + this.criticalEffects.systemsDM;
        this.#prepareCombatModifiers();
        this.sumModifiers();

        this.toHit = this.toHitBonus;
        this.maintenance = this.cost * MAINTENANCE_RATE;
        this.remoteControlDM = this.remote ? (MGT2.RemoteInterfaces[this.remote.interface]?.dm ?? 0) : null;
    }

    /**
     * Core folio 138's two standing DMs, as **named** sources so the roll prompt lists them and the
     * referee can waive one — which is how a round moving on is said, there being nothing on the
     * sheet that can watch for it.
     *
     * Only the half that is this vehicle's own roll is applied: the dogfight's "DM+2 to all their
     * attack rolls", and evasive action's "negative DM to any attacks made from the vehicle too".
     * What either costs an attacker shooting **at** the vehicle is stated on the chat card and never
     * applied, because applying it would mean the attack roll reading its target (Appendix B, and
     * §1 C's Reactions, which are the same shape).
     */
    #prepareCombatModifiers() {
        const sources = [];
        if (this.combat.dogfight !== 0) {
            sources.push({ key: "dogfight", label: "MGT2.Actor.vehicle.DogfightDM",
                dm: this.combat.dogfight });
        }
        if (this.combat.evasive !== 0) {
            sources.push({ key: "evasive", label: "MGT2.Actor.vehicle.EvasiveDM",
                dm: -this.combat.evasive });
        }
        this.modifiers.check.auto += sources.reduce((total, source) => total + source.dm, 0);
        this.modifiers.check.sources = sources;
    }

    /**
     * The standing criticals as four numbers. Only the cells that name an integer are folded: a
     * `D3` or `1D` Speed Band loss is a roll the referee makes when the critical lands, and this is
     * the continuing state rather than the moment of the hit.
     */
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

    /* -------------------------------------------- */
    /*  Rules                                       */
    /* -------------------------------------------- */

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
     * with no facing named the front is the one that answers. The anti-light-weapon bonus joins it
     * here rather than in the stored figure — it is a property of the attack, not of the vehicle.
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
     * counted off the attack's own expression, so a wound typed by hand or dragged onto a token
     * bar — which names no weapon and states no dice — earns nothing.
     * @param {object} options   `applyDamage`'s options: `formula` and `stun`
     */
    lightWeaponArmour({ formula, stun } = {}) {
        if (stun === true) return this.armour.vsLight;
        const dice = MGT2Helper.damageDice(formula);
        return ((dice > 0) && (dice < LIGHT_WEAPON_DICE)) ? this.armour.vsLight : 0;
    }

    /* -------------------------------------------- */
    /*  Document Lifecycle                          */
    /* -------------------------------------------- */

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
