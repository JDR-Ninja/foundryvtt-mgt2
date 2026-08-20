import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { openDocket, recentLabel } from "./request.js";
import { TravellerActorSheet } from "./actors/character-sheet.js";

/** What core hangs on the wrapper element, and what it looks `onRender` up by. */
export const REQUEST_ENRICHER = "mgt2-request";

/** `@Request[…]{label}` — a demand written into an adventure, a journal or an item description. */
const PATTERN = /@Request\[(?<config>[^\]]+)](?:\{(?<label>[^}]+)})?/g;

/** Bare words that are syntax rather than a skill name. */
const FLAGS = Object.freeze({
    noskill: demand => { demand.skillMode = "none"; },
    anyskill: demand => { demand.skillMode = "open"; },
    boon: demand => { demand.stance = "boon"; },
    bane: demand => { demand.stance = "bane"; },
    faster: demand => { demand.timeframe = "Faster"; },
    slower: demand => { demand.timeframe = "Slower"; }
});

/** `key=value`, `key="two words"` and bare tokens, in the order they were written. */
function tokenise(config) {
    const rgx = /(?:(?<key>[a-zA-Z]+)=)?(?:"(?<quoted>[^"]*)"|(?<bare>[^\s"]+))/g;
    return [...config.matchAll(rgx)].map(match => ({
        key: match.groups.key?.toLowerCase() ?? "",
        value: match.groups.quoted ?? match.groups.bare ?? ""
    }));
}

/**
 * Config keys and their three-letter prefixes, which are unique across all twelve. Ids only: a
 * localised name would resolve differently on an English and a French client.
 */
function characteristicKeys(value) {
    const keys = Object.keys(MGT2.Characteristics);
    const wanted = [];
    for ( const part of String(value).split(/[,/]/) ) {
        const name = part.trim().toLowerCase();
        const key = keys.includes(name) ? name
            : ((name.length >= 3) ? keys.find(entry => entry.startsWith(name)) : null);
        if ( key && !wanted.includes(key) ) wanted.push(key);
    }
    return wanted;
}

/** A rung by its own name, or by the target number it prints — `dc=routine` and `dc=6+` are one. */
function difficultyKey(value) {
    const wanted = String(value).replace(/\+$/, "").trim().toLowerCase();
    const target = Number(wanted);
    if ( Number.isInteger(target) ) {
        return Object.keys(MGT2.DifficultyTargets)
            .find(key => MGT2.DifficultyTargets[key] === target) ?? "";
    }
    return Object.keys(MGT2.DifficultyChoices).find(key => key.toLowerCase() === wanted) ?? "";
}

/** `dm="-1 Low gravity"` — Core p.64 makes the provenance the point, so the value carries its own. */
function dmOf(value) {
    const match = /^\s*([+-]?\d+)\s*(.*)$/.exec(String(value));
    return match ? { value: Number(match[1]), label: match[2].trim() } : { value: 0, label: "" };
}

/**
 * The demand `@Request[…]` names, in exactly the shape `openDocket()` takes from the combat
 * tracker's own preset. **The skill stays the name the author typed and is resolved nowhere here**:
 * a name matched against one client's vocabulary resolves to an untrained DM-3 silently and
 * plausibly, so the resolution belongs to the Docket's roster, which prints it before anything is
 * sent.
 * @param {string} config   Whatever stood between the brackets
 */
export function parseRequest(config) {
    const demand = {
        skillMode: "named", skill: "", flavor: "", chars: [], difficulty: "",
        stance: "none", timeframe: "Normal", dm: { label: "", value: 0 },
        tally: "solo", ambush: "none"
    };
    const words = [];
    for ( const { key, value } of tokenise(config) ) {
        switch ( key ) {
            case "skill": demand.skill = value; break;
            case "char": case "chars": demand.chars = characteristicKeys(value); break;
            case "dc": case "difficulty": demand.difficulty = difficultyKey(value); break;
            case "why": case "reason": demand.flavor = value; break;
            case "dm": demand.dm = dmOf(value); break;
            case "tally": if ( value in MGT2.RequestTally ) demand.tally = value; break;
            case "ambush": if ( value in MGT2.RequestAmbush ) demand.ambush = value; break;
            case "": {
                const flag = FLAGS[value.toLowerCase()];
                if ( flag ) flag(demand);
                else words.push(value);
                break;
            }
            default: break;
        }
    }
    if ( !demand.skill ) demand.skill = words.join(" ");
    // Core p.58 makes a check with no skill a characteristic check rather than an open one, so a
    // demand that names none is that unless the author asked for `anyskill`.
    if ( !demand.skill && (demand.skillMode === "named") ) demand.skillMode = "none";
    return demand;
}

/** Bound once per element, never once per insertion. @type {WeakSet<HTMLElement>} */
const bound = new WeakSet();

/**
 * ⚠ `connectedCallback` runs again every time an enriched node is moved — a locked tooltip is
 * enough — and a second listener answers one click twice (foundry #13558, open on 14).
 */
function onRequestRender(element) {
    if ( bound.has(element) ) return;
    bound.add(element);
    const demand = JSON.parse(element.querySelector("[data-request]")?.dataset.request ?? "null");
    if ( !demand ) return;

    // Decided when the page is drawn rather than when the text was enriched: a ChatMessage's
    // `content` is enriched once, on its author's client, and read on everybody else's.
    const ask = element.querySelector("a.mgt2-request-ask");
    if ( !game.user.isGM ) ask?.remove();
    else ask?.addEventListener("click", event => {
        event.preventDefault();
        openDocket({ ...demand, from: "text" });
    });

    element.querySelector("a.mgt2-request")?.addEventListener("click", event => {
        event.preventDefault();
        rollRequest(demand);
    });
}

/** What the enricher leaves in the text: a link anyone may roll, and a bubble only a referee sends. */
function requestElement(demand, label) {
    const span = document.createElement("span");
    span.className = "mgt2-request-link";
    span.dataset.request = JSON.stringify(demand);

    const link = document.createElement("a");
    link.className = "content-link mgt2-request";
    link.append(icon("fa-regular fa-clipboard-list"), label || recentLabel(demand));
    link.dataset.tooltip = "";
    link.ariaLabel = game.i18n.localize("MGT2.Request.Enricher.RollHint");

    const ask = document.createElement("a");
    ask.className = "content-link mgt2-request-ask";
    ask.append(icon("fa-solid fa-comment-dots"));
    ask.dataset.tooltip = "";
    ask.ariaLabel = game.i18n.localize("MGT2.Request.Enricher.AskHint");

    span.append(link, ask);
    return span;
}

function icon(classes) {
    const node = document.createElement("i");
    node.className = classes;
    return node;
}

/** Whoever the reader is playing: their selected token first, then their assigned Traveller. */
function rollerActor() {
    const controlled = (canvas?.tokens?.controlled ?? [])
        .map(token => token.actor).filter(actor => actor?.system?.characteristics);
    const assigned = game.user.character;
    return controlled[0] ?? (assigned?.system?.characteristics ? assigned : null);
}

/**
 * The reader's own tier: the check the text names, rolled on the Traveller they are playing through
 * the sheet's own path. Nothing is imposed and nothing is frozen — text is not a referee, and an
 * `@Request` becomes a demand only when one sends it from the Docket.
 */
async function rollRequest(demand) {
    const actor = rollerActor();
    if ( !actor ) {
        return void ui.notifications.warn(game.i18n.localize("MGT2.Errors.RequestNoRoller"));
    }
    const rollable = actor.system.rollableCharacteristics ?? [];
    const characteristic = demand.chars.find(key => rollable.includes(key)) ?? "";
    // Core p.64 makes the provenance the point, so an unlabelled DM is not offered at all.
    const modifiers = (demand.dm.value && demand.dm.label)
        ? [{ key: "requestDm", label: demand.dm.label, dm: demand.dm.value }] : [];
    const what = { characteristic, difficulty: demand.difficulty, modifiers };

    if ( (demand.skillMode === "none") && characteristic ) {
        return TravellerActorSheet.roll(actor, { ...what, roll: "characteristic" });
    }
    // Matched against THIS Traveller's own Items and nowhere else. A name that matches none leaves
    // the prompt's skill select live and unchosen, which is the loud failure the Docket's roster is
    // for — never a silent DM-3.
    const skill = (demand.skillMode === "named") && demand.skill
        ? actor.items.find(item => (item.type === "talent") && (item.system.subType === "skill")
            && MGT2Helper.matchesSkill(item.name, demand.skill))
        : null;
    return TravellerActorSheet.roll(actor,
        skill ? { ...what, roll: "skill", skill: skill.id } : what);
}

/** The system's first text enricher. */
export function registerRequestEnricher() {
    CONFIG.TextEditor.enrichers.push({
        id: REQUEST_ENRICHER,
        pattern: PATTERN,
        enricher: match => requestElement(
            parseRequest(match.groups.config), match.groups.label?.trim() ?? ""),
        onRender: onRequestRender
    });
}
