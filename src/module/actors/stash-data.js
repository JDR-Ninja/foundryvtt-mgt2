import { MGT2Helper } from "../helper.js";

const fields = foundry.data.fields;

/**
 * Schema and behaviour of the `stash` Actor sub-type: a container nobody carries — a loot pile on
 * the floor, a shop's stock, a cache buried on a moon.
 *
 * The thinnest Actor in the system, and what earns it a type is ownership and only ownership
 * (§9.34). An Item's ownership is its parent's, so showing players the party's loot means showing
 * them whoever holds it; an Actor carries its own. Inventory and weight are *not* reasons — the
 * `container` Item already aggregates both, and this reuses that logic at Actor level.
 *
 * No encumbrance line, ever: `container` needs `onHand` and `weightless` precisely to keep party
 * loot off whoever happens to hold it, and a stash has no carrier to protect.
 *
 * @extends {foundry.abstract.TypeDataModel}
 */
export class StashData extends foundry.abstract.TypeDataModel {

    static LOCALIZATION_PREFIXES = ["MGT2.Actor.stash"];

    static defineSchema() {
        return {
            // What kind of stash this is, in the referee's own words — "shop stock · Regina
            // downport", "buried · left by Ilai Vosk, deceased". A subtitle, never a discriminator.
            kind: new fields.StringField({ required: false, blank: true, trim: true }),

            // The first document in the system where a lock has a job: a player can see a stash
            // without being able to open it. Enforced HERE and only here — retrofitting enforcement
            // onto every `container` would lock inventories referees have been treating as open.
            locked: new fields.BooleanField({ required: false, initial: false }),
            lockedDescription: new fields.StringField({
                required: false, blank: true, trim: true, nullable: true }),

            // The weight total is optional because a shop's shelves are not a load anybody carries.
            showWeight: new fields.BooleanField({ required: false, initial: true }),

            description: new fields.HTMLField({ required: false, blank: true, trim: true }),
            notes: new fields.HTMLField({ required: false, blank: true, trim: true })
        };
    }

    /* -------------------------------------------- */
    /*  Accessors                                   */
    /* -------------------------------------------- */

    /**
     * What is in it. Read at each access rather than derived once, for the reason `ItemContainerData`
     * gives: the contents are sibling documents and a nested container is built before the items
     * pointing at it exist.
     * @type {Item[]}
     */
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
     * as its weight does. One pass and no second recursion: everything in a stash is a sibling of
     * everything else, so a nested bag's contents are already in this list, and `containerChain`
     * files each one under the row it ends up in. A `container` adds no price of its own, the way it
     * adds no mass of its own (`datamodels.js:580`).
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

    /**
     * What the lot is worth. A readout and never a till: a sum of stored costs, with nothing on the
     * stash sheet that buys, sells or prices anything (§9.34).
     * @type {number}
     */
    get value() {
        return [...this.valueByRow.values()].reduce((sum, cost) => sum + cost, 0);
    }

    /**
     * One item's price, stack included. Gated on `container` and not on `cost`, because the field
     * name is not the unit: a `component` prices in MCr and a talent's `cost` is PSI points, and
     * neither is a thing a stash can hold — the drop path refuses both by the same test.
     */
    static #cost(item) {
        if ( !("container" in item.system) || !("cost" in item.system) ) return 0;
        const qty = item.system.quantity;
        return (!isNaN(qty) && qty > 0) ? item.system.cost * qty : 0;
    }

    /**
     * Whether a user may see past the lid. A locked stash keeps its sheet open and withholds every
     * row — that is the whole point of the flag, and it is what makes "readable but not takeable"
     * expressible at all.
     * @param {User} [user]
     * @returns {boolean}
     */
    canOpen(user = game.user) {
        if ( !this.locked ) return true;
        return this.parent.testUserPermission(user, "OWNER");
    }

    /* -------------------------------------------- */
    /*  Document Lifecycle                          */
    /* -------------------------------------------- */

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
