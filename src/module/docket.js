import { Checks } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { ambushDM, postRequest, SKILL_MODES, UNRESOLVED } from "./request.js";
import { RollPromptHelper } from "./roll-prompt.js";
import { TravellerActorSheet } from "./actors/character-sheet.js";
import { MGT2Screen } from "./screens.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const TEMPLATES = "systems/mgt2/templates";

/** What the roster takes, tested AFTER the uuid resolves — a bare document name cannot say `npc`. */
const ROSTER_TYPES = "Actor.character Actor.npc Actor.robot";

/**
 * The average of 2D, which is what every marker on the spread is placed against — the same constant
 * and the same arithmetic `roll-prompt.js` uses for its own ladder, so the referee's reading of a
 * roster row and the player's reading of their own prompt cannot disagree.
 */
const AVERAGE_2D = 7;

/** These controls live in no `<form>`: the Docket submits nowhere and reads its own state. */
const FIELD = "req";

/**
 * The GM's compose window: one Traveller demand, resolved against a named roster BEFORE it is sent.
 * @extends {ApplicationV2}
 */
export class Docket extends MGT2Screen(HandlebarsApplicationMixin(ApplicationV2)) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-docket",
        classes: ["mgt2", "docket"],
        position: { width: 620, height: 640 },
        window: { resizable: true, icon: "fa-regular fa-clipboard-list",
            title: "MGT2.Request.Docket" },
        actions: {
            post: Docket.#onPost,
            seedControlled: Docket.#onSeedControlled,
            seedParty: Docket.#onSeedParty,
            seedCombatants: Docket.#onSeedCombatants,
            clearRoster: Docket.#onClearRoster,
            dropRow: Docket.#onDropRow,
            dupeRow: Docket.#onDupeRow,
            toggleSelf: Docket.#onToggleSelf,
            toggleOverride: Docket.#onToggleOverride,
            clearOverride: Docket.#onClearOverride,
            openDocument: Docket.#onOpenDocument
        }
    };

    /**
     * Three parts and the split is deliberate: the compose form renders ONCE and is updated in
     * place, so a caret is never lost mid-word, while the roster and the foot are a reading of it
     * and re-render on every change.
     * @inheritDoc
     */
    static PARTS = {
        form: { template: `${TEMPLATES}/docket.html` },
        roster: { template: `${TEMPLATES}/docket-roster.html`, scrollable: [""] },
        foot: { template: `${TEMPLATES}/docket-foot.html` }
    };

    /**
     * One window. A second would compose a second demand against the same roster.
     * @param {object} [seed]   A partial demand, plus `from` naming the roster source and `fire`
     *     for the recents menu, which posts at the current roster with no window
     */
    static open(seed = {}) {
        if ( !game.user.isGM ) {
            ui.notifications.warn(game.i18n.localize("MGT2.Errors.DocketGMOnly"));
            return null;
        }
        const existing = foundry.applications.instances.get("mgt2-docket");
        const docket = existing ?? new Docket();
        if ( existing ) existing.seed();
        if ( seed.from === "combat" ) docket.#add(Docket.#combatantActors());
        for ( const key of Object.keys(docket.#demand) ) {
            if ( seed[key] !== undefined ) docket.#demand[key] = foundry.utils.deepClone(seed[key]);
        }
        // A recent request fired from the chat control's context menu goes at the current roster
        // with no window at all, which is why the RECENT rail and its footer button were cut.
        if ( seed.fire ) return Docket.#onPost.call(docket);
        return docket.render({ force: true });
    }

    /** @inheritDoc */
    constructor(options = {}) {
        super(options);
        this.#send.visibility = game.settings.get("mgt2", "request.visibility");
        this.seed();
    }

    /**
     * The epic-rolls seeding heuristic, which is the best thing in that module: whoever the referee
     * has selected, and otherwise the active table.
     */
    seed() {
        const controlled = Docket.#controlledActors();
        this.#add(controlled.length ? controlled : Docket.#partyActors());
    }

    /** It never renders for anyone else, and the entry points are GM-gated too. @inheritDoc */
    _canRender(options) {
        if ( !game.user.isGM ) return false;
        return super._canRender(options);
    }

    /** The demand as composed. */
    #demand = {
        skillMode: "named", skill: "", flavor: "", chars: [], difficulty: "",
        stance: "none", timeframe: "Normal", dm: { label: "", value: 0 },
        tally: "solo", showTarget: true, sideRoll: false, ambush: "none"
    };

    /** SEND, which is about the posting rather than about the demand. */
    #send = { visibility: "public", roll: true };

    /**
     * The last reading, kept so the form part's two roster-derived controls can be patched without
     * resolving the whole roster a second time on every keystroke.
     * @type {object|null}
     */
    #last = null;

    /**
     * The roster, per-client and never persisted. `over` is the four things a row may disagree with
     * the demand about, `null` for each meaning it does not; `open` is whether its editor is shown.
     * @type {{id: string, uuid: string, name: string, self: boolean, open: boolean,
     *     over: {skill: ?string, difficulty: ?string, chars: ?string[], opposes: ?string}}[]}
     */
    #rows = [];

    /** What had the caret when a part was replaced, since ApplicationV2 restores no focus at all. */
    #focus = null;

    /** Set before the first await of the post: pressing twice must not send two cards. */
    #posting = false;

    /** Whoever the referee has selected. Naming documents is the permitted side of the canvas line. */
    static #controlledActors() {
        return (canvas?.tokens?.controlled ?? []).map(token => token.actor).filter(actor => actor);
    }

    /** Every active non-GM user's assigned character. */
    static #partyActors() {
        return game.users.filter(user => user.active && !user.isGM && user.character)
            .map(user => user.character);
    }

    /** Every combatant of the encounter in progress, ships included — a group carries no actor. */
    static #combatantActors() {
        return (game.combat?.combatants ?? []).map(combatant => combatant.actor).filter(actor => actor);
    }

    /** Appended, never replaced, and deduplicated on the uuid: adding the party twice adds nobody. */
    #add(actors) {
        const held = new Set(this.#rows.map(row => row.uuid));
        for ( const actor of actors ) {
            if ( !actor?.uuid || held.has(actor.uuid) ) continue;
            held.add(actor.uuid);
            this.#rows.push({
                id: foundry.utils.randomID(),
                uuid: actor.uuid,
                name: actor.name,
                // A creature nobody but the referee owns answers on the referee's client; a
                // Traveller whose player is simply offline is `unclaimed` and waits for them.
                self: !Docket.addresseeFor(actor) && !Docket.#hasPlayerStake(actor),
                open: false,
                over: { skill: null, difficulty: null, chars: null, opposes: null }
            });
        }
    }

    #row(id) {
        return this.#rows.find(row => row.id === id) ?? null;
    }

    /** Does any non-GM hold any level on this actor at all? A `stash` shared with the table does. */
    static #hasPlayerStake(actor) {
        const ownership = actor.ownership ?? {};
        if ( (ownership.default ?? 0) > CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE ) return true;
        return game.users.some(user => !user.isGM
            && ((ownership[user.id] ?? 0) > CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE));
    }

    /**
     * Who is told this line is theirs — Mongoose's `findActorOwner()` rule, **ported and not
     * copied**.
     * @returns {string|null}   A User id
     */
    static addresseeFor(actor) {
        const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        const ownership = actor?.ownership ?? {};
        const players = game.users.filter(user => user.active && !user.isGM);
        const explicit = players.find(user => ownership[user.id] === OWNER);
        if ( explicit ) return explicit.id;
        // Owned by default is owned by everyone, so the first active player is as good a claim as
        // any — and a claim is what the line needs, since it decides who the chit is enabled for.
        if ( ownership.default === OWNER ) return players[0]?.id ?? null;
        return null;
    }

    /** The demand resolved against every row, once — and a row may disagree with the demand. */
    #reading() {
        const target = MGT2Helper.getEffectTarget(this.#demand.difficulty);
        const actors = this.#rows.map(row => Docket.#actorOf(row.uuid));
        const rows = this.#rows.map((row, index) => this.#resolve(row, actors[index], actors));

        return {
            target,
            rows,
            counts: {
                asked: rows.length,
                unclaimed: rows.filter(row => row.status === "unclaimed").length,
                unable: rows.filter(row => row.status === "unable").length,
                untrained: rows.filter(row => row.untrained).length,
                unresolved: rows.filter(row => row.skillItem === UNRESOLVED).length,
                self: rows.filter(row => row.self).length,
                overridden: rows.filter(row => row.overridden).length,
                paired: rows.filter(row => row.paired).length
            }
        };
    }

    /** What one row is being asked, which is the demand unless that row disagrees with it. */
    #asked(row) {
        const demand = this.#demand;
        return {
            skill: row.over.skill ?? demand.skill,
            chars: row.over.chars ?? demand.chars,
            difficulty: row.over.difficulty ?? demand.difficulty
        };
    }

    /** A row that cannot be read degrades to its stored name and never throws — the roster contract. */
    static #actorOf(uuid) {
        let actor = null;
        try { actor = foundry.utils.fromUuidSync(uuid); } catch { return null; }
        // A packed Actor answers with an index record: a name and a type, and no sheet to read.
        return actor?.system?.characteristics ? actor : null;
    }

    /**
     * Does the typed name match anything on the roster, or a chassis skill the books fix?
     * @returns {""|"skill"|"psionic"}   A skill anywhere on the roster beats a power anywhere on it
     */
    static #knownSkill(typed, actors) {
        const name = typed.trim();
        let kind = "";
        for ( const actor of actors ) {
            for ( const item of actor?.items ?? [] ) {
                if ( !Docket.#rollable(item) || !MGT2Helper.matchesSkill(item.name, name) ) continue;
                if ( Docket.#isSkill(item) ) return "skill";
                kind = "psionic";
            }
        }
        if ( kind ) return kind;
        return Docket.#vehicleSkillLabels().some(label => MGT2Helper.matchesSkill(label, name))
            ? "skill" : "";
    }

    static #isSkill(item) {
        return (item?.type === "talent") && (item?.system?.subType === "skill");
    }

    /** Core p.229 makes a power a skill check on the power itself, so a demand may name one. */
    static #isPower(item) {
        return (item?.type === "talent") && (item?.system?.subType === "psionic");
    }

    static #rollable(item) {
        return Docket.#isSkill(item) || Docket.#isPower(item);
    }

    /** Core p.66, p.68, p.71's chassis skills, which no Traveller need carry for the name to be real. */
    static #vehicleSkillLabels() {
        return [
            ...Object.values(MGT2.VehicleSkills).map(skill => skill.label),
            ...Object.values(MGT2.VehicleSpecialities)
        ].map(key => game.i18n.localize(key));
    }

    /**
     * One roster row: who answers it, what the skill resolves to on THEIR sheet, which
     * characteristic they would roll, and what the whole thing is worth.
     */
    #resolve(row, actor, actors) {
        const demand = this.#demand;
        const asked = this.#asked(row);
        const user = actor ? Docket.addresseeFor(actor) : null;
        // Being paired is not disagreeing with the demand — Core p.62 is about what the check is
        // measured against, not about what was asked — so the two are counted apart.
        const overridden = [row.over.skill, row.over.difficulty, row.over.chars]
            .some(value => value !== null);
        const base = {
            ...row,
            name: actor?.name || row.name,
            actor,
            user,
            userName: user ? game.users.get(user)?.name ?? "" : "",
            skillItem: null,
            untrained: false,
            overridden,
            paired: row.over.opposes !== null,
            asked
        };

        // No sheet loaded is its own answer and not a failure of the demand.
        if ( !actor ) {
            return { ...base, status: "unable", why: game.i18n.localize("MGT2.Request.NotLoaded"),
                terms: [], total: 0, effect: null };
        }

        const characteristic = Docket.#characteristicFor(actor, asked.chars);
        if ( !characteristic ) {
            const wanted = asked.chars.length ? asked.chars : actor.system.rollableCharacteristics;
            return { ...base, status: "unable", terms: [], total: 0, effect: null,
                why: game.i18n.format("MGT2.Request.CannotAnswer", {
                    chars: wanted.map(key => Docket.#shortName(key)).join("/") })
            };
        }

        // The only discriminator the roster has evidence for: a name not one docketed Traveller has
        // ever heard of is a name this client cannot resolve, and the line posts as open-skill.
        const named = (demand.skillMode === "named") && Boolean(asked.skill.trim());
        const skill = Docket.#skillFor(actor, asked.skill,
            { named, known: named ? Docket.#knownSkill(asked.skill, actors) : "" });
        // Core p.229: "A Traveller with no PSI points cannot attempt to activate a power." The
        // roster is where a refusal at the moment of the click becomes a refusal before the ask.
        if ( skill.psionic && (Docket.#psiReserve(actor) <= 0) ) {
            return { ...base, status: "unable", terms: [], total: 0, effect: null,
                skillItem: skill.item, why: game.i18n.localize("MGT2.Request.NoPsi") };
        }
        const terms = [[characteristic.label, characteristic.dm]];
        if ( skill.label ) terms.push([skill.label, skill.dm]);
        const timeframe = MGT2Helper.getTimeframeDM(demand.timeframe);
        if ( timeframe ) {
            terms.push([game.i18n.localize(MGT2.Timeframes[demand.timeframe]), timeframe]);
        }
        if ( demand.dm.value ) {
            terms.push([demand.dm.label.trim()
                || game.i18n.localize("MGT2.Request.UnnamedDM"), demand.dm.value]);
        }
        const ambush = ambushDM(demand.ambush, base.self);
        if ( ambush ) terms.push([game.i18n.localize("MGT2.Request.Ambush"), ambush]);

        const { total, terms: reduced, parts } = Checks.modifiers(terms);
        return {
            ...base,
            parts,
            skillItem: skill.item,
            untrained: skill.untrained === true,
            skillLabel: skill.label,
            skillDisplay: skill.display,
            characteristic: characteristic.key,
            charShort: Docket.#shortName(characteristic.key),
            charDM: MGT2Helper.signed(characteristic.dm, "+0"),
            status: base.self ? "waiting" : (user ? "waiting" : "unclaimed"),
            terms: reduced,
            total,
            totalDisplay: MGT2Helper.signed(total, "+0"),
            negative: total < 0,
            // Where this row lands on an average roll, which is the only reading that means
            // anything before the dice — and the caption on the strip states the 7 out loud.
            effect: AVERAGE_2D + total - MGT2Helper.getEffectTarget(asked.difficulty).value
        };
    }

    /** Core p.229's reserve, where the sheet keeps one at all. */
    static #psiReserve(actor) {
        if ( !actor.system.isCharacteristicShown?.("psionic") ) return Infinity;
        return actor.system.characteristics.psionic?.value ?? 0;
    }

    /** Which characteristic the row will be rolled on. */
    static #characteristicFor(actor, chars) {
        const rollable = actor.system.rollableCharacteristics ?? [];
        const offered = chars.length ? chars.filter(key => rollable.includes(key)) : rollable;
        let best = null;
        for ( const key of offered ) {
            const score = actor.system.characteristics[key];
            if ( !score ) continue;
            if ( !best || (score.dm > best.dm) ) {
                best = { key, dm: score.dm, label: game.i18n.localize(MGT2.Characteristics[key] ?? key) };
            }
        }
        return best;
    }

    /**
     * The three states, resolved on THIS client and frozen at Post: an Item id, `null` for the
     * referee's untrained, and `"unresolved"` where the name matched nothing anyone here carries.
     */
    static #skillFor(actor, typed, { named, known }) {
        // Characteristic-only (p.58) and open-skill demands name no skill at all, so the line
        // carries no resolution: `skillMode` short-circuits it on the answering client, and DM+0 is
        // right.
        if ( !named ) return { item: null, label: "", dm: 0 };

        const match = actor.items.find(item => Docket.#rollable(item)
            && MGT2Helper.matchesSkill(item.name, typed));
        if ( match ) {
            return { item: match.id, label: match.getRollDisplay(false), dm: match.system.level,
                display: match.getRollDisplay(), psionic: Docket.#isPower(match) };
        }
        // Nobody on the roster has heard of the name — and Core p.229's powers are known or not
        // known, so a Traveller without the power gets the same third state rather than folio 59's
        // DM-3, which is the rule for a skill.
        if ( !known || (known === "psionic") ) {
            return { item: UNRESOLVED, label: "", dm: 0,
                display: game.i18n.localize("MGT2.Request.Unresolved") };
        }
        // Core p.59, as p.69's Jack-of-All-Trades leaves it. The prompt already owns that reading.
        const untrained = RollPromptHelper.untrained(actor);
        return { item: null, label: untrained.label, dm: untrained.dm, untrained: true,
            display: `${untrained.label} ${MGT2Helper.signed(untrained.dm)}` };
    }

    /** `INT`, from the localised name — the roster prints eight of these across a 620 px window. */
    static #shortName(key) {
        return game.i18n.localize(MGT2.Characteristics[key] ?? key).slice(0, 3).toUpperCase();
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const reading = this.#last = this.#reading();
        Object.assign(context, {
            field: FIELD,
            demand: this.#demand,
            send: this.#send,
            rosterTypes: ROSTER_TYPES,
            rows: this.#overrideContext(reading.rows),
            counts: reading.counts,
            spread: Docket.#spread(reading.rows),
            summary: this.#summary(reading),
            skillModes: SKILL_MODES.map(key => ({
                key, label: game.i18n.localize(`MGT2.Request.SkillMode.${key}`),
                active: key === this.#demand.skillMode
            })),
            // The union of the docketed actors' own vocabularies.
            vocabulary: this.#vocabulary(reading.rows),
            characteristics: this.#characteristicOptions(reading.rows),
            difficulties: Object.entries(MGT2.DifficultyTargets).map(([key, target]) => ({
                key, target, label: game.i18n.localize(MGT2.Difficulty[key]),
                active: key === this.#demand.difficulty
            })),
            stances: Object.entries(MGT2.Stance).map(([key, label]) => ({
                key, label: game.i18n.localize(label), active: key === this.#demand.stance
            })),
            // A strip implies an order, so the timeframes run rushed to unhurried as the prompt's do.
            timeframes: Object.keys(MGT2.Timeframes).map(key => ({
                key, label: game.i18n.localize(MGT2.Timeframes[key]),
                dm: MGT2Helper.getTimeframeDM(key),
                display: MGT2Helper.signed(MGT2Helper.getTimeframeDM(key)),
                active: key === this.#demand.timeframe
            })).sort((a, b) => a.dm - b.dm),
            tallies: Object.entries(MGT2.RequestTally).map(([key, label]) => ({
                key, label: game.i18n.localize(label), active: key === this.#demand.tally
            })),
            visibilities: ["public", "addressed"].map(key => ({
                key, label: game.i18n.localize(`MGT2.Request.Visibility.${key}`),
                active: key === this.#send.visibility
            })),
            ambushes: Object.entries(MGT2.RequestAmbush).map(([key, label]) => ({
                key, label: game.i18n.localize(label), active: key === this.#demand.ambush
            })),
            // Core p.73 prints the collapse and the ambush for a characteristic-only check, which
            // is the case it could decide: whose skill level a collapsed roll uses, no book states.
            canSideRoll: this.#demand.skillMode === "none"
        });
        return context;
    }

    /** The datalist: every skill and power on the roster, plus the chassis skills the books fix. */
    #vocabulary(rows) {
        const names = new Set(Docket.#vehicleSkillLabels());
        for ( const row of rows ) {
            for ( const item of row.actor?.items ?? [] ) {
                if ( Docket.#rollable(item) ) names.add(item.name);
            }
        }
        return [...names].sort((a, b) => a.localeCompare(b));
    }

    /**
     * Companion p.151 wants END and INT at two rungs and lets the Traveller allocate them, so the
     * override is per row rather than per demand — and the same Traveller answers twice.
     */
    #overrideContext(rows) {
        const demand = this.#demand;
        const rungs = Object.entries(MGT2.DifficultyTargets).map(([key, target]) => ({ key, target,
            label: game.i18n.localize(MGT2.Difficulty[key]) }));
        return rows.map(row => {
            const over = row.over;
            return {
                ...row,
                rungs: rungs.map(rung => ({ ...rung, active: over.difficulty === rung.key })),
                sameRung: over.difficulty === null,
                noRung: over.difficulty === "",
                rungLabel: (over.difficulty === null) ? ""
                    : (MGT2Helper.getDifficultyDisplay(over.difficulty)
                        ?? game.i18n.localize("MGT2.Difficulty.NA")),
                // One Traveller's own characteristics, never the roster's union.
                chars: (row.actor?.system.rollableCharacteristics ?? []).map(key => ({
                    key, label: game.i18n.localize(MGT2.Characteristics[key] ?? key),
                    selected: (over.chars ?? []).includes(key) })),
                sameChars: over.chars === null,
                skill: over.skill ?? "",
                sameSkill: over.skill === null,
                // Core p.62 needs two checks and this window holds both, so the pair is picked off
                // the roster rather than off the chat log.
                pairs: rows.filter(other => other.id !== row.id).map(other => ({
                    id: other.id, name: other.name, active: over.opposes === other.id })),
                canSkill: demand.skillMode === "named"
            };
        });
    }

    /**
     * The characteristic select, over the UNION of the docketed actors' `rollableCharacteristics`.
     */
    #characteristicOptions(rows) {
        const union = new Set();
        for ( const row of rows ) {
            for ( const key of row.actor?.system.rollableCharacteristics ?? [] ) union.add(key);
        }
        return [...union].map(key => ({
            key, label: game.i18n.localize(MGT2.Characteristics[key] ?? key),
            selected: this.#demand.chars.includes(key)
        }));
    }

    /** Item 5: one marker per row on the six bands, drawn compact. */
    static #spread(rows) {
        return Object.entries(MGT2.EffectBands).map(([key, band]) => ({
            key,
            tone: band.tone,
            label: Docket.#bandLabel(band),
            marks: rows.filter(row => Number.isInteger(row.effect)
                && ((band.min === null) || (row.effect >= band.min))
                && ((band.max === null) || (row.effect <= band.max)))
                .map(row => ({ id: row.id, name: row.name, effect: MGT2Helper.signed(row.effect, "+0") }))
        }));
    }

    static #bandLabel(band) {
        const sign = value => MGT2Helper.signed(value, "0");
        if ( band.min === null ) return `≤${sign(band.max)}`;
        if ( band.max === null ) return `≥${sign(band.min)}`;
        if ( band.min === band.max ) return sign(band.min);
        return `${sign(band.min)}…${sign(band.max)}`;
    }

    /** The demand in one line, in plain words, before it is sent. */
    #summary(reading) {
        const demand = this.#demand;
        const parts = [];
        if ( demand.difficulty ) parts.push(MGT2Helper.getDifficultyDisplay(demand.difficulty));
        if ( demand.skillMode === "named" ) {
            if ( demand.skill.trim() ) parts.push(demand.skill.trim());
        }
        else parts.push(game.i18n.localize(`MGT2.Request.SkillMode.${demand.skillMode}`));
        parts.push(this.#charEcho());
        if ( demand.stance !== "none" ) parts.push(game.i18n.localize(MGT2.Stance[demand.stance]));
        if ( demand.timeframe !== "Normal" ) {
            parts.push(game.i18n.localize(MGT2.Timeframes[demand.timeframe]));
        }
        if ( demand.dm.value ) {
            parts.push(`${demand.dm.label.trim() || game.i18n.localize("MGT2.Request.UnnamedDM")} ${
                MGT2Helper.signed(demand.dm.value)}`);
        }
        if ( demand.ambush !== "none" ) {
            parts.push(`${game.i18n.localize("MGT2.Request.Ambush")} ${
                game.i18n.localize(MGT2.RequestAmbush[demand.ambush])}`);
        }

        // Only what is true: a roster with nobody untrained does not print a zero.
        const counts = reading.counts;
        const tallies = [game.i18n.format("MGT2.Request.Counts.asked", { n: counts.asked })];
        const add = (key, n) => { if ( n ) tallies.push(game.i18n.format(key, { n })); };
        add("MGT2.Request.Counts.unclaimed", counts.unclaimed);
        add("MGT2.Request.Counts.unable", counts.unable);
        add("MGT2.Request.Counts.untrained", counts.untrained);
        add("MGT2.Request.Counts.unresolved", counts.unresolved);
        add("MGT2.Request.Counts.self", counts.self);
        add("MGT2.Request.Counts.overridden", counts.overridden);
        add("MGT2.Request.Counts.paired", counts.paired);
        return { demand: parts.filter(part => part).join(" · "), tally: tallies.join(" · ") };
    }

    /**
     * The live plain-language echo is what separates "the referee left the characteristic open"
     * from "the referee forgot", so it says which of the three it is.
     */
    #charEcho() {
        const chars = this.#demand.chars;
        if ( !chars.length ) return game.i18n.localize("MGT2.Request.CharsOpen");
        const names = chars.map(key => game.i18n.localize(MGT2.Characteristics[key] ?? key));
        if ( names.length === 1 ) return names[0];
        return game.i18n.format("MGT2.Request.CharsOffered", {
            chars: names.join(` ${game.i18n.localize("MGT2.Request.Or")} `) });
    }

    /** The frame outlives every re-render, so this binds once. @inheritDoc */
    _attachFrameListeners() {
        super._attachFrameListeners();
        // `input` alone.
        this.element.addEventListener("input", this.#onField.bind(this));
        // Enter posts, but never on a control Enter already activates: `+ PARTY` would post the
        // docket instead of seeding it, and the close button would post on its way out.
        this.element.addEventListener("keydown", event => {
            if ( (event.key !== "Enter") || event.repeat ) return;
            if ( event.target.closest("button, a, textarea, [data-action]") ) return;
            event.preventDefault();
            Docket.#onPost.call(this, event, null);
        });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        // Re-bound on every render because the roster part carries the zones and is replaced.
        this.dragDrop.bind(this.element);
        // The ladder's narration is the form part's, and that part renders once.
        if ( options.parts?.includes("form") ) this.#wireLadder();
        this.#syncForm();
        this.#restoreFocus();
    }

    /**
     * The difficulty cells carry the target number; the word sits beside them and follows the
     * pointer, so the ladder names its own rungs without ever being opened.
     */
    #wireLadder() {
        const ladder = this.element.querySelector(`[data-name="${FIELD}Difficulty"]`);
        const name = this.element.querySelector('[data-readout="difficultyName"]');
        if ( !ladder || !name ) return;
        this.#showRung = peeked => {
            const chosen = ladder.querySelector("input:checked")?.closest("label");
            name.textContent = (peeked ?? chosen)?.dataset.name ?? "";
            name.classList.toggle("peek", Boolean(peeked) && (peeked !== chosen));
        };
        ladder.addEventListener("pointerover", event => {
            const cell = event.target.closest("label");
            if ( cell ) this.#showRung(cell);
        });
        ladder.addEventListener("pointerleave", () => this.#showRung());
    }

    /** @type {(peeked?: HTMLElement) => void} */
    #showRung = () => {};

    /** The form part renders once, so everything of it that is not static is patched here. */
    #syncForm() {
        const echo = this.element.querySelector('[data-readout="chars"]');
        if ( echo ) echo.textContent = this.#charEcho();
        const count = this.element.querySelector('[data-readout="asked"]');
        if ( count ) count.textContent = String(this.#last?.counts.asked ?? 0);
        this.#showRung();
        this.#syncSkillMode();
        this.#syncVocabulary();
    }

    /** The characteristic select and the skill datalist, both over the docketed actors. */
    #syncVocabulary() {
        const rows = this.#last?.rows ?? [];
        const select = this.element.querySelector(`[name="${FIELD}Chars"]`);
        if ( select ) {
            const options = this.#characteristicOptions(rows);
            const shown = [...select.options].map(option => option.value).join(" ");
            if ( shown !== options.map(option => option.key).join(" ") ) {
                select.replaceChildren(...options.map(entry => {
                    const option = document.createElement("option");
                    option.value = entry.key;
                    option.textContent = entry.label;
                    option.selected = entry.selected;
                    return option;
                }));
            }
            const hint = select.closest(".pfields")?.querySelector(".hint");
            if ( hint ) hint.hidden = options.length > 0;
        }

        const datalist = this.element.querySelector("#mgt2-docket-skills");
        if ( !datalist ) return;
        const names = this.#vocabulary(rows);
        if ( [...datalist.options].map(option => option.value).join("\0") === names.join("\0") ) return;
        datalist.replaceChildren(...names.map(name => {
            const option = document.createElement("option");
            option.value = name;
            return option;
        }));
    }

    /** One delegated reader for the whole window, keyed by the control's own name. */
    #onField(event) {
        const input = event.target;
        const name = input.name;
        if ( !name?.startsWith(FIELD) ) return;
        // A per-row control carries its row in its own name, because a radio group shared across
        // rows is one group: every row's ladder would move together.
        const [key, rowId] = name.slice(FIELD.length).split("~");
        const demand = this.#demand;

        if ( rowId ) {
            this.#onOverride(key, rowId, input);
            this.#keepFocus();
            this.render({ parts: ["roster", "foot"] });
            return;
        }

        switch ( key ) {
            case "SkillMode":
                demand.skillMode = input.value;
                // Core p.73's collapse and its ambush are offered only on a characteristic-only
                // demand, so leaving that mode puts both back down rather than leaving a control set
                // to something nothing honours.
                if ( demand.skillMode !== "none" ) {
                    demand.sideRoll = false;
                    demand.ambush = "none";
                }
                break;
            case "Skill": demand.skill = input.value; break;
            case "Flavor": demand.flavor = input.value; break;
            case "Chars":
                demand.chars = [...input.selectedOptions].map(option => option.value);
                break;
            case "Difficulty": demand.difficulty = input.value; break;
            case "Stance": demand.stance = input.value; break;
            case "Timeframe": demand.timeframe = input.value; break;
            case "DMLabel": demand.dm.label = input.value; break;
            case "DMValue": demand.dm.value = MGT2Helper.getIntegerFromInput(input.value); break;
            case "Ambush": demand.ambush = input.value; break;
            case "Tally": demand.tally = input.value; break;
            case "ShowTarget": demand.showTarget = input.checked; break;
            case "SideRoll": demand.sideRoll = input.checked; break;
            case "Visibility": this.#send.visibility = input.value; break;
            case "RollMine": this.#send.roll = input.checked; break;
            default: return;
        }

        // The two live parts.
        this.render({ parts: ["roster", "foot"] });
        this.#syncForm();
    }

    /** One row disagreeing with the demand. An empty value is `null` — "the demand decides". */
    #onOverride(key, rowId, input) {
        const row = this.#row(rowId);
        if ( !row ) return;
        switch ( key ) {
            case "RowSkill":
                row.over.skill = input.value.trim() ? input.value : null;
                break;
            case "RowDifficulty":
                // Three answers and not two: `same` follows the demand, `—` is this line stating no
                // rung at all (Core p.61), and a key is this line's own.
                row.over.difficulty = (input.value === "same") ? null : input.value.slice(1);
                break;
            case "RowChars": {
                const chosen = [...input.selectedOptions].map(option => option.value);
                row.over.chars = chosen.length ? chosen : null;
                break;
            }
            case "RowOpposes": this.#pair(row, input.value); break;
            default: break;
        }
    }

    /**
     * Core p.62 measures two checks against each other, so the pairing is mutual: setting one end
     * sets the other and clears whatever either end was pointing at.
     */
    #pair(row, otherId) {
        const other = otherId ? this.#row(otherId) : null;
        // Every old pointer at either end lets go BEFORE the new pair is made: clearing afterwards
        // clears the pointer just written.
        for ( const entry of this.#rows ) {
            if ( (entry.over.opposes === row.id) || (entry.over.opposes === other?.id) ) {
                entry.over.opposes = null;
            }
        }
        row.over.opposes = other?.id ?? null;
        if ( other ) other.over.opposes = row.id;
    }

    /** ApplicationV2 restores no focus, and the roster part now carries a typed field. */
    #keepFocus() {
        const node = document.activeElement;
        if ( !node?.name || !this.element.contains(node) ) return;
        this.#focus = { name: node.name, start: node.selectionStart ?? null,
            end: node.selectionEnd ?? null };
    }

    #restoreFocus() {
        const wanted = this.#focus;
        this.#focus = null;
        if ( !wanted ) return;
        const node = this.element.querySelector(`[name="${CSS.escape(wanted.name)}"]`);
        if ( !node ) return;
        node.focus();
        // A radio and a select both throw on `setSelectionRange`, and neither has a caret to keep.
        if ( (wanted.start === null) || (node.type !== "text") ) return;
        node.setSelectionRange(wanted.start, wanted.end);
    }

    /**
     * The three things the form part shows about a mode it renders once: the skill field is inert on
     * a demand that names no skill, and p.73's collapse and its ambush belong to that case alone.
     */
    #syncSkillMode() {
        const none = this.#demand.skillMode === "none";
        const skill = this.element.querySelector(`[name="${FIELD}Skill"]`);
        if ( skill ) {
            skill.disabled = this.#demand.skillMode !== "named";
            skill.closest(".skillfld")?.classList.toggle("off", skill.disabled);
        }
        const side = this.element.querySelector(`[name="${FIELD}SideRoll"]`);
        if ( side ) {
            side.disabled = !none;
            if ( !none ) side.checked = false;
            side.closest(".tog")?.classList.toggle("disabled", !none);
        }
        // Voided rather than hidden: a strip that vanishes moves the DM row's other two controls.
        const ambush = this.element.querySelectorAll(`[name="${FIELD}Ambush"]`);
        for ( const radio of ambush ) {
            radio.disabled = !none;
            if ( !none ) radio.checked = radio.value === "none";
        }
        ambush[0]?.closest(".seggrp")?.classList.toggle("voided", !none);
    }

    static #onSeedControlled() {
        this.#add(Docket.#controlledActors());
        this.render({ parts: ["roster", "foot"] });
    }

    static #onSeedParty() {
        this.#add(Docket.#partyActors());
        this.render({ parts: ["roster", "foot"] });
    }

    static #onSeedCombatants() {
        this.#add(Docket.#combatantActors());
        this.render({ parts: ["roster", "foot"] });
    }

    static #onClearRoster() {
        this.#rows = [];
        this.render({ parts: ["roster", "foot"] });
    }

    static #onDropRow(event, target) {
        const id = target.closest("[data-row-id]")?.dataset.rowId;
        for ( const row of this.#rows ) if ( row.over.opposes === id ) row.over.opposes = null;
        this.#rows = this.#rows.filter(row => row.id !== id);
        this.render({ parts: ["roster", "foot"] });
    }

    /**
     * Companion p.151: everyone aboard makes TWO checks, one Routine and one Difficult, and chooses
     * which is which — so one Traveller occupies two lines. Seeding still dedupes on the uuid; this
     * is the referee saying so deliberately.
     */
    static #onDupeRow(event, target) {
        const id = target.closest("[data-row-id]")?.dataset.rowId;
        const at = this.#rows.findIndex(row => row.id === id);
        if ( at < 0 ) return;
        const row = this.#rows[at];
        this.#rows.splice(at + 1, 0, { ...row, id: foundry.utils.randomID(), open: true,
            over: { ...row.over, opposes: null } });
        this.render({ parts: ["roster", "foot"] });
    }

    static #onToggleOverride(event, target) {
        const row = this.#row(target.closest("[data-row-id]")?.dataset.rowId);
        if ( !row ) return;
        row.open = !row.open;
        this.render({ parts: ["roster", "foot"] });
    }

    static #onClearOverride(event, target) {
        const row = this.#row(target.closest("[data-row-id]")?.dataset.rowId);
        if ( !row ) return;
        this.#pair(row, "");
        row.over = { skill: null, difficulty: null, chars: null, opposes: null };
        this.render({ parts: ["roster", "foot"] });
    }

    /**
     * Companion p.7, "The Referee secretly makes a MRL check for Damien": the referee takes a row
     * off a player and answers it themselves, whispered.
     */
    static #onToggleSelf(event, target) {
        const id = target.closest("[data-row-id]")?.dataset.rowId;
        const row = this.#rows.find(entry => entry.id === id);
        if ( !row ) return;
        row.self = !row.self;
        this.render({ parts: ["roster", "foot"] });
    }

    static async #onOpenDocument(event, target) {
        const document = await fromUuid(target.dataset.uuid);
        document?.sheet?.render({ force: true });
    }

    /**
     * A plain `ApplicationV2` inherits no drag-drop plumbing — it first appears on `ActorSheetV2` —
     * so the controller is supplied here, as the voyage screen's is.
     * @type {DragDrop}
     */
    get dragDrop() {
        return this.#dragDrop ??= new DragDrop.implementation({
            dropSelector: "[data-accept]",
            permissions: { drop: () => game.user.isGM },
            callbacks: {
                dragover: this.#onDragOver.bind(this),
                dragleave: this.#onDragLeave.bind(this),
                drop: this.#onDrop.bind(this)
            }
        });
    }

    /** @type {DragDrop|null} */
    #dragDrop = null;

    #onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        this.#clearDropState(zone);
        if ( !zone ) return;
        zone.classList.add(MGT2Helper.dropAccepted(zone) ? "over" : "deny");
    }

    #onDragLeave(event) {
        const zone = event.target.closest("[data-accept]");
        if ( zone && !zone.contains(event.relatedTarget) ) zone.classList.remove("over", "deny");
    }

    #clearDropState(keep) {
        for ( const node of this.element.querySelectorAll(".over, .deny") ) {
            if ( node !== keep ) node.classList.remove("over", "deny");
        }
    }

    /** The type is tested AFTER the uuid resolves, which is what `data-accept` names a type for. */
    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        const data = MGT2Helper.getDataFromDropEvent(event);
        this.#clearDropState();
        // No `preventDefault`: `DragDrop#_handleDrop` has already called it before dispatching.
        if ( !zone || !game.user.isGM || !MGT2Helper.dropAccepted(zone, data) ) return;
        // Awaited end to end: a packed Actor answers `fromUuidSync` with an index entry.
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor ) return;
        this.#add([actor]);
        return this.render({ parts: ["roster", "foot"] });
    }

    /** The two refusals, and nothing else. */
    #refuse(reading) {
        if ( !reading.rows.length ) return "MGT2.Errors.RosterEmpty";
        // Core p.64 constrains where a DM comes from, so provenance is the row's whole job.
        if ( this.#demand.dm.value && !this.#demand.dm.label.trim() ) return "MGT2.Errors.UnlabelledDM";
        return null;
    }

    /**
     * The card is created FIRST and the referee's own rows are resolved against it afterwards:
     * an answer's `flags.mgt2.request.message` needs the request's id, so a self row cannot roll
     * before the card exists.
     */
    static async #onPost(event, target) {
        if ( this.#posting ) return;
        const reading = this.#reading();
        const refusal = this.#refuse(reading);
        if ( refusal ) return void ui.notifications.error(game.i18n.localize(refusal));

        const demand = this.#demand;
        const lines = reading.rows.map(row => ({
            id: row.id,
            actor: row.uuid,
            name: row.name,
            user: row.self ? null : row.user,
            skillItem: row.skillItem,
            // `null` on any of the four is "the demand decides", so a roster nobody overrode posts
            // exactly the lines it posted before this existed.
            skill: row.over.skill,
            difficulty: row.over.difficulty,
            chars: row.over.chars,
            opposes: row.over.opposes,
            // Core p.63-64: on a `together` tally the contributors' rungs are summed into one
            // Traveller's check.
            resolver: false,
            self: row.self,
            status: (row.status === "unable") ? "unable" : (row.status === "unclaimed" ? "unclaimed" : "waiting"),
            effect: null,
            message: null
        }));

        // Through `postRequest` and not `ChatMessage.create`, because the recents list the chat
        // control's context menu reads is written there — composing in this window was the one path
        // that never reached it, so the menu it fires from was permanently empty.
        this.#posting = true;
        try {
            const message = await postRequest({
                skillMode: demand.skillMode,
                skill: (demand.skillMode === "named") ? demand.skill.trim() : "",
                flavor: demand.flavor.trim(),
                chars: demand.chars,
                difficulty: demand.difficulty,
                stance: demand.stance,
                timeframe: demand.timeframe,
                dm: { label: demand.dm.label.trim(), value: demand.dm.value },
                tally: demand.tally,
                showTarget: demand.showTarget,
                sideRoll: demand.sideRoll,
                ambush: demand.ambush,
                state: "open",
                lines
            }, {
                ...this.#whisper(lines),
                // The body is rendered per client from a live reading of the log, and `content` is
                // only what a world that has lost the sub-type would be left with.
                content: this.#fallback(reading)
            });
            if ( !message ) return;

            if ( this.#send.roll ) await this.#rollSide(message, reading);
            this.close();
        }
        finally {
            this.#posting = false;
        }
    }

    /** `Addressed` whispers to the lines' own users and to the GMs; `Public` whispers to nobody. */
    #whisper(lines) {
        if ( this.#send.visibility !== "addressed" ) return {};
        const recipients = new Set(ChatMessage.getWhisperRecipients("GM").map(user => user.id));
        for ( const line of lines ) if ( line.user ) recipients.add(line.user);
        return { whisper: [...recipients] };
    }

    /** The demand as one escaped line — the same sentence the summary foot prints. */
    #fallback(reading) {
        const summary = this.#summary(reading);
        const reason = this.#demand.flavor.trim();
        const escape = foundry.utils.escapeHTML;
        // Wrapped in the card so a world that has lost the sub-type still gets the log's frame
        // rather than naked text; `mgt2-request-fallback` stays as the hook that identifies it.
        return `<div class="mgt2 theme-light card"><p class="bare mgt2-request-fallback"><b>${
            escape(game.i18n.localize("MGT2.Request.Card"))}</b> ${escape(summary.demand)}</p>${
            reason ? `<p class="bare">${escape(reason)}</p>` : ""}</div>`;
    }

    /**
     * Item 4. Every row the referee answers resolves here, on the referee's client, once the card
     * exists — whispered to GMs with the dice out of `rolls` and in the body, because a whispered
     * message that carries rolls announces itself to the whole table as `???`.
     */
    async #rollSide(message, reading) {
        let rows = reading.rows.filter(row => row.self && row.actor && (row.status !== "unable"));
        if ( !rows.length ) return;

        // Core p.73 OPPOSING FORCES: one roll for the whole side, on the highest score in the
        // chosen characteristic.
        if ( this.#demand.sideRoll && (this.#demand.skillMode === "none") ) {
            rows = [rows.reduce((best, row) => Docket.#score(row) > Docket.#score(best) ? row : best)];
        }
        // Core p.62 measures one check against another, so a pair both ends of which the referee
        // answers is settled by whichever of the two rolls second.
        const posted = new Map();
        for ( const row of rows ) {
            const answer = await this.#rollFor(message, row, posted.get(row.over.opposes));
            if ( answer ) posted.set(row.id, answer.id);
        }
    }

    /** The SCORE and not the DM: p.73 collapses onto the highest characteristic, which is the value. */
    static #score(row) {
        return row.actor?.system.characteristics?.[row.characteristic]?.value ?? 0;
    }

    async #rollFor(message, row, against = null) {
        const demand = this.#demand;
        // Core p.61's tri-state as the prompt's own footer builds it: three dice, one dropped.
        const dice = (demand.stance === "bane") ? "3d6dh"
            : ((demand.stance === "boon") ? "3d6dl" : "2d6");
        // The terms the roster already reduced, spent as the formula.
        const formula = [dice, ...row.parts].join("");
        // What the card is called.
        const label = ((demand.skillMode === "named") && row.asked.skill.trim())
            || game.i18n.localize(MGT2.Characteristics[row.characteristic] ?? "MGT2.Request.Card");

        const outcome = await Checks.resolve({ formula, difficulty: row.asked.difficulty,
            prompt: against ? { opposed: against } : null });
        if ( !outcome ) return null;
        // Core p.229: the power is paid for out of the reserve, on the referee's rows as on anyone
        // else's, and there is no boost strip on a roll with no prompt.
        const talent = row.actor?.items?.get(row.skillItem);
        const psiLine = Docket.#isPower(talent)
            ? await TravellerActorSheet.spendPsi(row.actor, talent, {}, outcome.effect) : null;
        return Checks.post(outcome, {
            actor: row.actor,
            label,
            secret: true,
            flags: { mgt2: { request: { message: message.id, line: row.id } } },
            rollTypeName: label,
            rollObjectName: row.name,
            difficulty: row.asked.difficulty,
            modifiers: row.terms,
            psiLine,
            lines: [demand.flavor.trim()]
        });
    }
}
