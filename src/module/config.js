import { TRAITS, TRAIT_FAMILIES } from "./traits.js";

export const MGT2 = {};

// Trait registry, at `CONFIG.MGT2.Traits[family][slug]`. `TraitFamilies` adds `custom`.
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

// The eight rungs a check can be SET at: `Difficulty` minus `NA`, derived so the two cannot drift.
MGT2.DifficultyChoices = Object.freeze(Object.fromEntries(
    Object.keys(MGT2.DifficultyTargets).map(key => [key, MGT2.Difficulty[key]])));

// Core p.63. The Effect of the previous check is a DM on the next. Six rungs, none worth zero.
MGT2.TaskChain = Object.freeze([
    {min: null, max: -6, dm: -3},
    {min: -5, max: -2, dm: -2},
    {min: -1, max: -1, dm: -1},
    {min: 0, max: 0, dm: 1},
    {min: 1, max: 5, dm: 2},
    {min: 6, max: null, dm: 3}
]);

// Core p.76. `dm` is what the REACTOR imposes on the attacker; announced, never applied.
MGT2.CombatReactions = Object.freeze({
    dodge: {label: "MGT2.CombatReactions.dodge", icon: "fa-solid fa-person-running",
        characteristic: "dexterity", skill: "Athletics (dexterity)"},
    dive: {label: "MGT2.CombatReactions.dive", icon: "fa-solid fa-person-falling",
        dm: -2, noCover: -1, forgoes: true},
    parry: {label: "MGT2.CombatReactions.parry", icon: "fa-solid fa-shield-halved",
        skill: "Melee"}
});

// Core p.73. DM±6 on Initiative for the first round only — and Initiative is rolled once.
MGT2.Ambush = Object.freeze({
    aware: {label: "MGT2.Ambush.aware", dm: 6},
    unaware: {label: "MGT2.Ambush.unaware", dm: -6}
});

// Core p.73. A stored key, not the token disposition, which is only the default it starts from.
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

// Core folio 59 (DM-3 unskilled) and folio 69 (Jack-of-All-Trades reduces it, capped by `max`).
MGT2.Untrained = Object.freeze({
    dm: -3,
    max: 3,
    skills: Object.freeze(["Jack-of-All-Trades", "Polyvalent"])
});

// Core folio 75. Damage during an Extended Action forces a check at `dm` per point; failure loses
// the round's work, and `ruin` is the Effect at or below which it starts from scratch.
MGT2.ExtendedAction = Object.freeze({
    dm: -1,
    per: 1,
    ruin: -6,
    outcomes: Object.freeze({
        kept: "MGT2.Chat.Roll.ExtendedKept",
        lost: "MGT2.Chat.Roll.ExtendedLost",
        ruined: "MGT2.Chat.Roll.ExtendedRuined"
    })
});

// The two procedures differ in SHAPE, not numbers: Core folio 158 chains astrogator into engineer,
// Companion folio 152 triggers on the SUM.
MGT2.JumpRulesets = Object.freeze({
    core: "MGT2.Voyage.RulesetCore",
    companion: "MGT2.Voyage.RulesetCompanion"
});

// What a jump does when it goes wrong.
MGT2.Misjumps = Object.freeze({
    // Core folio 158 reads the failed Engineer (j-drive) Effect alone: no second roll, no table.
    core: Object.freeze({
        outcomes: Object.freeze([
            { max: -3, label: "MGT2.Jump.Core.Adrift", parsecs: "1D*1D", merciful: true },
            { max: -2, label: "MGT2.Jump.Core.Displaced", diameters: "1D" },
            // The extra 1D is the crew's PERCEIVED time, which the folio also makes optional.
            { max: -1, label: "MGT2.Jump.Core.Late", days: "1D", perceived: "1D" },
            { max: null, label: "MGT2.Jump.Core.Clean", clean: true }
        ])
    }),

    // Companion folios 150-153. Two checks, two variance tables, and a trigger reading their SUM.
    companion: Object.freeze({
        // Folio 152: a misjump when the sum of both Effects is 0 or less.
        trigger: 0,

        // Folio 151, 2D + astrogator Effect: emergence distance in diameters, not a variance.
        distance: Object.freeze([
            { max: 2, diameters: "110-3D", bad: true },
            { max: 3, diameters: "110-2D", bad: true },
            { max: 4, diameters: "105-1D", bad: true },
            { max: 5, diameters: "100+2D*10", bad: true },
            { max: 6, diameters: "100+2D*5" },
            { max: 7, diameters: "100+4D" },
            { max: 8, diameters: "100+3D" },
            { max: 9, diameters: "100+2D" },
            { max: 10, diameters: "100+1D" },
            { max: 11, diameters: "100+1D3" },
            { max: null, diameters: "100", exact: true }
        ]),

        // Folio 151, 2D + engineer Effect: variance on the 160-hour baseline (the last row).
        time: Object.freeze([
            { max: 2, hours: "16D", bad: true },
            { max: 3, hours: "10D", bad: true },
            { max: 4, hours: "8D", bad: true },
            { max: 5, hours: "6D", bad: true },
            { max: 6, hours: "5D" },
            { max: 7, hours: "4D" },
            { max: 8, hours: "3D" },
            { max: 9, hours: "2D" },
            { max: 10, hours: "1D" },
            { max: 11, hours: "1D3" },
            { max: null, hours: "0", exact: true }
        ]),
        baselineHours: 160,
        // Folio 150-151: the emergence limit, and the distance a clean jump aims for.
        limit: 100,
        // "Roll 1D: Odd indicates that the jump is long in duration, even indicates it is short."
        longOnOdd: true,

        // Folio 153, 2D with the combined Effect as a DM; the trigger caps the sum at 0.
        table: Object.freeze([
            { max: 2, label: "MGT2.Jump.Misjump.Lost" },
            { max: 4, label: "MGT2.Jump.Misjump.Wrecked", parsecs: "1D*1D" },
            { max: 6, label: "MGT2.Jump.Misjump.Severe", parsecs: "2D" },
            { max: 8, label: "MGT2.Jump.Misjump.Scattered", parsecs: "1D" },
            { max: 10, label: "MGT2.Jump.Misjump.Recalibrate", days: "1D", work: "1D3" },
            { max: null, label: "MGT2.Jump.Misjump.Rough", diameters: "100*2D" }
        ]),

        // Folio 152. ⚠ The printed table overlaps: 6-8 and 7-9 both name 7 and 8. Read top down as
        // a referee reads the page — the first band containing the roll wins.
        veryBad: Object.freeze([
            { max: 2, label: "MGT2.Jump.VeryBad.None" },
            { max: 5, label: "MGT2.Jump.VeryBad.Recalibration", days: "2D" },
            { max: 8, label: "MGT2.Jump.VeryBad.MinorRepairs" },
            { max: 9, label: "MGT2.Jump.VeryBad.MajorRepairs" },
            { max: 12, label: "MGT2.Jump.VeryBad.Intrusions", hullPerDay: "2D-2" },
            { max: null, label: "MGT2.Jump.VeryBad.SevereIntrusions", hullPerDay: "2D+10" }
        ]),

        // Folio 152: "the Referee should use the highest applicable" — a max, never a sum.
        veryBadDMs: Object.freeze({
            bothVariances: -4,
            precipitation: -2,
            misjump: 0,
            significant: 2,
            serious: 4
        }),

        // Folio 151-152. Everyone aboard; the system states the pair and nothing rolls it.
        badJump: Object.freeze({
            characteristics: Object.freeze(["endurance", "intellect"]),
            difficulties: Object.freeze(["Routine", "Difficult"]),
            veryBadDM: -2,
            // END failed: a DM equal to the Effect of the failure, twice — entering and emerging.
            physical: Object.freeze({
                hours: "2D", incapacitatedAt: -6, outFor: "2D*30", thenDM: -6, thenHours: "4D" }),
            // INT failed: mental and interpersonal checks only, for the jump and 1D days after.
            mental: Object.freeze({ dm: -2, seriousAt: -6, afterDays: "1D" })
        })
    })
});

// The referee's half of folio 152's Very Bad Jump ladder: where the drive was fired.
MGT2.JumpGravity = Object.freeze({
    none: "MGT2.Jump.Gravity.none",
    significant: "MGT2.Jump.Gravity.significant",
    serious: "MGT2.Jump.Gravity.serious"
});

// Core folio 78. Nothing declares a grapple: the opposed Melee (unarmed) check IS the declaration,
// and `skills` matches the rolled free-text name in both shipped languages.
MGT2.Grapple = Object.freeze({
    skills: Object.freeze(["melee", "mêlée"]),
    outcomes: Object.freeze({
        prone: {label: "MGT2.Grapple.Outcomes.prone"},
        disarm: {label: "MGT2.Grapple.Outcomes.disarm", takes: 6},
        throw: {label: "MGT2.Grapple.Outcomes.throw", distance: "1D", damage: "1D", ends: true},
        damage: {label: "MGT2.Grapple.Outcomes.damage", base: 2, ignoreArmour: true},
        weapon: {label: "MGT2.Grapple.Outcomes.weapon", attack: true},
        escape: {label: "MGT2.Grapple.Outcomes.escape", ends: true},
        drag: {label: "MGT2.Grapple.Outcomes.drag", metres: 3},
        hold: {label: "MGT2.Grapple.Outcomes.hold"}
    })
});

// Core p.76-77. Bands are multiples of the weapon's own Range; `out` carries no DM and no shot.
MGT2.RangeBands = Object.freeze({
    short: {label: "MGT2.RangeBands.short", dm: 1},
    normal: {label: "MGT2.RangeBands.normal", dm: 0},
    long: {label: "MGT2.RangeBands.long", dm: -2},
    extreme: {label: "MGT2.RangeBands.extreme", dm: -4},
    out: {label: "MGT2.RangeBands.out", dm: 0}
});

// Core p.74's Common Modifiers to Ranged Attacks, in book order.
MGT2.AttackModifiers = Object.freeze({
    aiming: {label: "MGT2.AttackModifiers.aiming", dm: 1, max: 6},
    laserSight: {label: "MGT2.AttackModifiers.laserSight", dm: 1, requires: "aiming"},
    fastMovingTarget: {label: "MGT2.AttackModifiers.fastMovingTarget", dm: -1, per: 10},
    shortRange: {label: "MGT2.RangeBands.short", dm: 1, band: "short"},
    longRange: {label: "MGT2.RangeBands.long", dm: -2, band: "long"},
    extremeRange: {label: "MGT2.RangeBands.extreme", dm: -4, band: "extreme"},
    cover: {label: "MGT2.AttackModifiers.cover", dm: -2},
    prone: {label: "MGT2.AttackModifiers.prone", dm: -1},
    // Core folio 78: two one-handed weapons cost DM-2 each and forfeit aiming. Blades count too.
    dualWeapons: {label: "MGT2.AttackModifiers.dualWeapons", dm: -2, suppress: "aiming"}
});

// Core folio 77: 100 m in combat, and the 300 m a referee "is free to increase this to" outside one.
MGT2.ExtremeRangeThresholds = Object.freeze({
    combat: {label: "MGT2.RollPrompt.ThresholdCombat", metres: 100},
    noStress: {label: "MGT2.RollPrompt.ThresholdNoStress", metres: 300}
});

// Core folio 79. The mode is a per-attack choice, so nothing stores one; `rounds` is the multiple
// of the Auto score it spends.
MGT2.FireModes = Object.freeze({
    single: {label: "MGT2.FireModes.single"},
    burst: {label: "MGT2.FireModes.burst", damage: true, rounds: 1, suppress: "aiming"},
    fullAuto: {label: "MGT2.FireModes.fullAuto", attacks: true, rounds: 3, suppress: "aiming"}
});

// Companion p.93-94. Not a partition: the types overlap and an empty set is the normal case.
MGT2.DamageTypes = Object.freeze({
    blades: "MGT2.DamageTypes.blades",
    fire: "MGT2.DamageTypes.fire",
    stabbing: "MGT2.DamageTypes.stabbing",
    crushing: "MGT2.DamageTypes.crushing",
    impaling: "MGT2.DamageTypes.impaling",
    projectile: "MGT2.DamageTypes.projectile",
    laser: "MGT2.DamageTypes.laser"
});

// Core folio 167's Damage Scale table, to-hit column.
MGT2.CrossScaleAttack = Object.freeze({
    ground: {label: "MGT2.RollPrompt.ScaleSpacecraftTarget", dm: 2},
    spacecraft: {label: "MGT2.RollPrompt.ScaleGroundTarget", dm: -2}
});

// Core p.167 — a wound crossing the scale boundary is multiplied or divided by ten.
MGT2.Scales = Object.freeze({
    ground: {label: "MGT2.Scales.ground", ratio: 1},
    spacecraft: {label: "MGT2.Scales.spacecraft", ratio: 10}
});

// A weapon's own scale.
MGT2.WeaponScales = Object.freeze({
    ground: {label: "MGT2.Scales.ground", range: "meter", fireControl: false, power: false, band: false},
    vehicle: {label: "MGT2.Scales.vehicle", range: "kilometer", fireControl: true, power: false, band: false},
    spacecraft: {label: "MGT2.Scales.spacecraft", range: "kilometer", fireControl: true, power: true, band: true}
});

// Companion p.93. Reduced and Minimum substitute into the expression and are rolled with the attack.
MGT2.DamageTransforms = Object.freeze({
    full: "MGT2.DamageTransforms.full",
    reduced: "MGT2.DamageTransforms.reduced",
    minimum: "MGT2.DamageTransforms.minimum"
});

// Core p.82. The names a rolled free-text skill is matched against to offer the first-aid button.
MGT2.FirstAidSkills = Object.freeze(["medic", "médecine"]);

// CSC folio 66's exception: Interface runs alongside one other Bandwidth 0 program. A name only.
MGT2.InterfaceSoftware = Object.freeze(["interface"]);

// Core folio 81's Radiation Effects.
MGT2.RadiationEffects = Object.freeze([
    {min: 801, damage: "8D", condition: "MGT2.Radiation.Bleeding", endurance: -4},
    {min: 501, damage: "6D", condition: "MGT2.Radiation.Sterile", endurance: -3},
    {min: 301, damage: "4D", condition: "MGT2.Radiation.HairLoss", endurance: -2},
    {min: 151, damage: "2D", condition: "", endurance: -1},
    // The one immediate effect that is a number rather than a scene fact, so it is carried as state.
    {min: 51, damage: "1D", condition: "MGT2.Radiation.Nausea", state: "nausea", endurance: 0},
    {min: 0, damage: "", condition: "", endurance: 0}
]);

// Core folio 81's Radiation Exposure, and folio 79's weapon trait dose. Nothing here is scheduled.
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

// Core folio 80: a disease or poison is resisted by END checks, one per Interval. `wound` is ours.
MGT2.EnduranceResisted = Object.freeze(["disease", "poison"]);

// Core folio 229's Psionic Range table in printed order — "one Range Band further" is a step here.
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

// Core folio 229: one Range Band further for twice the PSI Cost, two for four times.
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

// Core folio 9's "PHYSICAL CHARACTERISTICS" heading, the only such partition the books state.
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

// Core p.61. Tri-state and never a count: a Boon and a Bane cancel to plain 2D.
MGT2.Stance = Object.freeze({
    bane: "MGT2.Request.Stance.bane",
    none: "MGT2.Request.Stance.none",
    boon: "MGT2.Request.Stance.boon"
});

// `solo` is N rollers with N consequences; `together` is Core p.63-64's one resolver taking a chain.
MGT2.RequestTally = Object.freeze({
    solo: "MGT2.Request.Tally.solo",
    together: "MGT2.Request.Tally.together"
});

// Core p.136. Eleven bands, 0-10; the number itself is what the rules do arithmetic on.
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
    Hours: "MGT2.Durations.Hours"
});

// Damage pools that are not characteristics; the characteristic roster itself stays the twelve.
MGT2.DamageTracks = Object.freeze({
    hits: "MGT2.DamageTracks.hits",
    hull: "MGT2.DamageTracks.hull"
});

// Animal Size (Core p.89) — advisory: the size trait is stored, never derived from Hits.
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

// Fight or Flight (Core p.90), keyed on the behaviour pattern alone: published statblocks pair diet
// and pattern freely.
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

// Core p.89. `inexplicable` and `none` are the Companion statblocks' own escapes.
MGT2.Diets = Object.freeze({
    herbivore: "MGT2.Diets.herbivore",
    omnivore: "MGT2.Diets.omnivore",
    carnivore: "MGT2.Diets.carnivore",
    scavenger: "MGT2.Diets.scavenger",
    inexplicable: "MGT2.Diets.inexplicable",
    none: "MGT2.Diets.none"
});

// The Experience ladder's own axis (Core p.92); `combatant` is the other.
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

// Experience (Core p.92). The table's Skills column is generator guidance and is not carried.
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

// Vehicle critical hits (Core p.140-141).
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
            // UNVERIFIED: Core p.141 prints "DM+2" here.
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

// Core folio 138's two vehicular actions that leave a DM behind.
MGT2.VehicleActions = Object.freeze({
    dogfight: {label: "MGT2.Actor.vehicle.Dogfight", opposed: true, winner: 2, loser: -2},
    evasive: {label: "MGT2.Actor.vehicle.Evasive", opposed: false}
});

// The chassis sets the skill and its speciality (Core p.66, p.68, p.71).
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

// The union of the three skills' specialities, which is what a stored pair validates against.
MGT2.VehicleSpecialities = Object.freeze(Object.fromEntries(
    Object.values(MGT2.VehicleSkills).flatMap(skill => Object.entries(skill.specialities))));

// `agility` is the penalty for operating OUTSIDE the chassis's native medium — the printed Agility
// is the native-medium value (VH p.3, p.14, p.47-48).
MGT2.OperatingModes = Object.freeze({
    ground: {label: "MGT2.OperatingModes.ground", agility: -1},
    afloat: {label: "MGT2.OperatingModes.afloat", agility: -1},
    flying: {label: "MGT2.OperatingModes.flying", agility: -1},
    rails: {label: "MGT2.OperatingModes.rails", agility: -2}
});

// Which skill puts a vehicle in which medium, so the native one is read off the chassis.
MGT2.VehicleNativeModes = Object.freeze({
    drive: "ground",
    flyer: "flying",
    seafarer: "afloat"
});

// Five of the 78 print a service life instead of a distance: a fission or fusion plant (VH p.49).
MGT2.RangeUnits = Object.freeze({
    km: "MGT2.RangeUnits.km",
    years: "MGT2.RangeUnits.years"
});

// A drone's control interface and the DM it gives the operator (VH p.67).
MGT2.RemoteInterfaces = Object.freeze({
    primitive: {label: "MGT2.RemoteInterfaces.primitive", dm: -4},
    basic: {label: "MGT2.RemoteInterfaces.basic", dm: -2},
    improved: {label: "MGT2.RemoteInterfaces.improved", dm: 0},
    advanced: {label: "MGT2.RemoteInterfaces.advanced", dm: 1}
});

// Spacecraft critical hits (Core p.169-170).
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

// Spacecraft weapon mounts (HG p.26, p.29, p.34-35).
MGT2.ShipMounts = Object.freeze({
    fixed: {label: "MGT2.ShipMounts.fixed", tons: 0, weapons: 1, hardpoints: 1, damageMultiple: 1},
    // HG p.113 counts sandcasters and salvo-defence lasers by the mount, not by the weapon in it.
    singleTurret: {label: "MGT2.ShipMounts.singleTurret", tons: 1, weapons: 1, hardpoints: 1, damageMultiple: 1, turret: true},
    doubleTurret: {label: "MGT2.ShipMounts.doubleTurret", tons: 1, weapons: 2, hardpoints: 1, damageMultiple: 1, turret: true},
    tripleTurret: {label: "MGT2.ShipMounts.tripleTurret", tons: 1, weapons: 3, hardpoints: 1, damageMultiple: 1, turret: true},
    barbette: {label: "MGT2.ShipMounts.barbette", tons: 5, weapons: 1, hardpoints: 1, damageMultiple: 3},
    smallBay: {label: "MGT2.ShipMounts.smallBay", tons: 50, weapons: 1, hardpoints: 1, damageMultiple: 10},
    mediumBay: {label: "MGT2.ShipMounts.mediumBay", tons: 100, weapons: 1, hardpoints: 1, damageMultiple: 20},
    largeBay: {label: "MGT2.ShipMounts.largeBay", tons: 500, weapons: 1, hardpoints: 5, damageMultiple: 100},
    spinal: {
        label: "MGT2.ShipMounts.spinal", tons: null, weapons: 1, hardpoints: null, damageMultiple: 1000,
        // A spinal weapon cannot track a small target; `cannotAttack` lifts if it is stationary.
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

// Space combat range bands.
MGT2.ShipRangeBands = Object.freeze({
    adjacent: {label: "MGT2.ShipRangeBands.adjacent", minKm: 0, maxKm: 1, thrust: 1, attackDM: null, dogfight: true},
    close: {label: "MGT2.ShipRangeBands.close", minKm: 1, maxKm: 10, thrust: 1, attackDM: null, dogfight: true},
    short: {label: "MGT2.ShipRangeBands.short", minKm: 11, maxKm: 1250, thrust: 2, attackDM: 1, dogfight: false},
    medium: {label: "MGT2.ShipRangeBands.medium", minKm: 1251, maxKm: 10000, thrust: 5, attackDM: 0, dogfight: false},
    long: {label: "MGT2.ShipRangeBands.long", minKm: 10001, maxKm: 25000, thrust: 10, attackDM: -2, dogfight: false},
    veryLong: {label: "MGT2.ShipRangeBands.veryLong", minKm: 25001, maxKm: 50000, thrust: 25, attackDM: -4, dogfight: false},
    distant: {label: "MGT2.ShipRangeBands.distant", minKm: 50001, maxKm: null, thrust: 50, attackDM: -6, dogfight: false}
});

// Hull armour (HG p.12-13).
MGT2.ArmourMaterials = Object.freeze({
    titaniumSteel: {label: "MGT2.ArmourMaterials.titaniumSteel", tl: 7, tonsPerPoint: 2.5, costPerTon: 50000, maxProtection: {tlOffset: 0, cap: 9}},
    crystaliron: {label: "MGT2.ArmourMaterials.crystaliron", tl: 10, tonsPerPoint: 1.25, costPerTon: 200000, maxProtection: {tlOffset: 0, cap: 13}},
    bondedSuperdense: {label: "MGT2.ArmourMaterials.bondedSuperdense", tl: 14, tonsPerPoint: 0.80, costPerTon: 500000, maxProtection: {tlOffset: 0, cap: null}},
    molecularBonded: {label: "MGT2.ArmourMaterials.molecularBonded", tl: 16, tonsPerPoint: 0.50, costPerTon: 1500000, maxProtection: {tlOffset: 4, cap: null}}
});

// Carried craft (HG p.57, p.61-63). `tonsMultiple` applies to the carried craft's tonnage.
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

// Crew Requirements (HG p.23). Salary is monthly for a skill-1 crewman, +50% per level above.
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

// The eight duties of space combat (Core folio 164), per-encounter and on the `crew` Combatant.
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

// What a station can do.
MGT2.RoleActions = Object.freeze({
    skill: "MGT2.RoleActions.skill",
    weapon: "MGT2.RoleActions.weapon",
    special: "MGT2.RoleActions.special"
});

// Core folio 164. Three steps, and every ship takes one before any ship takes the next.
MGT2.CombatSteps = Object.freeze({
    manoeuvre: "MGT2.CombatSteps.manoeuvre",
    attack: "MGT2.CombatSteps.attack",
    actions: "MGT2.CombatSteps.actions",
    reaction: "MGT2.CombatSteps.reaction"
});

// What limits an action taken more than once a round: point defence per gunner (Core folio 171),
// electronic warfare per salvo (folio 173), screens angled against one attack (HG folio 41).
MGT2.ActionCaps = Object.freeze({
    none: "MGT2.ActionCaps.none",
    round: "MGT2.ActionCaps.round",
    salvo: "MGT2.ActionCaps.salvo",
    attack: "MGT2.ActionCaps.attack"
});

// Hull configuration (HG p.11).
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

// Armour framework multiplier by hull size (HG p.13), after the configuration's volume modifier.
MGT2.ArmourTonnage = Object.freeze([
    {maxTons: 15, multiplier: 4},
    {maxTons: 25, multiplier: 3},
    {maxTons: 99, multiplier: 2},
    {maxTons: null, multiplier: 1}
]);

// Drives as a percentage of hull by rating (HG p.16); a jump drive adds five tons and floors at ten.
MGT2.ThrustPotential = Object.freeze([0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11]);
// A reaction drive reads its own row of the same table and runs to rating 16 (HG p.16).
MGT2.ReactionPotential = Object.freeze([0.01, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18,
    0.20, 0.22, 0.24, 0.26, 0.28, 0.30, 0.32]);
MGT2.JumpPotential = Object.freeze([0, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.175, 0.20, 0.225]);

// The g-LOC ladder (HG p.47), read by the G-force a ship's compensators do not cover.
MGT2.GLoc = Object.freeze([
    {maxG: 1, difficulty: null, increment: null, trained: false, special: false},
    {maxG: 2, difficulty: "Easy", increment: "turn", trained: false, special: false},
    {maxG: 3, difficulty: "Routine", increment: "turn", trained: false, special: false},
    {maxG: 4, difficulty: "Average", increment: "turn", trained: false, special: false},
    {maxG: 6, difficulty: "Difficult", increment: "minute", trained: false, special: false},
    {maxG: 10, difficulty: "VeryDifficult", increment: "minute", trained: false, special: false},
    {maxG: 15, difficulty: "VeryDifficult", increment: "minute", trained: true, special: false},
    {maxG: null, difficulty: null, increment: null, trained: false, special: true}
]);

// Bridges (HG p.19). `tons` is the ladder by hull size; the cost is MCr0.5 per 100 tons of ship.
MGT2.BridgeSizes = Object.freeze([
    {maxTons: 50, tons: 3},
    {maxTons: 99, tons: 6},
    {maxTons: 200, tons: 10},
    {maxTons: 1000, tons: 20},
    {maxTons: 2000, tons: 40},
    {maxTons: 100000, tons: 60}
]);

// `dm` applies to operations checks from the bridge; a command bridge's DM is Tactics (naval) only.
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

// Passage classes (Core p.158, p.238-239), priced by parsec for a single jump; `baggage` is in kg.
MGT2.PassageClasses = Object.freeze({
    high: {label: "MGT2.PassageClasses.high", baggage: 1000},
    middle: {label: "MGT2.PassageClasses.middle", baggage: 100},
    basic: {label: "MGT2.PassageClasses.basic", baggage: 10},
    low: {label: "MGT2.PassageClasses.low", baggage: 10, lowBerth: true},
    working: {label: "MGT2.PassageClasses.working", baggage: 100, unpaid: true}
});

// Screens (HG p.41). A count, not a flag: every five nuclear dampers strike off a further 1DD.
MGT2.ShipScreens = Object.freeze({
    nuclearDamper: {label: "MGT2.ShipScreens.nuclearDamper", tl: 12, tons: 10, power: 20, cost: 10000000},
    mesonScreen: {label: "MGT2.ShipScreens.mesonScreen", tl: 13, tons: 10, power: 30, cost: 20000000},
    blackGlobe: {label: "MGT2.ShipScreens.blackGlobe", tl: 15, tons: 50, power: 30, cost: 100000000}
});

// Ship software packages carrying a rating (Core p.161, HG p.73-75).
MGT2.ShipSoftware = Object.freeze({
    fireControl: {label: "MGT2.ShipSoftware.fireControl",
        names: ["fire control", "controle de tir"],
        unless: ["advanced fire control", "controle de tir avance"]},
    advancedFireControl: {label: "MGT2.ShipSoftware.advancedFireControl",
        names: ["advanced fire control", "controle de tir avance"]},
    evade: {label: "MGT2.ShipSoftware.evade", names: ["evade", "evitement"]},
    launchSolution: {label: "MGT2.ShipSoftware.launchSolution",
        names: ["launch solution", "solution de lancement"]},
    autoRepair: {label: "MGT2.ShipSoftware.autoRepair",
        names: ["auto-repair", "auto repair", "auto-reparation", "auto reparation"]},
    electronicWarfare: {label: "MGT2.ShipSoftware.electronicWarfare",
        names: ["electronic warfare", "guerre electronique"]},
    pointDefence: {label: "MGT2.ShipSoftware.pointDefence",
        names: ["point defence", "point defense", "defense a bout portant"]}
});

// HG p.20 scopes the /bis option to "Jump Control programs only". A name, and kept out of
// `ShipSoftware` above because that list is the fleet block's and Jump Control is no fleet DM.
MGT2.JumpControlSoftware = Object.freeze(["jump control", "controle de saut"]);

// HG p.113's four salvo-defence categories.
MGT2.FleetDefences = Object.freeze({
    // HG p.40's Type I/II/III batteries, laser and gauss alike.
    pointDefence: {
        label: "MGT2.FleetDefences.pointDefence",
        names: ["point defence", "point defense", "defense a bout portant"],
        types: {i: 4, ii: 8, iii: 12}
    },
    // p.113 counts per TURRET and not per weapon: 100 triple turrets would otherwise give the
    // Pantheress 500 lasers instead of its printed 300.
    laser: {
        label: "MGT2.FleetDefences.laser",
        names: ["beam laser", "pulse laser", "laser a faisceau", "lasers a faisceau",
            "laser a impulsion", "lasers a impulsion"],
        crewSkill: true,
        perMount: {doubleTurret: 1, tripleTurret: 2}
    },
    repulsor: {
        label: "MGT2.FleetDefences.repulsor",
        names: ["repulsor", "repulseur"],
        perMount: {smallBay: 5, mediumBay: 10, largeBay: 50}
    },
    // p.113 totals sandcasters per WEAPON, and only in turrets.
    sandcaster: {
        label: "MGT2.FleetDefences.sandcaster",
        names: ["sandcaster", "lance-sable", "lance sable"],
        perWeapon: true, turretsOnly: true
    }
});

// HG p.119. The defender's Crew Skill plus its Defensive DM, less the attacker's Offensive DM.
MGT2.SandcasterEffect = Object.freeze([
    {min: 3, multiplier: 1},
    {min: 1, multiplier: 0.75},
    {min: null, multiplier: 0.5}
]);

// HG p.113's Fleet Missile/Torpedo Damage tables with p.119's riders: a torpedo costs two points of
// Salvo Defence, `halvesDefensive` is the antiradiation one, `salvoPenalty` the multi-warhead's.
MGT2.FleetWarheads = Object.freeze({
    missileAdvanced: {label: "MGT2.FleetWarheads.missileAdvanced", damage: 5},
    missileAntimatter: {label: "MGT2.FleetWarheads.missileAntimatter", damage: 20},
    missileFragmentation: {label: "MGT2.FleetWarheads.missileFragmentation", damage: 3},
    missileLongRange: {label: "MGT2.FleetWarheads.missileLongRange", damage: 3},
    missileMultiWarhead: {label: "MGT2.FleetWarheads.missileMultiWarhead", damage: 3, salvoPenalty: 0.2},
    missileNuclear: {label: "MGT2.FleetWarheads.missileNuclear", damage: 10},
    missileStandard: {label: "MGT2.FleetWarheads.missileStandard", damage: 4},
    torpedoAdvanced: {label: "MGT2.FleetWarheads.torpedoAdvanced", damage: 7, torpedo: true},
    torpedoAntimatter: {label: "MGT2.FleetWarheads.torpedoAntimatter", damage: 30, torpedo: true},
    torpedoAntimatterBombPumped: {
        label: "MGT2.FleetWarheads.torpedoAntimatterBombPumped", damage: 8, torpedo: true},
    torpedoAntiradiation: {
        label: "MGT2.FleetWarheads.torpedoAntiradiation", damage: 6, torpedo: true, halvesDefensive: true},
    torpedoBombPumped: {label: "MGT2.FleetWarheads.torpedoBombPumped", damage: 4, torpedo: true},
    torpedoMultiAntimatter: {
        label: "MGT2.FleetWarheads.torpedoMultiAntimatter", damage: 10, torpedo: true, salvoPenalty: 0.2},
    torpedoMultiStandard: {
        label: "MGT2.FleetWarheads.torpedoMultiStandard", damage: 4, torpedo: true, salvoPenalty: 0.2},
    torpedoMultiNuclear: {
        label: "MGT2.FleetWarheads.torpedoMultiNuclear", damage: 6, torpedo: true, salvoPenalty: 0.2},
    torpedoNuclear: {label: "MGT2.FleetWarheads.torpedoNuclear", damage: 20, torpedo: true},
    torpedoPlasma: {label: "MGT2.FleetWarheads.torpedoPlasma", damage: 10, torpedo: true},
    torpedoStandard: {label: "MGT2.FleetWarheads.torpedoStandard", damage: 6, torpedo: true}
});

// HG p.119's Missile Flight table, "Medium and below" being immediate.
MGT2.MissileFlight = Object.freeze({
    adjacent: 0, close: 0, short: 0, medium: 0, long: 1, veryLong: 4, distant: 10
});

// HG p.121's Radiation Effects.
MGT2.FleetRadiation = Object.freeze([
    {exposures: 1, crewSkill: -1, salvo: 0, weapons: 0},
    {exposures: 2, crewSkill: -2, salvo: 0.25, weapons: 1},
    {exposures: 3, crewSkill: -3, salvo: 0.5, weapons: 2},
    {exposures: 4, crewSkill: -4, salvo: 0.75, weapons: 3},
    {exposures: 5, crewSkill: -4, salvo: 1, weapons: 3, disabled: true}
]);

// HG p.122's four Morale events and p.115's flag ship; `per` is the fraction each -1 is charged for.
MGT2.FleetMorale = Object.freeze({
    flagShip: {label: "MGT2.FleetMorale.flagShip", dm: 1},
    opposingLosses: {label: "MGT2.FleetMorale.opposingLosses", dm: 1, threshold: 0.5},
    opposingFlagship: {label: "MGT2.FleetMorale.opposingFlagship", dm: 1},
    ownLosses: {label: "MGT2.FleetMorale.ownLosses", dm: -1, per: 0.25},
    ownFlagship: {label: "MGT2.FleetMorale.ownFlagship", dm: -1}
});

// HG p.122's Fleet Dispersal table.
MGT2.FleetDispersal = Object.freeze([
    {min: 3, rounds: 1, dm: 0, label: "MGT2.FleetDispersal.exceptional"},
    {min: 1, rounds: 2, dm: 0, label: "MGT2.FleetDispersal.success"},
    {min: 0, rounds: 3, dm: -1, label: "MGT2.FleetDispersal.slow"},
    {min: null, rounds: 2, dm: -2, failed: true, label: "MGT2.FleetDispersal.failure"}
]);

// HG p.118's Attack Effectiveness table, and the whole of a fleet attack: nothing but a spinal
// mount rolls to hit.
MGT2.FleetEffectiveness = Object.freeze([
    {min: null, max: -6, multiple: 0},
    {min: -5, max: -4, multiple: 0.25},
    {min: -3, max: -2, multiple: 0.5},
    {min: -1, max: 0, multiple: 0.75},
    {min: 1, max: 2, multiple: 1},
    {min: 3, max: 4, multiple: 1.25},
    {min: 5, max: null, multiple: 1.5}
]);

// HG p.118's -2 against sub-100-ton targets.
MGT2.FleetSmallTarget = Object.freeze({
    underTons: 100, dm: -2,
    mounts: ["singleTurret", "doubleTurret", "tripleTurret", "barbette"]
});

// HG p.111-112's ion weapons inflict NO damage: Effect per Weapon times like weapons fired, divided
// by the target's adjusted Hull points and rounded down, is the Thrust or the weapon systems lost.
MGT2.FleetIon = Object.freeze({
    perWeapon: {barbette: 75, smallBay: 200, mediumBay: 500, largeBay: 3500},
    maxResult: 6,
    longDuration: 2,
    duration: 1
});

// HG p.111's five ship Traits.
MGT2.FleetTraits = Object.freeze({
    antirad: {label: "MGT2.FleetTraits.antirad",
        names: ["radiation shielding", "bouclier anti-radiations", "bouclier antiradiations"]},
    blackGlobe: {label: "MGT2.FleetTraits.blackGlobe",
        names: ["black globe", "sphere noire"]},
    fleetDefence: {label: "MGT2.FleetTraits.fleetDefence", software: "pointDefence"},
    hardened: {label: "MGT2.FleetTraits.hardened", names: ["hardened", "blindage em"]},
    // +10% of the FLEET Armour, which is the only figure a fleet attack subtracts.
    reflec: {label: "MGT2.FleetTraits.reflec", names: ["reflec"], armourBonus: 0.1}
});

// Which column of the Crew Requirements table a ship reads (HG p.23).
MGT2.ShipService = Object.freeze({
    commercial: "MGT2.ShipService.commercial",
    military: "MGT2.ShipService.military"
});

// Running costs (Core p.149, p.154, p.183; HG p.25).
MGT2.ShipCosts = Object.freeze({
    mortgageDivisor: 240,
    mortgageYears: 40,
    // p.153 calls the period four weeks (thirteen a year); p.154 divides the year by TWELVE to
    // price maintenance.
    mortgagePeriodsPerYear: 12,
    // What `mortgageFourWeekPeriods` reads instead: p.153's four weeks taken literally.
    mortgagePeriodsPerYearFourWeek: 13,
    // p.149: each Benefit roll of the same ship pays off a quarter, priced as ten years off the term.
    mortgageBenefitFraction: 0.25,
    mortgageBenefitYears: 10,
    maintenanceDivisor: 12000,
    lifeSupportPerStateroom: 1000,
    lifeSupportPerPerson: 1000,
    lifeSupportPerLowBerth: 100,
    fuelRefined: 500,
    fuelUnrefined: 100
});

// Core p.153's Skipping on Debts: 2D per new system, 8+ and the crew is hunted.
MGT2.SkipDebts = Object.freeze({
    target: 8,
    perParsec: -1,
    disguiseMax: 6,
    // "Per MCr10 of value of ship stolen: +1" — a rate over the purchase price, floored.
    creditsPerStep: 10000000,
    perStep: 1,
    revisited: 2,
    // "Add local Law Level -5", which is one term and not two: a Law Level of 5 is worth nothing.
    lawLevelOffset: -5,
    // Exclusive bands, and the second is the worst: a bank chases hardest just after the first miss.
    overdue: Object.freeze({
        under4: { dm: -4, label: "MGT2.SkipDebts.Overdue.under4" },
        weeks4: { dm: 4, label: "MGT2.SkipDebts.Overdue.weeks4" },
        weeks25: { dm: 2, label: "MGT2.SkipDebts.Overdue.weeks25" },
        overYear: { dm: 0, label: "MGT2.SkipDebts.Overdue.overYear" }
    })
});

// Fuel (HG p.18): 10% of the hull per parsec, and a tenth of the plant's tonnage every four weeks.
MGT2.ShipFuel = Object.freeze({
    jumpFraction: 0.10,
    plantFraction: 0.10,
    weeksPerPeriod: 4
});

// Free allowances per full 100 tons of hull (HG p.25, p.26), and the firmpoint ladder below that.
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

// Robot Size (Robot Handbook p.13). `attackDM` is the Small/Large trait score; Base Slots is fixed.
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

// Robot brains (Robot Handbook p.66).
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

// Robot locomotion (Robot Handbook p.16).
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

// Robot armour by TL band (RH p.19). `slotsPerPoint` is a percentage of Base Slots, never below one.
MGT2.RobotArmour = Object.freeze({
    tl6: {label: "MGT2.RobotArmour.tl6", minTL: 6, maxTL: 8, protection: 2, maxAdded: 20, slotsPerPoint: 1, maxPerSlot: 1, costPerSlot: 250},
    tl9: {label: "MGT2.RobotArmour.tl9", minTL: 9, maxTL: 11, protection: 3, maxAdded: 30, slotsPerPoint: 0.5, maxPerSlot: 2, costPerSlot: 1000},
    tl12: {label: "MGT2.RobotArmour.tl12", minTL: 12, maxTL: 14, protection: 4, maxAdded: 40, slotsPerPoint: 0.4, maxPerSlot: 3, costPerSlot: 1500},
    tl15: {label: "MGT2.RobotArmour.tl15", minTL: 15, maxTL: 17, protection: 4, maxAdded: 50, slotsPerPoint: 0.3, maxPerSlot: 4, costPerSlot: 2500},
    tl18: {label: "MGT2.RobotArmour.tl18", minTL: 18, maxTL: null, protection: 5, maxAdded: 60, slotsPerPoint: 0.25, maxPerSlot: 5, costPerSlot: 5000}
});

// RTG and solar replace the endurance chain and print a half-life in years (RH p.20, p.76).
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

// The campaign's own calendar, and the only one: `mgt2.campaignDay` counts days, the month derives.
MGT2.Calendar = Object.freeze({
    daysPerWeek: 7,
    daysPerMonth: 28
});

// Core p.257-258. The letter drives the fuel grade, the berthing rate and both traffic tables'
// Starport DM.
MGT2.Starports = Object.freeze({
    A: {label: "MGT2.Starports.A", fuel: "refined", berthingPerDie: 1000, trafficDM: 2, searchDM: 6},
    B: {label: "MGT2.Starports.B", fuel: "refined", berthingPerDie: 500, trafficDM: 1, searchDM: 4},
    C: {label: "MGT2.Starports.C", fuel: "unrefined", berthingPerDie: 100, trafficDM: 0, searchDM: 2},
    D: {label: "MGT2.Starports.D", fuel: "unrefined", berthingPerDie: 10, trafficDM: 0, searchDM: 0},
    E: {label: "MGT2.Starports.E", fuel: "none", berthingPerDie: 0, trafficDM: -1, searchDM: 0},
    X: {label: "MGT2.Starports.X", fuel: "none", berthingPerDie: null, trafficDM: -3, searchDM: 0}
});

// Read by BOTH traffic tables and with opposite signs (Core p.239, p.240), which is why the pair is
// stored rather than one number.
MGT2.TravelZones = Object.freeze({
    green: {label: "MGT2.TravelZones.green", passengerDM: 0, freightDM: 0},
    amber: {label: "MGT2.TravelZones.amber", passengerDM: 1, freightDM: -2},
    red: {label: "MGT2.TravelZones.red", passengerDM: -4, freightDM: -6, forbidden: true}
});

// The three profile digits that are unreadable without a table (Core p.250, p.252, p.253), indexed
// by the digit.
MGT2.Atmospheres = Object.freeze([
    {label: "MGT2.Atmospheres.0"}, {label: "MGT2.Atmospheres.1"},
    {label: "MGT2.Atmospheres.2"}, {label: "MGT2.Atmospheres.3"},
    {label: "MGT2.Atmospheres.4"}, {label: "MGT2.Atmospheres.5"},
    {label: "MGT2.Atmospheres.6"}, {label: "MGT2.Atmospheres.7"},
    {label: "MGT2.Atmospheres.8"}, {label: "MGT2.Atmospheres.9"},
    {label: "MGT2.Atmospheres.10"}, {label: "MGT2.Atmospheres.11"},
    {label: "MGT2.Atmospheres.12"}, {label: "MGT2.Atmospheres.13"},
    {label: "MGT2.Atmospheres.14"}, {label: "MGT2.Atmospheres.15"}
]);

// "The number of zeroes following a one" (Core p.252), so the label is the head count itself.
MGT2.Populations = Object.freeze([
    {label: "MGT2.Populations.0"}, {label: "MGT2.Populations.1"},
    {label: "MGT2.Populations.2"}, {label: "MGT2.Populations.3"},
    {label: "MGT2.Populations.4"}, {label: "MGT2.Populations.5"},
    {label: "MGT2.Populations.6"}, {label: "MGT2.Populations.7"},
    {label: "MGT2.Populations.8"}, {label: "MGT2.Populations.9"},
    {label: "MGT2.Populations.10"}, {label: "MGT2.Populations.11"},
    {label: "MGT2.Populations.12"}
]);

// Sixteen and not fourteen: the 2022 update prints E and F, and 2D−7+Population reaches both.
MGT2.Governments = Object.freeze([
    {label: "MGT2.Governments.0"}, {label: "MGT2.Governments.1"},
    {label: "MGT2.Governments.2"}, {label: "MGT2.Governments.3"},
    {label: "MGT2.Governments.4"}, {label: "MGT2.Governments.5"},
    {label: "MGT2.Governments.6"}, {label: "MGT2.Governments.7"},
    {label: "MGT2.Governments.8"}, {label: "MGT2.Governments.9"},
    {label: "MGT2.Governments.10"}, {label: "MGT2.Governments.11"},
    {label: "MGT2.Governments.12"}, {label: "MGT2.Governments.13"},
    {label: "MGT2.Governments.14"}, {label: "MGT2.Governments.15"}
]);

MGT2.WorldBases = Object.freeze({
    naval: "MGT2.WorldBases.naval",
    scout: "MGT2.WorldBases.scout",
    military: "MGT2.WorldBases.military",
    research: "MGT2.WorldBases.research",
    tas: "MGT2.WorldBases.tas",
    consulate: "MGT2.WorldBases.consulate",
    pirate: "MGT2.WorldBases.pirate"
});

// Core p.260-261: a world gains a code if it meets ALL the requirements, and may hold many at once.
MGT2.TradeCodes = Object.freeze([
    {code: "Ag", label: "MGT2.TradeCodes.Ag", condition: [["atmosphere", "4-9"], ["hydrographics", "4-8"], ["population", "5-7"]],
        test: u => (u.atmosphere >= 4) && (u.atmosphere <= 9) && (u.hydrographics >= 4)
            && (u.hydrographics <= 8) && (u.population >= 5) && (u.population <= 7)},
    {code: "As", label: "MGT2.TradeCodes.As", condition: [["size", "0"], ["atmosphere", "0"], ["hydrographics", "0"]],
        test: u => (u.size === 0) && (u.atmosphere === 0) && (u.hydrographics === 0)},
    {code: "Ba", label: "MGT2.TradeCodes.Ba", condition: [["population", "0"], ["government", "0"], ["lawLevel", "0"]],
        test: u => (u.population === 0) && (u.government === 0) && (u.lawLevel === 0)},
    {code: "De", label: "MGT2.TradeCodes.De", condition: [["atmosphere", "2-9"], ["hydrographics", "0"]],
        test: u => (u.atmosphere >= 2) && (u.atmosphere <= 9) && (u.hydrographics === 0)},
    {code: "Fl", label: "MGT2.TradeCodes.Fl", condition: [["atmosphere", "10+"], ["hydrographics", "1+"]],
        test: u => (u.atmosphere >= 10) && (u.hydrographics >= 1)},
    {code: "Ga", label: "MGT2.TradeCodes.Ga", condition: [["size", "6-8"], ["atmosphere", "5, 6, 8"], ["hydrographics", "5-7"]],
        test: u => (u.size >= 6) && (u.size <= 8) && [5, 6, 8].includes(u.atmosphere)
            && (u.hydrographics >= 5) && (u.hydrographics <= 7)},
    {code: "Hi", label: "MGT2.TradeCodes.Hi", condition: [["population", "9+"]], test: u => u.population >= 9},
    {code: "Ht", label: "MGT2.TradeCodes.Ht", condition: [["techLevel", "12+"]], test: u => u.techLevel >= 12},
    {code: "Ic", label: "MGT2.TradeCodes.Ic", condition: [["atmosphere", "0-1"], ["hydrographics", "1+"]],
        test: u => (u.atmosphere <= 1) && (u.hydrographics >= 1)},
    {code: "In", label: "MGT2.TradeCodes.In", condition: [["atmosphere", "0-2, 4, 7, 9-12"], ["population", "9+"]],
        test: u => [0, 1, 2, 4, 7, 9, 10, 11, 12].includes(u.atmosphere) && (u.population >= 9)},
    {code: "Lo", label: "MGT2.TradeCodes.Lo", condition: [["population", "1-3"]],
        test: u => (u.population >= 1) && (u.population <= 3)},
    {code: "Lt", label: "MGT2.TradeCodes.Lt", condition: [["population", "1+"], ["techLevel", "0-5"]],
        test: u => (u.population >= 1) && (u.techLevel <= 5)},
    {code: "Na", label: "MGT2.TradeCodes.Na", condition: [["atmosphere", "0-3"], ["hydrographics", "0-3"], ["population", "6+"]],
        test: u => (u.atmosphere <= 3) && (u.hydrographics <= 3) && (u.population >= 6)},
    {code: "Ni", label: "MGT2.TradeCodes.Ni", condition: [["population", "4-6"]],
        test: u => (u.population >= 4) && (u.population <= 6)},
    {code: "Po", label: "MGT2.TradeCodes.Po", condition: [["atmosphere", "2-5"], ["hydrographics", "0-3"]],
        test: u => (u.atmosphere >= 2) && (u.atmosphere <= 5) && (u.hydrographics <= 3)},
    {code: "Ri", label: "MGT2.TradeCodes.Ri", condition: [["atmosphere", "6, 8"], ["population", "6-8"], ["government", "4-9"]],
        test: u => [6, 8].includes(u.atmosphere) && (u.population >= 6) && (u.population <= 8)
            && (u.government >= 4) && (u.government <= 9)},
    {code: "Va", label: "MGT2.TradeCodes.Va", condition: [["atmosphere", "0"]], test: u => u.atmosphere === 0},
    {code: "Wa", label: "MGT2.TradeCodes.Wa", condition: [["atmosphere", "3-9, 13+"], ["hydrographics", "10+"]],
        test: u => (((u.atmosphere >= 3) && (u.atmosphere <= 9)) || (u.atmosphere >= 13))
            && (u.hydrographics >= 10)}
]);

/** Read a printed lookup table by a modified total. */
MGT2.readTable = (rows, total) => rows.find(row => (row.max === null) || (total <= row.max)) ?? rows.at(-1);

/** Read a D66 index. */
MGT2.readD66 = (table, tens, units) => table[`${tens}${units}`] ?? null;

/** Passenger and freight traffic. */
MGT2.Traffic = Object.freeze({
    // "Each parsec of destination past the first" — the one line neither end owns.
    perParsec: -1,

    passenger: Object.freeze({
        population: Object.freeze([
            {max: 1, dm: -4}, {max: 5, dm: 0}, {max: 7, dm: 1}, {max: null, dm: 3}]),
        // Core p.239 prints no Tech Level term for passengers at all.
        techLevel: null,
        zone: "passengerDM",
        // Core p.239 allows Carouse and p.240 does not, so the rolled skill decides which column.
        skills: Object.freeze(["broker", "carouse", "streetwise"]),
        // Four 2D, one per class, and only two of the four carry a DM of their own.
        classes: Object.freeze([
            {key: "high", label: "MGT2.Trade.Passage.high", dm: -4},
            {key: "middle", label: "MGT2.Trade.Passage.middle", dm: 0},
            {key: "basic", label: "MGT2.Trade.Passage.basic", dm: 0},
            {key: "low", label: "MGT2.Trade.Passage.low", dm: 1}
        ]),
        table: Object.freeze([
            {max: 1, dice: 0}, {max: 3, dice: 1}, {max: 6, dice: 2}, {max: 10, dice: 3},
            {max: 13, dice: 4}, {max: 15, dice: 5}, {max: 16, dice: 6}, {max: 17, dice: 7},
            {max: 18, dice: 8}, {max: 19, dice: 9}, {max: null, dice: 10}
        ])
    }),

    freight: Object.freeze({
        population: Object.freeze([
            {max: 1, dm: -4}, {max: 5, dm: 0}, {max: 7, dm: 2}, {max: null, dm: 4}]),
        techLevel: Object.freeze([{max: 6, dm: -1}, {max: 8, dm: 0}, {max: null, dm: 2}]),
        zone: "freightDM",
        // Core p.240 drops Carouse: a night out finds passengers and does not find cargo.
        skills: Object.freeze(["broker", "streetwise"]),
        // Three 2D. The table gives a COUNT OF LOTS and every lot rolls its own tonnage.
        classes: Object.freeze([
            {key: "incidental", label: "MGT2.Trade.Lot.incidental", dm: 2, tonsPerLot: 1, lotSize: "1D"},
            {key: "minor", label: "MGT2.Trade.Lot.minor", dm: 0, tonsPerLot: 5, lotSize: "1D×5"},
            {key: "major", label: "MGT2.Trade.Lot.major", dm: -4, tonsPerLot: 10, lotSize: "1D×10"}
        ]),
        // Not the passenger rows: freight reaches 3D at 6 and 6D at 15, one step earlier each.
        table: Object.freeze([
            {max: 1, dice: 0}, {max: 3, dice: 1}, {max: 5, dice: 2}, {max: 8, dice: 3},
            {max: 11, dice: 4}, {max: 14, dice: 5}, {max: 16, dice: 6}, {max: 17, dice: 7},
            {max: 18, dice: 8}, {max: 19, dice: 9}, {max: null, dice: 10}
        ])
    })
});

// Core p.239's Passage and Freight table, indexed by parsecs jumped.
MGT2.PassageFares = Object.freeze([
    Object.freeze({high: 9000, middle: 6500, basic: 2000, low: 700, freight: 1000}),
    Object.freeze({high: 14000, middle: 10000, basic: 3000, low: 1300, freight: 1600}),
    Object.freeze({high: 21000, middle: 14000, basic: 5000, low: 2200, freight: 2600}),
    Object.freeze({high: 34000, middle: 23000, basic: 8000, low: 3900, freight: 4400}),
    Object.freeze({high: 60000, middle: 40000, basic: 14000, low: 7200, freight: 8500}),
    Object.freeze({high: 210000, middle: 130000, basic: 55000, low: 27000, freight: 32000})
]);

/** One row of the Passage and Freight table, clamped to the six the book prints. */
MGT2.readFares = parsecs => MGT2.PassageFares[
    Math.min(MGT2.PassageFares.length, Math.max(1, Math.trunc(Number(parsecs)) || 1)) - 1];

// Core p.241: late cargo "reduces the amount paid by 1D+4 x 10%", so the worst late lot pays
// nothing at all, and mail inherits the clause.
MGT2.FreightDelivery = Object.freeze({
    latePenalty: "1d6 + 4",
    penaltyPerPoint: 10
});

// Core p.241. Mail is pass or fail on 12+, and its DM is the FREIGHT world total banded — the one
// place where one table's output is another table's input.
MGT2.MailTraffic = Object.freeze({
    target: 12,
    band: Object.freeze([
        {max: -10, dm: -2}, {max: -5, dm: -1}, {max: 4, dm: 0}, {max: 9, dm: 1}, {max: null, dm: 2}]),
    armedDM: 2,
    lowTechAt: 5,
    lowTechDM: -4,
    containers: "1d6",
    tonsPerContainer: 5,
    creditsPerContainer: 25000
});

/** One row of the Trade Goods table (Core p.244-245). */
const goods = (d66, key, availability, dice, multiplier, basePrice, purchase, sale, illegal = false) =>
    Object.freeze({
        d66, key, label: `MGT2.TradeGoods.${key}`, illegal,
        availability: availability && Object.freeze(availability),
        dice, multiplier, basePrice,
        purchase: Object.freeze(purchase.map(([code, dm]) => Object.freeze({code, dm}))),
        sale: Object.freeze(sale.map(([code, dm]) => Object.freeze({code, dm})))
    });

/**
 * The 36 rows of the Trade Goods table, keyed by their D66 index — also their insertion order,
 * since integer-like keys enumerate numerically.
 */
MGT2.TradeGoods = Object.freeze(Object.fromEntries([
    goods("11", "commonElectronics", null, 2, 10, 20000,
        [["In", 2], ["Ht", 3], ["Ri", 1]], [["Ni", 2], ["Lt", 1], ["Po", 1]]),
    goods("12", "commonIndustrial", null, 2, 10, 10000,
        [["Na", 2], ["In", 5]], [["Ni", 3], ["Ag", 2]]),
    goods("13", "commonManufactured", null, 2, 10, 20000,
        [["Na", 2], ["In", 5]], [["Ni", 3], ["Hi", 2]]),
    goods("14", "commonRawMaterials", null, 2, 20, 5000,
        [["Ag", 3], ["Ga", 2]], [["In", 2], ["Po", 2]]),
    goods("15", "commonConsumables", null, 2, 20, 500,
        [["Ag", 3], ["Wa", 2], ["Ga", 1], ["As", -4]], [["As", 1], ["Fl", 1], ["Ic", 1], ["Hi", 1]]),
    goods("16", "commonOre", null, 2, 20, 1000,
        [["As", 4]], [["In", 3], ["Ni", 1]]),
    goods("21", "advancedElectronics", ["In", "Ht"], 1, 5, 100000,
        [["In", 2], ["Ht", 3]], [["Ni", 1], ["Ri", 2], ["As", 3]]),
    goods("22", "advancedMachineParts", ["In", "Ht"], 1, 5, 75000,
        [["In", 2], ["Ht", 1]], [["As", 2], ["Ni", 1]]),
    goods("23", "advancedManufactured", ["In", "Ht"], 1, 5, 100000,
        [["In", 1]], [["Hi", 1], ["Ri", 2]]),
    goods("24", "advancedWeapons", ["In", "Ht"], 1, 5, 150000,
        [["Ht", 2]], [["Po", 1], ["amber", 2], ["red", 4]]),
    goods("25", "advancedVehicles", ["In", "Ht"], 1, 5, 180000,
        [["Ht", 2]], [["As", 2], ["Ri", 2]]),
    goods("26", "biochemicals", ["Ag", "Wa"], 1, 5, 50000,
        [["Ag", 1], ["Wa", 2]], [["In", 2]]),
    goods("31", "crystalsGems", ["As", "De", "Ic"], 1, 5, 20000,
        [["As", 2], ["De", 1], ["Ic", 1]], [["In", 3], ["Ri", 2]]),
    goods("32", "cybernetics", ["Ht"], 1, 1, 250000,
        [["Ht", 1]], [["As", 1], ["Ic", 1], ["Ri", 2]]),
    goods("33", "liveAnimals", ["Ag", "Ga"], 1, 10, 10000,
        [["Ag", 2]], [["Lo", 3]]),
    goods("34", "luxuryConsumables", ["Ag", "Ga", "Wa"], 1, 10, 20000,
        [["Ag", 2], ["Wa", 1]], [["Ri", 2], ["Hi", 2]]),
    goods("35", "luxuryGoods", ["Hi"], 1, 1, 200000,
        [["Hi", 1]], [["Ri", 4]]),
    goods("36", "medicalSupplies", ["Ht", "Hi"], 1, 5, 50000,
        [["Ht", 2]], [["In", 2], ["Po", 1], ["Ri", 1]]),
    goods("41", "petrochemicals", ["De", "Fl", "Ic", "Wa"], 1, 10, 10000,
        [["De", 2]], [["In", 2], ["Ag", 1], ["Lt", 2]]),
    goods("42", "pharmaceuticals", ["As", "De", "Hi", "Wa"], 1, 1, 100000,
        [["As", 2], ["Hi", 1]], [["Ri", 2], ["Lt", 1]]),
    goods("43", "polymers", ["In"], 1, 10, 7000,
        [["In", 1]], [["Ri", 2], ["Ni", 1]]),
    goods("44", "preciousMetals", ["As", "De", "Ic", "Fl"], 1, 1, 50000,
        [["As", 3], ["De", 1], ["Ic", 2]], [["Ri", 3], ["In", 2], ["Ht", 1]]),
    goods("45", "radioactives", ["As", "De", "Lo"], 1, 1, 1000000,
        [["As", 2], ["Lo", 2]], [["In", 3], ["Ht", 1], ["Ni", -2], ["Ag", -3]]),
    goods("46", "robots", ["In"], 1, 5, 400000,
        [["In", 1]], [["Ag", 2], ["Ht", 1]]),
    goods("51", "spices", ["Ga", "De", "Wa"], 1, 10, 6000,
        [["De", 2]], [["Hi", 2], ["Ri", 3], ["Po", 3]]),
    goods("52", "textiles", ["Ag", "Ni"], 1, 20, 3000,
        [["Ag", 7]], [["Hi", 3], ["Na", 2]]),
    goods("53", "uncommonOre", ["As", "Ic"], 1, 20, 5000,
        [["As", 4]], [["In", 3], ["Ni", 1]]),
    goods("54", "uncommonRawMaterials", ["Ag", "De", "Wa"], 1, 10, 20000,
        [["Ag", 2], ["Wa", 1]], [["In", 2], ["Ht", 1]]),
    goods("55", "wood", ["Ag", "Ga"], 1, 20, 1000,
        [["Ag", 6]], [["Ri", 2], ["In", 1]]),
    goods("56", "vehicles", ["In", "Ht"], 1, 10, 15000,
        [["In", 2], ["Ht", 1]], [["Ni", 2], ["Hi", 1]]),
    goods("61", "illegalBiochemicals", ["Ag", "Wa"], 1, 5, 50000,
        [["Wa", 2]], [["In", 6]], true),
    goods("62", "illegalCybernetics", ["Ht"], 1, 1, 250000,
        [["Ht", 1]], [["As", 4], ["Ic", 4], ["Ri", 8], ["amber", 6], ["red", 6]], true),
    goods("63", "illegalDrugs", ["As", "De", "Hi", "Wa"], 1, 1, 100000,
        [["As", 1], ["De", 1], ["Ga", 1], ["Wa", 1]], [["Ri", 6], ["Hi", 6]], true),
    goods("64", "illegalLuxuries", ["Ag", "Ga", "Wa"], 1, 1, 50000,
        [["Ag", 2], ["Wa", 1]], [["Ri", 6], ["Hi", 4]], true),
    goods("65", "illegalWeapons", ["In", "Ht"], 1, 5, 150000,
        [["Ht", 2]], [["Po", 6], ["amber", 8], ["red", 10]], true),
    Object.freeze({d66: "66", key: "exotics", label: "MGT2.TradeGoods.exotics",
        exotic: true, illegal: false, availability: [], dice: 0, multiplier: 0, basePrice: 0,
        purchase: Object.freeze([]), sale: Object.freeze([])})
].map(row => [row.d66, row])));

/**
 * The Modified Price table (Core p.243), read by `MGT2.readTable` with no new code: its printed "−3
 * or less" IS the open bottom row and "25+" the open top one.
 */
MGT2.ModifiedPrice = Object.freeze([
    {max: -3, purchase: 300, sale: 10},
    {max: -2, purchase: 250, sale: 20},
    {max: -1, purchase: 200, sale: 30},
    {max: 0, purchase: 175, sale: 40},
    {max: 1, purchase: 150, sale: 45},
    {max: 2, purchase: 135, sale: 50},
    {max: 3, purchase: 125, sale: 55},
    {max: 4, purchase: 120, sale: 60},
    {max: 5, purchase: 115, sale: 65},
    {max: 6, purchase: 110, sale: 70},
    {max: 7, purchase: 105, sale: 75},
    {max: 8, purchase: 100, sale: 80},
    {max: 9, purchase: 95, sale: 85},
    {max: 10, purchase: 90, sale: 90},
    {max: 11, purchase: 85, sale: 100},
    {max: 12, purchase: 80, sale: 105},
    {max: 13, purchase: 75, sale: 110},
    {max: 14, purchase: 70, sale: 115},
    {max: 15, purchase: 65, sale: 120},
    {max: 16, purchase: 60, sale: 125},
    {max: 17, purchase: 55, sale: 130},
    {max: 18, purchase: 50, sale: 140},
    {max: 19, purchase: 45, sale: 150},
    {max: 20, purchase: 40, sale: 160},
    {max: 21, purchase: 35, sale: 175},
    {max: 22, purchase: 30, sale: 200},
    {max: 23, purchase: 25, sale: 250},
    {max: 24, purchase: 20, sale: 300},
    {max: null, purchase: 15, sale: 400}
]);

// `otherBroker` is Core p.243's standing assumption, subtracted from both readings; `population`
// bands the TONNAGE roll alone (Core p.242) and never the price.
MGT2.SpeculativeTrade = Object.freeze({
    priceDice: 3,
    otherBroker: 2,
    // Core p.241: DM−1 per previous search on the same planet in the same month.
    attemptDM: -1,
    // Core p.242: a legal supplier never stocks 61-65, and a black market rolls 1D under a leading 6.
    illegalTens: 6,
    // Core p.242's hired local broker.
    localBrokerDM: 2,
    brokerFee: 10,
    fixerFee: 20,
    population: Object.freeze([{max: 3, dm: -3}, {max: 8, dm: 0}, {max: null, dm: 3}])
});

// The leading word of a transcribed component row (HG p.9-64).
MGT2.ComponentCategories = Object.freeze({
    hull: "MGT2.ComponentCategories.hull",
    armour: "MGT2.ComponentCategories.armour",
    mDrive: "MGT2.ComponentCategories.mDrive",
    rDrive: "MGT2.ComponentCategories.rDrive",
    jDrive: "MGT2.ComponentCategories.jDrive",
    powerPlant: "MGT2.ComponentCategories.powerPlant",
    fuel: "MGT2.ComponentCategories.fuel",
    bridge: "MGT2.ComponentCategories.bridge",
    computer: "MGT2.ComponentCategories.computer",
    sensors: "MGT2.ComponentCategories.sensors",
    weapon: "MGT2.ComponentCategories.weapon",
    screen: "MGT2.ComponentCategories.screen",
    stateroom: "MGT2.ComponentCategories.stateroom",
    cargo: "MGT2.ComponentCategories.cargo",
    software: "MGT2.ComponentCategories.software",
    option: "MGT2.ComponentCategories.option"
});

// Where a permanent characteristic change came from.
MGT2.CharacteristicLossSources = Object.freeze({
    ageing: "MGT2.CharacteristicLossSources.ageing",
    injury: "MGT2.CharacteristicLossSources.injury",
    event: "MGT2.CharacteristicLossSources.event",
    medicalCare: "MGT2.CharacteristicLossSources.medicalCare",
    ageingCrisisCare: "MGT2.CharacteristicLossSources.ageingCrisisCare",
    referee: "MGT2.CharacteristicLossSources.referee",
    // Compagnon p.40 lets a programme BUY a characteristic; the point goes here as a signed +1.
    training: "MGT2.CharacteristicLossSources.training"
});

// Core folio 49's two prices buy different things.
MGT2.CharacteristicCare = Object.freeze({
    perPoint: 5000,
    crisisFormula: "1D*10000",
    crisisFloor: 1
});

// The Core term, step by step, as the default order and not a law: a species frame declares its own
// sequence.
MGT2.CreationSteps = Object.freeze({
    elect: "MGT2.Chargen.Steps.elect",
    qualify: "MGT2.Chargen.Steps.qualify",
    basic: "MGT2.Chargen.Steps.basic",
    survival: "MGT2.Chargen.Steps.survival",
    event: "MGT2.Chargen.Steps.event",
    commission: "MGT2.Chargen.Steps.commission",
    advance: "MGT2.Chargen.Steps.advance",
    skill: "MGT2.Chargen.Steps.skill",
    ageing: "MGT2.Chargen.Steps.ageing",
    decide: "MGT2.Chargen.Steps.decide",
    nest: "MGT2.Chargen.Steps.nest",
    status: "MGT2.Chargen.Steps.status",
    continuation: "MGT2.Chargen.Steps.continuation",
    // Dependants gained on a check. Distinct from `nest`, a transfer between groups that gains nobody.
    household: "MGT2.Chargen.Steps.household"
});

// What a declared step's printed ladder of targets is read against.
MGT2.StepCheckIndices = Object.freeze({
    term: "MGT2.Chargen.StepCheckIndices.term",
    characteristic: "MGT2.Chargen.StepCheckIndices.characteristic"
});

// When a declared step's check fires.
MGT2.StepCheckTriggers = Object.freeze({
    everyTerm: "MGT2.Chargen.StepCheckTriggers.everyTerm",
    afterMishap: "MGT2.Chargen.StepCheckTriggers.afterMishap"
});

// The default frame's sequence, reconstructed from folio 8's section headings — the book prints no
// ordered list of a term's steps anywhere.
MGT2.CoreTermSequence = Object.freeze(["elect", "qualify", "basic", "survival", "event",
    "commission", "advance", "skill", "ageing", "decide"]);

// Folio 8's printed defaults, which a frame replaces.
MGT2.CreationDefaults = Object.freeze({ startAge: 18, termYears: 4, racialMaximum: 15,
    ageingFromTerm: 4, ageingFromAge: 34, ageingPerTerm: -1, ageingFlat: 0 });

// Folio 19's two commission gates, which are GENERAL rules and not a list of career names: the
// attempt is the first term of a career unless the named characteristic is high enough, and every
// term after the first costs a DM.
MGT2.CommissionGate = Object.freeze({
    characteristic: "social", min: 9, laterTermDM: -1
});

// Core p.49's Ageing table as EFFECTS: `physical` and `mental` are one entry per characteristic the
// Traveller chooses, each the number of points it loses — "pick this many, take that much off
// each".
MGT2.AgeingEffects = Object.freeze([
    { roll: -6, physical: [2, 2, 2], mental: [1] },
    { roll: -5, physical: [2, 2, 2], mental: [] },
    { roll: -4, physical: [2, 2, 1], mental: [] },
    { roll: -3, physical: [2, 1, 1], mental: [] },
    { roll: -2, physical: [1, 1, 1], mental: [] },
    { roll: -1, physical: [1, 1], mental: [] },
    { roll: 0, physical: [1], mental: [] },
    { roll: 1, physical: [], mental: [] }
]);

// University and the military academy are a KIND on the same `career` Item and not a document type
// of their own: what a Traveller ends up with is a term, an assignment and an event log either way.
MGT2.CareerKinds = Object.freeze({
    career: "MGT2.Chargen.CareerKinds.career",
    preCareer: "MGT2.Chargen.CareerKinds.preCareer"
});

// Six qualification modes across three fields: this one says whether a roll happens at all,
// `autoIf` carries the score that bypasses it and `requiresPermission` the referee's gate.
MGT2.QualificationEntry = Object.freeze({
    target: "MGT2.Chargen.Qualification.target",
    automatic: "MGT2.Chargen.Qualification.automatic",
    forcedOnly: "MGT2.Chargen.Qualification.forcedOnly"
});

// Four kinds: a species may substitute the whole roll, substitute only the characteristic supplying
// the DM, ADD a DM, or remove the roll entirely.
MGT2.QualificationOverrides = Object.freeze({
    none: "MGT2.Chargen.QualificationOverrides.none",
    wholeRoll: "MGT2.Chargen.QualificationOverrides.wholeRoll",
    characteristic: "MGT2.Chargen.QualificationOverrides.characteristic",
    addDM: "MGT2.Chargen.QualificationOverrides.addDM"
});

// How a record was entered and how it ended.
MGT2.CareerEntryModes = Object.freeze({
    qualified: "MGT2.Chargen.EntryModes.qualified",
    drafted: "MGT2.Chargen.EntryModes.drafted",
    draftedByEvent: "MGT2.Chargen.EntryModes.draftedByEvent",
    fallbackCareer: "MGT2.Chargen.EntryModes.fallbackCareer",
    assignmentChange: "MGT2.Chargen.EntryModes.assignmentChange",
    automatic: "MGT2.Chargen.EntryModes.automatic"
});

MGT2.CareerExitModes = Object.freeze({
    stillServing: "MGT2.Chargen.ExitModes.stillServing",
    voluntary: "MGT2.Chargen.ExitModes.voluntary",
    ejectedByMishap: "MGT2.Chargen.ExitModes.ejectedByMishap",
    forcedOutByAdvancement: "MGT2.Chargen.ExitModes.forcedOutByAdvancement",
    paroled: "MGT2.Chargen.ExitModes.paroled"
});

// The book's three values plus a fourth its own groups do not contain: the Prisoner picks a new
// assignment every term with no roll and no penalty.
MGT2.AssignmentChangeRules = Object.freeze({
    requalifyKeepRank: "MGT2.Chargen.AssignmentChange.requalifyKeepRank",
    newCareer: "MGT2.Chargen.AssignmentChange.newCareer",
    separateCareers: "MGT2.Chargen.AssignmentChange.separateCareers",
    free: "MGT2.Chargen.AssignmentChange.free"
});

// Which table basic training reads.
MGT2.BasicTrainingTables = Object.freeze({
    service: "MGT2.Chargen.BasicFrom.service",
    assignment: "MGT2.Chargen.BasicFrom.assignment"
});

// What a term PRODUCED, as facts rather than prose.
MGT2.TermOutcomes = Object.freeze({
    elected: "MGT2.Chargen.TermOutcomes.elected",
    basicTraining: "MGT2.Chargen.TermOutcomes.basicTraining",
    mishap: "MGT2.Chargen.TermOutcomes.mishap",
    commissioned: "MGT2.Chargen.TermOutcomes.commissioned",
    advanced: "MGT2.Chargen.TermOutcomes.advanced",
    // "Lose 1 rank … but you are not ejected from this career".
    demoted: "MGT2.Chargen.TermOutcomes.demoted",
    // The advancement roll came out at or under the terms spent in this career (folio 18): a forced
    // ending that is neither a failed survival nor a mishap.
    forcedOut: "MGT2.Chargen.TermOutcomes.forcedOut",
    // A natural 12: too valuable to lose (folio 18).
    mustContinue: "MGT2.Chargen.TermOutcomes.mustContinue",
    // A template-named leaving rule fired instead of the generic outcomes, which it DISPLACES.
    released: "MGT2.Chargen.TermOutcomes.released",
    skillRoll: "MGT2.Chargen.TermOutcomes.skillRoll",
    aged: "MGT2.Chargen.TermOutcomes.aged"
});

// The Prisoner's row 7 is a nested Prison Event sub-table, which is why "a 7 is always a Life
// Event" is a template row defaulting to Life Events rather than three lines of hard-coded routing.
MGT2.EventRow7 = Object.freeze({
    lifeEvent: "MGT2.Chargen.EventRow7.lifeEvent",
    own: "MGT2.Chargen.EventRow7.own"
});

// Ejection is a per-row FACT and not a rule with exceptions: the book prints "otherwise" in both
// directions, and a row may leave it to the Traveller.
MGT2.EjectionOutcomes = Object.freeze({
    ejects: "MGT2.Chargen.Ejection.ejects",
    stays: "MGT2.Chargen.Ejection.stays",
    choice: "MGT2.Chargen.Ejection.choice"
});

// What an event or mishap row does to the term's Benefit roll.
MGT2.BenefitRowEffects = Object.freeze({
    none: "MGT2.Chargen.BenefitEffects.none",
    keep: "MGT2.Chargen.BenefitEffects.keep",
    lose: "MGT2.Chargen.BenefitEffects.lose",
    grant: "MGT2.Chargen.BenefitEffects.grant",
    wipe: "MGT2.Chargen.BenefitEffects.wipe"
});

// Seven kinds, each with a printed source: an `autoSuccess` is deferred and player-directed, a
// `careerOffer` waives qualification and may be declined, a `careerBlock` is the exact inverse of
// an unlock, and a `grant` is N skills from a named table, surviving into the next term.
MGT2.TrayKinds = Object.freeze({
    dm: "MGT2.Chargen.TrayKinds.dm",
    autoSuccess: "MGT2.Chargen.TrayKinds.autoSuccess",
    unlock: "MGT2.Chargen.TrayKinds.unlock",
    prohibition: "MGT2.Chargen.TrayKinds.prohibition",
    grant: "MGT2.Chargen.TrayKinds.grant",
    careerOffer: "MGT2.Chargen.TrayKinds.careerOffer",
    // "You must take the Prisoner career in your next term" — the exact opposite of an offer rather
    // than a variant of one: nothing may be declined.
    careerForce: "MGT2.Chargen.TrayKinds.careerForce",
    careerBlock: "MGT2.Chargen.TrayKinds.careerBlock"
});

// What EARNS a tray entry, which is a different question from `expiresWhen`'s expiry.
MGT2.TrayConditions = Object.freeze({
    always: "MGT2.Chargen.TrayConditions.always",
    choice: "MGT2.Chargen.TrayConditions.choice",
    checkPassed: "MGT2.Chargen.TrayConditions.checkPassed",
    checkFailed: "MGT2.Chargen.TrayConditions.checkFailed"
});

// A row's career reference has three printed senses, and one field carrying all three made every
// one an offer: one row offers the Rogue career with qualification waived, seven compel the
// Prisoner, and one rolls on another career's Events table without entering it at all.
MGT2.RowCareerModes = Object.freeze({
    offer: "MGT2.Chargen.RowCareerModes.offer",
    force: "MGT2.Chargen.RowCareerModes.force",
    borrow: "MGT2.Chargen.RowCareerModes.borrow"
});

MGT2.TrayDurations = Object.freeze({
    oneShot: "MGT2.Chargen.TrayDurations.oneShot",
    thisCareer: "MGT2.Chargen.TrayDurations.thisCareer",
    restOfCreation: "MGT2.Chargen.TrayDurations.restOfCreation"
});

// A SET and not one value: "event bonuses to advancement rolls may be applied to commission rolls
// instead" makes the holder choose.
MGT2.TrayChecks = Object.freeze({
    qualification: "MGT2.Chargen.TrayChecks.qualification",
    survival: "MGT2.Chargen.TrayChecks.survival",
    advancement: "MGT2.Chargen.TrayChecks.advancement",
    commission: "MGT2.Chargen.TrayChecks.commission",
    benefit: "MGT2.Chargen.TrayChecks.benefit",
    graduation: "MGT2.Chargen.TrayChecks.graduation",
    elections: "MGT2.Chargen.TrayChecks.elections"
});

// Every check a standing modifier can bear on: the tray's seven, plus the frame-owned steps
// carrying a check of their own.
MGT2.CreationChecks = Object.freeze({
    ...MGT2.TrayChecks,
    nest: MGT2.CreationSteps.nest,
    status: MGT2.CreationSteps.status,
    continuation: MGT2.CreationSteps.continuation,
    household: MGT2.CreationSteps.household
});

MGT2.TrayScopes = Object.freeze({
    thisCareer: "MGT2.Chargen.TrayScopes.thisCareer",
    // "DM+2 to the qualification roll for your NEXT career".
    nextCareer: "MGT2.Chargen.TrayScopes.nextCareer",
    namedCareer: "MGT2.Chargen.TrayScopes.namedCareer",
    anyCareer: "MGT2.Chargen.TrayScopes.anyCareer",
    firstAfterGraduation: "MGT2.Chargen.TrayScopes.firstAfterGraduation"
});

// A printed cell is a small EXPRESSION and not a scalar, and one level of nesting covers every Core
// cell: `all` is `Deception, Persuade AND Stealth`, `oneOf` is `Drive OR Vacc Suit`.
MGT2.CellModes = Object.freeze({
    all: "MGT2.Chargen.CellModes.all",
    oneOf: "MGT2.Chargen.CellModes.oneOf"
});

// What one grant inside a cell hands over.
MGT2.CreationGrantKinds = Object.freeze({
    skill: "MGT2.Chargen.GrantKinds.skill",
    characteristic: "MGT2.Chargen.GrantKinds.characteristic",
    contact: "MGT2.Chargen.GrantKinds.contact",
    cash: "MGT2.Chargen.GrantKinds.cash",
    shipShare: "MGT2.Chargen.GrantKinds.shipShare",
    benefit: "MGT2.Chargen.GrantKinds.benefit",
    note: "MGT2.Chargen.GrantKinds.note"
});

// Plus the mode that lives on rank rows: `SOC 10 or SOC +1, whichever is higher` is max(current +
// 1, floor).
MGT2.GrantModes = Object.freeze({
    raise: "MGT2.Chargen.GrantModes.raise",
    atLeast: "MGT2.Chargen.GrantModes.atLeast",
    add: "MGT2.Chargen.GrantModes.add",
    floor: "MGT2.Chargen.GrantModes.floor"
});

// Other Benefits are RIGHTS WITH LIMITS and not objects — "any armour up to Cr10000 and TL12" —
// because the system has no catalogue and never will.
MGT2.BenefitKinds = Object.freeze({
    voucher: "MGT2.Chargen.BenefitKinds.voucher",
    characteristic: "MGT2.Chargen.BenefitKinds.characteristic",
    cash: "MGT2.Chargen.BenefitKinds.cash",
    skill: "MGT2.Chargen.BenefitKinds.skill",
    ship: "MGT2.Chargen.BenefitKinds.ship",
    shipShare: "MGT2.Chargen.BenefitKinds.shipShare",
    membership: "MGT2.Chargen.BenefitKinds.membership"
});

// The repeat clause is not always "another one, or a skill level instead": that hedge hid four real
// shapes, and the mortgaged ships stack a quarter at a time up to outright ownership.
MGT2.BenefitRepeats = Object.freeze({
    another: "MGT2.Chargen.BenefitRepeats.another",
    skillLevel: "MGT2.Chargen.BenefitRepeats.skillLevel",
    upgradeCeiling: "MGT2.Chargen.BenefitRepeats.upgradeCeiling",
    improveExisting: "MGT2.Chargen.BenefitRepeats.improveExisting",
    stackMortgage: "MGT2.Chargen.BenefitRepeats.stackMortgage",
    reroll: "MGT2.Chargen.BenefitRepeats.reroll",
    convert: "MGT2.Chargen.BenefitRepeats.convert"
});

// Named tracks: the Prisoner's Parole Threshold is the numeric one, Aslan Outcast, K'kree caste,
// Zhodani class and Hiver status the enumerated ones.
MGT2.TrackKinds = Object.freeze({
    numeric: "MGT2.Chargen.TrackKinds.numeric",
    enumerated: "MGT2.Chargen.TrackKinds.enumerated"
});

/**
 * Everything to the end of the creation block is ARITHMETIC the chapter prints once and every
 * career reads: numbers a rule states in prose, not content a publisher owns.
 */

// Folio 9's printed order, which is also the harsher method: assign in this sequence rather than
// choosing.
MGT2.RolledCharacteristics = Object.freeze(["strength", "dexterity", "endurance", "intellect",
    "education", "social"]);

// Folio 18's two skill limits and folio 9's background-skill count.
MGT2.CreationLimits = Object.freeze({
    skillLevel: 4,
    skillCapFactor: 3,
    skillCapCharacteristics: Object.freeze(["intellect", "education"]),
    // "A number of background skills equal to your EDU DM +3 (so, 0 to 6)".
    backgroundBase: 3,
    backgroundMin: 0,
    backgroundMax: 6,
    // Folio 19's Connections Rule: at most two, each with a DIFFERENT Traveller, never above level
    // 3 and never Jack-of-All-Trades — named in both spellings the system targets.
    connections: 2,
    connectionLevel: 3,
    connectionExcluded: Object.freeze(["Jack-of-All-Trades", "Polyvalent"])
});

// Folio 46-48's mustering out.
MGT2.MusterOut = Object.freeze({
    // "You may only roll on the Cash column a maximum of three times across all your careers."
    cashRolls: 3,
    // Folio 46's Benefits of Rank.
    rankBonus: Object.freeze([
        Object.freeze({ upTo: 0, rolls: 0, dm: 0 }),
        Object.freeze({ upTo: 2, rolls: 1, dm: 0 }),
        Object.freeze({ upTo: 4, rolls: 2, dm: 0 }),
        Object.freeze({ upTo: 6, rolls: 3, dm: 1 })
    ]),
    // "A Traveller with the Gambler skill gains DM+1 to all rolls on Cash columns" — any level of it.
    cashSkill: Object.freeze({ skills: Object.freeze(["Gambler", "Flambeur"]), dm: 1 }),
    // Folio 48's five rows are one progression, which is what "Cr2000 per term beyond 8" continues.
    pension: Object.freeze({ fromTerms: 5, base: 10000, perTerm: 2000 }),
    // Two pensions that are not the pension: a ship given up, and a Ship Share never spent on a hull.
    shipForgone: 25000,
    shipShareUnspent: 1000,
    shipShareValue: 1000000,
    // "They may purchase personal equipment worth up to Cr10000 before they start adventuring."
    preplayEquipment: 10000
});

// Folio 228's Psionic Training table.
MGT2.PsionicTraining = Object.freeze({
    talents: Object.freeze([
        Object.freeze({ key: "telepathy", dm: 4, skills: Object.freeze(["Telepathy", "Télépathie"]) }),
        Object.freeze({ key: "clairvoyance", dm: 3, skills: Object.freeze(["Clairvoyance"]) }),
        Object.freeze({ key: "telekinesis", dm: 2, skills: Object.freeze(["Telekinesis", "Télékinésie"]) }),
        Object.freeze({ key: "awareness", dm: 1, skills: Object.freeze(["Awareness", "Conscience"]) }),
        Object.freeze({ key: "teleportation", dm: 0, skills: Object.freeze(["Teleportation", "Téléportation"]) })
    ]),
    perAttempt: -1,
    // The psionics chapter prints no difficulty for the learning check; folio 61 covers that case.
    difficulty: "Average",
    // "If a Traveller chooses Telepathy as their first talent, it will be gained automatically."
    freeFirst: "telepathy",
    // PSI is `2D − the terms served so far`, and one species tests it without the subtraction.
    formula: "2D",
    // A learned talent arrives at level 0.
    level: 0
});

/* Post-career training. Core p.55's Study Periods and Compagnon p.39-40's Experience Points are two
 * ways of moving one record, so the engine is a property of the programme and not of the world. */

// Core p.55: "A Study Period is equal to eight weeks (or two months) of study and practice."
MGT2.TrainingPeriodWeeks = 8;

// Which book runs a programme.
MGT2.AdvancementEngines = Object.freeze({
    core: "MGT2.Training.Engine.core",
    companion: "MGT2.Training.Engine.companion"
});

// Core trains skills; Compagnon p.40 also buys characteristics.
MGT2.TrainingTargets = Object.freeze({
    skill: "MGT2.Training.Target.skill",
    characteristic: "MGT2.Training.Target.characteristic"
});

// ONE log, both engines, because every row is the same sentence: something happened, it may have
// involved a check, and it moved the programme by an amount.
MGT2.TrainingLogKinds = Object.freeze({
    period: "MGT2.Training.LogKind.period",
    study: "MGT2.Training.LogKind.study",
    fullTime: "MGT2.Training.LogKind.fullTime",
    teaching: "MGT2.Training.LogKind.teaching",
    adventure: "MGT2.Training.LogKind.adventure",
    grant: "MGT2.Training.LogKind.grant"
});

// Compagnon p.40's two price tables.
MGT2.TrainingCosts = Object.freeze({
    skill: Object.freeze([1, 1, 2, 4, 8, 16, 32]),
    mental: Object.freeze(["intellect", "education"]),
    physical: Object.freeze(["strength", "dexterity", "endurance"])
});

// Core p.55: Athletics does not use EDU but "the appropriate physical characteristics (STR, DEX or
// END)".
MGT2.AthleticsTraining = Object.freeze({
    skills: Object.freeze(["athletics", "athlétisme"]),
    specialities: Object.freeze({
        strength: Object.freeze(["strength", "force"]),
        dexterity: Object.freeze(["dexterity", "dextérité"]),
        endurance: Object.freeze(["endurance"])
    })
});

// What a drug leaves behind when it wears off.
MGT2.DrugAfterKinds = Object.freeze({
    none: "MGT2.DrugAfterKinds.none",
    condition: "MGT2.DrugAfterKinds.condition",
    damage: "MGT2.DrugAfterKinds.damage"
});

// What resets a per-Traveller dose counter — state that outlives the drug.
MGT2.DoseResets = Object.freeze({
    never: "MGT2.DoseResets.never",
    sleep: "MGT2.DoseResets.sleep",
    day: "MGT2.DoseResets.day"
});

// The intervals a drug's `onset` and `duration` can be written in, so that "10 minutes" and "1D
// hours" become a duration Foundry counts down. ⚠ `unit` is a v14
// `CONST.ACTIVE_EFFECT_DURATION_UNITS` name and NOT a count of seconds: v14 stores `{value,
// units}`, and writing `duration.seconds` goes through `#migrateDuration`'s legacy shim and loses
// the printed unit.
MGT2.DoseUnits = Object.freeze({
    // Core folio 73: a combat round is six seconds, and the one interval Foundry is let to advance.
    round: { unit: "rounds", per: 1, words: Object.freeze(["round", "rounds", "tour", "tours"]) },
    second: { unit: "seconds", per: 1, words: Object.freeze(["second", "seconds", "seconde", "secondes"]) },
    minute: { unit: "minutes", per: 1, words: Object.freeze(["minute", "minutes"]) },
    hour: { unit: "hours", per: 1, words: Object.freeze(["hour", "hours", "heure", "heures"]) },
    day: { unit: "days", per: 1, words: Object.freeze(["day", "days", "jour", "jours", "journee", "journees"]) },
    week: { unit: "days", per: 7, words: Object.freeze(["week", "weeks", "semaine", "semaines"]) }
});

// Companion p.59-64. `physicalOnly` separates the two directions: low gravity costs physical checks
// alone, high gravity costs every check.
MGT2.GravityBands = Object.freeze({
    micro: {label: "MGT2.GravityBands.micro", gees: 0.01, dm: -1, physicalOnly: true},
    minimal: {label: "MGT2.GravityBands.minimal", gees: 0.1, dm: -1, physicalOnly: true},
    veryLow: {label: "MGT2.GravityBands.veryLow", gees: 0.4, dm: -1, physicalOnly: true},
    low: {label: "MGT2.GravityBands.low", gees: 0.7, dm: -1, physicalOnly: true},
    standard: {label: "MGT2.GravityBands.standard", gees: 1, dm: 0, physicalOnly: false},
    high: {label: "MGT2.GravityBands.high", gees: 1.4, dm: -1, physicalOnly: false},
    extreme: {label: "MGT2.GravityBands.extreme", gees: 2.5, dm: -2, physicalOnly: false}
});

// How often a hazard bites — and only `round` has an event behind it.
MGT2.HazardClocks = Object.freeze({
    round: {label: "MGT2.HazardClocks.round", scheduled: true},
    minute: {label: "MGT2.HazardClocks.minute", scheduled: false},
    hour: {label: "MGT2.HazardClocks.hour", scheduled: false},
    day: {label: "MGT2.HazardClocks.day", scheduled: false}
});

// Companion p.65-71. Hard vacuum escalates a die per round; the thinner two do not.
MGT2.VacuumPressures = Object.freeze({
    hard: {label: "MGT2.VacuumPressures.hard", cumulative: true},
    partial: {label: "MGT2.VacuumPressures.partial", cumulative: false},
    minimal: {label: "MGT2.VacuumPressures.minimal", cumulative: false}
});

// The suit's state rather than the region's: a breach shifts the whole table instead of adding to it.
MGT2.SuitBreaches = Object.freeze({
    none: "MGT2.SuitBreaches.none",
    minor: "MGT2.SuitBreaches.minor",
    major: "MGT2.SuitBreaches.major"
});

// WHERE A SECTOR SITS, and what its subsectors are called.
MGT2.Sectors = Object.freeze({
    "Spinward Marches": {x: -4, y: -1, subsectors: Object.freeze({
        A: "Cronor", B: "Jewell", C: "Regina", D: "Aramis", E: "Querion", F: "Vilis",
        G: "Lanth", H: "Rhylanor", I: "Darrian", J: "Sword Worlds", K: "Lunion", L: "Mora",
        M: "Five Sisters", N: "District 268", O: "Glisten", P: "Trin's Veil"
    })},
    "Deneb": {x: -3, y: -1, subsectors: Object.freeze({
        A: "Pretoria", B: "Lamas", C: "Antra", D: "Million", E: "Sabine", F: "Inar",
        G: "Dunmag", H: "Atsah", I: "Star Lane", J: "Vincennes", K: "Usani", L: "Geniishir",
        M: "Gulf", N: "Zeng", O: "Kamlar", P: "Vast Heavens"
    })},
    "Foreven": {x: -5, y: -1, subsectors: Object.freeze({
        D: "Massina", H: "Fessor", L: "Reidain", P: "Urnian"
    })},
    "Kruse": {x: 0, y: 9, subsectors: Object.freeze({
        A: "Adams", B: "Barratt", C: "Chase", D: "Drower", E: "Eberhardt", F: "French",
        G: "Gower", H: "Hagan", I: "Ivy", J: "Jain", K: "Kane", L: "Luomala", M: "Mullings",
        N: "Neyzi", O: "Osthoff", P: "Pletneva"
    })},
    "Lubbock": {x: -1, y: 7, subsectors: Object.freeze({
        H: "Horden"
    })},
    "Xuanzang": {x: -2, y: 15, subsectors: Object.freeze({
        M: "Moksadeva"
    })}
});
