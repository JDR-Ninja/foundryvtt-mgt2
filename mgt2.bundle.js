const fields = foundry.data.fields;
class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: new fields.StringField({ required: false, blank: false, trim: true }),
      life: new fields.SchemaField({
        value: new fields.NumberField({ required: false, initial: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 0, integer: true })
      }),
      personal: new fields.SchemaField({
        title: new fields.StringField({ required: false, blank: true, trim: true }),
        species: new fields.StringField({ required: false, blank: true, trim: true }),
        speciesText: new fields.SchemaField({
          description: new fields.StringField({ required: false, blank: true, trim: true, nullable: true }),
          descriptionLong: new fields.HTMLField({ required: false, blank: true, trim: true })
        }),
        age: new fields.StringField({ required: false, blank: true, trim: true }),
        gender: new fields.StringField({ required: false, blank: true, trim: true }),
        pronouns: new fields.StringField({ required: false, blank: true, trim: true }),
        homeworld: new fields.StringField({ required: false, blank: true, trim: true }),
        ucp: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        traits: new fields.ArrayField(
          new fields.SchemaField({
            name: new fields.StringField({ required: true, blank: true, trim: true }),
            description: new fields.StringField({ required: false, blank: true, trim: true })
          })
        )
      }),
      biography: new fields.HTMLField({ required: false, blank: true, trim: true }),
      characteristics: new fields.SchemaField({
        strength: createCharacteristicField(true, true),
        dexterity: createCharacteristicField(true, true),
        endurance: createCharacteristicField(true, true),
        intellect: createCharacteristicField(true, false),
        education: createCharacteristicField(true, false),
        social: createCharacteristicField(true, false),
        morale: createCharacteristicField(true, false),
        luck: createCharacteristicField(true, false),
        sanity: createCharacteristicField(true, false),
        charm: createCharacteristicField(true, false),
        psionic: createCharacteristicField(true, false),
        other: createCharacteristicField(true, false)
      }),
      health: new fields.SchemaField({
        radiations: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
      }),
      study: new fields.SchemaField({
        skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
        total: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
        completed: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
      }),
      finance: new fields.SchemaField({
        pension: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        credits: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        cashOnHand: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        debt: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        livingCost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        monthlyShipPayments: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        notes: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
      }),
      containerView: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
      containerDropIn: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, trim: true }),
      inventory: new fields.SchemaField({
        armor: new fields.NumberField({ required: true, initial: 0, integer: true }),
        weight: new fields.NumberField({ required: true, initial: 0, min: 0, integer: false }),
        encumbrance: new fields.SchemaField({
          normal: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
          heavy: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true })
        })
      }),
      states: new fields.SchemaField({
        encumbrance: new fields.BooleanField({ required: false, initial: false }),
        fatigue: new fields.BooleanField({ required: false, initial: false }),
        unconscious: new fields.BooleanField({ required: false, initial: false }),
        surgeryRequired: new fields.BooleanField({ required: false, initial: false })
      }),
      config: new fields.SchemaField({
        psionic: new fields.BooleanField({ required: false, initial: true }),
        initiative: new fields.StringField({ required: false, blank: true, initial: "dexterity" }),
        damages: new fields.SchemaField({
          rank1: new fields.StringField({ required: false, blank: true, initial: "strength" }),
          rank2: new fields.StringField({ required: false, blank: true, initial: "dexterity" }),
          rank3: new fields.StringField({ required: false, blank: true, initial: "endurance" })
        })
      })
    };
  }
}
class VehiculeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: new fields.StringField({ required: false, blank: false, trim: true }),
      skillId: new fields.StringField({ required: false, initial: "", blank: true, trim: true }),
      speed: new fields.SchemaField({
        cruise: new fields.StringField({ required: false, initial: "Slow", blank: true }),
        maximum: new fields.StringField({ required: false, initial: "Medium", blank: true })
      }),
      agility: new fields.NumberField({ required: false, min: 0, integer: true }),
      crew: new fields.NumberField({ required: false, min: 0, integer: true }),
      passengers: new fields.NumberField({ required: false, min: 0, integer: true }),
      cargo: new fields.NumberField({ required: false, min: 0, integer: false }),
      //hull
      life: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 0, integer: true })
      }),
      shipping: new fields.NumberField({ required: false, min: 0, integer: true }),
      cost: new fields.NumberField({ required: false, min: 0, integer: true }),
      armor: new fields.SchemaField({
        front: new fields.NumberField({ required: true, initial: 0, integer: true }),
        rear: new fields.NumberField({ required: true, initial: 0, integer: true }),
        sides: new fields.NumberField({ required: true, initial: 0, integer: true })
      }),
      skills: new fields.SchemaField({
        // Skill Level
        autopilot: new fields.NumberField({ required: true, initial: 0, integer: true })
        // Communication Range
        // Navigation
        // Sensors
        // Camouflage / Recon
        // Stealth
      })
      // config: new fields.SchemaField({
      // })
    };
  }
}
class ItemBaseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields2 = foundry.data.fields;
    const schema = {
      //name: new fields.StringField({ required: true, blank: true, trim: true, nullable: true }),
      description: new fields2.StringField({ required: false, blank: true, trim: true, nullable: true }),
      //type: new fields.StringField({ required: false, blank: false }),
      subType: new fields2.StringField({ required: false, blank: false, nullable: true })
    };
    return schema;
  }
}
class PhysicalItemData extends ItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.quantity = new fields.NumberField({ required: true, initial: 1, min: 0, integer: true });
    schema.weight = new fields.NumberField({ required: true, initial: 0, min: 0, integer: false });
    schema.weightless = new fields.BooleanField({ required: false, initial: false });
    schema.cost = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });
    schema.tl = new fields.StringField({ required: true, blank: false, initial: "TL12" });
    schema.container = new fields.SchemaField({
      //inContainer: new fields.BooleanField({ required: false, initial: false }),
      id: new fields.StringField({ required: false, blank: true })
    });
    schema.roll = new fields.SchemaField({
      characteristic: new fields.StringField({ required: false, blank: true, trim: true }),
      skill: new fields.StringField({ required: false, blank: true, trim: true }),
      difficulty: new fields.StringField({ required: false, blank: true, trim: true })
    });
    schema.trash = new fields.BooleanField({ required: false, initial: false });
    return schema;
  }
}
class ItemData extends PhysicalItemData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.subType.initial = "loot";
    schema.software = new fields.SchemaField({
      bandwidth: new fields.NumberField({ required: false, initial: 0, min: 0, max: 10, integer: true }),
      effect: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
      computerId: new fields.StringField({ required: false, blank: true, initial: "" })
    });
    return schema;
  }
}
class EquipmentData extends PhysicalItemData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.equipped = new fields.BooleanField({ required: false, initial: false });
    schema.augment = new fields.SchemaField({
      improvement: new fields.StringField({ required: false, blank: true, trim: true })
    });
    schema.subType.initial = "equipment";
    return schema;
  }
}
class DiseaseData extends ItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.subType.initial = "disease";
    schema.difficulty = new fields.StringField({ required: true, initial: "Average" });
    schema.damage = new fields.StringField({ required: false, blank: true });
    schema.interval = new fields.StringField({ required: false, blank: true });
    return schema;
  }
}
class CareerData extends ItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.difficulty = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });
    schema.damage = new fields.StringField({ required: false, blank: true });
    schema.interval = new fields.StringField({ required: false, blank: true });
    schema.assignment = new fields.StringField({ required: false, blank: true });
    schema.terms = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
    schema.rank = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
    schema.events = new fields.ArrayField(
      new fields.SchemaField({
        age: new fields.NumberField({ required: false, integer: true }),
        description: new fields.StringField({ required: false, blank: true, trim: true })
      })
    );
    return schema;
  }
}
class TalentData extends ItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.subType.initial = "skill";
    schema.cost = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });
    schema.level = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true });
    schema.skill = new fields.SchemaField({
      speciality: new fields.StringField({ required: false, blank: true, trim: true }),
      reduceEncumbrance: new fields.BooleanField({ required: false, initial: false })
    });
    schema.psionic = new fields.SchemaField({
      reach: new fields.StringField({ required: false, blank: true, trim: true }),
      cost: new fields.NumberField({ required: false, initial: 1, min: 0, integer: true }),
      duration: new fields.StringField({ required: false, blank: true, trim: true }),
      durationUnit: new fields.StringField({ required: false })
    });
    schema.roll = new fields.SchemaField({
      characteristic: new fields.StringField({ required: false, blank: true, trim: true }),
      skill: new fields.StringField({ required: false, blank: true, trim: true }),
      difficulty: new fields.StringField({ required: false, blank: true, trim: true })
    });
    return schema;
  }
}
class ContactData extends ItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.subType.initial = "skill";
    schema.cost = new fields.NumberField({ required: true, initial: 1, min: 0, integer: true });
    schema.skill = new fields.SchemaField({
      speciality: new fields.StringField({ required: false, blank: true, trim: true }),
      characteristic: new fields.StringField({ required: false, blank: true, trim: true })
    });
    schema.status = new fields.StringField({ required: false, blank: true, trim: true, initial: "Alive" });
    schema.attitude = new fields.StringField({ required: false, blank: true, trim: true, initial: "Unknow" });
    schema.relation = new fields.StringField({ required: false, blank: true, trim: true, initial: "Contact" });
    schema.title = new fields.StringField({ required: false, blank: true, trim: true });
    schema.nickname = new fields.StringField({ required: false, blank: true, trim: true });
    schema.species = new fields.StringField({ required: false, blank: true, trim: true });
    schema.gender = new fields.StringField({ required: false, blank: true, trim: true });
    schema.pronouns = new fields.StringField({ required: false, blank: true, trim: true });
    schema.homeworld = new fields.StringField({ required: false, blank: true, trim: true });
    schema.location = new fields.StringField({ required: false, blank: true, trim: true });
    schema.occupation = new fields.StringField({ required: false, blank: true, trim: true });
    schema.notes = new fields.HTMLField({ required: false, blank: true, trim: true });
    return schema;
  }
}
class WeaponData extends PhysicalItemData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.equipped = new fields.BooleanField({ required: false, initial: false });
    schema.range = new fields.SchemaField({
      isMelee: new fields.BooleanField({ required: false, initial: false }),
      value: new fields.NumberField({ required: false, integer: true, nullable: true }),
      unit: new fields.StringField({ required: false, blank: true, nullable: true })
    }), //schema.tons = new fields.NumberField({ required: false, initial: 0, min: 0, integer: false });
    schema.damage = new fields.StringField({ required: false, blank: true, trim: true });
    schema.magazine = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
    schema.magazineCost = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
    schema.traits = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: true, trim: true }),
        description: new fields.StringField({ required: false, blank: true, trim: true })
      })
    );
    schema.options = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: true, trim: true }),
        description: new fields.StringField({ required: false, blank: true, trim: true })
      })
    );
    return schema;
  }
}
class ArmorData extends PhysicalItemData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.equipped = new fields.BooleanField({ required: false, initial: false });
    schema.radiations = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
    schema.protection = new fields.StringField({ required: false, blank: false, trim: true });
    schema.requireSkill = new fields.StringField({ required: false, blank: false });
    schema.requireSkillLevel = new fields.NumberField({ required: false, min: 0, integer: true });
    schema.powered = new fields.BooleanField({ required: false, initial: false });
    schema.options = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: true, trim: true }),
        description: new fields.StringField({ required: false, blank: true, trim: true })
      })
    );
    return schema;
  }
}
class ComputerData extends PhysicalItemData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.processing = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
    schema.processingUsed = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
    schema.overload = new fields.BooleanField({ required: false, initial: false });
    schema.options = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: true, trim: true }),
        description: new fields.StringField({ required: false, blank: true, trim: true })
      })
    );
    return schema;
  }
}
class SpeciesData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields2 = foundry.data.fields;
    const schema = {
      description: new fields2.StringField({ required: false, blank: true, trim: true, nullable: true }),
      descriptionLong: new fields2.HTMLField({ required: false, blank: true, trim: true }),
      traits: new fields2.ArrayField(
        new fields2.SchemaField({
          name: new fields2.StringField({ required: true, blank: true, trim: true }),
          description: new fields2.StringField({ required: false, blank: true, trim: true })
        })
      ),
      modifiers: new fields2.ArrayField(
        new fields2.SchemaField({
          characteristic: new fields2.StringField({ required: false, blank: true, trim: true }),
          value: new fields2.NumberField({ required: false, integer: true, nullable: true })
        })
      )
    };
    return schema;
  }
}
class ItemContainerData extends ItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.onHand = new fields.BooleanField({ required: false, initial: false });
    schema.location = new fields.StringField({ required: false, blank: true, trim: true });
    schema.count = new fields.NumberField({ required: false, initial: 0, integer: true });
    schema.weight = new fields.NumberField({ required: false, initial: 0, integer: false });
    schema.weightless = new fields.BooleanField({ required: false, initial: false });
    schema.locked = new fields.BooleanField({ required: false, initial: false });
    schema.lockedDescription = new fields.StringField({ required: false, blank: true, trim: true, nullable: true });
    return schema;
  }
}
function createCharacteristicField(show = true, showMax = false) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
    max: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
    dm: new fields.NumberField({ required: false, initial: 0, integer: true }),
    show: new fields.BooleanField({ required: false, initial: show }),
    showMax: new fields.BooleanField({ required: false, initial: showMax })
  });
}

const MGT2 = {};
MGT2.MetricRange = Object.freeze({
  meter: "MGT2.MetricRange.meter",
  kilometer: "MGT2.MetricRange.kilometer"
});
MGT2.MetricWeight = Object.freeze({
  kilogram: "MGT2.MetricWeight.kilogram",
  ton: "MGT2.MetricWeight.ton"
});
MGT2.Difficulty = Object.freeze({
  NA: "MGT2.Difficulty.NA",
  Simple: "MGT2.Difficulty.Simple",
  Easy: "MGT2.Difficulty.Easy",
  Routine: "MGT2.Difficulty.Routine",
  Average: "MGT2.Difficulty.Average",
  Difficult: "MGT2.Difficulty.Difficult",
  VeryDifficult: "MGT2.Difficulty.VeryDifficult",
  Formidable: "MGT2.Difficulty.Formidable",
  Impossible: "MGT2.Difficulty.Impossible"
});
MGT2.ItemSubType = Object.freeze({
  loot: "MGT2.ItemSubType.loot",
  software: "MGT2.ItemSubType.software"
});
MGT2.EquipmentSubType = Object.freeze({
  augment: "MGT2.EquipmentSubType.augment",
  clothing: "MGT2.EquipmentSubType.clothing",
  equipment: "MGT2.EquipmentSubType.equipment",
  trinket: "MGT2.EquipmentSubType.trinket",
  toolkit: "MGT2.EquipmentSubType.toolkit"
});
MGT2.TalentSubType = Object.freeze({
  skill: "MGT2.TalentSubType.skill",
  psionic: "MGT2.TalentSubType.psionic"
});
MGT2.DiseaseSubType = Object.freeze({
  disease: "MGT2.DiseaseSubType.disease",
  poison: "MGT2.DiseaseSubType.poison",
  wound: "MGT2.DiseaseSubType.wound"
});
MGT2.PsionicReach = Object.freeze({
  NA: "MGT2.PsionicReach.NA",
  Personal: "MGT2.PsionicReach.Personal",
  Close: "MGT2.PsionicReach.Close",
  Short: "MGT2.PsionicReach.Short",
  Medium: "MGT2.PsionicReach.Medium",
  Long: "MGT2.PsionicReach.Long",
  VeryLong: "MGT2.PsionicReach.VeryLong",
  Distant: "MGT2.PsionicReach.Distant",
  VeryDistant: "MGT2.PsionicReach.VeryDistant",
  Continental: "MGT2.PsionicReach.Continental",
  Planetary: "MGT2.PsionicReach.Planetary"
});
MGT2.ContactRelations = Object.freeze({
  Allie: "MGT2.Contact.Relation.Allie",
  Contact: "MGT2.Contact.Relation.Contact",
  Rival: "MGT2.Contact.Relation.Rival",
  Enemy: "MGT2.Contact.Relation.Enemy"
});
MGT2.ContactStatus = Object.freeze({
  Alive: "MGT2.Contact.Status.Alive",
  Unknow: "MGT2.Contact.Status.Unknow",
  Dead: "MGT2.Contact.Status.Dead"
});
MGT2.Attitudes = Object.freeze({
  Unknow: "MGT2.Contact.Attitude.Unknow",
  Hostile: "MGT2.Contact.Attitude.Hostile",
  Unfriendly: "MGT2.Contact.Attitude.Unfriendly",
  Indifferent: "MGT2.Contact.Attitude.Indifferent",
  Friendly: "MGT2.Contact.Attitude.Friendly",
  Helpful: "MGT2.Contact.Attitude.Helpful",
  Complicated: "MGT2.Contact.Attitude.Complicated"
});
MGT2.Characteristics = Object.freeze({
  strength: "MGT2.Characteristics.strength.name",
  dexterity: "MGT2.Characteristics.dexterity.name",
  endurance: "MGT2.Characteristics.endurance.name",
  intellect: "MGT2.Characteristics.intellect.name",
  education: "MGT2.Characteristics.education.name",
  social: "MGT2.Characteristics.social.name",
  morale: "MGT2.Characteristics.morale.name",
  luck: "MGT2.Characteristics.luck.name",
  sanity: "MGT2.Characteristics.sanity.name",
  charm: "MGT2.Characteristics.charm.name",
  psionic: "MGT2.Characteristics.psionic.name",
  other: "MGT2.Characteristics.other.name"
});
MGT2.InitiativeCharacteristics = Object.freeze({
  dexterity: "MGT2.Characteristics.dexterity.name",
  intellect: "MGT2.Characteristics.intellect.name"
});
MGT2.DamageCharacteristics = Object.freeze({
  strength: "MGT2.Characteristics.strength.name",
  dexterity: "MGT2.Characteristics.dexterity.name",
  endurance: "MGT2.Characteristics.endurance.name"
});
MGT2.TL = Object.freeze({
  NA: "MGT2.TL.NA",
  Unknow: "MGT2.TL.Unknow",
  NotIdentified: "MGT2.TL.NotIdentified",
  TL00: "MGT2.TL.L00",
  TL01: "MGT2.TL.L01",
  TL02: "MGT2.TL.L02",
  TL03: "MGT2.TL.L03",
  TL04: "MGT2.TL.L04",
  TL05: "MGT2.TL.L05",
  TL06: "MGT2.TL.L06",
  TL07: "MGT2.TL.L07",
  TL08: "MGT2.TL.L08",
  TL09: "MGT2.TL.L09",
  TL10: "MGT2.TL.L10",
  TL11: "MGT2.TL.L11",
  TL12: "MGT2.TL.L12",
  TL13: "MGT2.TL.L13",
  TL14: "MGT2.TL.L14",
  TL15: "MGT2.TL.L15"
});
MGT2.Timeframes = Object.freeze({
  Normal: "MGT2.Timeframes.Normal",
  Slower: "MGT2.Timeframes.Slower",
  Faster: "MGT2.Timeframes.Faster"
});
MGT2.SpeedBands = Object.freeze({
  Stoppped: "MGT2.SpeedBands.Stoppped",
  Idle: "MGT2.SpeedBands.Idle",
  VerySlow: "MGT2.SpeedBands.VerySlow",
  Slow: "MGT2.SpeedBands.Slow",
  Medium: "MGT2.SpeedBands.Medium",
  High: "MGT2.SpeedBands.High.",
  Fast: "MGT2.SpeedBands.Fast",
  VeryFast: "MGT2.SpeedBands.VeryFast",
  Subsonic: "MGT2.SpeedBands.Subsonic",
  Hypersonic: "MGT2.SpeedBands.Hypersonic"
});
MGT2.Durations = Object.freeze({
  Seconds: "MGT2.Durations.Seconds",
  Minutes: "MGT2.Durations.Minutes",
  Heures: "MGT2.Durations.Heures"
});

class ActorCharacter {
  static preCreate($this, data, options, user) {
    $this.updateSource({ prototypeToken: { actorLink: true } });
  }
  static prepareData(actorData) {
    actorData.initiative = this.getInitiative(actorData);
  }
  static getInitiative($this) {
    let c = $this.system.config.initiative;
    return $this.system.characteristics[c].dm;
  }
  static async onDeleteDescendantDocuments($this, parent, collection, documents, ids, options, userId) {
    const toDeleteIds = [];
    const itemToUpdates = [];
    for (let d of documents) {
      if (d.type === "container") {
        for (let item of $this.items) {
          if (item.system.hasOwnProperty("container") && item.system.container.id === d._id)
            toDeleteIds.push(item._id);
        }
      } else if (d.type === "computer") {
        for (let item of $this.items) {
          if (item.system.hasOwnProperty("software") && item.system.computerId === d._id) {
            let clone = duplicate(item);
            clone.system.software.computerId = "";
            itemToUpdates.push(clone);
          }
        }
      }
    }
    if (toDeleteIds.length > 0)
      await $this.deleteEmbeddedDocuments("Item", toDeleteIds);
    if (itemToUpdates.length > 0)
      await $this.updateEmbeddedDocuments("Item", itemToUpdates);
    await this.recalculateWeight();
  }
  static async onUpdateDescendantDocuments($this, parent, collection, documents, changes, options, userId) {
    await this.calculEncumbranceAndWeight($this, parent, collection, documents, changes, options, userId);
    await this.calculComputers($this, parent, collection, documents, changes, options, userId);
  }
  static async calculComputers($this, parent, collection, documents, changes, options, userId) {
    let change;
    let i = 0;
    let recalculProcessing = false;
    for (let d of documents) {
      if (changes[i].hasOwnProperty("system")) {
        change = changes[i];
        if (d.type === "item" && d.system.subType === "software") {
          if (change.system.software.hasOwnProperty("bandwidth") || change.system.software.hasOwnProperty("computerId")) {
            recalculProcessing = true;
            break;
          }
        }
      }
    }
    if (recalculProcessing) {
      let updatedComputers = [];
      let computerChanges = {};
      let computers = [];
      for (let item of $this.items) {
        if (item.system.trash === true)
          continue;
        if (item.type === "computer") {
          computers.push(item);
          computerChanges[item._id] = { processingUsed: 0 };
        }
      }
      for (let item of $this.items) {
        if (item.type !== "item" && item.system.subType !== "software")
          continue;
        if (item.system.software.hasOwnProperty("computerId") && item.system.software.computerId !== "") {
          computerChanges[item.system.software.computerId].processingUsed += item.system.software.bandwidth;
        }
      }
      for (let computer of computers) {
        let newProcessingUsed = computerChanges[computer._id].processingUsed;
        if (computer.system.processingUsed !== newProcessingUsed) {
          const cloneComputer = duplicate($this.getEmbeddedDocument("Item", computer._id));
          cloneComputer.system.processingUsed = newProcessingUsed;
          cloneComputer.system.overload = cloneComputer.system.processingUsed > cloneComputer.system.processing;
          updatedComputers.push(cloneComputer);
        }
      }
      if (updatedComputers.length > 0) {
        await $this.updateEmbeddedDocuments("Item", updatedComputers);
      }
    }
  }
  static async calculEncumbranceAndWeight($this, parent, collection, documents, changes, options, userId) {
    var _a, _b;
    let recalculEncumbrance = false;
    let recalculWeight = false;
    let change;
    let i = 0;
    for (let d of documents) {
      if (changes[i].hasOwnProperty("system")) {
        change = changes[i];
        if (d.type === "armor" || d.type === "computer" || d.type === "gear" || d.type === "item" || d.type === "weapon") {
          if (change.system.hasOwnProperty("quantity") || change.system.hasOwnProperty("weight") || change.system.hasOwnProperty("weightless") || change.system.hasOwnProperty("container") || change.system.hasOwnProperty("equipped") || d.type === "armor") {
            recalculWeight = true;
          }
        } else if (d.type === "talent" && d.system.subType === "skill") {
          if (change.system.level || ((_a = change.system) == null ? void 0 : _a.hasOwnProperty("skill")) && ((_b = change.system) == null ? void 0 : _b.skill.hasOwnProperty("reduceEncumbrance"))) {
            recalculEncumbrance = true;
          }
        } else if (d.type === "container" && (change.system.hasOwnProperty("onHand") || change.system.hasOwnProperty("weightless"))) {
          recalculWeight = true;
        }
      }
      i++;
    }
    if (recalculEncumbrance || recalculWeight) {
      const cloneActor = duplicate($this);
      await this.recalculateArmor($this, cloneActor);
      if (recalculEncumbrance) {
        const str = $this.system.characteristics.strength.value;
        const end = $this.system.characteristics.endurance.value;
        let sumSkill = 0;
        $this.items.filter((x) => x.type === "talent" && x.system.subType === "skill" && x.system.skill.reduceEncumbrance === true).forEach((x) => sumSkill += x.system.level);
        let normal = str + end + sumSkill;
        let heavy = normal * 2;
        cloneActor.system.states.encumbrance = $this.system.inventory.weight > normal;
        cloneActor.system.encumbrance.normal = normal;
        cloneActor.system.encumbrance.heavy = heavy;
      }
      if (recalculWeight)
        await this.recalculateWeight($this, cloneActor);
    }
  }
  static async recalculateArmor($this, cloneActor) {
    if (cloneActor === null || cloneActor === void 0)
      cloneActor = duplicate($this);
    let armor = 0;
    for (let item of $this.items) {
      if (item.type === "armor") {
        if (item.system.equipped === true && !isNaN(item.system.protection)) {
          armor += +item.system.protection || 0;
        }
      }
    }
    cloneActor.system.inventory.armor = armor;
  }
  static async recalculateWeight($this, cloneActor) {
    if (cloneActor === null || cloneActor === void 0)
      cloneActor = duplicate($this);
    let updatedContainers = [];
    let containerChanges = {};
    let containers = [];
    for (let item of $this.items) {
      if (item.system.trash === true)
        continue;
      if (item.type === "container") {
        containers.push(item);
        containerChanges[item._id] = { count: 0, weight: 0 };
      }
    }
    let onHandWeight = 0;
    for (let item of $this.items) {
      if (item.type === "container")
        continue;
      if (item.system.hasOwnProperty("weightless") && item.system.weightless === true)
        continue;
      let itemWeight = 0;
      if (item.system.hasOwnProperty("weight")) {
        let itemQty = item.system.quantity;
        if (!isNaN(itemQty) && itemQty > 0) {
          itemWeight = item.system.weight;
          if (itemWeight > 0) {
            itemWeight *= itemQty;
          }
        }
        if (item.type === "armor") {
          if (item.system.equipped === true) {
            if (item.system.powered === true)
              itemWeight = 0;
            else
              itemWeight *= 0.25;
          }
        }
        if (item.system.container && item.system.container.id && item.system.container.id !== "") {
          if (containerChanges.hasOwnProperty(item.system.container.id)) {
            containerChanges[item.system.container.id].weight += Math.round(itemWeight * 10) / 10;
            containerChanges[item.system.container.id].count += item.system.quantity;
          }
        } else {
          onHandWeight += Math.round(itemWeight * 10) / 10;
        }
      }
    }
    for (let container of containers) {
      let newWeight = containerChanges[container._id].weight;
      let newCount = containerChanges[container._id].count;
      if (container.system.weight !== newWeight || container.system.count !== newCount) {
        const cloneContainer = duplicate($this.getEmbeddedDocument("Item", container._id));
        cloneContainer.system.weight = newWeight;
        cloneContainer.system.count = newCount;
        updatedContainers.push(cloneContainer);
        if (container.system.onHand === true && (container.system.weight > 0 || container.system.weightless !== true)) {
          onHandWeight += container.system.weight;
        }
      }
    }
    cloneActor.system.inventory.weight = onHandWeight;
    cloneActor.system.states.encumbrance = onHandWeight > $this.system.inventory.encumbrance.normal;
    await $this.update(cloneActor);
    if (updatedContainers.length > 0) {
      await $this.updateEmbeddedDocuments("Item", updatedContainers);
    }
  }
  static async preUpdate($this, changed, options, user) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const newStr = (_a = foundry.utils.getProperty(changed, "system.characteristics.strength.value")) != null ? _a : $this.system.characteristics.strength.value;
    const newEnd = (_b = foundry.utils.getProperty(changed, "system.characteristics.endurance.value")) != null ? _b : $this.system.characteristics.endurance.value;
    if (newStr !== $this.system.characteristics.strength.value || newEnd !== $this.system.characteristics.endurance.value) {
      let sumSkill = 0;
      $this.items.filter((x) => x.type === "talent" && x.system.subType === "skill" && x.system.skill.reduceEncumbrance === true).forEach((x) => sumSkill += x.system.level);
      let normal = newStr + newEnd + sumSkill;
      let heavy = normal * 2;
      foundry.utils.setProperty(changed, "system.inventory.encumbrance.normal", normal);
      foundry.utils.setProperty(changed, "system.inventory.encumbrance.heavy", heavy);
    }
    const characteristicModified = this.computeCharacteristics(changed);
    const strengthValue = (_c = foundry.utils.getProperty(changed, "system.characteristics.strength.value")) != null ? _c : $this.system.characteristics.strength.value;
    const strengthMax = (_d = foundry.utils.getProperty(changed, "system.characteristics.strength.max")) != null ? _d : $this.system.characteristics.strength.max;
    const dexterityValue = (_e = foundry.utils.getProperty(changed, "system.characteristics.dexterity.value")) != null ? _e : $this.system.characteristics.dexterity.value;
    const dexterityMax = (_f = foundry.utils.getProperty(changed, "system.characteristics.dexterity.max")) != null ? _f : $this.system.characteristics.dexterity.max;
    const enduranceValue = (_g = foundry.utils.getProperty(changed, "system.characteristics.endurance.value")) != null ? _g : $this.system.characteristics.endurance.value;
    const enduranceMax = (_h = foundry.utils.getProperty(changed, "system.characteristics.endurance.max")) != null ? _h : $this.system.characteristics.endurance.max;
    const lifeValue = strengthValue + dexterityValue + enduranceValue;
    const lifeMax = strengthMax + dexterityMax + enduranceMax;
    if ($this.system.life.value !== lifeValue)
      foundry.utils.setProperty(changed, "system.life.value", lifeValue);
    if ($this.system.life.max !== lifeMax)
      foundry.utils.setProperty(changed, "system.life.max", lifeMax);
    if (characteristicModified && $this.system.personal.ucp === void 0 || $this.system.personal.ucp === "") ;
  }
  // static applyHealing($this, amount) {
  //     if (isNaN(amount) || amount === 0) return;
  //     const strength = $this.system.characteristics.strength;
  //     const dexterity = $this.system.characteristics.dexterity;
  //     const endurance = $this.system.characteristics.endurance;
  //     const data = {
  //         strength: { value: strength.value },
  //         dexterity: { value: dexterity.value },
  //         endurance: { value: endurance.value }
  //     };
  //     $this.update({ system: { characteristics: data } });
  // }
  static applyDamage($this, amount) {
    if (isNaN(amount) || amount === 0)
      return;
    const rank1 = $this.system.config.damages.rank1;
    const rank2 = $this.system.config.damages.rank2;
    const rank3 = $this.system.config.damages.rank3;
    const data = {};
    data[rank1] = { value: $this.system.characteristics[rank1].value };
    data[rank2] = { value: $this.system.characteristics[rank2].value };
    data[rank3] = { value: $this.system.characteristics[rank3].value };
    if (amount < 0)
      amount = Math.abs(amount);
    for (const [key, rank] of Object.entries(data)) {
      if (rank.value > 0) {
        if (rank.value >= amount) {
          rank.value -= amount;
          amount = 0;
        } else {
          amount -= rank.value;
          rank.value = 0;
        }
        rank.dm = this.getModifier(rank.value);
        if (amount <= 0)
          break;
      }
    }
    $this.update({ system: { characteristics: data } });
  }
  static getContainers($this) {
    const containers = [];
    for (let item of $this.items) {
      if (item.type == "container") {
        containers.push(item);
      }
    }
    containers.sort(this.compareByName);
    return containers;
  }
  static getComputers($this) {
    const containers = [];
    for (let item of $this.items) {
      if (item.type == "computer") {
        containers.push(item);
      }
    }
    containers.sort(this.compareByName);
    return containers;
  }
  static getSkills($this) {
    const skills = [];
    for (let item of $this.items) {
      if (item.type === "talent" && item.system.subType === "skill") {
        skills.push(item);
      }
    }
    skills.sort(this.compareByName);
    return skills;
  }
  static computeCharacteristics(changed) {
    let modified = this.computeCharacteristic(changed, "strength");
    if (this.computeCharacteristic(changed, "dexterity") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "endurance") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "intellect") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "education") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "social") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "morale") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "luck") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "sanity") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "charm") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "psionic") && !modified)
      modified = true;
    if (this.computeCharacteristic(changed, "other") && !modified)
      modified = true;
    return modified;
  }
  static computeCharacteristic(changed, name) {
    const path = `system.characteristics.${name}`;
    const newValue = foundry.utils.getProperty(changed, path + ".value");
    if (newValue) {
      const dm = this.getModifier(newValue);
      foundry.utils.setProperty(changed, path + ".dm", dm);
      return true;
    }
    return false;
  }
  static getModifier(value) {
    if (isNaN(value) || value <= 0)
      return -3;
    if (value >= 1 && value <= 2)
      return -2;
    if (value >= 3 && value <= 5)
      return -1;
    if (value >= 6 && value <= 8)
      return 0;
    if (value >= 9 && value <= 11)
      return 1;
    if (value >= 12 && value <= 14)
      return 2;
    return 3;
  }
  static compareByName(a, b) {
    if (!a.hasOwnProperty("name") || !b.hasOwnProperty("name")) {
      return 0;
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }
}

class MGT2Combatant extends Combatant {
}
class TravellerActor extends Actor {
  // _onUpdate(data, options, userId) {
  //   super._onUpdate(data, options, userId);
  //   console.log("_onUpdate");
  //   console.log(data);
  //   if (data.system?.characteristics) {
  //     // Calc encumbrance
  //     if (data.system.characteristics.strength || data.system.characteristics.endurance) {
  //       data.system.encumbrance.normal = 0;
  //       data.system.encumbrance.heavy = 0;
  //     }
  //   }
  //   // If benefits were changed
  //   //if (data.system?.benefits) {
  //   //  this.updateBenefitsOnActor();
  //   //}
  //   // this.actor.computeCharacteristics(formData);
  // }
  /*
  initiative if(!token?.combatant) return ui.notifications.warn("You are missing a selected token or combatant."); const bonus = await Dialog.prompt({ title: "Roll Initiative", content: `<input type="number" placeholder="Initiative bonus" autofocus>`, callback: (html) => html[0].querySelector("input").value, rejectClose: false }); const roll = await new Roll(`1d12 + ${bonus}`).evaluate({async: true}); await roll.toMessage({ flavor: `${token.actor.name} rolls initiative!`, speaker: ChatMessage.getSpeaker({actor: token.actor}) }); await token.combatant.update({initiative: roll.total});
  */
  prepareDerivedData() {
    if (this.type === "character") {
      this.system.initiative = ActorCharacter.getInitiative(this);
    }
  }
  async _preCreate(data, options, user) {
    if (await super._preCreate(data, options, user) === false)
      return false;
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
    if (this.type === "character") {
      await ActorCharacter.onUpdateDescendantDocuments(this, parent, collection, documents, changes, options, userId);
    }
  }
  async _preUpdate(changed, options, user) {
    if (await super._preUpdate(changed, options, user) === false)
      return false;
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

class TravellerItem extends Item {
  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
  }
  async _preUpdate(changed, options, user) {
    var _a, _b, _c;
    if (await super._preUpdate(changed, options, user) === false)
      return false;
    if (this.type === "computer") {
      const newProcessing = (_a = foundry.utils.getProperty(changed, "system.processing")) != null ? _a : this.system.processing;
      if (newProcessing !== this.system.processing) {
        let overload = this.system.processingUsed > newProcessing;
        foundry.utils.setProperty(changed, "system.overload", overload);
      }
    }
    if (this.type === "computer" || this.type === "container" || this.type === "item" && this.system.subType === "software") {
      const newQty = (_b = foundry.utils.getProperty(changed, "system.quantity")) != null ? _b : this.system.quantity;
      if (newQty !== this.system.quantity && newQty > 1) {
        foundry.utils.setProperty(changed, "system.quantity", 1);
      }
    }
    if (this.type === "item" && this.system.subType === "software") {
      const newWeight = (_c = foundry.utils.getProperty(changed, "system.weight")) != null ? _c : this.system.weight;
      if (newWeight !== this.system.weight && newWeight > 0) {
        foundry.utils.setProperty(changed, "system.weight", 0);
      }
    }
  }
  getRollDisplay() {
    if (this.type === "talent") {
      if (this.system.subType === "skill") {
        let label;
        if (this.system.skill.speciality !== "" && this.system.skill.speciality !== void 0) {
          label = `${this.name} (${this.system.skill.speciality})`;
        } else {
          label = this.name;
        }
        if (this.system.level > 0)
          label += ` (+${this.system.level})`;
        else if (this.system.level < 0)
          label += ` (${this.system.level})`;
        return label;
      } else if (this.system.subType === "psionic") ;
    }
    return name;
  }
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const _MGT2Helper = class _MGT2Helper {
  static hasValue(object, property) {
    return object !== void 0 && object.hasOwnProperty(property) && object[property] !== null && object[property] !== void 0 && object[property] !== "";
  }
  static getItemsWeight(items) {
    let weight = 0;
    for (let i of items) {
      let item = i.hasOwnProperty("system") ? i.system : i;
      if (item.hasOwnProperty("weightless") && item.weightless === true) {
        continue;
      }
      if (item.hasOwnProperty("weight")) {
        let itemQty = item.quantity;
        if (!isNaN(itemQty) && itemQty > 0) {
          let itemWeight = item.weight;
          if (itemWeight > 0) {
            weight += itemWeight * itemQty;
          }
        }
      }
    }
    return weight;
  }
  static generateUID() {
    let result = "";
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 36; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
      if (i === 8 || i === 12 || i === 16 || i === 20)
        result += "-";
    }
    return result;
  }
  static compareByName(a, b) {
    if (!a.hasOwnProperty("name") || !b.hasOwnProperty("name")) {
      return 0;
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }
  static getDisplayDM(dm) {
    if (dm === 0)
      return " (0)";
    if (dm > 0)
      return ` (+${dm})`;
    if (dm < 0)
      return ` (${dm})`;
    return "";
  }
  static getFormulaDM(dm) {
    if (dm === 0)
      return "+0";
    if (dm > 0)
      return `+${dm}`;
    if (dm < 0)
      return `${dm}`;
    return "";
  }
  static getDiceResults(roll) {
    const results = [];
    for (const die of roll.dice) {
      results.push(die.results);
    }
    return results.flat(2);
  }
  static getDiceTotal(roll) {
    let total = 0;
    for (const die of roll.dice) {
      total += die.total;
    }
    return total;
  }
  static getDifficultyValue(difficulty) {
    switch (difficulty) {
      case "Simple":
        return 2;
      case "Easy":
        return 4;
      case "Routine":
        return 6;
      case "Average":
        return 8;
      case "Difficult":
        return 10;
      case "VeryDifficult":
        return 12;
      case "Formidable":
        return 14;
      case "Impossible":
        return 16;
      default:
        return 0;
    }
  }
  static getDifficultyDisplay(difficulty) {
    switch (difficulty) {
      case "Simple":
        return game.i18n.localize("MGT2.Difficulty.Simple") + " (2+)";
      case "Easy":
        return game.i18n.localize("MGT2.Difficulty.Easy") + " (4+)";
      case "Routine":
        return game.i18n.localize("MGT2.Difficulty.Routine") + " (6+)";
      case "Average":
        return game.i18n.localize("MGT2.Difficulty.Average") + " (8+)";
      case "Difficult":
        return game.i18n.localize("MGT2.Difficulty.Difficult") + " (10+)";
      case "VeryDifficult":
        return game.i18n.localize("MGT2.Difficulty.VeryDifficult") + " (12+)";
      case "Formidable":
        return game.i18n.localize("MGT2.Difficulty.Formidable") + " (14+)";
      case "Impossible":
        return game.i18n.localize("MGT2.Difficulty.Impossible") + " (16+)";
      default:
        return null;
    }
  }
  static getRangeDisplay(range) {
    let value = Number(range.value);
    if (isNaN(value))
      return null;
    let label;
    if (range.unit !== null && range.unit !== void 0 && range.unit !== "")
      label = game.i18n.localize(`MGT2.MetricRange.${range.unit}`).toLowerCase();
    else
      label = "";
    return `${value}${label}`;
  }
  static getWeightLabel() {
    return game.i18n.localize("MGT2.MetricSystem.Weight.kg");
  }
  static getDistanceLabel() {
    return game.i18n.localize("MGT2.MetricSystem.Distance.km");
  }
  static getIntegerFromInput(data) {
    return Math.trunc(this.getNumberFromInput(data));
  }
  static getNumberFromInput(data) {
    if (data === void 0 || data === null)
      return 0;
    if (typeof data === "string") {
      let converted2 = Number(data.replace(/\s+/g, "").replace(this.badDecimalSeparator, this.decimalSeparator).trim());
      if (isNaN(converted2))
        return 0;
      return converted2;
    }
    let converted = Number(data);
    if (isNaN(converted))
      return 0;
    return converted;
  }
  static convertWeightForDisplay(weight) {
    return weight;
  }
  static convertWeightFromInput(weight) {
    return Math.round(weight * 10) / 10;
  }
  static getDataFromDropEvent(event) {
    var _a;
    try {
      return JSON.parse((_a = event.dataTransfer) == null ? void 0 : _a.getData("text/plain"));
    } catch (err) {
      return false;
    }
  }
  static async getItemDataFromDropData(dropData) {
    var _a;
    let item;
    if (((_a = game.modules.get("monks-enhanced-journal")) == null ? void 0 : _a.active) && dropData.itemId && dropData.uuid.includes("JournalEntry")) {
      await fromUuid(dropData.uuid);
    } else if (dropData.hasOwnProperty("uuid")) {
      item = await fromUuid(dropData.uuid);
    } else {
      let uuid = `${dropData.type}.${dropData.data._id}`;
      item = await fromUuid(uuid);
    }
    if (!item) {
      throw new Error(game.i18n.localize("Errors.CouldNotFindItem").replace("_ITEM_ID_", dropData.uuid));
    }
    if (item.pack) {
      const pack = game.packs.get(item.pack);
      item = await (pack == null ? void 0 : pack.getDocument(item._id));
    }
    return deepClone(item);
  }
};
__publicField(_MGT2Helper, "POUNDS_CONVERT", 2.20462262185);
__publicField(_MGT2Helper, "decimalSeparator");
__publicField(_MGT2Helper, "badDecimalSeparator");
_MGT2Helper.decimalSeparator = Number(1.1).toLocaleString().charAt(1);
_MGT2Helper.badDecimalSeparator = _MGT2Helper.decimalSeparator === "." ? "," : ".";
__publicField(_MGT2Helper, "format", function() {
  var s = arguments[0];
  for (var i = 0; i < arguments.length - 1; i++) {
    var reg = new RegExp("\\{" + i + "\\}", "gm");
    s = s.replace(reg, arguments[i + 1]);
  }
  return s;
});
let MGT2Helper = _MGT2Helper;

class TravellerItemSheet extends ItemSheet {
  /** @inheritdoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return foundry.utils.mergeObject(options, {
      classes: ["mgt2", game.settings.get("mgt2", "theme"), "sheet"],
      width: 630,
      tabs: [{ navSelector: ".horizontal-tabs", contentSelector: ".itemsheet-panel", initial: "tab1" }]
    });
  }
  /* -------------------------------------------- */
  get template() {
    const path = "systems/mgt2/templates/items";
    return `${path}/${this.item.type}-sheet.html`;
  }
  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    const item = context.item;
    const source = item.toObject();
    context.config = CONFIG.MGT2;
    const settings = {};
    settings.usePronouns = game.settings.get("mgt2", "usePronouns");
    let containers = null;
    let computers = null;
    let hadContainer;
    if (context.item.actor != null) {
      hadContainer = true;
      containers = [{ "name": "", "_id": "" }].concat(context.item.actor.getContainers());
      computers = [{ "name": "", "_id": "" }].concat(context.item.actor.getComputers());
    } else {
      hadContainer = false;
    }
    let weight = null;
    if (item.system.hasOwnProperty("weight")) {
      weight = MGT2Helper.convertWeightForDisplay(item.system.weight);
    }
    let unitlabels = {
      weight: MGT2Helper.getWeightLabel()
    };
    let skills = [];
    if (this.actor !== null) {
      for (let item2 of this.actor.items) {
        if (item2.type === "talent") {
          if (item2.system.subType === "skill")
            skills.push({ _id: item2._id, name: item2.getRollDisplay() });
        }
      }
    }
    skills.sort(MGT2Helper.compareByName);
    skills = [{ _id: "NP", name: game.i18n.localize("MGT2.Items.NotProficient") }].concat(skills);
    foundry.utils.mergeObject(context, {
      source: source.system,
      system: item.system,
      settings,
      containers,
      computers,
      hadContainer,
      weight,
      unitlabels,
      editable: this.isEditable,
      isGM: game.user.isGM,
      skills,
      config: CONFIG
      //rollData: this.item.getRollData(),
    });
    return context;
  }
  /* -------------------------------------------- */
  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable)
      return;
    html.find("div.itemsheet-panel").each((i, li) => {
    });
    if (this.item.type == "career") {
      html.find(".event-create").click(this._onCareerEventCreate.bind(this));
      html.find(".event-delete").click(this._onCareerEventDelete.bind(this));
    } else if (this.item.type == "armor" || this.item.type == "computer" || this.item.type == "species" || this.item.type == "weapon") {
      html.find(".options-create").click(this._onOptionCreate.bind(this));
      html.find(".options-delete").click(this._onOptionDelete.bind(this));
    }
    if (this.item.type == "species") {
      html.find(".modifiers-create").click(this._onModifierEventCreate.bind(this));
      html.find(".modifiers-delete").click(this._onModifierEventDelete.bind(this));
    }
  }
  async _onModifierEventCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    let modifiers = this.item.system.modifiers;
    let index;
    if (modifiers.length === 0) {
      modifiers = {};
      modifiers["0"] = { characteristic: "Endurance", value: null };
    } else {
      index = Math.max(...Object.keys(modifiers));
      index++;
      modifiers[index] = { characteristic: "Endurance", value: null };
    }
    let update = {
      system: {
        modifiers
      }
    };
    return this.item.update(update);
  }
  async _onModifierEventDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".modifiers-part");
    const modifiers = foundry.utils.deepClone(this.item.system.modifiers);
    let index = Number(element.dataset.modifiersPart);
    const newModifiers = [];
    let entries = Object.entries(modifiers);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
          newModifiers.push(value);
      }
    }
    let update = {
      system: {
        modifiers: newModifiers
      }
    };
    return this.item.update(update);
  }
  async _onCareerEventCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    let events = this.item.system.events;
    let index;
    if (events.length === 0) {
      events = {};
      events["0"] = { age: "", description: "" };
    } else {
      index = Math.max(...Object.keys(events));
      index++;
      events[index] = { age: "", description: "" };
    }
    let update = {
      system: {
        events
      }
    };
    return this.item.update(update);
  }
  async _onCareerEventDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".events-part");
    const events = foundry.utils.deepClone(this.item.system.events);
    let index = Number(element.dataset.eventsPart);
    const newEvents = [];
    let entries = Object.entries(events);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
          newEvents.push(value);
      }
    }
    let update = {
      system: {
        events: newEvents
      }
    };
    return this.item.update(update);
  }
  async _onOptionCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const property = event.currentTarget.dataset.property;
    let options = this.item.system[property];
    let index;
    if (options.length === 0) {
      options = {};
      options["0"] = { name: "", description: "" };
    } else {
      index = Math.max(...Object.keys(options));
      index++;
      options[index] = { name: "", description: "" };
    }
    let update = {};
    update[`system.${property}`] = options;
    return this.item.update(update);
  }
  async _onOptionDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".options-part");
    const property = element.dataset.property;
    const options = foundry.utils.deepClone(this.item.system[property]);
    let index = Number(element.dataset.optionsPart);
    const newOptions = [];
    let entries = Object.entries(options);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
          newOptions.push(value);
      }
    }
    let update = {};
    update[`system.${property}`] = newOptions;
    return this.item.update(update);
  }
  // async _onTraitCreate(event) {
  //   event.preventDefault();
  //   await this._onSubmit(event);
  //   const traits = this.item.system.traits;
  //   return this.item.update({ "system.traits.parts": traits.parts.concat([["", ""]]) });
  // }
  // async _onTraitDelete(event) {
  //   event.preventDefault();
  //   await this._onSubmit(event);
  //   const element = event.currentTarget.closest(".traits-part");
  //   const traits = foundry.utils.deepClone(this.item.system.traits);
  //   traits.parts.splice(Number(element.dataset.traitsPart), 1);
  //   return this.item.update({ "system.traits.parts": traits.parts });
  // }
  _getSubmitData(updateData = {}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    if (formData.hasOwnProperty("system") && formData.system.hasOwnProperty("container") && this.item.system.hasOwnProperty("equipped")) {
      const equippedChange = this.item.system.equipped !== formData.system.equipped;
      const containerChange = this.item.system.container.id !== formData.system.container.id;
      if (equippedChange) {
        if (formData.system.equipped === true) {
          formData.system.container = {
            //inContainer: false,
            id: ""
          };
        }
      } else if (containerChange) {
        if (formData.system.container.id !== "" && (this.item.system.container.id === "" || this.item.system.container.id === null)) {
          formData.system.equipped = false;
        }
      }
    }
    if (formData.hasOwnProperty("weight")) {
      formData.system.weight = MGT2Helper.convertWeightFromInput(formData.weight);
      delete formData.weight;
    }
    if (formData.system.hasOwnProperty("quantity")) {
      formData.system.quantity = MGT2Helper.getIntegerFromInput(formData.system.quantity);
    }
    if (formData.system.hasOwnProperty("cost")) {
      formData.system.cost = MGT2Helper.getIntegerFromInput(formData.system.cost);
    }
    return foundry.utils.flattenObject(formData);
  }
}

class RollPromptDialog extends Dialog {
  constructor(dialogData = {}, options = {}) {
    super(dialogData, options);
    this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet", "dialog"];
  }
  static async create(options) {
    const htmlContent = await renderTemplate("systems/mgt2/templates/roll-prompt.html", {
      config: CONFIG.MGT2,
      //formula: formula,
      characteristics: options.characteristics,
      characteristic: options.characteristic,
      skills: options.skills,
      skill: options.skill,
      fatigue: options.fatigue,
      encumbrance: options.encumbrance,
      difficulty: options.difficulty
    });
    const results = new Promise((resolve) => {
      new this({
        title: options.title,
        content: htmlContent,
        buttons: {
          boon: {
            label: game.i18n.localize("MGT2.RollPrompt.Boon"),
            callback: (html) => {
              const formData = new FormDataExtended(html[0].querySelector("form")).object;
              formData.diceModifier = "dl";
              resolve(formData);
            }
          },
          submit: {
            label: game.i18n.localize("MGT2.RollPrompt.Roll"),
            icon: '<i class="fa-solid fa-dice"></i>',
            callback: (html) => {
              const formData = new FormDataExtended(html[0].querySelector("form")).object;
              resolve(formData);
            }
          },
          bane: {
            label: game.i18n.localize("MGT2.RollPrompt.Bane"),
            //icon: '<i class="fa-solid fa-dice"></i>',
            callback: (html) => {
              const formData = new FormDataExtended(html[0].querySelector("form")).object;
              formData.diceModifier = "dh";
              resolve(formData);
            }
          }
        }
        //close: () => { resolve(false) }
      }).render(true);
    });
    return results;
  }
}
class RollPromptHelper {
  static async roll(options) {
    return await RollPromptDialog.create(options);
  }
  static async promptForFruitTraits() {
    const htmlContent = await renderTemplate("systems/mgt2/templateschat/chat/roll-prompt.html");
    return new Promise((resolve, reject) => {
      const dialog = new Dialog({
        title: "Fruit Traits",
        content: htmlContent,
        buttons: {
          submit: {
            label: "Roll",
            icon: '<i class="fa-solid fa-dice"></i>',
            callback: (html) => {
              const formData = new FormDataExtended(html[0].querySelector("form")).toObject();
              resolve(formData);
            }
          },
          skip: {
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        render: (html) => {
        },
        close: () => {
          reject("User closed dialog without making a selection.");
        }
      });
      dialog.render(true);
    });
  }
}

class EditorFullViewDialog extends Dialog {
  constructor(dialogData = {}, options = {}) {
    super(dialogData, options);
    this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
    this.options.resizable = true;
  }
  static async create(title, html) {
    const htmlContent = await renderTemplate("systems/mgt2/templates/editor-fullview.html", {
      config: CONFIG.MGT2,
      html
    });
    const results = new Promise((resolve) => {
      new this({
        title,
        content: htmlContent,
        buttons: {
          //close: { label: game.i18n.localize("MGT2.Close") }
        }
      }).render(true);
    });
    return results;
  }
}
class ActorConfigDialog extends Dialog {
  constructor(dialogData = {}, options = {}) {
    super(dialogData, options);
    this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
  }
  static async create(system) {
    const htmlContent = await renderTemplate("systems/mgt2/templates/actors/actor-config-sheet.html", {
      config: CONFIG.MGT2,
      system
    });
    const results = new Promise((resolve) => {
      new this({
        title: "Configuration",
        content: htmlContent,
        buttons: {
          submit: {
            label: game.i18n.localize("MGT2.Save"),
            icon: '<i class="fa-solid fa-floppy-disk"></i>',
            callback: (html) => {
              const formData = new FormDataExtended(html[0].querySelector("form")).object;
              resolve(formData);
            }
          }
        }
      }).render(true);
    });
    return results;
  }
}
class ActorCharacteristicDialog extends Dialog {
  // https://foundryvtt.wiki/en/development/api/dialog
  constructor(dialogData = {}, options = {}) {
    super(dialogData, options);
    this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
  }
  static async create(name, show, showMax, showAll = false) {
    const htmlContent = await renderTemplate("systems/mgt2/templates/actors/actor-config-characteristic-sheet.html", {
      name,
      show,
      showMax,
      showAll
    });
    const results = new Promise((resolve) => {
      new this({
        title: "Configuration: " + name,
        content: htmlContent,
        buttons: {
          submit: {
            label: game.i18n.localize("MGT2.Save"),
            icon: '<i class="fa-solid fa-floppy-disk"></i>',
            callback: (html) => {
              const formData = new FormDataExtended(html[0].querySelector("form")).object;
              resolve(formData);
            }
          }
        }
      }).render(true);
    });
    return results;
  }
}
class TraitEditDialog extends Dialog {
  constructor(dialogData = {}, options = {}) {
    super(dialogData, options);
    this.options.classes = ["mgt2", game.settings.get("mgt2", "theme"), "sheet"];
  }
  static async create(data) {
    const htmlContent = await renderTemplate("systems/mgt2/templates/actors/trait-sheet.html", {
      config: CONFIG.MGT2,
      data
    });
    const title = data.hasOwnProperty("name") && data.name !== void 0 ? data.name : game.i18n.localize("MGT2.Actor.EditTrait");
    const results = new Promise((resolve) => {
      new this({
        title,
        content: htmlContent,
        buttons: {
          submit: {
            label: game.i18n.localize("MGT2.Save"),
            icon: '<i class="fa-solid fa-floppy-disk"></i>',
            callback: (html) => {
              const formData = new FormDataExtended(html[0].querySelector("form")).object;
              resolve(formData);
            }
          }
          //cancel: { label: "Cancel" }
        }
        // close: (html) => {
        //     console.log("This always is logged no matter which option is chosen");
        //     const formData = new FormDataExtended(html[0].querySelector('form')).object;
        //     resolve(formData);
        //  }
      }).render(true);
    });
    return results;
  }
}
class CharacterPrompts {
  static async openConfig(system) {
    return await ActorConfigDialog.create(system);
  }
  static async openCharacteristic(name, hide, showMax, showAll = false) {
    return await ActorCharacteristicDialog.create(name, hide, showMax, showAll);
  }
  static async openTraitEdit(data) {
    return await TraitEditDialog.create(data);
  }
  static async openEditorFullView(title, html) {
    return await EditorFullViewDialog.create(title, html);
  }
}

class TravellerActorSheet extends ActorSheet {
  /** @inheritdoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    if (game.user.isGM || options.editable)
      options.dragDrop.push({ dragSelector: ".drag-item-list", dropSelector: ".drop-item-list" });
    return foundry.utils.mergeObject(options, {
      classes: ["mgt2", game.settings.get("mgt2", "theme"), "sheet", "actor", "character", "nopad"],
      template: "systems/mgt2/templates/actors/actor-sheet.html",
      width: 780,
      //height: 600,
      tabs: [
        { navSelector: ".sheet-sidebar", contentSelector: "form" },
        { navSelector: "nav[data-group='characteristics']", contentSelector: "section.characteristics-panel", initial: "core" },
        { navSelector: "nav[data-group='inventory']", contentSelector: "div.tab[data-tab='inventory']", initial: "onhand" }
      ]
    });
  }
  async getData(options) {
    const context = super.getData(options);
    this._prepareCharacterItems(context);
    return context.data;
  }
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData.data;
    actorData.isGM = game.user.isGM;
    actorData.showTrash = false;
    actorData.initiative = this.actor.getInitiative();
    const weapons = [];
    const armors = [];
    const augments = [];
    const computers = [];
    const softwares = [];
    const items = [];
    const equipments = [];
    const containerItems = [];
    const careers = [];
    const skills = [];
    const psionics = [];
    const diseases = [];
    const wounds = [];
    const contacts = [];
    const settings = {
      weightUnit: "kg",
      //weightUnit: game.settings.get("mgt2", "useWeightMetric") ? "kg" : "lb",
      usePronouns: game.settings.get("mgt2", "usePronouns"),
      useGender: game.settings.get("mgt2", "useGender"),
      showLife: game.settings.get("mgt2", "showLife")
    };
    actorData.settings = settings;
    const actorContainers = [];
    for (let item of sheetData.items) {
      if (item.type === "container") {
        actorContainers.push(item);
      } else if (item.type === "computer") {
        computers.push(item);
        item.subItems = [];
        if (item.system.overload === true)
          item.overloadClass = "computer-overload";
      }
    }
    actorContainers.sort(MGT2Helper.compareByName);
    const containers = [{ "name": "(tous)", "_id": "" }].concat(actorContainers);
    const containerIndex = /* @__PURE__ */ new Map();
    for (let c of actorContainers) {
      containerIndex.set(c._id, c);
      if (c.system.weight > 0) {
        c.weight = MGT2Helper.convertWeightForDisplay(c.system.weight) + " " + settings.weightUnit;
        c.display = c.name.length > 12 ? `${c.name.substring(0, 12)}... (${c.weight})` : `${c.name} (${c.weight})`;
      } else {
        c.display = c.name.length > 12 ? c.name.substring(0, 12) + "..." : c.name;
      }
      if (c.system.onHand === true)
        c.subItems = [];
    }
    let currentContainerView;
    if (actorData.system.containerView !== "") {
      currentContainerView = containerIndex.get(actorData.system.containerView);
      if (currentContainerView !== void 0) {
        actorData.containerView = currentContainerView;
        actorData.containerWeight = MGT2Helper.convertWeightForDisplay(currentContainerView.system.weight);
      } else {
        currentContainerView = null;
        actorData.containerWeight = MGT2Helper.convertWeightForDisplay(0);
      }
    } else {
      currentContainerView = null;
      actorData.containerWeight = MGT2Helper.convertWeightForDisplay(0);
    }
    actorData.containerShowAll = actorData.system.containerView === "";
    for (let i of sheetData.items) {
      let item = i.system;
      if (i.system.hasOwnProperty("weight") && i.system.weight > 0) {
        if (isNaN(i.system.quantity))
          i.weight = MGT2Helper.convertWeightForDisplay(i.system.weight) + " " + settings.weightUnit;
        else
          i.weight = MGT2Helper.convertWeightForDisplay(i.system.weight * i.system.quantity) + " " + settings.weightUnit;
      }
      if (item.hasOwnProperty("container") && item.container.id !== "" && item.container.id !== void 0) {
        let container = containerIndex.get(item.container.id);
        if (container === void 0) {
          if (actorData.containerShowAll) {
            i.containerName = "#deleted#";
            containerItems.push(i);
          }
          continue;
        }
        if (container.system.locked && !game.user.isGM)
          continue;
        if (container.system.onHand === true) {
          container.subItems.push(i);
        }
        if (actorData.containerShowAll || !actorData.containerShowAll && actorData.system.containerView == item.container.id) {
          if (container === void 0)
            i.containerName = "#deleted#";
          else
            i.containerName = container.name;
          containerItems.push(i);
        }
        continue;
      }
      if (i.system.hasOwnProperty("equipped")) {
        i.canEquip = true;
        if (i.system.equipped === true)
          i.toggleClass = "active";
      } else {
        i.canEquip = false;
      }
      switch (i.type) {
        case "equipment":
          switch (i.system.subType) {
            case "augment":
              augments.push(i);
              break;
            default:
              equipments.push(i);
              break;
          }
          break;
        case "armor":
          armors.push(i);
          if (i.system.options && i.system.options.length > 0) {
            i.subInfo = i.system.options.map((x) => x.name).join(", ");
          }
          break;
        case "computer":
          if (i.system.options && i.system.options.length > 0) {
            i.subInfo = i.system.options.map((x) => x.name).join(", ");
          }
          break;
        case "item":
          if (i.system.subType === "software") {
            if (i.system.software.computerId && i.system.software.computerId !== "") {
              const computer = computers.find((x) => x._id === i.system.software.computerId);
              if (computer !== void 0)
                computer.subItems.push(i);
              else
                softwares.push(i);
            } else {
              if (i.system.software.bandwidth > 0)
                i.display = `${i.name} (${i.system.software.bandwidth})`;
              else
                i.display = i.name;
              softwares.push(i);
            }
          } else {
            items.push(i);
          }
          break;
        case "weapon":
          if (i.system.range.isMelee)
            i.range = game.i18n.localize("MGT2.Melee");
          else {
            i.range = MGT2Helper.getRangeDisplay(i.system.range);
          }
          if (i.system.traits && i.system.traits.length > 0) {
            i.subInfo = i.system.traits.map((x) => x.name).join(", ");
          }
          weapons.push(i);
          break;
        case "career":
          careers.push(i);
          break;
        case "contact":
          contacts.push(i);
          break;
        case "disease":
          switch (i.system.subType) {
            case "wound":
              wounds.push(i);
              break;
            default:
              diseases.push(i);
              break;
          }
          break;
        case "talent":
          if (i.system.subType === "skill") {
            skills.push(i);
          } else {
            if (MGT2Helper.hasValue(i.system.psionic, "reach")) {
              i.reach = game.i18n.localize(`MGT2.PsionicReach.${i.system.psionic.reach}`);
            }
            if (MGT2Helper.hasValue(i.system.roll, "difficulty")) {
              i.difficulty = game.i18n.localize(`MGT2.Difficulty.${i.system.roll.difficulty}`);
            }
            psionics.push(i);
          }
          break;
        case "container":
          if (i.system.onHand === true) {
            items.push(i);
          }
          break;
      }
    }
    actorData.encumbranceNormal = MGT2Helper.convertWeightForDisplay(actorData.system.inventory.encumbrance.normal);
    actorData.encumbranceHeavy = MGT2Helper.convertWeightForDisplay(actorData.system.inventory.encumbrance.heavy);
    if (actorData.system.inventory.weight > actorData.system.inventory.encumbrance.heavy) {
      actorData.encumbranceClasses = "encumbrance-heavy";
      actorData.encumbrance = 2;
    } else if (actorData.system.inventory.weight > actorData.system.inventory.encumbrance.normal) {
      actorData.encumbranceClasses = "encumbrance-normal";
      actorData.encumbrance = 1;
    } else {
      actorData.encumbrance = 0;
    }
    if (softwares.length > 0) {
      softwares.sort(MGT2Helper.compareByName);
      actorData.softwares = softwares;
    }
    augments.sort(this.compareEquippedByName);
    actorData.augments = augments;
    armors.sort(this.compareEquippedByName);
    actorData.armors = armors;
    computers.sort(this.compareEquippedByName);
    actorData.computers = computers;
    actorData.careers = careers;
    contacts.sort(MGT2Helper.compareByName);
    actorData.contacts = contacts;
    containers.sort(MGT2Helper.compareByName);
    actorData.containers = containers;
    diseases.sort(MGT2Helper.compareByName);
    actorData.diseases = diseases;
    actorData.wounds = wounds;
    equipments.sort(this.compareEquippedByName);
    actorData.equipments = equipments;
    items.sort(this.compareEquippedByName);
    actorData.items = items;
    actorContainers.sort(MGT2Helper.compareByName);
    actorData.actorContainers = actorContainers;
    skills.sort(MGT2Helper.compareByName);
    actorData.skills = skills;
    psionics.sort(MGT2Helper.compareByName);
    actorData.psionics = psionics;
    weapons.sort(this.compareEquippedByName);
    actorData.weapons = weapons;
    if (containerItems.length > 0) {
      containerItems.sort((a, b) => {
        const containerResult = a.containerName.localeCompare(b.containerName);
        if (containerResult !== 0)
          return containerResult;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    }
    actorData.containerItems = containerItems;
  }
  compareEquippedByName(a, b) {
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.options.editable)
      return;
    html.find(".container-create").click(this._onContainerCreate.bind(this));
    html.find(".container-edit").click((ev) => {
      const container = this.actor.getEmbeddedDocument("Item", this.actor.system.containerView);
      container.sheet.render(true);
    });
    html.find(".container-delete").click((ev) => {
      ev.preventDefault();
      const containers = this.actor.getContainers();
      const container = containers.find((x) => x._id == this.actor.system.containerView);
      const containerItems = this.actor.items.filter((x) => x.system.hasOwnProperty("container") && x.system.container.id === container._id);
      if (containerItems.length > 0) {
        for (let item of containerItems) {
          let clone = duplicate(item);
          clone.system.container.id = "";
          this.actor.updateEmbeddedDocuments("Item", [clone]);
        }
      }
      const cloneActor = duplicate(this.actor);
      cloneActor.system.containerView = "";
      if (cloneActor.system.containerDropIn === container._id) {
        cloneActor.system.containerDropIn = "";
        const remainingContainers = containers.filter((x) => x._id !== container._id);
        if (remainingContainers.length > 0)
          cloneActor.system.containerDropIn = remainingContainers[0]._id;
      }
      this.actor.deleteEmbeddedDocuments("Item", [container._id]);
      this.actor.update(cloneActor);
    });
    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".item-edit").click((ev) => {
      ev.preventDefault();
      const html2 = $(ev.currentTarget).parents("[data-item-id]");
      const item = this.actor.getEmbeddedDocument("Item", html2.data("itemId"));
      item.sheet.render(true);
    });
    html.find(".item-delete").click((ev) => {
      ev.preventDefault();
      const html2 = $(ev.currentTarget).parents("[data-item-id]");
      this.actor.deleteEmbeddedDocuments("Item", [html2.data("itemId")]);
      html2.slideUp(200, () => this.render(false));
    });
    html.find("a.item-equip").click(this._onItemEquip.bind(this));
    html.find("a.item-storage-out").click(this._onItemStorageOut.bind(this));
    html.find("a.item-storage-in").click(this._onItemStorageIn.bind(this));
    html.find("a.software-eject").click(this._onSoftwareEject.bind(this));
    html.find("a[data-roll]").click(this._onRoll.bind(this));
    html.find('a[name="config"]').click(this._onOpenConfig.bind(this));
    html.find("a[data-cfg-characteristic]").click(this._onOpenCharacteristic.bind(this));
    html.find(".traits-create").click(this._onTraitCreate.bind(this));
    html.find(".traits-edit").click(this._onTraitEdit.bind(this));
    html.find(".traits-delete").click(this._onTraitDelete.bind(this));
    html.find('a[data-editor="open"]').click(this._onOpenEditor.bind(this));
  }
  async _onOpenEditor(event) {
    event.preventDefault();
    await CharacterPrompts.openEditorFullView(this.actor.system.personal.species, this.actor.system.personal.speciesText.descriptionLong);
  }
  async _onTraitCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    let traits = this.actor.system.personal.traits;
    let index;
    if (traits.length === 0) {
      traits = {};
      traits["0"] = { name: "", description: "" };
    } else {
      index = Math.max(...Object.keys(traits));
      index++;
      traits[index] = { name: "", description: "" };
    }
    return this.actor.update({ system: { personal: { traits } } });
  }
  async _onTraitEdit(event) {
    event.preventDefault();
    const index = $(event.currentTarget).parents("[data-traits-part]").data("traits-part");
    const trait = this.actor.system.personal.traits[index];
    let result = await CharacterPrompts.openTraitEdit(trait);
    const traits = this.actor.system.personal.traits;
    traits[index].name = result.name;
    traits[index].description = result.description;
    return this.actor.update({ system: { personal: { traits } } });
  }
  async _onTraitDelete(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const element = event.currentTarget.closest(".traits-part");
    const traits = foundry.utils.deepClone(this.actor.system.personal.traits);
    let index = Number(element.dataset.traitsPart);
    const newTraits = [];
    let entries = Object.entries(traits);
    if (entries.length > 1) {
      for (const [key, value] of entries) {
        if (key != index)
          newTraits.push(value);
      }
    }
    return this.actor.update({ system: { personal: { traits: newTraits } } });
  }
  async _onOpenConfig(ev) {
    ev.preventDefault();
    const userConfig = await CharacterPrompts.openConfig(this.actor.system);
    if (userConfig) {
      this.actor.update({ "system.config": userConfig });
    }
  }
  async _onOpenCharacteristic(ev) {
    ev.preventDefault();
    const name = ev.currentTarget.dataset.cfgCharacteristic;
    const c = this.actor.system.characteristics[name];
    let showAll = false;
    for (const [key, value] of Object.entries(this.actor.system.characteristics)) {
      if (!value.show) {
        showAll = true;
        break;
      }
    }
    const userConfig = await CharacterPrompts.openCharacteristic(game.i18n.localize(`MGT2.Characteristics.${name}.name`), c.show, c.showMax, showAll);
    if (userConfig) {
      const data = {
        system: {
          characteristics: {}
        }
      };
      data.system.characteristics[name] = {
        show: userConfig.show,
        showMax: userConfig.showMax
      };
      if (userConfig.showAll === true) {
        for (const [key, value] of Object.entries(this.actor.system.characteristics)) {
          if (key !== name && !value.show) {
            data.system.characteristics[key] = { show: true };
          }
        }
      }
      this.actor.update(data);
    }
  }
  async _onRoll(event) {
    event.preventDefault();
    const rollOptions = {
      rollTypeName: game.i18n.localize("MGT2.RollPrompt.Roll"),
      rollObjectName: "",
      characteristics: [{ _id: "", name: "" }],
      characteristic: "",
      skills: [],
      skill: "",
      fatigue: this.actor.system.states.fatigue,
      encumbrance: this.actor.system.states.encumbrance,
      difficulty: null,
      damageFormula: null
    };
    const cardButtons = [];
    for (const [key, label] of Object.entries(MGT2.Characteristics)) {
      const c = this.actor.system.characteristics[key];
      if (c.show) {
        rollOptions.characteristics.push({ _id: key, name: game.i18n.localize(label) + MGT2Helper.getDisplayDM(c.dm) });
      }
    }
    for (let item of this.actor.items) {
      if (item.type === "talent") {
        if (item.system.subType === "skill")
          rollOptions.skills.push({ _id: item._id, name: item.getRollDisplay() });
      }
    }
    rollOptions.skills.sort(MGT2Helper.compareByName);
    rollOptions.skills = [{ _id: "NP", name: game.i18n.localize("MGT2.Items.NotProficient") }].concat(rollOptions.skills);
    let itemObj = null;
    let isInitiative = false;
    const button = event.currentTarget;
    if (button.dataset.roll === "initiative") {
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.InitiativeRoll");
      rollOptions.characteristic = this.actor.system.config.initiative;
      isInitiative = true;
    } else if (button.dataset.roll === "characteristic") {
      rollOptions.characteristic = button.dataset.rollCharacteristic;
      rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.CharacteristicRoll");
      rollOptions.rollObjectName = game.i18n.localize(`MGT2.Characteristics.${rollOptions.characteristic}.name`);
    } else {
      if (button.dataset.roll === "skill") {
        rollOptions.skill = button.dataset.rollSkill;
        itemObj = this.actor.getEmbeddedDocument("Item", rollOptions.skill);
        rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.SkillRoll");
        rollOptions.rollObjectName = itemObj.name;
      } else {
        if (button.dataset.roll === "psionic") {
          rollOptions.rollTypeName = game.i18n.localize("MGT2.RollPrompt.PsionicRoll");
        }
      }
      if (itemObj === null && button.dataset.itemId) {
        itemObj = this.actor.getEmbeddedDocument("Item", button.dataset.itemId);
        rollOptions.rollObjectName = itemObj.name;
        if (itemObj.type === "weapon")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.weapon");
        else if (itemObj.type === "armor")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.armor");
        else if (itemObj.type === "computer")
          rollOptions.rollTypeName = game.i18n.localize("TYPES.Item.computer");
      }
      if (button.dataset.roll === "psionic") {
        rollOptions.rollObjectName = itemObj.name;
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
      if (itemObj.system.hasOwnProperty("damage")) {
        rollOptions.damageFormula = itemObj.system.damage;
        if (itemObj.type === "disease") {
          if (itemObj.system.subTypetype === "disease") {
            rollOptions.rollTypeName = game.i18n.localize("MGT2.DiseaseSubType.disease");
          } else if (itemObj.system.subTypetype === "poison") {
            rollOptions.rollTypeName = game.i18n.localize("MGT2.DiseaseSubType.poison");
          }
        }
      }
      if (itemObj.system.hasOwnProperty("roll")) {
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
    }
    const userRollData = await RollPromptHelper.roll(rollOptions);
    const rollModifiers = [];
    const rollFormulaParts = [];
    if (userRollData.diceModifier) {
      rollFormulaParts.push("3d6");
      rollFormulaParts.push(userRollData.diceModifier);
    } else {
      rollFormulaParts.push("2d6");
    }
    if (userRollData.hasOwnProperty("characteristic") && userRollData.characteristic !== "") {
      let c = this.actor.system.characteristics[userRollData.characteristic];
      let dm = c.dm;
      rollFormulaParts.push(MGT2Helper.getFormulaDM(dm));
      rollModifiers.push(game.i18n.localize(`MGT2.Characteristics.${userRollData.characteristic}.name`) + MGT2Helper.getDisplayDM(dm));
    }
    if (userRollData.hasOwnProperty("skill") && userRollData.skill !== "") {
      if (userRollData.skill === "NP") {
        rollFormulaParts.push("-3");
        rollModifiers.push(game.i18n.localize("MGT2.Items.NotProficient"));
      } else {
        const skillObj = this.actor.getEmbeddedDocument("Item", userRollData.skill);
        rollFormulaParts.push(MGT2Helper.getFormulaDM(skillObj.system.level));
        rollModifiers.push(skillObj.getRollDisplay());
      }
    }
    if (userRollData.hasOwnProperty("psionic") && userRollData.psionic !== "") {
      let psionicObj = this.actor.getEmbeddedDocument("Item", userRollData.psionic);
      rollFormulaParts.push(MGT2Helper.getFormulaDM(psionicObj.system.level));
      rollModifiers.push(psionicObj.getRollDisplay());
    }
    if (userRollData.hasOwnProperty("timeframes") && userRollData.timeframes !== "" && userRollData.timeframes !== "Normal") {
      rollModifiers.push(game.i18n.localize(`MGT2.Timeframes.${userRollData.timeframes}`));
      rollFormulaParts.push(userRollData.timeframes === "Slower" ? "+2" : "-2");
    }
    if (userRollData.hasOwnProperty("encumbrance") && userRollData.encumbrance === true) {
      rollFormulaParts.push("-2");
      rollModifiers.push(game.i18n.localize("MGT2.Actor.Encumbrance") + " -2");
    }
    if (userRollData.hasOwnProperty("fatigue") && userRollData.fatigue === true) {
      rollFormulaParts.push("-2");
      rollModifiers.push(game.i18n.localize("MGT2.Actor.Fatigue") + " -2");
    }
    if (userRollData.hasOwnProperty("customDM") && userRollData.customDM !== "") {
      let s = userRollData.customDM.trim();
      if (/^[0-9]/.test(s))
        rollFormulaParts.push("+");
      rollFormulaParts.push(s);
    }
    if (MGT2Helper.hasValue(userRollData, "difficulty")) {
      rollOptions.difficulty = userRollData.difficulty;
    }
    const rollData = this.actor.getRollData();
    const rollFormula = rollFormulaParts.join("");
    if (!Roll.validate(rollFormula)) {
      ui.notifications.error(game.i18n.localize("MGT2.Errors.InvalidRollFormula"));
      return;
    }
    let roll = await new Roll(rollFormula, rollData).roll({ async: true, rollMode: userRollData.rollMode });
    if (isInitiative && this.token && this.token.combatant) {
      await this.token.combatant.update({ initiative: roll.total });
    }
    const chatData = {
      user: game.user.id,
      speaker: this.actor ? ChatMessage.getSpeaker({ actor: this.actor }) : null,
      formula: roll._formula,
      //flavor: isPrivate ? null : flavor,
      tooltip: await roll.getTooltip(),
      total: Math.round(roll.total * 100) / 100,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      showButtons: true,
      showLifeButtons: false,
      showRollRequest: false,
      rollTypeName: rollOptions.rollTypeName,
      rollObjectName: rollOptions.rollObjectName,
      rollModifiers,
      showRollDamage: rollOptions.damageFormula !== null && rollOptions.damageFormula !== "",
      cardButtons
    };
    if (MGT2Helper.hasValue(rollOptions, "difficulty")) {
      chatData.rollDifficulty = rollOptions.difficulty;
      chatData.rollDifficultyLabel = MGT2Helper.getDifficultyDisplay(rollOptions.difficulty);
      if (roll.total >= MGT2Helper.getDifficultyValue(rollOptions.difficulty)) {
        chatData.rollSuccess = true;
      } else {
        chatData.rollFailure = true;
      }
    }
    const html = await renderTemplate("systems/mgt2/templates/chat/roll.html", chatData);
    chatData.content = html;
    let flags = null;
    if (rollOptions.damageFormula !== null && rollOptions.damageFormula !== "") {
      flags = { mgt2: { damage: { formula: rollOptions.damageFormula, rollObjectName: rollOptions.rollObjectName, rollTypeName: rollOptions.rollTypeName } } };
    }
    if (cardButtons.length > 0) {
      if (flags === null)
        flags = { mgt2: {} };
      flags.mgt2.buttons = cardButtons;
    }
    if (flags !== null)
      chatData.flags = flags;
    return roll.toMessage(chatData);
  }
  _onItemCreate(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget);
    const data = {
      name: html.data("create-name"),
      type: html.data("type-item")
    };
    if (html.data("subtype")) {
      data.system = {
        subType: html.data("subtype")
      };
    }
    const cls = getDocumentClass("Item");
    return cls.create(data, { parent: this.actor });
  }
  _onItemEquip(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    item.system.equipped = !item.system.equipped;
    this.actor.updateEmbeddedDocuments("Item", [item]);
  }
  _onItemStorageIn(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    if (item.type === "container") {
      item.system.onHand = false;
    } else {
      let container;
      const containers = this.actor.getContainers();
      if (this.actor.system.containerDropIn == "" || this.actor.system.containerDropIn === null) {
        if (containers.length === 0) {
          const cls = getDocumentClass("Item");
          container = cls.create({ name: "New container", type: "container" }, { parent: this.actor });
        } else {
          container = containers[0];
        }
      } else {
        container = containers.find((x) => x._id == this.actor.system.containerDropIn);
      }
      if (container.system.locked) {
        if (game.user.isGM) {
          item.system.container.id = container._id;
        } else {
          ui.notifications.error("Objet verrouill\xE9");
        }
      } else {
        item.system.container.id = container._id;
      }
    }
    this.actor.updateEmbeddedDocuments("Item", [item]);
  }
  _onItemStorageOut(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    item.system.container.id = "";
    this.actor.updateEmbeddedDocuments("Item", [item]);
  }
  _onSoftwareEject(ev) {
    ev.preventDefault();
    const html = $(ev.currentTarget).parents("[data-item-id]");
    const item = duplicate(this.actor.getEmbeddedDocument("Item", html.data("itemId")));
    item.system.software.computerId = "";
    this.actor.updateEmbeddedDocuments("Item", [item]);
  }
  _onContainerCreate(ev) {
    ev.preventDefault();
    const cls = getDocumentClass("Item");
    return cls.create({ name: "New container", type: "container" }, { parent: this.actor });
  }
  _canDragDrop(selector) {
    return this.isEditable;
  }
  async _onDrop(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const dropData = MGT2Helper.getDataFromDropEvent(event);
    if (!dropData)
      return false;
    const sourceItemData = await MGT2Helper.getItemDataFromDropData(dropData);
    if (sourceItemData.type === "species") {
      const update = {
        system: {
          personal: {
            species: sourceItemData.name,
            speciesText: {
              description: sourceItemData.system.description,
              descriptionLong: sourceItemData.system.descriptionLong
            }
          }
        }
      };
      update.system.personal.traits = this.actor.system.personal.traits.concat(sourceItemData.system.traits);
      if (sourceItemData.system.modifiers && sourceItemData.system.modifiers.length > 0) {
        update.system.characteristics = {};
        for (let modifier of sourceItemData.system.modifiers) {
          if (MGT2Helper.hasValue(modifier, "characteristic") && MGT2Helper.hasValue(modifier, "value")) {
            const c = this.actor.system.characteristics[modifier.characteristic];
            const updateValue = { value: c.value };
            updateValue.value += modifier.value;
            if (c.showMax) {
              updateValue.max = c.max + modifier.value;
            }
            update.system.characteristics[modifier.characteristic] = updateValue;
          }
        }
      }
      this.actor.update(update);
      return true;
    }
    if (sourceItemData.type === "contact" || sourceItemData.type === "disease" || sourceItemData.type === "career" || sourceItemData.type === "talent") {
      let transferData = {};
      try {
        transferData = sourceItemData.toJSON();
      } catch (err) {
        transferData = sourceItemData;
      }
      delete transferData._id;
      delete transferData.id;
      await this.actor.createEmbeddedDocuments("Item", [transferData]);
      return true;
    }
    if (sourceItemData.type !== "armor" && sourceItemData.type !== "weapon" && sourceItemData.type !== "computer" && sourceItemData.type !== "container" && sourceItemData.type !== "item" && sourceItemData.type !== "equipment")
      return false;
    const target = event.target.closest(".table-row");
    let targetId = null;
    let targetItem = null;
    if (target !== null && target !== void 0) {
      targetId = target.dataset.itemId;
      targetItem = this.actor.getEmbeddedDocument("Item", targetId);
    }
    let sourceItem = this.actor.getEmbeddedDocument("Item", sourceItemData.id);
    if (sourceItem) {
      if (targetItem === null || targetItem === void 0)
        return false;
      sourceItem = duplicate(sourceItem);
      if (sourceItem._id === targetId)
        return false;
      if (targetItem.type === "item" || targetItem.type === "equipment") {
        if (targetItem.system.subType === "software") {
          sourceItem.system.software.computerId = targetItem.system.software.computerId;
        } else {
          sourceItem.system.container.id = targetItem.system.container.id;
        }
        this.actor.updateEmbeddedDocuments("Item", [sourceItem]);
        return true;
      } else if (targetItem.type === "computer") {
        sourceItem.system.software.computerId = targetId;
        this.actor.updateEmbeddedDocuments("Item", [sourceItem]);
        return true;
      } else if (targetItem.type === "container") {
        if (targetItem.system.locked && !game.user.isGM)
          ui.notifications.error("Verrouill\xE9");
        else {
          sourceItem.system.container.id = targetId;
          this.actor.updateEmbeddedDocuments("Item", [sourceItem]);
          return true;
        }
      }
    } else {
      let transferData = {};
      try {
        transferData = sourceItemData.toJSON();
      } catch (err) {
        transferData = sourceItemData;
      }
      delete transferData._id;
      delete transferData.id;
      const recalcWeight = transferData.system.hasOwnProperty("weight");
      if (transferData.system.hasOwnProperty("container"))
        transferData.system.container.id = "";
      if (transferData.type === "item" && transferData.system.subType === "software")
        transferData.system.software.computerId = "";
      if (transferData.type === "container")
        transferData.onHand = true;
      if (transferData.system.hasOwnProperty("equipment"))
        transferData.system.equipped = false;
      if (targetItem !== null) {
        if (transferData.type === "item" && transferData.system.subType === "software") {
          if (targetItem.type === "item" && targetItem.system.subType === "software") {
            transferData.system.software.computerId = targetItem.system.software.computerId;
          } else if (targetItem.type === "computer") {
            transferData.system.software.computerId = targetItem._id;
          }
        } else if (transferData.type === "armor" || transferData.type === "computer" || transferData.type === "equipment" || transferData.type === "item" || transferData.type === "weapon") {
          if (targetItem.type === "container") {
            if (!targetItem.system.locked || game.user.isGM) {
              transferData.system.container.id = targetId;
            }
          } else {
            transferData.system.container.id = targetItem.system.container.id;
          }
        }
      }
      (await this.actor.createEmbeddedDocuments("Item", [transferData]))[0];
      if (transferData.actor) ;
      if (recalcWeight) {
        await this.actor.recalculateWeight();
      }
    }
    return true;
  }
  _getSubmitData(updateData = {}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    return foundry.utils.flattenObject(formData);
  }
}

const preloadHandlebarsTemplates = async function() {
  const templatePaths = [
    "systems/mgt2/templates/items/parts/sheet-configuration.html",
    "systems/mgt2/templates/items/parts/sheet-physical-item.html",
    "systems/mgt2/templates/roll-prompt.html",
    "systems/mgt2/templates/chat/roll.html",
    //"systems/mgt2/templates/chat/roll-characteristic.html",
    "systems/mgt2/templates/actors/actor-config-sheet.html",
    "systems/mgt2/templates/actors/actor-config-characteristic-sheet.html",
    "systems/mgt2/templates/actors/trait-sheet.html",
    "systems/mgt2/templates/editor-fullview.html"
    //"systems/mgt2/templates/actors/parts/actor-characteristic.html"
  ];
  return loadTemplates(templatePaths);
};

class ChatHelper {
  // _injectContent(message, type, html) {
  //     _setupCardListeners(message, html);
  // }
  static setupCardListeners(message, html, messageData) {
    if (!message || !html) {
      return;
    }
    html.find('button[data-action="rollDamage"]').click(async (event) => {
      await this._processRollDamageButtonEvent(message, event);
    });
    html.find('button[data-action="damage"]').click(async (event) => {
      await this._applyChatCardDamage(message, event);
    });
    html.find('button[data-action="healing"]').click(async (event) => {
      ui.notifications.warn("healing");
    });
    html.find("button[data-index]").click(async (event) => {
      await this._processRollButtonEvent(message, event);
    });
  }
  static async _processRollButtonEvent(message, event) {
    event.preventDefault();
    event.stopPropagation();
    let buttons = message.flags.mgt2.buttons;
    const index = event.target.dataset.index;
    const button = buttons[index];
    let roll = await new Roll(button.formula, {}).roll({ async: true });
    const chatData = {
      user: game.user.id,
      speaker: message.speaker,
      formula: roll._formula,
      tooltip: await roll.getTooltip(),
      total: Math.round(roll.total * 100) / 100,
      //formula: isPrivate ? "???" : roll._formula,
      //tooltip: isPrivate ? "" : await roll.getTooltip(),
      //total: isPrivate ? "?" : Math.round(roll.total * 100) / 100,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rollObjectName: button.message.objectName,
      rollMessage: MGT2Helper.format(button.message.flavor, Math.round(roll.total * 100) / 100)
    };
    const html = await renderTemplate("systems/mgt2/templates/chat/roll.html", chatData);
    chatData.content = html;
    return roll.toMessage(chatData);
  }
  static async _processRollDamageButtonEvent(message, event) {
    event.preventDefault();
    event.stopPropagation();
    let rollFormula = message.flags.mgt2.damage.formula;
    let roll = await new Roll(rollFormula, {}).roll({ async: true });
    let speaker;
    let selectTokens = canvas.tokens.controlled;
    if (selectTokens.length > 0) {
      speaker = selectTokens[0].actor;
    } else {
      speaker = game.user.character;
    }
    let rollTypeName = message.flags.mgt2.damage.rollTypeName ? message.flags.mgt2.damage.rollTypeName + " DAMAGE" : null;
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: speaker }),
      formula: roll._formula,
      tooltip: await roll.getTooltip(),
      total: Math.round(roll.total * 100) / 100,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      showButtons: true,
      hasDamage: true,
      rollTypeName,
      rollObjectName: message.flags.mgt2.damage.rollObjectName
    };
    const html = await renderTemplate("systems/mgt2/templates/chat/roll.html", chatData);
    chatData.content = html;
    return roll.toMessage(chatData);
  }
  async _processDamageButtonEvent(message, event) {
    event.preventDefault();
    event.stopPropagation();
    await ItemUtility.runItemAction(null, message, ROLL_TYPE.DAMAGE);
  }
  static _applyChatCardDamage(message, event) {
    const roll = message.rolls[0];
    return Promise.all(canvas.tokens.controlled.map((t) => {
      const a = t.actor;
      return a.applyDamage(roll.total);
    }));
  }
}

const registerSettings = function() {
  game.settings.register("mgt2", "theme", {
    name: "MGT2.Settings.theme.name",
    hint: "MGT2.Settings.theme.hint",
    scope: "client",
    config: true,
    default: "black-and-red",
    type: String,
    choices: {
      "black-and-red": "MGT2.Themes.BlackAndRed",
      "mwamba": "MGT2.Themes.Mwamba",
      "blue": "MGT2.Themes.Blue"
    },
    requiresReload: true
  });
  game.settings.register("mgt2", "usePronouns", {
    name: "MGT2.Settings.usePronouns.name",
    hint: "MGT2.Settings.usePronouns.hint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });
  game.settings.register("mgt2", "useGender", {
    name: "MGT2.Settings.useGender.name",
    hint: "MGT2.Settings.useGender.hint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });
  game.settings.register("mgt2", "showLife", {
    name: "MGT2.Settings.showLife.name",
    hint: "MGT2.Settings.showLife.hint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: false
  });
};

function registerHandlebarsHelpers() {
  Handlebars.registerHelper("showDM", function(dm) {
    if (dm === 0)
      return "0";
    if (dm > 0)
      return `+${dm}`;
    if (dm < 0)
      return `${dm}`;
    return "";
  });
}
Hooks.once("init", async function() {
  CONFIG.MGT2 = MGT2;
  CONFIG.Combat.initiative = {
    formula: "2d6 + @initiative",
    decimals: 2
  };
  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: [
        "life",
        "characteristics.strength",
        "characteristics.dexterity",
        "characteristics.endurance",
        "characteristics.intellect",
        "characteristics.education",
        "characteristics.social",
        "characteristics.morale",
        "characteristics.luck",
        "characteristics.sanity",
        "characteristics.charm",
        "characteristics.psionic",
        "characteristics.other"
      ],
      value: [
        "life.value",
        "health.radiations",
        "characteristics.strength.value",
        "characteristics.dexterity.value",
        "characteristics.endurance.value",
        "characteristics.intellect.value",
        "characteristics.education.value",
        "characteristics.social.value",
        "characteristics.morale.value",
        "characteristics.luck.value",
        "characteristics.sanity.value",
        "characteristics.charm.value",
        "characteristics.psionic.value",
        "characteristics.other.value"
      ]
    }
  };
  game.mgt2 = {
    TravellerActor,
    TravellerItem
  };
  registerHandlebarsHelpers();
  registerSettings();
  CONFIG.Combatant.documentClass = MGT2Combatant;
  CONFIG.Actor.documentClass = TravellerActor;
  CONFIG.Item.documentClass = TravellerItem;
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("mgt2", TravellerActorSheet, { types: ["character"], makeDefault: true, label: "Traveller Sheet" });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("mgt2", TravellerItemSheet, { makeDefault: true });
  Object.assign(CONFIG.Actor.dataModels, {
    "character": CharacterData
  });
  Object.assign(CONFIG.Item.dataModels, {
    "item": ItemData,
    "equipment": EquipmentData,
    "disease": DiseaseData,
    "career": CareerData,
    "talent": TalentData,
    "contact": ContactData,
    "weapon": WeaponData,
    "computer": ComputerData,
    "armor": ArmorData,
    "container": ItemContainerData,
    "species": SpeciesData
  });
  Hooks.on("renderChatMessage", (message, html, messageData) => {
    ChatHelper.setupCardListeners(message, html, messageData);
  });
  await preloadHandlebarsTemplates();
});

export { MGT2 };
//# sourceMappingURL=mgt2.bundle.js.map
