/**
 * The LevelDB layout Foundry reads a compendium out of, taken from the document classes in
 * `common/documents/*.mjs`: a primary document lives at `!<collection>!<id>` and an embedded one at
 * `!<collection>.<embedded>!<parentId>.<childId>`, with the parent storing only the child ids.
 *
 * A copy of `mgt2-data/tools/lib/collections.mjs` rather than an import of it: that module is a
 * sibling package, and the system has to build from a bare clone of its own repository.
 */

/** Document name → the sublevel a primary document of that type is keyed under. */
export const COLLECTIONS = Object.freeze({
    Actor: "actors",
    Adventure: "adventures",
    Cards: "cards",
    Folder: "folders",
    Item: "items",
    JournalEntry: "journal",
    Macro: "macros",
    Playlist: "playlists",
    RollTable: "tables",
    Scene: "scenes"
});

/** Document name → { field on the parent: document name of the children }. */
export const EMBEDDED = Object.freeze({
    Actor: { items: "Item", effects: "ActiveEffect" },
    ActorDelta: { items: "Item", effects: "ActiveEffect" },
    Cards: { cards: "Card" },
    Item: { effects: "ActiveEffect" },
    JournalEntry: { pages: "JournalEntryPage", categories: "JournalEntryCategory" },
    Playlist: { sounds: "PlaylistSound" },
    Region: { behaviors: "RegionBehavior" },
    RollTable: { results: "TableResult" },
    Scene: {
        drawings: "Drawing", lights: "AmbientLight", notes: "Note", regions: "Region",
        sounds: "AmbientSound", templates: "MeasuredTemplate", tiles: "Tile", tokens: "Token",
        walls: "Wall"
    },
    Token: { delta: "ActorDelta" }
});

/**
 * Flatten a document into the key/value pairs a pack stores, hoisting every embedded collection into
 * its own key and leaving an array of ids behind.
 * @param {string} documentName   The primary document's type, e.g. "Actor".
 * @param {object} source         The document source data, embedded collections inlined.
 * @param {string} [collection]   The sublevel prefix; defaults to the primary one.
 * @param {string} [parentKey]    The dotted id path of the parent, empty for a primary document.
 * @returns {[string, object][]}
 */
export function flattenDocument(documentName, source, collection, parentKey = "") {
    collection ??= COLLECTIONS[documentName];
    if ( !collection ) throw new Error(`No compendium collection for document type "${documentName}"`);
    if ( !source._id ) throw new Error(`Document in "${collection}" has no _id: ${JSON.stringify(source).slice(0, 200)}`);

    const idPath = parentKey ? `${parentKey}.${source._id}` : source._id;
    const doc = { ...source };
    const entries = [];

    for ( const [field, childName] of Object.entries(EMBEDDED[documentName] ?? {}) ) {
        const children = source[field];
        if ( !Array.isArray(children) ) continue;
        doc[field] = children.map(child => child._id);
        for ( const child of children ) {
            entries.push(...flattenDocument(childName, child, `${collection}.${field}`, idPath));
        }
    }

    entries.unshift([`!${collection}!${idPath}`, doc]);
    return entries;
}

/**
 * The inverse of {@link flattenDocument}: re-inline every embedded child under its parent so a
 * source file holds one whole document.
 * @param {[string, object][]} entries   Every key/value pair of a pack.
 * @returns {object[]}                   The primary documents, children inlined.
 */
export function nestDocuments(entries) {
    const byKey = new Map();
    for ( const [key, value] of entries ) byKey.set(key, structuredClone(value));

    // Deepest first, so a child is whole before its own parent claims it.
    const keys = [...byKey.keys()].sort((a, b) => depth(b) - depth(a));
    const primary = [];

    for ( const key of keys ) {
        const [, collection, idPath] = key.match(/^!([^!]+)!(.+)$/) ?? [];
        if ( !collection ) continue;
        const segments = collection.split(".");
        if ( segments.length === 1 ) {
            primary.push(byKey.get(key));
            continue;
        }
        const field = segments.at(-1);
        const parentKey = `!${segments.slice(0, -1).join(".")}!${idPath.split(".").slice(0, -1).join(".")}`;
        const parent = byKey.get(parentKey);
        if ( !parent ) continue;
        const child = byKey.get(key);
        const index = Array.isArray(parent[field]) ? parent[field].indexOf(child._id) : -1;
        if ( !Array.isArray(parent[field]) ) parent[field] = [];
        if ( index >= 0 ) parent[field][index] = child;
        else parent[field].push(child);
    }
    return primary;
}

function depth(key) {
    return (key.match(/^!([^!]+)!/)?.[1].split(".").length) ?? 0;
}
