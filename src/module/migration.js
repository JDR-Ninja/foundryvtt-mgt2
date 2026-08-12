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

const MIGRATIONS = [
  {
    version: "0.2.0",
    label: "damageOrder, protection, view state",
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
 * shape in memory, so writing the document back is enough to persist it; the `-=` keys remove what
 * would otherwise linger in the source forever.
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
    update["system.config.-=damages"] = null;
    dirty = true;
  }
  for ( const key of ["name", "containerView", "containerDropIn", "inventory"] ) {
    if ( key in source ) {
      update[`system.-=${key}`] = null;
      dirty = true;
    }
  }
  if ( source.states && ("encumbrance" in source.states) ) {
    update["system.states.-=encumbrance"] = null;
    dirty = true;
  }
  for ( const [key, characteristic] of Object.entries(source.characteristics ?? {}) ) {
    for ( const dropped of ["dm", "showMax"] ) {
      if ( dropped in characteristic ) {
        update[`system.characteristics.${key}.-=${dropped}`] = null;
        dirty = true;
      }
    }
  }

  return dirty ? update : null;
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
    update["system.-=trash"] = null;
    dirty = true;
  }
  if ( (item.type === "container") && (("weight" in source) || ("count" in source)) ) {
    update["system.-=weight"] = null;
    update["system.-=count"] = null;
    dirty = true;
  }
  if ( (item.type === "computer") && (("processingUsed" in source) || ("overload" in source)) ) {
    update["system.-=processingUsed"] = null;
    update["system.-=overload"] = null;
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
