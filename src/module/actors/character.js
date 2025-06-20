export class ActorCharacter {
    static preCreate($this, data, options, user) {
        $this.updateSource({ prototypeToken: { actorLink: true } }) // QoL
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
                // Delete content
                for (let item of $this.items) {
                    if (item.system.hasOwnProperty("container") && item.system.container.id === d._id)
                        toDeleteIds.push(item._id);
                }
            } else if (d.type === "computer") {
                // Eject software
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
            await $this.updateEmbeddedDocuments('Item', itemToUpdates);

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
                if (item.system.trash === true) continue;
                if (item.type === "computer") {
                    computers.push(item);
                    computerChanges[item._id] = { processingUsed: 0 };
                }
            }

            for (let item of $this.items) {
                if (item.type !== "item" && item.system.subType !== "software") continue;

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
                await $this.updateEmbeddedDocuments('Item', updatedComputers);
            }
        }
    }

    static async calculEncumbranceAndWeight($this, parent, collection, documents, changes, options, userId) {
        let recalculEncumbrance = false;
        let recalculWeight = false;

        let change;
        let i = 0;
        for (let d of documents) {
            if (changes[i].hasOwnProperty("system")) {
                change = changes[i];

                if (d.type === "armor" ||
                    d.type === "computer" ||
                    d.type === "gear" ||
                    d.type === "item" ||
                    d.type === "weapon") {
                    if (change.system.hasOwnProperty("quantity") ||
                        change.system.hasOwnProperty("weight") ||
                        change.system.hasOwnProperty("weightless") ||
                        change.system.hasOwnProperty("container") ||
                        change.system.hasOwnProperty("equipped") ||
                        d.type === "armor") {
                        recalculWeight = true;
                    }
                } else if (d.type === "talent" && d.system.subType === "skill") {
                    if (change.system.level || (change.system?.hasOwnProperty("skill") && change.system?.skill.hasOwnProperty("reduceEncumbrance"))) {
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
                //console.log("recalculEncumbrance");
                const str = $this.system.characteristics.strength.value;
                const end = $this.system.characteristics.endurance.value;
                let sumSkill = 0;
                $this.items.filter(x => x.type === "talent" && x.system.subType === "skill" && x.system.skill.reduceEncumbrance === true).forEach(x => sumSkill += x.system.level);
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
        if (cloneActor === null || cloneActor === undefined)
            cloneActor = duplicate($this);

        let armor = 0;
        for (let item of $this.items) {
            if (item.type === "armor") {
                if (item.system.equipped === true && !isNaN(item.system.protection)) {
                    armor += (+item.system.protection || 0);
                }
            }
        }

        cloneActor.system.inventory.armor = armor;
    }

    static async recalculateWeight($this, cloneActor) {

        if (cloneActor === null || cloneActor === undefined)
            cloneActor = duplicate($this);

        let updatedContainers = [];
        let containerChanges = {};

        //console.log("recalculWeight");
        let containers = [];

        // List all containers
        for (let item of $this.items) {
            if (item.system.trash === true) continue;

            if (item.type === "container") {
                containers.push(item);
                containerChanges[item._id] = { count: 0, weight: 0 };
            }
        }

        let onHandWeight = 0;
        for (let item of $this.items) {
            if (item.type === "container") continue;
            if (item.system.hasOwnProperty("weightless") && item.system.weightless === true) continue;

            let itemWeight = 0;
            if (item.system.hasOwnProperty("weight")) {
                let itemQty = item.system.quantity
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
                            itemWeight *= 0.25; // mass of armor that is being worn by 75% OPTIONAL
                    }
                }

                if (item.system.container && item.system.container.id && item.system.container.id !== "") {
                    // bad deleted container id
                    if (containerChanges.hasOwnProperty(item.system.container.id)) {
                        containerChanges[item.system.container.id].weight += Math.round(itemWeight * 10) / 10;
                        containerChanges[item.system.container.id].count += item.system.quantity;
                    }
                } else {
                    onHandWeight += Math.round(itemWeight * 10) / 10;
                }
            }
        }

        //cloneActor.system.inventory.weight = onHandWeight.toFixed(1);

        // Check containers new weight
        for (let container of containers) {
            let newWeight = containerChanges[container._id].weight;
            let newCount = containerChanges[container._id].count;
            if (container.system.weight !== newWeight || container.system.count !== newCount) {
                //const cloneContainer = duplicate();
                const cloneContainer = duplicate($this.getEmbeddedDocument("Item", container._id));
                //foundry.utils.setProperty(cloneContainer, "system.weight", newWeight);
                cloneContainer.system.weight = newWeight;
                cloneContainer.system.count = newCount;
                updatedContainers.push(cloneContainer);

                if (container.system.onHand === true &&
                    (container.system.weight > 0 || container.system.weightless !== true)) {
                    onHandWeight += container.system.weight;
                }
            }
        }

        cloneActor.system.inventory.weight = onHandWeight;
        cloneActor.system.states.encumbrance = onHandWeight > $this.system.inventory.encumbrance.normal;


        await $this.update(cloneActor);

        if (updatedContainers.length > 0) {
            await $this.updateEmbeddedDocuments('Item', updatedContainers);
        }
    }

    static async preUpdate($this, changed, options, user) {
        // Calc encumbrance

        const newStr = foundry.utils.getProperty(changed, "system.characteristics.strength.value") ?? $this.system.characteristics.strength.value;
        const newEnd = foundry.utils.getProperty(changed, "system.characteristics.endurance.value") ?? $this.system.characteristics.endurance.value;
        if ((newStr !== $this.system.characteristics.strength.value) || (newEnd !== $this.system.characteristics.endurance.value)) {
            let sumSkill = 0;
            $this.items.filter(x => x.type === "talent" && x.system.subType === "skill" && x.system.skill.reduceEncumbrance === true).forEach(x => sumSkill += x.system.level);
            let normal = newStr + newEnd + sumSkill;
            let heavy = normal * 2;
            foundry.utils.setProperty(changed, "system.inventory.encumbrance.normal", normal);
            foundry.utils.setProperty(changed, "system.inventory.encumbrance.heavy", heavy);
        }

        //console.log(foundry.utils.getProperty(changed, "system.characteristics.strength.value"));
        const characteristicModified = this.computeCharacteristics(changed);
        const strengthValue = foundry.utils.getProperty(changed, "system.characteristics.strength.value") ?? $this.system.characteristics.strength.value;
        const strengthMax = foundry.utils.getProperty(changed, "system.characteristics.strength.max") ?? $this.system.characteristics.strength.max;
        const dexterityValue = foundry.utils.getProperty(changed, "system.characteristics.dexterity.value") ?? $this.system.characteristics.dexterity.value;
        const dexterityMax = foundry.utils.getProperty(changed, "system.characteristics.dexterity.max") ?? $this.system.characteristics.dexterity.max;
        const enduranceValue = foundry.utils.getProperty(changed, "system.characteristics.endurance.value") ?? $this.system.characteristics.endurance.value;
        const enduranceMax = foundry.utils.getProperty(changed, "system.characteristics.endurance.max") ?? $this.system.characteristics.endurance.max;
        const lifeValue = strengthValue + dexterityValue + enduranceValue;
        const lifeMax = strengthMax + dexterityMax + enduranceMax;

        if ($this.system.life.value !== lifeValue)
            foundry.utils.setProperty(changed, "system.life.value", lifeValue);
        if ($this.system.life.max !== lifeMax)
            foundry.utils.setProperty(changed, "system.life.max", lifeMax);

        if (characteristicModified && $this.system.personal.ucp === undefined || $this.system.personal.ucp === "") {
            // calc

        }
        //}

        // Apply changes in Actor size to Token width/height
        // if ( "size" in (this.system.traits || {}) ) {
        //   const newSize = foundry.utils.getProperty(changed, "system.traits.size");
        //   if ( newSize && (newSize !== this.system.traits?.size) ) {
        //     let size = CONFIG.DND5E.tokenSizes[newSize];
        //     if ( !foundry.utils.hasProperty(changed, "prototypeToken.width") ) {
        //       changed.prototypeToken ||= {};
        //       changed.prototypeToken.height = size;
        //       changed.prototypeToken.width = size;
        //     }
        //   }
        // }
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
        if (isNaN(amount) || amount === 0) return;
        const rank1 = $this.system.config.damages.rank1;
        const rank2 = $this.system.config.damages.rank2;
        const rank3 = $this.system.config.damages.rank3;

        const data = {};
        data[rank1] = { value: $this.system.characteristics[rank1].value };
        data[rank2] = { value: $this.system.characteristics[rank2].value };
        data[rank3] = { value: $this.system.characteristics[rank3].value };

        if (amount < 0) amount = Math.abs(amount);

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
                if (amount <= 0) break;
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

        if (this.computeCharacteristic(changed, "dexterity") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "endurance") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "intellect") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "education") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "social") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "morale") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "luck") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "sanity") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "charm") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "psionic") && !modified) modified = true;
        if (this.computeCharacteristic(changed, "other") && !modified) modified = true;

        return modified;
    }

    static computeCharacteristic(changed, name) {
        //if (isNaN(c.value) || c.value <= 0) c.value = 0;
        //c.dm = this._getModifier(c.value)
        const path = `system.characteristics.${name}`;
        const newValue = foundry.utils.getProperty(changed, path + ".value");// || this.system.characteristics[name].value;
        if (newValue) {
            const dm = this.getModifier(newValue);
            foundry.utils.setProperty(changed, path + ".dm", dm);
            return true;
        }

        return false;
    }

    static getModifier(value) {
        if (isNaN(value) || value <= 0) return -3;
        if (value >= 1 && value <= 2) return -2;
        if (value >= 3 && value <= 5) return -1;
        if (value >= 6 && value <= 8) return 0;
        if (value >= 9 && value <= 11) return 1;
        if (value >= 12 && value <= 14) return 2;

        return 3;
    }

    static compareByName(a, b) {
        if (!a.hasOwnProperty("name") || !b.hasOwnProperty("name")) {
            return 0;
        }
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
}