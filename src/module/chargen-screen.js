import { Chargen } from "./chargen.js";
import { ChargenClose } from "./chargen-close.js";
import { ChargenTerm } from "./chargen-term.js";
import { CreationBackground } from "./chargen-background.js";
import { CreationCharacteristics } from "./chargen-characteristics.js";
import { CreationOptions } from "./chargen-rolls.js";
import { Grants } from "./chargen-grants.js";
import { CreationPsi } from "./chargen-psi.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const PARTS_PATH = "systems/mgt2/templates/chargen";

/** Creation produces a Traveller, so a Traveller is what the roster takes. */
const ROSTER_TYPES = "Actor.character";

/** A column is one Traveller, and the frame is the one thing it takes. */
const FRAME_TYPES = "Item.species";

/**
 * The creation screen: a grid of Travellers × terms, and no session document behind it.
 * @extends {ApplicationV2}
 */
export class ChargenScreen extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-chargen",
        classes: ["mgt2", "chargen", "nopad"],
        // 1160 is the sketch's own frame, and it is not decoration: four columns at 4 rem of term
        // gutter plus a 12-line cell is what fits before a fifth Traveller falls off the edge.
        position: { width: 1160, height: 700 },
        window: { resizable: true, icon: "fa-solid fa-user-plus", title: "MGT2.Chargen.Screen.Title" },
        actions: {
            selectColumn: ChargenScreen.#onSelectColumn,
            leave: ChargenScreen.#onLeave,
            openActor: ChargenScreen.#onOpenActor,
            rollCharacteristics: ChargenScreen.#onRollCharacteristics,
            rollPsi: ChargenScreen.#onRollPsi,
            connect: ChargenScreen.#onConnect,
            takeBackground: ChargenScreen.#onTakeBackground,
            runStep: ChargenScreen.#onRunStep,
            openClose: ChargenScreen.#onOpenClose
        }
    };

    /** Four parts, and they are the sketch's four blocks. @inheritDoc */
    static PARTS = {
        masthead: { template: `${PARTS_PATH}/masthead.html` },
        ledger: { template: `${PARTS_PATH}/ledger.html`, scrollable: [""] },
        strip: { template: `${PARTS_PATH}/strip.html` },
        tray: { template: `${PARTS_PATH}/tray.html` }
    };

    /**
     * One window. A second would show the same roster twice and select two different columns in it.
     * @param {Actor} [options.add]   A Traveller to put on the roster before the window opens
     */
    static async open({ add } = {}) {
        const screen = foundry.applications.instances.get("mgt2-chargen") ?? new ChargenScreen();
        if ( add ) await screen.add(add);
        return screen.render({ force: true });
    }

    /** Put a Traveller on the roster — which is writing the flag and nothing else. */
    async add(actor) {
        if ( actor?.type !== "character" ) return null;
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        if ( Chargen.isInCreation(actor) ) {
            this.#selectedId = actor.id;
            return actor;
        }
        this.#selectedId = actor.id;
        return Chargen.start(actor);
    }

    /** Which column the strip and the tray are read from. Per-client, and never persisted. */
    #selectedId = null;

    /** Every actor this screen has written into `apps`, which is not the same as the current roster. */
    #registered = new Set();

    /** Two registrations, two different shapes, and both are needed. */
    #syncRegistrations(actors) {
        const wanted = new Set(actors.filter(actor => actor));
        for ( const actor of this.#registered ) {
            if ( !wanted.has(actor) ) delete actor.apps[this.id];
        }
        for ( const actor of wanted ) actor.apps[this.id] = this;
        this.#registered = wanted;
        const apps = game.actors.apps;
        for ( let i = apps.length - 1; i >= 0; i-- ) {
            if ( (apps[i] !== this) && (apps[i] instanceof ChargenScreen) ) apps.splice(i, 1);
        }
        if ( !apps.includes(this) ) apps.push(this);
    }

    /**
     * `_tearDown` and not `_onClose`: it runs synchronously before the state flips to CLOSED, while
     * `_onClose` is dispatched unawaited — and a stale entry in a collection's `apps` array renders
     * a closed window on every actor update for the rest of the session.
     * @inheritDoc
     */
    _tearDown(options) {
        super._tearDown(options);
        for ( const actor of this.#registered ) delete actor.apps[this.id];
        this.#registered = new Set();
        const index = game.actors.apps.indexOf(this);
        if ( index >= 0 ) game.actors.apps.splice(index, 1);
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const roster = Chargen.roster().sort((a, b) => a.name.localeCompare(b.name));
        this.#syncRegistrations(roster);

        const columns = roster.map(actor => this.#column(actor));
        const selected = columns.find(column => column.id === this.#selectedId)
            ?? columns.find(column => column.isOwner) ?? columns[0] ?? null;
        this.#selectedId = selected?.id ?? null;
        for ( const column of columns ) column.selected = column.id === selected?.id;

        context.rosterTypes = ROSTER_TYPES;
        context.frameTypes = FRAME_TYPES;
        context.columns = columns;
        context.colspan = columns.length + 1;
        context.empty = !columns.length;
        context.serving = columns.filter(column => !column.done).length;
        // Who has business on the closing screen: a Traveller whose last career is closed is owed
        // mustering out, and until that runs the flag stays on and the column stays ragged.
        context.done = columns.length - context.serving;
        // The table's clock, DERIVED and not stored: the furthest cursor on the roster.
        context.term = columns.reduce((furthest, column) => Math.max(furthest, column.cursor), 0);
        context.rows = ChargenScreen.#rows(columns);
        context.options = ChargenScreen.#options();
        context.strip = selected ? this.#strip(selected) : null;
        context.tray = selected ? ChargenScreen.#tray(selected) : null;
        return context;
    }

    /** One Traveller, read whole. Nothing here is stored — every field is a reading of the actor. */
    #column(actor) {
        const timeline = Chargen.timeline(actor);
        const species = Chargen.frame(actor);
        const frame = species?.system.frame;
        const done = Chargen.isDone(actor);
        return {
            id: actor.id, name: actor.name, actor,
            isOwner: actor.isOwner,
            canEdit: actor.canUserModify(game.user, "update"),
            // The species Item's own name, because a frame is per VARIANT: two statlines can exist
            // under one species name, so the frame actually loaded is what the header prints.
            species: species?.name ?? "",
            age: Chargen.age(actor),
            cursor: Chargen.read(actor).term,
            lastTerm: timeline.at(-1)?.index ?? 0,
            done,
            // The manner of leaving, which four separate rules read rather than the fact.
            exitMode: done ? ChargenScreen.#label(MGT2.CareerExitModes, timeline.at(-1)?.career.system.exitMode) : "",
            cells: new Map(timeline.map(row => [row.index, ChargenScreen.#cell(row, frame)])),
            selected: false
        };
    }

    /** One cell: the career, the assignment and the term's own typed facts. */
    static #cell(row, frame) {
        const lines = [];
        const say = (tone, mark, key) => lines.push({ tone, mark, text: game.i18n.localize(key) });
        if ( row.survived === true ) say("good", "✓", "MGT2.Chargen.Screen.Survived");
        if ( row.survived === false ) say("bad", "✗", "MGT2.Chargen.Screen.SurvivalFailed");
        // Ejection is a FIELD and never a phrase: a note reading "not ejected" would fool
        // any text match, which is why the row carries the boolean and this reads it.
        if ( row.ejected ) say("bad", "✗", "MGT2.Chargen.Screen.Ejected");
        // The term KIND is the frame's own vocabulary — the frame declares what a term
        // yields and names it, so the label comes off the frame and never off a list in this file.
        const kind = frame?.termKinds?.find(entry => entry.key === row.kind);
        if ( row.kind ) lines.push({ tone: "", mark: "·", text: kind?.label || row.kind });
        if ( row.note ) lines.push({ tone: "", mark: "·", text: row.note });
        for ( const event of row.events ) lines.push({ tone: "", mark: "·", text: event.description });
        return {
            career: row.careerName, assignment: row.assignment, lines,
            track: row.track ? { ...row.track, display: ChargenScreen.#trackDisplay(row.track) } : null
        };
    }

    /** A named track prints its cap where it has one: a threshold with no ceiling is half a number. */
    static #trackDisplay(track) {
        return (track.cap === null) ? `${track.value}` : `${track.value} / ${track.cap}`;
    }

    /**
     * The grid, and the one rule that makes the tail ragged: **a vacated cell is not an empty
     * one**.
     */
    static #rows(columns) {
        const last = columns.reduce((furthest, column) =>
            Math.max(furthest, column.lastTerm, column.done ? 0 : column.cursor), 0);
        return Array.fromRange(last, 1).map(n => ({
            n,
            cells: columns.map(column => {
                const cell = column.cells.get(n);
                if ( cell ) return { ...cell, id: column.id, state: (n === column.cursor) && !column.done ? "now" : "" };
                if ( !column.done && (n === column.cursor) ) return { id: column.id, state: "now", live: true };
                if ( column.done && (n > column.lastTerm) ) return { id: column.id, state: "gone", gone: true };
                return { id: column.id, state: "" };
            })
        }));
    }

    /**
     * The table's terms, stated before anyone rolls. Only what DIFFERS from the printed game, plus
     * the assignment method, which every table chooses and which decides the very first step.
     * @returns {string[]}
     */
    static #options() {
        const all = CreationOptions.all();
        const say = key => game.i18n.localize(`MGT2.Chargen.Screen.Option.${key}`);
        const terms = [game.i18n.localize(`MGT2.Rules.creationAssignment.${all.assignment}`)];
        if ( all.boonDice !== "none" ) {
            terms.push(game.i18n.format("MGT2.Chargen.Screen.Option.boon",
                { n: game.i18n.localize(`MGT2.Rules.creationBoonDice.${all.boonDice}`) }));
        }
        if ( all.ironMan ) terms.push(say("ironMan"));
        if ( all.maximumTerms ) {
            terms.push(MGT2Helper.plural("MGT2.Chargen.Screen.Option.maximumTerms", all.maximumTerms,
                { n: all.maximumTerms }));
        }
        if ( all.pickedSkills ) terms.push(say("pickedSkills"));
        if ( all.solo ) terms.push(say("solo"));
        return terms;
    }

    /** The frame's whole argument, on screen. */
    #strip(column) {
        const { sequence, own, cut } = Chargen.steps(column.actor);
        const species = Chargen.frame(column.actor);
        const frame = species?.system.frame;
        // The step the loop is on.
        const cursor = ChargenTerm.current(column.actor);
        const rolled = CreationCharacteristics.isSet(column.actor);
        return {
            id: column.id,
            name: column.name,
            canRun: column.canEdit,
            // Core p.9's first step, and it stands outside the numbered list because it runs once
            // rather than once a term.
            characteristics: { set: rolled, upp: rolled ? (column.actor.system.upp ?? "") : "" },
            psi: ChargenScreen.#psi(column),
            background: ChargenScreen.#background(column),
            steps: sequence.map((key, index) => ({
                key, order: index + 1, own: own.has(key), now: key === cursor,
                label: ChargenScreen.#label(MGT2.CreationSteps, key)
            })),
            cut: [...cut].map(key => ({ key, label: ChargenScreen.#label(MGT2.CreationSteps, key) })),
            why: frame?.why ?? "",
            // No species Item is no frame, and the Core sequence is what a Traveller without one
            // runs.
            frameName: species?.name ?? game.i18n.localize("MGT2.Chargen.Screen.DefaultFrame"),
            source: ChargenScreen.#source(species?.system.source)
        };
    }

    /**
     * Core p.9's second pre-term step. The chip carries the allowance rather than a code, because
     * the allowance is what the step is about and it moves with EDU right up to the moment it runs.
     */
    static #background(column) {
        const plan = CreationBackground.plan(column.actor);
        const count = (plan.count === null) ? MGT2Helper.showFormula(plan.formula) : String(plan.count);
        return {
            set: CreationBackground.isSet(column.actor),
            count,
            hint: game.i18n.format("MGT2.Chargen.Background.Hint",
                { n: count, dm: MGT2Helper.signed(plan.eduDM) })
        };
    }

    /**
     * The third chip, which exists only where the table adopted PSI. It walks Core p.228's own two
     * steps and the state picks: test, then train, and nothing at all once PSI 0 is the answer.
     * @returns {object|null}
     */
    static #psi(column) {
        if ( !CreationPsi.available() ) return null;
        const state = CreationPsi.state(column.actor);
        const hint = { test: "MGT2.Chargen.Psi.TestHint", train: "MGT2.Chargen.Psi.TrainHint",
            none: "MGT2.Chargen.Psi.NoneHint" }[state.step];
        return {
            score: state.score,
            untested: !state.tested,
            none: state.step === "none",
            canRun: column.canEdit && (state.step !== "none"),
            hint: game.i18n.format(hint, { formula: state.formula })
        };
    }

    /** The pair degrades: a book with no page is still a citation, and prints without a bare "p." */
    static #source(source) {
        if ( !source?.book ) return "";
        return source.page
            ? game.i18n.format("MGT2.Chargen.Screen.Source", { book: source.book, page: source.page })
            : source.book;
    }

    /**
     * A tray entry is never a bare value: a printed penalty runs for a whole career, is spent on a
     * check the holder chooses, and expires on HOW that career ended.
     */
    static #tray(column) {
        const state = Chargen.read(column.actor);
        return {
            name: column.name,
            // The two counters are LEDGERS and not derivations — thirty printed rows wipe, grant,
            // remove or retain Benefit rolls, and two let a player wager them mid-term.
            benefitRolls: Chargen.benefitRolls(column.actor),
            skillRolls: Chargen.skillRolls(column.actor),
            entries: state.tray.map(entry => ({
                kind: ChargenScreen.#label(MGT2.TrayKinds, entry.kind),
                // A `dm` carries the number; every other kind names something instead.
                value: (entry.kind === "dm") ? MGT2Helper.signed(entry.dm) : (entry.value || "—"),
                appliesTo: [...entry.appliesTo].map(check => ChargenScreen.#label(MGT2.TrayChecks, check))
                    .join(", ") || "—",
                scope: [ChargenScreen.#label(MGT2.TrayScopes, entry.scope),
                    ChargenScreen.#careerName(column.actor, entry.career)].filter(part => part).join(" · "),
                duration: ChargenScreen.#label(MGT2.TrayDurations, entry.duration),
                // Null is unlimited: a DM on every Survival roll of a career has no count.
                uses: (entry.uses === null)
                    ? game.i18n.localize("MGT2.Chargen.Screen.Unlimited") : String(entry.uses),
                expiresWhen: entry.expiresWhen
                    ? ChargenScreen.#label(MGT2.CareerExitModes, entry.expiresWhen) : "—",
                note: entry.note
            }))
        };
    }

    /** A stored KEY is what every vocabulary holds, so a label is always a lookup and never a value. */
    static #label(vocabulary, key) {
        return key ? game.i18n.localize(vocabulary[key] ?? key) : "";
    }

    /**
     * A scoped tray entry names a career, and the field takes two different things by design: the
     * id of a record on this Traveller, or **a template id the referee typed** — which is what
     * keeps no career name in the code where one would otherwise be needed.
     */
    static #careerName(actor, career) {
        if ( !career ) return "";
        const record = actor.items.get(career);
        return (record?.type === "career") ? record.name : career;
    }

    /** @this {ChargenScreen} */
    static #onSelectColumn(event, target) {
        const id = target.closest("[data-actor-id]")?.dataset.actorId;
        if ( !id || (id === this.#selectedId) ) return;
        this.#selectedId = id;
        this.render({ parts: ["ledger", "strip", "tray"] });
    }

    /**
     * Taking a Traveller off the roster, which is unsetting the flag and nothing else — **the actor
     * keeps everything decided so far**, because everything decided was written to the
     * actor as it was decided.
     */
    static async #onLeave(event, target) {
        const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
        if ( !actor ) return;
        if ( !actor.canUserModify(game.user, "update") ) {
            return ui.notifications.warn(
                game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
        }
        const confirmed = await DialogV2.confirm({
            window: { title: "MGT2.Chargen.Screen.Leave" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.Chargen.Screen.LeaveHint", { name: actor.name })}</p>`
        });
        if ( !confirmed ) return;
        if ( actor.id === this.#selectedId ) this.#selectedId = null;
        return Chargen.finish(actor);
    }

    /** @this {ChargenScreen} */
    static #onOpenActor(event, target) {
        game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId)?.sheet?.render({ force: true });
    }

    /** The hand-off. */
    static #onOpenClose() {
        return ChargenClose.open();
    }

    /** Roll and assign the set, which is the one step that precedes the term loop. */
    static async #onRollCharacteristics(event, target) {
        const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
        if ( !actor ) return;
        await CreationCharacteristics.run(actor);
        return this.render();
    }

    /** Core p.9's second step: the allowance is read now and spent now. */
    static async #onTakeBackground(event, target) {
        const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
        if ( !actor ) return;
        await CreationBackground.run(actor);
        return this.render();
    }

    /** Core p.228's step, which is testing or training depending on where this Traveller is. */
    static async #onRollPsi(event, target) {
        const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
        if ( !actor ) return;
        await CreationPsi.run(actor);
        return this.render();
    }

    /**
     * Core p.19's Connections Rule: two Travellers agree that one's event involved the other, and
     * both take a skill for it. It is the one transaction a single sheet cannot express.
     * @this {ChargenScreen}
     */
    static async #onConnect() {
        const roster = Chargen.roster().sort((a, b) => a.name.localeCompare(b.name));
        if ( roster.length < 2 ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Connect.NeedsTwo"));
        }
        const option = (actor, selected) => `<option value="${actor.id}"${selected
            ? " selected" : ""}>${foundry.utils.escapeHTML(actor.name)}</option>`;
        const first = roster.find(actor => actor.id === this.#selectedId) ?? roster[0];
        const second = roster.find(actor => actor !== first);
        // Every skill anyone on the roster already holds, so the two are typing against one list.
        const known = [...new Set(roster.flatMap(actor =>
            Grants.skills(actor).map(item => item.name)))].sort((a, b) => a.localeCompare(b));

        const content = document.createElement("div");
        content.innerHTML = await foundry.applications.handlebars.renderTemplate(
            `${PARTS_PATH}/connect.html`, {
                first: roster.map(actor => option(actor, actor === first)).join(""),
                second: roster.map(actor => option(actor, actor === second)).join(""),
                skills: known.map(name =>
                    `<option value="${foundry.utils.escapeHTML(name)}"></option>`).join("")
            });

        const agreed = await DialogV2.prompt({
            window: { title: "MGT2.Chargen.Connect.Title", icon: "fa-solid fa-link" },
            classes: ["mgt2"],
            position: { width: 460 },
            content,
            ok: {
                label: "MGT2.Chargen.Connect.Agree",
                icon: "fa-solid fa-check",
                callback: (click, button) => ({
                    a: button.form.elements.a.value, b: button.form.elements.b.value,
                    skills: { a: button.form.elements["skill-a"].value.trim(),
                        b: button.form.elements["skill-b"].value.trim() },
                    note: button.form.elements.note.value.trim()
                })
            },
            // Each side's skill row names the Traveller it belongs to, and the pair may be changed
            // after the dialog opens — so the labels follow the selects rather than the seed.
            render: (click, dialog) => ChargenScreen.#nameSkillRows(dialog.element),
            rejectClose: false
        });
        if ( !agreed ) return;
        const [a, b] = [game.actors.get(agreed.a), game.actors.get(agreed.b)];
        const written = await Grants.connect(a, b,
            { [agreed.a]: agreed.skills.a, [agreed.b]: agreed.skills.b }, agreed.note);
        if ( written ) {
            ui.notifications.info(game.i18n.format("MGT2.Chargen.Connect.Made",
                { name: a.name, other: b.name }));
        }
        return this.render();
    }

    /** The two skill labels, kept on the Travellers the two selects are actually holding. */
    static #nameSkillRows(element) {
        const paint = () => {
            for ( const side of ["a", "b"] ) {
                const chosen = element.querySelector(`select[name="${side}"]`).selectedOptions[0];
                element.querySelector(`label[data-for="${side}"]`).textContent =
                    game.i18n.format("MGT2.Chargen.Connect.SkillFor", { name: chosen?.textContent ?? "" });
            }
        };
        for ( const side of ["a", "b"] ) {
            element.querySelector(`select[name="${side}"]`).addEventListener("change", paint);
        }
        paint();
    }

    /** Run one step of the term on the selected Traveller. */
    static async #onRunStep(event, target) {
        const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
        if ( !actor ) return;
        await ChargenTerm.run(actor, target.dataset.step);
        // The document writes redraw every client through `apps`; this catches the case where the
        // step wrote only the cursor, which lives on a flag the screen reads but no document update
        // names.
        return this.render();
    }

    /**
     * The window hears every drop and not just the zone's, because what is dropped elsewhere on this
     * screen used to land in silence. It reaches here at all only because `Game#_onPreventDragover`
     * (`client/game.mjs`, *"target.type !== 'file'"*) prevents `dragover` on the whole document.
     * @inheritDoc
     */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this.element.addEventListener("drop", ChargenScreen.#onRefused);
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        // Re-bound on every render because the ledger part carries the zone and is replaced.
        this.dragDrop.bind(this.element);
    }

    /** Say what the roster takes, and where the commonest refusal actually belongs. */
    static #onRefused(event) {
        const data = MGT2Helper.getDataFromDropEvent(event);
        if ( !data?.uuid ) return;
        if ( MGT2Helper.dropAccepted(event.target.closest("[data-accept]"), data) ) return;
        let record = null;
        try { record = foundry.utils.fromUuidSync(data.uuid); } catch { /* an index entry is enough */ }
        ui.notifications.warn(game.i18n.localize(record?.type === "species"
            ? "MGT2.Chargen.Screen.DropSpecies" : "MGT2.Chargen.Screen.DropRefused"));
    }

    /**
     * A plain `ApplicationV2` inherits no drag-drop plumbing, so the controller is supplied here as
     * the Docket's and the voyage screen's are.
     * @type {DragDrop}
     */
    get dragDrop() {
        return this.#dragDrop ??= new DragDrop.implementation({
            dropSelector: "[data-accept]",
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
        if ( !zone ) return;
        zone.classList.add(MGT2Helper.dropAccepted(zone) ? "over" : "deny");
    }

    #onDragLeave(event) {
        const zone = event.target.closest("[data-accept]");
        if ( zone && !zone.contains(event.relatedTarget) ) zone.classList.remove("over", "deny");
    }

    /** The type is tested AFTER the uuid resolves, which is what `data-accept` names a type for. */
    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        const data = MGT2Helper.getDataFromDropEvent(event);
        zone?.classList.remove("over", "deny");
        if ( !zone || !MGT2Helper.dropAccepted(zone, data) ) return;
        // Awaited end to end: a packed document answers `fromUuidSync` with an index entry.
        const dropped = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !dropped ) return;
        if ( dropped.documentName === "Item" ) await this.#setFrame(zone, dropped);
        else await this.add(dropped);
        return this.render();
    }

    /**
     * The frame, dropped on the Traveller it is for. `SpeciesData` owns the link on
     * `personal.species`, so this places the Item and lets the frame's own tracks be born.
     */
    async #setFrame(zone, item) {
        const actor = game.actors.get(zone.closest("[data-actor-id]")?.dataset.actorId);
        if ( !actor ) return null;
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        // The sub-variant rule is the one case where a second frame is meant to stand beside the
        // first, so under it a drop adds and nothing is replaced.
        const standing = Rules.on("speciesModifiersStack") ? null : Chargen.frame(actor);
        if ( standing ) {
            const orphans = ChargenScreen.#orphanTracks(standing, item);
            if ( !await ChargenScreen.#confirmReplace(actor, standing, item, orphans) ) return null;
            await Chargen.dropTracks(actor, orphans);
            await standing.delete();
        }
        const [created] = await actor.createEmbeddedDocuments("Item", [MGT2Helper.stripIds(item)]);
        if ( !created ) return null;
        // The column dropped on becomes the selected one: the strip is where a frame states its case.
        this.#selectedId = actor.id;
        ui.notifications.info(game.i18n.format("MGT2.Chargen.Screen.FrameSet",
            { name: actor.name, frame: created.name }));
        return Chargen.ensureTracks(actor);
    }

    /**
     * The tracks the frame leaving declared and the one arriving does not. A key both declare keeps
     * its value: the Traveller is still on that track, and only the frame stating it has changed.
     * @returns {string[]}
     */
    static #orphanTracks(leaving, arriving) {
        const keys = item => (item?.system.frame.tracks ?? []).map(track => track.key).filter(key => key);
        const kept = new Set(keys(arriving));
        return keys(leaving).filter(key => !kept.has(key));
    }

    /** Replacing a frame is not a merge, so the ledger it wrote on is part of what is being asked. */
    static #confirmReplace(actor, leaving, arriving, orphans) {
        const lines = [game.i18n.format("MGT2.Chargen.Screen.FrameReplace",
            { name: actor.name, old: leaving.name, frame: arriving.name })];
        if ( orphans.length ) {
            lines.push(game.i18n.format("MGT2.Chargen.Screen.FrameReplaceTracks",
                { old: leaving.name, frame: arriving.name }));
        }
        return DialogV2.confirm({
            window: { title: "MGT2.Chargen.Screen.FrameReplaceTitle" },
            classes: ["mgt2"],
            content: lines.map(line => `<p>${line}</p>`).join(""),
            rejectClose: false
        });
    }
}

/**
 * Three doors, and none of them imports a sheet class: the character sheet's header, the Actor
 * directory's context menu, and the directory's own footer for the case where nobody is selected
 * yet.
 */
export function registerChargenScreen() {
    // NOT `getHeaderControls`, which never fires: `ApplicationV2#_doEvent` appends the class name,
    // so the hook is called once per class in the chain and never under the bare name.
    Hooks.on("getHeaderControlsActorSheetV2", (application, controls) => {
        if ( application.document?.type !== "character" ) return;
        controls.push({
            icon: "fa-solid fa-user-plus",
            label: "MGT2.Chargen.Screen.Add",
            action: "mgt2Chargen",
            onClick: () => ChargenScreen.open({ add: application.document })
        });
    });

    Hooks.on("getActorContextOptions", (application, options) => {
        options.push({
            label: "MGT2.Chargen.Screen.Add",
            icon: '<i class="fa-solid fa-user-plus"></i>',
            visible: li => application.collection
                .get(li.closest("[data-entry-id]").dataset.entryId)?.type === "character",
            onClick: (event, li) => ChargenScreen.open({ add: application.collection
                .get(li.closest("[data-entry-id]").dataset.entryId) })
        });
    });

    // The window has to be reachable with nobody selected — resuming a session three hours in is
    // opening it, and the roster is already there.
    Hooks.on("renderActorDirectory", (application, element) => {
        const header = element.querySelector(".header-actions");
        if ( !header || header.querySelector(".mgt2-chargen") ) return;
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("mgt2-chargen");
        button.innerHTML = `<i class="fa-solid fa-user-plus" inert></i>
            <span>${foundry.utils.escapeHTML(game.i18n.localize("MGT2.Chargen.Screen.Open"))}</span>`;
        button.addEventListener("click", () => ChargenScreen.open());
        header.append(button);
    });
}
