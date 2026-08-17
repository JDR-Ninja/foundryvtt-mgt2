import { MGT2Helper } from "./helper.js";

/** How deep containers may nest before the chain is read as a mistake rather than a chain. */
export const MAX_CONTAINER_DEPTH = 5;

/**
 * Creation data for an item and everything it holds, re-keyed so the references between them
 * survive the move to another collection — `keepId: true` on creation is what makes the new ids
 * stick. What the copy sheds is every tie to where it came from: the machine software was loaded
 * in, and whether armour was being worn.
 *
 * @param {TravellerItem} item        The document being copied
 * @param {string} [containerId]      The container it lands in, blank for loose
 * @param {number} [depth]
 * @returns {Promise<object[]>}       The head of the list is the item itself
 */
export async function copyItemWithContents(item, containerId = "", depth = 0) {
  const data = item.toObject();
  data._id = foundry.utils.randomID();
  delete data.id;

  if ("container" in item.system) foundry.utils.setProperty(data, "system.container.id", containerId);
  if ("equipped" in item.system) foundry.utils.setProperty(data, "system.equipped", false);
  if (item.system.software) foundry.utils.setProperty(data, "system.software.computerId", "");
  // A bag that lands loose is on the traveller; one that lands inside another is carried through it.
  if (item.type === "container") foundry.utils.setProperty(data, "system.onHand", !containerId);

  const created = [data];
  if ((item.type === "container") && (depth < MAX_CONTAINER_DEPTH)) {
    for (const child of await item.getContents()) {
      created.push(...await copyItemWithContents(child, data._id, depth + 1));
    }
  }
  return created;
}

/**
 * The two rules a singular item obeys whatever wrote it, returned as an update rather than applied:
 * a create writes through `updateSource` and an update through the `changed` object it was handed.
 *
 * *Qty max 1* names only `computer` and software. A `container` is singular too and used to be
 * listed here, but `ItemContainerData` descends from `ItemBaseData` and has no `quantity` at all —
 * the schema is what makes it one, and a second rule saying so could only ever disagree (§9.127).
 *
 * @param {string} type            The Item type
 * @param {object} system          The system data the write would leave behind
 * @returns {object|null}          Flat update paths, or null when nothing is out of bounds
 */
function singularItemLimits(type, system) {
  const isSoftware = (type === "item") && (system.subType === "software");
  const limits = {};

  // Qty max 1
  if ((type === "computer" || isSoftware) && (system.quantity > 1)) limits["system.quantity"] = 1;
  // No Weight
  if (isSoftware && (system.weight > 0)) limits["system.weight"] = 0;

  return foundry.utils.isEmpty(limits) ? null : limits;
}

export class TravellerItem extends Item {

  /**
   * The item rules hold on a create as much as on an update: nothing on the sheet builds a stack of
   * computers, but a pack, a macro or a drop from another collection can (§9.127).
   * @inheritDoc
   */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    const limits = singularItemLimits(this.type, this.system);
    if (limits) this.updateSource(limits);
  }

  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;

    const limits = singularItemLimits(this.type, {
      subType: foundry.utils.getProperty(changed, "system.subType") ?? this.system.subType,
      quantity: foundry.utils.getProperty(changed, "system.quantity") ?? this.system.quantity,
      weight: foundry.utils.getProperty(changed, "system.weight") ?? this.system.weight
    });
    for (const [path, value] of Object.entries(limits ?? {})) foundry.utils.setProperty(changed, path, value);

    // The container it leaves has to be redrawn too, and by then the reference is already the new one.
    if (foundry.utils.hasProperty(changed, "system.container")) {
      options.mgt2FormerContainer = this.system.container?.id || null;
    }

    // A bag cannot end up inside itself, at any remove. Guarded here rather than at each control:
    // the storage select, a drop and a macro all arrive as the same write.
    const containerId = foundry.utils.getProperty(changed, "system.container.id");
    if (containerId && (this.type === "container")) {
      const target = this.siblings?.get(containerId);
      if ((containerId === this.id) || target?.containerChain.some(c => c.id === this.id)) {
        ui.notifications.error(game.i18n.localize("MGT2.Errors.ContainerRecursive"));
        return false;
      }
    }
  }

  /* -------------------------------------------- */
  /*  Containment                                 */
  /* -------------------------------------------- */

  /**
   * The collection this item's siblings live in. Storage is a reference between siblings — "in the
   * bag" means "in the same collection, pointing at the bag" — so an owned container holds the
   * actor's items and a loose one holds the world's. A compendium resolves to nothing here: every
   * caller on the derived-data path is synchronous and a pack read is not. See {@link getContents}.
   * @type {Collection<TravellerItem>|null}
   */
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

  /**
   * Every container this item sits inside, innermost first. Capped rather than cycle-checked: the
   * cap is also what stops a corrupt chain from walking forever.
   * @type {TravellerItem[]}
   */
  get containerChain() {
    const chain = [];
    let current = this.siblings?.get(this.system.container?.id);
    while (current && (chain.length < MAX_CONTAINER_DEPTH)) {
      chain.push(current);
      current = current.siblings?.get(current.system.container?.id);
    }
    return chain;
  }

  /**
   * Mass of this item, quantity included.
   * Worn armour counts a quarter of its mass; powered armour carries itself, and a container
   * weighs what it holds.
   * @param {Set<string>} [seen]   Containers already summed, so a cycle cannot recurse forever.
   */
  getTotalWeight(seen) {
    if (this.system.weightless === true) return 0;
    if (this.type === "container") return this.getContentsWeight(seen);
    if (!("weight" in this.system)) return 0;

    const qty = this.system.quantity;
    let weight = (!isNaN(qty) && qty > 0) ? this.system.weight * qty : 0;

    if (this.type === "armor" && this.system.equipped === true) {
      weight = this.system.powered === true ? 0 : weight * 0.25;
    }
    return weight;
  }

  /** What the contents weigh, whatever the container itself is flagged as. */
  getContentsWeight(seen = new Set()) {
    if (seen.has(this.id)) return 0;
    seen.add(this.id);
    return MGT2Helper.roundWeight(this.contents.reduce(
      (sum, item) => sum + MGT2Helper.roundWeight(item.getTotalWeight(seen)), 0));
  }

  /* -------------------------------------------- */

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

    // A loose container is deleted from a list its contents also live in, and the user can see
    // them there: taking them with it would silently remove items off the screen. They are cut
    // loose instead. An owned container still takes its contents with it — the actor cascades.
    if ((game.user.id !== userId) || (this.type !== "container") || this.isEmbedded || this.pack) return;
    const loose = this.contents.map(item => ({ _id: item.id, "system.container.id": "" }));
    if (loose.length) this.constructor.updateDocuments(loose);
  }

  /**
   * An item moving in or out is not a change to the container document, so nothing else would
   * redraw the sheet listing it. An owned item's actor sheet re-renders on its own.
   */
  #renderContainers(...ids) {
    for (const id of new Set(ids.filter(Boolean))) {
      const container = this.siblings?.get(id);
      if (container?.sheet?.rendered) container.sheet.render();
    }
  }

  /**
   * The skill as a roll names it: the name, its speciality, and the level it contributes.
   * @param {boolean} [level]   Drop the level for a caller that prints the DM in a cell of its own —
   *                            it would otherwise state the same number twice on one line.
   */
  getRollDisplay(level = true) {
    // Core p.229: a psionic talent is a skill — "Luka gains Telepathy 0" — so it states its level
    // the same way. Only a skill talent carries a speciality, and a psionic one leaves it blank.
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
