export class TravellerItem extends Item {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

  }

  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;

    if (this.type === "computer") {
      // Overload
      const newProcessing = foundry.utils.getProperty(changed, "system.processing") ?? this.system.processing;
      if (newProcessing !== this.system.processing) {
        let overload = this.system.processingUsed > newProcessing;
        foundry.utils.setProperty(changed, "system.overload", overload);
      }
    }

    // Qty max 1
    if (this.type === "computer" || this.type === "container" || (this.type === "item" && this.system.subType === "software")) {
      const newQty = foundry.utils.getProperty(changed, "system.quantity") ?? this.system.quantity;
      if (newQty !== this.system.quantity && newQty > 1) {
        foundry.utils.setProperty(changed, "system.quantity", 1);
      }
    }

    // No Weight
    if (this.type === "item" && this.system.subType === "software") {
      const newWeight = foundry.utils.getProperty(changed, "system.weight") ?? this.system.weight;
      if (newWeight !== this.system.weight && newWeight > 0) {
        foundry.utils.setProperty(changed, "system.weight", 0);
      }
    }
  }

  getRollDisplay() {
    if (this.type === "talent") {
      if (this.system.subType === "skill") {
        let label;
        if (this.system.skill.speciality !== "" && this.system.skill.speciality !== undefined) {
          label = `${this.name} (${this.system.skill.speciality})`;
        } else {
          label = this.name;
        }

        if (this.system.level > 0)
          label += ` (+${this.system.level})`;
        else if (this.system.level < 0)
          label += ` (${this.system.level})`;

        return label;
      } else if (this.system.subType === "psionic") {

      }
    }

    return name;
  }
}
