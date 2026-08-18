import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { SearchFilter } = foundry.applications.ux;

/** The three fields this system adds to every Actor and Item compendium index. */
export const INDEX_FIELDS = Object.freeze(["system.tl", "system.subType", "system.scale"]);

/** Rows built per render. */
const PAGE = 200;

/** The sub-type vocabulary each document type owns. A type absent here has no table and prints raw. */
const SUB_TYPES = Object.freeze({
    item: MGT2.ItemSubType,
    equipment: MGT2.EquipmentSubType,
    talent: MGT2.TalentSubType,
    disease: MGT2.DiseaseSubType,
    npc: MGT2.NpcSubTypes
});

/** World, module or system — `metadata.packageType`, which is also what decides `pack.locked`. */
const SOURCES = Object.freeze({
    world: { label: "MGT2.Explorer.Sources.world", icon: "fa-solid fa-globe" },
    system: { label: "MGT2.Explorer.Sources.system", icon: "fa-solid fa-dice-d20" },
    module: { label: "MGT2.Explorer.Sources.module", icon: "fa-solid fa-cubes" }
});

/** The three text fields. They re-draw the results alone, so the caret survives mid-word editing. */
const TEXT_FILTERS = Object.freeze(["q", "tlMin", "tlMax"]);

/** Blank is "no bound", which is a different statement from zero. */
function bound(value) {
    const text = String(value ?? "").trim();
    if ( text === "" ) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

/** One facet row, counted; the first document that carries a value is the one that names it. */
function bump(facets, value, documentName, type) {
    const row = facets.get(value) ?? { value, count: 0, doc: documentName, type };
    row.count++;
    facets.set(value, row);
}

/**
 * One browsing surface over every compendium the user may see: search, narrow, drag onto a
 * sheet.
 * @extends {ApplicationV2}
 */
export class CompendiumExplorer extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-compendium-explorer",
        classes: ["mgt2", "explorer"],
        position: { width: 1000, height: 720 },
        window: { resizable: true, icon: "fa-solid fa-magnifying-glass-arrow-right",
            title: "MGT2.Explorer.Title" },
        actions: {
            sort: CompendiumExplorer.#onSort,
            openEntry: CompendiumExplorer.#onOpenEntry,
            sources: CompendiumExplorer.#onSources,
            reset: CompendiumExplorer.#onReset
        }
    };

    /** @inheritDoc */
    static PARTS = {
        rail: { template: "systems/mgt2/templates/explorer-rail.html", scrollable: [""] },
        results: { template: "systems/mgt2/templates/explorer-results.html", scrollable: [".rows"] }
    };

    /** Nothing here is persisted: what a referee is looking for is a question, not a preference. */
    #filters = { q: "", cls: "", type: "", subType: "", scale: "", tlMin: "", tlMax: "" };

    /** Packs switched OFF, so a module installed while the window is open joins the search. */
    #hidden = new Set();

    /** Collection ids whose declared fields have landed, are in flight, and failed to arrive. */
    #ready = new Set();
    #loading = new Set();
    #failed = new Set();

    #sort = { key: "name", dir: 1 };

    /** Indexes land one after another; one draw per pack would be a draw per round-trip. */
    #redraw = foundry.utils.debounce(() => {
        if ( this.rendered ) this.render({ parts: ["rail", "results"] });
    }, 120);

    /** One window: two would fetch every index twice for the same question. */
    static open() {
        const existing = foundry.applications.instances.get("mgt2-compendium-explorer");
        return (existing ?? new CompendiumExplorer()).render({ force: true });
    }

    /** Every pack this user may see. @type {CompendiumCollection[]} */
    get packs() {
        return game.packs.filter(pack => pack.visible);
    }

    /** One `getIndex()` per pack that needs one, fired together and drawn as each lands. */
    #loadIndexes() {
        for ( const pack of this.packs ) {
            const id = pack.collection;
            if ( this.#ready.has(id) || this.#loading.has(id) ) continue;
            if ( pack.indexed ) {
                this.#ready.add(id);
                continue;
            }
            this.#loading.add(id);
            pack.getIndex()
                .then(() => this.#ready.add(id))
                .catch(error => {
                    console.error(error);
                    this.#failed.add(id);
                })
                .finally(() => {
                    this.#loading.delete(id);
                    this.#redraw();
                });
        }
    }

    /** Where a pack stands, for the marker in the rail and for the rule below it. */
    #state(pack) {
        const id = pack.collection;
        if ( this.#failed.has(id) ) return "failed";
        if ( this.#ready.has(id) ) return "ready";
        return this.#loading.has(id) ? "loading" : "waiting";
    }

    /** The printed Tech Level, through `MGT2.TL` where the stored value is one of its keys. */
    static tlLabel(value) {
        if ( (value === undefined) || (value === null) || (value === "") ) return null;
        const key = (typeof value === "number") ? `TL${String(value).padStart(2, "0")}` : value;
        if ( MGT2.TL[key] ) return game.i18n.localize(MGT2.TL[key]);
        return (typeof value === "number") ? `TL${value}` : String(value);
    }

    /** A sub-type prints through its own type's table, or raw where the type declares none. */
    static subTypeLabel(type, subType) {
        if ( !subType ) return null;
        const key = SUB_TYPES[type]?.[subType];
        return key ? game.i18n.localize(key) : subType;
    }

    /** A weapon's scale — the only field of the three that belongs to one Item type alone. */
    static scaleLabel(scale) {
        const key = MGT2.WeaponScales[scale]?.label;
        return key ? game.i18n.localize(key) : scale;
    }

    /** A document sub-type prints through `TYPES.*`, which Foundry fills from the lang files. */
    static typeLabel(documentName, type) {
        const key = CONFIG[documentName]?.typeLabels?.[type];
        return key ? game.i18n.localize(key) : (type ?? null);
    }

    /** One pass over every index record of every shown pack: the rows, and the two facet lists. */
    #scan() {
        const filters = this.#filters;
        const query = filters.q ? SearchFilter.cleanQuery(filters.q).toLowerCase() : "";
        const tlMin = bound(filters.tlMin);
        const tlMax = bound(filters.tlMax);
        // Search reads `name`, which rides the world-load index; these three do not.
        const declared = Boolean(filters.subType) || Boolean(filters.scale)
            || (tlMin !== null) || (tlMax !== null);

        const types = new Map();
        const subTypes = new Map();
        const scales = new Map();
        const rows = [];
        let total = 0;
        let withheld = 0;

        for ( const pack of this.packs ) {
            if ( this.#hidden.has(pack.collection) ) continue;
            if ( filters.cls && (pack.documentName !== filters.cls) ) continue;
            const ready = this.#ready.has(pack.collection);
            total += pack.index.size;

            for ( const entry of pack.index ) {
                if ( query && !SearchFilter.cleanQuery(entry.name ?? "").toLowerCase().includes(query) ) continue;
                // A declared field cannot be read before its pack is back, so the row is withheld
                // rather than shown unjudged: showing it would be a lie about what the screen
                // knows.
                if ( declared && !ready ) {
                    withheld++;
                    continue;
                }

                const type = entry.type ?? null;
                const subType = entry.system?.subType ?? null;
                const scale = entry.system?.scale ?? null;
                const tl = MGT2Helper.tlNumber(entry.system?.tl);
                const okType = !filters.type || (type === filters.type);
                const okSub = !filters.subType || (subType === filters.subType);
                const okScale = !filters.scale || (scale === filters.scale);
                const okTl = ((tlMin === null) && (tlMax === null))
                    || ((tl !== null) && ((tlMin === null) || (tl >= tlMin)) && ((tlMax === null) || (tl <= tlMax)));

                // A facet carries the document type that owns it: a sub-type has no label without
                // one, and `type` itself prints through `TYPES.<Actor|Item>.<type>`.
                if ( type && okSub && okScale && okTl ) bump(types, type, pack.documentName, type);
                if ( subType && okType && okScale && okTl ) bump(subTypes, subType, pack.documentName, type);
                if ( scale && okType && okSub && okTl ) bump(scales, scale, pack.documentName, type);
                if ( !okType || !okSub || !okScale || !okTl ) continue;

                rows.push({
                    uuid: entry.uuid,
                    doc: pack.documentName,
                    name: entry.name,
                    img: entry.img ?? null,
                    icon: CONFIG[pack.documentName]?.sidebarIcon ?? "fa-solid fa-file",
                    type: CompendiumExplorer.typeLabel(pack.documentName, type),
                    subType: ready ? CompendiumExplorer.subTypeLabel(type, subType) : null,
                    tl: ready ? CompendiumExplorer.tlLabel(entry.system?.tl) : null,
                    tlSort: tl,
                    pending: !ready,
                    pack: pack.title,
                    // A module pack is read-only and can be uninstalled, taking its documents with
                    // it.
                    sourceIcon: SOURCES[pack.metadata.packageType]?.icon,
                    locked: pack.locked
                });
            }
        }

        return { rows, types, subTypes, scales, total, withheld };
    }

    /** The four sortable columns, carrying their own state so the template compares nothing. */
    #columns() {
        return ["name", "type", "tl", "pack"].map(key => ({
            key,
            label: `MGT2.Explorer.Columns.${key}`,
            on: this.#sort.key === key,
            up: this.#sort.dir > 0
        }));
    }

    /** Name, type and pack read as text; a Tech Level reads as a number and its absences sort last. */
    #sorted(rows) {
        const { key, dir } = this.#sort;
        return rows.sort((a, b) => {
            if ( key === "tl" ) {
                if ( a.tlSort === b.tlSort ) return a.name.localeCompare(b.name);
                if ( a.tlSort === null ) return 1;
                if ( b.tlSort === null ) return -1;
                return (a.tlSort - b.tlSort) * dir;
            }
            const compared = String(a[key] ?? "").localeCompare(String(b[key] ?? ""));
            return (compared || a.name.localeCompare(b.name)) * dir;
        });
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const scan = this.#scan();
        const sorted = this.#sorted(scan.rows);

        Object.assign(context, {
            filters: this.#filters,
            sort: this.#sort,
            sources: this.#sources(),
            classes: this.#classes(),
            types: CompendiumExplorer.#facets(scan.types,
                row => CompendiumExplorer.typeLabel(row.doc, row.value)),
            subTypes: CompendiumExplorer.#facets(scan.subTypes,
                row => CompendiumExplorer.subTypeLabel(row.type, row.value)),
            // Only `weapon` carries a scale, so the control appears when there is one to read and
            // is absent otherwise — a permanently empty select is worse than no select.
            scales: CompendiumExplorer.#facets(scan.scales,
                row => CompendiumExplorer.scaleLabel(row.value)),
            columns: this.#columns(),
            rows: sorted.slice(0, PAGE),
            shown: Math.min(sorted.length, PAGE),
            matched: sorted.length,
            total: scan.total,
            capped: sorted.length > PAGE,
            withheld: scan.withheld,
            // Outstanding, not in flight: the first paint happens before `_onFirstRender` has fired
            // a single request, and that is precisely the moment the cost is worth stating.
            loading: this.packs.filter(pack =>
                !this.#ready.has(pack.collection) && !this.#failed.has(pack.collection)).length,
            filtered: Object.values(this.#filters).some(value => value !== "") || (this.#hidden.size > 0)
        });
        return context;
    }

    /**
     * A facet list, sorted by what it prints rather than by what it stores, and carrying the count
     * it would leave: a choice that narrows to nothing is worth seeing before it is made.
     */
    static #facets(counts, label) {
        return [...counts.values()]
            .map(row => {
                const text = label(row) ?? row.value;
                return { value: row.value, label: text, text: `${text} · ${row.count}` };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    /** The document classes the shown packs hold — Actor, Item, and whatever else is installed. */
    #classes() {
        const seen = new Map();
        for ( const pack of this.packs ) {
            if ( seen.has(pack.documentName) ) continue;
            seen.set(pack.documentName, {
                value: pack.documentName,
                label: game.i18n.localize(getDocumentClass(pack.documentName).metadata.label)
            });
        }
        return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * The pack list is the source filter **and** the index-progress readout, because they are the
     * same list: a pack the referee has switched off is a pack whose round-trip bought nothing, and
     * a pack still arriving is one whose rows cannot answer a TL yet.
     */
    #sources() {
        const groups = new Map(Object.keys(SOURCES).map(key => [key, []]));
        for ( const pack of this.packs ) {
            const source = pack.metadata.packageType;
            groups.get(source)?.push({
                id: pack.collection,
                title: pack.title,
                package: pack.metadata.packageName,
                doc: game.i18n.localize(getDocumentClass(pack.documentName).metadata.label),
                count: pack.index.size,
                locked: pack.locked,
                on: !this.#hidden.has(pack.collection),
                state: this.#state(pack)
            });
        }
        return [...groups].filter(([, packs]) => packs.length).map(([key, packs]) => ({
            key,
            label: SOURCES[key].label,
            icon: SOURCES[key].icon,
            packs: packs.sort((a, b) => a.title.localeCompare(b.title))
        }));
    }

    /**
     * Two delegated listeners on the application root, so both survive either part being replaced.
     * @inheritDoc
     */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this.element.addEventListener("input", this.#onFilter.bind(this));
        this.element.addEventListener("dragstart", CompendiumExplorer.#onDragStart);
        this.#loadIndexes();
    }

    /**
     * A text field redraws the results alone, so the caret survives; anything else redraws the rail
     * too, because the facet lists are read off the rows that are left.
     */
    #onFilter(event) {
        const target = event.target;
        const source = target.dataset.source;
        if ( source ) {
            if ( target.checked ) this.#hidden.delete(source);
            else this.#hidden.add(source);
            return void this.render({ parts: ["rail", "results"] });
        }
        const field = target.dataset.filter;
        if ( !(field in this.#filters) ) return;
        this.#filters[field] = target.value;
        this.render({ parts: TEXT_FILTERS.includes(field) ? ["results"] : ["rail", "results"] });
    }

    /**
     * `{uuid, type}` with the *document name* as the type, which is what core's own compendium rows
     * write (`compendium-directory.mjs`, `_onDragDocumentStart`) and what every sheet's `_onDrop`
     * expects.
     */
    static #onDragStart(event) {
        const row = event.target.closest("[data-uuid]");
        if ( !row ) return;
        event.dataTransfer.setData("text/plain",
            JSON.stringify({ type: row.dataset.doc, uuid: row.dataset.uuid }));
    }

    static #onSort(event, target) {
        const key = target.dataset.key;
        this.#sort = { key, dir: (this.#sort.key === key) ? -this.#sort.dir : 1 };
        this.render({ parts: ["results"] });
    }

    /** The sheet, not an import: the explorer answers where a thing is and copies nothing. */
    static async #onOpenEntry(event, target) {
        const document = await fromUuid(target.closest("[data-uuid]").dataset.uuid);
        return document?.sheet?.render({ force: true });
    }

    /** All or none, over the group the button belongs to. */
    static #onSources(event, target) {
        const on = target.dataset.on === "true";
        for ( const box of target.closest(".grp").querySelectorAll("[data-source]") ) {
            if ( on ) this.#hidden.delete(box.dataset.source);
            else this.#hidden.add(box.dataset.source);
        }
        this.render({ parts: ["rail", "results"] });
    }

    static #onReset(event, target) {
        this.#filters = { q: "", cls: "", type: "", subType: "", scale: "", tlMin: "", tlMax: "" };
        this.#hidden.clear();
        this.render({ parts: ["rail", "results"] });
    }
}

/** The index fields, and the control that opens the window. */
export function registerCompendiumExplorer() {
    CONFIG.Actor.compendiumIndexFields.push(...INDEX_FIELDS);
    CONFIG.Item.compendiumIndexFields.push(...INDEX_FIELDS);

    Hooks.on("renderCompendiumDirectory", (app, element) => {
        const header = element.querySelector(".header-actions");
        if ( !header || header.querySelector(".mgt2-explorer") ) return;
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("mgt2-explorer");
        button.innerHTML = `<i class="fa-solid fa-magnifying-glass-arrow-right" inert></i>
            <span>${foundry.utils.escapeHTML(game.i18n.localize("MGT2.Explorer.Open"))}</span>`;
        button.addEventListener("click", () => CompendiumExplorer.open());
        header.prepend(button);
    });
}
