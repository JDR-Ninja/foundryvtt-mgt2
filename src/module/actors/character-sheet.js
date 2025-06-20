import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { RollPromptHelper } from "../roll-prompt.js";
import { CharacterPrompts } from "./character-prompts.js";

export class TravellerActorSheet extends ActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    const options = super.defaultOptions;

    if (game.user.isGM || options.editable)
      options.dragDrop.push({ dragSelector: ".drag-item-list", dropSelector: ".drop-item-list" });

    return foundry.utils.mergeObject(options, {
      classes: ["mgt2", game.settings.get("mgt2", "theme"), "sheet", "actor", "character", "nopad"],
      template: "systems/mgt2/templates/actors/actor-sheet.html",
      width: 780,
      //height: 600,
      tabs: [
        { navSelector: ".sheet-sidebar", contentSelector: "form" },
        { navSelector: "nav[data-group='characteristics']", contentSelector: "section.characteristics-panel", initial: "core" },
        { navSelector: "nav[data-group='inventory']", contentSelector: "div.tab[data-tab='inventory']", initial: "onhand" }
      ]
    });
  }

  async getData(options) {
    const context = super.getData(options);
    //console.log(context);
    /*const context = {
    actor: this.actor,
    source: source.system
    
    }*/

    this._prepareCharacterItems(context);

    /*context.biographyHTML = await TextEditor.enrichHTML(context.data.system.biography, {
      secrets: this.actor.isOwner,
      rollData: context.rollData,
      async: true,
      relativeTo: this.actor
    });*/

    return context.data;
  }

  _prepareCharacterItems(sheetData) {
    const actorData = sheetData.data;
    actorData.isGM = game.user.isGM;
    actorData.showTrash = false;//game.user.isGM || game.settings.get("mgt2", "showTrash");
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
      //weightUnit: game.settings.get("mgt2", "useWeightMetric") ? "kg" : "lb",
      usePronouns: game.settings.get("mgt2", "usePronouns"),
      useGender: game.settings.get("mgt2", "useGender"),
      showLife: game.settings.get("mgt2", "showLife")
    };
    actorData.settings = settings;

    const actorContainers = [];//sheetData.actor.getContainers();

    for (let item of sheetData.items) {
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

      if (c.system.onHand === true/* && c.system.count > 0*/)
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

    for (let i of sheetData.items) {
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
          if (container === undefined)
            i.containerName = "#deleted#";
          else
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
          //computers.push(i);
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

          // Traits
          // if (i.system.traits == undefined)
          //   i.system.traits = {
          //     parts: []
          //   };

          // let traits = i.system.traits.parts.map(x => x[0]);

          // traits.sort();
          // i.traits = traits.join(", ");
          // if (i.system.options && i.system.options.length > 0) {
          //   i.subInfo = i.system.options.map(x => x.name).join(", ");
          // }
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
              //i.difficulty = MGT2Helper.getDifficultyDisplay(i.system.roll.difficulty);
            }
            psionics.push(i);
          }
          break;

        case "container":
          if (i.system.onHand === true) {
            items.push(i);
            // sous item
          }
          break;
      }
    }

    // let weight = MGT2Helper.getItemsWeight(weapons) +
    //   MGT2Helper.getItemsWeight(augments) +
    //   MGT2Helper.getItemsWeight(armors) +
    //   MGT2Helper.getItemsWeight(computers) +
    //   MGT2Helper.getItemsWeight(items);

    //let containerWeight = MGT2Helper.getItemsWeight(containerItems);

    actorData.encumbranceNormal = MGT2Helper.convertWeightForDisplay(actorData.system.inventory.encumbrance.normal);
    actorData.encumbranceHeavy = MGT2Helper.convertWeightForDisplay(actorData.system.inventory.encumbrance.heavy);
    //actorData.weight = MGT2Helper.convertWeightForDisplay(weight); // actorData.system.inventory.weight
    //actorData.containerWeight = MGT2Helper.convertWeightForDisplay(containerWeight);
    //actorData.dropInContainer = 

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

    //careers.sort(this.compareByName);
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
    //if (a.system.hasOwnProperty("equipped") && !b.system.hasOwnProperty("equipped")) return -1;
    //if (!a.system.hasOwnProperty("equipped") && b.system.hasOwnProperty("equipped")) return 1;

    //if (a.system.equipped === true && b.system.equipped === false) return -1;
    //if (a.system.equipped === false && b.system.equipped === true) return 1;

    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // if (this.actor.isOwner) {
    //   let handler = ev => this._onDragStart(ev);

    //   html.find('div.dropitem').each((i, e) => {
    //     //if (li.classList.contains("inventory-header")) return;
    //     e.setAttribute("draggable", true);
    //     e.addEventListener("dragstart", handler, false);
    //   });
    // }

    html.find('.container-create').click(this._onContainerCreate.bind(this));
    html.find('.container-edit').click(ev => {
      const container = this.actor.getEmbeddedDocument("Item", this.actor.system.containerView);
      container.sheet.render(true);
    });

    html.find('.container-delete').click(ev => {
      ev.preventDefault();
      const containers = this.actor.getContainers();
      const container = containers.find(x => x._id == this.actor.system.containerView);
      const containerItems = this.actor.items.filter(x => x.system.hasOwnProperty("container") && x.system.container.id === container._id);

      if (containerItems.length > 0) {
        for (let item of containerItems) {
          let clone = duplicate(item);
          clone.system.container.id = "";
          this.actor.updateEmbeddedDocuments('Item', [clone]);
        }
      }

      const cloneActor = duplicate(this.actor);
      cloneActor.system.containerView = "";
      if (cloneActor.system.containerDropIn === container._id) {
        cloneActor.system.containerDropIn = "";
        const remainingContainers = containers.filter(x => x._id !== container._id);
        if (remainingContainers.length > 0)
          cloneActor.system.containerDropIn = remainingContainers[0]._id;
      }
      this.actor.deleteEmbeddedDocuments("Item", [container._id]);
      this.actor.update(cloneActor);
    });

    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-edit').click(ev => {
      ev.preventDefault();
      const html = $(ev.currentTarget).parents("[data-item-id]");
      const item = this.actor.getEmbeddedDocument("Item", html.data("itemId"));
      item.sheet.render(true);
    });

    html.find('.item-delete').click(ev => {
      ev.preventDefault();
      const html = $(ev.currentTarget).parents("[data-item-id]");
      // ev.ctrlKey === true

      this.actor.deleteEmbeddedDocuments("Item", [html.data("itemId")]);
      html.slideUp(200, () => this.render(false));
    });
    html.find('a.item-equip').click(this._onItemEquip.bind(this));
    html.find('a.item-storage-out').click(this._onItemStorageOut.bind(this));
    html.find('a.item-storage-in').click(this._onItemStorageIn.bind(this));
    html.find('a.software-eject').click(this._onSoftwareEject.bind(this));

    html.find('a[data-roll]').click(this._onRoll.bind(this));
    html.find('a[name="config"]').click(this._onOpenConfig.bind(this));
    html.find('a[data-cfg-characteristic]').click(this._onOpenCharacteristic.bind(this));
    html.find('.traits-create').click(this._onTraitCreate.bind(this));
    html.find('.traits-edit').click(this._onTraitEdit.bind(this));
    html.find('.traits-delete').click(this._onTraitDelete.bind(this));
    html.find('a[data-editor="open"]').click(this._onOpenEditor.bind(this));
  };

  async _onOpenEditor(event) {
    event.preventDefault();
    await CharacterPrompts.openEditorFullView(this.actor.system.personal.species, this.actor.system.personal.speciesText.descriptionLong);
  }

  async _onTraitCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    let traits = this.actor.system.personal.traits;
    let index;
    if (traits.length === 0) {
      traits = {};
      traits["0"] = { name: "", description: "" };
    } else {
      index = Math.max(...Object.keys(traits));
      index++;
      traits[index] = { name: "", description: "" };
    }

    return this.actor.update({ system: { personal: { traits: traits } } });
  }

  async _onTraitEdit(event) {
    event.preventDefault();
    const index = $(event.currentTarget).parents("[data-traits-part]").data("traits-part");
    const trait = this.actor.system.personal.traits[index];
    let result = await CharacterPrompts.openTraitEdit(trait);
    const traits = this.actor.system.personal.traits;
    traits[index].name = result.name;
    traits[index].description = result.description;
    return this.actor.update({ system: { personal: { traits: traits } } });
  }

  async _onTraitDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".traits-part");
    const traits = foundry.utils.deepClone(this.actor.system.personal.traits);
    let index = Number(element.dataset.traitsPart);

    const newTraits = [];
    let entries = Object.entries(traits);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
          newTraits.push(value);
      }
    }

    return this.actor.update({ system: { personal: { traits: newTraits } } });
  }

  async _onOpenConfig(ev) {
    ev.preventDefault();
    //console.log(this.actor.system);
    const userConfig = await CharacterPrompts.openConfig(this.actor.system);
    //console.log(userData);
    // {initiative: 'dexterity', damage.rank1: 'strength', damage.rank2: 'dexterity', damage.rank3: 'endurance'}
    if (userConfig) {
      this.actor.update({ "system.config": userConfig });
    }
  }

  async _onOpenCharacteristic(ev) {
    ev.preventDefault();
    const name = ev.currentTarget.dataset.cfgCharacteristic;
    const c = this.actor.system.characteristics[name];

    let showAll = false;
    for (const [key, value] of Object.entries(this.actor.system.characteristics)) {
      if (!value.show) {
        showAll = true;
        break;
      }
    }

    const userConfig = await CharacterPrompts.openCharacteristic(game.i18n.localize(`MGT2.Characteristics.${name}.name`), c.show, c.showMax, showAll);

    // {hide: false, showMax: true, showAll: false}
    if (userConfig) {
      const data = {
        system: {
          characteristics: {}
        }
      };

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

      this.actor.update(data);
    }
  }

  async _onRoll(event) {
    event.preventDefault();

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

    // TODO Convertir le bouton des dégâts
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
          rollOptions.skills.push({ _id: item._id, name: item.getRollDisplay() });
      }
    }

    rollOptions.skills.sort(MGT2Helper.compareByName);
    rollOptions.skills = [{ _id: "NP", name: game.i18n.localize("MGT2.Items.NotProficient") }].concat(rollOptions.skills);

    let itemObj = null;
    let isInitiative = false;
    const button = event.currentTarget;
    if (button.dataset.roll === "initiative") {
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.InitiativeRoll");
      rollOptions.characteristic = this.actor.system.config.initiative;
      isInitiative = true;
    } else if (button.dataset.roll === "characteristic") {
      rollOptions.characteristic = button.dataset.rollCharacteristic;
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.CharacteristicRoll");
      rollOptions.rollObjectName = game.i18n.localize(`MGT2.Characteristics.${rollOptions.characteristic}.name`);
    } else {

      if (button.dataset.roll === "skill") {
        rollOptions.skill = button.dataset.rollSkill;
        itemObj = this.actor.getEmbeddedDocument("Item", rollOptions.skill);
        rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.SkillRoll");
        rollOptions.rollObjectName = itemObj.name;
      } else {
        if (button.dataset.roll === "psionic") {
          rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.PsionicRoll");
        }
      }

      if (itemObj === null && button.dataset.itemId) {
        itemObj = this.actor.getEmbeddedDocument("Item", button.dataset.itemId);
        rollOptions.rollObjectName = itemObj.name;
        if (itemObj.type === "weapon")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.weapon");
        else if (itemObj.type === "armor")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.armor");
        else if (itemObj.type === "computer")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.computer");
      }

      if (button.dataset.roll === "psionic") {
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
          if (itemObj.system.subTypetype === "disease") {
            rollOptions.rollTypeName = game.i18n.localize("MGT2.DiseaseSubType.disease");
          } else if (itemObj.system.subTypetype === "poison") {
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
      let s = userRollData.customDM.trim();
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

    let roll = await new Roll(rollFormula, rollData).roll({ async: true, rollMode: userRollData.rollMode });

    if (isInitiative && this.token && this.token.combatant) {
      await this.token.combatant.update({ initiative: roll.total });
    }

    let isPrivate = false;
    //let flavor = "Roule!";
    const chatData = {
      user: game.user.id,
      speaker: this.actor ? ChatMessage.getSpeaker({ actor: this.actor }) : null,
      formula: isPrivate ? "???" : roll._formula,
      //flavor: isPrivate ? null : flavor,
      tooltip: isPrivate ? "" : await roll.getTooltip(),
      total: isPrivate ? "?" : Math.round(roll.total * 100) / 100,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
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

    const html = await renderTemplate("systems/mgt2/templates/chat/roll.html", chatData);
    chatData.content = html;

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

    return roll.toMessage(chatData);
  }

  _onItemCreate(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget);

    const data = {
      name: html.data("create-name"),
      type: html.data("type-item")
    };

    if (html.data("subtype")) {
      data.system = {
        subType: html.data("subtype")
      };
    }

    const cls = getDocumentClass("Item");

    return cls.create(data, { parent: this.actor });
  }

  _onItemEquip(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    item.system.equipped = !item.system.equipped;
    this.actor.updateEmbeddedDocuments('Item', [item]);
  }

  _onItemStorageIn(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    if (item.type === "container") {
      item.system.onHand = false;
    } else {
      let container;
      const containers = this.actor.getContainers();
      if (this.actor.system.containerDropIn == "" || this.actor.system.containerDropIn === null) {
        // Placer dans le premier container
        if (containers.length === 0) {
          // Create default container
          const cls = getDocumentClass("Item");
          container = cls.create({ name: "New container", type: "container" }, { parent: this.actor });
        } else {
          container = containers[0];
        }
      } else {
        container = containers.find(x => x._id == this.actor.system.containerDropIn);
      }

      if (container.system.locked) {
        if (game.user.isGM) {
          item.system.container.id = container._id;
        } else {
          ui.notifications.error("Objet verrouillé");
        }
      } else {
        item.system.container.id = container._id;
      }

    }
    this.actor.updateEmbeddedDocuments('Item', [item]);
  }

  _onItemStorageOut(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    item.system.container.id = "";
    //item.system.container.inContainer = false;
    this.actor.updateEmbeddedDocuments('Item', [item]);
  }

  _onSoftwareEject(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    item.system.software.computerId = "";
    this.actor.updateEmbeddedDocuments('Item', [item]);
  }

  _onContainerCreate(ev) {
    ev.preventDefault();
    const cls = getDocumentClass("Item");
    return cls.create({ name: "New container", type: "container" }, { parent: this.actor });
  }

  _canDragDrop(selector) {
    return this.isEditable;
  }

  async _onDrop(event) {
    //console.log("_onDrop");
    //console.log(event);
    event.preventDefault();
    event.stopImmediatePropagation();
    const dropData = MGT2Helper.getDataFromDropEvent(event);
    if (!dropData) return false;

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

        // recalcul modifier?
      }

      this.actor.update(update);

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

      sourceItem = duplicate(sourceItem);
      if (sourceItem._id === targetId) return false; // Same item

      if (targetItem.type === "item" || targetItem.type === "equipment") {
        // SOFTWARE --> COMPUTER
        if (targetItem.system.subType === "software") {
          sourceItem.system.software.computerId = targetItem.system.software.computerId;
        } else {
          sourceItem.system.container.id = targetItem.system.container.id;
        }
        this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
        return true;
      } else if (targetItem.type === "computer") {
        sourceItem.system.software.computerId = targetId;
        this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
        return true;
      } else if (targetItem.type === "container") {
        // locked refuse
        if (targetItem.system.locked && !game.user.isGM)
          ui.notifications.error("Verrouillé");
        else {
          sourceItem.system.container.id = targetId;
          this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
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

      //const sourceItemId = transferData._id;

      delete transferData._id;
      delete transferData.id;

      const recalcWeight = transferData.system.hasOwnProperty("weight");

      // Normalize data
      if (transferData.system.hasOwnProperty("container"))
        transferData.system.container.id = "";
      if (transferData.type === "item" && transferData.system.subType === "software")
        transferData.system.software.computerId = "";

      if (transferData.type === "container")
        transferData.onHand = true;

      if (transferData.system.hasOwnProperty("equipment"))
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

      const addedItem = (await this.actor.createEmbeddedDocuments("Item", [transferData]))[0];

      if (transferData.actor) {
        // delete item
        // if container, tranferts content onHand true
      }


      if (recalcWeight) {
        await this.actor.recalculateWeight();
      }
    }
    return true;
  }

  _getSubmitData(updateData = {}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    //   this.actor.computeCharacteristics(formData);
    return foundry.utils.flattenObject(formData);
  }
}
