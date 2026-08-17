import { MGT2 } from "../config.js";
import { Rules } from "../rules.js";

/**
 * The characteristics as the damage-order editor needs them: the chain first, in order, then
 * everything else. Both lists are rendered up front and the editor only moves nodes between
 * them, so no markup is built in JavaScript.
 * @param {object} system   The actor's system data
 * @returns {object[]}
 */
export function prepareDamageOrder(system) {
    const chain = system.config.damageOrder;
    const roster = system.characteristicKeys;
    // The only site that needs a label for a pool which is not one of the twelve characteristics.
    const labels = { ...MGT2.Characteristics, ...MGT2.DamageTracks };
    const entry = key => {
        const c = system.characteristics[key];
        const inChain = chain.includes(key);
        return {
            key,
            label: labels[key] ?? key,
            value: c.value,
            max: c.max,
            inChain,
            // Without a maximum there is no way to know how far to drain it or where healing
            // stops, so it cannot be added. Chains stored before this rule are left alone.
            addable: c.max > 0
        };
    };

    // A characteristic the world has not adopted cannot be added to the chain — but one already in a
    // stored chain stays listed, because a rule switched off must not silently reroute damage. The
    // actor's own `show` flag is not consulted: hiding a characteristic has never stopped it taking
    // damage, and this is the control that decides that.
    const rest = roster.filter(k => !chain.includes(k) && Rules.characteristic(k));
    return chain.filter(k => roster.includes(k)).map(entry).concat(rest.map(entry));
}

/* -------------------------------------------- */

/**
 * Make the damage-order block interactive: drag to reorder, remove a link, add one from the
 * pool. The chain is mirrored into a hidden input so the dialog submits it like any other field.
 * @param {HTMLElement} root   The rendered dialog element
 */
export function activateDamageOrder(root) {
    const editor = root.querySelector(".mgt2-damage-order");
    if ( !editor ) return;

    const list = editor.querySelector("ol");
    const pool = editor.querySelector(".pool");
    const empty = editor.querySelector(".empty");
    const field = editor.querySelector('input[name="damageOrder"]');
    const chip = key => pool.querySelector(`.chip[data-key="${key}"]`);

    const sync = () => {
        const keys = [...list.querySelectorAll("li:not([hidden])")].map(li => li.dataset.key);
        field.value = keys.join(",");
        empty.hidden = keys.length > 0;
    };

    editor.addEventListener("click", event => {
        const add = event.target.closest(".chip");
        if ( add && !add.disabled ) {
            const item = list.querySelector(`li[data-key="${add.dataset.key}"]`);
            item.hidden = false;
            list.append(item);   // a re-added link goes to the end of the chain
            add.hidden = true;
            return sync();
        }

        const remove = event.target.closest(".remove");
        if ( !remove ) return;
        const item = remove.closest("li");
        item.hidden = true;
        chip(item.dataset.key).hidden = false;
        sync();
    });

    let dragged = null;
    list.addEventListener("dragstart", event => {
        dragged = event.target.closest("li");
        if ( !dragged ) return;
        dragged.classList.add("is-dragged");
        event.dataTransfer.effectAllowed = "move";
        // Firefox ignores a drag that carries no data.
        event.dataTransfer.setData("text/plain", dragged.dataset.key);
    });

    list.addEventListener("dragover", event => {
        const over = event.target.closest("li");
        if ( !dragged || !over || (over === dragged) ) return;
        event.preventDefault();
        const box = over.getBoundingClientRect();
        const before = event.clientY < (box.top + (box.height / 2));
        const ref = before ? over : over.nextElementSibling;
        // Re-inserting the dragged node where it already sits would restart the drag.
        if ( ref !== dragged ) list.insertBefore(dragged, ref);
    });

    list.addEventListener("dragend", () => {
        dragged?.classList.remove("is-dragged");
        dragged = null;
        sync();
    });

    list.addEventListener("drop", event => event.preventDefault());
}
