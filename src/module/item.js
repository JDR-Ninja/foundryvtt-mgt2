import { MGT2Helper } from "./helper.js";

/** How deep containers may nest before the chain is read as a mistake rather than a chain. */
export const MAX_CONTAINER_DEPTH = 5;

/**
 * Creation data for an item, what it holds and what is fitted to it, re-keyed: `keepId: true` keeps the new ids.
 * @param {string} [containerId]   The container it lands in, blank for loose
 * @param {string} [fittedTo]      The weapon it lands fitted to instead, blank for none
 * @returns {Promise<object[]>}    The head of the list is the item itself
 */
export async function copyItemWithContents(item, containerId = "", depth = 0, fittedTo = "") {
  const data = item.toObject();
  data._id = foundry.utils.randomID();
  delete data.id;

  if ("container" in item.system) foundry.utils.setProperty(data, "system.container.id", fittedTo ? "" : containerId);
  if ("equipped" in item.system) foundry.utils.setProperty(data, "system.equipped", false);
  if (item.system.software) foundry.utils.setProperty(data, "system.software.computerId", "");
  if ("fittedTo" in item.system) foundry.utils.setProperty(data, "system.fittedTo", fittedTo);
  if ("accessory" in item.system) foundry.utils.setProperty(data, "system.accessory.deployed", false);
  // A bag that lands loose is on the traveller; one that lands inside another is carried through it.
  if (item.type === "container") foundry.utils.setProperty(data, "system.onHand", !containerId);

  const created = [data];
  if ((item.type === "container") && (depth < MAX_CONTAINER_DEPTH)) {
    for (const child of await item.getContents()) {
      created.push(...await copyItemWithContents(child, data._id, depth + 1));
    }
  }
  if (depth < MAX_CONTAINER_DEPTH) {
    for (const child of await item.getFitted()) {
      created.push(...await copyItemWithContents(child, "", depth + 1, data._id));
    }
  }
  return created;
}

export function isAccessory(item) {
  return (item?.type === "equipment") && (item.system?.subType === "accessory");
}

/** Whether an Item, or its data, is fitted to the weapon it is dropped on: an accessory (CSC folio 174), or a weapon. */
export function fitsWeapon(item) {
  return isAccessory(item) || (item?.type === "weapon");
}

/** FC folio 40 fits a secondary weapon to a primary; neither may already be one of a pair. */
export function secondaryRefused(item, host, carried) {
  if ( (item?.type !== "weapon") || !host ) return false;
  return (host === item) || Boolean(host.fittedHost) || carried.some(entry => entry.type === "weapon");
}

/**
 * The two rules a singular item obeys whatever wrote it, returned as an update rather than applied:
 * a create writes through `updateSource` and an update through the `changed` object it was handed.
 * @param {object} system          The system data the write would leave behind
 * @returns {object|null}          Flat update paths, or null when nothing is out of bounds
 */
export function singularItemLimits(type, system) {
  const isSoftware = (type === "item") && (system.subType === "software");
  const limits = {};

  // Qty max 1
  if ((type === "computer" || isSoftware) && (system.quantity > 1)) limits["system.quantity"] = 1;
  // No Weight
  if (isSoftware && (system.weight > 0)) limits["system.weight"] = 0;

  return foundry.utils.isEmpty(limits) ? null : limits;
}

export class TravellerItem extends Item {

  /** The item rules hold on a create too: a pack, a macro or a drop can build a stack of computers. @inheritDoc */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    const limits = singularItemLimits(this.type, this.system);
    if (limits) this.updateSource(limits);
  }

  /** A weapon created fitted to a secondary, in the same batch or beside it, is refused as an update is. @inheritDoc */
  static async _preCreateOperation(documents, operation, user) {
    if ((await super._preCreateOperation(documents, operation, user)) === false) return false;
    const batch = new Map(documents.map(doc => [doc.id, doc]));
    const siblings = operation.parent?.items ?? (operation.pack ? null : game.items);
    const host = doc => {
      const id = doc?.system?.fittedTo;
      const found = id ? (batch.get(id) ?? siblings?.get(id)) : null;
      return ((found?.type === "weapon") && (found !== doc)) ? found : null;
    };
    const refused = documents.filter(doc => (doc.type === "weapon") && host(host(doc)));
    if (!refused.length) return;
    ui.notifications.error(game.i18n.localize("MGT2.Errors.FitDepth"));
    for (const doc of refused) documents.splice(documents.indexOf(doc), 1);
    if (!documents.length) return false;
  }

  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;

    const limits = singularItemLimits(this.type, {
      subType: foundry.utils.getProperty(changed, "system.subType") ?? this.system.subType,
      quantity: foundry.utils.getProperty(changed, "system.quantity") ?? this.system.quantity,
      weight: foundry.utils.getProperty(changed, "system.weight") ?? this.system.weight
    });
    for (const [path, value] of Object.entries(limits ?? {})) foundry.utils.setProperty(changed, path, value);

    // Fitting takes an Item out of its container, and storing it takes it off the weapon.
    const fittedTo = foundry.utils.getProperty(changed, "system.fittedTo");
    const fits = Boolean(fittedTo) && (fittedTo !== this.system.fittedTo);
    const stored = foundry.utils.getProperty(changed, "system.container.id");
    if (fits && ("container" in this.system)) foundry.utils.setProperty(changed, "system.container.id", "");
    else if (stored && (stored !== this.system.container?.id) && this.system.fittedTo) {
      foundry.utils.setProperty(changed, "system.fittedTo", "");
    }
    // CSC folio 174: setting a bipod up takes two Minor Actions, so one that moves arrives folded.
    const moved = foundry.utils.getProperty(changed, "system.fittedTo") ?? this.system.fittedTo;
    if (("accessory" in this.system) && (moved !== this.system.fittedTo)) {
      foundry.utils.setProperty(changed, "system.accessory.deployed", false);
    }
    if (fits && !user.isGM && this.siblings?.get(fittedTo)?.isLocked) {
      ui.notifications.error(game.i18n.localize("MGT2.Errors.LockedContainer"));
      return false;
    }
    if (fits && secondaryRefused(this, this.siblings?.get(fittedTo), this.fitted)) {
      ui.notifications.error(game.i18n.localize("MGT2.Errors.FitDepth"));
      return false;
    }

    // The container it leaves has to be redrawn too, and by then the reference is already the new one.
    if (foundry.utils.hasProperty(changed, "system.container")) {
      options.mgt2FormerContainer = this.system.container?.id || null;
    }

    // A bag cannot end up inside itself, at any remove.
    const containerId = foundry.utils.getProperty(changed, "system.container.id");
    if (containerId && (this.type === "container")) {
      const target = this.siblings?.get(containerId);
      if ((containerId === this.id) || target?.containerChain.some(c => c.id === this.id)) {
        ui.notifications.error(game.i18n.localize("MGT2.Errors.ContainerRecursive"));
        return false;
      }
    }

    // A player stores nothing into a lock, at any depth, whatever wrote it.
    if (containerId && !user.isGM && (containerId !== this.system.container?.id)
      && this.siblings?.get(containerId)?.isLocked) {
      ui.notifications.error(game.i18n.localize("MGT2.Errors.LockedContainer"));
      return false;
    }
  }

  /** The collection this item's siblings live in. @type {Collection<TravellerItem>|null} */
  get siblings() {
    if (this.pack) return null;
    return this.isEmbedded ? (this.actor?.items ?? null) : game.items;
  }

  /** @type {TravellerItem[]} */
  get contents() {
    if (this.type !== "container") return [];
    return this.siblings?.filter(item => item.system.container?.id === this.id) ?? [];
  }

  /** The same list, resolving a compendium container's the only way a pack allows. */
  async getContents() {
    if ((this.type !== "container") || !this.pack) return this.contents;
    const documents = await game.packs.get(this.pack)?.getDocuments() ?? [];
    return documents.filter(item => item.system.container?.id === this.id);
  }

  /** The weapon this is fitted to, or null where the id names no weapon beside it. @type {TravellerItem|null} */
  get fittedHost() {
    const id = this.system.fittedTo;
    const host = id ? this.siblings?.get(id) : null;
    return ((host?.type === "weapon") && (host !== this)) ? host : null;
  }

  /** What is fitted to this weapon. @type {TravellerItem[]} */
  get fitted() {
    if (this.type !== "weapon") return [];
    return this.siblings?.filter(item => (item !== this) && (item.system.fittedTo === this.id)) ?? [];
  }

  /** The same list, read off a pack through its index. */
  async getFitted() {
    if ((this.type !== "weapon") || !this.pack) return this.fitted;
    const pack = game.packs.get(this.pack);
    const index = await pack?.getIndex({ fields: ["system.fittedTo"] });
    const ids = (index ?? []).filter(entry => (entry._id !== this.id) && (entry.system?.fittedTo === this.id))
      .map(entry => entry._id);
    return ids.length ? pack.getDocuments({ _id__in: ids }) : [];
  }

  /** The weapon this travels with, a secondary's accessory going with the primary; itself when fitted to nothing. */
  get fittedRoot() {
    let root = this;
    for (let hops = 0; root.fittedHost && (hops < MAX_CONTAINER_DEPTH); hops++) root = root.fittedHost;
    return root;
  }

  /** The name its attack goes by: a secondary's follows its primary's, a shared stem said once (FC folio 98). */
  get attackName() {
    const host = this.fittedHost;
    if (!host || (this.type !== "weapon")) return this.name;
    const stem = /^(.+?)\s*\(([^()]+)\)$/;
    const own = stem.exec(this.name);
    const shared = own && (own[1] === stem.exec(host.name)?.[1]);
    return shared ? `${own[1]} — ${own[2]}` : `${host.name} — ${this.name}`;
  }

  /** Every container this item sits inside, innermost first; a fitted Item sits in its weapon's. @type {TravellerItem[]} */
  get containerChain() {
    const chain = [];
    let current = this.siblings?.get(this.fittedRoot.system.container?.id);
    while (current && (chain.length < MAX_CONTAINER_DEPTH)) {
      chain.push(current);
      current = current.siblings?.get(current.system.container?.id);
    }
    return chain;
  }

  /** Whether this is a locked container or sits inside one, at any depth. @type {boolean} */
  get isLocked() {
    return [this, ...this.containerChain].some(c => c.system.locked === true);
  }

  /** Mass of this item, quantity included; `seen` holds what is already summed, so a cycle cannot recurse forever. */
  getTotalWeight(seen = new Set()) {
    if (this.system.weightless === true) return 0;
    if (this.type === "container") return this.getContentsWeight(seen);
    if (!("weight" in this.system) || seen.has(this.id)) return 0;
    seen.add(this.id);

    const qty = this.system.quantity;
    let weight = (!isNaN(qty) && qty > 0) ? this.system.weight * qty : 0;

    if (this.type === "armor" && this.system.equipped === true) {
      weight = ((this.system.powered === true) && this.system.running) ? 0 : weight * 0.25;
    }
    return this.fitted.reduce((sum, item) => sum + item.getTotalWeight(seen), weight);
  }

  /** What the contents weigh, whatever the container itself is flagged as. */
  getContentsWeight(seen = new Set()) {
    if (seen.has(this.id)) return 0;
    seen.add(this.id);
    return MGT2Helper.roundWeight(this.contents.reduce(
      (sum, item) => sum + MGT2Helper.roundWeight(item.getTotalWeight(seen)), 0));
  }

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    this.#renderContainers(this.system.container?.id);
  }

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (foundry.utils.hasProperty(changed, "system.container")) {
      this.#renderContainers(options.mgt2FormerContainer, this.system.container?.id);
    }
  }

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    this.#renderContainers(this.system.container?.id);

    // A loose container is deleted from a list its contents also live in, and the user can see them
    // there: taking them with it would silently remove items off the screen.
    if ((game.user.id !== userId) || (this.type !== "container") || this.isEmbedded || this.pack) return;
    const loose = this.contents.map(item => ({ _id: item.id, "system.container.id": "" }));
    if (loose.length) this.constructor.updateDocuments(loose);
  }

  /** An item moving in or out is no change to the container document, so nothing else redraws its sheet. */
  #renderContainers(...ids) {
    for (const id of new Set(ids.filter(Boolean))) {
      const container = this.siblings?.get(id);
      if (container?.sheet?.rendered) container.sheet.render();
    }
  }

  /**
   * The skill as a roll names it: the name, its speciality, and the level it contributes.
   * @param {boolean} [level]   Drop the level for a caller that prints the DM in a cell of its own
   *     — it would otherwise state the same number twice on one line.
   */
  getRollDisplay(level = true) {
    // Core p.229: a psionic talent is a skill — "Luka gains Telepathy 0" — so it states its level
    // the same way.
    if (this.type === "talent") {
      const speciality = this.system.skill.speciality;
      let label = (speciality && !MGT2Helper.nameStatesSpeciality(this.name, speciality))
        ? `${this.name} (${speciality})` : this.name;
      if (level && (this.system.level !== 0)) label += ` (${MGT2Helper.signed(this.system.level)})`;
      return label;
    }

    return this.name;
  }
}
