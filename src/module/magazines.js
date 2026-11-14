import { Rules } from "./rules.js";

/** Core folio 77: a weapon's magazine, and the spare magazines of the round loaded in it. */
export class Magazines {

    /** What one attack is counted against, or null where nothing counts it. @returns {{ammo: number, magazine: number}|null} */
    static counter(weapon) {
        if ( !Rules.on("magazines") ) return null;
        const system = weapon?.system;
        // The loaded round's capacity, where there is one: a grenade takes a 40-round rifle to 1.
        const magazine = system?.effective?.magazine ?? system?.magazine;
        if ( !system || (system.scale === "spacecraft") || !(magazine > 0) ) return null;
        return { ammo: system.ammo, magazine };
    }

    /** The loaded round's spares, its quantity counting full magazines (CSC folio 179), and why none can be taken. */
    static spares(weapon, seesLocked = game.user.isGM) {
        const round = weapon?.system.round ?? null;
        if ( !round ) return { round, spare: null, refusal: null };
        return { round, spare: (seesLocked || !round.isLocked) ? round.system.quantity : null,
            refusal: Magazines.#refusal(round, seesLocked) };
    }

    /** Why no magazine can be taken from this stack, or null: a player never reaches into a lock. */
    static #refusal(round, seesLocked) {
        if ( !seesLocked && round.isLocked ) return game.i18n.localize("MGT2.Errors.LockedContainer");
        if ( !(round.system.quantity > 0) ) return game.i18n.format("MGT2.Items.ReloadNoSpare", { round: round.name });
        return null;
    }

    /** A spare "will fully reload the weapon" (Core folio 77); the magazine taken out is discarded. */
    static async reload(weapon) {
        const { round, ammo, effective: { magazine } } = weapon.system;
        if ( !Rules.on("magazines") || !(magazine > 0) || (ammo >= magazine) ) return false;
        if ( !round ) return Boolean(await weapon.update({ "system.loaded": magazine }));
        const refusal = Magazines.#refusal(round, game.user.isGM);
        if ( refusal ) {
            ui.notifications.warn(refusal);
            return false;
        }
        await weapon.actor.updateEmbeddedDocuments("Item", [
            { _id: round.id, "system.quantity": round.system.quantity - 1 },
            { _id: weapon.id, "system.loaded": magazine }], { mgt2Reload: weapon.id });
        return true;
    }

    /** Changing the round is a reload, and the magazine taken out goes back to its stack only when full. */
    static async load(weapon, id) {
        const { system, actor } = weapon;
        if ( id === system.ammunition ) return false;
        const next = id ? actor?.items.get(id) : null;
        if ( id && (next?.type !== "ammunition") ) return false;
        if ( !actor || !Rules.on("magazines") ) return Boolean(await weapon.update({ "system.ammunition": id }));
        const gm = game.user.isGM;
        const magazine = next?.system.magazine ?? system.magazine;
        const out = system.round;
        const returned = out && (system.effective.magazine > 0) && (system.ammo >= system.effective.magazine);
        const refusal = ((next && (magazine > 0)) ? Magazines.#refusal(next, gm) : null)
            ?? ((returned && !gm && out.isLocked) ? game.i18n.localize("MGT2.Errors.LockedContainer") : null);
        if ( refusal ) {
            ui.notifications.warn(refusal);
            return false;
        }
        const writes = [{ _id: weapon.id, "system.ammunition": id, "system.loaded": (magazine > 0) ? magazine : null }];
        if ( next && (magazine > 0) ) writes.unshift({ _id: next.id, "system.quantity": next.system.quantity - 1 });
        if ( returned ) writes.unshift({ _id: out.id, "system.quantity": out.system.quantity + 1 });
        await actor.updateEmbeddedDocuments("Item", writes, { mgt2Reload: weapon.id });
        return true;
    }
}
