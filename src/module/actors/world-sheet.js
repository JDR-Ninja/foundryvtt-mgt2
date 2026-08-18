import { MGT2 } from "../config.js";
import { SheetModeMixin } from "../sheet-mode.js";
import { SpecTradeDialog } from "../trade.js";
import { WorldData } from "./world-data.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const PARTS_PATH = "systems/mgt2/templates/actors";

/** The eight profile cells, in the order the printed line gives them (Core p.248). */
const UWP_CELLS = ["starport", "size", "atmosphere", "hydrographics", "population", "government",
    "lawLevel", "techLevel"];

/** The three cells whose digit means nothing on its own (Core p.250, p.252, p.253). */
const UWP_TABLES = Object.freeze({
    atmosphere: MGT2.Atmospheres,
    population: MGT2.Populations,
    government: MGT2.Governments
});

/**
 * The world sheet: one line typed, everything else a reading of it.
 *
 * `world` extends `TypeDataModel` rather than `ActorBaseData` — no characteristics, no damage chain,
 * no token bar — so this is the one Actor sheet in the system that is **not** a subclass of the
 * character sheet. It takes the mode mixin and the shared blocks and nothing else.
 *
 * Two fields are writes rather than derivations, and they are why a world is an Actor at all
 * (§9.33.5): the berthing rate, rolled once per starport and recorded (Core p.258), and the supplier
 * lockout a crew earns by walking away (Core p.243).
 *
 * @extends {ActorSheetV2}
 * @mixes HandlebarsApplication
 */
export class WorldActorSheet extends SheetModeMixin(HandlebarsApplicationMixin(ActorSheetV2)) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mgt2", "actor", "world", "nopad"],
        position: { width: 940, height: 760 },
        window: { resizable: true },
        form: { submitOnChange: true, closeOnSubmit: false },
        actions: {
            baseToggle: WorldActorSheet.#onBaseToggle,
            berthingRoll: WorldActorSheet.#onBerthingRoll,
            berthingClear: WorldActorSheet.#onBerthingClear,
            codeOverride: WorldActorSheet.#onCodeOverride,
            searchRecord: WorldActorSheet.#onSearchRecord,
            searchClear: WorldActorSheet.#onSearchClear,
            supplierRefuse: WorldActorSheet.#onSupplierRefuse,
            supplierClear: WorldActorSheet.#onSupplierClear,
            tradeScreen: WorldActorSheet.#onTradeScreen
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/world/header.html` },
        rail: { template: `${PARTS_PATH}/world/rail.html`, scrollable: [""] },
        panel: { template: `${PARTS_PATH}/world/panel.html`, scrollable: [""] }
    };

    /** One rail and one panel, no tab strip. */
    static TABS = {};

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const system = this.actor.system;
        const day = game.settings.get("mgt2", "campaignDay");

        context.name = this.actor.name;
        context.img = this.actor.img;
        context.isGM = game.user.isGM;
        context.system = system;
        context.systemFields = system.schema.fields;

        context.world = {
            profile: system.profile,
            cells: WorldActorSheet.#cells(system),
            location: WorldActorSheet.#location(system),
            bases: WorldActorSheet.#bases(system),
            berthing: WorldActorSheet.#berthing(system),
            ledger: WorldActorSheet.#ledger(system),
            traffic: WorldActorSheet.#traffic(system),
            trade: WorldActorSheet.#trade(system, day),
            zone: MGT2.TravelZones[system.zone]?.label ?? "",
            forbidden: system.travel.forbidden,
            day
        };
        return context;
    }

    /* -------------------------------------------- */

    /**
     * The eight cells of the strip. The glyph comes off `profile` rather than out of a second eHex
     * encoder, so one function still produces the printed line. The gloss only says what the glyph
     * cannot: the decimal behind a letter above 9, and what the digit means on the four cells that
     * have a table. Localised here rather than in the template because the two halves join.
     */
    static #cells(system) {
        const line = system.profile;
        const glyphs = [...line.slice(0, 7), line.slice(8)];
        return UWP_CELLS.map((key, index) => {
            const value = system.uwp[key];
            const port = (key === "starport");
            const label = (port ? MGT2.Starports : UWP_TABLES[key])?.[value]?.label;
            return {
                key, value, port,
                glyph: glyphs[index],
                field: system.schema.fields.uwp.fields[key],
                name: `system.uwp.${key}`,
                classes: port ? "f" : "f n",
                gloss: [(!port && (value > 9)) ? String(value) : "",
                    label ? game.i18n.localize(label) : ""].filter(Boolean).join(" · ")
            };
        });
    }

    /**
     * Where the world is, as one line. The sector and the hex are what was typed; the subsector is a
     * reading of the hex alone and survives an unknown sector, so it prints its name where the
     * registry has one and its letter otherwise. The absolute coordinate is the only figure here
     * nobody types and no table prints, so it rides the tooltip rather than the line.
     */
    static #location(system) {
        const at = system.location;
        const parts = [system.sector, system.hex, at.subsectorName ?? at.subsector].filter(Boolean);
        const hint = at.coords
            ? game.i18n.format("MGT2.Actor.world.WorldSpace", { x: at.coords.x, y: at.coords.y })
            : at.cell ? game.i18n.localize("MGT2.Actor.world.SectorUnknown")
                : system.hex ? game.i18n.localize("MGT2.Actor.world.NotOnAMap") : "";
        return { line: parts.join(" · "), hint };
    }

    /** Every base the config knows, on or off — the row is a picker as well as a readout. */
    static #bases(system) {
        const rows = Object.entries(MGT2.WorldBases).map(([key, label]) => ({
            key, label, on: system.bases.has(key)
        }));
        return { rows, on: rows.filter(row => row.on) };
    }

    /**
     * Three states, and a naive `0` collapses two of them: `null` is NOT YET ROLLED, class E is a port
     * that charges nothing, class X is no port at all (Core p.258). Only the third case is rollable,
     * which is why the button reads the band rather than the stored value.
     */
    static #berthing(system) {
        const perDie = system.starport.berthingPerDie;
        return {
            value: system.berthing,
            perDie,
            rollable: !!perDie,
            rolled: system.berthing !== null,
            noPort: perDie === null,
            free: perDie === 0,
            unrolled: (system.berthing === null) && !!perDie
        };
    }

    /**
     * The eighteen codes with the condition that produced each one. `derived` and `published` are
     * printed side by side and never merged (§9.20): an override with no visible condition beside it
     * cannot be told from a typo, and neither set can be trusted once they are one column.
     */
    static #ledger(system) {
        const rows = MGT2.TradeCodes.map(row => {
            const override = system.codeOverrides[row.code];
            return {
                code: row.code,
                label: row.label,
                // The field name is the only language-dependent half, and the label it takes is the
                // one the UWP editor above the ledger already prints.
                condition: row.condition.map(([field, range]) =>
                    `${game.i18n.localize(`MGT2.Actor.world.FIELDS.uwp.${field}.label`)} ${range}`)
                    .join(" · "),
                derived: system.derivedCodes.includes(row.code),
                published: system.codes.includes(row.code),
                state: (override === undefined) ? "derive" : override ? "on" : "off"
            };
        });
        return {
            rows,
            derivedLine: system.derivedCodes.join(" "),
            publishedLine: system.codes.join(" "),
            derivedCount: system.derivedCodes.length,
            publishedCount: system.codes.length
        };
    }

    /**
     * The two halves this world can answer for on its own: the Starport DM (Core p.239, p.240) and the
     * travel zone, which both tables read with opposite signs. The population and Tech Level terms
     * belong to the roll, and the roll needs the other end of a leg — so the sheet never makes one.
     */
    static #traffic(system) {
        const zone = MGT2.TravelZones[system.zone] ?? MGT2.TravelZones.green;
        const half = zoneDM => {
            const rows = [{ label: "MGT2.Actor.world.StarportDM", dm: system.starport.trafficDM }];
            if (zoneDM !== 0) rows.push({ label: zone.label, dm: zoneDM });
            return { rows, total: rows.reduce((sum, row) => sum + row.dm, 0) };
        };
        return {
            passengers: half(system.travel.passengerDM),
            freight: half(system.travel.freightDM)
        };
    }

    /** The supplier standing, read against the campaign's own *now* — `mgt2.campaignDay`, not a field. */
    static #trade(system, day) {
        const standing = system.tradeStanding(day);
        return {
            attempts: system.trade.attempts.length,
            thisMonth: standing.attemptsThisMonth,
            searchDM: standing.searchDM,
            refused: system.trade.refusedOn !== null,
            refusedOn: system.trade.refusedOn,
            closedUntil: standing.closedUntil
        };
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this.element.querySelector("[data-uwp-line]")
            ?.addEventListener("change", this.#onPasteUwp.bind(this));
    }

    /**
     * A subsector is 8x10 hexes and day one is several hundred typed digits, so the printed line is an
     * input and the eight cells are the parse (§9.33.5). The field carries no `name` and stops the
     * change from reaching the form: it is a reading of the cells, never a value of its own, and
     * letting `submitOnChange` fire would write the stale cells back over the parse.
     */
    async #onPasteUwp(event) {
        event.stopPropagation();
        const input = event.currentTarget;
        const line = input.value;
        const parsed = WorldData.parseUwp(line);
        if (!parsed) {
            input.value = this.actor.system.profile;
            return ui.notifications.warn(
                game.i18n.format("MGT2.Actor.world.PasteFailed", { line }));
        }
        return this.actor.update({ "system.uwp": parsed });
    }

    /** @this {WorldActorSheet} */
    static async #onBaseToggle(event, target) {
        const key = target.dataset.base;
        const bases = new Set(this.actor.system.bases);
        if (bases.has(key)) bases.delete(key);
        else bases.add(key);
        return this.actor.update({ "system.bases": Array.from(bases) });
    }

    /**
     * "Roll once per starport and record it — prices are stable at any given port" (Core p.258). One
     * die against the class band; class E and class X have no band to roll against and the control is
     * disabled for both, so neither can be written a number that would read as a price.
     * @this {WorldActorSheet}
     */
    static async #onBerthingRoll() {
        const perDie = this.actor.system.starport.berthingPerDie;
        if (!perDie) return;
        const roll = await new Roll(`1d6 * ${perDie}`).evaluate();
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: game.i18n.format("MGT2.Actor.world.BerthingFlavour",
                { port: this.actor.system.starport.key })
        });
        return this.actor.update({ "system.berthing": roll.total });
    }

    /** Back to NOT YET ROLLED, which no number can express. @this {WorldActorSheet} */
    static async #onBerthingClear() {
        return this.actor.update({ "system.berthing": null });
    }

    /**
     * Derive, force on, force off. Clearing an override deletes the key rather than storing a third
     * value: `-=key` warns since v14, so the operator is what removes it (`combat.js:119`).
     * @this {WorldActorSheet}
     */
    static async #onCodeOverride(event, target) {
        const code = target.closest("[data-code]").dataset.code;
        const state = target.dataset.state;
        const value = (state === "derive") ? new foundry.data.operators.ForcedDeletion()
            : (state === "on");
        return this.actor.update({ system: { codeOverrides: { [code]: value } } });
    }

    /**
     * The four supplier writes are the model's, because the speculative trade screen makes two of
     * them too and a second implementation would double-stamp.
     * @this {WorldActorSheet}
     */
    static async #onSearchRecord() {
        return this.actor.system.recordSearch(game.settings.get("mgt2", "campaignDay"));
    }

    /** @this {WorldActorSheet} */
    static async #onSearchClear() {
        return this.actor.system.clearSearches();
    }

    /** @this {WorldActorSheet} */
    static async #onSupplierRefuse() {
        return this.actor.system.refuseSupplier(game.settings.get("mgt2", "campaignDay"));
    }

    /** @this {WorldActorSheet} */
    static async #onSupplierClear() {
        return this.actor.system.clearRefusal();
    }

    /**
     * The market, opened on this world rather than on a retyped profile — a mistyped digit silently
     * changes every DM on that page, and the two write-backs need the document anyway.
     * @this {WorldActorSheet}
     */
    static #onTradeScreen() {
        return SpecTradeDialog.open({ world: this.actor });
    }
}
