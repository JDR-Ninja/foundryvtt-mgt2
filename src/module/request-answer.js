import { Checks } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { ambushDM, REQUEST, UNRESOLVED } from "./request.js";
import { RollPromptHelper } from "./roll-prompt.js";
import { TravellerActorSheet } from "./actors/character-sheet.js";

/**
 * The nudge, namespaced because core reserves bare query names (`client/config.mjs`, "System and
 * modules must prefix the names of the queries they register").
 */
export const NUDGE_QUERY = "mgt2.nudge";

/** How long the flash sits on the card, matching `jumpToMessage`'s own mark. */
const FLASH_MS = 1600;

/**
 * Answer one line of a roll request.
 * @param {boolean} [options.prompt]   Force the prompt open — the shift-click path
 */
export async function answerRequest(message, lineId, { prompt = false } = {}) {
    const request = message?.system;
    if ( message?.type !== REQUEST ) return null;
    const read = request.reading.find(line => line.id === lineId);
    if ( !read ) return null;

    // The chit is the addressee's and the referee's, who owns everything.
    if ( !game.user.isGM && (read.user !== game.user.id) ) {
        return void ui.notifications.warn(game.i18n.localize("MGT2.Errors.RequestNotYours"));
    }
    if ( request.state !== "open" ) {
        return void ui.notifications.warn(game.i18n.localize("MGT2.Errors.RequestClosed"));
    }

    const actor = read.actor ? await fromUuid(read.actor) : null;
    if ( !actor?.system?.characteristics ) {
        return void ui.notifications.warn(game.i18n.localize("MGT2.Errors.RequestNoActor"));
    }

    const imposed = imposedOf(request, read);
    const rollOptions = seedOptions(request, read, actor, imposed);
    // Core p.63-64: on a `together` tally the resolver's prompt opens with the contributors'
    // answers already armed, summed and named.
    const chain = read.resolver ? contributorAnswers(request, read) : [];
    rollOptions.armed = chain;

    // One click, no dialog.
    const direct = !prompt && (request.chars.length === 1)
        && (request.skillMode !== "open") && (read.skillItem !== UNRESOLVED);
    const data = direct
        ? directAnswer(request, read, actor, rollOptions, chain)
        : await RollPromptHelper.roll(rollOptions);
    if ( !data ) return null;

    // Core p.64's imposed DM through the documented `extra` slot, which is where `#onRoll` already
    // puts its own terms. Core p.73's ambush is a second one, and its sign is this line's own.
    const extra = request.dm.value ? [[request.dm.label, request.dm.value]] : [];
    if ( imposed.ambush ) {
        extra.push([game.i18n.localize("MGT2.Request.Ambush"), imposed.ambush]);
    }
    const { formula, modifiers, chainSources, stance } =
        RollPromptHelper.terms(data, actor, rollOptions.checkModifiers, extra);

    const difficulty = Object.hasOwn(data, "difficulty") ? data.difficulty : request.difficulty;
    const outcome = await Checks.resolve({
        formula, rollData: actor.getRollData(), difficulty, prompt: data });
    if ( !outcome ) return null;

    const label = answerLabel(request, read, actor);
    return Checks.post(outcome, {
        actor,
        label,
        // The correlation, and the only thing tying an answer to a request.
        flags: { mgt2: { request: { message: message.id, line: read.id } } },
        mode: data.rollMode,
        // Companion p.7: a row the referee took is whispered, with the dice out of `rolls` and in
        // the body — a whispered message that CARRIES rolls announces itself to the table as `???`.
        secret: read.self === true,
        rollTypeName: game.i18n.localize("MGT2.Request.Prompt.Asked"),
        rollObjectName: label,
        difficulty,
        modifiers,
        chainSources,
        // Core p.61 verbatim: "a Boon and a Bane cancel each other out and the check is rolled
        // normally".
        lines: [request.flavor, stance.cancelled
            ? game.i18n.localize("MGT2.Request.Prompt.Cancelled") : null]
    });
}

/** The `imposed` block, read off the demand and this line's own frozen resolution. */
function imposedOf(request, read) {
    return {
        difficulty: request.difficulty,
        chars: [...request.chars],
        // Meaningless on a demand that names no skill, and `null` there would read as the referee
        // choosing untrained — so `skillMode` is read FIRST, which is the card's rule too.
        skillItem: ((request.skillMode === "named") && (read.skillItem !== UNRESOLVED))
            ? read.skillItem : undefined,
        stance: request.stance,
        timeframe: request.timeframe,
        dm: { label: request.dm.label, value: request.dm.value },
        // Core p.73's DM+-6, resolved to the one sign this line sits at.
        ambush: ambushDM(request.ambush, read.self),
        flavor: request.flavor
    };
}

/** What the seeded prompt opens on. */
function seedOptions(request, read, actor, imposed) {
    const characteristics = RollPromptHelper.actorCharacteristics(actor);
    const offered = request.chars.filter(key => characteristics.some(entry => entry._id === key));
    return {
        rollTypeName: game.i18n.localize("MGT2.Request.Prompt.Asked"),
        rollObjectName: answerLabel(request, read, actor),
        // Two or more offered is the referee narrowing a choice the player still makes, so the
        // blank "no characteristic" entry goes with them: the demand named characteristics.
        characteristics: offered.length
            ? characteristics.filter(entry => offered.includes(entry._id)) : characteristics,
        characteristic: (offered.length > 1) ? bestCharacteristic(actor, offered) : (offered[0] ?? ""),
        skills: RollPromptHelper.actorSkills(actor),
        skill: skillKey(request, read),
        checkModifiers: TravellerActorSheet.checkModifiers(actor),
        difficulty: request.difficulty,
        blocks: { skill: request.skillMode !== "none", range: false, traits: false,
            psionic: false, attack: false, extended: false },
        ceiling: actor.system.taskCeiling,
        strengthDM: actor.system.characteristics.strength?.dm ?? 0,
        imposed
    };
}

/**
 * The prompt's own `skill` sentinel for this line: an Item id where the referee's client resolved
 * one, `NP` where the referee chose untrained, and nothing at all where the demand named no skill
 * or this line could not resolve it — that line picks from its own vocabulary.
 */
function skillKey(request, read) {
    if ( request.skillMode !== "named" ) return "";
    if ( read.skillItem === UNRESOLVED ) return "";
    return (read.skillItem === null) ? "NP" : read.skillItem;
}

/** The best of what was offered, which is what the player would pick and what the roster printed. */
function bestCharacteristic(actor, offered) {
    let best = "";
    let dm = -Infinity;
    for ( const key of offered ) {
        const score = actor.system.characteristics[key];
        if ( score && (score.dm > dm) ) {
            dm = score.dm;
            best = key;
        }
    }
    return best;
}

/** What the answer card is called: the skill asked for, or the characteristic that stood in for it. */
function answerLabel(request, read, actor) {
    if ( (request.skillMode === "named") && request.skill ) return request.skill;
    const key = (request.chars.length === 1) ? request.chars[0]
        : bestCharacteristic(actor, request.chars);
    return key ? game.i18n.localize(MGT2.Characteristics[key] ?? key)
        : game.i18n.localize("MGT2.Request.Card");
}

/**
 * The one-click answer: the form the prompt would have come back with, built from the demand alone.
 */
function directAnswer(request, read, actor, rollOptions, chain) {
    const characteristic = rollOptions.characteristic;
    const skill = rollOptions.skill;
    const data = {
        characteristic,
        timeframes: request.timeframe,
        imposedStance: request.stance,
        difficulty: request.difficulty,
        chain
    };
    if ( rollOptions.blocks.skill ) data.skill = skill;
    // The prompt opens with every standing modifier ticked, so a click that skipped the dialog has
    // to tick them too — and a source whose rule names the checks it reaches follows the select
    // that decides them, exactly as `#scoped` does on the form.
    for ( const source of rollOptions.checkModifiers ) {
        const scoped = source.characteristics ? source.characteristics.includes(characteristic)
            : (source.skills ? source.skills.includes(skill) : true);
        data[`check-${source.key}`] = scoped;
    }
    return data;
}

/**
 * The answers the resolver's check chains from: every other line that has landed one, in the order
 * they landed.
 * @returns {string[]}   ChatMessage ids
 */
function contributorAnswers(request, read) {
    if ( request.tally !== "together" ) return [];
    return request.reading
        .filter(line => (line.id !== read.id) && (line.status === "answered") && line.message)
        .map(line => line.message)
        .filter(id => game.messages.get(id)?.visible);
}

/** Tell the addressees a request landed. */
export async function nudgeRequest(message) {
    if ( message?.type !== REQUEST ) return null;
    const wanted = new Set();
    for ( const line of message.system.lines ) {
        if ( !line.self && line.user && (line.user !== game.user.id) ) wanted.add(line.user);
    }
    const users = [...wanted].map(id => game.users.get(id)).filter(user => user?.active);
    if ( !users.length ) return null;
    // The payload is one id and must stay JSON-serialisable: the receiver reads the message out of
    // its own collection, which is where the per-client rendering rule already puts it.
    return getDocumentClass("User").queryMany(users, NUDGE_QUERY, { message: message.id });
}

/** The receiving half. */
async function onNudge({ message: id } = {}) {
    const mode = game.settings.get("mgt2", "request.nudge");
    if ( (mode === "off") || !id ) return false;
    const message = game.messages.get(id);
    if ( (message?.type !== REQUEST) || !message.visible ) return false;

    const line = message.system.reading.find(
        read => (read.user === game.user.id) && (read.status === "waiting"));
    if ( !line ) return false;

    // The log may be popped out, notified, or scrolled past `batchSize` with no node at all — so
    // the tab is flashed whatever happened to the card, and neither is required for the other.
    flash(document.querySelector(`.chat-message[data-message-id="${id}"]`), mode === "open");
    flash(document.querySelector('#sidebar-tabs [data-tab="chat"]'), false);
    // Not awaited, and never rolled for them: the query answers now, so the referee's own client is
    // not left holding a socket callback open for as long as the prompt sits on somebody's screen.
    if ( mode === "open" ) answerRequest(message, line.id, { prompt: true });
    return true;
}

/** The existing jump mark, borrowed: it answers "which one" and gets out of the way. */
function flash(node, scroll) {
    if ( !node ) return;
    if ( scroll ) node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("mgt2-jumped");
    setTimeout(() => node.classList.remove("mgt2-jumped"), FLASH_MS);
}

/**
 * The answering half of the feature: the seam `request.js` calls for the chit, the nudge query, and
 * the strip a check wears once it is an answer.
 */
export function registerRequestAnswer() {
    CONFIG.queries[NUDGE_QUERY] = onNudge;
    // Only the referee who composed it nudges: the hook fires on every client, and a request
    // re-posted by *Ask again* is a new demand and nudges again.
    Hooks.on("createChatMessage", message => {
        if ( (message?.type === REQUEST) && (message.author?.id === game.user.id) ) {
            nudgeRequest(message);
        }
    });
}

/**
 * The `ASKED` strip, in the existing `.from` vocabulary and injected into the rendered card rather
 * than added to `roll.html`, which keeps that template unchanged. The strip's own link is picked up
 * by the `chainSource` listener that runs after this.
 */
export function injectAskedStrip(message, html) {
    const flag = message?.flags?.mgt2?.request;
    if ( !flag?.message ) return;
    const card = html.querySelector(".mgt2.card");
    if ( !card || card.querySelector(".from.asked") ) return;

    const request = game.messages.get(flag.message);
    const strip = document.createElement("div");
    strip.className = "from asked";
    strip.innerHTML = '<i class="fa-regular fa-clipboard-list"></i>';
    const text = document.createElement("span");
    text.textContent = game.i18n.localize("MGT2.Request.Prompt.Asked");
    strip.append(text);
    // A request flushed out of the log leaves the strip saying what happened and nothing to click.
    if ( request?.visible ) {
        const link = document.createElement("a");
        link.dataset.action = "chainSource";
        link.dataset.messageId = flag.message;
        link.textContent = MGT2Helper.getDifficultyDisplay(request.system.difficulty)
            ?? game.i18n.localize("MGT2.Request.Card");
        text.append(" ", link);
    }
    card.prepend(strip);
}
