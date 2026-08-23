import { MGT2 } from "./config.js";
import { Chargen } from "./chargen.js";
import { Contract } from "./contract.js";
import { Doses } from "./doses.js";
import { EFFECT_ACTIONS, prepareEffects } from "./effects.js";
import { MGT2Helper } from "./helper.js";
import { copyItemWithContents } from "./item.js";
import { RollPromptHelper } from "./roll-prompt.js";
import { Rules } from "./rules.js";
import { SheetModeMixin } from "./sheet-mode.js";
import { appendTraitText, bindTraitInput, prepareTraitBlock, refreshTraitNumbers } from "./traits.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Every block the sheet can compose from; each one is a partial of the same name. */
const BLOCKS = ["roll", "hazard", "specs", "carried", "traits", "rules", "relationship", "description",
  "detail", "notes", "software", "contents", "trade", "events", "station", "actions", "effects",
  "career", "careertables", "species", "speciesframe",
  "bounty", "referee", "leads", "associates", "generate"];

const blockPath = id => `systems/mgt2/templates/items/blocks/${id}.html`;

/** Which tab holds each block. */
const SLOT = {
  roll: "masthead", hazard: "masthead",
  specs: "details", relationship: "details", station: "details", career: "details",
  species: "details",
  // A round's printed rules are what the trait vocabulary cannot say, so they sit beside it.
  traits: "traits", rules: "traits",
  contents: "contents", software: "contents", events: "contents", actions: "contents",
  trade: "contents", carried: "contents", careertables: "contents", speciesframe: "contents",
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
const TEMPLATE_ONLY = new Set(["career", "careertables"]);
const RECORD_ONLY = new Set(["events"]);

/**
 * Bounty Hunter p.19's rows and p.22's generator are the referee's; the party gets `leads`, which
 * draws only the rows already shown. The referee tab is not thinned for a player — it is not built.
 */
const GM_ONLY = new Set(["referee", "generate"]);
const PLAYER_ONLY = new Set(["leads"]);

/** Blocks whose heading only repeats the nav entry above it, so alone in a tab they drop it. */
const EPONYMOUS = new Set(["effects", "description", "contents"]);

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

/**
 * A declared step's check as the book prints it — `Patriarchy 4+`, `Caste 2+`, `Patriarchy, by SOC`
 * — or nothing at all where the frame declares no check.
 * @returns {string}
 */
function stepCheckSummary(check) {
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

/** The sub-type dictionary that names each type, where it has one. */
const SUBTYPES = {
  item: MGT2.ItemSubType,
  equipment: MGT2.EquipmentSubType,
  talent: MGT2.TalentSubType,
  disease: MGT2.DiseaseSubType
};

/** The Traveller item sheet, shared by all item sub-types. @extends {ItemSheetV2} */
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
      nestedEdit: TravellerItemSheet.#onNestedEdit,
      nestedRemove: TravellerItemSheet.#onNestedRemove,
      nestedDelete: TravellerItemSheet.#onNestedDelete,
      openReference: TravellerItemSheet.#onOpenReference,
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
        "systems/mgt2/templates/items/parts/law-selectors.html",
        "systems/mgt2/templates/items/parts/specialised.html",
        // One reference shape, drawn four times on a contract.
        "systems/mgt2/templates/items/parts/person-ref.html"),
      // The masthead never scrolls, so the open tab is the only scroller — and `submitOnChange`
      // re-renders the whole sheet on every keystroke.
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
        { id: "description", cssClass: "item tab-select", icon: "fa-solid fa-book", label: "MGT2.Items.Description" },
        { id: "generate", cssClass: "item tab-select gmtab", icon: "fa-solid fa-dice", label: "MGT2.Contract.GenerateTab" },
        { id: "effects", cssClass: "item tab-select", icon: "fa-solid fa-person-rays", label: "MGT2.Effects.Title" }
      ]
    }
  };

  /** Which blocks each type carries, in render order. */
  static #BLOCKS_BY_TYPE = {
    _default: ["specs", "carried", "effects", "description"],
    weapon: ["roll", "specs", "carried", "traits", "effects", "description"],
    // Battle dress carries a computer; `#composition` drops the block on armour that hosts nothing.
    armor: ["specs", "carried", "traits", "effects", "description", "software"],
    talent: ["roll", "effects", "description"],
    "talent:psionic": ["roll", "specs", "effects", "description"],
    disease: ["hazard", "effects", "description"],
    computer: ["specs", "carried", "traits", "effects", "description", "software"],
    // A wafer jack is a computer as much as an implant, and so is a transceiver from TL10 up, so
    // equipment lists what it runs; `#composition` drops the block on one that hosts nothing.
    equipment: ["specs", "carried", "effects", "description", "software"],
    container: ["carried", "effects", "description", "contents"],
    // Both halves are listed and `#composition` drops the one this Item is not.
    career: ["specs", "career", "effects", "description", "careertables", "events"],
    // A contact is someone the Traveller KNOWS, and knowing someone moves no number on the sheet:
    // the relationship is the whole record, so there is nothing for a change to carry.
    contact: ["relationship", "description", "notes"],
    // The split is where the schema already splits: `frame.*` is the term this species runs and
    // everything beside it is what a Traveller of it rolls.
    species: ["specs", "species", "traits", "speciesframe", "effects", "description", "detail"],
    role: ["station", "actions", "effects", "description"],
    // The three ship-owned types are not carried by anyone, so none of them takes `carried` and
    // none shows a supply cell.
    cargo: ["specs", "trade", "effects", "description"],
    passage: ["specs", "effects", "description"],
    component: ["specs", "effects", "description"],
    ammunition: ["specs", "carried", "traits", "rules", "effects", "description"],
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
    let supply = false;

    for ( const id of list ) {
      if ( TEMPLATE_ONLY.has(id) && !item.system.isTemplate ) continue;
      if ( RECORD_ONLY.has(id) && item.system.isTemplate ) continue;
      if ( GM_ONLY.has(id) && !game.user.isGM ) continue;
      if ( PLAYER_ONLY.has(id) && game.user.isGM ) continue;
      if ( id === "carried" ) {
        supply = true;
        if ( item.type !== "container" ) continue;
      }
      // An augment is a host only while it is fitted and states Processing; one that is
      // neither has no software to list, and a `computer` always passes.
      if ( (id === "software") && !MGT2Helper.runsSoftware(item) ) continue;
      // A weapon declares both trait arrays and the sheet had one code row to spend, so the block
      // renders once per array rather than once per type.
      const rows = ((id === "traits") && traits) ? traits : [null];
      for ( const row of rows ) (slots[SLOT[id]] ??= []).push({ id, template: blockPath(id), row });
    }

    for ( const blocks of Object.values(slots) ) {
      if ( (blocks.length === 1) && EPONYMOUS.has(blocks[0].id) ) blocks[0].bare = true;
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

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const actor = item.actor;
    const traitRows = this.#prepareTraits();
    const { supply, slots } = this.#composition(traitRows);

    // The tab record is auto-prepared by ApplicationV2, there being one group; each entry carries
    // the blocks its body renders.
    for ( const tab of Object.values(context.tabs) ) tab.blocks = slots[tab.id];

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
      // Only the Companion's vacuum table reads a suit's breach, so only it puts the control up.
      showSuitBreach: (item.type === "armor") && (Rules.get("vacuumRuleset") === "companion"),
      binding: slots.masthead?.[0] ?? null,
      supply,
      spine: this.#spine(),
      tags: this.#tags(),
      subTypes: SUBTYPES[item.type] ?? null,
      hadContainer: actor != null,
      // A bag is offered neither itself nor anything already inside it.
      containers: actor ? [{ name: "", _id: "" }].concat(actor.getContainers()
        .filter(c => (c.id !== item.id) && !c.containerChain.some(p => p.id === item.id))) : null,
      computers: actor ? [{ name: "", _id: "" }].concat(actor.getComputers()) : null,
      // Every round the owner carries, whatever it says it fits: `weaponType` is free text because
      // no book prints a closed list, so it is a hint on the row and never a filter.
      rounds: (actor && (item.type === "weapon"))
        ? [{ name: game.i18n.localize("MGT2.Items.WeaponsOwn"), _id: "" }]
          .concat(actor.items.filter(entry => entry.type === "ammunition")) : null,
      // The counter lives on the Traveller, not on the drug, so that it survives the last dose
      // being swallowed — which is precisely when it matters most.
      doses: (item.type === "drug") ? Doses.countOf(actor, item.name) : null,
      weight: "weight" in item.system ? item.system.weight : null,
      unitlabels: { weight: MGT2Helper.getWeightLabel() },
      isGM: game.user.isGM,
      skills: this.#prepareSkills(actor),
      roll: this.#prepareRoll(actor),
      effects: prepareEffects(item),
      // A Set is neither an array nor a plain object, so Handlebars cannot walk it.
      damageTypes: Array.from(item.system.damageType ?? [], key => game.i18n.localize(MGT2.DamageTypes[key])),
      scale: MGT2.WeaponScales[item.system.scale] ?? null,
      fireModes: this.#fireModes(),
      ammo: this.#ammo(),
      destination: this.#destination(),
      citation: this.#citation(),
      componentTons: this.#componentTons(),
      componentCategories: TravellerItemSheet.#componentCategories(item.system.category),
      trade: this.#tradeColumns(),
      nested: this.#prepareNested(actor),
      careerTables: this.#careerTables(),
      careerIssues: this.#careerIssues(),
      eventTables: this.#eventTables(),
      speciesFrame: this.#speciesFrame(),
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
      short: (system.hunterRep !== null) && (system.hunterRep < system.repFloor),
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
      repDM: MGT2Helper.signed(Contract.repChangeDM(system.hunterRep ?? 0), "+0"),
      circumstances: Object.entries(MGT2.RepModification).map(([value, row]) => ({
        value, label: `${MGT2Helper.signed(row.dm)} · ${game.i18n.localize(row.label)}`
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
    return Contract.sequence.map(step =>
      ({ ...step, ...(drawn.find(row => row.step === step.step) ?? {}) }));
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
        summary: stepCheckSummary(step.check)
      })),
      without: Array.from(this.item.system.withoutCharacteristics,
        key => game.i18n.localize(MGT2.Characteristics[key])),
      matched: this.#matchedLaws()
    };
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

  /**
   * The categories a part may be, minus the ones behind a rule this table has not adopted — the one
   * already stored stays offered, so a switch turned off does not silently retype a fitted part.
   */
  static #componentCategories(current) {
    const optional = MGT2.OptionalComponentCategories;
    return Object.fromEntries(Object.entries(MGT2.ComponentCategories).filter(([key]) =>
      (key === current) || !optional[key] || Rules.on(optional[key])));
  }

  /**
   * The four skill tables as a list the template can walk, because `tables` is a SchemaField and
   * not an array — a career has these four slots or fewer, never a fifth, and `present` is what
   * says which exist rather than the key being absent.
   */
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

  /** Events and Mishaps are the same row shape twice over, differing only in what `ejects` defaults to. */
  #eventTables() {
    if ( (this.item.type !== "career") || !this.item.system.isTemplate ) return null;
    return [
      { key: "eventTable", label: "MGT2.Chargen.Template.EventTable", rows: this.item.system.eventTable },
      { key: "mishapTable", label: "MGT2.Chargen.Template.MishapTable", rows: this.item.system.mishapTable }
    ];
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
      if ( system.skill.speciality
        && !MGT2Helper.nameStatesSpeciality(this.item.name, system.skill.speciality) ) {
        tags.push(system.skill.speciality);
      }
      tags.push(`${game.i18n.localize("MGT2.Items.Level")} ${system.level}`);
    }
    if ( type === "weapon" ) tags.push(game.i18n.localize(MGT2.WeaponScales[system.scale]?.label ?? ""));
    if ( type === "contract" ) {
      tags.push(game.i18n.localize(MGT2.ContractClients[system.client] ?? ""));
      tags.push(game.i18n.localize(MGT2.JobStatus[system.status] ?? ""));
      tags.push(game.i18n.localize((system.subject.kind === "person")
        ? MGT2.ContractWanted[system.alive] : "MGT2.Contract.ToBeFound"));
    }
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

  /**
   * What is in the magazine, and what putting a full one in costs in actions.
   * @returns {{value: number, magazine: number, full: boolean, actions: number}|null}
   */
  #ammo() {
    const { type, system } = this.item;
    // The loaded round's magazine, where one is loaded: a 40mm grenade takes the rifle from 40 to 1
    // and every number on the weapon's own line is wrong while it is in there.
    const magazine = system.effective?.magazine ?? system.magazine;
    if ( (type !== "weapon") || !(magazine > 0) ) return null;
    // Core p.77 counts the shots: one null closes the loaded readout and the Reload button. The
    // round selector renders off `rounds` and is not gated here — a loaded round is a damage rule.
    if ( !Rules.on("magazines") ) return null;
    return {
      value: system.ammo,
      magazine,
      full: system.ammo >= magazine,
      round: system.round?.name ?? null,
      actions: Math.max(1, MGT2Helper.traitScore(system.effective.traits, "slow-loader"))
    };
  }

  /** Where a lot or a booking is bound for, as one name. @returns {string|null} */
  #destination() {
    const destination = this.item.system.destination;
    if ( !destination ) return null;
    const world = destination.world ? foundry.utils.fromUuidSync(destination.world) : null;
    return world?.name || destination.name || null;
  }

  /** The printed reference as one line, from the two strings stored. @returns {string|null} */
  #citation() {
    const source = this.item.system.source;
    return [source?.book, source?.page].filter(half => half?.trim()).join(", ") || null;
  }

  /**
   * The tonnage triple resolved against the hull this row is fitted to.
   * @returns {number|null}
   */
  #componentTons() {
    const item = this.item;
    if ( item.type !== "component" ) return null;
    const hull = item.actor?.system.hull?.tons;
    return hull ? Math.round(item.system.tonsFor(hull) * 10) / 10 : null;
  }

  /**
   * Core p.244 keeps a purchase column and a sale column and applies the **largest applicable** DM
   * rather than their sum, which is why each is a list of (trade code, DM) pairs.
   * @returns {object[]|null}
   */
  #tradeColumns() {
    if ( this.item.type !== "cargo" ) return null;
    const system = this.item.system;
    return [
      { property: "purchaseDM", label: "MGT2.Items.PurchaseDM", rows: system.purchaseDM },
      { property: "saleDM", label: "MGT2.Items.SaleDM", rows: system.saleDM }
    ];
  }

  /**
   * The trait arrays as shared code rows, one per array the schema declares.
   * @returns {object[]}
   */
  #prepareTraits() {
    const system = this.item.system;
    const rows = [];
    for ( const [property, label] of [["traits", "MGT2.Items.Traits"], ["options", "MGT2.Items.Options"]] ) {
      // Most types carry neither array, and the context is built before the block list is consulted.
      const field = system.schema.fields[property];
      if ( !field ) continue;
      rows.push(prepareTraitBlock(system[property], property, field.element.fields.family.initial, label));
    }
    return rows;
  }

  /** What this item holds: software loaded into a computer, or items stored in a container. */
  #prepareNested(actor) {
    const item = this.item;
    // A fitted augment with Processing hosts software exactly as a computer does.
    const isHost = MGT2Helper.runsSoftware(item);
    if ( !isHost && (item.type !== "container") ) return [];

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
    // ⚠ This control binds to no field. Left to bubble, `submitOnChange` re-renders the sheet and
    // silently clears the choice before the button beside it is ever clicked.
    this.element.querySelector("[data-rep-circumstance]")
      ?.addEventListener("change", event => event.stopPropagation());
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
    // A ship component is priced in MCr and carries decimals, so the conversion asks the schema
    // rather than the field's name — truncating it silently costs a drive most of its price.
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

    // The chip row lets a printed parameter be retyped; the number a rule reads follows from it.
    for ( const property of ["traits", "options"] ) refreshTraitNumbers(system?.[property]);

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

  /**
   * Core folio 77: a spare magazine "will fully reload the weapon", so the whole capacity goes back
   * in and there is nothing to count.
   */
  /** A dose is taken, not equipped — everything that follows from that is in `doses.js`. */
  static #onDoseTake() {
    return Doses.take(this.item);
  }

  static #onReload() {
    return this.item.update({ "system.loaded": this.item.system.effective.magazine });
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
    const select = this.element.querySelector("[data-rep-circumstance]");
    const chosen = [...(select?.selectedOptions ?? [])].map(option => option.value);
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
    const field = MGT2Helper.runsSoftware(this.item)
      ? "system.software.computerId" : "system.container.id";
    await TravellerItemSheet.#nestedItem.call(this, target)?.update({ [field]: "" });
    return this.render();
  }

  /** @this {TravellerItemSheet} */
  static async #onNestedDelete(event, target) {
    await TravellerItemSheet.#nestedItem.call(this, target)?.delete();
    return this.render();
  }
}
