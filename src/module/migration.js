import { MGT2Helper } from "./helper.js";

/**
 * World migrations.
 *
 * Shape changes inside `system` are handled by `DataModel.migrateData`, which runs on every read
 * and writes nothing — old worlds simply load correctly. This module exists for the second half:
 * persisting those shims so they can eventually be dropped, and carrying the changes migrateData
 * cannot express (a document's `type`, or anything outside `system`).
 *
 * Each entry runs once, in order, for worlds coming from a version older than its own — so an entry's
 * version must be one `system.json` actually reaches, or `migrateWorld` re-runs it on every load.
 *
 * **0.2.0 is unreleased, so its entry is still open and gains work rather than getting a successor.**
 * The cost is that a local world already stamped `0.2.0` does not see what was added afterwards: to
 * replay it, clear the setting — `game.settings.set("mgt2", "migrationVersion", "")` — and reload.
 * That is safe here because every step below re-runs to a no-op on a world it has already touched.
 */

/**
 * The `npc` person preset shipped the damage chain in UPP order; Core folio 77 applies damage to
 * END first. Both are spelled out here rather than read off `NpcData`: a migration records what it
 * did on one release and must not follow a constant a later one changes again.
 */
const NPC_CHAIN_STALE = ["strength", "dexterity", "endurance"];
const NPC_CHAIN_FIXED = ["endurance", "strength", "dexterity"];

const MIGRATIONS = [
  {
    version: "0.2.0",
    label: "damageOrder, protection, view state, crew duty, NPC damage chain, species unwind, ucp, durationUnit",
    async migrate() {
      // Before the sweep: it rewrites `characteristics.<k>.base`, which the sweep then persists.
      for ( const actor of game.actors ) await unwindSpecies(actor);

      const actorUpdates = [];
      for ( const actor of game.actors ) {
        const update = collectActorUpdate(actor);
        if ( update ) actorUpdates.push(update);
      }
      if ( actorUpdates.length ) await Actor.implementation.updateDocuments(actorUpdates);

      const itemUpdates = [];
      for ( const item of game.items ) {
        const update = collectItemUpdate(item);
        if ( update ) itemUpdates.push(update);
      }
      if ( itemUpdates.length ) await Item.implementation.updateDocuments(itemUpdates);

      for ( const actor of game.actors ) {
        const embedded = actor.items.map(collectItemUpdate).filter(Boolean);
        if ( embedded.length ) await actor.updateEmbeddedDocuments("Item", embedded);
      }

      // Last, so the chains this entry rewrote are the ones counted.
      return countRescaledLife();
    }
  }
];

/* -------------------------------------------- */

/**
 * How many actors come out of this with a different `life.max` (§9.1) — the number the completion
 * notice reports, because `life` is `primaryTokenAttribute` and every one of those tokens rescales.
 *
 * The comparison is possible at all because the two definitions live in two places: 0.1.x wrote
 * STR+DEX+END into the document on every update, and nothing writes `system.life` any more, so the
 * stored number is still the old reading while `actor.system.life` is the new sum over
 * `damageOrder`. A stored zero is an actor that write never ran for — it has no previous reading to
 * have moved — and `world` and `stash` carry no chain at all.
 * @returns {number}
 */
function countRescaledLife() {
  let count = 0;
  for ( const actor of game.actors ) {
    const stored = actor._source.system?.life?.max ?? 0;
    const now = actor.system.life?.max;
    if ( (stored > 0) && (now !== undefined) && (stored !== now) ) count++;
  }
  return count;
}

/* -------------------------------------------- */

/**
 * Take the species bonus back out of `base` and put the species Item on the actor instead (§9.18).
 *
 * **Every subtraction is logged, and that is not caution — it is the only check there can be.** The
 * write being unwound was `base + value`: additive, non-idempotent, and nothing in the data
 * distinguishes one drop from two, so a Traveller who took the same species twice comes out of this
 * still carrying one copy of the bonus and no code can tell. A world whose species Item is gone gets
 * a line naming the actor and is left alone, because guessing is worse than not moving.
 * @param {Actor} actor
 */
async function unwindSpecies(actor) {
  const name = actor._source.system?.personal?.species?.trim();
  if ( !name || (actor.type !== "character") ) return;
  // Already derived: an actor carrying the Item was never written to in the first place.
  if ( actor.items.some(item => item.type === "species") ) return;

  const species = game.items.find(item => (item.type === "species") && (item.name === name));
  if ( !species ) {
    console.warn(`mgt2 | "${actor.name}" names species "${name}" and no species Item matches it: `
      + `its characteristics are left exactly as stored, and the bonus (if any was ever applied) `
      + `has to be taken out by hand.`);
    return;
  }

  const characteristics = {};
  const taken = [];
  for ( const modifier of species.system.modifiers ?? [] ) {
    const c = actor._source.system.characteristics?.[modifier.characteristic];
    if ( !c || !Number.isFinite(modifier.value) ) continue;
    characteristics[modifier.characteristic] = { base: Math.max(0, c.base - modifier.value) };
    taken.push(`${modifier.characteristic} ${c.base} → ${Math.max(0, c.base - modifier.value)}`);
  }

  // eslint-disable-next-line no-console
  console.log(`mgt2 | "${actor.name}": species "${name}" moved off base and onto an Item`
    + (taken.length ? ` — ${taken.join(", ")}` : " — it carries no characteristic modifier"));

  if ( taken.length ) await actor.update({ system: { characteristics } });
  await actor.createEmbeddedDocuments("Item", [MGT2Helper.stripIds(species)]);
}

/* -------------------------------------------- */

/**
 * Drop the fields the 0.2.0 schema no longer declares. `migrateData` has already produced the new
 * shape in memory, so writing the document back is enough to persist it; the `ForcedDeletion`
 * operators remove what would otherwise linger in the source forever. That operator is v14's
 * replacement for the `-=key: null` syntax, which warns since 14 and is removed in 16.
 * @param {Actor} actor
 * @returns {object|null}
 */
function collectActorUpdate(actor) {
  const source = actor._source.system;
  if ( !source ) return null;
  const update = { _id: actor.id };
  let dirty = false;

  if ( source.config?.damages ) {
    update["system.config.damageOrder"] = actor.system.config.damageOrder;
    update["system.config.damages"] = new foundry.data.operators.ForcedDeletion();
    dirty = true;
  }
  // Only the exact stale triple, order included: nothing records who wrote a chain, so a reordered,
  // shortened or `hits`-based one is a decision and is left alone. The one case this cannot tell
  // apart — a referee who chose the buggy order — loses only the order, no wound and no link.
  if ( (actor.type === "npc") && isChain(source.config?.damageOrder, NPC_CHAIN_STALE) ) {
    update["system.config.damageOrder"] = [...NPC_CHAIN_FIXED];
    dirty = true;
  }
  for ( const key of ["name", "containerView", "containerDropIn", "inventory"] ) {
    if ( key in source ) {
      update[`system.${key}`] = new foundry.data.operators.ForcedDeletion();
      dirty = true;
    }
  }
  if ( source.states && ("encumbrance" in source.states) ) {
    update["system.states.encumbrance"] = new foundry.data.operators.ForcedDeletion();
    dirty = true;
  }
  // `crew[].duty` moved onto the `crew` Combatant, where it clears with the encounter (§9.26). It
  // carries nothing: there is no combat to carry it into, and the field never shipped outside 0.2.0.
  // Writing the prepared array back is the removal — an ArrayField update replaces, never merges.
  if ( (actor.type === "spacecraft") && source.crew?.some(row => "duty" in row) ) {
    update["system.crew"] = actor.system.crew.map(row => ({ ...row }));
    dirty = true;
  }
  // The UPP is the six canonical maxima and derives; a typed one beside them was a second source of
  // truth for one fact (§9.19). Logged rather than dropped silently: a world may have typed a
  // species profile the six characteristics do not reproduce.
  if ( source.personal && ("ucp" in source.personal) && (actor.type === "character") ) {
    if ( source.personal.ucp ) {
      // eslint-disable-next-line no-console
      console.log(`mgt2 | "${actor.name}": discarding the typed UPP "${source.personal.ucp}" — `
        + `it now derives as "${actor.system.upp}"`);
    }
    update["system.personal.ucp"] = new foundry.data.operators.ForcedDeletion();
    dirty = true;
  }
  for ( const [key, characteristic] of Object.entries(source.characteristics ?? {}) ) {
    for ( const dropped of ["dm", "showMax"] ) {
      if ( dropped in characteristic ) {
        update[`system.characteristics.${key}.${dropped}`] = new foundry.data.operators.ForcedDeletion();
        dirty = true;
      }
    }
  }

  return dirty ? update : null;
}

/** Same links in the same order, and no others. */
function isChain(stored, chain) {
  return Array.isArray(stored) && (stored.length === chain.length) && stored.every((key, i) => key === chain[i]);
}

/* -------------------------------------------- */

/**
 * @param {Item} item
 * @returns {object|null}
 */
function collectItemUpdate(item) {
  const source = item._source.system;
  if ( !source ) return null;
  const update = { _id: item.id };
  let dirty = false;

  if ( typeof source.protection === "string" ) {
    update["system.protection"] = item.system.protection;
    dirty = true;
  }
  if ( "trash" in source ) {
    update["system.trash"] = new foundry.data.operators.ForcedDeletion();
    dirty = true;
  }
  if ( (item.type === "container") && (("weight" in source) || ("count" in source)) ) {
    update["system.weight"] = new foundry.data.operators.ForcedDeletion();
    update["system.count"] = new foundry.data.operators.ForcedDeletion();
    dirty = true;
  }
  // A station's construction position used to be read off the Item's NAME, which is user text in
  // whatever language the world runs in. Stamping the derived key makes it explicit, so renaming
  // the station later cannot silently cost a ship its pilot's Pilot skill.
  if ( (item.type === "role") && !source.crewRole && item.system.crewRoleKey ) {
    update["system.crewRole"] = item.system.crewRoleKey;
    dirty = true;
  }
  if ( (item.type === "computer") && (("processingUsed" in source) || ("overload" in source)) ) {
    update["system.processingUsed"] = new foundry.data.operators.ForcedDeletion();
    update["system.overload"] = new foundry.data.operators.ForcedDeletion();
    dirty = true;
  }
  // `MGT2.Durations` had a French key name in the English dictionary, and `durationUnit` stores that
  // key rather than a label — so the typo was persisted on every psionic talent that names hours.
  if ( source.psionic?.durationUnit === "Heures" ) {
    update["system.psionic.durationUnit"] = "Hours";
    dirty = true;
  }

  return dirty ? update : null;
}

/* -------------------------------------------- */

/**
 * Run any migration the world has not seen yet. GM only — everyone else would race for the same
 * writes. Safe to call on every load: it is a no-op once the recorded version is current.
 */
export async function migrateWorld() {
  if ( !game.user.isGM ) return;

  const last = game.settings.get("mgt2", "migrationVersion");
  const pending = MIGRATIONS.filter(m => !last || foundry.utils.isNewerVersion(m.version, last));

  if ( !pending.length ) {
    // A fresh world has nothing to migrate, but must still be stamped.
    if ( last !== game.system.version ) await game.settings.set("mgt2", "migrationVersion", game.system.version);
    return;
  }

  // Permanent so it cannot scroll away mid-migration — hence the explicit removal below.
  const banner = ui.notifications.info(game.i18n.localize("MGT2.Migration.Begin"), { permanent: true });
  try {
    let count = 0;
    for ( const migration of pending ) {
      // Worth a log line: this rewrites documents once, and a GM chasing a problem needs the trace.
      // eslint-disable-next-line no-console
      console.log(`mgt2 | migrating world to ${migration.version}: ${migration.label}`);
      count += (await migration.migrate()) ?? 0;
    }
    await game.settings.set("mgt2", "migrationVersion", game.system.version);
    ui.notifications.info(game.i18n.format("MGT2.Migration.Complete", { count }));
  } catch(err) {
    // Leave migrationVersion untouched so the next load retries rather than skipping ahead.
    ui.notifications.error(game.i18n.localize("MGT2.Migration.Failed"), { permanent: true });
    throw err;
  } finally {
    ui.notifications.remove(banner);
  }
}
