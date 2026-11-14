import { buildContent } from "./actors/character-prompts.js";
import { Chargen } from "./chargen.js";
import { MGT2 } from "./config.js";
import { CreditSplit } from "./credit-split.js";
import { MGT2Helper } from "./helper.js";
import { singularItemLimits } from "./item.js";

const { DialogV2 } = foundry.applications.api;
const TEMPLATES = "systems/mgt2/templates";

/** What a drop from the Items directory or a compendium onto a Traveller does with its price. */
export const PURCHASE_MODES = Object.freeze({
    off: "MGT2.CreditSplit.Settings.purchaseOnDrop.off",
    ask: "MGT2.CreditSplit.Settings.purchaseOnDrop.ask",
    always: "MGT2.CreditSplit.Settings.purchaseOnDrop.always"
});

/** Core p.97: an item is bought at its listed cost, out of Cash On Hand and never on credit. */
export class Purchase {

    /** What an Item and everything it holds cost, read off the data about to be created. */
    static price(itemsData) {
        return itemsData.reduce((sum, data) => sum + MGT2Helper.itemCost(data), 0);
    }

    /**
     * Whether a drop is paid for. The quantity chosen is written onto the head of `toCreate`.
     * @returns {Promise<{pay: boolean, quantity: number|null}|null>}   null when the drop is cancelled
     */
    static async confirm(actor, toCreate, source) {
        const mode = game.settings.get("mgt2", "credit.purchaseOnDrop");
        const head = toCreate[0];
        // Priced as `_preCreate` will create it: a computer or a software package is one, whatever was stored.
        for ( const [path, value] of Object.entries(singularItemLimits(head.type, head.system) ?? {}) ) {
            foundry.utils.setProperty(head, path, value);
        }
        const kept = { pay: false, quantity: head.system.quantity ?? null };
        // A copy from another Actor, a stash or a ship among them, moves gear between holders.
        if ( (mode === "off") || (actor.type !== "character") || source.parent ) return kept;
        const price = Purchase.price(toCreate);
        if ( price <= 0 ) return kept;
        if ( (mode === "always") && (price <= actor.system.finance.credits) ) return { ...kept, pay: true };

        const deal = await Purchase.#ask(actor, toCreate);
        if ( !deal ) return null;
        if ( deal.quantity !== null ) head.system.quantity = deal.quantity;
        return deal;
    }

    /** The price out of the purse, then the Items, then the card. @returns {Promise<boolean>} */
    static async pay(actor, toCreate) {
        const price = Purchase.price(toCreate);
        const before = actor.system.finance.credits;
        if ( price > before ) {
            ui.notifications.warn(game.i18n.format("MGT2.Purchase.Refused",
                { name: actor.name, credits: MGT2Helper.credits(price - before) }));
            return false;
        }
        await actor.update({ "system.finance.credits": before - price });

        let created = [];
        try {
            created = await actor.createEmbeddedDocuments("Item", toCreate, { keepId: true });
        } catch(err) {
            console.warn(`mgt2 | a paid purchase was not created: ${err.message}`);
        }
        if ( !created?.length ) {
            ui.notifications.error(game.i18n.format("MGT2.Purchase.PaidNotCreated",
                { name: actor.name, credits: MGT2Helper.credits(price) }));
        }
        await Purchase.#post(actor, toCreate[0], price);
        return created?.length > 0;
    }

    static async #ask(actor, toCreate) {
        const head = toCreate[0];
        const system = head.system;
        const cash = actor.system.finance.credits;
        const rest = Purchase.price(toCreate.slice(1));
        const unit = MGT2Helper.itemCost({ system: { ...system, quantity: 1 } });
        const fixed = !("quantity" in system) || (toCreate.length > 1)
            || (singularItemLimits(head.type, { ...system, quantity: 2 })?.["system.quantity"] !== undefined);
        const start = fixed ? (system.quantity ?? null) : Math.max(1, system.quantity);
        const loc = key => game.i18n.localize(key);
        const spec = [];
        if ( "tl" in system ) spec.push(loc(MGT2.TL[system.tl] ?? system.tl));
        if ( "legality" in system ) {
            spec.push(`${loc("MGT2.Items.Legality")} ${system.legality ?? loc("MGT2.Items.Unrestricted")}`);
        }

        const content = await buildContent(`${TEMPLATES}/purchase.html`, {
            name: head.name, img: head.img, spec: spec.join(" · "), quantity: start ?? 1, fixed,
            cash: MGT2Helper.credits(cash),
            preplay: Chargen.isInCreation(actor) ? MGT2Helper.credits(MGT2.MusterOut.preplayEquipment) : ""
        });
        const quantityOf = form => (fixed ? start : Math.max(1, Math.trunc(Number(form.elements.quantity.value) || 1)));
        const opening = MGT2Helper.credits((unit * (start ?? 1)) + rest);
        const deal = await DialogV2.wait({
            window: { title: game.i18n.format("MGT2.Purchase.Title", { name: actor.name }) },
            classes: ["mgt2"],
            position: { width: 400 },
            content,
            buttons: [
                { action: "pay", label: game.i18n.format("MGT2.Purchase.Pay", { price: opening }),
                    icon: "fa-solid fa-coins", default: true,
                    callback: (event, button) => ({ pay: true, quantity: quantityOf(button.form) }) },
                { action: "free", label: "MGT2.Purchase.AddFree", icon: "fa-solid fa-hand-holding",
                    callback: (event, button) => ({ pay: false, quantity: quantityOf(button.form) }) },
                { action: "cancel", label: "MGT2.Cancel", icon: "fa-solid fa-xmark" }
            ],
            render: (event, dialog) => Purchase.#wire(dialog.element, { unit, rest, cash, start, fixed }),
            rejectClose: false
        });
        return (deal && (typeof deal === "object")) ? deal : null;
    }

    /** The sums follow the quantity, and Pay is refused while the purse is short. */
    static #wire(root, { unit, rest, cash, start, fixed }) {
        const input = root.querySelector("input[name='quantity']");
        const pay = root.querySelector("button[data-action='pay']");
        const total = root.querySelector(".sums .total b");
        const after = root.querySelector(".sums .after");
        const money = MGT2Helper.credits;
        const sync = () => {
            const quantity = fixed ? (start ?? 1) : Math.max(1, Math.trunc(Number(input.value) || 1));
            const price = (unit * quantity) + rest;
            const short = price - cash;
            const shortText = game.i18n.format("MGT2.Purchase.Short", { credits: money(short) });
            total.textContent = `Cr${money(price)}`;
            after.classList.toggle("short", short > 0);
            after.querySelector("b").textContent = (short > 0) ? shortText : `Cr${money(cash - price)}`;
            pay.querySelector("span").textContent = game.i18n.format("MGT2.Purchase.Pay", { price: money(price) });
            pay.disabled = short > 0;
            if ( short > 0 ) {
                pay.dataset.tooltip = "";
                pay.setAttribute("aria-label", shortText);
            } else {
                delete pay.dataset.tooltip;
                pay.removeAttribute("aria-label");
            }
        };
        input?.addEventListener("input", sync);
        sync();
    }

    static async #post(actor, head, price) {
        const content = await foundry.applications.handlebars.renderTemplate(`${TEMPLATES}/chat/purchase.html`, {
            buyer: actor.name, item: head.name, quantity: head.system.quantity ?? 1,
            price: MGT2Helper.credits(price),
            left: game.settings.get("mgt2", "credit.balances") ? MGT2Helper.credits(actor.system.finance.credits) : null
        });
        return getDocumentClass("ChatMessage").create({
            author: game.user.id, speaker: ChatMessage.getSpeaker({ actor }), content,
            ...CreditSplit.audience(game.settings.get("mgt2", "credit.visibility"), [actor]) });
    }
}
