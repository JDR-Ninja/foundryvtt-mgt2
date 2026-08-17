import { MGT2 } from "./config.js";
import { Checks } from "./checks.js";
import { SPACE, SpaceCombatData, STEPS, validPairKey } from "./combat.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const fields = foundry.data.fields;

// A sub-type a SYSTEM declares is not namespaced, so these are the literal strings `system.json`
// and `CONFIG.<Doc>.dataModels` both key on. `FLEET` keys TWO registries — a fleet Combat and a
// fleet CombatantGroup — because HG folio 115's two levels sit one above the `space` sub-type's and
// the word is the same at both (§9.100 B3).
export const FLEET = "fleet";
export const FLEET_SHIP = "fleetShip";
export const SQUADRON = "squadron";
export const SALVO = "salvo";

/** The two things that FIGHT: one hull, or one wing. A salvo is a contact and not one of them. */
export const FLEET_COMBATANTS = Object.freeze([FLEET_SHIP, SQUADRON]);

/** Everything on the chart. Folio 124 tracks salvoes "as if they were ships", which is §9.78's shape. */
export const FLEET_CONTACTS = Object.freeze([...FLEET_COMBATANTS, SALVO]);

/** HG folio 117's tightest operational range, and folio 114's — both worth Defensive DM+1. */
const TIGHT = Object.freeze(["adjacent", "close"]);

/** The plane of battle (folio 117): a fleet spread wider than this is dispersing. */
const PLANE_OF_BATTLE = "short";

/** Folio 117 lets a fleet stray to Medium for one turn "provided they return […] the following turn". */
const SCATTER_GRACE = 1;

/** Folio 122: a dispersal that extracts this few ships is sent back to the standard space rules. */
const SMALL_GROUP = 3;

/** The five pools a round refills (folios 113, 119, 121). One shape, one clear. */
const POOLS = Object.freeze(["salvo", "meson", "damper", "sand", "repair"]);

/** The mean of a list of numbers, or 0 for an empty one. */
function mean(values) {
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

/** A pool counter: spent this round, never negative, cleared when the round turns over. */
function spentField() {
    return new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 });
}

/** The fleet group a Combatant belongs to, read off `_source` so it answers before it prepares. */
function fleetOf(combatant) {
    const id = combatant?._source.group;
    const group = id ? combatant.parent?.groups.get(id) : null;
    return (group?.type === FLEET) ? group : null;
}

/* -------------------------------------------- */

/**
 * A fleet battle (HG folios 105-124). The second engine on the same document family as `space`, and
 * not a mode of it: the round keeps Core folio 164's three step NAMES and changes the content of
 * every one — the mover is a fleet, the attack resolves on a factor instead of a check, and the
 * Actions Step carries dispersal, morale and jumping out (§9.100 C).
 *
 * The two levels shift up by one. A `CombatantGroup` is a FLEET and a `Combatant` is a ship or a
 * squadron, which is forced rather than chosen: `CombatantGroup` has no `group` field, so groups do
 * not nest and "a fleet of ship-groups" is not expressible.
 */
export class FleetCombatData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Folio 115 names the same three steps as Core folio 164, so `STEPS` is shared verbatim
            // — and `reaction` is filtered out of it there for the same reason: no combat is IN it.
            step: new fields.StringField({
                required: true, blank: false, initial: "manoeuvre", choices: STEPS }),
            // Folio 115 measures range between FLEETS, so the pair is two CombatantGroup ids — the
            // same key and the same validator the `space` sub-type uses one level down (§9.100 B3).
            bands: new fields.TypedObjectField(new fields.StringField({
                required: true, blank: false, choices: MGT2.ShipRangeBands
            }), { validateKey: validPairKey })
        };
    }

    /* -------------------------------------------- */

    /** `OPTIONAL-RULES.md` §3.4 D5. Off, the engine refuses to build; the ships keep what they hold. */
    get enabled() {
        return Rules.on("fleetBattles");
    }

    /** The switch, refused out loud — a silent null is the trap, not the gate. */
    #gate() {
        if ( this.enabled ) return true;
        ui.notifications.warn(game.i18n.localize("MGT2.Fleet.RuleOff"));
        return false;
    }

    /** Every fleet in the battle. A fleet is a GROUP, because its ships move as a unit (folio 115). */
    get fleets() {
        return this.parent.groups.filter(group => group.type === FLEET);
    }

    /** Everything on the chart, whichever fleet it flies for — hulls, wings and salvoes in flight. */
    get contacts() {
        return this.parent.combatants.filter(combatant => FLEET_CONTACTS.includes(combatant.type));
    }

    /** The hulls and wings. What morale counts and what a dispersal moves; a salvo is neither. */
    get fighting() {
        return this.parent.combatants.filter(combatant => FLEET_COMBATANTS.includes(combatant.type));
    }

    /** Every salvo still in the air. */
    get salvoes() {
        return this.parent.combatants.filter(combatant => combatant.type === SALVO);
    }

    /* -------------------------------------------- */

    /** The band between two fleets, or null while they have never been placed. */
    bandBetween(a, b) {
        return this.bands[SpaceCombatData.pairKey(a, b)] ?? null;
    }

    /** What that band is worth: the kilometres it spans, its attack DM and what leaving it costs. */
    rangeBetween(a, b) {
        return SpaceCombatData.bandInfo(this.bandBetween(a, b));
    }

    /** Set the band between two fleets, or clear it by passing a falsy band. */
    async setBand(a, b, band) {
        const key = SpaceCombatData.pairKey(a, b);
        if ( !validPairKey(key) ) return this.parent;
        const value = MGT2.ShipRangeBands[band]
            ? band : new foundry.data.operators.ForcedDeletion();
        return this.parent.update({ system: { bands: { [key]: value } } });
    }

    /**
     * Drop every pair a fleet was half of — what a fleet leaving the battle takes with it. The map
     * is read back off the DOCUMENT rather than off `this`: a caller holding a model from before a
     * `setBand` would sweep the keys as they were then and leave the new ones orphaned.
     */
    async clearGroup(group) {
        const id = group?.id ?? group;
        const bands = {};
        for ( const key of Object.keys(this.parent.system.bands) ) {
            if ( key.split("|").includes(id) ) bands[key] = new foundry.data.operators.ForcedDeletion();
        }
        if ( !Object.keys(bands).length ) return this.parent;
        return this.parent.update({ system: { bands } });
    }

    /* -------------------------------------------- */

    /**
     * Put a fleet in the battle. Its name, image, ownership and Initiative are `CombatantGroup`'s
     * own fields, so a fleet declares only what the chapter adds to them.
     * @param {object} [options]
     * @param {string} [options.name]
     * @param {string} [options.img]
     * @param {string} [options.band]              A key of `MGT2.ShipRangeBands`
     * @param {CombatantGroup} [options.relativeTo]  The fleet the band is measured against
     * @returns {Promise<CombatantGroup|null>}
     */
    async addFleet({ name, img, band, relativeTo } = {}) {
        if ( !this.#gate() ) return null;
        const data = { type: FLEET, name: name || game.i18n.localize("MGT2.Fleet.NewFleet") };
        if ( img ) data.img = img;
        const [group] = await this.parent.createEmbeddedDocuments("CombatantGroup", [data]);
        if ( group && band ) {
            const others = relativeTo ? [relativeTo] : this.fleets.filter(one => one.id !== group.id);
            for ( const other of others ) await this.setBand(group, other, band);
        }
        return group ?? null;
    }

    /**
     * One hull, flying for one fleet. No crew Combatants: folio 115 says "the crew take few specific
     * actions", which is the whole reason the two levels shift up by one.
     * @param {Actor} actor                A `spacecraft`
     * @param {CombatantGroup} group       The fleet it flies for
     * @param {object} [options]
     * @param {boolean} [options.reserve]  Folio 117's reserve: a tanker, transport or auxiliary
     * @returns {Promise<Combatant|null>}
     */
    async addShip(actor, group, { reserve = false } = {}) {
        if ( !this.#gate() ) return null;
        if ( (actor?.type !== "spacecraft") || (group?.type !== FLEET) ) return null;
        const [combatant] = await this.parent.createEmbeddedDocuments("Combatant", [{
            type: FLEET_SHIP, actorId: actor.id, group: group.id,
            name: actor.name, img: actor.img, system: { reserve }
        }]);
        return combatant ?? null;
    }

    /**
     * One wing. §9.95's `{actor, count}` and not §9.78's actorless Combatant — a squadron has a
     * hull, a crew and a place in the compendium, and folio 114 treats it "much like an individual
     * ship". §9.78's form stays right for the missile salvo folio 124 wants tracked beside them.
     * @param {Actor} actor                   The fighter class
     * @param {CombatantGroup} group
     * @param {object} [options]
     * @param {number} [options.count]        How many fighters
     * @param {string} [options.name]         Folio 114's squadron name
     * @param {number|null} [options.crewSkill]  Folio 114 lets a wing differ from its mothership
     * @returns {Promise<Combatant|null>}
     */
    async addSquadron(actor, group, { count = 1, name, crewSkill = null } = {}) {
        if ( !this.#gate() ) return null;
        if ( (actor?.type !== "spacecraft") || (group?.type !== FLEET) ) return null;
        const [combatant] = await this.parent.createEmbeddedDocuments("Combatant", [{
            type: SQUADRON, actorId: actor.id, group: group.id,
            name: name || actor.name, img: actor.img,
            system: { count: Math.max(1, Math.trunc(count)), crewSkillOverride: crewSkill }
        }]);
        return combatant ?? null;
    }

    /**
     * A flight of missiles or torpedoes, as §9.78 fixed its shape: a `Combatant` with **no Actor**,
     * because a salvo has a position, a target and an age and has no hull, no crew and no business
     * in the compendium. Folio 124 wants them "tracked and moved as if they were ships", which is
     * that design arriving at the screen that needs it.
     *
     * Its position is not a band-map entry — the map is keyed by two FLEETS and §9.100 B3 warns off
     * keying a contact into it — but folio 119's flight time from the band it was fired at.
     * @param {CombatantGroup} group          The fleet that fired it
     * @param {object} [options]
     * @param {string} [options.warhead]      A key of `MGT2.FleetWarheads`
     * @param {number} [options.count]        How many are in the air
     * @param {Combatant} [options.target]
     * @param {Combatant} [options.from]      The hull or wing that fired it (folio 110's missile DM)
     * @param {string} [options.band]         The band it was fired at, which sets its flight time
     * @param {string} [options.name]
     * @returns {Promise<Combatant|null>}
     */
    async addSalvo(group, { warhead = "missileStandard", count = 1, target, from, band, name } = {}) {
        if ( !this.#gate() ) return null;
        if ( group?.type !== FLEET ) return null;
        const head = MGT2.FleetWarheads[warhead] ?? MGT2.FleetWarheads.missileStandard;
        const mine = one => (one?.parent === this.parent) ? one.id : null;
        const [combatant] = await this.parent.createEmbeddedDocuments("Combatant", [{
            type: SALVO, actorId: null, group: group.id,
            name: name || game.i18n.localize(head.label),
            system: {
                warhead, count: Math.max(1, Math.trunc(count)),
                target: mine(target), firedBy: mine(from),
                launchBand: MGT2.ShipRangeBands[band] ? band : PLANE_OF_BATTLE
            }
        }]);
        return combatant ?? null;
    }

    /**
     * Folio 122's hand-off between the two engines, and it is the chapter's own instruction: when a
     * dispersal extracts "a very small group, perhaps 1-3 ships, and that group includes one or more
     * of the Travellers, the Referee should consider using the normal space combat rules". So the
     * hulls leave this battle and arrive in a `space` Combat, through `MGT2Combat#addShip`, which
     * builds the ship group and its crew roster the way the shipped engine expects.
     *
     * Advisory rather than enforced: folio 122 says *consider*, and a referee sending five is warned
     * and obeyed.
     * @param {Combatant[]} combatants   `fleetShip` contacts of this battle
     * @param {object} [options]
     * @param {string} [options.band]    Where the new fight opens
     * @returns {Promise<Combat|null>}
     */
    async detach(combatants, { band = PLANE_OF_BATTLE } = {}) {
        if ( !this.#gate() ) return null;
        // Deduplicated, because folio 122's 1-3 is counted in hulls and a caller that names one
        // twice must not read as two.
        const ships = [...new Set(combatants ?? [])].filter(one =>
            (one?.type === FLEET_SHIP) && (one.parent === this.parent) && one.actor);
        if ( !ships.length ) return null;
        if ( ships.length > SMALL_GROUP ) {
            ui.notifications.warn(game.i18n.format("MGT2.Fleet.DetachLarge",
                { count: ships.length, max: SMALL_GROUP }));
        }

        const combat = await getDocumentClass("Combat").create({
            type: SPACE, scene: this.parent.scene?.id ?? null });
        if ( !combat ) return null;
        for ( const ship of ships ) await combat.addShip(ship.actor, { band });
        await this.parent.deleteEmbeddedDocuments("Combatant", ships.map(one => one.id));
        return combat;
    }

    /**
     * Folio 122's other half: the fleet divides into smaller fleets that stay in this battle. The
     * new fleet inherits every band its parent held, because a fleet breaking formation is at the
     * range its parent was — nothing else would place it.
     * @param {CombatantGroup} group     The fleet being split
     * @param {Combatant[]} combatants   Which of its contacts leave
     * @param {object} [options]
     * @param {string} [options.name]
     * @returns {Promise<CombatantGroup|null>}
     */
    async disperse(group, combatants, { name } = {}) {
        if ( !this.#gate() ) return null;
        if ( group?.type !== FLEET ) return null;
        const moving = (combatants ?? []).filter(one =>
            FLEET_CONTACTS.includes(one?.type) && (one._source.group === group.id));
        if ( !moving.length ) return null;

        const [split] = await this.parent.createEmbeddedDocuments("CombatantGroup", [{
            type: FLEET, img: group.img,
            name: name || game.i18n.format("MGT2.Fleet.SplitOf", { name: group.name })
        }]);
        if ( !split ) return null;
        // Every band the parent held, and never a band to the parent itself: two halves of one
        // formation start on top of each other and the referee places them.
        for ( const other of this.fleets ) {
            if ( (other.id === group.id) || (other.id === split.id) ) continue;
            const band = this.bandBetween(group, other);
            if ( band ) await this.setBand(split, other, band);
        }
        await this.parent.updateEmbeddedDocuments("Combatant",
            moving.map(one => ({ _id: one.id, group: split.id })));
        return split;
    }

    /**
     * Folio 122's reassembly, once the same Leadership → Tactics (naval) chain has been made again:
     * the contacts return to one fleet and an emptied one leaves the battle with its bands.
     * @param {CombatantGroup} group   The fleet being folded away
     * @param {CombatantGroup} into
     */
    async reassemble(group, into) {
        if ( (group?.type !== FLEET) || (into?.type !== FLEET) || (group.id === into.id) ) return null;
        const moving = group.system.combatants;
        if ( moving.length ) {
            await this.parent.updateEmbeddedDocuments("Combatant",
                moving.map(one => ({ _id: one.id, group: into.id })));
        }
        await this.clearGroup(group);
        return group.delete();
    }

    /**
     * Take a fleet out of the battle. The band map is keyed by pairs, so a fleet leaving takes every
     * pair it was half of with it — nothing else would ever clear those keys.
     * @param {CombatantGroup} group
     * @returns {Promise<CombatantGroup|null>}
     */
    async removeFleet(group) {
        if ( (group?.type !== FLEET) || (group.parent !== this.parent) ) return null;
        await this.clearGroup(group);
        const ids = this.parent.combatants
            .filter(combatant => combatant._source.group === group.id).map(combatant => combatant.id);
        if ( ids.length ) await this.parent.deleteEmbeddedDocuments("Combatant", ids);
        return group.delete();
    }

    /**
     * Folio 115's three steps in order, and the round turning over after the Actions Step. The step
     * is the round's spine at fleet level — folio 115 moves whole fleets in the Manoeuvre Step and
     * spends the pools in the Attack Step — so it is driven from here rather than from a screen.
     */
    async advanceStep() {
        const index = STEPS.indexOf(this.step);
        if ( index < 0 ) return this.parent.update({ system: { step: STEPS[0] } });
        if ( index === (STEPS.length - 1) ) return this.parent.nextRound();
        return this.parent.update({ system: { step: STEPS[index + 1] } });
    }

    /**
     * Folio 115: "once the Actions Step is complete, a fleet combat round ends and […] a new round
     * begins with the Manoeuvre Step." Called by `MGT2Combat#_onEndRound`, which hands a sub-type it
     * does not know how to end its own round.
     *
     * Four things turn over, and the order matters: folio 116 banks the Thrust each fleet put into
     * movement and moves a pair that can afford the change, folio 122's Morale lasts "for that round"
     * only, folios 113/119/121 restore every pool to its maximum, and the step returns to Manoeuvre.
     */
    async endRound() {
        // Every reading is taken BEFORE any fleet is written. Folio 116 adds two fleets' movement
        // together, and a fleet cleared first would contribute nothing to the second's reading —
        // the pair would move on one side's Thrust alone, and the second would settle against the
        // cost of the band it had already been moved into.
        const plans = this.fleets.map(fleet => ({ fleet, ...fleet.system.movementPlan }));
        const changed = new Set();
        for ( const plan of plans ) {
            // One pair, one band change. Two fleets closing on each other both bank the pair's
            // COMBINED progress, so both ledgers pay the same cost and the band moves once.
            const key = plan.opponent ? SpaceCombatData.pairKey(plan.fleet, plan.opponent) : null;
            if ( plan.moves && key && !changed.has(key) ) {
                changed.add(key);
                await this.setBand(plan.fleet, plan.opponent, plan.band);
            }
            await plan.fleet.system.endRound(plan);
        }

        const updates = this.contacts.filter(one => one.system.anySpent)
            .map(one => ({ _id: one.id,
                system: { spent: Object.fromEntries(POOLS.map(pool => [pool, 0])) } }));
        if ( updates.length ) await this.parent.updateEmbeddedDocuments("Combatant", updates);

        if ( this.step === STEPS[0] ) return this.parent;
        return this.parent.update({ system: { step: STEPS[0] } });
    }
}

/* -------------------------------------------- */

/**
 * A fleet: several ships moving as a unit (folio 115). Its name, image, ownership and Initiative are
 * `CombatantGroup`'s own schema and are not redeclared here — what a fleet adds is a flag ship, a
 * commander's Tactics Effect, the formation its ships hold and the Thrust score folio 115 uses and
 * never defines.
 *
 * The readings below are getters and not derived data, for `ShipGroupData`'s reason: a group's
 * members are filled in as the Combatants prepare, which happens after the group has.
 */
export class FleetGroupData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Folio 115: the flag ship needs a command bridge and is worth DM+1 on the Morale check
            // while it remains in the battle. A Combatant id and not an Actor's — the same hull can
            // fly in two encounters, and only one of them is this fleet.
            flagship: new fields.DocumentIdField({
                required: false, nullable: true, initial: null, readonly: false }),
            // Folio 115: one Tactics (naval) check by the fleet's commander, "the Effect of this
            // check is added to the Initiative of the fleet". It belongs to no ship, which is why it
            // is entered on the fleet rather than derived from anything below it — §9.26's shape one
            // level up.
            tacticsEffect: new fields.NumberField({
                required: true, nullable: false, integer: true, initial: 0 }),
            // Folio 117's three operational ranges are the spacing INSIDE a fleet and not the range
            // to the enemy: Adjacent-to-Close is Defensive DM+1 for every ship, Short is the plane of
            // battle, Medium disperses. The band map answers the other question and cannot hold this
            // one — it is keyed by two fleets.
            formation: new fields.StringField({
                required: true, blank: false, initial: PLANE_OF_BATTLE, choices: MGT2.ShipRangeBands }),
            // Folio 115 uses "the fleet's Thrust score" once and never defines it, and the Fleet
            // Sheet (folio 106) has no such field. Derived below and typed here — the ruling is the
            // referee's and this is where they state a different one.
            thrustOverride: new fields.NumberField({
                required: false, nullable: true, initial: null, integer: true, min: 0 }),

            // Folio 116 reprints Core folio 166 word for word and the only change is that the mover
            // is a fleet. `ShipGroupData.thrust` with the station list taken out: folio 115 says
            // "there is no detailed combat manoeuvring", so a fleet's Thrust buys movement or
            // nothing — which also keeps §9.101's `ArrayField._cast` trap off this schema.
            //
            // NOT named `thrust`: `DataModel#_initialize` defines every field as an own property,
            // which would shadow the `thrust` getter below and silently replace the fleet's Thrust
            // score with this object.
            movement: new fields.SchemaField({
                thrust: spentField(),
                // Folio 116: "a fleet can spend Thrust over multiple rounds to close or open a
                // category", so this is a running total and not an allocation.
                banked: spentField(),
                target: new fields.SchemaField({
                    group: new fields.DocumentIdField({
                        required: false, nullable: true, initial: null, readonly: false }),
                    band: new fields.StringField({
                        required: false, blank: true, initial: "", choices: MGT2.ShipRangeBands })
                })
            }),

            // Folio 122: the Morale check "potentially result[s] in changes to the Crew Skill score
            // of all of the ships in a fleet FOR THAT ROUND". Per-fleet and per-round, so it is read
            // off the group at the point of use and cleared when the round turns over — writing it
            // onto each ship would mean unwriting it next round (§9.100 B1).
            morale: new fields.NumberField({
                required: true, nullable: false, integer: true, initial: 0 }),

            // Folio 122: "a fleet that breaks off from a battle incurs DM-1 to its Defensive DM and
            // may not use spinal mount weapons for the duration of the action."
            breakingOff: new fields.BooleanField({ required: false, initial: false }),

            // Folio 124: a gas giant or rocky planet held with superior Thrust is worth Defensive
            // DM+1 per point of superiority. The object is no document and the band to it cannot be
            // measured, so this is the referee's declaration that the fleet holds one; the DM below
            // derives from the Thrust comparison, which is the half that is arithmetic.
            terrain: new fields.BooleanField({ required: false, initial: false }),

            // Folio 117 gives one turn's grace outside the plane of battle: ships at Medium "can
            // maintain their position in the fleet provided they return to Short range in the
            // following turn". Counted at the end of each round, surfaced, never enforced.
            scattered: new fields.NumberField({
                required: true, nullable: false, integer: true, min: 0, initial: 0 }),

            // Folio 122's Fleet Dispersal table, once the Leadership → Tactics (naval) chain has been
            // rolled: how many rounds are left to run and what the fleet's DMs pay meanwhile. On a
            // failure the same two fields are the penalty and its duration.
            dispersal: new fields.SchemaField({
                rounds: spentField(),
                dm: new fields.NumberField({
                    required: true, nullable: false, integer: true, initial: 0 }),
                failed: new fields.BooleanField({ required: false, initial: false })
            })
        };
    }

    /* -------------------------------------------- */

    /**
     * The Combatants in this fleet. Read off `_source.group` rather than off `members`, so the
     * answer does not depend on whether the group prepared before or after its members.
     */
    get combatants() {
        const id = this.parent.id;
        return this.parent.parent.combatants.filter(combatant => combatant._source.group === id);
    }

    get ships() {
        return this.combatants.filter(combatant => combatant.type === FLEET_SHIP);
    }

    get squadrons() {
        return this.combatants.filter(combatant => combatant.type === SQUADRON);
    }

    /** Folio 117's plane of battle: the reserve is part of the fleet and not part of the line. */
    get line() {
        return this.ships.filter(combatant => !combatant.system.reserve);
    }

    get reserve() {
        return this.ships.filter(combatant => combatant.system.reserve);
    }

    /* -------------------------------------------- */

    /** HG folio 105: "to command a fleet, a capital ship must have a command bridge". */
    static commands(actor) {
        return actor?.system?.bridge?.type === "command";
    }

    /** The flag ship, when the fleet has one and it is still one of its own (folio 115). */
    get flagShip() {
        const combatant = this.flagship ? this.parent.parent.combatants.get(this.flagship) : null;
        if ( (combatant?.type !== FLEET_SHIP) || (combatant._source.group !== this.parent.id) ) return null;
        return combatant;
    }

    /**
     * Folio 115: "as long as the flag ship remains in the battle, its fleet receives DM+1 during the
     * Morale check that is made each round." A wreck has left it — folio 111 wrecks a ship at zero
     * adjusted Hull points. The Morale check itself is folio 122's and is not built.
     */
    get flagShipDM() {
        const flag = this.flagShip;
        if ( !flag || flag.isDefeated ) return 0;
        return (flag.system.hull.remaining > 0) ? 1 : 0;
    }

    /**
     * Fly the flag, or strike it by passing nothing. Refused rather than warned about for a hull
     * with no command bridge: folio 105 makes it a precondition on being the flag ship at all.
     * @param {Combatant|null} combatant
     */
    async setFlagShip(combatant) {
        if ( !combatant ) return this.parent.update({ system: { flagship: null } });
        if ( (combatant.type !== FLEET_SHIP) || (combatant._source.group !== this.parent.id) ) {
            return this.parent;
        }
        if ( !FleetGroupData.commands(combatant.actor) ) {
            ui.notifications.warn(game.i18n.format("MGT2.Fleet.NotACommandBridge",
                { name: combatant.name }));
            return this.parent;
        }
        return this.parent.update({ system: { flagship: combatant.id } });
    }

    /** Folio 115's Tactics (naval) check by the fleet's commander; its Effect, and nothing else. */
    async setTactics(effect) {
        return this.parent.update({ system: {
            tacticsEffect: (effect === null) ? 0 : Math.trunc(Number(effect) || 0) } });
    }

    /* -------------------------------------------- */

    /** The fleet on the other side, where there are exactly two — which is the ordinary battle. */
    get opposing() {
        const others = this.parent.parent.system.fleets.filter(one => one.id !== this.parent.id);
        return (others.length === 1) ? others[0] : null;
    }

    /**
     * How much of the fleet is gone. Ships and wings both, because folio 122 counts "the ships in a
     * fleet" in a battle where folio 114 makes a squadron a contact treated much like one — and the
     * reserve counts, because folio 117 keeps it part of the fleet.
     */
    get strength() {
        const all = this.combatants.filter(one => FLEET_COMBATANTS.includes(one.type));
        const lost = all.filter(one => one.system.eliminated).length;
        return { total: all.length, lost, left: all.length - lost,
            fraction: all.length ? (lost / all.length) : 0 };
    }

    /**
     * Folio 122's four Morale events plus folio 115's flag ship, read off the battle rather than
     * typed. Every row is named even when it is worth nothing, which is what `Checks.modifiers`
     * prints on the card — a referee has to see that a term was considered.
     * @param {CombatantGroup} [against]   The opposing fleet; the other one when there are two
     * @returns {[string, number][]}
     */
    moraleRows(against = null) {
        const enemy = against ?? this.opposing;
        const table = MGT2.FleetMorale;
        const label = key => game.i18n.localize(table[key].label);
        const mine = this.strength;
        const theirs = enemy?.system.strength ?? { fraction: 0 };
        const gone = group => {
            const flag = group?.system.flagShip;
            return flag ? (flag.system.eliminated ? 1 : 0) : 0;
        };
        return [
            [label("flagShip"), this.flagShipDM * table.flagShip.dm],
            [label("opposingLosses"),
                (enemy && (theirs.fraction >= table.opposingLosses.threshold)) ? table.opposingLosses.dm : 0],
            [label("opposingFlagship"), gone(enemy) * table.opposingFlagship.dm],
            [label("ownLosses"), Math.floor(mine.fraction / table.ownLosses.per) * table.ownLosses.dm],
            [label("ownFlagship"), gone(this.parent) * table.ownFlagship.dm]
        ];
    }

    /**
     * Folio 122's Morale check, made each round. **The book prints its DMs and neither a target nor
     * a consequence** — only that the check "potentially result[s] in changes to the Crew Skill
     * score of all of the ships in a fleet for that round" — so the dice are rolled and the card is
     * posted and nothing is written. `setMorale` is where the referee states what it cost, which is
     * §9.35's discipline: display the state, let the referee spend it.
     * @param {CombatantGroup} [against]
     */
    async moraleCheck(against = null) {
        const rows = this.moraleRows(against);
        const { parts, labels } = Checks.modifiers(rows);
        const outcome = await Checks.resolve({ formula: ["2d6", ...parts].join(" ") });
        if ( !outcome ) return null;
        return Checks.post(outcome, {
            label: game.i18n.localize("MGT2.Fleet.Morale"),
            rollTypeName: game.i18n.localize("MGT2.Fleet.Morale"),
            rollObjectName: this.parent.name,
            modifiers: labels
        });
    }

    /** Folio 122's per-round Crew Skill change, for every ship and wing of this fleet. */
    async setMorale(delta) {
        return this.parent.update({ system: {
            morale: (delta === null) ? 0 : Math.trunc(Number(delta) || 0) } });
    }

    /* -------------------------------------------- */

    /**
     * Folio 122's Fleet Dispersal table, read off the Effect of the Tactics (naval) check that ends
     * the chapter's own task chain — Average (8+) Leadership, then Difficult (10+) Tactics (naval).
     * The chain is §9.25's and is rolled through it; what lands here is its Effect.
     * @param {number} effect
     */
    async applyDispersal(effect) {
        const score = Math.trunc(Number(effect) || 0);
        const row = MGT2.FleetDispersal.find(entry => (entry.min === null) || (score >= entry.min));
        return this.parent.update({ system: { dispersal: {
            rounds: row.rounds, dm: row.dm, failed: row.failed === true } } });
    }

    /** Folio 122: the DM a dispersal in progress, or a failed one, charges both of a ship's DMs. */
    get dispersalDM() {
        return this.dispersal.rounds > 0 ? this.dispersal.dm : 0;
    }

    /** Folio 122: "other actions cannot be taken by ships participating in a dispersal". */
    get dispersalRunning() {
        return (this.dispersal.rounds > 0) && !this.dispersal.failed;
    }

    /**
     * Folio 124: Defensive DM+1 per point of Thrust superiority while the fleet holds a planet as an
     * obstruction. The superiority is over the fleet being defended against; the proximity to the
     * object is the referee's, which is what `terrain` states.
     * @param {CombatantGroup} [against]
     */
    terrainDM(against = null) {
        if ( !this.terrain ) return 0;
        const enemy = against ?? this.opposing;
        return Math.max(0, this.thrust - (enemy?.system.thrust ?? 0));
    }

    /** Folio 122: breaking off costs the fleet's Defensive DM 1 and locks its spinal mounts. */
    get breakingOffDM() {
        return this.breakingOff ? -1 : 0;
    }

    /* -------------------------------------------- */

    /** Folio 117: a fleet holding Adjacent-to-Close gives every one of its ships Defensive DM+1. */
    get formationDM() {
        return TIGHT.includes(this.formation) ? 1 : 0;
    }

    /**
     * Folio 115: the ships "must move as a unit, staying within Short range of each other, otherwise
     * they disperse", and folio 117 gives Medium one turn's grace. Surfaced, never enforced —
     * dispersal is folio 122's task chain and the referee's call.
     */
    get dispersing() {
        return SpaceCombatData.bandIndex(this.formation)
            > SpaceCombatData.bandIndex(PLANE_OF_BATTLE);
    }

    /**
     * Folio 117's grace spent: "ships that stray to Medium range can maintain their position in the
     * fleet provided they return to Short range in the following turn". `scattered` counts the
     * rounds that have ended out of formation, so one is the allowance and two is a fleet that folio
     * 117 says now forms separate fleets or squadrons.
     */
    get mustDisperse() {
        return this.scattered > SCATTER_GRACE;
    }

    /**
     * **A referee-facing ruling, because folio 115 uses "the fleet's Thrust score" once and never
     * defines it and folio 106's Fleet Sheet has no field for it.** The slowest ship of the battle
     * line: folio 115 makes the ships of a fleet move as a unit, and a formation is as fast as its
     * slowest member. The reserve is out of it — folio 117 exempts it from the formation — and so
     * are squadrons, which folio 115 lets launch at their own Thrust. `thrustOverride` is where a
     * referee who rules otherwise types theirs.
     */
    get thrust() {
        return this.thrustOverride ?? this.thrustDerived;
    }

    get thrustDerived() {
        const thrusts = this.line.map(combatant => combatant.system.thrust);
        return thrusts.length ? Math.min(...thrusts) : 0;
    }

    /**
     * Folio 115's streamlined roll: "an average or approximation of the ships' Crew Skill scores".
     * Over the whole fleet, reserve included — the book qualifies neither — while squadrons carry
     * their own (folio 114) and are left out.
     */
    get crewSkill() {
        return Math.round(this.crewSkillMean);
    }

    get crewSkillMean() {
        return mean(this.ships.map(combatant => combatant.system.crewSkill));
    }

    /**
     * The other averaged term of the streamlined roll. **A reading**: folio 115 names only Crew
     * Skill as averaged, and the formula it streamlines carries an Offensive DM that no single ship
     * can answer for a whole fleet.
     */
    get offensiveDM() {
        return Math.round(mean(this.ships.map(combatant => combatant.system.offensive.standard)));
    }

    /* -------------------------------------------- */

    /**
     * Which of folio 115's two Initiative procedures this fleet is running — and it needs no field.
     * `Combatant#_prepareGroup` overwrites every member's Initiative with its group's, so a fleet
     * that has been rolled IS the streamlined mode and one that has not leaves each ship its own
     * (§9.100 B3).
     * @returns {"streamlined"|"detailed"}
     */
    get mode() {
        return Number.isFinite(this.parent.initiative) ? "streamlined" : "detailed";
    }

    /** Folio 115's per-ship formula with the fleet standing in for the ship it is rolled once for. */
    get initiativeFormula() {
        const parts = ["2d6"];
        const base = this.crewSkill + this.thrust + this.offensiveDM;
        if ( base ) parts.push(MGT2Helper.term(base));
        if ( this.tacticsEffect ) {
            parts.push(MGT2Helper.term(this.tacticsEffect,
                game.i18n.localize("MGT2.Fleet.TacticsTerm")));
        }
        return parts.join(" ");
    }

    /* -------------------------------------------- */

    /** The fleet this one is manoeuvring against, once it has named one (folio 116). */
    get opponent() {
        const id = this.movement.target.group;
        const group = id ? this.parent.parent.groups.get(id) : null;
        return (group?.type === FLEET) ? group : null;
    }

    /** The band the pair is at now — which is what a change out of it costs (folio 116). */
    get currentBand() {
        const other = this.opponent;
        return other ? (this.parent.parent.system?.bandBetween?.(this.parent, other) ?? null) : null;
    }

    get cost() {
        return MGT2.ShipRangeBands[this.currentBand]?.thrust ?? 0;
    }

    get shortfall() {
        return Math.max(0, this.cost - this.movement.banked);
    }

    /** Folio 116: Thrust the fleet did not put into movement, which the chapter spends on nothing. */
    get held() {
        return Math.max(0, this.thrust - this.movement.thrust);
    }

    /**
     * Folio 116, word for word from Core folio 166: "if two fleets are travelling towards one
     * another, then the proportion of their Thrusts devoted to movement are added together […] if
     * one fleet is trying to escape another, then subtract the lower Thrust from the higher". Which
     * of the two it is falls out of where each says it is going, and the two only interact when both
     * have named the other.
     */
    get closingRate() {
        const other = this.opponent?.system;
        if ( !other || (other.movement.target.group !== this.parent.id) ) return this.movement.thrust;
        const from = SpaceCombatData.bandIndex(this.currentBand);
        const mine = SpaceCombatData.bandIndex(this.movement.target.band);
        const theirs = SpaceCombatData.bandIndex(other.movement.target.band);
        const together = (from < 0) || (mine < 0) || (theirs < 0)
            || (Math.sign(mine - from) === Math.sign(theirs - from));
        return together
            ? (this.movement.thrust + other.movement.thrust)
            : (this.movement.thrust - other.movement.thrust);
    }

    /** Folio 115: "each fleet may allocate Thrust to movement", capped by what its drives can put out. */
    async allocate(points, { group, band } = {}) {
        const thrust = Math.max(0, Math.min(this.thrust, Math.trunc(Number(points) || 0)));
        const target = {};
        if ( group !== undefined ) target.group = group?.id ?? group ?? null;
        if ( band !== undefined ) target.band = MGT2.ShipRangeBands[band] ? band : "";
        return this.parent.update({ system: { movement: { thrust, target } } });
    }

    /**
     * What this round's manoeuvre comes to, read while every fleet still holds what it allocated.
     * Folio 116 lets Thrust accumulate across rounds to pay for a band change one round cannot
     * afford, so what this round bought is added to the bank; once the bank covers the cost the pair
     * moves one band and the remainder carries into the next change.
     */
    get movementPlan() {
        const rate = this.closingRate;
        const banked = Math.max(0, this.movement.banked + rate);
        const cost = this.cost;
        const opponent = this.opponent;
        const wanted = this.movement.target.band;
        // A pair that has arrived pays nothing more: `bandToward` answers the band it is already at
        // once the target is reached, so without this test the bank is charged the cost of a change
        // that never happens, every round the declaration stands.
        const moves = Boolean(opponent && cost && wanted
            && (wanted !== this.currentBand) && (banked >= cost));
        return { rate, cost, opponent, moves,
            banked: moves ? (banked - cost) : banked,
            band: moves ? SpaceCombatData.bandToward(this.currentBand, wanted) : null };
    }

    /**
     * End of round for one fleet. The plan is passed IN rather than read here, because the band it
     * would move is a property of a PAIR: two fleets closing on each other both bank the combined
     * rate, so the change is applied once by `FleetCombatData#endRound` and both ledgers pay it.
     * @param {object} [plan]   `movementPlan`, taken before any fleet was written
     */
    async endRound(plan) {
        const settled = plan ?? this.movementPlan;
        // Ended on its own rather than by the Combat, this fleet has to apply its own change or it
        // would bank past the cost forever.
        if ( !plan && settled.moves ) {
            await this.parent.parent.system?.setBand?.(this.parent, settled.opponent, settled.band);
        }
        const banked = settled.banked;
        // Folio 122 scopes Morale to "that round"; folio 117 counts the rounds a fleet has ended
        // outside the plane of battle; folio 122's dispersal runs down the rounds it was quoted.
        return this.parent.update({ system: {
            movement: { banked, thrust: 0 },
            morale: 0,
            scattered: this.dispersing ? (this.scattered + 1) : 0,
            dispersal: { rounds: Math.max(0, this.dispersal.rounds - 1) }
        } });
    }

    /** Folio 115's streamlined procedure: one roll for the fleet, which every member reads back. */
    async rollInitiative() {
        if ( this.parent.type !== FLEET ) return this.parent;
        const roll = await foundry.dice.Roll.create(this.initiativeFormula).evaluate();
        return this.parent.update({ initiative: roll.total });
    }

    /**
     * Folio 115's detailed procedure: one roll per ship. The fleet's own number is cleared FIRST,
     * because `_prepareGroup` overwrites every member with it — leaving it would store a roll per
     * ship that nothing ever shows.
     */
    async rollShips() {
        if ( this.parent.type !== FLEET ) return this.parent;
        if ( Number.isFinite(this.parent.initiative) ) {
            await this.parent.update({ initiative: null });
        }
        const ids = this.combatants
            .filter(combatant => FLEET_COMBATANTS.includes(combatant.type)).map(one => one.id);
        if ( ids.length ) await this.parent.parent.rollInitiative(ids, { updateTurn: false });
        return this.parent;
    }
}

/* -------------------------------------------- */

/**
 * One hull in a fleet battle. Everything the dice read is READ THROUGH to the Actor's own Fleet Ship
 * Sheet (§9.102's `system.fleet`) and nothing is copied onto the Combatant: a rating or a mount
 * edited on the ship sheet mid-battle has to reach the dice, which is §9.98's audit.
 *
 * Getters rather than `prepareDerivedData`, because `Combatant#group` is only assigned in
 * `_prepareGroup`, which v14 runs after the system model has prepared.
 */
export class FleetShipData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Folio 117: tankers, transports and auxiliaries stay at Very Long or Distant and are
            // "considered part of the fleet in spite of their distance". A flag on the ship and not
            // a fourth document (§9.100 B3), and it is what keeps a slow auxiliary out of the
            // fleet's Thrust score.
            reserve: new fields.BooleanField({ required: false, initial: false }),

            // Folio 121's Radiation Effects, counted per encounter and therefore on the Combatant:
            // an exposure is something that happened in THIS battle, and a `spacecraft` carries no
            // radiation track at all (§9.26's split).
            radiation: spentField(),

            // What this round has already taken out of each pool. Folio 113 restores the salvo pool
            // "to maximum in the following round", folio 119 replenishes the screens on the same
            // terms, and folio 121 reverts Repair Points to zero at the end of each round — one
            // shape for all five, cleared together by `FleetCombatData#endRound`.
            spent: new fields.SchemaField(Object.fromEntries(POOLS.map(pool => [pool, spentField()])))
        };
    }

    /* -------------------------------------------- */

    get ship() {
        return (this.parent.actor?.type === "spacecraft") ? this.parent.actor : null;
    }

    get fleetGroup() {
        return fleetOf(this.parent);
    }

    /**
     * Folios 110-111's Fleet Ship Sheet, derived on the Actor by §9.102. **Null while the rule is
     * off**, which is what makes the switch gate the engine rather than hide a number somebody typed.
     */
    get stats() {
        return this.ship?.system.fleet ?? null;
    }

    /**
     * Folio 110's Crew Skill with the two things the chapter moves it by: folio 122's Morale, which
     * changes it for "all of the ships in a fleet for that round", and folio 121's Radiation, which
     * is this hull's own. Both are per-encounter, which is why neither is written onto the Actor.
     */
    get crewSkill() {
        return Math.max(0, (this.stats?.crewSkill ?? 0)
            + (this.fleetGroup?.system.morale ?? 0) + this.radiationDM);
    }

    /** Folio 121's row for however many exposures this hull has taken, or null for a clean one. */
    get radiationRow() {
        if ( this.radiation <= 0 ) return null;
        return MGT2.FleetRadiation[Math.min(MGT2.FleetRadiation.length, this.radiation) - 1];
    }

    get radiationDM() {
        return this.radiationRow?.crewSkill ?? 0;
    }

    /** Folio 121's fifth step: "ship crew essentially disabled and ship can no longer function". */
    get disabled() {
        return this.radiationRow?.disabled === true;
    }

    /** Folio 121's own count — a Radiation attack the ship had no Antirad and no screen against. */
    async expose(count = 1) {
        return this.parent.update({
            system: { radiation: Math.max(0, this.radiation + Math.trunc(Number(count) || 0)) } });
    }

    /**
     * Folio 110's slashed pair, **recomposed from the Actor's parts rather than read whole**: the
     * standard DM starts at half the Crew Skill and Morale and Radiation have already moved that, so
     * `system.fleet.offensive` is the ship's standing figure and this is the round's.
     */
    get offensive() {
        const stats = this.stats;
        if ( !stats ) return { standard: 0, missile: 0 };
        return {
            standard: Math.ceil(this.crewSkill / 2) + stats.fireControl + stats.tl,
            // Folio 110 gives the missile DM no Crew Skill term at all, so nothing moves it.
            missile: stats.launchSolution + stats.tl
        };
    }

    /**
     * Folio 111's Defensive DM, plus every fleet-level term the chapter adds to it: folio 117's
     * formation bonus (the fleet's own spacing, NOT the range to the enemy, which is why it needs no
     * target), folio 122's dispersal penalty and folio 122's DM-1 for breaking off.
     */
    get defensive() {
        const stats = this.stats;
        if ( !stats ) return 0;
        const fleet = this.fleetGroup?.system;
        return Math.ceil(this.crewSkill / 2) + stats.evade + stats.tl
            + (fleet?.formationDM ?? 0) + (fleet?.dispersalDM ?? 0) + (fleet?.breakingOffDM ?? 0);
    }

    /**
     * Folio 124's celestial terrain is the one Defensive term that needs an opponent: the DM is the
     * fleet's Thrust superiority over whichever fleet it is being attacked by.
     * @param {CombatantGroup} other   The attacking fleet
     */
    defensiveAgainst(other) {
        return this.defensive + (this.fleetGroup?.system.terrainDM(other) ?? 0);
    }

    /** Folio 122: a fleet breaking off "may not use spinal mount weapons for the duration". */
    get spinalLocked() {
        return this.fleetGroup?.system.breakingOff === true;
    }

    get armour() {
        return this.stats?.armour ?? 0;
    }

    get autoRepair() {
        return this.stats?.autoRepair ?? 0;
    }

    /** Folio 111's adjusted Hull points, criticals already folded into the Actor's own figure. */
    get hull() {
        const stats = this.stats;
        return {
            max: stats?.hull ?? 0,
            damage: stats?.damage ?? 0,
            remaining: stats?.remaining ?? 0,
            thresholds: stats?.thresholds ?? []
        };
    }

    /** Folio 111's Thrust field: the ship's own, criticals folded in. */
    get thrust() {
        return this.ship?.system.drives.effectiveThrust ?? 0;
    }

    /** Folio 111's Jump field. */
    get jump() {
        return this.ship?.system.drives.jump ?? 0;
    }

    /** Folio 105: only a hull with a command bridge may fly the flag. */
    get canFlag() {
        return FleetGroupData.commands(this.ship);
    }

    get isFlagShip() {
        return this.fleetGroup?.system.flagship === this.parent.id;
    }

    /** Folio 111: a hull at zero adjusted Hull points is wrecked, which is what Morale counts. */
    get eliminated() {
        return this.parent.isDefeated || (this.stats ? (this.hull.remaining <= 0) : false);
    }

    /* -------------------------------------------- */

    /**
     * Folios 113 and 121's pools at this round's Crew Skill, with folio 121's radiation fraction
     * already struck off the three terms that table names. One derivation, on the Actor, so the
     * DEFENCES panel a referee reads before the battle and the pool the round spends are the same
     * arithmetic and cannot drift apart.
     */
    get defences() {
        return this.ship?.system.fleetDefences?.(this.crewSkill,
            { radiation: this.radiationRow?.salvo ?? 0 }) ?? null;
    }

    /**
     * The five spendable pools, each as `{max, spent, left}`. Folio 113 restores the salvo pool
     * every round, folio 119 the two screens, folio 121 the Repair Points; the sandcaster pool is
     * the odd one out and is read through `sandcasterAgainst`, because folio 119 makes its size a
     * function of who is shooting.
     */
    get pools() {
        const defences = this.defences;
        const pool = (key, max) => ({ key, max, spent: this.spent[key],
            left: Math.max(0, max - this.spent[key]) });
        return {
            salvo: pool("salvo", defences?.salvo ?? 0),
            meson: pool("meson", defences?.mesonScreen ?? 0),
            damper: pool("damper", defences?.nuclearDamper ?? 0),
            repair: pool("repair", defences?.repairPoints ?? 0)
        };
    }

    /**
     * Folio 119's Sandcaster Effectiveness — the only pool an opposing ship is a term of: "add the
     * Crew Skill score to the ship's Defensive DM and then subtract the opposing ship's Offensive
     * DM".
     * @param {Combatant} [other]   The attacking ship or wing
     */
    sandcasterAgainst(other = null) {
        const against = other?.system.offensive?.standard ?? 0;
        const reading = this.ship?.system.sandcasterPool?.(this.crewSkill, this.defensive, against)
            ?? { score: 0, multiplier: 0, points: 0 };
        return { ...reading, key: "sand", spent: this.spent.sand,
            max: reading.points, left: Math.max(0, reading.points - this.spent.sand) };
    }

    /** Whether this round has taken anything out of anything — what `endRound` has to write back. */
    get anySpent() {
        return POOLS.some(pool => this.spent[pool] > 0);
    }

    /**
     * Take points out of a pool. Refused rather than clamped when the pool cannot cover it: a
     * referee spending 400 points of salvo defence a ship does not have is making a mistake the
     * round cannot undo, and folio 113 caps the pool at what the systems produce.
     * @param {string} key       A member of `POOLS`
     * @param {number} points
     * @param {Combatant} [against]   Only the sandcaster pool has one (folio 119)
     */
    async spend(key, points, against = null) {
        if ( !POOLS.includes(key) ) return this.parent;
        const wanted = Math.max(0, Math.trunc(Number(points) || 0));
        const pool = (key === "sand") ? this.sandcasterAgainst(against) : this.pools[key];
        if ( wanted > pool.left ) {
            ui.notifications.warn(game.i18n.format("MGT2.Fleet.PoolEmpty",
                { name: this.parent.name, left: pool.left, wanted }));
            return this.parent;
        }
        return this.parent.update({ system: { spent: { [key]: this.spent[key] + wanted } } });
    }

    /**
     * Folio 121's Repair System: "Repair Points can be used to repair systems that have been
     * affected by Critical Hits on a point-for-point basis" — one point per severity level. The
     * severity lives on the Actor, which is where `applyCritical` put it, so this spends the round's
     * pool and lowers the location.
     *
     * Folio 121's "destroyed cannot be repaired […] until the ship is taken to a base or shipyard"
     * is NOT enforced: which cell a stored severity means is folio 120's grid, which the corpus
     * carries column-scrambled, so the judgement stays the referee's.
     * @param {string} location   A key of `MGT2.ShipCriticals`
     * @param {number} levels
     */
    async repairCritical(location, levels = 1) {
        const ship = this.ship;
        const current = ship?.system.criticals?.[location];
        if ( !Number.isInteger(current) || (current <= 0) ) return this.parent;
        const wanted = Math.max(1, Math.min(current, Math.trunc(Number(levels) || 0)));
        const before = this.parent._source.system.spent.repair;
        await this.spend("repair", wanted);
        // `spend` refuses a pool it cannot cover, so the severity only moves once the points did.
        // Read through the document: `Combatant#update` re-initialises `system` and leaves this
        // instance behind, so `this.spent` here would still be the figure from before the spend.
        if ( this.parent._source.system.spent.repair === before ) return this.parent;
        await ship.update({ [`system.criticals.${location}`]: current - wanted });
        return this.parent;
    }

    /* -------------------------------------------- */

    /**
     * Folio 115: `2D + the ship's Crew Skill + the fleet's Thrust score + Offensive DM`, plus the
     * commander's Tactics (naval) Effect — folio 115 adds that to "the Initiative of the fleet", and
     * in the detailed mode there is no fleet number to add it to, so every ship carries it.
     */
    get initiativeFormula() {
        const fleet = this.fleetGroup?.system;
        const parts = ["2d6"];
        const base = this.crewSkill + (fleet?.thrust ?? 0) + this.offensive.standard;
        if ( base ) parts.push(MGT2Helper.term(base));
        if ( fleet?.tacticsEffect ) {
            parts.push(MGT2Helper.term(fleet.tacticsEffect,
                game.i18n.localize("MGT2.Fleet.TacticsTerm")));
        }
        return parts.join(" ");
    }

    /**
     * Folio 115's two procedures are alternatives: while the fleet holds a number, `_prepareGroup`
     * overwrites every member's with it, so a roll made here would be stored and never shown.
     */
    get rollsWithGroup() {
        return Number.isFinite(this.fleetGroup?.initiative);
    }
}

/* -------------------------------------------- */

/**
 * One wing (folio 114): a fighter class, a number of them, and a Hull pool that loses a fighter per
 * fighter's-worth destroyed. §9.95's `{actor, count}`, which `carriedCraft` already answers with for
 * a clamp rack of ten light fighters — the same pair, placed on a battle map.
 *
 * **Folio 114's DMs are not folio 110's.** A squadron starts at its FULL Crew Skill where a ship
 * starts at half, so the DMs are recomposed here from the parts the Actor derives rather than read
 * off `system.fleet.offensive` whole.
 */
export class SquadronData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            count: new fields.NumberField({
                required: true, nullable: false, integer: true, min: 1, initial: 1 }),
            // Folio 114's Hull pool. Per-encounter and on the Combatant because ten squadrons fly
            // the same fighter Actor, so the Actor cannot hold one wing's losses.
            damage: new fields.NumberField({
                required: true, nullable: false, integer: true, min: 0, initial: 0 }),
            // Folio 114: "usually the same as the squadron's mothership but may be different" — one
            // level lower for a green wing, one or two higher for a crack one. Null reads the
            // fighter class's own typed figure.
            crewSkillOverride: new fields.NumberField({
                required: false, nullable: true, integer: true, min: 0, initial: null })
            // **No pools.** Folio 114's Fighter Squadron Sheet prints Crew Skill, weapons, the two
            // DMs, Thrust, Armour and Hull points and nothing else: a wing has no salvo defence, no
            // screens, no sandcasters and no Repair Points. Declaring the five would be an
            // accumulator with no source, which is §9.102's own lesson one entry back.
        };
    }

    /* -------------------------------------------- */

    get fighter() {
        return (this.parent.actor?.type === "spacecraft") ? this.parent.actor : null;
    }

    get fleetGroup() {
        return fleetOf(this.parent);
    }

    /** The fighter class's own Fleet Ship Sheet — the parts, not the ship-shaped totals. */
    get stats() {
        return this.fighter?.system.fleet ?? null;
    }

    /**
     * Folio 114's own figure, moved by folio 122's Morale like every other element of the fleet —
     * "changes to the Crew Skill score of all of the ships in a fleet for that round", and folio 114
     * makes a wing a contact treated much like a ship. Radiation is not read: folio 121's table is
     * about a ship's crew and a wing has no hull to irradiate.
     */
    get crewSkill() {
        const own = this.crewSkillOverride ?? (this.stats?.crewSkill ?? 0);
        return Math.max(0, own + (this.fleetGroup?.system.morale ?? 0));
    }

    /**
     * Folio 114: the squadron's own Crew Skill, the Fire Control rating and the TL step. The
     * fire-control term is the Actor's max over the plain and Advanced packages, which is HG folio
     * 73's "does not stack" — folio 114 names only "Fire Control software".
     */
    get offensive() {
        const stats = this.stats;
        if ( !stats ) return { standard: 0, missile: 0 };
        return {
            standard: this.crewSkill + stats.fireControl + stats.tl,
            // Folio 114 prints no missile DM for a squadron and folio 107's sample squadron carries
            // missile racks. Folio 110's form, over the squadron's own figures.
            missile: stats.launchSolution + stats.tl
        };
    }

    /**
     * Folio 114: full Crew Skill, the Evade rating and the TL step — plus the two fleet-level DMs
     * folio 122 charges every element of the fleet, a dispersal in progress and breaking off.
     */
    get defensive() {
        const stats = this.stats;
        if ( !stats ) return 0;
        const fleet = this.fleetGroup?.system;
        return this.crewSkill + stats.evade + stats.tl
            + (fleet?.dispersalDM ?? 0) + (fleet?.breakingOffDM ?? 0);
    }

    /**
     * Folio 114: "add DM+1 against opposing ships at Close or Adjacent Range". **This +1 is the
     * range to the enemy** — unlike folio 117's identically-worded one for a ship, which is the
     * fleet's own spacing — so it is the band map's first reader. Folio 124's celestial terrain
     * rides on top of it, a planetoid serving a wing the way a planet serves a fleet.
     * @param {CombatantGroup} other   The attacking fleet
     */
    defensiveAgainst(other) {
        const fleet = this.fleetGroup;
        const band = (fleet && other)
            ? (this.parent.parent?.system?.bandBetween?.(fleet, other) ?? null) : null;
        return this.defensive + (TIGHT.includes(band) ? 1 : 0)
            + (fleet?.system.terrainDM(other) ?? 0);
    }

    /** Folio 114: the fighter's Armour, already divided by the mean of 1D on the Actor. */
    get armour() {
        return this.stats?.armour ?? 0;
    }

    /** Folio 114: "the maximum Thrust rating of the fighters in the squadron". */
    get thrust() {
        return this.fighter?.system.drives.effectiveThrust ?? 0;
    }

    /**
     * Folio 114: one fighter's Hull points times the count, losing a fighter every time a fighter's
     * worth is eliminated.
     *
     * **The per-fighter figure is the fleet-adjusted one, and that is a referee-facing ruling.**
     * Folio 114 says only "obtain the Hull points from the fighter's description" and does not
     * repeat folio 111's ÷ 3.5 — although it does repeat it for Armour two lines above. Read as an
     * omission rather than a rule: every other quantity in the chapter is in ÷ 3.5 space, and an
     * undivided wing would have 3.5 times the hull of the same tonnage flown as ships.
     */
    get hull() {
        const perFighter = Math.max(1, this.stats?.hull ?? 0);
        const max = perFighter * this.count;
        const damage = Math.min(max, this.damage);
        const lost = Math.min(this.count, Math.floor(damage / perFighter));
        return { perFighter, max, damage, remaining: max - damage, lost, strength: this.count - lost };
    }

    /** A wing with no fighters left is off the chart, which is what folio 122's Morale counts. */
    get eliminated() {
        return this.parent.isDefeated || (this.stats ? (this.hull.strength <= 0) : false);
    }

    /* -------------------------------------------- */

    /**
     * Folio 115's formula with the squadron's OWN Thrust rather than its fleet's: the same page
     * exempts squadrons from moving as a unit, and folio 114 gives them a Thrust of their own.
     */
    get initiativeFormula() {
        const fleet = this.fleetGroup?.system;
        const parts = ["2d6"];
        const base = this.crewSkill + this.thrust + this.offensive.standard;
        if ( base ) parts.push(MGT2Helper.term(base));
        if ( fleet?.tacticsEffect ) {
            parts.push(MGT2Helper.term(fleet.tacticsEffect,
                game.i18n.localize("MGT2.Fleet.TacticsTerm")));
        }
        return parts.join(" ");
    }

    get rollsWithGroup() {
        return Number.isFinite(this.fleetGroup?.initiative);
    }
}

/* -------------------------------------------- */

/**
 * A flight of missiles or torpedoes on its way to a target — §9.78's design, arriving at the screen
 * that needs it. **No Actor**: a salvo has a position, a target and an age, and it has no hull, no
 * crew and no business in the compendium. Folio 124 asks for exactly this — "salvoes can be tracked
 * and moved as if they were ships".
 *
 * Its position is folio 119's flight time from the band it was fired at and **not** an entry in the
 * band map, which is keyed by two FLEETS; §9.100 B3 records that a Combatant id would validate into
 * that map and read back as null.
 */
export class SalvoData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Folio 112: "the number of missiles or torpedoes that make it through a ship's defences
            // becomes the multiple", so the count IS the salvo's weight and not a detail of it.
            count: new fields.NumberField({
                required: true, nullable: false, integer: true, min: 0, initial: 1 }),
            // What point defence has taken out. Stored beside the count rather than subtracted from
            // it, so a round can be undone and a card can say what the pool bought.
            removed: spentField(),
            warhead: new fields.StringField({
                required: true, blank: false, initial: "missileStandard", choices: MGT2.FleetWarheads }),
            // The contact it is flying at. A Combatant id, because a salvo outlives the ship that
            // fired it and is aimed at one hull rather than at a fleet.
            target: new fields.DocumentIdField({
                required: false, nullable: true, initial: null, readonly: false }),
            // And who fired it. Folio 110 derives a MISSILE Offensive DM on the ship, and a salvo
            // resolving itself has none — so without this the only reader of that DM answers 0.
            // Nullable because a salvo outlives its shooter, which is the whole reason §9.78 made it
            // a contact rather than a property of one.
            firedBy: new fields.DocumentIdField({
                required: false, nullable: true, initial: null, readonly: false }),
            // Folio 119's Missile Flight table is read from where it was FIRED and not from where
            // the fleets are now — the flight time was fixed when the trigger was pulled.
            launchBand: new fields.StringField({
                required: true, blank: false, initial: PLANE_OF_BATTLE, choices: MGT2.ShipRangeBands })
        };
    }

    /* -------------------------------------------- */

    get head() {
        return MGT2.FleetWarheads[this.warhead] ?? MGT2.FleetWarheads.missileStandard;
    }

    get fleetGroup() {
        return fleetOf(this.parent);
    }

    /** The hull or wing it is aimed at, while that contact is still in the battle. */
    get targetContact() {
        const combatant = this.target ? this.parent.parent?.combatants.get(this.target) : null;
        return FLEET_COMBATANTS.includes(combatant?.type) ? combatant : null;
    }

    /** The hull or wing that fired it, while it is still in the battle. */
    get shooter() {
        const combatant = this.firedBy ? this.parent.parent?.combatants.get(this.firedBy) : null;
        return FLEET_COMBATANTS.includes(combatant?.type) ? combatant : null;
    }

    /** Folio 113's damage figure for this warhead, before the target's Armour. */
    get damage() {
        return this.head.damage;
    }

    get torpedo() {
        return this.head.torpedo === true;
    }

    /**
     * Folio 113: "against torpedoes, double the amount taken from the pool. For example, 100 taken
     * from the pool only eliminates 50 torpedoes." So a torpedo costs two points and a missile one.
     */
    get cost() {
        return this.torpedo ? 2 : 1;
    }

    /** Folio 119: "reduce the target's Salvo Defence by 20%" for a multi-warhead. */
    get salvoPenalty() {
        return this.head.salvoPenalty ?? 0;
    }

    /** Folio 119: an antiradiation torpedo halves the target's Defensive DM, rounding down. */
    get halvesDefensive() {
        return this.head.halvesDefensive === true;
    }

    /** How many are still in the air. */
    get remaining() {
        return Math.max(0, this.count - this.removed);
    }

    get eliminated() {
        return this.remaining <= 0;
    }

    /* -------------------------------------------- */

    /** Folio 119's Missile Flight table, read from the band the salvo was fired at. */
    get flightRounds() {
        return MGT2.MissileFlight[this.launchBand] ?? 0;
    }

    /**
     * The round it lands on. `roundJoined` is core's own field and is the salvo's age for free,
     * which is the half of §9.78 that needed no schema.
     */
    get impactRound() {
        return (this.parent.roundJoined ?? this.parent.parent?.round ?? 0) + this.flightRounds;
    }

    get roundsLeft() {
        return Math.max(0, this.impactRound - (this.parent.parent?.round ?? 0));
    }

    get arriving() {
        return this.roundsLeft <= 0;
    }

    /* -------------------------------------------- */

    /**
     * Folio 113's salvo defence, spent: "each point removes one missile from incoming salvoes", and
     * a torpedo costs two. The points come out of the defender's own pool, which is what makes this
     * the pool's sink rather than a subtraction somebody does on paper.
     *
     * Folio 119's multi-warhead rider shrinks the POOL rather than the exchange rate — a defender's
     * Salvo Defence is 20% smaller against one, which is fewer points to spend.
     * @param {Combatant} defender   The `fleetShip` being shot at
     * @param {number} points        Points of Salvo Defence to spend
     */
    async intercept(defender, points) {
        if ( defender?.type !== FLEET_SHIP ) return this.parent;
        const wanted = Math.max(0, Math.trunc(Number(points) || 0));
        const available = Math.floor(defender.system.pools.salvo.left * (1 - this.salvoPenalty));
        if ( wanted > available ) {
            ui.notifications.warn(game.i18n.format("MGT2.Fleet.PoolEmpty",
                { name: defender.name, left: available, wanted }));
            return this.parent;
        }
        await defender.system.spend("salvo", wanted);
        return this.remove(Math.floor(wanted / this.cost));
    }

    /** Take rounds out of the flight — what point defence killed, or what the referee ruled lost. */
    async remove(count) {
        const wanted = Math.max(0, Math.trunc(Number(count) || 0));
        if ( !wanted ) return this.parent;
        return this.parent.update({
            system: { removed: Math.min(this.count, this.removed + wanted) } });
    }

    /* -------------------------------------------- */

    /**
     * A salvo has no Initiative of its own — it moves on folio 119's flight table and not on the
     * dice — so it acts with the fleet that fired it, whichever of folio 115's two procedures that
     * fleet is running.
     */
    get initiativeFormula() {
        return this.fleetGroup?.system.initiativeFormula ?? "2d6";
    }

    get rollsWithGroup() {
        return Number.isFinite(this.fleetGroup?.initiative);
    }
}
