import { Doses, DOSE_FLAG } from "./doses.js";

const { ActiveEffectConfig } = foundry.applications.sheets;

/**
 * Derived states shown as a token icon, `unconscious` and `dead` reusing Foundry's own ids
 * (`client/config.mjs:1740, :1745`).
 */
const DERIVED_STATES = Object.freeze([
  ["encumbrance", "encumbered"],
  ["unconscious", "unconscious"],
  ["dead", "dead"]
]);

/**
 * Stored states with an icon, kept equal in **both** directions: the sheet's tick writes the icon
 * and the token HUD writes the field.
 */
const STORED_STATES = Object.freeze([["fatigue", "fatigued"]]);

const MIRRORED_IDS = Object.freeze([...DERIVED_STATES, ...STORED_STATES].map(([, id]) => id));

/** Added to Foundry's list, not replacing it: prone, blind and stunned are Traveller's too. */
const STATUS_EFFECTS = Object.freeze([
  { id: "fatigued", name: "MGT2.Status.Fatigued", img: "icons/svg/downgrade.svg" },
  { id: "encumbered", name: "MGT2.Status.Encumbered", img: "icons/svg/anchor.svg" }
]);

/** The MGT2 ActiveEffect. @extends {ActiveEffect} */
export class MGT2ActiveEffect extends foundry.documents.ActiveEffect {

  /**
   * Suspension is the referee's pause, kept apart from `disabled` because an effect the player
   * switched off and one the table is ignoring for a scene are different things.
   * @inheritDoc
   */
  get isSuppressed() {
    // A drug's own effects are the TEMPLATE a dose copies onto the Traveller, so carrying the box
    // changes nothing: the trigger is consumption, not equipment.
    if ( this.parent?.type === "drug" ) return true;
    return (this.flags?.mgt2?.suspended === true) || super.isSuppressed;
  }

  /**
   * An effect transferred from an Item resolves its `@` expressions against the Actor and nothing
   * else — `Actor#getRollData` returns `system` (`client/documents/actor.mjs:238`), so the number a
   * trait actually scales on, the armour's protection or the talent's level, is invisible to the
   * change carrying it.
   * @inheritDoc
   */
  getReplacementData(baseData) {
    const item = (this.parent?.documentName === "Item") ? this.parent : null;
    if ( !item ) return baseData;
    return Object.assign(Object.create(baseData), { item: item.system });
  }
}

/**
 * The effect configuration, for one reason: **core renders `phase` as a hidden input**
 * (`templates/sheets/active-effect/change.hbs:11`), so the field that decides whether a change
 * lands at all cannot be edited — and a change aimed at a derived value without `final` is
 * overwritten by the next `prepareDerivedData`, which looks exactly like a broken effect.
 * @extends {ActiveEffectConfig}
 */
export class MGT2EffectConfig extends ActiveEffectConfig {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    // Six columns where core has five, so the window needs the width the sixth one takes.
    position: { width: 620 }
  };

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
    changes: {
      template: "systems/mgt2/templates/effect-config.html",
      scrollable: ["ol[data-changes]"]
    }
  };

  /** The changes tab is rebuilt from source: core's rows are the thing being replaced. @inheritDoc */
  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    if ( partId !== "changes" ) return partContext;

    const effect = this.document;
    const labels = entries => Object.fromEntries(
      entries.map(([value, config]) => [value, game.i18n.localize(config.label)]));

    partContext.fields = effect.system.schema.fields.changes.element.fields;
    partContext.changeTypes = labels(Object.entries(effect.constructor.CHANGE_TYPES));
    partContext.phases = labels(Object.entries(effect.constructor.CHANGE_PHASES));
    // `_source.changes` still resolves, but only through the shim `shimData` installs onto the
    // system source (`common/documents/active-effect.mjs:247-255`); the system model owns them.
    partContext.changes = (effect._source.system.changes ?? []).map((change, index) => ({
      index,
      path: `system.changes.${index}`,
      key: change.key,
      type: change.type,
      // An AnyField holds whatever it was given, and the form round-trips it as JSON — which is
      // what `_processChangeSubmission` parses back (`active-effect-config.mjs:218`).
      value: (typeof change.value === "string") ? change.value : JSON.stringify(change.value),
      phase: change.phase,
      priority: change.priority,
      known: change.type in effect.constructor.CHANGE_TYPES,
      defaultPriority: effect.constructor.CHANGE_TYPES[change.type]?.defaultPriority ?? 0,
      phaseHint: game.i18n.localize(effect.constructor.CHANGE_PHASES[change.phase]?.hint ?? "")
    }));
    return partContext;
  }
}

/** One presentation row per effect. */
export function prepareEffects(doc) {
  const source = (doc.documentName === "Actor") ? doc.allApplicableEffects() : doc.effects;
  const rows = [];
  for ( const effect of source ) {
    const mirrored = MIRRORED_IDS.some(id => effect.statuses.has(id));
    const dose = effect.flags?.mgt2?.[DOSE_FLAG] ?? null;
    rows.push({
      uuid: effect.uuid,
      name: effect.name,
      img: effect.img,
      // Null when the effect is the document's own; otherwise the Item it transfers from.
      origin: (effect.parent === doc) ? null : effect.parent?.name,
      disabled: effect.disabled,
      suspended: effect.flags?.mgt2?.suspended === true,
      active: effect.active,
      mirrored,
      // A dose, which is the one kind of effect that ends in something rather than just ending
      //.
      dose,
      onset: (dose && effect.disabled) ? dose.onset : null,
      // A permanent effect's label is "None", which says nothing worth a column.
      duration: effect.isTemporary ? effect.duration.label : null,
      changes: (effect.system.changes ?? []).map(change => ({
        key: change.key,
        type: change.type,
        phase: change.phase,
        final: change.phase === "final",
        value: (typeof change.value === "object") ? JSON.stringify(change.value) : String(change.value ?? "")
      }))
    });
  }
  return rows;
}

/** The effect a clicked control belongs to, resolved by uuid because it may live on an owned Item. */
function effectOf(target) {
  const uuid = target.closest("[data-effect-uuid]")?.dataset.effectUuid;
  return uuid ? foundry.utils.fromUuidSync(uuid) : null;
}

// The five handlers below are action callbacks: ApplicationV2 binds `this` to the sheet, so the
// same function serves the Actor's Effects tab and the Item's Effects block.

async function onEffectCreate() {
  const [effect] = await CONFIG.ActiveEffect.documentClass.createDocuments([{
    name: game.i18n.localize("MGT2.Effects.New"),
    img: "icons/svg/aura.svg"
  }], { parent: this.document });
  return effect?.sheet.render({ force: true });
}

async function onEffectEdit(event, target) {
  return effectOf(target)?.sheet.render({ force: true });
}

async function onEffectDelete(event, target) {
  return effectOf(target)?.deleteDialog();
}

async function onEffectToggle(event, target) {
  const effect = effectOf(target);
  return effect?.update({ disabled: !effect.disabled });
}

async function onEffectSuspend(event, target) {
  const effect = effectOf(target);
  if ( !effect ) return;
  return effect.setFlag("mgt2", "suspended", effect.flags?.mgt2?.suspended !== true);
}

/** A dose does not merely stop: CSC p.93-97 lets it end in a condition or in damage. */
async function onDoseEnd(event, target) {
  return Doses.end(effectOf(target));
}


export const EFFECT_ACTIONS = Object.freeze({
  effectCreate: onEffectCreate,
  effectEdit: onEffectEdit,
  effectDelete: onEffectDelete,
  effectToggle: onEffectToggle,
  effectSuspend: onEffectSuspend,
  doseEnd: onDoseEnd
});

/** Whether one client should be doing this actor's status bookkeeping at all. */
function canSync(actor) {
  return !!actor?.system?.states && !actor.pack && (game.users.activeGM?.isSelf === true);
}

const syncing = new Set();

/** Bring the status icons back in step with the states behind them. */
export async function syncStatuses(actor) {
  if ( !canSync(actor) || syncing.has(actor.uuid) ) return;
  syncing.add(actor.uuid);
  try {
    for ( const [key, statusId] of [...DERIVED_STATES, ...STORED_STATES] ) {
      if ( !(key in actor.system.states) ) continue;
      const wanted = actor.system.states[key] === true;
      if ( wanted === actor.statuses.has(statusId) ) continue;
      await actor.toggleStatusEffect(statusId, { active: wanted });
    }
  } finally {
    syncing.delete(actor.uuid);
  }
}

/**
 * The other direction, and only for a stored state: a status toggled from the token HUD writes the
 * field the sheet ticks.
 */
async function onStatusToggled(effect, active) {
  const actor = effect.target;
  if ( !(actor instanceof Actor) || !canSync(actor) ) return;

  // Any other effect can have moved a derived state — and a hand-placed derived icon is taken back
  // by the same pass, because that icon is a readout and not an input.
  const stored = STORED_STATES.find(([, id]) => effect.statuses.has(id));
  if ( !stored ) return syncStatuses(actor);

  const [key] = stored;
  if ( !(key in actor.system.states) || (actor.system.states[key] === active) ) return;
  return actor.update({ [`system.states.${key}`]: active });
}

/** Called from the `init` hook, before any document is prepared. */
export function registerActiveEffects() {
  CONFIG.ActiveEffect.documentClass = MGT2ActiveEffect;
  for ( const status of STATUS_EFFECTS ) CONFIG.statusEffects[status.id] = status;

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.ActiveEffect, "mgt2", MGT2EffectConfig, {
      makeDefault: true,
      label: "MGT2.Effects.SheetLabel"
    });

  Hooks.on("updateActor", actor => syncStatuses(actor));
  // Weight moves with the inventory, and encumbrance is one of the mirrored states.
  for ( const hook of ["createItem", "updateItem", "deleteItem"] ) {
    Hooks.on(hook, item => { if ( item.actor ) syncStatuses(item.actor); });
  }
  Hooks.on("createActiveEffect", effect => onStatusToggled(effect, effect.active));
  Hooks.on("updateActiveEffect", effect => onStatusToggled(effect, effect.active));
  Hooks.on("deleteActiveEffect", effect => onStatusToggled(effect, false));
}
