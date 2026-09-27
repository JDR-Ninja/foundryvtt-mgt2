import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { DialogV2 } = foundry.applications.api;

/** The prefix of the world settings naming each shared table, one setting per table. */
export const TABLE_SETTING = "creationTable";

/** The tables every career shares, each a `career` Item of kind `table` whose Events rows apply as a career's own. */
export const SharedTables = {

    setting(role) {
        return `${TABLE_SETTING}.${role}`;
    },

    uuid(role) {
        if ( !(role in MGT2.SharedCreationTables) ) return "";
        return game.settings.get("mgt2", this.setting(role)) || "";
    },

    /** @returns {Promise<Item|null>} */
    async table(role) {
        const uuid = this.uuid(role);
        if ( !uuid ) return null;
        const found = await fromUuid(uuid).catch(() => null);
        return (found?.type === "career") ? found : null;
    },

    /** The shared role a row's sub-table names — by the printed names, the label, or the linked table's own name. */
    role(name) {
        const key = MGT2Helper.skillSlug(name);
        if ( !key ) return "";
        for ( const [role, entry] of Object.entries(MGT2.SharedCreationTables) ) {
            const linked = this.uuid(role) ? foundry.utils.fromUuidSync(this.uuid(role))?.name : "";
            if ( [...entry.names, game.i18n.localize(entry.label), linked ?? ""]
                .some(one => one && (MGT2Helper.skillSlug(one) === key)) ) return role;
        }
        return "";
    },

    /** Whether a row's sub-table is Core p.49's Injury table. */
    isInjury(name) {
        const key = MGT2Helper.skillSlug(name);
        return !!key && [...MGT2.InjuryTableNames, game.i18n.localize("MGT2.Chargen.Shared.injury")]
            .some(one => MGT2Helper.skillSlug(one) === key);
    },

    /** The skills a background table offers, read off its rows' grants: a list, never a roll. */
    async backgroundChoices() {
        const table = await this.table("background");
        if ( !table ) return [];
        const names = table.system.eventTable.flatMap(row => (row.grant?.grants ?? [])
            .filter(grant => (grant.kind === "skill") && grant.skill).map(grant => grant.skill));
        return [...new Set(names)];
    }
};

/** The career templates a table can reach by name — the world first, then every Item compendium. */
export const CareerLibrary = {

    /** @returns {Promise<Item|null>} */
    async find(name, { kinds = ["career", "preCareer"] } = {}) {
        const key = MGT2Helper.skillSlug(name);
        if ( !key ) return null;
        const named = entry => (entry.type === "career") && (MGT2Helper.skillSlug(entry.name) === key)
            && kinds.includes(entry.system?.kind ?? "career");
        const world = game.items.find(named);
        if ( world ) return world;
        for ( const pack of game.packs.filter(one => one.documentName === "Item") ) {
            const index = await pack.getIndex({ fields: ["system.kind"] });
            const entry = index.find(named);
            if ( entry ) return pack.getDocument(entry._id);
        }
        return null;
    },

    /** The templates always open to a refused Traveller (Core p.19's Drifter), by field and never by name. */
    async fallbacks() {
        const open = entry => (entry.type === "career") && entry.system?.alwaysAvailable
            && ((entry.system?.kind ?? "career") === "career");
        const found = new Map(game.items.filter(open).map(item => [MGT2Helper.skillSlug(item.name), item]));
        for ( const pack of game.packs.filter(one => one.documentName === "Item") ) {
            const index = await pack.getIndex({ fields: ["system.kind", "system.alwaysAvailable"] });
            for ( const entry of index.filter(open) ) {
                const key = MGT2Helper.skillSlug(entry.name);
                if ( !found.has(key) ) found.set(key, await pack.getDocument(entry._id));
            }
        }
        return [...found.values()];
    }
};

/** The referee links each shared table by dropping a `career` Item of kind `table` on its row. @extends {DialogV2} */
export class CreationTablesMenu extends DialogV2 {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-creation-tables-{id}",
        classes: ["mgt2"],
        position: { width: 520 },
        window: { title: "MGT2.Chargen.Shared.Title", icon: "fa-solid fa-table-list" },
        buttons: [
            { action: "save", label: "MGT2.Chargen.Shared.Save", icon: "fa-solid fa-check", default: true,
                callback: (event, button) => CreationTablesMenu.#save(button.form) },
            { action: "cancel", label: "MGT2.Cancel", icon: "fa-solid fa-xmark" }
        ]
    };

    constructor(options = {}) {
        super({ content: CreationTablesMenu.#content(), ...options });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        for ( const input of this.element.querySelectorAll("input[data-role]") ) {
            input.addEventListener("drop", event => {
                const data = MGT2Helper.getDataFromDropEvent(event);
                if ( !data?.uuid ) return;
                event.preventDefault();
                input.value = data.uuid;
                input.nextElementSibling.textContent = foundry.utils.fromUuidSync(data.uuid)?.name ?? "";
            });
        }
    }

    static #content() {
        const escape = foundry.utils.escapeHTML;
        const rows = Object.entries(MGT2.SharedCreationTables).map(([role, entry]) => {
            const uuid = SharedTables.uuid(role);
            const name = uuid ? (foundry.utils.fromUuidSync(uuid)?.name ?? "?") : "";
            return `<div class="form-group"><label>${escape(game.i18n.localize(entry.label))}</label>
                <input type="text" name="${role}" data-role="${role}" value="${escape(uuid)}"
                    placeholder="${escape(game.i18n.localize("MGT2.Chargen.Shared.Drop"))}" />
                <span class="hint">${escape(name)}</span></div>`;
        });
        const content = document.createElement("div");
        content.innerHTML = `<div class="dlg"><p class="hint">${escape(game.i18n.localize("MGT2.Chargen.Shared.Hint"))}</p>
            <div class="dblock">${rows.join("")}</div></div>`;
        return content;
    }

    static async #save(form) {
        for ( const role of Object.keys(MGT2.SharedCreationTables) ) {
            const value = form.elements[role]?.value.trim() ?? "";
            if ( value !== SharedTables.uuid(role) ) await game.settings.set("mgt2", SharedTables.setting(role), value);
        }
        return true;
    }
}
