import { MGT2Helper } from "../helper.js";

const fields = foundry.data.fields;

/**
 * Schema and behaviour of the `stash` Actor sub-type: a container nobody carries — a loot pile on
 * the floor, a shop's stock, a cache buried on a moon.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class StashData extends foundry.abstract.TypeDataModel {

    static LOCALIZATION_PREFIXES = ["MGT2.Actor.stash"];

    static defineSchema() {
        return {
            // What kind of stash this is, in the referee's own words — "shop stock · Regina
            // downport", "buried · left by Ilai Vosk, deceased".
            kind: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),

            // The first document in the system where a lock has a job: a player can see a stash
            // without being able to open it.
            locked: new fields.BooleanField({ required: false, initial: false }),
            lockedDescription: new fields.StringField({
                required: false, blank: true, trim: true, nullable: true, initial: "" }),

            // The weight total is optional because a shop's shelves are not a load anybody carries.
            showWeight: new fields.BooleanField({ required: false, initial: true }),

            description: new fields.HTMLField({ required: false, blank: true, trim: true, initial: "" }),
            notes: new fields.HTMLField({ required: false, blank: true, trim: true, initial: "" })
        };
    }

    /** What is in it. @type {Item[]} */
    get contents() {
        return this.parent.items.filter(item => !item.system.container?.id);
    }

    /** Mass of everything inside, nested containers included. @type {number} */
    get weight() {
        return MGT2Helper.roundWeight(this.contents.reduce(
            (sum, item) => sum + MGT2Helper.roundWeight(item.getTotalWeight()), 0));
    }

    /** Top-level rows only: a bag inside the stash counts as the one thing it is. @type {number} */
    get count() {
        return this.contents.reduce((sum, item) => sum + (item.system.quantity ?? 1), 0);
    }

    /**
     * What each top-level row is worth, keyed by item id — a bag reports what is inside it, exactly
     * as its weight does.
     * @type {Map<string, number>}
     */
    get valueByRow() {
        const rows = new Map();
        for ( const item of this.parent.items ) {
            const row = item.containerChain.at(-1) ?? item;
            // A dangling storage reference reaches no row, so it counts towards none — the same
            // items `weight` misses, for the same reason.
            if ( row.system.container?.id ) continue;
            rows.set(row.id, (rows.get(row.id) ?? 0) + StashData.#cost(item));
        }
        return rows;
    }

    /** What the lot is worth. @type {number} */
    get value() {
        return [...this.valueByRow.values()].reduce((sum, cost) => sum + cost, 0);
    }

    /** One item's price, stack included. */
    static #cost(item) {
        if ( !("container" in item.system) || !("cost" in item.system) ) return 0;
        const qty = item.system.quantity;
        return (!isNaN(qty) && qty > 0) ? item.system.cost * qty : 0;
    }

    /** Whether a user may see past the lid. @returns {boolean} */
    canOpen(user = game.user) {
        if ( !this.locked ) return true;
        return this.parent.testUserPermission(user, "OWNER");
    }

    /**
     * A stash is one place with one record behind it — a cache is not dropped twice — so its token
     * is linked, the same call `spacecraft` makes.
     * @inheritDoc
     */
    async _preCreate(data, options, user) {
        if ( data.prototypeToken?.actorLink !== undefined ) return;
        this.parent.updateSource({ prototypeToken: { actorLink: true } });
    }
}
