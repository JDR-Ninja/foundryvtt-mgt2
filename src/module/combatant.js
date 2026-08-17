import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { buildContent } from "./actors/character-prompts.js";

const fields = foundry.data.fields;

/** Actor types whose Initiative is the Effect of a check rather than the total of one. */
const PERSON_TYPES = new Set(["character", "npc", "robot"]);

// A sub-type a SYSTEM declares is not namespaced: `Document.TYPES` reports `["base", "person"]`, so
// this is the string both the registration and the model key use. (Measured 2026-08-12 for
// ChatMessage too, which this comment used to claim was different — it is not. A MODULE's sub-types
// are the namespaced ones.)
const PERSON = "person";
export const CREW = "crew";

/**
 * Core p.73's side, guessed from the token. This is the DEFAULT and nothing more: the guess is
 * stored so a wrong one can be corrected without moving a token (§9.30). SECRET answers with no
 * side, because it states who may see the token and says nothing about who it fights for.
 * @returns {string}   A key of `MGT2.CombatSides`, or "" for no side
 */
function sideForDisposition(disposition) {
    switch ( disposition ) {
        case CONST.TOKEN_DISPOSITIONS.FRIENDLY: return "allies";
        case CONST.TOKEN_DISPOSITIONS.HOSTILE: return "enemies";
        case CONST.TOKEN_DISPOSITIONS.NEUTRAL: return "neutral";
        default: return "";
    }
}

/**
 * Whoever holds a side's Tactics Effect. Core p.73 has ONE Traveller make the check, so the side
 * has at most one holder and everyone else on it reads the number back off them.
 */
function tacticsHolder(combat, side) {
    if ( !combat || !side ) return null;
    return combat.combatants.find(combatant => (combatant.type === PERSON)
        && (combatant.system.side === side) && (combatant.system.tactics !== null)) ?? null;
}

/**
 * Core p.73 lets no surprised Traveller make the check, so the Effect field follows the ambush
 * select rather than letting one sit there looking valid. A disabled control submits nothing, which
 * is what leaves an Effect the referee did not touch alone.
 */
function gateTactics(root) {
    const ambush = root.querySelector('select[name="ambush"]');
    const tactics = root.querySelector('input[name="tactics"]');
    const note = root.querySelector(".surprised");
    if ( !ambush || !tactics ) return;

    const sync = () => {
        tactics.disabled = ambush.value === "unaware";
        // The shared `.f` control paints its own colour, so core's :disabled styling never shows
        // through; without this the gate would be invisible until you clicked it.
        tactics.style.opacity = tactics.disabled ? "0.4" : "";
        if ( note ) note.hidden = !tactics.disabled;
    };
    ambush.addEventListener("change", sync);
    sync();
}

/**
 * Per-encounter state for a person. Everything it holds starts and stops with the combat, so none
 * of it belongs on the Actor: Core p.76 charges DM-1 on the reactor's next set of actions for
 * every Reaction taken, and Core p.73 gives the aware side of an ambush DM+6 on its Initiative
 * check, the unaware side DM-6, and everyone on a side the Effect of its one Tactics check.
 */
export class PersonCombatantData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // The reactions taken, not a count: the card names which ones, and the referee clearing
            // one is clearing a thing that happened rather than decrementing a number.
            reactions: new fields.ArrayField(new fields.StringField({
                required: true, blank: false, choices: MGT2.CombatReactions }), { initial: [] }),
            ambush: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.Ambush }),
            // Core p.76: diving for cover forgoes the next actions completely, which is a state and
            // not a DM. Surfaced, never enforced — the rule is the referee's to apply.
            forgone: new fields.BooleanField({ required: false, initial: false }),
            // Core p.73: the Effect of a Tactics check reaches "everyone on the same side", and the
            // system had no notion of a side. Initialised from the token's disposition in
            // `_preCreate` and overridable from there on (§9.30).
            side: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.CombatSides }),
            // The Effect of the Tactics check THIS combatant made, null when they made none — which
            // is not the same as an Effect of 0, a marginal success that is worth exactly nothing.
            // A side is no document, so the number hangs on the one Traveller p.73 says makes the
            // check; `sideTactics` is how the rest of the side reads it (§9.30).
            tactics: new fields.NumberField({
                required: false, nullable: true, integer: true, initial: null })
        };
    }

    /** @inheritDoc */
    prepareDerivedData() {
        this.reactionDM = -this.reactions.length;
    }

    /**
     * The Tactics Effect in force for this combatant's side. A getter and not derived data: it
     * reads the combat's other Combatants, which have not all prepared when this one does.
     */
    get sideTactics() {
        if ( !this.side ) return 0;
        if ( this.tactics !== null ) return this.tactics;
        return tacticsHolder(this.parent.parent, this.side)?.system.tactics ?? 0;
    }
}

/**
 * One crew member of one ship, for one encounter. `duty` lives here rather than on
 * `spacecraft.system.crew[]` because it is per-combat state on a shared party asset: on the
 * Combatant it clears when the encounter is deleted, for nothing (§9.26). The ship's roster does not
 * move — it keeps the station, the linked actor, the head count and the mount, because a ship has a
 * crew when no combat is running.
 *
 * Everything derived here is a getter rather than `prepareDerivedData`, because `Combatant#group` is
 * only assigned in `_prepareGroup`, which v14 runs *after* the system model has prepared
 * (`ClientDocument#prepareData`). A getter reads the ship whenever it is asked instead.
 */
export class CrewCombatantData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Which row of `spacecraft.system.crew[]` this is, by index — the same handle the ship
            // sheet uses everywhere (`data-row-index`, `system.crew.<i>.role`). It held the `role`
            // Item id until 2026-08-16 and that could not identify a row: two turret gunners share
            // one Gunner role Item, so both resolved to the first row (§9.98). An index has no
            // reordering or deletion control to go stale against — the roster's only mutation is a
            // drop, which fills a row in place or appends.
            station: new fields.NumberField({
                required: false, nullable: true, initial: null, integer: true, min: 0 }),
            // Core folio 164: everyone aboard who takes part is assigned a duty, and anyone without
            // one is a Passenger — so that is the initial value rather than a blank. Folio 172 lets
            // anyone reassign, at the cost of their action and taking effect the following round.
            duty: new fields.StringField({
                required: true, blank: false, initial: "passenger", choices: MGT2.CombatDuties }),
            // Core folio 164: a turret gunner chooses their turret at the start of the combat, which
            // is what makes this the encounter's answer; the roster's own is the standing one. Blank
            // is therefore the right initial value and joining a fight must NOT seed it from the
            // roster — a seeded copy is a snapshot, and the ship sheet's mount stops reaching the
            // dice the moment one is taken (§9.98).
            dutyTarget: new fields.StringField({
                required: false, blank: true, initial: "", trim: true }),
            spent: new fields.SchemaField({
                // Core folio 171: one action each in the Actions Step, cleared when the round turns
                // over. One per ROUND and not per step, which is why a boolean answers it.
                action: new fields.BooleanField({ required: false, initial: false }),
                // Reactions are not a fourth step: the Core resolves them when they are provoked, so
                // what is stored is which ones this round has already used up and nothing more.
                reactions: new fields.ArrayField(new fields.StringField({
                    required: true, blank: false, trim: true }), { initial: [] })
            })
        };
    }

    /**
     * `station` held a `role` Item id before 2026-08-16 and holds a row index after it. The id
     * cannot be resolved to an index from here — a DataModel migrating has no parent to read the
     * ship from — so a combat already running when the system updates loses the link and its crew
     * read as unmounted. That is visible rather than silently wrong, and re-adding the ship rebuilds
     * it; a combat does not outlive an upgrade in practice.
     * @inheritDoc
     */
    static migrateData(source) {
        if ( typeof source.station === "string" ) source.station = null;
        return super.migrateData(source);
    }

    /** The ship this crew member is aboard, through the group that is the ship. */
    get ship() {
        return this.parent.group?.system?.ship ?? null;
    }

    /** The roster row this Combatant came from. */
    get rosterRow() {
        if ( !Number.isInteger(this.station) ) return null;
        return this.ship?.system.crew[this.station] ?? null;
    }

    /**
     * The `role` Item id the station is, read through the row rather than stored. `role.actions[]` is
     * the only place that says what this crew member may do and in which step, and it is a property
     * of the station, not of the encounter — so a role reassigned on the ship sheet is picked up by
     * a fight already running.
     */
    get role() {
        return this.rosterRow?.role ?? null;
    }

    /** Core folio 164, via `MGT2.CombatDuties`: only the two gunner duties bind to a mount. */
    get needsMount() {
        return MGT2.CombatDuties[this.duty]?.mount === true;
    }

    /**
     * The mount this crew member is sitting at. The encounter's answer wins; failing that the
     * station's standing mount, so a roster filled in outside combat still names a turret.
     */
    get mount() {
        return this.dutyTarget || this.rosterRow?.dutyTarget || "";
    }

    /** Surfaced, never blocked: a half-filled roster is as common as a mistake. */
    get unmounted() {
        return this.needsMount && !this.mount;
    }
}

/**
 * @extends {Combatant}
 */
export class MGT2Combatant extends Combatant {

    /**
     * Core p.73: a Traveller's Initiative **is the Effect** of a DEX or INT check, and Core p.165
     * makes a ship's the total of 2D + Pilot + Thrust. One `CONFIG.Combat.initiative.formula`
     * cannot be both — it is right for the ship and wrong for the person by the size of the target
     * number — so the dispatch lives here, which is what `Combatant#_getInitiativeFormula` is for.
     *
     * Three more numbers ride on the same roll: the ambush DM (p.73, and Initiative is rolled once
     * for the whole combat, so "first round only" needs no round test), the side's Tactics Effect
     * (p.73, and the same reason it has to reach the formula rather than be added afterwards), and
     * a hundredths tie-break on DEX (p.73), which is what `CONFIG.Combat.initiative.decimals` was
     * already leaving room for.
     *
     * Ambush and Tactics are separate named terms rather than one total: they answer different
     * questions — whether this combatant was surprised, and how well their side was commanded —
     * and the roll's own tooltip has to be able to say which paid what.
     * @inheritDoc
     */
    _getInitiativeFormula() {
        // Core folio 165 rolls Initiative once per SHIP, and everyone aboard acts on that number —
        // so a crew member borrows their group's formula rather than rolling as a person.
        if ( this.type === CREW ) {
            return this.group?.system?.initiativeFormula ?? super._getInitiativeFormula();
        }
        // A sub-type that knows its own formula answers for itself: HG folio 115 rolls a fleet ship
        // and a squadron off figures no Actor carries. Duck-typed rather than keyed on the type,
        // which is what keeps `combat.js` and `fleet.js` two engines and not one import cycle.
        const own = this.system?.initiativeFormula;
        if ( typeof own === "string" ) return own;

        const actor = this.actor;
        if ( !actor || !PERSON_TYPES.has(actor.type) ) return super._getInitiativeFormula();

        const parts = ["2d6 + @initiative"];
        const target = MGT2.DifficultyTargets.Average;
        if ( target ) parts.push(`- ${target}`);

        const ambush = MGT2.Ambush[this.system?.ambush]?.dm ?? 0;
        if ( ambush ) parts.push(MGT2Helper.term(ambush, game.i18n.localize("MGT2.Combatant.Ambush")));

        const tactics = this.system?.sideTactics ?? 0;
        if ( tactics ) parts.push(MGT2Helper.term(tactics, game.i18n.localize("MGT2.Combatant.Tactics")));

        const dex = actor.system.characteristics?.dexterity?.value ?? 0;
        if ( dex > 0 ) parts.push(`+ ${(dex / 100).toFixed(2)}`);

        return parts.join(" ");
    }

    /**
     * A crew member has no Initiative of their own (Core folio 165) and v14 already makes every
     * member of a group read the group's number back (`Combatant#_prepareGroup`), so rolling one
     * individually would write a figure the next prepare discards. Roll the ship instead.
     * @inheritDoc
     */
    async rollInitiative(formula) {
        // A fleet ship HAS a number of its own until its fleet is rolled — HG folio 115 prints two
        // Initiative procedures and they are alternatives — so it defers only once the group holds
        // one, which is exactly when `_prepareGroup` would discard what was rolled here (§9.100 B3).
        const grouped = (this.type === CREW) || (this.system?.rollsWithGroup === true);
        if ( grouped && this.group ) {
            await this.group.rollInitiative();
            return this;
        }
        return super.rollInitiative(formula);
    }

    /**
     * The tracker creates a combatant with no type, so the person model is chosen from the actor it
     * points at rather than asked for — and the side is guessed from the token at the same moment,
     * which is the only moment the guess is worth anything (§9.30).
     * @inheritDoc
     */
    async _preCreate(data, options, user) {
        const allowed = await super._preCreate(data, options, user);
        if ( allowed === false ) return false;
        if ( data.type && (data.type !== CONST.BASE_DOCUMENT_TYPE) ) return;
        const actor = this.actor ?? game.actors.get(data.actorId);
        if ( !actor || !PERSON_TYPES.has(actor.type) ) return;
        // The placed token where there is one, and the actor's own prototype where the combatant was
        // added without one — a combatant with no token still belongs to a side.
        const disposition = this.token?.disposition ?? actor.prototypeToken?.disposition;
        // v14 refuses a bare type change: the system field has to arrive as a ForcedReplacement.
        this.updateSource({
            type: PERSON,
            system: foundry.data.operators.ForcedReplacement.create({
                side: sideForDisposition(disposition)
            })
        });
    }

    /* -------------------------------------------- */

    /**
     * The combatant this sheet's actor is acting as. Every unlinked token shares its actorId, so an
     * unqualified lookup answers for each mook as well — the token narrows it when there is one.
     * @param {Actor} actor
     * @param {TokenDocument} [token]
     * @returns {MGT2Combatant|null}
     */
    static forActor(actor, token) {
        if ( !actor || !game.combat ) return null;
        const combatants = game.combat.getCombatantsByActor(actor) ?? [];
        if ( token ) return combatants.find(entry => entry.token?.id === token.id) ?? null;
        // The sheet is the base actor's, and every unlinked token shares its actorId — so only a
        // linked token's combatant, or one placed with no token at all, is unambiguously this one.
        return combatants.find(entry => entry.token?.actorLink === true)
            ?? combatants.find(entry => !entry.token) ?? null;
    }

    /** Core p.76: DM-1 on the next set of actions for every Reaction already taken. */
    static reactionDM(actor, token) {
        return MGT2Combatant.forActor(actor, token)?.system?.reactionDM ?? 0;
    }

    /* -------------------------------------------- */

    /**
     * Take a Reaction. What it costs the reactor is stored; what it costs the ATTACKER is only
     * announced, because the system never resolves against a target — so the number is posted for
     * whoever is rolling to apply, the same way an attack's traits are surfaced rather than applied.
     * @param {string} key   A key of MGT2.CombatReactions
     */
    async react(key) {
        const reaction = MGT2.CombatReactions[key];
        if ( !reaction || (this.type !== PERSON) ) return;
        const update = { system: { reactions: [...this.system.reactions, key] } };
        if ( reaction.forgoes ) update.system.forgone = true;
        await this.update(update);

        const against = this.constructor.reactionPenalty(this.actor, key);
        return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.token }),
            // The card wrapper is what puts this message in the log's own frame — a bare <p> now
            // reads as broken beside a neighbour with a band.
            content: `<div class="mgt2 theme-light card"><p class="bare">${
                game.i18n.format("MGT2.Combatant.ReactionTaken", {
                    name: this.name,
                    reaction: game.i18n.localize(reaction.label),
                    against: MGT2Helper.signed(against),
                    // `update` has already refreshed the model, so this is the running total after
                    // the Reaction just taken rather than before it.
                    own: MGT2Helper.signed(this.system.reactionDM)
                })}</p></div>`
        });
    }

    /* -------------------------------------------- */

    /**
     * Core p.73: "one Traveller (or character under the referee's control) may make a Tactics check
     * at the start of a combat. The Effect of this check is then applied to the Initiative of
     * everyone on the same side." The side gets ONE check, so writing a new Effect takes the old
     * holder's away rather than adding a second — the number is stored against its maker because a
     * side is not a document, and everyone else on the side reads it back (§9.30).
     *
     * The book prints no cap and no floor: the Effect of a failed check is negative and applies as
     * it stands. Nothing here clamps it.
     * @param {number|null} effect   The Effect of the check, or null to take the side's away
     */
    async setTactics(effect) {
        const side = this.system?.side;
        if ( (this.type !== PERSON) || !side ) return this;
        const value = (effect === null) ? null : Math.trunc(Number(effect) || 0);

        // The clause p.73 opens with — "So long as they are not surprised" — is a precondition on
        // making the check at all, not a modifier to what it is worth, so it is refused rather than
        // warned about. Taking an Effect AWAY is always allowed: a combatant who becomes surprised
        // must still be able to stop holding one.
        if ( (value !== null) && (this.system.ambush === "unaware") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Combatant.TacticsSurprised", { name: this.name }));
            return this;
        }

        const updates = this.parent.combatants
            .filter(combatant => (combatant.type === PERSON) && (combatant.id !== this.id)
                && (combatant.system.side === side) && (combatant.system.tactics !== null))
            .map(combatant => ({ _id: combatant.id, system: { tactics: null } }));
        updates.push({ _id: this.id, system: { tactics: value } });
        await this.parent.updateEmbeddedDocuments("Combatant", updates);

        if ( value === null ) return this;

        // p.73 puts the check "at the start of a combat" and Initiative is rolled once for the whole
        // of it (§9.28), so an Effect arriving after the dice is the referee's to re-roll. Said out
        // loud and applied to nothing: retrofitting it would move a number nobody rolled.
        const rolled = this.parent.combatants.filter(combatant => (combatant.type === PERSON)
            && (combatant.system.side === side) && (combatant.initiative !== null));
        if ( rolled.length ) {
            ui.notifications.warn(game.i18n.format("MGT2.Combatant.TacticsLate", { count: rolled.length }));
        }

        return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.token }),
            content: `<div class="mgt2 theme-light card"><p class="bare">${
                game.i18n.format("MGT2.Combatant.TacticsTaken", {
                    name: this.name,
                    effect: MGT2Helper.signed(value, "+0"),
                    side: game.i18n.localize(MGT2.CombatSides[side])
                })}</p></div>`
        });
    }

    /**
     * The three things Core p.73 decides before the Initiative dice: which side this combatant is
     * on, whether they were ambushed, and the side's Tactics Effect. One dialog, because they are
     * one moment — and because two of the three are per-SIDE rules reached through a combatant.
     */
    async openSetup() {
        if ( this.type !== PERSON ) return null;
        const holder = tacticsHolder(this.parent, this.system.side);
        const content = await buildContent("systems/mgt2/templates/combat/side.html", {
            config: CONFIG.MGT2,
            side: this.system.side,
            ambush: this.system.ambush,
            tactics: this.system.tactics,
            // Who currently holds the side's check, when it is somebody else — so a referee typing
            // a second Effect can see what they are about to replace.
            holder: (holder && (holder.id !== this.id))
                ? { name: holder.name, effect: MGT2Helper.signed(holder.system.tactics, "+0") } : null
        });

        const data = await foundry.applications.api.DialogV2.input({
            window: { title: `${this.name} — ${game.i18n.localize("MGT2.Combatant.Setup")}` },
            classes: ["mgt2"],
            position: { width: 420 },
            content,
            ok: { label: "MGT2.Save", icon: "fa-solid fa-floppy-disk" },
            render: (event, dialog) => gateTactics(dialog.element),
            rejectClose: false
        });
        if ( !data ) return null;

        const update = { system: { side: data.side, ambush: data.ambush } };
        // Somebody on no side holds no side's check, so the two clear together — otherwise being put
        // back on a side later would resurrect an Effect rolled for a different one.
        if ( !data.side ) update.system.tactics = null;
        // p.73's precondition read against the state the referee is declaring right now: a Traveller
        // they have just marked surprised cannot go on holding their side's check either.
        const surprised = (data.ambush === "unaware") && (this.system.tactics !== null);
        if ( surprised ) update.system.tactics = null;
        await this.update(update);
        if ( surprised ) {
            ui.notifications.warn(game.i18n.format("MGT2.Combatant.TacticsDropped", { name: this.name }));
        }

        // After the side, never before: the Effect belongs to whichever side this combatant is on
        // once the dialog has been applied, and `setTactics` reads it back off the document. A
        // disabled control submits nothing, so `undefined` is the gated field and not a cleared one.
        if ( data.side && (data.tactics !== undefined) && (data.tactics !== this.system.tactics) ) {
            await this.setTactics(data.tactics);
        }
        return this;
    }

    /* -------------------------------------------- */

    /**
     * What the reactor imposes on their attacker. Dodging is the higher of the DEX DM and Athletics
     * (dexterity) and parrying is the Melee level (Core p.76), so both are read off the reactor's
     * own sheet; diving for cover is a flat figure and does not need one.
     * @returns {number}   Negative, as a DM against the attack roll
     */
    static reactionPenalty(actor, key) {
        const reaction = MGT2.CombatReactions[key];
        if ( !reaction ) return 0;
        if ( Number.isInteger(reaction.dm) ) return reaction.dm;
        const level = actor?.items?.find(item => (item.type === "talent")
            && (item.system.subType === "skill")
            && MGT2Helper.matchesSkill(item.name, reaction.skill))?.system.level ?? null;
        const characteristic = reaction.characteristic
            ? (actor?.system.characteristics?.[reaction.characteristic]?.dm ?? 0) : null;
        const best = Math.max(level ?? 0, characteristic ?? 0);
        return -Math.max(0, best);
    }
}

/**
 * The tracker's own context menu is the surface, because a Reaction is per-encounter state and the
 * tracker is where per-encounter state already lives. `getCombatTrackerContextOptions` is the hook
 * `ApplicationV2#_createContextMenu` builds from the class name.
 */
export function registerCombatantContextOptions() {
    Hooks.on("getCombatTrackerContextOptions", (application, options) => {
        const combatantOf = li => application.viewed?.combatants.get(li.dataset.combatantId);
        const person = li => {
            const combatant = combatantOf(li);
            return (combatant?.type === PERSON) ? combatant : null;
        };
        // Core p.73's start-of-combat questions. One entry rather than a side per key plus an
        // ambush per key plus a number prompt, which would be eight rows for three answers.
        options.push({
            label: "MGT2.Combatant.Setup",
            icon: '<i class="fa-solid fa-flag"></i>',
            visible: li => game.user.isGM && !!person(li),
            onClick: (event, li) => person(li)?.openSetup()
        });
        for ( const [key, reaction] of Object.entries(MGT2.CombatReactions) ) {
            options.push({
                label: reaction.label,
                icon: `<i class="${reaction.icon}"></i>`,
                visible: li => game.user.isGM && !!person(li),
                onClick: (event, li) => person(li)?.react(key)
            });
        }
        options.push({
            label: "MGT2.Combatant.ClearReactions",
            icon: '<i class="fa-solid fa-arrow-rotate-left"></i>',
            visible: li => game.user.isGM && (person(li)?.system.reactions.length > 0),
            onClick: (event, li) => person(li)?.update({
                system: { reactions: [], forgone: false } })
        });
    });
}
