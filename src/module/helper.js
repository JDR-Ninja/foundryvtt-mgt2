import { MGT2 } from "./config.js";
import { traitLabel, traitNumber, WEAPON_ROLL } from "./traits.js";

// What the block says about a row.
const TRAIT_STATUS = {
    applied: "MGT2.RollPrompt.TraitApplied",
    offered: "MGT2.RollPrompt.TraitOffered",
    reminded: "MGT2.RollPrompt.TraitReminded"
};

export class MGT2Helper {

    /** Substitute `{0}`, `{1}`… placeholders. The indexed form is persisted in chat message flags. */
    static format(template, ...values) {
        return values.reduce((text, value, i) => text.replaceAll(`{${i}}`, String(value)), template);
    }

    /** A count-dependent string: the key holds one member per CLDR category the language uses. */
    static plural(key, n, data = {}) {
        const has = id => game.i18n.has(id, false);
        const rule = Number.isFinite(n) ? game.i18n.pluralRules.select(n) : "other";
        // The active language first, so one still holding the key as a plain string keeps its text;
        // then `other`, because French selects `many` at a million and defines none.
        const id = [`${key}.${rule}`, key, `${key}.other`].find(has) ?? `${key}.other`;
        return game.i18n.format(id, { n, ...data });
    }

    static hasValue(object, property) {
        return object != null && Object.hasOwn(object, property)
            && object[property] !== null && object[property] !== undefined && object[property] !== "";
    }

    static compareByName(a, b) {
        if (!Object.hasOwn(a, "name") || !Object.hasOwn(b, "name")) {
            return 0;
        }
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }

    /** Traveller's pseudo-hex: 0-9, then A for 10 and on through the alphabet, clamped at Z. */
    static uppDigit(value) {
        const n = Math.min(35, Math.max(0, value));
        return n < 10 ? String(n) : String.fromCharCode(55 + n);
    }

    /** @param {string} [zero]   What to render for 0 — a roll formula needs "+0", a label wants "0". */
    static signed(value, zero = "0") {
        if (value === 0) return zero;
        return value > 0 ? `+${value}` : `${value}`;
    }

    static getDisplayDM(dm) {
        return ` (${this.signed(dm)})`;
    }

    /** A credit figure with its thousands grouped. */
    static credits(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "";
        return number.toLocaleString(game.i18n?.lang ?? "en");
    }

    static getFormulaDM(dm) {
        return this.signed(dm, "+0");
    }

    /**
     * One signed term of a roll formula, optionally naming itself.
     * @param {string} [flavor]   Already localised — it is read by whoever opens the roll
     */
    static term(value, flavor = "") {
        const sign = (value < 0) ? "-" : "+";
        return `${sign} ${Math.abs(value)}${flavor ? `[${flavor}]` : ""}`;
    }

    /**
     * The books print damage as `3D`, a Destructive weapon as `3DD` (Core p.78) and a D3 weapon as
     * `3D3`; Foundry's parser reads none of the three.
     */
    static damageFormula(formula) {
        // ⚠ Anchored against letters on both sides, or the `d` of a word is read as a die and prose
        // becomes an expression: "200 rads" once normalised to "200 ra1d6s".
        return String(formula ?? "")
            .replace(/(?<![A-Za-z])(\d*)[dD]{1,2}(3|6)?(?![A-Za-z\d])/g,
                (_m, n, faces) => `${n === "" ? 1 : n}d${faces ?? 6}`);
    }

    /** Core p.78: the doubled D of `3DD` is the Destructive trait, written into the damage score. */
    static isDestructive(formula) {
        return /\d*[dD]{2}(?!\d)/.test(String(formula ?? ""));
    }

    /**
     * Companion p.93, Reduced Damage — a weapon's damage dice drop to D3 and keep any plus or
     * minus, so `3d6-3` becomes `3D3-3`.
     */
    static reduceDamageFormula(formula) {
        const reduced = String(formula ?? "").replace(/(\d*)[dD](?:3|6)?(?![0-9dD])/g, (_m, n) => `${n}D3`);
        return Roll.validate(reduced) ? reduced : String(formula ?? "");
    }

    /** Companion p.93, Minimum Damage — one point per die, ignoring any plus or minus. */
    static minimumDamage(formula) {
        let dice = 0;
        for (const [, n] of String(formula ?? "").matchAll(/(\d*)[dD](?:3|6)?(?![0-9dD])/g)) {
            dice += n === "" ? 1 : Number(n);
        }
        return dice;
    }

    /** How many dice a damage score rolls, whichever way it is written. */
    static damageDice(formula) {
        return this.minimumDamage(this.damageFormula(formula));
    }

    /**
     * The score on a parameterised weapon trait — `AP 5`, `Lo-Pen 3` (Core p.79).
     * @param {object[]} traits   Stored traits, or a derived traitMap's values
     * @param {string} key        A registry slug
     */
    static traitScore(traits, key) {
        for (const trait of traits ?? []) {
            if (trait.key === key) return trait.params?.find(p => p.num !== null)?.num ?? 0;
            if (trait.key === "custom") {
                const match = new RegExp(`^\\s*${key}\\b[^0-9+-]*([+-]?\\d+)`, "i").exec(trait.note ?? "");
                if (match) return Number(match[1]);
            }
        }
        return 0;
    }

    /**
     * A free-text Item name against a registry list: lowercased, prefix-insensitive, blank never
     * matching.
     */
    static #namedAs(name, registry) {
        const text = String(name ?? "").trim().toLowerCase();
        return (text !== "") && registry.some(entry => text.startsWith(entry));
    }

    /** Whether a rolled skill is the Medic skill Core p.82 drives first aid off. */
    static isFirstAidSkill(name) {
        return MGT2Helper.#namedAs(name, MGT2.FirstAidSkills);
    }

    /**
     * CSC p.66's exception to the Processing 0 count: Interface "will run in conjunction with one
     * other Bandwidth 0 program".
     */
    static isInterfaceSoftware(name) {
        return MGT2Helper.#namedAs(name, MGT2.InterfaceSoftware);
    }

    /** Core p.172 fires these in salvos; HG p.29 keeps the mount's damage multiple off them. */
    static isMissileWeapon(weapon) {
        if (MGT2Helper.hasTrait(weapon?.system?.traits, "smart")) return true;
        const name = String(weapon?.name ?? "").toLowerCase();
        return MGT2.MissileWeapons.some(word => name.includes(word));
    }

    /**
     * The Weapon traits block: one row per stored trait, each in the tone its own rule earns.
     * @param {Item} weapon        The weapon being attacked with
     * @param {number} strengthDM  The attacker's STR DM, which Bulky and Very Bulky read
     * @returns {object[]}
     */
    static weaponTraitRows(weapon, strengthDM = 0) {
        const range = this.getNumberFromInput(weapon?.system.range?.value);
        // The traits the loaded round leaves the weapon with: a shotgun firing pellets follows
        // rules its own line never carried, and a few rounds replace the list outright.
        const traits = weapon?.system.effective?.traits ?? weapon?.system.traits;
        return (traits ?? []).map(trait => {
            const rule = WEAPON_ROLL[trait.key] ?? {};
            const tone = rule.tone ?? "reminded";
            const term = traitLabel(trait);
            // Scope and Auto carry no DM of their own: they void another row rather than add to it.
            const numeric = Boolean(rule.param || rule.strength || rule.dm);
            let dm = rule.dm ?? 0;
            if (rule.param) dm = traitNumber(trait);
            // Core p.79: the penalty is what the wearer's STR DM falls short by, and nothing when
            // it does not fall short.
            if (rule.strength) dm = Math.min(0, strengthDM - rule.strength);

            return {
                key: trait.key, term, tone, dm, numeric,
                name: `trait-${trait.key}`,
                display: numeric ? this.signed(dm, "+0") : "—",
                params: (trait.params ?? []).map(p => p.value).filter(value => value !== ""),
                checked: rule.checked === true,
                requires: rule.requires ?? "",
                suppress: rule.suppress ?? "",
                when: rule.when ?? "",
                whenValue: (rule.when === "within") ? range : (rule.value ?? 0),
                status: rule.target ? "MGT2.RollPrompt.TraitNeedsTarget"
                    : (rule.control ? `MGT2.RollPrompt.TraitControl.${rule.control}` : TRAIT_STATUS[tone])
            };
        });
    }

    /** Whether a stored trait list carries a registry slug at all. */
    static hasTrait(traits, key) {
        const pattern = new RegExp(`^\\s*${key}\\b`, "i");
        return (traits ?? []).some(trait =>
            (trait.key === key) || ((trait.key === "custom") && pattern.test(trait.note ?? "")));
    }

    /** The key a skill modifier is filed under, derived from the free-text Item name. */
    static skillSlug(name) {
        return String(name ?? "").slugify({ strict: true });
    }

    static isSkillSlug(key) {
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key);
    }

    /** Whether a skill Item answers a requirement written as a bare skill name. */
    static matchesSkill(name, required) {
        const skill = String(name ?? "").trim().toLowerCase();
        const wanted = String(required ?? "").trim().toLowerCase();
        if (!skill || !wanted) return false;
        return (skill === wanted)
            || (skill.startsWith(wanted) && /[^a-z0-9]/.test(skill.charAt(wanted.length)));
    }

    /** One number out of the three shapes a Tech Level is stored in. @returns {number|null} */
    static tlNumber(value) {
        if (typeof value === "number") return Number.isFinite(value) ? value : null;
        const digits = /(\d+)/.exec(value ?? "");
        return digits ? Number(digits[1]) : null;
    }

    /**
     * Whether software can run on this thing — a `computer` Item always, and a **fitted augment
     * carrying a Processing figure** too.
     */
    static runsSoftware(item) {
        if (item?.type === "computer") return true;
        // Worn, not carried: a suit in the locker runs nothing, as it protects against nothing.
        if (item?.type === "armor") {
            return (item.system?.equipped === true) && (item.system?.processing !== null);
        }
        if (item?.type !== "equipment") return false;
        // An augment in a med-kit is in nobody's skull; a comm is carried, the way a computer is.
        return ((item.system?.processing ?? null) !== null)
            && ((item.system.subType !== "augment") || (item.system.equipped === true));
    }

    /** The Processing a host offers. */
    static processing(item) {
        return item?.system?.processing ?? 0;
    }

    /** Core p.112's specialised rating, read off the same hosts as the Processing score. */
    static specialised(item) {
        return item?.system?.specialised;
    }

    /** Whether a skill Item's name already ends in its own speciality. */
    static nameStatesSpeciality(name, speciality) {
        const label = String(name ?? "").trim().toLowerCase();
        const tail = String(speciality ?? "").trim().toLowerCase();
        return !!tail && label.endsWith(`(${tail})`);
    }

    /** A named modifier contribution reads either straight or through its substitutions. */
    static modifierLabel(source) {
        if ( !source.params ) return game.i18n.localize(source.label);
        return source.plural
            ? this.plural(source.label, Number(source.params[source.plural]), source.params)
            : game.i18n.format(source.label, source.params);
    }

    /**
     * Core folio 77: the band a shot falls in, measured against the weapon's own Range score — a
     * quarter of it is Short, up to it is normal, twice is Long, four times is Extreme and beyond
     * that is out of range.
     * @returns {{key: string, dm: number, min: number, max: number|null, forced: boolean}|null}
     */
    static rangeBand(distance, range, threshold = 0) {
        const shot = this.getNumberFromInput(distance);
        const score = this.getNumberFromInput(range);
        if (!(shot > 0) || !(score > 0)) return null;

        let key;
        if (shot > score * 4) key = "out";
        else if (shot <= score / 4) key = "short";
        else if (shot <= score) key = "normal";
        else if (shot <= score * 2) key = "long";
        else key = "extreme";

        const extreme = MGT2.RangeBands.extreme;
        const forced = (key !== "out") && (threshold > 0) && (shot > threshold)
            && (MGT2.RangeBands[key].dm > extreme.dm);
        const band = forced ? extreme : MGT2.RangeBands[key];
        const bounds = {
            short: [0, score / 4],
            normal: [score / 4, score],
            long: [score, score * 2],
            extreme: [score * 2, score * 4],
            out: [score * 4, null]
        }[key];
        return { key: forced ? "extreme" : key, dm: band.dm, min: bounds[0], max: bounds[1], forced };
    }

    /**
     * The space combat band a distance falls in (Core p.165), and what that band is worth: the
     * attack DM (p.167), the Thrust a change of band costs (p.166), and whether the exchange
     * resolves as a dogfight.
     * @param {number|string} distance   Kilometres
     * @returns {{key: string, dm: number|null, thrust: number, dogfight: boolean, max: number|null}|null}
     */
    static shipRangeBand(distance) {
        const km = this.getNumberFromInput(distance);
        if (!(km >= 0)) return null;
        const entry = Object.entries(MGT2.ShipRangeBands)
            .find(([, band]) => (band.maxKm === null) || (km <= band.maxKm));
        if (!entry) return null;
        const [key, band] = entry;
        return {
            key, dm: band.attackDM, thrust: band.thrust,
            dogfight: band.dogfight, max: band.maxKm
        };
    }

    static getDifficultyValue(difficulty) {
        return MGT2.DifficultyTargets[difficulty] ?? 0;
    }

    /** The number a check is measured against. @returns {{value: number, assumed: boolean}} */
    static getEffectTarget(difficulty) {
        const value = this.getDifficultyValue(difficulty);
        if (value > 0) return { value, assumed: false };
        return { value: MGT2.DifficultyTargets.Average, assumed: true };
    }

    /** Core p.63: what the Effect of the previous check is worth as a DM on the one it feeds. */
    static taskChainDM(effect) {
        const rung = MGT2.TaskChain.find(row =>
            ((row.min === null) || (effect >= row.min)) && ((row.max === null) || (effect <= row.max)));
        return rung?.dm ?? 0;
    }

    /** The Effect Results band (Core p.61) a margin of success falls in. */
    static getEffectBand(effect) {
        return Object.values(MGT2.EffectBands).find(
            band => (band.min === null || effect >= band.min) && (band.max === null || effect <= band.max));
    }

    /** Taking longer over a task grants DM+2, rushing it DM-2. */
    static getTimeframeDM(timeframe) {
        if (timeframe === "Slower") return 2;
        if (timeframe === "Faster") return -2;
        return 0;
    }

    static getDifficultyDisplay(difficulty) {
        // The localised label already carries the target ("Average (8)"), because the same strings
        // feed the difficulty dropdowns.
        if (MGT2.DifficultyTargets[difficulty] === undefined) return null;
        return game.i18n.localize(MGT2.Difficulty[difficulty]);
    }

    static getRangeDisplay(range) {
        const value = Number(range.value);

        if (isNaN(value)) return null;

        let label;
        if (range.unit !== null && range.unit !== undefined && range.unit !== "")
            label = game.i18n.localize(`MGT2.MetricRange.${range.unit}`).toLowerCase();
        else
            label = "";

        return `${value}${label}`;
    }

    static getWeightLabel() {
        return game.i18n.localize("MGT2.MetricSystem.Weight.kg");
    }

    static getIntegerFromInput(data) {
        return Math.trunc(this.getNumberFromInput(data));
    }

    static getNumberFromInput(data) {
        if (data === undefined || data === null) return 0;

        if (typeof data === "string") {
            // Every string reaching here is a distance, a quantity or a percentage, none of which is
            // written with grouping — so a comma is always the decimal point, whatever the locale.
            const converted = Number(data.replace(/\s+/g, "").replace(/,/g, "."));
            if (isNaN(converted))
                return 0;

            return converted;
        }

        const converted = Number(data);

        if (isNaN(converted))
            return 0;

        return converted;
    }

    /** Weights are stored and displayed to one decimal. */
    static roundWeight(weight) {
        return Math.round(weight * 10) / 10;
    }

    static getDataFromDropEvent(event) {
        try {
            return JSON.parse(event.dataTransfer?.getData("text/plain"));
        } catch {
            return false;
        }
    }

    /** The drag in flight, cached from `dragstart`. */
    static watchDrags() {
        if ( MGT2Helper.#watchingDrags ) return;
        MGT2Helper.#watchingDrags = true;
        // Subclass whatever is installed rather than the base class, so a module that has also
        // overridden it still composes.
        const Base = CONFIG.ux.DragDrop;
        CONFIG.ux.DragDrop = class MGT2DragDrop extends Base {
            /** @inheritDoc */
            _handleDragStart(event) {
                super._handleDragStart(event);
                MGT2Helper.#dragged = MGT2Helper.getDataFromDropEvent(event) || null;
            }
        };

        // Clearing the pointer feedback belongs to the same watcher: `dragleave` does not fire when
        // a drag ends outside every zone, so a refused cell would keep its red until the next one.
        const clear = () => {
            MGT2Helper.#dragged = null;
            for ( const node of document.querySelectorAll("[data-accept].over, [data-accept].deny") ) {
                node.classList.remove("over", "deny");
            }
        };
        document.addEventListener("dragstart", () => { MGT2Helper.#dragged = null; }, true);
        document.addEventListener("dragstart", event => {
            MGT2Helper.#dragged ??= MGT2Helper.getDataFromDropEvent(event) || null;
        });
        document.addEventListener("dragend", clear, true);
        document.addEventListener("drop", clear, true);
    }

    static #watchingDrags = false;
    static #dragged = null;

    /**
     * Does a zone take what is being dragged? @returns {boolean}
     * @param {HTMLElement} zone   Carrying `data-accept`, a space-separated list
     * @param {object} [data]      A drop payload, `{type, uuid}`
     */
    static dropAccepted(zone, data) {
        const accept = zone?.dataset.accept;
        const dragged = data ?? MGT2Helper.#dragged;
        if ( !accept || !dragged?.uuid ) return false;
        let record = null;
        try { record = foundry.utils.fromUuidSync(dragged.uuid); } catch { return false; }
        // A compendium entry answers with its index record, which carries the type and nothing else.
        return record?.type ? accept.split(/\s+/).includes(`${dragged.type}.${record.type}`) : false;
    }

    static async getItemDataFromDropData(dropData) {
        let item;
        if (Object.hasOwn(dropData, "uuid")) {
            item = await fromUuid(dropData.uuid);
        } else {
            item = await fromUuid(`${dropData.type}.${dropData.data._id}`);
        }

        if (!item) {
            throw new Error(game.i18n.localize("MGT2.Errors.CouldNotFindItem").replace("_ITEM_ID_", dropData.uuid));
        }
        if (item.pack) {
            const pack = game.packs.get(item.pack);
            item = await pack?.getDocument(item._id);
        }
        return foundry.utils.deepClone(item);
    }

    /**
     * A dropped document as a creation payload: `getItemDataFromDropData` hands back a clone that
     * still carries the source's id, and creating with it would collide with the original.
     * @returns {object}
     */
    static stripIds(source) {
        let data;
        try { data = source.toJSON(); } catch { data = source; }
        delete data._id;
        delete data.id;
        return data;
    }
}
