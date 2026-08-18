import { MGT2 } from "./config.js";
import { SpaceCombatData } from "./combat.js";
import { SALVO } from "./fleet.js";

const { DialogV2 } = foundry.applications.api;
const { TokenRuler } = foundry.canvas.placeables.tokens;

/** What makes a scene a space scene. */
const SPACE_FLAG = "space";

/** Kilometres per grid unit, stated by a Level for itself. */
const KM_PER_UNIT = "kmPerUnit";

/** Which of the four scales a Level is. With `kmPerUnit`, the whole of what this system writes there. */
const SPACE_LEVEL = "spaceLevel";

/**
 * Kilometres per measured unit on a token's own Level, or `null` where this is not a space scene —
 * which is the passthrough the whole feature's safety rests on.
 * @returns {number|null}
 */
function kmFactor(token) {
    const scene = token?.parent ?? canvas.scene;
    if ( !scene?.flags?.mgt2?.[SPACE_FLAG] ) return null;
    const perUnit = scene.grid.distance;
    if ( !(perUnit > 0) ) return null;
    const level = scene.levels?.get(token.level);
    const km = Number(level?.flags?.mgt2?.[KM_PER_UNIT] ?? perUnit);
    return (km > 0) ? (km / perUnit) : 1;
}

/**
 * The ruler on a space scene, which says the range band instead of a grid figure.
 * @extends {TokenRuler}
 */
export class MGT2TokenRuler extends TokenRuler {

    /** The reading a distance earns: the band Core folio 165 names it, and the kilometres it is. */
    static rangeLabel(km) {
        const band = MGT2.ShipRangeBands[SpaceCombatData.bandForKm(km)];
        return game.i18n.format("MGT2.Canvas.RangeLabel", {
            band: game.i18n.localize(band.label),
            km: km.toNearest(0.01).toLocaleString(game.i18n.lang)
        });
    }

    /**
     * Core ends the measurement half of the context with `context.distance = {total:
     * waypoint.measurement.distance.toNearest(0.01).toLocaleString(...)}` then `context.cost =
     * {total: ..., units: canvas.grid.units}` (`client/canvas/placeables/tokens/ruler.mjs`,
     * `_getWaypointLabelContext`).
     * @inheritDoc
     */
    _getWaypointLabelContext(waypoint, state) {
        const context = super._getWaypointLabelContext(waypoint, state);
        const factor = context ? kmFactor(this.token.document) : null;
        if ( factor === null ) return context;
        const refusal = scaleRefusal(waypoint);
        const total = refusal ? game.i18n.localize(refusal)
            : MGT2TokenRuler.rangeLabel(waypoint.measurement.distance * factor);
        // The unit is inside the formatted string, so the suffix both branches append after it —
        // `{{cost.total}} {{cost.units}}` and `{{distance.total}} {{units}}` — has to go.
        context.units = "";
        context.distance.total = total;
        context.cost.total = total;
        context.cost.units = "";
        if ( refusal ) {
            delete context.distance.delta;
            delete context.cost.delta;
        }
        else if ( "delta" in context.distance ) {
            const delta = (waypoint.measurement.backward.distance * factor).toNearest(0.01).signedString();
            context.distance.delta = delta;
            context.cost.delta = delta;
        }
        return context;
    }
}

/** Why a path has no single reading, or `null` where it has one. @returns {string|null} */
function scaleRefusal(waypoint) {
    for ( let w = waypoint; w?.previous; w = w.previous ) {
        if ( w.level !== w.previous.level ) return "MGT2.Canvas.RangeCrossLevel";
        if ( w.elevation !== w.previous.elevation ) return "MGT2.Canvas.RangeElevation";
    }
    return null;
}

/** A refusal is a sentence naming what failed, never a silent no-op and never a guess. */
function refuse(key, data) {
    ui.notifications.warn(data ? game.i18n.format(key, data) : game.i18n.localize(key));
    return null;
}

/**
 * The one place the canvas writes to the band map, and it writes in ONE direction: a measurement
 * becomes a band, and a stored band never moves a token.
 * @returns {Promise<Combat|null>}
 */
export async function setBandFromTokens() {
    if ( !game.user.isGM ) return refuse("MGT2.SpaceCombat.NoPermission");

    const controlled = canvas.tokens?.controlled ?? [];
    if ( controlled.length !== 2 ) return refuse("MGT2.Canvas.NeedTwo");
    const [a, b] = controlled.map(token => token.document);

    const factor = kmFactor(a);
    if ( factor === null ) return refuse("MGT2.Canvas.NotSpaceScene");
    // Two Levels of one scene are drawn at two scales, so a path across them is not a distance —
    // the factor is per-Level and a pair spanning two of them has no single one.
    if ( a.level !== b.level ) return refuse("MGT2.Canvas.LevelSplit");
    // And the ruler's other refusal, for the same reason: elevation is the levels' sort key here,
    // not a height, so a difference between two tokens would fold an ordinal into the range.
    if ( a.elevation !== b.elevation ) return refuse("MGT2.Canvas.ElevationSplit");

    const combat = game.combat;
    if ( typeof combat?.system?.setBand !== "function" ) return refuse("MGT2.Canvas.NoCombat");

    const groups = [];
    for ( const token of [a, b] ) {
        const combatant = combat.getCombatantsByToken(token)[0];
        if ( !combatant ) return refuse("MGT2.Canvas.NotInCombat", { name: token.name });
        // HG folio 124 moves a salvo "as if it were a ship" and the band map still refuses it: the
        // map is keyed by two FLEETS, and a flight of missiles is where IT is, not where the fleet
        // that fired it is.
        if ( combatant.type === SALVO ) return refuse("MGT2.Canvas.SalvoPosition", { name: token.name });
        const group = combat.groups.get(combatant._source.group);
        if ( !group ) return refuse("MGT2.Canvas.NoGroup", { name: token.name });
        groups.push(group);
    }
    if ( groups[0].id === groups[1].id ) {
        return refuse("MGT2.Canvas.SameGroup", { name: groups[0].name });
    }

    // Centre to centre, which core's own ruler does not do: `measureMovementPath` measures between
    // anchor points, and on a gridless scene the anchor is the token's top-left corner
    // (`client/documents/token.mjs`, "Measure between anchor points, which lie in the top-left grid
    // offset").
    const km = canvas.grid.measurePath([a.getCenterPoint(), b.getCenterPoint()]).distance * factor;
    await combat.system.setBand(groups[0], groups[1], SpaceCombatData.bandForKm(km));
    ui.notifications.info(game.i18n.format("MGT2.Canvas.BandSet", {
        a: groups[0].name, b: groups[1].name, range: MGT2TokenRuler.rangeLabel(km)
    }));
    return combat;
}

/**
 * What a space scene is configured to, and the arithmetic behind 1 250: the canvas is square, so 2
 * 000 px from centre is 20 grid units and therefore 25 000 km — the outer edge of Long.
 */
const SPACE_SCENE = Object.freeze({ size: 4096, gridSize: 100, kmPerUnit: 1250, units: "km" });

/** The four scales, innermost first, and the whole of what a Level states about itself. */
const SPACE_LEVELS = Object.freeze([
    { key: "contact", kmPerUnit: 0.5, elevation: { bottom: -2, top: -1 }, color: "#2b1a1a" },
    { key: "approach", kmPerUnit: 62.5, elevation: { bottom: -1, top: 0 }, color: "#2b2318" },
    { key: "engagement", kmPerUnit: 1250, elevation: { bottom: 0, top: 1 }, color: "#15242b" },
    { key: "theatre", kmPerUnit: 15000, elevation: { bottom: 1, top: 2 }, color: "#191a2b" }
]);

/** The scale a scene has before it has Levels, and therefore the one that reuses its existing Level. */
const ENGAGEMENT = "engagement";

/** The four Levels' names, localised in the order they are drawn. */
function levelNames() {
    return SPACE_LEVELS.map(level => game.i18n.localize(`MGT2.Canvas.Levels.${level.key}`));
}

/** Write the four Levels, and answer the one to make initial. @returns {Promise<string|null>} */
async function configureSpaceLevels(scene) {
    const existing = new Map();
    for ( const level of scene.levels ) {
        const key = level.flags?.mgt2?.[SPACE_LEVEL];
        if ( key && !existing.has(key) ) existing.set(key, level.id);
    }
    if ( !existing.has(ENGAGEMENT) ) {
        const reused = scene.levels.get(foundry.documents.BaseScene.metadata.defaultLevelId)
            ?? scene.levels.sorted[0];
        // Only a Level no scale has claimed: two keys on one Level would send two updates to one id.
        if ( reused && !reused.flags?.mgt2?.[SPACE_LEVEL] ) existing.set(ENGAGEMENT, reused.id);
    }

    const names = levelNames();
    const updates = [];
    const creations = [];
    for ( const [sort, level] of SPACE_LEVELS.entries() ) {
        // No `background.src`: a scale needs a colour and nothing else, and leaving the field alone
        // keeps whatever art a referee put there of their own accord.
        const data = {
            name: names[sort], sort,
            elevation: { ...level.elevation },
            background: { color: level.color },
            visibility: { levels: [] },
            flags: { mgt2: { [SPACE_LEVEL]: level.key, [KM_PER_UNIT]: level.kmPerUnit } }
        };
        const id = existing.get(level.key);
        if ( id ) updates.push({ _id: id, ...data });
        else creations.push(data);
    }
    if ( updates.length ) await scene.updateEmbeddedDocuments("Level", updates);
    if ( creations.length ) await scene.createEmbeddedDocuments("Level", creations);
    return scene.levels.find(level => level.flags?.mgt2?.[SPACE_LEVEL] === ENGAGEMENT)?.id ?? null;
}

/** Foundry's own level-change prompt, wired rather than forked. */
const CHANGE_LEVEL = "changeLevel";

/** The one movement action the prompt offers. */
const TRANSITION_ACTION = "fly";

/** The two thresholds, in pixels from the scene centre. */
const TRANSITION_RADIUS = Object.freeze({ edge: 2000, centre: 100 });

/** Which of the two transition Regions a Region is, and the whole of what this system writes on one. */
const SPACE_REGION = "spaceRegion";

/** The two of them, outward first. */
const SPACE_REGIONS = Object.freeze([
    { key: "edge", color: "#e08a3c" },
    { key: "centre", color: "#4fc3e8" }
]);

/**
 * Where a scale change is offered, in the coordinates a placeable is actually stored in — which are
 * the *canvas*'s and not the scene's.
 * @returns {object[]}
 */
function regionShapes(key, scene) {
    const { x, y } = scene.dimensions.sceneRect.center;
    if ( key === "edge" ) {
        // The hole follows what it cuts: core skips leading holes, then differences each run of them
        // from the shapes before it (`client/documents/region.mjs`, `#buildClipperBatches`).
        const { width, height } = scene.dimensions.rect;
        return [
            { type: "rectangle", x: 0, y: 0, width, height },
            { type: "circle", x, y, radius: TRANSITION_RADIUS.edge, hole: true }
        ];
    }
    return [{ type: "circle", x, y, radius: TRANSITION_RADIUS.centre }];
}

/** Core's behaviour, unforked, named as core would name it. */
function changeLevelBehavior() {
    return {
        type: CHANGE_LEVEL,
        name: game.i18n.localize(CONFIG.RegionBehavior.typeLabels[CHANGE_LEVEL]),
        system: { movementActions: [TRANSITION_ACTION] }
    };
}

/**
 * Write the two Regions a referee changes scale through: reaching the edge zooms out, reaching the
 * centre zooms in.
 * @returns {Promise<void>}
 */
async function configureSpaceRegions(scene) {
    const existing = new Map();
    for ( const region of scene.regions ) {
        const key = region.flags?.mgt2?.[SPACE_REGION];
        if ( key && !existing.has(key) ) existing.set(key, region.id);
    }

    const updates = [];
    const creations = [];
    for ( const region of SPACE_REGIONS ) {
        const data = {
            name: game.i18n.localize(`MGT2.Canvas.Regions.${region.key}`),
            color: region.color,
            shapes: regionShapes(region.key, scene),
            elevation: { bottom: null, top: null },
            levels: [],
            // Drawn for everyone without anybody activating the Regions layer
            // (`common/constants.mjs`, `REGION_VISIBILITY` — ALWAYS, "Always visible to anyone").
            visibility: CONST.REGION_VISIBILITY.ALWAYS,
            flags: { mgt2: { [SPACE_REGION]: region.key } }
        };
        const id = existing.get(region.key);
        if ( id ) updates.push({ _id: id, ...data });
        else creations.push({ ...data, behaviors: [changeLevelBehavior()] });
    }
    if ( updates.length ) await scene.updateEmbeddedDocuments("Region", updates);
    if ( creations.length ) await scene.createEmbeddedDocuments("Region", creations);

    // A behaviour is never sent in an update: an embedded collection in one would fight whatever a
    // referee added of their own.
    for ( const id of existing.values() ) {
        const region = scene.regions.get(id);
        if ( !region || region.behaviors.some(behavior => behavior.type === CHANGE_LEVEL) ) continue;
        await region.createEmbeddedDocuments("RegionBehavior", [changeLevelBehavior()]);
    }
}

/**
 * Configure a scene for space combat. It configures and creates no art and no drawings.
 * @returns {Promise<Scene|null>}
 */
export async function configureSpaceScene(scene) {
    if ( !game.user.isGM ) return refuse("MGT2.Canvas.NotGM");
    if ( !scene ) return null;

    const levels = levelNames().join(" · ");
    const confirmed = await DialogV2.confirm({
        window: { title: "MGT2.Canvas.ConfigureScene" },
        classes: ["mgt2"],
        content: `<p>${game.i18n.format("MGT2.Canvas.ConfigureSceneHint", {
            name: scene.name, size: SPACE_SCENE.size, levels
        })}</p>`
    });
    if ( !confirmed ) return null;

    // Idempotent, and it has to stay so: the scalar fields are frozen constants, a Level is matched
    // by its own `spaceLevel` flag and a Region by its own `spaceRegion` flag, so a second run
    // updates the same four and the same two rather than creating a fifth and a third.
    const initialLevel = await configureSpaceLevels(scene);
    await scene.update({
        width: SPACE_SCENE.size,
        height: SPACE_SCENE.size,
        grid: {
            type: CONST.GRID_TYPES.GRIDLESS,
            size: SPACE_SCENE.gridSize,
            distance: SPACE_SCENE.kmPerUnit,
            units: SPACE_SCENE.units
        },
        ...(initialLevel ? { initialLevel } : {}),
        flags: { mgt2: { [SPACE_FLAG]: true } }
    });
    // After the resize, never before: a Region's shapes are canvas coordinates, and the canvas the
    // scene centre sits in is the one this update just sized.
    await configureSpaceRegions(scene);
    ui.notifications.info(game.i18n.format("MGT2.Canvas.SceneConfigured", { name: scene.name, levels }));
    return scene;
}

/** The ruler is global; the scene flag is what keeps every non-space scene untouched. */
export function registerSpaceCanvas() {
    CONFIG.Token.rulerClass = MGT2TokenRuler;
    // The token controls, because the control's whole input is the canvas SELECTION and nothing
    // else reads it: a Token HUD entry or a tracker row is anchored to one document and would have
    // to guess the second.
    Hooks.on("getSceneControlButtons", controls => {
        const tools = controls.tokens?.tools;
        if ( !tools ) return;
        tools.setRangeBand = {
            name: "setRangeBand",
            order: Math.max(...Object.values(tools).map(tool => tool.order ?? 0)) + 1,
            title: "MGT2.Canvas.SetBand",
            icon: "fa-solid fa-ruler-horizontal",
            button: true,
            visible: game.user.isGM,
            onChange: () => setBandFromTokens()
        };
    });

    // The scene directory rather than the canvas controls, because the input is a scene NAMED and
    // not a selection: a scene is scaffolded once, before anybody views it, and the controls only
    // ever reach the scene already on screen.
    Hooks.on("getSceneContextOptions", (application, options) => {
        options.push({
            label: "MGT2.Canvas.ConfigureScene",
            icon: '<i class="fa-solid fa-satellite"></i>',
            visible: game.user.isGM,
            onClick: (event, li) => configureSpaceScene(application.collection
                .get(li.closest("[data-entry-id]").dataset.entryId))
        });
    });
}
