import { MGT2Helper } from "./helper.js";

export class TravellerItem extends Item {

  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;

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

  /**
   * The skill as a roll names it: the name, its speciality, and the level it contributes.
   * @param {boolean} [level]   Drop the level for a caller that prints the DM in a cell of its own —
   *                            it would otherwise state the same number twice on one line.
   */
  getRollDisplay(level = true) {
    if (this.type === "talent" && this.system.subType === "skill") {
      const speciality = this.system.skill.speciality;
      let label = speciality ? `${this.name} (${speciality})` : this.name;
      if (level && (this.system.level !== 0)) label += ` (${MGT2Helper.signed(this.system.level)})`;
      return label;
    }

    return this.name;
  }
}
