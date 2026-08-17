import { MGT2 } from "./config.js";
import { SpaceCombatData } from "./combat.js";
import { SALVO } from "./fleet.js";

const { DialogV2 } = foundry.applications.api;
const { TokenRuler } = foundry.canvas.placeables.tokens;

/**
 * What makes a scene a space scene. A scene either is one or it is not, so this is configuration
 * rather than a rule and deliberately **not** an optional-rules switch.
 */
const SPACE_FLAG = "space";

/**
 * Kilometres per grid unit, stated by a Level for itself. A Level that does not state a scale is
 * read at the scene's own `grid.distance`, which makes the factor 1 and the label true on an
 * ordinary single-level scene already measured in kilometres.
 */
const KM_PER_UNIT = "kmPerUnit";

/** Which of the four scales a Level is. With `kmPerUnit`, the whole of what this system writes there. */
const SPACE_LEVEL = "spaceLevel";

/**
 * Kilometres per measured unit on a token's own Level, or `null` where this is not a space scene —
 * which is the passthrough the whole feature's safety rests on. Shared by the ruler and by the band
 * control, so the label a referee reads and the band they write are one conversion.
 * @param {TokenDocument} token
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
 * The ruler on a space scene, which says the range band instead of a grid figure. **The scene is a
 * view and never the truth**: nothing here writes a band, so `SpaceCombatData.bands` stays what
 * `FleetAttack` reads and removing this module leaves every battle resolving as it did.
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
     * Core ends the measurement half of the context with
     * `context.distance = {total: waypoint.measurement.distance.toNearest(0.01).toLocaleString(...)}`
     * then `context.cost = {total: ..., units: canvas.grid.units}`
     * (`client/canvas/placeables/tokens/ruler.mjs`, `_getWaypointLabelContext`). That method is
     * `@protected` and is the only non-public API this feature touches: if a build moves it the cost
     * is a wrong label, not a broken scene.
     *
     * **Both are rewritten, because only one of them is ever drawn.**
     * `templates/hud/waypoint-label.hbs` opens with `{{#if cost}}` and core assigns `context.cost`
     * unconditionally, so the `distance` branch is dead in practice — the two agree in core only
     * because movement cost equals distance over open ground. The band is read off
     * `measurement.distance` all the same: terrain multiplies cost, and a band is a distance.
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
        // `{{cost.total}} {{cost.units}}` and `{{distance.total}} {{units}}` — has to go. Elevation
        // shares `units` and loses its own, and now for a checked reason rather than an unchecked
        // one: what core prints there is `waypoint.elevation - canvas.level.elevation.base`, and on
        // a space scene that base is a sort key, so no unit name is true of the number.
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

/**
 * Why a path has no single reading, or `null` where it has one. Both answers are refusals rather
 * than conversions, and the second one is a defect of step 1 that only four Levels could expose.
 *
 * Gridless measures `hypot(Δx, Δy, Δelev / distance × size) / size × distance`
 * (`common/grid/gridless.mjs`, `_measurePath`). The planar terms are pixels, so `grid.distance`
 * cancels and `kmFactor` turns them into true kilometres — but Δelev enters divided by `distance`
 * and leaves multiplied by it, so it passes through **already in kilometres** and the same factor
 * rescales a figure that was right. Multiplying the combined total made an elevation of 1 000 km
 * read as 0.4 km on Contact (`0.5 / 1250`); Engagement's factor is 1, so three levels of four were
 * wrong and the fourth hid it.
 *
 * The answer is not to convert the elevation term, because `SPACE_LEVELS` spends `Level#elevation`
 * as the levels' sort key: a level's elevation zero is a position in a list, core sets a token's
 * elevation to that zero when it changes level
 * (`client/data/region-behaviors/change-level.mjs`, `token.move({elevation: destinationLevel.elevation.base, …})`),
 * and a level's entire vertical room is one kilometre. A range read off an axis whose origin and
 * extent were assigned for ordering is not a range. So the path is named instead of numbered — and
 * the same walk catches the level crossing, where two scales meet and no one figure is either.
 * @param {DeepReadonly<TokenRulerWaypoint>} waypoint
 * @returns {string|null}
 */
function scaleRefusal(waypoint) {
    for ( let w = waypoint; w?.previous; w = w.previous ) {
        if ( w.level !== w.previous.level ) return "MGT2.Canvas.RangeCrossLevel";
        if ( w.elevation !== w.previous.elevation ) return "MGT2.Canvas.RangeElevation";
    }
    return null;
}

/* -------------------------------------------- */

/** A refusal is a sentence naming what failed, never a silent no-op and never a guess. */
function refuse(key, data) {
    ui.notifications.warn(data ? game.i18n.format(key, data) : game.i18n.localize(key));
    return null;
}

/**
 * The one place the canvas writes to the band map, and it writes in ONE direction: a measurement
 * becomes a band, and a stored band never moves a token. Nothing calls this but a GM clicking it —
 * no `updateToken` hook, nothing on drag — because the scene is a view and a referee dragging a ship
 * is rehearsing rather than ruling.
 *
 * Which sub-type is running is duck-typed rather than tested, the way `MGT2Combatant` picks an
 * Initiative formula: `space` keys its map by two SHIP groups and `fleet` by two FLEET groups, both
 * through `SpaceCombatData.pairKey`, so either answers this unchanged.
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
        // that fired it is. Measuring from one would write a range nobody is at.
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
    // offset"). Two ships of different sizes would then measure from two different parts of
    // themselves. `getCenterPoint()` carries the elevation, which the refusal above has made equal,
    // so the elevation term of the gridless hypot is zero and the reading is planar.
    const km = canvas.grid.measurePath([a.getCenterPoint(), b.getCenterPoint()]).distance * factor;
    await combat.system.setBand(groups[0], groups[1], SpaceCombatData.bandForKm(km));
    ui.notifications.info(game.i18n.format("MGT2.Canvas.BandSet", {
        a: groups[0].name, b: groups[1].name, range: MGT2TokenRuler.rangeLabel(km)
    }));
    return combat;
}

/* -------------------------------------------- */

/**
 * What a space scene is configured to, and the arithmetic behind 1 250: the canvas is square, so
 * 2 000 px from centre is 20 grid units and therefore 25 000 km — the outer edge of Long. One grid
 * unit is Short's own outer edge, the corners reach Very Long and the far edge is already past
 * Distant's 50 001 km, so the whole ladder is on the one canvas. Adjacent and Close are sub-pixel:
 * that is the 300 000:1 problem four Levels exist to dissolve, and this scale states it rather than
 * hides it.
 *
 * `units` is stored document data the way `system.json`'s own `"m"` is, not an interface string —
 * localising it would stamp a shared scene with whichever language its referee ran the tool in.
 */
const SPACE_SCENE = Object.freeze({ size: 4096, gridSize: 100, kmPerUnit: 1250, units: "km" });

/**
 * The four scales, innermost first, and the whole of what a Level states about itself. `kmPerUnit`
 * is per `SPACE_SCENE.gridSize` pixels, sized so that the 2 000 px of useful radius puts each
 * level's outer edge at the top of its last band — 10 km, 1 250 km, 25 000 km, 300 000 km. No level
 * exceeds 20:1 internally, so every distance on every level is drawn to true scale, and the
 * non-linearity Mongoose had to print as a chart lives in the navigation between levels instead: on
 * each level, the centre is the level below. Engagement's scale is `grid.distance` itself, so a
 * scene that has not been scaffolded already reads at Engagement.
 *
 * **`elevation` is a sort key here, not an altitude, and the abuse is deliberate.** What orders the
 * navigation is `sort` (`client/documents/scene.mjs`,
 * `const levelsSorted = this.levels.contents.sort((a, b) => a.sort - b.sort)`) — but a Level still
 * has an elevation range, core sends a token to `elevation.base` when it changes level, and core
 * prints a token's elevation relative to that base. Four contiguous one-unit ranges give each scale
 * an unambiguous home and spend as little of the axis as possible; Engagement's starts at 0 so that
 * every token already on a scene keeps the elevation it has. **What it costs**: a token has to sit
 * inside its own level's range, so a level carries one kilometre of vertical room and no more —
 * which is why elevation is out of scope for the reading (see `scaleRefusal`).
 *
 * `visibility.levels` is empty on all four: these are scales, not storeys, so a ship drawn from
 * another one would sit at a position that means nothing. Each sees only itself.
 */
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

/**
 * Write the four Levels, and answer the one to make initial.
 *
 * **The scene's own Level becomes Engagement rather than a fifth being created**, and that reuse is
 * not tidiness: a Token created without an explicit Level is on `defaultLevel0000`
 * (`common/documents/token.mjs`, `initial: foundry.documents.BaseScene.metadata.defaultLevelId`),
 * and Engagement's scale is the `grid.distance` those tokens were already read at — so every token
 * on the scene keeps its reading and its elevation, and nothing needs migrating.
 *
 * A name is localised because it is a name: core's own default Level name is stored localised
 * (`client/documents/scene.mjs`, `name: foundry.documents.Level.defaultName({parent: this})`).
 * `grid.units` is not, and the difference is that "km" has no translation to be wrong about.
 * @param {Scene} scene
 * @returns {Promise<string|null>}
 */
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

/* -------------------------------------------- */

/** Foundry's own level-change prompt, wired rather than forked. */
const CHANGE_LEVEL = "changeLevel";

/**
 * The one movement action the prompt offers. A ship changing scale is not walking, and naming a
 * single action collapses core's dialog to the one question that matters — which scale — because it
 * writes the action select as `disabled: selectableActions.size <= 1`
 * (`client/data/region-behaviors/change-level.mjs`, `#confirmDialog`). An empty set means *all*
 * actions there, not none ("If no actions are selected, all movement actions are allowed"), so it
 * would offer nine.
 */
const TRANSITION_ACTION = "fly";

/**
 * The two thresholds, in pixels from the scene centre.
 *
 * `edge` is the useful radius of the square scene — `SPACE_LEVELS` sizes every scale so that its
 * last band ends there — so crossing it outward is leaving the widest range this level can draw.
 *
 * `centre` is **not** a measurement, and deliberately so: the geometrically exact centre threshold
 * on Approach is 16 px across, which nobody can drag a token into. It is a control.
 */
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
 * the *canvas*'s and not the scene's. `getDimensions` seats the scene rect at `sceneX, sceneY`
 * inside a canvas enlarged by `padding` (`client/documents/scene.mjs`,
 * `sceneRect: new PIXI.Rectangle(sceneX, sceneY, sceneWidth, sceneHeight)`), so the centre of a
 * 4096-square scene is 3 148 px at the default padding of 0.25 and never 2 048. This is why the
 * Regions are written after the scene is resized and not before.
 *
 * The edge rectangle covers the whole canvas rather than the scene: r = 2 000 leaves only 48 px of
 * scene beyond it at the axes, and a token cannot be dragged into that.
 * @param {string} key
 * @param {Scene} scene
 * @returns {object[]}
 */
function regionShapes(key, scene) {
    const { x, y } = scene.dimensions.sceneRect.center;
    if ( key === "edge" ) {
        // The hole follows what it cuts: core skips leading holes, then differences each run of them
        // from the shapes before it (`client/documents/region.mjs`, `#buildClipperBatches`,
        // `clipType: isHole ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctUnion`).
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
 *
 * **Core's own `changeLevel` behaviour, and no sub-type of ours.** It is a GM aid, so it stages
 * rather than computes. Two consequences are accepted rather than engineered around: it always
 * confirms through a dialog (`#confirmDialog` is hard-wired, with no schema switch), and it
 * **preserves the token's pixel position** — `token.move({elevation: destinationLevel.elevation.base,
 * level: destinationLevel.id, action: selectedAction})` writes no `x`/`y`, so a ship at the edge of
 * Engagement arrives at the edge of Theatre rather than at the point that is the same true distance.
 *
 * **`levels` is left empty, and that is what makes two Regions enough for four scales.**
 * `#getDestinationLevels` reads `if ( !region.levels.size ) levels =
 * region.parent.levels.reverseSorted.filter(l => l.id !== token._source.level)`, so an empty set
 * spans every Level and the dialog offers all the others. `elevation` spans everything for the same
 * reason: `SPACE_LEVELS` spends the axis as a sort key across −2…2, and a Region that stopped
 * anywhere on it would stop at a scale.
 * @param {Scene} scene
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
    // referee added of their own. A re-run only supplies the one that went missing.
    for ( const id of existing.values() ) {
        const region = scene.regions.get(id);
        if ( !region || region.behaviors.some(behavior => behavior.type === CHANGE_LEVEL) ) continue;
        await region.createEmbeddedDocuments("RegionBehavior", [changeLevelBehavior()]);
    }
}

/**
 * Configure a scene for space combat. It configures and creates no art and no drawings.
 *
 * **`grid.distance` is Engagement's scale, and the scale of a space scene that has no Levels.**
 * Gridless measures `hypot(Δx, Δy, Δelev / distance × size) / size × distance`
 * (`common/grid/gridless.mjs`, `_measurePath`) and `kmFactor` above multiplies that by
 * `kmPerUnit / distance`. The planar terms are pixels, so `distance` cancels exactly and true km is
 * `pixels / size × kmPerUnit` — a Level stating its own scale therefore overrides the number written
 * here outright. It cancels out of the elevation term too, which enters divided by `distance` and
 * leaves multiplied by it: an elevation is typed and read in plain `grid.units`, which is why the
 * factor must never be applied to it and why `scaleRefusal` exists.
 * @param {Scene} scene
 * @returns {Promise<Scene|null>}
 */
export async function configureSpaceScene(scene) {
    if ( !game.user.isGM ) return refuse("MGT2.Canvas.NotGM");
    if ( !scene ) return null;

    const levels = levelNames().join(" · ");
    const confirmed = await DialogV2.confirm({
        window: { title: "MGT2.Canvas.ConfigureScene" },
        content: `<p>${game.i18n.format("MGT2.Canvas.ConfigureSceneHint", {
            name: scene.name, size: SPACE_SCENE.size, levels
        })}</p>`
    });
    if ( !confirmed ) return null;

    // Idempotent, and it has to stay so: the scalar fields are frozen constants, a Level is matched
    // by its own `spaceLevel` flag and a Region by its own `spaceRegion` flag, so a second run
    // updates the same four and the same two rather than creating a fifth and a third.
    // `initialLevel` is Engagement deliberately — it is the Level tokens default to, and the scale
    // the scene read at before it had any.
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

/* -------------------------------------------- */

/** The ruler is global; the scene flag is what keeps every non-space scene untouched. */
export function registerSpaceCanvas() {
    CONFIG.Token.rulerClass = MGT2TokenRuler;
    // The token controls, because the control's whole input is the canvas SELECTION and nothing else
    // reads it: a Token HUD entry or a tracker row is anchored to one document and would have to
    // guess the second. The hook fires on every prepare, so `visible` re-reads the GM gate.
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
    // ever reach the scene already on screen. `DocumentDirectory` passes `parentClassHooks: false`
    // for its entry menu ("hookName: `get${this.documentName}ContextOptions`",
    // `client/applications/sidebar/document-directory.mjs`), so this bare name is the whole of it.
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
