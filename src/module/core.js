import {
  CharacterData,
  ItemData,
  EquipmentData,
  DiseaseData,
  CareerData,
  TalentData,
  ContactData,
  ArmorData,
  ComputerData,
  WeaponData,
  ItemContainerData,
  SpeciesData
} from "./datamodels.js";

import { MGT2 } from "./config.js";
import { TravellerActor, MGT2Combatant } from "./actors/actor.js";
import { TravellerItem } from "./item.js";
import { TravellerItemSheet } from "./item-sheet.js";
import { TravellerActorSheet } from "./actors/character-sheet.js";
import { preloadHandlebarsTemplates } from "./templates.js";
//import { MGT2Helper } from "./helper.js";
import {ChatHelper} from "./chatHelper.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
import { registerSettings } from "./settings.js";

function registerHandlebarsHelpers() {
  Handlebars.registerHelper('showDM', function (dm) {
    if (dm === 0) return "0";
    if (dm > 0) return `+${dm}`;
    if (dm < 0) return `${dm}`;
    return "";
  });
}

Hooks.once("init", async function () {
  CONFIG.MGT2 = MGT2;
  CONFIG.Combat.initiative = {
    formula: "2d6 + @initiative",
    decimals: 2
  };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["life",
        "characteristics.strength",
        "characteristics.dexterity",
        "characteristics.endurance",
        "characteristics.intellect",
        "characteristics.education",
        "characteristics.social",
        "characteristics.morale",
        "characteristics.luck",
        "characteristics.sanity",
        "characteristics.charm",
        "characteristics.psionic",
        "characteristics.other"
      ],
      value: ["life.value",
      "health.radiations",
        "characteristics.strength.value",
        "characteristics.dexterity.value",
        "characteristics.endurance.value",
        "characteristics.intellect.value",
        "characteristics.education.value",
        "characteristics.social.value",
        "characteristics.morale.value",
        "characteristics.luck.value",
        "characteristics.sanity.value",
        "characteristics.charm.value",
        "characteristics.psionic.value",
        "characteristics.other.value"]
    }
  };

  game.mgt2 = {
    TravellerActor,
    TravellerItem
  };

  registerHandlebarsHelpers();
  registerSettings();

  CONFIG.Combatant.documentClass = MGT2Combatant;
  CONFIG.Actor.documentClass = TravellerActor;
  CONFIG.Item.documentClass = TravellerItem;

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("mgt2", TravellerActorSheet, { types: ["character"], makeDefault: true, label: "Traveller Sheet" });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("mgt2", TravellerItemSheet, { makeDefault: true });

  Object.assign(CONFIG.Actor.dataModels, {
    "character": CharacterData
  });

  Object.assign(CONFIG.Item.dataModels, {
    "item": ItemData,
    "equipment": EquipmentData,
    "disease": DiseaseData,
    "career": CareerData,
    "talent": TalentData,
    "contact": ContactData,
    "weapon": WeaponData,
    "computer": ComputerData,
    "armor": ArmorData,
    "container": ItemContainerData,
    "species": SpeciesData
  });


  Hooks.on("renderChatMessage", (message, html, messageData) => {
    ChatHelper.setupCardListeners(message, html, messageData);
  });

  // Preload template partials
  await preloadHandlebarsTemplates();
});

export { MGT2 };