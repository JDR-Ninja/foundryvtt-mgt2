import { MGT2 } from "../config.js";
import { LocalDocumentField } from "../datamodels.js";
import { MGT2Helper } from "../helper.js";
import { Rules } from "../rules.js";
import { buildHazardItem, buildTraitMap, createTraitsField, hazardTraits, resolveDamageResponse } from "../traits.js";

const fields = foundry.data.fields;

// DM ladder indexed by characteristic value; 15+ is off the end of the table.
const DM_LADDER = [-3, -2, -2, -1, -1, -1, 0, 0, 0, 1, 1, 1, 2, 2, 2];

// Core folio 228: the reserve stands still for three hours, then returns a point an hour.
const PSI_RECOVERY_DELAY = 3;

// The only Active-Effect sink for a standing check DM; `region-behaviors.js` is what writes it.
const CHECK_EFFECT_PATH = "system.modifiers.check.effect";

// One warning per sub-type and key: the chain is walked on every prepare.
const warnedLinks = new Set();

/** A characteristic stores its score and its wound; the other four numbers derive. */
export function createCharacteristicField(show = true) {
    return new fields.SchemaField({
        base: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        damage: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        auto: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        effect: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        max: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 0 }),
        value: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 0 }),
        show: new fields.BooleanField({ required: false, initial: show })
    });
}

/** The identity block of a sub-type that is somebody rather than something. */
export function withPersonal() {
    return {
        personal: new fields.SchemaField({
            title: new fields.StringField({ required: false, blank: true, trim: true }),
            // The embedded Item, or the name a table shipping no content typed instead.
            species: new LocalDocumentField(foundry.documents.BaseItem, {
                required: false, blank: true, trim: true, initial: "", fallback: true }),
            age: new fields.StringField({ required: false, blank: true, trim: true }),
            gender: new fields.StringField({ required: false, blank: true, trim: true }),
            pronouns: new fields.StringField({ required: false, blank: true, trim: true }),
            homeworld: new fields.StringField({ required: false, blank: true, trim: true })
        })
    };
}

/**
 * A modifier accumulator: three provenances and their total, because one integer cannot tell an
 * Active Effect, a computed bonus and the referee's own entry apart.
 */
export function createModifierField() {
    return new fields.SchemaField({
        custom: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        auto: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        effect: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        dm: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 })
    });
}

/**
 * What every Actor sub-type shares: a damage pool drained along an ordered chain of
 * characteristics, and the DM ladder that reads them.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ActorBaseData extends foundry.abstract.TypeDataModel {

    /** The chain a new actor of this sub-type starts with. */
    static DEFAULT_DAMAGE_ORDER = [];

    /** Which characteristic a new actor rolls Initiative off; blank hands it to `initiative.flat`. */
    static DEFAULT_INITIATIVE = "";

    /** The characteristics whose current values set the encumbrance cap (Core p.98). */
    static ENCUMBRANCE_LINKS = ["strength", "endurance"];

    /** Core p.79 names END as the only characteristic Stun reaches; blank stuns the chain's first link. */
    static STUN_LINK = "";

    /** Core p.83: the characteristics that recover a point a day outside the physical wound. */
    static MENTAL_LINKS = [];

    /** The scale before any trait speaks; `spacecraft` overrides it permanently (Core p.167). */
    static SCALE = "ground";

    static defineSchema() {
        const damageOrder = [...this.DEFAULT_DAMAGE_ORDER];
        return {
            // Summed over the chain on every prepare; declared only for the token-bar reason above.
            life: new fields.SchemaField({
                value: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
                max: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
                damage: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true })
            }),
            // Clamped to `life.damage` on every prepare: an hour of rest clears exactly this (Core p.79).
            stun: new fields.NumberField({ required: false, nullable: false, initial: 0, min: 0, integer: true }),
            notes: new fields.HTMLField({ required: false, blank: true, trim: true }),

            // A Traveller's traits come from their species, so that is where a new entry starts.
            traits: createTraitsField("species"),

            modifiers: new fields.SchemaField({
                check: createModifierField(),
                // Core p.74 makes Initiative the Effect of a DEX or INT check, so a printed
                // `Initiative -2` has no sink beside it: `check` would hit every check that species
                // makes.
                initiative: createModifierField(),
                // Keyed by a free-text skill's slug; `validateKey` drops a typo rather than storing it.
                skills: new fields.TypedObjectField(createModifierField(),
                    { initial: {}, validateKey: MGT2Helper.isSkillSlug })
            }),

            config: new fields.SchemaField({
                // Ordered, no duplicates: damage fills each link before moving to the next.
                damageOrder: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false }),
                    { initial: damageOrder }),
                // A creature has no DEX and Fast Metabolism (+X) hands the DM directly (Core p.85),
                // so `flat` is read whenever `characteristic` is blank.
                initiative: new fields.SchemaField({
                    characteristic: new fields.StringField({
                        required: false, blank: true, initial: this.DEFAULT_INITIATIVE }),
                    flat: new fields.NumberField({
                        required: false, nullable: false, integer: true, initial: 0 })
                })
            })
        };
    }

    /** The lookup behind the pointer is what makes a world whose pointer was never written work. */
    get species() {
        const linked = this.personal?.species;
        if ( linked instanceof foundry.documents.BaseItem ) return linked;
        return this.parent?.items.find(item => item.type === "species") ?? null;
    }

    /** Which of them SPEAK: one, unless a sub-variant is allowed to add to its parent species. */
    get speciesItems() {
        const all = this.parent?.items.filter(item => item.type === "species") ?? [];
        return Rules.on("speciesModifiersStack") ? all : all.slice(0, 1);
    }

    /** The roster, off the schema — a config dictionary only ever describes one sub-type's. */
    get characteristicKeys() {
        return Object.keys(this.schema.fields.characteristics?.fields ?? {});
    }

    /**
     * Whether this actor shows a characteristic — the world decides whether it exists at this table
     * at all, the actor whether it shows one that does.
     */
    isCharacteristicShown(key) {
        return (this.characteristics[key]?.show === true) && Rules.characteristic(key);
    }

    /**
     * Which of them a check may be ROLLED on, which is not which the sheet shows: `hull` and `hits`
     * run the DM ladder like the rest, so the prompt was offering "Hull — 240 (+3)".
     * @type {string[]}
     */
    get rollableCharacteristics() {
        return this.characteristicKeys.filter(key =>
            this.isCharacteristicShown(key) && !(key in MGT2.DamageTracks));
    }

    /**
     * The damage chain, less any link this sub-type does not declare: a chain outlives the schema
     * it was written against, and an unguarded sum would give NaN and a blank token bar.
     */
    get damageChain() {
        const chain = [];
        for (const key of this.config.damageOrder) {
            if (key in this.characteristics) chain.push(key);
            else this.#warnUnknownLink(key);
        }
        return chain;
    }

    #warnUnknownLink(key) {
        const id = `${this.parent?.type}.${key}`;
        if (warnedLinks.has(id)) return;
        warnedLinks.add(id);
        console.warn(`mgt2 | damage chain link "${key}" is not a characteristic of "${this.parent?.type}" and is ignored`);
    }

    /** The chain links carrying a wound — what every healing procedure divides itself among. */
    get damagedLinks() {
        return this.damageChain.filter(key => this.characteristics[key].damage > 0);
    }

    /** Which link Stun damage drains. @type {string|null} */
    get stunLink() {
        const chain = this.damageChain;
        const named = this.constructor.STUN_LINK;
        if (named && chain.includes(named)) return named;
        return chain[0] ?? null;
    }

    /** Protection worn or built in, subtracted from every wound. */
    get protection() {
        return this.inventory?.armor ?? 0;
    }

    /**
     * The Protection this attack meets: one number for a person, the struck facing for a vehicle
     * (Core p.140), none at all for a critical.
     */
    protectionAgainst(options = {}) {
        return options.ignoreArmour ? 0 : this.protection;
    }

    /** The hardest difficulty this actor may attempt. */
    get taskCeiling() {
        return null;
    }

    /** The vocabulary a new trait typed on this actor starts in. */
    get traitFamily() {
        return this.schema.fields.traits.element.fields.family.initial;
    }

    /** Core folio 100: an armour's Rad score is deducted from every dose. */
    get radiationProtection() {
        let rads = 0;
        for (const item of this.parent.items) {
            if ((item.type === "armor") && (item.system.equipped === true)) {
                rads += Math.max(0, item.system.radiations || 0);
            }
        }
        return rads;
    }

    /** Core p.77: a melee attack adds the attacker's own STR DM to its damage. */
    get meleeDamageDM() {
        return this.characteristics.strength?.dm ?? 0;
    }

    /** Every healing rate on Core p.83 is measured in the patient's own END DM. */
    get enduranceDM() {
        return this.characteristics.endurance?.dm ?? 0;
    }

    /** Every accumulator the actor carries, the general check first. @type {object[]} */
    get modifierAccumulators() {
        return [this.modifiers.check, this.modifiers.initiative,
            ...Object.values(this.modifiers.skills)];
    }

    /**
     * Core p.77: unconscious once a characteristic PAST the first has been emptied — the chain puts
     * END first, so the first zero is the one the rule does not count — and dead once the whole
     * chain is at zero.
     */
    get damageStates() {
        return this.damageStatesFor(this.characteristics);
    }

    /**
     * The same rule read against a projection instead of the stored wound, so the damage dialog can
     * state what a hit would cause before writing it.
     */
    damageStatesFor(characteristics) {
        // A link with no score has no pool to empty, so a blank sheet is not a corpse.
        const chain = this.damageChain.filter(key => characteristics[key].max > 0);
        if (chain.length === 0) return { unconscious: false, dead: false };
        const emptied = key => characteristics[key].value <= 0;
        return {
            unconscious: chain.slice(1).some(emptied),
            dead: chain.every(emptied)
        };
    }

    /** Which of `damageStates` the damage dialog names, and this type's word for each. */
    get damageStateLabels() {
        return { unconscious: "MGT2.Actor.Unconscious", dead: "MGT2.Actor.Dead" };
    }

    /**
     * The points `amount` would push past the first link while more than one link could still take
     * them — the moment Core folio 77 hands the choice to the target.
     */
    overflowChoice(amount) {
        const chain = this.damageChain;
        if (chain.length < 2) return null;

        const first = this.characteristics[chain[0]];
        const taken = Math.max(0, first.max - first.damage);
        const remaining = amount - taken;
        if (remaining <= 0) return null;

        const choices = chain.slice(1).filter(key => this.characteristics[key].value > 0);
        if (choices.length < 2) return null;
        return { filled: chain[0], taken, remaining, choices };
    }

    /** Both sinks are filled by derivations and by Active Effects, never by the stored document. */
    prepareBaseData() {
        for (const c of Object.values(this.characteristics)) {
            c.auto = 0;
            c.effect = 0;
        }
        this.#declareSkillModifiers();
        this.#declareTraits();
        for (const modifier of this.modifierAccumulators) {
            modifier.auto = 0;
            modifier.effect = 0;
        }
    }

    /**
     * Sliced and not pushed: `prepareData` may run over a model that was not re-initialised, and
     * appending would double the list each time.
     */
    #declareTraits() {
        this.ownTraits = this.traits.slice(0, this._source.traits.length);
        this.speciesTraits = this.speciesItems.flatMap(item => item.system.traits ?? []);
        this.traits = this.speciesTraits.length
            ? [...this.ownTraits, ...this.speciesTraits] : this.ownTraits;
    }

    /** One accumulator per skill the actor carries. */
    #declareSkillModifiers() {
        for (const item of this.parent?.items ?? []) {
            if ((item.type !== "talent") || (item.system.subType !== "skill")) continue;
            const slug = MGT2Helper.skillSlug(item.name);
            if (!slug || (slug in this.modifiers.skills)) continue;
            this.modifiers.skills[slug] = { custom: 0, auto: 0, effect: 0, dm: 0 };
        }
    }

    /** Total each accumulator. */
    sumModifiers() {
        for (const modifier of this.modifierAccumulators) {
            modifier.dm = modifier.custom + modifier.auto + modifier.effect;
        }
    }

    /** The last chance to add to `auto` before `max` reads it. */
    prepareCharacteristicAuto() {}

    /** @inheritDoc */
    prepareDerivedData() {
        this.prepareCharacteristicAuto();
        for (const c of Object.values(this.characteristics)) {
            c.max = Math.max(0, c.base + c.auto + c.effect);
            c.value = Math.max(0, c.max - c.damage);
            // Meaningless on a pure damage track, but one array lookup is cheaper than a branch here.
            c.dm = ActorBaseData.getModifier(c.value);
        }

        const life = { value: 0, max: 0, damage: 0 };
        for (const key of this.damageChain) {
            const c = this.characteristics[key];
            life.value += c.value;
            life.max += c.max;
            life.damage += c.damage;
        }
        this.life = life;

        // Nothing may report more stun than there is wound, so a heal that emptied the pool healed it.
        this.stun = Math.min(this.stun, life.damage);
        // Companion p.94: a Gigantic creature is treated as Spacecraft scale for dealing and taking
        // damage — which is what makes a Traveller shooting a starship divide by ten with no
        // branch.
        this.scale = MGT2Helper.hasTrait(this.traits, "gigantic")
            ? "spacecraft" : this.constructor.SCALE;
        // Companion p.93-94: which reading of an attack lands is the defender's own property.
        this.damageResponse = resolveDamageResponse(key => MGT2Helper.hasTrait(this.traits, key));

        const states = this.damageStates;
        // Core p.83: an END check restores consciousness without healing, so the chain alone cannot
        // answer.
        if (states.unconscious && (life.damage <= (this.states?.consciousWound ?? -1))) {
            states.unconscious = false;
        }
        Object.assign(this.states ??= {}, states);

        // Before the initiative below, the first derivation to read a `dm`: `dm` is stored, so
        // totalling after the read leaves it one prepare behind and settles on its own.
        this.sumModifiers();
        const initiative = this.config.initiative;
        this.initiative = (this.characteristics[initiative.characteristic]?.dm ?? initiative.flat ?? 0)
            + this.modifiers.initiative.dm;
        this.traitMap = buildTraitMap(this.traits);
    }

    /** Protection: what is worn, plus what a trait grants. */
    prepareArmor() {
        let armor = MGT2Helper.traitScore(this.traits, "armour");
        for (const item of this.parent.items) {
            if ((item.type === "armor") && (item.system.equipped === true) && !isNaN(item.system.protection)) {
                armor += (+item.system.protection || 0);
            }
            // Core p.107: subdermal armour stacks with other protection, and `equipped` is the
            // fitted gate rather than a worn one.
            if ((item.type === "equipment") && (item.system.subType === "augment")
                && (item.system.equipped === true)) {
                armor += (+item.system.augment?.protection || 0);
            }
        }
        this.inventory.armor = armor;
    }

    /** Mass of one item, quantity included; the rule lives on the item, for the loose-container case. */
    itemWeight(item) {
        return item.getTotalWeight();
    }

    prepareWeight() {
        let onHand = 0;
        for (const item of this.parent.items) {
            if (item.system.container?.id) continue;   // counted through its container
            // A container is only carried when it is on the traveller rather than left somewhere.
            if (item.type === "container") {
                if (item.system.onHand === true) onHand += item.getTotalWeight();
                continue;
            }
            onHand += MGT2Helper.roundWeight(this.itemWeight(item));
        }
        this.inventory.weight = MGT2Helper.roundWeight(onHand);
    }

    prepareEncumbrance() {
        const links = this.constructor.ENCUMBRANCE_LINKS;
        // No links is a sub-type the rule does not reach; false rather than absent clears the icon.
        if (!links.length) {
            this.states.encumbrance = false;
            return;
        }
        const normal = links
            .reduce((sum, key) => sum + (this.characteristics[key]?.value ?? 0), this.encumbranceSkillBonus);
        this.inventory.encumbrance = { normal, heavy: normal * 2 };
        // Gating the flag is what keeps the DM-2 below, the header tick and the token icon together.
        this.states.encumbrance = Rules.on("encumbrance") && (this.inventory.weight > normal);
    }

    /** Total levels of skills flagged as reducing encumbrance. */
    get encumbranceSkillBonus() {
        return this.parent.items
            .filter(i => i.type === "talent" && i.system.subType === "skill" && i.system.skill.reduceEncumbrance === true)
            .reduce((sum, i) => sum + i.system.level, 0);
    }

    /** The states that stand on a check whatever it is of, in the order the prompt lists them. */
    static CHECK_STATES = Object.freeze([
        // Core folio 80: DM-2 to ALL checks until they rest, which is why this names no characteristic.
        { state: "fatigue", key: "fatigue", label: "MGT2.Actor.Fatigue", dm: -2 },
        // Core folio 81's Nausea, the same shape and the same reason.
        { state: "nausea", key: "nausea", label: "MGT2.Radiation.Nausea", dm: -1 },
        // Core folio 98 is narrower: "DM-2 on all physical actions".
        { state: "encumbrance", key: "encumbrance", label: "MGT2.Actor.Encumbrance", dm: -2,
            characteristics: MGT2.PhysicalCharacteristics }
    ]);

    /**
     * The standing DMs a check carries before anything situational, each named beside the
     * accumulator it feeds so the roll prompt can print and waive them.
     * @param {object[]} [extra]   The sub-type's own sources, appended after the shared ones
     */
    prepareCheckModifiers(extra = []) {
        const sources = [
            ...this.stateCheckModifiers(),
            ...this.armorSkillModifiers(),
            ...this.augmentSkillModifiers(),
            ...this.scopedEffectModifiers(),
            ...extra
        ];
        this.modifiers.check.auto = sources.reduce((sum, source) => sum + source.dm, 0);
        this.modifiers.check.sources = sources;
        this.sumModifiers();
    }

    /** @protected */
    stateCheckModifiers() {
        const sources = [];
        for (const { state, ...source } of this.constructor.CHECK_STATES) {
            if (this.states?.[state] === true) sources.push({ ...source });
        }
        return sources;
    }

    /**
     * Core p.100: armour with a required skill costs DM-1 per level the wearer is short, and a flat
     * DM-3 to a wearer with no such skill at all.
     */
    armorSkillModifiers() {
        const sources = [];
        for (const item of this.parent.items) {
            if ((item.type !== "armor") || (item.system.equipped !== true)) continue;
            const required = item.system.requireSkill?.trim();
            if (!required) continue;

            const level = this.skillLevel(required);
            const dm = (level === null) ? -3
                : -Math.max(0, (Math.trunc(item.system.requireSkillLevel) || 0) - level);
            if (dm === 0) continue;
            // Hyphenated, never dotted: the prompt names a form control after this key.
            sources.push({ key: `armor-${item.id}`, label: "MGT2.Actor.ArmorSkill", dm,
                params: { armor: item.name, skill: required } });
        }
        return sources;
    }

    /**
     * Core p.107: a skill augmentation gives DM+1 "when using that specific skill" — the first
     * source in the system scoped to a SKILL rather than to a characteristic roster.
     */
    augmentSkillModifiers() {
        const sources = [];
        for (const item of this.parent.items) {
            if (!ActorBaseData.#isFittedAugment(item)) continue;
            const named = item.system.augment.skill?.name?.trim();
            const dm = Math.trunc(item.system.augment.skill?.value) || 0;
            // The augment does nothing for a skill the Traveller does not have at all.
            if (!named || (dm === 0) || (this.skillLevel(named) === null)) continue;

            // Resolved to Item ids here, where `matchesSkill` can settle the speciality form.
            const skills = this.parent.items.filter(skill => (skill.type === "talent")
                && (skill.system.subType === "skill")
                && MGT2Helper.matchesSkill(skill.name, named)).map(skill => skill.id);
            // Hyphenated, never dotted: the prompt names a form control after this key.
            sources.push({ key: `augment-${item.id}`, label: "MGT2.Actor.AugmentSkill", dm,
                params: { augment: item.name, skill: named }, skills });
        }
        return sources;
    }

    /** Fitted, not carried: Core p.106 improves nobody through a bag. */
    static #isFittedAugment(item) {
        return (item.type === "equipment") && (item.system.subType === "augment")
            && (item.system.equipped === true);
    }

    /** Core p.107 allows ONE skill augmentation. */
    get augmentIssues() {
        const skillDuplicates = [];
        let held = false;
        for (const item of this.parent.items) {
            if (!ActorBaseData.#isFittedAugment(item)) continue;
            if (!item.system.augment.skill?.name?.trim()) continue;
            if (held) skillDuplicates.push(item.id);
            else held = true;
        }
        return { skillDuplicates, any: skillDuplicates.length > 0 };
    }

    /** Core p.80-81: a low-gravity band is DM−1 to the PHYSICAL checks alone. */
    scopedEffectModifiers() {
        const sources = [];
        for (const effect of this.parent.allApplicableEffects()) {
            if (!effect.active || (effect.flags?.mgt2?.region?.physicalOnly !== true)) continue;
            // Only an additive change can be attributed: an override says what the sink IS.
            const dm = (effect.system.changes ?? []).reduce((sum, change) =>
                ((change.key === CHECK_EFFECT_PATH) && (change.type === "add"))
                    ? sum + (Number(change.value) || 0) : sum, 0);
            if (dm === 0) continue;

            this.modifiers.check.effect -= dm;
            // Hyphenated, never dotted: the prompt names a form control after this key.
            sources.push({ key: `effect-${effect.id}`, label: effect.name, dm,
                characteristics: MGT2.PhysicalCharacteristics });
        }
        return sources;
    }

    /** The best level in a named skill, or null when the actor does not have that skill at all. */
    skillLevel(name) {
        let best = null;
        for (const item of this.parent.items) {
            if ((item.type !== "talent") || (item.system.subType !== "skill")) continue;
            if (!MGT2Helper.matchesSkill(item.name, name)) continue;
            best = Math.max(best ?? 0, item.system.level ?? 0);
        }
        return best;
    }

    /**
     * Take a wound through the pipeline and write it.
     * @param {number} [options.multiple]   The firing mount's damage multiple (HG p.29)
     * @returns {Promise<{wound: number, rounds: number}|undefined>}   `rounds` is Stun's incapacitation
     */
    async applyDamage(amount, options = {}) {
        amount = Number(amount);
        if (!amount || isNaN(amount)) return;
        if (this.damageChain.length === 0) return;

        if (amount < 0) {
            const data = this.#healed(-amount);
            if (foundry.utils.isEmpty(data)) return;
            await this.parent.update({ system: { characteristics: data } });
            return { wound: 0, rounds: 0 };
        }

        const wound = options.raw ? amount : this.reduceDamage(amount, options);
        if (wound <= 0) return { wound: 0, rounds: 0 };

        // Core p.79: Stun only ever drains END, and the excess becomes rounds of incapacitation.
        if (options.stun) {
            const key = this.stunLink;
            const c = this.characteristics[key];
            const taken = Math.min(wound, c.value);
            if (taken > 0) {
                await this.parent.update({
                    system: { stun: this.stun + taken, characteristics: { [key]: { damage: c.damage + taken } } }
                });
            }
            return { wound: taken, rounds: wound - taken };
        }

        const data = this.#wounded(wound, options.overflow);
        if (!foundry.utils.isEmpty(data)) await this.parent.update({ system: { characteristics: data } });
        return { wound, rounds: 0 };
    }

    /**
     * Which reading of an attack this actor's traits select.
     * @returns {string}   `full` · `reduced` · `minimum` · `immune`
     */
    damageTransform(damageType = []) {
        const response = this.damageResponse;
        const excepted = Array.from(damageType ?? []).some(type => response.exceptions.includes(type));
        return excepted ? "full" : response.transform;
    }

    /**
     * Stages 2, 4 and 5 of the pipeline: scale, Protection, then the floor an Effect 6+ attack
     * cannot fall below.
     */
    reduceDamage(amount, options = {}) {
        // Companion p.93: an immune defender is not a reduction the Effect-6 floor can beat — the
        // attack does not land at all — so this short-circuits every stage below.
        if (this.damageTransform(options.damageType) === "immune") return 0;

        // Core p.167: the ratio applies to the damage total, after Effect and Destructive and
        // before the armour deduction.
        const weaponScale = options.scale ?? this.scale;
        const from = MGT2.Scales[weaponScale]?.ratio ?? 1;
        const to = MGT2.Scales[this.scale]?.ratio ?? 1;
        let wound = (from === to) ? amount : Math.floor(amount * from / to);

        // FC p.7: Lo-Pen X multiplies the Protection met. There is no Lo-Pen 1, so below 2 is no trait.
        const loPen = Math.max(1, options.loPen ?? 1);
        // Core p.79: a Spacecraft target ignores AP unless the firing weapon is Spacecraft too.
        const pierced = (this.scale === "spacecraft") && (weaponScale !== "spacecraft")
            ? 0 : Math.max(0, options.ap ?? 0);

        // Core p.77: Protection is subtracted; the AP trait ignores that much of it.
        wound -= Math.max(0, this.protectionAgainst(options) * loPen - pierced);

        // HG p.29: a bay, barbette or spinal mount multiplies AFTER the armour deduction, so it
        // cannot be folded into the attack's dice.
        const multiple = Math.max(1, options.multiple ?? 1);
        if (wound > 0) wound *= multiple;

        // Core p.77: an attack with Effect 6+ always inflicts at least one point.
        return Math.max((options.effect ?? 0) >= 6 ? 1 : 0, wound);
    }

    /**
     * Core folio 229: activating a power spends PSI, and any excess below zero "are applied as
     * damage".
     * @returns {Promise<{points: number, spent: number, damage: number, left: number}|null>}
     */
    async spendPsi(points) {
        const psi = this.characteristics.psionic;
        const total = Math.max(0, Math.trunc(points) || 0);
        if (!psi || (total === 0)) return null;

        // Every figure is read before the first write: an update re-prepares the model in place.
        const spent = Math.min(total, psi.value);
        const result = { points: total, spent, damage: total - spent, left: psi.value - spent };
        if (spent > 0) {
            await this.parent.update({ "system.characteristics.psionic.damage": psi.damage + spent });
        }
        // Through the parent, not `this`: an update replaces `actor.system` with a fresh instance.
        if (result.damage > 0) await this.parent.system.applyDamage(result.damage, { raw: true });
        return result;
    }

    /** Put the hazards an attack carried onto whoever it hit. */
    async applyHazards(entries, sourceName) {
        const items = hazardTraits(entries).map(entry => buildHazardItem(entry, sourceName));
        if (items.length === 0) return [];
        return this.parent.createEmbeddedDocuments("Item", items);
    }

    /**
     * Core folio 228: one point an hour, "beginning three hours after the Traveller last used a
     * psionic talent" — the delay pushes the rate rather than granting the first point, so the
     * first lands on the fourth hour.
     */
    static psiRecovered(hours) {
        return Math.max(0, (Math.trunc(hours) || 0) - PSI_RECOVERY_DELAY);
    }

    /**
     * Give the reserve back what those hours are worth.
     * @returns {Promise<{recovered: number, left: number}|null>}   Null when nothing was spent
     */
    async restPsi(hours) {
        const psi = this.characteristics.psionic;
        if ( !psi || (psi.damage <= 0) ) return null;
        const recovered = Math.min(psi.damage, ActorBaseData.psiRecovered(hours));
        if ( recovered > 0 ) {
            await this.parent.update({ "system.characteristics.psionic.damage": psi.damage - recovered });
        }
        return { recovered, left: psi.value + recovered };
    }

    /** Core p.79: an hour of rest heals exactly the stun sub-track and zeroes it. */
    async restHour() {
        if (this.stun <= 0) return;
        // Straight off the stun link rather than through the heal path, which walks the chain
        // backwards and would hand back a lethal wound taken after the stunning.
        const key = this.stunLink;
        const c = this.characteristics[key];
        const healed = Math.min(this.stun, c?.damage ?? 0);
        const characteristics = healed > 0 ? { [key]: { damage: c.damage - healed } } : {};
        return this.parent.update({ system: { stun: 0, characteristics } });
    }

    /**
     * Core p.82 divides first aid and surgery "as desired", so the split is an input and never a
     * policy.
     * @returns {Promise<number>}   Points actually restored
     */
    async applyHeal(distribution, extra = {}) {
        const characteristics = {};
        let healed = 0;
        for (const [key, points] of Object.entries(distribution ?? {})) {
            const c = this.characteristics[key];
            const taken = Math.min(Math.max(0, Math.trunc(points) || 0), c?.damage ?? 0);
            if (taken <= 0) continue;
            characteristics[key] = { damage: c.damage - taken };
            healed += taken;
        }
        if ((healed === 0) && foundry.utils.isEmpty(extra)) return 0;
        await this.parent.update({ system: { ...extra, characteristics } });
        return healed;
    }

    /** Core p.83: medical care divides its points evenly among the damaged characteristics. */
    spreadEvenly(points) {
        const distribution = {};
        let pool = Math.max(0, Math.trunc(points) || 0);
        let keys = this.damagedLinks;
        while ((pool > 0) && (keys.length > 0)) {
            const share = Math.max(1, Math.floor(pool / keys.length));
            const next = [];
            for (const key of keys) {
                const room = this.characteristics[key].damage - (distribution[key] ?? 0);
                const taken = Math.min(share, room, pool);
                distribution[key] = (distribution[key] ?? 0) + taken;
                pool -= taken;
                if (room > taken) next.push(key);
            }
            keys = next;
        }
        return distribution;
    }

    /** Chain order, each link filled to its own wound: what "as desired" opens on. */
    fillInOrder(points) {
        const distribution = {};
        let pool = Math.max(0, Math.trunc(points) || 0);
        for (const key of this.damagedLinks) {
            if (pool <= 0) break;
            const taken = Math.min(this.characteristics[key].damage, pool);
            distribution[key] = taken;
            pool -= taken;
        }
        return distribution;
    }

    /** Core p.83: each mental characteristic recovers one point per day, never out of the wound. */
    async healMental() {
        const characteristics = {};
        for (const key of this.constructor.MENTAL_LINKS) {
            const c = this.characteristics[key];
            if (c?.damage > 0) characteristics[key] = { damage: c.damage - 1 };
        }
        const keys = Object.keys(characteristics);
        if (keys.length > 0) await this.parent.update({ system: { characteristics } });
        return keys;
    }

    /** Fill each link up to its own maximum; the last one takes the remainder, uncapped. */
    #wounded(amount, overflow) {
        const chain = this.damageChain;
        // The target's choice only moves a link forward — the chain still says which links exist.
        const order = (overflow && chain.indexOf(overflow) > 0)
            ? [chain[0], overflow, ...chain.slice(1).filter(key => key !== overflow)]
            : chain;

        const data = {};
        let remaining = amount;
        for (const [index, key] of order.entries()) {
            const c = this.characteristics[key];
            const room = (index === order.length - 1) ? remaining : Math.max(0, c.max - c.damage);
            const taken = Math.min(room, remaining);
            if (taken > 0) data[key] = { damage: c.damage + taken };
            remaining -= taken;
            if (remaining <= 0) break;
        }
        return data;
    }

    #healed(amount) {
        const data = {};
        let remaining = amount;
        for (const key of [...this.damageChain].reverse()) {
            const c = this.characteristics[key];
            const healed = Math.min(c.damage, remaining);
            if (healed > 0) data[key] = { damage: c.damage - healed };
            remaining -= healed;
            if (remaining <= 0) break;
        }
        return data;
    }

    static getModifier(value) {
        if (isNaN(value) || value <= 0) return DM_LADDER[0];
        return DM_LADDER[value] ?? 3;
    }
}
