/** Toggle the sheet between play and edit mode, saving what is in the form first. */
async function onToggleSheetMode() {
  const { MODES } = this.constructor;
  this._mode = this.isEditMode ? MODES.PLAY : MODES.EDIT;
  await this.submit();
  this.render();
}

/**
 * Play / edit mode, shared by the actor and item sheets — which have no common base of their own.
 * @returns {typeof DocumentSheetV2}
 */
export const SheetModeMixin = Base => class extends Base {

  /** @enum {number} */
  static MODES = { PLAY: 1, EDIT: 2 };

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: { toggleSheetMode: onToggleSheetMode }
  };

  /** @type {number|null} */
  _mode = null;

  /** @type {boolean} */
  get isEditMode() {
    return this._mode === this.constructor.MODES.EDIT;
  }

  /** @inheritDoc */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    this._mode = options.mode ?? this._mode ?? this.constructor.MODES.PLAY;
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.editable = this.isEditable && this.isEditMode;
    return context;
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.dataset.mode = this.isEditMode ? "edit" : "play";
    this.#renderModeToggle();
  }

  /**
   * A closed sheet keeps its instance — the document caches it — so the mode has to be cleared here
   * for the next open to start in play.
   * @inheritDoc
   */
  _onClose(options) {
    super._onClose(options);
    this._mode = null;
  }

  /** The window frame outlives a re-render, so the toggle is built once and only relabelled after. */
  #renderModeToggle() {
    const header = this.element.querySelector(".window-header");
    if ( !header ) return;
    let toggle = header.querySelector(".mgt2-mode");
    if ( !this.isEditable ) return toggle?.remove();
    if ( !toggle ) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "mgt2-mode";
      toggle.dataset.action = "toggleSheetMode";
      toggle.dataset.tooltip = "MGT2.Sheet.ModeToggle";
      toggle.setAttribute("aria-label", game.i18n.localize("MGT2.Sheet.ModeToggle"));
      // The header drags the window on pointerdown and minimises it on double click.
      toggle.addEventListener("pointerdown", event => event.stopPropagation());
      toggle.addEventListener("dblclick", event => event.stopPropagation());
      header.prepend(toggle);
    }
    toggle.textContent = game.i18n.localize(`MGT2.Sheet.Mode${this.isEditMode ? "Edit" : "Play"}`);
  }
};
