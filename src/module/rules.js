const { fields } = foundry.data;

/**
 * The optional and variant rules a referee turns on, and what the interface then obeys.
 *
 * Where the books print an optional or a variant rule, the sheets and dialogs draw **one** reading —
 * this world's — instead of offering every printed one on every screen. Three consequences, and they
 * are what this module is:
 *
 * - **A rule the books make optional is off** until the referee turns it on. A rule the Core Rulebook
 *   simply prints is **on**, and the switch is what relaxes it — shipping those off would mean the
 *   system stops obeying its own rulebook out of the box. `default` says which.
 * - **A switch decides whether a choice exists; the document decides what it is.** With psionics off,
 *   a Traveller's PSI row is not blank — the control that would reveal it is gone, and the per-actor
 *   flag behind it is not offered.
 * - **Off hides; it never deletes.** A stored Sanity survives Sanity being switched off, and comes
 *   back unchanged when it is switched on again.
 *
 * `seed` is the fourth: what a world that predates the switch keeps. Registering a setting makes an
 * existing world take its `default`, so a world that has been playing with psionics visible would
 * lose them on update — `seedRules` writes the pre-switch behaviour instead, once, and only for a
 * world that has loaded before.
 */

/** Every rule setting is registered under this prefix, so one loop covers them and one call reads them. */
const PREFIX = "rule";

/** The namespace and key of one rule's setting, spread straight into `game.settings.get`/`set`. */
export const ruleSetting = key => ["mgt2", `${PREFIX}.${key}`];

export const MENU_ID = "mgt2-optional-rules";

/** Which rules have already been through `seedRules`. */
const SEEDED = "seededRules";

/**
 * The five the Core Rulebook never defines. Morale and Sanity have zero occurrences in it, Charm and
 * Luck appear only as ordinary English prose, and `other` comes from no book at all: they arrive from
 * other Traveller lines, and Sanity is its own optional rule (Robot Handbook p.112). One picker
 * rather than five switches, because a table that wants Sanity rarely wants Charm.
 */
export const EXTRA_CHARACTERISTICS = Object.freeze(["morale", "luck", "sanity", "charm", "other"]);

/** The sections the menu draws, in the order it draws them. */
export const RULE_GROUPS = Object.freeze(["travellers", "creation", "combat", "health", "space", "craft"]);

/**
 * The registry, and one row is three shapes:
 *
 * - a **switch** — a boolean, and what most rules are;
 * - a **picker** (`choices`) — a set, for a rule that is several adoptions wearing one name;
 * - a **choice** (`options`) — a string, for the two rules that are not on-or-off but *which of the
 *   printed procedures is in force*. A boolean would have to name one of them the absence of the
 *   other, and neither jump chapter is the negation of its neighbour.
 *
 * `book` and `page` print as the source line, because a referee choosing a rule wants to know where
 * to read it. `seed` is what a world that predates the switch keeps; a rule with no `seed` is one
 * whose default already is the behaviour that shipped.
 *
 * **A row with no `book` is a HOUSE RULE and says so** (§9.99). The sixteen in the `creation` group
 * exist because the books are silent rather than ambiguous, so they have no folio to print — and a
 * blank source line would read as a transcription somebody forgot rather than as a rule no book
 * contains. `unofficial` is the third state: a designer's answer outside any book, carried with its
 * year because two of the sixteen have exactly that standing and nothing stronger.
 */
export const RULES = Object.freeze({
    psionics: {
        group: "travellers", book: "core", page: "226-233",
        default: false, seed: true
    },
    extraCharacteristics: {
        group: "travellers", book: "robot", page: "112",
        choices: EXTRA_CHARACTERISTICS, choiceLabel: "MGT2.Characteristics.{key}.name",
        default: [], seed: EXTRA_CHARACTERISTICS
    },
    // Not a flag, because a table may legitimately run the Companion's Experience Points *and*
    // Core's Study Periods — one Traveller at a downport university, another taught by a comrade.
    // `both` is what makes the picker ask which engine a new programme uses; on either single option
    // it does not ask, and a programme of the other kind still reads and still resolves, because the
    // engine is stored on the record (§9.133).
    advancementSystem: {
        group: "travellers", book: "core", page: "55",
        options: { core: "MGT2.Rules.advancementSystem.core",
            companion: "MGT2.Rules.advancementSystem.companion",
            both: "MGT2.Rules.advancementSystem.both" },
        default: "core"
    },

    /* Character creation, §9.56's sixteen. Every question §9.48-§9.55 left open, each with the default
     * the user chose on 2026-08-14. **None of these is a printed rule** — there is no comprehensive
     * MGT2 errata, and of the fourteen questions the design left open, one has an official answer, two
     * have edition-stale designer answers and eleven have nothing anywhere. So the group prints "house
     * rule" where every other group prints a folio, and `unofficial` is the year of the only external
     * standing two of them have.
     *
     * **Not one carries a `seed`, and that is not an omission**: no world has ever run a creation loop,
     * so there is no pre-switch behaviour for a world that predates the switch to keep.
     *
     * **Five of §9.56's key names are changed here and the reason is §9.47.** The design named them for
     * the career or species that raised each question — the Drifter's assignment change, the Prisoner's
     * promotion, the Prisoner's lawyer, the Aslan ageing trigger, the Hiver's Manipulator status. A
     * settings key is code, so those five would have been the career names the invariant forbids, and
     * each one governs more than the case that raised it: the assignment rule applies to any career
     * that declares none, the promotion rule to any career whose exit is governed by a track. The
     * hints name the case, because a hint is prose for the referee and prose is where the book's own
     * words belong. */

    // "Instead of rolling" binds only the first-career sentence, and 1st edition allowed both. On is
    // ADDITIONAL: the term's own skill roll still happens. Hands one extra skill per career after the
    // first, which is one of the two here a player will feel.
    secondCareerBasicTraining: {
        group: "creation",
        default: true
    },
    // A Mongoose staff answer of 2018 says the untrained DM−3 applies during creation and that
    // characteristic DMs do not. An unverified 2026 claim reports the opposite with no quote and no
    // correspondence published, so the sourced one wins — and this is the toggle most worth surfacing,
    // because an official clarification would flip a default touching every skill-named check.
    untrainedDMInCreation: {
        group: "creation", unofficial: "2018",
        default: true
    },
    // Folio 55 prints the only on-breach procedure in the book — for post-career study — and it is
    // transposed here. Off leaves the cap untracked.
    skillCapBreach: {
        group: "creation",
        default: true
    },
    // The two ladders are numbered independently and a commission restarts at 1, so the printed number
    // is the number. A widespread blog claim that they combine has no text behind it.
    officerRankNumbering: {
        group: "creation",
        options: { printed: "MGT2.Rules.officerRankNumbering.printed",
            combined: "MGT2.Rules.officerRankNumbering.combined" },
        default: "printed"
    },
    // A career whose exit is decided by a track prints a full rank ladder with bonuses that would have
    // no use otherwise, so a successful advancement promotes AND grants the extra skill roll as well as
    // testing the track.
    trackedAdvancementPromotes: {
        group: "creation",
        default: true
    },
    // The book gives two assignment-change rules by career group and a third for one career, and leaves
    // one career in none of the lists — the only career in that state. Demanding a roll to move inside
    // a career that needs none to enter is incoherent, so the default for a template that declares
    // nothing is free.
    undeclaredAssignmentChange: {
        group: "creation",
        options: { requalifyKeepRank: "MGT2.Chargen.AssignmentChange.requalifyKeepRank",
            newCareer: "MGT2.Chargen.AssignmentChange.newCareer",
            separateCareers: "MGT2.Chargen.AssignmentChange.separateCareers",
            free: "MGT2.Chargen.AssignmentChange.free" },
        default: "free"
    },
    // The ageing crisis is the only printed rule for a characteristic at zero during creation, so it is
    // transposed to the injury that causes one. **This one can kill a Traveller**, so the control that
    // applies it states the price before the roll is applied and never after.
    creationInjuryToZero: {
        group: "creation",
        default: true
    },
    // No volume states whether species modifiers replace or stack. One published line is a third
    // bespoke set, neither parent nor sum, and the corpus says "additional modifiers" where it means to
    // stack — so replacement is the reading and this ships off.
    speciesModifiersStack: {
        group: "creation",
        default: false
    },
    // The cap counts skill LEVELS and a speciality level is a level. It bites specialists sooner, which
    // is the honest reading and the second of the two a player will feel.
    specialitiesCountToCap: {
        group: "creation",
        default: true
    },
    // The ageing table stops at −6, printed bare rather than as "−6 or less", while the DM is the
    // Traveller's total terms — so a nine-term Traveller rolling snake-eyes sits at −7 and the book
    // prints neither a row nor an instruction to floor. It is the worst printed outcome and every rung
    // already adds severity; extrapolating invents rules the game does not have.
    ageingTableFloor: {
        group: "creation",
        default: true
    },
    // The general ceiling is printed and nothing exempts PSI, and no species maximum is printed for
    // anyone.
    psiCeiling: {
        group: "creation",
        default: true
    },
    // One published species prints an ageing age and a term count that do not agree. A staff writer's
    // 2009 answer treats the printed age as a Classic Traveller import and computes from the terms —
    // edition-stale, and it overrides a printed number, which is the strongest external standing of the
    // sixteen and still a house rule.
    ageingTriggerPrecedence: {
        group: "creation", unofficial: "2009",
        options: { terms: "MGT2.Rules.ageingTriggerPrecedence.terms",
            age: "MGT2.Rules.ageingTriggerPrecedence.age" },
        default: "terms"
    },
    // The cumulative −1 is per check attempted within a session; a lifetime counter would make the
    // second training the book prices at Cr100000 pointless.
    psionicTrainingReset: {
        group: "creation",
        default: true
    },
    // One species' folio contradicts itself within two lines — a status is "for life once attained" and
    // "possible to fall from and regain, perhaps multiple times". The middle reading is the only one
    // that satisfies all three of the page's sentences.
    trackRungPermanence: {
        group: "creation",
        options: { canFall: "MGT2.Rules.trackRungPermanence.canFall",
            heldThenPermanent: "MGT2.Rules.trackRungPermanence.heldThenPermanent",
            permanent: "MGT2.Rules.trackRungPermanence.permanent" },
        default: "heldThenPermanent"
    },
    // One career's event spends money mid-creation, and the cash model produces none before mustering
    // out. The only printed mechanism for a cost incurred during creation is debt against benefits,
    // with the unpaid remainder following the Traveller into play.
    creationCostsBecomeDebt: {
        group: "creation",
        default: true
    },
    // Official errata: an event draft "(and similar effects) can cause a Traveller to be drafted more
    // than once", printed as a general statement rather than a local exception.
    eventDraftBudget: {
        group: "creation",
        default: true
    },

    /* The Companion's optional creation rules, which are **session configuration** and not per-actor
     * state (§9.46): a table plays one way for everybody, and §9.38's "no session document" was about
     * session STATE, never about configuration. These six carry a folio, so they print a real source
     * line where the sixteen above print "house rule" — the difference the registry was built to say.
     * What stays out of v1 is the pair that REPLACE the career system: package-based creation and
     * point-buy. */

    // A failed Survival kills the Traveller instead of causing a Mishap. The only option that
    // destroys work — and under the write-as-you-go policy the history is already on the actor, so
    // "start again" is a decision about that document and the system never deletes it silently.
    creationIronMan: {
        group: "creation", book: "companion", page: "13",
        default: false
    },
    // 3D drop the lowest, for two characteristics — or four, or all six.
    creationBoonDice: {
        group: "creation", book: "companion", page: "13",
        options: { none: "MGT2.Rules.creationBoonDice.none", two: "MGT2.Rules.creationBoonDice.two",
            four: "MGT2.Rules.creationBoonDice.four", all: "MGT2.Rules.creationBoonDice.all" },
        default: "none"
    },
    // Both Core methods and both Companion ones on one line, because they answer one question: how
    // the six numbers reach the six characteristics.
    creationAssignment: {
        group: "creation", book: "core", page: "9",
        options: { choose: "MGT2.Rules.creationAssignment.choose",
            printed: "MGT2.Rules.creationAssignment.printed",
            pool: "MGT2.Rules.creationAssignment.pool",
            heroic: "MGT2.Rules.creationAssignment.heroic" },
        default: "choose"
    },
    // A cap the referee sets before anyone starts. 0 is the printed game.
    creationMaximumTerms: {
        group: "creation", book: "companion", page: "13",
        number: { min: 0, max: 20, step: 1 },
        default: 0
    },
    // Skills are PICKED from the tables instead of rolled.
    creationSkillSelection: {
        group: "creation", book: "companion", page: "13",
        default: false
    },
    // The option that contradicts the thesis, and it earns its row by doing so: it switches off the
    // Connections Rule and both group-level closing steps, degenerating the grid to a single column.
    creationSolo: {
        group: "creation", book: "companion", page: "13",
        default: false
    },

    // Core p.77's magazine is a rule, not an option — so it ships on, and the switch is what a table
    // that does not count shots turns off. Same for the two below it.
    magazines: {
        group: "combat", book: "core", page: "77",
        default: true
    },
    // Which cell the prompt's threshold strip starts on. Folio 77 prints the rule (100 m), names the
    // concession (300 m in a no-stress environment) and leaves the third to the table, so this is a
    // choice between three printed answers rather than a switch.
    extremeRange: {
        group: "combat", book: "core", page: "77",
        options: { combat: "MGT2.RollPrompt.ThresholdCombat", noStress: "MGT2.RollPrompt.ThresholdNoStress",
            none: "MGT2.RollPrompt.ThresholdNone" },
        default: "combat"
    },

    radiation: {
        group: "health", book: "core", page: "81",
        default: true
    },
    encumbrance: {
        group: "health", book: "core", page: "98",
        default: true
    },
    // The default a NEW hull is created with. The hull keeps its own field and may still differ — a
    // Companion-built ship can sail a Core campaign (§9.97).
    jumpRuleset: {
        group: "space", book: "core", page: "158",
        options: { core: "MGT2.Voyage.RulesetCore", companion: "MGT2.Voyage.RulesetCompanion" },
        default: "core"
    },
    // Two things folio 158 prints as the referee's to grant: the extra 1D of time the crew *perceives*
    // on a late jump, and the outcome it hands to "a merciful referee" in place of the worst band.
    perceivedTime: {
        group: "space", book: "core", page: "158",
        default: false, seed: true
    },
    mercifulReferee: {
        group: "space", book: "core", page: "158",
        default: false, seed: true
    },
    // Folio 149 prints a 240 divisor and a 40-year term and never multiplies them out, so the number
    // of payments is read off folio 154, which divides the year by 12 — 480 periods, and a mortgage
    // that repays exactly twice the price. On, folio 153's four-week period is taken literally
    // instead: 13 a year, 520 periods, x2.17. No `seed` — no world has ever been shown a term.
    mortgageFourWeekPeriods: {
        group: "space", book: "core", page: "149, 154",
        default: false
    },
    // An ALTERNATIVE resolution system for the same fiction rather than a variant of one rule, which
    // is the strongest form of bucket A there is: HG p.105 offers the chapter in place of the Core
    // rules and p.122 sends a dispersed handful of ships back to them. It gates the derived Fleet
    // Ship Sheet — never the stored `crewSkill` behind it, which is C5's test (§9.100 C).
    fleetBattles: {
        group: "space", book: "highGuard", page: "105-124",
        default: false
    },

    // Both are advisory readings rather than gates, and both stay that way: the switch decides whether
    // the reading is drawn, never whether it blocks (§9.92, RH p.115).
    designValidation: {
        group: "craft", book: "core", page: "177",
        default: true
    },
    taskCeiling: {
        group: "craft", book: "robot", page: "115",
        default: true
    }
});

/* -------------------------------------------- */

/**
 * The stored field of a picker, a choice or a **count**; a switch needs none and registers as a
 * plain Boolean. The fourth shape arrived with §9.46's maximum-terms cap, which is a number the
 * referee sets and which no boolean or closed list can express.
 */
function ruleField(rule) {
    if ( rule.options ) return new fields.StringField({
        required: true, blank: false, choices: rule.options, initial: rule.default });
    if ( rule.number ) return new fields.NumberField({
        required: true, nullable: false, integer: true, initial: rule.default, ...rule.number });
    return new fields.SetField(
        new fields.StringField({ required: true, blank: false, choices: rule.choices }),
        { initial: () => [...rule.default] });
}

export const registerRules = function () {

    // Not user-facing: which rules this world has already been through seeding for. A SET and not a
    // "has it run" flag, because the registry grows: a boolean marks the world done and every rule
    // added in a later version then misses its seed silently, which is exactly what a seed exists to
    // prevent. No `choices` on the member field — a key retired from the registry must not make the
    // stored set invalid.
    game.settings.register("mgt2", SEEDED, {
        scope: "world",
        config: false,
        type: new fields.SetField(new fields.StringField({ required: true, blank: false }),
            { initial: () => [] })
    });

    for ( const [key, rule] of Object.entries(RULES) ) {
        game.settings.register(...ruleSetting(key), {
            name: `MGT2.Rules.${key}.name`,
            hint: `MGT2.Rules.${key}.hint`,
            scope: "world",
            // The grouped menu below is where these are set: Foundry's settings pane cannot group,
            // and an ungrouped list of switches is the noise this whole feature exists to remove.
            config: false,
            type: (rule.choices || rule.options || rule.number) ? ruleField(rule) : Boolean,
            default: rule.default,
            requiresReload: false,
            onChange: refreshRuleUI
        });
    }
};

/* -------------------------------------------- */

export const Rules = {

    /** The stored value: a boolean for a switch, a Set for a picker, a key for a choice. */
    get(key) {
        return game.settings.get(...ruleSetting(key));
    },

    /** @returns {boolean} Whether a switch is on. */
    on(key) {
        return this.get(key) === true;
    },

    /** @returns {boolean} Whether a picker holds `member`. */
    has(key, member) {
        return this.get(key)?.has(member) === true;
    },

    /**
     * Whether a characteristic exists at this table at all — which is not the same question as
     * whether an actor shows it (`ActorBaseData#isCharacteristicShown` asks both). The six the Core
     * Rulebook defines are never in question, and neither are the damage pools.
     * @param {string} key
     */
    characteristic(key) {
        if ( key === "psionic" ) return this.on("psionics");
        if ( EXTRA_CHARACTERISTICS.includes(key) ) return this.has("extraCharacteristics", key);
        return true;
    }
};

/* -------------------------------------------- */

/**
 * Re-render this system's open windows, so a switch the referee flips reaches a player's open sheet
 * rather than waiting for them to reopen it. A world setting's `onChange` fires on every connected
 * client, which is what makes that work.
 *
 * `foundry.applications.instances` is the registry of rendered ApplicationV2 instances — *"A registry
 * of currently rendered ApplicationV2 instances"* — and the `mgt2` class every application here
 * carries is what keeps this from re-rendering core's windows too. Debounced because a picker writes
 * one setting per toggle and `seedRules` writes several in a row.
 *
 * **Chat cards are deliberately out of reach.** A posted card records a roll made under the rules in
 * force at the time; a switch flipped afterwards must not rewrite it.
 */
export const refreshRuleUI = foundry.utils.debounce(() => {
    // Re-prepare BEFORE re-drawing, because a re-render alone reads stale derived data. Some gates
    // have to live in data preparation rather than in a template — Core p.81's cumulative END loss
    // and Core p.98's encumbrance band are both derived — and nothing re-runs `prepareData` when a
    // setting changes, so switching radiation off would hide the block while the penalty stayed on
    // the characteristic until the next update or reload.
    for ( const actor of game.actors ) actor.reset();
    // An unlinked token carries its own synthetic Actor, which `game.actors` does not reach.
    for ( const scene of game.scenes ) {
        for ( const token of scene.tokens ) if ( !token.actorLink ) token.actor?.reset();
    }
    for ( const app of foundry.applications.instances.values() ) {
        // The menu itself re-renders from its own submit; re-rendering it here steals the focus of
        // the control that was just clicked.
        if ( app.options.classes?.includes("mgt2") && (app.id !== MENU_ID) ) app.render();
    }
}, 100);

/* -------------------------------------------- */

/**
 * Give a world that predates a switch the behaviour it already had. GM only, and **once per rule**
 * rather than once per world: a rule added in a later version has its own first encounter with a
 * world that was already playing, and that is the moment its seed is owed.
 *
 * @param {boolean} existing   Whether this world has loaded under an earlier version — read from
 *                             `migrationVersion` **before** the migration stamps it. A world seeing
 *                             a rule for the first time on a first-ever load is a new table and
 *                             takes the book-faithful default instead.
 */
export async function seedRules(existing) {
    if ( !game.user.isGM ) return;
    const seeded = new Set(game.settings.get("mgt2", SEEDED));
    const pending = Object.entries(RULES).filter(([key]) => !seeded.has(key));
    if ( !pending.length ) return;

    for ( const [key, rule] of pending ) {
        // Copied, never passed through: `ArrayField#clean` cleans each element **in place**, and a
        // registry constant is frozen — writing the seed straight in throws on the first cell.
        if ( existing && ("seed" in rule) ) {
            const seed = Array.isArray(rule.seed) ? [...rule.seed] : rule.seed;
            await game.settings.set(...ruleSetting(key), seed);
        }
        seeded.add(key);
    }
    await game.settings.set("mgt2", SEEDED, [...seeded]);
}
