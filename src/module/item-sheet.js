import { MGT2 } from "./config.js";
import { Chargen } from "./chargen.js";
import { Contract } from "./contract.js";
import { Doses } from "./doses.js";
import { EFFECT_ACTIONS, prepareEffects } from "./effects.js";
import { MGT2Helper } from "./helper.js";
import { copyItemWithContents, fitsWeapon, isAccessory, secondaryRefused } from "./item.js";
import { Magazines } from "./magazines.js";
import { RollPromptHelper } from "./roll-prompt.js";
import { Rules } from "./rules.js";
import { GuideButtonMixin } from "./guide.js";
import { SheetModeMixin } from "./sheet-mode.js";
import { CUSTOM_KEY, appendTraitText, bindTraitInput, formatTrait, prepareTraitBlock, refreshTraitNumbers, traitLabel }
  from "./traits.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Every block the sheet can compose from; each one is a partial of the same name. */
const BLOCKS = ["roll", "hazard", "summary", "specs", "augment", "hosts", "carried", "traits", "rules", "relationship", "description",
  "detail", "notes", "software", "contents", "fitted", "trade", "terms", "actions", "effects",
  "career", "careertables", "careerevents", "species", "speciesframe",
  "bounty", "referee", "leads", "associates", "generate"];

const blockPath = id => `systems/mgt2/templates/items/blocks/${id}.html`;

/** Which tab holds each block. */
const SLOT = {
  roll: "masthead", hazard: "masthead",
  specs: "details", relationship: "details", career: "details", actions: "details",
  species: "details", summary: "details", augment: "details",
  // On a round the printed rules are what it does, so they sit under its plates.
  rules: "details", hosts: "details", trade: "details",
  traits: "traits",
  contents: "contents", software: "contents", fitted: "contents",
  carried: "contents", speciesframe: "contents",
  careertables: "tables", careerevents: "events", terms: "terms",
  effects: "effects",
  description: "description", detail: "description", notes: "description",
  // Bounty Hunter p.18-19's two portions, and the party's copy of what has been shown.
  bounty: "contract", referee: "referee", leads: "leads", associates: "associates",
  generate: "generate"
};

for ( const id of BLOCKS ) {
  if ( !(id in SLOT) ) throw new Error(`MGT2 | the item sheet block "${id}" has no tab slot.`);
}

/**
 * `CareerData` is two schemas in one Item and `isTemplate` is which — the Item having no Actor
 * parent, read and never stored.
 */
const TEMPLATE_ONLY = new Set(["career", "careertables", "careerevents"]);
const RECORD_ONLY = new Set(["terms"]);

/**
 * Bounty Hunter p.19's rows and p.22's generator are the referee's; the party gets `leads`, which
 * draws only the rows already shown. The referee tab is not thinned for a player — it is not built.
 */
const GM_ONLY = new Set(["referee", "generate"]);
const PLAYER_ONLY = new Set(["leads"]);

/** Blocks whose heading only repeats the nav entry above it, so alone in a tab they drop it. */
const EPONYMOUS = new Set(["effects", "description", "contents", "fitted"]);

/** Blocks drawn without a heading, which the bare rule does not count: a container's strip. */
const HEADLESS = new Set(["carried"]);

/**
 * Every array of NON-BLANK strings a sheet draws, and the reason they are listed together: the
 * element is `blank: false`, so an appended empty string cleans away, the diff comes out empty and
 * no update fires — adding a track rung silently did nothing.
 */
const STRING_LISTS = ["rules", "qualificationOverride.exceptCareers"];

/** The same convention one level down, where the list is a track's rungs inside an indexed track. */
const TRACK_LISTS = ["tracks", "frame.tracks"];

/** And again, where it is the skills a standing modifier reads its DM off. */
const STANDING_LISTS = ["standingModifiers", "frame.standingModifiers"];

/** A submitted list arrives keyed by index, so it is an object here and an array afterwards. */
const compact = list => Object.values(list ?? {}).filter(entry => entry?.trim());

/** The lists a career form types as one comma-separated line, wherever they sit in the tree. */
const TYPED_LISTS = new Set(["specialities", "afterCareers", "termDMs", "skills", "except"]);

function splitTypedLists(node) {
  if ( !node || (typeof node !== "object") ) return;
  for ( const [key, value] of Object.entries(node) ) {
    if ( TYPED_LISTS.has(key) && (typeof value === "string") ) {
      node[key] = value.split(",").map(entry => entry.trim()).filter(entry => entry);
    }
    else splitTypedLists(value);
  }
}

/**
 * A declared step's check as the book prints it — `Patriarchy 4+`, `Caste 2+`, `Patriarchy, by SOC`
 * — or nothing at all where the frame declares no check.
 * @returns {string}
 */
function stepCheckSummary(check, key) {
  // On a Core step the loop reads one thing, the characteristic a career's own roll is made on.
  if ( MGT2.CoreTermSequence.includes(key) ) {
    return (["survival", "commission", "advance"].includes(key) && check.characteristic)
      ? game.i18n.format("MGT2.Chargen.Frame.CoreCheck",
        { characteristic: game.i18n.localize(MGT2.Characteristics[check.characteristic]) }) : "";
  }
  const named = check.skills.length ? check.skills.join(" / ")
    : (check.characteristic ? game.i18n.localize(MGT2.Characteristics[check.characteristic]) : "");
  if ( !named ) return "";
  let target = "";
  if ( check.kind === "index" ) target = game.i18n.localize(MGT2.CreationCheckKinds.index);
  else if ( check.index ) {
    target = game.i18n.format("MGT2.Chargen.Frame.CheckLadder",
      { index: game.i18n.localize(MGT2.StepCheckIndices[check.index]) });
  }
  else if ( check.target !== null ) target = game.i18n.format("MGT2.Chargen.Term.Target", { n: check.target });
  return [named, target].filter(part => part).join(" ");
}

/** The tone each recurring-character reading takes on the contact sheet's pills; blank is neutral. */
const CONTACT_TONES = {
  relation: { Allie: "good", Rival: "warn", Enemy: "danger", Patron: "accent" },
  attitude: { Unknow: "faint", Hostile: "danger", Unfriendly: "warn", Friendly: "good", Helpful: "good",
    Complicated: "warn" },
  status: { Alive: "good", Unknow: "faint", Dead: "danger" }
};

/** A ship component's rating under its own name, where its category gives it one; every other reads Rating. */
const RATING_LABELS = Object.freeze({
  mDrive: "MGT2.Actor.spacecraft.Thrust", rDrive: "MGT2.Actor.spacecraft.Thrust", jDrive: "MGT2.Actor.spacecraft.Jump",
  computer: "MGT2.Actor.spacecraft.Processing", armour: "MGT2.Actor.spacecraft.Armour",
  automation: "MGT2.ComponentCategories.automation"
});

/** Past this many points a magazine or a Processing rating is drawn as a bar rather than counted. */
const MAX_CELLS = 30;

/** One cell per point, filled up to `value`; null where there are too many to count. */
const cells = (value, of) => ((of > 0) && (of <= MAX_CELLS))
  ? Array.from({ length: of }, (_v, index) => index < value) : null;

/** The sub-type dictionary that names each type, where it has one. */
const SUBTYPES = {
  item: MGT2.ItemSubType,
  equipment: MGT2.EquipmentSubType,
  talent: MGT2.TalentSubType,
  disease: MGT2.DiseaseSubType
};

/** The Traveller item sheet, shared by all item sub-types. @extends {ItemSheetV2} */
export class TravellerItemSheet extends GuideButtonMixin(SheetModeMixin(HandlebarsApplicationMixin(ItemSheetV2))) {

  /** @inheritDoc */
  static GUIDE_TOPIC = "item";

  /** One page serves every Item type, and the type is its own heading on it. @inheritDoc */
  get guideAnchor() {
    return this.item.type;
  }

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
      entryCreate: TravellerItemSheet.#onEntryCreate,
      entryDelete: TravellerItemSheet.#onEntryDelete,
      stepsDeclare: TravellerItemSheet.#onStepsDeclare,
      stepsDefault: TravellerItemSheet.#onStepsDefault,
      tradeDMCreate: TravellerItemSheet.#onTradeDMCreate,
      tradeDMDelete: TravellerItemSheet.#onTradeDMDelete,
      ruleDelete: TravellerItemSheet.#onRuleDelete,
      itemRoll: TravellerItemSheet.#onItemRoll,
      reload: TravellerItemSheet.#onReload,
      doseTake: TravellerItemSheet.#onDoseTake,
      doseCountReset: TravellerItemSheet.#onDoseCountReset,
      nestedEdit: TravellerItemSheet.#onNestedEdit,
      rowFold: TravellerItemSheet.#onRowFold,
      cellFold: TravellerItemSheet.#onCellFold,
      nestedRemove: TravellerItemSheet.#onNestedRemove,
      nestedDelete: TravellerItemSheet.#onNestedDelete,
      fittedDeploy: TravellerItemSheet.#onFittedDeploy,
      openReference: TravellerItemSheet.#onOpenReference,
      contactUnlink: TravellerItemSheet.#onContactUnlink,
      contractHandover: TravellerItemSheet.#onContractHandover,
      contractShow: TravellerItemSheet.#onContractShow,
      contractNegotiate: TravellerItemSheet.#onContractNegotiate,
      contractQualify: TravellerItemSheet.#onContractQualify,
      contractRepChange: TravellerItemSheet.#onContractRepChange,
      contractGenerate: TravellerItemSheet.#onContractGenerate,
      ...EFFECT_ACTIONS
    }
  };

  /** The last run of the eight draws, kept for this window only — a log, not a stored record. */
  #drawLog = null;

  /** One root part, unwrapped into `.window-content`. @inheritDoc */
  static PARTS = {
    sheet: {
      root: true,
      template: "systems/mgt2/templates/items/item-sheet.html",
      templates: BLOCKS.map(blockPath).concat("systems/mgt2/templates/actors/parts/tabs-nav.html",
        // A printed cell is the same editor in six places on a career template.
        "systems/mgt2/templates/items/parts/career-cell.html",
        "systems/mgt2/templates/items/parts/string-list.html",
        "systems/mgt2/templates/items/parts/track-definition.html",
        "systems/mgt2/templates/items/parts/standing-modifier.html",
        "systems/mgt2/templates/items/parts/step-outcome.html",
        "systems/mgt2/templates/items/parts/tray-row.html",
        "systems/mgt2/templates/items/parts/mark.html",
        "systems/mgt2/templates/items/parts/description-fields.html",
        "systems/mgt2/templates/items/parts/education-picks.html",
        "systems/mgt2/templates/items/parts/education-arm.html",
        "systems/mgt2/templates/items/parts/law-selectors.html",
        "systems/mgt2/templates/items/parts/specialised.html",
        // One reference shape, drawn four times on a contract.
        "systems/mgt2/templates/items/parts/person-ref.html"),
      // The masthead never scrolls, so the open tab is the only scroller.
      scrollable: ['.tab[data-group="item"].active']
    }
  };

  /** Every tab any type can fill, in nav order; `_getTabsConfig` keeps the ones with blocks in them. */
  static TABS = {
    item: {
      tabs: [
        { id: "contract", cssClass: "item tab-select", icon: "fa-solid fa-file-signature", label: "MGT2.Contract.Tab" },
        { id: "details", cssClass: "item tab-select", icon: "fa-solid fa-gear", label: "MGT2.Items.Details" },
        // Two tabs the player is not meant to read yet, drawn in the danger hue in both states.
        { id: "referee", cssClass: "item tab-select gmtab", icon: "fa-solid fa-lock", label: "MGT2.Contract.RefereeTab" },
        { id: "leads", cssClass: "item tab-select", icon: "fa-solid fa-eye", label: "MGT2.Contract.LeadsTab" },
        { id: "associates", cssClass: "item tab-select", icon: "fa-solid fa-users", label: "MGT2.Contract.AssociatesTab" },
        { id: "traits", cssClass: "item tab-select", icon: "fa-solid fa-tag", label: "MGT2.Items.Traits" },
        { id: "contents", cssClass: "item tab-select", icon: "fa-solid fa-box-open", label: "MGT2.Items.Contents" },
        { id: "tables", cssClass: "item tab-select", icon: "fa-solid fa-table", label: "MGT2.Items.Tables" },
        { id: "events", cssClass: "item tab-select", icon: "fa-solid fa-dice-d6", label: "MGT2.Items.EventsMishaps" },
        { id: "terms", cssClass: "item tab-select", icon: "fa-solid fa-timeline", label: "MGT2.Items.Terms" },
        { id: "description", cssClass: "item tab-select", icon: "fa-solid fa-book", label: "MGT2.Items.Description" },
        { id: "generate", cssClass: "item tab-select gmtab", icon: "fa-solid fa-dice", label: "MGT2.Contract.GenerateTab" },
        { id: "effects", cssClass: "item tab-select", icon: "fa-solid fa-person-rays", label: "MGT2.Effects.Title" }
      ]
    }
  };

  /** Which blocks each type carries, in render order. */
  static #BLOCKS_BY_TYPE = {
    _default: ["specs", "carried", "effects", "description"],
    weapon: ["roll", "specs", "carried", "traits", "fitted", "effects", "description"],
    // Battle dress carries a computer; `#composition` drops the block on armour that hosts nothing.
    armor: ["specs", "carried", "traits", "effects", "description", "software"],
    talent: ["roll", "effects", "description"],
    "talent:psionic": ["roll", "specs", "effects", "description"],
    disease: ["hazard", "effects", "description"],
    computer: ["specs", "carried", "traits", "effects", "description", "software"],
    // A wafer jack is a computer as much as an implant, and so is a transceiver from TL10 up, so
    // equipment lists what it runs; `#composition` drops the block on one that hosts nothing.
    equipment: ["summary", "specs", "carried", "effects", "software"],
    "equipment:augment": ["summary", "augment", "specs", "carried", "effects", "software"],
    "equipment:accessory": ["summary", "specs", "carried", "traits", "effects", "software"],
    drug: ["summary", "specs", "carried", "effects"],
    // `carried` sets the supply flag; a found thing or a program hosts nothing, so it never gains Contents.
    item: ["summary", "specs", "carried", "effects"],
    container: ["carried", "effects", "description", "contents"],
    // Both halves are listed and `#composition` drops the one this Item is not.
    career: ["specs", "career", "effects", "description", "careertables", "careerevents", "terms"],
    // A contact is someone the Traveller KNOWS, and knowing someone moves no number on the sheet:
    // the relationship is the whole record, so there is nothing for a change to carry.
    contact: ["relationship", "description", "notes"],
    // The split is where the schema already splits: `frame.*` is the term this species runs and
    // everything beside it is what a Traveller of it rolls.
    species: ["specs", "species", "traits", "speciesframe", "effects", "description", "detail"],
    role: ["actions", "summary", "effects"],
    // The three ship-owned types are not carried by anyone, so none of them takes `carried` and
    // none shows a supply cell.
    cargo: ["specs", "trade", "summary", "effects"],
    passage: ["specs", "summary", "effects"],
    component: ["summary", "specs", "effects"],
    // A round changes the weapon and not the shooter: no Effects tab unless one is already there.
    ammunition: ["specs", "rules", "hosts", "summary", "carried", "traits", "effects"],
    // Bounty Hunter p.18: one document rendered for two seats. `#composition` drops the two GM
    // blocks for a player and the party's `leads` copy for the referee. `notes` is not listed: the
    // referee's own prep belongs behind the fold, so the referee block draws it.
    contract: ["bounty", "referee", "leads", "associates", "generate", "description"]
  };

  /**
   * The blocks this document carries, grouped into the tab each one belongs in.
   * @param {object[]} [traits]   The prepared code rows, when the blocks are being rendered
   * @returns {{supply: boolean, slots: Record<string, object[]>}}
   */
  #composition(traits) {
    const item = this.item;
    const byType = TravellerItemSheet.#BLOCKS_BY_TYPE;
    const list = byType[`${item.type}:${item.system.subType}`] ?? byType[item.type] ?? byType._default;
    const slots = {};
    const template = (item.type === "career") && item.system.isTemplate;
    const sharedTable = (item.type === "career") && (item.system.kind === "table");
    let supply = false;

    for ( const id of list ) {
      if ( TEMPLATE_ONLY.has(id) && !item.system.isTemplate ) continue;
      if ( RECORD_ONLY.has(id) && item.system.isTemplate ) continue;
      // A template reads as its qualification card, so Specs is the record's alone.
      if ( template && (id === "specs") ) continue;
      if ( sharedTable && (id === "careertables") ) continue;
      if ( (id === "effects") && (item.type === "ammunition") && !item.effects.size ) continue;
      if ( GM_ONLY.has(id) && !game.user.isGM ) continue;
      if ( PLAYER_ONLY.has(id) && game.user.isGM ) continue;
      if ( id === "carried" ) {
        supply = true;
        if ( item.type !== "container" ) continue;
      }
      // An augment hosts software only while fitted and rated; a `computer` always does.
      if ( (id === "software") && !MGT2Helper.runsSoftware(item) ) continue;
      if ( (id === "fitted") && !item.actor ) continue;
      // The traits block renders once per trait array the type declares.
      const rows = ((id === "traits") && traits) ? traits : [null];
      for ( const row of rows ) (slots[SLOT[id]] ??= []).push({ id, template: blockPath(id), row });
    }

    for ( const blocks of Object.values(slots) ) {
      const titled = blocks.filter(block => !HEADLESS.has(block.id));
      if ( (titled.length === 1) && EPONYMOUS.has(titled[0].id) ) titled[0].bare = true;
    }
    return { supply, slots };
  }

  /**
   * The tab set varies per document, so the declared list is filtered down to the slots this item's
   * blocks fill and `initial` follows it.
   * @inheritDoc
   */
  _getTabsConfig(group) {
    const config = super._getTabsConfig(group);
    if ( (group !== "item") || !config ) return config;
    const { slots } = this.#composition();
    const tabs = config.tabs.filter(tab => tab.id in slots);
    return { ...config, tabs, initial: tabs[0]?.id ?? null };
  }

  /**
   * `_prepareTabs` fills `tabGroups[group]` with `??=`, so a stored id outlives the tab that
   * carried it: turn a talent from psionic to skill and Details is gone while the group still
   * points at it, leaving a blank body under a strip with nothing active.
   * @inheritDoc
   */
  _prepareTabs(group) {
    if ( group === "item" ) {
      const { tabs } = this._getTabsConfig(group);
      if ( !tabs.some(tab => tab.id === this.tabGroups[group]) ) this.tabGroups[group] = null;
    }
    return super._prepareTabs(group);
  }

  /** A player reads nothing a lock holds, at any depth. */
  get #withheld() {
    return (this.item.type === "container") && this.item.isLocked && !game.user.isGM;
  }

  /** How many entries a listing tab holds; null on a tab of prose, fields or tables. */
  #tabCount(id, blocks, traitRows, effects, nested) {
    if ( id === "effects" ) return effects.length;
    if ( id === "traits" ) {
      const rules = blocks.some(block => block.id === "rules") ? (this.item.system.rules?.length ?? 0) : 0;
      return traitRows.reduce((sum, row) => sum + row.entries.length, rules);
    }
    if ( (id === "events") && (this.item.type === "career") ) {
      const system = this.item.system;
      return system.eventTable.length + ((system.kind === "table") ? 0 : system.mishapTable.length);
    }
    if ( id === "terms" ) return this.#termRows()?.length ?? 0;
    // Both slots exist only on a contract.
    if ( id === "associates" ) return this.item.system.parties.length;
    if ( id === "leads" ) return this.item.system.referee.filter(row => row.shown).length;
    const listing = block => ["contents", "software", "fitted"].includes(block.id);
    if ( (id === "contents") && blocks.some(listing) && !this.#withheld
      && blocks.every(block => listing(block) || (block.id === "carried")) ) return nested.length;
    return null;
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const actor = item.actor;
    const traitRows = this.#prepareTraits();
    const { supply, slots } = this.#composition(traitRows);
    const effects = prepareEffects(item);
    const nested = this.#prepareNested(actor);
    const careerBook = this.#careerBook();

    // Each auto-prepared tab carries the blocks its body renders, and a listing tab its count.
    for ( const tab of Object.values(context.tabs) ) {
      tab.blocks = slots[tab.id];
      if ( (tab.id === "events") && (item.type === "career") && (item.system.kind === "table") ) {
        tab.label = "MGT2.Chargen.Template.EventTable";
      }
      if ( (tab.id === "contents") && (item.type === "weapon") ) tab.label = "MGT2.Items.Fitted";
      // A pre-career with nothing to draw keeps its Tables tab, dimmed: edit mode is where it is filled.
      if ( (tab.id === "tables") && careerBook?.empty ) tab.cssClass = [tab.cssClass, "empty"].filterJoin(" ");
      const count = this.#tabCount(tab.id, slots[tab.id], traitRows, effects, nested);
      if ( count === null ) continue;
      tab.badge = String(count);
      if ( count === 0 ) tab.cssClass = [tab.cssClass, "empty"].filterJoin(" ");
    }

    return Object.assign(context, {
      item,
      system: item.system,
      enriched: await MGT2Helper.enrichFields(item, ["description", "descriptionLong", "notes"]),
      source: item.toObject().system,
      systemFields: item.system.schema.fields,
      config: CONFIG.MGT2,
      settings: {
        usePronouns: game.settings.get("mgt2", "usePronouns"),
        useGender: game.settings.get("mgt2", "useGender")
      },
      // Only the Companion's vacuum table reads a suit's breach, so only it puts the control up.
      showSuitBreach: (item.type === "armor") && (Rules.get("vacuumRuleset") === "companion"),
      conditional: (item.type === "armor") ? MGT2Helper.protectionVs(item.system.conditional) : "",
      armourBoosts: (item.type === "armor") ? TravellerItemSheet.#armourBoosts(item.system) : null,
      binding: slots.masthead?.[0] ?? null,
      supply,
      spine: this.#spine(),
      tags: this.#tags(),
      level: this.#level(),
      subTypes: SUBTYPES[item.type] ?? null,
      hadContainer: actor != null,
      // A bag is offered neither itself nor anything already inside it; a player, no lock but its own.
      containers: actor ? [{ name: ("inventory" in actor.system) ? game.i18n.localize("MGT2.Items.OnHand") : "", _id: "" }]
        .concat(actor.getContainers()
        .filter(c => (c.id !== item.id) && !c.containerChain.some(p => p.id === item.id)
          && (game.user.isGM || !c.isLocked || (c.id === item.system.container?.id)))) : null,
      computers: actor ? [{ name: "", _id: "" }].concat(actor.getComputers()) : null,
      // The owner's weapons; a player is offered none inside a lock but the one already fitted to.
      fitted: Boolean(item.fittedHost),
      secondary: (item.type === "weapon") && Boolean(item.fittedHost),
      weapons: (actor && (isAccessory(item) || item.fittedHost))
        ? [{ name: game.i18n.localize("MGT2.Items.NotFitted"), _id: "" }].concat(actor.items.filter(entry =>
        (entry.type === "weapon") && (entry !== item) && (game.user.isGM || !entry.isLocked || (entry.id === item.system.fittedTo))
        && !secondaryRefused(item, entry, item.fitted)).sort(MGT2Helper.compareByName)) : null,
      accessory: this.#accessory(),
      // Every round the owner carries: `weaponType` is free text and never a filter. A player is
      // offered nothing inside a lock but the round already loaded.
      rounds: (actor && (item.type === "weapon"))
        ? [{ name: game.i18n.localize("MGT2.Items.WeaponsOwn"), _id: "" }]
          .concat(actor.items.filter(entry => (entry.type === "ammunition")
            && (game.user.isGM || !entry.isLocked || (entry.id === item.system.ammunition)))) : null,
      // The counter lives on the Traveller, so it survives the last dose being swallowed.
      doses: (item.type === "drug") ? Doses.countOf(actor, item.name) : null,
      canDose: (item.type === "drug") && Doses.canTake(actor),
      addiction: this.#addiction(),
      weight: "weight" in item.system ? item.system.weight : null,
      unitlabels: { weight: MGT2Helper.getWeightLabel() },
      isGM: game.user.isGM,
      skills: this.#prepareSkills(actor),
      roll: this.#prepareRoll(actor),
      effects,
      // A Set is neither an array nor a plain object, so Handlebars cannot walk it.
      damageTypes: Array.from(item.system.damageType ?? [], key => game.i18n.localize(MGT2.DamageTypes[key])),
      scale: MGT2.WeaponScales[item.system.scale] ?? null,
      fireModes: this.#fireModes(),
      ammo: this.#ammo(),
      processing: this.#processing(),
      citation: this.#citation(),
      component: this.#component(),
      componentCategories: TravellerItemSheet.#componentCategories(item.system.category),
      trade: this.#tradeColumns(),
      nested,
      careerTables: this.#careerTables(),
      careerIssues: this.#careerIssues(),
      eventTables: this.#eventTables(),
      careerCard: this.#careerCard(),
      careerBook,
      qualChoices: this.#qualChoices(),
      termRows: this.#termRows(),
      serviceCard: this.#serviceCard(),
      mastPills: this.#mastPills(),
      cargo: this.#cargo(),
      passage: this.#passage(),
      speciesFrame: this.#speciesFrame(),
      speciesTiles: this.#speciesTiles(),
      traitModifiers: this.#traitModifiers(),
      // A role's line follows its actions, so it reads as prose and not as the lede the tab opens on.
      summary: this.#summary(slots.details?.[0]?.id !== "actions"),
      station: item.type === "role",
      stationActions: this.#stationActions(),
      augmentTiles: this.#augmentTiles(),
      bandwidth: this.#bandwidth(),
      host: this.#host(),
      bag: this.#bag(actor),
      hosts: this.#hosts(),
      contactActor: (item.type === "contact") ? this.#reference({ uuid: item.system.actor, name: "" }) : null,
      contactPills: this.#contactPills(),
      contract: this.#contract()
    });
  }

  /**
   * Bounty Hunter p.18-19's contract as one viewer reads it. The party's column is not a subset of
   * the referee's: it is the same stored object read with a different viewer.
   */
  #contract() {
    const item = this.item;
    if ( item.type !== "contract" ) return null;
    const system = item.system;
    const gm = game.user.isGM;
    const mayEdit = this.canEditContent;
    const shown = system.referee.filter(row => row.shown);

    return {
      gm, mayEdit,
      subject: (system.subject.kind === "person")
        ? { person: this.#reference(system.subject.person) }
        : { label: system.subject.label, kind: MGT2.ContractSubjectKinds[system.subject.kind] },
      // Folio 18's third state: the party reads "Classified", the referee reads who it is, off one
      // stored field.
      issuer: {
        classified: system.employer.classified,
        person: (system.employer.classified && !gm) ? null : this.#reference(system.employer.person),
        note: gm ? system.employer.note : ""
      },
      hunter: this.#reference(system.hunter),
      rep: system.hunterRep,
      hasRep: system.hunterRep !== null,
      // The floor is a referee row: until it is shown, the party's sheet must not tell them it is there.
      short: (gm || system.repFloorShown) && (system.hunterRep !== null) && (system.hunterRep < system.repFloor),
      pills: [
        { label: MGT2.ContractPriorities[system.priority], field: "MGT2.Contract.PriorityLabel",
          tone: { high: "warn", critical: "danger" }[system.priority] ?? "" },
        { label: MGT2.JobStatus[system.status], field: "MGT2.Contract.Status",
          tone: { done: "good", failed: "danger", cancelled: "faint" }[system.status] ?? "" },
        system.paid && { label: "MGT2.Contract.Paid", field: "MGT2.Contract.Paid", tone: "good", icon: "fa-solid fa-check" }
      ].filter(Boolean),
      shownLabel: MGT2Helper.plural("MGT2.Contract.ShownCount", system.referee.length,
        { shown: shown.length, total: system.referee.length }),
      leadLabel: MGT2Helper.plural("MGT2.Contract.LeadCount", shown.length, { n: shown.length }),
      rows: system.referee.map((row, index) => ({
        index, ...row,
        label: MGT2.ContractRefereeRows[row.key] ?? row.label,
        // Folio 19 leaves the last known location blank on an alternate contract, and that blank
        // is the reading rather than an omission.
        blanked: system.alternate && (row.key === "lastSeen")
      })),
      shownRows: shown,
      shownCount: shown.length,
      heldCount: system.referee.length - shown.length,
      // `stored` is what the edit field binds: binding the RESOLVED name would copy the Actor's
      // name into the document, and nothing here is a copy.
      associates: system.parties.map((party, index) => ({
        index, relation: party.relation, note: party.note,
        stored: party.person.name, uuid: party.person.uuid ?? "",
        person: this.#reference(party.person)
      })),
      negotiate: this.#contractAction("negotiate"),
      qualify: this.#contractAction("qualify"),
      repChange: this.#contractAction("repChange"),
      repInPlay: Rules.characteristic("reputation"),
      repChangeDM: MGT2Helper.signed(Contract.repChangeDM(system.hunterRep ?? 0), "+0"),
      // The hunter's own REP DM, which the two party rolls add; none with nobody to roll.
      repDM: system.hunterActor ? (system.hunterActor.system.characteristics?.reputation?.dm ?? null) : null,
      circumstances: Object.entries(MGT2.RepModification).map(([value, row]) => ({
        value, dm: MGT2Helper.signed(row.dm), label: game.i18n.localize(row.label)
      })),
      // The floor is a referee-side field, so until it is shown the party does not know there is
      // one to fall under — and folio 10's check is only for a hunter under it.
      offerQualify: (system.repFloorShown && (system.hunterRep !== null)
        && (system.hunterRep < system.repFloor)) || system.qualificationRolled,
      difficulty: MGT2Helper.getDifficultyDisplay(
        Contract.qualificationDifficulty(system.repFloor - (system.hunterRep ?? 0))),
      generator: {
        refused: Contract.generatorRefusal(item),
        log: this.#generatorLog()
      }
    };
  }

  /** One printed roll: whether it can be made here, and the sentence saying why not. */
  #contractAction(rule) {
    const refused = Contract.refusal(this.item, rule);
    return { refused, disabled: refused !== null };
  }

  /**
   * The eight declared draws, carrying whatever the last run returned. The sequence is the system's;
   * every row it shows came from the module.
   */
  #generatorLog() {
    const drawn = this.#drawLog ?? [];
    // A step waiting for its draw names the table it draws from; three take theirs from an earlier result.
    return Contract.sequence.map(step => ({
      ...step, chained: !step.table || step.table.includes("{"),
      name: step.table?.replace(/\{\w+\}/g, "…") ?? null,
      ...(drawn.find(row => row.step === step.step) ?? {})
    }));
  }

  /**
   * One `{uuid, name}` reference as this viewer reads it — three occupancy states, and a link the
   * viewer cannot observe degrades to the stored name rather than to a chip that will not open.
   * @returns {{name: string, linked: boolean}|null}   Null is VACANT, and vacant is a state
   */
  #reference(reference) {
    const actor = reference?.uuid ? foundry.utils.fromUuidSync(reference.uuid) : null;
    const visible = actor?.testUserPermission?.(game.user, "LIMITED") === true;
    if ( visible ) return { uuid: reference.uuid, name: actor.name, linked: true };
    const name = reference?.name?.trim() || actor?.name || "";
    return name ? { uuid: reference.uuid, name, linked: false } : null;
  }

  /** A contact's three readings as toned pills, each naming its field on hover. */
  #contactPills() {
    if ( this.item.type !== "contact" ) return null;
    const system = this.item.system;
    return [["relation", "Relation"], ["attitude", "Attitude"], ["status", "Status"]].map(([field, name]) => ({
      label: `MGT2.Contact.${name}.${system[field]}`,
      field: `MGT2.Items.${name}`,
      tone: CONTACT_TONES[field][system[field]] ?? ""
    }));
  }

  /**
   * What a species frame reads as rather than what it stores: the term sequence derived against the
   * Core one, and the Set of characteristics it does without — a Set being neither an array
   * nor a plain object, so Handlebars cannot walk it and `.join` on it throws.
   */
  #speciesFrame() {
    if ( this.item.type !== "species" ) return null;
    const { sequence, own, cut } = this.item.system.termSequence;
    return {
      sequence,
      own: [...own],
      cut: [...cut],
      declared: this.item.system.frame.steps.length > 0,
      // The step's own label and the one-line reading of its check, composed here because a
      // play-time row prints what the book prints — `Patriarchy 4+` — and Handlebars cannot
      // assemble that.
      steps: this.item.system.frame.steps.map((step, index) => ({
        index,
        key: step.key,
        check: step.check,
        label: game.i18n.localize(MGT2.CreationSteps[step.key] ?? step.key),
        summary: stepCheckSummary(step.check, step.key)
      })),
      without: Array.from(this.item.system.withoutCharacteristics,
        key => game.i18n.localize(MGT2.Characteristics[key])),
      matched: this.#matchedLaws()
    };
  }

  /**
   * The printed line Details opens on, and on an augment the printed cell when the description does
   * not already begin with it: the same text is never drawn twice.
   * @returns {{head: string, rest: string, short: boolean, vacant: boolean}|null}
   */
  #summary(lead = true) {
    const system = this.item.system;
    if ( typeof system.description !== "string" ) return null;
    const sub = `${this.item.type}:${system.subType}`;
    const cell = (sub === "equipment:augment") ? (system.augment.improvement ?? "").trim()
      : (sub === "item:software") ? (system.software.effect ?? "").trim() : "";
    const text = system.description.trim();
    const head = (!cell || text.startsWith(cell)) ? text : cell;
    const rest = ((head === cell) && text && (text !== cell)) ? text : "";
    return { head, rest, short: lead && (head.length <= 120) && !head.includes("\n"), vacant: !head && !this.#citation() };
  }

  /** What the Traveller's derivations read off an augment, one tile each; a tile they skip is off. */
  #augmentTiles() {
    const item = this.item;
    if ( (item.type !== "equipment") || (item.system.subType !== "augment") ) return null;
    const augment = item.system.augment;
    const fitted = item.system.equipped === true;
    const issues = item.actor?.system.augmentIssues;
    const limits = { characteristic: "MGT2.Actor.AugmentCharacteristicLimit", skill: "MGT2.Actor.AugmentSkillLimit",
      protection: "MGT2.Actor.AugmentProtectionLimit" };
    // The sheet reads the inventory's own lists, so it cannot disagree with the numbers.
    const tile = (kind, label, value, tooltip) => {
      const outranked = fitted && Boolean(issues?.[kind]?.includes(item.id));
      return { kind, label, value, text: MGT2Helper.signed(value), tone: (value > 0) ? "up" : "down",
        off: !fitted || outranked,
        tooltip: outranked ? game.i18n.format(limits[kind], { names: item.name }) : tooltip };
    };
    const tiles = [];
    for ( const row of augment.modifiers ?? [] ) {
      if ( !row.characteristic || !Number.isFinite(row.value) || !row.value ) continue;
      tiles.push(tile("characteristic", game.i18n.localize(`MGT2.Characteristics.${row.characteristic}.short`), row.value,
        game.i18n.localize(MGT2.Characteristics[row.characteristic] ?? row.characteristic)));
    }
    const skill = augment.skill?.name?.trim();
    if ( skill && augment.skill.value ) {
      tiles.push(tile("skill", skill, augment.skill.value,
        game.i18n.format("MGT2.Actor.AugmentSkill", { augment: item.name, skill })));
    }
    if ( augment.protection > 0 ) tiles.push(tile("protection", game.i18n.localize("MGT2.Items.Protection"), augment.protection, ""));
    return { fitted, tiles, hasEffects: item.effects.size > 0 };
  }

  /** A drug's three addiction values, read together, or null while the referee has not set one (CSC p.97). */
  #addiction() {
    const { type, system } = this.item;
    if ( type !== "drug" ) return null;
    const { dosesBefore, checkInterval, cravingDM } = system.addiction;
    if ( (dosesBefore === null) && !checkInterval && (cravingDM === null) ) return null;
    return { before: dosesBefore, interval: checkInterval ?? "", craving: cravingDM };
  }

  /** A program's Bandwidth as cells, lit up to the figure it runs at (Core p.110's downgrade). */
  #bandwidth() {
    const { type, system } = this.item;
    // A program carries its figures under `software`; a ship's software row on itself, its host the ship.
    const source = ((type === "item") && (system.subType === "software")) ? system.software
      : ((type === "component") && (system.category === "software")) ? system : null;
    if ( !source ) return null;
    const { bandwidthRun: run, bandwidth: rated, downgraded } = source;
    return { run, rated, downgraded, cells: cells(run, rated), fill: rated ? Math.round(100 * run / rated) : 0,
      blocked: (type === "component") && (system.tlBlocked === true) };
  }

  /** The computer an owned program runs on, read off its owner's items. */
  #host() {
    const { type, system, actor } = this.item;
    if ( (type !== "item") || (system.subType !== "software") || !actor ) return null;
    return { name: actor.items.get(system.software.computerId)?.name ?? "", blocked: system.software.tlBlocked === true };
  }

  /** One tile per characteristic rolled, dice and species DM together, read as `Chargen.plan` reads the list. */
  #speciesTiles() {
    if ( this.item.type !== "species" ) return null;
    const system = this.item.system;
    const short = key => game.i18n.localize(`MGT2.Characteristics.${key}.short`);
    const named = key => game.i18n.localize(MGT2.Characteristics[key] ?? key);
    const tile = (characteristic, row = {}) => ({
      key: characteristic,
      short: row.short || short(characteristic),
      name: row.label || named(characteristic),
      formula: row.formula || "2D",
      replaces: row.replaces ? named(row.replaces) : "",
      dm: 0,
      variants: []
    });
    const declared = system.characteristicRolls.filter(row => row.characteristic && !row.sex);
    const tiles = declared.length ? declared.map(row => tile(row.characteristic, row))
      : MGT2.RolledCharacteristics.filter(key => !system.withoutCharacteristics.has(key)).map(key => tile(key));
    const find = key => tiles.find(entry => entry.key === key);

    for ( const row of system.characteristicRolls ) {
      if ( row.sex && row.characteristic ) find(row.characteristic)?.variants.push(`${row.sex} ${row.formula || "2D"}`);
    }
    for ( const modifier of system.modifiers ) {
      if ( !modifier.characteristic || !modifier.value ) continue;
      // A DM on a characteristic the species does not roll, Psionics say, still applies: its own tile.
      let target = find(modifier.characteristic);
      if ( !target ) {
        target = { ...tile(modifier.characteristic), formula: "" };
        tiles.push(target);
      }
      if ( modifier.sex ) target.variants.push(`${modifier.sex} ${MGT2Helper.signed(modifier.value)}`);
      else target.dm += modifier.value;
    }

    const replaces = game.i18n.localize("MGT2.Chargen.Frame.Replaces");
    return tiles.map(entry => ({
      ...entry,
      dmText: entry.dm ? MGT2Helper.signed(entry.dm) : "—",
      tone: (entry.dm > 0) ? "up" : (entry.dm < 0) ? "down" : "",
      tooltip: [entry.name, entry.replaces && `${replaces} ${entry.replaces}`, ...entry.variants]
        .filter(part => part).join(" · ")
    }));
  }

  /** Each trait DM row, named by one of the Item's own traits, a custom one by its text. */
  #traitModifiers() {
    const { type, system } = this.item;
    if ( type !== "species" ) return null;
    const traits = system.traits.map(entry => ({ value: (entry.key === CUSTOM_KEY) ? entry.note : entry.key,
      label: traitLabel(entry) })).filter(entry => entry.value);
    return system.traitModifiers.map(row => {
      const named = traits.find(entry => entry.value === row.trait);
      const skillsText = row.skills.join(", ");
      return { ...row, label: named?.label ?? row.trait, skillsText,
        applies: ((row.target === "skills") && skillsText) || game.i18n.localize(MGT2.TraitModifierTargets[row.target] ?? ""),
        inert: (row.target === "protection") && !!row.condition,
        traits: (named || !row.trait) ? traits : [...traits, { value: row.trait, label: row.trait }] };
    });
  }

  /**
   * Which row of each sexed law answers for the Traveller this species Item is embedded in. Both
   * selectors are strings matched by `fold`, so a rung typed in the wrong language reads as a
   * silence everywhere else; this is the one place it shows. `-1` off an Actor and where the law
   * has no answer.
   */
  #matchedLaws() {
    const actor = this.item.actor;
    const system = this.item.system;
    const at = rows => (actor && rows?.length) ? rows.indexOf(Chargen.law(actor, rows)) : -1;
    return {
      startAge: at(system.frame.startAge),
      ageing: at(system.ageing),
      backgroundSkills: at(system.backgroundSkills)
    };
  }

  /** The STR and DEX controls, and the line the play view prints. */
  static #armourBoosts(system) {
    const fields = system.schema.fields.characteristics.fields;
    return {
      rows: MGT2.ArmourCharacteristics.map(key => ({
        key, fields: fields[key].fields, ...system.characteristics[key],
        short: game.i18n.localize(`MGT2.Characteristics.${key}.short`)
      })),
      line: MGT2Helper.armourBoostLine(system.characteristics)
    };
  }

  /**
   * The categories a part may be, minus the ones behind a rule this table has not adopted — the one
   * already stored stays offered, so a switch turned off does not silently retype a fitted part.
   */
  static #componentCategories(current) {
    const optional = MGT2.OptionalComponentCategories;
    return Object.fromEntries(Object.entries(MGT2.ComponentCategories).filter(([key]) =>
      (key === current) || !optional[key] || Rules.on(optional[key])));
  }

  /** The four skill tables as a list the template can walk: `tables` is a SchemaField, not an array. */
  #careerTables() {
    if ( (this.item.type !== "career") || !this.item.system.isTemplate ) return null;
    const tables = this.item.system.tables;
    return Object.keys(tables).map(key => ({
      key, label: `MGT2.Chargen.Template.Tables.${key}`, ...tables[key]
    }));
  }

  /**
   * The reference ledger, on the `system.design` model: one line per name this template
   * points at, and the names that resolve to nothing spelled out beside it.
   */
  #careerIssues() {
    if ( (this.item.type !== "career") || !this.item.system.isTemplate ) return null;
    const issues = this.item.system.templateIssues;
    return {
      failed: issues.failed,
      checks: issues.checks.map(check => ({
        ...check,
        label: `MGT2.Chargen.Template.Checks.${check.key}`,
        why: `MGT2.Chargen.Template.Why.${check.key}`,
        // Handlebars cannot join, and the names are worth more than the count they came from.
        named: check.missing.join(", ")
      }))
    };
  }

  /** Events and Mishaps are one row shape, differing in what `ejects` defaults to; a shared table has Events alone. */
  #eventTables() {
    if ( (this.item.type !== "career") || !this.item.system.isTemplate ) return null;
    // Each option names its table, so a closed select still says which borrowed table it rolls.
    const borrow = Object.entries(MGT2.BorrowedTables).map(([key, label]) => {
      const table = game.i18n.localize(label);
      return { key, choices: Object.fromEntries(["", ...Object.keys(MGT2.TrayConditions)].map(condition => [condition,
        game.i18n.format(`MGT2.Chargen.Template.BorrowWhen.${condition || "never"}`, { table })])) };
    });
    const shared = this.item.system.kind === "table";
    const read = key => this.item.system[key].map(row => ({ ...row, pills: TravellerItemSheet.#eventPills(row, key) }));
    const events = { key: "eventTable", label: "MGT2.Chargen.Template.EventTable", dice: shared ? "" : "2D",
      rows: read("eventTable"), borrow };
    if ( shared ) return [events];
    return [events, { key: "mishapTable", label: "MGT2.Chargen.Template.MishapTable", dice: "1D",
      rows: read("mishapTable"), borrow }];
  }

  /** A characteristic key as its short form, `INT`. */
  static #short(key) {
    return key ? game.i18n.localize(`MGT2.Characteristics.${key}.short`) : "";
  }

  /** What an event or mishap row does, as pills; one whose effect hangs on a condition is dashed. */
  static #eventPills(row, table) {
    const pills = [];
    const loc = key => game.i18n.localize(key);
    const when = condition => ((condition && (condition !== "always")) ? loc(MGT2.TrayConditions[condition] ?? "") : "");
    // A pill that carries what the referee typed keeps its case; a state is set in capitals.
    const add = (text, { tone = "", icon = "", condition = "", tip = "", dashed = false, typed = false } = {}) => {
      if ( text ) pills.push({ text, tone, icon, typed, dashed: dashed || Boolean(condition), tip: condition || tip });
    };
    const ejection = { ejects: "danger", mishap: "faint", choice: "warn", stays: "good" };
    // Staying is the exception on a Mishap row and the rule on an Events row.
    if ( (row.ejects in ejection) && ((row.ejects !== "stays") || (table === "mishapTable")) ) {
      add(loc(`MGT2.Chargen.Ejection.${row.ejects}`), { tone: ejection[row.ejects], condition: when(row.ejectsCondition) });
    }
    if ( row.subTable && (row.subTable !== "Injury") ) add(`→ ${row.subTable}`, { typed: true });
    if ( row.injury?.modes?.size || (row.subTable === "Injury") ) {
      const how = Array.from(row.injury?.modes ?? [], mode => loc(MGT2.InjuryModes[mode] ?? "")).filter(Boolean).join(" / ");
      const who = (row.injury?.who === "associate") ? loc(MGT2.InjuryTargets.associate) : how;
      add(`→ ${loc("MGT2.Chargen.Template.Injury")}${who ? ` · ${who}` : ""}`, { tone: "warn", typed: true });
    }
    const check = row.check ?? {};
    if ( check.target ) {
      const reading = one => `${[TravellerItemSheet.#short(one.characteristic), ...(one.skills ?? [])]
        .filter(Boolean).join(" / ")} ${one.target}+`;
      add([check, ...(check.alternatives ?? [])].map(reading).join(" · "), { icon: "fa-solid fa-dice", typed: true });
    }
    const cellText = text => (text ? text[0].toUpperCase() + text.slice(1) : "");
    add(cellText(row.grant?.text), { icon: "fa-solid fa-plus", condition: when(row.grantCondition), typed: true });
    add(cellText(row.grant2?.text), { icon: "fa-solid fa-plus", condition: when(row.grant2Condition), typed: true });
    for ( const entry of row.tray ?? [] ) {
      const kind = (entry.kind === "dm") ? `DM${MGT2Helper.signed(entry.dm)}` : loc(MGT2.TrayKinds[entry.kind] ?? "");
      const on = Array.from(entry.appliesTo ?? [], key => loc(MGT2.TrayChecks[key] ?? "")).filter(Boolean).join(", ");
      add([kind, on].filter(Boolean).join(" · "), { icon: "fa-solid fa-hourglass-half", condition: when(entry.condition),
        dashed: true });
    }
    if ( row.awards?.outcomes?.size ) {
      add(Array.from(row.awards.outcomes, key => loc(MGT2.TermOutcomes[key] ?? "")).join(" / "), { icon: "fa-solid fa-star" });
    }
    if ( row.career ) add(`→ ${row.career}`, { tip: loc(MGT2.RowCareerModes[row.careerMode] ?? ""), typed: true });
    if ( row.benefit && (row.benefit !== "none") ) {
      add(loc(MGT2.BenefitRowEffects[row.benefit]), { tone: ["lose", "wipe"].includes(row.benefit) ? "danger" : "good",
        condition: when(row.benefitCondition) });
    }
    const gate = row.gate ?? {};
    if ( gate.kind === "characteristic" ) {
      add([TravellerItemSheet.#short(gate.characteristic), (gate.min !== null) ? `${gate.min}+` : "",
        (gate.max !== null) ? `≤ ${gate.max}` : ""].filter(Boolean).join(" "));
    } else if ( gate.kind && gate.key ) add(gate.key, { typed: true });
    if ( row.track?.key ) {
      add(`${row.track.key} ${row.track.formula || MGT2Helper.signed(row.track.value ?? 0)}`, { typed: true });
    }
    return pills;
  }

  /** The qualification card a template opens on: plates, the DM line, the switches, the assignments. */
  #careerCard() {
    const { item } = this;
    if ( (item.type !== "career") || !item.system.isTemplate || (item.system.kind === "table") ) return null;
    const system = item.system;
    const loc = key => game.i18n.localize(key);
    const short = TravellerItemSheet.#short;
    const or = game.i18n.getListFormatter({ type: "disjunction" });
    const qualification = system.qualification;
    const plates = [{
      label: "MGT2.Chargen.Steps.qualify",
      value: (qualification.entry === "target") ? `${system.difficulty}+` : loc(MGT2.QualificationEntry[qualification.entry]),
      word: qualification.entry !== "target",
      on: or.format(qualification.characteristics.map(short)),
      note: qualification.autoIf.characteristic ? [loc("MGT2.Chargen.Template.AutoIf"),
        short(qualification.autoIf.characteristic),
        (qualification.autoIf.min !== null) ? `${qualification.autoIf.min}+` : "",
        (qualification.autoIf.max !== null) ? `≤ ${qualification.autoIf.max}` : ""].filter(Boolean).join(" ") : ""
    }];
    if ( system.commission ) {
      plates.push({ label: "MGT2.Chargen.Steps.commission",
        value: system.commissionCheck.target ? `${system.commissionCheck.target}+` : "—",
        on: short(system.commissionCheck.characteristic) });
    }
    if ( system.basicFrom ) {
      plates.push({ label: "MGT2.Chargen.Steps.basic", value: loc(MGT2.BasicTrainingTables[system.basicFrom]), word: true });
    }
    const escape = foundry.utils.escapeHTML;
    const dm = value => `<span class="dmp${value ? "" : " zero"}">${MGT2Helper.signed(value)}</span>`;
    const dms = [];
    if ( qualification.perPreviousCareer ) {
      dms.push(game.i18n.format("MGT2.Chargen.Template.DMPerPrevious", { dm: dm(qualification.perPreviousCareer) }));
    }
    for ( const row of qualification.conditionalDMs ) {
      if ( row.characteristic ) dms.push(`${dm(row.dm)} ${short(row.characteristic)} ${row.min ?? ""}+`);
      else if ( row.afterCareers?.length ) {
        dms.push(game.i18n.format("MGT2.Chargen.Template.DMAfter",
          { dm: dm(row.dm), careers: escape(or.format([row.afterCareers].flat())) }));
      }
    }
    if ( (system.ageDM.from !== null) && system.ageDM.dm ) {
      dms.push(game.i18n.format("MGT2.Chargen.Template.DMFromAge", { dm: dm(system.ageDM.dm), age: system.ageDM.from }));
    }
    const switches = [["pensionable", "Pensionable"], ["alwaysAvailable", "AlwaysAvailable"], ["neverEjects", "NeverEjects"],
      ["blocksAnagathics", "BlocksAnagathics"]].filter(([key]) => system[key])
      .map(([, label]) => `MGT2.Chargen.Template.${label}`);
    if ( qualification.requiresPermission ) switches.push("MGT2.Chargen.Template.RequiresPermission");
    const reading = (row) => (row?.characteristic ? `${short(row.characteristic)} ${row.target}+` : "—");
    const bills = system.medicalBillsRow;
    const facts = [
      { label: "MGT2.Chargen.Template.AssignmentChange", value: system.assignmentChange
        ? loc(MGT2.AssignmentChangeRules[system.assignmentChange]) : loc("MGT2.Chargen.Template.Undeclared") },
      { label: "MGT2.Chargen.Template.EventRow7", value: loc(MGT2.EventRow7[system.eventRow7] ?? "") },
      { label: "MGT2.Chargen.Template.MedicalBillsRow", value: bills
        ? (MGT2.MedicalBillsGroups[bills] ? loc(MGT2.MedicalBillsGroups[bills]) : bills) : "—" },
      system.restrictedTo.species && { label: "MGT2.Chargen.Template.RestrictedSpecies", value: system.restrictedTo.species },
      system.restrictedTo.sex && { label: "MGT2.Chargen.Template.RestrictedSex", value: system.restrictedTo.sex },
      system.exitRule.track && { label: "MGT2.Chargen.Template.ExitRule",
        value: [system.exitRule.track, system.exitRule.test].filter(Boolean).join(" · ") }
    ].filter(Boolean);
    return {
      plates, dms: dms.join(" · "), switches, facts,
      assignments: system.assignments.map(row => ({ name: row.name, survival: reading(row.survival),
        advancement: reading(row.advancement) }))
    };
  }

  /** The career's printed tables, laid out as the book prints them. */
  #careerBook() {
    const { item } = this;
    if ( (item.type !== "career") || !item.system.isTemplate || (item.system.kind === "table") ) return null;
    const system = item.system;
    const short = TravellerItemSheet.#short;
    const text = cell => cell?.text || "";
    const ladders = system.rankLadders.map(ladder => ({ name: ladder.name, officer: ladder.officer,
      rows: ladder.rows.map(row => ({ rank: row.rank, title: row.title, bonus: text(row.bonus) })) }));
    const assignments = system.assignments.map(row => ({ name: row.name,
      gate: [row.survival?.characteristic ? `${short(row.survival.characteristic)} ${row.survival.target}+` : "",
        row.advancement?.characteristic ? `${short(row.advancement.characteristic)} ${row.advancement.target}+` : ""]
        .filter(Boolean).join(" · "),
      cells: row.skills.map(text) }));
    const tables = Object.entries(system.tables).filter(([, table]) => table.present).map(([key, table]) => ({
      label: `MGT2.Chargen.Template.Tables.${key}`,
      gate: table.requiresCommission ? game.i18n.localize("MGT2.Chargen.Template.RequiresCommission")
        : (table.gate?.characteristic ? `${short(table.gate.characteristic)} ${table.gate.min ?? ""}+` : ""),
      cells: table.rows.map(text) }));
    const width = Math.max(0, ...assignments.map(row => row.cells.length), ...tables.map(row => row.cells.length));
    const benefitRows = Math.max(system.benefits.cash.length, system.benefits.other.length);
    return {
      ladders,
      assignments: { heads: assignments, rows: Array.from({ length: Math.max(0, ...assignments.map(row => row.cells.length)) },
        (_r, index) => ({ roll: index + 1, cells: assignments.map(row => row.cells[index] ?? "") })) },
      tables: { heads: tables, rows: Array.from({ length: Math.max(0, ...tables.map(row => row.cells.length)) },
        (_r, index) => ({ roll: index + 1, cells: tables.map(row => row.cells[index] ?? "") })) },
      benefits: Array.from({ length: benefitRows }, (_r, index) => ({ roll: index + 1,
        cash: system.benefits.cash[index] ?? null, other: text(system.benefits.other[index]) })),
      empty: !ladders.length && !assignments.length && !width && !benefitRows
    };
  }

  /** The characteristics a career may qualify on: the six rolled, the optional ones in play, and any already stored. */
  #qualChoices() {
    const { item } = this;
    if ( (item.type !== "career") || !item.system.isTemplate || (item.system.kind === "table") ) return null;
    const stored = item.system.qualification.characteristics;
    const keys = [...MGT2.RolledCharacteristics,
      ...Object.keys(MGT2.Characteristics).filter(key => !MGT2.RolledCharacteristics.includes(key)
        && (Rules.characteristic?.(key) || stored.includes(key)))];
    return keys.map(key => ({ key, label: TravellerItemSheet.#short(key), on: stored.includes(key) }));
  }

  /** A record's terms, as the creation screen reads them. */
  #termRows() {
    const { item } = this;
    if ( (item.type !== "career") || item.system.isTemplate || !item.actor ) return null;
    const frame = Chargen.frame(item.actor)?.system.frame;
    return Chargen.timeline(item.actor).filter(row => row.careerId === item.id).map(row => {
      // The toned lines are the survival and ejection marks, which head the card beside the outcomes.
      const lines = Chargen.termLines(row, frame);
      return { index: row.index, from: row.from, to: row.to,
        outcomes: Array.from(row.outcomes, key => MGT2.TermOutcomes[key]).filter(Boolean),
        marks: lines.filter(line => line.tone), lines: lines.filter(line => !line.tone) };
    });
  }

  /** A record's service: the rank and its title, the terms and their marks, the assignment and its two thresholds. */
  #serviceCard() {
    const { item } = this;
    if ( (item.type !== "career") || item.system.isTemplate ) return null;
    const system = item.system;
    const ladder = system.rankLadders.find(entry => entry.id === system.ladder);
    const assignment = system.assignments.find(entry => entry.name === system.assignment);
    const short = TravellerItemSheet.#short;
    const reading = row => (row?.characteristic ? `${short(row.characteristic)} ${row.target}+` : "");
    return {
      rank: system.rank,
      title: ladder?.rows.find(row => row.rank === system.rank)?.title ?? "",
      ladder: ladder?.name ?? "",
      enlisted: TravellerItemSheet.#enlisted(system, assignment),
      terms: system.terms,
      marks: (system.termLog ?? []).map(entry => ({ term: entry.term,
        tone: !entry.closed ? "open" : (((entry.survived !== false) && !entry.ejected) ? "good" : "bad") })),
      assignment: system.assignment,
      survival: reading(assignment?.survival),
      advancement: reading(assignment?.advancement)
    };
  }

  /** The rank a commissioned record left behind, read off the assignment's enlisted ladder: `Ratings 4 · Leading Hand`. */
  static #enlisted(system, assignment) {
    if ( !(system.enlistedRank > 0) ) return "";
    const ladder = system.rankLadders.find(entry => entry.id === assignment?.ladder);
    const title = ladder?.rows.find(row => row.rank === system.enlistedRank)?.title;
    return [`${ladder?.name ?? ""} ${system.enlistedRank}`.trim(), title].filter(Boolean).join(" · ");
  }

  /** The pills under the masthead: a template's references, a record's entry and exit. */
  #mastPills() {
    const { item } = this;
    if ( item.type === "cargo" ) return this.#cargoPills();
    if ( item.type === "passage" ) return this.#passagePills();
    if ( item.type === "weapon" ) return this.#secondaryPills();
    if ( item.type !== "career" ) return null;
    const system = item.system;
    if ( system.isTemplate ) {
      if ( system.kind === "table" ) return null;
      const checks = system.templateIssues.checks.filter(check => check.applies);
      if ( !checks.length ) return null;
      const passed = checks.filter(check => check.ok).length;
      const ok = passed === checks.length;
      return [{ label: `${game.i18n.localize("MGT2.Chargen.Template.Integrity")} ${passed}/${checks.length}`,
        tone: ok ? "good" : "danger", mark: ok ? "good" : "bad",
        tooltip: checks.map(check => game.i18n.localize(`MGT2.Chargen.Template.Checks.${check.key}`)).join(" · ") }];
    }
    const exitTone = { graduated: "good", paroled: "good", forcedOutByAdvancement: "warn", blocked: "warn",
      ejectedByMishap: "danger", died: "danger" };
    return [{ label: game.i18n.localize(MGT2.CareerEntryModes[system.entryMode] ?? ""), tone: "" },
      { label: game.i18n.localize(MGT2.CareerExitModes[system.exitMode] ?? ""), tone: exitTone[system.exitMode] ?? "" }]
      .filter(pill => pill.label);
  }

  #secondaryPills() {
    const { fittedHost: host, system } = this.item;
    if ( !host ) return null;
    const part = !(system.weight > 0) && !(system.cost > 0);
    return [{ label: game.i18n.format(part ? "MGT2.Items.PartOf" : "MGT2.Items.FittedToName", { name: host.name }),
      tooltip: part ? game.i18n.format("MGT2.Items.PartOfHint", { name: host.name }) : "" }];
  }

  /** The spine reads the sub-type where there is one, because that is the name on the character sheet. */
  #spine() {
    const item = this.item;
    // `TYPES.Item.container` disambiguates in the create dialog — too long to stand on a spine.
    if ( item.type === "container" ) return "MGT2.Items.Container";
    // A component's sub-type is its category, the word the ship's parts list prints.
    if ( item.type === "component" ) return MGT2.ComponentCategories[item.system.category] ?? "TYPES.Item.component";
    return SUBTYPES[item.type]?.[item.system.subType] ?? `TYPES.Item.${item.type}`;
  }

  /** The identity line under the name. */
  #tags() {
    const { type, system } = this.item;
    const tags = [];

    // A talent's level is not a tag: the pips beside the tags draw it, and the roll line states it.
    if ( (type === "talent") && system.skill.speciality
      && !MGT2Helper.nameStatesSpeciality(this.item.name, system.skill.speciality) ) {
      tags.push(system.skill.speciality);
    }
    if ( type === "weapon" ) tags.push(game.i18n.localize(MGT2.WeaponScales[system.scale]?.label ?? ""));
    if ( type === "career" ) tags.push(game.i18n.localize(MGT2.CareerKinds[system.kind] ?? ""));
    if ( type === "contract" ) {
      // The status is a state, so it is a pill under this line, and the line says each term once.
      tags.push(game.i18n.localize(MGT2.ContractClients[system.client] ?? ""));
      tags.push(game.i18n.localize((system.subject.kind === "person")
        ? MGT2.ContractWanted[system.alive] : "MGT2.Contract.ToBeFound"));
      if ( system.issued ) tags.push(`${game.i18n.localize("MGT2.Contract.Issued")} ${system.issued}`);
    }
    if ( type === "role" ) {
      tags.push(game.i18n.localize(MGT2.Departments[system.department] ?? ""));
      // The crew position, unless the name already says it (a talent's speciality follows the same rule).
      const key = system.crewRoleKey;
      if ( key && (system.constructor.matchCrewRole(this.item.name) !== key) ) {
        tags.push(game.i18n.localize(MGT2.CrewRoles[key]?.label ?? ""));
      }
    }
    if ( "tl" in system ) {
      // A component's TL is a number, as the ship's own is.
      const key = (typeof system.tl === "number") ? `TL${String(system.tl).padStart(2, "0")}` : system.tl;
      tags.push(game.i18n.localize(MGT2.TL[key] ?? ""));
    }
    if ( (type === "component") && (system.quantity > 1) ) tags.push(`×${system.quantity}`);
    return tags.filter(tag => tag !== "");
  }

  /** A talent's level as the character sheet's skill list draws it: four pips, filled up to it. */
  #level() {
    if ( this.item.type !== "talent" ) return null;
    const value = this.item.system.level ?? 0;
    return {
      value,
      zero: value <= 0,
      label: game.i18n.format("MGT2.Items.LevelValue", { level: value }),
      pips: Array.from({ length: Math.max(4, value) }, (_v, index) => index < value)
    };
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
    // Every other option in the list states the level it contributes; unskilled states its own —
    // which folio 69's Jack-of-All-Trades softens by a point per level, so the prompt's own reading
    // of the rule is what fills the row rather than a second copy of the DM−3.
    const untrained = RollPromptHelper.untrained(actor);
    return [{ _id: "NP", name: untrained.label + MGT2Helper.getDisplayDM(untrained.dm) }].concat(skills);
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
      const untrained = RollPromptHelper.untrained(actor);
      skill = untrained.label + MGT2Helper.getDisplayDM(untrained.dm);
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
   * Core folio 79: what Auto X buys this weapon, one line per mode.
   * @returns {string[]|null}   Null on anything that is not an Auto weapon
   */
  #fireModes() {
    // The loaded round's list: a grenade replaces the rifle's traits outright, so Auto goes with
    // them and the weapon offers no burst while that round is in it.
    const auto = (this.item.type === "weapon")
      ? MGT2Helper.traitScore(this.item.system.effective.traits, "auto") : 0;
    if ( auto <= 0 ) return null;
    return Object.values(MGT2.FireModes).map(mode => {
      const label = game.i18n.localize(mode.label);
      if ( !mode.rounds ) return label;
      return MGT2Helper.plural("MGT2.Items.FireModeCost", mode.rounds * auto, {
        mode: label,
        gain: mode.damage ? MGT2Helper.signed(auto)
          : game.i18n.format("MGT2.RollPrompt.FireModeAttacks", { count: auto }),
        rounds: mode.rounds * auto
      });
    });
  }

  /** What is in the magazine, the loaded round's spares, and what a reload costs and discards. */
  #ammo() {
    const { type, system } = this.item;
    // The loaded round's magazine, where one is loaded: a 40mm grenade takes the rifle from 40 to 1.
    const magazine = system.effective?.magazine ?? system.magazine;
    if ( (type !== "weapon") || !(magazine > 0) ) return null;
    // Core p.77 counts the shots: one null closes the loaded readout and the Reload button. The
    // round selector renders off `rounds` and is not gated here — a loaded round is a damage rule.
    if ( !Rules.on("magazines") ) return null;
    const full = system.ammo >= magazine;
    const actions = Math.max(1, MGT2Helper.traitScore(system.effective.traits, "slow-loader"));
    const { round, spare, refusal } = Magazines.spares(this.item);
    const lost = (round && !full && (system.ammo > 0)) ? MGT2Helper.plural("MGT2.Items.ReloadLost", system.ammo) : "";
    return {
      value: system.ammo,
      magazine,
      full,
      pips: cells(system.ammo, magazine),
      fill: Math.round(100 * Math.min(system.ammo, magazine) / magazine),
      round: round?.name ?? null,
      actions,
      spare,
      spareLabel: Number.isInteger(spare) ? MGT2Helper.plural("MGT2.Items.SpareMagazines", spare) : null,
      blocked: Boolean(refusal),
      hint: refusal ?? [round ? game.i18n.format("MGT2.Items.ReloadHint", { round: round.name, actions })
        : game.i18n.format("MGT2.Items.ReloadFree", { actions }), lost].filterJoin(" ")
    };
  }

  /** What the running software spends of the host's Processing; null where none is stated. */
  #processing() {
    const { type, system } = this.item;
    if ( !["computer", "armor", "equipment"].includes(type) ) return null;
    // A null test and not a truthy one: Computer/0 is a rating and prints as one.
    if ( (type !== "computer") && (system.processing === null) ) return null;
    const used = system.processingUsed ?? 0;
    const cap = system.processingCap ?? 0;
    return {
      used, cap,
      over: used > cap,
      cells: cells(used, cap),
      fill: cap ? Math.round(100 * Math.min(used, cap) / cap) : 0
    };
  }

  /** The printed reference as one line, from the two strings stored. @returns {string|null} */
  #citation() {
    const source = this.item.system.source;
    return [source?.book, source?.page].filter(half => half?.trim()).join(", ") || null;
  }

  /**
   * A ship component's plates — tons, cost, power and its rating — each with the arm and count behind
   * it, read as the ship's parts list reads the same row; and its critical and Hardened pills.
   */
  #component() {
    const item = this.item;
    if ( item.type !== "component" ) return null;
    const system = item.system;
    const loc = key => game.i18n.localize(key);
    const lang = game.i18n.lang;
    const number = value => Number(value).toLocaleString(lang, { maximumFractionDigits: 2 });
    const unit = text => `<span class="u">${foundry.utils.escapeHTML(text)}</span>`;
    const hull = item.actor?.system.hull?.tons ?? null;
    const q = Math.max(1, system.quantity);
    const tenth = value => Math.round(value * 10) / 10;
    const t = loc("MGT2.Actor.spacecraft.Tons");
    const each = loc("MGT2.Actor.spacecraft.Each");
    const { tons, percent, minimum } = system.tonnage;
    const software = system.category === "software";
    const plant = system.category === "powerPlant";
    const floor = `${loc("MGT2.Items.Minimum")} ${number(minimum)} ${t}`;
    const plates = [];

    if ( !software ) {
      const how = [];
      let value;
      let total;
      if ( hull ) {
        total = system.tonsFor(hull);
        value = `${number(tenth(total))}${unit(t)}`;
        // The arm that won `tonsFor`'s max, which is not always the one declared first.
        const share = (percent > 0) ? (hull * percent / 100) : 0;
        if ( (percent > 0) && (share >= Math.max(tons, minimum)) ) how.push(`${number(percent)} ${loc("MGT2.Items.PercentOfHull")}`);
        else if ( (percent > 0) && minimum && (minimum >= Math.max(tons, share)) ) how.push(floor);
      } else if ( percent > 0 ) {
        total = percent;
        value = `${number(percent)}${unit(loc("MGT2.Items.PercentOfHull"))}`;
        if ( minimum ) how.push(floor);
      } else {
        total = Math.max(tons, minimum) * q;
        value = `${number(tenth(total))}${unit(t)}`;
      }
      if ( (q > 1) && (hull || !(percent > 0)) ) how.push(`×${q} · ${number(tenth(total / q))} ${t} ${each}`);
      plates.push({ key: "tons", label: loc("MGT2.Items.Tons"), value, off: !total, how: how.join(" · ") });
    }

    plates.push({ key: "cost", label: loc("MGT2.Items.Cost"), value: `${unit(loc("MGT2.Design.MCr"))}${number(system.cost * q)}`,
      off: !system.cost, how: (q > 1) ? `${loc("MGT2.Design.MCr")}${number(system.cost)} ${each}` : "" });

    if ( !software ) {
      const draw = system.drawFor(hull ?? 0);
      const how = [];
      if ( system.powerPerTon ) how.push(`${number(system.powerPerTon)} ${loc("MGT2.Items.PowerPerTon")}`);
      if ( (q > 1) && system.power && !plant ) how.push(`−${number(system.power)} ${each}`);
      plates.push(plant
        ? { key: "power", label: loc("MGT2.Items.Power"), value: `+${number(system.generates)}`, off: !system.generates,
          tone: "gen", how: how.join(" · ") }
        : { key: "power", label: loc("MGT2.Items.Power"), value: `−${number(tenth(draw))}`, off: !draw, how: how.join(" · ") });
    }

    // A plant's rating is its output, which the Power plate already states.
    const ratingLabel = plant ? "MGT2.Actor.spacecraft.PowerPlant" : (RATING_LABELS[system.category] ?? "MGT2.Items.Rating");
    if ( !plant && (RATING_LABELS[system.category] || (system.rating > 0)) ) {
      const row = (system.category === "automation") ? MGT2.ShipAutomation.find(entry => entry.rating === system.rating) : null;
      plates.push({ key: "rating", label: loc(ratingLabel), off: !system.rating && !row,
        value: row ? `<span class="word">${foundry.utils.escapeHTML(loc(row.label))}</span>` : number(system.rating) });
    }

    return {
      plates, ratingLabel,
      pills: { critical: (system.dm > 0) ? { dm: system.dm, rungs: [1, 2, 3, 4, 5, 6].map(n => n <= system.dm) } : null,
        hardened: system.hardened },
      grades: [0, 1, 2, 3, 4, 5, 6].map(n => ({ n, checked: n === system.dm })),
      // A grade typed outside the strip rides a hidden rung, so a submit keeps it until one is clicked.
      stray: ((system.dm >= 0) && (system.dm <= 6)) ? null : system.dm
    };
  }

  /**
   * Core p.244 keeps a purchase column and a sale column and applies the **largest applicable** DM
   * rather than their sum, which is why each is a list of (trade code, DM) pairs.
   * @returns {object[]|null}
   */
  #tradeColumns() {
    if ( this.item.type !== "cargo" ) return null;
    const system = this.item.system;
    const named = rows => rows.map(row => ({ ...row, name: row.code ? game.i18n.localize(`MGT2.TradeCodes.${row.code}`) : "" }));
    const columns = [
      { property: "purchaseDM", label: "MGT2.Items.PurchaseDM", rows: named(system.purchaseDM) },
      { property: "saleDM", label: "MGT2.Items.SaleDM", rows: named(system.saleDM) }
    ];
    const count = columns.reduce((sum, column) => sum + column.rows.length, 0);
    return { columns, count, empty: count === 0 };
  }

  /**
   * A cargo lot's terms, plates, lateness and hold, read as the ship's manifest reads the same lot.
   * Freight is paid on delivery; a speculative lot was bought. The derived flag tells them apart.
   */
  #cargo() {
    const item = this.item;
    if ( item.type !== "cargo" ) return null;
    const s = item.system;
    const day = game.settings.get("mgt2", "campaignDay");
    const late = (s.dueDay !== null) && (day > s.dueDay);
    const terms = !s.speculative
      ? { label: "MGT2.Trade.Fare", field: "fare", value: s.fare, tooltip: "MGT2.Trade.Card.PaidOnDelivery", cost: s.paid }
      : ((s.paid !== null) ? { label: "MGT2.Items.Cost", field: "paid", value: s.paid, cost: null } : null);
    const actor = item.actor;
    let hold = null;
    if ( actor?.type === "spacecraft" ) {
      const cargo = actor.system.cargo;
      hold = MGT2Helper.holdMeter(actor, cargo, s.tons);
      // One lot bigger than the hull will never fit, which is the trade screen's own sentence.
      if ( s.tons > cargo.capacity ) hold.why = game.i18n.format("MGT2.Trade.HoldTooSmall", { tons: s.tons, capacity: cargo.capacity });
    }
    return {
      day, late, daysLate: late ? (day - s.dueDay) : 0, terms, hold,
      destination: s.speculative ? null : this.#reference({ uuid: s.destination.world, name: s.destination.name }),
      due: !s.speculative && (s.dueDay !== null), fare: !s.speculative && (s.farePerTon > 0),
      price: s.basePrice > 0, paid: s.purchasePct !== null
    };
  }

  /**
   * A role's actions grouped by the step of the round they belong to (Core p.164), reactions last
   * (p.171), each keeping its stored index: the roster and the combat screen address an action by it.
   */
  #stationActions() {
    if ( this.item.type !== "role" ) return null;
    const actions = this.item.system.actions;
    const read = (action, index) => ({
      index, label: action.label, weapon: action.kind === "weapon", special: action.kind === "special",
      skill: action.skill,
      short: action.characteristic ? game.i18n.localize(`MGT2.Characteristics.${action.characteristic}.short`) : "",
      characteristic: action.characteristic ? game.i18n.localize(MGT2.Characteristics[action.characteristic] ?? "") : "",
      dm: action.dm, dmText: MGT2Helper.signed(action.dm),
      difficulty: action.difficulty ? MGT2Helper.getDifficultyDisplay(action.difficulty) : null,
      cap: (action.cap && (action.cap !== "none")) ? game.i18n.localize(MGT2.ActionCaps[action.cap] ?? "") : null
    });
    const groups = ["manoeuvre", "attack", "actions", "reaction"].map((step, n) => ({
      step, number: (step === "reaction") ? null : n + 1, reaction: step === "reaction",
      label: (step === "reaction") ? "MGT2.SpaceCombat.Reactions" : MGT2.CombatSteps[step],
      actions: actions.map(read).filter((_row, index) => actions[index].step === step)
    })).filter(group => group.actions.length);
    return { count: actions.length, groups };
  }

  /** A booking's fare, destination, staterooms and the share of the hold its baggage takes. */
  #passage() {
    const item = this.item;
    if ( item.type !== "passage" ) return null;
    const s = item.system;
    const actor = item.actor;
    return {
      terms: (s.fare > 0) ? { fare: s.fare, perHead: s.farePerHead } : null,
      destination: this.#reference({ uuid: s.destination.world, name: s.destination.name }),
      staterooms: s.staterooms.toLocaleString(game.i18n.lang),
      // The ship counts baggage in tonnes of hold (Core p.238).
      hold: (actor?.type === "spacecraft") ? MGT2Helper.holdMeter(actor, actor.system.cargo, s.baggage / 1000) : null
    };
  }

  /** A booking's class under its name, and the revival check a low passage owes on arrival. */
  #passagePills() {
    const s = this.item.system;
    const pills = [{ label: game.i18n.localize(MGT2.PassageClasses[s.grade]?.label ?? ""), tone: "",
      tooltip: game.i18n.localize("MGT2.Items.PassageHint") }];
    if ( s.lowBerth ) {
      pills.push({ label: game.i18n.localize("MGT2.Trade.Card.RevivalCheck"), tone: "warn", dashed: true,
        tooltip: MGT2Helper.plural("MGT2.Trade.Card.Revival", s.count, { n: s.count }) });
    }
    return pills;
  }

  /** A cargo lot's states under its name: its kind, lateness, and the two bans. */
  #cargoPills() {
    const s = this.item.system;
    const loc = key => game.i18n.localize(key);
    const pills = [{ label: loc(s.speculative ? "MGT2.Trade.Speculation" : "MGT2.Trade.Freight"), tone: "", dashed: true,
      tooltip: loc("MGT2.Items.SpeculativeHint") }];
    const day = game.settings.get("mgt2", "campaignDay");
    if ( (s.dueDay !== null) && (day > s.dueDay) ) {
      const n = day - s.dueDay;
      pills.push({ label: MGT2Helper.plural("MGT2.Items.DaysLate", n, { n }), tone: "danger", dashed: true,
        tooltip: loc("MGT2.Actor.spacecraft.DeliverLate") });
    }
    if ( s.illegal ) pills.push({ label: loc("MGT2.Items.IllegalEverywhere"), tone: "danger" });
    if ( s.legality !== null ) pills.push({ label: `${loc("MGT2.Items.BannedAt")} ${s.legality}`, tone: "warn" });
    if ( s.spareParts ) pills.push({ label: loc("MGT2.Items.SpareParts"), tone: "", tooltip: loc("MGT2.Items.SparePartsHint") });
    return pills;
  }

  /** The trait arrays as shared code rows, one per array the schema declares. @returns {object[]} */
  #prepareTraits() {
    const { type, system } = this.item;
    const rows = [];
    const notes = (type === "weapon") ? "MGT2.Items.Notes" : "MGT2.Items.Options";
    const arrays = [["traits", "MGT2.Items.Traits"], ["options", notes]];
    if ( isAccessory(this.item) ) arrays.push(["accessory.traits", "MGT2.Items.Traits"]);
    for ( const [property, label] of arrays ) {
      // Most types carry neither array, and the context is built before the block list is consulted.
      if ( !system.schema.getField(property) ) continue;
      rows.push(prepareTraitBlock(foundry.utils.getProperty(system, property), property,
        this.#traitFamily(property), label, true));
    }
    return rows;
  }

  /** The vocabulary a row is typed in: a spacecraft-scale weapon's own traits are High Guard's. */
  #traitFamily(property) {
    const { type, system } = this.item;
    if ( (type === "weapon") && (property === "traits") && (system.scale === "spacecraft") ) return "shipWeapon";
    return system.schema.getField(property).element.fields.family.initial;
  }

  /** What this item holds: software loaded into a computer, items stored in a container, or what a weapon has fitted. */
  #prepareNested(actor) {
    const item = this.item;
    if ( item.type === "weapon" ) return this.#fittedRows();
    // A fitted augment with Processing hosts software exactly as a computer does.
    const isHost = MGT2Helper.runsSoftware(item);
    if ( !isHost && (item.type !== "container") ) return [];
    if ( this.#withheld ) return [];

    const held = isHost
      ? (actor?.items.filter(i => i.system.software?.computerId === item.id) ?? [])
      : item.contents;

    return held.map(sibling => ({
      _id: sibling.id,
      name: sibling.name,
      img: sibling.img,
      type: game.i18n.localize(`TYPES.Item.${sibling.type}`),
      bandwidth: sibling.system.software?.bandwidth ?? null,
      bandwidthRun: sibling.system.software?.bandwidthRun ?? null,
      downgraded: sibling.system.software?.downgraded === true,
      tlBlocked: sibling.system.software?.tlBlocked === true,
      quantity: sibling.system.quantity ?? null,
      weight: MGT2Helper.roundWeight(sibling.getTotalWeight()),
      held: (sibling.type === "container") ? sibling.system.count : null
    })).sort(MGT2Helper.compareByName);
  }

  /** A weapon's fitted Items; a second sight is marked idle, and a bipod's row carries its deployed toggle. */
  #fittedRows() {
    return (this.item.system.fitted ?? []).map(({ item: fitted, accessory, idle }) => ({
      _id: fitted.id,
      name: fitted.name,
      img: fitted.img,
      type: game.i18n.localize(SUBTYPES[fitted.type]?.[fitted.system.subType] ?? `TYPES.Item.${fitted.type}`),
      fits: fitted.system.accessory?.fits ?? "",
      idle,
      deploys: accessory?.steadies === "ignore",
      deployed: accessory?.deployed === true,
      weight: MGT2Helper.roundWeight(fitted.getTotalWeight())
    }));
  }

  /** What an accessory does to the weapon it is fitted to, as its sheet reads it. */
  #accessory() {
    const item = this.item;
    if ( !isAccessory(item) ) return null;
    const { accessory } = item.system;
    const host = item.fittedHost;
    return {
      host: host?.name ?? "",
      idle: Boolean(host?.system.fitted?.find(entry => entry.item === item)?.idle),
      steadies: accessory.steadies ? MGT2.AccessorySteadies[accessory.steadies] : "",
      attack: accessory.attack.map((row, index) => ({ ...row, index, display: MGT2Helper.signed(row.dm, "+0"),
        when: [(row.beyond !== null) && game.i18n.format("MGT2.Items.AttackFrom", { n: row.beyond }),
          (row.within !== null) && game.i18n.format("MGT2.Items.AttackUnder", { n: row.within })]
          .filter(Boolean).join(" · ") }))
    };
  }

  /** Each weapon of the owner this round is loaded in: what it holds, and every value the round changes. */
  #hosts() {
    const { item } = this;
    const actor = item.actor;
    if ( (item.type !== "ammunition") || !actor ) return null;
    const list = traits => traits.map(formatTrait).join(" · ");
    const credits = value => (Number.isFinite(value) ? `Cr ${MGT2Helper.credits(value)}` : "");
    return actor.items.filter(weapon => (weapon.type === "weapon") && (weapon.system.ammunition === item.id))
      .map(weapon => {
        const own = weapon.system;
        const eff = own.effective;
        // Fire control's Scope and a fitted accessory's grants are the weapon's whatever is loaded.
        const bare = own.unloaded;
        const rows = [
          ["MGT2.Items.Damage", bare.damage, eff.damage],
          ["MGT2.Items.Range", MGT2Helper.getRangeDisplay(bare.range), MGT2Helper.getRangeDisplay(eff.range)],
          ["MGT2.Items.Magazine", bare.magazine, eff.magazine],
          ["MGT2.Items.MagazineCost", credits(bare.magazineCost), credits(eff.magazineCost)],
          ["MGT2.Items.Traits", list(bare.traits), list(eff.traits)]
        ].filter(([, was, now]) => String(was ?? "") !== String(now ?? ""))
          .map(([label, was, now]) => ({ label, was: was || "—", now: now || "—" }));
        const ammo = (Rules.on("magazines") && (eff.magazine > 0)) ? { value: own.ammo, magazine: eff.magazine,
          pips: cells(own.ammo, eff.magazine), fill: Math.round(100 * Math.min(own.ammo, eff.magazine) / eff.magazine) }
          : null;
        return { id: weapon.id, name: weapon.name, ammo, rows };
      }).sort(MGT2Helper.compareByName);
  }

  /** A round's sheet reads its weapons, a weapon's its round's spares and lock; a reload renders its own weapon already. */
  #onHostUpdate = (other, change, options) => {
    if ( other.parent !== this.item.parent ) return;
    if ( this.item.type === "weapon" ) {
      const round = this.item.system.round;
      if ( ((other.id === round?.id) && (options.mgt2Reload !== this.item.id))
        || (foundry.utils.hasProperty(change, "system.locked") && round?.containerChain.some(c => c.id === other.id))
        || this.#fitsHere(other, change) ) {
        this.render();
      }
    }
    else if ( (other.type === "weapon") && ((other.system.ammunition === this.item.id)
      || foundry.utils.hasProperty(change, "system.ammunition")) ) this.render();
  };

  #fitsHere(other, change = {}) {
    return (other.system.fittedTo === this.item.id) || foundry.utils.hasProperty(change, "system.fittedTo");
  }

  /** A fitted Item created or deleted elsewhere changes the weapon's list. */
  #onFittedChange = other => {
    if ( (other.parent === this.item.parent) && this.#fitsHere(other) ) this.render();
  };

  #hostHooks = [];

  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if ( !["ammunition", "weapon"].includes(this.item.type) || !this.item.actor ) return;
    this.#hostHooks.push(["updateItem", Hooks.on("updateItem", this.#onHostUpdate)]);
    if ( this.item.type !== "weapon" ) return;
    for ( const hook of ["createItem", "deleteItem"] ) this.#hostHooks.push([hook, Hooks.on(hook, this.#onFittedChange)]);
  }

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    for ( const [hook, id] of this.#hostHooks ) Hooks.off(hook, id);
    this.#hostHooks = [];
  }

  /**
   * A container's state as its sheet reads it: whether the lock withholds it from this viewer, what
   * it holds, and whether its mass reaches the carrier's load, by the rule `prepareWeight` applies.
   */
  #bag(actor) {
    const item = this.item;
    if ( item.type !== "container" ) return null;
    const withheld = this.#withheld;
    const chain = [item, ...item.containerChain];
    return {
      withheld,
      count: withheld ? null : item.system.count,
      nested: Boolean(item.system.container?.id),
      carrier: Boolean(actor) && ("inventory" in actor.system),
      counted: !chain.some(bag => bag.system.weightless) && (chain.at(-1).system.onHand === true),
      canDrop: this.isEditable && !withheld
    };
  }

  /** The one event row open in edit mode, as `"eventTable.3"`. */
  #openRow = null;

  /** The career cells whose grants are open in edit mode, by `data-cell-path`. */
  #openCells = new Set();

  /** Opening an event row closes the other: the form keeps every control, CSS folds the rest. */
  static #onRowFold(event, target) {
    const row = target.closest(".entry[data-row-key]");
    const key = row?.dataset.rowKey;
    if ( !key ) return;
    this.#openRow = (this.#openRow === key) ? null : key;
    for ( const entry of this.element.querySelectorAll(".careerevents .entry[data-row-key]") ) {
      entry.classList.toggle("open", entry.dataset.rowKey === this.#openRow);
    }
  }

  /** A cell's grants fold behind their count; several may be open. */
  static #onCellFold(event, target) {
    const cell = target.closest(".cell[data-cell-path]");
    if ( !cell ) return;
    const path = cell.dataset.cellPath;
    if ( this.#openCells.has(path) ) this.#openCells.delete(path);
    else this.#openCells.add(path);
    cell.classList.toggle("open", this.#openCells.has(path));
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if ( this.#openRow ) this.element.querySelector(`.careerevents .entry[data-row-key="${this.#openRow}"]`)?.classList.add("open");
    for ( const path of this.#openCells ) {
      this.element.querySelector(`.cell[data-cell-path="${CSS.escape(path)}"]`)?.classList.add("open");
    }
    // A root part is unwrapped into the window content, so the sheet has no element of its own to
    // carry the variant: the application root does.
    this.element.classList.toggle("hazard", context.roll.hazard);
    const select = this.element.querySelector("[data-scale-select]");
    select?.addEventListener("change", () => this.#applyScale(select.value));
    // ⚠ This control binds to no field. Left to bubble, `submitOnChange` re-renders the sheet and
    // silently clears the choice before the button beside it is ever clicked.
    this.element.querySelector("[data-rep-circumstance]")
      ?.addEventListener("change", event => event.stopPropagation());
    bindTraitInput(this.element, (property, text) => this.#addTrait(property, text));
  }

  async #addTrait(property, text) {
    await this.submit();
    const entries = appendTraitText(foundry.utils.getProperty(this.item.system, property), text, this.#traitFamily(property));
    if (entries) await this.item.update({ [`system.${property}`]: entries });
  }

  /**
   * Fire control and power draw exist only above ground scale, and the scale also decides which
   * unit the range field speaks.
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

  /** Replaces `_getSubmitData` of the V1 sheet. @inheritDoc */
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
        const wasLoose = this.item.system.container.id === "";
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
    // A component's MCr cost carries decimals, so the schema decides whether it is truncated.
    if ( system?.cost !== undefined ) {
      system.cost = this.item.system.schema.fields.cost.integer
        ? MGT2Helper.getIntegerFromInput(system.cost) : MGT2Helper.getNumberFromInput(system.cost);
    }

    for ( const path of STRING_LISTS ) {
      const list = foundry.utils.getProperty(system ?? {}, path);
      if ( list ) foundry.utils.setProperty(system, path, compact(list));
    }
    for ( const path of TRACK_LISTS ) {
      for ( const track of Object.values(foundry.utils.getProperty(system ?? {}, path) ?? {}) ) {
        if ( track?.values ) track.values = compact(track.values);
      }
    }
    // The same convention one level down again: the skills a declared step's check names,
    // and the ones a standing modifier reads its DM off.
    for ( const step of Object.values(system?.frame?.steps ?? {}) ) {
      if ( step?.check?.skills ) step.check.skills = compact(step.check.skills);
    }
    for ( const law of Object.values(system?.backgroundSkills ?? {}) ) {
      if ( law?.mandatory ) law.mandatory = compact(law.mandatory);
      if ( law?.choices ) law.choices = compact(law.choices);
    }
    for ( const path of STANDING_LISTS ) {
      for ( const entry of Object.values(foundry.utils.getProperty(system ?? {}, path) ?? {}) ) {
        if ( entry?.skills ) entry.skills = compact(entry.skills);
      }
    }

    splitTypedLists(system);

    // The chip row lets a printed parameter be retyped; the number a rule reads follows from it.
    for ( const property of ["traits", "options", "accessory.traits"] ) {
      refreshTraitNumbers(foundry.utils.getProperty(system ?? {}, property));
    }

    return submitData;
  }

  /**
   * Append an entry to an indexed collection stored on the item, saving pending form edits first.
   * @param {string} property   The system property holding the collection
   * @param {object} blank      The entry to append
   */
  static async #appendEntry(property, blank) {
    await this.submit();
    const source = this.item.toObject().system;
    const current = Object.values(foundry.utils.getProperty(source, property) ?? []);
    return TravellerItemSheet.#writeCollection.call(this, source, property, [...current, blank]);
  }

  /**
   * Remove one entry from an indexed collection stored on the item.
   * @param {string} property   The system property holding the collection
   * @param {number} index      The index to drop
   */
  static async #removeEntry(property, index) {
    await this.submit();
    const source = this.item.toObject().system;
    const current = Object.values(foundry.utils.getProperty(source, property) ?? []);
    return TravellerItemSheet.#writeCollection.call(this, source, property,
      current.filter((_v, i) => i !== index));
  }

  /**
   * Write a collection back, addressed at the **outermost array on its path** and carrying that
   * array whole.
   * @param {object} source     The item's system source, mutated and then written
   * @param {string} property   The dotted path of the collection
   * @param {Array} next        What it becomes
   */
  static async #writeCollection(source, property, next) {
    foundry.utils.setProperty(source, property, next);
    const parts = property.split(".");
    const indexed = parts.findIndex(part => /^\d+$/.test(part));
    const root = (indexed < 0) ? property : parts.slice(0, indexed).join(".");
    return this.item.update({ [`system.${root}`]: foundry.utils.getProperty(source, root) });
  }

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

  /**
   * Add a row to any indexed collection, the path coming from the DOM rather than from a handler
   * per array — a career template has eighteen of them and four are nested two deep.
   */
  static #onEntryCreate(event, target) {
    const property = target.closest("[data-property]")?.dataset.property;
    if ( !property ) return;
    const blank = target.dataset.blank;
    return TravellerItemSheet.#appendEntry.call(this, property,
      (blank === undefined) ? {} : JSON.parse(blank));
  }

  /** @this {TravellerItemSheet} */
  static #onEntryDelete(event, target) {
    const row = target.closest("[data-entry-index]");
    const property = row?.closest("[data-property]")?.dataset.property;
    if ( !property ) return;
    return TravellerItemSheet.#removeEntry.call(this, property, Number(row.dataset.entryIndex));
  }

  /**
   * Seed the frame's step list with the Core sequence so a referee editing one term step does not
   * retype the other nine.
   */
  static async #onStepsDeclare() {
    await this.submit();
    return this.item.update({
      "system.frame.steps": MGT2.CoreTermSequence.map(key => ({ key })) });
  }

  /** @this {TravellerItemSheet} */
  static async #onStepsDefault() {
    await this.submit();
    return this.item.update({ "system.frame.steps": [] });
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

  /**
   * Purchase and sale are two columns of the same table (Core p.244), so the row goes to whichever
   * one asked for it rather than to a handler each.
   */
  static #onTradeDMCreate(event, target) {
    const property = target.closest("[data-property]").dataset.property;
    return TravellerItemSheet.#appendEntry.call(this, property, { code: "", dm: 0 });
  }

  /** @this {TravellerItemSheet} */
  static #onTradeDMDelete(event, target) {
    const element = target.closest("[data-dm-index]");
    const property = element.closest("[data-property]").dataset.property;
    return TravellerItemSheet.#removeEntry.call(this, property, Number(element.dataset.dmIndex));
  }

  /** @this {TravellerItemSheet} */
  static #onRuleDelete(event, target) {
    const element = target.closest("[data-rule-index]");
    return TravellerItemSheet.#removeEntry.call(this, "rules", Number(element.dataset.ruleIndex));
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

  /**
   * The roll belongs to the character sheet: it owns the characteristics, the skill list and the
   * Effect card.
   */
  static #onItemRoll(event, target) {
    const sheet = this.item.actor?.sheet;
    let handler = sheet?.options.actions?.roll;
    if ( typeof handler === "object" ) handler = handler.handler;
    if ( typeof handler !== "function" ) return;
    return handler.call(sheet, event, target);
  }

  /** A dose is taken, not equipped — everything that follows from that is in `doses.js`. */
  static async #onDoseTake() {
    await Doses.take(this.item);
    return this.render();
  }

  /** The count lives on the Traveller, whose update does not reach this sheet. */
  static async #onDoseCountReset() {
    await Doses.reset(this.item.actor, this.item.name);
    return this.render();
  }

  /** Core folio 77: a spare magazine "will fully reload the weapon", so the whole capacity goes back in. */
  static #onReload() {
    return Magazines.reload(this.item);
  }

  /** The round select binds to no field: picking a round is a reload, and a refused one redraws the select. @inheritDoc */
  async _onChangeForm(formConfig, event) {
    if ( !event.target.matches?.("select.loadedround") ) return super._onChangeForm(formConfig, event);
    if ( !(await Magazines.load(this.item, event.target.value)) ) return this.render();
  }

  /**
   * A contents row stands for a sibling document, not for anything embedded in this item, so what
   * leaves the sheet is that sibling's own drag data.
   * @inheritDoc
   */
  async _onDragStart(event) {
    const nested = TravellerItemSheet.#nestedItem.call(this, event.currentTarget);
    if ( !nested ) return super._onDragStart(event);
    event.dataTransfer.setData("text/plain", JSON.stringify(nested.toDragData()));
  }

  /**
   * A contract is handed over at OWNER so the PARTY can roll folio 10's two rules; every stored row
   * stays the GM's, refused at the server by `gmOnlyFields`. Offering a player the edit toggle and
   * the drop zones therefore only offers what always fails, so the sheet stops offering them.
   * @inheritDoc
   */
  get canEditContent() {
    return super.canEditContent && ((this.item.type !== "contract") || game.user.isGM);
  }

  /** Storing something is a drop on the container's own sheet. @inheritDoc */
  async _onDrop(event) {
    const data = MGT2Helper.getDataFromDropEvent(event);
    const container = this.item;
    if ( (container.type === "contract") && (data?.type === "Actor") ) {
      return this.#onDropPerson(event, data);
    }
    if ( (container.type === "contact") && (data?.type === "Actor") ) return this.#onDropContactActor(data);
    if ( (container.type === "weapon") && (data?.type === "Item") ) return this.#onDropFit(data);
    if ( (container.type !== "container") || (data?.type !== "Item") ) return super._onDrop(event);
    if ( !this.isEditable ) return;
    if ( Hooks.call("dropItemSheetData", container, this, data) === false ) return;

    // Only what carries a storage reference can be stored: a career or a skill has nowhere to put.
    const dropped = await getDocumentClass("Item").fromDropData(data);
    if ( !dropped || !("container" in dropped.system) ) return;

    if ( container.isLocked && !game.user.isGM ) {
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

  /** An accessory or a secondary dropped on an owned weapon's sheet is fitted to it; one from elsewhere is copied in fitted. */
  async #onDropFit(data) {
    const weapon = this.item;
    if ( !this.isEditable || !weapon.actor ) return false;
    if ( Hooks.call("dropItemSheetData", weapon, this, data) === false ) return false;
    const dropped = await getDocumentClass("Item").fromDropData(data);
    if ( !fitsWeapon(dropped) || (dropped === weapon) ) return false;
    if ( dropped.parent !== weapon.parent ) {
      if ( secondaryRefused(dropped, weapon, await dropped.getFitted()) ) {
        return ui.notifications.error(game.i18n.localize("MGT2.Errors.FitDepth"));
      }
      await getDocumentClass("Item").createDocuments(await copyItemWithContents(dropped, "", 0, weapon.id),
        { parent: weapon.parent, keepId: true });
    }
    else if ( dropped.system.fittedTo !== weapon.id ) await dropped.update({ "system.fittedTo": weapon.id });
    return this.render();
  }

  /**
   * A person dropped on a contract fills whichever slot they landed on. The stored uuid is the
   * WORLD Actor: a contract names a person, not an instance on a map, so a token resolves to its
   * base — the distinction `lines[].actor` shipped a release blocker on.
   */
  async #onDropPerson(event, data) {
    if ( !this.canEditContent ) return false;
    const dropped = await fromUuid(data.uuid);
    const actor = dropped?.isToken ? dropped.token?.baseActor ?? dropped : dropped;
    if ( !["character", "npc"].includes(actor?.type) ) {
      ui.notifications.warn(game.i18n.localize("MGT2.Contract.NotAPerson"));
      return false;
    }
    const slot = event.target.closest("[data-reference]")?.dataset.reference;
    if ( !slot ) return false;
    const reference = { uuid: actor.uuid, name: actor.name };

    if ( slot === "associate" ) {
      const index = Number(event.target.closest("[data-row-index]")?.dataset.rowIndex ?? -1);
      const parties = this.item.system.parties.map(party => ({ ...party }));
      if ( parties[index] ) parties[index].person = reference;
      else parties.push({ relation: "", person: reference, note: "" });
      await this.item.update({ "system.parties": parties });
      return true;
    }
    const path = { subject: "system.subject.person", issuer: "system.employer.person",
      hunter: "system.hunter" }[slot];
    if ( !path ) return false;
    await this.item.update({ [path]: reference });
    return true;
  }

  /** The Actor a contact is, once the referee statblocks them or the contact is a Traveller at the table. */
  async #onDropContactActor(data) {
    if ( !this.isEditable ) return false;
    const dropped = await fromUuid(data.uuid);
    const actor = dropped?.isToken ? dropped.token?.baseActor ?? dropped : dropped;
    if ( !["character", "npc"].includes(actor?.type) ) {
      ui.notifications.warn(game.i18n.localize("MGT2.Contact.NotAPerson"));
      return false;
    }
    await this.item.update({ "system.actor": actor.uuid });
    return true;
  }

  /** @this {TravellerItemSheet} */
  static async #onContactUnlink() {
    return this.item.update({ "system.actor": null });
  }

  /** A zone refuses at the pointer or not at all. @inheritDoc */
  _onDragOver(event) {
    const zone = event.target.closest("[data-accept]");
    if ( !zone ) return super._onDragOver(event);
    const accepted = MGT2Helper.dropAccepted(zone);
    zone.classList.toggle("over", accepted);
    zone.classList.toggle("deny", !accepted);
  }

  /** A stored reference opened by whoever can see it. @this {TravellerItemSheet} */
  static async #onOpenReference(event, target) {
    const document = await fromUuid(target.dataset.uuid);
    return document?.sheet?.render({ force: true });
  }

  /**
   * Folio 18's handover, and the one job ownership does on this type. Held back, the party's client
   * never receives the document; handed over, it receives all of it.
   * @this {TravellerItemSheet}
   */
  static async #onContractHandover() {
    const given = !this.item.system.given;
    const update = { "system.given": given };
    // An embedded Item inherits its Actor's ownership and can express neither state.
    if ( !this.item.isEmbedded ) {
      update["ownership.default"] = given
        ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
    }
    return this.item.update(update);
  }

  /** Showing one of folio 19's rows to the party, which is a stored fact. @this {TravellerItemSheet} */
  static async #onContractShow(event, target) {
    await this.submit();
    const index = Number(target.closest("[data-row-index]").dataset.rowIndex);
    const rows = this.item.system.referee.map((row, at) =>
      ((at === index) ? { ...row, shown: !row.shown } : { ...row }));
    return this.item.update({ "system.referee": rows });
  }

  /** @this {TravellerItemSheet} */
  static #onContractNegotiate() {
    return Contract.negotiate(this.item);
  }

  /** @this {TravellerItemSheet} */
  static #onContractQualify() {
    return Contract.qualify(this.item);
  }

  /** The circumstances are chosen at the moment of the roll and stored nowhere. @this {TravellerItemSheet} */
  static #onContractRepChange() {
    const chosen = [...this.element.querySelectorAll("[data-rep-circumstance] input:checked")].map(input => input.value);
    return Contract.reputationChange(this.item, ...chosen);
  }

  /** @this {TravellerItemSheet} */
  static async #onContractGenerate() {
    await this.submit();
    const log = await Contract.generate(this.item);
    if ( log ) this.#drawLog = log;
    return this.render();
  }

  /** The sibling document a nested row stands for. @this {TravellerItemSheet} */
  static #nestedItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return id ? this.item.siblings?.get(id) : null;
  }

  /** @this {TravellerItemSheet} */
  static #onNestedEdit(event, target) {
    return TravellerItemSheet.#nestedItem.call(this, target)?.sheet.render({ force: true });
  }

  /** A sibling changing is not a change to this item, so nothing re-renders the list on its own. */
  static async #onNestedRemove(event, target) {
    const field = (this.item.type === "weapon") ? "system.fittedTo"
      : MGT2Helper.runsSoftware(this.item) ? "system.software.computerId" : "system.container.id";
    await TravellerItemSheet.#nestedItem.call(this, target)?.update({ [field]: "" });
    return this.render();
  }

  /** CSC folio 174: a bipod counts only while it is set up, which is the player's to say in play. */
  static async #onFittedDeploy(event, target) {
    const fitted = TravellerItemSheet.#nestedItem.call(this, target);
    await fitted?.update({ "system.accessory.deployed": !fitted.system.accessory.deployed });
  }

  /** @this {TravellerItemSheet} */
  static async #onNestedDelete(event, target) {
    await TravellerItemSheet.#nestedItem.call(this, target)?.delete();
    return this.render();
  }
}
