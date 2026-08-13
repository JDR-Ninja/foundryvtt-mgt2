import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { CraftData } from "./craft-data.js";

const fields = foundry.data.fields;

/** HG p.16: a jump drive is never smaller than this, whatever the percentage works out at. */
const MIN_JUMP_DRIVE_TONS = 10;

/** HG p.19: MCr0.5 per 100 tons of ship, or part of one. */
const BRIDGE_COST_PER_100T = 500000;

/** Core p.183 and HG p.25 both count a period as four weeks. */
const WEEKS_PER_PERIOD = 4;

/** The power consumers the panel can switch off, in the order the catalogue prints them. */
const POWER_CONSUMERS = ["basic", "mDrive", "jDrive", "sensors", "weapons", "screens", "other"];

/** Where a band table answers for a tonnage; the last entry carries `maxTons: null`. */
function band(table, tons) {
    return table.find(entry => (entry.maxTons === null) || (tons <= entry.maxTons)) ?? table.at(-1);
}

/**
 * Schema and behaviour of the `spacecraft` Actor sub-type. The schema is the statblock and the
 * items are the parts (§4.1): every headline number is a formula over three or four stored ratings
 * rather than a sum over a component list, so a ship with no items at all is complete and usable.
 *
 * Three budgets constrain it rather than one — tonnage, power and hardpoints — and the power budget
 * is a panel rather than a number because the rules give it a *state*: a consumer taken offline is
 * an Engineer's action and it frees its draw (Core p.171).
 *
 * @extends {CraftData}
 */
export class SpacecraftData extends CraftData {

    static CRITICALS = MGT2.ShipCriticals;

    static WRECKED_LABEL = "MGT2.Actor.spacecraft.Wrecked";

    /**
     * Core p.167: a ship is Spacecraft scale and always was. That is what makes a Traveller
     * shooting a starship divide by ten with no branch anywhere in the damage pipeline.
     */
    static SCALE = "spacecraft";

    static defineSchema() {
        const schema = super.defineSchema();

        const count = (initial = 0) => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, initial });
        const tons = (initial = 0) => new fields.NumberField({
            required: false, nullable: false, min: 0, initial });

        Object.assign(schema, {
            // The design input everything else reads. Hull points are computed from these three and
            // land in `characteristics.hull.auto`, so a ship's `base` goes unused — the exact mirror
            // of a vehicle, whose Hull is transcribed off the page (§4.2).
            hull: new fields.SchemaField({
                tons: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 100 }),
                configuration: new fields.StringField({
                    required: false, blank: false, initial: "standard", choices: MGT2.HullConfigurations }),
                options: new fields.SetField(
                    new fields.StringField({ required: true, blank: false, choices: MGT2.HullOptions }),
                    { required: false, initial: [] }),
                shipClass: new fields.StringField({ required: false, blank: true, trim: true })
            }),

            // Bought per point of Protection as a percentage of hull tonnage (HG p.12-13); the
            // tonnage, the cost and the cap all derive from the material and the count. `damage` is
            // the wound criticals inflict on it, stored for the same reason every other wound is.
            armour: new fields.SchemaField({
                material: new fields.StringField({
                    required: false, blank: false, initial: "titaniumSteel", choices: MGT2.ArmourMaterials }),
                points: count(0),
                damage: count(0)
            }),

            drives: new fields.SchemaField({
                thrust: count(1),
                jump: count(0),
                // A reaction drive burns fuel instead of drawing Power (HG p.17-18).
                reaction: new fields.BooleanField({ required: false, initial: false })
            }),

            power: new fields.SchemaField({
                plant: tons(0),
                // Switched off, not removed: an Engineer can cut power to a system during combat and
                // switch it back on, which is why this is stored state and not a design decision.
                offline: new fields.SetField(
                    new fields.StringField({ required: true, blank: false, choices: POWER_CONSUMERS }),
                    { required: false, initial: [] }),
                // Declared although derived, so an Active Effect from a damaged plant is coerced and
                // validated rather than written raw (§1.5). Written in the `final` phase.
                available: new fields.NumberField({ required: false, nullable: false, initial: 0 })
            }),

            fuel: new fields.SchemaField({
                tons: tons(0),
                refined: new fields.BooleanField({ required: false, initial: true }),
                // Weeks of power-plant operation the tank is sized for, printed on every catalogue
                // entry beside the jump rating.
                weeks: count(WEEKS_PER_PERIOD)
            }),

            bridge: new fields.SchemaField({
                type: new fields.StringField({
                    required: false, blank: false, initial: "standard", choices: MGT2.BridgeTypes })
            }),

            // HG p.20: a ship's computer has a Processing score and consumes no tonnage. Ship
            // software is `item`/`software` and spends it exactly as personal software spends
            // bandwidth, which is the machinery `ComputerData` already carries.
            computer: new fields.SchemaField({ processing: count(5) }),

            sensors: new fields.SchemaField({
                grade: new fields.StringField({
                    required: false, blank: false, initial: "civilian", choices: MGT2.SensorGrades })
            }),

            staterooms: new fields.SchemaField({ standard: count(0), high: count(0), luxury: count(0) }),
            lowBerths: new fields.SchemaField({ standard: count(0), emergency: count(0) }),
            passengers: new fields.SchemaField({
                high: count(0), middle: count(0), basic: count(0), low: count(0) }),
            cargo: new fields.SchemaField({ capacity: tons(0) }),

            // Which column of the Crew Requirements table the ship reads (HG p.23). Named `role` by
            // §4.9; it is the ship's service, and has nothing to do with a crew station's `role`.
            role: new fields.StringField({
                required: false, blank: false, initial: "commercial", choices: MGT2.ShipService }),

            // A roster of stations, not of people: `role` points at a `role` Item because the eight
            // combat duties are a closed list and the stations on a ship are not (§4.6, §6.5).
            crew: new fields.ArrayField(new fields.SchemaField({
                // `readonly` defaults to true on a DocumentIdField, which would refuse the edit.
                role: new fields.DocumentIdField({
                    required: false, nullable: true, initial: null, readonly: false }),
                // A UUID rather than a ForeignDocumentField, because it resolves across collections.
                actor: new fields.DocumentUUIDField({
                    type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
                name: new fields.StringField({ required: false, blank: true, trim: true }),
                // How many bodies this station holds — the printed crew line says `Engineers x2`.
                count: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 1, initial: 1 }),
                // The mount this station sits at. `duty` is NOT here: it is per-combat state on a
                // shared party asset, so it lives on the `crew` Combatant and clears with the
                // encounter (§9.26). The mount stays, because a gunner's turret is a standing fact
                // about the ship and the station action needs it when no combat is running.
                dutyTarget: new fields.StringField({ required: false, blank: true })
            }), { initial: [] }),

            // The mount is not packaging: it multiplies damage by up to a thousand, and it is the
            // ship's field rather than the weapon's because it is the ship that owns the hardpoint.
            mounts: new fields.ArrayField(new fields.SchemaField({
                type: new fields.StringField({
                    required: false, blank: false, initial: "singleTurret", choices: MGT2.ShipMounts }),
                label: new fields.StringField({ required: false, blank: true, trim: true }),
                // Ids of this ship's own embedded weapons, as `mounts` already does on a vehicle.
                weapons: new fields.ArrayField(new fields.DocumentIdField(), { initial: [] }),
                // HG p.28: a ship whose weapons are all pop-up scans as unarmed.
                popup: new fields.BooleanField({ required: false, initial: false }),
                // Per mount and never a ship-wide pool: a turret missile rack holds twelve whatever
                // it contains (HG p.28).
                ammo: count(0)
            }), { initial: [] }),

            screens: new fields.ArrayField(new fields.SchemaField({
                type: new fields.StringField({
                    required: false, blank: false, initial: "nuclearDamper", choices: MGT2.ShipScreens }),
                count: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 1, initial: 1 })
            }), { initial: [] }),

            // A carried craft is a full independent ship record, so it is a reference and not an
            // embedded document — and the mothership has to know which craft it carries in order to
            // exclude them from its own maintenance base (Core p.183).
            bays: new fields.ArrayField(new fields.SchemaField({
                kind: new fields.StringField({
                    required: false, blank: false, initial: "dockingSpace", choices: MGT2.CraftBays }),
                capacity: tons(0),
                craft: new fields.DocumentUUIDField({
                    type: "Actor", embedded: false, required: false, nullable: true, initial: null })
            }), { initial: [] }),

            finance: new fields.SchemaField({
                // Net of any Ship Shares contributed before the mortgage was calculated (Core p.149).
                purchase: new fields.NumberField({ required: false, nullable: false, min: 0, initial: 0 }),
                // The reference figure is under-determined: a ship bought outright, bought with
                // shares, or taken as a career Benefit have three different legitimate mortgages
                // (§9.13), so the elected number wins when it is set.
                mortgageOverride: new fields.NumberField({
                    required: false, nullable: true, min: 0, initial: null })
            }),

            homeport: new fields.StringField({ required: false, blank: true, trim: true })
        });
        return schema;
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /** HG p.10-12: tons per point by size band, then the configuration and hull options. */
    get hullPoints() {
        const tons = this.hull.tons;
        if (!(tons > 0)) return 0;
        const config = MGT2.HullConfigurations[this.hull.configuration];
        let points = Math.floor(tons / band(MGT2.HullPointRates, tons).tonsPerPoint);
        points *= config?.hullPoints ?? 1;
        for (const key of this.hull.options) points *= MGT2.HullOptions[key]?.hullPoints ?? 1;
        return Math.floor(points);
    }

    /**
     * HG p.12-13: a percentage of the hull per point of Protection, multiplied by the
     * configuration's Armour Volume Modifier and then by the framework multiplier for the hull size.
     */
    get armourTons() {
        const material = MGT2.ArmourMaterials[this.armour.material];
        if (!material || !(this.armour.points > 0)) return 0;
        const config = MGT2.HullConfigurations[this.hull.configuration];
        const size = band(MGT2.ArmourTonnage, this.hull.tons).multiplier;
        return this.hull.tons * (material.tonsPerPoint / 100) * (config?.armourVolume ?? 1)
            * size * this.armour.points;
    }

    /** The cap the material and the Tech Level agree on; a Military Hull doubles it (HG p.12). */
    get armourMax() {
        const material = MGT2.ArmourMaterials[this.armour.material];
        if (!material) return 0;
        const cap = material.maxProtection;
        let max = this.tl + cap.tlOffset;
        if (cap.cap !== null) max = Math.min(max, cap.cap);
        if (this.hull.options.has("military")) max *= MGT2.HullOptions.military.armourMax;
        return Math.max(0, max);
    }

    /** HG p.16: a percentage of the hull by rating, and a jump drive adds five tons on top. */
    get driveTons() {
        const thrust = MGT2.ThrustPotential[this.drives.thrust] ?? 0;
        const jumpPct = MGT2.JumpPotential[this.drives.jump] ?? 0;
        const jump = this.drives.jump > 0
            ? Math.max(MIN_JUMP_DRIVE_TONS, (this.hull.tons * jumpPct) + 5) : 0;
        return { mDrive: this.hull.tons * thrust, jDrive: jump };
    }

    /** HG p.19: a ladder on hull size, one step down for a smaller bridge, +40 for a command deck. */
    get bridgeTons() {
        const type = MGT2.BridgeTypes[this.bridge.type];
        if (type?.tons !== undefined) return type.tons;
        const ladder = MGT2.BridgeSizes;
        const index = ladder.findIndex(entry => this.hull.tons <= entry.maxTons);
        // Past the printed ladder the bridge grows by 20 tons per additional 100 000 tons.
        if (index < 0) return 60 + (Math.ceil((this.hull.tons - 100000) / 100000) * 20);
        const step = Math.max(0, index + (type?.step ?? 0));
        return ladder[step].tons + (type?.addTons ?? 0);
    }

    get bridgeCost() {
        const type = MGT2.BridgeTypes[this.bridge.type];
        if (type?.cost !== undefined) return type.cost;
        const cost = Math.ceil(this.hull.tons / 100) * BRIDGE_COST_PER_100T;
        return (cost * (type?.costFactor ?? 1)) + (type?.addCost ?? 0);
    }

    /** HG p.26: one hardpoint per full 100 tons; a hull too small for one gets firmpoints instead. */
    get hardpointsMax() {
        return Math.floor(this.hull.tons / MGT2.HullPoints.tonsPerHardpoint);
    }

    get firmpointsMax() {
        return band(MGT2.HullPoints.firmpoints, this.hull.tons).count;
    }

    /** Every mount's class record, in roster order. */
    get mountClasses() {
        return this.mounts.map(mount => MGT2.ShipMounts[mount.type] ?? MGT2.ShipMounts.fixed);
    }

    /** HG p.18: 10% of the hull per parsec of jump, plus a tenth of the plant per four weeks. */
    get fuelPerJump() {
        return this.hull.tons * MGT2.ShipFuel.jumpFraction * this.drives.jump;
    }

    get fuelPerPeriod() {
        return Math.max(this.power.plant > 0 ? 1 : 0,
            Math.ceil(this.plantTons * MGT2.ShipFuel.plantFraction));
    }

    /** The plant's own tonnage, back-derived from its output and the ship's Tech Level. */
    get plantTons() {
        const perTon = SpacecraftData.#powerPerTon(this.tl);
        return perTon > 0 ? this.power.plant / perTon : 0;
    }

    /** HG p.17's Power Plant table, reduced to the best type the Tech Level can build. */
    static #powerPerTon(tl) {
        if (tl >= 20) return 100;
        if (tl >= 15) return 20;
        if (tl >= 12) return 15;
        if (tl >= 8) return 10;
        if (tl >= 6) return 8;
        return 5;
    }

    /** Every bay holding a craft, resolved where the document is already in memory (§4.6). */
    get carriedCraft() {
        const craft = [];
        for (const bay of this.bays) {
            if (!bay.craft) continue;
            // fromUuidSync only answers for documents already loaded: a compendium craft degrades
            // to its bay rather than throwing.
            let actor = null;
            try { actor = foundry.utils.fromUuidSync(bay.craft); } catch { actor = null; }
            if (actor) craft.push(actor);
        }
        return craft;
    }

    /** How many small craft the ship carries — the Crew Requirements table counts these twice. */
    get smallCraftCount() {
        return this.bays.filter(bay => bay.craft).length;
    }

    /**
     * HG p.12: the hull's own Protection plus the armour bolted to it, less what criticals have
     * stripped. A ship has no facings — Core p.165 says facing generally does not matter, because
     * ships rotate and mount turrets — so one number answers every attack.
     * @inheritDoc
     */
    get protection() {
        return Math.max(0, this.armour.points - this.armour.damage)
            + (MGT2.HullConfigurations[this.hull.configuration]?.protection ?? 0);
    }

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /**
     * Hull points are a derivation and not a transcription, so they land in `auto` exactly as a
     * species modifier does — and here, before the base clears it, because `prepareDerivedData`
     * reads `auto` on its first line.
     * @inheritDoc
     */
    prepareBaseData() {
        super.prepareBaseData();
        this.characteristics.hull.auto = this.hullPoints;
    }

    /** @inheritDoc */
    prepareDerivedData() {
        super.prepareDerivedData();

        this.criticalEffects = this.#foldCriticals();
        this.#prepareArmour();
        this.#prepareDrives();
        this.#prepareSystems();
        this.#preparePower();
        this.#prepareTonnage();
        this.#prepareComputer();
        this.#prepareCrew();
        this.#prepareManoeuvre();
        this.#prepareFinance();

        // Core p.165: 2D + the pilot's Pilot skill + the ship's CURRENT Thrust, so an M-Drive
        // critical feeds initiative directly. The manifest formula stays `2d6 + @initiative`.
        this.initiative = this.pilotSkill + this.drives.effectiveThrust;
    }

    /**
     * The standing criticals as numbers. Only the cells naming an integer are folded: a `1D` fuel
     * leak or a `D3` weapon explosion is a roll the referee makes when the critical lands, and this
     * is the continuing state rather than the moment of the hit.
     */
    #foldCriticals() {
        const totals = {
            powerFactor: 1, thrustLoss: 0, thrustZero: false,
            sensorDM: 0, controlDM: 0, jumpDM: 0, sensorRange: undefined, jump: null
        };
        for (const location of this.criticalLocations) {
            const cell = this.criticalEffect(location);
            if (!cell) continue;
            if (cell.power === 0) totals.powerFactor = 0;
            else if (Number.isInteger(cell.power)) totals.powerFactor *= 1 + (cell.power / 100);
            if (cell.thrust === 0) totals.thrustZero = true;
            else if (Number.isInteger(cell.thrust)) totals.thrustLoss -= cell.thrust;
            if (Number.isInteger(cell.sensorDM)) totals.sensorDM += cell.sensorDM;
            if (Number.isInteger(cell.controlDM)) totals.controlDM += cell.controlDM;
            if (Number.isInteger(cell.jumpDM)) totals.jumpDM += cell.jumpDM;
            if ("sensorRange" in cell) totals.sensorRange = cell.sensorRange;
            if (cell.jump) totals.jump = cell.jump;
        }
        return totals;
    }

    #prepareArmour() {
        const armour = this.armour;
        armour.current = Math.max(0, armour.points - armour.damage);
        armour.tons = this.armourTons;
        armour.cost = armour.tons * (MGT2.ArmourMaterials[armour.material]?.costPerTon ?? 0);
        armour.max = this.armourMax;
        // Every hull starts at Protection +0 except the two planetoids (HG p.12).
        armour.hull = MGT2.HullConfigurations[this.hull.configuration]?.protection ?? 0;
    }

    #prepareDrives() {
        const drives = this.drives;
        const critical = this.criticalEffects;
        drives.effectiveThrust = critical.thrustZero
            ? 0 : Math.max(0, drives.thrust - critical.thrustLoss);
        Object.assign(drives, this.driveTons);
        drives.plant = this.plantTons;
    }

    /**
     * What the ship's CURRENT Thrust buys, band by band (Core folio 166): the listed figure is what
     * a change OUT of that band costs, to either neighbour, and Thrust may be accumulated across
     * rounds to pay a price one round cannot. The attack DM of each band (folio 167) rides along
     * because it is the other half of what a range is worth, and Adjacent and Close carry `null`
     * rather than a zero because the books print no DM for them at all — they resolve as a dogfight.
     */
    #prepareManoeuvre() {
        const thrust = this.drives.effectiveThrust;
        this.manoeuvre = Object.entries(MGT2.ShipRangeBands).map(([key, band]) => ({
            key, label: band.label, thrust: band.thrust, attackDM: band.attackDM,
            dogfight: band.dogfight,
            // Affordable in ONE round. A slower ship still gets there by banking, which is why the
            // rounds figure is printed beside it rather than the band being struck out.
            affordable: (thrust > 0) && (thrust >= band.thrust),
            rounds: (thrust > 0) ? Math.ceil(band.thrust / thrust) : null
        }));
    }

    #prepareSystems() {
        const sensors = MGT2.SensorGrades[this.sensors.grade];
        this.sensors.dm = (sensors?.dm ?? 0) + this.criticalEffects.sensorDM;
        this.sensors.power = sensors?.power ?? 0;
        this.sensors.tons = sensors?.tons ?? 0;
        this.sensors.cost = sensors?.cost ?? 0;
        // Inoperative beyond a band, or disabled outright when a Severity 6 named a null range.
        this.sensors.range = this.criticalEffects.sensorRange;

        const bridge = MGT2.BridgeTypes[this.bridge.type];
        this.bridge.tons = this.bridgeTons;
        this.bridge.cost = this.bridgeCost;
        this.bridge.dm = bridge?.dm ?? 0;
        this.bridge.tacticsDM = bridge?.tacticsDM ?? 0;

        this.fuel.jumpTons = this.fuelPerJump;
        this.fuel.plantTons = this.fuelPerPeriod;
        this.fuel.jumpCapacity = this.fuelPerJump > 0 ? Math.floor(this.fuel.tons / this.fuelPerJump) : 0;

        // HG p.25-26: one airlock and one hardpoint per full 100 tons, free.
        this.hardpoints = { used: 0, max: this.hardpointsMax };
        this.firmpoints = { used: 0, max: this.firmpointsMax };
        this.airlocks = Math.floor(this.hull.tons / MGT2.HullPoints.tonsPerAirlock);

        // A spinal mount's hardpoint cost is ceil(weapon tons / 100) and its tonnage is the weapon's
        // own, so both are unknown until the weapon is transcribed; it is charged one.
        this.hardpoints.used = this.mountClasses.reduce((sum, type) => sum + (type.hardpoints ?? 1), 0);
        // Every mount concealed means the ship reads as unarmed to an exterior scan (HG p.28).
        this.scansUnarmed = (this.mounts.length > 0) && this.mounts.every(mount => mount.popup);
    }

    /**
     * The power panel (HG p.17, Core p.171). A consumer switched off frees its draw, which is what
     * makes this a panel with a state rather than a single number.
     */
    #preparePower() {
        const hull = this.hull.tons;
        const nonGravity = this.hull.options.has("nonGravity")
            ? MGT2.HullOptions.nonGravity.basicPower : 1;

        const requirements = {
            basic: hull * 0.20 * nonGravity,
            // A reaction drive draws no Power at all; Thrust 0 draws a quarter (HG p.17).
            mDrive: this.drives.reaction ? 0
                : hull * 0.10 * (this.drives.thrust === 0 ? 0.25 : this.drives.thrust),
            jDrive: hull * 0.10 * this.drives.jump,
            sensors: this.sensors.power,
            weapons: 0,
            screens: 0,
            other: 0
        };

        for (const item of this.parent.items) {
            if ((item.type === "weapon") && (item.system.power > 0)) {
                requirements.weapons += item.system.power * Math.max(1, item.system.quantity ?? 1);
            }
        }
        for (const screen of this.screens) {
            requirements.screens += (MGT2.ShipScreens[screen.type]?.power ?? 0) * screen.count;
        }

        const offline = this.power.offline;
        let total = 0;
        const rows = POWER_CONSUMERS.map(key => {
            const draw = Math.round(requirements[key] * 100) / 100;
            const powered = !offline.has(key);
            if (powered) total += draw;
            return { key, draw, powered };
        });

        // A damaged plant is a percentage of its rating (Core p.170); `available` is declared in the
        // schema so a `final`-phase Active Effect on it is coerced rather than written raw.
        this.power.available = Math.floor(this.power.plant * this.criticalEffects.powerFactor);
        this.power.requirements = Object.assign(requirements, { total });
        this.power.rows = rows;
        this.power.surplus = this.power.available - total;
    }

    /**
     * The tonnage budget, derived row by row from the stored ratings rather than summed from
     * component Items — which is the whole of §4.1's argument, and the reason a ship with no items
     * still balances. Optional `component` Items, when they exist, land in `other`.
     */
    #prepareTonnage() {
        const mounts = this.mountClasses.reduce((sum, type) => sum + (type.tons ?? 0), 0);
        const bays = this.bays.reduce((sum, bay) => sum + bay.capacity, 0);
        const staterooms = Object.entries(this.staterooms)
            .reduce((sum, [key, n]) => sum + ((MGT2.Staterooms[key]?.tons ?? 0) * n), 0);
        const lowBerths = Object.entries(this.lowBerths)
            .reduce((sum, [key, n]) => sum + ((MGT2.LowBerths[key]?.tons ?? 0) * n), 0);

        const rows = [
            { key: "armour", tons: this.armour.tons },
            { key: "mDrive", tons: this.drives.mDrive },
            { key: "jDrive", tons: this.drives.jDrive },
            { key: "powerPlant", tons: this.drives.plant },
            { key: "fuel", tons: this.fuel.tons },
            { key: "bridge", tons: this.bridge.tons },
            { key: "sensors", tons: this.sensors.tons },
            { key: "mounts", tons: mounts },
            { key: "screens", tons: this.screens.reduce((sum, s) => sum + ((MGT2.ShipScreens[s.type]?.tons ?? 0) * s.count), 0) },
            { key: "staterooms", tons: staterooms },
            { key: "lowBerths", tons: lowBerths },
            { key: "bays", tons: bays },
            { key: "cargo", tons: this.cargo.capacity }
        ];

        const used = rows.reduce((sum, row) => sum + row.tons, 0);
        this.budget = {
            rows: rows.map(row => ({ ...row, tons: Math.round(row.tons * 100) / 100 })),
            tons: Math.round(used * 100) / 100,
            capacity: this.hull.tons,
            free: Math.round((this.hull.tons - used) * 100) / 100
        };
    }

    /** HG p.20: ship software consumes Processing exactly as personal software consumes bandwidth. */
    #prepareComputer() {
        let used = 0;
        const software = [];
        for (const item of this.parent.items) {
            if ((item.type !== "item") || (item.system.subType !== "software")) continue;
            const bandwidth = item.system.software.bandwidth ?? 0;
            used += bandwidth;
            software.push({ _id: item.id, name: item.name, bandwidth });
        }
        this.computer.used = used;
        this.computer.software = software;
        this.computer.overload = used > this.computer.processing;
    }

    /**
     * HG p.23's Crew Requirements table, as the advisory target §9.20 settles it to be: computed,
     * displayed beside the roster, never enforced and never written back. Fractions round up; the
     * `per full` rows floor, because that is what "per full 20 crew" says.
     */
    #prepareCrew() {
        const military = this.role === "military";
        const tons = this.hull.tons;
        const carried = this.bays.reduce((sum, bay) => sum + bay.capacity, 0);
        const craft = this.smallCraftCount;
        const drives = this.drives.mDrive + this.drives.jDrive + this.drives.plant;

        let turrets = 0, barbettes = 0, smallBays = 0, mediumBays = 0, largeBays = 0, spinalTons = 0;
        for (const [index, mount] of this.mounts.entries()) {
            switch (mount.type) {
                case "barbette": barbettes++; break;
                case "smallBay": smallBays++; break;
                case "mediumBay": mediumBays++; break;
                case "largeBay": largeBays++; break;
                case "spinal": spinalTons += this.mountClasses[index].tons ?? 0; break;
                default: turrets++;
            }
        }
        const screens = this.screens.reduce((sum, screen) => sum + screen.count, 0);

        const gunners = military
            ? smallBays + (2 * (turrets + barbettes + mediumBays + screens)) + (4 * largeBays)
                + Math.ceil(spinalTons / 100)
            : turrets + barbettes + screens;

        const required = {
            captain: 1,
            pilot: (military ? 3 : 1) + craft,
            astrogator: this.drives.jump > 0 ? 1 : 0,
            engineer: Math.ceil(drives / 35),
            maintenance: Math.ceil((tons + carried) / (military ? 500 : 1000)),
            gunner: gunners,
            steward: Math.ceil(this.passengers.high / 10) + Math.ceil(this.passengers.middle / 100),
            administrator: Math.ceil(tons / (military ? 1000 : 2000)),
            sensorOperator: Math.ceil((military ? 3 : 1) * tons / 7500),
            medic: 0,
            officer: 0
        };

        // HG p.22: capital ships centralise, and officers and medics are counted afterwards.
        const multiplier = band(MGT2.CrewReduction, tons).multiplier;
        if (multiplier < 1) {
            for (const [key, role] of Object.entries(MGT2.CrewRoles)) {
                if (role.reducible) required[key] = Math.ceil(required[key] * multiplier);
            }
        }

        const core = Object.values(required).reduce((sum, n) => sum + n, 0);
        const passengers = this.passengers.high + this.passengers.middle + this.passengers.basic;
        required.medic = Math.ceil((core + (military ? 0 : passengers)) / 120);
        required.officer = Math.floor((core + required.medic) / (military ? 10 : 20));

        const aboard = this.crew.reduce((sum, station) => sum + station.count, 0);
        this.crewRequired = Object.entries(required).map(([key, count]) => ({
            key, count, salary: (MGT2.CrewRoles[key]?.salary ?? 0) * count
        }));
        this.crewTotals = {
            required: Object.values(required).reduce((sum, n) => sum + n, 0),
            aboard,
            stations: this.crew.length,
            salaries: this.crewRequired.reduce((sum, row) => sum + row.salary, 0)
        };

        // The one number §4.6 allows to be read off a linked actor: the pilot's own Pilot skill.
        this.pilotSkill = this.#pilotSkill();
    }

    /**
     * The Pilot level of whoever mans the pilot station; 0 when it is vacant or unstatted. The
     * station is found by the `role` Item's own `crewRole` key and never by its name, which is user
     * text in whatever language the world runs in. It is a construction question, not a combat one:
     * the ship's initiative is a standing figure, while `duty` is per-encounter and lives on the
     * Combatant — who actually flies during a battle is the ship group's answer (§9.26).
     */
    #pilotSkill() {
        const station = this.crew.find(entry =>
            this.parent?.items?.get(entry.role)?.system.crewRoleKey === "pilot");
        if (!station?.actor) return 0;
        let actor = null;
        try { actor = foundry.utils.fromUuidSync(station.actor); } catch { return 0; }
        // Core p.58 makes a Traveller take a speciality the moment they reach Pilot 1, and HG p.95
        // names the starship one — so a ship's pilot holds `Pilot (spacecraft)` and never a bare
        // `Pilot` above level 0. An equality test therefore answers 0 for every pilot who has the
        // skill at all, which is why this is `matchesSkill` like the other five call sites.
        const skill = actor?.items?.find(item =>
            (item.type === "talent") && (item.system.subType === "skill")
            && MGT2Helper.matchesSkill(item.name, "pilot"));
        return skill?.system.level ?? 0;
    }

    /** Core p.149, p.154, p.183; HG p.23. Every periodic figure runs on the four-week period. */
    #prepareFinance() {
        const finance = this.finance;
        const carried = this.carriedCraft
            .reduce((sum, actor) => sum + (actor.system?.finance?.purchase ?? 0), 0);

        // Authoritative and takes no override (§9.20): p.183's form is the only one that excludes
        // carried craft, and the catalogue's plain cost/12000 therefore bills a carried boat twice.
        finance.maintenance = Math.max(0, finance.purchase - carried) / MGT2.ShipCosts.maintenanceDivisor;
        finance.maintenanceCatalogue = finance.purchase / MGT2.ShipCosts.maintenanceDivisor;
        finance.carried = carried;

        finance.mortgage = finance.mortgageOverride
            ?? (finance.purchase / MGT2.ShipCosts.mortgageDivisor);
        finance.mortgageDerived = finance.purchase / MGT2.ShipCosts.mortgageDivisor;

        // Core p.154 bills life support three times over: per stateroom, again per person NOT in a
        // low berth, and a tenth of that per occupied low berth — which is why `awake` excludes them.
        const staterooms = this.staterooms.standard + this.staterooms.high + this.staterooms.luxury;
        const awake = this.crewTotals.aboard + this.passengers.high + this.passengers.middle
            + this.passengers.basic;
        finance.lifeSupport = (staterooms * MGT2.ShipCosts.lifeSupportPerStateroom)
            + (awake * MGT2.ShipCosts.lifeSupportPerPerson)
            + (this.passengers.low * MGT2.ShipCosts.lifeSupportPerLowBerth);

        finance.salaries = this.crewTotals.salaries;
        finance.fuel = this.fuel.tons
            * (this.fuel.refined ? MGT2.ShipCosts.fuelRefined : MGT2.ShipCosts.fuelUnrefined);
    }

    /* -------------------------------------------- */
    /*  Document Lifecycle                          */
    /* -------------------------------------------- */

    /**
     * A ship is a shared party asset with one record behind it, so its token is linked — the
     * opposite of a vehicle, of which several of the same model are dropped at once.
     * @inheritDoc
     */
    async _preCreate(data, options, user) {
        if (data.prototypeToken?.actorLink !== undefined) return;
        this.parent.updateSource({ prototypeToken: { actorLink: true } });
    }
}
