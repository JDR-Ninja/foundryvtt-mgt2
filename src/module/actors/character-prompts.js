import { activateDamageOrder, prepareDamageOrder } from "./damage-order.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Build the dialog body as a bare <div> with no attributes: DialogV2 runs `cleanHTML` on string
 * content, which would strip attributes off the rendered form controls.
 * @param {string} path   Template path
 * @param {object} data   Template context
 * @returns {Promise<HTMLDivElement>}
 */
export async function buildContent(path, data) {
    const content = document.createElement("div");
    content.innerHTML = await foundry.applications.handlebars.renderTemplate(path, data);
    return content;
}

/**
 * The same wrapper for markup this module builds itself. The healing prompts have no template of
 * their own: their rows are one per damaged characteristic and are known only at call time.
 * @param {string} html
 * @returns {HTMLDivElement}
 */
function buildElement(html) {
    const content = document.createElement("div");
    content.innerHTML = html;
    return content;
}

/** Item and actor names reach these dialogs, and they are built as markup. */
function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

/* -------------------------------------------- */

/**
 * A read-only pop-out showing the full species description.
 * This is a viewer rather than a form, so it is a small ApplicationV2 instead of a DialogV2
 * (which requires at least one button).
 * @extends {ApplicationV2}
 * @mixes HandlebarsApplication
 */
class EditorFullView extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["mgt2"],
        position: { width: 640, height: 520 },
        window: { resizable: true, title: "" }
    };

    /** @inheritDoc */
    // Not a root part: a root part that renders a single element gets replaced by its children,
    // which would drop the wrapper and its class.
    static PARTS = {
        body: { template: "systems/mgt2/templates/editor-fullview.html", scrollable: [""] }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.config = CONFIG.MGT2;
        context.html = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            this.options.rawHtml ?? "", { secrets: false });
        return context;
    }
}

/* -------------------------------------------- */

export class CharacterPrompts {

    /**
     * Configure initiative and the damage order.
     * @param {object} system   The actor's system data
     * @returns {Promise<object|null>}
     */
    static async openConfig(system) {
        const content = await buildContent("systems/mgt2/templates/actors/actor-config-sheet.html", {
            config: CONFIG.MGT2,
            system,
            ordered: prepareDamageOrder(system),
            chainLength: system.config.damageOrder.length,
            damageOrder: system.config.damageOrder.join(",")
        });

        return DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Actor.Configuration") },
            classes: ["mgt2"],
            position: { width: 440 },
            content,
            ok: { label: "MGT2.Save", icon: "fa-solid fa-floppy-disk" },
            render: (event, dialog) => activateDamageOrder(dialog.element),
            rejectClose: false
        });
    }

    /**
     * Configure one characteristic: its stored base, its rank in the damage chain, and what the
     * sheet shows of it.
     * @param {object} context   `{key, label, characteristic, rank, ranks, showAll}`
     * @returns {Promise<object|null>}
     */
    static async openCharacteristic(context) {
        const content = await buildContent(
            "systems/mgt2/templates/actors/actor-config-characteristic-sheet.html", context);

        return DialogV2.input({
            window: { title: `${game.i18n.localize("MGT2.Actor.Configuration")}: ${context.label}` },
            classes: ["mgt2"],
            position: { width: 420 },
            content,
            ok: { label: "MGT2.Save", icon: "fa-solid fa-floppy-disk" },
            render: (event, dialog) => this.#gateChainRank(dialog.element),
            rejectClose: false
        });
    }

    /**
     * A characteristic with no score has no pool to drain, so it cannot take a rank in the damage
     * chain. The control follows the base field as it is typed, and a disabled control submits
     * nothing — which is what leaves an existing chain untouched.
     */
    static #gateChainRank(root) {
        const base = root.querySelector('input[name="base"]');
        const rank = root.querySelector('select[name="rank"]');
        if ( !base || !rank ) return;

        const sync = () => {
            rank.disabled = !(Number(base.value) > 0);
            // The shared `.f` control paints its own colour, so core's :disabled styling never
            // shows through; without this the gate would be invisible until you clicked it.
            rank.style.opacity = rank.disabled ? "0.4" : "";
        };
        base.addEventListener("input", sync);
        sync();
    }

    /**
     * Show the full species description.
     * @param {string} title
     * @param {string} html
     */
    static async openEditorFullView(title, html) {
        return new EditorFullView({ window: { title: title || "" }, rawHtml: html }).render({ force: true });
    }

    /* -------------------------------------------- */
    /*  Healing (Core p.82-83)                      */
    /* -------------------------------------------- */

    /**
     * Core p.82 divides both first aid and surgery "as desired", so this one dialog ends both. The
     * pool is editable: the Effect a card carries is an offer, not a fact the referee must accept.
     * @param {object} context   `{title, points, opening, rows, conditions, note}`, `rows` being
     *                           `[{key, label, damage}]` and `conditions` labels that gate submit
     * @returns {Promise<Record<string, number>|null>}
     */
    static async openDistribution(context) {
        const opening = context.opening ?? {};
        const rows = context.rows.map(row => `
            <label class="drow">
                <span class="lbl">${esc(game.i18n.localize(row.label))}</span>
                <input class="f n share" type="number" name="points.${row.key}" step="1" min="0"
                       max="${row.damage}" value="${opening[row.key] ?? 0}" />
                <span class="dm">/ ${row.damage}</span>
            </label>`).join("");

        const content = buildElement(`
            <div class="dlg">
                <div class="dblock">
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Recovery.Points"))}</span>
                        <input class="f n pool" type="number" name="pool" step="1" min="0" value="${context.points}" />
                        <span class="dm left">0</span>
                    </label>
                    ${rows}
                </div>
                ${CharacterPrompts.#conditions(context.conditions)}
                ${context.note ? `<p class="hint">${esc(context.note)}</p>` : ""}
            </div>`);

        const result = await DialogV2.input({
            window: { title: game.i18n.localize(context.title) },
            classes: ["mgt2"],
            position: { width: 380 },
            content,
            ok: { label: "MGT2.Recovery.Apply", icon: "fa-solid fa-heart-pulse" },
            render: (event, dialog) => CharacterPrompts.#wireDistribution(dialog.element),
            rejectClose: false
        });

        // DialogV2.input hands back the flat FormData object, dotted names and all.
        return result ? (foundry.utils.expandObject(result).points ?? null) : null;
    }

    /** Keep the pool honest: what is left over, and no submit while it is overspent. */
    static #wireDistribution(root) {
        const pool = root.querySelector("input.pool");
        const shares = Array.from(root.querySelectorAll("input.share"));
        const left = root.querySelector(".dm.left");

        const sync = () => {
            const remaining = (Number(pool.value) || 0)
                - shares.reduce((sum, input) => sum + (Number(input.value) || 0), 0);
            left.textContent = String(remaining);
            left.classList.toggle("zero", remaining === 0);
            left.classList.toggle("bad", remaining < 0);
            CharacterPrompts.#gateSubmit(root);
        };
        for (const input of [pool, ...shares]) input.addEventListener("input", sync);
        CharacterPrompts.#wireConditions(root);
        sync();
    }

    /** The Medic check behind a surgery: its Effect decides which way the operation goes. */
    static async openSurgery(context) {
        const content = buildElement(`
            <div class="dlg">
                <div class="dblock">
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Recovery.Effect"))}</span>
                        <input class="f n effect" type="number" name="effect" step="1" value="0" />
                        <span class="dm outcome"></span>
                    </label>
                    ${CharacterPrompts.#augmentRow(context.augment)}
                </div>
                ${CharacterPrompts.#conditions([game.i18n.localize("MGT2.Recovery.NeedFacility")])}
            </div>`);

        return DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Recovery.Surgery") },
            classes: ["mgt2"],
            position: { width: 380 },
            content,
            ok: { label: "MGT2.Recovery.Resolve", icon: "fa-solid fa-syringe" },
            render: (event, dialog) => {
                const root = dialog.element;
                const effect = root.querySelector("input.effect");
                const outcome = root.querySelector(".dm.outcome");
                const sync = () => {
                    const value = Number(effect.value) || 0;
                    const points = CharacterPrompts.surgeryPoints(value);
                    outcome.textContent = game.i18n.format(
                        points.success ? "MGT2.Recovery.Restores" : "MGT2.Recovery.Costs", { points: points.points });
                    outcome.classList.toggle("bad", !points.success);
                };
                effect.addEventListener("input", sync);
                sync();
                CharacterPrompts.#wireAugment(root, context.augment);
                CharacterPrompts.#wireConditions(root);
            },
            rejectClose: false
        });
    }

    /**
     * Core p.82: surgery restores like first aid — the Effect, minimum one — and a failed check
     * instead costs 3 + the Effect. That sum shrinks as the check gets worse and goes negative below
     * Effect -3, so it is floored: an operation that went wrong cannot heal.
     * @returns {{success: boolean, points: number}}
     */
    static surgeryPoints(effect) {
        return (effect >= 0)
            ? { success: true, points: Math.max(1, effect) }
            : { success: false, points: Math.max(0, 3 + effect) };
    }

    /** The doctor and the ward, neither of which is on the patient's sheet. */
    static async openMedicalCare(context) {
        const content = buildElement(`
            <div class="dlg">
                <div class="dblock">
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Recovery.MedicSkill"))}</span>
                        <input class="f n medic" type="number" name="medic" step="1" min="0" value="0" />
                        <span class="dm total"></span>
                    </label>
                    ${CharacterPrompts.#augmentRow(context.augment)}
                </div>
                ${CharacterPrompts.#conditions([
                    game.i18n.localize("MGT2.Recovery.NeedFacility"),
                    game.i18n.localize("MGT2.Recovery.BedRest")
                ])}
            </div>`);

        return DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Recovery.MedicalCare") },
            classes: ["mgt2"],
            position: { width: 380 },
            content,
            ok: { label: "MGT2.Recovery.Apply", icon: "fa-solid fa-heart-pulse" },
            render: (event, dialog) => {
                const root = dialog.element;
                const medic = root.querySelector("input.medic");
                const total = root.querySelector(".dm.total");
                const sync = () => {
                    total.textContent = game.i18n.format("MGT2.Recovery.Restores",
                        { points: Math.max(0, 3 + context.enduranceDM + (Number(medic.value) || 0)) });
                };
                medic.addEventListener("input", sync);
                sync();
                CharacterPrompts.#wireAugment(root, context.augment);
                CharacterPrompts.#wireConditions(root);
            },
            rejectClose: false
        });
    }

    /* -------------------------------------------- */
    /*  Radiation (Core folio 81)                   */
    /* -------------------------------------------- */

    /**
     * One dose. Core folio 81's Radiation Exposure table is offered as it is printed — pick a source
     * and its figure is rolled — and the field beside it is the exposure the table does not cover,
     * which is most of them. Folio 100's armour Rad score is stated rather than typed: it is already
     * on the sheet, and it comes off whichever route the dose arrived by.
     * @param {object} context   `{rads, protection}`
     * @returns {Promise<{source: string, rads: string}|null>}
     */
    static async openRadiation(context) {
        const sources = Object.entries(CONFIG.MGT2.RadiationSources).map(([key, source]) =>
            `<option value="${key}">${esc(game.i18n.localize(source.label))} — ${esc(source.formula)}</option>`);

        const content = buildElement(`
            <div class="dlg">
                <div class="dblock">
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Radiation.Source"))}</span>
                        <select class="f source" name="source">
                            <option value="">${esc(game.i18n.localize("MGT2.Radiation.Typed"))}</option>
                            ${sources.join("")}
                        </select>
                    </label>
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Actor.Rads"))}</span>
                        <input class="f n rads" type="number" name="rads" step="1" min="0" value="0" />
                        <span class="dm outcome"></span>
                    </label>
                </div>
                <p class="hint">${esc(game.i18n.format("MGT2.Radiation.Standing", context))}</p>
            </div>`);

        return DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Radiation.Exposure") },
            classes: ["mgt2"],
            position: { width: 400 },
            content,
            ok: { label: "MGT2.Radiation.Expose", icon: "fa-solid fa-radiation" },
            render: (event, dialog) => CharacterPrompts.#wireRadiation(dialog.element, context),
            rejectClose: false
        });
    }

    /**
     * A picked source rolls its own figure on submit, so the typed field goes dark and the readout
     * says which band a dose of that size lands in rather than pretending to know the total.
     */
    static #wireRadiation(root, context) {
        const source = root.querySelector("select.source");
        const rads = root.querySelector("input.rads");
        const outcome = root.querySelector(".dm.outcome");
        const sync = () => {
            const picked = CONFIG.MGT2.RadiationSources[source.value];
            rads.disabled = Boolean(picked);
            const dose = picked ? null : Math.max(0, (Number(rads.value) || 0) - context.protection);
            outcome.textContent = (dose === null) ? picked.formula
                : game.i18n.format("MGT2.Radiation.Reaching", { rads: dose });
            outcome.classList.toggle("bad", dose > 0);
        };
        source.addEventListener("change", sync);
        rads.addEventListener("input", sync);
        sync();
    }

    /* -------------------------------------------- */

    /**
     * Core p.83's augment interference, offered and never applied: the system cannot know which
     * implant is "relevant", and the facility's Tech Level is not on any sheet — so the referee
     * types it and reads the modifier off.
     */
    static #augmentRow(augment) {
        const label = augment
            ? esc(game.i18n.format("MGT2.Recovery.AugmentAt", { name: augment.name, tl: augment.tl }))
            : esc(game.i18n.localize("MGT2.Recovery.AugmentNone"));
        return `
            <label class="drow">
                <span class="lbl">${esc(game.i18n.localize("MGT2.Recovery.FacilityTL"))}</span>
                <input class="f n facility" type="number" name="facilityTL" step="1" min="0" value="" />
                <span class="dm augment"></span>
            </label>
            <p class="hint augment-name">${label}</p>`;
    }

    static #wireAugment(root, augment) {
        const facility = root.querySelector("input.facility");
        const readout = root.querySelector(".dm.augment");
        const sync = () => {
            const tl = facility.value === "" ? null : Number(facility.value);
            const dm = (augment && (tl !== null) && !isNaN(tl)) ? Math.min(0, tl - augment.tl) : null;
            readout.textContent = (dm === null) ? "—" : `DM${dm === 0 ? "0" : dm}`;
            readout.classList.toggle("bad", dm < 0);
        };
        facility.addEventListener("input", sync);
        sync();
    }

    /** Facts the sheet cannot check. They are confirmed, not assumed, so nothing submits without them. */
    static #conditions(labels) {
        if ( !labels?.length ) return "";
        const boxes = labels.map(label =>
            `<label><input type="checkbox" class="cond" /><span>${esc(label)}</span></label>`).join("");
        return `<div class="dstates">${boxes}</div>`;
    }

    static #wireConditions(root) {
        for (const box of root.querySelectorAll("input.cond")) {
            box.addEventListener("change", () => CharacterPrompts.#gateSubmit(root));
        }
        CharacterPrompts.#gateSubmit(root);
    }

    /** Every gate is read off the DOM, so two of them on one dialog cannot undo each other. */
    static #gateSubmit(root) {
        const button = root.querySelector('button[data-action="ok"], .form-footer button[type="submit"]');
        if ( !button ) return;
        const unconfirmed = root.querySelector("input.cond:not(:checked)") !== null;
        const overspent = Number(root.querySelector(".dm.left")?.textContent ?? 0) < 0;
        button.disabled = unconfirmed || overspent;
    }
}
