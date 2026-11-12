import { cardState, keepBottom, setTray } from "./chat-cards.js";
import { ChatHelper } from "./chatHelper.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const ROWS = "systems/mgt2/templates/chat/damage-rows.html";

/** Core folio 140: the facings a vehicle answers an attack with; `left` and `right` are synonyms. */
export const FACINGS = ["front", "rear", "sides", "top", "bottom"];
export const FACINGS_2026 = ["forward", "aft", "port", "starboard", "dorsal", "ventral"];

const facingsInForce = () => (Rules.get("vehicleCombat") === "vehicle2026") ? FACINGS_2026 : FACINGS;

/** The rows each rendered tray last drew, read back by its buttons. */
const drawn = new WeakMap();

export const STAMP_QUERY = "mgt2.stampApplied";
const STAMP_TIMEOUT = 10000;

/** A player's stamp is the referee's to write, queued so two stamps arriving together keep both. */
let writing = Promise.resolve();

/** Everything `applyDamage` reads off an attack, plus the facing it struck. */
export function damageOptions(payload, facing) {
    return {
        scale: payload.scale, ap: payload.ap, loPen: payload.loPen,
        effect: payload.effect, stun: payload.stun, formula: payload.formula,
        destructive: payload.destructive, blast: payload.blast,
        multiple: payload.multiple, damageType: payload.damageType, ion: payload.ion,
        ignoreArmour: payload.ignoreArmour, facing
    };
}

function amountOf(payload, reading) {
    return { full: payload.total, reduced: payload.reduced?.total, minimum: payload.minimum, immune: 0 }[reading]
        ?? payload.total;
}

/** Recorded at the attack where there was one, else this user's own targets; or the selection. */
function tokensOf(message, source) {
    if ( source === "selected" ) return (canvas.tokens?.controlled ?? []).map(token => token.document);
    const recorded = message.flags.mgt2.targets ?? [];
    if ( recorded.length ) {
        return recorded.map(target => fromUuidSync(target.uuid, { strict: false })).filter(token => token);
    }
    return Array.from(game.user.targets ?? [], token => token.document);
}

function appliedOf(message) {
    return new Set([...(message.flags.mgt2.applied ?? []), ...(cardState(message.id).applied ?? [])]);
}

function noteOf(preview) {
    switch ( preview.kind ) {
        case "stun": return [game.i18n.localize("MGT2.Chat.Damage.Stun"), preview.rounds > 0
            ? MGT2Helper.plural("MGT2.Chat.Damage.Incapacitated", preview.rounds, { n: preview.rounds }) : ""]
            .filter(part => part).join(" · ");
        case "shutdown": return MGT2Helper.plural("MGT2.Chat.Damage.Shutdown", preview.value, { n: preview.value });
        case "ion": return game.i18n.format("MGT2.Chat.Damage.IonDrain", { n: preview.value });
        case "disrupted": return game.i18n.localize("MGT2.Chat.Damage.Disrupted");
        default: return "";
    }
}

/** One token as the tray reads it, through the same pipeline `applyDamage` runs. */
function readToken(message, token, picked, state) {
    const payload = message.flags.mgt2.apply;
    const system = token.actor.system;
    // The defender's traits answer which reading applies, and overrule the pick where they speak.
    const byTraits = (system.damageResponse?.transform ?? "full") !== "full";
    const reading = byTraits ? system.damageTransform(payload.damageType ?? []) : picked;
    const group = token.actorLink ? token.actor.uuid : token.actorId;
    const facings = (token.actor.type === "vehicle") ? facingsInForce() : null;
    const facing = facings ? (state.facing?.[group] ?? facings[0]) : undefined;
    const options = damageOptions(payload, facing);
    const amount = amountOf(payload, reading);
    const preview = (reading === "immune") ? { kind: "immune", value: 0 }
        : system.previewDamage(amount, options);
    const met = ((preview.kind === "immune") || payload.ignoreArmour) ? 0
        : (system.protectionAgainst(options) * Math.max(1, payload.loPen ?? 1));
    return { token, group, reading, byTraits, facing, facings, amount, preview,
        met: (met > 0) ? [game.i18n.format("MGT2.Chat.Damage.Met", { protection: met }),
            payload.ap ? game.i18n.format("MGT2.Chat.Damage.AP", { score: payload.ap }) : ""]
            .filter(part => part).join(" − ") : "" };
}

/** The rows: one per token, identical unlinked tokens of one actor folded into one. */
function readRows(message) {
    const state = cardState(message.id);
    const picked = state.picked ?? "full";
    const applied = appliedOf(message);
    const seen = new Set();
    const rows = new Map();
    for ( const token of tokensOf(message, state.source) ) {
        if ( typeof token.actor?.system?.previewDamage !== "function" ) continue;
        // A linked actor is one actor however many of its tokens are on the board.
        const one = token.actorLink ? token.actor.uuid : token.uuid;
        if ( seen.has(one) ) continue;
        seen.add(one);
        const read = readToken(message, token, picked, state);
        const key = [read.group, read.reading, read.facing, read.preview.kind, read.preview.value, read.met].join("|");
        const row = rows.get(key);
        if ( row && !token.actorLink ) row.tokens.push(token);
        else rows.set(token.actorLink ? one : key, { ...read, tokens: [token] });
    }
    return [...rows.values()].map(row => {
        const owned = row.token.actor.isOwner;
        const name = (row.tokens.length > 1)
            ? game.i18n.format("MGT2.Chat.Damage.Group", { n: row.tokens.length, name: row.token.name })
            : row.token.name;
        const done = row.tokens.every(token => applied.has(token.uuid));
        const nothing = ["immune", "disrupted"].includes(row.preview.kind);
        return {
            uuids: row.tokens.map(token => token.uuid),
            group: row.group, amount: row.amount, facing: row.facing,
            name, img: MGT2Helper.tokenPortrait(row.token), numbers: owned,
            reading: game.i18n.localize(`MGT2.DamageTransforms.${row.reading}`),
            byTraits: row.byTraits, met: row.met, note: noteOf(row.preview),
            value: row.preview.value, void: nothing, applied: done,
            canApply: owned && !done && !nothing,
            applyLabel: game.i18n.format("MGT2.Chat.Damage.ApplyTo", { amount: row.preview.value, name }),
            facings: (owned && row.facings) ? row.facings.map(key => ({ key, selected: key === row.facing,
                label: game.i18n.localize(`MGT2.Actor.vehicle.Facing.${key}`) })) : null
        };
    });
}

/** Draw the rows for whoever the tray points at now, and the count on the button under it. */
async function fillTray(message, html) {
    const tray = html.querySelector('[data-tray="apply"]');
    const body = tray?.querySelector("[data-rows]");
    if ( !body ) return;
    const state = cardState(message.id);
    const rows = readRows(message);
    const content = await foundry.applications.handlebars.renderTemplate(ROWS, {
        rows,
        empty: game.i18n.localize((state.source === "selected")
            ? "MGT2.Chat.Damage.NoSelection" : "MGT2.Chat.Damage.NoTargets"),
        facingLabel: game.i18n.localize("MGT2.Chat.Damage.Facing"),
        appliedLabel: game.i18n.localize("MGT2.Chat.Damage.Applied")
    });
    keepBottom(body, () => { body.innerHTML = content; });
    drawn.set(tray, rows);
    const spent = rows.some(row => row.applied) && !rows.some(row => row.canApply);
    tray.classList.toggle("applied", spent);
    // A tray this client never touched opens unless everything in it was applied, here or elsewhere.
    if ( !("apply" in state.trays) ) tray.classList.toggle("shut", spent);

    for ( const button of body.querySelectorAll("[data-row] button.go") ) {
        const row = rows[Number(button.closest("[data-row]").dataset.row)];
        button.addEventListener("click", event => {
            event.stopPropagation();
            return applyRows(message, html, [row]);
        });
    }
    for ( const select of body.querySelectorAll("[data-row] select.face") ) {
        const row = rows[Number(select.closest("[data-row]").dataset.row)];
        select.addEventListener("change", () => {
            (state.facing ??= {})[row.group] = select.value;
            fillTray(message, html);
        });
    }

    const all = html.querySelector('button[data-action="applyAll"]');
    const count = rows.filter(row => row.canApply).reduce((sum, row) => sum + row.uuids.length, 0);
    if ( all ) {
        all.closest(".cbtns").hidden = count === 0;
        const label = all.querySelector("span") ?? all;
        label.textContent = MGT2Helper.plural("MGT2.Chat.Damage.ApplyAll", count, { n: count });
    }
}

function writeStamp(message, uuids) {
    const queued = writing.then(() => message.setFlag("mgt2", "applied",
        [...new Set([...(message.flags.mgt2.applied ?? []), ...uuids])]));
    writing = queued.catch(() => null);
    return queued;
}

/** The referee writes every stamp; with no referee on line, whoever may update the message does. */
async function stamp(message, uuids) {
    const gm = game.users.activeGM;
    if ( gm && !gm.isSelf && game.user.hasPermission("QUERY_USER") ) {
        try {
            return await gm.query(STAMP_QUERY, { message: message.id, uuids }, { timeout: STAMP_TIMEOUT });
        } catch(err) {
            console.warn(`mgt2 | the referee's client did not stamp the damage card: ${err.message}`);
            return false;
        }
    }
    if ( !message.canUserModify(game.user, "update") ) return false;
    await writeStamp(message, uuids);
    return true;
}

async function onStamp({ message: id, uuids } = {}, { user } = {}) {
    const message = game.messages.get(id);
    if ( !message?.flags?.mgt2?.apply || !user ) throw new Error("not a damage card");
    const owned = (uuids ?? []).filter(uuid => fromUuidSync(uuid, { strict: false })?.actor
        ?.testUserPermission(user, "OWNER"));
    if ( owned.length ) await writeStamp(message, owned);
    return owned.length > 0;
}

/** The tray stamps what it applied and closes; this client shows the stamp before the message carries it. */
async function applyRows(message, html, rows) {
    const payload = message.flags.mgt2.apply;
    const done = [];
    for ( const row of rows ) {
        if ( !row.canApply ) continue;
        for ( const uuid of row.uuids ) {
            const actor = fromUuidSync(uuid, { strict: false })?.actor;
            if ( !actor?.isOwner ) continue;
            await ChatHelper.applyToActor(actor, payload, row.amount, row.facing);
            done.push(uuid);
        }
    }
    if ( !done.length ) return;
    const state = cardState(message.id);
    state.applied = [...(state.applied ?? []), ...done];
    const left = (drawn.get(html.querySelector('[data-tray="apply"]')) ?? [])
        .some(row => row.canApply && !row.uuids.every(uuid => state.applied.includes(uuid)));
    if ( !left ) setTray(message.id, "apply", false, html.querySelector('[data-tray="apply"]'));
    await fillTray(message, html);
    return stamp(message, done);
}

/** Wire a damage card's application tray; false where the card has none. */
export function wireDamageTray(message, html) {
    const tray = html.querySelector('[data-tray="apply"]');
    if ( !tray || !message.flags?.mgt2?.apply ) return false;
    const state = cardState(message.id);
    state.source ??= ((message.flags.mgt2.targets?.length ?? 0) || game.user.targets.size)
        ? "targeted" : "selected";

    const sources = tray.querySelectorAll(".seg [data-source]");
    for ( const button of sources ) {
        button.setAttribute("aria-pressed", String(button.dataset.source === state.source));
        button.addEventListener("click", event => {
            event.stopPropagation();
            state.source = button.dataset.source;
            for ( const other of sources ) other.setAttribute("aria-pressed", String(other === button));
            fillTray(message, html);
        });
    }

    // The global pick is the viewer's own, so it lives in this client and never touches the message.
    const options = html.querySelectorAll(".dmgpick > [data-transform]");
    const pick = key => {
        for ( const option of options ) option.classList.toggle("on", option.dataset.transform === key);
    };
    if ( state.picked ) pick(state.picked);
    for ( const option of options ) {
        option.addEventListener("click", () => {
            state.picked = option.dataset.transform;
            pick(state.picked);
            fillTray(message, html);
        });
    }

    html.querySelector('button[data-action="applyAll"]')?.addEventListener("click", event => {
        event.preventDefault();
        return applyRows(message, html, drawn.get(tray) ?? []);
    });
    // Armour can change between two looks at the card, so the rows are read again as it is approached.
    html.addEventListener("pointerenter", () => fillTray(message, html));
    fillTray(message, html);
    return true;
}

function refresh(source) {
    for ( const li of foundry.applications.detached.querySelectorAll(".chat-message[data-message-id]") ) {
        const message = game.messages.get(li.dataset.messageId);
        if ( !li.querySelector('[data-tray="apply"]') || !message ) continue;
        if ( cardState(message.id).source === source ) fillTray(message, li);
    }
}

/** Selected follows the canvas live, and so does Targeted where the attack recorded nobody. */
export function registerDamageTrayHooks() {
    CONFIG.queries[STAMP_QUERY] = onStamp;
    const selected = foundry.utils.debounce(() => refresh("selected"), 60);
    const targeted = foundry.utils.debounce(() => refresh("targeted"), 60);
    Hooks.on("controlToken", selected);
    Hooks.on("targetToken", user => {
        if ( user === game.user ) targeted();
    });
}
