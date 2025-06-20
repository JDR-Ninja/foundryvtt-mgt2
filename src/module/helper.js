export class MGT2Helper {
    static POUNDS_CONVERT = 2.20462262185;

    static decimalSeparator;
    static badDecimalSeparator;

    static {
        this.decimalSeparator = Number(1.1).toLocaleString().charAt(1);
        this.badDecimalSeparator = (this.decimalSeparator === "." ? "," : ".");
    }

    static format = function() {
        var s = arguments[0];
        for (var i = 0; i < arguments.length - 1; i++) {       
            var reg = new RegExp("\\{" + i + "\\}", "gm");             
            s = s.replace(reg, arguments[i + 1]);
        }
        return s;
    }

    static hasValue(object, property) {
        return object !== undefined && object.hasOwnProperty(property) && object[property] !== null && object[property] !== undefined && object[property] !== "";
    }

    static getItemsWeight(items) {
        let weight = 0;
        for (let i of items) {
            let item = i.hasOwnProperty("system") ? i.system : i;
            if (item.hasOwnProperty("weightless") && item.weightless === true) {
                continue;
            }

            if (item.hasOwnProperty("weight")) {
                let itemQty = item.quantity
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
        let result = '';
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';

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
        if (dm === 0) return " (0)";
        if (dm > 0) return ` (+${dm})`;
        if (dm < 0) return ` (${dm})`;
        return "";
    }
    static getFormulaDM(dm) {
        if (dm === 0) return "+0";
        if (dm > 0) return `+${dm}`;
        if (dm < 0) return `${dm}`;
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
        switch(difficulty) {
            case "Simple": return 2;
            case "Easy": return 4;
            case "Routine": return 6;
            case "Average": return 8;
            case "Difficult": return 10;
            case "VeryDifficult": return 12;
            case "Formidable": return 14;
            case "Impossible": return 16;
            default:
              return 0;
          }
    }

    static getDifficultyDisplay(difficulty) {
        switch(difficulty) {
            case "Simple": return game.i18n.localize("MGT2.Difficulty.Simple") + " (2+)";
            case "Easy": return game.i18n.localize("MGT2.Difficulty.Easy") + " (4+)";
            case "Routine": return game.i18n.localize("MGT2.Difficulty.Routine") + " (6+)";
            case "Average": return game.i18n.localize("MGT2.Difficulty.Average") + " (8+)";
            case "Difficult": return game.i18n.localize("MGT2.Difficulty.Difficult") + " (10+)";
            case "VeryDifficult": return game.i18n.localize("MGT2.Difficulty.VeryDifficult") + " (12+)";
            case "Formidable": return game.i18n.localize("MGT2.Difficulty.Formidable") + " (14+)";
            case "Impossible": return game.i18n.localize("MGT2.Difficulty.Impossible") + " (16+)";
            default:
              return null;
          }
    }

    static getRangeDisplay(range) {
        let value = Number(range.value);

        if (isNaN(value)) return null;

        let label;
        //if (game.settings.get("mgt2", "useDistanceMetric") === true) {
            if (range.unit !== null && range.unit !== undefined && range.unit !== "")
                label = game.i18n.localize(`MGT2.MetricRange.${range.unit}`).toLowerCase();
            else
                label = "";
        //} else {
                // TODO
        //}

        return `${value}${label}`;
    }

    static getWeightLabel() {
        //const label = game.settings.get("mgt2", "useWeightMetric") === true ? "MGT2.MetricSystem.Weight.kg" : "MGT2.ImperialSystem.Weight.lb";
        //return game.i18n.localize(label);
        return game.i18n.localize("MGT2.MetricSystem.Weight.kg");
    }

    static getDistanceLabel() {
        //const label = game.settings.get("mgt2", "useDistanceMetric") === true ? "MGT2.MetricSystem.Distance.km" : "MGT2.ImperialSystem.Distance.mi";
        //return game.i18n.localize(label);
        return game.i18n.localize("MGT2.MetricSystem.Distance.km");
    }

    static getIntegerFromInput(data) {
        return Math.trunc(this.getNumberFromInput(data));
    }

    static getNumberFromInput(data) {
        if (data === undefined || data === null) return 0;

        if (typeof data === "string") {
            let converted = Number(data.replace(/\s+/g, '').replace(this.badDecimalSeparator, this.decimalSeparator).trim());
            if (isNaN(converted))
                return 0;

            return converted;
        }

        let converted = Number(data);

        if (isNaN(converted))
            return 0;

        return converted;
    }

    static convertWeightForDisplay(weight) {
        //if (game.settings.get("mgt2", "useWeightMetric") === true || weight === 0)
            return weight;

        // Metric to Imperial
        //const pounds = weight * this.POUNDS_CONVERT;
        //return Math.round(pounds * 10) / 10;
    }

    static convertWeightFromInput(weight) {
        //if (game.settings.get("mgt2", "useWeightMetric") === true || weight === 0)
            return Math.round(weight * 10) / 10;

        // Imperial to Metric
        //const kg = this.POUNDS_CONVERT / weight;
        //return Math.round(kg * 10) / 10;
    }

    static getDataFromDropEvent(event) {
        let data;
        try {
            return JSON.parse(event.dataTransfer?.getData("text/plain"));
        } catch (err) {
            return false;
        }

        //if ( data.type !== "Item" ) return false;
        //const item = await Item.implementation.fromDropData(data);
    }

    static async getItemDataFromDropData(dropData) {
        //console.log("getItemDataFromDropData");
        let item;
        if (game.modules.get("monks-enhanced-journal")?.active && dropData.itemId && dropData.uuid.includes("JournalEntry")) {
            const journalEntry = await fromUuid(dropData.uuid);
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
            item = await pack?.getDocument(item._id);
        }
        return deepClone(item);
    }
}