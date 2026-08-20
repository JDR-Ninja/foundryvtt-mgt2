import { Checks } from "../checks.js";
import { MGT2 } from "../config.js";
import { CreditSplit } from "../credit-split.js";
import { fleetBatteries } from "../fleet-attack.js";
import { MGT2Helper } from "../helper.js";
import { RollPromptHelper } from "../roll-prompt.js";
import { Rules } from "../rules.js";
import { SkipDebtsDialog } from "../skip-debts.js";
import { CraftData } from "./craft-data.js";
import { TravellerActorSheet } from "./character-sheet.js";

const PARTS_PATH = "systems/mgt2/templates/actors";

/** Cell keys that phrase themselves as a signed DM and nothing else. */
const DM_KEYS = ["sensorDM", "controlDM", "jumpDM"];

/** Every block the panel composes from; each one is a partial of the same name. */
const BLOCKS = ["hull", "accommodation", "manifest", "mounts", "crew", "bays", "criticals",
    "design", "computer", "fleet", "finance", "description", "notes"];

const blockPath = id => `${PARTS_PATH}/spacecraft/blocks/${id}.html`;

/** Which tab holds each block. */
const SLOT = {
    mounts: "station", criticals: "station", computer: "station", crew: "station",
    manifest: "hold", accommodation: "hold", bays: "hold",
    finance: "finance",
    hull: "design", design: "design",
    fleet: "fleet",
    description: "description", notes: "description"
};

for ( const id of BLOCKS ) {
    if ( !(id in SLOT) ) throw new Error(`MGT2 | the spacecraft sheet block "${id}" has no tab slot.`);
}

/**
 * The spacecraft sheet, and the hard one: it is the single
 * screen that needs all four layout blocks at once: a statline header, three budgets with live
 * totals, two rosters of linked actors, and a code row.
 * @extends {TravellerActorSheet}
 */
export class SpacecraftActorSheet extends TravellerActorSheet {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["spacecraft"],
        position: { width: 1120, height: 860 },
        actions: {
            criticalSet: SpacecraftActorSheet.#onCriticalSet,
            criticalRoll: SpacecraftActorSheet.#onCriticalRoll,
            criticalClear: SpacecraftActorSheet.#onCriticalClear,
            powerToggle: SpacecraftActorSheet.#onPowerToggle,
            softwareToggle: SpacecraftActorSheet.#onSoftwareToggle,
            backupToggle: SpacecraftActorSheet.#onBackupToggle,
            burnToggle: SpacecraftActorSheet.#onBurnToggle,
            ionClear: SpacecraftActorSheet.#onIonClear,
            hullOptionToggle: SpacecraftActorSheet.#onHullOptionToggle,
            rowCreate: SpacecraftActorSheet.#onRowCreate,
            rowDelete: SpacecraftActorSheet.#onRowDelete,
            stationAction: SpacecraftActorSheet.#onStationAction,
            openCraft: SpacecraftActorSheet.#onOpenCraft,
            electMortgage: SpacecraftActorSheet.#onElectMortgage,
            skipDebts: SpacecraftActorSheet.#onSkipDebts,
            deliverLot: SpacecraftActorSheet.#onDeliverLot,
            arrivePassage: SpacecraftActorSheet.#onArrivePassage
        }
    };

    /**
     * What a hull takes on a drop: the four types `SpacecraftData` reads off its own Items.
     * @inheritDoc
     */
    static DROP_ITEM_TYPES = new Set(["component", "cargo", "passage", "role", "weapon"]);

    /** @inheritDoc */
    static DROP_ITEM_SIMPLE = new Set();

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/spacecraft/header.html` },
        rail: {
            template: `${PARTS_PATH}/spacecraft/rail.html`,
            templates: [`${PARTS_PATH}/spacecraft/budget.html`,
                `${PARTS_PATH}/spacecraft/budget-rows.html`],
            scrollable: [""]
        },
        panel: {
            template: `${PARTS_PATH}/spacecraft/panel.html`,
            templates: BLOCKS.map(blockPath).concat(`${PARTS_PATH}/parts/row-controls.html`,
                `${PARTS_PATH}/parts/tabs-nav.html`,
                `${PARTS_PATH}/spacecraft/budget.html`,
                `${PARTS_PATH}/spacecraft/budget-rows.html`),
            scrollable: ['.tab[data-group="spacecraft"].active']
        }
    };

    /** The five tabs, in nav order; Fleet is a sixth only where the rule is on. @inheritDoc */
    static TABS = {
        spacecraft: {
            tabs: [
                { id: "station", cssClass: "item tab-select", icon: "fa-solid fa-crosshairs", label: "MGT2.Actor.spacecraft.Tabs.Station" },
                { id: "hold", cssClass: "item tab-select", icon: "fa-solid fa-pallet-boxes", label: "MGT2.Actor.spacecraft.Tabs.Hold" },
                { id: "finance", cssClass: "item tab-select", icon: "fa-solid fa-credit-card", label: "MGT2.Actor.spacecraft.Finance" },
                { id: "design", cssClass: "item tab-select", icon: "fa-solid fa-drafting-compass", label: "MGT2.Design.Title" },
                { id: "fleet", cssClass: "item tab-select", icon: "fa-solid fa-chess-rook", label: "MGT2.Actor.spacecraft.Fleet.Title" },
                { id: "description", cssClass: "item tab-select", icon: "fa-solid fa-book", label: "MGT2.Actor.spacecraft.Description" }
            ]
        }
    };

    /** The blocks this hull carries, grouped into the tab each one belongs in. */
    #composition() {
        const slots = {};
        for ( const id of BLOCKS ) {
            if ( (id === "fleet") && !Rules.on("fleetBattles") ) continue;
            (slots[SLOT[id]] ??= []).push({ id, template: blockPath(id) });
        }
        return slots;
    }

    /** The Fleet tab is drawn only where the rule is on. @inheritDoc */
    _getTabsConfig(group) {
        const config = super._getTabsConfig(group);
        if ( (group !== "spacecraft") || !config ) return config;
        const slots = this.#composition();
        const tabs = config.tabs.filter(tab => tab.id in slots);
        return { ...config, tabs, initial: tabs[0]?.id ?? null };
    }

    /**
     * `_prepareTabs` fills `tabGroups[group]` with `??=`, so a stored id outlives the tab that
     * carried it: turn fleet battles off while Fleet is open and the strip has nothing active.
     * @inheritDoc
     */
    _prepareTabs(group) {
        if ( group === "spacecraft" ) {
            const { tabs } = this._getTabsConfig(group);
            if ( !tabs.some(tab => tab.id === this.tabGroups[group]) ) this.tabGroups[group] = null;
        }
        return super._prepareTabs(group);
    }

    /** Folds the reader opened by hand; one with no entry keeps what the template asked for.
     * @type {Map<string, boolean>} */
    #folds = new Map();

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);
        for ( const fold of this.element.querySelectorAll("details.fold[data-fold]") ) {
            const key = fold.dataset.fold;
            if ( this.#folds.has(key) ) fold.open = this.#folds.get(key);
            fold.addEventListener("toggle", () => this.#folds.set(key, fold.open));
        }
    }

    /**
     * The parent maps document paths onto the *character* sheet's parts, and this sheet has three
     * of its own, so a document-driven render redraws all of them instead.
     * @inheritDoc
     */
    _configureRenderOptions(options) {
        super._configureRenderOptions(options);
        if (options.renderContext && !options.isFirstRender) {
            options.parts = Object.keys(this.constructor.PARTS);
        }
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const system = this.actor.system;

        // The parent overwrites `context.tabs` with the character sheet's two groups.
        context.tabs = this._prepareTabs("spacecraft");
        const slots = this.#composition();
        for ( const tab of Object.values(context.tabs) ) tab.blocks = slots[tab.id];

        context.choices = {
            configurations: MGT2.HullConfigurations,
            hullOptions: MGT2.HullOptions,
            materials: MGT2.ArmourMaterials,
            bridges: MGT2.BridgeTypes,
            sensors: MGT2.SensorGrades,
            mountTypes: MGT2.ShipMounts,
            bays: MGT2.CraftBays,
            service: MGT2.ShipService,
            screens: MGT2.ShipScreens,
            scales: MGT2.Scales
        };

        context.ship = {
            hull: SpacecraftActorSheet.#hull(system),
            tonnage: SpacecraftActorSheet.#tonnage(system),
            power: SpacecraftActorSheet.#power(system),
            hardpoints: SpacecraftActorSheet.#hardpoints(system),
            computer: SpacecraftActorSheet.#computer(system),
            options: SpacecraftActorSheet.#hullOptions(system),
            accommodation: SpacecraftActorSheet.#accommodation(system),
            mounts: SpacecraftActorSheet.#mounts(system, context.weapons),
            crew: this.#crew(system),
            bays: this.#bays(system),
            // Craft and bays are two counts now: a clamp rack of ten fighters is one row.
            craftCount: system.smallCraftCount,
            criticals: this.#criticals(system),
            manifest: this.#manifest(),
            manoeuvre: system.manoeuvre,
            fuel: SpacecraftActorSheet.#fuel(system),
            drives: SpacecraftActorSheet.#drives(system),
            finance: SpacecraftActorSheet.#finance(system),
            design: SpacecraftActorSheet.#design(system),
            // Which of the six headline figures the book is answering for.
            printed: system.printedFigures,
            derived: SpacecraftActorSheet.#derived(system),
            // Null where the table does not play fleet battles: the rule is off and no statblock
            // was computed.
            fleet: this.#fleet(system)
        };
        return context;
    }

    /** HG p.107's WEAPONS and DEFENCES panels, off the readers the fleet screen uses. */
    #fleet(system) {
        if ( !system.fleet ) return null;
        return {
            ...system.fleet,
            defences: system.fleetDefences(system.fleet.crewSkill),
            batteries: fleetBatteries(this.actor).map(row => ({
                ...row,
                mountLabel: game.i18n.localize(row.mountLabel),
                bandLabel: row.band ? MGT2.ShipRangeBands[row.band]?.label : null,
                // HG p.112: what gets through is a salvo's multiple, so the mount's is not one.
                salvo: MGT2Helper.isMissileWeapon(this.actor.items.get(row.id))
            }))
        };
    }

    /**
     * One budget panel: the total, the bar and the over-state are computed here and never authored,
     * which is the block's own contract.
     * @param {number} [stated]   A printed total displacing the sum of the rows, which then no
     *     longer add up to the header — what the block's `why` gloss says
     */
    static #budget(cap, rows, stated) {
        const total = stated
            ?? rows.reduce((sum, row) => sum + ((row.powered === false) ? 0 : row.value), 0);
        const over = total > cap;
        const fill = cap > 0 ? Math.min(100, (total / cap) * 100) : 0;
        const round = value => Math.round(value * 100) / 100;
        return {
            rows: rows.map(row => ({ ...row, value: round(row.value) })),
            total: round(total), cap: round(cap), over,
            // The cap tick sits where the fill stops, so an overrun reads as an overrun.
            fill: Math.round(fill * 10) / 10,
            mark: over ? 100 : Math.round(fill * 10) / 10,
            remaining: round(Math.abs(cap - total))
        };
    }

    /** The parts list and the design check beside it. */
    static #design(system) {
        const design = system.design;
        return {
            ...system.components,
            failed: design.failed,
            checked: design.checks.filter(check => check.applies).length,
            checks: design.checks.map(check => ({
                ...check,
                label: `MGT2.Design.Checks.${check.key}`,
                why: `MGT2.Design.Why.${check.key}`,
                // The two transcription lines read as a match rather than as a cap, so the reading
                // is `used = cap` and not `used / cap`.
                match: check.key.startsWith("stated")
            })),
            rows: system.components.rows.map(row => ({
                ...row,
                categoryLabel: MGT2.ComponentCategories[row.category] ?? row.category,
                // A power plant states what it makes; every other row states what it takes.
                power: row.generates > 0 ? row.generates : -row.draw
            }))
        };
    }

    /** The pool. A hull only ever fills — there is no state under wrecked (Core p.168). */
    static #hull(system) {
        const hull = system.characteristics.hull;
        return {
            value: hull.value, max: hull.max, damage: hull.damage,
            wound: (hull.max > 0) ? Math.min(100, Math.round((hull.damage / hull.max) * 100)) : 0,
            wrecked: system.states.wrecked,
            crossed: system.sustainedCrossed,
            steps: system.sustainedSteps,
            severity: system.hullSeverity
        };
    }

    /** The gloss that says a printed figure is answering, in the slot `mortgageOverride` already uses. */
    static #printedWhy(on) {
        return on ? "MGT2.Actor.spacecraft.Printed" : undefined;
    }

    /**
     * The formula's own answer for each of the six, whether or not an override is displacing it.
     */
    static #derived(system) {
        const round = value => Math.round(value * 100) / 100;
        return {
            hullPoints: system.hullPoints,
            armourTons: round(system.armourTons),
            bridgeTons: round(system.bridgeTons),
            bridgeCost: system.bridgeCost,
            jumpTons: round(system.fuelPerMaxJump),
            powerDraw: system.power.fullDraw
        };
    }

    static #tonnage(system) {
        const printed = system.printedFigures;
        const why = { armour: printed.armourTons, bridge: printed.bridgeTons };
        // A row at zero is a fitting the hull does not carry.
        return SpacecraftActorSheet.#budget(system.hull.tons,
            system.budget.rows.filter(row => row.tons).map(row => ({ key: row.key, value: row.tons,
                why: SpacecraftActorSheet.#printedWhy(why[row.key]) })));
    }

    /**
     * The one budget with a state: a consumer taken offline is an Engineer's action and it frees
     * its draw (Core p.171), which is why power is a panel rather than a number.
     */
    static #power(system) {
        // `other` is never incremented at all; one already shed stays listed, to be brought back.
        const budget = SpacecraftActorSheet.#budget(system.power.available,
            system.power.rows.filter(row => row.draw || !row.powered)
                .map(row => ({ key: row.key, value: row.draw, powered: row.powered })),
            system.power.requirements.total);
        budget.surplus = system.power.surplus;
        budget.plant = system.power.plant;
        // A critical cut the plant's output; an ion hit is deducted after it, off `rated`.
        budget.rated = system.power.rated;
        budget.damaged = system.power.rated < system.power.plant;
        budget.ionDrain = system.power.ionDrain;
        budget.why = SpacecraftActorSheet.#printedWhy(system.printedFigures.powerDraw);
        return budget;
    }

    /** The level in the tank against the tonnage that holds it: `ops.fuel`, not `fuel.tons`. */
    static #fuel(system) {
        const jumpTons = system.fuel.jumpTons;
        return {
            aboard: Math.round(system.ops.fuel * 100) / 100,
            capacity: system.fuel.tons,
            jumps: jumpTons > 0 ? Math.floor(system.ops.fuel / jumpTons) : 0,
            rated: system.drives.jump
        };
    }

    /** The second drive and the G-force it costs the crew, resolved to what the hint prints. */
    static #drives(system) {
        const drives = system.drives;
        const rung = drives.gLoc;
        return {
            fitted: drives.reactionThrust !== null,
            reactionThrust: drives.reactionThrust,
            lit: drives.lit,
            thrust: drives.thrust,
            total: drives.totalThrust,
            uncompensated: drives.uncompensated,
            gLoc: !rung ? null : {
                special: rung.special,
                trained: rung.trained,
                difficulty: rung.difficulty ? MGT2.Difficulty[rung.difficulty] : null,
                increment: rung.increment ? `MGT2.Actor.spacecraft.GLoc.${rung.increment}` : null
            }
        };
    }

    static #hardpoints(system) {
        const rows = system.mounts.map((mount, index) => ({
            key: String(index + 1),
            label: mount.label || game.i18n.format("MGT2.Actor.spacecraft.MountN", { n: index + 1 }),
            why: MGT2.ShipMounts[mount.type]?.label ?? "",
            value: MGT2.ShipMounts[mount.type]?.hardpoints ?? 1
        }));
        const budget = SpacecraftActorSheet.#budget(system.hardpoints.max, rows);
        budget.firmpoints = system.firmpoints.max;
        budget.airlocks = system.airlocks;
        return budget;
    }

    /** A package the ship cannot run spends nothing, so its row reads 0 and says why. */
    static #computer(system) {
        const budget = SpacecraftActorSheet.#budget(system.computer.cap,
            system.computer.software.map(row => ({
                // `item` is what tells the budget partial this row is a document and not a fixed
                // consumer key, so it draws the open and delete controls.
                key: row._id, item: true, label: row.name, value: row.bandwidth, powered: row.powered,
                why: row.tlBlocked ? "MGT2.Actor.spacecraft.SoftwareBlocked"
                    : (row.downgraded ? "MGT2.Actor.spacecraft.SoftwareDowngraded" : undefined)
            })));
        budget.overload = system.computer.overload;
        budget.overCrowded = system.computer.overCrowded;
        budget.blockedSoftware = system.computer.blockedSoftware;
        // What is aboard, beside what is running: the hint under the budget is the only place the
        // design figure appears, and it is the one HG p.73 is about.
        budget.installed = system.computer.installed;
        budget.carried = system.computer.carried;
        // Why the cap is not the Processing typed above it: the operating computer's own score, and
        // what Jump Control claimed of the /bis pool.
        budget.available = system.computer.available;
        budget.jumpBonus = system.computer.jumpBonus;
        budget.backup = system.computer.backup;
        budget.hasBackup = system.computer.backup !== null;
        budget.onBackup = system.computer.onBackup;
        // The designations belong to the computer in service, so falling back changes them with it.
        budget.rated = system.computer.rated;
        budget.liveBis = system.computer.liveBis;
        budget.liveFib = system.computer.liveFib;
        budget.ionDrain = system.computer.ionDrain;
        return budget;
    }

    /**
     * Hull options are options, not traits: the registry has no ship family. HG p.12's size limits
     * are drawn as advisory lines beside them and refuse nothing.
     */
    static #hullOptions(system) {
        const say = (key, data) => game.i18n.format(`MGT2.Actor.spacecraft.${key}`, data);
        const checks = [];
        const rows = Object.entries(MGT2.HullOptions).map(([key, option]) => {
            const on = system.hull.options.has(key);
            if (on && option.minTons && (system.hull.tons < option.minTons)) {
                checks.push(say("HullOptionMin", { option: game.i18n.localize(option.label),
                    tons: system.hull.tons, min: option.minTons }));
            }
            if (on && option.maxTons && (system.hull.tons > option.maxTons)) {
                checks.push(say("HullOptionMax", { option: game.i18n.localize(option.label),
                    tons: system.hull.tons, max: option.maxTons }));
            }
            return { key, label: option.label, on };
        });
        const installed = Object.entries(MGT2.HullInstallOptions).map(([key, option]) => ({
            key, label: option.label, on: system.hull.installed.has(key)
        }));

        const fitted = system.hullOptions;
        const named = key => game.i18n.localize(MGT2.HullInstallOptions[key].label);
        for (const row of fitted.underTL) {
            checks.push(say("HullInstallTL", { option: named(row.key), tl: row.tl, ship: system.tl }));
        }
        for (const [a, b] of fitted.clashes) {
            checks.push(say("HullInstallExclusive", { option: named(a), other: named(b) }));
        }
        if (fitted.gradeMissing) {
            checks.push(game.i18n.localize("MGT2.Actor.spacecraft.HullInstallStealthGrade"));
        }

        return {
            rows, on: rows.filter(row => row.on),
            installed, fitted: installed.filter(row => row.on),
            checks,
            stealthDM: fitted.sensorDM, cost: fitted.cost, rads: fitted.radsAbsorbed
        };
    }

    /** Berths and passengers as one list: three consumers read them and none of them is a pool. */
    static #accommodation(system) {
        const rows = [];
        for (const [key, room] of Object.entries(MGT2.Staterooms)) {
            rows.push({ path: `staterooms.${key}`, label: room.label, value: system.staterooms[key] });
        }
        for (const [key, berth] of Object.entries(MGT2.LowBerths)) {
            rows.push({ path: `lowBerths.${key}`, label: berth.label, value: system.lowBerths[key] });
        }
        for (const [key, passage] of Object.entries(MGT2.PassageClasses)) {
            // A working passage is paid in labour, not booked into a berth the ship counts.
            if (!(key in system.passengers)) continue;
            rows.push({ path: `passengers.${key}`, label: passage.label, value: system.passengers[key] });
        }
        return rows;
    }

    /** Each mount with the weapons it holds, its damage multiple, and the ones no mount claimed. */
    static #mounts(system, weapons) {
        const byId = new Map(weapons.map(weapon => [weapon._id, weapon]));
        const claimed = new Set();
        const inert = system.mountsInert;
        const rows = system.mounts.map((mount, index) => {
            const type = MGT2.ShipMounts[mount.type] ?? MGT2.ShipMounts.fixed;
            const held = [];
            let ammo = 0;
            for (const id of mount.weapons) {
                const weapon = byId.get(id);
                if (!weapon) continue;
                claimed.add(id);
                held.push(weapon);
                ammo += weapon.system.magazine ?? 0;
            }
            // HG p.29: the multiple applies after armour and never to missiles or torpedoes.
            const missile = held.some(weapon => MGT2Helper.isMissileWeapon(weapon));
            // Core p.168: two or more weapons OF THE SAME TYPE in one mount fire together on a
            // single attack roll, each extra one adding +1 per damage die.
            const linked = held.length
                ? held.filter(weapon => weapon.name === held[0].name).length : 0;
            const band = held[0]?.system.range?.band || "";
            return {
                index, type: mount.type, label: mount.label, popup: mount.popup,
                typeLabel: type.label,
                // Names a weapon and resolves none: correct for the defensive counts, which read
                // the class off the label, and silently zero for anything offensive.
                inert: inert[index],
                // Core p.165-167: the furthest band the mounted weapon reaches.
                band, bandLabel: MGT2.ShipRangeBands[band]?.label ?? "",
                linked: missile ? 1 : linked,
                linkedBonus: missile ? 0
                    : (linked - 1) * SpacecraftActorSheet.#damageDice(held[0]?.system.damage),
                multiple: missile ? 1 : type.damageMultiple,
                printed: type.damageMultiple,
                missile,
                big: !missile && (type.damageMultiple >= 10),
                hardpoints: type.hardpoints ?? 1,
                tons: type.tons,
                ammo: mount.ammo, ammoMax: ammo,
                weapons: held,
                // Core p.183: a fixed mount or a turret holds one, two or three weapons by type.
                overCapacity: (held.length > type.weapons)
                    ? MGT2Helper.plural("MGT2.Actor.spacecraft.MountCapacity", held.length,
                        { held: held.length, cap: type.weapons }) : null,
                choices: weapons.map(weapon => ({
                    _id: weapon._id, name: weapon.name, selected: mount.weapons.includes(weapon._id)
                }))
            };
        });
        return {
            rows,
            unmounted: weapons.filter(weapon => !claimed.has(weapon._id)),
            inertCount: system.inertMountCount,
            spinal: system.mounts.some(mount => mount.type === "spinal"),
            scansUnarmed: system.scansUnarmed,
            tons: system.hull.tons
        };
    }

    /** The roster. */
    #crew(system) {
        const required = new Map(system.crewRequired.map(row => [row.key, row.count]));
        const rows = system.crew.map((station, index) => {
            const role = station.role ? this.actor.items.get(station.role) : null;
            let actor = null;
            if (station.actor) {
                try { actor = foundry.utils.fromUuidSync(station.actor); } catch { actor = null; }
            }
            const statted = actor != null;
            return {
                index,
                role: station.role, actor: station.actor, count: station.count,
                name: actor?.name ?? station.name,
                img: actor?.img ?? null,
                statted,
                vacant: !statted && !station.name,
                station: role?.name ?? "",
                department: role ? MGT2.Departments[role.system.department] : "",
                // The mount this station sits at.
                dutyTarget: station.dutyTarget,
                actions: (role?.system.actions ?? []).map((action, i) => ({
                    index: i, label: action.label, kind: action.kind, skill: action.skill,
                    difficulty: action.difficulty,
                    step: action.step, stepLabel: MGT2.CombatSteps[action.step] ?? "",
                    cap: action.cap, capLabel: (action.cap && (action.cap !== "none"))
                        ? MGT2.ActionCaps[action.cap] : "",
                    target: action.difficulty ? MGT2Helper.getDifficultyValue(action.difficulty) : null,
                    disabled: (action.kind !== "special") && !statted
                })),
                roles: this.actor.items.filter(item => item.type === "role")
                    .map(item => ({ _id: item.id, name: item.name, selected: item.id === station.role })),
                required: role ? (required.get(role.system.crewRoleKey) ?? null) : null
            };
        });

        return {
            rows,
            required: system.crewRequired.filter(row => row.count > 0).map(row => ({
                ...row, label: MGT2.CrewRoles[row.key]?.label ?? row.key
            })),
            totals: system.crewTotals,
            short: system.crewTotals.stations < system.crewTotals.required,
            military: system.role === "military",
            hasRoles: this.actor.items.some(item => item.type === "role"),
            // The typed Crew Skill and the average the roster can see.
            skill: system.crewSkill,
            observed: system.crewSkillObserved
        };
    }


    /** Carried craft are references: a stored UUID, resolved only where it is already loaded. */
    #bays(system) {
        return system.bays.map((bay, index) => {
            let actor = null;
            if (bay.craft) {
                try { actor = foundry.utils.fromUuidSync(bay.craft); } catch { actor = null; }
            }
            const kind = MGT2.CraftBays[bay.kind] ?? {};
            const count = Math.max(1, bay.count);
            return {
                index, kind: bay.kind, capacity: bay.capacity, craft: bay.craft, count,
                kindLabel: kind.label ?? "", external: kind.external === true,
                transfer: kind.transfer ?? null,
                craftPerRound: kind.craftPerRound ?? null,
                repairs: kind.repairs === true,
                checks: SpacecraftActorSheet.#bayChecks(kind, bay.capacity,
                    actor?.system?.hull?.tons ?? 0),
                name: actor?.name ?? null,
                img: actor?.img ?? null,
                tons: Math.round(count * bay.capacity * 100) / 100,
                many: count > 1,
                purchase: actor?.system?.finance?.purchase ?? 0,
                vacant: !bay.craft
            };
        });
    }

    /** HG p.57's clamp bands and p.61's multiples against the craft aboard, as localised lines. */
    static #bayChecks(kind, capacity, craftTons) {
        if (!craftTons) return [];
        const say = (key, data) => game.i18n.format(`MGT2.Actor.spacecraft.${key}`, data);
        const lines = [];
        if (kind.tons && (capacity !== kind.tons)) {
            lines.push(say("ClampTons", { tons: kind.tons, capacity }));
        }
        if (kind.minCraftTons && ((craftTons < kind.minCraftTons)
            || (kind.maxCraftTons && (craftTons > kind.maxCraftTons)))) {
            lines.push(say("ClampCraft", { tons: craftTons, band: kind.maxCraftTons
                ? `${kind.minCraftTons}-${kind.maxCraftTons}` : `${kind.minCraftTons}+` }));
        }
        // HG p.61 rounds the multiple up, and 40 t x 1.1 floats to 44.000000000000006.
        const need = kind.tonsMultiple ? Math.ceil((craftTons * kind.tonsMultiple) - 1e-9) : 0;
        if (need > capacity) lines.push(say("BaySize", { need, tons: craftTons }));
        return lines;
    }

    /**
     * What the hull is actually carrying, as the two things a referee acts on at the far end of a
     * route: freight to hand over and passengers to put ashore.
     */
    #manifest() {
        const day = game.settings.get("mgt2", "campaignDay");
        const settle = this.#canSettle;
        const rows = [];
        for (const item of this.actor.items) {
            if (item.type === "cargo") {
                const lot = item.system;
                rows.push({
                    _id: item.id, freight: !lot.speculative, name: item.name, tons: lot.tons,
                    where: SpacecraftActorSheet.#destinationOf(lot.destination),
                    dueDay: lot.dueDay,
                    // Core p.241 measures lateness at the moment of delivery: the day is read now,
                    // and no timer ever moves it.
                    late: (lot.dueDay !== null) && (day > lot.dueDay),
                    fare: lot.fare ? MGT2Helper.credits(lot.fare) : null,
                    can: settle && !lot.speculative && (lot.fare > 0)
                });
            }
            else if (item.type === "passage") {
                const booking = item.system;
                const grade = MGT2.PassageClasses[booking.grade] ?? MGT2.PassageClasses.middle;
                rows.push({
                    _id: item.id, passage: true, name: item.name, count: booking.count,
                    grade: grade.label, lowBerth: booking.lowBerth,
                    where: SpacecraftActorSheet.#destinationOf(booking.destination),
                    // The fare was collected when the berth was taken (Core p.239), so arrival
                    // moves no money at all — what it owes is Core p.158's revival check on a low
                    // passage.
                    fare: booking.fare ? MGT2Helper.credits(booking.fare) : null,
                    can: settle
                });
            }
        }
        return { rows, day, count: rows.length, canSettle: settle };
    }

    /** A destination degrades to its stored name where the world is not an Actor, or was deleted. */
    static #destinationOf(destination) {
        if (!destination) return null;
        const world = destination.world ? foundry.utils.fromUuidSync(destination.world) : null;
        return world?.name || destination.name || null;
    }

    /** The gate on both acts at the manifest. */
    get #canSettle() {
        return game.user.isGM && this.actor.canUserModify(game.user, "update");
    }

    /** Eleven locations × six pips, with the standing severity spelled out beside it. */
    #criticals(system) {
        const locations = Object.entries(MGT2.ShipCriticals).map(([key, location]) => {
            const severity = system.criticals[key] ?? 0;
            return {
                key, label: location.label, severity,
                roll: `${location.roll[0]}`,
                pips: Array.fromRange(6, 1).map(step => ({ step, on: step <= severity })),
                effect: SpacecraftActorSheet.#effectText(system.criticalEffect(key))
            };
        });
        return {
            locations,
            hit: locations.filter(location => location.severity),
            intact: locations.filter(location => !location.severity),
            hullSeverity: system.hullSeverity, standing: system.criticalEffects
        };
    }

    /** One critical cell as localised fragments. */
    static #effectText(cell) {
        if (!cell) return null;
        const parts = [];
        const say = (key, data) => parts.push(game.i18n.format(`MGT2.Criticals.${key}`, data));
        const state = key => game.i18n.localize(`MGT2.Criticals.States.${key}`);
        const unit = key => game.i18n.localize(`MGT2.Criticals.Units.${key}`);
        // The interval is dice plus a unit, and the unit is a key: it reaches an already-translated
        // sentence, so a literal here prints half in one language and half in the other.
        const interval = ({ dice, unit: key }) => (dice ? `${dice} ` : "") + unit(key);

        if (cell.damage) say("Damage", { dice: cell.damage });
        if (cell.power === 0) say("PowerZero");
        else if (cell.power) say("Power", { pct: String(cell.power).replace("-", "") });
        if (cell.thrust === 0) say("ThrustZero");
        else if (cell.thrust) say("Thrust", { value: String(cell.thrust).replace("-", "") });
        if (cell.armour) say("Armour", { value: String(cell.armour).replace("-", "") });
        if ("sensorRange" in cell) {
            if (cell.sensorRange === null) say("SensorsDisabled");
            else say("SensorRange", { band: game.i18n.localize(MGT2.ShipRangeBands[cell.sensorRange]?.label ?? "") });
        }
        for (const key of DM_KEYS) {
            if (cell[key] !== undefined) {
                say(key[0].toUpperCase() + key.slice(1), { dm: MGT2Helper.signed(cell[key]) });
            }
        }
        if (cell.weapons) {
            say("Weapon", { n: cell.weapons.n ?? game.i18n.localize("MGT2.Criticals.Some"),
                state: state(cell.weapons.state) });
        }
        if (cell.fuel?.leak) say("FuelLeak", { amount: cell.fuel.leak, per: unit(cell.fuel.per) });
        if (cell.fuel?.state) say("FuelState", { state: state(cell.fuel.state) });
        if (cell.cargo) {
            say("Cargo", {
                amount: (cell.cargo === "all") ? game.i18n.localize("MGT2.Criticals.All") : cell.cargo
            });
        }
        if (cell.jump) say("Jump", { state: state(cell.jump) });
        if (cell.occupants) {
            say("Occupants", {
                n: (cell.occupants.n === "all") ? game.i18n.localize("MGT2.Criticals.All") : cell.occupants.n,
                dice: cell.occupants.damage
            });
        }
        if (cell.lifeSupport) {
            // Core p.164 prints the sixth cell as "Life support fails" with no interval.
            if (cell.lifeSupport.unit) say("LifeSupport", { time: interval(cell.lifeSupport) });
            else say("LifeSupportNow");
        }
        if (cell.computer) say("Computer", { state: state(cell.computer) });
        if (cell.bridge) {
            say("Bridge", { state: state(cell.bridge.station) });
            if (cell.bridge.occupantDamage) say("Damage", { dice: cell.bridge.occupantDamage });
        }
        if (cell.hullSeverity) say("HullSeverity", { value: cell.hullSeverity });
        return parts.length ? parts.join(" · ") : game.i18n.localize("MGT2.Criticals.RefereesCall");
    }

    /**
     * The running costs, and the one row that disagrees with the printed page on purpose: Core
     * p.183 subtracts carried craft from the maintenance base and the catalogue's cost ÷ 12 000
     * does not, so the catalogue bills a carried boat twice.
     */
    static #finance(system) {
        const finance = system.finance;
        const money = value => Math.round(value);
        const election = row => row && {
            payment: money(row.payment), periods: row.periods, total: money(row.total) };
        return {
            purchase: money(finance.purchase),
            mortgage: money(finance.mortgage),
            mortgageOverridden: finance.mortgageOverride !== null,
            // Core p.149's term, and the total it was never multiplied out to.
            periods: finance.mortgagePeriods,
            periodsPerYear: finance.periodsPerYear,
            total: money(finance.mortgageTotal),
            overcost: money(finance.mortgageOvercost),
            multiple: finance.mortgageMultiple?.toFixed(2) ?? null,
            paid: finance.periodsPaid,
            remaining: finance.periodsRemaining,
            balance: money(finance.balance),
            percent: Math.round(finance.paidFraction * 100),
            quarters: finance.benefitQuarters,
            elections: finance.elections && {
                keep: election(finance.elections.keep),
                remortgage: election(finance.elections.remortgage)
            },
            maintenance: money(finance.maintenance),
            catalogue: money(finance.maintenanceCatalogue),
            carried: money(finance.carried),
            delta: money(finance.maintenanceCatalogue - finance.maintenance),
            lifeSupport: money(finance.lifeSupport),
            salaries: money(finance.salaries),
            // Outside the five periodic rows above, and rendered apart from them: fuel is a unit
            // price the crew pays when they buy some.
            fuelPerTon: money(finance.fuelPerTon),
            tankFill: money(finance.tankFill),
            refined: system.fuel.refined
        };
    }

    /** One settlement at a time: a second split window beside the first would pay the fare twice. */
    #settling = false;

    /** A consignment handed over. */
    static async #onDeliverLot(event, target) {
        if (this.#settling) return;
        const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
        const lot = item?.system;
        if ((item?.type !== "cargo") || lot.speculative || !(lot.fare > 0) || !this.#canSettle) return;

        const day = game.settings.get("mgt2", "campaignDay");
        const late = (lot.dueDay !== null) && (day > lot.dueDay);
        let roll = null, docked = 0;
        if (late) {
            roll = await new Roll(MGT2.FreightDelivery.latePenalty).roll();
            docked = Math.round(lot.fare * roll.total * MGT2.FreightDelivery.penaltyPerPoint / 100);
        }
        const due = Math.max(0, lot.fare - docked);
        const where = SpacecraftActorSheet.#destinationOf(lot.destination)
            ?? game.i18n.localize("MGT2.Actor.spacecraft.NoDestination");

        this.#settling = true;
        try {
            const split = await CreditSplit.open({
                total: due,
                direction: "credit",
                spacecraft: this.actor.uuid,
                reason: game.i18n.format("MGT2.Trade.DeliveryReason",
                    { tons: lot.tons, lot: item.name, world: where })
            });
            if (!split) return;
            const name = item.name;
            const tons = lot.tons;
            await item.delete();
            await this.#postSettlement({
                title: "MGT2.Trade.Card.Delivered", where, roll,
                line: game.i18n.format("MGT2.Trade.Card.Consignment",
                    { lot: name, tons, credits: MGT2Helper.credits(due) }),
                late, days: late ? (day - lot.dueDay) : 0,
                percent: roll ? (roll.total * MGT2.FreightDelivery.penaltyPerPoint) : 0,
                docked: MGT2Helper.credits(docked),
                credits: MGT2Helper.credits(lot.fare)
            });
        }
        finally {
            this.#settling = false;
        }
    }

    /** Passengers ashore — the booking is deleted before the card reads the hold. */
    static async #onArrivePassage(event, target) {
        const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
        if ((item?.type !== "passage") || !this.#canSettle) return;
        const booking = item.system;
        const where = SpacecraftActorSheet.#destinationOf(booking.destination)
            ?? game.i18n.localize("MGT2.Actor.spacecraft.NoDestination");
        const grade = game.i18n.localize(
            (MGT2.PassageClasses[booking.grade] ?? MGT2.PassageClasses.middle).label);

        const { count, lowBerth } = booking;
        await item.delete();
        return this.#postSettlement({
            title: "MGT2.Trade.Card.Ashore", where,
            line: game.i18n.format("MGT2.Trade.Card.Disembark", { n: count, grade }),
            revival: lowBerth, count
        });
    }

    /** Core p.158's two ship-side modifiers to the revival check. */
    #revivalModifiers() {
        const rule = MGT2.LowBerthRevival;
        const rows = [];
        if ((MGT2Helper.tlNumber(this.actor.system.tl) ?? 0) >= rule.tl) {
            rows.push({ key: "revivalTL", label: "MGT2.Trade.RevivalTL", dm: rule.tlDM });
        }
        if (this.actor.system.lowBerths.emergency > 0) {
            rows.push({ key: "revivalEmergency", label: "MGT2.Trade.RevivalEmergency",
                dm: rule.emergencyDM });
        }
        return rows;
    }

    /** The far end, on the log — the settlement, and whatever the referee still owes it. */
    async #postSettlement({ title, where, line, roll, late, days, percent, docked, credits,
        revival, count }) {
        const hold = this.actor.system.cargo;
        const nonHuman = MGT2Helper.signed(MGT2.LowBerthRevival.nonHumanDM);
        const content = await foundry.applications.handlebars.renderTemplate(
            "systems/mgt2/templates/chat/traffic-delivery.html", {
                title, line, late, days, docked, credits, revival, count, nonHuman,
                where: game.i18n.format("MGT2.Trade.Arriving", { world: where }),
                percent,
                roll: roll?.total ?? 0,
                ship: this.actor.name,
                used: hold.used, capacity: hold.capacity
            });
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            // v14 appends no display of its own once `content` is set, so this costs the card
            // nothing and buys Dice So Nice and an auditable record.
            rolls: roll ? [roll] : [],
            content,
            flags: revival
                ? { mgt2: { revival: { ship: this.actor.name, modifiers: this.#revivalModifiers() } } }
                : {}
        });
    }

    /**
     * Core p.158: opening a low berth is a Routine (6+) Medic check with the PASSENGER's END DM,
     * so a targeted passenger lends theirs and the selected token makes the check.
     * @param {ChatMessage} message   The Ashore card, carrying what the ship contributed
     */
    static async rollRevival(message) {
        const payload = message.flags?.mgt2?.revival;
        if (!payload) return;
        const actor = canvas.tokens?.controlled.find(token => token.actor?.isOwner)?.actor;
        if (!actor) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Errors.NoOwnedTokenSelected"));
        }

        const modifiers = payload.modifiers.map(row => ({ ...row }));
        const passenger = Array.from(game.user?.targets ?? [])[0]?.actor;
        const endurance = passenger?.system.characteristics?.endurance?.dm;
        if (Number.isFinite(endurance)) {
            modifiers.push({ key: "revivalEndurance", label: "MGT2.Trade.RevivalEndurance",
                params: { name: passenger.name }, dm: endurance });
        }

        const medic = actor.items.find(item => (item.type === "talent")
            && (item.system.subType === "skill") && MGT2Helper.isFirstAidSkill(item.name));
        const label = game.i18n.localize("MGT2.Trade.Card.RevivalCheck");
        const rollOptions = {
            rollTypeName: payload.ship,
            rollObjectName: label,
            characteristics: RollPromptHelper.actorCharacteristics(actor),
            characteristic: "",
            skills: RollPromptHelper.actorSkills(actor),
            skill: medic?.id ?? "NP",
            checkModifiers: modifiers,
            difficulty: MGT2.LowBerthRevival.difficulty,
            blocks: { skill: true, range: false, traits: false },
            strengthDM: 0
        };

        const answered = await RollPromptHelper.roll(rollOptions);
        if (!answered) return;
        const { formula, modifiers: named, chainSources } =
            RollPromptHelper.terms(answered, actor, modifiers);
        if (MGT2Helper.hasValue(answered, "difficulty")) rollOptions.difficulty = answered.difficulty;

        const scored = await Checks.resolve({
            formula, rollData: actor.getRollData(),
            difficulty: rollOptions.difficulty, prompt: answered });
        if (!scored) return;
        return Checks.post(scored, {
            actor, label, mode: answered.rollMode,
            rollTypeName: payload.ship, rollObjectName: label,
            difficulty: rollOptions.difficulty,
            modifiers: named, chainSources, showButtons: true
        });
    }

    /** @this {SpacecraftActorSheet} */
    static async #onCriticalSet(event, target) {
        const location = target.closest("[data-location]").dataset.location;
        const step = Number(target.dataset.step);
        const current = this.actor.system.criticals[location] ?? 0;
        return this.actor.update({ [`system.criticals.${location}`]: (current === step) ? step - 1 : step });
    }

    /** @this {SpacecraftActorSheet} */
    static async #onCriticalClear() {
        const criticals = Object.fromEntries(Object.keys(MGT2.ShipCriticals).map(key => [key, 0]));
        return this.actor.update({ system: { criticals, hullSeverity: 0 } });
    }

    /**
     * Core p.169: severity is Effect − 5, a repeat takes `max(new, old + 1)` and caps at 6, and a
     * further hit on a 6 deals 6D that ignores armour.
     */
    static async #onCriticalRoll(event, target) {
        const panel = target.closest(".critctl");
        const location = panel.querySelector('[data-crit="location"]').value;
        const effect = Number(panel.querySelector('[data-crit="effect"]').value) || 0;
        const severity = CraftData.severityFor(effect);
        if (severity <= 0) {
            return ui.notifications.info(game.i18n.localize("MGT2.Actor.spacecraft.NoCritical"));
        }

        const result = await this.actor.system.applyCritical(location, severity);
        if (!result) return;
        const label = game.i18n.localize(MGT2.ShipCriticals[location].label);
        // The sixteen cells that raise Hull Severity instead of damaging their own location are
        // applied here rather than folded, because two of them are a 1D roll.
        const cell = this.actor.system.criticalEffect(location);
        if (cell?.hullSeverity && !result.overflow) {
            await this.actor.system.raiseHullSeverity(cell.hullSeverity);
        }

        return ui.notifications.info(result.overflow
            ? game.i18n.format("MGT2.Actor.spacecraft.CriticalOverflow",
                { location: label, damage: result.overflow.total })
            : game.i18n.format("MGT2.Actor.spacecraft.CriticalApplied",
                { location: label, severity: result.severity }));
    }

    /** Core p.171: cutting power to a system is an Engineer's action, and it is reversible. */
    static async #onPowerToggle(event, target) {
        return this.#toggleMember("system.power.offline", this.actor.system.power.offline,
            target.dataset.consumer);
    }

    /**
     * HG p.73: a package is started when it is wanted and stopped when it is not, and only what is
     * running spends Processing.
     */
    static async #onSoftwareToggle(event, target) {
        return this.#toggleMember("system.computer.running", this.actor.system.computer.running,
            target.dataset.consumer);
    }

    /**
     * HG p.20: the primary and the backup "cannot be operated simultaneously", and no book gives
     * the fallback a trigger — so it is set here and never derived.
     */
    static async #onBackupToggle(event, target) {
        return this.actor.update({ "system.computer.onBackup": !this.actor.system.computer.onBackup });
    }

    /** HG p.45 makes the second drive a temporary boost, so lighting it is the pilot's declaration. */
    static async #onBurnToggle(event, target) {
        return this.actor.update({ "system.drives.burning": !this.actor.system.drives.burning });
    }

    /** HG p.30 gives the deduction a duration and no recovery step: it is given back by hand. */
    static async #onIonClear(event, target) {
        const tracks = { power: "system.power.ionDrain", computer: "system.computer.ionDrain" };
        const path = tracks[target.dataset.track];
        if (!path) return;
        return this.actor.update({ [path]: 0 });
    }

    /** @this {SpacecraftActorSheet} */
    async #toggleMember(path, current, key) {
        const members = new Set(current);
        if (members.has(key)) members.delete(key);
        else members.add(key);
        return this.actor.update({ [path]: Array.from(members) });
    }

    /** Core p.149's two elections after a career Benefit. */
    static async #onElectMortgage(event, target) {
        const payment = target.dataset.election === "remortgage"
            ? Math.round(this.actor.system.finance.elections.remortgage.payment) : null;
        return this.actor.update({ "system.finance.mortgageOverride": payment });
    }

    /** Core p.153's check, for this hull. */
    static async #onSkipDebts(event, target) {
        return SkipDebtsDialog.open(this.actor);
    }

    /** Serves HG p.12's specialised hulls and p.13's installed options, one set each. */
    static async #onHullOptionToggle(event, target) {
        const key = target.dataset.option;
        const path = target.dataset.set === "installed" ? "installed" : "options";
        const options = new Set(this.actor.system.hull[path]);
        if (options.has(key)) options.delete(key);
        else options.add(key);
        return this.actor.update({ [`system.hull.${path}`]: Array.from(options) });
    }

    /** One handler for the four repeatable arrays. */
    static async #onRowCreate(event, target) {
        await this.submit();
        const key = target.dataset.rows;
        const rows = this.actor.system[key].map(row => ({ ...row }));
        return this.actor.update({ [`system.${key}`]: [...rows, {}] });
    }

    /** @this {SpacecraftActorSheet} */
    static async #onRowDelete(event, target) {
        await this.submit();
        const key = target.dataset.rows;
        const index = Number(target.closest("[data-row-index]").dataset.rowIndex);
        const rows = this.actor.system[key].map(row => ({ ...row })).filter((_row, i) => i !== index);
        return this.actor.update({ [`system.${key}`]: rows });
    }

    /**
     * A station's action, rolled on the crew member the slot links to — the one place the ship
     * reads a linked actor at all.
     */
    static async #onStationAction(event, target) {
        const row = target.closest("[data-row-index]");
        const station = this.actor.system.crew[Number(row.dataset.rowIndex)];
        const action = this.actor.items.get(station?.role)?.system.actions[Number(target.dataset.actionIndex)];
        if (!action) return;

        let actor = null;
        if (station.actor) {
            try { actor = foundry.utils.fromUuidSync(station.actor); } catch { actor = null; }
        }
        return SpacecraftActorSheet.rollStationAction(this.actor, action,
            { crew: actor, dutyTarget: station.dutyTarget });
    }

    /**
     * The same roll from two screens: the ship's own roster and the space combat screen.
     * @param {object} action              A `role.actions[]` record
     * @param {Actor|null} [options.crew]  Whoever is at the station, or null
     * @param {object[]} [options.extraModifiers]  The caller's own waivable modifiers
     */
    static async rollStationAction(ship, action,
        { crew: actor = null, dutyTarget = "", extraModifiers = [] } = {}) {
        if ((action.kind !== "special") && !actor) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Actor.spacecraft.NoCrewSheet"));
        }
        if (!actor) {
            return ui.notifications.info(game.i18n.format("MGT2.Actor.spacecraft.RefereeAction",
                { action: action.label }));
        }

        const system = ship.system;
        // A `weapon` action fires the mount the gunner is sitting at — `dutyTarget`, which is what
        // `MGT2.CombatDuties[duty].mount` marks the two gunner duties as needing.
        const mount = (action.kind === "weapon")
            ? SpacecraftActorSheet.#dutyMount(ship, dutyTarget) : null;
        if ((action.kind === "weapon") && !mount) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Actor.spacecraft.NoMount"));
        }

        // Core p.59: an unskilled check is DM−3, and a skill the crewman does not have is
        // unskilled.
        const skill = actor.items.find(item => (item.type === "talent")
            && (item.system.subType === "skill") && MGT2Helper.matchesSkill(item.name, action.skill));

        // The ship's own contributions ride the prompt as waivable modifiers, which is what they
        // are: a referee who rules that a critical has knocked the fire control out says so by
        // unticking it rather than by editing the ship.
        const shipModifiers = [...extraModifiers];
        if (action.dm) {
            shipModifiers.push({ key: "station", label: "MGT2.Actor.spacecraft.StationDM", dm: action.dm });
        }
        // The mount's own accuracy grade, which stands in for a scope on a vehicle or ship weapon
        // (VH p.45).
        const weapon = mount?.weapon ?? null;
        if (weapon?.system.fireControl) {
            shipModifiers.push({ key: "fireControl", label: "MGT2.Items.FireControl",
                dm: weapon.system.fireControl });
        }
        // A Sensors critical is already folded into `sensors.dm`.
        if (SpacecraftActorSheet.#shipCheck(action.skill, "sensors") && system.sensors.dm) {
            shipModifiers.push({ key: "sensors", label: "MGT2.Actor.spacecraft.SensorDM",
                dm: system.sensors.dm });
        }
        if (SpacecraftActorSheet.#shipCheck(action.skill, "navalTactics") && system.bridge.tacticsDM) {
            shipModifiers.push({ key: "tactics", label: "MGT2.Actor.spacecraft.TacticsDM",
                dm: system.bridge.tacticsDM });
        }

        // The same prompt every other check opens, seeded from the crew member's sheet: Boon and
        // Bane, the timeframe, the difficulty ladder and the chain row all come with it.
        const rollOptions = {
            rollTypeName: ship.name,
            rollObjectName: action.label,
            characteristics: RollPromptHelper.actorCharacteristics(actor),
            characteristic: action.characteristic || "",
            skills: RollPromptHelper.actorSkills(actor),
            skill: skill?.id ?? "NP",
            checkModifiers: shipModifiers,
            difficulty: action.difficulty,
            damageFormula: weapon?.system.damage ?? null,
            // A ship weapon reaches in range BANDS, which Core p.74's ground table does not speak;
            // its traits are not offered here either, and that is the entry's remaining half.
            blocks: { skill: true, range: false, traits: false },
            strengthDM: actor.system.characteristics.strength?.dm ?? 0
        };

        const userRollData = await RollPromptHelper.roll(rollOptions);
        if (!userRollData) return; // dialog dismissed

        const { formula, modifiers, chainSources } =
            RollPromptHelper.terms(userRollData, actor, shipModifiers);
        if (MGT2Helper.hasValue(userRollData, "difficulty")) {
            rollOptions.difficulty = userRollData.difficulty;
        }

        // A station action scores an Effect like any other check, so it can feed a chain too — Core
        // p.166's Aid Gunners is exactly that shape.
        const scored = await Checks.resolve({
            formula, rollData: actor.getRollData(),
            difficulty: rollOptions.difficulty, prompt: userRollData
        });
        if (!scored) return;

        const flags = { mgt2: {} };

        // A fired mount carries the whole damage payload, so the card the defender resolves knows
        // what the mount is worth.
        if (weapon?.system.damage) {
            const traits = weapon.system.traits;
            flags.mgt2.damage = {
                formula: mount.linkedBonus
                    ? `${weapon.system.damage} + ${mount.linkedBonus}` : weapon.system.damage,
                rollObjectName: weapon.name,
                rollTypeName: game.i18n.localize(mount.typeLabel),
                effect: scored.effect,
                strengthDM: 0,
                scale: weapon.system.scale ?? "spacecraft",
                multiple: mount.multiple,
                ap: MGT2Helper.traitScore(traits, "ap"),
                loPen: MGT2Helper.traitScore(traits, "lo-pen"),
                stun: MGT2Helper.hasTrait(traits, "stun"),
                destructive: MGT2Helper.hasTrait(traits, "destructive"),
                damageType: Array.from(weapon.system.damageType ?? [])
            };
        }

        // The same card every other check posts.
        return Checks.post(scored, {
            actor,
            label: action.label,
            flags,
            mode: userRollData.rollMode,
            // The ship names the context the action was taken in; the crewman is already the
            // message's speaker.
            rollTypeName: ship.name,
            rollObjectName: action.label,
            difficulty: rollOptions.difficulty,
            modifiers,
            chainSources,
            showButtons: true,
            showRollDamage: Boolean(flags.mgt2.damage),
            damageCarriesEffect: true
        });
    }

    /** Whether a station action's free-text skill is any name an `MGT2.ShipCheckSkills` row prints. */
    static #shipCheck(name, key) {
        const row = MGT2.ShipCheckSkills[key];
        const text = String(name ?? "").toLowerCase();
        return row.skills.some(entry => MGT2Helper.matchesSkill(name, entry))
            && row.specialities.some(entry => text.includes(entry));
    }

    /**
     * The mount a gunner's `dutyTarget` names — an index, or a label, matched case-insensitively.
     */
    static #dutyMount(ship, dutyTarget) {
        const rows = SpacecraftActorSheet.#mounts(ship.system, ship.items.filter(i => i.type === "weapon"));
        const wanted = String(dutyTarget ?? "").trim();
        if (!wanted) return null;
        const index = Number(wanted);
        // The hardpoint budget prints `Mount 1` for the first mount, so a typed number is 1-based.
        const named = entry => (entry.label
            || game.i18n.format("MGT2.Actor.spacecraft.MountN", { n: entry.index + 1 })).trim().toLowerCase();
        const row = Number.isInteger(index) ? rows.rows[index - 1]
            : rows.rows.find(entry => named(entry) === wanted.toLowerCase());
        if (!row?.weapons.length) return null;
        return { ...row, weapon: row.weapons[0] };
    }

    /** How many dice a damage expression rolls, for Core p.168's +1 per die per linked weapon. */
    static #damageDice(formula) {
        const match = /(\d*)\s*[dD]/.exec(String(formula ?? ""));
        if (!match) return 0;
        return match[1] ? Number(match[1]) : 1;
    }

    /** The link is a stored UUID and nothing here reads the canvas. @this {SpacecraftActorSheet} */
    static async #onOpenCraft(event, target) {
        const uuid = target.closest("[data-uuid]")?.dataset.uuid;
        if (!uuid) return;
        const document = await fromUuid(uuid);
        return document?.sheet?.render(true);
    }

    /** A person dropped on a station row takes it. @inheritDoc */
    async _onDrop(event) {
        const data = MGT2Helper.getDataFromDropEvent(event);
        if (data?.type !== "Actor") return this.#onDropItem(event, data);
        if (!this.isEditable) return false;

        const actor = await fromUuid(data.uuid);
        // Only these two may be dropped here: a ship's crew is people, and a `spacecraft` would be
        // asking for a carried craft, which is the bay's question and not this one.
        if (!["character", "npc"].includes(actor?.type)) {
            ui.notifications.warn(game.i18n.localize("MGT2.Actor.spacecraft.NotCrew"));
            return false;
        }

        const index = Number(event.target.closest("[data-row-index]")?.dataset.rowIndex ?? -1);
        const crew = this.actor.system.crew.map(station => ({ ...station }));
        if (crew[index]) crew[index].actor = actor.uuid;
        else crew.push({ actor: actor.uuid, name: actor.name });
        await this.actor.update({ "system.crew": crew });
        return true;
    }

    /**
     * A ship takes parts, not luggage.
     * @param {object} data   The drop payload, already parsed
     */
    async #onDropItem(event, data) {
        if (!data) return false;
        if (Hooks.call("dropActorSheetData", this.actor, this, data) === false) return false;
        if (!this.isEditable) return false;
        const item = await MGT2Helper.getItemDataFromDropData(data);
        if (!item) return false;
        if (!SpacecraftActorSheet.DROP_ITEM_TYPES.has(item.type)) {
            ui.notifications.warn(game.i18n.format("MGT2.Errors.NotForThisSheet",
                { type: game.i18n.localize(CONFIG.Item.typeLabels[item.type] ?? item.type) }));
            return false;
        }
        await this.actor.createEmbeddedDocuments("Item", [MGT2Helper.stripIds(item)]);
        return true;
    }

    /** A zone refuses at the pointer or not at all — after the drop is too late to be feedback. */
    _onDragOver(event) {
        const zone = event.target.closest("[data-accept]");
        for (const node of this.element.querySelectorAll(".over, .deny")) {
            if (node !== zone) node.classList.remove("over", "deny");
        }
        if (!zone) return super._onDragOver(event);
        const accepted = MGT2Helper.dropAccepted(zone);
        zone.classList.toggle("over", accepted);
        zone.classList.toggle("deny", !accepted);
    }
}
