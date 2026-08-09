const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Sheet for the "vehicule" actor sub-type.
 *
 * NOTE: this sheet is not registered in core.js, and the "vehicule" sub-type has no data model
 * registered either (VehiculeData exists in datamodels.js but is never wired up). Its template
 * also still reads `system.personal.*`, which VehiculeData does not define. The class is kept
 * ApplicationV2-compatible so it is ready if the vehicle feature is finished, but it is
 * currently unused.
 *
 * @extends {ActorSheetV2}
 * @mixes HandlebarsApplication
 */
export class VehiculeActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["mgt2", "actor", "vehicule", "nopad", "themed", "theme-light"],
    position: { width: 780 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  /** @inheritDoc */
  static PARTS = {
    sheet: { root: true, template: "systems/mgt2/templates/actors/vehicule-sheet.html" }
  };

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    const theme = game.settings.get("mgt2", "theme");
    if ( theme && !options.classes.includes(theme) ) options.classes.push(theme);
    return options;
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, this.actor.toObject(false));
  }
}
