// https://foundryvtt.com/article/system-data-models/
// https://foundryvtt.com/api/classes/foundry.data.fields.NumberField.html
// https://foundryvtt.com/api/v10/classes/foundry.data.fields.DataField.html
const fields = foundry.data.fields;

export class CharacterData extends foundry.abstract.TypeDataModel {

    static defineSchema() {
        // XP
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

// export class CreatureData extends foundry.abstract.TypeDataModel {
//     static defineSchema() {
//         return {
//             name: new fields.StringField({ required: false, blank: false, trim: true }),
//             TL: new fields.StringField({ required: true, blank: false, initial: "NA" }),
//             species: new fields.StringField({ required: false, blank: true, trim: true }),
//             //cost: new fields.NumberField({ required: true, integer: true }),
//             armor: new fields.NumberField({ required: false, initial: 0, integer: true }),
//             life: new fields.SchemaField({
//                 value: new fields.NumberField({ required: false, initial: 0, integer: true }),
//                 max: new fields.NumberField({ required: true, initial: 0, integer: true })
//             }),

//             speed: new fields.StringField({ required: false, initial: "4m", blank: true, trim: true }),

//             traits: new fields.ArrayField(
//                 new fields.SchemaField({
//                     name: new fields.StringField({ required: true, blank: true, trim: true }),
//                     description: new fields.StringField({ required: false, blank: true, trim: true })
//                 })
//             ),

//             description: new fields.HTMLField({ required: false, blank: true, trim: true }),
//             behaviour: new fields.StringField({ required: false, blank: true, trim: true })
//         }
//     };
// }

// export class NPCData extends CreatureData {
//     static defineSchema() {
//         const schema = super.defineSchema();
//         // Species, Gender, Age
//         // STR, DEX, END, INT,. EDU, SOC, PSI, SKILL/Psy, equipment
//         // Status
//         schema.secret = new fields.HTMLField({ required: false, blank: true, trim: true });

//         return schema;
//     }
// }

export class VehiculeData extends foundry.abstract.TypeDataModel {

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
        const fields = foundry.data.fields;
        const schema = {
            //name: new fields.StringField({ required: true, blank: true, trim: true, nullable: true }),
            description: new fields.StringField({ required: false, blank: true, trim: true, nullable: true }),
            //type: new fields.StringField({ required: false, blank: false }),
            subType: new fields.StringField({ required: false, blank: false, nullable: true })
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

export class ItemData extends PhysicalItemData {
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

export class EquipmentData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();
        // augment, clothes
        schema.equipped = new fields.BooleanField({ required: false, initial: false });
        //schema.skillModifier = new fields.StringField({ required: false, blank: true });
        //schema.characteristicModifier = new fields.StringField({ required: false, blank: true });

        schema.augment = new fields.SchemaField({
            improvement: new fields.StringField({ required: false, blank: true, trim: true })
        });

        schema.subType.initial = "equipment"; // augment, clothing, trinket, toolkit, equipment

        return schema;
    }
}

export class DiseaseData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();
        schema.subType.initial = "disease"; // disease;poison
        schema.difficulty = new fields.StringField({ required: true, initial: "Average" });
        schema.damage = new fields.StringField({ required: false, blank: true });
        schema.interval = new fields.StringField({ required: false, blank: true });
        return schema;
    }
}

export class CareerData extends ItemBaseData {
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

export class TalentData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.subType.initial = "skill";
        schema.cost = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true })
        schema.level = new fields.NumberField({ required: true, initial: 0, min: 0, integer: true })
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

export class ContactData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.subType.initial = "skill";
        schema.cost = new fields.NumberField({ required: true, initial: 1, min: 0, integer: true })

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

export class WeaponData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();
        schema.equipped = new fields.BooleanField({ required: false, initial: false });
        schema.range = new fields.SchemaField({
            isMelee: new fields.BooleanField({ required: false, initial: false }),
            value: new fields.NumberField({ required: false, integer: true, nullable: true }),
            unit: new fields.StringField({ required: false, blank: true, nullable: true })
        }),
            //schema.tons = new fields.NumberField({ required: false, initial: 0, min: 0, integer: false });
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

export class ArmorData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();
        schema.equipped = new fields.BooleanField({ required: false, initial: false });
        schema.radiations = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.protection = new fields.StringField({ required: false, blank: false, trim: true });

        // Some armours have a required skill. A Traveller suffers DM-1 to all checks taken in the armour per missing
        // skill level. For example, a Traveller with Vacc Suit skill 0 who is in a suit that requires Vacc Suit 2 would have
        // DM-2 to all their checks. Not having the skill at all inflicts the usual DM-3 unskilled penalty instead.
        schema.requireSkill = new fields.StringField({ required: false, blank: false });
        schema.requireSkillLevel = new fields.NumberField({ required: false, min: 0, integer: true });

        //requirements: new fields.StringField({ required: false, blank: false, trim: true }),

        // As powered armour, battle dress supports its own weight. While powered and active, the mass of battle dress
        // does not count against the encumbrance of the wearer and is effectively weightless.
        schema.powered = new fields.BooleanField({ required: false, initial: false });
        schema.options = new fields.ArrayField(
            new fields.SchemaField({
                name: new fields.StringField({ required: true, blank: true, trim: true }),
                description: new fields.StringField({ required: false, blank: true, trim: true })
            })
        );

        // Characteristics Modifiers (Pirate of Drinax - ASLAN BATTLE DRESS STR/DEX, Slot)

        return schema;
    }
}

export class ComputerData extends PhysicalItemData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.processing = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.processingUsed = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.overload = new fields.BooleanField({ required: false, initial: false });
        //schema.softwares = new fields.ArrayField(new fields.StringField({ required: false, blank: true, trim: true }));
        schema.options = new fields.ArrayField(
            new fields.SchemaField({
                name: new fields.StringField({ required: true, blank: true, trim: true }),
                description: new fields.StringField({ required: false, blank: true, trim: true })
            })
        );

        return schema;
    }
}

export class SoftwareData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.bandwidth = new fields.NumberField({ required: false, initial: 0, min: 0, integer: true });
        schema.inUse = new fields.BooleanField({ required: false, initial: false });
        schema.computer = new fields.StringField({ required: false, blank: true, nullable: true });

        return schema;
    }
}

export class SpeciesData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = {
            description: new fields.StringField({ required: false, blank: true, trim: true, nullable: true }),
            descriptionLong: new fields.HTMLField({ required: false, blank: true, trim: true }),
            traits: new fields.ArrayField(
                new fields.SchemaField({
                    name: new fields.StringField({ required: true, blank: true, trim: true }),
                    description: new fields.StringField({ required: false, blank: true, trim: true })
                })
            ),
            modifiers: new fields.ArrayField(
                new fields.SchemaField({
                    characteristic: new fields.StringField({ required: false, blank: true, trim: true }),
                    value: new fields.NumberField({ required: false, integer: true, nullable: true })
                })
            )
        };

        return schema;
    }
}

export class ItemContainerData extends ItemBaseData {
    static defineSchema() {
        const schema = super.defineSchema();

        schema.onHand = new fields.BooleanField({ required: false, initial: false });
        schema.location = new fields.StringField({ required: false, blank: true, trim: true });
        schema.count = new fields.NumberField({ required: false, initial: 0, integer: true });
        schema.weight = new fields.NumberField({ required: false, initial: 0, integer: false });
        schema.weightless = new fields.BooleanField({ required: false, initial: false });

        schema.locked = new fields.BooleanField({ required: false, initial: false }); // GM only
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