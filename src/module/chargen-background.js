import { Grants } from "./chargen-grants.js";
import { MGT2Helper } from "./helper.js";

const { DialogV2 } = foundry.applications.api;

const TEMPLATE = "systems/mgt2/templates/chargen/background.html";

const TABLE = "background";

/**
 * Core p.9's second step, which is not a step of a term either: the allowance is read off EDU at
 * one moment, before term 1, and spent once.
 */
export const CreationBackground = {

    /** Whether the step has been taken — a skill this step granted says so on its own provenance. */
    isSet(actor) {
        return this.taken(actor) > 0;
    },

    /** How many of the allowance actually landed, which is not the allowance. */
    taken(actor) {
        return Grants.skills(actor).filter(item => item.system.provenance?.table === TABLE).length;
    },

    /** The allowance. `count` is null where the frame prints dice rather than a number. */
    plan(actor) {
        return Grants.backgroundSkills(actor);
    },

    /**
     * Pick the allowance and grant it at level 0.
     * @returns {Promise<string[]|null>}   The names written, or null wherever the player stopped
     */
    async run(actor) {
        if ( !actor ) return null;
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        const plan = this.plan(actor);
        // A frame printing dice states an allowance nobody can count, so the roll comes first and
        // its total is what the picker then spends.
        const count = (plan.count === null) ? await rollAllowance(plan.formula) : plan.count;
        if ( count === null ) return null;
        if ( this.isSet(actor) ) {
            const again = await DialogV2.confirm({
                window: { title: "MGT2.Chargen.Background.Title" },
                classes: ["mgt2"],
                content: `<p>${game.i18n.format("MGT2.Chargen.Background.Again", { name: actor.name })}</p>`,
                rejectClose: false
            });
            if ( !again ) return null;
        }
        const picked = await pick(actor, plan, count);
        if ( !picked ) return null;
        // A row naming a skill already held buys nothing: the match folds case.
        const held = new Set(Grants.skills(actor).map(item => item.name));
        const written = [];
        for ( const name of picked ) {
            const grant = await Grants.grantSkill(actor, { name, level: 0, mode: "atLeast",
                provenance: { term: 0, table: TABLE } });
            if ( !grant || held.has(grant.item.name) ) continue;
            held.add(grant.item.name);
            written.push(grant.item.name);
        }
        const unspent = count - written.length;
        if ( unspent > 0 ) {
            ui.notifications.warn(MGT2Helper.plural("MGT2.Chargen.Background.Unspent", unspent,
                { name: actor.name, n: unspent }));
        }
        return written;
    }
};

/** A frame's own dice, rolled once so the picker knows how many rows to open. */
async function rollAllowance(formula) {
    if ( !formula ) return null;
    const roll = await new Roll(MGT2Helper.damageFormula(formula)).roll();
    return Math.max(0, roll.total);
}

/** The picker: one row per skill the allowance buys. */
async function pick(actor, plan, count) {
    const held = Grants.skills(actor).map(item => item.name);
    const offered = [...new Set([...plan.mandatory, ...plan.choices])]
        .sort((a, b) => a.localeCompare(b));
    // The mandatory ones are not a choice: they fill their rows and the allowance pays for them.
    const rows = Array.fromRange(Math.max(count, plan.mandatory.length)).map(index => ({
        name: `s${index}`,
        n: index + 1,
        fixed: plan.mandatory[index] ?? "",
        value: plan.mandatory[index] ?? ""
    }));
    if ( !rows.length ) {
        ui.notifications.warn(game.i18n.format(plan.fromFrame
            ? "MGT2.Chargen.Background.NoneFrame" : "MGT2.Chargen.Background.NoneEdu",
        { name: actor.name, dm: MGT2Helper.signed(plan.eduDM) }));
        return null;
    }

    const content = document.createElement("div");
    content.innerHTML = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
        name: actor.name,
        eduDM: MGT2Helper.signed(plan.eduDM),
        count: MGT2Helper.plural("MGT2.Chargen.Background.Allowance", rows.length, { n: rows.length }),
        rows,
        held: held.join(", "),
        options: offered.map(one => ({ value: one })),
        // Every skill anyone already holds, so a second Traveller types against the same words.
        known: [...new Set([...offered, ...held])].sort((a, b) => a.localeCompare(b))
    });
    return DialogV2.prompt({
        window: { title: "MGT2.Chargen.Background.Title", icon: "fa-solid fa-graduation-cap" },
        classes: ["mgt2"],
        position: { width: 420 },
        content,
        ok: {
            label: "MGT2.Chargen.Background.Take",
            icon: "fa-solid fa-check",
            callback: (event, button) => rows
                .map(row => button.form.elements[row.name].value.trim()).filter(one => one)
        },
        rejectClose: false
    });
}
