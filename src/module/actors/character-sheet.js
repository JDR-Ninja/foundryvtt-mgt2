import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { RollPromptHelper } from "../roll-prompt.js";
import { CharacterPrompts } from "./character-prompts.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { DragDrop } = foundry.applications.ux;

/**
 * The Traveller character sheet.
 *
 * A single root part is used: the sheet is one contiguous layout whose three tab groups
 * (sidebar / characteristics / inventory) are nested inside each other, so splitting it into
 * sibling parts would force the flex layout to be rebuilt for no functional gain.
 *
 * @extends {ActorSheetV2}
 * @mixes HandlebarsApplication
 */
export class TravellerActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    // "themed theme-light" reproduces what ApplicationV1 forced on every window: the mgt2
    // palette is built for a light sheet, so the viewer's dark preference must not leak in.
    classes: ["mgt2", "actor", "character", "nopad", "themed", "theme-light"],
    position: { width: 780, height: 720 },
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
      roll: TravellerActorSheet.#onRoll,
      openConfig: TravellerActorSheet.#onOpenConfig,
      openCharacteristic: TravellerActorSheet.#onOpenCharacteristic,
      traitCreate: TravellerActorSheet.#onTraitCreate,
      traitEdit: TravellerActorSheet.#onTraitEdit,
      traitDelete: TravellerActorSheet.#onTraitDelete,
      openEditor: TravellerActorSheet.#onOpenEditor
    }
  };

  /** @inheritDoc */
  static PARTS = {
    sheet: {
      root: true,
      template: "systems/mgt2/templates/actors/actor-sheet.html",
      templates: ["systems/mgt2/templates/actors/parts/tabs-nav.html"],
      scrollable: [
        '.tab[data-group="sidebar"].active',
        '.tab[data-group="inventory"].active'
      ]
    }
  };

  /** @inheritDoc */
  static TABS = {
    sidebar: {
      initial: "health",
      tabs: [
        { id: "health", cssClass: "item tab-select", icon: "fa-solid fa-heart-pulse", tooltip: "MGT2.Actor.Health" },
        { id: "skills", cssClass: "item tab-select", icon: "fa-solid fa-head-side", tooltip: "MGT2.Actor.TabSkills" },
        { id: "inventory", cssClass: "item tab-select", icon: "fa-solid fa-briefcase-blank", tooltip: "MGT2.Actor.Inventory" },
        { id: "relations", cssClass: "item tab-select", icon: "fa-solid fa-users", tooltip: "MGT2.Actor.Contacts" },
        { id: "notes", cssClass: "item tab-select", icon: "fa-solid fa-books", tooltip: "MGT2.Actor.Notes" },
        { id: "biography", cssClass: "item tab-select", icon: "fa-solid fa-book-user", tooltip: "MGT2.Actor.Biography" }
      ]
    },
    characteristics: {
      initial: "core",
      tabs: [
        { id: "core", cssClass: "item tab-select", label: "MGT2.Actor.TabCore" },
        { id: "other", cssClass: "item tab-select", label: "MGT2.Actor.TabOthers" }
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
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Three tab groups: ApplicationV2 only auto-prepares when there is exactly one.
    context.tabs = {
      sidebar: this._prepareTabs("sidebar"),
      characteristics: this._prepareTabs("characteristics"),
      inventory: this._prepareTabs("inventory")
    };

    // The templates read {{system.*}}, {{name}}, {{weapons}}… at the root of the context,
    // matching what the V1 sheet returned (a derived plain copy of the actor).
    const actorData = this.actor.toObject(false);
    this._prepareCharacterItems(actorData);
    return Object.assign(context, actorData);
  }

  /* -------------------------------------------- */

  /**
   * Sort the actor's items into the collections consumed by the sheet template.
   * @param {object} actorData   A derived plain copy of the actor, including its items
   */
  _prepareCharacterItems(actorData) {
    actorData.isGM = game.user.isGM;
    actorData.showTrash = false;
    actorData.initiative = this.actor.getInitiative();

    const weapons = [];
    const armors = [];
    const augments = [];
    const computers = [];
    const softwares = [];
    const items = [];
    const equipments = [];

    const containerItems = [];
    const careers = [];
    const skills = [];
    const psionics = [];
    const diseases = [];
    const wounds = [];
    const contacts = [];

    const settings = {
      weightUnit: "kg",
      usePronouns: game.settings.get("mgt2", "usePronouns"),
      useGender: game.settings.get("mgt2", "useGender"),
      showLife: game.settings.get("mgt2", "showLife")
    };
    actorData.settings = settings;

    const actorContainers = [];

    for (let item of actorData.items) {
      if (item.type === "container") {
        actorContainers.push(item);
      } else if (item.type === "computer") {
        computers.push(item);
        item.subItems = [];
        if (item.system.overload === true)
          item.overloadClass = "computer-overload";
      }
    }

    actorContainers.sort(MGT2Helper.compareByName);

    const containers = [{ "name": "(tous)", "_id": "" }].concat(actorContainers);
    const containerIndex = new Map();

    for (let c of actorContainers) {
      containerIndex.set(c._id, c);

      if (c.system.weight > 0) {
        c.weight = MGT2Helper.convertWeightForDisplay(c.system.weight) + " " + settings.weightUnit;
        c.display = c.name.length > 12 ? `${c.name.substring(0, 12)}... (${c.weight})` : `${c.name} (${c.weight})`;
      } else {
        c.display = c.name.length > 12 ? c.name.substring(0, 12) + "..." : c.name;
      }

      if (c.system.onHand === true)
        c.subItems = [];
    }

    let currentContainerView;
    if (actorData.system.containerView !== "") {
      currentContainerView = containerIndex.get(actorData.system.containerView);
      if (currentContainerView !== undefined) {
        actorData.containerView = currentContainerView;
        actorData.containerWeight = MGT2Helper.convertWeightForDisplay(currentContainerView.system.weight);
      } else {
        currentContainerView = null;
        actorData.containerWeight = MGT2Helper.convertWeightForDisplay(0);
      }
    } else {
      currentContainerView = null;
      actorData.containerWeight = MGT2Helper.convertWeightForDisplay(0);
    }

    actorData.containerShowAll = actorData.system.containerView === "";

    for (let i of actorData.items) {
      let item = i.system;

      if (i.system.hasOwnProperty("weight") && i.system.weight > 0) {
        if (isNaN(i.system.quantity))
          i.weight = MGT2Helper.convertWeightForDisplay(i.system.weight) + " " + settings.weightUnit;
        else
          i.weight = MGT2Helper.convertWeightForDisplay(i.system.weight * i.system.quantity) + " " + settings.weightUnit;
      }

      // Item in Storage
      if (item.hasOwnProperty("container") && item.container.id !== "" && item.container.id !== undefined) {
        let container = containerIndex.get(item.container.id);
        if (container === undefined) { // container deleted
          if (actorData.containerShowAll) {
            i.containerName = "#deleted#";
            containerItems.push(i);
          }
          continue;
        }

        if (container.system.locked && !game.user.isGM) continue;

        if (container.system.onHand === true) {
          container.subItems.push(i);
        }

        if (actorData.containerShowAll || (!actorData.containerShowAll && actorData.system.containerView == item.container.id)) {
          i.containerName = container.name;
          containerItems.push(i);
        }

        continue;
      }

      if (i.system.hasOwnProperty("equipped")) {
        i.canEquip = true;
        if (i.system.equipped === true)
          i.toggleClass = "active";
      } else {
        i.canEquip = false;
      }

      switch (i.type) {
        case "equipment":
          switch (i.system.subType) {
            case "augment":
              augments.push(i);
              break;

            default:
              equipments.push(i);
              break;
          }
          break;

        case "armor":
          armors.push(i);
          if (i.system.options && i.system.options.length > 0) {
            i.subInfo = i.system.options.map(x => x.name).join(", ");
          }
          break;

        case "computer":
          if (i.system.options && i.system.options.length > 0) {
            i.subInfo = i.system.options.map(x => x.name).join(", ");
          }
          break;

        case "item":
          if (i.system.subType === "software") {
            if (i.system.software.computerId && i.system.software.computerId !== "") {
              const computer = computers.find(x => x._id === i.system.software.computerId);
              if (computer !== undefined)
                computer.subItems.push(i);
              else
                softwares.push(i);
            } else {
              if (i.system.software.bandwidth > 0)
                i.display = `${i.name} (${i.system.software.bandwidth})`;
              else
                i.display = i.name;
              softwares.push(i);
            }
          } else {
            items.push(i);
          }
          break;

        case "weapon":
          if (i.system.range.isMelee)
            i.range = game.i18n.localize("MGT2.Melee")
          else {
            i.range = MGT2Helper.getRangeDisplay(i.system.range);
          }

          if (i.system.traits && i.system.traits.length > 0) {
            i.subInfo = i.system.traits.map(x => x.name).join(", ");
          }

          weapons.push(i);
          break;

        case "career":
          careers.push(i);
          break;

        case "contact":
          contacts.push(i);
          break;

        case "disease":
          switch (i.system.subType) {
            case "wound":
              wounds.push(i);
              break;

            default:
              diseases.push(i);
              break;
          }
          break;

        case "talent":
          if (i.system.subType === "skill") {
            skills.push(i);
          } else {
            if (MGT2Helper.hasValue(i.system.psionic, "reach")) {
              i.reach = game.i18n.localize(`MGT2.PsionicReach.${i.system.psionic.reach}`);
            }

            if (MGT2Helper.hasValue(i.system.roll, "difficulty")) {
              i.difficulty = game.i18n.localize(`MGT2.Difficulty.${i.system.roll.difficulty}`);
            }
            psionics.push(i);
          }
          break;

        case "container":
          if (i.system.onHand === true) {
            items.push(i);
          }
          break;
      }
    }

    actorData.encumbranceNormal = MGT2Helper.convertWeightForDisplay(actorData.system.inventory.encumbrance.normal);
    actorData.encumbranceHeavy = MGT2Helper.convertWeightForDisplay(actorData.system.inventory.encumbrance.heavy);

    if (actorData.system.inventory.weight > actorData.system.inventory.encumbrance.heavy) {
      actorData.encumbranceClasses = "encumbrance-heavy"
      actorData.encumbrance = 2;
    } else if (actorData.system.inventory.weight > actorData.system.inventory.encumbrance.normal) {
      actorData.encumbranceClasses = "encumbrance-normal"
      actorData.encumbrance = 1;
    } else {
      actorData.encumbrance = 0;
    }

    if (softwares.length > 0) {
      softwares.sort(MGT2Helper.compareByName);
      actorData.softwares = softwares;
    }

    augments.sort(this.compareEquippedByName);
    actorData.augments = augments;

    armors.sort(this.compareEquippedByName);
    actorData.armors = armors;

    computers.sort(this.compareEquippedByName);
    actorData.computers = computers;

    actorData.careers = careers; // First In First Out

    contacts.sort(MGT2Helper.compareByName);
    actorData.contacts = contacts;

    containers.sort(MGT2Helper.compareByName);
    actorData.containers = containers;

    diseases.sort(MGT2Helper.compareByName);
    actorData.diseases = diseases;

    actorData.wounds = wounds;

    equipments.sort(this.compareEquippedByName);
    actorData.equipments = equipments;

    items.sort(this.compareEquippedByName);
    actorData.items = items;

    actorContainers.sort(MGT2Helper.compareByName);
    actorData.actorContainers = actorContainers;

    skills.sort(MGT2Helper.compareByName);
    actorData.skills = skills;

    psionics.sort(MGT2Helper.compareByName);
    actorData.psionics = psionics;

    weapons.sort(this.compareEquippedByName);
    actorData.weapons = weapons;

    if (containerItems.length > 0) {
      containerItems.sort((a, b) => {
        const containerResult = a.containerName.localeCompare(b.containerName);
        if (containerResult !== 0) return containerResult;

        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    }

    actorData.containerItems = containerItems;
  }

  compareEquippedByName(a, b) {
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
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
  static async #onTraitCreate() {
    await this.submit();
    const traits = Object.values(this.actor.system.personal.traits ?? []);
    traits.push({ name: "", description: "" });
    return this.actor.update({ "system.personal.traits": traits });
  }

  /** @this {TravellerActorSheet} */
  static async #onTraitEdit(event, target) {
    const index = Number(target.closest("[data-traits-part]").dataset.traitsPart);
    const traits = foundry.utils.deepClone(Object.values(this.actor.system.personal.traits ?? []));
    const result = await CharacterPrompts.openTraitEdit(traits[index]);
    if ( !result ) return;
    traits[index].name = result.name;
    traits[index].description = result.description;
    return this.actor.update({ "system.personal.traits": traits });
  }

  /** @this {TravellerActorSheet} */
  static async #onTraitDelete(event, target) {
    await this.submit();
    const index = Number(target.closest(".traits-part").dataset.traitsPart);
    const traits = Object.values(this.actor.system.personal.traits ?? []);
    return this.actor.update({ "system.personal.traits": traits.filter((_v, i) => i !== index) });
  }

  /** @this {TravellerActorSheet} */
  static async #onOpenConfig() {
    const userConfig = await CharacterPrompts.openConfig(this.actor.system);
    if ( !userConfig ) return;
    return this.actor.update({ "system.config": foundry.utils.expandObject(userConfig) });
  }

  /** @this {TravellerActorSheet} */
  static async #onOpenCharacteristic(event, target) {
    const name = target.dataset.cfgCharacteristic;
    const c = this.actor.system.characteristics[name];

    let showAll = false;
    for (const value of Object.values(this.actor.system.characteristics)) {
      if (!value.show) {
        showAll = true;
        break;
      }
    }

    const userConfig = await CharacterPrompts.openCharacteristic(
      game.i18n.localize(`MGT2.Characteristics.${name}.name`), c.show, c.showMax, showAll);

    if ( !userConfig ) return;

    const data = { system: { characteristics: {} } };
    data.system.characteristics[name] = {
      show: userConfig.show,
      showMax: userConfig.showMax
    };

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

  /** @this {TravellerActorSheet} */
  static async #onRoll(event, target) {
    const rollOptions = {
      rollTypeName: game.i18n.localize("MGT2.RollPrompt.Roll"),
      rollObjectName: "",
      characteristics: [{ _id: "", name: "" }],
      characteristic: "",
      skills: [],
      skill: "",
      fatigue: this.actor.system.states.fatigue,
      encumbrance: this.actor.system.states.encumbrance,
      difficulty: null,
      damageFormula: null
    };

    const cardButtons = [];

    for (const [key, label] of Object.entries(MGT2.Characteristics)) {
      const c = this.actor.system.characteristics[key];
      if (c.show) {
        rollOptions.characteristics.push({ _id: key, name: game.i18n.localize(label) + MGT2Helper.getDisplayDM(c.dm) });
      }
    }

    for (let item of this.actor.items) {
      if (item.type === "talent") {
        if (item.system.subType === "skill")
          rollOptions.skills.push({ _id: item.id, name: item.getRollDisplay() });
      }
    }

    rollOptions.skills.sort(MGT2Helper.compareByName);
    rollOptions.skills = [{ _id: "NP", name: game.i18n.localize("MGT2.Items.NotProficient") }].concat(rollOptions.skills);

    let itemObj = null;
    let isInitiative = false;
    if (target.dataset.roll === "initiative") {
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.InitiativeRoll");
      rollOptions.characteristic = this.actor.system.config.initiative;
      isInitiative = true;
    } else if (target.dataset.roll === "characteristic") {
      rollOptions.characteristic = target.dataset.rollCharacteristic;
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.CharacteristicRoll");
      rollOptions.rollObjectName = game.i18n.localize(`MGT2.Characteristics.${rollOptions.characteristic}.name`);
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

      if (target.dataset.roll === "psionic") {
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

      if (itemObj.system.hasOwnProperty("damage")) {
        rollOptions.damageFormula = itemObj.system.damage;
        if (itemObj.type === "disease") {
          if (itemObj.system.subType === "disease") {
            rollOptions.rollTypeName = game.i18n.localize("MGT2.DiseaseSubType.disease");
          } else if (itemObj.system.subType === "poison") {
            rollOptions.rollTypeName = game.i18n.localize("MGT2.DiseaseSubType.poison");
          }
        }
      }

      if (itemObj.system.hasOwnProperty("roll")) {
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

    if (userRollData.hasOwnProperty("characteristic") && userRollData.characteristic !== "") {
      let c = this.actor.system.characteristics[userRollData.characteristic];
      let dm = c.dm;
      rollFormulaParts.push(MGT2Helper.getFormulaDM(dm));
      rollModifiers.push(game.i18n.localize(`MGT2.Characteristics.${userRollData.characteristic}.name`) + MGT2Helper.getDisplayDM(dm));
    }

    if (userRollData.hasOwnProperty("skill") && userRollData.skill !== "") {
      if (userRollData.skill === "NP") {
        rollFormulaParts.push("-3");
        rollModifiers.push(game.i18n.localize("MGT2.Items.NotProficient"));
      } else {
        const skillObj = this.actor.getEmbeddedDocument("Item", userRollData.skill);
        rollFormulaParts.push(MGT2Helper.getFormulaDM(skillObj.system.level));
        rollModifiers.push(skillObj.getRollDisplay());
      }
    }

    if (userRollData.hasOwnProperty("psionic") && userRollData.psionic !== "") {
      let psionicObj = this.actor.getEmbeddedDocument("Item", userRollData.psionic);
      rollFormulaParts.push(MGT2Helper.getFormulaDM(psionicObj.system.level));
      rollModifiers.push(psionicObj.getRollDisplay());
    }

    if (userRollData.hasOwnProperty("timeframes") &&
      userRollData.timeframes !== "" &&
      userRollData.timeframes !== "Normal") {
      rollModifiers.push(game.i18n.localize(`MGT2.Timeframes.${userRollData.timeframes}`));
      rollFormulaParts.push(userRollData.timeframes === "Slower" ? "+2" : "-2");
    }

    if (userRollData.hasOwnProperty("encumbrance") && userRollData.encumbrance === true) {
      rollFormulaParts.push("-2");
      rollModifiers.push(game.i18n.localize("MGT2.Actor.Encumbrance") + " -2");
    }

    if (userRollData.hasOwnProperty("fatigue") && userRollData.fatigue === true) {
      rollFormulaParts.push("-2");
      rollModifiers.push(game.i18n.localize("MGT2.Actor.Fatigue") + " -2");
    }

    if (userRollData.hasOwnProperty("customDM") && userRollData.customDM !== "") {
      let s = String(userRollData.customDM).trim();
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

    if (isInitiative && this.token && this.token.combatant) {
      await this.token.combatant.update({ initiative: roll.total });
    }

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
      showRollDamage: rollOptions.damageFormula !== null && rollOptions.damageFormula !== "",
      cardButtons: cardButtons
    };

    if (MGT2Helper.hasValue(rollOptions, "difficulty")) {
      chatData.rollDifficulty = rollOptions.difficulty;
      chatData.rollDifficultyLabel = MGT2Helper.getDifficultyDisplay(rollOptions.difficulty);

      if (roll.total >= MGT2Helper.getDifficultyValue(rollOptions.difficulty)) {
        chatData.rollSuccess = true;
      } else {
        chatData.rollFailure = true;
      }
    }

    chatData.content = await foundry.applications.handlebars.renderTemplate(
      "systems/mgt2/templates/chat/roll.html", chatData);

    let flags = null;

    if (rollOptions.damageFormula !== null && rollOptions.damageFormula !== "") {
      flags = { mgt2: { damage: { formula: rollOptions.damageFormula, rollObjectName: rollOptions.rollObjectName, rollTypeName: rollOptions.rollTypeName } } };
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
      if (this.actor.system.containerDropIn == "" || this.actor.system.containerDropIn === null) {
        // Place into the first container, creating one if the actor has none.
        if (containers.length === 0) {
          container = (await getDocumentClass("Item").create({ name: "New container", type: "container" }, { parent: this.actor }));
        } else {
          container = containers[0];
        }
      } else {
        container = containers.find(x => x._id == this.actor.system.containerDropIn);
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
    const container = this.actor.items.get(this.actor.system.containerView);
    return container?.sheet.render({ force: true });
  }

  /** @this {TravellerActorSheet} */
  static async #onContainerDelete() {
    const containers = this.actor.getContainers();
    const container = containers.find(x => x._id == this.actor.system.containerView);
    if ( !container ) return;

    // Loose items that referenced this container so they are not orphaned.
    const containerItems = this.actor.items.filter(x => x.system.hasOwnProperty("container") && x.system.container.id === container._id);
    if (containerItems.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item",
        containerItems.map(item => ({ _id: item.id, "system.container.id": "" })));
    }

    const update = { "system.containerView": "" };
    if (this.actor.system.containerDropIn === container._id) {
      const remaining = containers.filter(x => x._id !== container._id);
      update["system.containerDropIn"] = remaining.length > 0 ? remaining[0]._id : "";
    }

    await this.actor.deleteEmbeddedDocuments("Item", [container._id]);
    return this.actor.update(update);
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

      update.system.personal.traits = this.actor.system.personal.traits.concat(sourceItemData.system.traits);

      // characteristics
      if (sourceItemData.system.modifiers && sourceItemData.system.modifiers.length > 0) {
        update.system.characteristics = {};
        for (let modifier of sourceItemData.system.modifiers) {
          if (MGT2Helper.hasValue(modifier, "characteristic") && MGT2Helper.hasValue(modifier, "value")) {
            const c = this.actor.system.characteristics[modifier.characteristic];
            const updateValue = { value: c.value };
            updateValue.value += modifier.value;
            if (c.showMax) {
              updateValue.max = c.max + modifier.value;
            }

            update.system.characteristics[modifier.characteristic] = updateValue;
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

      const recalcWeight = transferData.system.hasOwnProperty("weight");

      // Normalize data
      if (transferData.system.hasOwnProperty("container"))
        transferData.system.container.id = "";
      if (transferData.type === "item" && transferData.system.subType === "software")
        transferData.system.software.computerId = "";

      if (transferData.type === "container")
        transferData.system.onHand = true;

      if (transferData.system.hasOwnProperty("equipped"))
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

      if (recalcWeight) {
        await this.actor.recalculateWeight();
      }
    }
    return true;
  }
}
