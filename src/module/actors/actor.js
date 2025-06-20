import { ActorCharacter } from "./character.js";

export class MGT2Combatant extends Combatant {
 
}

export class TravellerActor extends Actor {


  prepareDerivedData() {
    if (this.type === "character") {
      this.system.initiative = ActorCharacter.getInitiative(this);
    }
  }

  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    
    if (this.type === "character") {
      ActorCharacter.preCreate(this, data, options, user);
    }
  }

  async _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    await super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);

    if (this.type === "character") {
      await ActorCharacter.onDeleteDescendantDocuments(this, parent, collection, documents, ids, options, userId);
    }
  }

  async _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
    super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    //console.log("_onUpdateDescendantDocuments");

    if (this.type === "character") {
      await ActorCharacter.onUpdateDescendantDocuments(this, parent, collection, documents, changes, options, userId);
    }
  }

  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;

    if (this.type === "character") {
      await ActorCharacter.preUpdate(this, changed, options, user);
    }
  }

  getInitiative($this) {
    if (this.type === "character") {
      return ActorCharacter.getInitiative(this);
    }
  }

  applyDamage(amount) {
    if (this.type === "character") {
      ActorCharacter.applyDamage(this, amount);
    }
  }

  getContainers() {
    if (this.type === "character") {
      return ActorCharacter.getContainers(this);
    }

    return [];
  }

  getComputers() {
    if (this.type === "character") {
      return ActorCharacter.getComputers(this);
    }

    return [];
  }

  getSkills() {
    if (this.type === "character") {
      return ActorCharacter.getSkills(this);
    }

    return [];
  }



}
