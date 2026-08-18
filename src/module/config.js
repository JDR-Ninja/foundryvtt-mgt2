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

// Core folio 59 charges DM-3 for a check the roller has no applicable skill for, and folio 69's
// Jack-of-All-Trades "reduces the unskilled penalty ... by one for every level" — with "no benefit
// for having Jack-of-All-Trades 0 or Jack-of-All-Trades 4 or higher", which is what `max` caps. A
// skill is a free-text Item with no registry behind it, so `skills` is the list of names one is
// matched against; both books' names are listed because the system ships English packs and targets
// a French translation, and a world that renames the skill states its own name here.
MGT2.Untrained = Object.freeze({
    dm: -3,
    max: 3,
    skills: Object.freeze(["Jack-of-All-Trades", "Polyvalent"])
});

// Core folio 75. A Traveller who "sustains damage while performing an Extended Action" makes "an
// immediate check with the skill they are currently using, with the amount of damage sustained as a
// negative DM" — `dm` is per point, which is what lets the prompt take the damage rather than a DM
// the referee has to negate by hand. Failure loses the round's work and `ruin` is the Effect at or
// below which "the Traveller will have to start again from scratch"; the check itself is any skill
// check, so nothing here decides which one.
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

// The two jump procedures, which differ in SHAPE and not in numbers (§9.33.10 Q1). Core folio 158
// chains the astrogator's Effect into the engineer's check and reads its outcome off that check
// alone; Companion folio 152 triggers on the SUM of both Effects, so neither roll can resolve first.
// The enum decides which of `MGT2.Misjumps` below is read, so it is load-bearing rather than
// declarative: the precedence rule the books print only holds if something states which is in force.
MGT2.JumpRulesets = Object.freeze({
    core: "MGT2.Voyage.RulesetCore",
    companion: "MGT2.Voyage.RulesetCompanion"
});

// What a jump does when it goes wrong, under whichever procedure the hull declares (§9.89).
//
// Every row is read by `MGT2.readTable`, so the bands are the printed ones and the open end carries
// `max: null`. A `parsecs`, `days`, `hours` or `diameters` value is a DICE EXPRESSION as the book
// prints it — `MGT2Helper.damageFormula` normalises `2D` and `1D3` — and a row that states a rule
// without a number carries a label alone.
MGT2.Misjumps = Object.freeze({
    // Core folio 158 reads the FAILED Engineer (j-drive) check's Effect and nothing else: there is
    // no second roll and no table to roll on, which is the whole difference from the Companion.
    // Three outcomes, and the third is the one the folio hands to "a merciful referee" — printed as
    // an option rather than as a result, so it is named as such and never rolled for.
    core: Object.freeze({
        outcomes: Object.freeze([
            { max: -3, label: "MGT2.Jump.Core.Adrift", parsecs: "1D*1D", merciful: true },
            { max: -2, label: "MGT2.Jump.Core.Displaced", diameters: "1D" },
            // The extra 1D is the crew's PERCEIVED time, which the folio also makes optional.
            { max: -1, label: "MGT2.Jump.Core.Late", days: "1D", perceived: "1D" },
            { max: null, label: "MGT2.Jump.Core.Clean", clean: true }
        ])
    }),

    // Companion folios 150-153. Two independent checks, two variance tables read off one Effect
    // each, and a misjump trigger that reads their SUM — so nothing here can resolve until both
    // rolls exist, and that is what makes it not a chain.
    companion: Object.freeze({
        // Folio 152: "A Misjump occurs if the sum of the Effect achieved by the astrogator and
        // engineer is 0 or less." Both checks failed is a SERIOUS misjump; one failed against a
        // larger success is a misjump averted, and the folio still imposes a Bad Jump for it.
        trigger: 0,

        // Folio 151, 2D + the astrogator's Effect. The value is the emergence distance in
        // diameters, not a variance — a model jump comes out at 105 and the best plot at exactly
        // 100. Under 100 the ship is precipitated at the limit (folio 150).
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

        // Folio 151, 2D + the engineer's Effect. This one IS a variance, around the 160-hour
        // baseline the folio restates on 154 — so the last row, printed "160 Hours exactly", is the
        // baseline with no variance at all rather than a duration of its own.
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

        // Folio 153, 2D with the COMBINED Effect as a DM. The trigger caps the sum at 0, so the
        // table can never be read above 12 — the open end is there for the shape, not for a case.
        table: Object.freeze([
            { max: 2, label: "MGT2.Jump.Misjump.Lost" },
            { max: 4, label: "MGT2.Jump.Misjump.Wrecked", parsecs: "1D*1D" },
            { max: 6, label: "MGT2.Jump.Misjump.Severe", parsecs: "2D" },
            { max: 8, label: "MGT2.Jump.Misjump.Scattered", parsecs: "1D" },
            { max: 10, label: "MGT2.Jump.Misjump.Recalibrate", days: "1D", work: "1D3" },
            { max: null, label: "MGT2.Jump.Misjump.Rough", diameters: "100*2D" }
        ]),

        // Folio 152. ⚠ The printed table overlaps: minor repairs are banded 6-8 and major repairs
        // 7-9, so 7 and 8 name two outcomes. Verified in the PDF as well as in the corpus — it is
        // the book's error, not the extraction's. Read top down as a referee reads the page: the
        // first band that contains the roll wins, which keeps both printed strings and both printed
        // upper bounds and moves only the lower bound the overlap made unreadable (§9.89).
        veryBad: Object.freeze([
            { max: 2, label: "MGT2.Jump.VeryBad.None" },
            { max: 5, label: "MGT2.Jump.VeryBad.Recalibration", days: "2D" },
            { max: 8, label: "MGT2.Jump.VeryBad.MinorRepairs" },
            { max: 9, label: "MGT2.Jump.VeryBad.MajorRepairs" },
            { max: 12, label: "MGT2.Jump.VeryBad.Intrusions", hullPerDay: "2D-2" },
            { max: null, label: "MGT2.Jump.VeryBad.SevereIntrusions", hullPerDay: "2D+10" }
        ]),

        // Folio 152, and the sentence that makes it computable: "Only one modifier is used — the
        // Referee should use the highest applicable to the ship." So this is a max over what
        // applies, never a sum. Two of the four are read off the reading itself; gravity is the
        // referee's, because nothing on this screen knows where the ship fired its drive.
        veryBadDMs: Object.freeze({
            bothVariances: -4,
            precipitation: -2,
            misjump: 0,
            significant: 2,
            serious: 4
        }),

        // Folio 151-152. Everyone aboard, which is why nothing here rolls it: the system states the
        // pair and the table takes it. "One of these checks is at Routine (6+) difficulty and the
        // other at Difficult (10+) … A Traveller can choose which check is taken at each level."
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

// The referee's half of folio 152's Very Bad Jump ladder: where the drive was fired. Nothing on the
// voyage screen tracks a position (§9.33.10 Q4 declined the counter that would have), so this is
// typed and not derived.
MGT2.JumpGravity = Object.freeze({
    none: "MGT2.Jump.Gravity.none",
    significant: "MGT2.Jump.Gravity.significant",
    serious: "MGT2.Jump.Gravity.serious"
});

// Core folio 78. To grapple is to make "an opposed Melee (unarmed) check … each using either STR or
// DEX DM", so nothing declares a grapple: the skill rolled and the prompt's Opposed row ARE the
// declaration. `skills` is what the rolled skill's free-text name is matched against, the device
// `MGT2.FirstAidSkills` already uses; both books' names are listed because the system ships English
// packs and targets a French translation, and a speciality answers its skill — so Melee (unarmed),
// (natural) and (blade) all qualify. A world that renames the skill states its own name here.
//
// `outcomes` is the winner's menu in the order the folio prints it, and each row is a NAME plus the
// figure the folio attaches to it — never what the outcome does, the same rule the trait registry
// follows. Only two carry a number the system computes: `base` is the damage "equal to 2 + the
// Effect of the Melee check", which "ignores any armour"; `distance` and `damage` are the throw's
// own two dice, and they meet armour like any other wound because the folio exempts only the first.
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
    prone: {label: "MGT2.AttackModifiers.prone", dm: -1},
    // Core folio 78, and not part of that table: attacking with two one-handed weapons costs "DM-2
    // to the attack rolls of both" and the Traveller "may not aim with either". `suppress` is the
    // same forfeit folio 79 gives burst and full auto, so one wiring greys the aiming ladder out.
    // Two blades is as much a pair as two pistols, so this is not a ranged-only row.
    dualWeapons: {label: "MGT2.AttackModifiers.dualWeapons", dm: -2, suppress: "aiming"}
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
// prefix-insensitively, to decide whether its card offers the first-aid button. Both books' names
// are listed because the system ships English packs and targets a French translation, and a world
// that renames the skill states its own name here. Lowercase and accented, because
// `MGT2Helper.isFirstAidSkill` lowercases only the ROLLED name before its `startsWith`.
MGT2.FirstAidSkills = Object.freeze(["medic", "médecine"]);

// CSC folio 66 is a later printing of Core folio 110's section and adds one exception the Core does
// not carry: "The exception to this is the Interface program … it will run in conjunction with one
// other Bandwidth 0 program on other Computer/0 devices." Which program it is, is a name and nothing
// else — same shape as `FirstAidSkills` above, and Modül's Catalogue prints it *Interface* too, so
// one entry serves both languages (§9.130).
MGT2.InterfaceSoftware = Object.freeze(["interface"]);

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

// Core p.61's Boon and Bane, as the one thing a check can be in: tri-state, never a count and never
// a stack, so a Boon and a Bane cancel to plain 2D rather than adding up. Declared in the order the
// strip draws and the roll prompt's own footer already reads, Bane left of Boon.
MGT2.Stance = Object.freeze({
    bane: "MGT2.Request.Stance.bane",
    none: "MGT2.Request.Stance.none",
    boon: "MGT2.Request.Stance.boon"
});

// What a referee is asking of several Travellers at once. Binary, because Traveller prints exactly
// one "everyone rolls the same check" (Initiative, p.73) and no aggregation rule for it: `solo` is N
// rollers with N graded consequences, `together` is Core p.63-64's one resolver taking the rest as
// a task chain. Anything that sums Effects is a rule the books do not have.
MGT2.RequestTally = Object.freeze({
    solo: "MGT2.Request.Tally.solo",
    together: "MGT2.Request.Tally.together"
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
    Hours: "MGT2.Durations.Hours"
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
    // `turret` because HG p.113 counts sandcasters and salvo-defence lasers "installed in turrets"
    // and nowhere else, which is a property of the mount rather than of the weapon in it.
    singleTurret: {label: "MGT2.ShipMounts.singleTurret", tons: 1, weapons: 1, hardpoints: 1, damageMultiple: 1, turret: true},
    doubleTurret: {label: "MGT2.ShipMounts.doubleTurret", tons: 1, weapons: 2, hardpoints: 1, damageMultiple: 1, turret: true},
    tripleTurret: {label: "MGT2.ShipMounts.tripleTurret", tons: 1, weapons: 3, hardpoints: 1, damageMultiple: 1, turret: true},
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

// Passage classes (Core p.158, p.238-239). A passage is priced by parsec and is for a single jump;
// `baggage` is what the class allows aboard, in kilograms. A working passage is paid in labour, so a
// ship never counts one as a fare-paying berth — which is why `passengers` declares only the first
// four and the accommodation list skips whatever it does not.
MGT2.PassageClasses = Object.freeze({
    high: {label: "MGT2.PassageClasses.high", baggage: 1000},
    middle: {label: "MGT2.PassageClasses.middle", baggage: 100},
    basic: {label: "MGT2.PassageClasses.basic", baggage: 10},
    low: {label: "MGT2.PassageClasses.low", baggage: 10, lowBerth: true},
    working: {label: "MGT2.PassageClasses.working", baggage: 100, unpaid: true}
});

// Screens (HG p.41). A count and not a flag: every five nuclear dampers reduce a Destructive
// weapon's damage by a further 1DD, which a boolean cannot express.
MGT2.ShipScreens = Object.freeze({
    nuclearDamper: {label: "MGT2.ShipScreens.nuclearDamper", tl: 12, tons: 10, power: 20, cost: 60000000},
    mesonScreen: {label: "MGT2.ShipScreens.mesonScreen", tl: 13, tons: 10, power: 30, cost: 60000000},
    blackGlobe: {label: "MGT2.ShipScreens.blackGlobe", tl: 15, tons: 50, power: 30, cost: 100000000}
});

// The ship software packages that carry a rating something reads (Core p.161, HG p.73-75). A package
// is a `component` Item of category `software` and its rating is `ComponentData.rating`, so the name
// is all there is to recognise it by — which is why this follows §9.75 and lists Modül's French name
// beside the English one. Names are matched lower-cased and stripped of diacritics, so a world that
// typed `Evitement` still answers; a world that renames a package states its own name here.
//
// `unless` exists for one pair: HG p.73 says Advanced Fire Control does not stack with Fire Control,
// and the second name contains the first.
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

// HG p.113's four salvo-defence categories, and what one unit of each is worth. A ship's weapons
// carry no class of their own — `mounts[].weapons` is empty on all 341 packed hulls and the weapon
// is printed in the mount's free-text `label` — so a class is recognised by NAME, which is §9.75's
// rule and `ShipSoftware`'s shape: English and Modül's French, matched lower-cased with diacritics
// stripped. Plurals are listed where the French pluralises the head noun.
//
// `perMount` is keyed by `ShipMounts` because neither figure is a property of the weapon: p.113's
// laser bonus is the turret's size and a repulsor's score is its bay's.
MGT2.FleetDefences = Object.freeze({
    // HG p.40's Type I/II/III batteries, laser and gauss alike — both tables print the same three
    // Intercept steps. `types` is read off a `Type N` in the label, which in HG's ship-weapon
    // vocabulary designates nothing else.
    pointDefence: {
        label: "MGT2.FleetDefences.pointDefence",
        names: ["point defence", "point defense", "defense a bout portant"],
        types: {i: 4, ii: 8, iii: 12}
    },
    // p.113: "add the Crew Skill score of the ship for every beam or pulse laser turret", plus +1
    // per double and +2 per triple. Per TURRET and not per weapon — p.111 counts 100 triple turrets
    // as 300 lasers, which would give the Pantheress 500 instead of its printed 300 (§9.100).
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
    // p.113 totals sandcasters per WEAPON and only in turrets: "the Pantheress has 100 triple
    // sandcaster turrets, so this value is 300".
    sandcaster: {
        label: "MGT2.FleetDefences.sandcaster",
        names: ["sandcaster", "lance-sable", "lance sable"],
        perWeapon: true, turretsOnly: true
    }
});

// HG p.119. The score is the defender's Crew Skill plus its Defensive DM less the attacker's
// Offensive DM, and the multiplier scales the sandcaster total into the round's pool.
MGT2.SandcasterEffect = Object.freeze([
    {min: 3, multiplier: 1},
    {min: 1, multiplier: 0.75},
    {min: null, multiplier: 0.5}
]);

// HG p.113's Fleet Missile/Torpedo Damage tables, with p.119's two riders. `torpedo` costs two
// points of Salvo Defence per unit rather than one (p.113), `halvesDefensive` is the antiradiation
// torpedo and `salvoPenalty` is the multi-warhead's -20% against the target's Salvo Defence.
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

// HG p.119's Missile Flight table: rounds to impact from the band the salvo was fired at, "Medium
// and below" being immediate. The figures are for Thrust 10; p.37's own table covers the Thrust-15
// advanced missile and did not survive extraction, so nothing here answers for one.
MGT2.MissileFlight = Object.freeze({
    adjacent: 0, close: 0, short: 0, medium: 0, long: 1, veryLong: 4, distant: 10
});

// HG p.121's Radiation Effects. `salvo` is the fraction struck off the laser-turret, repulsor and
// electronic-warfare terms — never off point defence, which the table does not name — and `weapons`
// is how many weapon systems are eliminated. The fifth step is not a modifier: the crew are gone.
MGT2.FleetRadiation = Object.freeze([
    {exposures: 1, crewSkill: -1, salvo: 0, weapons: 0},
    {exposures: 2, crewSkill: -2, salvo: 0.25, weapons: 1},
    {exposures: 3, crewSkill: -3, salvo: 0.5, weapons: 2},
    {exposures: 4, crewSkill: -4, salvo: 0.75, weapons: 3},
    {exposures: 5, crewSkill: -4, salvo: 1, weapons: 3, disabled: true}
]);

// HG p.122's four Morale events, plus p.115's flag ship. `per` is the fraction each -1 is charged
// for: own losses are "-1 for each 25% of one's own ships that are eliminated", where the opposing
// fleet's 50% is a single threshold.
MGT2.FleetMorale = Object.freeze({
    flagShip: {label: "MGT2.FleetMorale.flagShip", dm: 1},
    opposingLosses: {label: "MGT2.FleetMorale.opposingLosses", dm: 1, threshold: 0.5},
    opposingFlagship: {label: "MGT2.FleetMorale.opposingFlagship", dm: 1},
    ownLosses: {label: "MGT2.FleetMorale.ownLosses", dm: -1, per: 0.25},
    ownFlagship: {label: "MGT2.FleetMorale.ownFlagship", dm: -1}
});

// HG p.122's Fleet Dispersal table, read off the Effect of the Tactics (naval) check that ends the
// Leadership chain. On a failure `rounds` is how long the DM lasts before the fleet may reattempt;
// on a success it is how long the manoeuvre takes.
MGT2.FleetDispersal = Object.freeze([
    {min: 3, rounds: 1, dm: 0, label: "MGT2.FleetDispersal.exceptional"},
    {min: 1, rounds: 2, dm: 0, label: "MGT2.FleetDispersal.success"},
    {min: 0, rounds: 3, dm: -1, label: "MGT2.FleetDispersal.slow"},
    {min: null, rounds: 2, dm: -2, failed: true, label: "MGT2.FleetDispersal.failure"}
]);

// HG p.118's Attack Effectiveness table, and it is the whole of a fleet attack: nothing but a spinal
// mount rolls to hit, so the Attack Factor — the attacker's Offensive DM less the target's Defensive
// DM, plus the range term and the small-target term — is read here and the damage subtotal is
// multiplied by what the row says. Ordered widest-first so a walk stops at the first `max` it fits.
MGT2.FleetEffectiveness = Object.freeze([
    {min: null, max: -6, multiple: 0},
    {min: -5, max: -4, multiple: 0.25},
    {min: -3, max: -2, multiple: 0.5},
    {min: -1, max: 0, multiple: 0.75},
    {min: 1, max: 2, multiple: 1},
    {min: 3, max: 4, multiple: 1.25},
    {min: 5, max: null, multiple: 1.5}
]);

// HG p.118: "-2 if attacking a target (or squadron of targets) who are each less than 100 tons in
// size with any weapon other than turrets or barbettes". It REPLACES Core folio 167's "+1 per full
// 1,000 tons of the target, max +6" rather than joining it — same place in the arithmetic, opposite
// sign, different quantity. `mounts` is the printed exemption and nothing else: a firmpoint (`fixed`)
// is neither a turret nor a barbette, so a fighter's own firmpoint weapon takes the DM.
MGT2.FleetSmallTarget = Object.freeze({
    underTons: 100, dm: -2,
    mounts: ["singleTurret", "doubleTurret", "tripleTurret", "barbette"]
});

// HG p.111-112's ion weapons, which are the one thing in the chapter the ÷ 3.5 rule does not explain:
// they inflict NO damage. `Effect per Weapon` is multiplied by the number of like weapons fired and
// divided by the target's ADJUSTED Hull points (the Ion Damage table's own column header), and the
// quotient rounded DOWN is how many points of Thrust, or how many weapon systems, the target loses.
// The six printed rows are the identity — a result of 3 costs 3 — so only the last one is declared.
// No turret and no spinal row is printed. The effect lasts one round, or two where the attacker's
// Offensive DM is twice the target's Defensive DM, and the `hardened` Trait is immune (p.111-112).
MGT2.FleetIon = Object.freeze({
    perWeapon: {barbette: 75, smallBay: 200, mediumBay: 500, largeBay: 3500},
    maxResult: 6,
    longDuration: 2,
    duration: 1
});

// HG p.111's five ship Traits. `traits.js` has no ship family and does not gain one: every row of the
// printed table names a REQUIREMENT that is a component, a program or a coating the ship already
// carries, so a fleet Trait is derived like the rest of the Fleet Ship Sheet rather than typed a
// second time on a hull whose own design already says it. Names follow §9.75 — English and Modül's
// French, matched lower-cased with diacritics stripped — and `software` reads `ShipSoftware` instead.
//
// Four are read off a fitting; `hardened` is the one that is not. Its requirement is "at least 75% of
// systems that use Power are Hardened", which is a design-wide fact no field holds, so it answers to a
// component a transcriber typed and to nothing else.
MGT2.FleetTraits = Object.freeze({
    antirad: {label: "MGT2.FleetTraits.antirad",
        names: ["radiation shielding", "bouclier anti-radiations", "bouclier antiradiations"]},
    blackGlobe: {label: "MGT2.FleetTraits.blackGlobe",
        names: ["black globe", "sphere noire"]},
    fleetDefence: {label: "MGT2.FleetTraits.fleetDefence", software: "pointDefence"},
    hardened: {label: "MGT2.FleetTraits.hardened", names: ["hardened", "blindage em"]},
    // "Increase Armour against turret weapons by +10%, rounding up" — of the FLEET Armour, which is
    // where the trait is printed and the only figure a fleet attack subtracts.
    reflec: {label: "MGT2.FleetTraits.reflec", names: ["reflec"], armourBonus: 0.1}
});

// Which column of the Crew Requirements table a ship reads (HG p.23).
MGT2.ShipService = Object.freeze({
    commercial: "MGT2.ShipService.commercial",
    military: "MGT2.ShipService.military"
});

// Running costs (Core p.149, p.154, p.183; HG p.25). Every periodic figure runs on the maintenance
// period. `maintenanceDivisor` is p.183's form — the only one that excludes carried craft — and it
// is authoritative: the catalogue's plain cost/12000 bills a carried boat twice.
MGT2.ShipCosts = Object.freeze({
    mortgageDivisor: 240,
    mortgageYears: 40,
    // p.153 calls the period four weeks, which reads as thirteen a year; p.154 divides the year by
    // TWELVE to price maintenance and calls the result the Maintenance Period cost. Where the book's
    // prose and its arithmetic disagree, the arithmetic is the one it uses — and `maintenanceDivisor`
    // below already is that 12. So the term is 480 periods and a mortgage repays exactly twice the
    // purchase price (§9.115).
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

// Core p.153's Skipping on Debts: 2D for each new system, 8+ and the crew is hunted. `disguiseMax`
// is the span of the folio's one referee-judged line, "-1 to -6", and it is stored POSITIVE — a
// referee types how much the ship has been altered, and the ladder is what makes it a minus.
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
    // The four bands are exclusive and the second is the worst of them — a bank chases hardest in
    // the half-year after the first missed payment, and gives up as the trail goes cold.
    overdue: Object.freeze({
        under4: { dm: -4, label: "MGT2.SkipDebts.Overdue.under4" },
        weeks4: { dm: 4, label: "MGT2.SkipDebts.Overdue.weeks4" },
        weeks25: { dm: 2, label: "MGT2.SkipDebts.Overdue.weeks25" },
        overYear: { dm: 0, label: "MGT2.SkipDebts.Overdue.overYear" }
    })
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

/* -------------------------------------------- */

// The campaign's own calendar, and the only one: `mgt2.campaignDay` counts days and the month
// derives (§9.33.5). Core p.153 makes a Maintenance Period four weeks, which is where 28 comes from.
MGT2.Calendar = Object.freeze({
    daysPerWeek: 7,
    daysPerMonth: 28
});

// Core p.257-258. The letter drives the fuel grade, the berthing rate and both traffic tables'
// Starport DM, which is why it is the busiest digit in the profile. `berthingPerDie` is what one die
// of Core p.258's roll is worth; null is a port that cannot berth anybody at all. `searchDM` is the
// bonus to finding a supplier (Core p.242), which only A, B and C carry.
MGT2.Starports = Object.freeze({
    A: {label: "MGT2.Starports.A", fuel: "refined", berthingPerDie: 1000, trafficDM: 2, searchDM: 6},
    B: {label: "MGT2.Starports.B", fuel: "refined", berthingPerDie: 500, trafficDM: 1, searchDM: 4},
    C: {label: "MGT2.Starports.C", fuel: "unrefined", berthingPerDie: 100, trafficDM: 0, searchDM: 2},
    D: {label: "MGT2.Starports.D", fuel: "unrefined", berthingPerDie: 10, trafficDM: 0, searchDM: 0},
    E: {label: "MGT2.Starports.E", fuel: "none", berthingPerDie: 0, trafficDM: -1, searchDM: 0},
    X: {label: "MGT2.Starports.X", fuel: "none", berthingPerDie: null, trafficDM: -3, searchDM: 0}
});

// Read by BOTH traffic tables and with opposite signs (Core p.239, p.240), which is the whole reason
// the pair is stored rather than one number. A Red Zone is forbidden outright (Core p.260). The keys
// double as Purchase/Sale DM codes on the Trade Goods table, which prices weapons by travel zone.
MGT2.TravelZones = Object.freeze({
    green: {label: "MGT2.TravelZones.green", passengerDM: 0, freightDM: 0},
    amber: {label: "MGT2.TravelZones.amber", passengerDM: 1, freightDM: -2},
    red: {label: "MGT2.TravelZones.red", passengerDM: -4, freightDM: -6, forbidden: true}
});

// The three profile digits that are unreadable without a table (Core p.250, p.252, p.253). Indexed by
// the digit, and each record carries a label and nothing else — the shape is what lets the sheet read
// all four digit tables through one `[value]?.label`, the starport letter included.
//
// What ships is the FACT a digit stands for, phrased in `lang/` in the project's own words: the gear an
// atmosphere demands, the head count behind a population code, who holds power (§9.3, §9.64). The
// books' own rows — composition, government type, description — ship nowhere.
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

// Core p.260-261: "a world gains a code if it meets ALL the requirements listed", and it can hold
// many at once. Every condition reads the eight profile digits and nothing else, which is what makes
// the whole set derivable. The printed condition travels beside each test because an override with
// no visible condition cannot be told from a typo.
//
// `condition` is a list of [uwpField, range] pairs rather than a phrase: the books print a table of
// digits with one column per profile field and no prose at all, and the field NAME is the only
// language-dependent half. The sheet localises each through `FIELDS.uwp.<field>.label`, which is
// what keeps the ledger reading in the same words as the UWP editor above it.
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

/* -------------------------------------------- */
/*  The printed tables (Core p.239-245)         */
/* -------------------------------------------- */

/**
 * Read a printed lookup table by a modified total. Rows are ordered, each covers everything up to
 * and including its `max`, and `max: null` is the open top end — so the FIRST row is also the open
 * bottom one ("1 or less", "-3 or less"). Whatever else a row carries is that table's own payload,
 * which is what lets one reader serve a table returning a dice count, one returning a DM, and the
 * 29-row Modified Price table's pair of percentages.
 * @param {ReadonlyArray<{max: number|null}>} rows
 * @param {number} total
 * @returns {object}
 */
MGT2.readTable = (rows, total) => rows.find(row => (row.max === null) || (total <= row.max)) ?? rows.at(-1);

/**
 * Read a D66 index. The two dice are DIGITS, not a sum, so no band read can serve it: 11-16, 21-26 …
 * 61-66 are thirty-six discrete rows with no order between them and no open end at either extreme.
 * @param {Record<string, object>} table
 * @param {number} tens    The first die
 * @param {number} units   The second
 * @returns {object|null}
 */
MGT2.readD66 = (table, tens, units) => table[`${tens}${units}`] ?? null;

/**
 * Passenger and freight traffic. The SAME world lines are read at BOTH ends and scored differently:
 * population pays double for freight, Tech Level appears in the freight column only, and the travel
 * zone changes sign — Amber +1 against −2, Red −4 against −6 (Core p.239, p.240). That opposition is
 * the most error-generating thing in the chapter and it is invisible on the page.
 *
 * `zone` names the key on `MGT2.TravelZones` and the starport DM is read off
 * `MGT2.Starports.trafficDM`, so neither figure is written down twice.
 * `table` hands back a DICE EXPRESSION rather than a quantity: the count is rolled again, which is
 * the shape no task check produces.
 */
MGT2.Traffic = Object.freeze({
    // "Each parsec of destination past the first" — the one line neither end owns.
    perParsec: -1,

    passenger: Object.freeze({
        population: Object.freeze([
            {max: 1, dm: -4}, {max: 5, dm: 0}, {max: 7, dm: 1}, {max: null, dm: 3}]),
        // Core p.239 prints no Tech Level term for passengers at all.
        techLevel: null,
        zone: "passengerDM",
        // Core p.239 allows Carouse; Core p.240 does not (see `freight.skills`), so which skill was
        // rolled decides whether the leading Effect reaches one column or both.
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
        // Three 2D. The table gives a COUNT OF LOTS and every lot rolls its own tonnage, so a row of
        // four lots is four dice — showing one under-reports the hold by a factor of four.
        classes: Object.freeze([
            {key: "incidental", label: "MGT2.Trade.Lot.incidental", dm: 2, tonsPerLot: 1, lotSize: "1D"},
            {key: "minor", label: "MGT2.Trade.Lot.minor", dm: 0, tonsPerLot: 5, lotSize: "1D×5"},
            {key: "major", label: "MGT2.Trade.Lot.major", dm: -4, tonsPerLot: 10, lotSize: "1D×10"}
        ]),
        // Not the passenger rows: freight reaches 3D at 6 where passengers need 7, and 6D at 15
        // where passengers need 16.
        table: Object.freeze([
            {max: 1, dice: 0}, {max: 3, dice: 1}, {max: 5, dice: 2}, {max: 8, dice: 3},
            {max: 11, dice: 4}, {max: 14, dice: 5}, {max: 16, dice: 6}, {max: 17, dice: 7},
            {max: 18, dice: 8}, {max: 19, dice: 9}, {max: null, dice: 10}
        ])
    })
});

// Core p.239's Passage and Freight table, indexed by the parsecs jumped. A fare is for a SINGLE jump
// and six parsecs is the longest one there is, so the table has no open end at either extreme. A
// working passage is paid in labour and has no column: `MGT2.PassageClasses.working` carries `unpaid`
// and `PassageData` derives its fare as zero.
MGT2.PassageFares = Object.freeze([
    Object.freeze({high: 9000, middle: 6500, basic: 2000, low: 700, freight: 1000}),
    Object.freeze({high: 14000, middle: 10000, basic: 3000, low: 1300, freight: 1600}),
    Object.freeze({high: 21000, middle: 14000, basic: 5000, low: 2200, freight: 2600}),
    Object.freeze({high: 34000, middle: 23000, basic: 8000, low: 3900, freight: 4400}),
    Object.freeze({high: 60000, middle: 40000, basic: 14000, low: 7200, freight: 8500}),
    Object.freeze({high: 210000, middle: 130000, basic: 55000, low: 27000, freight: 32000})
]);

/**
 * One row of the Passage and Freight table, clamped to the six the book prints.
 * @param {number} parsecs
 * @returns {object}
 */
MGT2.readFares = parsecs => MGT2.PassageFares[
    Math.min(MGT2.PassageFares.length, Math.max(1, Math.trunc(Number(parsecs)) || 1)) - 1];

// Core p.241: "Cargo is paid for upon delivery, assuming it is delivered on time. Failing to deliver
// cargo on time reduces the amount paid by 1D+4 x 10%" — five to ten tenths, so the worst late lot
// pays nothing at all. Mail is "a special form of freight" and inherits the clause.
//
// The chapter prints NO deadline, so this table holds none: a due day is a term the referee and the
// shipper agree, and the field is left blank until one does. A blank one is a consignment with no
// deadline recorded, which the delivery act reads as never late — the honest reading of a rule the
// books state only as "on time". Nothing here schedules anything either (§9.35).
MGT2.FreightDelivery = Object.freeze({
    latePenalty: "1d6 + 4",
    penaltyPerPoint: 10
});

// Core p.241. Mail is pass or fail on 12+ rather than a quantity, and its DM is the FREIGHT world
// total banded — the one place in the chapter where one table's output is another table's input.
// The payment is flat, so a container beats freight out to four parsecs and loses at five or six.
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

/* -------------------------------------------- */
/*  Speculative trade (Core p.241-245)          */
/* -------------------------------------------- */

/**
 * One row of the Trade Goods table (Core p.244-245).
 *
 * `purchase` and `sale` are (code, DM) PAIRS in exactly the shape `CargoData.purchaseDM` stores, so a
 * lot Item is built from a row with no mapping and Core p.243's largest-applicable rule keeps its one
 * implementation, `CargoData.bestDM`. A code is a trade code OR a travel-zone key — Advanced Weapons
 * sell on an Amber Zone, which is not a property of the world's economy at all.
 *
 * `availability: null` is the printed "All": the six Common Goods, which need no matching code.
 */
const goods = (d66, key, availability, dice, multiplier, basePrice, purchase, sale, illegal = false) =>
    Object.freeze({
        d66, key, label: `MGT2.TradeGoods.${key}`, illegal,
        availability: availability && Object.freeze(availability),
        dice, multiplier, basePrice,
        purchase: Object.freeze(purchase.map(([code, dm]) => Object.freeze({code, dm}))),
        sale: Object.freeze(sale.map(([code, dm]) => Object.freeze({code, dm})))
    });

/**
 * The 36 rows of the Trade Goods table, keyed by their D66 index — which is also their insertion
 * order, since integer-like keys enumerate numerically. Only three DMs on the whole table are
 * negative and all three are printed: Common Consumables buy badly on an asteroid belt, and
 * Radioactives sell badly to a farm.
 *
 * Exotics (66) carries no availability, tonnage, price or DM at all: the printed row is a paragraph
 * saying the goods are outside these rules, so the row is marked and left empty rather than invented.
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
 * The Modified Price table (Core p.243), read by `MGT2.readTable` with no new code: its printed
 * "−3 or less" IS the open bottom row and "25+" the open top one. Both columns are percentages of the
 * base price, and they cross at result 10-11 — which is what makes the Purchase/Sale DM spread, and
 * not the dice, the whole of a trader's profit.
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

// The scalars of the speculative loop. `otherBroker` is the standing assumption of Core p.243 — the
// figure on the far side of the table, subtracted from both readings — and `population` bands the
// TONNAGE roll alone (Core p.242), never the price, which is why it is not on `MGT2.Traffic`.
MGT2.SpeculativeTrade = Object.freeze({
    priceDice: 3,
    otherBroker: 2,
    // Core p.241: DM−1 per previous search on the same planet in the same month. `world` keeps the
    // day-stamps and `WorldData#tradeStanding` counts them; this is what one of them is worth.
    attemptDM: -1,
    // Core p.242: a legal supplier never stocks 61-65, and a black market rolls 1D under a leading 6.
    illegalTens: 6,
    // Core p.242's hired local broker: DM+2 on the negotiation, against a flat fee of 10% of the
    // gross proceeds — 20% where the fixer is handling illegal goods. The fee is charged on the
    // transaction and not on the profit, so it is added to a purchase and taken off a sale.
    localBrokerDM: 2,
    brokerFee: 10,
    fixerFee: 20,
    population: Object.freeze([{max: 3, dm: -3}, {max: 8, dm: 0}, {max: null, dm: 3}])
});

/* -------------------------------------------- */

// The leading word of a transcribed component row (HG p.9-64). A component feeds `budget` and
// nothing else: every headline rating is stored on the ship (§4.1, §6.2).
MGT2.ComponentCategories = Object.freeze({
    hull: "MGT2.ComponentCategories.hull",
    armour: "MGT2.ComponentCategories.armour",
    mDrive: "MGT2.ComponentCategories.mDrive",
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

/* -------------------------------------------- */

// Where a permanent characteristic change came from. The log is SIGNED and its sum is derived, so
// `base` holds only the characteristics as first rolled and nothing ever writes it again (§9.39).
// Two of these restore rather than take, and they do it with different arithmetic: `medicalCare`
// prices per point restored (Cr5000 each), `ageingCrisisCare` sets every zeroed characteristic back
// to 1 for one rolled sum (1D × Cr10000, folio 49).
MGT2.CharacteristicLossSources = Object.freeze({
    ageing: "MGT2.CharacteristicLossSources.ageing",
    injury: "MGT2.CharacteristicLossSources.injury",
    event: "MGT2.CharacteristicLossSources.event",
    medicalCare: "MGT2.CharacteristicLossSources.medicalCare",
    ageingCrisisCare: "MGT2.CharacteristicLossSources.ageingCrisisCare",
    referee: "MGT2.CharacteristicLossSources.referee",
    // Compagnon p.40 lets a programme BUY a characteristic, and the point bought goes here as a
    // signed +1 rather than into `base` — which §9.39 reserves for what was first rolled (§9.133).
    training: "MGT2.CharacteristicLossSources.training"
});

// Core folio 49's two prices, and they buy different things (§9.39, §9.91). `perPoint` is what one
// restored point costs; the crisis price is ONE rolled sum whatever it restores, and what it
// restores is every zeroed characteristic set to `crisisFloor` — not to where it was. A Traveller
// whose STR fell 5 → 0 is billed once and comes back at 1.
MGT2.CharacteristicCare = Object.freeze({
    perPoint: 5000,
    crisisFormula: "1D*10000",
    crisisFloor: 1
});

/* -------------------------------------------- */

/* Character creation, §9.38-§9.56. Everything below is a closed VOCABULARY — the words a template,
 * a frame or a ledger row is allowed to use. No table, no ladder and no career ships here: those are
 * the referee's, and §9.36 is unchanged. The invariant these exist to serve is §9.47's — a rule the
 * book states as a list of career names becomes a field, so no career name reaches the code. */

// The Core term, step by step. A species FRAME declares its own sequence and the Core one is simply
// the default (§9.54), so this is the default order and not a law. `elect` is §9.50's start-of-term
// elections, which the book prints as a sentence about anagathics rather than as a step; the last
// four are steps only a frame adds.
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
    // Where a term adds to a household — dependants gained on a check, and the skills that come with
    // them. Distinct from `nest`, which is a transfer between groups and gains nobody.
    household: "MGT2.Chargen.Steps.household"
});

// What a declared step's printed ladder of targets is read against (§9.120). **Two, because two are
// printed**: a household timetable indexed by term number, and a promotion difficulty indexed by a SOC
// band off a rank table. Blank is a check with one target and no ladder at all, which is most of them.
MGT2.StepCheckIndices = Object.freeze({
    term: "MGT2.Chargen.StepCheckIndices.term",
    characteristic: "MGT2.Chargen.StepCheckIndices.characteristic"
});

// When a declared step's check fires (§9.120). A step is a position in the term and most checks are
// simply made there — but one published frame prints *"any time a Mishap occurs the Droyne must make a
// continuation check"*, and a check made every term instead would be a wrong rule rather than a partial
// one. Read off the term log, which is where a mishap is already recorded as a fact and not a phrase.
MGT2.StepCheckTriggers = Object.freeze({
    everyTerm: "MGT2.Chargen.StepCheckTriggers.everyTerm",
    afterMishap: "MGT2.Chargen.StepCheckTriggers.afterMishap"
});

// The default frame's sequence. The book prints no ordered list of a term's steps anywhere — this is
// the design's reconstruction from folio 8's section headings, which is why the order is a decision
// the book will never confirm. A frame that drops ranks drops `commission` with them, and the cut is
// DERIVED against this array rather than authored beside it.
MGT2.CoreTermSequence = Object.freeze(["elect", "qualify", "basic", "survival", "event",
    "commission", "advance", "skill", "ageing", "decide"]);

// Folio 8's printed defaults, which a frame replaces. The three ageing numbers are here as well as
// on the frame because a Traveller with no species Item at all still runs the Core term (§9.99), and
// the loop must not read a frame that is not there.
MGT2.CreationDefaults = Object.freeze({ startAge: 18, termYears: 4, racialMaximum: 15,
    ageingFromTerm: 4, ageingFromAge: 34, ageingPerTerm: -1, ageingFlat: 0 });

// Folio 19's two commission gates, which are GENERAL rules and not a list of career names — whether
// the career has a commission at all is `commission` on the template, and its target and
// characteristic are `commissionCheck` (§9.53). The attempt is the first term of a career unless the
// named characteristic is high enough, and every term after the first costs a DM.
MGT2.CommissionGate = Object.freeze({
    characteristic: "social", min: 9, laterTermDM: -1
});

// Core p.49's Ageing table, as EFFECTS: the rows are what the rule does arithmetic on, and the words
// beside them in the book are prose we do not copy (§9.39). `physical` and `mental` are one entry per
// characteristic the Traveller chooses, each the number of points it loses — so a row is read as
// "pick this many, take that much off each" and the choice is the player's.
//
// **The table stops at -6, printed bare rather than as "-6 or less"** — while the DM is the total
// terms served, so a nine-term Traveller rolling snake-eyes sits at -7 and the book prints neither a
// row nor an instruction to floor. `ageingTableFloor` is the ruling, and it is a switch rather than a
// silent clamp.
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

// §9.41: university and the military academy are a KIND on the same `career` Item and not a document
// type of their own — what a Traveller ends up with is a term served, an assignment and an event log
// either way. What differs is only which rolls exist.
MGT2.CareerKinds = Object.freeze({
    career: "MGT2.Chargen.CareerKinds.career",
    preCareer: "MGT2.Chargen.CareerKinds.preCareer"
});

// §9.53's six qualification modes, split across three fields rather than six values: this one says
// whether a roll happens at all, `autoIf` carries the score threshold that bypasses it (printed on
// the Noble's own line, so it is the book's clause and not a ruling) and `requiresPermission` the
// referee's gate. A choice of two characteristics is the length of the list, not a mode.
MGT2.QualificationEntry = Object.freeze({
    target: "MGT2.Chargen.Qualification.target",
    automatic: "MGT2.Chargen.Qualification.automatic",
    forcedOnly: "MGT2.Chargen.Qualification.forcedOnly"
});

// §9.54: four kinds, because a species may substitute the whole roll (2D + a background score),
// substitute only the characteristic that supplies the DM, ADD a DM to the usual one, or remove the
// roll entirely. Each carries its own list of careers it does not touch, typed by the referee.
MGT2.QualificationOverrides = Object.freeze({
    none: "MGT2.Chargen.QualificationOverrides.none",
    wholeRoll: "MGT2.Chargen.QualificationOverrides.wholeRoll",
    characteristic: "MGT2.Chargen.QualificationOverrides.characteristic",
    addDM: "MGT2.Chargen.QualificationOverrides.addDM"
});

// How a record was entered and how it ended (§9.53). Four rules read the MANNER rather than the fact:
// the draft can return a Traveller to a career they were ejected from, an event-forced draft is a
// different thing from applying, the counts-as-a-new-career assignment change requires leaving
// voluntarily, and a failed Survival costs that term's Benefit roll in a career that cannot eject.
// `fallbackCareer` is §9.53's `drifterFallback` renamed: WHICH career catches a failed enlistment is
// the referee's data, and naming one here would be the career name §9.47 forbids.
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

// §9.47's three-valued field, plus the fourth the book's own two groups do not contain: the Prisoner
// picks a new assignment every term with no roll and no penalty. The Drifter is in none of the book's
// lists and no rule is given for it anywhere — §9.56 item 6 decides `free`, and the DEFAULT for a
// template that declares nothing is a world setting rather than a name in this file.
MGT2.AssignmentChangeRules = Object.freeze({
    requalifyKeepRank: "MGT2.Chargen.AssignmentChange.requalifyKeepRank",
    newCareer: "MGT2.Chargen.AssignmentChange.newCareer",
    separateCareers: "MGT2.Chargen.AssignmentChange.separateCareers",
    free: "MGT2.Chargen.AssignmentChange.free"
});

// Which table basic training reads. "Specialist" and "Assignment Skills" are the same value under two
// of the book's own words (§9.43), so there are two entries here and not three.
MGT2.BasicTrainingTables = Object.freeze({
    service: "MGT2.Chargen.BasicFrom.service",
    assignment: "MGT2.Chargen.BasicFrom.assignment"
});

// What a term PRODUCED, as facts rather than as prose — the field §9.103 reported the loop needs
// before §9.55's errata can be asserted at all. `termLog`'s own fields say whether the Traveller
// survived and whether they were ejected; these are the outcomes a LATER step reads: the decide step
// asks whether the career may be left, and a reader asks whether a commission and an advancement
// happened in the same term, which is exactly what the errata reversed.
MGT2.TermOutcomes = Object.freeze({
    elected: "MGT2.Chargen.TermOutcomes.elected",
    basicTraining: "MGT2.Chargen.TermOutcomes.basicTraining",
    mishap: "MGT2.Chargen.TermOutcomes.mishap",
    commissioned: "MGT2.Chargen.TermOutcomes.commissioned",
    advanced: "MGT2.Chargen.TermOutcomes.advanced",
    // "Lose 1 rank … but you are not ejected from this career". `advanced` with the sign flipped, and
    // it carries no count for the same reason `advanced` carries none: the books move a rank one rung
    // at a time in both directions. A demotion never takes back the bonus the rung already paid —
    // folio 19 grants that on attaining the rank and no rule ungrants a skill.
    demoted: "MGT2.Chargen.TermOutcomes.demoted",
    // The advancement roll came out at or under the terms spent in this career, so it cannot be
    // continued after this term (folio 18) — a forced ending that is neither a failed survival nor a
    // mishap (§9.51).
    forcedOut: "MGT2.Chargen.TermOutcomes.forcedOut",
    // A natural 12: too valuable to lose (folio 18).
    mustContinue: "MGT2.Chargen.TermOutcomes.mustContinue",
    // A template-named leaving rule fired instead of the generic outcomes, which DISPLACE rather
    // than layer (§9.52): the roll passed the record's own track.
    released: "MGT2.Chargen.TermOutcomes.released",
    skillRoll: "MGT2.Chargen.TermOutcomes.skillRoll",
    aged: "MGT2.Chargen.TermOutcomes.aged"
});

// §9.52: the Prisoner's row 7 is a nested Prison Event sub-table, which is why the routing "a 7 is
// always a Life Event" is a template row whose default content is Life Events rather than three lines
// of hard-coded code.
MGT2.EventRow7 = Object.freeze({
    lifeEvent: "MGT2.Chargen.EventRow7.lifeEvent",
    own: "MGT2.Chargen.EventRow7.own"
});

// §9.49: ejection is a per-row FACT and not a rule with exceptions — the book prints "otherwise" in
// both directions, and a row may leave it to the Traveller (eject unless you accept the offer).
MGT2.EjectionOutcomes = Object.freeze({
    ejects: "MGT2.Chargen.Ejection.ejects",
    stays: "MGT2.Chargen.Ejection.stays",
    choice: "MGT2.Chargen.Ejection.choice"
});

// What an event or mishap row does to the term's Benefit roll (§9.49, §9.50). `wipe` clears every
// roll the career earned, which is why the count is a ledger and not a derivation.
MGT2.BenefitRowEffects = Object.freeze({
    none: "MGT2.Chargen.BenefitEffects.none",
    keep: "MGT2.Chargen.BenefitEffects.keep",
    lose: "MGT2.Chargen.BenefitEffects.lose",
    grant: "MGT2.Chargen.BenefitEffects.grant",
    wipe: "MGT2.Chargen.BenefitEffects.wipe"
});

// §9.51's seven kinds. Four of them are new against §9.38's "one-shot modifier" and each has a
// printed source: an `autoSuccess` is deferred and player-directed, a `careerOffer` waives
// qualification and may be declined, a `careerBlock` is the exact inverse of an unlock, and a `grant`
// is N skills from a named table at a level, surviving into the next term.
MGT2.TrayKinds = Object.freeze({
    dm: "MGT2.Chargen.TrayKinds.dm",
    autoSuccess: "MGT2.Chargen.TrayKinds.autoSuccess",
    unlock: "MGT2.Chargen.TrayKinds.unlock",
    prohibition: "MGT2.Chargen.TrayKinds.prohibition",
    grant: "MGT2.Chargen.TrayKinds.grant",
    careerOffer: "MGT2.Chargen.TrayKinds.careerOffer",
    // "You must take the Prisoner career in your next term" — seven printed rows across four careers,
    // and it is the exact opposite of an offer rather than a variant of one: nothing may be declined.
    // Three transcribers examined `careerOffer` and `careerBlock` for it and refused both.
    careerForce: "MGT2.Chargen.TrayKinds.careerForce",
    careerBlock: "MGT2.Chargen.TrayKinds.careerBlock"
});

// What EARNS a tray entry, which is a different question from `expiresWhen` — entitlement against
// expiry. Most printed entries are branch-bound: a DM the Traveller gets only by reporting their
// officer, only on a successful check, or only by taking the DM instead of the skill the same row
// offers. `always` is the honest initial because that is what every entry written before this field
// meant. `checkPassed` and `checkFailed` read the row's OWN sub-check, which the loop rolls one step
// earlier; where the row prints no check they fall back to asking, because a loop that cannot decide
// asks rather than guessing — the same call `ejects: choice` already makes one field away.
MGT2.TrayConditions = Object.freeze({
    always: "MGT2.Chargen.TrayConditions.always",
    choice: "MGT2.Chargen.TrayConditions.choice",
    checkPassed: "MGT2.Chargen.TrayConditions.checkPassed",
    checkFailed: "MGT2.Chargen.TrayConditions.checkFailed"
});

// §9.49 named three senses for a row's career reference — send, offer, borrow — and one field carried
// all three, which made every one of them an offer. All three are printed: one row offers the Rogue
// career with qualification waived, seven compel the Prisoner, and one rolls on another career's
// Events table without entering it at all.
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
// instead" makes the holder choose. `elections` and `graduation` are the two steps §9.50 and §9.41
// added after §9.51 listed five.
MGT2.TrayChecks = Object.freeze({
    qualification: "MGT2.Chargen.TrayChecks.qualification",
    survival: "MGT2.Chargen.TrayChecks.survival",
    advancement: "MGT2.Chargen.TrayChecks.advancement",
    commission: "MGT2.Chargen.TrayChecks.commission",
    benefit: "MGT2.Chargen.TrayChecks.benefit",
    graduation: "MGT2.Chargen.TrayChecks.graduation",
    elections: "MGT2.Chargen.TrayChecks.elections"
});

// Every check a standing modifier can bear on (§9.121) — the tray's seven, plus the frame-owned steps
// that carry a check of their own (§9.120). **The seven were not enough and one printed rule proves
// it**: a Droyne's Black Skills penalty applies *"on all checks for advancement and continuation"*,
// and `continuation` is a step a frame declares, not a check a tray entry is spent on. The four are
// listed rather than derived from `CreationSteps` because the Core steps already answer to a tray
// check under their own name — `advance` is `advancement` here — and a vocabulary with both spellings
// of one thing is a vocabulary nobody can pick from. Their labels are the steps' own, so this adds no
// string.
MGT2.CreationChecks = Object.freeze({
    ...MGT2.TrayChecks,
    nest: MGT2.CreationSteps.nest,
    status: MGT2.CreationSteps.status,
    continuation: MGT2.CreationSteps.continuation,
    household: MGT2.CreationSteps.household
});

MGT2.TrayScopes = Object.freeze({
    thisCareer: "MGT2.Chargen.TrayScopes.thisCareer",
    // "DM+2 to the qualification roll for your NEXT career". A qualification is by definition rolled
    // to enter a different career, so `thisCareer` is not merely wrong on such a row, it is
    // impossible — and `anyCareer` is too wide, because it would also pay the DM to a Traveller
    // re-entering the very career that granted it. The entry is stamped with its granting career and
    // bears on every career but that one.
    nextCareer: "MGT2.Chargen.TrayScopes.nextCareer",
    namedCareer: "MGT2.Chargen.TrayScopes.namedCareer",
    anyCareer: "MGT2.Chargen.TrayScopes.anyCareer",
    firstAfterGraduation: "MGT2.Chargen.TrayScopes.firstAfterGraduation"
});

// A printed cell is a small EXPRESSION, not a scalar (§9.48), and one level of nesting covers every
// Core cell: `all` is `Deception, Persuade AND Stealth`, `oneOf` is `Drive OR Vacc Suit`.
MGT2.CellModes = Object.freeze({
    all: "MGT2.Chargen.CellModes.all",
    oneOf: "MGT2.Chargen.CellModes.oneOf"
});

// What one grant inside a cell hands over. `benefit` points at a shared Other Benefits definition;
// `note` is the cell nothing structures, left for the referee to read aloud.
MGT2.CreationGrantKinds = Object.freeze({
    skill: "MGT2.Chargen.GrantKinds.skill",
    characteristic: "MGT2.Chargen.GrantKinds.characteristic",
    contact: "MGT2.Chargen.GrantKinds.contact",
    cash: "MGT2.Chargen.GrantKinds.cash",
    shipShare: "MGT2.Chargen.GrantKinds.shipShare",
    benefit: "MGT2.Chargen.GrantKinds.benefit",
    note: "MGT2.Chargen.GrantKinds.note"
});

// §9.38's three effect kinds, plus the one that lives on rank rows: `SOC 10 or SOC +1, whichever is
// higher` is max(current + 1, floor), and the Navy prints 10 on one rank and 12 on the next — so the
// floor is per ROW and never per career.
MGT2.GrantModes = Object.freeze({
    raise: "MGT2.Chargen.GrantModes.raise",
    atLeast: "MGT2.Chargen.GrantModes.atLeast",
    add: "MGT2.Chargen.GrantModes.add",
    floor: "MGT2.Chargen.GrantModes.floor"
});

// §9.40's Other Benefits are RIGHTS WITH LIMITS and not objects — "any armour up to Cr10000 and
// TL12" — because the system has no catalogue and never will. Three of the seven need real
// documents; the Prisoner's skill-granting column is the fourth kind §9.40 first missed (§9.52).
MGT2.BenefitKinds = Object.freeze({
    voucher: "MGT2.Chargen.BenefitKinds.voucher",
    characteristic: "MGT2.Chargen.BenefitKinds.characteristic",
    cash: "MGT2.Chargen.BenefitKinds.cash",
    skill: "MGT2.Chargen.BenefitKinds.skill",
    ship: "MGT2.Chargen.BenefitKinds.ship",
    shipShare: "MGT2.Chargen.BenefitKinds.shipShare",
    membership: "MGT2.Chargen.BenefitKinds.membership"
});

// §9.40: the repeat clause is not always "another one, or a skill level instead" — that hedge was
// hiding four real shapes, and the mortgaged ships stack a quarter at a time to outright ownership.
MGT2.BenefitRepeats = Object.freeze({
    another: "MGT2.Chargen.BenefitRepeats.another",
    skillLevel: "MGT2.Chargen.BenefitRepeats.skillLevel",
    upgradeCeiling: "MGT2.Chargen.BenefitRepeats.upgradeCeiling",
    improveExisting: "MGT2.Chargen.BenefitRepeats.improveExisting",
    stackMortgage: "MGT2.Chargen.BenefitRepeats.stackMortgage",
    reroll: "MGT2.Chargen.BenefitRepeats.reroll",
    convert: "MGT2.Chargen.BenefitRepeats.convert"
});

// §9.54's named tracks: the Prisoner's Parole Threshold is the numeric one and §9.52 invented its
// shape without naming it; Aslan Outcast, K'kree caste, Zhodani class and Hiver status are the
// enumerated ones. A track may FALL — a Hiver's status as readily as it rises — which is why §9.40's
// "highest rank reached" reads a high-water mark and only where the frame declares it monotone.
MGT2.TrackKinds = Object.freeze({
    numeric: "MGT2.Chargen.TrackKinds.numeric",
    enumerated: "MGT2.Chargen.TrackKinds.enumerated"
});

/* Everything from here to the end of the creation block is ARITHMETIC the chapter prints once and
 * every career reads — §9.36 is untouched, because none of it is a career's own table. `MusterOut`
 * and `PsionicTraining` are the same class of constant as `MGT2.CharacteristicCare`'s two folio 49
 * prices and `MGT2.Untrained`'s −3: numbers a rule states in prose, not content a publisher owns.
 * A career's Cash column and its Other Benefits column are the referee's and live on the template. */

// Folio 9's printed order, which is also §9.46's harsher method: assign in this sequence rather than
// choosing. A frame declares `characteristicRolls` and replaces this outright (§9.54) — one species
// has no SOC at all and another rolls a seventh characteristic.
MGT2.RolledCharacteristics = Object.freeze(["strength", "dexterity", "endurance", "intellect",
    "education", "social"]);

// Folio 18's two skill limits and folio 9's background-skill count. The `3 × (INT + EDU)` cap is the
// one no table tracks by hand, and on its own it justifies the creation screen (§9.38).
MGT2.CreationLimits = Object.freeze({
    skillLevel: 4,
    skillCapFactor: 3,
    skillCapCharacteristics: Object.freeze(["intellect", "education"]),
    // "A number of background skills equal to your EDU DM +3 (so, 0 to 6)". The clamp is the book's
    // own parenthesis and not a guard, and a frame may replace the whole formula (§9.45, §9.54).
    backgroundBase: 3,
    backgroundMin: 0,
    backgroundMax: 6,
    // Folio 19's Connections Rule: at most two, each with a DIFFERENT Traveller, never above level 3
    // and never Jack-of-All-Trades. The exclusion names a skill, so both spellings the system targets
    // are listed — `MGT2.Untrained`'s device (§9.57).
    connections: 2,
    connectionLevel: 3,
    connectionExcluded: Object.freeze(["Jack-of-All-Trades", "Polyvalent"])
});

// Folio 46-48's mustering out. The Benefit COUNT is not here — it is a ledger on the flag (§9.50),
// because thirty printed rows wipe, grant, remove or retain rolls and two let a player wager them.
MGT2.MusterOut = Object.freeze({
    // "You may only roll on the Cash column a maximum of three times across all your careers."
    cashRolls: 3,
    // Folio 46's Benefits of Rank, and the DM its top rung carries with it. `upTo` is the highest
    // rank the row answers for; what it reads is the HIGHEST rank REACHED, which on a track that can
    // fall is a high-water mark and not the current value (§9.54).
    rankBonus: Object.freeze([
        Object.freeze({ upTo: 0, rolls: 0, dm: 0 }),
        Object.freeze({ upTo: 2, rolls: 1, dm: 0 }),
        Object.freeze({ upTo: 4, rolls: 2, dm: 0 }),
        Object.freeze({ upTo: 6, rolls: 3, dm: 1 })
    ]),
    // "A Traveller with the Gambler skill gains DM+1 to all rolls on Cash columns" — any level of it.
    cashSkill: Object.freeze({ skills: Object.freeze(["Gambler", "Flambeur"]), dm: 1 }),
    // Folio 48 prints five rows and they are one arithmetic progression: Cr10000 at five terms, plus
    // Cr2000 a term after that, which is exactly what its "9+: Cr2000 per term beyond 8" continues.
    pension: Object.freeze({ fromTerms: 5, base: 10000, perTerm: 2000 }),
    // Two pensions that are not the pension: Cr25000 a year for each ship given up when the table
    // debates who keeps the only one, and Cr1000 a year for a Ship Share never spent on a hull.
    shipForgone: 25000,
    shipShareUnspent: 1000,
    shipShareValue: 1000000,
    // "They may purchase personal equipment worth up to Cr10000 before they start adventuring."
    preplayEquipment: 10000
});

// Folio 228's Psionic Training table — six numbers, so it ships (§9.43). The talents are named
// because the table names them and a `talent` Item is free text with no registry behind it, so each
// row lists every spelling the system targets. `perAttempt` is cumulative and counts CHECKS made,
// not talents held: the worked example applies −1 on the second attempt after the first failed.
MGT2.PsionicTraining = Object.freeze({
    talents: Object.freeze([
        Object.freeze({ key: "telepathy", dm: 4, skills: Object.freeze(["Telepathy", "Télépathie"]) }),
        Object.freeze({ key: "clairvoyance", dm: 3, skills: Object.freeze(["Clairvoyance"]) }),
        Object.freeze({ key: "telekinesis", dm: 2, skills: Object.freeze(["Telekinesis", "Télékinésie"]) }),
        Object.freeze({ key: "awareness", dm: 1, skills: Object.freeze(["Awareness", "Conscience"]) }),
        Object.freeze({ key: "teleportation", dm: 0, skills: Object.freeze(["Teleportation", "Téléportation"]) })
    ]),
    perAttempt: -1,
    // The psionics chapter prints no difficulty for the learning check; folio 61 prints the rule for
    // that case, so Average ships as a citation rather than as a marked ruling (§9.43).
    difficulty: "Average",
    // "If a Traveller chooses Telepathy as their first talent, it will be gained automatically."
    freeFirst: "telepathy",
    // PSI is `2D − the terms served so far`, and one species tests it without the subtraction.
    formula: "2D",
    // A learned talent arrives at level 0.
    level: 0
});

/* -------------------------------------------- */

/* Post-career training, §9.133. Core p.55's Study Periods and Compagnon p.39-40's Experience Points
 * are two ways of moving one record, so the vocabulary below is shared and the engine is a property
 * of the programme rather than of the world. */

// Core p.55: "A Study Period is equal to eight weeks (or two months) of study and practice."
MGT2.TrainingPeriodWeeks = 8;

// Which book runs a programme. Stored per programme rather than read off the world setting: `both` is
// a legal setting, and a table that switches mid-campaign must not re-interpret a log written under
// the other engine.
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
// involved a check, and it moved the programme by an amount. `period` is Core's eight weeks, the
// middle four are the Companion's ways of earning a point, and `grant` is the reset both write when
// a level arrives.
MGT2.TrainingLogKinds = Object.freeze({
    period: "MGT2.Training.LogKind.period",
    study: "MGT2.Training.LogKind.study",
    fullTime: "MGT2.Training.LogKind.fullTime",
    teaching: "MGT2.Training.LogKind.teaching",
    adventure: "MGT2.Training.LogKind.adventure",
    grant: "MGT2.Training.LogKind.grant"
});

// Compagnon p.40's two price tables. `skill` is indexed by the LEVEL being bought and doubles per
// level past the sixth; a characteristic costs its new value, and a mental one twice that. SOC and
// PSI are in neither list and are trainable by neither table — the page names five characteristics,
// and psionic strength has training rules of its own. Spelled out rather than read off
// `MGT2.PhysicalCharacteristics`: that one is folio 9's heading, and a price table is its own rule.
MGT2.TrainingCosts = Object.freeze({
    skill: Object.freeze([1, 1, 2, 4, 8, 16, 32]),
    mental: Object.freeze(["intellect", "education"]),
    physical: Object.freeze(["strength", "dexterity", "endurance"])
});

// Core p.55: "The Athletics skill may be learned or improved but does not use EDU. Instead, use the
// appropriate physical characteristics (STR, DEX or END)." Which one is what the SPECIALITY names, so
// the printed word is read back off the skill name. Every language the system targets is listed, the
// device `MGT2.FirstAidSkills` already uses (§9.75): a skill is free text with no registry behind it.
MGT2.AthleticsTraining = Object.freeze({
    skills: Object.freeze(["athletics", "athlétisme"]),
    specialities: Object.freeze({
        strength: Object.freeze(["strength", "force"]),
        dexterity: Object.freeze(["dexterity", "dextérité"]),
        endurance: Object.freeze(["endurance"])
    })
});

/* -------------------------------------------- */

// What a drug leaves behind when it wears off. It names the pipeline rather than the wording: a
// condition is a state flag, damage goes through §1.10, and most drugs have neither.
MGT2.DrugAfterKinds = Object.freeze({
    none: "MGT2.DrugAfterKinds.none",
    condition: "MGT2.DrugAfterKinds.condition",
    damage: "MGT2.DrugAfterKinds.damage"
});

// What resets a per-Traveller dose counter — state that outlives the drug and so cannot live on it.
// Stims escalate per dose since sleep; anti-rad counts doses taken that day (Core p.115).
MGT2.DoseResets = Object.freeze({
    never: "MGT2.DoseResets.never",
    sleep: "MGT2.DoseResets.sleep",
    day: "MGT2.DoseResets.day"
});

// The intervals a drug's `onset` and `duration` can be written in, so that "10 minutes" and "1D
// hours" become a duration Foundry counts down (§9.90). Both fields stay free text — the catalogue
// prints them in prose and no closed list would hold it — so this is a READING of what was typed
// and an unrecognised phrase simply produces no duration.
//
// Every language the system targets is listed, the device `MGT2.FirstAidSkills` already uses
// (§9.75): a French world types "1D heures" and an English pack ships "10 minutes", and both are in
// the same world.
//
// `unit` is a **v14 `CONST.ACTIVE_EFFECT_DURATION_UNITS` name** and not a count of seconds, because
// v14 stores a duration as `{value, units}` — `duration.seconds` is a getter over that pair, and
// writing one goes through `#migrateDuration`'s legacy shim and loses the unit the book printed
// (`common/documents/active-effect.mjs:60-67`, `:229-240`). A ten-minute drug therefore reads as
// ten minutes rather than as six hundred seconds. The platform's list has no `weeks`, so a week is
// carried as `per: 7` days — the one unit conversion here, and it is exact.
MGT2.DoseUnits = Object.freeze({
    // Core folio 73: "each combat round lasts around six seconds of game time". This is the one
    // unit that sets a COMBAT duration, which is also the one interval §9.35 lets Foundry advance.
    round: { unit: "rounds", per: 1, words: Object.freeze(["round", "rounds", "tour", "tours"]) },
    second: { unit: "seconds", per: 1, words: Object.freeze(["second", "seconds", "seconde", "secondes"]) },
    minute: { unit: "minutes", per: 1, words: Object.freeze(["minute", "minutes"]) },
    hour: { unit: "hours", per: 1, words: Object.freeze(["hour", "hours", "heure", "heures"]) },
    day: { unit: "days", per: 1, words: Object.freeze(["day", "days", "jour", "jours", "journee", "journees"]) },
    week: { unit: "days", per: 7, words: Object.freeze(["week", "weeks", "semaine", "semaines"]) }
});

/* -------------------------------------------- */

// Companion p.59-64. `physicalOnly` is the half of the rule that separates the two directions: low
// gravity costs physical checks alone, high gravity costs every check.
MGT2.GravityBands = Object.freeze({
    micro: {label: "MGT2.GravityBands.micro", gees: 0.01, dm: -1, physicalOnly: true},
    minimal: {label: "MGT2.GravityBands.minimal", gees: 0.1, dm: -1, physicalOnly: true},
    veryLow: {label: "MGT2.GravityBands.veryLow", gees: 0.4, dm: -1, physicalOnly: true},
    low: {label: "MGT2.GravityBands.low", gees: 0.7, dm: -1, physicalOnly: true},
    standard: {label: "MGT2.GravityBands.standard", gees: 1, dm: 0, physicalOnly: false},
    high: {label: "MGT2.GravityBands.high", gees: 1.4, dm: -1, physicalOnly: false},
    extreme: {label: "MGT2.GravityBands.extreme", gees: 2.5, dm: -2, physicalOnly: false}
});

// How often a hazard bites — and only `round` has an event behind it. All seventeen REGION_EVENTS
// fire on movement or on a combat round and not one fires because time passed, so everything longer
// is a readout the referee applies (§9.35). `scheduled` says which is which, in the schema.
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

/* -------------------------------------------- */

// WHERE A SECTOR SITS, and what its subsectors are called. A world types the sector by name and the
// hex inside it (§9.142); this table is what turns that pair into one frame for all of Charted
// Space, `space.js` folding the origin in. The origin is in SECTORS, not in hexes — a sector is 32
// columns of 40 — and it is the only figure here a calculation reads.
//
// Geometry and proper names only. A subsector Traveller Map has never named is simply absent, so an
// unnamed one reads back as its letter rather than as a placeholder pretending to be a name; and a
// sector that is not here is not an error — a homebrew sector derives no coordinate and keeps
// everything the grid alone can tell it.
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
