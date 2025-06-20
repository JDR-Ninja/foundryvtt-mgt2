import { MGT2Helper } from "./helper.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class TravellerItemSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return foundry.utils.mergeObject(options, {
      classes: ["mgt2", game.settings.get("mgt2", "theme"), "sheet"],
      width: 630,
      tabs: [{ navSelector: ".horizontal-tabs", contentSelector: ".itemsheet-panel", initial: "tab1" }]
    });
  }

  /* -------------------------------------------- */

  get template() {
    const path = "systems/mgt2/templates/items";
    return `${path}/${this.item.type}-sheet.html`;
  }

  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    //console.log('-=getData=-');
    //console.log(context);
    const item = context.item;

    const source = item.toObject();
    context.config = CONFIG.MGT2;

    const settings = {};
    settings.usePronouns = game.settings.get("mgt2", "usePronouns");

    let containers = null;
    let computers = null;;
    let hadContainer;
    if (context.item.actor != null) {
      hadContainer = true;
      containers = [{ "name": "", "_id": "" }].concat(context.item.actor.getContainers());
      computers = [{ "name": "", "_id": "" }].concat(context.item.actor.getComputers());
    } else {
      hadContainer = false;
    }

    let weight = null;
    if (item.system.hasOwnProperty("weight")) {
      weight = MGT2Helper.convertWeightForDisplay(item.system.weight);
    }
    let unitlabels = {
      weight: MGT2Helper.getWeightLabel()
    };
    let skills = [];

    if (this.actor !== null) {
      for (let item of this.actor.items) {
        if (item.type === "talent") {
          if (item.system.subType === "skill")
            skills.push({ _id: item._id, name: item.getRollDisplay() });
        }
      }
    }
    
    skills.sort(MGT2Helper.compareByName);
    skills = [{ _id: "NP", name: game.i18n.localize("MGT2.Items.NotProficient") }].concat(skills);

    foundry.utils.mergeObject(context, {
      source: source.system,
      system: item.system,
      settings: settings,
      containers: containers,
      computers: computers,
      hadContainer: hadContainer,
      weight: weight,
      unitlabels: unitlabels,
      editable: this.isEditable,
      isGM: game.user.isGM,
      skills: skills,
      config: CONFIG
      //rollData: this.item.getRollData(),
    });

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    //let handler = ev => this._onDropCustom(ev);

    //console.log(html);
    // itemsheet-panel
    //html.addEventListener("dragstart", this._onDropCustom, false);
    html.find('div.itemsheet-panel').each((i, li) => {
      //  //if (li.classList.contains("inventory-header")) return;
      //li.setAttribute("draggable", true);
      //li.addEventListener("drop", handler, false);
    });


    //html.find('div.dropitem').each((i, li) => {
    //  //if (li.classList.contains("inventory-header")) return;
    //  li.setAttribute("draggable", true);
    //  li.addEventListener("dragstart", handler, false);
    //});

    // if (this.item.type == "weapon") {
    //   html.find('.trait-create').click(this._onTraitCreate.bind(this));
    //   html.find('.trait-delete').click(this._onTraitDelete.bind(this));
    // }

    if (this.item.type == "career") {
      html.find('.event-create').click(this._onCareerEventCreate.bind(this));
      html.find('.event-delete').click(this._onCareerEventDelete.bind(this));
    }

    else if (this.item.type == "armor" ||
             this.item.type == "computer" ||
             this.item.type == "species" ||
             this.item.type == "weapon") {
        html.find('.options-create').click(this._onOptionCreate.bind(this));
        html.find('.options-delete').click(this._onOptionDelete.bind(this));
    }

    if (this.item.type == "species") {
      html.find('.modifiers-create').click(this._onModifierEventCreate.bind(this));
      html.find('.modifiers-delete').click(this._onModifierEventDelete.bind(this));
    }
  }

  async _onModifierEventCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);

    let modifiers = this.item.system.modifiers;
    let index;
    if (modifiers.length === 0) {
      modifiers = {};
      modifiers["0"] = { characteristic: "Endurance", value: null };
    } else {
      index = Math.max(...Object.keys(modifiers));
      index++;
      modifiers[index] = { characteristic: "Endurance", value: null };
    }

    let update = {
      system: {
        modifiers: modifiers
      }
    };

    return this.item.update(update);
  }

  async _onModifierEventDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".modifiers-part");
    const modifiers = foundry.utils.deepClone(this.item.system.modifiers);
    let index = Number(element.dataset.modifiersPart);

    const newModifiers = [];
    let entries = Object.entries(modifiers);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
        newModifiers.push(value);
      }
    }

    let update = {
      system: {
        modifiers: newModifiers
      }
    };
    
    return this.item.update(update);
  }

  async _onCareerEventCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);

    let events = this.item.system.events;
    let index;
    if (events.length === 0) {
      events = {};
      events["0"] = { age: "", description: "" };
    } else {
      index = Math.max(...Object.keys(events));
      index++;
      events[index] = { age: "", description: "" };
    }

    let update = {
      system: {
        events: events
      }
    };

    return this.item.update(update);
  }

  async _onCareerEventDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".events-part");
    const events = foundry.utils.deepClone(this.item.system.events);
    let index = Number(element.dataset.eventsPart);

    const newEvents = [];
    let entries = Object.entries(events);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
        newEvents.push(value);
      }
    }

    let update = {
      system: {
        events: newEvents
      }
    };
    
    return this.item.update(update);
  }

  async _onOptionCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);

    //const subType = event.currentTarget.dataset.subType;
    const property = event.currentTarget.dataset.property;

    //let options = this.item.system[subType][property];
    let options = this.item.system[property];
    let index;
    if (options.length === 0) {
      options = {};
      options["0"] = { name: "", description: "" };
    } else {
      index = Math.max(...Object.keys(options));
      index++;
      options[index] = { name: "", description: "" };
    }

    let update = {};
    //update[`system.${subType}.${property}`] = options;
    update[`system.${property}`] = options;
    return this.item.update(update);
  }

  async _onOptionDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".options-part");
    //const subType = element.dataset.subType;
    const property = element.dataset.property;
    //const options = foundry.utils.deepClone(this.item.system[subType][property]);
    const options = foundry.utils.deepClone(this.item.system[property]);
    let index = Number(element.dataset.optionsPart);

    const newOptions = [];
    let entries = Object.entries(options);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
          newOptions.push(value);
      }
    }

    let update = {};
    //update[`system.${subType}.${property}`] = newOptions;
    update[`system.${property}`] = newOptions;
    return this.item.update(update);
  }

  // async _onTraitCreate(event) {
  //   event.preventDefault();
  //   await this._onSubmit(event);
  //   const traits = this.item.system.traits;
  //   return this.item.update({ "system.traits.parts": traits.parts.concat([["", ""]]) });
  // }

  // async _onTraitDelete(event) {
  //   event.preventDefault();
  //   await this._onSubmit(event);
  //   const element = event.currentTarget.closest(".traits-part");
  //   const traits = foundry.utils.deepClone(this.item.system.traits);
  //   traits.parts.splice(Number(element.dataset.traitsPart), 1);
  //   return this.item.update({ "system.traits.parts": traits.parts });
  // }

  _getSubmitData(updateData = {}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));

    // Gestion des containers
    if (formData.hasOwnProperty("system") && formData.system.hasOwnProperty("container") &&
      (this.item.system.hasOwnProperty("equipped"))) {
      //*console.log('-=_getSubmitData=-');
      //console.log(this.item.system.onHand);
      //console.log(formData.system.onHand);
      //const onHandChange = this.item.system.onHand !== formData.system.onHand;
      const equippedChange = this.item.system.equipped !== formData.system.equipped;
      const containerChange = this.item.system.container.id !== formData.system.container.id;
      // Maintenant équipé
      if (equippedChange) {
        if (formData.system.equipped === true) {
          //formData.system.onHand = true;
          //console.log("clear container");
          formData.system.container = {
            //inContainer: false,
            id: ""
          };
        }
      }

      /*else if (onHandChange) {
        // Maintenant à portée
        if (formData.system.onHand === true) {
          //console.log("clear container");
          formData.system.container = {
            inContainer: false,
            id: ""
          };
        } else {
          formData.system.equipped = false;
        }
      }*/

      else if (containerChange) {
        // Mise en storage
        if (formData.system.container.id !== "" && (this.item.system.container.id === "" || this.item.system.container.id === null)) {
          //console.log("put in container");
          //formData.system.onHand = false;
          formData.system.equipped = false;
          //formData.system.container.inContainer = true;
        }
      }
    }

    // if (this.item.type == "weapon") {
    //   const traits = formData.system?.traits;
    //   if (traits)
    //     traits.parts = Object.values(traits?.parts || {}).map(d => [d[0] || "", d[1] || ""]);
    // }

    // else if (this.item.type == "career") {
    //   const events = formData.system?.events;
    //   if (events)
    //     events.parts = Object.values(events?.parts || {}).map(d => [d[0] || "", d[1] || ""]);
    // }

    // else if (this.item.type == "equipment") {
    //   if (this.item.system.subType == "armor") {
    //     // const armor = formData.system?.armor;
    //     // if (armor)
    //     //   //options.parts = Object.values(options?.parts || {}).map(d => [d[0] || "", d[1] || ""]);
    //     //   console.log(armor.options);
    //     //   armor.options = Object.values(armor?.options || {})
    //     //     .map(d => [d.name || "", d.description || ""]);
    //     //     console.log(armor.options);
    //   } else if (this.item.system.subType == "computer") {
    //     const computer = formData.system?.computer;
    //     if (computer)
    //       //options.parts = Object.values(options?.parts || {}).map(d => [d[0] || "", d[1] || ""]);
    //       computer.options = Object.values(computer?.options || {}).map(d => [d[0] || "", d[1] || ""]);
    //   }
    // }

    if (formData.hasOwnProperty("weight")) {
      formData.system.weight = MGT2Helper.convertWeightFromInput(formData.weight);
      delete formData.weight;
    }

    if (formData.system.hasOwnProperty("quantity")) {
      formData.system.quantity = MGT2Helper.getIntegerFromInput(formData.system.quantity);
    }

    if (formData.system.hasOwnProperty("cost")) {
      formData.system.cost = MGT2Helper.getIntegerFromInput(formData.system.cost);
    }
    //console.log("before flatten");
    //console.log(formData);
    //console.log("after flatten");
    //    let x = foundry.utils.flattenObject(formData);;
    //    console.log(x);
    //    return x;
    return foundry.utils.flattenObject(formData);
  }
}
