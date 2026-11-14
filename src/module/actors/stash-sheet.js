import { MGT2Helper } from "../helper.js";
import { copyItemWithContents } from "../item.js";
import { GuideButtonMixin } from "../guide.js";
import { SheetModeMixin } from "../sheet-mode.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const PARTS_PATH = "systems/mgt2/templates/actors";

/** Foundry's four rungs as words, because every label and gloss on this sheet keys off one. */
const RUNGS = { 0: "none", 1: "limited", 2: "observer", 3: "owner" };

/**
 * The stash sheet: an inventory nobody carries, and the only screen in the system where a lock does
 * anything.
 * @extends {ActorSheetV2}
 */
export class StashActorSheet extends GuideButtonMixin(SheetModeMixin(HandlebarsApplicationMixin(ActorSheetV2))) {

    /** @inheritDoc */
    static GUIDE_TOPIC = "stash";

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

        // Two gates, and neither of them is CSS.
        const reads = actor.testUserPermission(game.user, "OBSERVER");
        const opens = system.canOpen();
        const stash = {
            open: reads && opens,
            access: StashActorSheet.#access(actor, reads, opens),
            showWeight: system.showWeight,
            canEdit: this.isEditable,
            // Play mode folds an empty editor into one line; edit mode keeps both to fill in.
            vacant: { description: MGT2Helper.isBlankHtml(system.description),
                notes: game.user.isGM && MGT2Helper.isBlankHtml(system.notes) }
        };
        stash.ladder = StashActorSheet.#ladder(actor, stash.access.rung);
        // The value goes inside the guard with the inventory it sums, and is the one number a
        // player would most want off a locked cache.
        if (stash.open) {
            stash.contents = this.#contents();
            stash.count = system.count;
            stash.weight = system.weight;
            stash.unit = MGT2Helper.getWeightLabel();
            stash.value = system.value;
        }
        context.stash = stash;
        context.enriched = await MGT2Helper.enrichFields(actor, ["description", "notes"]);
        return context;
    }

    /** Which rung the viewer stands on and what it entitles them to. */
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

    /** The four levels in Foundry's order, each with who stands on it: the whole reason this is an Actor. */
    static #ladder(actor, viewerRung) {
        const fallback = RUNGS[actor.ownership.default] ?? "none";
        return Object.values(RUNGS).map(key => {
            const users = game.users.filter(user => !user.isGM && ((RUNGS[actor.getUserLevel(user)] ?? "none") === key))
                .map(user => ({ name: user.name, inherited: !(user.id in actor.ownership), you: user.id === game.user.id }));
            const isFallback = fallback === key;
            return { key, users, fallback: isFallback, people: users.length || isFallback,
                you: !game.user.isGM && (viewerRung === key) };
        });
    }

    /** One row per top-level thing. */
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
            held: (item.type === "container") ? item.system.count : null,
            fitted: item.fitted.flatMap(entry => [entry, ...entry.fitted]).map(entry => ({ _id: entry.id, name: entry.name }))
        })).sort(MGT2Helper.compareByName);
    }

    /** The one control in the system that writes `locked`. */
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

    /** Reading is not taking. @inheritDoc */
    _canDragStart(selector) {
        return this.isEditable;
    }

    /**
     * A stash takes what a `container` takes, by the same test: whatever carries a storage
     * reference has somewhere to be put, and a career or a skill does not.
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
