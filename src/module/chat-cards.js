/** The client setting that folds a card down to its head. */
export const COLLAPSE_SETTING = "chatCollapse";

export const COLLAPSE_MODES = {
    never: "MGT2.Settings.chatCollapse.never",
    older: "MGT2.Settings.chatCollapse.older",
    always: "MGT2.Settings.chatCollapse.always"
};

/** How old a card is before `older` folds it. */
const OLDER_MS = 5 * 60 * 1000;

/** What this client opened or closed, per message: kept across re-renders and never stored. */
const states = new Map();

function stateOf(id) {
    if ( !states.has(id) ) states.set(id, { trays: {} });
    return states.get(id);
}

/** A tray's open state as this client last left it, or `fallback` where it never touched it. */
export function trayOpen(id, name, fallback = true) {
    return states.get(id)?.trays[name] ?? fallback;
}

/** Remember a tray's state; `tray` is the element to update, where it is in the DOM. */
export function setTray(id, name, open, tray = null) {
    stateOf(id).trays[name] = open;
    if ( tray ) keepBottom(tray, () => tray.classList.toggle("shut", !open));
}

/** A per-message value of the caller's own, kept the same way as the trays. */
export function cardState(id) {
    return stateOf(id);
}

/** An attack's targets are handed on with its damage, so its tray opens only until a damage card names it. */
function trayDefault(message, name) {
    return (name !== "targets") || !game.messages.some(other => other.flags?.mgt2?.attack === message.id);
}

function folded(message) {
    const state = states.get(message.id)?.fold;
    if ( state !== undefined ) return state;
    const mode = game.settings.get("mgt2", COLLAPSE_SETTING);
    if ( mode === "always" ) return true;
    return (mode === "older") && (message.timestamp < (Date.now() - OLDER_MS));
}

/** The scroller a card sits in: the sidebar log, a popped-out log or the notifications. */
function scrollerOf(element) {
    return element.closest(".chat-scroll, #chat-notifications .overflow");
}

/**
 * Open or close something without losing the bottom of the log: a reader pinned there stays pinned
 * while the grid rows animate, and a reader scrolled up keeps their place.
 */
export function keepBottom(element, change) {
    const scroller = scrollerOf(element);
    const pinned = scroller && ((scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop) < 4);
    change();
    if ( !pinned ) return;
    const until = performance.now() + 320;
    const step = () => {
        scroller.scrollTop = scroller.scrollHeight;
        if ( performance.now() < until ) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

/** The dice behind a result cell, as a popover so opening it moves nothing in the log. */
function wireDice(cell, popover) {
    let wasOpen = false;
    const close = () => popover.hidePopover();
    cell.addEventListener("pointerdown", () => { wasOpen = popover.matches(":popover-open"); });
    popover.addEventListener("toggle", event => {
        const scroller = scrollerOf(cell);
        if ( event.newState === "open" ) scroller?.addEventListener("scroll", close, { once: true });
        else scroller?.removeEventListener("scroll", close);
    });
    const open = () => {
        if ( wasOpen || popover.matches(":popover-open") ) return void (wasOpen = false);
        popover.showPopover();
        const at = cell.getBoundingClientRect();
        const size = popover.getBoundingClientRect();
        const below = at.bottom + 3;
        const top = ((below + size.height) > window.innerHeight) ? (at.top - size.height - 3) : below;
        popover.style.left = `${Math.max(3, Math.min(at.left, window.innerWidth - size.width - 3))}px`;
        popover.style.top = `${Math.max(3, top)}px`;
    };
    cell.addEventListener("click", open);
    cell.addEventListener("keydown", event => {
        if ( (event.key !== "Enter") && (event.key !== " ") ) return;
        event.preventDefault();
        wasOpen = popover.matches(":popover-open");
        if ( wasOpen ) close();
        else open();
    });
}

/** The fold, the trays and the dice of one rendered card. */
export function wireCard(message, html) {
    const card = html.querySelector(".mgt2.card");
    if ( !card ) return;

    if ( card.hasAttribute("data-fold") ) {
        card.classList.toggle("folded", folded(message));
        const head = card.querySelector("[data-fold-toggle]");
        head?.addEventListener("click", event => {
            if ( event.target.closest("a, button, input, select, [data-action]") ) return;
            const fold = !card.classList.contains("folded");
            stateOf(message.id).fold = fold;
            keepBottom(card, () => card.classList.toggle("folded", fold));
            head.setAttribute("aria-expanded", String(!fold));
        });
        head?.setAttribute("aria-expanded", String(!card.classList.contains("folded")));
    }

    for ( const tray of card.querySelectorAll("[data-tray]") ) {
        const name = tray.dataset.tray;
        tray.classList.toggle("shut", !trayOpen(message.id, name, trayDefault(message, name)));
        tray.querySelector(".tlab")?.addEventListener("click", event => {
            if ( event.target.closest(".seg, button, select") ) return;
            setTray(message.id, name, tray.classList.contains("shut"), tray);
        });
    }

    // The server drops an empty attribute, so a card stored with a bare `popover` arrives without it.
    const cell = card.querySelector("[data-dice]");
    const popover = card.querySelector(".xpop");
    if ( popover ) popover.popover = "auto";
    if ( cell && popover ) wireDice(cell, popover);
}

/** Core offers "Pop out message" only on a message flagged `core.canPopout`; every system card is one. */
export function registerCardHooks() {
    Hooks.on("preCreateChatMessage", message => {
        if ( !/class="(?:[^"]* )?mgt2 (?:[^"]* )?card[ "]/.test(message.content ?? "") ) return;
        if ( !message.getFlag("core", "canPopout") ) message.updateSource({ "flags.core.canPopout": true });
    });
    Hooks.on("createChatMessage", message => {
        const id = message.flags?.mgt2?.attack;
        if ( !id || (trayOpen(id, "targets", null) !== null) ) return;
        for ( const tray of foundry.applications.detached.querySelectorAll(
            `.chat-message[data-message-id="${id}"] [data-tray="targets"]`) ) {
            keepBottom(tray, () => tray.classList.add("shut"));
        }
    });
}

/** The setting reaches the cards already in the log; a card the reader toggled keeps its state. */
export function refreshFolds() {
    for ( const li of foundry.applications.detached.querySelectorAll(".chat-message[data-message-id]") ) {
        const message = game.messages.get(li.dataset.messageId);
        const card = li.querySelector(".mgt2.card[data-fold]");
        if ( message && card ) card.classList.toggle("folded", folded(message));
    }
}
