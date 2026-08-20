/** The system Actor document. */
export class TravellerActor extends Actor {

  /** @inheritDoc */
  async _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    await super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
    await this.system.onDeleteDescendantDocuments?.(parent, collection, documents, ids, options, userId);
  }

  /**
   * `life` is summed over the damage chain, so the bar cannot be written to directly: a drag is
   * translated into damage, or into healing when it goes the other way.
   * @inheritDoc
   */
  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    if ( attribute === "life" ) {
      // A bar drag types a wound rather than resolving an attack: no scale, no armour, no floor.
      await this.applyDamage(isDelta ? -value : this.system.life.value - value, { raw: true });
      return this;
    }

    // A characteristic's current value is `max - damage`, so its bar has to write the wound too.
    const [, key] = attribute.match(/^characteristics\.([^.]+)(?:\.value)?$/) ?? [];
    if ( !this.system.characteristicKeys?.includes(key) ) {
      return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
    }

    // Not capped at `max`: overrun is the Destroyed state, as it is for applyDamage's last link.
    const c = this.system.characteristics[key];
    const damage = isDelta ? (c.damage - value) : (c.damage + c.value - value);
    await this.update({ [`system.characteristics.${key}.damage`]: Math.max(0, damage) });
    return this;
  }

  applyDamage(amount, options = {}) {
    return this.system.applyDamage?.(amount, options);
  }

  getContainers() {
    return this.system.containers ?? [];
  }

  getComputers() {
    return this.system.computers ?? [];
  }
}
