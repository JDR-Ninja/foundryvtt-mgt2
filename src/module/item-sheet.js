import { MGT2Helper } from "./helper.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * The Traveller item sheet, shared by all item sub-types.
 *
 * A single root part is used rather than one part per section: the per-type templates each render
 * their own `.itemsheet-header` + `.itemsheet-panel` pair, and a root part is allowed to emit several
 * sibling elements. `_configureRenderParts` swaps the template for the item's sub-type, replacing the
 * `get template()` accessor of the V1 sheet.
 *
 * @extends {ItemSheetV2}
 * @mixes HandlebarsApplication
 */
export class TravellerItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    // See TravellerActorSheet: the mgt2 palette assumes a light sheet.
    classes: ["mgt2", "item", "themed", "theme-light"],
    position: { width: 630, height: "auto" },
    window: { resizable: true, contentClasses: ["itemsheet"] },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      optionCreate: TravellerItemSheet.#onOptionCreate,
      optionDelete: TravellerItemSheet.#onOptionDelete,
      eventCreate: TravellerItemSheet.#onCareerEventCreate,
      eventDelete: TravellerItemSheet.#onCareerEventDelete,
      modifierCreate: TravellerItemSheet.#onModifierCreate,
      modifierDelete: TravellerItemSheet.#onModifierDelete
    }
  };

  /** @inheritDoc */
  static PARTS = {
    sheet: {
      root: true,
      template: "systems/mgt2/templates/items/item-sheet.html", // replaced per sub-type
      templates: [
        "systems/mgt2/templates/items/parts/item-tabs.html",
        "systems/mgt2/templates/items/parts/sheet-configuration.html",
        "systems/mgt2/templates/items/parts/sheet-physical-item.html"
      ]
    }
  };

  /**
   * Declares the single tab group so that ApplicationV2 fills `context.tabs` on its own.
   * The actual tab list is per sub-type and comes from {@link TravellerItemSheet#_getTabsConfig}.
   * @inheritDoc
   */
  static TABS = {
    primary: { initial: "tab1", tabs: [] }
  };

  /** Tab layout per item sub-type. Types absent from this map use `_default`. */
  static #TABS_BY_TYPE = {
    _default: [
      { id: "tab1", label: "MGT2.Items.Description" },
      { id: "tab2", label: "MGT2.Items.Details" },
      { id: "tab3", label: "MGT2.Items.Configuration" }
    ],
    item: [
      { id: "tab1", label: "MGT2.Items.Description" },
      { id: "tab2", label: "MGT2.Items.Details" }
    ],
    species: [
      { id: "tab1", label: "MGT2.Items.Description" },
      { id: "tab2", label: "MGT2.Items.DetailedDescription" },
      { id: "tab3", label: "MGT2.Items.Details" }
    ],
    career: [
      { id: "tab1", label: "MGT2.Items.Description" },
      { id: "events", label: "MGT2.Items.EventsMishaps" }
    ],
    contact: [
      { id: "tab1", label: "MGT2.Items.Informations" },
      { id: "description", label: "MGT2.Items.Description" },
      { id: "notes", label: "MGT2.Items.Notes" }
    ],
    talent: [
      { id: "tab1", label: "MGT2.Items.Description" },
      { id: "config", label: "MGT2.Items.Configuration" }
    ],
    disease: []
  };

  /* -------------------------------------------- */

  /**
   * The theme is a client setting, so it cannot live in the static DEFAULT_OPTIONS
   * (which is evaluated once at import time).
   * @inheritDoc
   */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    const theme = game.settings.get("mgt2", "theme");
    if ( theme && !options.classes.includes(theme) ) options.classes.push(theme);
    return options;
  }

  /* -------------------------------------------- */

  /** Replaces the `get template()` accessor of the V1 sheet. @inheritDoc */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.sheet.template = `systems/mgt2/templates/items/${this.item.type}-sheet.html`;
    return parts;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getTabsConfig(group) {
    if ( group !== "primary" ) return super._getTabsConfig(group);
    const byType = TravellerItemSheet.#TABS_BY_TYPE;
    const tabs = (byType[this.item.type] ?? byType._default).map(t => ({ ...t, cssClass: "item tab-select" }));
    return { tabs, initial: tabs[0]?.id ?? null };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const actor = item.actor;

    return Object.assign(context, {
      item,
      system: item.system,
      source: item.toObject().system,
      config: CONFIG.MGT2,
      settings: { usePronouns: game.settings.get("mgt2", "usePronouns") },
      hadContainer: actor != null,
      containers: actor ? [{ name: "", _id: "" }].concat(actor.getContainers()) : null,
      computers: actor ? [{ name: "", _id: "" }].concat(actor.getComputers()) : null,
      weight: "weight" in item.system ? MGT2Helper.convertWeightForDisplay(item.system.weight) : null,
      unitlabels: { weight: MGT2Helper.getWeightLabel() },
      isGM: game.user.isGM,
      skills: this.#prepareSkills(actor)
    });
  }

  /* -------------------------------------------- */

  /**
   * The skill list offered by the "roll" configuration tab.
   * @param {Actor|null} actor
   * @returns {{_id: string, name: string}[]}
   */
  #prepareSkills(actor) {
    const skills = [];
    for ( const item of actor?.items ?? [] ) {
      if ( item.type === "talent" && item.system.subType === "skill" ) {
        skills.push({ _id: item.id, name: item.getRollDisplay() });
      }
    }
    skills.sort(MGT2Helper.compareByName);
    return [{ _id: "NP", name: game.i18n.localize("MGT2.Items.NotProficient") }].concat(skills);
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
      submitData.system.weight = MGT2Helper.convertWeightFromInput(submitData.weight);
      delete submitData.weight;
    }

    if ( system?.quantity !== undefined ) system.quantity = MGT2Helper.getIntegerFromInput(system.quantity);
    if ( system?.cost !== undefined ) system.cost = MGT2Helper.getIntegerFromInput(system.cost);

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
  static #onOptionCreate(event, target) {
    return TravellerItemSheet.#appendEntry.call(this, target.dataset.property, { name: "", description: "" });
  }

  /** @this {TravellerItemSheet} */
  static #onOptionDelete(event, target) {
    const element = target.closest(".options-part");
    return TravellerItemSheet.#removeEntry.call(this, element.dataset.property, Number(element.dataset.optionsPart));
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
  static #onModifierCreate() {
    return TravellerItemSheet.#appendEntry.call(this, "modifiers", { characteristic: "endurance", value: null });
  }

  /** @this {TravellerItemSheet} */
  static #onModifierDelete(event, target) {
    const element = target.closest(".modifiers-part");
    return TravellerItemSheet.#removeEntry.call(this, "modifiers", Number(element.dataset.modifiersPart));
  }
}
