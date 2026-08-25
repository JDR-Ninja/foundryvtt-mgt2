import { ChatHelper } from "../chatHelper.js";
import { checkOf } from "../chat-message.js";
import { Checks, renderRollCard } from "../checks.js";
import { BenefitPicker } from "../benefit-picker.js";
import { CompendiumExplorer } from "../compendium-explorer.js";
import { Chargen } from "../chargen.js";
import { ChargenScreen } from "../chargen-screen.js";
import { Muster } from "../chargen-muster.js";
import { MGT2 } from "../config.js";
import { CreditSplit } from "../credit-split.js";
import { EFFECT_ACTIONS, prepareEffects } from "../effects.js";
import { MGT2Helper } from "../helper.js";
import { MGT2Combatant } from "../combatant.js";
import { copyItemWithContents } from "../item.js";
import { RollPromptHelper } from "../roll-prompt.js";
import { GuideButtonMixin } from "../guide.js";
import { Rules } from "../rules.js";
import { SheetModeMixin } from "../sheet-mode.js";
import { appendTraitText, bindTraitInput, formatTrait, hazardTraits, prepareTraitBlock, refreshTraitNumbers } from "../traits.js";
import { CharacterPrompts } from "./character-prompts.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { DragDrop } = foundry.applications.ux;

const PARTS_PATH = "systems/mgt2/templates/actors";

/** The Traveller character sheet. @extends {ActorSheetV2} */
export class TravellerActorSheet extends GuideButtonMixin(SheetModeMixin(HandlebarsApplicationMixin(ActorSheetV2))) {

  /** @inheritDoc */
  static GUIDE_TOPIC = "character";

  /**
   * The Item types this sheet accepts on a drop, declared so a subclass can say what it takes
   * instead of the inventory's list being the system's.
   * @type {Set<string>}
   */
  static DROP_ITEM_TYPES = new Set(["armor", "weapon", "ammunition", "computer", "container", "item",
    "equipment", "drug"]);

  /** Types with placement of their own, handled before the inventory branch below. */
  static DROP_ITEM_SIMPLE = new Set(["contact", "disease", "career", "talent", "species"]);

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
      openDamage: TravellerActorSheet.#onOpenDamage,
      editStun: TravellerActorSheet.#onEditStun,
      restHour: TravellerActorSheet.#onRestHour,
      firstAid: TravellerActorSheet.#onFirstAid,
      firstAidReset: TravellerActorSheet.#onFirstAidReset,
      surgery: TravellerActorSheet.#onSurgery,
      medicalCare: TravellerActorSheet.#onMedicalCare,
      naturalHealing: TravellerActorSheet.#onNaturalHealing,
      mentalHealing: TravellerActorSheet.#onMentalHealing,
      psiRest: TravellerActorSheet.#onPsiRest,
      revive: TravellerActorSheet.#onRevive,
      radiation: TravellerActorSheet.#onRadiation,
      lossAdd: TravellerActorSheet.#onLossAdd,
      lossDelete: TravellerActorSheet.#onLossDelete,
      trainingWeek: TravellerActorSheet.#onTrainingWeek,
      trainingCheck: TravellerActorSheet.#onTrainingCheck,
      trainingOpen: TravellerActorSheet.#onTrainingOpen,
      chargenOpen: TravellerActorSheet.#onChargenOpen,
      roll: TravellerActorSheet.#onRoll,
      openConfig: TravellerActorSheet.#onOpenConfig,
      openCharacteristic: TravellerActorSheet.#onOpenCharacteristic,
      traitDelete: TravellerActorSheet.#onTraitDelete,
      openEditor: TravellerActorSheet.#onOpenEditor,
      speciesFind: TravellerActorSheet.#onSpeciesFind,
      benefitAdd: TravellerActorSheet.#onBenefitAdd,
      benefitRedeem: TravellerActorSheet.#onBenefitRedeem,
      benefitDelete: TravellerActorSheet.#onBenefitDelete,
      creditTransfer: TravellerActorSheet.#onCreditTransfer,
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
      templates: [`${PARTS_PATH}/parts/row-controls.html`, `${PARTS_PATH}/parts/species.html`,
        "systems/mgt2/templates/items/blocks/traits.html"],
      scrollable: [""]
    },
    inventory: {
      template: `${PARTS_PATH}/tabs/inventory.html`,
      templates: [`${PARTS_PATH}/parts/tabs-nav.html`, `${PARTS_PATH}/parts/row-controls.html`,
        `${PARTS_PATH}/parts/host-badge.html`, `${PARTS_PATH}/parts/host-software.html`],
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

  /** Which parts a change to these paths can affect. First match wins, so a longer prefix is listed above the one it extends. */
  static #PARTS_BY_PATH = [
    ["system.traits", ["skills"]],
    // The encumbrance cap in the footer is STR + END, so a score reaches it too, and the recovery
    // block reads the wound.
    ["system.characteristics", ["characteristics", "header", "footer", "health"]],
    ["system.biography", ["biography"]],
    ["system.entitlements", ["inventory"]],
    ["system.finance", ["inventory"]],
    ["system.personal", ["header", "skills"]],
    ["system.health", ["health", "header", "characteristics", "footer"]],
    ["system.config", ["characteristics", "skills", "header", "health"]],
    ["system.states", ["header", "health"]],
    ["system.stun", ["header"]],
    ["system.training", ["skills"]],
    ["system.notes", ["biography"]],
    ["name", ["header"]],
    ["img", ["header"]]
  ];

  /**
   * The sheet marks its draggable rows with `.drag-item-list` rather than the core `.draggable`, so
   * the inherited DragDrop instance is replaced wholesale (the parent's backing field is private).
   * @type {DragDrop}
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

  /**
   * Which container the Storage tab filters on, and which one items are dropped into.
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

  /** Re-render only the parts a change can reach. @inheritDoc */
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

  /**
   * One presentation object per item, referencing the live prepared document rather than a copy of
   * it.
   * @returns {object}
   */
  #itemView(item) {
    const view = { _id: item.id, name: item.name, img: item.img, type: item.type, system: item.system };
    // A skill row prints its level in a cell of its own, so it takes the roll's own name without it
    // — composing one from the speciality would state it twice on a pack Item already named for it.
    if ( item.type === "talent" ) view.rollName = item.getRollDisplay(false);
    return view;
  }

  /**
   * The creation strip: a state notice, so it stands in both modes and for an owner only.
   * @returns {{resume: boolean, term: string, step: string}|null}
   */
  #prepareChargenNotice() {
    if ( !this.actor.isOwner ) return null;
    if ( !Chargen.isInCreation(this.actor) ) return Chargen.isBlank(this.actor) ? { resume: false } : null;
    const state = Chargen.read(this.actor);
    return {
      resume: true,
      term: game.i18n.format("MGT2.Chargen.Screen.Term", { n: state.term }),
      step: state.step ? game.i18n.localize(MGT2.CreationSteps[state.step]) : ""
    };
  }

  /**
   * The characteristics as an ordered list — the roster's order, which is the one the rulebook
   * prints and players read everywhere else.
   * @returns {object[]}
   */
  #prepareCharacteristics() {
    const schema = this.actor.system.schema.fields.characteristics.fields;
    const named = this.actor.system.characteristicNames ?? {};

    return this.actor.system.characteristicKeys.map(key => {
      const c = this.actor.system.characteristics[key];
      return {
        key,
        // A species name is a literal, and `localize` hands back what it cannot find.
        label: named[key]?.label || TravellerActorSheet.#linkLabel(key),
        short: named[key]?.short || `MGT2.Characteristics.${key}.short`,
        fields: schema[key].fields,
        base: c.base, damage: c.damage, value: c.value, max: c.max, dm: c.dm,
        // Both halves: the actor's own flag, and whether the world has adopted the rule that makes
        // this characteristic exist.
        show: this.actor.system.isCharacteristicShown(key),
        modifier: c.auto + c.effect,
        percent: c.max > 0 ? Math.round((c.value / c.max) * 100) : 0,
        hurt: c.damage > 0,
        depleted: c.max > 0 && c.value <= 0,
        // The roll target is the DM itself, so its tooltip states what clicking it will roll.
        formula: MGT2Helper.showFormula(`2D${MGT2Helper.signed(c.dm, "")}`)
      };
    });
  }

  /**
   * Sort the actor's items into the collections consumed by the sheet template.
   * @returns {object}   The render context
   */
  #prepareViewModel() {
    const actor = this.actor;
    const settings = {
      weightUnit: MGT2Helper.getWeightLabel(),
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
      canGive: actor.isOwner,
      chargen: this.#prepareChargenNotice(),
      settings,
      initiative: actor.system.initiative,
      characteristics,
      // Rows stay in the roster's order — players read the six in one fixed sequence, and a chain
      // edit must not move them.
      damageTrack: characteristics.filter(c => c.show && chain.includes(c.key)),
      chainOrder: chain.map(key => byKey.get(key)).filter(c => c?.show),
      psionic: psionic?.show ? psionic : null,
      statics: characteristics.filter(c => c.show && (c.key !== "psionic") && !chain.includes(c.key)),
      // The talent list is the per-actor flag under the world's rule: with psionics not adopted,
      // the section is not drawn and the flag that would draw it is not offered
      // (`actor-config-sheet`).
      showPsionicTalents: Rules.on("psionics") && (actor.system.config.psionic === true)
    };

    // One view per item, created once so that the container and computer entries keep their
    // identity between the two passes below.
    const views = new Map();
    for (const item of actor.items) views.set(item.id, this.#itemView(item));

    // `hosts` is every view software can be loaded onto; `computers` is the subset that renders as
    // its own row group.
    const weapons = [], armors = [], augments = [], computers = [], hosts = [], softwares = [];
    const items = [], equipments = [], containerItems = [], careers = [];
    const skills = [], psionics = [], diseases = [], wounds = [], contacts = [];
    const actorContainers = [];

    for (const v of views.values()) {
      if (v.type === "container") {
        actorContainers.push(v);
      } else if (MGT2Helper.runsSoftware(v)) {
        if (v.type === "computer") computers.push(v);
        hosts.push(v);
        v.subItems = [];
        // A flag rather than `subItems.length`, because Handlebars reads an empty array as false
        // and a host with nothing loaded still has to draw as one.
        v.hostsSoftware = true;
        // The ratio reddens for the two rules that are about it — the Bandwidth sum and folio 110's
        // one package at Processing 0. A package the host's TL cannot run marks itself instead: the
        // number beside it is honest, and colouring it would name the wrong culprit.
        if ((v.system.overload === true) || (v.system.overCrowded === true)) v.overloadClass = "computer-overload";
      }
    }

    actorContainers.sort(MGT2Helper.compareByName);

    // The picker reads `display`, so the "every container" entry had neither a label nor a
    // language: it rendered as a blank option.
    const everyContainer = game.i18n.localize("MGT2.Items.SelectAll");
    const containers = [{ name: everyContainer, display: everyContainer, _id: "" }].concat(actorContainers);
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
    model.containerShowAll = viewId === "";
    // With every container shown there is none to ask for the total, and asking nothing read 0
    // under a list of rows.
    model.containerWeight = model.containerShowAll
      ? MGT2Helper.roundWeight(actorContainers.reduce((sum, c) =>
        (c.system.container?.id || (c.system.locked && !game.user.isGM)) ? sum : sum + c.system.weight, 0))
      : (currentContainerView?.system.weight ?? 0);
    model.containerViewId = viewId;
    model.containerDropInId = dropInId;

    for (const v of views.values()) {
      const sys = v.system;

      // `in`, not `hasOwn`: a container's weight is a getter, and it lives on the prototype.
      if (("weight" in sys) && sys.weight > 0) {
        const total = isNaN(sys.quantity) ? sys.weight : sys.weight * sys.quantity;
        v.weight = `${MGT2Helper.roundWeight(total)} ${settings.weightUnit}`;
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
            const host = hosts.find(x => x._id === sys.software.computerId);
            if (host !== undefined) host.subItems.push(v);
            else softwares.push(v);
          } else {
            // The PRINTED figure, alone among the readouts, and deliberately: this parenthesis is
            // the package's name — Core folio 111's own column, the thing that makes it Intrusion/3
            // — while `runAt` is a property of running, and a package bound to no host runs
            // nowhere.
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

        // Both are `PhysicalItemData` and both are in `DROP_ITEM_TYPES`, so with no case here a
        // dropped one landed on the actor and drew nowhere.
        case "drug":
        case "ammunition": items.push(v); break;

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
    // it, and the rate it will use.
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
      naturalFormula: MGT2Helper.showFormula(actor.system.naturalHealingFormula),
      mental: actor.system.constructor.MENTAL_LINKS.some(k => actor.system.characteristics[k].damage > 0),
      // The reserve is outside the damage chain, so no other procedure on this block reaches it.
      psi: (Rules.on("psionics") && (actor.system.config.psionic === true))
        ? { spent: actor.system.characteristics.psionic.damage } : null,
      augment: augment ? game.i18n.format("MGT2.Recovery.AugmentAt", augment) : null
    };

    // Core folio 81: the rads are a running total, and what they have already cost permanently is
    // read off the same table the next dose will be — so the panel states the standing penalty
    // beside the count instead of leaving the number to be looked up.
    const rads = actor.system.health?.radiations ?? 0;
    const band = actor.system.constructor.radiationBand?.(rads);
    model.radiation = band ? {
      rads,
      endurance: band.endurance,
      protection: actor.system.radiationProtection
    } : null;

    // The budget block's bar is a CSS variable, and the numbers behind it are already derived — so
    // the percentage is computed here rather than walked out of the DOM the way the kit does.
    const inventory = actor.system.inventory;
    model.encumbranceNormal = inventory.encumbrance.normal;
    model.encumbranceOver = actor.system.states.encumbrance;
    model.encumbrancePercent = inventory.encumbrance.normal > 0
      ? Math.min(100, Math.round((inventory.weight / inventory.encumbrance.normal) * 100))
      : 0;
    // The cap tick sits where the fill stops, so an overrun reads as an overrun.
    model.encumbranceTick = model.encumbranceOver ? 100 : model.encumbrancePercent;

    // Core p.107 allows one skill augmentation. Advisory: the extras stay fitted and stay listed.
    const duplicates = actor.system.augmentIssues.skillDuplicates;
    model.augmentDuplicates = duplicates.length
      ? duplicates.map(id => actor.items.get(id)?.name).filter(Boolean).join(" · ") : null;

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

    model.traits = prepareTraitBlock(actor.system.ownTraits, "traits",
      actor.system.traitFamily, "MGT2.Items.Traits");
    model.species = this.#prepareSpecies();
    // Empty for every human, which is what keeps the sex control off the sheet — not a setting.
    // Paired here because `selectOptions` reads a BARE string array positionally and would write
    // the index: an unpaired `["Female", "Male"]` stores `0` and no law would ever match again.
    model.sexes = Chargen.sexes(actor).map(value => ({ value, label: value }));
    model.effects = prepareEffects(actor);
    model.loss = this.#prepareLoss();
    model.training = this.#prepareProgrammes();
    model.entitlements = this.#prepareEntitlements();

    return model;
  }

  /**
   * The Benefit ledger: what a career owed, what it has been spent on, and what was given up.
   * @returns {object[]}
   */
  #prepareEntitlements() {
    const actor = this.actor;
    return (actor.system.entitlements ?? []).map((row, index) => {
      const item = row.item ? actor.items.get(row.item) : null;
      return {
        index,
        label: Muster.label(row),
        kind: game.i18n.localize(MGT2.BenefitKinds[row.kind] ?? row.kind),
        from: [actor.items.get(row.provenance?.career)?.name,
          row.provenance?.term ? game.i18n.format("MGT2.Chargen.Benefits.Term",
            { n: row.provenance.term }) : ""].filter(part => part).join(" · "),
        // Kept on the row, so a redeemed line still reads after its Item has been deleted.
        note: item?.name || row.note,
        itemId: item?.id ?? "",
        state: row.surrendered ? "surrendered" : (row.redeemed ? "redeemed" : "owed"),
        open: !row.redeemed && !row.surrendered
      };
    });
  }

  /** @returns {object|null}   Null where no Item is linked, which is the panel's empty state. */
  #prepareSpecies() {
    const item = this.actor.system.species;
    if ( !item ) return null;
    const source = item.system.source;
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      source: [source?.book, source?.page].filter(Boolean).join(" "),
      description: item.system.description,
      hasLong: Boolean(item.system.descriptionLong),
      modifiers: (item.system.modifiers ?? [])
        .filter(modifier => modifier.characteristic && Number.isFinite(modifier.value))
        .map(modifier => ({
          label: game.i18n.localize(CONFIG.MGT2.Characteristics[modifier.characteristic]),
          value: modifier.value
        })),
      traits: this.actor.system.speciesTraits.map(formatTrait)
    };
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    bindTraitInput(this.element, (property, text) => this.#addTrait(text));
  }

  /**
   * Resolve the embedded item id carried by the closest row of a clicked control.
   * @returns {string|undefined}
   */
  static #itemId(target) {
    return target.closest("[data-item-id]")?.dataset.itemId;
  }

  /** @this {TravellerActorSheet} */
  static async #onOpenEditor() {
    const item = this.actor.system.species;
    if ( !item ) return;
    await CharacterPrompts.openEditorFullView(item.name, item.system.descriptionLong);
  }

  static #onSpeciesFind() {
    return CompendiumExplorer.open({ cls: "Item", type: "species" });
  }

  /**
   * The sheet's door is the GIVING one, whoever presses it: a Traveller may hand their own money
   * over, and taking anybody else's is the referee's screen on the token controls.
   * @this {TravellerActorSheet}
   */
  static #onCreditTransfer() {
    return CreditSplit.open({ source: this.actor.uuid, actors: [] });
  }

  /** @this {TravellerActorSheet} */
  static async #onBenefitAdd() {
    const row = await Muster.promptRow(this.actor, { provenance: { table: "muster" } });
    if ( !row ) return;
    // Never spends a Benefit roll: this door is for a Traveller who finished on paper.
    return Muster.take(this.actor, row, { spend: false });
  }

  /** @this {TravellerActorSheet} */
  static #onBenefitRedeem(event, target) {
    return BenefitPicker.open(this.actor, Number(target.closest("[data-index]").dataset.index));
  }

  /** @this {TravellerActorSheet} */
  static async #onBenefitDelete(event, target) {
    const index = Number(target.closest("[data-index]").dataset.index);
    const rows = (this.actor.system.entitlements ?? []).map(row => ({ ...row }));
    return this.actor.update({ "system.entitlements": rows.filter((_row, at) => at !== index) });
  }

  /** @this {TravellerActorSheet} */
  static async #onTraitDelete(event, target) {
    await this.submit();
    const index = Number(target.closest(".code").dataset.traitIndex);
    // `ownTraits` and never `traits`: the merged list carries the species' at the tail.
    const traits = Object.values(this.actor.system.ownTraits ?? []);
    return this.actor.update({ "system.traits": traits.filter((_v, i) => i !== index) });
  }

  /** The typed or picked trait, parsed against the family the actor's own list speaks. */
  async #addTrait(text) {
    await this.submit();
    const traits = appendTraitText(this.actor.system.ownTraits, text, this.actor.system.traitFamily);
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

  /** A chain link's label: a characteristic on a person, a pool on everything else. */
  static #linkLabel(key) {
    return MGT2.Characteristics[key] ?? MGT2.DamageTracks[key] ?? key;
  }

  /** Spend or recover on one characteristic's own track, by the amount sitting in the control. */
  static async #onApplyDamage(event, target) {
    const control = target.closest(".dmgctl");
    const key = control?.dataset.characteristic;
    const amount = (Number(control?.querySelector("input")?.value) || 0) * Number(target.dataset.sign ?? 1);
    if ( !key || !amount ) return;

    const c = this.actor.system.characteristics[key];
    const damage = Math.min(c.max, Math.max(0, c.damage + amount));
    if ( damage === c.damage ) return;
    return this.actor.update({ [`system.characteristics.${key}.damage`]: damage });
  }

  /**
   * The reverse direction, worded by type in one place: a person is healed, a craft is repaired.
   * @type {Record<string, string>}
   */
  static #HEAL_LABEL = {
    robot: "MGT2.Actor.robot.Repair",
    vehicle: "MGT2.Actor.vehicle.Repair",
    spacecraft: "MGT2.Actor.spacecraft.Repair"
  };

  /** The pool, the wound track and the tail icon are one door. */
  static async #onOpenDamage() {
    const result = await CharacterPrompts.openDamage({
      system: this.actor.system,
      name: this.actor.name,
      healLabel: TravellerActorSheet.#HEAL_LABEL[this.actor.type] ?? "MGT2.Actor.Heal"
    });
    if ( !result ) return;

    const amount = Math.max(0, Number(result.amount) || 0);
    if ( !amount ) return;
    // Re-read off the document: the dialog was awaited, and an update in the meantime would have
    // replaced `actor.system` with a fresh instance.
    const system = this.actor.system;
    return (result.direction === "heal")
      ? system.applyDamage(-amount, { raw: true })
      : system.applyDamage(amount, { raw: true, overflow: result.overflow });
  }

  /**
   * The stun sub-track is stored and bounded and Rest 1 h puts it back, so its own number is the
   * control that changes it.
   */
  static #onEditStun(event, target) {
    if ( target.hidden ) return;
    const field = document.createElement("input");
    field.type = "number";
    field.className = "edit";
    field.min = "0";
    field.value = String(this.actor.system.stun);
    field.setAttribute("aria-label", game.i18n.localize("MGT2.Actor.Stun"));
    target.hidden = true;
    target.after(field);
    field.focus();
    field.select();

    let closed = false;
    const close = commit => {
      if ( closed ) return;
      closed = true;
      const value = Math.max(0, Number(field.value) || 0);
      field.remove();
      target.hidden = false;
      if ( commit ) return this.#setStun(value);
    };
    // `submitOnChange` listens for `change` on the form.
    field.addEventListener("change", changeEvent => changeEvent.stopPropagation());
    field.addEventListener("keydown", keyEvent => {
      if ( keyEvent.key === "Enter" ) { keyEvent.preventDefault(); close(true); }
      else if ( keyEvent.key === "Escape" ) { keyEvent.preventDefault(); close(false); }
    });
    field.addEventListener("blur", () => close(true));
  }

  /** Set the sub-track outright. */
  async #setStun(value) {
    const system = this.actor.system;
    const delta = value - system.stun;
    if ( !delta ) return;

    if ( delta > 0 ) {
      const result = await system.applyDamage(delta, { raw: true, stun: true });
      if ( result?.rounds > 0 ) {
        ui.notifications.info(MGT2Helper.plural("MGT2.Actor.StunIncapacitated",
          result.rounds, { name: this.actor.name, rounds: result.rounds }));
      }
      return;
    }

    const c = system.characteristics[system.stunLink];
    const healed = Math.min(-delta, c?.damage ?? 0);
    return this.actor.update({
      system: {
        stun: system.stun + delta,
        characteristics: healed > 0 ? { [system.stunLink]: { damage: c.damage - healed } } : {}
      }
    });
  }

  /** Core p.79: an hour of rest wipes the stun sub-track, and that much of the wound with it. */
  static async #onRestHour() {
    return this.actor.system.restHour();
  }

  /** No card here and so no Effect: the pool opens at Core p.82's minimum of one and is editable. */
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

    const outcome = CharacterPrompts.surgeryPoints(Number(result.effect) || 0, result.points);
    if ( outcome.success ) {
      return ChatHelper.applyRestore(this.actor,
        { procedure: "MGT2.Recovery.Surgery", points: outcome.points });
    }

    // Core p.82: a failed operation costs the patient points, and that is damage — so it goes
    // through the chain, where the unconscious threshold and death are waiting for it.
    await this.actor.system.applyDamage(outcome.points, { raw: true });
    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.Surgery",
      game.i18n.format("MGT2.Recovery.Costs", { points: outcome.points }));
  }

  /** Core p.83 divides this one evenly, so it places itself and never opens the prompt. */
  static async #onMedicalCare() {
    const system = this.actor.system;
    const result = await CharacterPrompts.openMedicalCare(
      { enduranceDM: system.enduranceDM, augment: system.augmentTL });
    if ( !result ) return;

    // Re-read after the dialog: an update replaces `actor.system` with a fresh instance.
    const live = this.actor.system;
    const distribution = live.spreadEvenly(live.medicalCarePoints(result.medic));
    const healed = await live.applyHeal(distribution);
    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.MedicalCare",
      ChatHelper.restoredMessage(healed, distribution));
  }

  /** Core p.83's rate can come out negative while surgery is required, and then it is a wound. */
  static async #onNaturalHealing() {
    const system = this.actor.system;
    // Companion p.80: a starving Traveller "does not heal from injuries".
    if (Rules.on("starvation") && system.states.starving) {
      return void ui.notifications.warn(game.i18n.localize("MGT2.Recovery.StarvingNoHealing"));
    }
    const roll = await new Roll(system.naturalHealingFormula).roll();
    const points = roll.total;

    let message;
    const live = this.actor.system;
    if ( points < 0 ) {
      await live.applyDamage(-points, { raw: true });
      message = game.i18n.format("MGT2.Recovery.Costs", { points: -points });
    } else {
      // The rule divides nothing here, so this takes the chain's own backwards heal.
      const healed = Math.min(points, live.life.damage);
      await live.applyDamage(-points, { raw: true });
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

  /** Core p.228: one point an hour from the fourth hour, and the only procedure reaching PSI. */
  static async #onPsiRest() {
    const spent = this.actor.system.characteristics.psionic.damage;
    const result = await CharacterPrompts.openPsiRest({ spent });
    if ( !result ) return;

    const rest = await this.actor.system.restPsi(result.hours);
    if ( !rest ) return;
    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.PsiRest",
      game.i18n.format("MGT2.Recovery.RestoredPlain", { points: rest.recovered }));
  }

  /** Core p.83: an END check per minute, each failure adding a cumulative DM+1 to the next. */
  static async #onRevive() {
    const system = this.actor.system;
    const failures = system.states.reviveFailures;
    const roll = await new Roll(`2d6${MGT2Helper.getFormulaDM(system.enduranceDM + failures)}`).roll();
    const awake = roll.total >= MGT2Helper.getEffectTarget(null).value;

    await this.actor.update({ system: { states: awake
      ? { reviveFailures: 0, consciousWound: this.actor.system.life.damage }
      : { reviveFailures: failures + 1 } } });

    return ChatHelper.postRecovery(this.actor, "MGT2.Recovery.Revive",
      game.i18n.localize(awake ? "MGT2.Recovery.Awake" : "MGT2.Recovery.StillOut"), roll);
  }

  /** Take a dose. */
  static async #onRadiation() {
    const system = this.actor.system;
    const result = await CharacterPrompts.openRadiation(
      { protection: system.radiationProtection, rads: system.health.radiations });
    if (!result) return;

    const source = MGT2.RadiationSources[result.source];
    const roll = source ? await new Roll(source.formula).roll() : null;
    return ChatHelper.resolveExposure(this.actor,
      { dose: roll ? roll.total : MGT2Helper.getIntegerFromInput(result.rads), roll });
  }

  /** One row of the permanent-change log. */
  static async #onLossAdd() {
    const system = this.actor.system;
    const result = await CharacterPrompts.openCharacteristicLoss({
      cash: system.finance.credits,
      rows: system.rollableCharacteristics.map(key => ({
        key,
        label: game.i18n.localize(MGT2.Characteristics[key]),
        // What the Traveller has NOW, which is what the reader is watching move — `max` is `base +
        // auto + effect` floored at 0, so it already carries every earlier row.
        now: system.characteristics[key].max,
        base: system.characteristics[key].base
      }))
    });
    if (!result) return;

    const care = MGT2.CharacteristicCare;
    const changes = {};
    for (const [name, value] of Object.entries(result)) {
      if (!name.startsWith("delta.")) continue;
      const delta = MGT2Helper.getIntegerFromInput(value);
      if (delta) changes[name.slice(6)] = delta;
    }

    // Folio 49: the crisis is ONE rolled price whatever it restores, so it is rolled here rather
    // than typed — `openRadiation`'s device, and for the same reason.
    let cost = MGT2Helper.getIntegerFromInput(result.cost);
    if (result.source === "ageingCrisisCare") {
      cost = (await new Roll(MGT2Helper.damageFormula(care.crisisFormula)).roll()).total;
    }
    if (!Object.keys(changes).length && !cost) return;

    const live = this.actor.system;
    const log = live.characteristicLog.map(entry => ({ ...entry }));
    log.push({
      source: result.source,
      term: MGT2Helper.hasValue(result, "term") ? MGT2Helper.getIntegerFromInput(result.term) : null,
      age: MGT2Helper.hasValue(result, "age") ? MGT2Helper.getIntegerFromInput(result.age) : null,
      roll: MGT2Helper.hasValue(result, "roll") ? MGT2Helper.getIntegerFromInput(result.roll) : null,
      changes, cost, note: String(result.note ?? "").trim()
    });

    const update = { "system.characteristicLog": log };
    // Folio 52: what the Traveller cannot pay becomes debt carried into play.
    if (result.billed && (cost > 0)) {
      const paid = Math.min(live.finance.credits, cost);
      update["system.finance.credits"] = live.finance.credits - paid;
      update["system.finance.debt"] = live.finance.debt + (cost - paid);
    }
    return this.actor.update(update);
  }

  /**
   * A row deleted by index, which is safe here and is not on the ship's arrays: a log entry carries
   * no reference to its neighbours, so removing one cannot falsify another — the sum simply loses
   * that row, and the score it derives moves with it.
   */
  static async #onLossDelete(event, target) {
    const index = Number(target.closest("[data-loss-index]")?.dataset.lossIndex ?? -1);
    const log = this.actor.system.characteristicLog
      .map(entry => ({ ...entry })).filter((entry, i) => i !== index);
    if (log.length === this.actor.system.characteristicLog.length) return;
    return this.actor.update({ "system.characteristicLog": log });
  }

  /**
   * The log as the sheet reads it: each row with its changes already named and signed, the running
   * score beside the characteristics that moved, and what the whole log has cost.
   */
  #prepareLoss() {
    const system = this.actor.system;
    const log = system.characteristicLog;
    if (!Array.isArray(log)) return null;
    const running = {};
    const rows = log.map((entry, index) => ({
      index,
      source: game.i18n.localize(MGT2.CharacteristicLossSources[entry.source] ?? entry.source),
      when: [
        entry.term === null ? null : game.i18n.format("MGT2.Loss.TermN", { n: entry.term }),
        entry.age === null ? null : game.i18n.format("MGT2.Loss.AgeN", { n: entry.age })
      ].filter(part => part).join(" · "),
      roll: entry.roll,
      cost: entry.cost,
      note: entry.note,
      changes: Object.entries(entry.changes ?? {})
        .filter(([key]) => key in system.characteristics)
        .map(([key, delta]) => ({
          key, delta: MGT2Helper.signed(delta),
          label: game.i18n.localize(MGT2.Characteristics[key]), negative: delta < 0
        }))
    }));

    // The score each moved characteristic now stands at, against the one it was rolled with.
    for (const entry of log) {
      for (const key of Object.keys(entry.changes ?? {})) {
        if (key in system.characteristics) running[key] = true;
      }
    }
    return {
      rows,
      // Two different facts, and the log distinguishes them where a single flag cannot.
      crisis: system.states.ageingCrisis,
      zeroed: Object.keys(running).some(key =>
        (system.characteristics[key].max <= 0) && (system.characteristics[key].base > 0)),
      paid: log.reduce((sum, entry) => sum + (entry.cost ?? 0), 0),
      moved: Object.keys(running).map(key => ({
        label: game.i18n.localize(MGT2.Characteristics[key]),
        base: system.characteristics[key].base,
        now: system.characteristics[key].max,
        lost: system.characteristics[key].max < system.characteristics[key].base
      }))
    };
  }

  /**
   * The training strip: one row per live programme, and the edit-only hatch onto the stored fields
   * of the row at the top.
   */
  #prepareProgrammes() {
    const training = this.actor.system.training;
    if ( !training ) return null;

    const rows = [];
    for ( const [id, programme] of Object.entries(training.programmes) ) {
      if ( programme.closed ) continue;
      const skill = programme.target.kind === "skill";
      // Core p.55: a failed period is eight weeks that bought nothing, and the ones before the last
      // grant belong to a level already reached.
      const since = programme.log.slice(
        programme.log.findLastIndex(row => row.kind === "grant") + 1);
      const failed = since.filter(row => (row.kind === "period") && (row.ok === false)).length;

      rows.push({
        id,
        companion: programme.engine === "companion",
        badge: `MGT2.Training.Badge.${programme.engine}`,
        name: skill ? programme.target.key
          : game.i18n.localize(MGT2.Characteristics[programme.target.key] ?? programme.target.key),
        isNew: programme.held === null,
        held: programme.held,
        next: programme.next,
        range: game.i18n.format(skill ? "MGT2.Training.LevelRange" : "MGT2.Training.ValueRange", {
          from: (programme.held === null)
            ? game.i18n.localize("MGT2.Training.NewSkill") : programme.held,
          to: programme.next
        }),
        xp: programme.xp,
        cost: programme.cost,
        percent: programme.percent,
        boxes: Array.fromRange(training.weeksPerPeriod).map(week => week < programme.weeks),
        pips: [...Array.fromRange(programme.periodsPassed).map(() => "pass"),
          ...Array.fromRange(programme.periodsLeft).map(() => ""),
          ...Array.fromRange(failed).map(() => "fail")],
        barred: programme.barred ? TravellerActorSheet.#barredReason(programme.target) : null,
        // What is actually waiting on the player: it sorts to the top and takes the accent rail.
        waiting: !programme.barred && (programme.ready || programme.checkDue),
        verb: TravellerActorSheet.#trainingVerb(programme),
        targetLabel: MGT2.TrainingTargets[programme.target.kind],
        key: programme.target.key,
        weeks: programme.weeks,
        characteristic: programme.characteristic
      });
    }
    rows.sort((a, b) => Number(b.waiting) - Number(a.waiting));

    const first = rows[0];
    return {
      rows,
      // The stored fields stay repairable, but they are not the interface: edit mode only, beneath
      // the strip and never inside it, and for one programme — more than that is what the window is
      // for.
      hatch: first ? {
        fields: this.actor.system.schema.fields.training.fields.programmes.element.fields,
        label: first.targetLabel,
        key: first.key,
        weeks: first.weeks,
        characteristic: first.characteristic,
        names: {
          key: `system.training.programmes.${first.id}.target.key`,
          weeks: `system.training.programmes.${first.id}.weeks`,
          characteristic: `system.training.programmes.${first.id}.characteristic`
        }
      } : null
    };
  }

  /**
   * Why neither book lets this programme reach anything: Core p.55 bars Jack-of-all-Trades
   * outright, and Compagnon p.40's table names five characteristics — SOC by name, PSI because
   * psionic strength has training rules of its own.
   */
  static #barredReason(target) {
    if ( target.kind !== "characteristic" ) return "MGT2.Training.Barred.jackOfAllTrades";
    return (target.key === "psionic")
      ? "MGT2.Training.Barred.psionic" : "MGT2.Training.Barred.social";
  }

  /**
   * The one verb a row offers, and never two.
   * @returns {{action: string, label: string, hot: boolean}|null}
   */
  static #trainingVerb(programme) {
    if ( programme.barred ) return null;
    const companion = programme.engine === "companion";
    if ( programme.ready ) {
      return { action: "trainingOpen", hot: true,
        label: game.i18n.format(companion ? "MGT2.Training.Buy" : "MGT2.Training.Grant",
          { n: programme.next }) };
    }
    if ( programme.checkDue ) {
      return { action: "trainingCheck", hot: true,
        label: game.i18n.format("MGT2.Training.Check", {
          characteristic: game.i18n.localize(
            `MGT2.Characteristics.${programme.checkCharacteristic}.short`)
        }) };
    }
    return companion
      ? null : { action: "trainingWeek", hot: false,
        label: game.i18n.localize("MGT2.Training.LogWeek") };
  }

  /** The programme key carried by the clicked strip row. */
  static #programmeId(target) {
    return target.closest("[data-programme-id]")?.dataset.programmeId;
  }

  /** Core p.55: one more week of the open Study Period. */
  static async #onTrainingWeek(event, target) {
    const id = TravellerActorSheet.#programmeId(target);
    const training = this.actor.system.training;
    const programme = training?.programmes[id];
    if ( !programme ) return;

    const weeks = Math.min(training.weeksPerPeriod, programme.weeks + 1);
    if ( weeks === programme.weeks ) return;
    return this.actor.update({ [`system.training.programmes.${id}.weeks`]: weeks });
  }

  /** The check that settles what is open, and the only thing either engine rolls from the strip. */
  static async #onTrainingCheck(event, target) {
    const id = TravellerActorSheet.#programmeId(target);
    const programme = this.actor.system.training?.programmes[id];
    if ( !programme?.checkDue || programme.barred || programme.closed ) return;

    const companion = programme.engine === "companion";
    // Compagnon p.39: the teacher's own level caps what can be learned, and the check is taken at
    // DM−the level being reached.
    const modifiers = companion
      ? [{ key: "training", label: "MGT2.Training.TeachingDM", dm: -programme.next }] : [];
    const message = await TravellerActorSheet.roll(this.actor, {
      roll: "characteristic",
      characteristic: programme.checkCharacteristic,
      difficulty: "Average",
      modifiers
    }, this.token);
    if ( !(message instanceof ChatMessage) ) return message;

    const effect = checkOf(message)?.effect;
    if ( !Number.isInteger(effect) ) return message;
    const total = message.rolls?.[0]?.total;
    const ok = effect >= 0;

    // Re-read off the document: the prompt was open across other people's writes, so the model
    // captured before it is a different instance answering with the old numbers.
    const current = this.actor.system.training.programmes[id];
    if ( !current ) return message;
    const log = current.log.map(row => ({ ...row }));
    const update = { [`system.training.programmes.${id}.log`]: log };

    if ( companion ) {
      log.push({ kind: "teaching", ok, amount: ok ? 1 : 0,
        roll: Number.isInteger(total) ? total : null });
    } else {
      // The open period's note is promoted into the row that closes it, and the counter goes back
      // to zero: a period is spent whether it passed or failed.
      log.push({ kind: "period", ok, amount: current.weeks,
        roll: Number.isInteger(total) ? total : null, note: current.note });
      update[`system.training.programmes.${id}.weeks`] = 0;
      update[`system.training.programmes.${id}.note`] = "";
    }
    return this.actor.update(update);
  }

  static #onChargenOpen() {
    return ChargenScreen.open({ add: this.actor });
  }

  /** The training window, on the programme the clicked row names. */
  static #onTrainingOpen(event, target) {
    const open = game.mgt2?.trainingScreen;
    if ( typeof open !== "function" ) {
      return void console.warn(
        "MGT2 | game.mgt2.trainingScreen is not registered, so the training strip has no window to open.");
    }
    return open(this.actor, { programme: TravellerActorSheet.#programmeId(target) });
  }

  /**
   * Everything standing against `modifiers.check`, each entry still named.
   * @returns {{key: string, label: string, dm: number, params?: object}[]}
   */
  static checkModifiers(actor, token = null) {
    const check = actor.system.modifiers.check;
    const sources = [...(check.sources ?? [])];
    const standing = check.custom + check.effect;
    if (standing !== 0) sources.push({ key: "actor", label: "MGT2.RollPrompt.ActorDM", dm: standing });
    // Core p.76: every Reaction taken costs DM-1 on the next set of actions.
    const reactions = MGT2Combatant.reactionDM(actor, token);
    if (reactions !== 0) {
      sources.push({ key: "reactions", label: "MGT2.RollPrompt.ReactionDM", dm: reactions });
    }
    return sources;
  }

  /**
   * The distance to the one targeted token, measured with Foundry's own `measurePath` so the figure
   * agrees with what the ruler draws — centre to centre, elevation included, and on the diagonal
   * rule the manifest declares (`grid.diagonals`, Euclidean, Companion p.173).
   * @param {TokenDocument|null} token   The sheet's own token, where the sheet has one
   * @returns {{distance: number, target: string}|null}
   */
  static #measureRange(actor, token, weapon) {
    const targets = Array.from(game.user?.targets ?? []);
    if (!canvas?.ready || (targets.length !== 1)) return null;

    // `scene.grid.units` is free text, so it is matched against the two units the system knows.
    const units = String(canvas.scene?.grid.units ?? "").trim().toLowerCase();
    const scale = Object.keys(MGT2.MetricRange).find(key =>
      game.i18n.localize(MGT2.MetricRange[key]).toLowerCase() === units);
    if (!scale || (scale !== weapon?.system.range?.unit)) return null;

    // The sheet's own token first: an unlinked NPC opened from its token is *that* token, not a
    // sibling.
    const placed = token ? null : actor.getActiveTokens();
    const from = token ?? ((placed?.length === 1) ? placed[0] : null);
    const start = (from?.document ?? from)?.getCenterPoint();
    if (!start) return null;

    const measured = canvas.grid.measurePath([start, targets[0].document.getCenterPoint()]).distance;
    return { distance: Math.round(measured * 10) / 10, target: targets[0].document.name };
  }

  /** Core p.74's Common Modifiers, read off the prompt. @returns {[string, number][]} */
  static #attackModifiers(data, weapon) {
    const terms = [];
    const named = key => game.i18n.localize(MGT2.AttackModifiers[key].label);
    const aim = MGT2.AttackModifiers.aiming;

    // Core folio 79, folio 78 and folio 77: a burst or full-auto attack forfeits aiming and so does
    // a second weapon in the other hand — both declare that as `suppress` — while a scoped weapon
    // that did aim is not held to the rule making every shot past 100 metres Extreme.
    const forfeitsAim = (MGT2.FireModes[data.fireMode]?.suppress === "aiming")
      || ((data.dualWeapons === true) && (MGT2.AttackModifiers.dualWeapons.suppress === "aiming"));
    const aiming = forfeitsAim ? 0
      : Math.min(aim.max, Math.max(0, MGT2Helper.getIntegerFromInput(data.aiming)));
    const threshold = TravellerActorSheet.#rangeThreshold(data, aiming);
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

    // Core folio 167: the to-hit column of the Damage Scale table, whose row the attacker declares.
    const cross = MGT2.CrossScaleAttack[
      (weapon?.system.scale === "spacecraft") ? "spacecraft" : "ground"];
    if (data.crossScale === true) terms.push([game.i18n.localize(cross.label), cross.dm]);
    return terms;
  }

  /**
   * The weapon's own traits, totalled the way the prompt showed them: an applied one is in whether
   * the player looked at it, an offered one only once confirmed, and a reminder never.
   * @returns {[string, number][]}
   */
  /** Core p.79: a scoped weapon aimed before shooting is not held to the 100 m rule. */
  static #rangeThreshold(data, aiming) {
    return ((data["trait-scope"] === true) && (aiming > 0)) ? 0
      : MGT2Helper.getIntegerFromInput(data.rangeThreshold);
  }

  static #weaponTraitModifiers(data, weapon, strengthDM) {
    const terms = [];
    const distance = MGT2Helper.getNumberFromInput(data.distance);
    const threshold = TravellerActorSheet.#rangeThreshold(data,
      MGT2Helper.getIntegerFromInput(data.aiming));
    for (const row of MGT2Helper.weaponTraitRows(weapon, strengthDM, distance, threshold)) {
      if (row.dm === 0) continue;
      if ((row.tone === "applied") || ((row.tone === "offered") && (data[row.name] === true))) {
        terms.push([row.term, row.dm]);
      }
    }
    return terms;
  }

  /** @this {TravellerActorSheet} */
  static async #onRoll(event, target) {
    return TravellerActorSheet.roll(this.actor, {
      roll: target.dataset.roll,
      characteristic: target.dataset.rollCharacteristic,
      skill: target.dataset.rollSkill,
      itemId: target.dataset.itemId
    }, this.token);
  }

  /**
   * Every check a Traveller makes, from the four things a control can name: the kind of roll, a
   * characteristic key, a skill Item id and any other Item id.
   * @param {string} [what.roll]            `initiative` | `characteristic` | `skill` | `psionic`
   * @param {string} [what.characteristic]  A characteristic key, for `roll: "characteristic"`
   * @param {string} [what.skill]           A `talent` Item id, for `roll: "skill"`
   * @param {string} [what.itemId]          Whatever else is being rolled
   * @param {string|null} [what.difficulty] A `MGT2.Difficulty` key the caller's rule states
   * @param {object[]} [what.modifiers]     The caller's own waivable modifiers
   * @param {TokenDocument|null} [token]    The token this was rolled from, where there is one
   * @returns {Promise<ChatMessage|undefined>}
   */
  static async roll(actor, { roll = "", characteristic = "", skill = "", itemId = "",
    difficulty = null, modifiers = [] } = {}, token = null) {
    const rollOptions = {
      rollTypeName: game.i18n.localize("MGT2.RollPrompt.Roll"),
      rollObjectName: "",
      characteristics: RollPromptHelper.actorCharacteristics(actor),
      characteristic: "",
      skills: RollPromptHelper.actorSkills(actor),
      skill: "",
      // A caller's own sources join the actor's BEFORE the prompt is built, which is what leaves
      // them un-tickable beside it rather than pushed in past the checkbox filter.
      checkModifiers: [...TravellerActorSheet.checkModifiers(actor, token), ...modifiers],
      difficulty,
      damageFormula: null,
      // The prompt renders its blocks from what is being rolled, so a bare characteristic check is
      // shorter than a weapon attack.
      blocks: { skill: true, range: false, traits: false, psionic: false, attack: false,
        extended: false },
      // RH folio 115's brain ceiling, which only a robot answers with anything.
      ceiling: actor.system.taskCeiling,
      // Core p.79: Bulky and Very Bulky are read against the attacker's own STR DM.
      strengthDM: actor.system.characteristics.strength?.dm ?? 0
    };

    const cardButtons = [];

    let itemObj = null;
    let isInitiative = false;
    if (roll === "initiative") {
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.InitiativeRoll");
      rollOptions.characteristic = actor.system.config.initiative.characteristic;
      // Core p.85: a creature has no DEX and Fast Metabolism hands it the DM directly, so with no
      // characteristic named the whole figure is offered as a waivable modifier instead.
      const standing = rollOptions.characteristic
        ? actor.system.modifiers.initiative.dm : actor.system.initiative;
      if (standing !== 0) {
        rollOptions.checkModifiers = [...rollOptions.checkModifiers,
          { key: "initiative", label: "MGT2.Actor.Initiative", dm: standing }];
      }
      isInitiative = true;
    } else if (roll === "characteristic") {
      rollOptions.characteristic = characteristic;
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.CharacteristicRoll");
      rollOptions.rollObjectName = game.i18n.localize(`MGT2.Characteristics.${rollOptions.characteristic}.name`);
      rollOptions.blocks.skill = false;
    } else {

      if (roll === "skill") {
        rollOptions.skill = skill;
        itemObj = actor.getEmbeddedDocument("Item", rollOptions.skill);
        rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.SkillRoll");
        rollOptions.rollObjectName = itemObj.name;
      } else {
        if (roll === "psionic") {
          rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.PsionicRoll");
        }
      }

      if (itemObj === null && itemId) {
        itemObj = actor.getEmbeddedDocument("Item", itemId);
        rollOptions.rollObjectName = itemObj.name;
        if (itemObj.type === "weapon")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.weapon");
        else if (itemObj.type === "armor")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.armor");
        else if (itemObj.type === "computer")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.computer");
      }

      if (itemObj && roll === "psionic") {
        // Core folio 229: "A Traveller with no PSI points cannot attempt to activate a power." The
        // refusal is what makes the folio's next clause reachable at all — the excess a spend
        // pushes past zero can only exist when there was a reserve to start from.
        const reserve = actor.system.characteristics.psionic;
        const tracked = actor.system.isCharacteristicShown("psionic");
        if (tracked && (reserve.value <= 0)) {
          return ui.notifications.warn(
            game.i18n.format("MGT2.Errors.NoPsiPoints", { name: actor.name }));
        }

        rollOptions.rollObjectName = itemObj.name;
        rollOptions.talent = itemObj;
        // Core folio 229 pays for reach with the same points the power costs, so the strip belongs
        // beside the roll rather than on the item: it is a choice per use, like the fire mode.
        rollOptions.blocks.psionic = tracked;
        // Core p.229: activating a power is "a skill check using the appropriate skill, adding
        // their PSI DM" — the talent IS that skill, so it joins the list the prompt offers and is
        // preselected.
        rollOptions.skills.splice(1, 0, {
          _id: itemObj.id, name: itemObj.getRollDisplay(false), term: itemObj.name,
          dm: itemObj.system.level
        });
        rollOptions.skill = itemObj.id;
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
        // A weapon answers with the round in it, which may replace its damage outright — a 40mm
        // grenade in an Advanced Combat Rifle does the grenade's damage and not the rifle's 3D
        // (Core p.127).
        rollOptions.damageFormula = itemObj.system.effective?.damage ?? itemObj.system.damage;
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

      // Core p.229: the PSI DM is added to every power, so a talent that names no characteristic of
      // its own still gets one — but only where the sheet shows PSI at all.
      if ((roll === "psionic") && (rollOptions.characteristic === "")
        && actor.system.isCharacteristicShown("psionic")) {
        rollOptions.characteristic = "psionic";
      }

      // A disease, poison or wound forces one check and only one, so it stores it at
      // `system.difficulty` and has no `roll` block for the gate above to read (Core folio 80).
      if (itemObj?.type === "disease") {
        if (MGT2Helper.hasValue(itemObj.system, "difficulty")) {
          rollOptions.difficulty = itemObj.system.difficulty;
        }
        // Core folio 80: "The Traveller must make a series of END checks to resist the effects of
        // the disease", and "poisons operate in the same way".
        if (MGT2.EnduranceResisted.includes(itemObj.system.subType)
          && actor.system.rollableCharacteristics.includes("endurance")) {
          rollOptions.characteristic = "endurance";
        }
      }

      // The traits belong to any weapon; Core p.74's table is headed "Common Modifiers to Ranged
      // Attacks", so the range block belongs to a ranged one and to nothing else.
      if (itemObj?.type === "weapon") {
        rollOptions.weapon = itemObj;
        rollOptions.blocks.traits = itemObj.system.effective.traits.length > 0;
        rollOptions.blocks.range = itemObj.system.range?.isMelee !== true;
        if (rollOptions.blocks.range) {
          rollOptions.measured = TravellerActorSheet.#measureRange(actor, token, itemObj);
        }
        // Core folio 78's pair is one-handed weapons of either kind, so this outlives the range
        // block: a melee attack is offered the second weapon as readily as a pistol is.
        rollOptions.blocks.attack = true;
        // Core folio 81: in zero gravity every close combat weapon and every ranged weapon without
        // the Zero-G trait owes an Athletics (dexterity) check. Stated, and rolled by nobody.
        if (actor.system.gravityBand === MGT2.Microgravity.band) {
          const traits = itemObj.system.effective?.traits ?? itemObj.system.traits;
          rollOptions.microgravity = {
            exempt: MGT2Helper.hasTrait(traits, MGT2.Microgravity.trait)
          };
        }
        // Core folio 77: the magazine is how many shots can be fired "before reloading is
        // necessary", so an empty one is refused here rather than allowed to drift negative.
        if (TravellerActorSheet.#magazine(itemObj)?.ammo === 0) {
          return ui.notifications.warn(
            game.i18n.format("MGT2.Errors.WeaponEmpty", { name: itemObj.name }));
        }
      }

      // Core folio 58 makes characteristic checks and skill checks two different kinds of task
      // check, and only the second has a skill that can be missing.
      if (rollOptions.skill && !rollOptions.skills.some(entry => entry._id === rollOptions.skill)) {
        rollOptions.skill = "NP";
      }
      else if (!rollOptions.skill && (itemObj?.type === "weapon")) rollOptions.skill = "NP";
    }

    // Fills a gap and never closes one: every branch above has already had its say.
    if (characteristic && !rollOptions.characteristic) rollOptions.characteristic = characteristic;

    // Core folio 75 reaches any skill check running longer than a combat round, which is a fact
    // about the fiction and not about the Item — so only the two that cannot be one are withheld.
    rollOptions.blocks.extended = rollOptions.blocks.skill && !isInitiative
      && (itemObj?.type !== "weapon");

    const userRollData = await RollPromptHelper.roll(rollOptions);
    if ( !userRollData ) return; // dialog dismissed

    // Core p.74's attack modifiers and the weapon traits are this path's own terms; everything else
    // the prompt came back with is assembled the same way for any caller.
    const extra = [];
    // Core folio 78: DM-2 to the attack rolls of both weapons.
    if (rollOptions.blocks.attack && (userRollData.dualWeapons === true)) {
      extra.push([game.i18n.localize(MGT2.AttackModifiers.dualWeapons.label),
        MGT2.AttackModifiers.dualWeapons.dm]);
    }
    if (rollOptions.blocks.range) {
      extra.push(...TravellerActorSheet.#attackModifiers(userRollData, rollOptions.weapon));
    }
    if (rollOptions.blocks.traits) {
      extra.push(...TravellerActorSheet.#weaponTraitModifiers(
        userRollData, rollOptions.weapon, rollOptions.strengthDM));
    }
    const { formula: rollFormula, modifiers: rollModifiers, chainSources } =
      RollPromptHelper.terms(userRollData, actor, rollOptions.checkModifiers, extra);

    if (MGT2Helper.hasValue(userRollData, "difficulty")) {
      rollOptions.difficulty = userRollData.difficulty;
    }

    const rollData = actor.getRollData();

    // Ahead of the magazine debit rather than left to `Checks.resolve`: a formula that cannot be
    // parsed must not spend the rounds first.
    if (!Roll.validate(rollFormula)) {
      ui.notifications.error(game.i18n.localize("MGT2.Errors.InvalidRollFormula"));
      return;
    }

    // Core folio 79: the fire mode decides what Auto does beyond forfeiting the aim.
    const auto = MGT2Helper.traitScore(
      rollOptions.weapon?.system.effective?.traits ?? rollOptions.weapon?.system.traits, "auto");
    const fireMode = (auto > 0) ? (MGT2.FireModes[userRollData.fireMode] ?? {}) : {};
    const attacks = fireMode.attacks ? auto : 1;
    const burst = fireMode.damage ? auto : 0;
    const rounds = fireMode.rounds ? fireMode.rounds * auto : 0;

    // Core folio 77 counts shots against the magazine, so an ordinary attack spends one round and
    // folio 79's two Auto modes spend what they are priced at — once for the whole salvo, since
    // full auto is one pull of the trigger however many attacks it makes.
    const magazine = TravellerActorSheet.#magazine(rollOptions.weapon);
    const spend = magazine ? Math.max(1, rounds) : 0;
    if (magazine && (spend > magazine.ammo)) {
      return ui.notifications.warn(MGT2Helper.plural("MGT2.Errors.WeaponShort", magazine.ammo,
        { name: rollOptions.weapon.name, rounds: spend, ammo: magazine.ammo }));
    }
    let ammoLine = null;
    if (magazine) {
      const left = magazine.ammo - spend;
      await rollOptions.weapon.update({ "system.loaded": left });
      ammoLine = game.i18n.format("MGT2.Chat.Roll.Ammo",
        { spent: spend, left, magazine: magazine.magazine });
    }

    let posted;
    for (let attack = 1; attack <= attacks; attack++) {
      const scored = await Checks.resolve({
        formula: rollFormula, rollData,
        difficulty: rollOptions.difficulty, prompt: userRollData
      });
      if (!scored) return;
      const { effect, opposed } = scored;
      const carriesEffect = itemObj?.type === "weapon";

      // Core p.73: the Effect of the DEX or INT check IS the Initiative, not the total — and
      // *every* Traveller rolls their own.
      if (isInitiative) {
        const combatants = game.combat?.getCombatantsByActor(actor) ?? [];
        const own = token ? combatants : combatants.filter(c => c.token?.actorLink === true);
        for (const combatant of own) await combatant.update({ initiative: effect });
      }

      // Core folio 75: the Effect is the verdict on the work — any failure costs the round, the
      // ruin rung costs the task.
      const sustained = MGT2Helper.getIntegerFromInput(userRollData.damageSustained);
      const extendedLine = (sustained > 0)
        ? game.i18n.localize(MGT2.ExtendedAction.outcomes[(effect >= 0) ? "kept"
          : ((effect <= MGT2.ExtendedAction.ruin) ? "ruined" : "lost")])
        : null;

      // Core p.82: first aid restores the Effect of a Medic check, minimum one point.
      const rolledSkill = (userRollData.skill && (userRollData.skill !== "NP"))
        ? actor.getEmbeddedDocument("Item", userRollData.skill) : null;
      const firstAidPoints = MGT2Helper.isFirstAidSkill(rolledSkill?.name) ? Math.max(1, effect) : 0;

      const mishapLine = carriesEffect
        ? await TravellerActorSheet.#combatMishap(scored, rolledSkill) : null;

      // Core folio 78: to grapple IS to make an opposed Melee check, so nothing on the prompt
      // declares one — the skill rolled and the Opposed row together are the declaration.
      const grapple = (opposed && (opposed.outcome !== "tie")
        && MGT2.Grapple.skills.some(name => MGT2Helper.matchesSkill(rolledSkill?.name, name)))
        ? TravellerActorSheet.#grappleWinner(actor, opposed, effect) : null;

      // Core folio 229: the power is paid for now, out of the reserve, and the card states what it
      // cost.
      const psiLine = rollOptions.blocks.psionic
        ? await TravellerActorSheet.spendPsi(actor, rollOptions.talent, userRollData, effect)
        : null;

      // The damage payload stays a flag: it is the WEAPON's offer to a future defender, resolved on
      // another actor entirely, and it rides messages that are not checks.
      const flags = { mgt2: {} };

      if (rollOptions.damageFormula !== null && rollOptions.damageFormula !== "") {
        // The round in it and not the weapon's own line, as the formula above already is.
        const traits = carriesEffect
          ? (itemObj.system.effective?.traits ?? itemObj.system.traits) : [];
        flags.mgt2.damage = {
          formula: rollOptions.damageFormula,
          rollObjectName: rollOptions.rollObjectName,
          rollTypeName: rollOptions.rollTypeName,
          // Core p.77: damage is rolled with the attack's Effect added, and a melee attack adds the
          // attacker's STR DM on top.
          effect: carriesEffect ? effect : 0,
          strengthDM: (carriesEffect && itemObj.system.range?.isMelee)
            ? actor.system.meleeDamageDM : 0,
          // Core folio 79: a burst adds the Auto score to the damage this attack deals.
          burst,
          // The rest of the pipeline's inputs, carried so that stages 2 to 6 can run later on
          // whichever actor was hit.
          scale: itemObj?.system.scale ?? actor.system.scale,
          ap: MGT2Helper.traitScore(traits, "ap"),
          loPen: MGT2Helper.traitScore(traits, "lo-pen"),
          stun: MGT2Helper.hasTrait(traits, "stun"),
          // Core folio 79: a Radiation weapon doses whoever it hits, which only the apply path knows.
          radiation: MGT2Helper.hasTrait(traits, "radiation"),
          // RH folio 106: an ion weapon meets no armour and shuts a robot's brain down.
          ion: MGT2Helper.hasTrait(traits, "ion"),
          // Core p.78: most Destructive weapons say so in the score itself, which the card reads.
          destructive: MGT2Helper.hasTrait(traits, "destructive"),
          blast: MGT2Helper.hasTrait(traits, "blast"),
          // Poison and Diseased become an Item the DEFENDER owns, so the parameters travel
          // with the rest of the pipeline's inputs and are built on the apply path.
          hazards: hazardTraits(traits),
          damageType: carriesEffect ? Array.from(itemObj.system.damageType ?? []) : []
        };
      }

      if (firstAidPoints > 0) flags.mgt2.firstAid = { points: firstAidPoints };
      // A flag rather than a field on the check: like the damage payload it is an offer resolved
      // later and on another actor, and it rides no rule the schema validates.
      if (grapple) flags.mgt2.grapple = grapple;
      if (cardButtons.length > 0) flags.mgt2.buttons = cardButtons;

      posted = await Checks.post(scored, {
        actor,
        label: rollOptions.rollObjectName || rollOptions.rollTypeName || "",
        flags,
        mode: userRollData.rollMode,
        rollTypeName: rollOptions.rollTypeName,
        rollObjectName: rollOptions.rollObjectName,
        difficulty: rollOptions.difficulty,
        modifiers: rollModifiers,
        chainSources,
        showButtons: true,
        fireModeLine: TravellerActorSheet.#fireModeLine({ burst, rounds, attack, attacks }),
        ammoLine: (attack === 1) ? ammoLine : null,
        psiLine,
        extendedLine,
        mishapLine,
        grapple,
        showRollDamage: rollOptions.damageFormula !== null && rollOptions.damageFormula !== "",
        damageCarriesEffect: carriesEffect,
        firstAidPoints,
        cardButtons
      });
    }
    return posted;
  }

  /** Who won the grapple and by how much. @returns {{winner: string, effect: number}} */
  static #grappleWinner(actor, opposed, effect) {
    const winner = (opposed.outcome === "won") ? actor.name
      : (game.messages.get(opposed.message)?.speaker?.alias || opposed.label);
    return { winner, effect: Math.max(effect, opposed.effect) };
  }

  /**
   * What one attack with this weapon is counted against, or null where it counts nothing.
   * @returns {{ammo: number, magazine: number}|null}
   */
  static #magazine(weapon) {
    // The one gate for the rule: counting nothing is what makes an attack roll and spend nothing,
    // refuse nothing and say nothing about ammunition on the card.
    if (!Rules.on("magazines")) return null;
    const system = weapon?.system;
    // The loaded round's magazine, where there is one: a grenade takes a 40-round rifle to 1, so
    // the capacity the shot is counted against is the round's and not the weapon's.
    const magazine = system?.effective?.magazine ?? system?.magazine;
    if (!system || (system.scale === "spacecraft") || !(magazine > 0)) return null;
    return { ammo: system.ammo, magazine };
  }

  /**
   * Companion p.53: a double 1 that is also a failure, read on 2D + the weapon skill — so a higher
   * skill lands a milder row. @returns {Promise<string|null>}
   */
  static async #combatMishap(scored, skill) {
    if (!Rules.on("combatMishaps") || (scored.effect >= 0)) return null;
    const dice = (scored.roll.dice[0]?.results ?? []).filter(result => result.active);
    if ((dice.length !== 2) || dice.some(result => result.result !== 1)) return null;

    const level = Math.max(0, skill?.system.level ?? 0);
    const roll = await new Roll(`2d6${MGT2Helper.getFormulaDM(level)}`).roll();
    const row = MGT2.CombatMishaps.find(entry => (entry.max === null) || (roll.total <= entry.max));
    return game.i18n.format("MGT2.CombatMishaps.Line",
      { total: roll.total, result: game.i18n.localize(row.label) });
  }

  /** What the card says about the fire mode (Core folio 79). @returns {string|null} */
  static #fireModeLine({ burst, rounds, attack, attacks }) {
    if (burst > 0) {
      return MGT2Helper.plural("MGT2.Chat.Roll.FireModeBurst", rounds,
        { score: MGT2Helper.signed(burst), rounds });
    }
    if (attacks > 1) {
      return MGT2Helper.plural(
        (attack === 1) ? "MGT2.Chat.Roll.FireModeFullAuto" : "MGT2.Chat.Roll.FireModeFullAutoNext",
        rounds, { attack, attacks, rounds });
    }
    return null;
  }

  /**
   * Core folio 229: "They must also spend the listed number of PSI points if they succeed or one
   * point if they fail.
   * @returns {Promise<string|null>}   What the card says about the spend
   */
  static async spendPsi(actor, talent, data, effect) {
    const listed = Math.max(0, talent?.system.psionic?.cost ?? 0);
    const points = (effect >= 0) ? listed * (MGT2Helper.getIntegerFromInput(data.psiBoost) || 1) : 1;
    const spent = await actor.system.spendPsi(points);
    if (!spent) return null;
    return game.i18n.format(
      spent.damage > 0 ? "MGT2.Chat.Roll.PsiSpentDamage" : "MGT2.Chat.Roll.PsiSpent", spent);
  }

  /** @this {TravellerActorSheet} */
  static async #onItemCreate(event, target) {
    const data = {
      name: target.dataset.createName,
      type: target.dataset.typeItem
    };

    if (target.dataset.subtype) {
      data.system = { subType: target.dataset.subtype };
    }
    // A `component` discriminates on `category` where every other type uses `subType`, and the
    // ship's Computer block creates one of those.
    if (target.dataset.category) {
      data.system = { ...data.system, category: target.dataset.category };
    }
    // Storage creates INTO the picker's container; without this the row would land on hand and
    // vanish from the panel that made it.
    if (target.dataset.store) {
      const container = await this.#dropInContainer();
      if (!container) return;
      data.system = { ...data.system, container: { id: container._id } };
    }

    const item = await getDocumentClass("Item").create(data, { parent: this.actor });
    // A play-mode row offers the eye and not the pencil, so a blank Item created there would be a
    // dead end: the create carries the whole of the authoring and opens the sheet to take it
    //.
    if (item && !this.isEditMode) {
      await item.sheet.render({ force: true, mode: this.constructor.MODES.EDIT });
    }
    return item;
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
      const container = await this.#dropInContainer();
      if (!container) return;
      item.system.container.id = container._id;
    }
    return this.actor.updateEmbeddedDocuments("Item", [item]);
  }

  /**
   * Where a stored item lands: the picker's choice, or the first container, or a new one where the
   * Traveller has none.
   * @returns {Promise<object|null>}   Null once the refusal has been reported
   */
  async #dropInContainer() {
    const containers = this.actor.getContainers();
    const container = this.viewState.dropIn
      ? containers.find(x => x._id === this.viewState.dropIn)
      : containers[0] ?? await getDocumentClass("Item").create(
        { name: game.i18n.localize("MGT2.Actor.NewContainer"), type: "container" }, { parent: this.actor });

    if (!container) return null;
    if (container.system.locked && !game.user.isGM) {
      ui.notifications.error(game.i18n.localize("MGT2.Errors.LockedContainer"));
      return null;
    }
    return container;
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

  /** @inheritDoc */
  async _onDrop(event) {
    const dropData = MGT2Helper.getDataFromDropEvent(event);
    if (!dropData) return false;
    if (Hooks.call("dropActorSheetData", this.actor, this, dropData) === false) return false;
    if (!this.isEditable) return false;

    const sourceItemData = await MGT2Helper.getItemDataFromDropData(dropData);

    // Simple drop — a species included: `SpeciesData`'s own hooks own the link.
    if (this.constructor.DROP_ITEM_SIMPLE.has(sourceItemData.type)) {
      // A move, not a copy: `stripIds` would leave the duplicate unrecognisable downstream.
      if (this.actor.items.has(sourceItemData.id)) return false;
      await this.actor.createEmbeddedDocuments("Item", [MGT2Helper.stripIds(sourceItemData)]);
      return true;
    }

    // What is left is the inventory, which places into containers and loads into machines.
    if (!this.constructor.DROP_ITEM_TYPES.has(sourceItemData.type)) return false;

    // Every inventory row carries the id, whether it is a drag source or a drop target.
    const target = event.target.closest("[data-item-id]");
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
        if (targetItem.system.subType === "software" && sourceItem.system.software) {
          sourceItem.system.software.computerId = targetItem.system.software.computerId;
        } else {
          sourceItem.system.container.id = targetItem.system.container.id;
        }
        await this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
        return true;
      } else if (MGT2Helper.runsSoftware(targetItem)) {
        if (!sourceItem.system.software) return false;   // only software loads into a machine
        sourceItem.system.software.computerId = targetId;
        await this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
        return true;
      } else if (targetItem.type === "container") {
        // locked refuse
        if (targetItem.system.locked && !game.user.isGM)
          ui.notifications.error(game.i18n.localize("MGT2.Errors.LockedContainer"));
        // A bag cannot end up inside itself, at any remove.
        else if (targetItem.containerChain.some(c => c.id === sourceItem._id))
          ui.notifications.error(game.i18n.localize("MGT2.Errors.ContainerRecursive"));
        else {
          sourceItem.system.container.id = targetId;
          await this.actor.updateEmbeddedDocuments('Item', [sourceItem]);
          return true;
        }
      }
    } else {
      // Copy from another collection.
      let stored = "";
      if (targetItem !== null) {
        if (targetItem.type === "container") {
          if (!targetItem.system.locked || game.user.isGM) stored = targetId;
        } else if (Object.hasOwn(targetItem.system, "container")) {
          stored = targetItem.system.container.id;   // dropped beside it, so stored with it
        }
      }

      const toCreate = await copyItemWithContents(sourceItemData, stored);
      const head = toCreate[0];

      // SOFTWARE --> COMPUTER: software follows the machine it was dropped on, not a container.
      if (head.system.software && (targetItem !== null)) {
        if (MGT2Helper.runsSoftware(targetItem)) head.system.software.computerId = targetItem._id;
        else if (targetItem.system.software) head.system.software.computerId = targetItem.system.software.computerId;
      }

      await this.actor.createEmbeddedDocuments("Item", toCreate, { keepId: true });
    }
    return true;
  }
}

/**
 * The NPC sheet — one class for both presets, because `subType` is a preset and not a branch.
 * @extends {TravellerActorSheet}
 */
export class NpcActorSheet extends TravellerActorSheet {

  /** Its own page lands with the reference chapter. @inheritDoc */
  static GUIDE_TOPIC = null;

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
      templates: [`${PARTS_PATH}/parts/row-controls.html`, `${PARTS_PATH}/parts/species.html`,
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

  /** The stored size DM beside the row the Animal Size table would have suggested. */
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

  /** The pool drawn on the stored wound. */
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

  /** Core p.90: 2D against the pattern's own thresholds. */
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
    return roll.toMessage({
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: await renderRollCard({
        roll,
        rollTypeName: game.i18n.localize("MGT2.Actor.npc.Reaction"),
        rollObjectName: game.i18n.localize(reaction.label),
        lines: [gate
          ? `${game.i18n.localize(outcome)} — ${game.i18n.localize(`MGT2.Reactions.Gates.${gate}`)}`
          : game.i18n.localize(outcome)]
      })
    });
  }
}
