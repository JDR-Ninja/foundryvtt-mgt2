import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Jump } from "./jump.js";
import { Rules } from "./rules.js";
import { distance } from "./space.js";
import { checkOf } from "./chat-message.js";
import { SpacecraftActorSheet } from "./actors/spacecraft-sheet.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const PARTS_PATH = "systems/mgt2/templates/voyage";

/** Drawn inside the panel and rendered again on its own for the card, so it is named once. */
const MISJUMP = `${PARTS_PATH}/misjump.html`;

/** A leg names worlds and a roster names people; the screen takes nothing else. */
const WORLD_TYPE = "Actor.world";
const CREW_TYPES = "Actor.character Actor.npc";

/** Core p.157's two checks, as `role.actions[]` records. */
const JUMP_STEPS = Object.freeze({
    plot: Object.freeze({ kind: "skill", skill: "astrogation", characteristic: "education",
        difficulty: "Easy", label: "MGT2.Voyage.Plot", role: "astrogator" }),
    jump: Object.freeze({ kind: "skill", skill: "engineer", characteristic: "education",
        difficulty: "Easy", label: "MGT2.Voyage.Jump", role: "engineer" })
});

/**
 * The voyage screen: one leg, the stop it lands on, and the two checks that fly it.
 * @extends {ApplicationV2}
 */
export class VoyageScreen extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options) {
        super(options);
        this.#ship = options.ship;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-voyage-{id}",
        classes: ["mgt2", "voyage", "nopad"],
        position: { width: 1080, height: 780 },
        window: { resizable: true, icon: "fa-solid fa-route" },
        actions: {
            advance: VoyageScreen.#onAdvance,
            jumpStep: VoyageScreen.#onJumpStep,
            misjumpRoll: VoyageScreen.#onMisjumpRoll,
            misjumpPost: VoyageScreen.#onMisjumpPost,
            queuePromote: VoyageScreen.#onQueuePromote,
            queueRemove: VoyageScreen.#onQueueRemove,
            stopClear: VoyageScreen.#onStopClear,
            openDocument: VoyageScreen.#onOpenDocument
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/header.html` },
        rail: {
            template: `${PARTS_PATH}/rail.html`,
            // ⚠ A partial a part includes must be listed here too: the mixin loads `template` and
            // `templates` and does not walk nested `{{> …}}`, so an omission throws only on open.
            templates: ["systems/mgt2/templates/actors/spacecraft/budget.html",
                "systems/mgt2/templates/actors/spacecraft/budget-rows.html"],
            scrollable: [""]
        },
        panel: {
            template: `${PARTS_PATH}/panel.html`,
            templates: [MISJUMP],
            scrollable: [""]
        }
    };

    /** @type {Actor} */
    #ship;

    get ship() {
        return this.#ship;
    }

    /**
     * A `spacecraft` Actor carries ownership, so the manual `canEdit` the combat screen needs (a
     * `Combat` has no ownership field) is three words here.
     */
    get canEdit() {
        return this.#ship.canUserModify(game.user, "update");
    }

    get title() {
        return game.i18n.format("MGT2.Voyage.Title", { ship: this.#ship.name });
    }

    /** One screen per hull, addressed by the ship's own id. */
    static open(ship) {
        if ( ship?.type !== "spacecraft" ) return null;
        const existing = foundry.applications.instances.get(`mgt2-voyage-${ship.id}`);
        return (existing ?? new VoyageScreen({ ship })).render({ force: true });
    }

    /** @inheritDoc */
    _initializeApplicationOptions(options) {
        const applied = super._initializeApplicationOptions(options);
        applied.uniqueId = options.ship.id;
        return applied;
    }

    /**
     * The two Effects the jump was flown on, and the reading they produced.
     * @type {{plot: number|null, jump: number|null}}
     */
    #effects = { plot: null, jump: null };

    /** @type {object|null} */
    #reading = null;

    /** Folio 152's half of the Very Bad Jump ladder that no stored field can answer. */
    #gravity = "none";

    /** Every document this screen has written into `apps`, which is not the same as the current leg. */
    #registered = new Set();

    /** `document.apps` is the only re-render mechanism there is. */
    #syncRegistrations(documents) {
        const wanted = new Set(documents.filter(document => document));
        for ( const document of this.#registered ) {
            if ( !wanted.has(document) ) delete document.apps[this.id];
        }
        for ( const document of wanted ) document.apps[this.id] = this;
        this.#registered = wanted;
    }

    /**
     * `_tearDown` and not `_onClose`: it runs synchronously before the state flips to CLOSED, while
     * `_onClose` is dispatched unawaited.
     * @inheritDoc
     */
    _tearDown(options) {
        super._tearDown(options);
        for ( const document of this.#registered ) delete document.apps[this.id];
        this.#registered = new Set();
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const system = this.#ship.system;
        const voyage = system.voyage;
        const parsecs = Math.max(1, voyage.next.parsecs);

        const here = await VoyageScreen.#stop(voyage.here);
        const next = await VoyageScreen.#stop(voyage.next);
        // The two ends and no queue entry: three `apps` are registered, and a stop still to come
        // changes nothing this screen prints.
        this.#syncRegistrations([this.#ship, here.document, next.document]);
        const charted = VoyageScreen.#charted(here.document, next.document);
        // The Actor was carried this far only so `apps` could be written.
        delete here.document;
        delete next.document;

        context.canEdit = this.canEdit;
        context.worldType = WORLD_TYPE;
        context.crewTypes = CREW_TYPES;
        context.route = {
            here, next, parsecs, charted,
            queue: await Promise.all(voyage.queue.map((stop, index) =>
                VoyageScreen.#stop(stop).then(({ document, ...entry }) => ({ ...entry, index }))))
        };
        context.leg = VoyageScreen.#leg(system, parsecs, next);
        context.fuel = this.#fuel(parsecs);
        context.jump = this.#jump(system, parsecs);
        context.ship = VoyageScreen.#shipStats(system);
        context.crew = await this.#crew();
        context.rulesets = Object.entries(MGT2.JumpRulesets).map(([key, label]) => ({
            key, label, active: key === voyage.ruleset
        }));
        context.misjump = this.#misjump(voyage.ruleset);
        return context;
    }

    /** One end of the leg. */
    static async #stop(stop) {
        const document = stop.world ? await fromUuid(stop.world) : null;
        const world = (document?.type === "world") ? document : null;
        const name = world?.name || stop.name;
        if ( !world ) return { document: null, name, named: Boolean(name), linked: false };
        const system = world.system;
        return {
            document: world, name, named: true, linked: true, uuid: world.uuid,
            profile: system.profile,
            codes: system.codes,
            // Core p.258: the letter decides the fuel grade, which is the one thing about a port
            // that reaches the NEXT leg — unrefined fuel is DM−2 on the jump after it is taken on.
            fuelGrade: system.starport.fuel,
            // Green is the absence of a zone rather than a third one, so it prints nothing.
            zone: (system.zone === "green") ? null : system.zone,
            zoneLabel: (system.zone === "green") ? null : MGT2.TravelZones[system.zone]?.label,
            forbidden: system.travel.forbidden
        };
    }

    /** The map's figure; null when an end is a bare name, an unknown sector or an unplaced hex. */
    static #charted(here, next) {
        const from = here?.system.location?.coords;
        const to = next?.system.location?.coords;
        return (from && to) ? distance(from, to) : null;
    }

    /** What the pair is worth, and every figure of it is a reading of the three stored numbers. */
    static #leg(system, parsecs, next) {
        return {
            burn: MGT2Helper.roundWeight(system.jumpFuel(parsecs)),
            astrogationDM: MGT2Helper.signed(-parsecs),
            jumpControl: parsecs,
            range: system.drives.jump,
            // The drive is what refuses a distance, not the tank: a jump-1 hull cannot reach two
            // parsecs however full it is.
            beyondRange: parsecs > system.drives.jump,
            zoneLabel: next.zoneLabel ?? null,
            forbidden: next.forbidden === true
        };
    }

    /**
     * The tank as one budget panel: the cap is `fuel.tons`, design tonnage that never moves, and
     * the one row is `ops.fuel`, the real level — Poor Maintenance leaks a percentage of CAPACITY,
     * so both are needed (Core p.155).
     */
    #fuel(parsecs) {
        const system = this.#ship.system;
        const cap = system.fuel.tons;
        const level = system.ops.fuel;
        const burn = system.jumpFuel(parsecs);
        const fill = cap > 0 ? Math.min(100, (level / cap) * 100) : 0;
        const round = value => Math.round(value * 10) / 10;
        return {
            level: round(level), cap: round(cap), burn: round(burn),
            rows: [{ key: "level", label: game.i18n.localize("MGT2.Voyage.InTheTank"),
                why: system.fuel.refined
                    ? "MGT2.Actor.spacecraft.Refined" : "MGT2.Actor.spacecraft.Unrefined",
                value: round(level) }],
            total: round(level), over: level > cap,
            fill: round(fill), mark: round(fill),
            remaining: round(Math.abs(cap - level)),
            enough: level >= burn,
            short: round(Math.max(0, burn - level)),
            after: round(Math.max(0, level - burn))
        };
    }

    /** The task chain as the books print it, with the DMs each check will carry stated first. */
    #jump(system, parsecs) {
        const chip = (key, data) => game.i18n.format(`MGT2.Voyage.${key}`, data);
        const jump = [];
        if ( !system.fuel.refined ) jump.push({ label: chip("UnrefinedChip"), negative: true });
        // Core p.157 prints two more and neither is applied: the 100-diameter limit is a position
        // nothing on this screen tracks, and DM−1 per month behind maintenance reads a counter the
        // design declined.
        jump.push({ label: chip("MaintenanceChip"), inert: true },
            { label: chip("DiameterChip"), inert: true });
        return {
            plot: { dms: [{ negative: true,
                label: chip("ParsecChip", { dm: MGT2Helper.signed(-parsecs), parsecs }) }] },
            jump: { dms: jump },
            ruleset: system.voyage.ruleset
        };
    }

    /** The misjump block. */
    #misjump(ruleset) {
        const core = ruleset === "core";
        return {
            core, ruleset,
            effects: this.#effects,
            // The Companion cannot start on one Effect: the trigger is the sum, so a single roll
            // says nothing at all until the other lands.
            ready: Number.isInteger(this.#effects.jump)
                && (core || Number.isInteger(this.#effects.plot)),
            gravity: Object.entries(MGT2.JumpGravity).map(([key, label]) => ({
                key, label, active: key === this.#gravity })),
            badJump: VoyageScreen.#badJumpLines(),
            reading: this.#reading ? VoyageScreen.#readingContext(this.#reading) : null
        };
    }

    /** A table row as one sentence: the printed outcome with the dice it asked for filled in. */
    static #outcome(entry) {
        const values = entry.values ?? {};
        const answered = clause => !clause.match(/{\w+}/g)
            ?.some(token => values[token.slice(1, -1)] === undefined);
        const label = entry.row.plural
            ? MGT2Helper.plural(entry.row.label, Number(values[entry.row.plural]))
            : game.i18n.localize(entry.row.label);
        // A sentence counting two things needs one group per count, so those values arrive as
        // already-plural fragments; `answered` still reads the raw ones.
        const parts = Object.entries(entry.row.plurals ?? {}).reduce((all, [key, fragment]) =>
            Object.assign(all, { [key]: MGT2Helper.plural(fragment, Number(values[key])) }), {});
        return label
            .split(/(?<=\.)\s+/).filter(answered).join(" ")
            .replace(/{(\w+)}/g, (token, key) => parts[key] ?? values[key]);
    }

    /** `2D 7 −1 = 6` — the read, so the table can be checked against the page it came from. */
    static #read(entry) {
        return game.i18n.format("MGT2.Jump.ReadLine", {
            roll: entry.roll,
            dm: MGT2Helper.signed(entry.effect ?? entry.dm ?? 0, "+0"),
            total: entry.total
        });
    }

    static #readingContext(reading) {
        if ( reading.ruleset === "core" ) {
            return {
                core: true,
                effect: MGT2Helper.signed(reading.effect, "+0"),
                misjumped: reading.misjumped,
                // Folio 158 hands the worst band's substitute to "a merciful referee", so a world
                // that has not adopted it is not offered the hint — read here rather than at roll
                // time, because it names an option and not a figure the dice already answered.
                merciful: (reading.row.merciful === true) && Rules.on("mercifulReferee"),
                outcome: VoyageScreen.#outcome(reading)
            };
        }

        const { distance, time } = reading;
        return {
            companion: true,
            astrogator: MGT2Helper.signed(reading.astrogator, "+0"),
            engineer: MGT2Helper.signed(reading.engineer, "+0"),
            sum: MGT2Helper.signed(reading.sum, "+0"),
            misjumped: reading.misjumped,
            serious: reading.serious,
            averted: reading.averted,
            badJump: reading.badJump,
            veryBad: reading.veryBad,
            distance: {
                read: VoyageScreen.#read(distance),
                printed: distance.row.diameters,
                value: distance.diameters,
                emergence: distance.emergence,
                precipitated: distance.precipitated,
                bad: distance.bad
            },
            time: {
                read: VoyageScreen.#read(time),
                printed: time.row.hours,
                value: time.hours,
                duration: time.duration,
                long: time.long,
                swing: time.swing,
                bad: time.bad
            },
            misjump: reading.misjump ? {
                read: VoyageScreen.#read(reading.misjump),
                outcome: VoyageScreen.#outcome(reading.misjump)
            } : null,
            veryBadJump: reading.veryBadJump ? {
                read: VoyageScreen.#read(reading.veryBadJump),
                outcome: VoyageScreen.#outcome(reading.veryBadJump),
                source: game.i18n.localize(`MGT2.Jump.VeryBadDM.${reading.veryBadJump.source}`)
            } : null
        };
    }

    /** Companion folio 151-152's consequences, as sentences. */
    static #badJumpLines() {
        const rules = MGT2.Misjumps.companion.badJump;
        const [routine, difficult] = rules.difficulties;
        const [first, second] = rules.characteristics
            .map(key => game.i18n.localize(MGT2.Characteristics[key]));
        // `MGT2.Difficulty` already prints its target — "Routine (6)" — so appending one states the
        // number twice, which is what the first live render of this block did.
        const rung = key => game.i18n.localize(MGT2.Difficulty[key]);
        return {
            checks: game.i18n.format("MGT2.Jump.BadJump.Checks", {
                first, second, routine: rung(routine), difficult: rung(difficult) }),
            veryBad: game.i18n.format("MGT2.Jump.BadJump.VeryBadDM", {
                dm: MGT2Helper.signed(rules.veryBadDM) }),
            physical: game.i18n.format("MGT2.Jump.BadJump.Physical", {
                first, at: rules.physical.incapacitatedAt,
                hours: MGT2Helper.plural("MGT2.Jump.BadJump.PhysicalHours", rules.physical.hours),
                // The only place a printed `2Dx30` reaches a player, and `*` is Foundry's operator
                // rather than the book's sign. It is a formula, so it takes the plural form.
                out: MGT2Helper.plural("MGT2.Jump.BadJump.PhysicalMinutes", Number.NaN,
                    { n: rules.physical.outFor.replace("*", "×") }),
                then: MGT2Helper.signed(rules.physical.thenDM),
                thenHours: MGT2Helper.plural("MGT2.Jump.BadJump.PhysicalHours", rules.physical.thenHours)
            }),
            mental: MGT2Helper.plural("MGT2.Jump.BadJump.Mental", rules.mental.afterDays, {
                second, dm: MGT2Helper.signed(rules.mental.dm), at: rules.mental.seriousAt,
                days: rules.mental.afterDays })
        };
    }

    static #shipStats(system) {
        return {
            tons: system.hull.tons,
            jump: system.drives.jump,
            thrust: system.drives.effectiveThrust,
            cargo: system.cargo.capacity,
            staterooms: system.staterooms.standard + system.staterooms.high + system.staterooms.luxury,
            lowBerths: system.lowBerths.standard + system.lowBerths.emergency,
            aboard: system.crewTotals.aboard,
            fuelPerTon: Math.round(system.finance.fuelPerTon),
            tankFill: Math.round(system.finance.tankFill)
        };
    }

    /**
     * The roster, which belongs to the SHIP: this screen reads three of its rows and writes one
     * field on one of them, from a drop.
     */
    async #crew() {
        const rows = [];
        for ( const [index, station] of this.#ship.system.crew.entries() ) {
            const role = station.role ? this.#ship.items.get(station.role) : null;
            const actor = station.actor ? await fromUuid(station.actor) : null;
            const key = role?.system.crewRoleKey ?? "";
            rows.push({
                index,
                station: role?.name ?? "",
                department: role ? MGT2.Departments[role.system.department] : "",
                name: actor?.name || station.name,
                uuid: actor?.uuid ?? null,
                vacant: !actor && !station.name,
                // The two stations the jump chain reads, named through `crewRoleKey` because it is
                // the only locale-independent handle a station has.
                step: Object.keys(JUMP_STEPS).find(entry => JUMP_STEPS[entry].role === key) ?? null,
                statted: Boolean(actor)
            });
        }
        return rows;
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

    /**
     * Three documents can take writes from here and a form cannot bind to three, so the change is
     * routed by what the control names rather than submitted.
     */
    async #onChangeInput(event) {
        const input = event.target;
        if ( !this.canEdit ) return;
        switch ( input.name ) {
            case "parsecs":
                // Core p.157: a jump of less than one parsec counts as jump-1 for the Astrogation
                // DM and for the fuel alike, so the floor is printed and not defensive.
                return this.#ship.update({
                    "system.voyage.next.parsecs": Math.max(1, Number(input.value) || 1) });
            case "fuel":
                return this.#ship.update({ "system.ops.fuel": Math.max(0, Number(input.value) || 0) });
            case "ruleset":
                // The reading belongs to the procedure it was read under, so switching discards it.
                this.#reading = null;
                return this.#ship.update({ "system.voyage.ruleset": input.value });
            // None of the three is stored, so none of them writes: the screen re-renders itself.
            case "effectPlot":
            case "effectJump":
                this.#effects[(input.name === "effectPlot") ? "plot" : "jump"] =
                    (input.value === "") ? null : Math.trunc(Number(input.value) || 0);
                this.#reading = null;
                return this.render({ parts: ["panel"] });
            case "gravity":
                this.#gravity = input.value;
                this.#reading = null;
                return this.render({ parts: ["panel"] });
            // A leg has to work with a typed name and no `world` document, which is what this is.
            case "stopName":
                return this.#ship.update({
                    [`system.voyage.${input.dataset.stop}.name`]: input.value });
        }
    }

    /**
     * A plain `ApplicationV2` inherits no drag-drop plumbing at all — the wiring first appears on
     * `ActorSheetV2` — so the whole controller is supplied here.
     * @type {DragDrop}
     */
    get dragDrop() {
        return this.#dragDrop ??= new DragDrop.implementation({
            // No `dragSelector`: nothing on this screen is dragged OUT of it, and a queue that
            // could be reordered by hand would be an ordered array with a cursor again.
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
     * A zone declares what it takes in `data-accept` and refuses everything else AT THE POINTER.
     */
    #onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        this.#clearDropState(zone);
        if ( !zone ) return;
        if ( MGT2Helper.dropAccepted(zone) ) zone.classList.add("over");
        else zone.classList.add("deny");
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

    /**
     * Three zones, three different documents: a `world` on either end of the leg sets that end, a
     * `world` on the queue is filed as a name to come back to, and a person on the roster writes
     * `spacecraft.system.crew[]` — the roster is the ship's and this screen only reads it, the same
     * split space combat draws.
     */
    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        const data = MGT2Helper.getDataFromDropEvent(event);
        this.#clearDropState();
        // No `preventDefault` here: `DragDrop#_handleDrop` has already called it before dispatching.
        if ( !zone || !this.canEdit || !MGT2Helper.dropAccepted(zone, data) ) return;
        // Awaited end to end: a packed Actor answers `fromUuidSync` with an index entry.
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor ) return;
        if ( zone.dataset.stop ) return this.#dropStop(actor, zone.dataset.stop);
        if ( zone.dataset.queue !== undefined ) return this.#dropQueued(actor);
        return this.#dropCrew(actor, zone.dataset.rowIndex);
    }

    /**
     * The uuid AND the name are written, because the leg has to keep reading when the document is
     * gone. Only `next` takes a distance back to the printed minimum; `here` has no parsecs.
     */
    async #dropStop(actor, stop) {
        const queue = this.#ship.system.voyage.queue
            .filter(entry => entry.world !== actor.uuid).map(entry => ({ ...entry }));
        const end = { world: actor.uuid, name: actor.name };
        if ( stop === "next" ) end.parsecs = 1;
        return this.#ship.update({ system: { voyage: { [stop]: end, queue } } });
    }

    async #dropQueued(actor) {
        const voyage = this.#ship.system.voyage;
        if ( voyage.queue.some(entry => entry.world === actor.uuid) ) return;
        const queue = voyage.queue.map(entry => ({ ...entry }));
        queue.push({ world: actor.uuid, name: actor.name });
        return this.#ship.update({ "system.voyage.queue": queue });
    }

    /** A ship has a crew when no jump is running, so the row is written on the hull. */
    async #dropCrew(actor, rowIndex) {
        const index = Number(rowIndex ?? -1);
        const crew = this.#ship.system.crew.map(station => ({ ...station }));
        if ( crew[index] ) crew[index].actor = actor.uuid;
        else crew.push({ actor: actor.uuid, name: actor.name });
        return this.#ship.update({ "system.crew": crew });
    }

    /**
     * The referee's clock, and the single writer of the leg: nothing subscribes to
     * `updateWorldTime`, no roll moves the stop, and the fuel was debited by the Jump button.
     */
    static async #onAdvance() {
        if ( !this.canEdit ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Voyage.NoPermission"));
        }
        return this.#ship.system.advanceLeg();
    }

    /**
     * Core p.157's chain: an Easy (4+) Astrogation check at DM−1 per parsec, then an Easy (4+)
     * Engineer (j-drive) check carrying its Effect.
     */
    static async #onJumpStep(event, target) {
        const step = target.dataset.step;
        const ship = this.#ship;
        const parsecs = Math.max(1, ship.system.voyage.next.parsecs);
        const burn = ship.system.jumpFuel(parsecs);

        // Core p.157 leaves no room here: without the fuel the drive does not fire.
        if ( (step === "jump") && (ship.system.ops.fuel < burn) ) {
            return ui.notifications.warn(game.i18n.format("MGT2.Voyage.NoFuel",
                { need: MGT2Helper.roundWeight(burn), have: MGT2Helper.roundWeight(ship.system.ops.fuel) }));
        }

        // Answered before the roll rather than after it: a `skill` action
        // needs a linked crew Actor, so `crew[].actor` has to be filled or neither button does
        // anything — and the warning names the station rather than the mechanism.
        const crew = await this.#stationActor(step);
        if ( !crew ) {
            return ui.notifications.warn(game.i18n.format("MGT2.Voyage.NoStation", {
                station: game.i18n.localize(MGT2.CrewRoles[JUMP_STEPS[step].role].label) }));
        }

        // Built at call time and LOCALISED at call time: `templates/chat/roll.html` prints
        // `rollObjectName` raw, so a literal carrying a key would put the key on the card.
        const action = { ...JUMP_STEPS[step], label: game.i18n.localize(JUMP_STEPS[step].label) };
        const message = await SpacecraftActorSheet.rollStationAction(ship, action,
            { crew, extraModifiers: VoyageScreen.#stepModifiers(step, ship.system, parsecs) });
        // Not a truthiness test: `rollStationAction` hands back a notification id on every refusal
        // path and `undefined` on a dismissed prompt, so the debit keys off the message the roll
        // actually posted.
        if ( !(message instanceof ChatMessage) ) return message;

        // The Effect the misjump block reads, taken off the message's own validated data rather
        // than from `resolve` — the same source a chain reads, so the block and the card can never
        // disagree about what was rolled.
        const effect = checkOf(message)?.effect;
        if ( Number.isInteger(effect) ) {
            this.#effects[step] = effect;
            this.#reading = null;
            this.render({ parts: ["panel"] });
        }
        if ( step !== "jump" ) return message;

        // The debit is one transaction with the roll, or `ops.fuel` is wrong at the first
        // forgotten jump.
        return ship.update({
            "system.ops.fuel": Math.max(0, ship.system.ops.fuel - burn) });
    }

    /** Read the jump. */
    static async #onMisjumpRoll() {
        const { plot, jump } = this.#effects;
        if ( !Number.isInteger(jump) ) return;
        const ruleset = this.#ship.system.voyage.ruleset;
        this.#reading = (ruleset === "core") ? await Jump.core(jump)
            : Number.isInteger(plot)
                ? await Jump.companion({ astrogator: plot, engineer: jump, gravity: this.#gravity })
                : null;
        return this.render({ parts: ["panel"] });
    }

    /** The reading, on the log. */
    static async #onMisjumpPost() {
        if ( !this.#reading ) return;
        const context = { misjump: this.#misjump(this.#ship.system.voyage.ruleset), card: true };
        const body = await foundry.applications.handlebars.renderTemplate(MISJUMP, context);
        const title = foundry.utils.escapeHTML(game.i18n.localize("MGT2.Jump.Title"));
        const ship = foundry.utils.escapeHTML(this.#ship.name);
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.#ship }),
            // The dice the reading was produced from, so the card is a roll and not a report of it.
            rolls: this.#reading.rolls ?? [],
            content: `<div class="mgt2 theme-light card misjump">
                <div class="chd"><div class="what"><h4>${title}</h4>
                    <span class="tgt">${ship}</span></div></div>${body}</div>`
        });
    }

    /** The DMs the two checks carry, as waivable modifiers rather than as `action.dm`. */
    static #stepModifiers(step, system, parsecs) {
        if ( step === "plot" ) {
            return [{ key: "parsecs", label: "MGT2.Voyage.ParsecDM",
                params: { parsecs }, plural: "parsecs", dm: -parsecs }];
        }
        // Core p.157. The other two printed modifiers are the referee's: the 100-diameter limit is
        // a position nothing here tracks, and DM−1 per month behind maintenance reads a counter the
        // design declined.
        return system.fuel.refined ? []
            : [{ key: "unrefined", label: "MGT2.Voyage.UnrefinedDM", dm: -2 }];
    }

    /** Whoever is at the station the step belongs to. */
    async #stationActor(step) {
        const wanted = JUMP_STEPS[step].role;
        for ( const station of this.#ship.system.crew ) {
            const role = station.role ? this.#ship.items.get(station.role) : null;
            if ( (role?.system.crewRoleKey !== wanted) || !station.actor ) continue;
            const actor = await fromUuid(station.actor);
            if ( actor ) return actor;
        }
        return null;
    }

    /** @this {VoyageScreen} */
    static async #onQueuePromote(event, target) {
        if ( !this.canEdit ) return;
        const index = Number(target.closest("[data-queue]").dataset.queue);
        const queue = this.#ship.system.voyage.queue.map(entry => ({ ...entry }));
        const [stop] = queue.splice(index, 1);
        if ( !stop ) return;
        return this.#ship.update({ system: { voyage: {
            next: { world: stop.world, name: stop.name, parsecs: 1 }, queue
        } } });
    }

    /**
     * The queue carries names and no numbers, so removing one cannot falsify its neighbour — which
     * is the failure `#onRowDelete` has on every other array on the ship, and the reason an index
     * is refused here.
     */
    static async #onQueueRemove(event, target) {
        if ( !this.canEdit ) return;
        const index = Number(target.closest("[data-queue]").dataset.queue);
        const queue = this.#ship.system.voyage.queue
            .map(entry => ({ ...entry })).filter((_entry, i) => i !== index);
        return this.#ship.update({ "system.voyage.queue": queue });
    }

    /** An empty end is a legal state — a ship with nothing planned is still somewhere. */
    static async #onStopClear(event, target) {
        if ( !this.canEdit ) return;
        const stop = target.closest("[data-stop]").dataset.stop;
        return this.#ship.update({
            [`system.voyage.${stop}`]: { world: null, name: "" } });
    }

    /** The link is a stored UUID and nothing here reads the canvas. @this {VoyageScreen} */
    static async #onOpenDocument(event, target) {
        const document = await fromUuid(target.closest("[data-uuid]")?.dataset.uuid ?? "");
        return document?.sheet?.render(true);
    }
}

/**
 * Two entry points: the ship's own sheet, where a crew is already looking, and the Actor directory,
 * where a referee is.
 */
export function registerVoyageScreen() {
    // NOT `getHeaderControls`, which never fires: `ApplicationV2#_doEvent` defaults
    // `parentClassHooks` to true and appends `{}` to a name that has none, so the hook is called
    // once per class in the inheritance chain and never under the bare name.
    Hooks.on("getHeaderControlsActorSheetV2", (application, controls) => {
        if ( application.document?.type !== "spacecraft" ) return;
        controls.push({
            icon: "fa-solid fa-route",
            label: "MGT2.Voyage.Open",
            action: "mgt2Voyage",
            onClick: () => VoyageScreen.open(application.document)
        });
    });

    Hooks.on("getActorContextOptions", (application, options) => {
        options.push({
            label: "MGT2.Voyage.Open",
            icon: '<i class="fa-solid fa-route"></i>',
            visible: li => application.collection
                .get(li.closest("[data-entry-id]").dataset.entryId)?.type === "spacecraft",
            onClick: (event, li) => VoyageScreen.open(application.collection
                .get(li.closest("[data-entry-id]").dataset.entryId))
        });
    });
}
