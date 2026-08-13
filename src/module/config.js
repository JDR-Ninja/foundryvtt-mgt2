import { TRAITS, TRAIT_FAMILIES } from "./traits.js";

export const MGT2 = {};

// The trait registry, reachable as `CONFIG.MGT2.Traits[family][slug]`. `TraitFamilies` is the
// choice vocabulary the stored field validates against and carries one key the registry does not:
// `custom`, for the accessory lists the books give no trait vocabulary at all.
MGT2.Traits = TRAITS;
MGT2.TraitFamilies = TRAIT_FAMILIES;

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

// Target number each difficulty must meet or beat. NA is absent: it has no target.
MGT2.DifficultyTargets = Object.freeze({
    Simple: 2,
    Easy: 4,
    Routine: 6,
    Average: 8,
    Difficult: 10,
    VeryDifficult: 12,
    Formidable: 14,
    Impossible: 16
});

// The eight rungs a check can be SET at — `Difficulty` without `NA`, derived from the targets so the
// two cannot drift. A select carrying an empty first option already says "no difficulty stated", and
// storing NA resolves to the same assumed Average (Core p.61), so offering both is one answer twice.
// `NA` keeps its own uses: a disease states its check on a select with no empty option, and the roll
// prompt's empty ladder cell is named by it.
MGT2.DifficultyChoices = Object.freeze(Object.fromEntries(
    Object.keys(MGT2.DifficultyTargets).map(key => [key, MGT2.Difficulty[key]])));

// Effect Results (Core p.61) — the six bands of `total - target`, the reading the next action
// takes. Success is `effect >= 0`; `tone` is how the chat card colours itself.
// Core p.63. The Effect of the previous check is a DM on the next one. Six rungs, and none of
// them worth zero: a check that resolved at all moves the one it feeds, and the sign flips straight
// from -1 to +1. `EffectBands` below reads the same axis to name a result; this is what it is worth
// to whatever comes next, and "working together" reads off the same rungs.
MGT2.TaskChain = Object.freeze([
    {min: null, max: -6, dm: -3},
    {min: -5, max: -2, dm: -2},
    {min: -1, max: -1, dm: -1},
    {min: 0, max: 0, dm: 1},
    {min: 1, max: 5, dm: 2},
    {min: 6, max: null, dm: 3}
]);

// Core p.76. A Traveller may react as often as they like, and every Reaction costs DM-1 on their
// next set of actions. `dm` is what the REACTOR imposes on the attacker: a flat figure where the
// rule prints one, and otherwise read off the reactor's own sheet — the higher of `characteristic`
// and `skill` for a dodge, the Melee level for a parry. It is announced and never applied, because
// nothing here resolves against a target.
MGT2.CombatReactions = Object.freeze({
    dodge: {label: "MGT2.CombatReactions.dodge", icon: "fa-solid fa-person-running",
        characteristic: "dexterity", skill: "Athletics (dexterity)"},
    dive: {label: "MGT2.CombatReactions.dive", icon: "fa-solid fa-person-falling",
        dm: -2, noCover: -1, forgoes: true},
    parry: {label: "MGT2.CombatReactions.parry", icon: "fa-solid fa-shield-halved",
        skill: "Melee"}
});

// Core p.73. The side that knows combat is coming takes DM+6 on its Initiative check and the side
// that does not takes DM-6, for the first round only — and Initiative is rolled once for the whole
// combat, so that is the roll it rides on.
MGT2.Ambush = Object.freeze({
    aware: {label: "MGT2.Ambush.aware", dm: 6},
    unaware: {label: "MGT2.Ambush.unaware", dm: -6}
});

// Core p.73. One Tactics check moves the Initiative of "everyone on the same side", and nothing
// else in the system knows what a side is. A stored key rather than the token's disposition, which
// is only the DEFAULT it is initialised from: a disposition cannot be corrected without moving a
// token, and SECRET says nothing about allegiance at all (§9.30). Blank is a real answer — a
// combatant on no side takes no side's Effect.
MGT2.CombatSides = Object.freeze({
    allies: "MGT2.CombatSides.allies",
    enemies: "MGT2.CombatSides.enemies",
    neutral: "MGT2.CombatSides.neutral"
});

MGT2.EffectBands = Object.freeze({
    exceptionalFailure: {label: "MGT2.Effect.exceptionalFailure", min: null, max: -6, tone: "bad"},
    averageFailure: {label: "MGT2.Effect.averageFailure", min: -5, max: -2, tone: "bad"},
    marginalFailure: {label: "MGT2.Effect.marginalFailure", min: -1, max: -1, tone: "edge"},
    marginalSuccess: {label: "MGT2.Effect.marginalSuccess", min: 0, max: 0, tone: "edge"},
    averageSuccess: {label: "MGT2.Effect.averageSuccess", min: 1, max: 5, tone: "ok"},
    exceptionalSuccess: {label: "MGT2.Effect.exceptionalSuccess", min: 6, max: null, tone: "ok"}
});

// Core p.76-77. Each band is a multiple of the weapon's own Range score, so one table serves every
// weapon. `out` carries no DM: beyond four times the Range there is no printed penalty because
// there is no shot — and the system displays the band rather than blocking the roll.
MGT2.RangeBands = Object.freeze({
    short: {label: "MGT2.RangeBands.short", dm: 1},
    normal: {label: "MGT2.RangeBands.normal", dm: 0},
    long: {label: "MGT2.RangeBands.long", dm: -2},
    extreme: {label: "MGT2.RangeBands.extreme", dm: -4},
    out: {label: "MGT2.RangeBands.out", dm: 0}
});

// Core p.74, the Common Modifiers to Ranged Attacks table, in the book's own order. The three range
// rows are the p.76 bands above stated a second time, so they share their labels. `max` is the six
// consecutive Minor Actions p.75 caps aiming at, `per` the metres of target movement each -1 costs,
// and `requires` the row a bonus is conditional on.
MGT2.AttackModifiers = Object.freeze({
    aiming: {label: "MGT2.AttackModifiers.aiming", dm: 1, max: 6},
    laserSight: {label: "MGT2.AttackModifiers.laserSight", dm: 1, requires: "aiming"},
    fastMovingTarget: {label: "MGT2.AttackModifiers.fastMovingTarget", dm: -1, per: 10},
    shortRange: {label: "MGT2.RangeBands.short", dm: 1, band: "short"},
    longRange: {label: "MGT2.RangeBands.long", dm: -2, band: "long"},
    extremeRange: {label: "MGT2.RangeBands.extreme", dm: -4, band: "extreme"},
    cover: {label: "MGT2.AttackModifiers.cover", dm: -2},
    prone: {label: "MGT2.AttackModifiers.prone", dm: -1}
});

// Core folio 77: without the Scope trait every attack past 100 metres is Extreme range, and outside
// a combat situation the referee "is free to increase this to 300 metres". `combat` is therefore the
// rule and the prompt's default; the other threshold and the prompt's empty cell are both
// concessions a referee grants.
MGT2.ExtremeRangeThresholds = Object.freeze({
    combat: {label: "MGT2.RollPrompt.ThresholdCombat", metres: 100},
    noStress: {label: "MGT2.RollPrompt.ThresholdNoStress", metres: 300}
});

// Core folio 79. A weapon with Auto X fires in three modes and the mode is a per-attack choice, so
// nothing stores one: single is the normal combat rules, burst adds the Auto score to damage, and
// full auto makes that many attacks — which may fall on separate targets within six metres of one
// another, a constraint on the referee's picks rather than on the roll. `rounds` is the multiple of
// the Auto score a mode spends; single spends what an ordinary shot does and the book restates
// neither that nor any way of tracking it.
MGT2.FireModes = Object.freeze({
    single: {label: "MGT2.FireModes.single"},
    burst: {label: "MGT2.FireModes.burst", damage: true, rounds: 1, suppress: "aiming"},
    fullAuto: {label: "MGT2.FireModes.fullAuto", attacks: true, rounds: 3, suppress: "aiming"}
});

// The printed damage-type vocabulary (Companion p.93-94). Deliberately not a partition: "blades"
// and "stabbing" overlap and no book assigns a type to every weapon, so an empty set is the normal
// case and means a defender's transform applies in full.
MGT2.DamageTypes = Object.freeze({
    blades: "MGT2.DamageTypes.blades",
    fire: "MGT2.DamageTypes.fire",
    stabbing: "MGT2.DamageTypes.stabbing",
    crushing: "MGT2.DamageTypes.crushing",
    impaling: "MGT2.DamageTypes.impaling",
    projectile: "MGT2.DamageTypes.projectile",
    laser: "MGT2.DamageTypes.laser"
});

// Core folio 167's Damage Scale table prints a TO-HIT column beside the damage one: a Ground weapon
// shooting a Spacecraft target takes DM+2 "simply because it is that much larger", a Spacecraft
// weapon shooting a Ground target DM-2, and matched scales nothing. Keyed by the WEAPON's scale,
// because that is the half the prompt already holds — folio 167: "scale is reflected by the weapon
// being used, not what it is mounted upon". The other half is a declared bit, like cover and prone
// on the same row: nothing here reads a target. `vehicle` is absent and resolves to Ground, which is
// the same reduction `Scales` makes for the damage ratio.
MGT2.CrossScaleAttack = Object.freeze({
    ground: {label: "MGT2.RollPrompt.ScaleSpacecraftTarget", dm: 2},
    spacecraft: {label: "MGT2.RollPrompt.ScaleGroundTarget", dm: -2}
});

// Core p.167 — a wound crossing the scale boundary is multiplied or divided by ten. `ratio` is what
// makes that one expression instead of a branch per direction.
MGT2.Scales = Object.freeze({
    ground: {label: "MGT2.Scales.ground", ratio: 1},
    spacecraft: {label: "MGT2.Scales.spacecraft", ratio: 10}
});

// A weapon's own scale. `range` is the unit the range field speaks; `fireControl`, `power` and
// `band` say whether those fields apply at all (VH p.45, HG p.26; Core p.165-167 for the band,
// which only a spacecraft weapon is printed with). The keys are MGT2.Scales', so a weapon's scale
// is directly the pipeline's cross-scale input and `vehicle` — absent there — resolves to ratio 1,
// which is the printed rule: a vehicle weapon is Ground scale.
MGT2.WeaponScales = Object.freeze({
    ground: {label: "MGT2.Scales.ground", range: "meter", fireControl: false, power: false, band: false},
    vehicle: {label: "MGT2.Scales.vehicle", range: "kilometer", fireControl: true, power: false, band: false},
    spacecraft: {label: "MGT2.Scales.spacecraft", range: "kilometer", fireControl: true, power: true, band: true}
});

// The three readings of one attack (Companion p.93). Reduced and Minimum substitute into the damage
// expression, so they are rolled with the attack and can never be derived from its total.
MGT2.DamageTransforms = Object.freeze({
    full: "MGT2.DamageTransforms.full",
    reduced: "MGT2.DamageTransforms.reduced",
    minimum: "MGT2.DamageTransforms.minimum"
});

// Core p.82 drives first aid off the Effect of a Medic check, and a skill is a free-text Item with
// no registry behind it — so these are the names a rolled skill is matched against, case- and
// prefix-insensitively, to decide whether its card offers the first-aid button.
MGT2.FirstAidSkills = Object.freeze(["medic"]);

// Core folio 81, the Radiation Effects table. One row carries both of its columns, because both are
// read off the same thresholds: `damage` and `condition` are what ONE exposure of that size inflicts
// at once, `endurance` what the RUNNING TOTAL costs permanently. That second figure is a total and
// not a step, which is why it derives from the count on every prepare rather than being applied once
// per crossing. Highest band first: the row is the first whose floor the count reaches.
MGT2.RadiationEffects = Object.freeze([
    {min: 801, damage: "8D", condition: "MGT2.Radiation.Bleeding", endurance: -4},
    {min: 501, damage: "6D", condition: "MGT2.Radiation.Sterile", endurance: -3},
    {min: 301, damage: "4D", condition: "MGT2.Radiation.HairLoss", endurance: -2},
    {min: 151, damage: "2D", condition: "", endurance: -1},
    // The one immediate effect that is a number rather than a scene fact, so it is the one the
    // system carries as a state.
    {min: 51, damage: "1D", condition: "MGT2.Radiation.Nausea", state: "nausea", endurance: 0},
    {min: 0, damage: "", condition: "", endurance: 0}
]);

// Core folio 81's Radiation Exposure table, and the weapon trait's dose from folio 79 — "2D x 20
// rads, multiplied by three for Spacecraft scale weapons". The interval each source delivers on is
// part of its printed name and stays a referee's clock: nothing here is scheduled.
MGT2.RadiationSources = Object.freeze({
    minorLeak: {label: "MGT2.Radiation.MinorLeak", formula: "2d6"},
    seriousLeak: {label: "MGT2.Radiation.SeriousLeak", formula: "2d6"},
    minorFlare: {label: "MGT2.Radiation.MinorFlare", formula: "1d6 * 100"},
    majorFlare: {label: "MGT2.Radiation.MajorFlare", formula: "3d6 * 100"},
    weapon: {label: "MGT2.Radiation.Weapon", formula: "2d6 * 20", spacecraft: "2d6 * 60"}
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

// Core folio 80: a disease is resisted by "a series of END checks", one per Interval, and "poisons
// operate in the same way". `wound` is the system's own third sub-type, which the folio does not
// speak of at all — so its check is the referee's.
MGT2.EnduranceResisted = Object.freeze(["disease", "poison"]);

// Core folio 229's Psionic Range table, in the order it prints — which is what makes "one Range
// Band further" a step through these keys. `NA` is the system's own escape for a power that reaches
// nowhere and is not a band.
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

// Core folio 229: "The Reach of a power can be increased by one Range Band if twice the PSI Cost is
// paid and increased by two Range Bands if the PSI Cost is multiplied by four." Three positions and
// nothing beyond — the folio names no third step — so the strip is the whole rule and `cost` is the
// multiple of the printed PSI Cost each one spends.
MGT2.PsionicBoosts = Object.freeze([
    {bands: 0, cost: 1},
    {bands: 1, cost: 2},
    {bands: 2, cost: 4}
]);

// The five recurring-character types (Core p.91).
MGT2.ContactRelations = Object.freeze({
    Allie: "MGT2.Contact.Relation.Allie",
    Contact: "MGT2.Contact.Relation.Contact",
    Rival: "MGT2.Contact.Relation.Rival",
    Enemy: "MGT2.Contact.Relation.Enemy",
    Patron: "MGT2.Contact.Relation.Patron"
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

// Core folio 9 heads STR, DEX and END "PHYSICAL CHARACTERISTICS". That heading is the only
// physical/mental partition the books state, and no skill carries such a flag — so it is what a
// rule written against "physical actions" (folio 98's encumbrance) resolves to: the characteristic
// a check is rolled on.
MGT2.PhysicalCharacteristics = Object.freeze(["strength", "dexterity", "endurance"]);

MGT2.InitiativeCharacteristics = Object.freeze({
    dexterity: "MGT2.Characteristics.dexterity.name",
    intellect: "MGT2.Characteristics.intellect.name"
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

// Eleven bands, 0-10 in declaration order; the number is what the rules do arithmetic on
// (collision damage, Weave, the per-band attack DM). Core p.136.
MGT2.SpeedBands = Object.freeze({
    Stopped: "MGT2.SpeedBands.Stopped",
    Idle: "MGT2.SpeedBands.Idle",
    VerySlow: "MGT2.SpeedBands.VerySlow",
    Slow: "MGT2.SpeedBands.Slow",
    Medium: "MGT2.SpeedBands.Medium",
    High: "MGT2.SpeedBands.High",
    Fast: "MGT2.SpeedBands.Fast",
    VeryFast: "MGT2.SpeedBands.VeryFast",
    Subsonic: "MGT2.SpeedBands.Subsonic",
    Supersonic: "MGT2.SpeedBands.Supersonic",
    Hypersonic: "MGT2.SpeedBands.Hypersonic"
});

MGT2.Durations = Object.freeze({
    Seconds: "MGT2.Durations.Seconds",
    Minutes: "MGT2.Durations.Minutes",
    Heures: "MGT2.Durations.Heures"
});

// Damage pools that are not characteristics. Merged with MGT2.Characteristics only where the
// damage chain editor needs a label; the characteristic roster itself stays the twelve.
MGT2.DamageTracks = Object.freeze({
    hits: "MGT2.DamageTracks.hits",
    hull: "MGT2.DamageTracks.hull"
});

// Animal Size (Core p.89) — advisory only, the size trait is stored and never derived from Hits.
// The top band starts at 126 so no Hits value matches two rows; its label reads as printed.
// `dm` is attacker-side: ranged attacks against the animal gain it.
MGT2.AnimalSize = Object.freeze({
    small4: {label: "MGT2.AnimalSize.small4", min: 1, max: 2, trait: "small", dm: -4, damage: "1"},
    small3: {label: "MGT2.AnimalSize.small3", min: 3, max: 5, trait: "small", dm: -3, damage: "D3"},
    small2: {label: "MGT2.AnimalSize.small2", min: 6, max: 7, trait: "small", dm: -2, damage: "D3"},
    small1: {label: "MGT2.AnimalSize.small1", min: 8, max: 13, trait: "small", dm: -1, damage: "1D"},
    human: {label: "MGT2.AnimalSize.human", min: 14, max: 28, trait: null, dm: 0, damage: "1D"},
    large1: {label: "MGT2.AnimalSize.large1", min: 29, max: 35, trait: "large", dm: 1, damage: "2D"},
    large2: {label: "MGT2.AnimalSize.large2", min: 36, max: 49, trait: "large", dm: 2, damage: "3D"},
    large3: {label: "MGT2.AnimalSize.large3", min: 50, max: 70, trait: "large", dm: 3, damage: "4D"},
    large4: {label: "MGT2.AnimalSize.large4", min: 71, max: 90, trait: "large", dm: 4, damage: "5D"},
    large5: {label: "MGT2.AnimalSize.large5", min: 91, max: 125, trait: "large", dm: 5, damage: "6D"},
    large6: {label: "MGT2.AnimalSize.large6", min: 126, max: null, trait: "large", dm: 6, damage: "7D"}
});

// Fight or Flight (Core p.90). Keyed on the behaviour pattern alone — the published statblocks
// pair diet and pattern freely, so the diet grouping the table prints is not a lookup key.
// `gate` is a scene fact the referee resolves; `altAttack` is the threshold once it holds.
// Pouncer is the one row whose flee cell is conditional too, hence the second token.
MGT2.Reactions = Object.freeze({
    filter: {label: "MGT2.Reactions.filter", flee: 5, attack: 10, gate: null, fleeGate: null, altAttack: null},
    intermittent: {label: "MGT2.Reactions.intermittent", flee: 4, attack: 10, gate: null, fleeGate: null, altAttack: null},
    grazer: {label: "MGT2.Reactions.grazer", flee: 6, attack: 8, gate: null, fleeGate: null, altAttack: null},
    gatherer: {label: "MGT2.Reactions.gatherer", flee: 7, attack: 9, gate: null, fleeGate: null, altAttack: null},
    hunter: {label: "MGT2.Reactions.hunter", flee: 5, attack: 10, gate: "sizeGreater", fleeGate: null, altAttack: 6},
    eater: {label: "MGT2.Reactions.eater", flee: 4, attack: 5, gate: null, fleeGate: null, altAttack: null},
    pouncer: {label: "MGT2.Reactions.pouncer", flee: null, attack: null, gate: "hasSurprise", fleeGate: "surprised", altAttack: null},
    chaser: {label: "MGT2.Reactions.chaser", flee: 5, attack: null, gate: "outnumbers", fleeGate: null, altAttack: null},
    trapper: {label: "MGT2.Reactions.trapper", flee: 5, attack: null, gate: "hasSurprise", fleeGate: null, altAttack: null},
    siren: {label: "MGT2.Reactions.siren", flee: 4, attack: null, gate: "hasSurprise", fleeGate: null, altAttack: null},
    killer: {label: "MGT2.Reactions.killer", flee: 3, attack: 6, gate: null, fleeGate: null, altAttack: null},
    hijacker: {label: "MGT2.Reactions.hijacker", flee: 6, attack: 7, gate: null, fleeGate: null, altAttack: null},
    intimidator: {label: "MGT2.Reactions.intimidator", flee: 7, attack: 8, gate: null, fleeGate: null, altAttack: null},
    carrionEater: {label: "MGT2.Reactions.carrionEater", flee: 7, attack: 11, gate: null, fleeGate: null, altAttack: null},
    reducer: {label: "MGT2.Reactions.reducer", flee: 7, attack: 10, gate: null, fleeGate: null, altAttack: null}
});

// Core p.89. `inexplicable` and `none` are the escape the print needs: the Companion's statblocks
// use both, and neither is one of the four the behaviour chapter groups its patterns under.
MGT2.Diets = Object.freeze({
    herbivore: "MGT2.Diets.herbivore",
    omnivore: "MGT2.Diets.omnivore",
    carnivore: "MGT2.Diets.carnivore",
    scavenger: "MGT2.Diets.scavenger",
    inexplicable: "MGT2.Diets.inexplicable",
    none: "MGT2.Diets.none"
});

// The Experience ladder's own axis (Core p.92); `combatant` is the other, and the pair names a row
// of MGT2.Experience.
MGT2.ExperienceLevels = Object.freeze({
    green: "MGT2.ExperienceLevels.green",
    average: "MGT2.ExperienceLevels.average",
    experienced: "MGT2.ExperienceLevels.experienced",
    elite: "MGT2.ExperienceLevels.elite"
});

MGT2.NpcSubTypes = Object.freeze({
    person: "MGT2.Actor.npc.SubType.person",
    creature: "MGT2.Actor.npc.SubType.creature"
});

// Experience (Core p.92). `characteristicDMs` is the spread the level's characteristics use;
// the table's Skills column is generator guidance and is not carried.
MGT2.Experience = Object.freeze({
    greenNonCombatant: {label: "MGT2.Experience.greenNonCombatant", skillLevel: 0, characteristicDMs: [0], combatant: false},
    greenCombatant: {label: "MGT2.Experience.greenCombatant", skillLevel: 0, characteristicDMs: [0], combatant: true},
    averageNonCombatant: {label: "MGT2.Experience.averageNonCombatant", skillLevel: 1, characteristicDMs: [1], combatant: false},
    averageCombatant: {label: "MGT2.Experience.averageCombatant", skillLevel: 1, characteristicDMs: [1], combatant: true},
    experiencedNonCombatant: {label: "MGT2.Experience.experiencedNonCombatant", skillLevel: 2, characteristicDMs: [1, 2], combatant: false},
    experiencedCombatant: {label: "MGT2.Experience.experiencedCombatant", skillLevel: 2, characteristicDMs: [1, 2], combatant: true},
    eliteNonCombatant: {label: "MGT2.Experience.eliteNonCombatant", skillLevel: 3, characteristicDMs: [1, 2, 3], combatant: false},
    eliteCombatant: {label: "MGT2.Experience.eliteCombatant", skillLevel: 3, characteristicDMs: [1, 2, 3], combatant: true}
});

// Vehicle critical hits (Core p.140-141). Severity = Effect - 5; a repeat on a location takes
// max(new, old + 1), caps at 6, and a further one deals 6D instead. Critical damage ignores
// armour. `roll` is the 2D location result. Cells carry numbers and system names only.
MGT2.VehicleCriticals = Object.freeze({
    fuel: {
        label: "MGT2.VehicleCriticals.fuel", roll: [2, 3],
        severities: [
            {fuel: {dryIn: "2D hours"}},
            {fuel: {dryIn: "1D hours"}},
            {fuel: {dryIn: "1D minutes"}},
            {fuel: {dryIn: "1D rounds"}},
            {fuel: {state: "explodes"}, hullSeverity: 1},
            {fuel: {state: "explodes"}, hullSeverity: "1D"}
        ]
    },
    powerPlant: {
        label: "MGT2.VehicleCriticals.powerPlant", roll: [4, 4],
        severities: [
            {speedBands: -1},
            {speedBands: "D3"},
            {speedBands: "1D"},
            {speedBands: 0},
            {speedBands: 0, hullSeverity: 1},
            {speedBands: 0, hullSeverity: "1D"}
        ]
    },
    weapon: {
        label: "MGT2.VehicleCriticals.weapon", roll: [5, 5],
        severities: [
            {weapons: {n: 1, state: "dm", dm: -2}},
            {weapons: {n: 1, state: "disabled"}},
            {weapons: {n: 1, state: "destroyed"}},
            {weapons: {n: 1, state: "explodes"}, hullSeverity: 1},
            {weapons: {n: 1, state: "explodes"}, hullSeverity: 1},
            {weapons: {n: 1, state: "explodes"}, hullSeverity: 1}
        ]
    },
    armour: {
        label: "MGT2.VehicleCriticals.armour", roll: [6, 6],
        severities: [
            {armour: -1},
            {armour: "-1D"},
            {armour: "-1D"},
            {armour: "-2D"},
            {armour: "-2D", hullSeverity: 1},
            {armour: "-2D", hullSeverity: 1}
        ]
    },
    hull: {
        label: "MGT2.VehicleCriticals.hull", roll: [7, 7],
        severities: [
            {damage: "1D"}, {damage: "2D"}, {damage: "3D"},
            {damage: "4D"}, {damage: "5D"}, {damage: "6D"}
        ]
    },
    cargo: {
        label: "MGT2.VehicleCriticals.cargo", roll: [8, 8],
        severities: [
            {cargo: "10%"},
            {cargo: "1Dx10%"},
            {cargo: "2Dx10%"},
            {cargo: "all"},
            {cargo: "all", hullSeverity: 1},
            {cargo: "all", hullSeverity: 1}
        ]
    },
    occupants: {
        label: "MGT2.VehicleCriticals.occupants", roll: [9, 9],
        severities: [
            {occupants: {n: 1, damage: "1D"}},
            {occupants: {n: 1, damage: "2D"}},
            {occupants: {n: "D3", damage: "2D"}},
            {occupants: {n: "1D", damage: "2D"}},
            {occupants: {n: "1D", damage: "3D"}},
            {occupants: {n: "all", damage: "4D"}}
        ]
    },
    driveSystem: {
        label: "MGT2.VehicleCriticals.driveSystem", roll: [10, 10],
        severities: [
            {controlDM: -1},
            // UNVERIFIED: Core p.141 prints "DM+2" here. The row is a -1/-3/-4 ladder and a
            // critical hit cannot help the target, so -2 is the reading, not the print.
            {controlDM: -2, speedBands: -1},
            {controlDM: -3, speedBands: "D3"},
            {controlDM: -4, speedBands: "1D"},
            {speedBands: 0},
            {speedBands: 0, hullSeverity: 1}
        ]
    },
    systems: {
        label: "MGT2.VehicleCriticals.systems", roll: [11, 12],
        severities: [
            {systemsDM: -2},
            {systemLoss: "1d:comms|sensors|computer"},
            {systemLoss: "1d:comms|sensors|computer"},
            {systemLoss: "1d:comms|sensors|computer"},
            {hullSeverity: 1},
            {hullSeverity: 1}
        ]
    }
});

MGT2.VehicleMounts = Object.freeze({
    fixed: "MGT2.VehicleMounts.fixed",
    pintle: "MGT2.VehicleMounts.pintle",
    ring: "MGT2.VehicleMounts.ring",
    gunPort: "MGT2.VehicleMounts.gunPort",
    bay: "MGT2.VehicleMounts.bay",
    hardPoint: "MGT2.VehicleMounts.hardPoint",
    smallTurret: "MGT2.VehicleMounts.smallTurret",
    largeTurret: "MGT2.VehicleMounts.largeTurret"
});

MGT2.FireArcs = Object.freeze({
    front: "MGT2.FireArcs.front",
    rear: "MGT2.FireArcs.rear",
    left: "MGT2.FireArcs.left",
    right: "MGT2.FireArcs.right",
    turret: "MGT2.FireArcs.turret"
});

// Core folio 138's two vehicular actions that leave a DM behind. Both are the driver's own check
// with the vehicle's Agility as a DM; `opposed` marks the one the folio resolves against another
// driver, and `winner`/`loser` are the split it prints for that round. Manoeuvre, Ram, Stunt and
// Weave are the same folio's other four and are absent on purpose: none of them leaves a standing
// number — a Ram is an attack, a Weave is a DM the driver picks at the moment of rolling.
MGT2.VehicleActions = Object.freeze({
    dogfight: {label: "MGT2.Actor.vehicle.Dogfight", opposed: true, winner: 2, loser: -2},
    evasive: {label: "MGT2.Actor.vehicle.Evasive", opposed: false}
});

// The chassis sets the skill and its speciality (Core p.66, p.68, p.71). Firing a mounted weapon
// is Heavy Weapons (vehicle) instead, and a drone is run with Electronics (remote ops).
MGT2.VehicleSkills = Object.freeze({
    drive: {
        label: "MGT2.VehicleSkills.drive.name",
        specialities: {
            wheel: "MGT2.VehicleSkills.drive.wheel",
            track: "MGT2.VehicleSkills.drive.track",
            walker: "MGT2.VehicleSkills.drive.walker",
            mole: "MGT2.VehicleSkills.drive.mole",
            hovercraft: "MGT2.VehicleSkills.drive.hovercraft"
        }
    },
    flyer: {
        label: "MGT2.VehicleSkills.flyer.name",
        specialities: {
            airship: "MGT2.VehicleSkills.flyer.airship",
            grav: "MGT2.VehicleSkills.flyer.grav",
            ornithopter: "MGT2.VehicleSkills.flyer.ornithopter",
            rotor: "MGT2.VehicleSkills.flyer.rotor",
            wing: "MGT2.VehicleSkills.flyer.wing"
        }
    },
    seafarer: {
        label: "MGT2.VehicleSkills.seafarer.name",
        specialities: {
            oceanShips: "MGT2.VehicleSkills.seafarer.oceanShips",
            personal: "MGT2.VehicleSkills.seafarer.personal",
            sail: "MGT2.VehicleSkills.seafarer.sail",
            submarine: "MGT2.VehicleSkills.seafarer.submarine"
        }
    }
});

// The union of the three skills' specialities, which is what a stored pair validates against; the
// sheet still offers only the chosen skill's own list.
MGT2.VehicleSpecialities = Object.freeze(Object.fromEntries(
    Object.values(MGT2.VehicleSkills).flatMap(skill => Object.entries(skill.specialities))));

// The medium a vehicle is operating in. `agility` is the penalty for operating OUTSIDE the chassis's
// native medium — the printed Agility is the native-medium value (VH p.3, p.14, p.47-48) — so a
// ground vehicle on the ground pays nothing. Rails is never native and always costs 2. Towing is a
// separate flag, because a vehicle tows *while* it is somewhere.
MGT2.OperatingModes = Object.freeze({
    ground: {label: "MGT2.OperatingModes.ground", agility: -1},
    afloat: {label: "MGT2.OperatingModes.afloat", agility: -1},
    flying: {label: "MGT2.OperatingModes.flying", agility: -1},
    rails: {label: "MGT2.OperatingModes.rails", agility: -2}
});

// Which skill puts a vehicle in which medium, so the native one is read off the chassis rather than
// stored twice (Core p.66, p.68, p.71).
MGT2.VehicleNativeModes = Object.freeze({
    drive: "ground",
    flyer: "flying",
    seafarer: "afloat"
});

// Five of the 78 print a service life instead of a distance, because a fission or fusion plant
// replaces fuel range altogether (VH p.49).
MGT2.RangeUnits = Object.freeze({
    km: "MGT2.RangeUnits.km",
    years: "MGT2.RangeUnits.years"
});

// A drone's control interface, and the DM it gives the operator (VH p.67). A robot brain substitutes
// a flat skill level instead (p.68), which is a brain and not an interface.
MGT2.RemoteInterfaces = Object.freeze({
    primitive: {label: "MGT2.RemoteInterfaces.primitive", dm: -4},
    basic: {label: "MGT2.RemoteInterfaces.basic", dm: -2},
    improved: {label: "MGT2.RemoteInterfaces.improved", dm: 0},
    advanced: {label: "MGT2.RemoteInterfaces.advanced", dm: 1}
});

// Spacecraft critical hits (Core p.169-170). Same severity rule as a vehicle. Sixteen cells feed
// `hullSeverity` instead of damaging their own location. An Engineer clears an effect for 1D
// hours only, so the stored entry carries repair state as well as a severity.
MGT2.ShipCriticals = Object.freeze({
    sensors: {
        label: "MGT2.ShipCriticals.sensors", roll: [2, 2],
        severities: [
            {sensorDM: -2},
            {sensorRange: "medium"},
            {sensorRange: "short"},
            {sensorRange: "close"},
            {sensorRange: "adjacent"},
            {sensorRange: null}
        ]
    },
    powerPlant: {
        label: "MGT2.ShipCriticals.powerPlant", roll: [3, 3],
        severities: [
            {power: -10},
            {power: -10},
            {power: -50},
            {power: 0},
            {power: 0, hullSeverity: 1},
            {power: 0, hullSeverity: "1D"}
        ]
    },
    fuel: {
        label: "MGT2.ShipCriticals.fuel", roll: [4, 4],
        severities: [
            {fuel: {leak: "1D", per: "hour"}},
            {fuel: {leak: "1D", per: "round"}},
            {fuel: {leak: "1Dx10%"}},
            {fuel: {state: "destroyed"}},
            {fuel: {state: "destroyed"}, hullSeverity: 1},
            {fuel: {state: "destroyed"}, hullSeverity: "1D"}
        ]
    },
    weapon: {
        label: "MGT2.ShipCriticals.weapon", roll: [5, 5],
        severities: [
            {weapons: {n: 1, state: "dm", dm: -1}},
            {weapons: {n: 1, state: "disabled"}},
            // "Random weapons destroyed" is printed plural with no count; `n` is left unstated.
            {weapons: {state: "destroyed"}},
            {weapons: {n: 1, state: "explodes"}, hullSeverity: 1},
            {weapons: {n: "D3", state: "explodes"}, hullSeverity: 1},
            {weapons: {n: "1D", state: "explodes"}, hullSeverity: 1}
        ]
    },
    armour: {
        label: "MGT2.ShipCriticals.armour", roll: [6, 6],
        severities: [
            {armour: -1},
            {armour: "-D3"},
            {armour: "-1D"},
            {armour: "-1D"},
            {armour: "-2D", hullSeverity: 1},
            {armour: "-2D", hullSeverity: 1}
        ]
    },
    hull: {
        label: "MGT2.ShipCriticals.hull", roll: [7, 7],
        severities: [
            {damage: "1D"}, {damage: "2D"}, {damage: "3D"},
            {damage: "4D"}, {damage: "5D"}, {damage: "6D"}
        ]
    },
    mDrive: {
        label: "MGT2.ShipCriticals.mDrive", roll: [8, 8],
        severities: [
            {controlDM: -1},
            {controlDM: -1, thrust: -1},
            {controlDM: -1, thrust: -1},
            {controlDM: -1, thrust: -1},
            {thrust: 0},
            {thrust: 0, hullSeverity: 1}
        ]
    },
    cargo: {
        label: "MGT2.ShipCriticals.cargo", roll: [9, 9],
        severities: [
            {cargo: "10%"},
            {cargo: "1Dx10%"},
            {cargo: "2Dx10%"},
            {cargo: "all"},
            {cargo: "all", hullSeverity: 1},
            {cargo: "all", hullSeverity: 1}
        ]
    },
    jDrive: {
        label: "MGT2.ShipCriticals.jDrive", roll: [10, 10],
        severities: [
            {jumpDM: -2},
            {jump: "disabled"},
            {jump: "destroyed"},
            {jump: "destroyed", hullSeverity: 1},
            {jump: "destroyed", hullSeverity: 1},
            {jump: "destroyed", hullSeverity: 1}
        ]
    },
    crew: {
        label: "MGT2.ShipCriticals.crew", roll: [11, 11],
        severities: [
            {occupants: {n: 1, damage: "1D"}},
            {lifeSupport: "1D hours"},
            {occupants: {n: "1D", damage: "2D"}},
            {lifeSupport: "1D rounds"},
            {occupants: {n: "all", damage: "3D"}},
            {lifeSupport: "immediate"}
        ]
    },
    bridge: {
        label: "MGT2.ShipCriticals.bridge", roll: [12, 12],
        severities: [
            {bridge: {station: "disabled"}},
            {computer: "reboot"},
            {computer: "bandwidth-50"},
            {bridge: {station: "destroyed", occupantDamage: "1Dx1D"}},
            {computer: "destroyed"},
            {bridge: {station: "destroyed", occupantDamage: "1Dx1D"}, hullSeverity: 1}
        ]
    }
});

// Spacecraft weapon mounts (HG p.26, p.29, p.34-35). The damage multiple applies after armour and
// never to missiles or torpedoes. A spinal mount's tonnage is per weapon, uses ceil(tons / 100)
// hardpoints, and cannot exceed half the ship's tonnage.
MGT2.ShipMounts = Object.freeze({
    fixed: {label: "MGT2.ShipMounts.fixed", tons: 0, weapons: 1, hardpoints: 1, damageMultiple: 1},
    singleTurret: {label: "MGT2.ShipMounts.singleTurret", tons: 1, weapons: 1, hardpoints: 1, damageMultiple: 1},
    doubleTurret: {label: "MGT2.ShipMounts.doubleTurret", tons: 1, weapons: 2, hardpoints: 1, damageMultiple: 1},
    tripleTurret: {label: "MGT2.ShipMounts.tripleTurret", tons: 1, weapons: 3, hardpoints: 1, damageMultiple: 1},
    barbette: {label: "MGT2.ShipMounts.barbette", tons: 5, weapons: 1, hardpoints: 1, damageMultiple: 3},
    smallBay: {label: "MGT2.ShipMounts.smallBay", tons: 50, weapons: 1, hardpoints: 1, damageMultiple: 10},
    mediumBay: {label: "MGT2.ShipMounts.mediumBay", tons: 100, weapons: 1, hardpoints: 1, damageMultiple: 20},
    largeBay: {label: "MGT2.ShipMounts.largeBay", tons: 500, weapons: 1, hardpoints: 5, damageMultiple: 100},
    spinal: {
        label: "MGT2.ShipMounts.spinal", tons: null, weapons: 1, hardpoints: null, damageMultiple: 1000,
        // A spinal weapon cannot track a small target, and its host's bulk costs it accuracy up
        // close. `cannotAttack` lifts if the target is stationary or caught in the blast.
        targetTonnageDM: [
            {maxTons: 1999, cannotAttack: true},
            {maxTons: 5000, dm: -8},
            {maxTons: 10000, dm: -4}
        ],
        attackerTonnageDM: [
            {maxTons: 10000, adjacent: -4, close: -2, short: -1},
            {maxTons: 50000, adjacent: -6, close: -4, short: -2},
            {maxTons: 250000, adjacent: -8, close: -6, short: -4},
            {maxTons: null, adjacent: -10, close: -8, short: -6}
        ]
    }
});

// Space combat range bands. `minKm`/`maxKm` transcribe the Range Bands table (Core folio 165) and
// overlap at 1 km exactly as the book prints it — Adjacent is "1km or less", Close is "1-10km".
// `thrust` is the Ship Movement table (folio 166) and is what it costs to move OUT of the band, to
// either neighbour, not into it. `attackDM` is folio 167; Adjacent and Close carry null rather than
// zero because no DM is printed for them at all — they resolve as a dogfight.
MGT2.ShipRangeBands = Object.freeze({
    adjacent: {label: "MGT2.ShipRangeBands.adjacent", minKm: 0, maxKm: 1, thrust: 1, attackDM: null, dogfight: true},
    close: {label: "MGT2.ShipRangeBands.close", minKm: 1, maxKm: 10, thrust: 1, attackDM: null, dogfight: true},
    short: {label: "MGT2.ShipRangeBands.short", minKm: 11, maxKm: 1250, thrust: 2, attackDM: 1, dogfight: false},
    medium: {label: "MGT2.ShipRangeBands.medium", minKm: 1251, maxKm: 10000, thrust: 5, attackDM: 0, dogfight: false},
    long: {label: "MGT2.ShipRangeBands.long", minKm: 10001, maxKm: 25000, thrust: 10, attackDM: -2, dogfight: false},
    veryLong: {label: "MGT2.ShipRangeBands.veryLong", minKm: 25001, maxKm: 50000, thrust: 25, attackDM: -4, dogfight: false},
    distant: {label: "MGT2.ShipRangeBands.distant", minKm: 50001, maxKm: null, thrust: 50, attackDM: -6, dogfight: false}
});

// Hull armour (HG p.12-13). `tonsPerPoint` is a percentage of hull tonnage, before the
// configuration's Armour Volume Modifier and the hull-size multiplier. Maximum Protection is
// min(TL + tlOffset, cap); a Military Hull doubles it.
MGT2.ArmourMaterials = Object.freeze({
    titaniumSteel: {label: "MGT2.ArmourMaterials.titaniumSteel", tl: 7, tonsPerPoint: 2.5, costPerTon: 50000, maxProtection: {tlOffset: 0, cap: 9}},
    crystaliron: {label: "MGT2.ArmourMaterials.crystaliron", tl: 10, tonsPerPoint: 1.25, costPerTon: 200000, maxProtection: {tlOffset: 0, cap: 13}},
    bondedSuperdense: {label: "MGT2.ArmourMaterials.bondedSuperdense", tl: 14, tonsPerPoint: 0.80, costPerTon: 500000, maxProtection: {tlOffset: 0, cap: null}},
    molecularBonded: {label: "MGT2.ArmourMaterials.molecularBonded", tl: 16, tonsPerPoint: 0.50, costPerTon: 1500000, maxProtection: {tlOffset: 4, cap: null}}
});

// Carried craft (HG p.57, p.61-63). `tonsMultiple` applies to the carried craft's tonnage; a
// docking clamp instead has a fixed tonnage for a stated range of attached ship. A launch tube
// does not replace each craft's own docking space or hangar.
MGT2.CraftBays = Object.freeze({
    dockingSpace: {label: "MGT2.CraftBays.dockingSpace", tonsMultiple: 1.1, transfer: "1D minutes", external: false},
    hangar: {label: "MGT2.CraftBays.hangar", tonsMultiple: 2, transfer: "2D minutes", external: false, repairs: true},
    dockingClampI: {label: "MGT2.CraftBays.dockingClampI", tons: 1, minCraftTons: 1, maxCraftTons: 30, external: true},
    dockingClampII: {label: "MGT2.CraftBays.dockingClampII", tons: 5, minCraftTons: 31, maxCraftTons: 99, external: true},
    dockingClampIII: {label: "MGT2.CraftBays.dockingClampIII", tons: 10, minCraftTons: 100, maxCraftTons: 300, external: true},
    dockingClampIV: {label: "MGT2.CraftBays.dockingClampIV", tons: 20, minCraftTons: 301, maxCraftTons: 2000, external: true},
    dockingClampV: {label: "MGT2.CraftBays.dockingClampV", tons: 50, minCraftTons: 2001, maxCraftTons: null, external: true},
    launchTube: {label: "MGT2.CraftBays.launchTube", tonsMultiple: 10, craftPerRound: 10, external: false},
    recoveryDeck: {label: "MGT2.CraftBays.recoveryDeck", tonsMultiple: 10, craftPerRound: 10, external: true}
});

// Crew Requirements (HG p.23). Salary is a monthly average for a skill-1 crewman, +50% per level
// above that. The commercial and military counts are derived from the ship, not stored here.
// `reducible` marks the roles the over-5000 t crew reduction may be applied to (p.22).
MGT2.CrewRoles = Object.freeze({
    captain: {label: "MGT2.CrewRoles.captain", skill: null, salary: 10000, reducible: false},
    pilot: {label: "MGT2.CrewRoles.pilot", skill: "pilot", salary: 6000, reducible: false},
    astrogator: {label: "MGT2.CrewRoles.astrogator", skill: "astrogation", salary: 5000, reducible: false},
    engineer: {label: "MGT2.CrewRoles.engineer", skill: "engineer", salary: 4000, reducible: true},
    maintenance: {label: "MGT2.CrewRoles.maintenance", skill: "mechanic", salary: 1000, reducible: true},
    gunner: {label: "MGT2.CrewRoles.gunner", skill: "gunner", salary: 2000, reducible: true},
    steward: {label: "MGT2.CrewRoles.steward", skill: "steward", salary: 2000, reducible: false},
    administrator: {label: "MGT2.CrewRoles.administrator", skill: "admin", salary: 1500, reducible: true},
    sensorOperator: {label: "MGT2.CrewRoles.sensorOperator", skill: "electronics", speciality: "sensors", salary: 4000, reducible: true},
    medic: {label: "MGT2.CrewRoles.medic", skill: "medic", salary: 4000, reducible: false},
    officer: {label: "MGT2.CrewRoles.officer", skill: "leadership", altSkill: "persuade", salary: 5000, reducible: false}
});

// Crew reduction on capital ships (HG p.22). Officers and medics are counted after the reduction.
MGT2.CrewReduction = Object.freeze([
    {maxTons: 5000, multiplier: 1},
    {maxTons: 19999, multiplier: 0.75},
    {maxTons: 49999, multiplier: 0.67},
    {maxTons: 99999, multiplier: 0.50},
    {maxTons: null, multiplier: 0.33}
]);

// The eight duties of space combat (Core folio 164). A separate vocabulary from the construction
// roles above: only one pilot and one captain, and the two gunner duties bind to a specific mount.
// The duty is per-encounter and lives on the `crew` Combatant, not on the ship's roster (§9.26).
MGT2.CombatDuties = Object.freeze({
    pilot: {label: "MGT2.CombatDuties.pilot", unique: true},
    captain: {label: "MGT2.CombatDuties.captain", unique: true},
    engineer: {label: "MGT2.CombatDuties.engineer", unique: false},
    sensorOperator: {label: "MGT2.CombatDuties.sensorOperator", unique: false},
    turretGunner: {label: "MGT2.CombatDuties.turretGunner", unique: false, mount: true},
    bayGunner: {label: "MGT2.CombatDuties.bayGunner", unique: false, mount: true},
    marine: {label: "MGT2.CombatDuties.marine", unique: false},
    passenger: {label: "MGT2.CombatDuties.passenger", unique: false}
});

// Which department a crew station belongs to — the `role` Item's grouping, and nothing more.
MGT2.Departments = Object.freeze({
    command: "MGT2.Departments.command",
    flight: "MGT2.Departments.flight",
    engineering: "MGT2.Departments.engineering",
    weapons: "MGT2.Departments.weapons",
    medical: "MGT2.Departments.medical",
    service: "MGT2.Departments.service",
    troops: "MGT2.Departments.troops"
});

// What a station can do. `skill` needs a sheet to read the level off and is refused on a vacant or
// unstatted slot; `weapon` rolls a mounted weapon; `special` is a referee's call and always offered.
MGT2.RoleActions = Object.freeze({
    skill: "MGT2.RoleActions.skill",
    weapon: "MGT2.RoleActions.weapon",
    special: "MGT2.RoleActions.special"
});

// Core folio 164. A space combat round resolves in three steps, and every ship takes a step before
// any ship takes the next. `reaction` is deliberately in the same list and is NOT a fourth step: the
// Core resolves reactions when they are provoked and HG folio 95 calls them an informal fourth
// phase. The key exists so an action can say it is one, not so a screen draws a fourth cell.
MGT2.CombatSteps = Object.freeze({
    manoeuvre: "MGT2.CombatSteps.manoeuvre",
    attack: "MGT2.CombatSteps.attack",
    actions: "MGT2.CombatSteps.actions",
    reaction: "MGT2.CombatSteps.reaction"
});

// What limits an action that may be taken more than once in a round — three different limits that
// all read as "a reaction" without this: Point Defence once per round per gunner (Core folio 171),
// Electronic Warfare once per salvo per round (folio 173), and screens angled against one attack
// per round (HG folio 41).
MGT2.ActionCaps = Object.freeze({
    none: "MGT2.ActionCaps.none",
    round: "MGT2.ActionCaps.round",
    salvo: "MGT2.ActionCaps.salvo",
    attack: "MGT2.ActionCaps.attack"
});

// Hull configuration (HG p.11). `armourVolume` multiplies the armour tonnage, `hullPoints` and
// `hullCost` the hull itself. `protection` is what the hull is worth before any armour is bought.
MGT2.HullConfigurations = Object.freeze({
    standard: {label: "MGT2.HullConfigurations.standard", streamlined: "partial", armourVolume: 1, hullPoints: 1, hullCost: 1, protection: 0},
    streamlined: {label: "MGT2.HullConfigurations.streamlined", streamlined: "yes", armourVolume: 1.2, hullPoints: 1, hullCost: 1.2, protection: 0},
    sphere: {label: "MGT2.HullConfigurations.sphere", streamlined: "partial", armourVolume: 0.9, hullPoints: 1, hullCost: 1.1, protection: 0},
    closeStructure: {label: "MGT2.HullConfigurations.closeStructure", streamlined: "partial", armourVolume: 1.5, hullPoints: 1, hullCost: 0.8, protection: 0},
    dispersedStructure: {label: "MGT2.HullConfigurations.dispersedStructure", streamlined: "no", armourVolume: 2, hullPoints: 0.9, hullCost: 0.5, protection: 0},
    planetoid: {label: "MGT2.HullConfigurations.planetoid", streamlined: "no", armourVolume: 1, hullPoints: 1.25, hullCost: null, protection: 2},
    bufferedPlanetoid: {label: "MGT2.HullConfigurations.bufferedPlanetoid", streamlined: "no", armourVolume: 1, hullPoints: 1.5, hullCost: null, protection: 4}
});

// Specialised hulls (HG p.12). Options rather than traits — the registry has no ship family.
MGT2.HullOptions = Object.freeze({
    reinforced: {label: "MGT2.HullOptions.reinforced", hullPoints: 1.1, hullCost: 1.5},
    light: {label: "MGT2.HullOptions.light", hullPoints: 0.9, hullCost: 0.75},
    military: {label: "MGT2.HullOptions.military", hullPoints: 1, hullCost: 1.25, armourMax: 2, minTons: 5001},
    nonGravity: {label: "MGT2.HullOptions.nonGravity", hullPoints: 1, hullCost: 0.5, basicPower: 0.5, maxTons: 500000},
    breakaway: {label: "MGT2.HullOptions.breakaway", hullPoints: 1, hullCost: 1}
});

// Tons of hull per Hull point (HG p.10). Very large ships brace more heavily and take more.
MGT2.HullPointRates = Object.freeze([
    {maxTons: 24999, tonsPerPoint: 2.5},
    {maxTons: 99999, tonsPerPoint: 2},
    {maxTons: null, tonsPerPoint: 1.5}
]);

// Armour framework multiplier by hull size (HG p.13), applied after the configuration's volume
// modifier. A small hull spends proportionally more of itself on the frame the armour hangs from.
MGT2.ArmourTonnage = Object.freeze([
    {maxTons: 15, multiplier: 4},
    {maxTons: 25, multiplier: 3},
    {maxTons: 99, multiplier: 2},
    {maxTons: null, multiplier: 1}
]);

// Manoeuvre and jump drives as a percentage of hull (HG p.16), indexed by rating. A jump drive adds
// five tons on top and is never smaller than ten.
MGT2.ThrustPotential = Object.freeze([0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11]);
MGT2.JumpPotential = Object.freeze([0, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.175, 0.20, 0.225]);

// Bridges (HG p.19). `tons` is the ladder by hull size; the cost is MCr0.5 per 100 tons of ship.
MGT2.BridgeSizes = Object.freeze([
    {maxTons: 50, tons: 3},
    {maxTons: 99, tons: 6},
    {maxTons: 200, tons: 10},
    {maxTons: 1000, tons: 20},
    {maxTons: 2000, tons: 40},
    {maxTons: 100000, tons: 60}
]);

// `dm` applies to spacecraft operations checks made from the bridge; a command bridge instead grants
// its DM to Tactics (naval) alone, which is why the two are not one number.
MGT2.BridgeTypes = Object.freeze({
    standard: {label: "MGT2.BridgeTypes.standard", dm: 0},
    smaller: {label: "MGT2.BridgeTypes.smaller", dm: -1, step: -1, costFactor: 0.5},
    command: {label: "MGT2.BridgeTypes.command", dm: 0, tacticsDM: 1, addTons: 40, addCost: 30000000, minTons: 5001},
    cockpit: {label: "MGT2.BridgeTypes.cockpit", dm: 0, tons: 1.5, cost: 10000, maxTons: 50},
    dualCockpit: {label: "MGT2.BridgeTypes.dualCockpit", dm: 0, tons: 2.5, cost: 15000, maxTons: 50}
});

// Sensors (HG p.21). One grade sets four numbers, which is why the ship stores the grade.
MGT2.SensorGrades = Object.freeze({
    basic: {label: "MGT2.SensorGrades.basic", tl: 8, dm: -4, power: 0, tons: 0, cost: 0},
    civilian: {label: "MGT2.SensorGrades.civilian", tl: 9, dm: -2, power: 1, tons: 1, cost: 3000000},
    military: {label: "MGT2.SensorGrades.military", tl: 10, dm: 0, power: 2, tons: 2, cost: 4100000},
    improved: {label: "MGT2.SensorGrades.improved", tl: 12, dm: 1, power: 4, tons: 3, cost: 4300000},
    advanced: {label: "MGT2.SensorGrades.advanced", tl: 15, dm: 2, power: 6, tons: 5, cost: 5300000}
});

// Staterooms and low berths (HG p.24, p.51). A low berth draws 1 Power per ten berths or part.
MGT2.Staterooms = Object.freeze({
    standard: {label: "MGT2.Staterooms.standard", tons: 4, cost: 500000},
    high: {label: "MGT2.Staterooms.high", tons: 6, cost: 800000},
    luxury: {label: "MGT2.Staterooms.luxury", tons: 10, cost: 1500000}
});

MGT2.LowBerths = Object.freeze({
    standard: {label: "MGT2.LowBerths.standard", tons: 0.5, cost: 50000, holds: 1, per: 10, power: 1},
    emergency: {label: "MGT2.LowBerths.emergency", tons: 1, cost: 1000000, holds: 4, per: 1, power: 1}
});

// Passage classes (Core p.158).
MGT2.PassageClasses = Object.freeze({
    high: "MGT2.PassageClasses.high",
    middle: "MGT2.PassageClasses.middle",
    basic: "MGT2.PassageClasses.basic",
    low: "MGT2.PassageClasses.low"
});

// Screens (HG p.41). A count and not a flag: every five nuclear dampers reduce a Destructive
// weapon's damage by a further 1DD, which a boolean cannot express.
MGT2.ShipScreens = Object.freeze({
    nuclearDamper: {label: "MGT2.ShipScreens.nuclearDamper", tl: 12, tons: 10, power: 20, cost: 60000000},
    mesonScreen: {label: "MGT2.ShipScreens.mesonScreen", tl: 13, tons: 10, power: 30, cost: 60000000},
    blackGlobe: {label: "MGT2.ShipScreens.blackGlobe", tl: 15, tons: 50, power: 30, cost: 100000000}
});

// Which column of the Crew Requirements table a ship reads (HG p.23).
MGT2.ShipService = Object.freeze({
    commercial: "MGT2.ShipService.commercial",
    military: "MGT2.ShipService.military"
});

// Running costs (Core p.149, p.154, p.183; HG p.25). All periodic figures run on the four-week
// maintenance period. `maintenanceDivisor` is p.183's form — the only one that excludes carried
// craft — and it is authoritative: the catalogue's plain cost/12000 bills a carried boat twice.
MGT2.ShipCosts = Object.freeze({
    mortgageDivisor: 240,
    mortgageYears: 40,
    maintenanceDivisor: 12000,
    lifeSupportPerStateroom: 1000,
    lifeSupportPerPerson: 1000,
    lifeSupportPerLowBerth: 100,
    fuelRefined: 500,
    fuelUnrefined: 100
});

// Fuel (HG p.18). A jump costs 10% of the hull per parsec; a power plant burns a tenth of its own
// tonnage every four weeks.
MGT2.ShipFuel = Object.freeze({
    jumpFraction: 0.10,
    plantFraction: 0.10,
    weeksPerPeriod: 4
});

// Free allowances per full 100 tons of hull (HG p.25, p.26), and the firmpoint ladder for hulls
// too small to carry a hardpoint at all.
MGT2.HullPoints = Object.freeze({
    tonsPerHardpoint: 100,
    tonsPerAirlock: 100,
    firmpoints: [
        {maxTons: 34, count: 1},
        {maxTons: 69, count: 2},
        {maxTons: 99, count: 3},
        {maxTons: null, count: 0}
    ]
});

// Robot Size (Robot Handbook p.13). `attackDM` is the Small/Large trait score, the same
// attacker-side ranged DM a creature carries. Base Slots never changes with modifications.
MGT2.RobotSize = Object.freeze({
    1: {label: "MGT2.RobotSize.1", slots: 1, hits: 1, attackDM: -4, spaces: 0, cost: 100},
    2: {label: "MGT2.RobotSize.2", slots: 2, hits: 4, attackDM: -3, spaces: 0.02, cost: 200},
    3: {label: "MGT2.RobotSize.3", slots: 4, hits: 8, attackDM: -2, spaces: 0.1, cost: 400},
    4: {label: "MGT2.RobotSize.4", slots: 8, hits: 12, attackDM: -1, spaces: 0.25, cost: 800},
    5: {label: "MGT2.RobotSize.5", slots: 16, hits: 20, attackDM: 0, spaces: 0.5, cost: 1000},
    6: {label: "MGT2.RobotSize.6", slots: 32, hits: 32, attackDM: 1, spaces: 1, cost: 2000},
    7: {label: "MGT2.RobotSize.7", slots: 64, hits: 50, attackDM: 2, spaces: 2, cost: 4000},
    8: {label: "MGT2.RobotSize.8", slots: 128, hits: 72, attackDM: 3, spaces: 4, cost: 8000}
});

// Robot brains (Robot Handbook p.66). Computer/X is Bandwidth. `tl`, `bandwidth` and `intellect`
// are parallel arrays: one entry per Tech Level step of the grade. `taskCeiling` is the hardest
// difficulty the grade may attempt, and RH folio 115 qualifies it twice: it reaches INT-, EDU- and
// SOC-based checks only — "a robot Traveller is free to try an Impossible (16+) feat of STR" — and
// "performing a task more slowly can lower difficulty by one level", which can bring a task back
// inside it. It does survive an INT upgrade.
MGT2.RobotBrains = Object.freeze({
    primitive: {label: "MGT2.RobotBrains.primitive", tl: [7, 8], bandwidth: [0, 0], intellect: [1, 1], skillDM: -2, taskCeiling: null},
    basic: {label: "MGT2.RobotBrains.basic", tl: [8, 10], bandwidth: [1, 1], intellect: [3, 4], skillDM: -1, taskCeiling: null},
    hunterKiller: {label: "MGT2.RobotBrains.hunterKiller", tl: [8, 10], bandwidth: [1, 1], intellect: [3, 4], skillDM: -1, taskCeiling: null},
    advanced: {label: "MGT2.RobotBrains.advanced", tl: [10, 11, 12], bandwidth: [2, 2, 2], intellect: [6, 7, 8], skillDM: 0, taskCeiling: "Difficult"},
    veryAdvanced: {label: "MGT2.RobotBrains.veryAdvanced", tl: [12, 13, 14], bandwidth: [3, 4, 5], intellect: [9, 10, 11], skillDM: 1, taskCeiling: "VeryDifficult"},
    selfAware: {label: "MGT2.RobotBrains.selfAware", tl: [15, 16], bandwidth: [10, 15], intellect: [12, 13], skillDM: 2, taskCeiling: "Formidable"},
    conscious: {label: "MGT2.RobotBrains.conscious", tl: [17, 18], bandwidth: [20, 30], intellect: [15, 15], skillDM: 3, taskCeiling: "Impossible"},
    // A printed Programming grade on eight statblocks (p.208-215), absent from the brain ladder.
    drone: {label: "MGT2.RobotBrains.drone", tl: null, bandwidth: null, intellect: null, skillDM: null, taskCeiling: null}
});

// Robot locomotion (Robot Handbook p.16). `costMultiplier` times the Size table's basic cost is
// the Base Chassis Cost, the denominator for armour, resiliency, efficiency, agility and speed.
// `None` also adds 25% to available Slots without raising Base Slots.
MGT2.RobotLocomotion = Object.freeze({
    none: {label: "MGT2.RobotLocomotion.none", tl: 5, agility: null, traits: [], endurance: 216, costMultiplier: 1},
    wheels: {label: "MGT2.RobotLocomotion.wheels", tl: 5, agility: 0, traits: [], endurance: 72, costMultiplier: 2},
    wheelsATV: {label: "MGT2.RobotLocomotion.wheelsATV", tl: 5, agility: 0, traits: ["atv"], endurance: 72, costMultiplier: 3},
    tracks: {label: "MGT2.RobotLocomotion.tracks", tl: 5, agility: -1, traits: ["atv"], endurance: 72, costMultiplier: 2},
    grav: {label: "MGT2.RobotLocomotion.grav", tl: 9, agility: 1, traits: ["flyer"], endurance: 24, costMultiplier: 20},
    aeroplane: {label: "MGT2.RobotLocomotion.aeroplane", tl: 5, agility: 1, traits: ["flyer"], endurance: 12, costMultiplier: 12},
    aquatic: {label: "MGT2.RobotLocomotion.aquatic", tl: 6, agility: -2, traits: ["seafarer"], endurance: 72, costMultiplier: 4},
    vtol: {label: "MGT2.RobotLocomotion.vtol", tl: 7, agility: 0, traits: ["flyer"], endurance: 24, costMultiplier: 14},
    walker: {label: "MGT2.RobotLocomotion.walker", tl: 8, agility: 0, traits: ["atv"], endurance: 72, costMultiplier: 10},
    hovercraft: {label: "MGT2.RobotLocomotion.hovercraft", tl: 7, agility: 1, traits: ["acv"], endurance: 24, costMultiplier: 10},
    thruster: {label: "MGT2.RobotLocomotion.thruster", tl: 7, agility: 1, traits: [], endurance: 2, costMultiplier: 20}
});

// Robot armour by TL band (Robot Handbook p.19). `slotsPerPoint` is a percentage of Base Slots,
// rounded up, never below one Slot. Androids and biological robots get no base Protection.
MGT2.RobotArmour = Object.freeze({
    tl6: {label: "MGT2.RobotArmour.tl6", minTL: 6, maxTL: 8, protection: 2, maxAdded: 20, slotsPerPoint: 1, maxPerSlot: 1, costPerSlot: 250},
    tl9: {label: "MGT2.RobotArmour.tl9", minTL: 9, maxTL: 11, protection: 3, maxAdded: 30, slotsPerPoint: 0.5, maxPerSlot: 2, costPerSlot: 1000},
    tl12: {label: "MGT2.RobotArmour.tl12", minTL: 12, maxTL: 14, protection: 4, maxAdded: 40, slotsPerPoint: 0.4, maxPerSlot: 3, costPerSlot: 1500},
    tl15: {label: "MGT2.RobotArmour.tl15", minTL: 15, maxTL: 17, protection: 4, maxAdded: 50, slotsPerPoint: 0.3, maxPerSlot: 4, costPerSlot: 2500},
    tl18: {label: "MGT2.RobotArmour.tl18", minTL: 18, maxTL: null, protection: 5, maxAdded: 60, slotsPerPoint: 0.25, maxPerSlot: 5, costPerSlot: 5000}
});

// Where the robot's power comes from. RTG and solar replace the endurance chain entirely and print
// a half-life in years with the hourly figure beside it (Robot Handbook p.20, p.76).
MGT2.RobotPower = Object.freeze({
    internal: "MGT2.RobotPower.internal",
    rtg: "MGT2.RobotPower.rtg",
    solar: "MGT2.RobotPower.solar"
});

// Robot Handbook p.117: SOC is 0 where robots are property and a 2D roll where one is a citizen.
MGT2.RobotSociety = Object.freeze({
    property: "MGT2.RobotSociety.property",
    citizen: "MGT2.RobotSociety.citizen"
});