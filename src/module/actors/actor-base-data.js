import { MGT2 } from "../config.js";
import { MGT2Helper } from "../helper.js";
import { buildHazardItem, buildTraitMap, createTraitsField, hazardTraits, resolveDamageResponse } from "../traits.js";

const fields = foundry.data.fields;

// DM ladder indexed by characteristic value; 15+ is off the end of the table.
const DM_LADDER = [-3, -2, -2, -1, -1, -1, 0, 0, 0, 1, 1, 1, 2, 2, 2];

// Core folio 228: the reserve stands still for three hours after the last talent, and only then
// starts coming back at a point an hour.
const PSI_RECOVERY_DELAY = 3;

// The only Active-Effect sink for a standing check DM; `region-behaviors.js` is what writes it.
const CHECK_EFFECT_PATH = "system.modifiers.check.effect";

// One warning per sub-type and key: the chain is walked on every prepare.
const warnedLinks = new Set();

/**
 * A characteristic stores its score and its wound; the other four numbers derive. Three traps:
 * `auto` and `effect` carry no `min`, because DataField#applyChange reverts an out-of-range Active
 * Effect rather than clamping it; `max` and `value` stay declared despite being overwritten on
 * every prepare, because TokenDocument#getBarAttribute only offers an editable bar when
 * `<path>.value` resolves to a NumberField; and `effect` is declared at all so that an Active
 * Effect aimed at it is coerced and validated instead of written raw.
 *
 * The two derived keys are `required: false` because a partial clean skips a key absent from the
 * payload instead of applying its `initial`, and the next full validation would then reject it as
 * undefined — which is what re-initialising an unlinked token's synthetic actor does.
 */
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

/* -------------------------------------------- */

/**
 * The identity block of a sub-type that is somebody rather than something. A mixin merged into
 * `defineSchema`'s result rather than a level of inheritance: `character` and `npc` both want it,
 * `spacecraft` does not, and the hierarchy is already spoken for by the damage model.
 */
export function withPersonal() {
    return {
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
            homeworld: new fields.StringField({ required: false, blank: true, trim: true })
        })
    };
}

/* -------------------------------------------- */

/**
 * A modifier accumulator: three provenances and their total. One derived integer cannot tell an
 * Active Effect, a computed bonus and the referee's own entry apart, so a recompute would either
 * clobber the manual entry or have no way to zero only its own contribution. `custom` is the only
 * one stored; `effect` is declared so an Active Effect aimed at it is coerced rather than written
 * raw, and none of the four carries `min` or `max` because applyChange reverts instead of clamping.
 */
function createModifierField() {
    return new fields.SchemaField({
        custom: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        auto: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        effect: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
        dm: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 })
    });
}

/* -------------------------------------------- */

/**
 * What every Actor sub-type shares: a damage pool drained along an ordered chain of
 * characteristics, and the DM ladder that reads them. Abstract — never registered in
 * `CONFIG.Actor.dataModels`. `characteristics` and `states` are subclass-supplied because their
 * keys differ per sub-type: a Traveller has twelve characteristics, a creature has `hits`.
 *
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ActorBaseData extends foundry.abstract.TypeDataModel {

    /** The chain a new actor of this sub-type starts with. */
    static DEFAULT_DAMAGE_ORDER = [];

    /** Which characteristic a new actor rolls Initiative off; blank hands it to `initiative.flat`. */
    static DEFAULT_INITIATIVE = "";

    /** The characteristics whose current values set the encumbrance cap (Core p.98). */
    static ENCUMBRANCE_LINKS = ["strength", "endurance"];

    /**
     * Core p.79 names END as the only characteristic Stun damage reaches. A sub-type that has no
     * such characteristic leaves this blank and stuns the first link of its chain instead.
     */
    static STUN_LINK = "";

    /**
     * Core p.83: the characteristics that recover a point a day on their own track, outside the
     * physical wound. Empty on a sub-type that has none.
     */
    static MENTAL_LINKS = [];

    /**
     * The scale a sub-type is at before any trait speaks — `spacecraft` overrides this permanently,
     * because a ship's scale is what it is and not something it acquired (Core p.167).
     */
    static SCALE = "ground";

    static defineSchema() {
        const damageOrder = [...this.DEFAULT_DAMAGE_ORDER];
        return {
            // Summed over the chain on every prepare, so the stored numbers are never read; it
            // stays declared for the token-bar reason above.
            life: new fields.SchemaField({
                value: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
                max: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
                damage: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true })
            }),
            // The part of the wound dealt by Stun weapons, clamped to `life.damage` on every
            // prepare: an hour of rest clears exactly this much (Core p.79).
            stun: new fields.NumberField({ required: false, nullable: false, initial: 0, min: 0, integer: true }),
            notes: new fields.HTMLField({ required: false, blank: true, trim: true }),

            // Every Actor sub-type carries traits, and a Traveller's come from their species — so
            // that is the vocabulary a new entry starts in. The stored `family` decides the rest.
            traits: createTraitsField("species"),

            modifiers: new fields.SchemaField({
                check: createModifierField(),
                // Core p.74 makes Initiative the Effect of a DEX or INT check, so a species printed
                // `Initiative -2` has no sink in either accumulator beside it: `check` would hit
                // every check that species ever makes, and a skill slug is not what it is keyed on.
                initiative: createModifierField(),
                // Keyed by the slug of a free-text skill Item's name; `validateKey` drops a typo
                // instead of quietly creating a modifier nothing will ever read.
                skills: new fields.TypedObjectField(createModifierField(),
                    { initial: {}, validateKey: MGT2Helper.isSkillSlug })
            }),

            config: new fields.SchemaField({
                // Ordered, no duplicates: damage fills each link before moving to the next.
                damageOrder: new fields.ArrayField(
                    new fields.StringField({ required: true, blank: false }),
                    { initial: damageOrder }),
                // A creature has no DEX and Fast Metabolism (+X) hands it the DM directly (Core
                // p.85), so the source is either a characteristic or a flat number: `flat` is read
                // whenever `characteristic` is blank. A vehicle, a ship and a robot need the same.
                initiative: new fields.SchemaField({
                    characteristic: new fields.StringField({
                        required: false, blank: true, initial: this.DEFAULT_INITIATIVE }),
                    flat: new fields.NumberField({
                        required: false, nullable: false, integer: true, initial: 0 })
                })
            })
        };
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /** The roster, off the schema — a config dictionary only ever describes one sub-type's. */
    get characteristicKeys() {
        return Object.keys(this.schema.fields.characteristics?.fields ?? {});
    }

    /**
     * Which of them a check may be *rolled on*, which is not the same question as which the sheet
     * shows. A damage pool is the difference: `hull` and `hits` run the DM ladder like every other
     * characteristic, so the prompt was offering "Hull — 240 (+3)" as though a ship had a score.
     * @type {string[]}
     */
    get rollableCharacteristics() {
        return this.characteristicKeys.filter(key =>
            this.characteristics[key].show && !(key in MGT2.DamageTracks));
    }

    /**
     * The damage chain, less any link this sub-type does not declare. A chain outlives the schema
     * it was written against, and an unguarded sum would give NaN and a blank token bar.
     * @type {string[]}
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
     * The Protection this particular attack meets. One number for a person, who is armoured all
     * round; a vehicle answers with the facing the attack came from (Core p.140), and a critical
     * meets none at all.
     *
     * `ignoreArmour` is the one spelling for every rule that says an attack meets no Protection —
     * Core p.140 and p.169's critical, RH folio 106's ion hit, and Core folio 78's grapple damage,
     * which "ignores any armour". It is not `raw`: the rest of the pipeline still runs, so scale, the
     * mount's multiple and a defender's damage-type immunity all still decide the wound.
     * @param {object} [options]   `applyDamage`'s options — `facing`, `ignoreArmour`
     * @returns {number}
     */
    protectionAgainst(options = {}) {
        return options.ignoreArmour ? 0 : this.protection;
    }

    /**
     * The hardest difficulty this actor may attempt, and which checks the limit reaches. Only a
     * robot's brain grade states one (RH folio 115); everything else answers null and the roll
     * prompt renders no ceiling caption at all.
     * @type {{key: string, target: number, grade: string, characteristics: string[]}|null}
     */
    get taskCeiling() {
        return null;
    }

    /** The vocabulary a new trait typed on this actor starts in. */
    get traitFamily() {
        return this.schema.fields.traits.element.fields.family.initial;
    }

    /**
     * Core folio 100: an armour's Rad score "is deducted from the rads a Traveller receives every
     * time they are exposed to radiation". Summed like Protection is, for the layered case the same
     * page allows. Here rather than on `CharacterData` because `ChatHelper.resolveExposure` is one
     * notion of a dose arriving for every sub-type that answers `applyRadiation` — a robot's ladder
     * is RH folio 106's rather than folio 81's, but the shielding it comes off is the same field.
     * @type {number}
     */
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
     * Core p.77: unconscious once a characteristic *past* the first has been emptied — the chain
     * puts END first, so the first zero is the one the rule does not count — and dead once the whole
     * chain is at zero. Stated against the chain rather than against STR/DEX/END so that a
     * single-link pool gets the same machinery.
     * @type {{unconscious: boolean, dead: boolean}}
     */
    get damageStates() {
        return this.damageStatesFor(this.characteristics);
    }

    /**
     * The same rule read against a projection instead of the stored wound, so the damage dialog can
     * state what a hit would cause before writing it. A sub-type with its own thresholds — a
     * creature is driven off at half its Hits, Core p.85 — overrides **this**, never the getter.
     * @param {object} characteristics   The model's own shape: `{max, damage, value}` per key
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

    /**
     * Which of `damageStates` the damage dialog names, and the word this type uses for each. Not
     * every state belongs on it: a robot's `inoperable` is a radiation count and no wound moves it.
     * The dialog draws the intersection with the states actually computed, so a roster naming one
     * the rule did not produce costs nothing.
     * @type {Record<string, string>}
     */
    get damageStateLabels() {
        return { unconscious: "MGT2.Actor.Unconscious", dead: "MGT2.Actor.Dead" };
    }

    /**
     * The points `amount` would push past the first link while more than one link could still take
     * them — the moment Core folio 77 hands the choice to the target. Only the sheet's own damage
     * control asks it there; an attack takes the same choice off the stored chain, pre-declared.
     * Null whenever the chain cannot pose the question: a single link, damage that stops inside the
     * first, or only one link left with room.
     * @returns {{filled: string, taken: number, remaining: number, choices: string[]}|null}
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

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /** Both sinks are filled by derivations and by Active Effects, never by the stored document. */
    prepareBaseData() {
        for (const c of Object.values(this.characteristics)) {
            c.auto = 0;
            c.effect = 0;
        }
        this.#declareSkillModifiers();
        for (const modifier of this.modifierAccumulators) {
            modifier.auto = 0;
            modifier.effect = 0;
        }
    }

    /**
     * One accumulator per skill the actor carries. `modifiers.skills` starts empty and nothing else
     * writes a key, so an Active Effect aimed at `modifiers.skills.<slug>.effect` would add to
     * `undefined`: `applyChange` cleans that to NaN, fails validation and reverts to the pre-effect
     * value (`common/data/fields.mjs:719-729`), leaving a console warning and no modifier. Declaring
     * the key in the prepared object is what makes the sink targetable at all.
     */
    #declareSkillModifiers() {
        for (const item of this.parent?.items ?? []) {
            if ((item.type !== "talent") || (item.system.subType !== "skill")) continue;
            const slug = MGT2Helper.skillSlug(item.name);
            if (!slug || (slug in this.modifiers.skills)) continue;
            this.modifiers.skills[slug] = { custom: 0, auto: 0, effect: 0, dm: 0 };
        }
    }

    /**
     * Total each accumulator. This runs here and not in a sheet's context preparation, because a
     * macro, a chat card or another actor's code reads the same number with no sheet rendered. A
     * sub-type calls it again once its own `auto` contributions have landed — it assigns rather
     * than adds, so running it twice costs nothing.
     */
    sumModifiers() {
        for (const modifier of this.modifierAccumulators) {
            modifier.dm = modifier.custom + modifier.auto + modifier.effect;
        }
    }

    /**
     * The last chance to add to `auto` before `max` reads it. Anything derived from an embedded
     * document lands here rather than in `prepareBaseData`, which runs before the items exist —
     * a species modifier and the permanent-loss log are both of that kind.
     * @protected
     */
    prepareCharacteristicAuto() {}

    /** @inheritDoc */
    prepareDerivedData() {
        this.prepareCharacteristicAuto();
        for (const c of Object.values(this.characteristics)) {
            c.max = Math.max(0, c.base + c.auto + c.effect);
            c.value = Math.max(0, c.max - c.damage);
            // Meaningless on a pure damage track such as `hits` or `hull`, but one array lookup is
            // cheaper than a per-sub-type branch here and everywhere the chain is walked.
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

        // Nothing may report more stun than there is wound to explain it, and a heal that emptied
        // the pool has therefore already healed the stun (Core p.79).
        this.stun = Math.min(this.stun, life.damage);
        // Companion p.94: a Gigantic creature "is treated as a Spacecraft scale object … for
        // purposes of dealing and sustaining damage". Scale is what makes a Traveller shooting a
        // starship divide by ten with no branch anywhere (Core p.167).
        this.scale = MGT2Helper.hasTrait(this.traits, "gigantic")
            ? "spacecraft" : this.constructor.SCALE;
        // Companion p.93-94: which reading of an attack lands is the defender's own property, and
        // the card that offers all three is picked on by whoever is applying it.
        this.damageResponse = resolveDamageResponse(key => MGT2Helper.hasTrait(this.traits, key));

        const states = this.damageStates;
        // Core p.83: an END check restores consciousness without healing anything, so the chain
        // alone cannot answer. `consciousWound` is the wound the check was passed at — healing keeps
        // them on their feet, and one fresh point puts them back down.
        if (states.unconscious && (life.damage <= (this.states?.consciousWound ?? -1))) {
            states.unconscious = false;
        }
        Object.assign(this.states ??= {}, states);

        // Before the initiative below, which is the first derivation here to read a `dm`: `dm` is
        // stored, so totalling after the read leaves it a prepare behind — 0 on the first, the
        // previous total after every change, and settling to the right answer on its own (§9.94).
        // Summing assigns, so a sub-type running it again once its own `auto` has landed costs
        // nothing.
        this.sumModifiers();
        const initiative = this.config.initiative;
        this.initiative = (this.characteristics[initiative.characteristic]?.dm ?? initiative.flat ?? 0)
            + this.modifiers.initiative.dm;
        this.traitMap = buildTraitMap(this.traits);
    }

    /* -------------------------------------------- */
    /*  Inventory                                   */
    /* -------------------------------------------- */

    /**
     * Protection: what is worn, plus what a trait grants. `Armour (+X)` gives its bearer "a
     * Protection score equal to the figure shown" (Core p.84) — the same quantity worn armour
     * already derives, so the two sum. The registry's second `armour` slot is a *conditional*
     * score and is surfaced beside the total, never added to it.
     *
     * The trait half stays a derivation and does not become an Active Effect: a trait never
     * expires, never suspends and never stacks with itself, which is the same argument §1.2 makes
     * for the species modifier. `inventory.armor` remains a `final`-phase target for anything that
     * genuinely does start and stop.
     */
    prepareArmor() {
        let armor = MGT2Helper.traitScore(this.traits, "armour");
        for (const item of this.parent.items) {
            if ((item.type === "armor") && (item.system.equipped === true) && !isNaN(item.system.protection)) {
                armor += (+item.system.protection || 0);
            }
            // Core p.107: subdermal armour "stacks with other protection", so an augment adds here
            // rather than competing with a worn suit — and `equipped` is the fitted gate, not a
            // worn one (§9.84).
            if ((item.type === "equipment") && (item.system.subType === "augment")
                && (item.system.equipped === true)) {
                armor += (+item.system.augment?.protection || 0);
            }
        }
        this.inventory.armor = armor;
    }

    /**
     * Mass of one item, quantity included. The rule lives on the item: a loose container has to
     * answer the same question with no actor in reach.
     */
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
        const normal = this.constructor.ENCUMBRANCE_LINKS
            .reduce((sum, key) => sum + (this.characteristics[key]?.value ?? 0), this.encumbranceSkillBonus);
        this.inventory.encumbrance = { normal, heavy: normal * 2 };
        this.states.encumbrance = this.inventory.weight > normal;
    }

    /** Total levels of skills flagged as reducing encumbrance. */
    get encumbranceSkillBonus() {
        return this.parent.items
            .filter(i => i.type === "talent" && i.system.subType === "skill" && i.system.skill.reduceEncumbrance === true)
            .reduce((sum, i) => sum + i.system.level, 0);
    }

    /* -------------------------------------------- */
    /*  Check modifiers                             */
    /* -------------------------------------------- */

    /**
     * The states that stand on a check whatever it is of, in the order the prompt lists them. A
     * sub-type that does not declare one never sets it and so contributes no source — `npc` has no
     * `nausea`, because nothing on it takes a radiation dose.
     */
    static CHECK_STATES = Object.freeze([
        // Core folio 80: a fatigued Traveller "suffers DM-2 to all checks until they rest" — all of
        // them, which is why this one names no characteristic.
        { state: "fatigue", key: "fatigue", label: "MGT2.Actor.Fatigue", dm: -2 },
        // Core folio 81's Nausea, the same shape and the same reason.
        { state: "nausea", key: "nausea", label: "MGT2.Radiation.Nausea", dm: -1 },
        // Core folio 98 is narrower: the second encumbrance band is "DM-2 on all physical actions".
        // No skill in this system is flagged physical and no book prints such a flag — but folio 9
        // heads STR, DEX and END the physical characteristics, so the check's own characteristic is
        // the printed answer. The prompt follows it and the player can still overrule.
        { state: "encumbrance", key: "encumbrance", label: "MGT2.Actor.Encumbrance", dm: -2,
            characteristics: MGT2.PhysicalCharacteristics }
    ]);

    /**
     * The standing DMs a check carries before anything situational. Each stays named beside the
     * accumulator it feeds: the roll prompt prints them and lets the player waive one, which an
     * anonymous `auto` total could not support.
     *
     * `auto` is **assigned** from the list rather than incremented, because the list is the whole of
     * it. The prompt reads `sources` and never `auto`, so a DM in one and not the other is a modifier
     * nobody can see or waive — assigning is what keeps the two from drifting apart.
     *
     * Runs after `prepareEncumbrance`, whose state is one of the sources.
     * @param {object[]} [extra]   The sub-type's own sources, appended after the shared ones
     * @protected
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
     * Core p.100: armour with a required skill costs DM-1 to every check per level the wearer is
     * short, and the flat DM-3 unskilled penalty to a wearer who has no such skill at all.
     *
     * Jack-of-All-Trades does NOT reduce that -3 (§9.58). Folio 100 names "the usual DM-3 unskilled
     * penalty" as a magnitude, not as the same penalty: folio 59's applies to checks OF that skill,
     * this one to EVERY check made while the suit is worn. Letting folio 69 cancel it would also
     * invert the rule, since no skill at all plus JoT 3 would beat Skill-0 plus JoT 3.
     * @protected
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
     * Core p.107: a skill augmentation gives DM+1 "when using that specific skill". The printed
     * table names no skill because the augment is bought FOR one, so the buyer names it (§9.84) —
     * which makes this the first source in the system scoped to a *skill* rather than to a
     * characteristic roster.
     *
     * Two gates the table does not show and the same paragraph does. The wearer "must initially
     * possess that skill at least at level 0 to benefit", which is exactly `skillLevel` answering
     * null; and "a Traveller can only have one skill augmentation", which no schema can enforce
     * because it cannot count siblings — so every one is offered and `augmentIssues` flags the
     * extras, the shape `MGT2Combat#dutyIssues` already uses.
     * @protected
     */
    augmentSkillModifiers() {
        const sources = [];
        for (const item of this.parent.items) {
            if (!ActorBaseData.#isFittedAugment(item)) continue;
            const named = item.system.augment.skill?.name?.trim();
            const dm = Math.trunc(item.system.augment.skill?.value) || 0;
            // The augment does nothing for a skill the Traveller does not have at all.
            if (!named || (dm === 0) || (this.skillLevel(named) === null)) continue;

            // The prompt's skill select is keyed by Item id, so the name is resolved to ids here,
            // where the items are in reach and `matchesSkill` already settles the speciality form.
            const skills = this.parent.items.filter(skill => (skill.type === "talent")
                && (skill.system.subType === "skill")
                && MGT2Helper.matchesSkill(skill.name, named)).map(skill => skill.id);
            // Hyphenated, never dotted: the prompt names a form control after this key.
            sources.push({ key: `augment-${item.id}`, label: "MGT2.Actor.AugmentSkill", dm,
                params: { augment: item.name, skill: named }, skills });
        }
        return sources;
    }

    /** Fitted, not carried: Core p.106 improves nobody through a bag (§9.84). */
    static #isFittedAugment(item) {
        return (item.type === "equipment") && (item.system.subType === "augment")
            && (item.system.equipped === true);
    }

    /**
     * Core p.107 allows a Traveller **one** skill augmentation. The one fitted first holds it
     * legitimately, so only the ones after it are flagged — and none is suppressed, because a
     * referee who fitted two meant something by it and the prompt lets either be waived.
     * @type {{skillDuplicates: string[], any: boolean}}
     */
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

    /**
     * Core p.80-81: a low-gravity band is DM−1 to the *physical* checks alone. `modifiers.check`
     * is the only accumulator an Active Effect can reach and it stands on every check, so an effect
     * that recorded the narrower scope has its share moved out of that sink and re-offered as a
     * named source carrying the roster encumbrance already scopes by — which is what lets the prompt
     * follow the characteristic instead of standing on INT and EDU too. The standing total does not
     * move: what leaves `effect` arrives in `auto`.
     * @protected
     */
    scopedEffectModifiers() {
        const sources = [];
        for (const effect of this.parent.allApplicableEffects()) {
            if (!effect.active || (effect.flags?.mgt2?.region?.physicalOnly !== true)) continue;
            // Only an additive change can be attributed: an override says what the sink IS, and no
            // share of it belongs to this effect alone.
            const dm = (effect.system.changes ?? []).reduce((sum, change) =>
                ((change.key === CHECK_EFFECT_PATH) && (change.type === "add"))
                    ? sum + (Number(change.value) || 0) : sum, 0);
            if (dm === 0) continue;

            this.modifiers.check.effect -= dm;
            // The effect's own name, which is already a localised string rather than a key — and
            // hyphenated, never dotted: the prompt names a form control after this key.
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

    /* -------------------------------------------- */
    /*  Rules                                       */
    /* -------------------------------------------- */

    /**
     * Take a wound through the pipeline and write it. A negative amount heals instead, walking the
     * chain backwards so the link injured last is repaired first.
     *
     * `options` is what the attack knew and the target resolves, and every key is optional so that
     * a macro, a token-bar drag or a bare `applyDamage(3)` still works:
     * `scale` the attacker's scale, `ap` and `loPen` the weapon's scores, `effect` the attack's Effect,
     * `damageType` the printed types the defender's traits may except, `stun` whether it came from
     * a Stun weapon, `formula` the expression it was rolled from — which is how a target that cares
     * how heavy the weapon was counts its dice — `raw` to skip the pipeline entirely (the sheet's
     * own damage control, which types a wound rather than an attack), and `overflow` naming the
     * link the *target* chooses for what the first link cannot hold. **With no `overflow` the
     * stored chain order stands, and that is the answer rather than a gap**: Core folio 77 gives the
     * target the choice of whether the excess past 0 END falls on STR or DEX, and `config.damageOrder`
     * is where that target declared it — once, on their own sheet, instead of at every blow, so a
     * card applied to six targets never stops to ask six times. `overflow` stays for the sheet's
     * own control, which is where the choice can still be made in the moment.
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

        // Core p.79: Stun damage is only ever deducted from END, and the excess becomes rounds of
        // incapacitation rather than injury elsewhere.
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
     * Which reading of an attack this actor's own traits select. A damage type its traits except
     * gets through in full whatever else they say (Companion p.93-94).
     * @param {Iterable<string>} [damageType]   The attack's damage types, usually none
     * @returns {string}   `full` · `reduced` · `minimum` · `immune`
     */
    damageTransform(damageType = []) {
        const response = this.damageResponse;
        const excepted = Array.from(damageType ?? []).some(type => response.exceptions.includes(type));
        return excepted ? "full" : response.transform;
    }

    /**
     * Stages 2, 4 and 5 of the pipeline: scale, then Protection, then the floor an Effect 6+ attack
     * cannot fall below. Stage 3 — the defender's damage-type transform — is chosen on the chat
     * card, because it substitutes into the damage expression and so has already been rolled.
     */
    reduceDamage(amount, options = {}) {
        // Companion p.93: "Energy creatures are not affected by conventional weapons" is not a
        // reduction the Effect-6 floor can beat — it says the attack does not land at all — so it
        // short-circuits every stage below, the floor included.
        if (this.damageTransform(options.damageType) === "immune") return 0;

        // Core p.167: Spacecraft scale against Ground multiplies by ten, Ground against Spacecraft
        // divides by ten and rounds down — and the ratio is applied to the damage total, after
        // Effect and Destructive, before the armour deduction of Core p.167.
        const weaponScale = options.scale ?? this.scale;
        const from = MGT2.Scales[weaponScale]?.ratio ?? 1;
        const to = MGT2.Scales[this.scale]?.ratio ?? 1;
        let wound = (from === to) ? amount : Math.floor(amount * from / to);

        // FC p.7: Lo-Pen X multiplies the Protection this attack meets — a Lo-Pen (3) round treats a
        // Protection +5 flak jacket as +15. There is no Lo-Pen 1, so anything below 2 is no trait.
        const loPen = Math.max(1, options.loPen ?? 1);
        // Core p.79: a Spacecraft scale target ignores AP unless the firing weapon is Spacecraft
        // scale too. The registry declares AP and Lo-Pen in conflict, so a weapon carries one.
        const pierced = (this.scale === "spacecraft") && (weaponScale !== "spacecraft")
            ? 0 : Math.max(0, options.ap ?? 0);

        // Core p.77: Protection is subtracted; the AP trait ignores that much of it.
        wound -= Math.max(0, this.protectionAgainst(options) * loPen - pierced);

        // HG p.29: a bay, barbette or spinal mount multiplies what gets through, and the book puts
        // that step AFTER the armour deduction — so it cannot be folded into the attack's dice.
        // Missiles and torpedoes are excluded at the mount and arrive here as 1.
        const multiple = Math.max(1, options.multiple ?? 1);
        if (wound > 0) wound *= multiple;

        // Core p.77: an attack with Effect 6+ always inflicts at least one point, whatever was
        // rolled and whatever the Protection score.
        return Math.max((options.effect ?? 0) >= 6 ? 1 : 0, wound);
    }

    /**
     * Core folio 229: activating a power spends PSI, and "if this cost brings them below zero PSI,
     * then any excess points are applied as damage". The reserve is not in the damage chain — it
     * takes what it can hold as its own wound, and only the overrun reaches `applyDamage`, where the
     * chain, the unconscious threshold and death are waiting for it.
     *
     * Lives here rather than on `CharacterData` because both person-shaped sub-types declare PSI and
     * the overrun is the base model's own pipeline; a sub-type without the characteristic gets null.
     * @param {number} points   What the power costs, reach multiplier already applied
     * @returns {Promise<{points: number, spent: number, damage: number, left: number}|null>}
     */
    async spendPsi(points) {
        const psi = this.characteristics.psionic;
        const total = Math.max(0, Math.trunc(points) || 0);
        if (!psi || (total === 0)) return null;

        // Every figure is read before the first write: an update re-prepares the model in place, so
        // `psi.value` afterwards is the new one.
        const spent = Math.min(total, psi.value);
        const result = { points: total, spent, damage: total - spent, left: psi.value - spent };
        if (spent > 0) {
            await this.parent.update({ "system.characteristics.psionic.damage": psi.damage + spent });
        }
        // Through the parent, not through `this`: an update replaces `actor.system` with a fresh
        // instance and the one running this method is already the previous prepare.
        if (result.damage > 0) await this.parent.system.applyDamage(result.damage, { raw: true });
        return result;
    }

    /**
     * Put the hazards an attack carried onto whoever it hit (§9.4). Template and instance: the
     * Poison or Diseased trait stays on the attacker and this is the `disease` Item the defender
     * now owns. Nothing dedupes — bitten twice is two doses, and each rolls its own resist check.
     * @param {object[]} entries      The attacker's stored traits, hazards or not
     * @param {string} [sourceName]   What carried them, for the Item's name
     * @returns {Promise<Item[]>}
     */
    async applyHazards(entries, sourceName) {
        const items = hazardTraits(entries).map(entry => buildHazardItem(entry, sourceName));
        if (items.length === 0) return [];
        return this.parent.createEmbeddedDocuments("Item", items);
    }

    /**
     * Core folio 228: "Expended PSI points are recovered at the rate of one point per hour,
     * beginning three hours after the Traveller last used a psionic talent." The three hours delay
     * the rate rather than granting the first point, so the first one lands on the fourth hour.
     *
     * The elapsed time is an argument and never a stored timestamp: §9.35 leaves the system no clock
     * to measure one against, so the player counts the hours and the rule turns them into points.
     * @param {number} hours   Hours since the last talent use
     * @returns {number}
     */
    static psiRecovered(hours) {
        return Math.max(0, (Math.trunc(hours) || 0) - PSI_RECOVERY_DELAY);
    }

    /**
     * Give the reserve back what those hours are worth. PSI is in no damage chain and Core p.83 names
     * it the exception to the mental track, so this is the only procedure that reaches it at all.
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

    /**
     * Core p.79: an hour of rest completely heals the damage a Stun weapon dealt — so it subtracts
     * exactly the stun sub-track from the wound and zeroes it.
     */
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

    /* -------------------------------------------- */
    /*  Healing (Core p.82-83)                      */
    /* -------------------------------------------- */

    /**
     * Core p.82 divides first aid and surgery "as desired", so the split is an input here and never
     * a policy; `extra` is written in the same update.
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

    /**
     * Core p.83: medical care divides its points evenly among the damaged characteristics. A link
     * takes no more than its own wound, and what that frees is offered round again; the remainder
     * of an uneven division walks the chain in order.
     */
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

    /* -------------------------------------------- */

    /** Fill each link up to its own maximum; the last one takes the remainder, uncapped. */
    #wounded(amount, overflow) {
        const chain = this.damageChain;
        // The target's choice only moves a link forward — the chain still says which links exist
        // and which one absorbs the overrun.
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

    /* -------------------------------------------- */

    static getModifier(value) {
        if (isNaN(value) || value <= 0) return DM_LADDER[0];
        return DM_LADDER[value] ?? 3;
    }
}
