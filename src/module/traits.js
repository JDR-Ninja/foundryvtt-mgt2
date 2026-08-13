/**
 * The trait registry, and the one field shape it types.
 *
 * **No rules text ships.** An entry carries a name, a family, an ordered parameter shape and
 * nothing else — a trait's definition is Mongoose's. The page citations and the species that carry
 * each trait stay in `docs/traits-registry.json`, which generates the block below; a two-column
 * `name → what it does` table is a UI for storing prose and is exactly what this replaces. The
 * `note` on a *stored* trait is the owner's own text.
 */

const fields = foundry.data.fields;

// >>> generated from docs/traits-registry.json
// 137 entries over 122 names, 44 parameterised, across 7 families.
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
        "open-vehicle": {label: "Open Vehicle"},
        "tracked": {label: "Tracked"},
    },
    weapon: {
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
        "inaccurate": {label: "Inaccurate", params: [{slot: "score", type: "negative"}]},
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
 * Which vocabulary a stored trait speaks — part of its identity, not decoration: Radiation is
 * `2D × 20` rads at personal scale (Core p.79) and a Hull-proportional DM at ship scale (HG p.31),
 * and Armour takes three slots on a creature and one on a species. Ion is the same shape: RH folio
 * 107's Pulse Carbine carries it at personal scale, HG folio 31's ion cannon at ship scale, and the
 * two rules are different — so the slug is declared in both families rather than in either alone.
 * `custom` is the eighth key and
 * has no registry entries: it is what a site whose accessory list the books never typed declares,
 * rather than claiming a family whose autocomplete would be wrong for it.
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

/**
 * Typographic stand-ins for `-`: true minus, en dash, hyphen, non-breaking hyphen. The corpus is
 * ASCII throughout, but `DOCTYPE-SCHEMAS.md` §2.1 writes `Small (−6)` and anything pasted out of a
 * PDF carries them, where a non-numeric `num` fails silently instead of loudly.
 *
 * **Every replacement is one character for one character**, so an offset into the folded text is
 * the same offset into the raw token — which is what lets a match be computed on the folded form
 * and then sliced out of the printed one. `value` must round-trip the book verbatim.
 */
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
 * trait's behaviour, `TRAITS[family]` is the family's whole vocabulary. Neither is a scan.
 */
export const TRAITS = deepFreeze(REGISTRY);

/**
 * Spellings the books print for a trait the registry names otherwise, canonical slug to alternates.
 *
 * An alias is an *input* spelling and nothing more: it resolves to the canonical slug, adds no
 * registry entry, no label and no i18n key, and it can only match inside a family that already
 * carries that slug — so `Camouflage` on a vehicle, where it is a systems-block line rather than a
 * trait (`DOCTYPE-SCHEMAS.md` §3.3), still resolves to nothing. Both earn their place from the
 * corpus: `Camouflage` outnumbers `Camouflaged` about twenty to one in print and 55 to 5 in
 * statblock trait lists, and `Armoured (+5)` carries a score that falling back to `custom` drops.
 */
const ALIASES = Object.freeze({
    camouflaged: ["Camouflage"],
    armour: ["Armoured"],
    // `One Shot` on the thrown weapons (Dart, Javelin — CSC p.154) is `One Use` said differently:
    // the weapon is expended after a single use. Five printings against the registry's 48.
    "one-use": ["One Shot"]
});

/** The same entries as arrays, ordered by label — what the autocomplete lists. */
const FAMILY_LIST = Object.freeze(Object.fromEntries(Object.entries(TRAITS).map(([family, entries]) =>
    [family, Object.freeze(Object.values(entries).sort((a, b) => a.label.localeCompare(b.label)))])));

/**
 * Every spelling a family answers to, paired with the entry it names and longest first so that
 * `Very Bulky` is tried before `Bulky`. Aliases join the same list, which is what gives them the
 * bare `Armoured +5` form as well as the parenthesised one.
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

/**
 * How each weapon trait meets an attack roll — Core p.79, CSC p.131 and FC p.6-8 between them.
 * `applied` is already in the total, `offered` is a toggle the player confirms, and everything
 * absent from this table is `reminded`: a line with no number. A `control` names the row the prompt
 * gives a trait whose rule is a choice rather than a number — Auto's three fire modes cannot be a
 * checkbox, so the chip states the score and the strip is where it is spent. Surfacing beats applying
 * (`REDESIGN-PLAN.md` §1), so a rule turning on what no sheet holds is never applied — and AP,
 * Lo-Pen, Smart and Blast are reminders here *permanently*, each needing a target the attack roll
 * must not read. AP and Lo-Pen do resolve later, on the damage card, against whoever it is applied
 * to; Smart and Blast have no such moment.
 */
export const WEAPON_ROLL = Object.freeze({
    // Core p.79: "a negative DM equal to the difference between their STR DM and +1" — +2 for Very
    // Bulky. The attacker's STR is on the sheet, so these are the traits that can compute at all.
    "bulky": { tone: "applied", strength: 1 },
    "very-bulky": { tone: "applied", strength: 2 },
    // FC p.7: "The DM is applied to attack rolls and the results of weapon malfunctions."
    "ramshackle": { tone: "applied", param: true },
    // FC p.7: only "when shooting at a target more than 10m distant", and the distance is typed.
    "inaccurate": { tone: "offered", param: true, when: "beyond", value: 10 },
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
    // RH folio 106: an ion hit shuts a robot's brain down and its armour does not protect. Whether
    // any of that happens depends on what was hit, so it resolves on the apply path too.
    "ion": { tone: "reminded", target: true },
    "smart": { tone: "reminded", target: true },
    "blast": { tone: "reminded", target: true }
});

// Companion p.93-94: five creature traits substitute into the damage expression rather than
// scaling its total, and each names the damage types that get through untouched.
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
 * Which transform a defender's traits select, and what bypasses it. **The books give no rule for
 * carrying two of them at once**, so this takes the strongest and intersects the exceptions: an
 * exception is stated against its own trait, so a damage type escapes only when every trait present
 * lets it. Dispersed and Particulate together therefore minimise a blade — Particulate says so and
 * Dispersed does not overrule it — while fire, which both except, still lands in full.
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
 * The one field that replaces six identical `{name, description}` arrays.
 *
 * `params` is an ordered list rather than a scalar because the corpus forces it:
 * `Armour (+7, +10 vs. lasers)` is a score plus a conditional score, `Poison (Difficult, 1D+3,
 * blindness, 1D minutes)` takes four slots, and `Explosive (1D, 3m)` and `Toxic (0m, 1D)` print the
 * same two concepts in opposite orders — so no universal slot order exists and a parser has to be
 * keyed on the trait name whatever the storage. `value` round-trips the book verbatim; `num` is the
 * only half a rule reads.
 * @param {string} family   The vocabulary this site speaks, and the family a new entry starts in
 */
export function createTraitsField(family) {
    return new fields.ArrayField(new fields.SchemaField({
        family: new fields.StringField({ required: true, blank: false, initial: family, choices: TRAIT_FAMILIES }),
        key: new fields.StringField({ required: true, blank: false, initial: CUSTOM_KEY }),
        params: new fields.ArrayField(new fields.SchemaField({
            slot: new fields.StringField({ required: false, blank: true }),
            value: new fields.StringField({ required: true, blank: true }),
            num: new fields.NumberField({ required: false, nullable: true, initial: null })
        })),
        note: new fields.StringField({ required: false, blank: true, trim: true })
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

/* -------------------------------------------- */
/*  Reading and writing the printed form        */
/* -------------------------------------------- */

/**
 * The localised name of a stored trait — its `note` for a custom one, which is the owner's own
 * text. Keyed once per name and not once per entry: Radiation is Radiation in either family.
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
 *
 * Two rules do the work an ordinary zip cannot. An optional slot is skipped when taking it would
 * starve a required slot further along — that is how `Diseased (Average (8+), D3, 1D days)` puts
 * `1D days` in `interval` rather than in `effect` — and a numeric slot whose token carries trailing
 * words hands them on when the next slot is free text, which is what makes `+10 vs. lasers` two
 * slots rather than one.
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
 * Read a printed trait — `Armour (+12)`, `AP 5`, `Zero-G` — into the stored shape. Both the
 * parenthesised form the books use and the bare `NAME value` form worlds typed by hand are
 * accepted; the name is matched against the family's spellings, longest first.
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
        // all. Anything but a letter ends the name; a letter would make `Large` swallow `Larger`,
        // and a remainder the slot's type rejects falls through to the next spelling regardless.
        else if (!bracketed && (folded.length > spelling.length) && folded.startsWith(spelling)
            && /[^a-z]/.test(folded.charAt(spelling.length))) {
            const params = fillSlots(entry.params, splitTokens(name.slice(label.length).trim()));
            if (params) return { family, key: entry.slug, params };
        }
    }
    return null;
}

/**
 * Convert one legacy `{name, description}` entry in place, or leave it alone.
 *
 * Both halves of "in place" matter. The shim runs on every read because nothing persists it, so it
 * has to be idempotent — a `key` already present means converted. And it runs over partial update
 * payloads too (`client/data/client-backend.mjs:231` cleans every update with `{migrate: true,
 * partial: true}`), so a half-formed entry with no `name` string is left untouched. The legacy keys
 * are not deleted: on a partial clean a missing key does not get its `initial`, and the array
 * element's own clean drops them anyway.
 */
function migrateTraitEntry(entry, family) {
    if (!entry || (typeof entry !== "object")) return;
    if (entry.key !== undefined) return;
    if (typeof entry.name !== "string") return;

    const parsed = parseTraitText(entry.name, family);
    Object.assign(entry, parsed ?? { family, key: CUSTOM_KEY, params: [] });
    // A world that typed its traits by the book keeps their meaning; one that did not keeps its
    // text. The description is the owner's note either way, and joins a name that matched nothing.
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

/* -------------------------------------------- */
/*  Sheets                                      */
/* -------------------------------------------- */

/**
 * Re-derive every `num` from the `value` beside it. The chip row lets the owner retype a printed
 * token, and `num` is the half no form control writes.
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
 * Append what the autocomplete input was given. Whatever the family's vocabulary does not
 * recognise is kept whole as a custom entry, so nothing a referee types is ever dropped.
 * @returns {object[]|null}   The new list, or null when there was nothing to add
 */
export function appendTraitText(entries, text, family) {
    const printed = String(text ?? "").trim();
    if (printed === "") return null;
    const parsed = parseTraitText(printed, family);
    return [...Object.values(entries ?? []).map(e => ({ ...e })),
        parsed ? { ...parsed, note: "" } : { family, key: CUSTOM_KEY, params: [], note: printed }];
}

/**
 * The chip row's autocomplete: one input that commits on Enter or on leaving the field. It is not
 * a form control — v14's `<string-tags>` holds a `Set<string>` and a trait is four fields — so it
 * carries no `name` and the callback writes through a document update instead.
 * @param {HTMLElement} root
 * @param {(property: string, text: string) => unknown} add
 */
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
 * One chip row's whole render context. Shared because the same component serves the item sheets'
 * Traits block and the character sheet's own list.
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
