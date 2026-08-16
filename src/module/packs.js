const { DialogV2 } = foundry.applications.api;

/**
 * The world's empty compendium packs (DOCTYPE-SCHEMAS §36): the shape of a library and none of its
 * content. One pack per document type × visibility and no finer — the only reason left to open a
 * second pack of the same type is that someone must not see it. Tables and Notes start unticked, so
 * a referee who wants neither never has to delete them.
 */
const PACKS = [
    { key: "library", type: "Item",         gmOnly: false, initial: true },
    { key: "ships",   type: "Actor",        gmOnly: false, initial: true },
    { key: "npcs",    type: "Actor",        gmOnly: true,  initial: true },
    { key: "tables",  type: "RollTable",    gmOnly: true,  initial: false },
    { key: "notes",   type: "JournalEntry", gmOnly: true,  initial: false }
];

/**
 * A pack created and left alone is readable by every player — the ownership default is
 * `{PLAYER: "OBSERVER", ASSISTANT: "OWNER"}` (`common/packages/base-package.mjs:115-123`) — so the
 * GM-only rows are configured by the operation that creates them. A referee who fills the NPC pack
 * first and configures it second has already published it.
 */
const GM_ONLY = { GAMEMASTER: "OWNER", ASSISTANT: "OWNER", TRUSTED: "NONE", PLAYER: "NONE" };

/** The world setting recording what the button has created: the folder, and one collection id per row. */
export const PACKS_SETTING = "worldPacks";

/* -------------------------------------------- */

function readRecord() {
    const stored = game.settings.get("mgt2", PACKS_SETTING) ?? {};
    return { folder: stored.folder ?? null, packs: { ...stored.packs } };
}

/**
 * The row's pack, or null. Idempotency keys on the recorded collection id, never on the label, which
 * is the referee's to change; a recorded id whose pack has since been deleted counts as missing.
 */
function findPack(record, key) {
    const id = record.packs[key];
    return id ? (game.packs.get(id) ?? null) : null;
}

/** A `Folder` document of type `"Compendium"` (`common/constants.mjs:524-525`), not a folder inside a pack. */
async function getPackFolder(record) {
    const existing = game.folders.get(record.folder);
    if ( existing?.type === "Compendium" ) return existing;
    return getDocumentClass("Folder").create({
        name: game.i18n.localize("MGT2.Packs.folder"),
        type: "Compendium"
    });
}

/**
 * Three calls, not one: `createCompendium` takes only `{label, type}` — that is all the core dialog
 * sends (`client/applications/sidebar/tabs/compendium-directory.mjs:464-485`) — the folder is assigned
 * afterwards, and ownership is pack configuration rather than metadata.
 */
async function createPack(row, folder) {
    const pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
        label: game.i18n.localize(`MGT2.Packs.labels.${row.key}`),
        type: row.type
    });
    if ( !pack ) return null;
    await pack.setFolder(folder);
    if ( row.gmOnly ) await pack.configure({ ownership: GM_ONLY });
    return pack;
}

/**
 * Create the named packs that do not already exist. Touches nothing that exists, and never deletes.
 * @param {string[]} keys   Row keys from PACKS
 * @returns {Promise<number>}   How many packs were created
 */
export async function createWorldPacks(keys) {
    if ( !game.user.isGM ) return 0;

    const record = readRecord();
    const missing = PACKS.filter(row => keys.includes(row.key) && !findPack(record, row.key));
    if ( !missing.length ) return 0;

    const folder = await getPackFolder(record);
    if ( !folder ) return 0;
    record.folder = folder.id;

    let created = 0;
    for ( const row of missing ) {
        try {
            const pack = await createPack(row, folder);
            if ( !pack ) continue;
            record.packs[row.key] = pack.collection;
            created++;
        }
        catch ( error ) {
            console.error(error);
            ui.notifications.error(game.i18n.format("MGT2.Packs.failed",
                { label: game.i18n.localize(`MGT2.Packs.labels.${row.key}`) }));
        }
    }

    // Written even after a partial failure: a pack that exists but is not recorded gets created twice.
    await game.settings.set("mgt2", PACKS_SETTING, record);
    return created;
}

/* -------------------------------------------- */

/**
 * The checkbox list. Built here rather than passed in because `new menu.type()` takes no arguments
 * (`client/applications/settings/config.mjs:212`), and returned as a bare `<div>` because DialogV2
 * runs `cleanHTML` over string content, which would strip the attributes off these controls.
 * @returns {HTMLDivElement}
 */
function buildContent() {
    const record = readRecord();

    const rows = PACKS.map(row => {
        const exists = Boolean(findPack(record, row.key));
        const notes = [
            game.i18n.localize(getDocumentClass(row.type).metadata.label),
            game.i18n.localize(row.gmOnly ? "MGT2.Packs.gmOnly" : "MGT2.Packs.visible")
        ];
        if ( exists ) notes.push(game.i18n.localize("MGT2.Packs.exists"));
        return `<label>
            <input type="checkbox" name="pack" value="${row.key}"
                   ${(exists || row.initial) ? "checked" : ""}${exists ? " disabled" : ""} />
            ${foundry.utils.escapeHTML(game.i18n.localize(`MGT2.Packs.labels.${row.key}`))}
            <span class="hint">&mdash; ${foundry.utils.escapeHTML(notes.join(" · "))}</span>
        </label>`;
    });

    const content = document.createElement("div");
    content.innerHTML = `
        <div class="dlg">
            <p class="hint">${foundry.utils.escapeHTML(game.i18n.localize("MGT2.Packs.hint"))}</p>
            <div class="dblock">${rows.join("")}</div>
            <p class="hint">${foundry.utils.escapeHTML(game.i18n.format("MGT2.Packs.folderHint",
                { folder: game.i18n.localize("MGT2.Packs.folder") }))}</p>
        </div>`;
    return content;
}

async function onCreate(button) {
    const boxes = button.form.querySelectorAll('input[name="pack"]:checked:not(:disabled)');
    const created = await createWorldPacks(Array.from(boxes).map(box => box.value));
    if ( !created ) return ui.notifications.info(game.i18n.localize("MGT2.Packs.nothing"));
    ui.notifications.info(game.i18n.format("MGT2.Packs.created", {
        count: created,
        folder: game.i18n.localize("MGT2.Packs.folder")
    }));
}

/**
 * `registerMenu` takes an ApplicationV2 or a v1 FormApplication subclass and throws on anything else
 * (`client/helpers/client-settings.mjs:185-193`); a DialogV2 subclass qualifies.
 * @extends {DialogV2}
 */
export class WorldPacksMenu extends DialogV2 {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-world-packs-{id}",
        classes: ["mgt2"],
        position: { width: 480 },
        window: { title: "MGT2.Packs.title", icon: "fa-solid fa-book-atlas" },
        buttons: [
            {
                action: "create",
                label: "MGT2.Packs.create",
                icon: "fa-solid fa-folder-plus",
                default: true,
                callback: (event, button) => onCreate(button)
            },
            { action: "cancel", label: "MGT2.Cancel", icon: "fa-solid fa-xmark" }
        ]
    };

    constructor(options = {}) {
        super({ content: buildContent(), ...options });
    }
}
