// `DataField#clean` prunes a key the schema no longer declares, on construction and on update
// alike, so `_source` never carries one. Residue from a removed field stays in the database row
// unread, and no condition here can see it: a step written to delete one fires on NOTHING.
import { MGT2Helper } from "./helper.js";
import { seedRules } from "./rules.js";

/**
 * The `npc` person preset shipped the damage chain in UPP order; Core folio 77 applies damage to
 * END first.
 */
const NPC_CHAIN_STALE = ["strength", "dexterity", "endurance"];
const NPC_CHAIN_FIXED = ["endurance", "strength", "dexterity"];

const MIGRATIONS = [
  {
    version: "0.2.0",
    label: "damageOrder, protection, NPC damage chain, species unwind, species link, durationUnit, world geometry, training programmes, augment Computer/0",
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

/**
 * How many actors come out of this with a different `life.max` — the number the completion
 * notice reports, because `life` is `primaryTokenAttribute` and every one of those tokens rescales.
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

/**
 * Take the species bonus back out of `base` and put the species Item on the actor instead.
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

/**
 * One occurrence per species trait and never every match: a referee who typed the same one keeps it.
 * @returns {object[]|null}   The shortened list, or null where nothing matched
 */
function withoutSpeciesTraits(stored, speciesTraits) {
  const remaining = [...stored];
  let removed = 0;
  for ( const trait of speciesTraits ) {
    const index = remaining.findIndex(entry => traitKey(entry) === traitKey(trait));
    if ( index < 0 ) continue;
    remaining.splice(index, 1);
    removed++;
  }
  return removed ? remaining : null;
}

function traitKey(entry) {
  const params = (entry?.params ?? []).map(p => `${p.slot ?? ""}=${p.value ?? ""}`).join("|");
  return `${entry?.family ?? ""}/${entry?.key ?? ""}/${params}/${entry?.note ?? ""}`;
}

/** @returns {object|null} */
function collectActorUpdate(actor) {
  const source = actor._source.system;
  if ( !source ) return null;
  const update = { _id: actor.id };
  let dirty = false;

  // Only the exact stale triple, order included: nothing records who wrote a chain, so a reordered,
  // shortened or `hits`-based one is a decision and is left alone.
  if ( (actor.type === "npc") && isChain(source.config?.damageOrder, NPC_CHAIN_STALE) ) {
    update["system.config.damageOrder"] = [...NPC_CHAIN_FIXED];
    dirty = true;
  }
  const species = actor.items.find(item => item.type === "species");
  if ( species ) {
    if ( source.personal?.species !== species.id ) {
      update["system.personal.species"] = species.id;
      dirty = true;
    }
    const traits = withoutSpeciesTraits(source.traits ?? [], species.system.traits ?? []);
    if ( traits ) {
      // eslint-disable-next-line no-console
      console.log(`mgt2 | "${actor.name}": ${(source.traits?.length ?? 0) - traits.length} trait(s) `
        + `copied from "${species.name}" taken back off the Actor — they are read off the Item now`);
      update["system.traits"] = traits;
      dirty = true;
    }
  }
  // A world imported from the `mgt2-data` module carried its geometry in that module's flag
  // namespace, where the system could not read it; the two typed halves are in the schema now.
  if ( actor.type === "world" ) {
    const flags = actor._source.flags?.["mgt2-data"] ?? {};
    for ( const key of ["sector", "hex"] ) {
      if ( flags[key] && !source[key] ) {
        update[`system.${key}`] = flags[key];
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

/** @returns {object|null} */
function collectItemUpdate(item) {
  const source = item._source.system;
  if ( !source ) return null;
  const update = { _id: item.id };
  let dirty = false;

  // A station's construction position used to be read off the Item's NAME, which is user text in
  // whatever language the world runs in.
  if ( (item.type === "role") && !source.crewRole && item.system.crewRoleKey ) {
    update["system.crewRole"] = item.system.crewRoleKey;
    dirty = true;
  }
  // `augment.processing` became nullable: `0` used to mean "not a computer" and now means
  // Computer/0, so a stored zero would turn every fitted augment into a software host.
  if ( (item.type === "equipment") && (source.subType === "augment")
    && (source.augment?.processing === 0) ) {
    update["system.augment.processing"] = null;
    dirty = true;
  }
  // `MGT2.Durations` had a French key name in the English dictionary, and `durationUnit` stores
  // that key rather than a label — so the typo was persisted on every psionic talent that names
  // hours.
  if ( source.psionic?.durationUnit === "Heures" ) {
    update["system.psionic.durationUnit"] = "Hours";
    dirty = true;
  }

  return dirty ? update : null;
}

/** Run any migration the world has not seen yet. */
export async function migrateWorld() {
  if ( !game.user.isGM ) return;

  const last = game.settings.get("mgt2", "migrationVersion");
  // Before anything stamps the version: an empty `migrationVersion` is the only thing that tells a
  // world which has never loaded from one that was playing before a rule switch existed, and the
  // second must keep the behaviour it had (`rules.js`, `seed`).
  await seedRules(Boolean(last));

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
