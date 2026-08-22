/** The trait registry, and the one field shape it types. */

const fields = foundry.data.fields;

// >>> generated — 142 entries over 127 names, 44 parameterised, across 7 families. Emitted whole
// from the trait extraction; edit the extraction and re-emit rather than patching a row here.
// ⚠ The five Vehicle Handbook 2026 rows are hand-added; a re-emit drops them.
const REGISTRY = {
    animal: {
        "alarm": {label: "Alarm"},
        "amphibious": {label: "Amphibious"},
        "aquatic": {label: "Aquatic"},
        "armour": {label: "Armour", params: [{slot: "score", type: "positive"}, {slot: "conditionalScore", type: "positive", optional: true}, {slot: "condition", type: "text", optional: true}]},
        "bioelectricity": {label: "Bioelectricity", params: [{slot: "damage", type: "dice"}]},
        "camouflaged": {label: "Camouflaged"},
        "clever": {label: "Clever"},
        "composite": {label: "Composite", params: [{slot: "main", type: "count"}, {slot: "parts", type: "count"}]},
        "diseased": {label: "Diseased", params: [{slot: "difficulty", type: "difficulty"}, {slot: "damage", type: "dice", optional: true}, {slot: "effect", type: "text", optional: true}, {slot: "interval", type: "interval"}]},
        "dispersed": {label: "Dispersed"},
        "echolocation": {label: "Echolocation", params: [{slot: "range", type: "distance"}]},
        "energy": {label: "Energy"},
        "explosive": {label: "Explosive", params: [{slot: "damage", type: "dice"}, {slot: "radius", type: "distance"}]},
        "fast-metabolism": {label: "Fast Metabolism", params: [{slot: "dm", type: "positive"}], conflict: ["slow-metabolism"]},
        "floater": {label: "Floater"},
        "flyer": {label: "Flyer", params: [{slot: "band", type: "band"}]},
        "gigantic": {label: "Gigantic"},
        "gossamer": {label: "Gossamer"},
        "heightened-senses": {label: "Heightened Senses"},
        "ir-uv-vision": {label: "IR/UV Vision"},
        "large": {label: "Large", params: [{slot: "dm", type: "positive"}], conflict: ["small"]},
        "mesmerise": {label: "Mesmerise", params: [{slot: "difficulty", type: "difficulty"}]},
        "ornery": {label: "Ornery"},
        "particulate": {label: "Particulate"},
        "poison": {label: "Poison", params: [{slot: "difficulty", type: "difficulty"}, {slot: "damage", type: "dice", optional: true}, {slot: "effect", type: "text", optional: true}, {slot: "interval", type: "interval"}]},
        "psionic": {label: "Psionic", params: [{slot: "score", type: "int"}]},
        "rage": {label: "Rage"},
        "slow-metabolism": {label: "Slow Metabolism", params: [{slot: "dm", type: "negative"}], conflict: ["fast-metabolism"]},
        "small": {label: "Small", params: [{slot: "dm", type: "negative"}], conflict: ["large"]},
        "strange": {label: "Strange"},
        "tough": {label: "Tough"},
        "toxic": {label: "Toxic", params: [{slot: "range", type: "distance"}, {slot: "damage", type: "dice"}]},
        "vacuum": {label: "Vacuum"},
    },
    biotech: {
        "ectothermic": {label: "Ectothermic", conflict: ["endothermic"]},
        "endothermic": {label: "Endothermic", conflict: ["ectothermic"]},
        // The book prints the effect on the STRUCTURE line -- "3 (heals every 6 hours)" -- and
        // never the trait beside a number, so the parameter is the interval it buys. Base rate is
        // once a day and each of the three applications shortens it. VH2026 p.132.
        "fast-regenerator": {label: "Fast Regenerator",
            params: [{slot: "interval", type: "level"}],
            levels: ["12 hours", "6 hours", "3 hours"]},
        "invertebrate": {label: "Invertebrate", conflict: ["vertebrate"]},
        "vertebrate": {label: "Vertebrate", conflict: ["invertebrate"]},
    },
    robot: {
        "acv": {label: "ACV"},
        "alarm": {label: "Alarm"},
        "amphibious": {label: "Amphibious"},
        "armour": {label: "Armour", params: [{slot: "score", type: "positive"}, {slot: "conditionalScore", type: "positive", optional: true}, {slot: "condition", type: "text", optional: true}]},
        "atv": {label: "ATV", params: [{slot: "band", type: "band", optional: true}]},
        "flyer": {label: "Flyer", params: [{slot: "band", type: "band", default: "idle"}]},
        "hardened": {label: "Hardened"},
        "heightened-senses": {label: "Heightened Senses"},
        "invisible": {label: "Invisible"},
        "ir-uv-vision": {label: "IR/UV Vision"},
        "ir-vision": {label: "IR Vision"},
        "large": {label: "Large", params: [{slot: "dm", type: "positive"}], conflict: ["small"], derived: "size"},
        "seafarer": {label: "Seafarer", params: [{slot: "band", type: "band", optional: true}]},
        "small": {label: "Small", params: [{slot: "dm", type: "negative"}], conflict: ["large"], derived: "size"},
        "stealth": {label: "Stealth", params: [{slot: "score", type: "positive"}]},
        "thruster": {label: "Thruster", params: [{slot: "acceleration", type: "decimal", default: "0.1"}]},
    },
    shipWeapon: {
        "chain-reaction": {label: "Chain Reaction"},
        "ion": {label: "Ion"},
        "orbital-bombardment": {label: "Orbital Bombardment"},
        "orbital-strike": {label: "Orbital Strike"},
        "radiation": {label: "Radiation"},
        "reductor": {label: "Reductor"},
        "weak": {label: "Weak"},
    },
    species: {
        "arm-antlers": {label: "Arm-Antlers"},
        "armour": {label: "Armour", params: [{slot: "score", type: "positive"}]},
        "big-and-tough": {label: "Big and Tough"},
        "bite": {label: "Bite"},
        "brachiator": {label: "Brachiator"},
        "burrowing": {label: "Burrowing"},
        "chameleon": {label: "Chameleon"},
        "claustrophobic": {label: "Claustrophobic"},
        "claws": {label: "Claws"},
        "close-combat-aversion": {label: "Close Combat Aversion"},
        "cold-resistance": {label: "Cold Resistance"},
        "coward": {label: "Coward"},
        "deep-diver": {label: "Deep Diver", params: [{slot: "depth", type: "distance"}]},
        "dewclaw": {label: "Dewclaw"},
        "droyne-claws": {label: "Droyne Claws"},
        "echolocation": {label: "Echolocation", params: [{slot: "range", type: "distance"}]},
        "enhanced-senses": {label: "Enhanced Senses"},
        "extra-limbs": {label: "Extra Limbs"},
        "fast-metabolism": {label: "Fast Metabolism", params: [{slot: "dm", type: "positive"}]},
        "gregarious": {label: "Gregarious"},
        "heightened-senses": {label: "Heightened Senses"},
        "hiver-physiology": {label: "Hiver Physiology"},
        "hyper-acclimatisation": {label: "Hyper-acclimatisation"},
        "manual-dexterity": {label: "Manual Dexterity"},
        "natural-weapons": {label: "Natural Weapons"},
        "ozone-immunity": {label: "Ozone Immunity"},
        "physical-coward": {label: "Physical Coward"},
        "poor-senses": {label: "Poor Senses"},
        "radiation-resistance": {label: "Radiation Resistance"},
        "regeneration": {label: "Regeneration"},
        "sense-of-smell-no-sense-of-smell": {label: "Sense of Smell/No Sense of Smell"},
        "social-norms": {label: "Social Norms"},
        "speed-of-hoof": {label: "Speed of Hoof"},
        "stability": {label: "Stability"},
        "structured-mind": {label: "Structured Mind"},
        "succour-syndrome": {label: "Succour Syndrome"},
        "swimmer": {label: "Swimmer", params: [{slot: "speed", type: "distance"}]},
        "temperature-resistance": {label: "Temperature Resistance"},
        "wings": {label: "Wings"},
    },
    vehicle: {
        "afv": {label: "AFV"},
        "atv": {label: "ATV"},
        "off-roader": {label: "Off-Roader"},
        "open-topped": {label: "Open-Topped"},
        "open-vehicle": {label: "Open Vehicle"},
        "responsive": {label: "Responsive"},
        "tracked": {label: "Tracked"},
        "unresponsive": {label: "Unresponsive"},
        "vtol": {label: "VTOL"},
    },
    weapon: {
        "accurate": {label: "Accurate"},
        "ap": {label: "AP", params: [{slot: "score", type: "int"}], conflict: ["lo-pen"]},
        "artillery": {label: "Artillery"},
        "auto": {label: "Auto", params: [{slot: "score", type: "int"}]},
        "blast": {label: "Blast", params: [{slot: "radius", type: "distance"}]},
        "bulky": {label: "Bulky", conflict: ["very-bulky"]},
        "burn": {label: "Burn", params: [{slot: "rounds", type: "int"}]},
        "corrosion-resistant": {label: "Corrosion-Resistant", params: [{slot: "score", type: "positive"}]},
        "corrosive": {label: "Corrosive"},
        "dangerous": {label: "Dangerous", conflict: ["very-dangerous"]},
        "destructive": {label: "Destructive"},
        "emissions-signature": {label: "Emissions Signature", params: [{slot: "level", type: "level"}], levels: ["minimal", "low", "normal", "high", "very high", "extreme"]},
        "fire": {label: "Fire"},
        "hazardous": {label: "Hazardous", params: [{slot: "score", type: "negative"}]},
        "inaccurate": {label: "Inaccurate", params: [{slot: "score", type: "negative", optional: true}]},
        "incendiary": {label: "Incendiary", params: [{slot: "score", type: "int"}]},
        "ion": {label: "Ion"},
        "lo-pen": {label: "Lo-Pen", params: [{slot: "multiplier", type: "int"}], conflict: ["ap"]},
        "one-use": {label: "One Use"},
        "physical-signature": {label: "Physical Signature", params: [{slot: "level", type: "level"}], levels: ["minimal", "low", "normal", "high", "very high", "extreme"]},
        "radiation": {label: "Radiation"},
        "ramshackle": {label: "Ramshackle", params: [{slot: "score", type: "negative"}]},
        "scope": {label: "Scope"},
        "silent": {label: "Silent"},
        "slow-loader": {label: "Slow Loader", params: [{slot: "rounds", type: "int"}]},
        "smart": {label: "Smart"},
        "smasher": {label: "Smasher"},
        "sonic": {label: "Sonic", params: [{slot: "score", type: "negative"}]},
        "spread": {label: "Spread", params: [{slot: "score", type: "int"}]},
        "stun": {label: "Stun"},
        "unreliable": {label: "Unreliable", params: [{slot: "threshold", type: "int"}]},
        "very-bulky": {label: "Very Bulky", conflict: ["bulky"]},
        "very-dangerous": {label: "Very Dangerous", conflict: ["dangerous"]},
        "zero-g": {label: "Zero-G"},
    }
};
// <<< generated

/**
 * Which vocabulary a stored trait speaks — part of its identity, not decoration: Radiation is `2D ×
 * 20` rads at personal scale (Core p.79) and a Hull-proportional DM at ship scale (HG p.31), and
 * Armour takes three slots on a creature and one on a species.
 */
export const TRAIT_FAMILIES = Object.freeze({
    animal: "MGT2.TraitFamily.animal",
    biotech: "MGT2.TraitFamily.biotech",
    robot: "MGT2.TraitFamily.robot",
    shipWeapon: "MGT2.TraitFamily.shipWeapon",
    species: "MGT2.TraitFamily.species",
    vehicle: "MGT2.TraitFamily.vehicle",
    weapon: "MGT2.TraitFamily.weapon",
    custom: "MGT2.TraitFamily.custom"
});

/** The key a trait that matched nothing is stored under. */
export const CUSTOM_KEY = "custom";

// The six of the twelve parameter types that yield a number a rule can read; the other six —
// `dice`, `interval`, `band`, `difficulty`, `level`, `text` — never do, so their `num` stays null.
const NUMERIC_TYPES = new Set(["int", "positive", "negative", "distance", "decimal", "count"]);

const DICE = /^\d*[dD]\d*\s*(?:[+-]\s*\d+)?$/;
const INTERVAL = /^\d*[dD]\d*\s*(?:[+-]\s*\d+)?\s+\S+/;
const LEADING_NUMBER = /^([+-]?\d+(?:[.,]\d+)?)\s*(.*)$/;

/** Typographic stand-ins for `-`: true minus, en dash, hyphen, non-breaking hyphen. */
const SIGNS = /[−–‐‑]/g;

/** Folded for matching only: signs regularised, case dropped, length untouched. */
function fold(text) {
    return String(text ?? "").replace(SIGNS, "-").toLowerCase();
}

function deepFreeze(value) {
    if ((value === null) || (typeof value !== "object") || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
    return value;
}

// Each entry gains its own identity so a lookup result stands alone.
for (const [family, entries] of Object.entries(REGISTRY)) {
    for (const [slug, entry] of Object.entries(entries)) {
        Object.assign(entry, { slug, family, params: entry.params ?? [] });
    }
}

/**
 * The registry, indexed for the two lookups that happen: `TRAITS[family][slug]` resolves a stored
 * trait's behaviour, `TRAITS[family]` is the family's whole vocabulary.
 */
export const TRAITS = deepFreeze(REGISTRY);

/**
 * Spellings the books print for a trait the registry names otherwise, canonical slug to alternates.
 */
const ALIASES = Object.freeze({
    camouflaged: ["Camouflage"],
    armour: ["Armoured"],
    // `One Shot` on the thrown weapons (Dart, Javelin — CSC p.154) is `One Use` said differently:
    // the weapon is expended after a single use.
    "one-use": ["One Shot"]
});

/** The same entries as arrays, ordered by label — what the autocomplete lists. */
const FAMILY_LIST = Object.freeze(Object.fromEntries(Object.entries(TRAITS).map(([family, entries]) =>
    [family, Object.freeze(Object.values(entries).sort((a, b) => a.label.localeCompare(b.label)))])));

/**
 * Every spelling a family answers to, paired with the entry it names and longest first so that
 * `Very Bulky` is tried before `Bulky`.
 */
const FAMILY_LABELS = Object.freeze(Object.fromEntries(Object.entries(TRAITS).map(([family, entries]) => {
    const spellings = [];
    for (const entry of Object.values(entries)) {
        spellings.push({ label: entry.label, entry });
        for (const alias of ALIASES[entry.slug] ?? []) spellings.push({ label: alias, entry });
    }
    return [family, Object.freeze(spellings.sort((a, b) => b.label.length - a.label.length))];
})));

/** One entry by its stored identity, or null. */
export function getTrait(family, key) {
    return TRAITS[family]?.[key] ?? null;
}

/** A family's whole vocabulary, ordered by label. Empty for `custom`, which has none. */
export function familyTraits(family) {
    return FAMILY_LIST[family] ?? [];
}

/**
 * A stored trait's first numeric parameter, signed by the slot type the registry declared: a world
 * that typed `Inaccurate (1)` meant the penalty, and the type is the only thing that knows.
 */
export function traitNumber(entry) {
    const slots = getTrait(entry?.family, entry?.key)?.params ?? [];
    for (const [index, param] of (entry?.params ?? []).entries()) {
        if ((param.num === null) || (param.num === undefined)) continue;
        const type = slots.find(s => s.slot === param.slot)?.type ?? slots[index]?.type;
        if (type === "negative") return -Math.abs(param.num);
        if (type === "positive") return Math.abs(param.num);
        return param.num;
    }
    return 0;
}

/** How each weapon trait meets an attack roll — Core p.79, CSC p.131 and FC p.6-8 between them. */
export const WEAPON_ROLL = Object.freeze({
    // Core p.79: "a negative DM equal to the difference between their STR DM and +1" — +2 for Very
    // Bulky.
    "bulky": { tone: "applied", strength: 1 },
    "very-bulky": { tone: "applied", strength: 2 },
    // FC p.7: "The DM is applied to attack rolls and the results of weapon malfunctions."
    "ramshackle": { tone: "applied", param: true },
    // FC p.7 past 10 m when scored; VH2026 p.17 prints it bare and takes the Core's bands in metres.
    "inaccurate": { tone: "offered", param: true, when: "beyond", value: 10,
        tiers: [[50, 0], [250, -4], [500, -8], [null, -12]] },
    "accurate": { tone: "offered", bands: { short: 2, normal: 2, long: 1, extreme: 1 } },   // VH2026 p.16
    // FC p.8: "the firer MAY add the Spread value", and only "within its base range".
    "spread": { tone: "offered", param: true, when: "within" },
    // Core p.79: the 100 m rule is ignored "so long as the Traveller aims before shooting".
    "scope": { tone: "offered", requires: "aiming", suppress: "rangeThreshold", checked: true },
    // Core folio 79: Auto has three fire modes, and each of the three rules the trait carries hangs
    // off which one was picked — so its control is the prompt's own fire-mode strip rather than a
    // chip, and the chip states the score the strip reads.
    "auto": { tone: "applied", control: "fireMode" },
    // CSC p.131: DM-2, but only for indirect fire at a target that cannot be physically seen.
    "artillery": { tone: "offered", dm: -2 },
    "ap": { tone: "reminded", target: true },
    "lo-pen": { tone: "reminded", target: true },
    // Core folio 79: "the target will receive 2D x 20 rads" — a dose delivered to whoever was hit,
    // so it is resolved on the apply path like AP and Lo-Pen.
    "radiation": { tone: "reminded", target: true },
    // RH folio 106: an ion hit shuts a robot's brain down and its armour does not protect.
    "ion": { tone: "reminded", target: true },
    "smart": { tone: "reminded", target: true },
    "blast": { tone: "reminded", target: true }
});

// Companion p.93-94: five creature traits substitute into the damage expression rather than scaling
// its total, and each names the damage types that get through untouched.
export const DAMAGE_RESPONSE = Object.freeze({
    "dispersed": { transform: "reduced", exceptions: ["blades", "fire"] },
    "tough": { transform: "reduced", exceptions: [] },
    "gossamer": { transform: "minimum", exceptions: [] },
    "particulate": { transform: "minimum", exceptions: ["fire"] },
    "energy": { transform: "immune", exceptions: [] }
});

/** Weakest first: the order two traits on one creature are resolved in. */
const TRANSFORMS = ["full", "reduced", "minimum", "immune"];

/**
 * Which transform a defender's traits select, and what bypasses it.
 * @param {(key: string) => boolean} has   Whether the defender carries a trait
 */
export function resolveDamageResponse(has) {
    let transform = "full";
    let exceptions = null;
    for (const [key, response] of Object.entries(DAMAGE_RESPONSE)) {
        if (!has(key)) continue;
        if (TRANSFORMS.indexOf(response.transform) > TRANSFORMS.indexOf(transform)) {
            transform = response.transform;
        }
        exceptions = (exceptions === null) ? [...response.exceptions]
            : exceptions.filter(type => response.exceptions.includes(type));
    }
    return { transform, exceptions: exceptions ?? [] };
}

/**
 * The two traits that leave something behind on whoever was hit, and the `disease` sub-type each
 * one becomes.
 */
export const HAZARD_TRAITS = Object.freeze({ poison: "poison", diseased: "disease" });

/**
 * `Very Difficult (12+)` → `VeryDifficult`.
 * @returns {string|null}   Null for anything the ladder does not name
 */
function difficultyKey(value) {
    const folded = fold(value).replace(/\(.*/, "").replace(/[^a-z]/g, "");
    if (folded === "") return null;
    return Object.keys(CONFIG.MGT2?.DifficultyTargets ?? {}).find(key => fold(key) === folded) ?? null;
}

/**
 * The `disease` Item a Poison or Diseased trait inflicts, as creation data.
 * @param {object} entry          A stored trait
 * @param {string} [sourceName]   What carried it — the weapon, or the creature that bit
 * @returns {object|null}         Null for any trait that is not a hazard
 */
export function buildHazardItem(entry, sourceName) {
    const subType = HAZARD_TRAITS[entry?.key];
    if (!subType) return null;

    const slots = {};
    for (const param of entry.params ?? []) {
        if (param.slot && (param.value !== "")) slots[param.slot] = param.value;
    }
    const difficulty = difficultyKey(slots.difficulty);
    const label = traitLabel(entry);

    return {
        type: "disease",
        name: sourceName
            ? game.i18n.format("MGT2.Hazard.Name", { trait: label, source: sourceName })
            : label,
        system: {
            subType,
            // A name the ladder does not carry is left to the field's own default rather than
            // guessed: the disease sheet states its check on a select with no empty option.
            ...(difficulty ? { difficulty } : {}),
            damage: slots.damage ?? "",
            effect: slots.effect ?? "",
            interval: slots.interval ?? "",
            description: entry.note ?? ""
        }
    };
}

/** Every hazard a trait list carries, in stored order — Tezheerekti carries both. */
export function hazardTraits(entries) {
    return Object.values(entries ?? []).filter(entry => Boolean(HAZARD_TRAITS[entry?.key]));
}

/**
 * The one field that replaces six identical `{name, description}` arrays.
 * @param {string} family   The vocabulary this site speaks, and the family a new entry starts in
 */
export function createTraitsField(family) {
    return new fields.ArrayField(new fields.SchemaField({
        family: new fields.StringField({ required: true, blank: false, initial: family, choices: TRAIT_FAMILIES }),
        key: new fields.StringField({ required: true, blank: false, initial: CUSTOM_KEY }),
        params: new fields.ArrayField(new fields.SchemaField({
            slot: new fields.StringField({ required: false, blank: true, initial: "" }),
            value: new fields.StringField({ required: true, blank: true }),
            num: new fields.NumberField({ required: false, nullable: true, initial: null })
        })),
        note: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
    }));
}

/** The derived lookup `prepareDerivedData` hangs on a document: slug to stored entry. */
export function buildTraitMap(entries) {
    const map = {};
    for (const entry of entries ?? []) {
        if (entry?.key && (entry.key !== CUSTOM_KEY)) map[entry.key] = entry;
    }
    return map;
}

/**
 * The localised name of a stored trait — its `note` for a custom one, which is the owner's own
 * text.
 */
export function traitLabel(entry) {
    if (!entry) return "";
    if (entry.key === CUSTOM_KEY) return entry.note ?? "";
    const key = `MGT2.Traits.${entry.key}`;
    if (game.i18n.has(key)) return game.i18n.localize(key);
    return getTrait(entry.family, entry.key)?.label ?? entry.key;
}

/** What a slot holds. Named because the order is per trait and nothing else states it. */
export function slotLabel(slot) {
    const key = `MGT2.TraitSlot.${slot}`;
    return game.i18n.has(key) ? game.i18n.localize(key) : (slot ?? "");
}

/** `Armour (+7, +10, vs. lasers)` — the chip's own text, for a tooltip or a one-line summary. */
export function formatTrait(entry) {
    const label = traitLabel(entry);
    const params = (entry?.params ?? []).map(p => p.value).filter(v => v !== "");
    return params.length > 0 ? `${label} (${params.join(", ")})` : label;
}

/** Split on commas at depth zero: `Diseased (Average (8+), D3, 1D days)` nests its difficulty. */
function splitTokens(text) {
    const tokens = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "(") depth++;
        else if (c === ")") depth--;
        else if ((c === ",") && (depth === 0)) {
            tokens.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    tokens.push(text.slice(start).trim());
    return tokens.filter(t => t !== "");
}

/** Whether a printed token can be what a slot of this type wants. */
function fitsType(type, token) {
    const folded = fold(token);
    switch (type) {
        case "dice": return DICE.test(folded);
        case "interval": return INTERVAL.test(folded);
        case "int": case "positive": case "negative": case "distance": case "decimal":
            return LEADING_NUMBER.test(folded);
        // "an integer count, which may itself be printed as dice" — Composite (1D+3D).
        case "count": return LEADING_NUMBER.test(folded) || DICE.test(folded);
        default: return true;
    }
}

function slotNumber(type, token) {
    const folded = fold(token);
    if (!NUMERIC_TYPES.has(type) || DICE.test(folded)) return null;
    const match = LEADING_NUMBER.exec(folded);
    if (!match) return null;
    const value = Number(match[1].replace(",", "."));
    return Number.isFinite(value) ? value : null;
}

/**
 * Fill an entry's slots from the printed tokens, left to right.
 * @returns {object[]|null}   Null when a required slot could not be filled
 */
function fillSlots(slots, tokens) {
    const params = [];
    const queue = [...tokens];
    for (const [index, slot] of slots.entries()) {
        const remainingRequired = slots.slice(index + 1).filter(s => !s.optional).length;
        let token = queue[0];
        if (token === undefined || (slot.optional
            && ((queue.length <= remainingRequired) || !fitsType(slot.type, token)))) {
            if (slot.optional) continue;
            return null;
        }
        if (!fitsType(slot.type, token)) return null;
        queue.shift();

        const next = slots[index + 1];
        if (NUMERIC_TYPES.has(slot.type) && (next?.type === "text")) {
            // Matched on the folded token and cut out of the printed one: folding preserves
            // offsets, so `−10 vs. lasers` keeps its typographic minus in `value`.
            const match = LEADING_NUMBER.exec(fold(token));
            if (match?.[2]) {
                queue.unshift(token.slice(token.length - match[2].length));
                token = token.slice(0, match[1].length);
            }
        }
        params.push({ slot: slot.slot, value: token, num: slotNumber(slot.type, token) });
    }
    return queue.length === 0 ? params : null;
}

/**
 * Read a printed trait — `Armour (+12)`, `AP 5`, `Zero-G` — into the stored shape.
 * @returns {{family: string, key: string, params: object[]}|null}   Null when nothing matched
 */
export function parseTraitText(text, family) {
    const printed = String(text ?? "").trim();
    if (printed === "") return null;

    const open = printed.indexOf("(");
    const close = printed.lastIndexOf(")");
    const bracketed = (open > 0) && (close > open);
    const name = (bracketed ? printed.slice(0, open) : printed).trim();
    const folded = fold(name);
    const inner = bracketed ? printed.slice(open + 1, close) : "";

    for (const { label, entry } of FAMILY_LABELS[family] ?? []) {
        const spelling = fold(label);
        if (folded === spelling) {
            const params = fillSlots(entry.params, splitTokens(inner));
            if (params) return { family, key: entry.slug, params };
        }
        // `AP 5`, `Armour +12`, and `AP3` — which the books print 27 times with no separator at
        // all.
        else if (!bracketed && (folded.length > spelling.length) && folded.startsWith(spelling)
            && /[^a-z]/.test(folded.charAt(spelling.length))) {
            const params = fillSlots(entry.params, splitTokens(name.slice(label.length).trim()));
            if (params) return { family, key: entry.slug, params };
        }
    }
    return null;
}

/** Convert one legacy `{name, description}` entry in place, or leave it alone. */
function migrateTraitEntry(entry, family) {
    if (!entry || (typeof entry !== "object")) return;
    if (entry.key !== undefined) return;
    if (typeof entry.name !== "string") return;

    const parsed = parseTraitText(entry.name, family);
    Object.assign(entry, parsed ?? { family, key: CUSTOM_KEY, params: [] });
    // A world that typed its traits by the book keeps their meaning; one that did not keeps its
    // text.
    const description = (typeof entry.description === "string") ? entry.description.trim() : "";
    entry.note = parsed
        ? description
        : [entry.name.trim(), description].filter(t => t !== "").join(" — ");
}

/** The same over a whole legacy array. Safe on an array that is already in the new shape. */
export function migrateTraitArray(entries, family) {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) migrateTraitEntry(entry, family);
}

/**
 * Re-derive every `num` from the `value` beside it.
 * @param {object|object[]} entries   The submitted list, still indexed by position
 */
export function refreshTraitNumbers(entries) {
    for (const entry of Object.values(entries ?? {})) {
        const slots = getTrait(entry?.family, entry?.key)?.params ?? [];
        for (const [index, param] of Object.values(entry?.params ?? {}).entries()) {
            const type = slots.find(s => s.slot === param.slot)?.type ?? slots[index]?.type;
            param.num = type ? slotNumber(type, String(param.value ?? "").trim()) : null;
        }
    }
}

/**
 * Append what the autocomplete input was given.
 * @returns {object[]|null}   The new list, or null when there was nothing to add
 */
export function appendTraitText(entries, text, family) {
    const printed = String(text ?? "").trim();
    if (printed === "") return null;
    const parsed = parseTraitText(printed, family);
    return [...Object.values(entries ?? []).map(e => ({ ...e })),
        parsed ? { ...parsed, note: "" } : { family, key: CUSTOM_KEY, params: [], note: printed }];
}

/** The chip row's autocomplete: one input that commits on Enter or on leaving the field. */
export function bindTraitInput(root, add) {
    for (const input of root.querySelectorAll(".codes .addtag input")) {
        const property = input.closest("[data-property]")?.dataset.property;
        const commit = () => {
            const text = input.value;
            input.value = "";
            if (text.trim() !== "") add(property, text);
        };
        input.addEventListener("change", commit);
        input.addEventListener("keydown", event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
        });
    }
}

/**
 * One chip row's whole render context.
 * @param {object[]} entries   The stored list
 * @param {string} property    Its path under `system`, which names the form controls
 * @param {string} family      The vocabulary this site speaks
 * @param {string} label       The i18n key of the block's heading
 */
export function prepareTraitBlock(entries, property, family, label) {
    return {
        property, family, label,
        familyLabel: TRAIT_FAMILIES[family],
        // One list per family, shared by every chip row on the sheet that speaks it.
        listId: `mgt2-traits-${family}`,
        vocabulary: familyTraits(family).map(entry => ({
            label: traitLabel({ family, key: entry.slug }),
            // The slot names, in order — the one thing a parameterised trait cannot be typed
            // without, since Explosive and Toxic print the same two concepts the other way round.
            hint: entry.params.length > 0 ? `(${entry.params.map(p => slotLabel(p.slot)).join(", ")})` : ""
        })),
        entries: Object.values(entries ?? []).map(entry => ({
            family: entry.family,
            key: entry.key,
            note: entry.note ?? "",
            custom: entry.key === CUSTOM_KEY,
            label: traitLabel(entry),
            params: (entry.params ?? []).map(p => ({ ...p, slotLabel: slotLabel(p.slot) }))
        }))
    };
}
