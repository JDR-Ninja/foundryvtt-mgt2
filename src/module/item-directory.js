/** The Items sidebar, taught what storage means. @extends {ItemDirectory} */
export class MGT2ItemDirectory extends foundry.applications.sidebar.tabs.ItemDirectory {

  /** @inheritDoc */
  async _handleDroppedEntry(target, data) {
    const entry = await this._getDroppedEntryFromData(data);
    if ( entry && this._entryAlreadyExists(entry) && entry.system.container?.id ) {
      await entry.update({ "system.container.id": "" });
    }
    return super._handleDroppedEntry(target, data);
  }
}
