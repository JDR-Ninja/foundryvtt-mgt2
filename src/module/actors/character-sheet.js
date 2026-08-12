import { ChatHelper } from "../chatHelper.js";
import { MGT2 } from "../config.js";
import { EFFECT_ACTIONS, prepareEffects } from "../effects.js";
import { MGT2Helper } from "../helper.js";
import { RollPromptHelper } from "../roll-prompt.js";
import { SheetModeMixin } from "../sheet-mode.js";
import { appendTraitText, bindTraitInput, formatTrait, prepareTraitBlock, refreshTraitNumbers } from "../traits.js";
import { CharacterPrompts } from "./character-prompts.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { DragDrop } = foundry.applications.ux;

const PARTS_PATH = "systems/mgt2/templates/actors";

/**
 * The Traveller character sheet.
 *
 * The layout is a grid on the window content and every section is its own part, so a change can
 * be rendered where it happened instead of rebuilding the whole sheet — which matters with
 * `submitOnChange` and two ProseMirror editors.
 *
 * @extends {ActorSheetV2}
 * @mixes HandlebarsApplication
 */
export class TravellerActorSheet extends SheetModeMixin(HandlebarsApplicationMixin(ActorSheetV2)) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["mgt2", "actor", "character", "nopad"],
    position: { width: 860, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      containerCreate: TravellerActorSheet.#onContainerCreate,
      containerEdit: TravellerActorSheet.#onContainerEdit,
      containerDelete: TravellerActorSheet.#onContainerDelete,
      itemCreate: TravellerActorSheet.#onItemCreate,
      itemEdit: TravellerActorSheet.#onItemEdit,
      itemDelete: TravellerActorSheet.#onItemDelete,
      itemEquip: TravellerActorSheet.#onItemEquip,
      itemStorageIn: TravellerActorSheet.#onItemStorageIn,
      itemStorageOut: TravellerActorSheet.#onItemStorageOut,
      softwareEject: TravellerActorSheet.#onSoftwareEject,
      applyDamage: TravellerActorSheet.#onApplyDamage,
      applyStun: TravellerActorSheet.#onApplyStun,
      restHour: TravellerActorSheet.#onRestHour,
      pickOverflow: TravellerActorSheet.#onPickOverflow,
      firstAid: TravellerActorSheet.#onFirstAid,
      firstAidReset: TravellerActorSheet.#onFirstAidReset,
      surgery: TravellerActorSheet.#onSurgery,
      medicalCare: TravellerActorSheet.#onMedicalCare,
      naturalHealing: TravellerActorSheet.#onNaturalHealing,
      mentalHealing: TravellerActorSheet.#onMentalHealing,
      revive: TravellerActorSheet.#onRevive,
      roll: TravellerActorSheet.#onRoll,
      openConfig: TravellerActorSheet.#onOpenConfig,
      openCharacteristic: TravellerActorSheet.#onOpenCharacteristic,
      traitDelete: TravellerActorSheet.#onTraitDelete,
      openEditor: TravellerActorSheet.#onOpenEditor,
      ...EFFECT_ACTIONS
    }
  };

  /**
   * Parts render in this order but are positioned by grid area, so the five sidebar panels share
   * one cell and only the active one occupies it.
   * @inheritDoc
   */
  static PARTS = {
    header: { template: `${PARTS_PATH}/parts/header.html` },
    characteristics: {
      template: `${PARTS_PATH}/parts/characteristics.html`,
      templates: [`${PARTS_PATH}/parts/characteristic.html`]
    },
    nav: { template: `${PARTS_PATH}/parts/nav.html`, templates: [`${PARTS_PATH}/parts/tabs-nav.html`] },
    health: {
      template: `${PARTS_PATH}/tabs/health.html`,
      templates: [`${PARTS_PATH}/parts/row-controls.html`],
      scrollable: [""]
    },
    skills: {
      template: `${PARTS_PATH}/tabs/skills.html`,
      templates: [`${PARTS_PATH}/parts/row-controls.html`,
        "systems/mgt2/templates/items/blocks/traits.html"],
      scrollable: [""]
    },
    inventory: {
      template: `${PARTS_PATH}/tabs/inventory.html`,
      templates: [`${PARTS_PATH}/parts/tabs-nav.html`, `${PARTS_PATH}/parts/row-controls.html`],
      scrollable: ['.tab[data-group="inventory"].active']
    },
    relations: {
      template: `${PARTS_PATH}/tabs/relations.html`,
      templates: [`${PARTS_PATH}/parts/row-controls.html`],
      scrollable: [""]
    },
    biography: { template: `${PARTS_PATH}/tabs/biography.html` },
    effects: {
      template: `${PARTS_PATH}/tabs/effects.html`,
      templates: ["systems/mgt2/templates/items/blocks/effects.html"],
      scrollable: [""]
    },
    footer: { template: `${PARTS_PATH}/parts/footer.html` }
  };

  /** @inheritDoc */
  static TABS = {
    sidebar: {
      initial: "health",
      tabs: [
        { id: "health", cssClass: "item tab-select", icon: "fa-solid fa-heart-pulse", label: "MGT2.Actor.Health" },
        { id: "skills", cssClass: "item tab-select", icon: "fa-solid fa-head-side", label: "MGT2.Actor.TabSkills" },
        { id: "inventory", cssClass: "item tab-select", icon: "fa-solid fa-briefcase-blank", label: "MGT2.Actor.Inventory" },
        { id: "relations", cssClass: "item tab-select", icon: "fa-solid fa-users", label: "MGT2.Actor.Contacts" },
        { id: "biography", cssClass: "item tab-select", icon: "fa-solid fa-book-user", label: "MGT2.Actor.Biography" },
        { id: "effects", cssClass: "item tab-select", icon: "fa-solid fa-person-rays", label: "MGT2.Effects.Title" }
      ]
    },
    inventory: {
      initial: "onhand",
      tabs: [
        { id: "onhand", cssClass: "item tab-select", icon: "fa-solid fa-person-walking-luggage", label: "MGT2.Items.OnHand" },
        { id: "storage", cssClass: "item tab-select", icon: "fa-solid fa-treasure-chest", label: "MGT2.Items.Storage" },
        { id: "finance", cssClass: "item tab-select", icon: "fa-solid fa-credit-card", label: "MGT2.Actor.Finance" }
      ]
    }
  };

  /** Which parts a change to these paths can affect. Longest prefix wins. */
  static #PARTS_BY_PATH = [
    ["system.traits", ["skills"]],
    // The encumbrance cap in the footer is STR + END, so a score reaches it too, and the recovery
    // block reads the wound.
    ["system.characteristics", ["characteristics", "header", "footer", "health"]],
    ["system.biography", ["biography"]],
    ["system.finance", ["inventory"]],
    ["system.personal", ["header", "skills"]],
    ["system.health", ["health", "header"]],
    ["system.config", ["characteristics", "skills", "header"]],
    ["system.states", ["header", "health"]],
    ["system.study", ["skills"]],
    ["system.notes", ["biography"]],
    ["name", ["header"]],
    ["img", ["header"]]
  ];

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /**
   * The sheet marks its draggable rows with `.drag-item-list` rather than the core `.draggable`,
   * so the inherited DragDrop instance is replaced wholesale (the parent's backing field is private).
   * @type {DragDrop}
   * @protected
   * @override
   */
  get _dragDrop() {
    return this.#dragDrop ??= new DragDrop.implementation({
      dragSelector: ".drag-item-list",
      permissions: {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      },
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      }
    });
  }

  /** @type {DragDrop|null} */
  #dragDrop = null;

  /* -------------------------------------------- */
  /*  View State                                  */
  /* -------------------------------------------- */

  /**
   * Which container the Storage tab filters on, and which one items are dropped into.
   * This is one viewer's preference, so it belongs to the User: on the actor it was a world write
   * that two players looking at the same sheet would fight over.
   * @type {{view: string, dropIn: string}}
   */
  get viewState() {
    const stored = game.user.getFlag("mgt2", `containers.${this.actor.id}`) ?? {};
    return { view: stored.view ?? "", dropIn: stored.dropIn ?? "" };
  }

  async setViewState(changes) {
    const current = this.viewState;
    const next = { ...current, ...changes };
    if ( (next.view === current.view) && (next.dropIn === current.dropIn) ) return;
    await game.user.setFlag("mgt2", `containers.${this.actor.id}`, next);
    // Nothing on the document changed, so nothing else would redraw the filtered list.
    return this.render();
  }

  /** @type {object} */
  #pendingViewState = {};

  /**
   * The overflow this sheet is waiting for the target to route, or null. Sheet state, not actor
   * state: the question belongs to the person who clicked Damage, not to the document.
   * @type {{filled: string, remaining: number, choices: string[]}|null}
   */
  #pendingOverflow = null;

  /**
   * `_prepareSubmitData` validates with `clean: {copy: false}`, which strips everything outside the
   * document schema in place — so the view fields have to be lifted out here, before that runs.
   * @inheritDoc
   */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    this.#pendingViewState = {};
    for ( const [field, key] of [["containerView", "view"], ["containerDropIn", "dropIn"]] ) {
      if ( !(field in submitData) ) continue;
      this.#pendingViewState[key] = submitData[field];
      delete submitData[field];
    }
    // The chip row lets a printed parameter be retyped; the number a rule reads follows from it.
    refreshTraitNumbers(submitData.system?.traits);
    return submitData;
  }

  /** @inheritDoc */
  async _processSubmitData(event, form, submitData, options = {}) {
    const view = this.#pendingViewState;
    this.#pendingViewState = {};
    const result = await super._processSubmitData(event, form, submitData, options);
    if ( !foundry.utils.isEmpty(view) ) await this.setViewState(view);
    return result;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Re-render only the parts a change can reach. Everything else keeps its DOM — which is what
   * stops the two ProseMirror editors from being rebuilt on every keystroke elsewhere.
   * @inheritDoc
   */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( options.isFirstRender || !options.renderContext ) return;
    const affected = TravellerActorSheet.#affectedParts(options);
    if ( affected ) options.parts = options.parts.filter(p => affected.has(p));
  }

  /**
   * @param {object} options   Render options carrying `renderContext` and `renderData`
   * @returns {Set<string>|null}   The parts to render, or null to render all of them
   */
  static #affectedParts(options) {
    // Any item change can move a weight, the armour total or one of the lists.
    // The context names the embedded collection, so it reads "updateitems", not "updateItem".
    if ( /^(create|update|delete)items$/.test(options.renderContext) ) {
      return new Set(["header", "characteristics", "health", "skills", "inventory", "relations", "footer"]);
    }
    if ( options.renderContext !== "updateActor" ) return null;

    const parts = new Set();
    for ( const path of Object.keys(foundry.utils.flattenObject(options.renderData ?? {})) ) {
      if ( path.startsWith("_") ) continue;   // _id, _stats
      const match = TravellerActorSheet.#PARTS_BY_PATH.find(([prefix]) => path.startsWith(prefix));
      if ( !match ) return null;              // unmapped: fall back to a full render
      for ( const part of match[1] ) parts.add(part);
    }
    return parts;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Two tab groups: ApplicationV2 only auto-prepares when there is exactly one.
    context.tabs = {
      sidebar: this._prepareTabs("sidebar"),
      inventory: this._prepareTabs("inventory")
    };

    return Object.assign(context, this.#prepareViewModel());
  }

  /* -------------------------------------------- */

  /**
   * One presentation object per item, referencing the live prepared document rather than a copy of
   * it. The sheet therefore neither deep-copies the actor on every render nor loses what
   * prepareDerivedData assigns outside the schema.
   * @param {Item} item
   * @returns {object}
   */
  #itemView(item) {
    return { _id: item.id, name: item.name, img: item.img, type: item.type, system: item.system };
  }

  /* -------------------------------------------- */

  /**
   * The characteristics as an ordered list — the roster's order, which is the one the rulebook
   * prints and players read everywhere else. `base` is the only bound field; `max`, `value` and
   * `dm` are readouts, and `modifier` is what `base` and `max` differ by — the derivation the row
   * spells out.
   * @returns {object[]}
   */
  #prepareCharacteristics() {
    const schema = this.actor.system.schema.fields.characteristics.fields;

    return this.actor.system.characteristicKeys.map(key => {
      const c = this.actor.system.characteristics[key];
      return {
        key,
        label: TravellerActorSheet.#linkLabel(key),
        short: `MGT2.Characteristics.${key}.short`,
        fields: schema[key].fields,
        base: c.base, damage: c.damage, value: c.value, max: c.max, dm: c.dm,
        show: c.show,
        modifier: c.auto + c.effect,
        percent: c.max > 0 ? Math.round((c.value / c.max) * 100) : 0,
        hurt: c.damage > 0,
        depleted: c.max > 0 && c.value <= 0,
        // The roll target is the DM itself, so its tooltip states what clicking it will roll.
        formula: `2D${MGT2Helper.signed(c.dm, "")}`
      };
    });
  }

  /* -------------------------------------------- */

  /**
   * Sort the actor's items into the collections consumed by the sheet template.
   * @returns {object}   The render context
   */
  #prepareViewModel() {
    const actor = this.actor;
    const settings = {
      weightUnit: "kg",
      usePronouns: game.settings.get("mgt2", "usePronouns"),
      useGender: game.settings.get("mgt2", "useGender"),
      showLife: game.settings.get("mgt2", "showLife")
    };

    // Three groups, by behaviour: the damage chain, the psionic reserve, and the constants — which
    // deplete for nobody, so the template gives them the same row without a gauge.
    const characteristics = this.#prepareCharacteristics();
    const byKey = new Map(characteristics.map(c => [c.key, c]));
    const chain = actor.system.damageChain;
    const psionic = actor.system.config.psionic ? byKey.get("psionic") : null;

    const model = {
      name: actor.name,
      img: actor.img,
      system: actor.system,
      systemFields: actor.system.schema.fields,
      isGM: game.user.isGM,
      settings,
      initiative: actor.system.initiative,
      characteristics,
      // Rows stay in the roster's order — players read the six in one fixed sequence, and a chain
      // edit must not move them. The chain survives as `chainOrder`, stated once on the header.
      damageTrack: characteristics.filter(c => c.show && chain.includes(c.key)),
      chainOrder: chain.map(key => byKey.get(key)).filter(c => c?.show),
      psionic: psionic?.show ? psionic : null,
      statics: characteristics.filter(c => c.show && (c.key !== "psionic") && !chain.includes(c.key))
    };

    // One view per item, created once so that the container and computer entries keep their
    // identity between the two passes below.
    const views = new Map();
    for (const item of actor.items) views.set(item.id, this.#itemView(item));

    const weapons = [], armors = [], augments = [], computers = [], softwares = [];
    const items = [], equipments = [], containerItems = [], careers = [];
    const skills = [], psionics = [], diseases = [], wounds = [], contacts = [];
    const actorContainers = [];

    for (const v of views.values()) {
      if (v.type === "container") {
        actorContainers.push(v);
      } else if (v.type === "computer") {
        computers.push(v);
        v.subItems = [];
        if (v.system.overload === true) v.overloadClass = "computer-overload";
      }
    }

    actorContainers.sort(MGT2Helper.compareByName);

    const containers = [{ name: "(tous)", _id: "" }].concat(actorContainers);
    const containerIndex = new Map();
    for (const c of actorContainers) {
      containerIndex.set(c._id, c);

      if (c.system.weight > 0) {
        c.weight = `${c.system.weight} ${settings.weightUnit}`;
        c.display = c.name.length > 12 ? `${c.name.substring(0, 12)}... (${c.weight})` : `${c.name} (${c.weight})`;
      } else {
        c.display = c.name.length > 12 ? `${c.name.substring(0, 12)}...` : c.name;
      }

      if (c.system.onHand === true) c.subItems = [];
    }

    const { view: viewId, dropIn: dropInId } = this.viewState;
    const currentContainerView = containerIndex.get(viewId);
    model.containerView = currentContainerView;
    model.containerWeight = currentContainerView?.system.weight ?? 0;
    model.containerShowAll = viewId === "";
    model.containerViewId = viewId;
    model.containerDropInId = dropInId;

    for (const v of views.values()) {
      const sys = v.system;

      if (Object.hasOwn(sys, "weight") && sys.weight > 0) {
        const total = isNaN(sys.quantity) ? sys.weight : sys.weight * sys.quantity;
        v.weight = `${total} ${settings.weightUnit}`;
      }

      // Item in storage
      if (Object.hasOwn(sys, "container") && sys.container.id) {
        const container = containerIndex.get(sys.container.id);
        if (container === undefined) { // container deleted
          if (model.containerShowAll) {
            v.containerName = "#deleted#";
            containerItems.push(v);
          }
          continue;
        }

        if (container.system.locked && !game.user.isGM) continue;
        if (container.system.onHand === true) container.subItems.push(v);

        if (model.containerShowAll || viewId === sys.container.id) {
          v.containerName = container.name;
          containerItems.push(v);
        }
        continue;
      }

      if (Object.hasOwn(sys, "equipped")) {
        v.canEquip = true;
        if (sys.equipped === true) v.toggleClass = "active";
      } else {
        v.canEquip = false;
      }

      switch (v.type) {
        case "equipment":
          if (sys.subType === "augment") augments.push(v);
          else equipments.push(v);
          break;

        case "armor":
          armors.push(v);
          if (sys.options?.length > 0) v.subInfo = sys.options.map(formatTrait).join(", ");
          break;

        case "computer":
          if (sys.options?.length > 0) v.subInfo = sys.options.map(formatTrait).join(", ");
          break;

        case "item":
          if (sys.subType !== "software") { items.push(v); break; }
          if (sys.software.computerId) {
            const computer = computers.find(x => x._id === sys.software.computerId);
            if (computer !== undefined) computer.subItems.push(v);
            else softwares.push(v);
          } else {
            v.display = sys.software.bandwidth > 0 ? `${v.name} (${sys.software.bandwidth})` : v.name;
            softwares.push(v);
          }
          break;

        case "weapon":
          v.range = sys.range.isMelee
            ? game.i18n.localize("MGT2.Melee")
            : MGT2Helper.getRangeDisplay(sys.range);
          if (sys.traits?.length > 0) v.subInfo = sys.traits.map(formatTrait).join(", ");
          weapons.push(v);
          break;

        case "career": careers.push(v); break;
        case "contact": contacts.push(v); break;

        case "disease":
          if (sys.subType === "wound") wounds.push(v);
          else diseases.push(v);
          break;

        case "talent":
          if (sys.subType === "skill") { skills.push(v); break; }
          if (MGT2Helper.hasValue(sys.psionic, "reach")) {
            v.reach = game.i18n.localize(`MGT2.PsionicReach.${sys.psionic.reach}`);
          }
          if (MGT2Helper.hasValue(sys.roll, "difficulty")) {
            v.difficulty = game.i18n.localize(`MGT2.Difficulty.${sys.roll.difficulty}`);
          }
          psionics.push(v);
          break;

        case "container":
          if (sys.onHand === true) items.push(v);
          break;
      }
    }

    const life = actor.system.life;
    model.lifeTrack = (settings.showLife && life.max > 0) ? {
      wound: Math.min(100, Math.round((life.damage / life.max) * 100)),
      stun: Math.min(100, Math.round((actor.system.stun / life.max) * 100)),
      // The hatch sits at the far end of the fill: the stun is the most recent part of the wound.
      stunFrom: Math.min(100, Math.round(((life.damage - actor.system.stun) / life.max) * 100))
    } : null;

    // What each recovery control needs to say before it is pressed: the conditions the rules put on
    // it, and the rate it will use. Every one of them is derived.
    const states = actor.system.states;
    const augment = actor.system.augmentTL;
    model.recovery = {
      damaged: actor.system.damagedLinks.length,
      enduranceDM: actor.system.enduranceDM,
      firstAidUsed: states.firstAidUsed,
      needsSurgery: states.needsSurgery,
      surgeryByRule: states.surgeryByRule,
      canMedicalCare: states.canMedicalCare,
      unconscious: states.unconscious,
      reviveDM: actor.system.enduranceDM + states.reviveFailures,
      naturalFormula: actor.system.naturalHealingFormula,
      mental: actor.system.constructor.MENTAL_LINKS.some(k => actor.system.characteristics[k].damage > 0),
      augment: augment ? game.i18n.format("MGT2.Recovery.AugmentAt", augment) : null
    };

    model.damagePrompt = this.#pendingOverflow ? {
      filled: game.i18n.localize(TravellerActorSheet.#linkLabel(this.#pendingOverflow.filled)),
      remaining: this.#pendingOverflow.remaining,
      choices: this.#pendingOverflow.choices.map(key => ({ key, label: TravellerActorSheet.#linkLabel(key) }))
    } : null;

    // The budget block's bar is a CSS variable, and the numbers behind it are already derived —
    // so the percentage is computed here rather than walked out of the DOM the way the kit does.
    const inventory = actor.system.inventory;
    model.encumbranceNormal = inventory.encumbrance.normal;
    model.encumbranceOver = actor.system.states.encumbrance;
    model.encumbrancePercent = inventory.encumbrance.normal > 0
      ? Math.min(100, Math.round((inventory.weight / inventory.encumbrance.normal) * 100))
      : 0;
    // The cap tick sits where the fill stops, so an overrun reads as an overrun.
    model.encumbranceTick = model.encumbranceOver ? 100 : model.encumbrancePercent;

    const byName = MGT2Helper.compareByName;
    Object.assign(model, {
      softwares: softwares.sort(byName),
      augments: augments.sort(byName),
      armors: armors.sort(byName),
      computers: computers.sort(byName),
      careers, // First In First Out
      contacts: contacts.sort(byName),
      containers: containers.sort(byName),
      diseases: diseases.sort(byName),
      wounds,
      equipments: equipments.sort(byName),
      items: items.sort(byName),
      actorContainers: actorContainers.sort(byName),
      skills: skills.sort(byName),
      psionics: psionics.sort(byName),
      weapons: weapons.sort(byName),
      containerItems: containerItems.sort((a, b) =>
        a.containerName.localeCompare(b.containerName)
        || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    });

    model.traits = prepareTraitBlock(actor.system.traits, "traits",
      actor.system.traitFamily, "MGT2.Items.Traits");
    model.effects = prepareEffects(actor);

    return model;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    bindTraitInput(this.element, (property, text) => this.#addTrait(text));
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Resolve the embedded item id carried by the closest row of a clicked control.
   * @param {HTMLElement} target
   * @returns {string|undefined}
   */
  static #itemId(target) {
    return target.closest("[data-item-id]")?.dataset.itemId;
  }

  /** @this {TravellerActorSheet} */
  static async #onOpenEditor() {
    await CharacterPrompts.openEditorFullView(
      this.actor.system.personal.species,
      this.actor.system.personal.speciesText.descriptionLong
    );
  }

  /** @this {TravellerActorSheet} */
  static async #onTraitDelete(event, target) {
    await this.submit();
    const index = Number(target.closest(".code").dataset.traitIndex);
    const traits = Object.values(this.actor.system.traits ?? []);
    return this.actor.update({ "system.traits": traits.filter((_v, i) => i !== index) });
  }

  /** The typed or picked trait, parsed against the family the actor's own list speaks. */
  async #addTrait(text) {
    await this.submit();
    const traits = appendTraitText(this.actor.system.traits, text, this.actor.system.traitFamily);
    if ( traits ) await this.actor.update({ "system.traits": traits });
  }

  /** @this {TravellerActorSheet} */
  static async #onOpenConfig() {
    const userConfig = await CharacterPrompts.openConfig(this.actor.system);
    if ( !userConfig ) return;
    const config = foundry.utils.expandObject(userConfig);
    // The editor mirrors its ordered list into one hidden field.
    config.damageOrder = config.damageOrder ? config.damageOrder.split(",") : [];
    return this.actor.update({ "system.config": config });
  }

  /** @this {TravellerActorSheet} */
  static async #onOpenCharacteristic(event, target) {
    const name = target.dataset.cfgCharacteristic;
    const characteristic = this.actor.system.characteristics[name];
    const chain = this.actor.system.config.damageOrder;
    const rank = chain.indexOf(name) + 1;

    const userConfig = await CharacterPrompts.openCharacteristic({
      key: name,
      label: game.i18n.localize(`MGT2.Characteristics.${name}.name`),
      characteristic,
      rank,
      // A link outside the chain can only be appended, so it is offered one rank more than there
      // are links; one already in it can move anywhere.
      ranks: Array.fromRange(rank ? chain.length : chain.length + 1, 1),
      showAll: Object.values(this.actor.system.characteristics).some(c => !c.show)
    });

    if ( !userConfig ) return;

    const data = { system: { characteristics: {} } };
    data.system.characteristics[name] = {
      // An emptied number input submits null, which the non-nullable field would reject.
      base: userConfig.base ?? characteristic.base,
      // The two stored numbers, and the only place damage can be set outright: everywhere else it
      // is applied as an amount.
      damage: userConfig.damage ?? characteristic.damage,
      show: userConfig.show
    };

    // A characteristic with no score has no pool to drain, so the dialog disables its rank control
    // and submits nothing: the chain is then left exactly as it was, legacy links included.
    if (userConfig.rank !== undefined) {
      const order = chain.filter(key => key !== name);
      if (userConfig.rank > 0) order.splice(userConfig.rank - 1, 0, name);
      if (order.join(",") !== chain.join(",")) data.system.config = { damageOrder: order };
    }

    if (userConfig.showAll === true) {
      for (const [key, value] of Object.entries(this.actor.system.characteristics)) {
        if (key !== name && !value.show) {
          data.system.characteristics[key] = { show: true };
        }
      }
    }

    return this.actor.update(data);
  }

  /* -------------------------------------------- */

  /** A chain link's label: a characteristic on a person, a pool on everything else. */
  static #linkLabel(key) {
    return MGT2.Characteristics[key] ?? MGT2.DamageTracks[key] ?? key;
  }

  /** The number typed into the control a button belongs to. */
  static #controlAmount(target) {
    return Number(target.closest(".dmgctl")?.querySelector("input")?.value) || 0;
  }

  /**
   * Wound or heal by the amount sitting in the control. Live in both modes: after the
   * `{base, damage}` split this is the only way a current value can change at all. The control
   * types a wound rather than resolving an attack, so it skips the pipeline — but it does ask,
   * because Core p.78 gives the target the choice the chain cannot hold.
   * @this {TravellerActorSheet}
   */
  static async #onApplyDamage(event, target) {
    this.#pendingOverflow = null;
    const control = target.closest(".dmgctl");
    const amount = TravellerActorSheet.#controlAmount(target) * Number(target.dataset.sign ?? 1);
    if ( !amount ) return;

    const key = control.dataset.characteristic;
    if ( key ) {
      // PSI is not in the damage chain: spending writes its own wound and never reaches `life`.
      const c = this.actor.system.characteristics[key];
      const damage = Math.min(c.max, Math.max(0, c.damage + amount));
      if ( damage === c.damage ) return;
      return this.actor.update({ [`system.characteristics.${key}.damage`]: damage });
    }

    const choice = (amount > 0) ? this.actor.system.overflowChoice(amount) : null;
    if ( !choice ) return this.actor.system.applyDamage(amount, { raw: true });

    this.#pendingOverflow = choice;
    if ( choice.taken > 0 ) await this.actor.system.applyDamage(choice.taken, { raw: true });
    return this.render({ parts: ["header"] });
  }

  /** @this {TravellerActorSheet} */
  static async #onPickOverflow(event, target) {
    const choice = this.#pendingOverflow;
    this.#pendingOverflow = null;
    if ( !choice ) return this.render({ parts: ["header"] });
    await this.actor.system.applyDamage(choice.remaining, { raw: true, overflow: target.dataset.overflow });
    return this.render({ parts: ["header"] });
  }

  /**
   * Core p.80: Stun damage reaches END alone, and whatever exceeds it becomes rounds of
   * incapacitation instead of injury. The round count is reported and not tracked.
   * @this {TravellerActorSheet}
   */
  static async #onApplyStun(event, target) {
    this.#pendingOverflow = null;
    const amount = TravellerActorSheet.#controlAmount(target);
    if ( !amount ) return;
    const result = await this.actor.system.applyDamage(amount, { raw: true, stun: true });
    if ( result?.rounds > 0 ) {
      ui.notifications.info(game.i18n.format("MGT2.Actor.StunIncapacitated",
        { name: this.actor.name, rounds: result.rounds }));
    }
  }

  /** @this {TravellerActorSheet} */
  static async #onRestHour() {
    this.#pendingOverflow = null;
    return this.actor.system.restHour();
  }

  /* -------------------------------------------- */
  /*  Recovery (Core p.83-84)                     */
  /* -------------------------------------------- */

  /** No card here and so no Effect: the pool opens at Core p.83's minimum of one and is editable. */
  static async #onFirstAid() {
    return ChatHelper.applyFirstAid(this.actor, 1);
  }

  /** "Once only" is spent per injury, and only a referee knows a new one has been taken. */
  static async #onFirstAidReset() {
    return this.actor.update({ "system.states.firstAidUsed": false });
  }

  /** @this {TravellerActorSheet} */
  static async #onSurgery() {
    const system = this.actor.system;
    const result = await CharacterPrompts.openSurgery({ augment: system.augmentTL });
    if ( !result ) return;

    const outcome = CharacterPrompts.surgeryPoints(Number(result.effect) || 0);
    if ( outcome.success ) {
      return ChatHelper.applyRestore(this.actor,
        { procedure: "MGT2.Recovery.Surgery", points: outcome.points });
    }

    // Core p.83: a failed operation costs the patient points, and that is damage — so it goes
    // through the chain, where the unconscious threshold and death are waiting for it.
    await system.applyDamage(outcome.points, { raw: true });
    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.Surgery",
      game.i18n.format("MGT2.Recovery.Costs", { points: outcome.points }));
  }

  /** Core p.84 divides this one evenly, so it places itself and never opens the prompt. */
  static async #onMedicalCare() {
    const system = this.actor.system;
    const result = await CharacterPrompts.openMedicalCare(
      { enduranceDM: system.enduranceDM, augment: system.augmentTL });
    if ( !result ) return;

    const distribution = system.spreadEvenly(system.medicalCarePoints(result.medic));
    const healed = await system.applyHeal(distribution);
    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.MedicalCare",
      ChatHelper.restoredMessage(healed, distribution));
  }

  /** Core p.84's rate can come out negative while surgery is required, and then it is a wound. */
  static async #onNaturalHealing() {
    const system = this.actor.system;
    const roll = await new Roll(system.naturalHealingFormula).roll();
    const points = roll.total;

    let message;
    if ( points < 0 ) {
      await system.applyDamage(-points, { raw: true });
      message = game.i18n.format("MGT2.Recovery.Costs", { points: -points });
    } else {
      // The rule divides nothing here, so this takes the chain's own backwards heal.
      const healed = Math.min(points, system.life.damage);
      await system.applyDamage(-points, { raw: true });
      message = ChatHelper.restoredMessage(healed, {});
    }
    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.NaturalHealing", message, roll);
  }

  /** @this {TravellerActorSheet} */
  static async #onMentalHealing() {
    const keys = await this.actor.system.healMental();
    const detail = keys.map(key => game.i18n.localize(MGT2.Characteristics[key])).join(" · ");
    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.Mental",
      game.i18n.format("MGT2.Recovery.Restored", { points: keys.length, detail }));
  }

  /**
   * Core p.84: an END check per minute, each failure adding a cumulative DM+1 to the next. The
   * count is stored on the actor because the minute between attempts outlives any sheet, and the
   * check states no difficulty, so it scores against the assumed Average.
   */
  static async #onRevive() {
    const system = this.actor.system;
    const failures = system.states.reviveFailures;
    const roll = await new Roll(`2d6${MGT2Helper.getFormulaDM(system.enduranceDM + failures)}`).roll();
    const awake = roll.total >= MGT2Helper.getEffectTarget(null).value;

    await this.actor.update({ system: { states: awake
      ? { reviveFailures: 0, consciousWound: system.life.damage }
      : { reviveFailures: failures + 1 } } });

    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.Revive",
      game.i18n.localize(awake ? "MGT2.Recovery.Awake" : "MGT2.Recovery.StillOut"), roll);
  }

  /* -------------------------------------------- */

  /**
   * Everything standing against `modifiers.check`, each entry still named. The three provenances
   * are offered separately because they are waived separately: a referee's own entry and an Active
   * Effect are one standing figure, while fatigue or armour is a state the player can argue out of.
   * @returns {{key: string, label: string, dm: number, params?: object}[]}
   */
  static #checkModifiers(actor) {
    const check = actor.system.modifiers.check;
    const sources = [...(check.sources ?? [])];
    const standing = check.custom + check.effect;
    if (standing !== 0) sources.push({ key: "actor", label: "MGT2.RollPrompt.ActorDM", dm: standing });
    return sources;
  }

  /**
   * Core p.75's Common Modifiers, read off the prompt. Aiming is capped at the six consecutive
   * Minor Actions p.76 allows, a laser sight is worth nothing without it, and a fast-moving target
   * costs a DM per full ten metres rather than per metre.
   * @returns {[string, number][]}
   */
  static #attackModifiers(data, weapon) {
    const terms = [];
    const named = key => game.i18n.localize(MGT2.AttackModifiers[key].label);
    const aim = MGT2.AttackModifiers.aiming;

    // Core p.80, both ways round: an Auto attack forfeits aiming, and a scoped weapon that did aim
    // is not held to the rule that makes every shot past 100 metres Extreme.
    const aiming = (data["trait-auto"] === true) ? 0
      : Math.min(aim.max, Math.max(0, MGT2Helper.getIntegerFromInput(data.aiming)));
    const threshold = ((data["trait-scope"] === true) && (aiming > 0)) ? 0
      : MGT2Helper.getIntegerFromInput(data.rangeThreshold);
    if (aiming > 0) {
      terms.push([named("aiming"), aiming * aim.dm]);
      if (data.laserSight === true) {
        terms.push([named("laserSight"), MGT2.AttackModifiers.laserSight.dm]);
      }
    }

    const fast = MGT2.AttackModifiers.fastMovingTarget;
    const steps = Math.floor(Math.max(0, MGT2Helper.getNumberFromInput(data.targetMovement)) / fast.per);
    if (steps > 0) terms.push([named("fastMovingTarget"), steps * fast.dm]);

    const band = MGT2Helper.rangeBand(data.distance, weapon?.system.range?.value, threshold);
    // Out of range is reported and rolled anyway, so it reaches the card with no DM at all.
    if (band && ((band.key === "out") || band.dm)) {
      terms.push([game.i18n.localize(MGT2.RangeBands[band.key].label), band.dm]);
    }

    if (data.cover === true) terms.push([named("cover"), MGT2.AttackModifiers.cover.dm]);
    if (data.prone === true) terms.push([named("prone"), MGT2.AttackModifiers.prone.dm]);
    return terms;
  }

  /**
   * The weapon's own traits, totalled the way the prompt showed them: an applied one is in whether
   * the player looked at it, an offered one only once confirmed, and a reminder never.
   * @returns {[string, number][]}
   */
  static #weaponTraitModifiers(data, weapon, strengthDM) {
    const terms = [];
    for (const row of MGT2Helper.weaponTraitRows(weapon, strengthDM)) {
      if (row.dm === 0) continue;
      if ((row.tone === "applied") || ((row.tone === "offered") && (data[row.name] === true))) {
        terms.push([row.term, row.dm]);
      }
    }
    return terms;
  }

  /** @this {TravellerActorSheet} */
  static async #onRoll(event, target) {
    const rollOptions = {
      rollTypeName: game.i18n.localize("MGT2.RollPrompt.Roll"),
      rollObjectName: "",
      characteristics: [{ _id: "", name: "", dm: 0 }],
      characteristic: "",
      skills: [],
      skill: "",
      checkModifiers: TravellerActorSheet.#checkModifiers(this.actor),
      difficulty: null,
      damageFormula: null,
      // The prompt renders its blocks from what is being rolled, so a bare characteristic check
      // is shorter than a weapon attack.
      blocks: { skill: true, range: false, traits: false },
      // Core p.80: Bulky and Very Bulky are read against the attacker's own STR DM.
      strengthDM: this.actor.system.characteristics.strength?.dm ?? 0
    };

    const cardButtons = [];

    for (const key of this.actor.system.characteristicKeys) {
      const c = this.actor.system.characteristics[key];
      if (c.show) {
        const label = game.i18n.localize(TravellerActorSheet.#linkLabel(key));
        rollOptions.characteristics.push({ _id: key, name: `${label} — ${c.value}`, term: label, dm: c.dm });
      }
    }

    for (const item of this.actor.items) {
      if (item.type === "talent") {
        if (item.system.subType === "skill")
          // The prompt prints every row's DM in its own cell, so the option names the skill only.
          rollOptions.skills.push({
            _id: item.id, name: item.getRollDisplay(false), term: item.name, dm: item.system.level
          });
      }
    }

    rollOptions.skills.sort(MGT2Helper.compareByName);
    const notProficient = game.i18n.localize("MGT2.Items.NotProficient");
    rollOptions.skills = [{ _id: "NP", name: notProficient, term: notProficient, dm: -3 }]
      .concat(rollOptions.skills);

    let itemObj = null;
    let isInitiative = false;
    if (target.dataset.roll === "initiative") {
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.InitiativeRoll");
      rollOptions.characteristic = this.actor.system.config.initiative.characteristic;
      // Core p.86: a creature has no DEX and Fast Metabolism hands it the DM directly, so with no
      // characteristic named the flat figure is offered as a waivable modifier instead.
      if ( !rollOptions.characteristic ) {
        rollOptions.checkModifiers = [...rollOptions.checkModifiers,
          { key: "initiative", label: "MGT2.Actor.Initiative", dm: this.actor.system.initiative }];
      }
      isInitiative = true;
    } else if (target.dataset.roll === "characteristic") {
      rollOptions.characteristic = target.dataset.rollCharacteristic;
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.CharacteristicRoll");
      rollOptions.rollObjectName = game.i18n.localize(`MGT2.Characteristics.${rollOptions.characteristic}.name`);
      rollOptions.blocks.skill = false;
    } else {

      if (target.dataset.roll === "skill") {
        rollOptions.skill = target.dataset.rollSkill;
        itemObj = this.actor.getEmbeddedDocument("Item", rollOptions.skill);
        rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.SkillRoll");
        rollOptions.rollObjectName = itemObj.name;
      } else {
        if (target.dataset.roll === "psionic") {
          rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.PsionicRoll");
        }
      }

      if (itemObj === null && target.dataset.itemId) {
        itemObj = this.actor.getEmbeddedDocument("Item", target.dataset.itemId);
        rollOptions.rollObjectName = itemObj.name;
        if (itemObj.type === "weapon")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.weapon");
        else if (itemObj.type === "armor")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.armor");
        else if (itemObj.type === "computer")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.computer");
      }

      if (itemObj && target.dataset.roll === "psionic") {
        rollOptions.rollObjectName = itemObj.name;
        if (MGT2Helper.hasValue(itemObj.system.psionic, "duration")) {
          cardButtons.push({
            label: game.i18n.localize("MGT2.Items.Duration"),
            formula: itemObj.system.psionic.duration,
            message: {
              objectName: itemObj.name,
              flavor: "{0} ".concat(game.i18n.localize(`MGT2.Durations.${itemObj.system.psionic.durationUnit}`))
            }
          });
        }
      }

      if (itemObj && Object.hasOwn(itemObj.system, "damage")) {
        rollOptions.damageFormula = itemObj.system.damage;
        if (itemObj.type === "disease") {
          if (itemObj.system.subType === "disease") {
            rollOptions.rollTypeName = game.i18n.localize("MGT2.DiseaseSubType.disease");
          } else if (itemObj.system.subType === "poison") {
            rollOptions.rollTypeName = game.i18n.localize("MGT2.DiseaseSubType.poison");
          }
        }
      }

      if (itemObj && Object.hasOwn(itemObj.system, "roll")) {
        if (MGT2Helper.hasValue(itemObj.system.roll, "characteristic")) {
          rollOptions.characteristic = itemObj.system.roll.characteristic;
        }

        if (MGT2Helper.hasValue(itemObj.system.roll, "skill")) {
          rollOptions.skill = itemObj.system.roll.skill;
        }

        if (MGT2Helper.hasValue(itemObj.system.roll, "difficulty")) {
          rollOptions.difficulty = itemObj.system.roll.difficulty;
        }
      }

      // A disease, poison or wound forces one check and only one, so it stores it at
      // `system.difficulty` and has no `roll` block for the gate above to read (Core p.81).
      if (itemObj?.type === "disease" && MGT2Helper.hasValue(itemObj.system, "difficulty")) {
        rollOptions.difficulty = itemObj.system.difficulty;
      }

      // The traits belong to any weapon; Core p.75's table is headed "Common Modifiers to Ranged
      // Attacks", so the range block belongs to a ranged one and to nothing else.
      if (itemObj?.type === "weapon") {
        rollOptions.weapon = itemObj;
        rollOptions.blocks.traits = itemObj.system.traits.length > 0;
        rollOptions.blocks.range = itemObj.system.range?.isMelee !== true;
      }
    }

    const userRollData = await RollPromptHelper.roll(rollOptions);
    if ( !userRollData ) return; // dialog dismissed

    const rollModifiers = [];
    const rollFormulaParts = [];
    if (userRollData.diceModifier) {
      rollFormulaParts.push("3d6");
      rollFormulaParts.push(userRollData.diceModifier);
    } else {
      rollFormulaParts.push("2d6");
    }

    if (Object.hasOwn(userRollData, "characteristic") && userRollData.characteristic !== "") {
      const c = this.actor.system.characteristics[userRollData.characteristic];
      const dm = c.dm;
      rollFormulaParts.push(MGT2Helper.getFormulaDM(dm));
      rollModifiers.push(game.i18n.localize(`MGT2.Characteristics.${userRollData.characteristic}.name`) + MGT2Helper.getDisplayDM(dm));
    }

    if (Object.hasOwn(userRollData, "skill") && userRollData.skill !== "") {
      if (userRollData.skill === "NP") {
        rollFormulaParts.push("-3");
        // The card has no DM column, so each name carries its own number the way the others do.
        rollModifiers.push(game.i18n.localize("MGT2.Items.NotProficient") + MGT2Helper.getDisplayDM(-3));
      } else {
        const skillObj = this.actor.getEmbeddedDocument("Item", userRollData.skill);
        rollFormulaParts.push(MGT2Helper.getFormulaDM(skillObj.system.level));
        rollModifiers.push(skillObj.getRollDisplay());
      }
    }

    if (Object.hasOwn(userRollData, "psionic") && userRollData.psionic !== "") {
      const psionicObj = this.actor.getEmbeddedDocument("Item", userRollData.psionic);
      rollFormulaParts.push(MGT2Helper.getFormulaDM(psionicObj.system.level));
      rollModifiers.push(psionicObj.getRollDisplay());
    }

    const timeframeDM = MGT2Helper.getTimeframeDM(userRollData.timeframes);
    if (timeframeDM !== 0) {
      rollModifiers.push(game.i18n.localize(`MGT2.Timeframes.${userRollData.timeframes}`)
        + MGT2Helper.getDisplayDM(timeframeDM));
      rollFormulaParts.push(MGT2Helper.getFormulaDM(timeframeDM));
    }

    // The accumulator's own numbers, minus whatever the player waived in the prompt. Each keeps its
    // name so the card explains the total the same way the readout did.
    // FormDataExtended does not expand a dotted field name, so the prompt names each checkbox
    // `check-<key>` and it comes back flat.
    const terms = rollOptions.checkModifiers.filter(source => userRollData[`check-${source.key}`] === true)
      .map(source => [MGT2Helper.modifierLabel(source), source.dm]);
    if (rollOptions.blocks.range) {
      terms.push(...TravellerActorSheet.#attackModifiers(userRollData, rollOptions.weapon));
    }
    if (rollOptions.blocks.traits) {
      terms.push(...TravellerActorSheet.#weaponTraitModifiers(
        userRollData, rollOptions.weapon, rollOptions.strengthDM));
    }
    for (const [name, dm] of terms) {
      if (dm !== 0) rollFormulaParts.push(MGT2Helper.getFormulaDM(dm));
      rollModifiers.push(dm === 0 ? name : name + MGT2Helper.getDisplayDM(dm));
    }

    if (Object.hasOwn(userRollData, "customDM") && userRollData.customDM !== "") {
      const s = String(userRollData.customDM).trim();
      if (/^[0-9]/.test(s))
        rollFormulaParts.push("+");
      rollFormulaParts.push(s);
    }

    if (MGT2Helper.hasValue(userRollData, "difficulty")) {
      rollOptions.difficulty = userRollData.difficulty;
    }

    const rollData = this.actor.getRollData();
    const rollFormula = rollFormulaParts.join("");

    if (!Roll.validate(rollFormula)) {
      ui.notifications.error(game.i18n.localize("MGT2.Errors.InvalidRollFormula"));
      return;
    }

    const roll = await new Roll(rollFormula, rollData).roll();

    // Effect is what the NEXT action reads — initiative, damage, first aid, psionic duration — and
    // those run later, on another actor, with no sheet rendered. It is computed here beside the roll.
    const effectTarget = MGT2Helper.getEffectTarget(rollOptions.difficulty);
    const effect = roll.total - effectTarget.value;
    const effectBand = MGT2Helper.getEffectBand(effect);
    const carriesEffect = itemObj?.type === "weapon";

    // Core p.74: the Effect of the DEX or INT check IS the Initiative, not the total — and *every*
    // Traveller rolls their own. The check lists no difficulty, so it scores against the assumed
    // Average 8 like any other.
    // ActorSheetV2#token is null when the sheet is the base actor's, and every unlinked token shares
    // its actorId — so getCombatantsByActor would answer for each mook as well. Only the linked
    // token's combatant belongs to this sheet; a mook is rolled from its own token sheet, where
    // `token` is set and getCombatantsByActor already routes through the synthetic actor.
    if (isInitiative) {
      const combatants = game.combat?.getCombatantsByActor(this.actor) ?? [];
      const own = this.token ? combatants : combatants.filter(c => c.token?.actorLink === true);
      for (const combatant of own) await combatant.update({ initiative: effect });
    }

    // Core p.83: first aid restores the Effect of a Medic check, minimum one point. The skill that
    // was actually rolled is the one the prompt came back with, not the one the row started from.
    const rolledSkill = (userRollData.skill && (userRollData.skill !== "NP"))
      ? this.actor.getEmbeddedDocument("Item", userRollData.skill) : null;
    const firstAidPoints = MGT2Helper.isFirstAidSkill(rolledSkill?.name) ? Math.max(1, effect) : 0;

    const chatData = {
      author: game.user.id,
      speaker: this.actor ? ChatMessage.getSpeaker({ actor: this.actor }) : null,
      formula: roll.formula,
      tooltip: await roll.getTooltip(),
      total: Math.round(roll.total * 100) / 100,
      showButtons: true,
      showLifeButtons: false,
      showRollRequest: false,
      rollTypeName: rollOptions.rollTypeName,
      rollObjectName: rollOptions.rollObjectName,
      rollModifiers: rollModifiers,
      rollDifficulty: rollOptions.difficulty,
      rollDifficultyLabel: MGT2Helper.getDifficultyDisplay(rollOptions.difficulty),
      rollTarget: effectTarget.value,
      rollTargetAssumed: effectTarget.assumed,
      effect,
      effectDisplay: MGT2Helper.signed(effect, "+0"),
      effectBand: effectBand.label,
      effectTone: effectBand.tone,
      showRollDamage: rollOptions.damageFormula !== null && rollOptions.damageFormula !== "",
      damageCarriesEffect: carriesEffect,
      firstAidPoints,
      cardButtons: cardButtons
    };

    chatData.content = await foundry.applications.handlebars.renderTemplate(
      "systems/mgt2/templates/chat/roll.html", chatData);

    let flags = null;

    if (rollOptions.damageFormula !== null && rollOptions.damageFormula !== "") {
      const traits = carriesEffect ? itemObj.system.traits : [];
      flags = { mgt2: { damage: {
        formula: rollOptions.damageFormula,
        rollObjectName: rollOptions.rollObjectName,
        rollTypeName: rollOptions.rollTypeName,
        // Core p.78: damage is rolled with the attack's Effect added, and a melee attack adds the
        // attacker's STR DM on top. Both are captured now — the roll happens on another card.
        effect: carriesEffect ? effect : 0,
        strengthDM: (carriesEffect && itemObj.system.range?.isMelee)
          ? this.actor.system.meleeDamageDM : 0,
        // The rest of the pipeline's inputs, carried so that stages 2 to 6 can run later on
        // whichever actor was hit. Nothing here names a target.
        // Core p.168: the scale that multiplies is the WEAPON's — a ship's turret is Spacecraft
        // scale whoever pulls the trigger. Only an item that has no scale falls back to the firer.
        scale: itemObj?.system.scale ?? this.actor.system.scale,
        ap: MGT2Helper.traitScore(traits, "ap"),
        loPen: MGT2Helper.traitScore(traits, "lo-pen"),
        stun: MGT2Helper.hasTrait(traits, "stun"),
        damageType: carriesEffect ? Array.from(itemObj.system.damageType ?? []) : []
      } } };
    }

    if (firstAidPoints > 0) {
      if (flags === null) flags = { mgt2: {} };
      flags.mgt2.firstAid = { points: firstAidPoints };
    }

    if (cardButtons.length > 0) {
      if (flags === null) flags = { mgt2: {} };
      flags.mgt2.buttons = cardButtons;
    }

    if (flags !== null)
      chatData.flags = flags;

    return roll.toMessage(chatData, { messageMode: userRollData.rollMode });
  }

  /* -------------------------------------------- */

  /** @this {TravellerActorSheet} */
  static #onItemCreate(event, target) {
    const data = {
      name: target.dataset.createName,
      type: target.dataset.typeItem
    };

    if (target.dataset.subtype) {
      data.system = { subType: target.dataset.subtype };
    }

    return getDocumentClass("Item").create(data, { parent: this.actor });
  }

  /** @this {TravellerActorSheet} */
  static #onItemEdit(event, target) {
    const item = this.actor.items.get(TravellerActorSheet.#itemId(target));
    return item?.sheet.render({ force: true });
  }

  /** @this {TravellerActorSheet} */
  static #onItemDelete(event, target) {
    return this.actor.deleteEmbeddedDocuments("Item", [TravellerActorSheet.#itemId(target)]);
  }

  /** @this {TravellerActorSheet} */
  static #onItemEquip(event, target) {
    const item = foundry.utils.duplicate(this.actor.getEmbeddedDocument("Item", TravellerActorSheet.#itemId(target)));
    item.system.equipped = !item.system.equipped;
    return this.actor.updateEmbeddedDocuments("Item", [item]);
  }

  /** @this {TravellerActorSheet} */
  static async #onItemStorageIn(event, target) {
    const item = foundry.utils.duplicate(this.actor.getEmbeddedDocument("Item", TravellerActorSheet.#itemId(target)));
    if (item.type === "container") {
      item.system.onHand = false;
    } else {
      let container;
      const containers = this.actor.getContainers();
      if (!this.viewState.dropIn) {
        // Place into the first container, creating one if the actor has none.
        if (containers.length === 0) {
          container = (await getDocumentClass("Item").create({ name: "New container", type: "container" }, { parent: this.actor }));
        } else {
          container = containers[0];
        }
      } else {
        container = containers.find(x => x._id === this.viewState.dropIn);
      }

      if (!container) return;

      if (container.system.locked && !game.user.isGM) {
        return ui.notifications.error(game.i18n.localize("MGT2.Errors.LockedContainer"));
      }

      item.system.container.id = container._id;
    }
    return this.actor.updateEmbeddedDocuments("Item", [item]);
  }

  /** @this {TravellerActorSheet} */
  static #onItemStorageOut(event, target) {
    const item = foundry.utils.duplicate(this.actor.getEmbeddedDocument("Item", TravellerActorSheet.#itemId(target)));
    item.system.container.id = "";
    return this.actor.updateEmbeddedDocuments("Item", [item]);
  }

  /** @this {TravellerActorSheet} */
  static #onSoftwareEject(event, target) {
    const item = foundry.utils.duplicate(this.actor.getEmbeddedDocument("Item", TravellerActorSheet.#itemId(target)));
    item.system.software.computerId = "";
    return this.actor.updateEmbeddedDocuments("Item", [item]);
  }

  /** @this {TravellerActorSheet} */
  static #onContainerCreate() {
    return getDocumentClass("Item").create({ name: "New container", type: "container" }, { parent: this.actor });
  }

  /** @this {TravellerActorSheet} */
  static #onContainerEdit() {
    const container = this.actor.items.get(this.viewState.view);
    return container?.sheet.render({ force: true });
  }

  /** @this {TravellerActorSheet} */
  static async #onContainerDelete() {
    const containers = this.actor.getContainers();
    const container = containers.find(x => x._id === this.viewState.view);
    if ( !container ) return;

    // Loose items that referenced this container so they are not orphaned.
    const containerItems = this.actor.items.filter(x => Object.hasOwn(x.system, "container") && x.system.container.id === container._id);
    if (containerItems.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item",
        containerItems.map(item => ({ _id: item.id, "system.container.id": "" })));
    }

    const view = { view: "" };
    if (this.viewState.dropIn === container._id) {
      const remaining = containers.filter(x => x._id !== container._id);
      view.dropIn = remaining.length > 0 ? remaining[0]._id : "";
    }

    await this.actor.deleteEmbeddedDocuments("Item", [container._id]);
    return this.setViewState(view);
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDrop(event) {
    const dropData = MGT2Helper.getDataFromDropEvent(event);
    if (!dropData) return false;
    if (Hooks.call("dropActorSheetData", this.actor, this, dropData) === false) return false;
    if (!this.isEditable) return false;

    const sourceItemData = await MGT2Helper.getItemDataFromDropData(dropData);

    if (sourceItemData.type === "species") {
      const update = {
        system: {
          personal: {
            species: sourceItemData.name,
            speciesText: {
              description: sourceItemData.system.description,
              descriptionLong: sourceItemData.system.descriptionLong
            },
          }
        }
      };

      update.system.traits = Object.values(this.actor.system.traits ?? [])
        .concat(Object.values(sourceItemData.system.traits ?? []));

      // A species modifier moves the score, not the current value: `max` and `value` derive, so a
      // write to either is discarded on the next prepare. Deriving it into `auto` is phase 7.
      if (sourceItemData.system.modifiers && sourceItemData.system.modifiers.length > 0) {
        update.system.characteristics = {};
        for (const modifier of sourceItemData.system.modifiers) {
          if (MGT2Helper.hasValue(modifier, "characteristic") && MGT2Helper.hasValue(modifier, "value")) {
            const c = this.actor.system.characteristics[modifier.characteristic];
            update.system.characteristics[modifier.characteristic] = {
              base: Math.max(0, c.base + modifier.value)
            };
          }
        }
      }

      await this.actor.update(update);

      return true;
    }

    // Simple drop
    if (sourceItemData.type === "contact" || sourceItemData.type === "disease" ||
      sourceItemData.type === "career" || sourceItemData.type === "talent") {
      let transferData = {};
      try {
        transferData = sourceItemData.toJSON();
      } catch (err) {
        transferData = sourceItemData;
      }

      delete transferData._id;
      delete transferData.id;
      await this.actor.createEmbeddedDocuments("Item", [transferData]);
      return true;
    }

    // Supported drop (don't drop vehicule stuff)
    if (sourceItemData.type !== "armor" && sourceItemData.type !== "weapon" &&
      sourceItemData.type !== "computer" && sourceItemData.type !== "container" &&
      sourceItemData.type !== "item" && sourceItemData.type !== "equipment") return false;

    const target = event.target.closest(".table-row");
    let targetId = null;
    let targetItem = null;

    if (target !== null && target !== undefined) {
      targetId = target.dataset.itemId;
      targetItem = this.actor.getEmbeddedDocument("Item", targetId);
    }

    let sourceItem = this.actor.getEmbeddedDocument("Item", sourceItemData.id);
    if (sourceItem) { // same actor item move
      if (targetItem === null || targetItem === undefined) return false;

      sourceItem = foundry.utils.duplicate(sourceItem);
      if (sourceItem._id === targetId) return false; // Same item

      if (targetItem.type === "item" || targetItem.type === "equipment") {
        // SOFTWARE --> COMPUTER
        if (targetItem.system.subType === "software") {
          sourceItem.system.software.computerId = targetItem.system.software.computerId;
        } else {
          sourceItem.system.container.id = targetItem.system.container.id;
        }
        await this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
        return true;
      } else if (targetItem.type === "computer") {
        sourceItem.system.software.computerId = targetId;
        await this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
        return true;
      } else if (targetItem.type === "container") {
        // locked refuse
        if (targetItem.system.locked && !game.user.isGM)
          ui.notifications.error(game.i18n.localize("MGT2.Errors.LockedContainer"));
        else {
          sourceItem.system.container.id = targetId;
          await this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
          return true;
        }
      }
    } else {
      // Copy item from other source
      let transferData = {};
      try {
        transferData = sourceItemData.toJSON();
      } catch (err) {
        transferData = sourceItemData;
      }

      delete transferData._id;
      delete transferData.id;

      // Normalize data
      if (Object.hasOwn(transferData.system, "container"))
        transferData.system.container.id = "";
      if (transferData.type === "item" && transferData.system.subType === "software")
        transferData.system.software.computerId = "";

      if (transferData.type === "container")
        transferData.system.onHand = true;

      if (Object.hasOwn(transferData.system, "equipped"))
        transferData.system.equipped = false;

      if (targetItem !== null) {
        // Handle computer & container
        if (transferData.type === "item" && transferData.system.subType === "software") {
          if (targetItem.type === "item" && targetItem.system.subType === "software") {
            transferData.system.software.computerId = targetItem.system.software.computerId;

          } else if (targetItem.type === "computer") {
            transferData.system.software.computerId = targetItem._id;
          }
        } else if (transferData.type === "armor" || transferData.type === "computer" || transferData.type === "equipment" || transferData.type === "item" || transferData.type === "weapon") {
          if (targetItem.type === "container") {
            if (!targetItem.system.locked || game.user.isGM) {
              transferData.system.container.id = targetId;
            }
          } else {
            transferData.system.container.id = targetItem.system.container.id;
          }
        }
      }

      await this.actor.createEmbeddedDocuments("Item", [transferData]);
    }
    return true;
  }
}

/* -------------------------------------------- */

/**
 * The NPC sheet — one class for both presets, because `subType` is a preset and not a branch.
 *
 * It extends the Traveller sheet rather than forking it: every action, the roll path, the damage
 * controls and the characteristics column are inherited unchanged, and what differs is which parts
 * render and the statblock the header prints.
 *
 * ApplicationV2 concatenates `classes` up the inheritance chain, so the root also carries
 * `character` and every rule written against that selector applies here as well.
 *
 * @extends {TravellerActorSheet}
 */
export class NpcActorSheet extends TravellerActorSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
    position: { width: 840, height: 720 },
    actions: { reactionRoll: NpcActorSheet.#onReactionRoll }
  };

  /** @inheritDoc */
  static PARTS = {
    header: { template: `${PARTS_PATH}/npc/header.html` },
    characteristics: {
      template: `${PARTS_PATH}/parts/characteristics.html`,
      templates: [`${PARTS_PATH}/parts/characteristic.html`]
    },
    panel: {
      template: `${PARTS_PATH}/npc/panel.html`,
      templates: [`${PARTS_PATH}/parts/row-controls.html`,
        "systems/mgt2/templates/items/blocks/traits.html"],
      scrollable: [""]
    }
  };

  /** One panel, no tab strip: the statblock is short enough to read in one column. */
  static TABS = {};

  /** The Fight or Flight roll is the one action this sheet adds. */
  static #REACT_FORMULA = "2d6";

  /**
   * A creature has no characteristics column at all: its whole pool is Hits and the header prints
   * it, so the part is dropped rather than rendered empty and the grid drops the column with it.
   *
   * The parent maps document paths onto the *character* sheet's parts, and this sheet has three of
   * its own — an unlucky mapping would filter the list down to nothing — so a document-driven
   * render redraws all of them instead.
   * @inheritDoc
   */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( options.renderContext && !options.isFirstRender ) {
      options.parts = Object.keys(this.constructor.PARTS);
    }
    if ( this.actor.system.subType === "creature" ) {
      options.parts = options.parts.filter(part => part !== "characteristics");
    }
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const creature = system.subType === "creature";

    context.isCreature = creature;
    context.choices = {
      subTypes: MGT2.NpcSubTypes,
      diets: MGT2.Diets,
      patterns: MGT2.Reactions,
      experience: MGT2.ExperienceLevels,
      attitudes: MGT2.Attitudes,
      speedBands: MGT2.SpeedBands
    };

    // The natural attacks print in the statblock header; anything else the creature is carrying
    // stays an ordinary inventory row.
    context.naturals = context.weapons.filter(w => w.system.natural === true);
    context.carried = context.weapons.filter(w => w.system.natural !== true);

    context.npc = {
      reaction: NpcActorSheet.#reaction(system),
      size: NpcActorSheet.#size(system),
      experience: system.experienceRow,
      flyBand: NpcActorSheet.#speedBandLabel(system.speed.fly),
      armourConditional: NpcActorSheet.#armourConditional(system),
      track: NpcActorSheet.#track(system)
    };
    return context;
  }

  /** Fight or Flight, ready to render: the two thresholds, and whatever the referee has to settle. */
  static #reaction(system) {
    const row = system.reaction;
    if ( !row ) return null;
    return {
      label: row.label,
      flee: row.flee, attack: row.attack, altAttack: row.altAttack,
      gate: row.gate ? `MGT2.Reactions.Gates.${row.gate}` : null,
      fleeGate: row.fleeGate ? `MGT2.Reactions.Gates.${row.fleeGate}` : null
    };
  }

  /**
   * The stored size DM beside the row the Animal Size table would have suggested. The ladder is
   * advisory — the table says so and the published blocks break it constantly — so this reports
   * agreement and never writes.
   */
  static #size(system) {
    const band = system.sizeBand;
    const dm = system.sizeDM;
    return {
      dm, band,
      stored: dm !== 0,
      agrees: !band || (band.dm === dm)
    };
  }

  /** `Armour (+7, +10 vs. lasers)`: the second score is a conditional and is surfaced, not applied. */
  static #armourConditional(system) {
    const trait = system.traitMap.armour;
    const params = trait?.params ?? [];
    if ( params.length < 2 ) return null;
    return { score: params[1].value, condition: params[2]?.value ?? "" };
  }

  static #speedBandLabel(band) {
    if ( (band === null) || (band === undefined) ) return null;
    return Object.values(MGT2.SpeedBands)[band] ?? null;
  }

  /**
   * The pool drawn on the stored wound. The scale is **twice** the maximum, because `damage` can
   * exceed `max` and that overrun is the Destroyed state (Core p.86) — the four printed thresholds
   * are then four marks on one bar that only ever fills.
   */
  static #track(system) {
    const hits = system.characteristics.hits;
    if ( !(hits.max > 0) || !system.damageChain.includes("hits") ) return null;
    const scale = 2 * hits.max;
    const pct = points => Math.min(100, Math.max(0, Math.round((points / scale) * 100)));
    const states = system.states;
    return {
      wound: pct(hits.damage),
      stun: pct(system.stun),
      stunFrom: pct(hits.damage - system.stun),
      marks: [
        { at: 25, label: "MGT2.Actor.npc.DrivenOff", hit: states.drivenOff },
        { at: 45, label: "MGT2.Actor.Unconscious", hit: states.unconscious },
        { at: 50, label: "MGT2.Actor.Dead", hit: states.dead },
        { at: 100, label: "MGT2.Actor.npc.Destroyed", hit: states.destroyed }
      ]
    };
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    // The grid drops the characteristics column on the creature preset, and the blocks that only
    // one preset owns are gated in the templates; both read this.
    this.element.dataset.preset = this.actor.system.subType;
    // Switching the preset leaves the part that is no longer rendered behind: ApplicationV2 only
    // ever replaces the parts it rendered, and the grid has no cell left to put this one in.
    if ( this.actor.system.subType === "creature" ) {
      this.element.querySelector('[data-application-part="characteristics"]')?.remove();
    }
  }

  /**
   * Core p.91: 2D against the pattern's own thresholds. The card states what was rolled and which
   * of the two it reached; a gate is printed beside it and left to the referee, because surprise is
   * a scene fact the system deliberately does not track.
   * @this {NpcActorSheet}
   */
  static async #onReactionRoll() {
    const reaction = this.actor.system.reaction;
    if ( !reaction ) return;
    const roll = await new Roll(NpcActorSheet.#REACT_FORMULA).roll();

    const attack = (reaction.altAttack !== null) ? Math.min(reaction.attack, reaction.altAttack)
      : reaction.attack;
    let outcome = "MGT2.Actor.npc.ReactionNeutral";
    if ( (reaction.flee !== null) && (roll.total <= reaction.flee) ) outcome = "MGT2.Actor.npc.ReactionFlee";
    else if ( (attack !== null) && (roll.total >= attack) ) outcome = "MGT2.Actor.npc.ReactionAttack";

    const gate = reaction.gate ?? reaction.fleeGate;
    const chatData = {
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      rollTypeName: game.i18n.localize("MGT2.Actor.npc.Reaction"),
      rollObjectName: game.i18n.localize(reaction.label),
      rollMessage: gate
        ? `${game.i18n.localize(outcome)} — ${game.i18n.localize(`MGT2.Reactions.Gates.${gate}`)}`
        : game.i18n.localize(outcome),
      formula: roll.formula,
      tooltip: await roll.getTooltip(),
      total: roll.total
    };
    chatData.content = await foundry.applications.handlebars.renderTemplate(
      "systems/mgt2/templates/chat/roll.html", chatData);
    return roll.toMessage(chatData);
  }
}
