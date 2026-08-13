/**
 * The Items sidebar, taught what storage means.
 *
 * A stored world item stays listed here: it is a world item like any other, and hiding it would
 * take it out of the folders and out of the search. What the directory adds is the way back out —
 * dropping a stored item into the list is how it leaves the container it is in.
 *
 * @extends {ItemDirectory}
 */
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
