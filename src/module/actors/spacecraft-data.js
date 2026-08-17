import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { Rules } from "../rules.js";
import { CraftData } from "./craft-data.js";
import { createModifierField } from "./actor-base-data.js";

const fields = foundry.data.fields;

/** HG p.16: a jump drive is never smaller than this, whatever the percentage works out at. */
const MIN_JUMP_DRIVE_TONS = 10;

/** HG p.19: MCr0.5 per 100 tons of ship, or part of one. */
const BRIDGE_COST_PER_100T = 500000;

// Core p.186 / HG p.52: holographic controls, TL9, +25 % of the bridge cost for DM+2 to Initiative.
const HOLOGRAPHIC_COST_FACTOR = 1.25;
const HOLOGRAPHIC_TL = 9;
const HOLOGRAPHIC_INITIATIVE_DM = 2;

/** Core p.183 and HG p.25 both count a period as four weeks. */
const WEEKS_PER_PERIOD = 4;

/** The power consumers the panel can switch off, in the order the catalogue prints them. */
const POWER_CONSUMERS = ["basic", "mDrive", "jDrive", "sensors", "weapons", "screens", "other"];

/**
 * HG p.111 divides Armour and Hull points by this and never says why: it is the mean of 1D. Fleet
 * combat is Core space combat with the dice taken out, and every quantity in it is the ordinary one
 * divided by the average roll (§9.100).
 */
const FLEET_DIVISOR = 3.5;

/** HG p.110: the Tech Level step every fleet DM adds — +1 at TL12-14, +2 at TL15. */
const FLEET_TL_STEPS = [{ tl: 15, dm: 2 }, { tl: 12, dm: 1 }];

/** HG p.120's Crew column, Severity 3: "Crew Skill score reduced by -1". Core p.170 has no such cell. */
const FLEET_CREW_CRITICAL = { severity: 3, dm: -1 };

/** HG p.113's screen pool: `(Crew Skill + 3.5) x 10` per screen, the 3.5 being the same mean of 1D. */
const SCREEN_MULTIPLE = 10;

/**
 * The jump procedure a NEW hull is created with. A function, because it is read when the document is
 * built rather than when this module loads, and it answers only for a hull that has none stored — an
 * existing ship keeps what it declared and may still differ from the world, so a Companion-built ship
 * can sail a Core campaign (§9.97).
 *
 * The guard is what lets the schema be cleaned outside a running world, where the pack tools validate
 * generated hulls against it and no setting is registered.
 */
function initialRuleset() {
    return game.settings?.settings?.has("mgt2.rule.jumpRuleset")
        ? Rules.get("jumpRuleset") : "core";
}

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

        /**
         * A formula is a default; a printed statblock is data (§4.1). Every figure this type
         * derives and the books also print per-ship gets one of these: `null` derives, a value is
         * what the book says, and the sheet says which is in force. Transcription is the dominant
         * use of the type, and 24 of the 260 published ships whose card prints hull points disagree
         * with the derivation — several of them the books' own arithmetic rather than misreads.
         *
         * `min: 0` states a rule and not a convenience (§1.12): no book prints a negative tonnage,
         * cost or pool. There is deliberately NO `max` and no `integer` — a `NumberField` cleans
         * before it validates, so a bound rounds or clamps a legal printed value away with no error
         * at all (`common/data/fields.mjs`, `_cleanType`: `if ( this.integer ) value = Math.round(value)`).
         */
        const printed = () => new fields.NumberField({
            required: false, nullable: true, min: 0, initial: null });

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
                shipClass: new fields.StringField({ required: false, blank: true, trim: true }),
                // The one figure of the six a book prints as a countable pool rather than as a
                // measured quantity, and `characteristics.hull.max` is summed from it — so a
                // fraction here would leave the ship a fractional hull and a fractional token bar.
                pointsOverride: new fields.NumberField({
                    required: false, nullable: true, integer: true, min: 0, initial: null })
            }),

            // Bought per point of Protection as a percentage of hull tonnage (HG p.12-13); the
            // tonnage, the cost and the cap all derive from the material and the count. `damage` is
            // the wound criticals inflict on it, stored for the same reason every other wound is.
            armour: new fields.SchemaField({
                material: new fields.StringField({
                    required: false, blank: false, initial: "titaniumSteel", choices: MGT2.ArmourMaterials }),
                points: count(0),
                damage: count(0),
                tonsOverride: printed()
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
                available: new fields.NumberField({ required: false, nullable: false, initial: 0 }),
                // The panel's bottom line AT FULL POWER, which is what a catalogue entry prints:
                // switching a consumer off is play state and goes on subtracting its own derived
                // draw from whichever figure is in force. `plant` above needs no twin — the output
                // is stored outright, which is the shape §4.1 asks for arrived at from the start.
                drawOverride: printed()
            }),

            fuel: new fields.SchemaField({
                tons: tons(0),
                refined: new fields.BooleanField({ required: false, initial: true }),
                // Weeks of power-plant operation the tank is sized for, printed on every catalogue
                // entry beside the jump rating.
                weeks: count(WEEKS_PER_PERIOD),
                // Displaces the DESIGN tonnage a jump at the rated range needs, which is the figure
                // the catalogue prints; `jumpFuel(parsecs)` goes on charging Core p.157's flat 10 %
                // per parsec, because that is consumption and no card states it.
                jumpTonsOverride: printed()
            }),

            bridge: new fields.SchemaField({
                type: new fields.StringField({
                    required: false, blank: false, initial: "standard", choices: MGT2.BridgeTypes }),
                tonsOverride: printed(),
                // In Credits, like every other cost on this type — HG prices a bridge in MCr0.5
                // steps and `BRIDGE_COST_PER_100T` is that in full.
                costOverride: printed(),
                // Core p.186 / HG p.52: an option on any bridge rather than a type of its own —
                // +25 % of the bridge cost, no tonnage, TL9, and DM+2 to Initiative.
                holographic: new fields.BooleanField({ required: false, initial: false })
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

            // HG p.110: "the average skill level of the crew across all duties and positions" — and
            // it is TYPED, not averaged. The roster below is a list of stations rather than of
            // people, so it cannot produce the number: the Pantheress is crewed in the thousands and
            // printed at Crew Skill 1. `crewSkillObserved` derives beside it as a hint, which is
            // §9.20's shape and the deliberate inverse of §9.93's overrides (§9.100 B1). Stored
            // whatever the fleet-battles switch says, so a table that tries the chapter for a month
            // and drops it does not lose what it typed on forty ships.
            crewSkill: count(0),

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
                // **Per craft, not for the bay** (§4.7, §9.95): what one of them costs the hull, so
                // the row consumes `count × capacity`. A carrier's clamps are identical and its
                // fighters are one Actor, which is the whole reason `count` exists.
                capacity: tons(0),
                // §4.7: the Indigo class flies ten light fighters off ten clamps, and one entry per
                // craft makes that ten rows differing only in a name the referee had to invent —
                // which is a live request against `mgt2e`, where the same limit forces ten
                // separately-named Actors. `min: 1` and not the shared `count()` helper, whose floor
                // is 0: a bay of nothing is a bay with no craft in it, and `craft: null` already
                // says that. A typed 0 therefore CLEANS to 1 rather than erroring (§1.12).
                count: new fields.NumberField({
                    required: false, nullable: false, integer: true, min: 1, initial: 1 }),
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
                    required: false, nullable: true, min: 0, initial: null }),
                // Core p.149: every Benefit roll of the same ship pays off a quarter, to outright
                // ownership at four (§9.40). It elects nothing on its own — it is what makes the
                // page's two elections computable, and either one answers through the override.
                benefitQuarters: new fields.NumberField({
                    required: false, nullable: false, min: 0, max: 4, integer: true, initial: 0 }),
                // Periods already paid. The referee types it and NOTHING here writes it (§9.35) —
                // the same shape as the Study Period counter and the campaign day.
                periodsPaid: new fields.NumberField({
                    required: false, nullable: false, min: 0, integer: true, initial: 0 }),
                // Core p.153's two persistent properties of a skip: the distance run, which the folio
                // resets "every time the Travellers are discovered", and what has been done to the
                // hull to disguise it. Only the skip check writes them, and only when the referee
                // rolls one — nothing accumulates either on its own.
                skipParsecs: new fields.NumberField({
                    required: false, nullable: false, min: 0, integer: true, initial: 0 }),
                // POSITIVE, 0-6: how much the ship has been altered. The folio's "-1 to -6" is the
                // ladder's business, so a referee never types a minus sign to mean an advantage.
                skipDisguise: new fields.NumberField({
                    required: false, nullable: false, min: 0, max: 6, integer: true, initial: 0 })
            }),

            // A free string nobody reads, kept deliberately (§9.33.10 q3). Anything that RESOLVES a
            // world goes through `voyage` below, never through this.
            homeport: new fields.StringField({ required: false, blank: true, trim: true }),

            // THE LEG, and not an ordered array of stops: exactly one set of parsecs exists at a
            // time, so nothing can chain on a previous leg and there is no index to shift. Advancing
            // is `next` → `here` and the head of `queue` → `next`, on a button and never on a roll
            // (§9.33.2, §9.33.10 Q4). The nullable uuid beside a bare name is `crew[]`'s degradation
            // pattern: no content ships, so the world Actor may simply not exist yet.
            voyage: new fields.SchemaField({
                here: new fields.SchemaField({
                    world: new fields.DocumentUUIDField({
                        type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
                    name: new fields.StringField({ required: false, blank: true, trim: true })
                }),
                next: new fields.SchemaField({
                    world: new fields.DocumentUUIDField({
                        type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
                    name: new fields.StringField({ required: false, blank: true, trim: true }),
                    // A property of the PAIR, typed by hand: no stored coordinate can compute it, and
                    // `hex` is deliberately not in the schema (§9.33.5). Core p.157 counts anything
                    // under a parsec as jump-1 for both the Astrogation DM and the fuel.
                    parsecs: count(1)
                }),
                // Names and references, NOTHING else — no parsecs, no index, no note. The deletion
                // test files the queue as a note, and no arithmetic anywhere may read it.
                queue: new fields.ArrayField(new fields.SchemaField({
                    world: new fields.DocumentUUIDField({
                        type: "Actor", embedded: false, required: false, nullable: true, initial: null }),
                    name: new fields.StringField({ required: false, blank: true, trim: true })
                }), { initial: [] }),
                // Stored per hull, because the screen that shows it reads one hull and a jump
                // procedure is a property of the drive being fired (§9.33.10 Q1). The world supplies
                // only the value a NEW hull starts at, so the two never contradict: a Companion-built
                // ship can sail a Core campaign (§9.97).
                ruleset: new fields.StringField({
                    required: false, blank: false, initial: initialRuleset,
                    choices: MGT2.JumpRulesets })
            }),

            // One scalar (Core p.154-155). `periodsSkipped` was the second until §9.33.10 Q4 declined
            // it outright, and with it the Poor Maintenance 2D/8+ roll and the Engineer's DM−1 per
            // month behind: skipped maintenance stays on paper.
            ops: new fields.SchemaField({
                // The REAL level, distinct from `fuel.tons` — which is design tonnage summed into the
                // hull budget and the divisor of `jumpCapacity`. Nothing can recompute it, so it is
                // debited ATOMICALLY with the Jump button or it is wrong at the first forgotten jump.
                fuel: tons(0)
            })
        });

        // HG p.120's Crew critical and p.121's Radiation both take Crew Skill down, so §9.100 B1's
        // accumulator finally has a writer and is declared here rather than in `ActorBaseData` — no
        // other Actor type has a Crew Skill to modify. `extendFields` is v14's own door for this
        // (`common/data/fields.mjs`, `extendFields(fields) { Object.assign(this.fields, …)`), and
        // reconstructing the SchemaField instead would throw: `_initialize` refuses a field that
        // "already belongs to some other parent and may not be reused".
        schema.modifiers.extendFields({ crewSkill: createModifierField() });
        return schema;
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /**
     * HG p.10-12: tons per point by size band, then the configuration and hull options.
     *
     * The modifiers are percentages of the ship's Hull points, so they apply to the exact figure and
     * the result is rounded down once. Rounding down before them as well costs a point wherever the
     * tonnage is not a whole multiple of the band's rate: High Guard prints 183,333 for the
     * 250,000-ton reinforced Fleet Carrier, which reads 183,332 when the base is floored first. A
     * hull carrying no modifier is unaffected either way.
     */
    get hullPoints() {
        const tons = this.hull.tons;
        if (!(tons > 0)) return 0;
        const config = MGT2.HullConfigurations[this.hull.configuration];
        let points = tons / band(MGT2.HullPointRates, tons).tonsPerPoint;
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

    /**
     * Core p.186 / HG p.52: holographic controls "add +25% to the cost of the bridge" — the bridge's
     * own cost, so it multiplies a cockpit's flat price and a command deck's `addCost` alike, and
     * consumes no tonnage, which is why `bridgeTons` says nothing about it.
     */
    get bridgeCost() {
        const type = MGT2.BridgeTypes[this.bridge.type];
        const holographic = this.bridge.holographic ? HOLOGRAPHIC_COST_FACTOR : 1;
        if (type?.cost !== undefined) return type.cost * holographic;
        const cost = Math.ceil(this.hull.tons / 100) * BRIDGE_COST_PER_100T;
        return ((cost * (type?.costFactor ?? 1)) + (type?.addCost ?? 0)) * holographic;
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

    /**
     * Which mounts NAME a weapon and resolve none — the state §9.106 found by fighting a hand-built
     * Pantheress and reading `0/1` on every battery.
     *
     * **A label carries a class and never a quantity, and that is why the two halves of fleet combat
     * disagree about it.** Defence is counted by class off `MGT2.FleetDefences` — HG p.113 prices a
     * *sandcaster* as a sandcaster — so `#mountText`'s fall back to the label is correct and the
     * printed 600/300/220/300 came out of it. An attack needs a **die count**, which no name can
     * supply and which this system cannot look up: it ships no weapon content and §9.36 makes that
     * permanent. So a labelled mount is genuinely half-armed, and the half that is missing is the
     * half that is silent.
     *
     * Surfaced and never blocked, on `unmounted`'s model (§9.26): a half-filled ship is as common as
     * a mistake, and typing the label first is how a referee transcribes a printed statblock.
     * @returns {boolean[]}   One per mount, in roster order
     */
    get mountsInert() {
        return this.mounts.map(mount => {
            const arms = (mount.weapons ?? []).some(id => this.parent?.items?.get(id));
            return !arms && Boolean(mount.label?.trim());
        });
    }

    /** How many mounts say something and shoot nothing — the panel's count and the block's warning. */
    get inertMountCount() {
        return this.mountsInert.filter(Boolean).length;
    }

    /**
     * HG p.18: what the tank has to hold to reach the rated range — the ship's jump number is in
     * it, so this is design tonnage and NOT what a jump burns. Read as consumption it over-burns by
     * a factor equal to the rating, which is why the two names differ (§9.33.7 a).
     */
    get fuelPerMaxJump() {
        return this.hull.tons * MGT2.ShipFuel.jumpFraction * this.drives.jump;
    }

    /** Core p.157: consumption is flat — 10% of the hull per parsec, whatever the drive is rated. */
    get fuelPerParsec() {
        return this.hull.tons * MGT2.ShipFuel.jumpFraction;
    }

    /**
     * What a jump of `parsecs` actually costs. Core p.157: "jumps of less than one parsec count as
     * jump-1 for both the Astrogation DM and fuel", so the floor is printed and not defensive.
     * @param {number} parsecs
     * @returns {number}
     */
    jumpFuel(parsecs) {
        return this.fuelPerParsec * Math.max(1, Math.trunc(parsecs) || 0);
    }

    /**
     * The referee's clock, and the only writer of the leg: `next` becomes `here` and the head of
     * `queue` becomes `next`, in ONE update. No index is shifted and no neighbour is read, so
     * deleting a stop can never silently move the ship — which is the whole reason a voyage is a
     * leg rather than an ordered array (§9.33.2). No roll reaches this and nothing schedules it
     * (§9.35); the fuel is untouched, because the debit is atomic with the Jump button (§9.33.7 f)
     * and a leg arrived at has already been paid for.
     * @returns {Promise<Actor|null>}   null when there is nowhere to go, which is a legal state
     */
    async advanceLeg() {
        const voyage = this.voyage;
        if (!voyage.next.world && !voyage.next.name) return null;
        const queue = voyage.queue.map(stop => ({ ...stop }));
        const head = queue.shift() ?? { world: null, name: "" };
        return this.parent.update({
            system: {
                voyage: {
                    here: { world: voyage.next.world, name: voyage.next.name },
                    // Back to the printed minimum: parsecs is a property of the PAIR, and the new
                    // pair is one nobody has typed a distance for yet. Carrying the old count over
                    // would state a measured distance between two worlds nobody measured.
                    next: { world: head.world, name: head.name, parsecs: 1 },
                    queue
                }
            }
        });
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

    /**
     * Every bay holding a craft, resolved where the document is already in memory (§4.6), **as
     * `{actor, count}` pairs and not as a list of Actors** (§9.95). Ten fighters on ten clamps are
     * one Actor referenced once with `count: 10`, so a caller that wants a cost or a head count has
     * to multiply — and one that wants the distinct craft, as a roster does, reads `actor` and gets
     * one row rather than ten identical ones. That is the whole point of the field.
     * @type {{actor: Actor, count: number}[]}
     */
    get carriedCraft() {
        const craft = [];
        for (const bay of this.bays) {
            if (!bay.craft) continue;
            // fromUuidSync only answers for documents already loaded: a compendium craft degrades
            // to its bay rather than throwing.
            let actor = null;
            try { actor = foundry.utils.fromUuidSync(bay.craft); } catch { actor = null; }
            if (actor) craft.push({ actor, count: Math.max(1, bay.count) });
        }
        return craft;
    }

    /**
     * How many small craft the ship carries — the Crew Requirements table counts these twice. Every
     * craft and not every bay: a clamp rack of ten fighters is ten craft to crew (§9.95).
     */
    get smallCraftCount() {
        return this.bays.reduce((sum, bay) =>
            sum + (bay.craft ? Math.max(1, bay.count) : 0), 0);
    }

    /** What the bays cost the hull: each row is `count × capacity`, capacity being per craft. */
    get bayTons() {
        return this.bays.reduce((sum, bay) => sum + (Math.max(1, bay.count) * bay.capacity), 0);
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

    /**
     * The rating of a named software package fitted to this ship — `Evade/2` answers `evade` with 2.
     *
     * Ship software is a `component` Item of category `software`, and `ComponentData.rating` already
     * IS the rating: no new field, and the work was in the content rather than the schema (§9.100
     * B2). `item`/`software` is deliberately not read — that carrier is PERSONAL software, and every
     * ship the packs ship carries its programs as components.
     *
     * @param {string} key   A key of `MGT2.ShipSoftware`
     * @returns {number} The highest rating fitted, or 0
     */
    softwareRating(key) {
        const entry = MGT2.ShipSoftware[key];
        if (!entry) return 0;
        let best = 0;
        for (const item of this.parent?.items ?? []) {
            if ((item.type !== "component") || (item.system.category !== "software")) continue;
            const name = SpacecraftData.#plainName(item.name);
            if (!entry.names.some(match => name.includes(match))) continue;
            if (entry.unless?.some(match => name.includes(match))) continue;
            best = Math.max(best, item.system.rating ?? 0);
        }
        return best;
    }

    /**
     * Everything a mount says about what is bolted to it: the linked weapons where a world has
     * linked any, and the mount's own label otherwise. **The label is the carrier the content
     * uses** — `mounts[].weapons` is empty on all 341 packed hulls and the weapon is printed in the
     * label — so a fleet-defence class is recognised by name, which is §9.75's rule.
     */
    #mountText(mount) {
        const weapons = (mount.weapons ?? [])
            .map(id => this.parent?.items?.get(id)?.name).filter(name => name);
        return SpacecraftData.#plainName(weapons.length ? weapons.join(", ") : mount.label);
    }

    /**
     * How many of a mount's weapon slots each entry of its label claims. A label lists its weapons
     * inside brackets — `Triple Turret (missile racks x 2, sandcaster)` — so an `xN` beside an entry
     * is that entry's own count and whatever is left divides evenly among the rest, remainder to the
     * first. Only a per-weapon class needs this: HG p.113 counts laser TURRETS and repulsor BAYS,
     * where the class merely has to be named.
     * @returns {{text: string, count: number}[]}
     */
    static #mountShares(text, slots) {
        const inside = /\(([^)]*)\)/.exec(text);
        const entries = (inside?.[1] ?? text).split(",").map(part => part.trim()).filter(part => part);
        if (entries.length <= 1) return [{text: entries[0] ?? text, count: slots}];

        const shares = entries.map(entry => {
            const stated = /\bx\s*(\d+)\b/.exec(entry);
            return {text: entry, count: stated ? Number(stated[1]) : null};
        });
        const unstated = shares.filter(share => share.count === null);
        let left = Math.max(0, slots - shares.reduce((sum, share) => sum + (share.count ?? 0), 0));
        for (const [index, share] of unstated.entries()) {
            const each = Math.floor(left / (unstated.length - index));
            share.count = (index === 0) ? left - (each * (unstated.length - 1)) : each;
            left -= share.count;
        }
        return shares;
    }

    /**
     * HG p.113's salvo-defence inventory, counted off the hull once. What each row is worth in
     * points is `MGT2.FleetDefences`; what depends on Crew Skill is deliberately NOT folded in here,
     * because Morale changes that figure per round for every ship in a fleet (p.122) — so the laser
     * term is stored as its two halves and multiplied at the point of use.
     */
    #fleetCounts() {
        const defences = MGT2.FleetDefences;
        const counts = {pointDefence: 0, repulsors: 0, laserTurrets: 0, laserBonus: 0, sandcasters: 0};

        for (const [index, mount] of this.mounts.entries()) {
            const shape = this.mountClasses[index];
            const text = this.#mountText(mount);
            const named = key => defences[key].names.some(name => text.includes(name));

            // HG p.40's batteries are designated by Type and nothing else in the ship-weapon
            // vocabulary is, so a bare `Type III` on a mount naming no other class is one.
            const roman = /\btype\s*(iii|ii|i)\b/.exec(text)?.[1];
            const others = ["laser", "repulsor", "sandcaster"].some(named);
            if (roman && (named("pointDefence") || !others)) {
                counts.pointDefence += defences.pointDefence.types[roman] ?? 0;
            }

            if (shape.turret && named("laser")) {
                counts.laserTurrets++;
                counts.laserBonus += defences.laser.perMount[mount.type] ?? 0;
            }
            if (named("repulsor")) counts.repulsors += defences.repulsor.perMount[mount.type] ?? 0;

            if (shape.turret && named("sandcaster")) {
                counts.sandcasters += SpacecraftData.#mountShares(text, shape.weapons ?? 1)
                    .filter(share => defences.sandcaster.names.some(name => share.text.includes(name)))
                    .reduce((sum, share) => sum + share.count, 0);
            }
        }

        // p.113's electronic-warfare base: "divide the number of sensor operators by three, rounding
        // up". A station stands for however many bodies `count` says, which is what the roster holds.
        counts.sensorOperators = this.crew.reduce((sum, station) =>
            sum + ((this.parent?.items?.get(station.role)?.system.crewRoleKey === "sensorOperator")
                ? station.count : 0), 0);
        counts.screens = Object.fromEntries(Object.keys(MGT2.ShipScreens).map(key => [key,
            this.screens.reduce((sum, row) => sum + ((row.type === key) ? row.count : 0), 0)]));
        return counts;
    }

    /**
     * HG p.113's DEFENCES panel at a stated Crew Skill — the ship's own for the sheet, and the
     * per-round figure Morale and Radiation leave for the battle (p.121, p.122). One function and
     * two callers, because the two must never disagree.
     *
     * `radiation` is p.121's fraction struck off the laser, repulsor and electronic-warfare terms;
     * the table does not name point defence and neither does this.
     * @param {number} crewSkill
     * @param {object} [options]
     * @param {number} [options.radiation]   0-1, the fraction lost
     * @returns {object|null}                null while the rule is off
     */
    fleetDefences(crewSkill, {radiation = 0} = {}) {
        const counts = this.fleet?.counts;
        if (!counts) return null;
        const skill = Math.max(0, crewSkill);
        const keep = value => Math.floor(value * (1 - Math.min(1, Math.max(0, radiation))));

        const lasers = keep((counts.laserTurrets * skill) + counts.laserBonus);
        const repulsors = keep(counts.repulsors);
        const ew = keep(Math.ceil(counts.sensorOperators / 3)
            * (skill + this.softwareRating("electronicWarfare")));
        // p.113: "add Crew Skill score to 3.5, multiply that by 10 and then multiply […] by the
        // number of screens" — the same mean-of-1D the rest of the chapter divides by (§9.100).
        const screen = key =>
            Math.floor((skill + FLEET_DIVISOR) * SCREEN_MULTIPLE * counts.screens[key]);

        return {
            pointDefence: counts.pointDefence, lasers, repulsors, ew,
            salvo: counts.pointDefence + lasers + repulsors + ew,
            mesonScreen: screen("mesonScreen"), nuclearDamper: screen("nuclearDamper"),
            sandcasters: counts.sandcasters,
            // p.121: "twice its Crew Skill score plus its Auto-Repair score", per round.
            repairPoints: (2 * skill) + this.softwareRating("autoRepair")
        };
    }

    /** HG p.119's Sandcaster Effectiveness — the only pool an opposing ship is a term of. */
    sandcasterPool(crewSkill, defensive, against = 0) {
        const total = this.fleet?.counts.sandcasters ?? 0;
        const score = crewSkill + defensive - against;
        const row = MGT2.SandcasterEffect.find(entry => (entry.min === null) || (score >= entry.min));
        return {score, multiplier: row.multiplier, points: Math.floor(total * row.multiplier)};
    }

    /** The fourth accumulator is this type's own, and `prepareBaseData` resets it through here. */
    get modifierAccumulators() {
        return [...super.modifierAccumulators, this.modifiers.crewSkill];
    }

    /**
     * HG p.111's five ship Traits, read off the fittings its own table names as their requirements.
     * `traits.js` gains no ship family for them: every row of the printed table is a component, a
     * program or a coating the design already carries, so a fleet Trait is a reading of the ship and
     * never a second place to type one.
     */
    #fleetTraits() {
        const fitted = [];
        for (const item of this.parent?.items ?? []) {
            if (item.type === "component") fitted.push(SpacecraftData.#plainName(item.name));
        }
        const carried = ([key, entry]) => (entry.software
            ? (this.softwareRating(entry.software) > 0)
            : fitted.some(name => entry.names.some(match => name.includes(match))));
        return Object.entries(MGT2.FleetTraits).filter(carried)
            .map(([key, entry]) => ({ key, label: entry.label }));
    }

    /** Lower-cased and stripped of diacritics, so `Evitement` answers for `Évitement` (§9.75). */
    static #plainName(name) {
        return String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    /**
     * Which of §4.1's figures the book is answering for rather than the formula. A READ over the
     * six stored fields and never a write: the sheet marks what is in force, and no derivation
     * anywhere may put a number into an override.
     * @returns {Record<string, boolean>}
     */
    get printedFigures() {
        return {
            hullPoints: this.hull.pointsOverride !== null,
            armourTons: this.armour.tonsOverride !== null,
            bridgeTons: this.bridge.tonsOverride !== null,
            bridgeCost: this.bridge.costOverride !== null,
            jumpTons: this.fuel.jumpTonsOverride !== null,
            powerDraw: this.power.drawOverride !== null
        };
    }

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /**
     * Hull points are a derivation and not a transcription, so they land in `auto` exactly as a
     * species modifier does — and here, before the base clears it, because `prepareDerivedData`
     * reads `auto` on its first line.
     *
     * Unless the book said otherwise: §4.1's override is read here and nowhere else, which is what
     * finally gives the printed figure something to displace.
     * @inheritDoc
     */
    prepareBaseData() {
        super.prepareBaseData();
        this.characteristics.hull.auto = this.hull.pointsOverride ?? this.hullPoints;
        // Here and not in `#prepareSystems`, which runs after `sumModifiers` has already totalled
        // the accumulator — the §9.94 trap one layer up. `auto` is assigned, so a second holographic
        // source would have to join this line rather than add to it.
        this.modifiers.initiative.auto = this.bridge.holographic ? HOLOGRAPHIC_INITIATIVE_DM : 0;
    }

    /** @inheritDoc */
    prepareDerivedData() {
        super.prepareDerivedData();

        this.criticalEffects = this.#foldCriticals();
        // Here and not in `#prepareFleet`, which is a reader: §9.94's ordering rule makes every
        // accumulator total before anything in `prepareDerivedData` reads one. `auto` is assigned,
        // so a second writer — HG p.121's Radiation is the one coming — joins this line.
        this.modifiers.crewSkill.auto = this.criticalEffects.crewSkill;
        this.sumModifiers();
        this.#prepareArmour();
        this.#prepareDrives();
        this.#prepareSystems();
        this.#preparePower();
        this.#prepareTonnage();
        this.#prepareComputer();
        // After the power, tonnage and hardpoint budgets: the design check reads all three, and
        // reads them rather than recomputing them (§9.92).
        this.#prepareComponents();
        // Before the crew: the steward requirement is read off the bookings when there are any.
        this.#prepareManifest();
        this.#prepareCrew();
        this.#prepareManoeuvre();
        this.#prepareFinance();
        // After the armour, the hull pool and the crew: every figure it prints is one of theirs
        // divided by 3.5, and it reads them rather than recomputing them.
        this.#prepareFleet();

        // Core p.165: 2D + the pilot's Pilot skill + the ship's CURRENT Thrust, so an M-Drive
        // critical feeds initiative directly. The manifest formula stays `2d6 + @initiative`.
        // The standing accumulator rides it because the books print one: Core p.186 and HG p.52
        // give a Holographic Controls bridge "DM+2 when rolling for Initiative" (§9.94).
        this.initiative = this.pilotSkill + this.drives.effectiveThrust
            + this.modifiers.initiative.dm;
    }

    /**
     * The standing criticals as numbers. Only the cells naming an integer are folded: a `1D` fuel
     * leak or a `D3` weapon explosion is a roll the referee makes when the critical lands, and this
     * is the continuing state rather than the moment of the hit.
     */
    #foldCriticals() {
        const totals = {
            powerFactor: 1, thrustLoss: 0, thrustZero: false,
            sensorDM: 0, controlDM: 0, jumpDM: 0, sensorRange: undefined, jump: null,
            crewSkill: 0
        };
        for (const location of this.criticalLocations) {
            const cell = this.criticalEffect(location);
            if (!cell) continue;
            // HG p.120's Crew column carries a rider Core p.170's does not: at Severity 3 the cell
            // reads "3D% of crew take 3D damage. Crew Skill score reduced by -1." It is printed once
            // and kept from there up, because p.121 climbs a location one step at a time — a ship at
            // Severity 5 has been through 3 and its crew are still short. `MGT2.ShipCriticals` is
            // Core's table and stays Core's; the rider lives here, where the fleet chapter puts it.
            if ((location === "crew") && (this.criticals.crew >= FLEET_CREW_CRITICAL.severity)) {
                totals.crewSkill += FLEET_CREW_CRITICAL.dm;
            }
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
        armour.tons = armour.tonsOverride ?? this.armourTons;
        // Off the tonnage in force rather than off the formula: a printed tonnage that did not
        // carry its cost with it would leave the two halves of one row disagreeing.
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
        this.bridge.tons = this.bridge.tonsOverride ?? this.bridgeTons;
        this.bridge.cost = this.bridge.costOverride ?? this.bridgeCost;
        this.bridge.dm = bridge?.dm ?? 0;
        this.bridge.tacticsDM = bridge?.tacticsDM ?? 0;
        // A readout, not a gate: the DM is already in `modifiers.initiative.auto`. HG p.52 makes
        // holographic controls TL9, and a ship below it is a transcription the sheet flags rather
        // than refuses — the same call §9.92 made for every other design rule.
        this.bridge.holographicUnderTL = this.bridge.holographic && (this.tl < HOLOGRAPHIC_TL);

        this.fuel.jumpTons = this.fuel.jumpTonsOverride ?? this.fuelPerMaxJump;
        this.fuel.parsecTons = this.fuelPerParsec;
        this.fuel.plantTons = this.fuelPerPeriod;
        // Jumps at the RATED range, which is the only ratio the design tonnage answers, and it
        // divides by the tonnage IN FORCE — a printed jump tank that the ratio ignored would put a
        // figure on the sheet contradicting the one printed beside it. Nothing derives off
        // `ops.fuel` here: §9.33.3 keeps "can I make THIS jump" a screen comparison, so the real
        // level is never divided by a tank figure.
        this.fuel.jumpCapacity = this.fuel.jumpTons > 0
            ? Math.floor(this.fuel.tons / this.fuel.jumpTons) : 0;

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

        // Rounded at the source, because `requirements` and `rows` publish the SAME seven numbers
        // and one of them was raw: a 24-ton hull draws 4.800000000000001 for basic systems, and
        // summing those reached the header as a surplus of -0.3999999999999986. §1.12 puts the
        // rounding in one place, and the one place is where the number is made.
        const round = value => Math.round(value * 100) / 100;
        for (const key of POWER_CONSUMERS) requirements[key] = round(requirements[key]);

        const offline = this.power.offline;
        let full = 0, shed = 0;
        const rows = POWER_CONSUMERS.map(key => {
            const draw = requirements[key];
            const powered = !offline.has(key);
            full += draw;
            if (!powered) shed += draw;
            return { key, draw, powered };
        });

        // §4.1's override displaces the panel's bottom line at FULL power, which is the figure a
        // catalogue prints. What a consumer taken offline frees is still its own derived draw, so
        // the panel keeps the state that makes it a panel (Core p.171) whichever figure is in force.
        // Summing seven 2dp figures drifts again, so each total is rounded where it is published.
        const printed = this.power.drawOverride;
        const total = round(Math.max(0, (printed ?? full) - shed));

        // A damaged plant is a percentage of its rating (Core p.170); `available` is declared in the
        // schema so a `final`-phase Active Effect on it is coerced rather than written raw.
        this.power.available = Math.floor(this.power.plant * this.criticalEffects.powerFactor);
        this.power.requirements = Object.assign(requirements, { total });
        this.power.rows = rows;
        this.power.surplus = round(this.power.available - total);
        // What the formula makes of the design with everything on — the quantity `drawOverride`
        // stands in for, and the figure the edit form prompts with.
        this.power.fullDraw = round(full);
    }

    /**
     * The tonnage budget, derived row by row from the stored ratings rather than summed from
     * component Items — which is the whole of §4.1's argument, and the reason a ship with no items
     * still balances.
     *
     * **`component` Items are not a row here and never will be** (§9.92). An earlier draft of this
     * comment promised them an `other` row; it was wrong in the way that matters, because a
     * transcribed M-Drive component and the ship's own `drives.mDrive` are the same tons written
     * twice, and `budget.free` would move with the parts list. The parts are a SECOND OPINION on
     * this budget — `#prepareComponents` compares the two and says where they disagree.
     */
    #prepareTonnage() {
        const mounts = this.mountClasses.reduce((sum, type) => sum + (type.tons ?? 0), 0);
        const bays = this.bayTons;
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

    /**
     * The parts list, and whether the design it describes balances — §6.2's "expensive half", which
     * `DOCUMENT-TYPES.md` §10 rated the whole type L for (§9.92).
     *
     * **Every check is a red line and never a block.** Published ships fail these: the Core's own
     * catalogue disagrees with its own construction chapter often enough that a validator refusing
     * to store a failing design would make transcription impossible. Same call §9.20 made for
     * `crew.required` — a derivation with a printed competitor is advisory.
     *
     * **And every check declares whether it APPLIES.** A parts list is a transcription and may be
     * partial: a ship with no fuel row transcribed is not a ship short of fuel, it is a ship whose
     * fuel row nobody typed. A check with nothing to read is silent rather than green, which is the
     * one thing `sketch-component.html`'s ledger got wrong — its jump-fuel line failed on a ship
     * with no components at all and needed a `mode === 'none'` escape to hide it.
     */
    #prepareComponents() {
        const hullTons = this.hull.tons;
        const rows = [];
        let tons = 0, cost = 0, draw = 0, generates = 0, weapons = 0, fuel = 0;

        // Which `budget` row each category is the parts-list spelling of. `hull` is the cap rather
        // than a row, and `computer`, `software` and `option` cost the ship no tonnage row at all —
        // so a docking space or a set of common areas is counted against the HULL and never against
        // the budget, which is what keeps the comparison below symmetrical.
        const budgetRow = { armour: "armour", mDrive: "mDrive", jDrive: "jDrive",
            powerPlant: "powerPlant", fuel: "fuel", bridge: "bridge", sensors: "sensors",
            weapon: "mounts", screen: "screens", stateroom: "staterooms", cargo: "cargo" };
        const mapped = new Set();
        let mappedTons = 0;

        for (const item of this.parent.items) {
            if (item.type !== "component") continue;
            const part = item.system;
            const quantity = Math.max(1, part.quantity);
            const row = {
                _id: item.id, name: item.name, category: part.category, tl: part.tl,
                quantity: part.quantity, dm: part.dm, rating: part.rating,
                tons: Math.round(part.tonsFor(hullTons) * 100) / 100,
                // Stored per unit and in MCr (§6.2), so the quantity is applied here and nowhere else.
                cost: Math.round(part.cost * quantity * 1000) / 1000,
                draw: part.drawFor(hullTons),
                generates: part.generates
            };
            rows.push(row);
            tons += row.tons;
            cost += row.cost;
            draw += row.draw;
            generates += row.generates;
            // HG p.26 counts hardpoints against turrets, and a component's `quantity` is how many
            // of that row the design fits.
            if (part.category === "weapon") weapons += quantity;
            if (part.category === "fuel") fuel += row.tons;
            if (budgetRow[part.category]) {
                mapped.add(budgetRow[part.category]);
                mappedTons += row.tons;
            }
        }

        const round = value => Math.round(value * 100) / 100;
        // Core p.157: 10% of hull per parsec, at the drive's full rating — what a full tank has to
        // hold for the ship to make the jump it is rated for.
        const needed = this.jumpFuel(this.drives.jump);
        const fitted = rows.length > 0;
        // The ship's own figure for exactly the rows the parts list covers, and nothing else.
        const budgetTons = this.budget.rows
            .filter(row => mapped.has(row.key)).reduce((sum, row) => sum + row.tons, 0);

        // A table that does not check its designs is offered no ledger at all — the parts list above
        // is a transcription and stays, because it is what the ship carries rather than a verdict on
        // it. On or off the checks remain advisory: nothing here has ever blocked a write (§9.92).
        const checks = !Rules.on("designValidation") ? [] : [
            // The design's own red lines, each read off the parts and nothing else.
            { key: "power", applies: (draw > 0) || (generates > 0),
                ok: draw <= generates, used: round(draw), cap: round(generates) },
            { key: "tonnage", applies: tons > 0, ok: tons <= hullTons,
                used: round(tons), cap: hullTons },
            { key: "hardpoints", applies: weapons > 0, ok: weapons <= this.hardpoints.max,
                used: weapons, cap: this.hardpoints.max },
            { key: "jumpFuel", applies: (fuel > 0) && (this.drives.jump > 0), ok: fuel >= needed,
                used: round(fuel), cap: round(needed) },
            // And the transcription: where the parts disagree with the statblock §4.1 stores. Not a
            // rule of High Guard's — a rule about this system, and the only place the two figures
            // are ever put beside each other.
            //
            // **Only over the categories both sides carry.** A parts list is a transcription and is
            // routinely more detailed than the budget: the Core's own Patrol Corvette lists a
            // docking space, fuel processors and common areas, none of which the ship's budget has
            // a row for, so comparing the totals reports a 47-ton disagreement on a faithful
            // transcription. A red line that fires on correct data is noise (§9.92).
            { key: "statedTons", applies: mapped.size > 0,
                ok: round(mappedTons) === round(budgetTons),
                used: round(mappedTons), cap: round(budgetTons) },
            { key: "statedPower", applies: generates > 0, ok: round(generates) === round(this.power.plant),
                used: round(generates), cap: round(this.power.plant) }
        ];

        this.components = {
            rows, fitted,
            count: rows.length,
            tons: round(tons), cost: Math.round(cost * 1000) / 1000,
            draw: round(draw), generates: round(generates),
            surplus: round(generates - draw),
            weapons, fuel: round(fuel),
            unaccounted: round(hullTons - tons)
        };
        this.design = {
            checks,
            // A check nobody can read is neither passed nor failed, and the count says so.
            failed: checks.filter(check => check.applies && !check.ok).length,
            silent: checks.filter(check => !check.applies).length
        };
    }

    /**
     * What the hold and the berths are actually carrying: the `cargo` and `passage` Items, summed.
     *
     * A ship with none of either is the DEFAULT and not an edge case (§6.3) — `cargo.capacity` and
     * the typed `passengers` counts stand alone, and every figure here has to be reachable at zero.
     * That is also why the bookings replace the typed counts only when at least one exists: a crew
     * that never creates a `passage` Item keeps the hand-typed manifest it has always had, and one
     * that does is never billed for both.
     *
     * A lot cannot be broken up (Core p.241), so `over` is a fact about ONE row: a 63-ton hold and a
     * 70-ton lot is a hold that takes nothing, which a fill bar would report as nearly full.
     */
    #prepareManifest() {
        const booked = {high: 0, middle: 0, basic: 0, low: 0};
        const lots = [];
        let used = 0, freight = 0, speculation = 0, bookings = 0;

        for (const item of this.parent.items) {
            if (item.type === "cargo") {
                const lot = item.system;
                used += lot.tons;
                freight += lot.fare;
                speculation += lot.paid ?? 0;
                lots.push({_id: item.id, name: item.name, tons: lot.tons, fare: lot.fare,
                    speculative: lot.speculative, over: lot.tons > this.cargo.capacity});
            }
            else if (item.type === "passage") {
                const grade = item.system.grade;
                if (grade in booked) booked[grade] += item.system.count;
                bookings++;
            }
        }

        this.cargo.used = Math.round(used * 100) / 100;
        this.cargo.free = Math.round((this.cargo.capacity - used) * 100) / 100;
        this.cargo.over = used > this.cargo.capacity;
        this.cargo.lots = lots;
        this.manifest = {lots: lots.length, bookings, freight, speculation,
            passengers: bookings ? booked : {...this.passengers}};
    }

    /**
     * Core folio 110's four clauses at ship scale. Two cross-references carry them across whole —
     * HG p.20, "the computers installed in a ship work just like personal computers (see the
     * Traveller Core Rulebook page 110)", and Core p.161, "ship software operates in exactly the
     * same way as normal computer software" — so the sum, the downgrade, the Tech Level gate and
     * the count at Processing 0 are all the ship's too (§9.128). Advisory like the character's: a
     * package the ship cannot run is marked and never unbound.
     */
    #prepareComputer() {
        // HG p.20: "the operating Tech Level is that of the starship in which it is installed;
        // therefore, ships can use software limited to the Tech Level of the ship, not the
        // computer" — which is why `computer` carries a Processing score and no TL of its own.
        const hullTL = MGT2Helper.tlNumber(this.tl);
        let used = 0, running = 0, blocked = 0;
        const software = [];
        for (const item of this.parent.items) {
            if ((item.type !== "item") || (item.system.subType !== "software")) continue;
            const program = item.system.software;
            const softwareTL = MGT2Helper.tlNumber(item.system.tl);
            program.tlBlocked = (softwareTL !== null) && (hullTL !== null) && (softwareTL > hullTL);
            if (program.tlBlocked) blocked += 1;
            else {
                used += program.bandwidthRun;
                running += 1;
            }
            software.push({
                _id: item.id, name: item.name,
                bandwidth: program.tlBlocked ? 0 : program.bandwidthRun,
                printed: program.bandwidth,
                downgraded: program.downgraded, tlBlocked: program.tlBlocked
            });
        }
        this.computer.used = used;
        this.computer.software = software;
        this.computer.overload = used > this.computer.processing;
        this.computer.blockedSoftware = blocked;
        // HG's smallest model is a Computer/5, so this only ever fires on a hand-typed 0 — a ship
        // with no working computer, which is the state the clause describes.
        this.computer.overCrowded = (this.computer.processing === 0) && (running > 1);
    }

    /**
     * HG p.23's Crew Requirements table, as the advisory target §9.20 settles it to be: computed,
     * displayed beside the roster, never enforced and never written back. Fractions round up; the
     * `per full` rows floor, because that is what "per full 20 crew" says.
     */
    #prepareCrew() {
        const military = this.role === "military";
        const tons = this.hull.tons;
        const carried = this.bayTons;
        const craft = this.smallCraftCount;
        const drives = this.drives.mDrive + this.drives.jDrive + this.drives.plant;
        const booked = this.manifest.passengers;

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
            // Core p.158: one Steward level per 10 high or 100 middle passengers, off the bookings.
            steward: Math.ceil(booked.high / 10) + Math.ceil(booked.middle / 100),
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
        const passengers = booked.high + booked.middle + booked.basic;
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
        this.crewSkillObserved = this.#observedCrewSkill();
    }

    /**
     * HG p.110's "average skill level of the crew across all duties and positions", as far as a
     * roster of STATIONS can answer it — which is not far, and that is the point (§9.100 B1). A row
     * stands for however many bodies `count` says and carries no skills of its own, so only a station
     * with a linked Actor **and** a role naming a skill can be read at all; everything else is
     * counted as unread rather than averaged in as a zero.
     *
     * Advisory, exactly like `crewRequired` one method up: the stored `crewSkill` wins, and this is
     * the hint beside it. `bodies` is what makes that legible — an average over two of nine hundred
     * crew is a different claim from an average over all of them.
     */
    #observedCrewSkill() {
        let bodies = 0, unread = 0, total = 0;
        for (const station of this.crew) {
            const count = Math.max(1, station.count);
            const role = station.role ? this.parent?.items?.get(station.role) : null;
            // By the role Item's own key and never by its name, which is user text in whatever
            // language the world runs in — the same rule `#pilotSkill` follows.
            const wanted = MGT2.CrewRoles[role?.system.crewRoleKey]?.skill;
            let actor = null;
            if (station.actor) {
                try { actor = foundry.utils.fromUuidSync(station.actor); } catch { actor = null; }
            }
            if (!actor || !wanted) {
                unread += count;
                continue;
            }
            const skill = actor.items?.find(item => (item.type === "talent")
                && (item.system.subType === "skill") && MGT2Helper.matchesSkill(item.name, wanted));
            total += (skill?.system.level ?? 0) * count;
            bodies += count;
        }
        return { level: bodies ? (Math.round((total / bodies) * 10) / 10) : null, bodies, unread };
    }

    /**
     * HG p.110-111's Fleet Ship Sheet, as a readout. The chapter makes the evaluation the
     * prerequisite for everything else in it (p.105), and it is pure arithmetic over figures this
     * type already holds: Armour and Hull points divided by the mean of 1D, half the Crew Skill
     * rounded up, a software rating and the Tech Level step.
     *
     * **The switch gates this and never `crewSkill`** (§9.100 C, §9.97 trap 2). Off, no fleet
     * statblock is computed — the rule stops applying rather than the sheet merely hiding a number
     * somebody typed, which is the test C5 failed.
     */
    #prepareFleet() {
        if (!Rules.on("fleetBattles")) {
            this.fleet = null;
            return;
        }

        // The accumulator and not the stored field: HG p.120's Crew critical takes Crew Skill down
        // and p.121's Radiation takes it down further, and both are standing facts about this ship's
        // company. Morale is neither — p.122 moves it "for that round" for a whole fleet, and §9.100
        // B1 rules it is read off the fleet group at the point of use and never written down here.
        const skill = Math.max(0, this.crewSkill + this.modifiers.crewSkill.dm);
        const half = Math.ceil(skill / 2);
        const tl = FLEET_TL_STEPS.find(step => this.tl >= step.tl)?.dm ?? 0;
        // HG p.73: Advanced Fire Control does not stack with Fire Control, so the pair is a max and
        // not a sum — which is also how p.110 phrases it, "Fire Control or Advanced Fire Control".
        const fireControl = Math.max(this.softwareRating("fireControl"),
            this.softwareRating("advancedFireControl"));
        const evade = this.softwareRating("evade");
        const launchSolution = this.softwareRating("launchSolution");

        const hull = Math.ceil(this.characteristics.hull.max / FLEET_DIVISOR);
        const damage = Math.ceil(this.characteristics.hull.damage / FLEET_DIVISOR);
        const remaining = Math.max(0, hull - damage);
        const fraction = this.constructor.SUSTAINED_FRACTION;

        this.fleet = {
            crewSkill: skill, half, tl,
            // What p.110's typed figure became once the criticals were folded in — printed beside
            // the derived block so a crew reading 1 where the sheet says 2 says why.
            crewSkillTyped: this.crewSkill, crewSkillDM: this.modifiers.crewSkill.dm,
            fireControl, evade, launchSolution,
            // p.111's Traits column, derived from the fittings its own table names (§9.100 A).
            traits: this.#fleetTraits(),
            // p.110 prints the pair slashed, and the two are NOT the same shape: the missile DM
            // starts at nothing, with no Crew Skill term at all.
            offensive: { standard: half + fireControl + tl, missile: launchSolution + tl },
            defensive: half + evade + tl,
            autoRepair: this.softwareRating("autoRepair"),
            armour: Math.ceil(this.protection / FLEET_DIVISOR),
            hull, damage, remaining,
            // p.111's own column, and it is Core p.169's Sustained Damage over a different pool —
            // `SUSTAINED_FRACTION` is that ladder and this reuses it rather than declaring a second.
            thresholds: Array.fromRange(this.sustainedSteps - 1, 1).reverse().map(step => {
                const points = Math.ceil(hull * step * fraction);
                return { percent: Math.round(step * fraction * 100), points, passed: remaining <= points };
            }),
            // Only what is actually fitted: a list of seven packages a ship does not carry is noise.
            software: Object.entries(MGT2.ShipSoftware)
                .map(([key, entry]) => ({ key, label: entry.label, rating: this.softwareRating(key) }))
                .filter(row => row.rating > 0),
            counts: this.#fleetCounts()
        };
        // p.113's DEFENCES panel at the ship's own Crew Skill. Second, because it reads `counts`.
        this.fleet.defences = this.fleetDefences(skill);
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
        // Core p.183 excludes "any other ships it is carrying", so ten fighters are excluded ten
        // times — `carriedCraft` hands back one entry with its count and the multiply is here.
        const carried = this.carriedCraft.reduce((sum, entry) =>
            sum + (entry.count * (entry.actor.system?.finance?.purchase ?? 0)), 0);

        // Authoritative and takes no override (§9.20): p.183's form is the only one that excludes
        // carried craft, and the catalogue's plain cost/12000 therefore bills a carried boat twice.
        finance.maintenance = Math.max(0, finance.purchase - carried) / MGT2.ShipCosts.maintenanceDivisor;
        finance.maintenanceCatalogue = finance.purchase / MGT2.ShipCosts.maintenanceDivisor;
        finance.carried = carried;

        finance.mortgage = finance.mortgageOverride
            ?? (finance.purchase / MGT2.ShipCosts.mortgageDivisor);
        finance.mortgageDerived = finance.purchase / MGT2.ShipCosts.mortgageDivisor;
        this.#prepareMortgageTerm(finance);

        // Core p.154 bills life support three times over: per stateroom, again per person NOT in a
        // low berth, and a tenth of that per occupied low berth — which is why `awake` excludes them.
        const staterooms = this.staterooms.standard + this.staterooms.high + this.staterooms.luxury;
        const aboard = this.manifest.passengers;
        const awake = this.crewTotals.aboard + aboard.high + aboard.middle + aboard.basic;
        finance.lifeSupport = (staterooms * MGT2.ShipCosts.lifeSupportPerStateroom)
            + (awake * MGT2.ShipCosts.lifeSupportPerPerson)
            + (aboard.low * MGT2.ShipCosts.lifeSupportPerLowBerth);

        finance.salaries = this.crewTotals.salaries;
        // Core p.155 prints fuel as a UNIT PRICE and never as a periodic charge, so neither of these
        // belongs beside the five rows above: a full tank per period is an invented quantity
        // (§9.33.7 c). `tankFill` is what filling the design tonnage costs, once.
        finance.fuelPerTon = this.fuel.refined
            ? MGT2.ShipCosts.fuelRefined : MGT2.ShipCosts.fuelUnrefined;
        finance.tankFill = this.fuel.tons * finance.fuelPerTon;
    }

    /**
     * How long the mortgage runs and what it therefore costs — the reading Core p.149 owes and never
     * gives. It prints the payment and the 40-year term and never multiplies them out; p.154 does the
     * division, for maintenance, and counts **twelve** periods in a year. So the term is 480 periods
     * and a mortgage repays **exactly twice** the purchase price. `mortgageFourWeekPeriods` reads
     * p.153's four-week period literally instead (13 a year, 520, x2.17), and every figure below
     * carries its basis to the sheet, because a total whose assumption is hidden cannot be checked
     * against the book (§9.115).
     *
     * p.149's two elections after a career Benefit are told apart by the override alone, and no third
     * field is needed: *continuing* keeps the calculated payment and shortens the term, so it needs no
     * override at all — a null override on a hull with quarters IS the continued mortgage. Anything
     * elected is a re-mortgage, or a referee's own figure, over the full term.
     */
    #prepareMortgageTerm(finance) {
        const costs = MGT2.ShipCosts;
        const perYear = Rules.on("mortgageFourWeekPeriods")
            ? costs.mortgagePeriodsPerYearFourWeek : costs.mortgagePeriodsPerYear;
        const fullTerm = costs.mortgageYears * perYear;
        const quarters = finance.benefitQuarters;
        const shortened = Math.max(0, fullTerm - (quarters * costs.mortgageBenefitYears * perYear));

        finance.periodsPerYear = perYear;
        finance.mortgagePeriods = (finance.mortgageOverride === null) ? shortened : fullTerm;
        finance.mortgageTotal = finance.mortgage * finance.mortgagePeriods;
        // Both read the COST OF THE CREDIT, so both answer nothing when there is no credit — a term
        // paid out to zero by Benefit quarters would otherwise report the whole price as money saved,
        // which is not what the row means. Null rather than 0 for the multiple, on the same ground: a
        // multiple of nothing is not a multiple, and the row drops its gloss rather than print one.
        const running = finance.mortgagePeriods > 0;
        finance.mortgageOvercost = running ? (finance.mortgageTotal - finance.purchase) : 0;
        finance.mortgageMultiple = (running && finance.purchase)
            ? (finance.mortgageTotal / finance.purchase) : null;

        finance.periodsRemaining = Math.max(0, finance.mortgagePeriods - finance.periodsPaid);
        finance.balance = finance.periodsRemaining * finance.mortgage;
        finance.paidFraction = finance.mortgagePeriods
            ? Math.min(1, finance.periodsPaid / finance.mortgagePeriods) : 1;

        // Both elections as suggestions the sheet can apply; each writes (or clears) the override,
        // which stays the only stored answer (§9.13).
        const remortgaged = (finance.purchase * (1 - (costs.mortgageBenefitFraction * quarters)))
            / costs.mortgageDivisor;
        finance.elections = quarters ? {
            keep: { payment: finance.mortgageDerived, periods: shortened,
                total: finance.mortgageDerived * shortened },
            remortgage: { payment: remortgaged, periods: fullTerm, total: remortgaged * fullTerm }
        } : null;
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
