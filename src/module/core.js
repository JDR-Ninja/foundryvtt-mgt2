import {
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
  RoleData,
  SpeciesData
} from "./datamodels.js";

import { MGT2 } from "./config.js";
import { registerActiveEffects } from "./effects.js";
import { MGT2Helper } from "./helper.js";
import { TravellerActor } from "./actors/actor.js";
import { CharacterData } from "./actors/character-data.js";
import { NpcData } from "./actors/npc-data.js";
import { VehicleData } from "./actors/vehicle-data.js";
import { SpacecraftData } from "./actors/spacecraft-data.js";
import { RobotData } from "./actors/robot-data.js";
import { TravellerItem } from "./item.js";
import { TravellerItemSheet } from "./item-sheet.js";
import { NpcActorSheet, TravellerActorSheet } from "./actors/character-sheet.js";
import { VehicleActorSheet } from "./actors/vehicle-sheet.js";
import { SpacecraftActorSheet } from "./actors/spacecraft-sheet.js";
import { RobotActorSheet } from "./actors/robot-sheet.js";
import { preloadHandlebarsTemplates } from "./templates.js";
import {ChatHelper} from "./chatHelper.js";
import { migrateWorld } from "./migration.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
import { applyTheme, registerSettings } from "./settings.js";

function registerHandlebarsHelpers() {
  Handlebars.registerHelper('showDM', dm => MGT2Helper.signed(dm));
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
      // `life.value` is derived: a value-attribute write to it is discarded on the next prepare.
      // The `life` bar above covers the useful case and routes through applyDamage.
      value: ["health.radiations",
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
    },
    // A non-empty map with no entry for a type unions every OTHER type's attributes
    // (token.mjs:4071-4093), so a missing entry is not a fallback — it is nonsense in the picker.
    // `group.count` is here because a herd token's bar reading "7 of 12 left" is the one number a
    // shared Hits bar cannot give.
    npc: {
      bar: ["life",
        "group.count",
        "characteristics.hits",
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
      value: ["stun",
        "characteristics.hits.value",
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
    },
    // `life` and `characteristics.hull` are the same pool named twice; both are offered because the
    // picker prints the raw path and a referee looking for a hull bar looks for "hull".
    vehicle: {
      bar: ["life", "characteristics.hull"],
      value: ["hullSeverity", "characteristics.hull.value"]
    },
    // `power.available` and `computer.processing` are the two ratings a referee genuinely tracks
    // in play beside the hull, and both are plain numbers rather than a pool.
    spacecraft: {
      bar: ["life", "characteristics.hull"],
      value: ["hullSeverity", "characteristics.hull.value", "power.surplus", "fuel.tons"]
    },
    // The six canonical characteristics are declared on every robot and only revealed by
    // `traveller.enabled`, so they are offered as bars here whether or not the flag is set: the
    // picker is the referee's, and a robot PC would otherwise have no bar for its own STR.
    robot: {
      bar: ["life",
        "characteristics.hits",
        "characteristics.strength",
        "characteristics.dexterity",
        "characteristics.endurance",
        "characteristics.intellect",
        "characteristics.education",
        "characteristics.social"
      ],
      // The last two are derived and undeclared, so the picker offers them as read-only readouts:
      // spare Slots and Bandwidth spent are what a referee watches while a robot is being built.
      value: ["stun", "characteristics.hits.value", "slots.spare", "brain.bandwidth.used"]
    },
    // Declared in the manifest, unregistered and inert: its `system` is an unvalidated plain object
    // with no schema, so it has nothing to track. The entry exists only because a MISSING one is not
    // a fallback — it unions every other type's attributes onto this type's tokens.
    vehicule: { bar: [], value: [] }
  };

  // Never auto-filled — `typeLabels` is, from TYPES.Actor.*, but without this the sidebar and every
  // content link fall back to the generic Actor icon.
  CONFIG.Actor.typeIcons = {
    character: "fa-solid fa-user",
    npc: "fa-solid fa-users",
    vehicle: "fa-solid fa-car-side",
    vehicule: "fa-solid fa-car-side",
    spacecraft: "fa-solid fa-rocket-launch",
    robot: "fa-solid fa-robot"
  };

  game.mgt2 = {
    TravellerActor,
    TravellerItem
  };

  registerHandlebarsHelpers();
  registerSettings();
  applyTheme();

  CONFIG.Actor.documentClass = TravellerActor;
  CONFIG.Item.documentClass = TravellerItem;
  // The document class, the statuses and the config sheet; `CONFIG.ActiveEffect.dataModels.base`
  // is left alone, because core already declares `changes` there.
  registerActiveEffects();

  // Foundry v14 registers no default Actor/Item sheet, so there is nothing to unregister.
  // Omitting `themes` leaves the light/dark choice in place: the sheets follow the viewer.
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(Actor, "mgt2", TravellerActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "Traveller Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, "mgt2", NpcActorSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "NPC Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, "mgt2", VehicleActorSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "Vehicle Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, "mgt2", SpacecraftActorSheet, {
    types: ["spacecraft"],
    makeDefault: true,
    label: "Spacecraft Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, "mgt2", RobotActorSheet, {
    types: ["robot"],
    makeDefault: true,
    label: "Robot Sheet"
  });
  DocumentSheetConfig.registerSheet(Item, "mgt2", TravellerItemSheet, {
    makeDefault: true
  });

  // `vehicule` is deliberately absent: it stays declared in the manifest and unregistered, so an
  // existing actor keeps loading with the same empty `system` it has now. The rename is §9.11's
  // other half and needs a migration.
  Object.assign(CONFIG.Actor.dataModels, {
    "character": CharacterData,
    "npc": NpcData,
    "vehicle": VehicleData,
    "spacecraft": SpacecraftData,
    "robot": RobotData
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
    "role": RoleData,
    "species": SpeciesData
  });


  Hooks.on("renderChatMessageHTML", (message, html, messageData) => {
    ChatHelper.setupCardListeners(message, html, messageData);
  });

  // Preload template partials
  await preloadHandlebarsTemplates();
});

export { MGT2 };

Hooks.once("ready", () => migrateWorld());
