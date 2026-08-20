import { MGT2 } from "./config.js";
import { STEPS } from "./combat.js";
import { FLEET, FLEET_SHIP, SALVO, SQUADRON, chartBand, chartCode } from "./fleet.js";
import { FleetAttack, fleetBatteries } from "./fleet-attack.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";
import { SpaceCombatScreen } from "./combat-screen.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PARTS_PATH = "systems/mgt2/templates/fleet";

/** A hull dropped on a fleet joins it; nothing else on this screen takes a drop. */
const SHIP_TYPES = "Actor.spacecraft";

/** The seven bands closest first — the order folio 115 prints, which is also the strip. */
const BANDS = Object.freeze(Object.keys(MGT2.ShipRangeBands));

/** The four pools a `fleetShip` spends whose size does not depend on who is shooting (folio 113). */
const FLAT_POOLS = Object.freeze(["salvo", "meson", "damper", "repair"]);

/** Folio 119's three defensive pools, which reduce damage rather than removing missiles. */
const MITIGATORS = Object.freeze(["sand", "meson", "damper"]);

/** The chart drawn as folio 123 draws it: a hub for the fixed point and eight rings of equal width. */
const CHART_VIEW = Object.freeze({ centre: 210, hub: 16, edge: 200, size: 420 });

/**
 * The fleet battle screen (HG folios 105-124): the referee's surface for the second engine.
 * @extends {ApplicationV2}
 */
export class FleetCombatScreen extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options) {
        super(options);
        this.#combat = options.combat;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-fleet-combat-{id}",
        classes: ["mgt2", "fleet-combat", "nopad"],
        // 1240 x 840: the rail is 25rem because a fleet block carries five controls beside its
        // roster, and the panel's battery table wants seven columns at 12px before it wraps.
        position: { width: 1240, height: 840 },
        window: { resizable: true, icon: "fa-solid fa-chess-rook" },
        actions: {
            selectFleet: FleetCombatScreen.#onSelectFleet,
            selectContact: FleetCombatScreen.#onSelectContact,
            measureTo: FleetCombatScreen.#onMeasureTo,
            setBand: FleetCombatScreen.#onSetBand,
            rollFleet: FleetCombatScreen.#onRollFleet,
            rollShips: FleetCombatScreen.#onRollShips,
            advanceStep: FleetCombatScreen.#onAdvanceStep,
            endRound: FleetCombatScreen.#onEndRound,
            addFleet: FleetCombatScreen.#onAddFleet,
            removeFleet: FleetCombatScreen.#onRemoveFleet,
            removeContact: FleetCombatScreen.#onRemoveContact,
            setFlag: FleetCombatScreen.#onSetFlag,
            moraleCheck: FleetCombatScreen.#onMoraleCheck,
            toggleReserve: FleetCombatScreen.#onToggleReserve,
            expose: FleetCombatScreen.#onExpose,
            spend: FleetCombatScreen.#onSpend,
            repair: FleetCombatScreen.#onRepair,
            fire: FleetCombatScreen.#onFire,
            launchSalvo: FleetCombatScreen.#onLaunchSalvo,
            intercept: FleetCombatScreen.#onIntercept,
            impact: FleetCombatScreen.#onImpact,
            applyDamage: FleetCombatScreen.#onApplyDamage,
            clearAttack: FleetCombatScreen.#onClearAttack,
            detach: FleetCombatScreen.#onDetach,
            openChart: FleetCombatScreen.#onOpenChart,
            openActor: FleetCombatScreen.#onOpenActor
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/header.html` },
        // A partial a part references has to be declared beside it: `ApplicationV2` preloads only
        // what `PARTS` names, and an undeclared one throws at render rather than at load.
        rail: {
            template: `${PARTS_PATH}/rail.html`,
            templates: ["systems/mgt2/templates/actors/spacecraft/budget.html"],
            scrollable: [""]
        },
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

    /** Which fleet the strip is read FROM. */
    #fleetId = null;

    /** Which other fleet the band cell edits — the pair the header is speaking about. */
    #measuredId = null;

    /** Which contact the panel shows. */
    #contactId = null;

    /** What the panel's batteries are firing at. */
    #targetId = null;

    /** How many of each battery the referee has declared this round (folio 117). */
    #firing = new Map();

    /** Folio 118's three riders that name a weapon by the words on its page. */
    #options = { ignoresArmour: false, armourPiercing: false, customised: false, effectiveness: false };

    /**
     * The attack last resolved on this client, held so `apply` can be a separate gesture.
     * @type {object|null}
     */
    #attack = null;

    /** @type {{pool: string, points: number}} */
    #mitigate = { pool: "", points: 0 };

    get canEdit() {
        return this.#combat.canUserModify(game.user, "update", { system: {} });
    }

    /** An encounter is created unnamed and core never gives it one, so the type label stands alone. */
    get title() {
        const label = game.i18n.localize("TYPES.Combat.fleet");
        return this.#combat.name ? `${label}: ${this.#combat.name}` : label;
    }

    /** One screen per encounter: a second window would select two different fleets in one battle. */
    static open(combat) {
        if ( combat?.type !== FLEET ) return null;
        const existing = foundry.applications.instances.get(`mgt2-fleet-combat-${combat.id}`);
        return (existing ?? new FleetCombatScreen({ combat })).render({ force: true });
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

    /** Every fleet, highest Initiative first — folio 115 resolves all three steps in that order. */
    get fleets() {
        return this.#combat.system.fleets
            .sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
    }

    get selectedFleet() {
        const fleets = this.fleets;
        return fleets.find(group => group.id === this.#fleetId)
            ?? fleets.find(group => group.isOwner) ?? fleets[0] ?? null;
    }

    /** The fleet the band cell moves: another one, never this one. */
    get measuredFleet() {
        const others = this.fleets.filter(group => group.id !== this.selectedFleet?.id);
        return others.find(group => group.id === this.#measuredId) ?? others[0] ?? null;
    }

    get selectedContact() {
        const fleet = this.selectedFleet;
        const contacts = fleet?.system.combatants ?? [];
        return contacts.find(one => one.id === this.#contactId) ?? contacts[0] ?? null;
    }

    /** Folio 117: targets are declared before firing, and never inside one's own fleet. */
    get targets() {
        const fleet = this.selectedFleet;
        return this.#combat.system.fighting.filter(one => one._source.group !== fleet?.id);
    }

    get target() {
        const targets = this.targets;
        return targets.find(one => one.id === this.#targetId) ?? targets[0] ?? null;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const combat = this.#combat;
        const fleet = this.selectedFleet;

        context.canEdit = this.canEdit;
        context.enabled = combat.system.enabled;
        context.chart = combat.system.chart;
        context.round = combat.round;
        context.step = combat.system.step;
        context.stepLabel = MGT2.CombatSteps[combat.system.step];
        context.steps = STEPS.map(key => ({
            key, label: MGT2.CombatSteps[key], active: key === combat.system.step
        }));
        context.strip = this.#strip(fleet);
        context.fleets = this.fleets.map(group => this.#fleetRow(group, fleet));
        // The command block is one fleet's and is rendered outside the roster loop: nesting it
        // would put every control three `..` frames deep and bind half of them to the wrong fleet.
        context.fleet = context.fleets.find(row => row.selected) ?? null;
        context.morale = this.#morale(fleet);
        context.panel = this.#panel(this.selectedContact);
        context.attack = this.#attackContext();
        context.shipTypes = SHIP_TYPES;
        return context;
    }

    /** The strip, read from one fleet outwards. */
    #strip(fleet) {
        const system = this.#combat.system;
        const others = this.fleets.filter(group => group.id !== fleet?.id);
        const measured = this.measuredFleet;
        const here = (fleet && measured) ? system.bandBetween(fleet, measured) : null;

        const cells = BANDS.map(key => {
            const band = MGT2.ShipRangeBands[key];
            return {
                key, label: band.label,
                km: SpaceCombatScreen.bandKm(band),
                // Adjacent and Close carry null rather than zero: folio 118 prints no DM for them.
                noDM: band.attackDM === null,
                negative: band.attackDM < 0,
                dm: MGT2Helper.signed(band.attackDM ?? 0),
                thrust: band.thrust,
                here: key === here,
                pins: others.filter(group => system.bandBetween(fleet, group) === key)
                    .map(group => ({ id: group.id, name: group.name, measured: group.id === measured?.id }))
            };
        });

        const band = here ? MGT2.ShipRangeBands[here] : null;
        const unplaced = others.filter(group => system.bandBetween(fleet, group) === null)
            .map(group => group.name);
        return {
            from: fleet ? { id: fleet.id, name: fleet.name } : null,
            to: measured ? { id: measured.id, name: measured.name } : null,
            unplaced: unplaced.length ? unplaced.join(", ") : null,
            band: here, bandLabel: band?.label ?? null,
            noDM: !band || (band.attackDM === null),
            dm: MGT2Helper.signed(band?.attackDM ?? 0),
            thrust: band?.thrust ?? null,
            cells
        };
    }

    /** One fleet: the command block folio 106's Fleet Sheet prints, plus its roster. */
    #fleetRow(group, selected) {
        const system = group.system;
        const strength = system.strength;
        const opposing = system.opposing;
        return {
            id: group.id, name: group.name, img: group.img,
            code: chartCode(system.position),
            selected: group.id === selected?.id,
            // `CombatantGroup` has its own ownership field, so a player commanding one fleet writes
            // its Tactics, its formation and its Morale without being able to touch the encounter.
            editable: this.canEdit || group.isOwner,
            owned: group.isOwner,
            initiative: group.initiative,
            hasInitiative: Number.isFinite(group.initiative),
            mode: game.i18n.localize(`MGT2.Fleet.Mode.${system.mode}`),
            formula: system.initiativeFormula,
            crewSkill: system.crewSkill,
            offensiveDM: MGT2Helper.signed(system.offensiveDM),
            thrust: system.thrust,
            thrustOverride: system.thrustOverride,
            thrustDerived: system.thrustDerived,
            tacticsEffect: system.tacticsEffect,
            morale: system.morale,
            formation: system.formation,
            formationLabel: MGT2.ShipRangeBands[system.formation]?.label ?? "",
            formationDM: system.formationDM,
            dispersing: system.dispersing,
            scattered: system.scattered,
            mustDisperse: system.mustDisperse,
            terrain: system.terrain,
            terrainDM: system.terrainDM(),
            breakingOff: system.breakingOff,
            dispersal: system.dispersal,
            dispersalDM: system.dispersalDM,
            flagship: system.flagShip
                ? { id: system.flagShip.id, name: system.flagShip.name } : null,
            flagShipDM: system.flagShipDM,
            strength,
            lostPercent: Math.round(strength.fraction * 100),
            opposing: opposing ? { id: opposing.id, name: opposing.name } : null,
            // Folio 116's bank, which is the pair's progress and not this fleet's allocation.
            movement: system.movement,
            closingRate: system.closingRate,
            cost: system.cost,
            shortfall: system.shortfall,
            closing: FleetCombatScreen.#gauge(system.movement.banked, system.cost, system.shortfall),
            held: system.held,
            currentBand: system.currentBand ? MGT2.ShipRangeBands[system.currentBand].label : null,
            bands: BANDS.map(key => ({
                key, label: MGT2.ShipRangeBands[key].label,
                selected: key === system.movement.target.band
            })),
            formations: BANDS.map(key => ({
                key, label: MGT2.ShipRangeBands[key].label, selected: key === system.formation
            })),
            targets: this.fleets.filter(other => other.id !== group.id).map(other => ({
                id: other.id, name: other.name, selected: other.id === system.movement.target.group
            })),
            contacts: system.combatants.map(one => this.#contactRow(one))
        };
    }

    /** The budget block's own shape: a total against a cap, with the bar computed and never authored. */
    static #gauge(total, cap, remaining) {
        const fill = cap > 0 ? Math.min(100, (total / cap) * 100) : 0;
        return { rows: [], total, cap, over: (cap > 0) && (total >= cap), fill, mark: fill,
            remaining: (total < cap) ? remaining : (total - cap) };
    }

    /** One line of the fleet's roster — a hull, a wing or a flight, whichever it is. */
    #contactRow(combatant) {
        const system = combatant.system;
        const row = {
            id: combatant.id, name: combatant.name, type: combatant.type,
            selected: combatant.id === this.selectedContact?.id,
            initiative: combatant.initiative,
            hasInitiative: Number.isFinite(combatant.initiative),
            eliminated: system.eliminated === true
        };
        if ( combatant.type === SALVO ) {
            row.sub = MGT2Helper.plural("MGT2.Fleet.Screen.SalvoLine", system.roundsLeft, {
                n: system.remaining, rounds: system.roundsLeft });
            row.arriving = system.arriving;
            return row;
        }
        if ( combatant.type === SQUADRON ) {
            row.sub = MGT2Helper.plural("MGT2.Fleet.Screen.WingLine", system.count, {
                n: system.hull.strength, of: system.count });
            return row;
        }
        row.sub = game.i18n.format("MGT2.Fleet.Screen.ShipLine", {
            hull: system.hull.remaining, armour: system.armour });
        row.reserve = system.reserve;
        row.flag = system.isFlagShip;
        return row;
    }

    /** Folio 122's Morale check, read off the battle rather than typed. */
    #morale(fleet) {
        if ( !fleet ) return null;
        const rows = fleet.system.moraleRows();
        return {
            rows: rows.map(([label, dm]) => ({ label, dm: MGT2Helper.signed(dm), zero: dm === 0 })),
            total: MGT2Helper.signed(rows.reduce((sum, [, dm]) => sum + dm, 0)),
            morale: fleet.system.morale
        };
    }

    /** The panel: whichever contact is selected, in the shape folios 107-114 print for its kind. */
    #panel(combatant) {
        if ( !combatant ) return null;
        const fleet = combatant.system.fleetGroup;
        const base = {
            id: combatant.id, name: combatant.name, type: combatant.type,
            // The panel's controls write the Combatant, and the fleet is what the change router
            // tests ownership against — so the block has to name it the way a rail block does.
            fleetId: fleet?.id ?? "",
            fleetName: fleet?.name ?? "",
            code: chartCode(combatant.system.position),
            editable: this.canEdit || (fleet?.isOwner === true)
        };
        if ( combatant.type === SALVO ) return { ...base, kind: "salvo", ...this.#salvoPanel(combatant) };
        if ( combatant.type === SQUADRON ) return { ...base, kind: "wing", ...this.#wingPanel(combatant) };
        return { ...base, kind: "ship", ...this.#shipPanel(combatant) };
    }

    /** Folios 107-113's Fleet Ship Sheet, every figure of it derived on the Actor. */
    #shipPanel(combatant) {
        const system = combatant.system;
        const stats = system.stats;
        const ship = system.ship;
        const target = this.target;
        const sand = system.sandcasterAgainst(target);
        return {
            uuid: ship?.uuid ?? null,
            shipClass: ship?.system.hull.shipClass ?? "",
            tons: ship?.system.hull.tons ?? 0,
            gated: !stats,
            reserve: system.reserve,
            isFlagShip: system.isFlagShip,
            canFlag: system.canFlag,
            spinalLocked: system.spinalLocked,
            radiation: system.radiation,
            radiationRow: system.radiationRow,
            disabled: system.disabled,
            crewSkill: system.crewSkill,
            crewSkillTyped: stats?.crewSkillTyped ?? 0,
            offensive: {
                standard: MGT2Helper.signed(system.offensive.standard),
                missile: MGT2Helper.signed(system.offensive.missile)
            },
            defensive: MGT2Helper.signed(system.defensive),
            defensiveAgainst: MGT2Helper.signed(
                system.defensiveAgainst(this.target?.system.fleetGroup ?? null)),
            armour: system.armour,
            autoRepair: system.autoRepair,
            thrust: system.thrust,
            jump: system.jump,
            hull: system.hull,
            traits: (stats?.traits ?? []).map(trait => trait.label),
            software: stats?.software ?? [],
            pools: FLAT_POOLS.map(key => ({ ...system.pools[key],
                label: `MGT2.Fleet.Pool.${key}` })),
            // Folio 119 makes the sandcaster pool a function of who is SHOOTING, and the panel is a
            // ship's own.
            sand: { ...sand, label: "MGT2.Fleet.Pool.sand", against: target?.name ?? null },
            criticals: Object.entries(ship?.system.criticals ?? {})
                .filter(([, severity]) => severity > 0)
                .map(([location, severity]) => ({
                    location, severity, label: MGT2.ShipCriticals[location]?.label ?? location })),
            batteries: this.#batteries(ship, combatant.id),
            warheads: Object.entries(MGT2.FleetWarheads).map(([key, entry]) => ({
                key, label: entry.label, torpedo: entry.torpedo === true }))
        };
    }

    /** Folio 114's Fighter Squadron Sheet: a wing is a contact treated much like an individual ship. */
    #wingPanel(combatant) {
        const system = combatant.system;
        return {
            uuid: system.fighter?.uuid ?? null,
            gated: !system.stats,
            tons: system.fighter?.system.hull.tons ?? 0,
            count: system.count,
            crewSkillOverride: system.crewSkillOverride,
            crewSkill: system.crewSkill,
            offensive: {
                standard: MGT2Helper.signed(system.offensive.standard),
                missile: MGT2Helper.signed(system.offensive.missile)
            },
            defensive: MGT2Helper.signed(system.defensive),
            defensiveAgainst: MGT2Helper.signed(
                system.defensiveAgainst(this.target?.system.fleetGroup ?? null)),
            armour: system.armour,
            thrust: system.thrust,
            hull: system.hull,
            batteries: this.#batteries(system.fighter, combatant.id),
            // Folio 107's sample squadron carries missile racks, so a wing launches salvoes like a
            // hull — what folio 114 denies it is the DEFENCES half, not the weapons.
            warheads: Object.entries(MGT2.FleetWarheads).map(([key, entry]) => ({
                key, label: entry.label, torpedo: entry.torpedo === true }))
        };
    }

    /** An Actorless flight, on folio 119's clock. */
    #salvoPanel(combatant) {
        const system = combatant.system;
        return {
            warhead: system.warhead,
            warheads: Object.entries(MGT2.FleetWarheads).map(([key, entry]) => ({
                key, label: entry.label, selected: key === system.warhead })),
            damage: system.damage,
            torpedo: system.torpedo,
            cost: system.cost,
            salvoPenalty: Math.round(system.salvoPenalty * 100),
            halvesDefensive: system.halvesDefensive,
            count: system.count,
            removed: system.removed,
            remaining: system.remaining,
            launchBand: MGT2.ShipRangeBands[system.launchBand]?.label ?? "",
            flightRounds: system.flightRounds,
            impactRound: system.impactRound,
            roundsLeft: system.roundsLeft,
            arriving: system.arriving,
            target: system.targetContact
                ? { id: system.targetContact.id, name: system.targetContact.name } : null,
            shooter: system.shooter?.name ?? null
        };
    }

    /** Folio 107's WEAPONS panel: `100 x Turrets (beam lasers)` on one line. */
    #batteries(actor, contactId) {
        return fleetBatteries(actor).map(row => {
            const key = `${contactId}|${row.mount}|${row.id}|${row.name}`;
            return {
                ...row, key,
                mountLabel: game.i18n.localize(row.mountLabel),
                bandLabel: row.band ? MGT2.ShipRangeBands[row.band]?.label : null,
                firing: Math.min(row.count, this.#firing.get(key) ?? row.count)
            };
        });
    }

    /**
     * The attack held on this client between resolving it and applying it, plus folio 119's three
     * mitigating pools — which are the defender's and are spent out of the defender's own ledger.
     */
    #attackContext() {
        const target = this.target;
        // The pair the attack was resolved between, not the dropdown's current value: this is the
        // ledger `applyDamage` charges. Folio 114 gives a wing no pools, and a salvo has none.
        const victim = this.#attack ? this.#combat.combatants.get(this.#attack.target.id) : target;
        const shooter = this.#attack
            ? this.#combat.combatants.get(this.#attack.attacker) : this.selectedContact;
        const context = {
            options: this.#options,
            targets: this.targets.map(one => ({
                id: one.id, name: one.name, selected: one.id === target?.id,
                fleet: one.system.fleetGroup?.name ?? "" })),
            target: target ? { id: target.id, name: target.name } : null,
            pools: (victim?.type === FLEET_SHIP)
                ? MITIGATORS.map(key => ({ key, label: `MGT2.Fleet.Pool.${key}`,
                    left: (key === "sand")
                        ? victim.system.sandcasterAgainst(shooter ?? null).left
                        : victim.system.pools[key].left })) : [],
            mitigate: this.#mitigate
        };
        if ( !this.#attack ) return context;
        return { ...context, last: this.#attack };
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
     * Four documents take writes from this screen and a form cannot bind to four, so the change is
     * routed by what the control names rather than submitted.
     */
    async #onChangeInput(event) {
        const input = event.target;
        const value = input.value;
        const number = () => Math.trunc(Number(value) || 0);

        // The client-side controls answer for everyone: they choose what the window is looking at
        // and what the referee is about to declare, and write no document.
        switch ( input.name ) {
            case "attackTarget":
                this.#targetId = value || null;
                return this.render();
            case "battery":
                this.#firing.set(input.dataset.battery, Math.max(0, number()));
                return this.render();
            case "attackOption":
                this.#options[input.dataset.option] = input.checked;
                return this.render();
            case "mitigatePool":
                this.#mitigate.pool = value;
                return this.render();
            case "mitigatePoints":
                this.#mitigate.points = Math.max(0, number());
                return this.render();
        }
        if ( !this.canEdit && !this.#fleetOf(input)?.isOwner ) return;

        const fleet = this.#fleetOf(input);
        const contact = this.#contactOf(input);
        switch ( input.name ) {
            case "step":
                return this.canEdit ? this.#combat.update({ system: { step: value } }) : null;
            case "tacticsEffect": return fleet?.system.setTactics(number());
            case "morale": return fleet?.system.setMorale(number());
            case "formation": return fleet?.update({ system: { formation: value } });
            case "thrustOverride":
                return fleet?.update({ system: { thrustOverride: value === "" ? null : number() } });
            case "allocate": return fleet?.system.allocate(number());
            case "closingTarget":
                return fleet?.system.allocate(fleet.system.movement.thrust, { group: value || null });
            case "closingBand":
                return fleet?.system.allocate(fleet.system.movement.thrust, { band: value });
            case "banked":
                return fleet?.update({ system: { movement: { banked: Math.max(0, number()) } } });
            case "terrain": return fleet?.update({ system: { terrain: input.checked } });
            case "breakingOff": return fleet?.update({ system: { breakingOff: input.checked } });
            case "dispersalEffect": return fleet?.system.applyDispersal(number());
            case "squadronCount":
                return contact?.update({ system: { count: Math.max(1, number()) } });
            case "crewSkillOverride":
                return contact?.update({
                    system: { crewSkillOverride: value === "" ? null : Math.max(0, number()) } });
            case "salvoWarhead": return contact?.update({ system: { warhead: value } });
            case "salvoCount":
                return contact?.update({ system: { count: Math.max(0, number()) } });
        }
    }

    #fleetOf(element) {
        const id = element.closest("[data-fleet-id]")?.dataset.fleetId;
        const group = id ? this.#combat.groups.get(id) : null;
        return (group?.type === FLEET) ? group : null;
    }

    #contactOf(element) {
        const id = element.closest("[data-combatant-id]")?.dataset.combatantId;
        return id ? this.#combat.combatants.get(id) : null;
    }

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
     * One document, two zones: a hull dropped on the LINE joins as a `fleetShip`, and one dropped
     * on the WINGS joins as a `squadron` of one — folio 114's count is edited in the panel, because
     * a drag cannot carry a number.
     */
    async #onDrop(event) {
        const zone = event.target.closest("[data-accept]");
        this.#clearDropState();
        const data = MGT2Helper.getDataFromDropEvent(event);
        if ( !zone || !MGT2Helper.dropAccepted(zone, data) ) return;
        event.preventDefault();
        if ( !this.canEdit ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.SpaceCombat.NoPermission"));
        }
        const actor = data.uuid ? await fromUuid(data.uuid) : null;
        const fleet = this.#fleetOf(zone);
        if ( !actor || !fleet ) return;

        const combatant = (zone.dataset.join === "wing")
            ? await this.#combat.system.addSquadron(actor, fleet)
            : await this.#combat.system.addShip(actor, fleet);
        if ( !combatant ) return;
        this.#fleetId = fleet.id;
        this.#contactId = combatant.id;
        return this.render();
    }

    /** @this {FleetCombatScreen} */
    static #onSelectFleet(event, target) {
        this.#fleetId = target.closest("[data-fleet-id]").dataset.fleetId;
        this.#measuredId = null;
        this.#contactId = null;
        this.#targetId = null;
        return this.render();
    }

    /** @this {FleetCombatScreen} */
    static #onSelectContact(event, target) {
        const row = target.closest("[data-combatant-id]");
        this.#contactId = row.dataset.combatantId;
        this.#fleetId = row.closest("[data-fleet-id]")?.dataset.fleetId ?? this.#fleetId;
        this.#attack = null;
        return this.render();
    }

    /** @this {FleetCombatScreen} */
    static #onMeasureTo(event, target) {
        this.#measuredId = target.closest("[data-fleet-id]").dataset.fleetId;
        return this.render();
    }

    /** Clicking a cell moves the pinned fleet, which is the only way a band changes here. */
    static async #onSetBand(event, target) {
        const from = this.selectedFleet;
        const to = this.measuredFleet;
        if ( !from || !to ) return;
        return this.#combat.system.setBand(from, to, target.dataset.band);
    }

    /** Folio 115's streamlined procedure: one roll for the fleet, which every member reads back. */
    static async #onRollFleet(event, target) {
        return this.#fleetOf(target)?.rollInitiative();
    }

    /** Folio 115's detailed procedure: one roll per ship, the fleet's own number cleared first. */
    static async #onRollShips(event, target) {
        return this.#fleetOf(target)?.system.rollShips();
    }

    /** @this {FleetCombatScreen} */
    static async #onAdvanceStep() {
        if ( !this.canEdit ) return;
        return this.#combat.system.advanceStep();
    }

    /** @this {FleetCombatScreen} */
    static async #onEndRound() {
        if ( !this.canEdit ) return;
        return this.#combat.nextRound();
    }

    /** @this {FleetCombatScreen} */
    static async #onAddFleet() {
        const group = await this.#combat.system.addFleet({});
        if ( !group ) return;
        this.#fleetId = group.id;
        return this.render();
    }

    /** @this {FleetCombatScreen} */
    static async #onRemoveFleet(event, target) {
        const fleet = this.#fleetOf(target);
        if ( !fleet ) return;
        const confirmed = await DialogV2.confirm({
            window: { title: "MGT2.Fleet.Screen.RemoveFleet" },
            classes: ["mgt2"],
            content: `<p>${MGT2Helper.plural("MGT2.Fleet.Screen.RemoveFleetHint",
                fleet.system.combatants.length,
                { name: fleet.name, count: fleet.system.combatants.length })}</p>`
        });
        if ( !confirmed ) return;
        if ( fleet.id === this.#fleetId ) this.#fleetId = null;
        return this.#combat.system.removeFleet(fleet);
    }

    /** @this {FleetCombatScreen} */
    static async #onRemoveContact(event, target) {
        const contact = this.#contactOf(target);
        if ( !contact ) return;
        if ( contact.id === this.#contactId ) this.#contactId = null;
        return contact.delete();
    }

    /** Folio 105: only a hull with a command bridge may fly the flag — `setFlagShip` refuses. */
    static async #onSetFlag(event, target) {
        const contact = this.#contactOf(target);
        const fleet = contact?.system.fleetGroup;
        if ( !fleet ) return;
        return fleet.system.setFlagShip(contact.system.isFlagShip ? null : contact);
    }

    /** @this {FleetCombatScreen} */
    static async #onMoraleCheck(event, target) {
        return this.#fleetOf(target)?.system.moraleCheck();
    }

    /** Folio 117: the reserve is part of the fleet and not part of the line. */
    static async #onToggleReserve(event, target) {
        const contact = this.#contactOf(target);
        if ( contact?.type !== FLEET_SHIP ) return;
        return contact.update({ system: { reserve: !contact.system.reserve } });
    }

    /** Folio 121: one exposure, counted per encounter and therefore on the Combatant. */
    static async #onExpose(event, target) {
        const contact = this.#contactOf(target);
        if ( contact?.type !== FLEET_SHIP ) return;
        return contact.system.expose(target.dataset.step === "down" ? -1 : 1);
    }

    /** Folio 113: the pools are spent per round and restored when it turns over. */
    static async #onSpend(event, target) {
        const contact = this.#contactOf(target);
        const key = target.dataset.pool;
        const points = Number(target.closest("[data-pool-row]")
            ?.querySelector("input[name='poolPoints']")?.value) || 0;
        if ( !contact || !points ) return;
        return contact.system.spend(key, points, (key === "sand") ? this.target : null);
    }

    /** Folio 121: Repair Points clear critical severities on a point-for-point basis. */
    static async #onRepair(event, target) {
        const contact = this.#contactOf(target);
        return contact?.system.repairCritical(target.dataset.location, 1);
    }

    /** Folio 118's three weapon types, one door each. */
    static async #onFire(event, target) {
        const attacker = this.selectedContact;
        const victim = this.target;
        if ( !attacker || !victim ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Fleet.Screen.NoTarget"));
        }
        const battery = this.#batteryOf(attacker, target.dataset.battery);
        if ( !battery ) return;
        const count = Math.max(1, Math.min(battery.count, this.#firing.get(battery.key) ?? battery.count));

        let result = null;
        if ( target.dataset.kind === "ion" ) {
            result = await FleetAttack.resolveIon({ attacker, target: victim, weapon: battery, count });
        }
        else if ( battery.spinal ) {
            // Folio 122: a fleet breaking off "may not use spinal mount weapons for the duration".
            if ( attacker.system.spinalLocked ) {
                return ui.notifications.warn(game.i18n.localize("MGT2.Fleet.Screen.SpinalLocked"));
            }
            result = await FleetAttack.resolveSpinal({
                attacker, target: victim, weapon: battery, ...this.#options });
        }
        else {
            result = await FleetAttack.resolveStandard({
                attacker, target: victim, weapon: battery, count, ...this.#options });
        }
        if ( !result ) return this.render();
        this.#attack = {
            weapon: battery.name, count, mount: battery.mount,
            kind: target.dataset.kind || (battery.spinal ? "spinal" : "standard"),
            attacker: attacker.id,
            target: { id: victim.id, name: victim.name },
            factor: result.factor ? MGT2Helper.signed(result.factor.total, "0") : null,
            multiple: result.factor?.multiple ?? null,
            damage: result.damage?.total ?? 0,
            impervious: result.damage?.impervious === true,
            hit: result.hit !== false,
            ion: result.result ?? null,
            rounds: result.rounds ?? null
        };
        this.#mitigate = { pool: "", points: 0 };
        return this.render();
    }

    #batteryOf(combatant, key) {
        const actor = (combatant.type === SQUADRON) ? combatant.system.fighter : combatant.system.ship;
        return this.#batteries(actor, combatant.id).find(row => row.key === key) ?? null;
    }

    /**
     * Folio 119's missile step, and this is the seam the two halves of the chapter meet at: the
     * flight is a Combatant and the damage is `FleetAttack.resolveMissiles`, which takes the
     * number of warheads that survived as its input.
     */
    static async #onImpact(event, target) {
        const salvo = this.#contactOf(target);
        const victim = salvo?.system.targetContact;
        if ( (salvo?.type !== SALVO) || !victim ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Fleet.Screen.NoSalvoTarget"));
        }
        // The SHOOTER, where it is still in the battle: folio 110 derives the missile Offensive DM
        // on the hull, and a salvo answering for itself carries none — a flight that outlives its
        // ship falls back to itself and scores 0, which is the same answer the printed three steps
        // give.
        const shooter = salvo.system.shooter ?? salvo;
        const result = await FleetAttack.resolveMissiles({
            attacker: shooter, target: victim, warhead: salvo.system.warhead,
            hits: salvo.system.remaining, band: salvo.system.launchBand,
            effectiveness: this.#options.effectiveness });
        if ( !result ) return;
        this.#attack = {
            weapon: salvo.name, count: result.hits, kind: "missile", mount: "",
            attacker: shooter.id,
            target: { id: victim.id, name: victim.name },
            factor: result.factor ? MGT2Helper.signed(result.factor.total, "0") : null,
            multiple: result.factor?.multiple ?? null,
            damage: result.total, impervious: false, hit: true, halved: result.halved
        };
        this.#mitigate = { pool: "", points: 0 };
        return this.render();
    }

    /** Folio 113: each point of Salvo Defence removes one missile, and a torpedo costs two. */
    static async #onIntercept(event, target) {
        const salvo = this.#contactOf(target);
        const defender = salvo?.system.targetContact;
        const points = Number(target.closest("[data-pool-row]")
            ?.querySelector("input[name='poolPoints']")?.value) || 0;
        if ( !salvo || !defender || !points ) return;
        if ( defender.type !== FLEET_SHIP ) {
            return ui.notifications.warn(game.i18n.format("MGT2.Fleet.Screen.NoSalvoDefence",
                { name: defender.name }));
        }
        return salvo.system.intercept(defender, points);
    }

    /** Folio 115: a salvo is fired at a target and travels on folio 119's clock, not on the dice. */
    static async #onLaunchSalvo(event, target) {
        const attacker = this.selectedContact;
        const victim = this.target;
        const fleet = attacker?.system.fleetGroup;
        if ( !fleet || !victim ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Fleet.Screen.NoTarget"));
        }
        const root = target.closest("[data-salvo-form]");
        const warhead = root?.querySelector("select[name='launchWarhead']")?.value;
        const count = Number(root?.querySelector("input[name='launchCount']")?.value) || 0;
        const band = FleetAttack.bandBetween(attacker, victim);
        const salvo = await this.#combat.system.addSalvo(fleet, {
            warhead, count: Math.max(1, count), target: victim, from: attacker, band,
            name: game.i18n.format("MGT2.Fleet.Screen.SalvoName", {
                ship: attacker.name, head: game.i18n.localize(MGT2.FleetWarheads[warhead]?.label ?? "") })
        });
        if ( !salvo ) return;
        this.#contactId = salvo.id;
        return this.render();
    }

    /**
     * Folio 118 reports and the referee applies, which is also the moment folio 119's screens and
     * sandcasters are spent: the points come out of the DEFENDER's own ledger and reduce the figure
     * before it reaches the hull.
     */
    static async #onApplyDamage() {
        const attack = this.#attack;
        const victim = attack ? this.#combat.combatants.get(attack.target.id) : null;
        if ( !victim ) return;
        // Whoever fired, not whoever is selected now: folio 119's superiority test is the
        // ATTACKER's Offensive DM against this target, and the referee may have clicked elsewhere
        // meanwhile.
        const attacker = this.#combat.combatants.get(attack.attacker) ?? null;
        const { pool, points } = this.#mitigate;
        let reduction = 0;
        if ( pool && points && (typeof victim.system.spend === "function") ) {
            const before = victim._source.system.spent?.[pool] ?? 0;
            await victim.system.spend(pool, points, (pool === "sand") ? attacker : null);
            if ( (victim._source.system.spent?.[pool] ?? 0) === before ) return;
            reduction = points;
        }
        const dealt = Math.max(0, attack.damage - reduction);
        const applied = await FleetAttack.apply(victim, dealt);
        const criticals = await FleetAttack.criticals({
            attacker, target: victim,
            crossings: applied.crossings ?? 0, weapon: { mount: attack.mount ?? "" } });
        this.#attack = { ...attack, applied: { ...applied, reduction, dealt }, criticals };
        this.#mitigate = { pool: "", points: 0 };
        return this.render();
    }

    /** @this {FleetCombatScreen} */
    static #onClearAttack() {
        this.#attack = null;
        this.#mitigate = { pool: "", points: 0 };
        return this.render();
    }

    /**
     * Folio 122's hand-off: "a very small group, perhaps 1-3 ships […] the Referee should consider
     * using the normal space combat rules".
     */
    static async #onDetach(event, target) {
        const contact = this.#contactOf(target);
        if ( contact?.type !== FLEET_SHIP ) return;
        const combat = await this.#combat.system.detach([contact]);
        if ( !combat ) return;
        await combat.activate({ render: false });
        this.#contactId = null;
        this.render();
        return SpaceCombatScreen.open(combat);
    }

    /** @this {FleetCombatScreen} */
    static #onOpenChart() {
        return FleetChartScreen.open(this.#combat);
    }

    /** The link is a stored uuid and nothing here reads the canvas. @this {FleetCombatScreen} */
    static async #onOpenActor(event, target) {
        const linked = await fromUuid(target.closest("[data-uuid]")?.dataset.uuid ?? "");
        return linked?.sheet?.render(true);
    }
}

/**
 * Folios 122-124's Fleet Manoeuvre Chart: 144 cells around a fixed point, and the placement that
 * writes the pair bands the rest of the engine already reads.
 * @extends {ApplicationV2}
 */
export class FleetChartScreen extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options) {
        super(options);
        this.#combat = options.combat;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-fleet-chart-{id}",
        classes: ["mgt2", "fleet-chart", "nopad"],
        position: { width: 780, height: 720 },
        window: { resizable: true, icon: "fa-solid fa-crosshairs" },
        actions: {
            selectSubject: FleetChartScreen.#onSelectSubject,
            place: FleetChartScreen.#onPlace,
            clearPlace: FleetChartScreen.#onClearPlace
        }
    };

    /** @inheritDoc */
    static PARTS = { chart: { template: `${PARTS_PATH}/chart.html` } };

    /** @type {Combat} */
    #combat;

    /** Which contact a click on a cell places. */
    #subjectId = null;

    get canEdit() {
        return this.#combat.canUserModify(game.user, "update", { system: {} });
    }

    get title() {
        const label = game.i18n.localize("MGT2.Fleet.Chart.Title");
        return this.#combat.name ? `${label}: ${this.#combat.name}` : label;
    }

    /** One chart per encounter, beside the battle screen rather than inside it. */
    static open(combat) {
        if ( combat?.type !== FLEET ) return null;
        const existing = foundry.applications.instances.get(`mgt2-fleet-chart-${combat.id}`);
        return (existing ?? new FleetChartScreen({ combat })).render({ force: true });
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

    /** Everything the chart places: folio 115's fleets, folio 114's wings, folio 124's salvoes. */
    get subjects() {
        return [
            ...this.#combat.system.fleets,
            ...this.#combat.combatants.filter(one => [SQUADRON, SALVO].includes(one.type))
        ];
    }

    get subject() {
        const all = this.subjects;
        return all.find(one => one.id === this.#subjectId) ?? all[0] ?? null;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const subject = this.subject;
        context.canEdit = this.canEdit;
        context.enabled = this.#combat.system.chart;
        context.view = CHART_VIEW;
        context.cells = this.#cells();
        context.subjects = this.subjects.map(one => ({
            id: one.id, name: one.name,
            kind: (one.type === FLEET)
                ? "TYPES.CombatantGroup.fleet" : `TYPES.Combatant.${one.type}`,
            fleet: (one.type === FLEET) ? null : (one.system.fleetGroup?.name ?? ""),
            code: chartCode(one.system.position),
            selected: one.id === subject?.id
        }));
        context.subject = context.subjects.find(row => row.selected) ?? null;
        context.pairs = this.#pairs();
        return context;
    }

    /** The 144 cells, each one annulus sector of the ring its band is drawn in. */
    #cells() {
        const rings = MGT2.FleetChart.rings;
        const width = (CHART_VIEW.edge - CHART_VIEW.hub) / rings.length;
        const held = this.#held();
        const cells = [];
        rings.forEach((ring, index) => {
            const inner = CHART_VIEW.hub + (index * width);
            const step = (2 * Math.PI) / (4 * ring.sectors);
            const before = rings.slice(0, index)
                .reduce((sum, one) => sum + ((one.band === ring.band) ? one.sectors : 0), 0);
            MGT2.FleetChart.quadrants.forEach((quadrant, side) => {
                for ( let place = 0; place < ring.sectors; place++ ) {
                    const from = ((side * ring.sectors) + place) * step;
                    const sector = before + place + 1;
                    const at = { quadrant, sector, band: ring.band };
                    cells.push({ ...at,
                        d: FleetChartScreen.#wedge(from, from + step, inner, inner + width),
                        mark: FleetChartScreen.#at(from + (step / 2), inner + (width / 2)),
                        code: chartCode(at),
                        here: held.get(`${quadrant}|${sector}|${ring.band}`) ?? null
                    });
                }
            });
        });
        return cells;
    }

    /** What sits in each cell, keyed as `#cells` keys them. */
    #held() {
        const map = new Map();
        const subject = this.subject;
        for ( const one of this.subjects ) {
            const at = one.system.position;
            if ( !at.quadrant ) continue;
            const key = `${at.quadrant}|${at.sector}|${at.band}`;
            const cell = map.get(key) ?? { names: [], mine: false };
            cell.names.push(one.name);
            cell.mine ||= (one.id === subject?.id);
            cell.label = cell.names.join(", ");
            map.set(key, cell);
        }
        return map;
    }

    /** A point `radius` from the centre, at `angle` radians counter-clockwise from the top. */
    static #at(angle, radius) {
        return {
            x: (CHART_VIEW.centre - (radius * Math.sin(angle))).toFixed(2),
            y: (CHART_VIEW.centre - (radius * Math.cos(angle))).toFixed(2)
        };
    }

    /** One annulus sector. Counter-clockwise on screen is sweep 0, and the return arc is sweep 1. */
    static #wedge(from, to, inner, outer) {
        const a = FleetChartScreen.#at(from, outer);
        const b = FleetChartScreen.#at(to, outer);
        const c = FleetChartScreen.#at(to, inner);
        const d = FleetChartScreen.#at(from, inner);
        return `M${a.x} ${a.y}A${outer} ${outer} 0 0 0 ${b.x} ${b.y}`
            + `L${c.x} ${c.y}A${inner} ${inner} 0 0 1 ${d.x} ${d.y}Z`;
    }

    /** What the chart writes: every placed pair of fleets and the band it derives for them. */
    #pairs() {
        const fleets = this.#combat.system.fleets.filter(group => group.system.position.quadrant);
        const rows = [];
        for ( let i = 0; i < fleets.length; i++ ) {
            for ( let j = i + 1; j < fleets.length; j++ ) {
                const band = chartBand(fleets[i].system.position, fleets[j].system.position);
                rows.push({ from: fleets[i].name, to: fleets[j].name,
                    label: MGT2.ShipRangeBands[band]?.label ?? null });
            }
        }
        return rows;
    }

    /** @this {FleetChartScreen} */
    static #onSelectSubject(event, target) {
        this.#subjectId = target.closest("[data-subject-id]").dataset.subjectId;
        return this.render();
    }

    /** Folio 124: a click is the placement, and a fleet's placement rewrites the pair bands. */
    static async #onPlace(event, target) {
        if ( !this.canEdit || !this.subject ) return;
        const { quadrant, sector, band } = target.dataset;
        return this.#combat.system.setPosition(this.subject, { quadrant, sector: Number(sector), band });
    }

    /** @this {FleetChartScreen} */
    static async #onClearPlace() {
        if ( !this.canEdit || !this.subject ) return;
        return this.#combat.system.setPosition(this.subject, null);
    }
}

/**
 * Two surfaces, the same pair the space screen registers — and the create entry carries the switch,
 * so the sub-type is not offered when the switch is off.
 */
export function registerFleetCombatScreen() {
    Hooks.on("getCombatContextOptions", (application, options) => {
        options.unshift({
            label: "MGT2.Fleet.Screen.Create",
            icon: '<i class="fa-solid fa-chess-rook"></i>',
            visible: () => game.user.isGM && Rules.on("fleetBattles"),
            onClick: async () => {
                const combat = await Combat.implementation.create({ type: FLEET });
                await combat.activate({ render: false });
                return FleetCombatScreen.open(combat);
            }
        }, {
            label: "MGT2.Fleet.Screen.Open",
            icon: '<i class="fa-solid fa-table-columns"></i>',
            visible: () => application.viewed?.type === FLEET,
            onClick: () => FleetCombatScreen.open(application.viewed)
        });
    });

    Hooks.on("getCombatTrackerContextOptions", (application, options) => {
        options.push({
            label: "MGT2.Fleet.Screen.Open",
            icon: '<i class="fa-solid fa-table-columns"></i>',
            visible: () => application.viewed?.type === FLEET,
            onClick: () => FleetCombatScreen.open(application.viewed)
        }, {
            label: "MGT2.Fleet.Chart.Open",
            icon: '<i class="fa-solid fa-crosshairs"></i>',
            visible: () => (application.viewed?.type === FLEET) && Rules.on("fleetChart"),
            onClick: () => FleetChartScreen.open(application.viewed)
        });
    });
}
