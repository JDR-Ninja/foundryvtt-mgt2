import { MGT2 } from "./config.js";
import { traitLabel, traitNumber, WEAPON_ROLL } from "./traits.js";

// What the block says about a row. Never what the trait does — the registry ships no definitions,
// so a status line states how the system treated it and nothing more.
const TRAIT_STATUS = {
    applied: "MGT2.RollPrompt.TraitApplied",
    offered: "MGT2.RollPrompt.TraitOffered",
    reminded: "MGT2.RollPrompt.TraitReminded"
};

export class MGT2Helper {

    static decimalSeparator;
    static badDecimalSeparator;

    static {
        this.decimalSeparator = Number(1.1).toLocaleString().charAt(1);
        this.badDecimalSeparator = (this.decimalSeparator === "." ? "," : ".");
    }

    /** Substitute `{0}`, `{1}`… placeholders. The indexed form is persisted in chat message flags. */
    static format(template, ...values) {
        return values.reduce((text, value, i) => text.replaceAll(`{${i}}`, String(value)), template);
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

    /**
     * Render a modifier with an explicit sign.
     * @param {number} value
     * @param {string} [zero]   What to render for 0 — the roll formula needs "+0", labels want "0".
     */
    /** Traveller's pseudo-hex: 0-9, then A for 10 and on through the alphabet, clamped at Z. */
    static uppDigit(value) {
        const n = Math.min(35, Math.max(0, value));
        return n < 10 ? String(n) : String.fromCharCode(55 + n);
    }

    static signed(value, zero = "0") {
        if (value === 0) return zero;
        return value > 0 ? `+${value}` : `${value}`;
    }

    static getDisplayDM(dm) {
        return ` (${this.signed(dm)})`;
    }

    static getFormulaDM(dm) {
        return this.signed(dm, "+0");
    }

    /**
     * Companion p.94, Reduced Damage — a weapon's damage dice drop to D3 and keep any plus or
     * minus, so `3d6-3` becomes `3D3-3`. A different roll, not a scaled total, which is why the
     * attack rolls it alongside the full one. Falls back when the substitution would not parse.
     */
    static reduceDamageFormula(formula) {
        const reduced = String(formula ?? "").replace(/(\d*)[dD](?:3|6)?(?![0-9dD])/g, (_m, n) => `${n}D3`);
        return Roll.validate(reduced) ? reduced : String(formula ?? "");
    }

    /** Companion p.94, Minimum Damage — one point per die, ignoring any plus or minus. */
    static minimumDamage(formula) {
        let dice = 0;
        for (const [, n] of String(formula ?? "").matchAll(/(\d*)[dD](?:3|6)?(?![0-9dD])/g)) {
            dice += n === "" ? 1 : Number(n);
        }
        return dice;
    }

    /**
     * The score on a parameterised weapon trait — `AP 5`, `Lo-Pen 3` (Core p.80). The registry
     * already typed it, so the first numeric slot is the answer; a `custom` entry that the
     * registry did not recognise still reads through its note.
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
     * Whether a rolled skill is the Medic skill Core p.83 drives first aid off. A skill is a
     * free-text Item with no registry behind it, so this is a name match and nothing more — a world
     * that renames the skill loses the card button and uses the sheet's own control instead.
     */
    static isFirstAidSkill(name) {
        const text = String(name ?? "").trim().toLowerCase();
        return (text !== "") && MGT2.FirstAidSkills.some(skill => text.startsWith(skill));
    }

    /**
     * The Weapon traits block: one row per stored trait, each in the tone its own rule earns.
     * Both the prompt and the roll path read this — the prompt to render and the roll to total —
     * the way the range band is computed twice from the same rule.
     * @param {Item} weapon        The weapon being attacked with
     * @param {number} strengthDM  The attacker's STR DM, which Bulky and Very Bulky read
     * @returns {object[]}
     */
    static weaponTraitRows(weapon, strengthDM = 0) {
        const range = this.getNumberFromInput(weapon?.system.range?.value);
        return (weapon?.system.traits ?? []).map(trait => {
            const rule = WEAPON_ROLL[trait.key] ?? {};
            const tone = rule.tone ?? "reminded";
            const term = traitLabel(trait);
            // Scope and Auto carry no DM of their own: they void another row rather than add to it.
            const numeric = Boolean(rule.param || rule.strength || rule.dm);
            let dm = rule.dm ?? 0;
            if (rule.param) dm = traitNumber(trait);
            // Core p.80: the penalty is what the wearer's STR DM falls short by, and nothing when
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
                status: rule.target ? "MGT2.RollPrompt.TraitNeedsTarget" : TRAIT_STATUS[tone]
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

    /**
     * Whether a skill Item answers a requirement written as a bare skill name. A speciality answers
     * the skill it belongs to, so "Gun Combat (slug)" satisfies a requirement for "Gun Combat".
     */
    static matchesSkill(name, required) {
        const skill = String(name ?? "").trim().toLowerCase();
        const wanted = String(required ?? "").trim().toLowerCase();
        if (!skill || !wanted) return false;
        return (skill === wanted)
            || (skill.startsWith(wanted) && /[^a-z0-9]/.test(skill.charAt(wanted.length)));
    }

    /** A named modifier contribution reads either straight or through its substitutions. */
    static modifierLabel(source) {
        return source.params
            ? game.i18n.format(source.label, source.params)
            : game.i18n.localize(source.label);
    }

    /**
     * Core p.77-78: the band a shot falls in, measured against the weapon's own Range score — a
     * quarter of it is Short, up to it is normal, twice is Long, four times is Extreme and beyond
     * that is out of range. Past `threshold` metres every attack is Extreme unless the weapon has
     * the Scope trait, and the caller decides whether that is in play: no weapon carries its traits
     * yet, so the prompt offers the rule instead of applying it.
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

    static getDifficultyValue(difficulty) {
        return MGT2.DifficultyTargets[difficulty] ?? 0;
    }

    /**
     * The number a check is measured against. Core p.62: "if no difficulty is listed for a check,
     * you can always assume it is Average (8+)", so every check yields an Effect.
     * @returns {{value: number, assumed: boolean}}
     */
    static getEffectTarget(difficulty) {
        const value = this.getDifficultyValue(difficulty);
        if (value > 0) return { value, assumed: false };
        return { value: MGT2.DifficultyTargets.Average, assumed: true };
    }

    /** The Effect Results band (Core p.62) a margin of success falls in. */
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
        // The localised label already carries the target ("Average (8)"), because the same
        // strings feed the difficulty dropdowns. Appending it again read "Average (8) (8+)".
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
            const converted = Number(data.replace(/\s+/g, '').replace(this.badDecimalSeparator, this.decimalSeparator).trim());
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
}
