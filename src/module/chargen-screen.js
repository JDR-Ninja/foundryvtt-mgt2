import { Chargen } from "./chargen.js";
import { ChargenClose } from "./chargen-close.js";
import { ChargenTerm } from "./chargen-term.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const PARTS_PATH = "systems/mgt2/templates/chargen";

/** Creation produces a Traveller, so a Traveller is what the roster takes. */
const ROSTER_TYPES = "Actor.character";

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

    /** The frame's whole argument, on screen. */
    #strip(column) {
        const { sequence, own, cut } = Chargen.steps(column.actor);
        const species = Chargen.frame(column.actor);
        const frame = species?.system.frame;
        // The step the loop is on.
        const cursor = ChargenTerm.current(column.actor);
        return {
            id: column.id,
            name: column.name,
            canRun: column.canEdit,
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

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        // Re-bound on every render because the ledger part carries the zone and is replaced.
        this.dragDrop.bind(this.element);
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
        // Awaited end to end: a packed Actor answers `fromUuidSync` with an index entry.
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor ) return;
        await this.add(actor);
        return this.render();
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
