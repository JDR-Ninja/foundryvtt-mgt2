/**
 * World migrations.
 *
 * Shape changes inside `system` are handled by `DataModel.migrateData`, which runs on every read
 * and writes nothing — old worlds simply load correctly. This module exists for the second half:
 * persisting those shims so they can eventually be dropped, and carrying the changes migrateData
 * cannot express (a document's `type`, or anything outside `system`).
 *
 * Each entry runs once, in order, for worlds coming from a version older than its own.
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
    label: "damageOrder, protection, view state, crew duty, NPC damage chain",
    async migrate() {
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
    }
  }
];

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
    for ( const migration of pending ) {
      // Worth a log line: this rewrites documents once, and a GM chasing a problem needs the trace.
      // eslint-disable-next-line no-console
      console.log(`mgt2 | migrating world to ${migration.version}: ${migration.label}`);
      await migration.migrate();
    }
    await game.settings.set("mgt2", "migrationVersion", game.system.version);
    ui.notifications.info(game.i18n.localize("MGT2.Migration.Complete"));
  } catch(err) {
    // Leave migrationVersion untouched so the next load retries rather than skipping ahead.
    ui.notifications.error(game.i18n.localize("MGT2.Migration.Failed"), { permanent: true });
    throw err;
  } finally {
    ui.notifications.remove(banner);
  }
}
