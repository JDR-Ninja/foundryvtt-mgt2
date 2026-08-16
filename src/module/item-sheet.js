import { MGT2 } from "./config.js";
import { Doses } from "./doses.js";
import { EFFECT_ACTIONS, prepareEffects } from "./effects.js";
import { MGT2Helper } from "./helper.js";
import { copyItemWithContents } from "./item.js";
import { RollPromptHelper } from "./roll-prompt.js";
import { SheetModeMixin } from "./sheet-mode.js";
import { appendTraitText, bindTraitInput, prepareTraitBlock, refreshTraitNumbers } from "./traits.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Every block the sheet can compose from; each one is a partial of the same name. */
const BLOCKS = ["roll", "hazard", "specs", "carried", "traits", "rules", "relationship", "description",
  "detail", "notes", "software", "contents", "trade", "events", "station", "actions", "effects"];

const blockPath = id => `systems/mgt2/templates/items/blocks/${id}.html`;

/**
 * Which tab holds each block. `masthead` is not a tab: the roll binding is lifted above the strip so
 * it stays on screen from every one of them. The map is TOTAL over `BLOCKS` — a block with no slot
 * would silently stop rendering on every type, so the omission is caught at load instead.
 */
const SLOT = {
  roll: "masthead", hazard: "masthead",
  specs: "details", relationship: "details", station: "details",
  // A round's printed rules are what the trait vocabulary cannot say, so they sit beside it.
  traits: "traits", rules: "traits",
  contents: "contents", software: "contents", events: "contents", actions: "contents",
  trade: "contents", carried: "contents",
  effects: "effects",
  description: "description", detail: "description", notes: "description"
};

for ( const id of BLOCKS ) {
  if ( !(id in SLOT) ) throw new Error(`MGT2 | the item sheet block "${id}" has no tab slot.`);
}

/** Blocks whose heading only repeats the nav entry above it, so alone in a tab they drop it. */
const EPONYMOUS = new Set(["effects", "description", "contents"]);

/** The sub-type dictionary that names each type, where it has one. */
const SUBTYPES = {
  item: MGT2.ItemSubType,
  equipment: MGT2.EquipmentSubType,
  talent: MGT2.TalentSubType,
  disease: MGT2.DiseaseSubType
};

/**
 * The Traveller item sheet, shared by all item sub-types.
 *
 * One root template for every type: the types differ by which blocks they carry, not by which
 * layout they need, so the per-type work is a list of block names and nothing else.
 *
 * @extends {ItemSheetV2}
 * @mixes HandlebarsApplication
 */
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
      tradeDMCreate: TravellerItemSheet.#onTradeDMCreate,
      tradeDMDelete: TravellerItemSheet.#onTradeDMDelete,
      ruleDelete: TravellerItemSheet.#onRuleDelete,
      itemRoll: TravellerItemSheet.#onItemRoll,
      reload: TravellerItemSheet.#onReload,
      doseTake: TravellerItemSheet.#onDoseTake,
      nestedEdit: TravellerItemSheet.#onNestedEdit,
      nestedRemove: TravellerItemSheet.#onNestedRemove,
      nestedDelete: TravellerItemSheet.#onNestedDelete,
      ...EFFECT_ACTIONS
    }
  };

  /**
   * One root part, unwrapped into `.window-content`. That is what makes `.window-content` the form
   * element, which is what lets the masthead carry `weight` — a bare input outside the schema, see
   * `_processFormData`. Promoting the masthead to a part of its own breaks that round trip silently.
   * @inheritDoc
   */
  static PARTS = {
    sheet: {
      root: true,
      template: "systems/mgt2/templates/items/item-sheet.html",
      templates: BLOCKS.map(blockPath).concat("systems/mgt2/templates/actors/parts/tabs-nav.html"),
      // The masthead never scrolls, so the open tab is the only scroller — and `submitOnChange`
      // re-renders the whole sheet on every keystroke.
      scrollable: ['.tab[data-group="item"].active']
    }
  };

  /**
   * The five tabs, in nav order. Which of them render varies per document: a slot no block fills
   * gets neither a nav entry nor a body, so no `initial` is declared here — the first surviving tab
   * is it. `effects` and `description` are on every type's list, so there is always one.
   *
   * Effects sits last on every sheet in the system, the character sheet included: it is the one tab
   * that is about what is being done *to* the document rather than what the document is.
   * @inheritDoc
   */
  static TABS = {
    item: {
      tabs: [
        { id: "details", cssClass: "item tab-select", icon: "fa-solid fa-gear", label: "MGT2.Items.Details" },
        { id: "traits", cssClass: "item tab-select", icon: "fa-solid fa-tag", label: "MGT2.Items.Traits" },
        { id: "contents", cssClass: "item tab-select", icon: "fa-solid fa-box-open", label: "MGT2.Items.Contents" },
        { id: "description", cssClass: "item tab-select", icon: "fa-solid fa-book", label: "MGT2.Items.Description" },
        { id: "effects", cssClass: "item tab-select", icon: "fa-solid fa-person-rays", label: "MGT2.Effects.Title" }
      ]
    }
  };

  /**
   * Which blocks each type carries, in render order. Keyed by type, or by `type:subType` where the
   * sub-type changes the answer. A type absent from the map uses `_default`.
   *
   * `effects` is on every list, empty or not: any Item can carry an ActiveEffect and any of them
   * transfers to the owner, so a type that never shows the block is a type whose effects are
   * invisible.
   */
  static #BLOCKS_BY_TYPE = {
    _default: ["specs", "carried", "effects", "description"],
    weapon: ["roll", "specs", "carried", "traits", "effects", "description"],
    armor: ["specs", "carried", "traits", "effects", "description"],
    talent: ["roll", "effects", "description"],
    "talent:psionic": ["roll", "specs", "effects", "description"],
    disease: ["hazard", "effects", "description"],
    computer: ["specs", "carried", "traits", "effects", "description", "software"],
    container: ["carried", "effects", "description", "contents"],
    career: ["specs", "effects", "description", "events"],
    contact: ["relationship", "effects", "description", "notes"],
    species: ["specs", "traits", "effects", "description", "detail"],
    role: ["station", "actions", "effects", "description"],
    // The three ship-owned types are not carried by anyone, so none of them takes `carried` and none
    // shows a supply cell. `drug` is deliberately absent: a dose is carried, priced and counted, so
    // the default list is already the right one for it.
    cargo: ["specs", "trade", "effects", "description"],
    passage: ["specs", "effects", "description"],
    component: ["specs", "effects", "description"],
    ammunition: ["specs", "carried", "traits", "rules", "effects", "description"]
  };

  /* -------------------------------------------- */

  /**
   * The blocks this document carries, grouped into the tab each one belongs in.
   *
   * `carried` is the block that dissolved: its inventory line is the masthead's supply cell and its
   * TL, legality and weightless join Specs, so what the partial still draws is a container's own
   * storage properties — nothing at all on anything else.
   *
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
      if ( id === "carried" ) {
        supply = true;
        if ( item.type !== "container" ) continue;
      }
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

  /* -------------------------------------------- */

  /**
   * The tab set varies per document, so the declared list is filtered down to the slots this item's
   * blocks fill and `initial` follows it. v14 reads both from here: `_prepareTabs`
   * (`client/applications/api/application.mjs`) destructures `{tabs, labelPrefix, initial}` off this
   * method, which is also where FilePicker varies its own source tabs.
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
   * `_prepareTabs` fills `tabGroups[group]` with `??=`, so a stored id outlives the tab that carried
   * it: turn a talent from psionic to skill and Details is gone while the group still points at it,
   * leaving a blank body under a strip with nothing active. Reset only when the id is genuinely
   * absent — a blanket reset would bounce the user off the tab they are typing in, on every
   * `submitOnChange` re-render.
   * @inheritDoc
   */
  _prepareTabs(group) {
    if ( group === "item" ) {
      const { tabs } = this._getTabsConfig(group);
      if ( !tabs.some(tab => tab.id === this.tabGroups[group]) ) this.tabGroups[group] = null;
    }
    return super._prepareTabs(group);
  }

  /* -------------------------------------------- */

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
      // no book prints a closed list, so it is a hint on the row and never a filter (§9.90).
      rounds: (actor && (item.type === "weapon"))
        ? [{ name: game.i18n.localize("MGT2.Items.WeaponsOwn"), _id: "" }]
          .concat(actor.items.filter(entry => entry.type === "ammunition")) : null,
      // The counter lives on the Traveller, not on the drug, so that it survives the last dose
      // being swallowed — which is precisely when it matters most (§9.90).
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
      trade: this.#tradeColumns(),
      nested: this.#prepareNested(actor)
    });
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
   * Core folio 79: what Auto X buys this weapon, one line per mode. **There is no fire-mode field
   * and there will not be one** — the folio makes the mode a choice per pull of the trigger, so it
   * is the prompt's control and the sheet's job is to state what each mode costs in rounds against
   * the magazine printed beside it.
   * @returns {string[]|null}   Null on anything that is not an Auto weapon
   */
  #fireModes() {
    // The loaded round's list: a grenade replaces the rifle's traits outright, so Auto goes with
    // them and the weapon offers no burst while that round is in it (§9.90).
    const auto = (this.item.type === "weapon")
      ? MGT2Helper.traitScore(this.item.system.effective.traits, "auto") : 0;
    if ( auto <= 0 ) return null;
    return Object.values(MGT2.FireModes).map(mode => {
      const label = game.i18n.localize(mode.label);
      if ( !mode.rounds ) return label;
      return game.i18n.format("MGT2.Items.FireModeCost", {
        mode: label,
        gain: mode.damage ? MGT2Helper.signed(auto)
          : game.i18n.format("MGT2.RollPrompt.FireModeAttacks", { count: auto }),
        rounds: mode.rounds * auto
      });
    });
  }

  /**
   * What is in the magazine, and what putting a full one in costs in actions. Core folio 77 makes a
   * spare magazine "fully reload the weapon", so there is one reload and no partial one; Core folio
   * 75 prices it at a Minor Action, and FC folio 7-8's Slow Loader X replaces that with X of them.
   * The cost is **stated and never spent** — nothing in this system keeps a ground-combat action
   * budget, which is the same treatment the prompt's aiming ladder already gets.
   * @returns {{value: number, magazine: number, full: boolean, actions: number}|null}
   */
  #ammo() {
    const { type, system } = this.item;
    // The loaded round's magazine, where one is loaded: a 40mm grenade takes the rifle from 40 to 1
    // and every number on the weapon's own line is wrong while it is in there (§9.90).
    const magazine = system.effective?.magazine ?? system.magazine;
    if ( (type !== "weapon") || !(magazine > 0) ) return null;
    return {
      value: system.ammo,
      magazine,
      full: system.ammo >= magazine,
      round: system.round?.name ?? null,
      actions: Math.max(1, MGT2Helper.traitScore(system.effective.traits, "slow-loader"))
    };
  }

  /**
   * Where a lot or a booking is bound for, as one name. §6.3 stores the pair degraded — a uuid where
   * the world exists as an Actor, a bare name where it does not — so the readout takes whichever
   * half is filled, and a speculative lot has neither (Core p.242).
   * @returns {string|null}
   */
  #destination() {
    const destination = this.item.system.destination;
    if ( !destination ) return null;
    const world = destination.world ? foundry.utils.fromUuidSync(destination.world) : null;
    return world?.name || destination.name || null;
  }

  /**
   * The printed reference as one line, from the two strings §6.1 stores. Either half may stand
   * alone — a book with no page is still a citation — and neither is prefixed here: `page` holds
   * whatever the book prints, which is `p.150-152` on one entry and `inside back cover` on another.
   * @returns {string|null}
   */
  #citation() {
    const source = this.item.system.source;
    return [source?.book, source?.page].filter(half => half?.trim()).join(", ") || null;
  }

  /**
   * §6.2's tonnage triple resolved against the hull this row is fitted to. A component off a ship
   * has no hull to take a percentage of, and that is the normal state of one in a compendium.
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
   * rather than their sum, which is why each is a list of (trade code, DM) pairs. One block per
   * column, the way the trait rows do it.
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
   * The trait arrays as shared code rows, one per array the schema declares. A weapon's traits and a
   * species' come from the registry; the accessory lists the other types call options have no
   * printed vocabulary, so they declare the `custom` family and their autocomplete is empty by
   * design. A weapon declares both, and with one row per sheet its accessories were unreachable.
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

  /**
   * What this item holds: software loaded into a computer, or items stored in a container. Both
   * read in play mode, so the list is not gated on the sheet being editable.
   *
   * Software is loaded into a machine an actor owns, so it still needs one. A container does not:
   * its contents are whatever sits beside it, in the world as much as on a character.
   */
  #prepareNested(actor) {
    const item = this.item;
    // A fitted augment with Processing hosts software exactly as a computer does (§9.84).
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
   * unit the range field speaks. Applied on change so the grid answers before the round trip.
   * @param {string} key
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

    // `rules[]` refuses a blank entry, so emptying a row is how it is deleted and the trailing input
    // is how one is added — otherwise clearing the text raises a validation error nobody can act on.
    if ( system?.rules ) system.rules = Object.values(system.rules).filter(rule => rule?.trim());

    // The chip row lets a printed parameter be retyped; the number a rule reads follows from it.
    for ( const property of ["traits", "options"] ) refreshTraitNumbers(system?.[property]);

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
   * @this {TravellerItemSheet}
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

  /* -------------------------------------------- */

  /**
   * The roll belongs to the character sheet: it owns the characteristics, the skill list and the
   * Effect card. Its handler reads nothing but the clicked element's dataset, so this hands it the
   * item sheet's own button and borrows the sheet as `this` rather than growing a second roll path.
   * @this {TravellerItemSheet}
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
   * in and there is nothing to count. Whose action it is, is settled by folio 75 — the firer's Minor
   * Action — and the button says so rather than spending one.
   * @this {TravellerItemSheet}
   */
  /** A dose is taken, not equipped — everything that follows from that is in `doses.js` (§9.90). */
  static #onDoseTake() {
    return Doses.take(this.item);
  }

  static #onReload() {
    return this.item.update({ "system.loaded": this.item.system.effective.magazine });
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /**
   * A contents row stands for a sibling document, not for anything embedded in this item, so what
   * leaves the sheet is that sibling's own drag data. Anything else is an effect.
   * @inheritDoc
   */
  async _onDragStart(event) {
    const nested = TravellerItemSheet.#nestedItem.call(this, event.currentTarget);
    if ( !nested ) return super._onDragStart(event);
    event.dataTransfer.setData("text/plain", JSON.stringify(nested.toDragData()));
  }

  /**
   * Storing something is a drop on the container's own sheet. All it writes is a reference, so an
   * item already in this collection only changes hands; one from a compendium, another actor or
   * the world is copied in with everything it holds.
   * @inheritDoc
   */
  async _onDrop(event) {
    const data = MGT2Helper.getDataFromDropEvent(event);
    const container = this.item;
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

  /* -------------------------------------------- */

  /** The sibling document a nested row stands for. @this {TravellerItemSheet} */
  static #nestedItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return id ? this.item.siblings?.get(id) : null;
  }

  /** @this {TravellerItemSheet} */
  static #onNestedEdit(event, target) {
    return TravellerItemSheet.#nestedItem.call(this, target)?.sheet.render({ force: true });
  }

  /**
   * A sibling changing is not a change to this item, so nothing re-renders the list on its own.
   * @this {TravellerItemSheet}
   */
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
