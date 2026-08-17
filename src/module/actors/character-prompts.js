import { MGT2Helper } from "../helper.js";
import { ActorBaseData } from "./actor-base-data.js";
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
            render: (event, dialog) => {
                this.#gateChainRank(dialog.element);
                this.#wirePsiRest(dialog.element, context);
            },
            rejectClose: false
        });
    }

    /**
     * Core folio 228: PSI comes back at one point an hour, beginning three hours after the last
     * talent. This is the only procedure that reaches the reserve — it sits in no damage chain and
     * Core p.83 names it the exception to the mental track — so a psion who had spent their points
     * could otherwise only get them back by retyping the wound.
     *
     * The hours are typed and nothing is scheduled (§9.35), and the row writes into the dialog's own
     * `damage` field rather than the document: what the rule proposes is still the referee's to
     * overrule before saving. Built here rather than in the template because it belongs to one
     * characteristic out of twelve.
     */
    static #wirePsiRest(root, context) {
        if ( context.key !== "psionic" ) return;
        const damage = root.querySelector('input[name="damage"]');
        const grid = root.querySelector(".grid");
        if ( !damage || !grid ) return;

        // No `name`, so the hours never reach the update: only the wound they moved does.
        const block = buildElement(`
            <div class="dblock">
                <label class="drow">
                    <span class="lbl">${esc(game.i18n.localize("MGT2.Recovery.PsiHours"))}</span>
                    <input class="f n hours" type="number" step="1" min="0" value="0" />
                    <span class="dm"></span>
                </label>
                <p class="hint">${esc(game.i18n.localize("MGT2.Recovery.PsiRestHint"))}</p>
            </div>`).firstElementChild;
        grid.after(block);

        const spent = context.characteristic.damage;
        const hours = block.querySelector("input.hours");
        const readout = block.querySelector(".dm");
        const sync = () => {
            const recovered = Math.min(spent, ActorBaseData.psiRecovered(hours.value));
            damage.value = String(spent - recovered);
            readout.textContent = recovered > 0 ? `+${recovered}` : "—";
            readout.classList.toggle("zero", recovered === 0);
        };
        hours.addEventListener("input", sync);
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
    /*  Damage (Core folio 77)                      */
    /* -------------------------------------------- */

    /**
     * Type a wound or take one back. Strictly raw: a number typed by hand names no weapon, so no
     * scale, no Protection, no Effect floor and no damage-type transform apply — an attack carrying
     * all four goes through the chat card instead.
     *
     * The map is a preview and writes nothing, so folio 77's question is answered and the two states
     * it trips are stated before anything reaches the document.
     * @param {object} context   `{system, name, healLabel}`
     * @returns {Promise<{amount: number, direction: string, overflow: string}|null>}
     */
    static async openDamage(context) {
        const system = context.system;
        // The widest reading of folio 77's question — which links could take the overflow at all.
        // Whether it is actually asked is decided per amount, live, by the same method.
        const asks = system.overflowChoice(Number.MAX_SAFE_INTEGER);

        // The roster the type names, intersected with what its rule actually produces: a creature
        // with no Hits falls back to the two Traveller states and must not be offered four chips.
        const reported = system.damageStates;
        const states = Object.entries(system.damageStateLabels)
            .filter(([key, label]) => label && (key in reported))
            .map(([key, label]) => ({ key, label }));

        const content = await buildContent("systems/mgt2/templates/actors/actor-damage-sheet.html", {
            healLabel: context.healLabel,
            states,
            overflow: asks?.choices.map(key => ({ key, label: CharacterPrompts.#linkLabel(key) }))
        });

        return DialogV2.input({
            window: { title: `${game.i18n.localize("MGT2.Actor.Damage")} — ${context.name}` },
            classes: ["mgt2"],
            position: { width: 440 },
            content,
            ok: { label: "MGT2.Recovery.Apply", icon: "fa-solid fa-heart-crack" },
            render: (event, dialog) => CharacterPrompts.#wireDamage(dialog.element, system),
            rejectClose: false
        });
    }

    /** A chain link's label: a characteristic on a person, a pool on everything else. */
    static #linkLabel(key) {
        return CONFIG.MGT2.Characteristics[key] ?? CONFIG.MGT2.DamageTracks[key] ?? key;
    }

    /** The same link in the map's 2.6 rem name column, where the roster prints three letters. */
    static #linkShort(key) {
        return (key in CONFIG.MGT2.Characteristics)
            ? game.i18n.localize(`MGT2.Characteristics.${key}.short`)
            : game.i18n.localize(CharacterPrompts.#linkLabel(key));
    }

    /**
     * Lay `amount` on the chain without writing anything. Mirrors what `applyDamage` will do: damage
     * fills each link to its own maximum and the last one takes the remainder uncapped, with the
     * target's choice moved forward one place (Core folio 77); healing walks the chain backwards, so
     * the link injured last is repaired first.
     * @returns {{rows: object[], states: Record<string, boolean>}}
     */
    static #planDamage(system, amount, heal, overflow) {
        const chain = system.damageChain;
        const rows = chain.map(key => {
            const c = system.characteristics[key];
            return { key, label: CharacterPrompts.#linkShort(key), max: c.max, was: c.value, damage: c.damage, applied: 0 };
        });

        let left = Math.max(0, amount);
        if ( heal ) {
            for ( const row of [...rows].reverse() ) {
                const taken = Math.min(left, row.damage);
                row.applied = -taken;
                row.damage -= taken;
                left -= taken;
            }
        }
        else {
            const byKey = new Map(rows.map(row => [row.key, row]));
            const order = (overflow && (chain.indexOf(overflow) > 0))
                ? [chain[0], overflow, ...chain.slice(1).filter(key => key !== overflow)]
                : chain;
            for ( const [index, key] of order.entries() ) {
                if ( left <= 0 ) break;
                const row = byKey.get(key);
                const room = (index === order.length - 1) ? left : Math.max(0, row.max - row.damage);
                const taken = Math.min(room, left);
                row.applied += taken;
                row.damage += taken;
                left -= taken;
            }
        }
        for ( const row of rows ) row.now = Math.max(0, row.max - row.damage);

        // The states are read off the MODEL against this projection, never restated here: a creature
        // is driven off at half its Hits and a craft is wrecked rather than dead, and only the
        // sub-type knows that. Links outside the chain pass through — a robot's `inoperable` reads
        // INT, which no wound on the chain moves.
        const projected = { ...system.characteristics };
        for ( const row of rows ) {
            projected[row.key] = { ...system.characteristics[row.key], damage: row.damage, value: row.now };
        }
        return { rows, states: system.damageStatesFor(projected) };
    }

    /** Everything below the amount recomputes from the model on every keystroke, and writes nothing. */
    static #wireDamage(root, system) {
        const amount = root.querySelector("input.amount");
        const echo = root.querySelector(".dm.echo");
        const overRow = root.querySelector(".drow.over");
        const over = root.querySelector("select.overflow");
        const map = root.querySelector(".chainmap");
        const hint = root.querySelector("p.hint");

        const sync = () => {
            const heal = root.querySelector('input[name="direction"]:checked').value === "heal";
            const points = Math.max(0, Number(amount.value) || 0);
            echo.textContent = `${heal ? "+" : "−"}${points}`;
            echo.classList.toggle("bad", !heal && (points > 0));

            const choice = heal ? null : system.overflowChoice(points);
            if ( overRow ) {
                overRow.hidden = !choice;
                if ( choice ) root.querySelector(".dm.spill").textContent = `−${choice.remaining}`;
            }

            const plan = CharacterPrompts.#planDamage(system, points, heal, choice ? over.value : null);
            map.innerHTML = plan.rows.map(row => {
                const moved = row.applied !== 0;
                const tone = (row.applied > 0) ? " hit" : ((row.applied < 0) ? " heal" : "");
                const fill = row.max > 0 ? Math.min(100, (row.now / row.max) * 100) : 0;
                return `<div class="lk${tone}">
                    <span class="k">${esc(row.label)}</span>
                    <span class="g"><i class="${moved ? "" : "was"}" style="--g:${fill}%"></i></span>
                    <span class="n">${moved ? `<s>${row.was}</s><em>&rarr;</em>` : ""}${row.now}</span>
                    <span class="d">${moved ? (row.applied > 0 ? "−" : "+") + Math.abs(row.applied) : "&mdash;"}</span>
                </div>`;
            }).join("");

            for ( const chip of root.querySelectorAll(".outcome b[data-state]") ) {
                chip.classList.toggle("on", plan.states[chip.dataset.state] === true);
            }
            hint.textContent = game.i18n.localize(heal ? "MGT2.Actor.HealChainHint" : "MGT2.Actor.DamageRawHint");
        };

        amount.addEventListener("input", sync);
        over?.addEventListener("change", sync);
        for ( const radio of root.querySelectorAll('input[name="direction"]') ) {
            radio.addEventListener("change", sync);
        }
        sync();
    }

    /* -------------------------------------------- */
    /*  Grappling (Core folio 78)                   */
    /* -------------------------------------------- */

    /**
     * Core folio 78: "The winner of this check may choose to do one of the following." Eight rows,
     * each a name and the figure the folio attaches to it — never what the outcome does, which is
     * the same rule the trait registry follows. Nothing here is live: the Effect is settled by the
     * time the card offers the menu, so every figure is known when the dialog is built.
     * @param {object} context   `{winner, effect}`, off the check card's own flag
     * @returns {Promise<{outcome: string}|null>}
     */
    static async openGrapple(context) {
        const metre = game.i18n.localize(CONFIG.MGT2.MetricRange.meter).toLowerCase();
        const rows = Object.entries(CONFIG.MGT2.Grapple.outcomes).map(([key, rule], index) => `
            <label class="drow">
                <input type="radio" name="outcome" value="${key}"${index === 0 ? " checked" : ""} />
                <span>${esc(game.i18n.localize(rule.label))}</span>
                <span class="dm">${esc(CharacterPrompts.#grappleFigure(rule, context.effect, metre))}</span>
            </label>`).join("");

        const content = buildElement(`
            <div class="dlg">
                <div class="dblock" style="--lbl-col:1.2rem; --dm-col:5.4rem">${rows}</div>
                <p class="hint">${esc(game.i18n.format("MGT2.Grapple.Won",
                    { winner: context.winner, effect: MGT2Helper.signed(context.effect, "+0") }))}</p>
            </div>`);

        return DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Grapple.Title") },
            classes: ["mgt2"],
            position: { width: 400 },
            content,
            ok: { label: "MGT2.Grapple.Resolve", icon: "fa-solid fa-hands-bound" },
            rejectClose: false
        });
    }

    /** The number the folio prints beside an outcome, or an em dash where it prints none. */
    static #grappleFigure(rule, effect, metre) {
        if (rule.base !== undefined) return String(Math.max(0, rule.base + effect));
        if (rule.distance) return `${rule.distance} ${metre} · ${rule.damage}`;
        if (rule.metres) return `${rule.metres} ${metre}`;
        if (rule.takes !== undefined) return `${rule.takes}+`;
        return "—";
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
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Recovery.Points"))}</span>
                        <input class="f n points" type="number" name="points" step="1" min="0" value="0" />
                        <span class="dm"></span>
                    </label>
                    ${CharacterPrompts.#augmentRow(context.augment)}
                </div>
                ${CharacterPrompts.#conditions([game.i18n.localize("MGT2.Recovery.NeedFacility")])}
                <p class="hint">${esc(game.i18n.localize("MGT2.Recovery.SurgeryPointsHint"))}</p>
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
                const points = root.querySelector("input.points");
                const outcome = root.querySelector(".dm.outcome");
                // The formula proposes and the referee disposes: the field follows the Effect until
                // it is typed into, and the sentence always states the number that will be applied.
                let typed = false;
                const sync = () => {
                    const derived = CharacterPrompts.surgeryPoints(Number(effect.value) || 0);
                    if ( !typed ) points.value = String(derived.points);
                    const applied = CharacterPrompts.surgeryPoints(Number(effect.value) || 0, points.value);
                    outcome.textContent = game.i18n.format(
                        applied.success ? "MGT2.Recovery.Restores" : "MGT2.Recovery.Costs", { points: applied.points });
                    outcome.classList.toggle("bad", !applied.success);
                };
                effect.addEventListener("input", sync);
                points.addEventListener("input", () => { typed = true; sync(); });
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
     *
     * The literal reading is what ships, and the cost is therefore *surfaced* rather than imposed
     * (§9.22): `typed` is the number the dialog's own field carried, and it wins over the formula
     * whenever it carries one — which is how a table reading `3 + |Effect|` gets to type 9 for an
     * Effect of -6. The direction is not negotiable, because a failed check cannot heal.
     * @param {number} effect
     * @param {number|string|null} [typed]   The dialog's editable number, if it was submitted
     * @returns {{success: boolean, points: number, derived: number}}
     */
    static surgeryPoints(effect, typed) {
        const success = effect >= 0;
        const derived = success ? Math.max(1, effect) : Math.max(0, 3 + effect);
        // An emptied number input submits null, and `Number(null)` is a perfectly finite 0.
        const override = ((typed === null) || (typed === undefined) || (typed === "")) ? NaN : Number(typed);
        return { success, derived,
            points: Number.isFinite(override) ? Math.max(0, Math.trunc(override)) : derived };
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

    /* -------------------------------------------- */
    /*  Permanent characteristic change (folio 48-49)                                             */
    /* -------------------------------------------- */

    /**
     * One row of the permanent-change log (§9.39, §9.91). **Signed**: ageing and creation injuries
     * take, medical care gives back, and both are entries in the same list — so this one dialog is
     * every route into it and nothing here ever writes a characteristic's `base`.
     *
     * The deltas are typed because the rules make them a choice: ageing "repeats every term from the
     * fourth onwards and the PLAYER chooses which characteristics take the loss", and after the fact
     * there is no way to infer what a roll took. Record the choice; derive the total.
     *
     * @param {object} context   `{rows, sources, cash, terms}` — see `#prepareLossPrompt`
     * @returns {Promise<object|null>}
     */
    static async openCharacteristicLoss(context) {
        const sources = Object.entries(CONFIG.MGT2.CharacteristicLossSources).map(([key, label]) =>
            `<option value="${key}">${esc(game.i18n.localize(label))}</option>`).join("");
        const deltas = context.rows.map(row => `
            <label class="drow">
                <span class="lbl">${esc(row.label)}</span>
                <input class="f n delta" type="number" name="delta.${row.key}" step="1" value="0"
                    data-key="${row.key}" data-now="${row.now}" data-base="${row.base}" />
                <span class="dm move" data-for="${row.key}"></span>
            </label>`).join("");

        const content = buildElement(`
            <div class="dlg loss">
                <div class="dblock">
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Loss.Source"))}</span>
                        <select class="f source" name="source">${sources}</select>
                    </label>
                    <div class="row3">
                        <label class="drow">
                            <span class="lbl">${esc(game.i18n.localize("MGT2.Loss.Term"))}</span>
                            <input class="f n" type="number" name="term" step="1" min="0" value="" />
                        </label>
                        <label class="drow">
                            <span class="lbl">${esc(game.i18n.localize("MGT2.Loss.Age"))}</span>
                            <input class="f n" type="number" name="age" step="1" min="0" value="" />
                        </label>
                        <label class="drow">
                            <span class="lbl">${esc(game.i18n.localize("MGT2.Loss.Roll"))}</span>
                            <input class="f n" type="number" name="roll" step="1" value="" />
                        </label>
                    </div>
                </div>
                <div class="dblock">${deltas}</div>
                <div class="dblock">
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Loss.Cost"))}</span>
                        <input class="f n cost" type="number" name="cost" step="1" min="0" value="0" />
                        <span class="dm price"></span>
                    </label>
                    <label class="drow bill">
                        <input type="checkbox" class="billed" name="billed" />
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Loss.Bill"))}</span>
                        <span class="dm purse"></span>
                    </label>
                    <label class="drow">
                        <span class="lbl">${esc(game.i18n.localize("MGT2.Loss.Note"))}</span>
                        <input class="f" type="text" name="note" value="" />
                    </label>
                </div>
                <p class="hint why"></p>
            </div>`);

        return DialogV2.input({
            window: { title: game.i18n.localize("MGT2.Loss.Add") },
            classes: ["mgt2"],
            position: { width: 460 },
            content,
            ok: { label: "MGT2.Loss.Record", icon: "fa-solid fa-clock-rotate-left" },
            render: (event, dialog) => CharacterPrompts.#wireLoss(dialog.element, context),
            rejectClose: false
        });
    }

    /**
     * The two care sources have arithmetic of their own and the other four have none (§9.39).
     *
     * `medicalCare` prices what is typed — Cr5000 a point — so the cost follows the deltas.
     * `ageingCrisisCare` is the opposite: it prices ONE rolled sum and it decides the deltas itself,
     * so the delta fields go dark carrying the restoration and the cost field goes dark too, rolled
     * on apply. That is `#wireRadiation`'s device and the reason is the same — a figure the dialog
     * would have to invent is better rolled by the handler that applies it.
     */
    static #wireLoss(root, context) {
        const care = CONFIG.MGT2.CharacteristicCare;
        const source = root.querySelector("select.source");
        const cost = root.querySelector("input.cost");
        const price = root.querySelector(".dm.price");
        const billed = root.querySelector("input.billed");
        const purse = root.querySelector(".dm.purse");
        const why = root.querySelector("p.why");
        const deltas = [...root.querySelectorAll("input.delta")];

        const sync = () => {
            const kind = source.value;
            const crisis = kind === "ageingCrisisCare";

            // The crisis restoration is not a choice: every characteristic the log REDUCED to 0
            // comes back to 1. Folio 49 says *reduced*, so one that was never rolled — a Traveller
            // with no PSI — is not a casualty and is not restored.
            // **`readOnly` and not `disabled`** — a disabled input submits nothing, so the whole
            // restoration would be previewed here and then lost on the way out.
            for ( const field of deltas ) {
                const now = Number(field.dataset.now);
                const reduced = (now <= 0) && (Number(field.dataset.base) > 0);
                if ( crisis ) field.value = String(reduced ? (care.crisisFloor - now) : 0);
                field.readOnly = crisis;
                field.classList.toggle("locked", crisis);
                const move = root.querySelector(`.dm.move[data-for="${field.dataset.key}"]`);
                const delta = Number(field.value) || 0;
                const after = Math.max(0, now + delta);
                move.textContent = delta ? `${now} → ${after}` : "—";
                move.classList.toggle("bad", delta < 0);
                move.classList.toggle("good", delta > 0);
            }

            const restored = deltas.reduce((sum, f) => sum + Math.max(0, Number(f.value) || 0), 0);
            if ( kind === "medicalCare" ) {
                cost.disabled = false;
                cost.value = String(restored * care.perPoint);
                price.textContent = game.i18n.format("MGT2.Loss.PerPoint", { cr: care.perPoint });
            }
            else if ( crisis ) {
                cost.disabled = true;
                price.textContent = care.crisisFormula.replace("*", " × Cr");
            }
            else {
                cost.disabled = false;
                price.textContent = "";
            }

            // What billing it would actually do, stated before it happens.
            const due = crisis ? null : (Number(cost.value) || 0);
            const paid = (due === null) ? null : Math.min(context.cash, due);
            purse.textContent = !billed.checked ? ""
                : (due === null) ? game.i18n.localize("MGT2.Loss.BillOnRoll")
                    : game.i18n.format("MGT2.Loss.BillSplit",
                        { paid, debt: Math.max(0, due - paid), cash: context.cash });

            // A characteristic this row TAKES to 0, which is not the same as one already there: a
            // Traveller with no PSI has not suffered an ageing crisis.
            const zeroed = deltas.some(f => {
                const delta = Number(f.value) || 0;
                return (delta < 0) && ((Number(f.dataset.now) + delta) <= 0);
            });
            // What the chosen source means is a rule, so it hangs off the control as a tooltip; the
            // line below it stays for the one thing that is a state — a score about to reach 0.
            const crisis0 = zeroed && (kind === "ageing");
            source.dataset.tooltip = game.i18n.localize(`MGT2.CharacteristicLossHints.${kind}`);
            why.replaceChildren();
            if ( crisis0 ) {
                why.textContent = game.i18n.localize("MGT2.Loss.CrisisWarning");
                why.insertAdjacentHTML("beforeend",
                    `<i class="fa-solid fa-circle-info note" data-tooltip="${esc(game.i18n.localize("MGT2.Loss.CrisisWarningWhy"))}"></i>`);
            }
            why.classList.toggle("bad", crisis0);
        };

        source.addEventListener("change", sync);
        billed.addEventListener("change", sync);
        cost.addEventListener("input", sync);
        for ( const field of deltas ) field.addEventListener("input", sync);
        sync();
    }
}
