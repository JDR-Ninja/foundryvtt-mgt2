import { MGT2Helper } from "../helper.js";
import { copyItemWithContents } from "../item.js";
import { SheetModeMixin } from "../sheet-mode.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const PARTS_PATH = "systems/mgt2/templates/actors";

/** Foundry's four rungs as words, because every label and gloss on this sheet keys off one. */
const RUNGS = { 0: "none", 1: "limited", 2: "observer", 3: "owner" };

/**
 * The stash sheet: an inventory nobody carries, and the only screen in the system where a lock does
 * anything.
 *
 * `stash` extends `TypeDataModel` rather than `ActorBaseData` — no characteristics, no damage chain,
 * no token bar — so this is not a subclass of the character sheet. It takes the mode mixin and the
 * shared blocks, the way the world sheet does.
 *
 * What earns the type is ownership and only ownership (§9.34), so the ownership strip is the header
 * and everything else is a reading of it: an Item's ownership is its parent's, which is why showing
 * players a `container` means showing them whoever carries it.
 *
 * @extends {ActorSheetV2}
 * @mixes HandlebarsApplication
 */
export class StashActorSheet extends SheetModeMixin(HandlebarsApplicationMixin(ActorSheetV2)) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mgt2", "actor", "stash", "nopad"],
        position: { width: 820, height: 660 },
        window: { resizable: true },
        form: { submitOnChange: true, closeOnSubmit: false },
        actions: {
            lockToggle: StashActorSheet.#onLockToggle,
            itemEdit: StashActorSheet.#onItemEdit,
            itemDelete: StashActorSheet.#onItemDelete
        }
    };

    /** @inheritDoc */
    static PARTS = {
        header: { template: `${PARTS_PATH}/stash/header.html` },
        rail: { template: `${PARTS_PATH}/stash/rail.html`, scrollable: [""] },
        panel: { template: `${PARTS_PATH}/stash/panel.html`, scrollable: [""] }
    };

    /** One rail and one panel, no tab strip. */
    static TABS = {};

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.actor;
        const system = actor.system;

        context.name = actor.name;
        context.img = actor.img;
        context.system = system;
        context.systemFields = system.schema.fields;
        context.isGM = game.user.isGM;

        // Two gates, and neither of them is CSS. OBSERVER is the rung that reads an inventory at
        // all; the lock then withholds it from everyone but an OWNER. A viewer who fails either
        // gets a context with no `contents` key in it — the rows are never sent to the template,
        // which is the only enforcement a lock can have (§9.34).
        const reads = actor.testUserPermission(game.user, "OBSERVER");
        const opens = system.canOpen();
        const stash = {
            open: reads && opens,
            access: StashActorSheet.#access(actor, reads, opens),
            ownership: StashActorSheet.#ownership(actor),
            showWeight: system.showWeight
        };
        // The value goes inside the guard with the inventory it sums, and is the one number a player
        // would most want off a locked cache.
        if (stash.open) {
            stash.contents = this.#contents();
            stash.count = system.count;
            stash.weight = system.weight;
            stash.unit = MGT2Helper.getWeightLabel();
            stash.value = system.value;
        }
        context.stash = stash;
        return context;
    }

    /* -------------------------------------------- */

    /**
     * Which rung the viewer stands on and what it entitles them to. A permission model you cannot
     * look through is one nobody checks, so the sheet states its own verdict rather than leaving it
     * to be inferred from an empty table.
     */
    static #access(actor, reads, opens) {
        // `getUserLevel` reads the stored map and does not special-case a referee, so a GM who did
        // not create the stash reads back as `none` while owning it in fact.
        const rung = game.user.isGM ? "owner" : (RUNGS[actor.getUserLevel(game.user)] ?? "none");
        return {
            rung, reads, opens,
            // A locked stash keeps its sheet and loses its rows; a LIMITED one never had them.
            withheld: reads ? (opens ? null : "locked") : "rung"
        };
    }

    /**
     * The strip, and the whole reason this is an Actor. `default` leads because it is what a user
     * with no entry of their own gets; a referee is skipped, being OWNER of everything by role.
     */
    static #ownership(actor) {
        const rows = [{
            name: game.i18n.localize("MGT2.Actor.stash.Everyone"),
            rung: RUNGS[actor.ownership.default] ?? "none",
            fallback: true
        }];
        for (const user of game.users) {
            if (user.isGM) continue;
            rows.push({ name: user.name, rung: RUNGS[actor.getUserLevel(user)] ?? "none" });
        }
        return rows;
    }

    /**
     * One row per top-level thing. Nothing here re-implements the aggregation: `system.contents`
     * filters exactly as `ItemContainerData` does, `getTotalWeight` is the Item's own recursion and
     * `valueByRow` is the model's, so a bag inside the stash reports what it holds — mass and price
     * both — without this sheet walking it.
     */
    #contents() {
        const value = this.actor.system.valueByRow;
        return this.actor.system.contents.map(item => ({
            _id: item.id,
            name: item.name,
            img: item.img,
            type: game.i18n.localize(`TYPES.Item.${item.type}`),
            quantity: item.system.quantity ?? null,
            weight: MGT2Helper.roundWeight(item.getTotalWeight()),
            value: value.get(item.id) ?? 0,
            held: (item.type === "container") ? item.system.count : null
        })).sort(MGT2Helper.compareByName);
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /**
     * The one control in the system that writes `locked`. GM-only in `system.json`'s
     * `gmOnlyFields`, so a player's update is refused by the server as well as absent here.
     * @this {StashActorSheet}
     */
    static async #onLockToggle() {
        if (!game.user.isGM) return;
        return this.actor.update({ "system.locked": !this.actor.system.locked });
    }

    /** @this {StashActorSheet} */
    static #onItemEdit(event, target) {
        return this.actor.items.get(StashActorSheet.#itemId(target))?.sheet.render({ force: true });
    }

    /** @this {StashActorSheet} */
    static async #onItemDelete(event, target) {
        return this.actor.deleteEmbeddedDocuments("Item", [StashActorSheet.#itemId(target)]);
    }

    static #itemId(target) {
        return target.closest("[data-item-id]")?.dataset.itemId;
    }

    /* -------------------------------------------- */
    /*  Drag and Drop                               */
    /* -------------------------------------------- */

    /**
     * Reading is not taking. Dropping is already OWNER-gated by the parent, but dragging a row
     * *out* is not — the default permits it at any rung, and a drop on a character sheet copies
     * rather than moves, so an OBSERVER pricing a shop's stock could walk off with it.
     * @inheritDoc
     */
    _canDragStart(selector) {
        return this.isEditable;
    }

    /**
     * A stash takes what a `container` takes, by the same test: whatever carries a storage
     * reference has somewhere to be put, and a career or a skill does not. Something already on
     * this actor is only moved out to the top level; anything else is copied in with its contents.
     * @inheritDoc
     */
    async _onDropItem(event, item) {
        if (!this.actor.isOwner) return null;
        if (!("container" in item.system)) return null;

        if (this.actor.uuid === item.parent?.uuid) {
            if (!item.system.container?.id) return null;
            await item.update({ "system.container.id": "" });
            return item;
        }

        const toCreate = await copyItemWithContents(item);
        const created = await getDocumentClass("Item").createDocuments(toCreate,
            { parent: this.actor, keepId: true });
        return created?.[0] ?? null;
    }
}
