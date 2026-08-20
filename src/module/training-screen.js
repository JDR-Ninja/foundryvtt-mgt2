import { CharacterData } from "./actors/character-data.js";
import { TravellerActorSheet } from "./actors/character-sheet.js";
import { checkOf } from "./chat-message.js";
import { Grants } from "./chargen-grants.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const PARTS_PATH = "systems/mgt2/templates/training";
const PICKER = `${PARTS_PATH}/picker.html`;

/** A comrade who teaches is another Traveller (Companion p.41), so only a person may be dropped. */
const TEACHER_TYPES = "Actor.character Actor.npc";

/** The three log kinds the REFEREE writes. */
const AWARDS = Object.freeze(["study", "fullTime", "adventure"]);

/**
 * The training window: every programme a Traveller has open, and the loop that moves them.
 * @extends {ApplicationV2}
 */
export class TrainingScreen extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options) {
        super(options);
        this.#actor = options.actor;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-training-{id}",
        classes: ["mgt2", "training", "nopad"],
        position: { width: 900, height: 700 },
        window: { resizable: true, icon: "fa-solid fa-graduation-cap" },
        actions: {
            programmeSelect: TrainingScreen.#onSelect,
            programmeAdd: TrainingScreen.#onAdd,
            programmeAbandon: TrainingScreen.#onAbandon,
            programmeRemove: TrainingScreen.#onRemove,
            logWeek: TrainingScreen.#onLogWeek,
            trainingCheck: TrainingScreen.#onCheck,
            award: TrainingScreen.#onAward,
            grant: TrainingScreen.#onGrant,
            teacherClear: TrainingScreen.#onTeacherClear,
            openDocument: TrainingScreen.#onOpenDocument
        }
    };

    /** @inheritDoc */
    static PARTS = {
        rail: { template: `${PARTS_PATH}/rail.html`, scrollable: [""] },
        panel: { template: `${PARTS_PATH}/panel.html`, scrollable: [""] }
    };

    /** @type {Actor} */
    #actor;

    /** Which programme the panel is showing. A key into the map, never an index. */
    #selected = "";

    /**
     * What the last check read, kept beside the programme it was rolled on.
     * @type {{id: string, ok: boolean, total: number}|null}
     */
    #last = null;

    get actor() {
        return this.#actor;
    }

    get canEdit() {
        return this.#actor.canUserModify(game.user, "update");
    }

    get title() {
        return game.i18n.format("MGT2.Training.Title", { name: this.#actor.name });
    }

    /**
     * One window per Traveller, addressed by the Actor's own id.
     * @param {string} [options.programme]   A key into `system.training.programmes`
     */
    static open(actor, { programme = "" } = {}) {
        if ( actor?.type !== "character" ) return null;
        const existing = foundry.applications.instances.get(`mgt2-training-${actor.id}`);
        const screen = existing ?? new TrainingScreen({ actor });
        // An id that is absent, or that belongs to another Traveller, falls back to the rail's own
        // default rather than blanking the panel.
        if ( Object.hasOwn(actor.system.training.programmes, programme) ) screen.select(programme);
        return screen.render({ force: true });
    }

    /** Show one programme. Public because the sheet strip opens the window ON the row it was clicked. */
    select(id) {
        this.#selected = id;
        this.#last = null;
    }

    /** @inheritDoc */
    _initializeApplicationOptions(options) {
        const applied = super._initializeApplicationOptions(options);
        applied.uniqueId = options.actor.id;
        return applied;
    }

    /**
     * `document.apps` is the only re-render mechanism there is: every write here goes through
     * `Actor#update`, and the window has to follow it.
     * @inheritDoc
     */
    async _preFirstRender(context, options) {
        await super._preFirstRender(context, options);
        this.#actor.apps[this.id] = this;
    }

    /** Synchronous and before the state flips to CLOSED, which `_onClose` is not. @inheritDoc */
    _tearDown(options) {
        super._tearDown(options);
        delete this.#actor.apps[this.id];
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const training = this.#actor.system.training;
        const entries = Object.entries(training.programmes);

        // A programme closes wherever it happens to sit in the map, so the two lists are
        // partitioned rather than flagged mid-loop — a header emitted on the first closed row would
        // drag every later live one under it.
        const live = entries.filter(([, programme]) => !programme.closed);
        const closed = entries.filter(([, programme]) => programme.closed);
        if ( !training.programmes[this.#selected] ) this.#selected = live[0]?.[0] ?? closed[0]?.[0] ?? "";

        context.canEdit = this.canEdit;
        context.actorName = this.#actor.name;
        context.teacherTypes = TEACHER_TYPES;
        context.live = live.map(([id, programme]) => this.#row(id, programme));
        context.closed = closed.map(([id, programme]) => this.#row(id, programme));
        context.totals = {
            core: game.i18n.format("MGT2.Training.RailCore", {
                count: live.filter(([, p]) => p.engine === "core").length,
                weeks: training.weeksLogged
            }),
            companion: game.i18n.format("MGT2.Training.RailCompanion", {
                count: live.filter(([, p]) => p.engine === "companion").length,
                points: training.pointsDedicated
            })
        };
        context.programme = training.programmes[this.#selected]
            ? await this.#panel(this.#selected, training.programmes[this.#selected]) : null;
        return context;
    }

    /** The printed skill name, or the characteristic's own label. */
    static #targetName(target) {
        return (target.kind === "characteristic")
            ? game.i18n.localize(MGT2.Characteristics[target.key] ?? target.key) : target.key;
    }

    /** `new skill`, `level 1 → 2` or `value 7 → 8`, which is the whole rule in four characters. */
    static #range(programme) {
        if ( programme.held === null ) return game.i18n.localize("MGT2.Training.NewSkill");
        const key = (programme.target.kind === "characteristic") ? "ValueRange" : "LevelRange";
        return game.i18n.format(`MGT2.Training.${key}`,
            { from: programme.held, to: programme.next });
    }

    /** Neither book lets everything be trained, and the refusal names its own page. */
    static #barredReason(target) {
        if ( target.kind === "skill" ) return "MGT2.Training.Barred.jackOfAllTrades";
        if ( target.key === "psionic" ) return "MGT2.Training.Barred.psionic";
        if ( target.key === "social" ) return "MGT2.Training.Barred.social";
        return null;
    }

    /** One rail row: which book, what it is buying, and where it has got to. */
    #row(id, programme) {
        const core = programme.engine === "core";
        const weeks = game.i18n.localize("MGT2.Training.WeeksAbbr");
        let state;
        if ( programme.closed ) {
            const periods = programme.log.filter(row => row.kind === "period").length;
            state = core
                ? `${periods} ${game.i18n.localize("MGT2.Training.Periods")} · ${programme.weeksSpent} ${weeks}`
                : MGT2Helper.plural("MGT2.Training.Entries", programme.log.length);
        }
        else if ( core ) {
            state = programme.checkDue ? game.i18n.localize("MGT2.Training.CheckDue")
                : `${programme.weeks}/${this.#actor.system.training.weeksPerPeriod} ${weeks}`;
        }
        else state = `${programme.xp}/${programme.cost}`;

        return {
            id, core, closed: programme.closed,
            name: TrainingScreen.#targetName(programme.target),
            badge: `MGT2.Training.Badge.${programme.engine}`,
            range: TrainingScreen.#range(programme),
            selected: id === this.#selected,
            state
        };
    }

    /** The panel, which is one programme read every way the two books ask for. */
    async #panel(id, programme) {
        const core = programme.engine === "core";
        const characteristic = programme.target.kind === "characteristic";
        const period = this.#actor.system.training.weeksPerPeriod;
        const name = TrainingScreen.#targetName(programme.target);
        const failed = programme.log.slice(
            programme.log.findLastIndex(row => row.kind === "grant") + 1)
            .filter(row => (row.kind === "period") && (row.ok === false)).length;

        const panel = {
            id, core, characteristic, name, period,
            engine: programme.engine,
            badge: `MGT2.Training.Badge.${programme.engine}`,
            closed: programme.closed,
            barred: programme.barred,
            range: TrainingScreen.#range(programme),
            rule: core ? "MGT2.Training.Rule.core" : "MGT2.Training.Rule.companion",
            costRule: core ? null
                : (characteristic ? "MGT2.Training.Rule.charCost" : "MGT2.Training.Rule.skillCost"),
            stats: this.#stats(programme, period),
            note: programme.note,
            weeks: programme.weeks,
            boxes: Array.from({ length: period }, (_box, index) => ({ index, on: index < programme.weeks })),
            pips: TrainingScreen.#pips(programme, failed),
            failed: game.i18n.format("MGT2.Training.FailedCount", { n: failed }),
            percent: programme.percent,
            xp: programme.xp,
            cost: programme.cost,
            checkDue: programme.checkDue,
            log: TrainingScreen.#record(programme),
            count: core ? MGT2Helper.plural("MGT2.Training.WeeksSpent", programme.weeksSpent)
                : MGT2Helper.plural("MGT2.Training.Entries", programme.log.length),
            last: (this.#last?.id === id) ? this.#last : null
        };

        // Core p.55 excepts Athletics from EDU and lets ANY physical characteristic buy Athletics
        // 0, so the choice is the player's.
        panel.athletics = core && MGT2.AthleticsTraining.skills.some(skill =>
            MGT2Helper.matchesSkill(programme.target.key, skill));
        panel.physical = MGT2.TrainingCosts.physical.map(key => ({
            key, label: MGT2.Characteristics[key], active: key === programme.characteristic }));

        const rolled = programme.checkCharacteristic;
        const dm = core ? (this.#actor.system.characteristics[rolled]?.dm ?? 0) : -programme.next;
        panel.check = game.i18n.format("MGT2.Training.Check",
            { characteristic: game.i18n.localize(MGT2.Characteristics[rolled] ?? rolled) });
        panel.formula = game.i18n.format("MGT2.Training.Formula", { dm: MGT2Helper.signed(dm, "+0") });
        panel.why = core
            ? (programme.checkDue ? game.i18n.localize("MGT2.Training.PeriodComplete")
                : MGT2Helper.plural("MGT2.Training.WeeksShort", period - programme.weeks))
            : game.i18n.localize("MGT2.Training.TeachingDM");

        panel.awards = AWARDS.map(kind => ({
            kind, label: `MGT2.Training.LogKind.${kind}`, rate: `MGT2.Training.AwardRate.${kind}` }));
        panel.teacher = await this.#teacher(programme);
        panel.will = this.#will(programme, name);
        return panel;
    }

    /** The statline, and it is a different reading per engine because the loops count different things. */
    #stats(programme, period) {
        if ( programme.engine === "core" ) {
            return [
                { label: "MGT2.Training.Stat.Periods", value: programme.periodsPassed,
                    of: programme.periodsNeeded, lead: true, good: programme.ready },
                { label: "MGT2.Training.Stat.ThisPeriod", value: programme.weeks, of: period },
                { label: "MGT2.Training.Stat.WeeksSpent", value: programme.weeksSpent },
                { label: "MGT2.Training.Stat.Entries", value: programme.log.length }
            ];
        }
        const buys = game.i18n.localize(MGT2.TrainingTargets[programme.target.kind]);
        return [
            { label: "MGT2.Training.Stat.Dedicated", value: programme.xp, of: programme.cost,
                lead: true, good: programme.ready },
            { label: "MGT2.Training.Stat.Buys", word: `${buys} ${programme.next}` },
            { label: "MGT2.Training.Stat.Awarded",
                value: programme.log.reduce((sum, row) => sum + Math.max(0, row.amount || 0), 0) },
            { label: "MGT2.Training.Stat.Entries", value: programme.log.length }
        ];
    }

    /** The ladder. */
    static #pips(programme, failed) {
        const pips = Array.from({ length: programme.periodsNeeded }, (_pip, index) =>
            ({ pass: index < programme.periodsPassed, fail: false }));
        for ( let i = 0; i < failed; i++ ) pips.push({ pass: false, fail: true });
        return pips;
    }

    /** Every row of the one log, both engines, in one table. */
    static #record(programme) {
        const weeks = game.i18n.localize("MGT2.Training.WeeksAbbr");
        return programme.log.map(row => ({
            kind: `MGT2.Training.LogKind.${row.kind}`,
            moved: (row.kind === "period") ? `${row.amount} ${weeks}`
                : (row.amount ? MGT2Helper.signed(row.amount) : ""),
            note: row.note,
            passed: row.ok === true,
            failed: row.ok === false,
            outcome: (row.ok === true) ? "MGT2.Training.Passed"
                : (row.ok === false) ? "MGT2.Training.Failed" : ""
        }));
    }

    /** Companion p.41's comrade. */
    async #teacher(programme) {
        if ( programme.engine === "core" ) return null;
        const actor = programme.teacher ? await fromUuid(programme.teacher) : null;
        if ( !actor ) return null;
        const level = (programme.target.kind === "skill")
            ? actor.system.skillLevel(programme.target.key) : null;
        return {
            uuid: actor.uuid,
            name: game.i18n.format("MGT2.Training.TaughtBy", { name: actor.name }),
            // "On ne peut enseigner que jusqu'à un niveau strictement inférieur au sien."
            cap: (level === null) ? null : game.i18n.format("MGT2.Training.TeacherCap", { n: level - 1 })
        };
    }

    /**
     * What the success will WRITE, said before it happens — the one thing the shipped block never
     * did.
     */
    #will(programme, name) {
        const core = programme.engine === "core";
        const consequence = (programme.held === null)
            ? game.i18n.format("MGT2.Training.AddedAtZero", { name })
            : game.i18n.format("MGT2.Training.RisesTo", { name, n: programme.next });

        if ( programme.closed ) {
            const parts = [MGT2Helper.plural("MGT2.Training.Entries", programme.log.length)];
            if ( core ) parts.push(MGT2Helper.plural("MGT2.Training.WeeksSpent", programme.weeksSpent));
            return { label: "MGT2.Training.Written", text: parts.join(" · ") };
        }
        if ( programme.barred ) {
            const reason = TrainingScreen.#barredReason(programme.target);
            return { barred: true, text: reason ? game.i18n.localize(reason) : consequence };
        }
        if ( programme.ready ) {
            // Core p.55: past 3 × (INT + EDU) skill levels "any additional skills may only be
            // learned to level 0", so a raise that would breach the cap has nothing to grant.
            if ( this.#capped(programme) ) {
                return { barred: true, text: game.i18n.localize("MGT2.Training.Barred.skillCap") };
            }
            return {
                label: "MGT2.Training.Ready", text: consequence,
                button: game.i18n.format(core ? "MGT2.Training.Grant" : "MGT2.Training.Buy",
                    { n: programme.next })
            };
        }
        const left = core ? programme.periodsLeft : (programme.cost - programme.xp);
        return {
            label: core
                ? game.i18n.format("MGT2.Training.OnSuccess",
                    { ordinal: TrainingScreen.#ordinal(programme.periodsNeeded) })
                : MGT2Helper.plural("MGT2.Training.AtPoints", programme.cost),
            text: `${consequence}. ${game.i18n.format("MGT2.Training.MoreToGo", { n: left })}`
        };
    }

    /** Whether folio 18's skill-level cap leaves no room for the level this programme is buying. */
    #capped(programme) {
        if ( programme.target.kind !== "skill" ) return false;
        const capacity = Grants.capacity(this.#actor);
        return capacity.enforced && (programme.next > 0) && (capacity.room < 1);
    }

    static #ordinal(n) {
        const key = `MGT2.Training.Ordinal.${n}`;
        return game.i18n.has(key) ? game.i18n.localize(key)
            : game.i18n.format("MGT2.Training.Ordinal.n", { n });
    }

    /** The frame outlives every re-render, so this binds once. @inheritDoc */
    _attachFrameListeners() {
        super._attachFrameListeners();
        this.element.addEventListener("change", this.#onChangeInput.bind(this));
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this.dragDrop.bind(this.element);
    }

    /** Two controls write, and both are named after a STORED field. */
    async #onChangeInput(event) {
        const input = event.target;
        const programme = this.#programme();
        if ( !this.canEdit || !programme ) return;
        switch ( input.name ) {
            case "note":
                return this.#write({ note: input.value });
            case "characteristic":
                return this.#write({ characteristic: input.value });
        }
    }

    /**
     * A `character` Actor takes one drop and it is the comrade teaching (Companion p.41).
     * @type {DragDrop}
     */
    get dragDrop() {
        return this.#dragDrop ??= new DragDrop.implementation({
            dropSelector: "[data-accept]",
            permissions: { drop: () => this.canEdit },
            callbacks: {
                dragover: this.#onDragOver.bind(this),
                dragleave: this.#onDragLeave.bind(this),
                drop: this.#onDrop.bind(this)
            }
        });
    }

    /** @type {DragDrop|null} */
    #dragDrop = null;

    /**
     * The refusal happens at the pointer, which core cannot do: `DataTransfer` is in protected mode
     * for the whole of `dragover`, so only `MGT2Helper.watchDrags`' cached payload can answer.
     */
    #onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        if ( zone ) zone.classList.add(MGT2Helper.dropAccepted(zone) ? "over" : "deny");
    }

    #onDragLeave(event) {
        const zone = event.target.closest("[data-accept]");
        if ( zone && !zone.contains(event.relatedTarget) ) zone.classList.remove("over", "deny");
    }

    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        const data = MGT2Helper.getDataFromDropEvent(event);
        zone?.classList.remove("over", "deny");
        if ( !zone || !this.canEdit || !MGT2Helper.dropAccepted(zone, data) ) return;
        // Awaited end to end: a packed Actor answers `fromUuidSync` with an index entry.
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor || (actor.id === this.#actor.id) ) return;
        return this.#write({ teacher: actor.uuid });
    }

    /** The programme the panel is showing, re-read off the document every time it is asked for. */
    #programme(id = this.#selected) {
        return this.#actor.system.training.programmes[id] ?? null;
    }

    /** Per key, never per collection: two clients moving two programmes must not collide. */
    async #write(changes, id = this.#selected) {
        const update = {};
        for ( const [key, value] of Object.entries(changes) ) {
            update[`system.training.programmes.${id}.${key}`] = value;
        }
        return this.#actor.update(update);
    }

    /** @this {TrainingScreen} */
    static async #onSelect(event, target) {
        this.#selected = target.closest("[data-programme]").dataset.programme;
        this.#last = null;
        return this.render({ parts: ["rail", "panel"] });
    }

    /** Ticking the box a week happened in. */
    static async #onLogWeek(event, target) {
        const programme = this.#programme();
        if ( !this.canEdit || !programme || programme.closed ) return;
        const week = Number(target.dataset.week);
        this.#last = null;
        return this.#write({ weeks: (week + 1 === programme.weeks) ? week : week + 1 });
    }

    /**
     * Core p.55's Average (8+) check on the programme's own characteristic, or Companion p.41's
     * teaching check at DM−the level being learned.
     */
    static async #onCheck() {
        const id = this.#selected;
        const before = this.#programme(id);
        if ( !this.canEdit || !before?.checkDue || before.closed || before.barred ) return;
        const core = before.engine === "core";

        // Read off the DOM rather than off the model: `change` fires on the blur the button's own
        // mousedown causes, so the note the player just typed may not have landed yet.
        const note = this.element.querySelector('[name="note"]')?.value ?? before.note;
        const teacher = core ? null : await this.#teacher(before);
        // Companion p.42: the teacher's own level caps what can be learned, and the check is taken
        // at DM−the level being reached.
        const modifiers = core ? []
            : [{ key: "training", label: "MGT2.Training.TeachingDM", dm: -before.next }];

        // The sheet strip's own entry point, so the two doors onto this check open the same prompt
        // and carry the same standing modifiers.
        const message = await TravellerActorSheet.roll(this.#actor, {
            roll: "characteristic",
            characteristic: before.checkCharacteristic,
            difficulty: "Average",
            modifiers
        });
        // Not a truthiness test: a dismissed prompt and an unparsable formula both come back
        // without a message, and a check that did not roll writes nothing at all.
        if ( !(message instanceof ChatMessage) ) return message;
        const check = checkOf(message);
        if ( !Number.isInteger(check?.effect) ) return message;

        // The prompt was open across other people's writes, so the programme is re-read rather than
        // taken from the copy made before it.
        const programme = this.#programme(id);
        if ( !programme ) return message;
        const ok = check.effect >= 0;
        const log = programme.log.map(row => ({ ...row }));
        this.#last = { id, ok, total: check.target + check.effect };
        if ( core ) {
            log.push({ kind: "period", ok, amount: programme.weeks, roll: this.#last.total, note });
            // Failure "indicates the Traveller has learned nothing new or useful" — the eight weeks
            // are spent either way, so the open period closes on both outcomes.
            return this.#write({ log, weeks: 0, note: "" }, id);
        }
        log.push({ kind: "teaching", ok, amount: ok ? 1 : 0, roll: this.#last.total,
            note: teacher?.name ?? "" });
        return this.#write({ log }, id);
    }

    /** The referee's award (Companion p.41). */
    static async #onAward(event, target) {
        const id = this.#selected;
        const programme = this.#programme(id);
        if ( !this.canEdit || !programme || programme.closed ) return;
        const kind = target.dataset.award;
        if ( !AWARDS.includes(kind) ) return;
        this.#last = null;
        const log = programme.log.map(row => ({ ...row }));
        log.push({ kind, ok: null, amount: 1, roll: null, note: "" });
        return this.#write({ log }, id);
    }

    /** The grant asks; it does not fire. */
    static async #onGrant() {
        const id = this.#selected;
        const programme = this.#programme(id);
        if ( !this.canEdit || !programme?.ready || this.#capped(programme) ) return;
        const name = TrainingScreen.#targetName(programme.target);
        const next = programme.next;
        const note = (programme.held === null)
            ? game.i18n.format("MGT2.Training.AddedAtZero", { name })
            : game.i18n.format("MGT2.Training.RisesTo", { name, n: next });
        // Core banks a level for periods already spent, so it moves nothing; the Companion's is a
        // purchase, and the negative row is what keeps the balance from drifting from its awards.
        const row = { kind: "grant", ok: null, roll: null, note,
            amount: (programme.engine === "core") ? 0 : -programme.cost };
        this.#last = null;

        if ( programme.target.kind === "characteristic" ) {
            const characteristicLog = this.#actor.system.characteristicLog.map(entry => ({ ...entry }));
            characteristicLog.push({ source: "training", term: null, age: null, roll: null,
                changes: { [programme.target.key]: 1 }, cost: 0, note });
            return this.#actor.update({
                "system.characteristicLog": characteristicLog,
                [`system.training.programmes.${id}.log`]: [...programme.log.map(r => ({ ...r })), row]
            });
        }

        await this.#grantSkill(programme.target.key, next);
        // `update` re-prepares the document, so the programme held above is a different model still
        // answering with the old level: re-read before the log is rewritten.
        const after = this.#programme(id);
        if ( !after ) return;
        return this.#write({ log: [...after.log.map(entry => ({ ...entry })), row] }, id);
    }

    /** Create the Item or raise it. */
    async #grantSkill(name, level) {
        const existing = Grants.skills(this.#actor)
            .filter(item => MGT2Helper.matchesSkill(item.name, name))
            .sort((a, b) => b.system.level - a.system.level)[0];
        if ( existing ) return existing.update({ "system.level": level });
        return this.#actor.createEmbeddedDocuments("Item", [{
            name, type: "talent", system: { subType: "skill", level }
        }]);
    }

    /** @this {TrainingScreen} */
    static async #onAdd() {
        if ( !this.canEdit ) return;
        const chosen = await this.#pick();
        if ( !chosen ) return;
        // Sixteen alphanumerics, which is what the map's `validateKey` accepts.
        const id = foundry.utils.randomID(16);
        await this.#actor.update({ [`system.training.programmes.${id}`]: {
            engine: chosen.engine, target: { kind: chosen.kind, key: chosen.key } } });
        this.#selected = id;
        this.#last = null;
        return this.render({ parts: ["rail", "panel"] });
    }

    /** `closed` means the Traveller stopped, not that a level arrived. @this {TrainingScreen} */
    static async #onAbandon() {
        if ( !this.canEdit || !this.#programme() ) return;
        return this.#write({ closed: true });
    }

    /** The `-=key` syntax is removed in v14, so the operator is what drops a record. @this {TrainingScreen} */
    static async #onRemove() {
        const id = this.#selected;
        if ( !this.canEdit || !this.#programme(id) ) return;
        this.#selected = "";
        return this.#actor.update({ system: { training: { programmes: {
            [id]: new foundry.data.operators.ForcedDeletion() } } } });
    }

    /** @this {TrainingScreen} */
    static async #onTeacherClear() {
        if ( !this.canEdit || !this.#programme() ) return;
        return this.#write({ teacher: null });
    }

    /** @this {TrainingScreen} */
    static async #onOpenDocument(event, target) {
        const document = await fromUuid(target.closest("[data-uuid]")?.dataset.uuid ?? "");
        return document?.sheet?.render(true);
    }

    /**
     * What each book refuses, drawn as refusals rather than hidden: a Traveller who goes looking
     * for Jack-of-all-Trades has a question, and an empty list answers it with silence.
     * @returns {Promise<{engine: string, kind: string, key: string}|null>}
     */
    async #pick() {
        const setting = Rules.get("advancementSystem");
        const engines = (setting === "both") ? ["core", "companion"] : [setting];
        const content = await this.#pickerContent(engines, setting);

        const chosen = await DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Training.TrainWhat") },
            classes: ["mgt2"],
            position: { width: 520 },
            content,
            ok: { label: "MGT2.Training.Start", icon: "fa-solid fa-graduation-cap" },
            // A click inside a form control does not run its label's activation behaviour, so
            // typing a name would otherwise leave the row it belongs to unchosen.
            render: (event, dialog) => dialog.element.querySelectorAll(".opt.new input.f")
                .forEach(input => input.addEventListener("input", () => {
                    input.closest(".opt").querySelector("input[type=radio]").checked = true;
                })),
            rejectClose: false
        });
        if ( !chosen?.choice ) return null;

        const [engine, kind, ...rest] = String(chosen.choice).split(":");
        // A blank key is the typed row: the Item this programme is about may not exist yet, and
        // creating it is what the programme is for.
        const key = rest.join(":") || String(chosen[`new-${engine}`] ?? "").trim();
        return key ? { engine, kind, key } : null;
    }

    async #pickerContent(engines, setting) {
        const actor = this.#actor;
        const period = actor.system.training.weeksPerPeriod;
        const live = Object.values(actor.system.training.programmes).filter(p => !p.closed);
        const training = key => live.some(programme =>
            programme.target.key.trim().toLowerCase() === key.trim().toLowerCase());
        const capacity = Grants.capacity(actor);
        const rows = [];

        for ( const engine of engines ) {
            const core = engine === "core";
            const badge = `MGT2.Training.Badge.${engine}`;
            for ( const item of Grants.skills(actor).sort((a, b) => a.name.localeCompare(b.name)) ) {
                const next = item.system.level + 1;
                // The two refusals are the model's, so the picker and a running programme cannot
                // disagree about what either book allows.
                const barred = CharacterData.trainingBarred({ kind: "skill", key: item.name });
                const athletics = MGT2.AthleticsTraining.skills.some(name =>
                    MGT2Helper.matchesSkill(item.name, name));
                rows.push({
                    value: `${engine}:skill:${item.name}`, badge, name: item.name,
                    range: game.i18n.format("MGT2.Training.LevelRange", { from: item.system.level, to: next }),
                    barred: barred || training(item.name),
                    why: barred ? game.i18n.localize("MGT2.Training.Barred.jackOfAllTrades")
                        : training(item.name) ? game.i18n.localize("MGT2.Training.Barred.alreadyTraining")
                            : (core && athletics) ? game.i18n.localize("MGT2.Training.AthleticsNote")
                                : core ? game.i18n.format("MGT2.Training.Cost",
                                    { periods: Math.max(1, next), weeks: Math.max(1, next) * period })
                                    : game.i18n.localize("MGT2.Training.Rule.skillCost")
                });
            }

            // Core trains skills and nothing else; the Companion's table is the only place a
            // characteristic can be bought at all (p.42).
            if ( core ) continue;
            for ( const key of [...MGT2.TrainingCosts.physical, ...MGT2.TrainingCosts.mental,
                "social", "psionic"] ) {
                if ( !actor.system.isCharacteristicShown(key) ) continue;
                const target = { kind: "characteristic", key };
                const characteristic = actor.system.characteristics[key];
                const next = characteristic.max + 1;
                const barred = CharacterData.trainingBarred(target)
                    ? TrainingScreen.#barredReason(target) : null;
                const mental = MGT2.TrainingCosts.mental.includes(key);
                rows.push({
                    value: `${engine}:characteristic:${key}`, badge,
                    name: game.i18n.localize(MGT2.Characteristics[key]),
                    range: game.i18n.format("MGT2.Training.ValueRange", { from: characteristic.max, to: next }),
                    barred: CharacterData.trainingBarred(target) || training(key),
                    why: barred ? game.i18n.localize(barred)
                        : training(key) ? game.i18n.localize("MGT2.Training.Barred.alreadyTraining")
                            : MGT2Helper.plural(mental ? "MGT2.Training.CostMental" : "MGT2.Training.CostPhysical",
                                CharacterData.trainingCost(target, next))
                });
            }
        }

        // The typed row, one per engine offered.
        const typed = engines.map(engine => ({
            engine, value: `${engine}:skill:`, badge: `MGT2.Training.Badge.${engine}`,
            why: (engine === "core")
                ? game.i18n.format("MGT2.Training.Cost", { periods: 1, weeks: period })
                : game.i18n.localize("MGT2.Training.Rule.skillCost")
        }));

        const content = document.createElement("div");
        content.innerHTML = await foundry.applications.handlebars.renderTemplate(PICKER, {
            rows, typed,
            engine: game.i18n.format("MGT2.Training.EngineIs", {
                engine: game.i18n.localize(MGT2.AdvancementEngines[setting]
                    ?? `MGT2.Rules.advancementSystem.${setting}`) }),
            // The cap speaks only where it binds: 3 × (INT + EDU) never comes near a typical
            // Traveller, and a limit that never binds is noise on every sheet that is not this one.
            capped: capacity.enforced && (capacity.room < 1)
                ? game.i18n.localize("MGT2.Training.Barred.skillCap") : null
        });
        return content;
    }
}

/**
 * Two doors: the Traveller's own sheet, where a player is already looking, and the Actor directory,
 * where a referee is.
 */
export function registerTrainingScreen() {
    // NOT `getHeaderControls`, which never fires: `ApplicationV2#_doEvent` defaults
    // `parentClassHooks` to true and appends `{}` to a name that has none, so the hook is called
    // once per class in the inheritance chain and never under the bare name.
    Hooks.on("getHeaderControlsActorSheetV2", (application, controls) => {
        if ( application.document?.type !== "character" ) return;
        controls.push({
            icon: "fa-solid fa-graduation-cap",
            label: "MGT2.Training.Open",
            action: "mgt2Training",
            onClick: () => TrainingScreen.open(application.document)
        });
    });

    Hooks.on("getActorContextOptions", (application, options) => {
        options.push({
            label: "MGT2.Training.Open",
            icon: '<i class="fa-solid fa-graduation-cap"></i>',
            visible: li => application.collection
                .get(li.closest("[data-entry-id]").dataset.entryId)?.type === "character",
            onClick: (event, li) => TrainingScreen.open(application.collection
                .get(li.closest("[data-entry-id]").dataset.entryId))
        });
    });
}
