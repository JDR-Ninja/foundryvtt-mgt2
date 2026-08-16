import { MGT2 } from "./config.js";
import { CREW } from "./combatant.js";
import { MGT2Helper } from "./helper.js";

const fields = foundry.data.fields;

// A sub-type a SYSTEM declares is not namespaced: `Document.TYPES` reports ["base", "space"], so
// these are the strings `system.json` and `CONFIG.<Doc>.dataModels` both key on. Keying them
// namespaced attaches no model and fails silently — right type, empty `system`, no error.
export const SPACE = "space";
export const SHIP = "ship";

/** The seven bands closest first, which is the order Core folio 165 prints and a step walks. */
const BANDS = Object.freeze(Object.keys(MGT2.ShipRangeBands));

/**
 * The three steps a round is actually resolved in (Core folio 164). `MGT2.CombatSteps` carries a
 * fourth key, `reaction`, so a station action can say it IS one — the Core resolves reactions when
 * they are provoked and HG folio 95 calls them an informal fourth phase. Nothing that walks the
 * round may walk that key, which is why it is filtered out here rather than at every reader.
 */
export const STEPS = Object.freeze(Object.keys(MGT2.CombatSteps).filter(key => key !== "reaction"));

const ID = /^[a-zA-Z0-9]{16}$/;

/**
 * A range band belongs to a PAIR of ships, and the map is keyed by the two CombatantGroup ids sorted
 * ascending and joined with a pipe. That ordering is the whole guarantee: `TypedObjectField` drops
 * any key this refuses, so "b|a" can never be written beside "a|b".
 */
function validPairKey(key) {
    const [a, b] = String(key).split("|");
    return ID.test(a ?? "") && ID.test(b ?? "") && (a < b);
}

/* -------------------------------------------- */

/**
 * A space combat encounter. Core folio 164 resolves a round in three named steps rather than in
 * initiative-order turns, and every ship takes a step before any ship takes the next — which is why
 * `step` is a property of the Combat and not of a turn.
 *
 * `round` is deliberately NOT declared: `Combat#round` is already core's and the tracker drives it,
 * so a second counter here would only drift away from it.
 */
export class SpaceCombatData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // `STEPS` and not `MGT2.CombatSteps`: a combat can never be IN the reaction phase,
            // because there is no such phase to be in.
            step: new fields.StringField({
                required: true, blank: false, initial: "manoeuvre", choices: STEPS }),
            // The band is a property of a pair, which no Actor and no Item can hold — the argument
            // for the sub-type. The band is STORED and the kilometres derive from it, never the
            // other way round: MGT2 resolves on bands throughout (Core folio 165).
            bands: new fields.TypedObjectField(new fields.StringField({
                required: true, blank: false, choices: MGT2.ShipRangeBands
            }), { validateKey: validPairKey })
        };
    }

    /* -------------------------------------------- */

    /** The canonical key for a pair, whichever order the caller names the two groups in. */
    static pairKey(a, b) {
        return [a?.id ?? a, b?.id ?? b].sort().join("|");
    }

    /** Core folio 165's table read backwards, for a referee who would rather type a distance. */
    static bandForKm(km) {
        const distance = Math.max(0, Number(km) || 0);
        return BANDS.find(key => {
            const max = MGT2.ShipRangeBands[key].maxKm;
            return (max === null) || (distance <= max);
        }) ?? BANDS.at(-1);
    }

    /** One band's full reading: its kilometres, its attack DM and what leaving it costs. */
    static bandInfo(key) {
        const band = MGT2.ShipRangeBands[key];
        return band ? { key, ...band } : null;
    }

    /** The band index, so "one step closer" is arithmetic rather than a table. */
    static bandIndex(key) {
        return BANDS.indexOf(key);
    }

    /** One band toward `to`, or `from` itself once it is there. */
    static bandToward(from, to) {
        const here = BANDS.indexOf(from);
        const there = BANDS.indexOf(to);
        if ( (here < 0) || (there < 0) || (here === there) ) return from;
        return BANDS[here + Math.sign(there - here)];
    }

    /* -------------------------------------------- */

    /** Every ship in the fight. A ship is a group, because several people act at its initiative. */
    get shipGroups() {
        return this.parent.groups.filter(group => group.type === SHIP);
    }

    /** The band between two ship groups, or null while they have never been placed. */
    bandBetween(a, b) {
        return this.bands[SpaceCombatData.pairKey(a, b)] ?? null;
    }

    /** What that band is worth: the kilometres it spans, its attack DM and what leaving it costs. */
    rangeBetween(a, b) {
        return SpaceCombatData.bandInfo(this.bandBetween(a, b));
    }

    /** Set the band between two ship groups, or clear it by passing a falsy band. */
    async setBand(a, b, band) {
        const key = SpaceCombatData.pairKey(a, b);
        if ( !validPairKey(key) ) return this.parent;
        const value = MGT2.ShipRangeBands[band]
            ? band : new foundry.data.operators.ForcedDeletion();
        return this.parent.update({ system: { bands: { [key]: value } } });
    }

    /** Drop every pair a group was half of — what a ship leaving the fight takes with it. */
    async clearGroup(group) {
        const id = group?.id ?? group;
        const bands = {};
        for ( const key of Object.keys(this.bands) ) {
            if ( key.split("|").includes(id) ) bands[key] = new foundry.data.operators.ForcedDeletion();
        }
        if ( !Object.keys(bands).length ) return this.parent;
        return this.parent.update({ system: { bands } });
    }
}

/* -------------------------------------------- */

/**
 * One ship in the fight: "one ship, several crew acting at its initiative". v14 already gives that
 * behaviour away — `Combatant#_prepareGroup` overwrites a member's initiative with the group's — so
 * the ship's number is rolled here and every crew member reads it back.
 *
 * The readings below are getters and not derived data on purpose: `CombatantGroup#members` is filled
 * by the Combatants as they prepare, which happens after the group has, so anything computed in
 * `prepareDerivedData` would be computed against an empty set.
 */
export class ShipGroupData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            thrust: new fields.SchemaField({
                // Core folio 165 splits Thrust between movement and combat manoeuvring, and prints
                // no closed list of manoeuvres — so a row is the station action's own label and the
                // points the pilot put behind it.
                spent: new fields.ArrayField(new fields.SchemaField({
                    label: new fields.StringField({ required: false, blank: true, trim: true }),
                    points: new fields.NumberField({
                        required: true, nullable: false, integer: true, min: 0, initial: 1 }),
                    // Only movement pays for a band change; docking and aiding gunners do not.
                    movement: new fields.BooleanField({ required: false, initial: false })
                }), { initial: [] }),
                // Core folio 166: "A ship can spend Thrust over multiple rounds to close or open a
                // category", so this is a running total carried between rounds and not an allocation.
                banked: new fields.NumberField({
                    required: true, nullable: false, integer: true, min: 0, initial: 0 }),
                // What the bank is being spent on. The cost of a change is the Thrust of the band
                // being LEFT, which is a property of the pair — hence the other group, not just a band.
                target: new fields.SchemaField({
                    group: new fields.DocumentIdField({
                        required: false, nullable: true, initial: null, readonly: false }),
                    band: new fields.StringField({
                        required: false, blank: true, initial: "", choices: MGT2.ShipRangeBands })
                })
            }),
            // Core folio 164: every ship takes a step before any ship takes the next, so what the
            // order needs is which steps THIS ship has got through — a set, not a turn pointer.
            resolved: new fields.SetField(new fields.StringField({
                required: true, blank: false, choices: STEPS }), { required: false, initial: [] }),
            // Core folio 165: one Tactics (naval) check by the commander of a ship or of a whole
            // fleet, its Effect added to Initiative. It belongs to no ship, so it is entered here
            // rather than derived from anything below it.
            tacticsEffect: new fields.NumberField({
                required: true, nullable: false, integer: true, initial: 0 })
        };
    }

    /* -------------------------------------------- */

    /**
     * The Combatants in this group. Read off `_source.group` rather than off `members`, so the
     * answer does not depend on whether the group prepared before or after its members.
     */
    get combatants() {
        const id = this.parent.id;
        return this.parent.parent.combatants.filter(combatant => combatant._source.group === id);
    }

    /** The ship: the one member of the group carrying a spacecraft Actor. */
    get ship() {
        return this.combatants.find(combatant => combatant.actor?.type === "spacecraft")?.actor ?? null;
    }

    /**
     * The crew, in the ship's own roster order. `Combat#combatants` is ordered by nothing in
     * particular, so the order is imposed here rather than left to whoever reads it.
     */
    get crew() {
        const roster = this.ship?.system.crew.map(row => row.role) ?? [];
        const at = combatant => {
            const index = roster.indexOf(combatant.system.station);
            return (index < 0) ? Number.MAX_SAFE_INTEGER : index;
        };
        return this.combatants.filter(combatant => combatant.type === CREW)
            .sort((a, b) => at(a) - at(b));
    }

    /** Whoever holds a duty this encounter, at most one for the two unique duties (folio 164). */
    crewOn(duty) {
        return this.crew.find(combatant => combatant.system.duty === duty) ?? null;
    }

    /**
     * Core folio 164 closes pilot and captain to one holder each and binds the two gunner duties to
     * a named mount. Warned, never blocked — a roster half filled in is as common as a mistake.
     */
    get dutyIssues() {
        const held = new Set();
        const duplicated = [];
        const unmounted = [];
        for ( const combatant of this.crew ) {
            const duty = MGT2.CombatDuties[combatant.system.duty];
            if ( !duty ) continue;
            // The one that took it first holds it legitimately, so only the ones after it are flagged.
            if ( duty.unique ) {
                if ( held.has(combatant.system.duty) ) duplicated.push(combatant.id);
                else held.add(combatant.system.duty);
            }
            if ( combatant.system.unmounted ) unmounted.push(combatant.id);
        }
        return { duplicated, unmounted, any: (duplicated.length > 0) || (unmounted.length > 0) };
    }

    /* -------------------------------------------- */

    /**
     * Core folio 165: 2D + the PILOT's Pilot skill + the ship's Thrust score. Whoever is on pilot
     * duty this encounter is the pilot, so their own level wins over the ship's standing pilot
     * station; the ship's figure is what answers when nobody has taken the duty yet.
     */
    get pilotSkill() {
        const pilot = this.crewOn("pilot")?.actor;
        if ( !pilot ) return this.ship?.system.pilotSkill ?? 0;
        const skill = pilot.items?.find(item => (item.type === "talent")
            && (item.system.subType === "skill") && MGT2Helper.matchesSkill(item.name, "pilot"));
        return skill?.system.level ?? 0;
    }

    /**
     * Core folio 165, plus the commander's Tactics (naval) Effect. The two numbers are baked into
     * the formula rather than left as `@initiative`: the roll may be made from a crew member's own
     * Combatant, and their roll data would answer with a Traveller's Initiative instead.
     *
     * The Effect is scoped to the ship because folio 165 scopes it there — "the Effect of this check
     * is added to the Initiative of the spacecraft (or fleet)". Folio 73's personal check reaches
     * "everyone on the same side" instead, so the personal half stores it against a `side` rather
     * than against a group (§9.30). One rule, two scopes, and both fold in as a named term.
     */
    get initiativeFormula() {
        const thrust = this.ship?.system.drives.effectiveThrust ?? 0;
        const parts = ["2d6"];
        // `SpacecraftData#initiative` is not read here — this pilot is whoever took the duty, not
        // the ship's standing one — so the standing DM is summed in rather than inherited (§9.94).
        const base = this.pilotSkill + thrust + (this.ship?.system.modifiers.initiative.dm ?? 0);
        if ( base ) parts.push(MGT2Helper.term(base));
        if ( this.tacticsEffect ) parts.push(MGT2Helper.term(this.tacticsEffect));
        return parts.join(" ");
    }

    /* -------------------------------------------- */

    /** Thrust the drive can put out this round, criticals folded in (Core folio 165). */
    get available() {
        return this.ship?.system.drives.effectiveThrust ?? 0;
    }

    get allocated() {
        return this.thrust.spent.reduce((sum, row) => sum + row.points, 0);
    }

    /** Only movement pays for a band change (Core folio 166). */
    get movement() {
        return this.thrust.spent.reduce((sum, row) => sum + (row.movement ? row.points : 0), 0);
    }

    /** Core folio 171: evasive action is paid for with Thrust the pilot did NOT spend. */
    get held() {
        return Math.max(0, this.available - this.allocated);
    }

    get opponent() {
        const id = this.thrust.target.group;
        const group = id ? this.parent.parent.groups.get(id) : null;
        return (group?.type === SHIP) ? group : null;
    }

    /** The band the pair is at now — which is what a change out of it costs (folio 166). */
    get currentBand() {
        const other = this.opponent;
        return other ? (this.parent.parent.system?.bandBetween?.(this.parent, other) ?? null) : null;
    }

    get cost() {
        return MGT2.ShipRangeBands[this.currentBand]?.thrust ?? 0;
    }

    get shortfall() {
        return Math.max(0, this.cost - this.thrust.banked);
    }

    /**
     * Core folio 166: two ships closing on each other add the Thrust each puts into movement; one
     * running from the other subtracts the lower from the higher. Which of the two it is falls out
     * of where each says it is going, and the two only interact when both have named the other —
     * a ship that has not declared it is manoeuvring against this one contributes nothing.
     */
    get closingRate() {
        const other = this.opponent?.system;
        if ( !other || (other.thrust.target.group !== this.parent.id) ) return this.movement;
        const from = SpaceCombatData.bandIndex(this.currentBand);
        const mine = SpaceCombatData.bandIndex(this.thrust.target.band);
        const theirs = SpaceCombatData.bandIndex(other.thrust.target.band);
        const together = (from < 0) || (mine < 0) || (theirs < 0)
            || (Math.sign(mine - from) === Math.sign(theirs - from));
        return together ? (this.movement + other.movement) : (this.movement - other.movement);
    }

    /* -------------------------------------------- */

    /**
     * Roll the ship's Initiative. Written on the GROUP, which is what makes it the whole crew's:
     * every member reads it back through `Combatant#_prepareGroup`.
     */
    async rollInitiative() {
        if ( this.parent.type !== SHIP ) return this.parent;
        const roll = await foundry.dice.Roll.create(this.initiativeFormula).evaluate();
        return this.parent.update({ initiative: roll.total });
    }

    /**
     * End of round. Core folio 166 lets Thrust accumulate across rounds to pay for a band change one
     * round cannot afford, so what this round bought is added to the bank; once the bank covers the
     * cost the pair moves one band and the remainder carries into the next change.
     */
    async endRound() {
        if ( this.parent.type !== SHIP ) return this.parent;
        let banked = Math.max(0, this.thrust.banked + this.closingRate);
        const cost = this.cost;
        const other = this.opponent;
        const wanted = this.thrust.target.band;
        if ( other && cost && wanted && (banked >= cost) ) {
            const moved = SpaceCombatData.bandToward(this.currentBand, wanted);
            await this.parent.parent.system?.setBand?.(this.parent, other, moved);
            banked -= cost;
        }
        return this.parent.update({ system: { thrust: { banked, spent: [] }, resolved: [] } });
    }

    /** Tick a step off, or back on — the referee's own mark, the way the tracker's turn pointer is. */
    async toggleResolved(step) {
        if ( !STEPS.includes(step) ) return this.parent;
        const resolved = new Set(this.resolved);
        if ( resolved.has(step) ) resolved.delete(step);
        else resolved.add(step);
        return this.parent.update({ system: { resolved: Array.from(resolved) } });
    }
}

/* -------------------------------------------- */

/**
 * @extends {CombatantGroup}
 */
export class MGT2CombatantGroup extends CombatantGroup {

    async rollInitiative() {
        return this.system?.rollInitiative?.() ?? this;
    }
}

/* -------------------------------------------- */

/**
 * @extends {Combat}
 */
export class MGT2Combat extends Combat {

    /**
     * Put a ship in the fight: one CombatantGroup for the ship, one plain Combatant carrying the
     * spacecraft Actor — which is what lets the group read the ship's Thrust and pilot — and one
     * `crew` Combatant per row of `spacecraft.system.crew[]`. The roster is referenced, never moved.
     *
     * `band` places the contact, because a contact has to arrive somewhere and the band IS the
     * state. With no `relativeTo` it arrives at that band from every ship already in the fight,
     * which is the only reading one number supports.
     * @param {Actor} actor                        A `spacecraft`
     * @param {object} [options]
     * @param {string} [options.band]              A key of `MGT2.ShipRangeBands`
     * @param {CombatantGroup} [options.relativeTo]  The contact the band is measured against
     * @returns {Promise<CombatantGroup|null>}
     */
    async addShip(actor, { band, relativeTo } = {}) {
        if ( (actor?.type !== "spacecraft") || (this.type !== SPACE) ) return null;

        const [group] = await this.createEmbeddedDocuments("CombatantGroup",
            [{ type: SHIP, name: actor.name, img: actor.img }]);

        const combatants = [{ actorId: actor.id, group: group.id, name: actor.name, img: actor.img }];
        for ( const station of actor.system.crew ) {
            let crew = null;
            if ( station.actor ) {
                try { crew = foundry.utils.fromUuidSync(station.actor); } catch { crew = null; }
            }
            // Core folio 164 calls anyone aboard without a duty a Passenger, which is the schema's
            // initial value — the book has the referee assign duties as the battle begins, so
            // guessing one off the station's name would be inventing an answer.
            combatants.push({
                type: CREW,
                group: group.id,
                actorId: game.actors.has(crew?.id) ? crew.id : null,
                name: crew?.name || station.name || actor.items.get(station.role)?.name || "",
                system: { station: station.role, dutyTarget: station.dutyTarget }
            });
        }
        await this.createEmbeddedDocuments("Combatant", combatants);

        if ( band ) {
            const others = relativeTo ? [relativeTo]
                : this.system.shipGroups.filter(entry => entry.id !== group.id);
            for ( const other of others ) await this.system.setBand(group, other, band);
        }
        return group;
    }

    /**
     * Take a ship out of the fight. The band map is keyed by pairs, so a group leaving takes every
     * pair it was half of with it — nothing else would ever clear those keys.
     * @param {CombatantGroup} group
     * @returns {Promise<Combat|null>}
     */
    async removeShip(group) {
        if ( (group?.type !== SHIP) || (group.parent !== this) ) return null;
        await this.system.clearGroup(group);
        const ids = group.system.combatants.map(combatant => combatant.id);
        if ( ids.length ) await this.deleteEmbeddedDocuments("Combatant", ids);
        return group.delete();
    }

    /**
     * Core folio 164: the round ends with the Actions Step and the next one opens on the Manoeuvre
     * Step, so the step resets and everything a round caps is released — one action per crew member,
     * the reactions each has used, and the Thrust the pilot allocated, which banks on its way out.
     * @inheritDoc
     */
    async _onEndRound(context) {
        await super._onEndRound(context);
        if ( this.type !== SPACE ) return;
        for ( const group of this.system.shipGroups ) await group.system.endRound();
        const updates = this.combatants.filter(combatant => combatant.type === CREW)
            .map(combatant => ({ _id: combatant.id, system: { spent: { action: false, reactions: [] } } }));
        if ( updates.length ) await this.updateEmbeddedDocuments("Combatant", updates);
        if ( this.system.step !== "manoeuvre" ) await this.update({ system: { step: "manoeuvre" } });
    }
}
