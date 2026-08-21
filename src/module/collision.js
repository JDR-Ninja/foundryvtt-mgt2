/**
 * Vehicle collisions — Vehicle Handbook 2026 p.11-12, behind the `vehicleCombat` rule.
 *
 * The schema holds none of what the impact turns on: whether the vehicles met head-on, what the
 * other one was doing, whether the barrier was built to crumple, which hull this one has, and
 * whether anyone was belted in. The referee states those, and the vehicle resolves the rest.
 */
import { MGT2 } from "./config.js";
import { Rules } from "./rules.js";

const { DialogV2 } = foundry.applications.api;

const CARD = "systems/mgt2/templates/chat/collision.html";

export class Collision {

    /** Prompt, resolve, apply every critical it raised, and report the whole thing once. */
    static async run(actor) {
        if ( Rules.get("vehicleCombat") !== "vehicle2026" ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Collision.RuleOff"));
        }
        const input = await Collision.#prompt(actor);
        if ( !input ) return;

        // VH2026 p.11: at twice the Spaces the larger one is rammed instead of running the
        // location-by-location procedure, so the two never resolve the same way.
        const size = actor.system.collisionSize(input.otherSpaces);
        if ( size === "larger" ) {
            const band = actor.system.collisionBand(input);
            const ram = await actor.system.ramDamage({ band, spaces: input.otherSpaces });
            await actor.system.applyDamage(ram.total, { facing: "forward" });
            return Collision.#card(actor, input, { potential: band, criticals: [], size, ram });
        }

        const result = await actor.system.resolveCollision(input);
        for ( const critical of result.criticals ) {
            if ( critical.location ) await actor.system.applyCritical(critical.location, critical.severity);
        }
        if ( size === "smaller" ) result.ram = await actor.system.ramDamage({ band: result.potential });
        result.size = size;
        return Collision.#card(actor, input, result);
    }

    static #options(vocabulary, selected) {
        return Object.entries(vocabulary).map(([key, entry]) =>
            `<option value="${key}"${(key === selected) ? " selected" : ""}>`
            + `${game.i18n.localize(entry.label)}</option>`).join("");
    }

    static async #prompt(actor) {
        const say = key => game.i18n.localize(`MGT2.Collision.${key}`);
        return DialogV2.prompt({
            window: { title: "MGT2.Collision.Title" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.Collision.Standing",
                { name: actor.name, band: actor.system.speed.effective })}</p>
                <div class="form-group"><label>${say("Mode")}</label>
                <select name="mode">${Collision.#options(MGT2.CollisionModes, "object")}</select></div>
                <div class="form-group"><label>${say("OtherBand")}</label>
                <input type="number" name="otherBand" value="0" min="0" step="1" /></div>
                <div class="form-group"><label>${say("OtherSpaces")}</label>
                <input type="number" name="otherSpaces" value="0" min="0" step="1" /></div>
                <div class="form-group"><label>${say("Hull")}</label>
                <select name="hull">${Collision.#options(MGT2.CollisionHulls, "standard")}</select></div>
                <div class="form-group"><label>${say("Protection")}</label>
                <input type="number" name="protection" value="0" min="0" step="1" /></div>
                <div class="form-group"><label>${say("Crumple")}</label>
                <input type="checkbox" name="crumple" /></div>
                <div class="form-group"><label>${say("Restrained")}</label>
                <input type="checkbox" name="restrained" /></div>`,
            ok: { label: "MGT2.Collision.Resolve",
                callback: (event, button) => ({
                    mode: button.form.elements.mode.value,
                    otherBand: Number(button.form.elements.otherBand.value) || 0,
                    otherSpaces: Number(button.form.elements.otherSpaces.value) || 0,
                    hull: button.form.elements.hull.value,
                    protection: Number(button.form.elements.protection.value) || 0,
                    crumple: button.form.elements.crumple.checked,
                    restrained: button.form.elements.restrained.checked }) },
            rejectClose: false
        });
    }

    static async #card(actor, input, result) {
        const table = actor.system.criticalTable;
        const content = await foundry.applications.handlebars.renderTemplate(CARD, {
            name: actor.name,
            mode: MGT2.CollisionModes[input.mode]?.label,
            potential: result.potential,
            dm: result.dm,
            rolled: (result.rolled ?? []).join(", "),
            discarded: (result.rolled ?? []).filter(die => die > result.potential).length,
            criticals: result.criticals.map(critical => ({
                label: table[critical.location]?.label ?? critical.location,
                severity: critical.severity, roll: critical.roll })),
            occupant: result.occupant,
            size: (result.size && (result.size !== "even"))
                ? `MGT2.Collision.Size.${result.size}` : null,
            ram: result.ram ?? null
        });
        return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
    }
}
