import {
  AmmunitionData,
  ItemData,
  CargoData,
  ComponentData,
  ContractData,
  DrugData,
  EquipmentData,
  DiseaseData,
  CareerData,
  PassageData,
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
import { CHECK, CheckMessageData } from "./chat-message.js";
import { Chargen } from "./chargen.js";
import { ChargenClose, Package } from "./chargen-close.js";
import { Grants } from "./chargen-grants.js";
import { Muster } from "./chargen-muster.js";
import { Psionics } from "./chargen-psionics.js";
import { CreationOptions, CreationRoll } from "./chargen-rolls.js";
import { ChargenScreen, registerChargenScreen } from "./chargen-screen.js";
import { ChargenTerm } from "./chargen-term.js";
import { Checks } from "./checks.js";
import { CrewCombatantData, MGT2Combatant, PersonCombatantData, registerCombatantContextOptions } from "./combatant.js";
import { MGT2Combat, MGT2CombatantGroup, MISSILE_SALVO, MissileSalvoData, SHIP, ShipGroupData, SPACE, SpaceCombatData } from "./combat.js";
import { FLEET, FLEET_SHIP, FleetCombatData, FleetGroupData, FleetShipData, SALVO, SQUADRON, SalvoData, SquadronData } from "./fleet.js";
import { FleetAttack, fleetBatteries, fleetWeaponRow, fleetWeaponRows } from "./fleet-attack.js";
import { registerSpaceCombatScreen } from "./combat-screen.js";
import { FleetCombatScreen, registerFleetCombatScreen } from "./fleet-screen.js";
import { CompendiumExplorer, registerCompendiumExplorer } from "./compendium-explorer.js";
import { registerStopTraffic, StopTrafficDialog } from "./stop-traffic.js";
import { registerSpecTrade, SpecTradeDialog } from "./trade.js";
import { CreditSplit, registerCreditSplit } from "./credit-split.js";
import { registerVoyageScreen } from "./voyage-screen.js";
import { registerTrainingScreen, TrainingScreen } from "./training-screen.js";
import {
  postRequest,
  registerRequestControls,
  registerRequestHooks,
  REQUEST,
  RequestMessageData
} from "./request.js";
import { answerRequest, registerRequestAnswer } from "./request-answer.js";
import { parseRequest, registerRequestEnricher } from "./request-enricher.js";
import { Docket } from "./docket.js";
import { registerActiveEffects } from "./effects.js";
import { registerSpaceCanvas } from "./space-canvas.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";
import { TravellerActor } from "./actors/actor.js";
import { CharacterData } from "./actors/character-data.js";
import { NpcData } from "./actors/npc-data.js";
import { VehicleData } from "./actors/vehicle-data.js";
import { SpacecraftData } from "./actors/spacecraft-data.js";
import { RobotData } from "./actors/robot-data.js";
import { StashData } from "./actors/stash-data.js";
import { WorldData } from "./actors/world-data.js";
import {
  GravityBehaviorData,
  RadiationBehaviorData,
  TemperatureBehaviorData,
  VacuumBehaviorData
} from "./region-behaviors.js";
import { TravellerItem } from "./item.js";
import { MGT2ItemDirectory } from "./item-directory.js";
import { TravellerItemSheet } from "./item-sheet.js";
import { NpcActorSheet, TravellerActorSheet } from "./actors/character-sheet.js";
import { VehicleActorSheet } from "./actors/vehicle-sheet.js";
import { SpacecraftActorSheet } from "./actors/spacecraft-sheet.js";
import { RobotActorSheet } from "./actors/robot-sheet.js";
import { WorldActorSheet } from "./actors/world-sheet.js";
import { StashActorSheet } from "./actors/stash-sheet.js";
import { preloadHandlebarsTemplates } from "./templates.js";
import {ChatHelper} from "./chatHelper.js";
import { migrateWorld } from "./migration.js";

import { applyPalette, groundWindow, migrateDarkPreset, migrateLegacyTheme, registerSettings,
  wirePalettePickers } from "./settings.js";
import { applyGuideButton } from "./guide.js";

function registerHandlebarsHelpers() {
  Handlebars.registerHelper('showDM', dm => MGT2Helper.signed(dm));
  Handlebars.registerHelper('showFormula', text => MGT2Helper.showFormula(text));
  Handlebars.registerHelper('credits', value => MGT2Helper.credits(value));
  // What an optional rule is set to.
  Handlebars.registerHelper('rule', key => Rules.get(key));
  // A printed table's rows are numbered from 1 and stored from 0, and a career template draws six
  // of them.
  Handlebars.registerHelper('inc', index => Number(index) + 1);
  // `{{plural 'KEY' count hash=...}}` — the count is positional and also fills `{n}`.
  Handlebars.registerHelper('plural', (key, count, options) =>
    MGT2Helper.plural(key, Number(count), options.hash));
}

/** The Item types a sheet offers a roll for. */
const ROLLABLE_ITEMS = new Set(["armor", "computer", "disease", "talent", "weapon"]);

/** Roll an Item from outside any sheet — a hotbar slot, a macro, a module. */
async function rollItem(uuid) {
  const item = await fromUuid(uuid);
  const actor = item?.actor;
  if ( !actor ) {
    return ui.notifications.warn(
      game.i18n.localize("MGT2.Errors.CouldNotFindItem").replace("_ITEM_ID_", uuid));
  }
  // A skill is the prompt's own skill row; a psionic talent brings the reach and PSI strips with it.
  if ( item.type === "talent" ) {
    return (item.system.subType === "psionic")
      ? TravellerActorSheet.roll(actor, { roll: "psionic", itemId: item.id })
      : TravellerActorSheet.roll(actor, { roll: "skill", skill: item.id });
  }
  return TravellerActorSheet.roll(actor, { itemId: item.id });
}

/** Dragging a skill or a weapon onto the hotbar rolls it. */
function registerHotbarRolls() {
  Hooks.on("hotbarDrop", (hotbar, data, slot) => {
    if ( data?.type !== "Item" ) return;
    // The hook is synchronous, so the decision has to be.
    const item = foundry.utils.fromUuidSync(data.uuid, { strict: false });
    if ( !item?.actor || !ROLLABLE_ITEMS.has(item.type) ) return;
    if ( !hotbar.locked ) createRollMacro(item, slot, data.slot);
    return false;
  });
}

/** One macro per Item: dropping the same weapon on a second slot must not clone it. */
async function createRollMacro(item, slot, fromSlot) {
  const command = `game.mgt2.rollItem("${item.uuid}");`;
  const macro = game.macros.find(m => (m.name === item.name) && (m.command === command))
    ?? await getDocumentClass("Macro").create({
      name: item.name,
      type: CONST.MACRO_TYPES.SCRIPT,
      img: item.img,
      command
    });
  if ( macro ) return game.user.assignHotbarMacro(macro, slot, { fromSlot });
}

Hooks.once("init", async function () {
  CONFIG.MGT2 = MGT2;
  // The formula is the SHIP's (Core p.165: 2D + Pilot + Thrust).
  CONFIG.Combat.initiative = {
    formula: "2d6 + @initiative",
    decimals: 2
  };
  CONFIG.Combatant.documentClass = MGT2Combatant;
  CONFIG.Combatant.dataModels = {
    person: PersonCombatantData, crew: CrewCombatantData,
    // Neither salvo carries an Actor: a flight of missiles is a contact with a target and an age,
    // and has no hull and no business in the compendium (Core folio 172, HG folio 124).
    [MISSILE_SALVO]: MissileSalvoData,
    [FLEET_SHIP]: FleetShipData, [SQUADRON]: SquadronData, [SALVO]: SalvoData
  };
  // A space combat is three documents, because a range band is a property of a PAIR of ships and no
  // Actor and no Item can hold a pair.
  CONFIG.Combat.documentClass = MGT2Combat;
  CONFIG.Combat.dataModels = { [SPACE]: SpaceCombatData, [FLEET]: FleetCombatData };
  CONFIG.CombatantGroup.documentClass = MGT2CombatantGroup;
  CONFIG.CombatantGroup.dataModels = { [SHIP]: ShipGroupData, [FLEET]: FleetGroupData };
  // `TypeDataField#getModelForType` reads `dataModels[type]` with the literal type string, so this
  // key must be whatever `system.json`'s `documentTypes` produced — key it wrong and the document
  // is created with the right type and an empty `system`, silently.
  CONFIG.ChatMessage.dataModels = { [CHECK]: CheckMessageData, [REQUEST]: RequestMessageData };

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
        "characteristics.other",
        "characteristics.reputation"
      ],
      // `life.value` is derived: a value-attribute write to it is discarded on the next prepare.
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
        "characteristics.other.value",
        "characteristics.reputation.value"]
    },
    // A non-empty map with no entry for a type unions every OTHER type's attributes
    // (token.mjs:4071-4093), so a missing entry is not a fallback — it is nonsense in the picker.
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
        "characteristics.other",
        "characteristics.reputation"
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
        "characteristics.other.value",
        "characteristics.reputation.value"]
    },
    // `life` and `characteristics.hull` are the same pool named twice; both are offered because the
    // picker prints the raw path and a referee looking for a hull bar looks for "hull".
    vehicle: {
      bar: ["life", "characteristics.hull"],
      value: ["hullSeverity", "characteristics.hull.value"]
    },
    // `power.available` and `computer.processing` are the two ratings a referee genuinely tracks in
    // play beside the hull, and both are plain numbers rather than a pool.
    spacecraft: {
      bar: ["life", "characteristics.hull"],
      value: ["ops.fuel", "hullSeverity", "characteristics.hull.value", "power.surplus",
        "fuel.tons"]
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
    // Neither has a pool, and an EMPTY entry is not the same as no entry: a missing key fires the
    // union branch and offers every other type's bars as raw dotted paths, whereas `isEmpty({bar:
    // [], value: []})` is false and the picker stays honest.
    world: { bar: [], value: [] },
    stash: { bar: [], value: [] }
  };

  // Never auto-filled — `typeLabels` is, from TYPES.Actor.*, but without this the sidebar and every
  // content link fall back to the generic Actor icon.
  CONFIG.Actor.typeIcons = {
    character: "fa-solid fa-user",
    npc: "fa-solid fa-users",
    vehicle: "fa-solid fa-car-side",
    spacecraft: "fa-solid fa-rocket-launch",
    robot: "fa-solid fa-robot",
    world: "fa-solid fa-globe",
    stash: "fa-solid fa-box-archive"
  };

  // Six chapters of "while you are here, this happens to you" — with a schema and no events map,
  // because Foundry has no clock and the system declined to invent one.
  Object.assign(CONFIG.RegionBehavior.dataModels, {
    "gravity": GravityBehaviorData,
    "temperature": TemperatureBehaviorData,
    "vacuum": VacuumBehaviorData,
    "radiation": RadiationBehaviorData
  });

  game.mgt2 = {
    TravellerActor,
    TravellerItem,
    // The roll a macro can make.
    Checks,
    roll: TravellerActorSheet.roll,
    rollItem,
    // A subsector is 8x10 hexes and `packs` is empty, so parsing the printed line is what makes the
    // `world` type usable before a sheet exists.
    parseUwp: WorldData.parseUwp,
    formatUwp: WorldData.formatUwp,
    stopTraffic: StopTrafficDialog.open,
    specTrade: SpecTradeDialog.open,
    // The referee's transfer screen, and the only thing in this system that writes purses on
    // demand.
    creditSplit: CreditSplit.open,
    explorer: CompendiumExplorer.open,
    // The GM's roll-request compose window, and the three doors onto it: the chat-log control, the
    // tracker's *Ask for Initiative* preset and *Ask the same* on any check card.
    docket: Docket.open,
    // The request card's own two sides: what posts a demand, and what answers one line of it
    // through the seeded prompt. `parse` reads `@Request[…]` into the payload `docket` takes.
    request: { post: postRequest, answer: answerRequest, parse: parseRequest },
    // The training window, and the door the sheet strip uses: it takes the programme the clicked
    // row names, so a Grant button pressed on one row cannot open the window on another.
    trainingScreen: TrainingScreen.open,
    // The creation ledger's read side: `flags.mgt2.chargen` is a convention rather than a schema,
    // so the helper that reads the roster off it is the only place that convention is stated
    //.
    chargen: Chargen,
    // The grid of Travellers x terms that reads it. One window, no session document behind it.
    chargenScreen: ChargenScreen.open,
    // The term loop, driven from the step strip and reachable here for a macro: `run(actor)` plays
    // the step the frame's own sequence says is next.
    chargenTerm: ChargenTerm,
    // The closing screen: mustering out for the whole roster, the one ship between the table,
    // the shared skills package, and the teardown that ends creation.
    chargenClose: ChargenClose.open,
    // Mustering out and the two rules layers around it.
    muster: Muster,
    package: Package,
    grants: Grants,
    psionics: Psionics,
    creationRoll: CreationRoll,
    creationOptions: CreationOptions,
    // HG folios 116-121's attack path, which is the half of the chapter that does not roll.
    fleetAttack: FleetAttack,
    fleetScreen: FleetCombatScreen,
    fleetWeaponRow,
    fleetWeaponRows,
    fleetBatteries
  };

  registerHandlebarsHelpers();
  registerSettings();
  applyPalette();
  // A class written only on change is missing on the first load of a client who switched it off in
  // an earlier session.
  applyGuideButton();
  migrateLegacyTheme();
  migrateDarkPreset();

  CONFIG.Actor.documentClass = TravellerActor;
  CONFIG.Item.documentClass = TravellerItem;
  CONFIG.ui.items = MGT2ItemDirectory;
  // The document class, the statuses and the config sheet; `CONFIG.ActiveEffect.dataModels.base` is
  // left alone, because core already declares `changes` there.
  registerActiveEffects();
  registerCombatantContextOptions();
  // The token ruler, which reads the range band off a scene flagged for space.
  registerSpaceCanvas();
  // The screen is opened from the tracker's two context menus, and the drag watcher is what lets a
  // drop zone refuse at the pointer — `dataTransfer` is unreadable for the whole of `dragover`.
  registerSpaceCombatScreen();
  // HG folio 115's second engine on the same document family.
  registerFleetCombatScreen();
  // Core p.238 hands the trade chapter to the Travellers, so the tool is not GM-gated.
  registerStopTraffic();
  registerSpecTrade();
  // Beside them and unlike them, GM-gated: those hand a chapter to the Travellers, this one moves
  // other people's purses.
  registerCreditSplit();
  registerVoyageScreen();
  // Two doors onto the training window, on the voyage screen's model: the Traveller's own sheet and
  // the Actor directory.
  registerTrainingScreen();
  // Three doors onto the creation grid: a Traveller's own sheet, the Actor directory's context menu
  // and its header, because resuming a session three hours in is opening the window with nobody
  // selected.
  registerChargenScreen();
  // The two index fields, and the button on the compendium tab.
  registerCompendiumExplorer();
  // The request card is a LIVE reading of the chat log, so it re-renders when a different message
  // arrives — which nothing in core does.
  registerRequestHooks();
  registerRequestControls();
  // The fourth door, and the only one that is not a control: `@Request[…]` inside an adventure's
  // text, as a link the reader may roll and a bubble a referee sends.
  registerRequestEnricher();
  // The answering half: the seeded prompt behind every DM chit, and the `mgt2.nudge` query — the
  // only wire traffic this feature has, and one nothing depends on.
  registerRequestAnswer();
  registerHotbarRolls();
  MGT2Helper.watchDrags();

  // Foundry v14 registers no default Actor/Item sheet, so there is nothing to unregister.
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
  DocumentSheetConfig.registerSheet(Actor, "mgt2", WorldActorSheet, {
    types: ["world"],
    makeDefault: true,
    label: "World Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, "mgt2", StashActorSheet, {
    types: ["stash"],
    makeDefault: true,
    label: "Stash Sheet"
  });
  DocumentSheetConfig.registerSheet(Item, "mgt2", TravellerItemSheet, {
    makeDefault: true
  });

  // `TypeDataField#getModelForType` reads `dataModels[type]`: a missing entry is not a fallback, it
  // is a document created with the right type and an unvalidated plain `system`, silently.
  Object.assign(CONFIG.Actor.dataModels, {
    "character": CharacterData,
    "npc": NpcData,
    "vehicle": VehicleData,
    "spacecraft": SpacecraftData,
    "robot": RobotData,
    "world": WorldData,
    "stash": StashData
  });

  Object.assign(CONFIG.Item.dataModels, {
    "item": ItemData,
    "equipment": EquipmentData,
    "disease": DiseaseData,
    "career": CareerData,
    "talent": TalentData,
    "contact": ContactData,
    "contract": ContractData,
    "weapon": WeaponData,
    "computer": ComputerData,
    "armor": ArmorData,
    "container": ItemContainerData,
    "role": RoleData,
    "species": SpeciesData,
    "cargo": CargoData,
    "passage": PassageData,
    "component": ComponentData,
    "drug": DrugData,
    "ammunition": AmmunitionData
  });


  Hooks.on("renderSettingsConfig", wirePalettePickers);
  Hooks.on("renderApplicationV2", (app, element) => groundWindow(element));

  Hooks.on("renderChatMessageHTML", (message, html, messageData) => {
    ChatHelper.setupCardListeners(message, html, messageData);
    // Core p.158's revival check is the ship's card, so the ship's sheet resolves it.
    html.querySelector('button[data-action="revival"]')
      ?.addEventListener("click", () => SpacecraftActorSheet.rollRevival(message));
  });

  // Preload template partials
  await preloadHandlebarsTemplates();
});

export { MGT2 };

Hooks.once("ready", () => migrateWorld());
