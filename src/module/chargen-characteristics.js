import { Grants } from "./chargen-grants.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { DialogV2 } = foundry.applications.api;

const TEMPLATE = "systems/mgt2/templates/chargen/characteristics.html";

/**
 * Core p.9's first step, which is not a step of a term: it runs once, before term 1, and the frame
 * decides which slots it fills and with which dice.
 */
export const CreationCharacteristics = {

    /** Whether the step has been taken — every slot the frame declares carries a score. */
    isSet(actor) {
        const characteristics = actor?.system.characteristics ?? {};
        const entries = Grants.plan(actor).entries;
        return (entries.length > 0)
            && entries.every(entry => (characteristics[entry.characteristic]?.base ?? 0) > 0);
    },

    /**
     * Roll the set, assign it and write it.
     * @returns {Promise<Record<string, number>|null>}   Null wherever the player stopped
     */
    async run(actor) {
        if ( !actor ) return null;
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        if ( this.isSet(actor) ) {
            const again = await DialogV2.confirm({
                window: { title: "MGT2.Chargen.Characteristics.Title" },
                classes: ["mgt2"],
                content: `<p>${game.i18n.format("MGT2.Chargen.Characteristics.Again",
                    { name: actor.name })}</p>`,
                rejectClose: false
            });
            if ( !again ) return null;
        }
        const rolled = await Grants.rollCharacteristics(actor);
        if ( !rolled ) {
            ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Characteristics.Nothing"));
            return null;
        }
        const scores = await assign(actor, rolled);
        if ( !scores ) return null;
        await Grants.assignCharacteristics(actor, scores);
        return scores;
    }
};

/** The picker: one row per slot the frame declares, one control per die the method leaves open. */
async function assign(actor, rolled) {
    const { plan } = rolled;
    const fixed = plan.method === MGT2.CreationPool.printed;
    const amounts = plan.pool ? rolled.dice : rolled.results.map(result => result.total);
    const values = amounts.map((amount, index) => ({ value: index, label: String(amount) }));
    const per = plan.pool ? MGT2.CreationPool.dicePerSlot : 1;
    let cursor = 0;
    const rows = plan.entries.map(entry => {
        const own = Array.fromRange(per).map(() => cursor++);
        return {
            key: entry.characteristic,
            label: entry.label,
            formula: MGT2Helper.showFormula(entry.rolled),
            values,
            slots: own.map(index => ({ name: `s${index}`, index })),
            total: own.reduce((sum, index) => sum + amounts[index], 0)
        };
    });

    const content = document.createElement("div");
    content.innerHTML = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
        name: actor.name,
        method: game.i18n.localize(`MGT2.Rules.creationAssignment.${plan.method}`),
        note: plan.note,
        fixed,
        rows
    });
    return DialogV2.prompt({
        window: { title: "MGT2.Chargen.Characteristics.Title", icon: "fa-solid fa-dice" },
        classes: ["mgt2"],
        position: { width: 420 },
        content,
        ok: {
            label: "MGT2.Chargen.Characteristics.Assign",
            icon: "fa-solid fa-check",
            callback: (event, button) => read(button.form, rows, amounts, fixed)
        },
        render: (event, dialog) => activate(dialog.element, amounts),
        rejectClose: false
    });
}

/** Read off the controls, so what is written is what the player was looking at. */
function read(form, rows, amounts, fixed) {
    const scores = {};
    for ( const row of rows ) {
        scores[row.key] = fixed ? row.total
            : row.slots.reduce((sum, slot) => sum + amounts[Number(form.elements[slot.name].value)], 0);
    }
    return scores;
}

/** Every picker holds a distinct result, so a change SWAPS the two rather than duplicating one. */
function activate(element, amounts) {
    const selects = [...element.querySelectorAll("select.slot")];
    const held = new Map(selects.map(select => [select, select.value]));
    const redraw = () => {
        for ( const row of element.querySelectorAll("[data-row]") ) {
            row.querySelector(".tot").textContent = [...row.querySelectorAll("select.slot")]
                .reduce((sum, select) => sum + amounts[Number(select.value)], 0);
        }
    };
    for ( const select of selects ) {
        select.addEventListener("change", () => {
            const taken = selects.find(other => (other !== select) && (other.value === select.value));
            if ( taken ) taken.value = held.get(select);
            for ( const one of selects ) held.set(one, one.value);
            redraw();
        });
    }
}
