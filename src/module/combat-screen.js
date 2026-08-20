import { MGT2 } from "./config.js";
import { CREW } from "./combatant.js";
import { SPACE, SpaceCombatData, STEPS } from "./combat.js";
import { MGT2Helper } from "./helper.js";
import { SpacecraftActorSheet } from "./actors/spacecraft-sheet.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PARTS_PATH = "systems/mgt2/templates/combat";

/** Only these two may be dropped on a station; the band cell takes the ship instead. */
const CREW_TYPES = "Actor.character Actor.npc";

/** The seven bands closest first — the order Core folio 165 prints, which is also the strip. */
const BANDS = Object.freeze(Object.keys(MGT2.ShipRangeBands));

/**
 * The space combat screen: the range strip, the order and the stations.
 * @extends {ApplicationV2}
 */
export class SpaceCombatScreen extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options) {
        super(options);
        this.#combat = options.combat;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-space-combat-{id}",
        classes: ["mgt2", "space-combat", "nopad"],
        position: { width: 1160, height: 820 },
        window: { resizable: true, icon: "fa-solid fa-rocket-launch" },
        actions: {
            selectShip: SpaceCombatScreen.#onSelectShip,
            measureTo: SpaceCombatScreen.#onMeasureTo,
            setBand: SpaceCombatScreen.#onSetBand,
            toggleResolved: SpaceCombatScreen.#onToggleResolved,
            rollShipInitiative: SpaceCombatScreen.#onRollInitiative,
            endRound: SpaceCombatScreen.#onEndRound,
            removeShip: SpaceCombatScreen.#onRemoveShip,
            thrustCreate: SpaceCombatScreen.#onThrustCreate,
            thrustDelete: SpaceCombatScreen.#onThrustDelete,
            stationAction: SpaceCombatScreen.#onStationAction,
            toggleSpent: SpaceCombatScreen.#onToggleSpent,
            toggleReaction: SpaceCombatScreen.#onToggleReaction,
            launchSalvo: SpaceCombatScreen.#onLaunchSalvo,
            salvoJam: SpaceCombatScreen.#onSalvoJam,
            salvoDefend: SpaceCombatScreen.#onSalvoDefend,
            salvoImpact: SpaceCombatScreen.#onSalvoImpact,
            salvoRemove: SpaceCombatScreen.#onSalvoRemove,
            openActor: SpaceCombatScreen.#onOpenActor
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/header.html` },
        rail: { template: `${PARTS_PATH}/rail.html`, scrollable: [""] },
        panel: {
            template: `${PARTS_PATH}/panel.html`,
            templates: ["systems/mgt2/templates/actors/spacecraft/budget.html"],
            scrollable: [""]
        }
    };

    /** @type {Combat} */
    #combat;

    get combat() {
        return this.#combat;
    }

    /** Which contact the strip is read FROM, which is also the ship the panel shows. */
    #selectedId = null;

    /** Which other contact the kilometre readout edits. */
    #measuredId = null;

    /** The distance the referee last typed. @type {number|null} */
    #km = null;

    /** The whole encounter is the referee's. */
    get canEdit() {
        return this.#combat.canUserModify(game.user, "update", { system: {} });
    }

    /** An encounter is created unnamed and core never gives it one, so the type label stands alone. */
    get title() {
        const label = game.i18n.localize("TYPES.Combat.space");
        return this.#combat.name ? `${label}: ${this.#combat.name}` : label;
    }

    /**
     * One screen per encounter, addressed by the combat's own id — a second window on the same
     * fight would show the same state twice and select two different ships in it.
     */
    static open(combat) {
        if ( combat?.type !== SPACE ) return null;
        const existing = foundry.applications.instances.get(`mgt2-space-combat-${combat.id}`);
        return (existing ?? new SpaceCombatScreen({ combat })).render({ force: true });
    }

    /** @inheritDoc */
    _initializeApplicationOptions(options) {
        const applied = super._initializeApplicationOptions(options);
        applied.uniqueId = options.combat.id;
        return applied;
    }

    /** The same registration `DocumentSheetV2` makes, so a document write reaches this window. */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this.#combat.apps[this.id] = this;
    }

    /** @inheritDoc */
    _onClose(options) {
        super._onClose(options);
        delete this.#combat.apps[this.id];
    }

    /** Every ship in the fight, highest Initiative first — an order that is not sorted is a list. */
    get ships() {
        return this.#combat.system.shipGroups
            .sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
    }

    get selected() {
        const ships = this.ships;
        return ships.find(group => group.id === this.#selectedId)
            ?? ships.find(group => group.system.ship?.isOwner) ?? ships[0] ?? null;
    }

    /** The contact the kilometre readout edits: another ship, never this one. */
    get measured() {
        const others = this.ships.filter(group => group.id !== this.selected?.id);
        return others.find(group => group.id === this.#measuredId) ?? others[0] ?? null;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const combat = this.#combat;
        const selected = this.selected;

        context.canEdit = this.canEdit;
        context.round = combat.round;
        context.step = combat.system.step;
        context.stepLabel = MGT2.CombatSteps[combat.system.step];
        context.steps = STEPS.map(key => ({
            key, label: MGT2.CombatSteps[key], active: key === combat.system.step
        }));
        context.strip = this.#strip(selected);
        context.order = this.ships.map(group => this.#orderRow(group, selected));
        context.panel = this.#panel(selected);
        context.crewTypes = CREW_TYPES;
        return context;
    }

    /** The strip, read from one ship outwards. */
    #strip(selected) {
        const system = this.#combat.system;
        const others = this.ships.filter(group => group.id !== selected?.id);
        const measured = this.measured;
        const here = (selected && measured) ? system.bandBetween(selected, measured) : null;
        const reach = this.#reach(selected);

        const cells = BANDS.map((key, index) => {
            const band = MGT2.ShipRangeBands[key];
            return {
                key, label: band.label,
                km: SpaceCombatScreen.bandKm(band),
                // Adjacent and Close carry null rather than zero: the book prints no DM for them at
                // all, and a dash is not a zero.
                noDM: band.attackDM === null,
                negative: band.attackDM < 0,
                dm: MGT2Helper.signed(band.attackDM ?? 0),
                thrust: band.thrust,
                here: key === here,
                out: (reach >= 0) && (index > reach),
                pins: others.filter(group => system.bandBetween(selected, group) === key)
                    .map(group => ({ id: group.id, name: group.name, measured: group.id === measured?.id }))
            };
        });

        const band = here ? MGT2.ShipRangeBands[here] : null;
        // Core folio 167: +1 for every full 1,000 tons of the TARGET, to a maximum of DM+6. A
        // 200-ton trader scores nothing, and printing +0 would hide that the ladder paid nothing.
        const tons = measured?.system.ship?.system.hull.tons ?? 0;
        const sizeDM = Math.min(6, Math.floor(tons / 1000));
        const unplaced = others.filter(group => system.bandBetween(selected, group) === null)
            .map(group => group.name);
        return {
            from: selected ? { id: selected.id, name: selected.name } : null,
            to: measured ? { id: measured.id, name: measured.name } : null,
            unplaced: unplaced.length ? unplaced.join(", ") : null,
            km: SpaceCombatScreen.#reading(band, this.#km),
            band: here, bandLabel: band?.label ?? null,
            noDM: !band || (band.attackDM === null),
            dm: MGT2Helper.signed(band?.attackDM ?? 0),
            thrust: band?.thrust ?? null,
            dogfight: band?.dogfight === true,
            sizeDM, sizeDisplay: MGT2Helper.signed(sizeDM),
            cells
        };
    }

    /** The furthest band this ship can shoot into, or −1 when no mounted weapon declares one. */
    #reach(group) {
        const ship = group?.system.ship;
        if ( !ship ) return -1;
        const mounted = new Set(ship.system.mounts.flatMap(mount => mount.weapons));
        let reach = -1;
        for ( const id of mounted ) {
            const band = ship.items.get(id)?.system.range?.band;
            if ( band ) reach = Math.max(reach, BANDS.indexOf(band));
        }
        return reach;
    }

    /** Public because the fleet strip prints the same seven bands from the same table. */
    static bandKm(band) {
        const say = (key, data) => game.i18n.format(`MGT2.SpaceCombat.${key}`, data);
        const number = value => value.toLocaleString(game.i18n.lang);
        if ( band.maxKm === null ) return say("BandOver", { min: number(band.minKm - 1) });
        if ( !band.minKm ) return say("BandUpTo", { max: number(band.maxKm) });
        return say("BandRange", { min: number(band.minKm), max: number(band.maxKm) });
    }

    /** A contact moved to a band has to land somewhere inside it, and the middle is the only choice. */
    static #midpoint(band) {
        if ( !band ) return 0;
        return (band.maxKm === null) ? band.minKm * 2 : Math.round((band.minKm + band.maxKm) / 2);
    }

    /** What the kilometre field shows. */
    static #reading(band, typed) {
        if ( !band ) return 0;
        const inside = (typed !== null) && (typed >= band.minKm)
            && ((band.maxKm === null) || (typed <= band.maxKm));
        return inside ? typed : SpaceCombatScreen.#midpoint(band);
    }

    #orderRow(group, selected) {
        const ship = group.system.ship;
        return {
            id: group.id, name: group.name,
            initiative: group.initiative,
            hasInitiative: Number.isFinite(group.initiative),
            tons: ship?.system.hull.tons ?? 0,
            thrust: group.system.available,
            selected: group.id === selected?.id,
            // Core folio 164: every ship takes a step before any ship takes the next, so the row
            // says which of the three this one has got through rather than whose turn it is.
            steps: STEPS.map(key => ({
                key, label: MGT2.CombatSteps[key], done: group.system.resolved.has(key)
            }))
        };
    }

    /** One ship's panel. */
    #panel(group) {
        if ( !group ) return null;
        const ship = group.system.ship;
        if ( !ship ) return { id: group.id, name: group.name, owned: false, shipless: true };

        const system = ship.system;
        const owned = ship.isOwner;
        const panel = {
            id: group.id, name: ship.name, owned, shipless: false,
            shipClass: system.hull.shipClass, tons: system.hull.tons,
            hull: { value: system.characteristics.hull.value, max: system.characteristics.hull.max },
            hurt: system.characteristics.hull.damage > 0,
            armour: system.protection,
            thrust: { now: system.drives.effectiveThrust, max: system.drives.thrust },
            power: { available: system.power.available, plant: system.power.plant },
            initiative: group.initiative,
            hasInitiative: Number.isFinite(group.initiative),
            controlDM: system.criticalEffects.controlDM,
            controlDisplay: MGT2Helper.signed(system.criticalEffects.controlDM),
            sensors: MGT2.SensorGrades[system.sensors.grade]?.label ?? "",
            aboard: system.crewTotals.aboard,
            tacticsEffect: group.system.tacticsEffect,
            initiativeFormula: group.system.initiativeFormula
        };
        if ( !owned ) return panel;

        panel.thrustBudget = SpaceCombatScreen.#thrustBudget(group);
        panel.closing = this.#closing(group);
        panel.held = group.system.held;
        panel.crew = this.#crew(group);
        panel.reactions = this.#reactions(group);
        panel.issues = group.system.dutyIssues;
        panel.salvoes = this.#salvoes(group);
        panel.launch = this.#launch(group);
        return panel;
    }

    /**
     * Core folios 172-173: every flight this ship fired or is under, with the two countermeasures
     * that thin it and the impact that ends it.
     */
    #salvoes(group) {
        const rows = [];
        for ( const combatant of this.#combat.missileSalvoes ) {
            const salvo = combatant.system;
            const incoming = salvo.target === group.id;
            if ( !incoming && (salvo.firedBy !== group.id) ) continue;
            const other = incoming ? salvo.shooterGroup : salvo.targetGroup;
            rows.push({
                id: combatant.id, name: combatant.name, incoming,
                other: other?.name ?? null,
                count: salvo.count, remaining: salvo.remaining, eliminated: salvo.eliminated,
                roundsLeft: salvo.roundsLeft, arriving: salvo.arriving, inert: salvo.inert,
                bandLabel: MGT2.ShipRangeBands[salvo.launchBand]?.label ?? "",
                jammed: salvo.jammedRound === this.#combat.round,
                smart: salvo.smart
            });
        }
        return rows;
    }

    /** What this ship can put in the air: its mounted missiles, and the contacts to aim them at. */
    #launch(group) {
        const ship = group.system.ship;
        const mounted = new Set(ship.system.mounts.flatMap(mount => mount.weapons));
        const missiles = [...mounted].map(id => ship.items.get(id))
            .filter(weapon => MGT2Helper.isMissileWeapon(weapon))
            .map(weapon => ({ id: weapon.id, name: weapon.name }));
        return {
            missiles,
            targets: this.ships.filter(other => other.id !== group.id)
                .map(other => ({ id: other.id, name: other.name }))
        };
    }

    /**
     * Core folio 165: the pilot splits Thrust between movement and combat manoeuvring, and the book
     * prints no closed list of manoeuvres — so a row is whatever the pilot called it plus the
     * points behind it, and only the rows flagged `movement` buy range.
     */
    static #thrustBudget(group) {
        const cap = group.system.available;
        const rows = group.system.thrust.spent.map((row, index) => ({
            index, label: row.label, value: row.points, movement: row.movement
        }));
        const total = group.system.allocated;
        return {
            rows, total, cap, over: total > cap,
            fill: cap > 0 ? Math.min(100, (total / cap) * 100) : 0,
            mark: total > cap ? 100 : (cap > 0 ? Math.min(100, (total / cap) * 100) : 0),
            remaining: Math.abs(cap - total)
        };
    }

    /** The bank. */
    #closing(group) {
        const cost = group.system.cost;
        const banked = group.system.thrust.banked;
        const opponent = group.system.opponent;
        const wanted = group.system.thrust.target.band;
        return {
            rows: [], total: banked, cap: cost, over: (cost > 0) && (banked >= cost),
            fill: cost > 0 ? Math.min(100, (banked / cost) * 100) : 0,
            mark: cost > 0 ? Math.min(100, (banked / cost) * 100) : 0,
            // Under the cap the reading is the shortfall; over it, the change is paid for and the
            // remainder is what carries into the next one.
            remaining: (banked < cost) ? group.system.shortfall : (banked - cost),
            from: group.system.currentBand ? MGT2.ShipRangeBands[group.system.currentBand].label : null,
            to: wanted ? MGT2.ShipRangeBands[wanted].label : null,
            opponent: opponent?.name ?? null,
            rate: group.system.closingRate,
            targets: this.ships.filter(other => other.id !== group.id).map(other => ({
                id: other.id, name: other.name, selected: other.id === group.system.thrust.target.group
            })),
            bands: BANDS.map(key => ({
                key, label: MGT2.ShipRangeBands[key].label, selected: key === wanted
            }))
        };
    }

    /** The roster, filtered by the step. */
    #crew(group) {
        const step = this.#combat.system.step;
        return group.system.crew.map(combatant => {
            const role = combatant.system.role
                ? group.system.ship.items.get(combatant.system.role) : null;
            const actor = combatant.actor;
            const spent = combatant.system.spent.action;
            return {
                id: combatant.id,
                station: role?.name ?? "",
                department: role ? MGT2.Departments[role.system.department] : "",
                name: actor?.name || combatant.name,
                uuid: actor?.uuid ?? null,
                vacant: !actor && !combatant.name,
                duty: combatant.system.duty,
                dutyLabel: MGT2.CombatDuties[combatant.system.duty]?.label ?? "",
                mount: combatant.system.mount, needsMount: combatant.system.needsMount,
                unmounted: combatant.system.unmounted,
                duties: Object.entries(MGT2.CombatDuties).map(([key, duty]) => ({
                    key, label: duty.label, selected: key === combatant.system.duty
                })),
                spent,
                actions: (role?.system.actions ?? [])
                    .map((action, index) => ({ ...action, index }))
                    .filter(action => action.step === step)
                    .map(action => ({
                        index: action.index, label: action.label, skill: action.skill,
                        target: action.difficulty
                            ? MGT2Helper.getDifficultyValue(action.difficulty) : null,
                        // A `skill` action needs a sheet to read the level off; a `special` one is
                        // the referee's call and is offered on a vacant slot too.
                        disabled: spent || ((action.kind !== "special") && !actor)
                    }))
            };
        });
    }

    /** Reactions are not a step. */
    #reactions(group) {
        const rows = [];
        for ( const combatant of group.system.crew ) {
            const role = combatant.system.role
                ? group.system.ship.items.get(combatant.system.role) : null;
            (role?.system.actions ?? []).forEach((action, index) => {
                if ( action.step !== "reaction" ) return;
                rows.push({
                    combatantId: combatant.id, index,
                    label: action.label,
                    by: combatant.actor?.name || combatant.name,
                    duty: MGT2.CombatDuties[combatant.system.duty]?.label ?? "",
                    cap: (action.cap && (action.cap !== "none")) ? MGT2.ActionCaps[action.cap] : null,
                    // The stored handle is the action's index in its own station's role, never its
                    // label: a label is user text, in whatever language the world runs in.
                    spent: combatant.system.spent.reactions.includes(String(index))
                });
            });
        }
        return rows;
    }

    /** The frame outlives every re-render, so these bind once. @inheritDoc */
    _attachFrameListeners() {
        super._attachFrameListeners();
        this.element.addEventListener("change", this.#onChangeInput.bind(this));
        this.element.addEventListener("dragover", this.#onDragOver.bind(this));
        this.element.addEventListener("dragleave", this.#onDragLeave.bind(this));
        this.element.addEventListener("drop", this.#onDrop.bind(this));
    }

    /**
     * Three documents take writes from this screen and a form cannot bind to three, so the change
     * is routed by what the control names rather than submitted.
     */
    async #onChangeInput(event) {
        const input = event.target;
        if ( !this.canEdit ) return;
        const group = this.#groupOf(input);
        switch ( input.name ) {
            case "km": return this.#onTypeDistance(input);
            case "step": return this.#combat.update({ system: { step: input.value } });
            case "tacticsEffect":
                return group?.update({ system: { tacticsEffect: Number(input.value) || 0 } });
            case "closingTarget":
                return group?.update({ system: { thrust: { target: { group: input.value || null } } } });
            case "closingBand":
                return group?.update({ system: { thrust: { target: { band: input.value } } } });
            case "banked":
                return group?.update({ system: { thrust: { banked: Number(input.value) || 0 } } });
            case "duty": {
                const combatant = this.#combat.combatants.get(input.dataset.combatantId);
                return combatant?.update({ system: { duty: input.value } });
            }
            case "mount": {
                const combatant = this.#combat.combatants.get(input.dataset.combatantId);
                return combatant?.update({ system: { dutyTarget: input.value } });
            }
            default: if ( input.dataset.thrustRow ) return this.#onEditThrustRow(input, group);
        }
    }

    /** Core folio 165's table read backwards, for a referee who would rather type a distance. */
    async #onTypeDistance(input) {
        const km = Math.max(0, Number(input.value) || 0);
        const { selected, measured } = this;
        if ( !selected || !measured ) return;
        this.#km = km;
        return this.#combat.system.setBand(selected, measured, SpaceCombatData.bandForKm(km));
    }

    /** A row rewrites the whole array, so the other rows are carried over unchanged. */
    async #onEditThrustRow(input, group) {
        if ( !group ) return;
        const index = Number(input.dataset.thrustRow);
        const rows = group.system.thrust.spent.map(row => ({ ...row }));
        if ( !rows[index] ) return;
        const field = input.dataset.thrustField;
        rows[index][field] = (field === "points") ? Math.max(0, Number(input.value) || 0)
            : (field === "movement") ? input.checked : input.value;
        return group.update({ system: { thrust: { spent: rows } } });
    }

    #groupOf(element) {
        const id = element.closest("[data-group-id]")?.dataset.groupId;
        return id ? this.#combat.groups.get(id) : null;
    }

    /**
     * A zone declares what it takes in `data-accept` and refuses everything else AT THE POINTER,
     * which is the only place a refusal is any use.
     */
    #onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        this.#clearDropState(zone);
        if ( !zone ) return;
        if ( MGT2Helper.dropAccepted(zone) ) {
            event.preventDefault();
            zone.classList.add("over");
        }
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
     * Two drops, because they write two different documents: a ship dropped on a BAND joins the
     * fight at that range and writes the Combat, a person dropped on the ROSTER takes a station and
     * writes the ship's own crew row.
     */
    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        this.#clearDropState();
        const data = MGT2Helper.getDataFromDropEvent(event);
        if ( !zone || !MGT2Helper.dropAccepted(zone, data) ) return;
        event.preventDefault();
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        if ( !actor ) return;
        if ( zone.dataset.band ) return this.#dropShip(actor, zone.dataset.band);
        return this.#dropCrew(actor, zone.closest("[data-combatant-id]"));
    }

    /**
     * Dropping a ship sets its range in the same gesture: a contact has to arrive somewhere and the
     * band IS the state, so the cell answers it.
     */
    async #dropShip(actor, band) {
        if ( !this.canEdit ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.SpaceCombat.NoPermission"));
        }
        const selected = this.selected;
        const existing = this.ships.find(group => group.system.ship?.id === actor.id);
        if ( existing ) {
            if ( !selected || (existing.id === selected.id) ) return;
            this.#measuredId = existing.id;
            this.#km = null;
            return this.#combat.system.setBand(selected, existing, band);
        }
        const group = await this.#combat.addShip(actor, { band, relativeTo: selected ?? undefined });
        if ( !group ) return;
        // The strip is read from the ship that was already there, so the new contact is what the
        // kilometre readout now measures — the drop answered exactly that question.
        if ( selected ) this.#measuredId = group.id;
        else this.#selectedId = group.id;
        this.#km = null;
        return this.render();
    }

    /**
     * A person dropped on a station writes `crew[i].actor` on the SPACECRAFT, because that is where
     * a crew roster belongs — a ship has a crew when no combat is running.
     */
    async #dropCrew(actor, row) {
        const group = this.selected;
        const ship = group?.system.ship;
        if ( !ship?.isOwner || !this.canEdit ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.SpaceCombat.NoPermission"));
        }
        const combatant = row ? this.#combat.combatants.get(row.dataset.combatantId) : null;
        const crew = ship.system.crew.map(station => ({ ...station }));
        // The row the Combatant already names.
        const index = combatant?.system.station ?? -1;

        if ( crew[index] ) crew[index].actor = actor.uuid;
        else crew.push({ actor: actor.uuid, name: actor.name });
        await ship.update({ "system.crew": crew });

        if ( combatant ) {
            return combatant.update({ actorId: actor.id, name: actor.name, img: actor.img });
        }
        // The push above gave them a roster row, so the new Combatant names it: without a station
        // there is no `role`, and a crew member with no role has no actions to take.
        return this.#combat.createEmbeddedDocuments("Combatant", [{
            type: CREW, group: group.id, actorId: actor.id, name: actor.name, img: actor.img,
            system: { station: crew.length - 1 }
        }]);
    }

    /** @this {SpaceCombatScreen} */
    static #onSelectShip(event, target) {
        this.#selectedId = target.closest("[data-group-id]").dataset.groupId;
        this.#measuredId = null;
        this.#km = null;
        return this.render();
    }

    /** @this {SpaceCombatScreen} */
    static #onMeasureTo(event, target) {
        this.#measuredId = target.closest("[data-group-id]").dataset.groupId;
        this.#km = null;
        return this.render();
    }

    /** Clicking a cell moves the pinned contact, which is the only way a band changes here. */
    static async #onSetBand(event, target) {
        const { selected, measured } = this;
        if ( !selected || !measured ) return;
        this.#km = null;
        return this.#combat.system.setBand(selected, measured, target.dataset.band);
    }

    /** @this {SpaceCombatScreen} */
    static async #onToggleResolved(event, target) {
        const group = this.#combat.groups.get(target.closest("[data-group-id]").dataset.groupId);
        return group?.system.toggleResolved(target.dataset.step);
    }

    /** @this {SpaceCombatScreen} */
    static async #onRollInitiative(event, target) {
        const group = this.#combat.groups.get(target.closest("[data-group-id]").dataset.groupId);
        return group?.rollInitiative();
    }

    /** @this {SpaceCombatScreen} */
    static async #onEndRound() {
        return this.#combat.nextRound();
    }

    /** @this {SpaceCombatScreen} */
    static async #onRemoveShip(event, target) {
        const group = this.#combat.groups.get(target.closest("[data-group-id]").dataset.groupId);
        if ( !group ) return;
        const confirmed = await DialogV2.confirm({
            window: { title: "MGT2.SpaceCombat.RemoveShip" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.SpaceCombat.RemoveShipHint", { name: group.name })}</p>`
        });
        if ( !confirmed ) return;
        if ( group.id === this.#selectedId ) this.#selectedId = null;
        return this.#combat.removeShip(group);
    }

    /** @this {SpaceCombatScreen} */
    static async #onThrustCreate(event, target) {
        const group = this.#combat.groups.get(target.closest("[data-group-id]").dataset.groupId);
        if ( !group ) return;
        const rows = group.system.thrust.spent.map(row => ({ ...row }));
        return group.update({ system: { thrust: { spent: [...rows, {}] } } });
    }

    /** @this {SpaceCombatScreen} */
    static async #onThrustDelete(event, target) {
        const group = this.#combat.groups.get(target.closest("[data-group-id]").dataset.groupId);
        const index = Number(target.closest("[data-thrust-index]").dataset.thrustIndex);
        if ( !group ) return;
        const rows = group.system.thrust.spent.map(row => ({ ...row })).filter((_row, i) => i !== index);
        return group.update({ system: { thrust: { spent: rows } } });
    }

    /** The same roll the ship's own roster makes, with the encounter's mount rather than the standing one. */
    static async #onStationAction(event, target) {
        const combatant = this.#combat.combatants.get(target.closest("[data-combatant-id]").dataset.combatantId);
        const ship = combatant?.system.ship;
        const action = ship?.items.get(combatant.system.role)
            ?.system.actions[Number(target.dataset.actionIndex)];
        if ( !action ) return;
        return SpacecraftActorSheet.rollStationAction(ship, action,
            { crew: combatant.actor, dutyTarget: combatant.system.mount });
    }

    /** Core folio 171: one action each in the Actions Step. The tick is the referee's, not the roll's. */
    static async #onToggleSpent(event, target) {
        const combatant = this.#combat.combatants.get(target.closest("[data-combatant-id]").dataset.combatantId);
        if ( !combatant ) return;
        return combatant.update({ system: { spent: { action: !combatant.system.spent.action } } });
    }

    /** @this {SpaceCombatScreen} */
    static async #onToggleReaction(event, target) {
        const combatant = this.#combat.combatants.get(target.closest("[data-combatant-id]").dataset.combatantId);
        if ( !combatant ) return;
        const key = target.dataset.actionIndex;
        const taken = combatant.system.spent.reactions.filter(entry => entry !== key);
        if ( taken.length === combatant.system.spent.reactions.length ) taken.push(key);
        return combatant.update({ system: { spent: { reactions: taken } } });
    }

    /** Core folio 172: one salvo is everything one ship fires at one target in one round. */
    static async #onLaunchSalvo(event, target) {
        const group = this.selected;
        const form = target.closest("[data-salvo-form]");
        const at = this.#combat.groups.get(form.querySelector('[name="salvoTarget"]').value);
        if ( !group || !at ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.SpaceCombat.SalvoNeedsTarget"));
        }
        const salvo = await this.#combat.addSalvo(group, at, {
            weapon: form.querySelector('[name="salvoWeapon"]').value,
            count: MGT2Helper.getIntegerFromInput(form.querySelector('[name="salvoCount"]').value)
        });
        return salvo ? this.render() : null;
    }

    #salvoOf(target) {
        const row = target.closest("[data-salvo-id]");
        return row ? this.#combat.combatants.get(row.dataset.salvoId) : null;
    }

    /** What the referee typed beside the row: the Effect of the check that was already rolled. */
    static #salvoEffect(target) {
        const row = target.closest("[data-salvo-id]");
        return MGT2Helper.getIntegerFromInput(row?.querySelector('[name="salvoEffect"]')?.value);
    }

    /** @this {SpaceCombatScreen} */
    static async #onSalvoJam(event, target) {
        const salvo = this.#salvoOf(target);
        return salvo?.system.jam(SpaceCombatScreen.#salvoEffect(target));
    }

    /** Core folio 171: the Effect of the gunner's check removes that many missiles. */
    static async #onSalvoDefend(event, target) {
        const salvo = this.#salvoOf(target);
        return salvo?.system.remove(SpaceCombatScreen.#salvoEffect(target));
    }

    /** @this {SpaceCombatScreen} */
    static async #onSalvoImpact(event, target) {
        const salvo = this.#salvoOf(target);
        return salvo?.system.attack();
    }

    /** @this {SpaceCombatScreen} */
    static async #onSalvoRemove(event, target) {
        const salvo = this.#salvoOf(target);
        return salvo?.delete();
    }

    /** The link is a stored uuid and nothing here reads the canvas. @this {SpaceCombatScreen} */
    static async #onOpenActor(event, target) {
        const linked = await fromUuid(target.closest("[data-uuid]")?.dataset.uuid ?? "");
        return linked?.sheet?.render(true);
    }
}

/**
 * Two surfaces, because the tracker's two context menus have different audiences: the encounter
 * menu is built only for the GM, and a player whose ship is in the fight still has to be able to
 * open the screen.
 */
export function registerSpaceCombatScreen() {
    Hooks.on("getCombatContextOptions", (application, options) => {
        options.unshift({
            label: "MGT2.SpaceCombat.Create",
            icon: '<i class="fa-solid fa-rocket-launch"></i>',
            visible: () => game.user.isGM,
            onClick: async () => {
                const combat = await Combat.implementation.create({ type: SPACE });
                await combat.activate({ render: false });
                return SpaceCombatScreen.open(combat);
            }
        }, {
            label: "MGT2.SpaceCombat.Open",
            icon: '<i class="fa-solid fa-table-columns"></i>',
            visible: () => application.viewed?.type === SPACE,
            onClick: () => SpaceCombatScreen.open(application.viewed)
        });
    });

    Hooks.on("getCombatTrackerContextOptions", (application, options) => {
        options.push({
            label: "MGT2.SpaceCombat.Open",
            icon: '<i class="fa-solid fa-table-columns"></i>',
            visible: () => application.viewed?.type === SPACE,
            onClick: () => SpaceCombatScreen.open(application.viewed)
        });
    });
}
