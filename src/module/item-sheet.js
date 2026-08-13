import { MGT2 } from "./config.js";
import { EFFECT_ACTIONS, prepareEffects } from "./effects.js";
import { MGT2Helper } from "./helper.js";
import { copyItemWithContents } from "./item.js";
import { SheetModeMixin } from "./sheet-mode.js";
import { appendTraitText, bindTraitInput, prepareTraitBlock, refreshTraitNumbers } from "./traits.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Every block the sheet can compose from; each one is a partial of the same name. */
const BLOCKS = ["roll", "hazard", "specs", "carried", "traits", "relationship", "description",
  "detail", "notes", "software", "contents", "events", "station", "actions", "effects"];

const blockPath = id => `systems/mgt2/templates/items/blocks/${id}.html`;

/** The sub-type dictionary that names each type, where it has one. */
const SUBTYPES = {
  item: MGT2.ItemSubType,
  equipment: MGT2.EquipmentSubType,
  talent: MGT2.TalentSubType,
  disease: MGT2.DiseaseSubType
};

/**
 * The Traveller item sheet, shared by all item sub-types.
 *
 * One root template for every type: the types differ by which blocks they carry, not by which
 * layout they need, so the per-type work is a list of block names and nothing else.
 *
 * @extends {ItemSheetV2}
 * @mixes HandlebarsApplication
 */
export class TravellerItemSheet extends SheetModeMixin(HandlebarsApplicationMixin(ItemSheetV2)) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["mgt2", "item"],
    position: { width: 630, height: "auto" },
    window: { resizable: true, contentClasses: ["itemsheet"] },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      traitDelete: TravellerItemSheet.#onTraitDelete,
      eventCreate: TravellerItemSheet.#onCareerEventCreate,
      eventDelete: TravellerItemSheet.#onCareerEventDelete,
      modifierCreate: TravellerItemSheet.#onModifierCreate,
      modifierDelete: TravellerItemSheet.#onModifierDelete,
      actionCreate: TravellerItemSheet.#onRoleActionCreate,
      actionDelete: TravellerItemSheet.#onRoleActionDelete,
      itemRoll: TravellerItemSheet.#onItemRoll,
      reload: TravellerItemSheet.#onReload,
      nestedEdit: TravellerItemSheet.#onNestedEdit,
      nestedRemove: TravellerItemSheet.#onNestedRemove,
      nestedDelete: TravellerItemSheet.#onNestedDelete,
      ...EFFECT_ACTIONS
    }
  };

  /** @inheritDoc */
  static PARTS = {
    sheet: {
      root: true,
      template: "systems/mgt2/templates/items/item-sheet.html",
      templates: BLOCKS.map(blockPath)
    }
  };

  /**
   * Which blocks each type carries, in render order. Keyed by type, or by `type:subType` where the
   * sub-type changes the answer. A type absent from the map uses `_default`.
   *
   * `effects` is on every list, empty or not: any Item can carry an ActiveEffect and any of them
   * transfers to the owner, so a type that never shows the block is a type whose effects are
   * invisible.
   */
  static #BLOCKS_BY_TYPE = {
    _default: ["specs", "carried", "effects", "description"],
    weapon: ["roll", "specs", "carried", "traits", "effects", "description"],
    armor: ["specs", "carried", "traits", "effects", "description"],
    talent: ["roll", "effects", "description"],
    "talent:psionic": ["roll", "specs", "effects", "description"],
    disease: ["hazard", "effects", "description"],
    computer: ["specs", "carried", "traits", "effects", "description", "software"],
    container: ["carried", "effects", "description", "contents"],
    career: ["specs", "effects", "description", "events"],
    contact: ["relationship", "effects", "description", "notes"],
    species: ["specs", "traits", "effects", "description", "detail"],
    role: ["station", "actions", "effects", "description"]
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const actor = item.actor;
    const byType = TravellerItemSheet.#BLOCKS_BY_TYPE;
    const blocks = byType[`${item.type}:${item.system.subType}`] ?? byType[item.type] ?? byType._default;

    return Object.assign(context, {
      item,
      system: item.system,
      source: item.toObject().system,
      systemFields: item.system.schema.fields,
      config: CONFIG.MGT2,
      settings: {
        usePronouns: game.settings.get("mgt2", "usePronouns"),
        useGender: game.settings.get("mgt2", "useGender")
      },
      blocks: blocks.map(id => ({ id, template: blockPath(id) })),
      spine: this.#spine(),
      tags: this.#tags(),
      subTypes: SUBTYPES[item.type] ?? null,
      hadContainer: actor != null,
      // A bag is offered neither itself nor anything already inside it.
      containers: actor ? [{ name: "", _id: "" }].concat(actor.getContainers()
        .filter(c => (c.id !== item.id) && !c.containerChain.some(p => p.id === item.id))) : null,
      computers: actor ? [{ name: "", _id: "" }].concat(actor.getComputers()) : null,
      weight: "weight" in item.system ? item.system.weight : null,
      unitlabels: { weight: MGT2Helper.getWeightLabel() },
      isGM: game.user.isGM,
      skills: this.#prepareSkills(actor),
      roll: this.#prepareRoll(actor),
      traits: this.#prepareTraits(),
      effects: prepareEffects(item),
      // A Set is neither an array nor a plain object, so Handlebars cannot walk it.
      damageTypes: Array.from(item.system.damageType ?? [], key => game.i18n.localize(MGT2.DamageTypes[key])),
      scale: MGT2.WeaponScales[item.system.scale] ?? null,
      fireModes: this.#fireModes(),
      ammo: this.#ammo(),
      nested: this.#prepareNested(actor)
    });
  }

  /** The spine reads the sub-type where there is one, because that is the name on the character sheet. */
  #spine() {
    const item = this.item;
    // `TYPES.Item.container` disambiguates in the create dialog — too long to stand on a spine.
    if ( item.type === "container" ) return "MGT2.Items.Container";
    return SUBTYPES[item.type]?.[item.system.subType] ?? `TYPES.Item.${item.type}`;
  }

  /** The identity line under the name. */
  #tags() {
    const { type, system } = this.item;
    const tags = [];

    if ( type === "talent" ) {
      if ( system.skill.speciality ) tags.push(system.skill.speciality);
      tags.push(`${game.i18n.localize("MGT2.Items.Level")} ${system.level}`);
    }
    if ( type === "weapon" ) tags.push(game.i18n.localize(MGT2.WeaponScales[system.scale]?.label ?? ""));
    if ( "tl" in system ) tags.push(game.i18n.localize(MGT2.TL[system.tl] ?? ""));
    return tags.filter(tag => tag !== "");
  }

  /** The skill list the roll block offers, which only an owned item has. */
  #prepareSkills(actor) {
    const skills = [];
    for ( const item of actor?.items ?? [] ) {
      if ( item.type === "talent" && item.system.subType === "skill" ) {
        skills.push({ _id: item.id, name: item.getRollDisplay() });
      }
    }
    skills.sort(MGT2Helper.compareByName);
    // Every other option in the list states the level it contributes; unskilled states its own.
    return [{ _id: "NP",
      name: game.i18n.localize("MGT2.Items.NotProficient") + MGT2Helper.getDisplayDM(-3) }].concat(skills);
  }

  /**
   * The item's binding to its owner, stated as a sentence — which skill, which characteristic, at
   * what difficulty — plus the dispatch key the actor sheet's roll handler reads off the button.
   */
  #prepareRoll(actor) {
    const { type, system } = this.item;
    const hazard = type === "disease";
    const binding = system.roll ?? {};
    const dispatch = hazard ? "disease"
      : (type === "talent") ? (system.subType === "psionic" ? "psionic" : "skill")
        : "item";

    let skill = null;
    // Core p.229: a psionic talent is rolled as its own skill too, so both sub-types state a level.
    if ( type === "talent" ) {
      skill = game.i18n.format("MGT2.Items.LevelValue", { level: MGT2Helper.signed(system.level) });
    }
    else if ( binding.skill === "NP" ) {
      skill = game.i18n.localize("MGT2.Items.NotProficient") + MGT2Helper.getDisplayDM(-3);
    }
    else if ( binding.skill ) skill = actor?.items.get(binding.skill)?.getRollDisplay() ?? null;

    // Core p.229: the PSI DM rides every power, so the sentence states it even where the talent
    // names no characteristic of its own — which is what the prompt does with the same rule.
    const characteristic = binding.characteristic || ((dispatch === "psionic") ? "psionic" : "");

    return {
      hazard,
      dispatch,
      skill,
      characteristic: characteristic
        ? game.i18n.localize(MGT2.Characteristics[characteristic]) : null,
      difficulty: MGT2Helper.getDifficultyDisplay(hazard ? system.difficulty : binding.difficulty),
      label: hazard ? "MGT2.Items.Resist" : "MGT2.Items.Roll",
      // An item with no owner has no characteristics and no skills to roll against.
      disabled: actor === null
    };
  }

  /**
   * Core folio 79: what Auto X buys this weapon, one line per mode. **There is no fire-mode field
   * and there will not be one** — the folio makes the mode a choice per pull of the trigger, so it
   * is the prompt's control and the sheet's job is to state what each mode costs in rounds against
   * the magazine printed beside it.
   * @returns {string[]|null}   Null on anything that is not an Auto weapon
   */
  #fireModes() {
    const auto = (this.item.type === "weapon")
      ? MGT2Helper.traitScore(this.item.system.traits, "auto") : 0;
    if ( auto <= 0 ) return null;
    return Object.values(MGT2.FireModes).map(mode => {
      const label = game.i18n.localize(mode.label);
      if ( !mode.rounds ) return label;
      return game.i18n.format("MGT2.Items.FireModeCost", {
        mode: label,
        gain: mode.damage ? MGT2Helper.signed(auto)
          : game.i18n.format("MGT2.RollPrompt.FireModeAttacks", { count: auto }),
        rounds: mode.rounds * auto
      });
    });
  }

  /**
   * What is in the magazine, and what putting a full one in costs in actions. Core folio 77 makes a
   * spare magazine "fully reload the weapon", so there is one reload and no partial one; Core folio
   * 75 prices it at a Minor Action, and FC folio 7-8's Slow Loader X replaces that with X of them.
   * The cost is **stated and never spent** — nothing in this system keeps a ground-combat action
   * budget, which is the same treatment the prompt's aiming ladder already gets.
   * @returns {{value: number, magazine: number, full: boolean, actions: number}|null}
   */
  #ammo() {
    const { type, system } = this.item;
    if ( (type !== "weapon") || !(system.magazine > 0) ) return null;
    return {
      value: system.ammo,
      magazine: system.magazine,
      full: system.ammo >= system.magazine,
      actions: Math.max(1, MGT2Helper.traitScore(system.traits, "slow-loader"))
    };
  }

  /**
   * The trait array as the shared code row. A weapon's traits and a species' come from the
   * registry; the accessory lists the other types call options have no printed vocabulary, so they
   * declare the `custom` family and their autocomplete is empty by design.
   */
  #prepareTraits() {
    const { type, system } = this.item;
    const traits = (type === "weapon") || (type === "species");
    const property = traits ? "traits" : "options";
    // Most types carry neither array, and the context is built before the block list is consulted.
    const field = system.schema.fields[property];
    if ( !field ) return null;
    return prepareTraitBlock(system[property], property, field.element.fields.family.initial,
      traits ? "MGT2.Items.Traits" : "MGT2.Items.Options");
  }

  /**
   * What this item holds: software loaded into a computer, or items stored in a container. Both
   * read in play mode, so the list is not gated on the sheet being editable.
   *
   * Software is loaded into a machine an actor owns, so it still needs one. A container does not:
   * its contents are whatever sits beside it, in the world as much as on a character.
   */
  #prepareNested(actor) {
    const item = this.item;
    const isComputer = item.type === "computer";
    if ( !isComputer && (item.type !== "container") ) return [];

    const held = isComputer
      ? (actor?.items.filter(i => i.system.software?.computerId === item.id) ?? [])
      : item.contents;

    return held.map(sibling => ({
      _id: sibling.id,
      name: sibling.name,
      img: sibling.img,
      type: game.i18n.localize(`TYPES.Item.${sibling.type}`),
      bandwidth: sibling.system.software?.bandwidth ?? null,
      quantity: sibling.system.quantity ?? null,
      weight: MGT2Helper.roundWeight(sibling.getTotalWeight())
    })).sort(MGT2Helper.compareByName);
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    // A root part is unwrapped into the window content, so the sheet has no element of its own to
    // carry the variant: the application root does.
    this.element.classList.toggle("hazard", context.roll.hazard);
    const select = this.element.querySelector("[data-scale-select]");
    select?.addEventListener("change", () => this.#applyScale(select.value));
    bindTraitInput(this.element, (property, text) => this.#addTrait(property, text));
  }

  async #addTrait(property, text) {
    await this.submit();
    const family = this.item.system.schema.fields[property].element.fields.family.initial;
    const entries = appendTraitText(this.item.system[property], text, family);
    if (entries) await this.item.update({ [`system.${property}`]: entries });
  }

  /**
   * Fire control and power draw exist only above ground scale, and the scale also decides which
   * unit the range field speaks. Applied on change so the grid answers before the round trip.
   * @param {string} key
   */
  #applyScale(key) {
    const scale = MGT2.WeaponScales[key];
    if ( !scale ) return;
    const root = this.element;
    const unit = root.querySelector("[name='system.range.unit']");
    if ( unit ) unit.value = scale.range;
    for ( const field of ["fireControl", "power", "range.band"] ) {
      const input = root.querySelector(`[name='system.${field}']`);
      if ( !input ) continue;
      const applies = scale[field.split(".").pop()];
      input.disabled = !applies;
      input.closest("label")?.classList.toggle("off", !applies);
    }
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /**
   * Replaces `_getSubmitData` of the V1 sheet.
   * Note it must return an *expanded* object: the result is handed to Document#validate.
   * @inheritDoc
   */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    const system = submitData.system;

    // Equipping an item takes it out of its container; putting it in a container unequips it.
    if ( system?.container && ("equipped" in this.item.system) ) {
      const equippedChange = this.item.system.equipped !== system.equipped;
      const containerChange = this.item.system.container.id !== system.container.id;

      if ( equippedChange ) {
        if ( system.equipped === true ) system.container = { id: "" };
      }
      else if ( containerChange ) {
        const wasLoose = this.item.system.container.id === "" || this.item.system.container.id === null;
        if ( system.container.id !== "" && wasLoose ) system.equipped = false;
      }
    }

    // "weight" is a bare input outside the schema: convert it and drop it before validation.
    if ( "weight" in submitData ) {
      submitData.system ??= {};
      submitData.system.weight = MGT2Helper.roundWeight(submitData.weight);
      delete submitData.weight;
    }

    if ( system?.quantity !== undefined ) system.quantity = MGT2Helper.getIntegerFromInput(system.quantity);
    if ( system?.cost !== undefined ) system.cost = MGT2Helper.getIntegerFromInput(system.cost);

    // The chip row lets a printed parameter be retyped; the number a rule reads follows from it.
    for ( const property of ["traits", "options"] ) refreshTraitNumbers(system?.[property]);

    return submitData;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Append an entry to an indexed collection stored on the item, saving pending form edits first.
   * @param {string} property   The system property holding the collection
   * @param {object} blank      The entry to append
   * @this {TravellerItemSheet}
   */
  static async #appendEntry(property, blank) {
    await this.submit();
    const current = foundry.utils.getProperty(this.item.system, property) ?? [];
    return this.item.update({ [`system.${property}`]: [...Object.values(current), blank] });
  }

  /**
   * Remove one entry from an indexed collection stored on the item.
   * @param {string} property   The system property holding the collection
   * @param {number} index      The index to drop
   * @this {TravellerItemSheet}
   */
  static async #removeEntry(property, index) {
    await this.submit();
    const current = Object.values(foundry.utils.getProperty(this.item.system, property) ?? []);
    return this.item.update({ [`system.${property}`]: current.filter((_v, i) => i !== index) });
  }

  /* -------------------------------------------- */

  /** @this {TravellerItemSheet} */
  static #onTraitDelete(event, target) {
    const element = target.closest(".code");
    const property = element.closest("[data-property]").dataset.property;
    return TravellerItemSheet.#removeEntry.call(this, property, Number(element.dataset.traitIndex));
  }

  /** @this {TravellerItemSheet} */
  static #onCareerEventCreate() {
    return TravellerItemSheet.#appendEntry.call(this, "events", { age: "", description: "" });
  }

  /** @this {TravellerItemSheet} */
  static #onCareerEventDelete(event, target) {
    const element = target.closest(".events-part");
    return TravellerItemSheet.#removeEntry.call(this, "events", Number(element.dataset.eventsPart));
  }

  /** @this {TravellerItemSheet} */
  static #onRoleActionCreate() {
    return TravellerItemSheet.#appendEntry.call(this, "actions", { label: "", kind: "skill" });
  }

  /** @this {TravellerItemSheet} */
  static #onRoleActionDelete(event, target) {
    const element = target.closest(".actions-part");
    return TravellerItemSheet.#removeEntry.call(this, "actions", Number(element.dataset.actionsPart));
  }

  /** @this {TravellerItemSheet} */
  static #onModifierCreate() {
    return TravellerItemSheet.#appendEntry.call(this, "modifiers", { characteristic: "endurance", value: null });
  }

  /** @this {TravellerItemSheet} */
  static #onModifierDelete(event, target) {
    const element = target.closest(".modifiers-part");
    return TravellerItemSheet.#removeEntry.call(this, "modifiers", Number(element.dataset.modifiersPart));
  }

  /* -------------------------------------------- */

  /**
   * The roll belongs to the character sheet: it owns the characteristics, the skill list and the
   * Effect card. Its handler reads nothing but the clicked element's dataset, so this hands it the
   * item sheet's own button and borrows the sheet as `this` rather than growing a second roll path.
   * @this {TravellerItemSheet}
   */
  static #onItemRoll(event, target) {
    const sheet = this.item.actor?.sheet;
    let handler = sheet?.options.actions?.roll;
    if ( typeof handler === "object" ) handler = handler.handler;
    if ( typeof handler !== "function" ) return;
    return handler.call(sheet, event, target);
  }

  /**
   * Core folio 77: a spare magazine "will fully reload the weapon", so the whole capacity goes back
   * in and there is nothing to count. Whose action it is, is settled by folio 75 — the firer's Minor
   * Action — and the button says so rather than spending one.
   * @this {TravellerItemSheet}
   */
  static #onReload() {
    return this.item.update({ "system.loaded": this.item.system.magazine });
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /**
   * A contents row stands for a sibling document, not for anything embedded in this item, so what
   * leaves the sheet is that sibling's own drag data. Anything else is an effect.
   * @inheritDoc
   */
  async _onDragStart(event) {
    const nested = TravellerItemSheet.#nestedItem.call(this, event.currentTarget);
    if ( !nested ) return super._onDragStart(event);
    event.dataTransfer.setData("text/plain", JSON.stringify(nested.toDragData()));
  }

  /**
   * Storing something is a drop on the container's own sheet. All it writes is a reference, so an
   * item already in this collection only changes hands; one from a compendium, another actor or
   * the world is copied in with everything it holds.
   * @inheritDoc
   */
  async _onDrop(event) {
    const data = MGT2Helper.getDataFromDropEvent(event);
    const container = this.item;
    if ( (container.type !== "container") || (data?.type !== "Item") ) return super._onDrop(event);
    if ( !this.isEditable ) return;
    if ( Hooks.call("dropItemSheetData", container, this, data) === false ) return;

    // Only what carries a storage reference can be stored: a career or a skill has nowhere to put.
    const dropped = await getDocumentClass("Item").fromDropData(data);
    if ( !dropped || !("container" in dropped.system) ) return;

    if ( container.system.locked && !game.user.isGM ) {
      return ui.notifications.error(game.i18n.localize("MGT2.Errors.LockedContainer"));
    }
    // A bag cannot end up inside itself, at any remove.
    if ( (dropped.id === container.id) || container.containerChain.some(c => c.id === dropped.id) ) {
      return ui.notifications.error(game.i18n.localize("MGT2.Errors.ContainerRecursive"));
    }

    if ( (dropped.parent === container.parent) && (dropped.pack === container.pack) ) {
      if ( dropped.system.container?.id === container.id ) return;
      const update = { "system.container.id": container.id };
      // Stowing something takes it off, the way the storage select does.
      if ( "equipped" in dropped.system ) update["system.equipped"] = false;
      await dropped.update(update);
      return this.render();
    }

    const toCreate = await copyItemWithContents(dropped, container.id);
    // A world copy belongs in the same folder as the bag it went into; an owned one has none.
    for ( const entry of toCreate ) entry.folder = container.folder?.id ?? null;
    await getDocumentClass("Item").createDocuments(toCreate,
      { parent: container.parent, pack: container.pack, keepId: true });
    return this.render();
  }

  /* -------------------------------------------- */

  /** The sibling document a nested row stands for. @this {TravellerItemSheet} */
  static #nestedItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return id ? this.item.siblings?.get(id) : null;
  }

  /** @this {TravellerItemSheet} */
  static #onNestedEdit(event, target) {
    return TravellerItemSheet.#nestedItem.call(this, target)?.sheet.render({ force: true });
  }

  /**
   * A sibling changing is not a change to this item, so nothing re-renders the list on its own.
   * @this {TravellerItemSheet}
   */
  static async #onNestedRemove(event, target) {
    const field = this.item.type === "computer" ? "system.software.computerId" : "system.container.id";
    await TravellerItemSheet.#nestedItem.call(this, target)?.update({ [field]: "" });
    return this.render();
  }

  /** @this {TravellerItemSheet} */
  static async #onNestedDelete(event, target) {
    await TravellerItemSheet.#nestedItem.call(this, target)?.delete();
    return this.render();
  }
}
