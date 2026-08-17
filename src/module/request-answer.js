import { Checks } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { REQUEST, UNRESOLVED } from "./request.js";
import { RollPromptHelper } from "./roll-prompt.js";
import { TravellerActorSheet } from "./actors/character-sheet.js";

/**
 * The nudge, namespaced because core reserves bare query names
 * (`client/config.mjs`, "System and modules must prefix the names of the queries they register").
 */
export const NUDGE_QUERY = "mgt2.nudge";

/** How long the flash sits on the card, matching `jumpToMessage`'s own mark. */
const FLASH_MS = 1600;

/* -------------------------------------------- */
/*  Answering one line                          */
/* -------------------------------------------- */

/**
 * Answer one line of a roll request (`ROLL-REQUEST.md` §10 item 7). The demand reaches `terms()`
 * intact or it does not reach it at all: every imposed value is a static readout with a hidden
 * mirror, the imposed DM travels in the documented `extra` slot, and the imposed stance is resolved
 * against the footer button per Core p.61.
 *
 * **What the demand left open decides the friction** (§5.1): one characteristic named and the skill
 * resolved is one click; anything else opens the seeded prompt, and shift-click always does.
 *
 * @param {ChatMessage} message
 * @param {string} lineId
 * @param {object} [options]
 * @param {boolean} [options.prompt]   Force the prompt open — the shift-click path
 */
export async function answerRequest(message, lineId, { prompt = false } = {}) {
    const request = message?.system;
    if ( message?.type !== REQUEST ) return null;
    const read = request.reading.find(line => line.id === lineId);
    if ( !read ) return null;

    // §5.1: the chit is the addressee's and the referee's, who owns everything. Guarded here as
    // well as in the render, because a card is a document and its DOM is not a permission.
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
    // answers already armed, summed and named. The arming is the REQUEST's, not a click on this
    // client, which is what `armChain`'s per-client set could never carry (item 8).
    const chain = read.resolver ? contributorAnswers(request, read) : [];
    rollOptions.armed = chain;

    // One click, no dialog. The demand fixed the characteristic and the skill resolved, so there is
    // nothing left to ask — and a dialog whose every control is a readout is a dialog for nothing.
    const direct = !prompt && (request.chars.length === 1)
        && (request.skillMode !== "open") && (read.skillItem !== UNRESOLVED);
    const data = direct
        ? directAnswer(request, read, actor, rollOptions, chain)
        : await RollPromptHelper.roll(rollOptions);
    if ( !data ) return null;

    // Core p.64's imposed DM through the documented `extra` slot, which is where `#onRoll` already
    // puts its own terms. No new term slot, and no second place a DM can enter a formula.
    const extra = request.dm.value ? [[request.dm.label, request.dm.value]] : [];
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
        // The correlation, and the only thing tying an answer to a request. It rides the ANSWER
        // because a player cannot update a ChatMessage (§8).
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
        // normally". Named on the card, because a 2d6 with a Bane on the demand needs explaining.
        lines: [request.flavor, stance.cancelled
            ? game.i18n.localize("MGT2.Request.Prompt.Cancelled") : null]
    });
}

/* -------------------------------------------- */

/** The `imposed` block §8 names, read off the demand and this line's own frozen resolution. */
function imposedOf(request, read) {
    return {
        difficulty: request.difficulty,
        chars: [...request.chars],
        // Meaningless on a demand that names no skill, and `null` there would read as the referee
        // choosing untrained — so `skillMode` is read FIRST, which is the card's rule too. An
        // `unresolved` line imposes no skill either: it posts as open-skill for that line alone,
        // which is what keeps a mixed-language table off a silent Core p.59 DM-3.
        skillItem: ((request.skillMode === "named") && (read.skillItem !== UNRESOLVED))
            ? read.skillItem : undefined,
        stance: request.stance,
        timeframe: request.timeframe,
        dm: { label: request.dm.label, value: request.dm.value },
        flavor: request.flavor
    };
}

/**
 * What the seeded prompt opens on. The characteristic list is narrowed to what the referee offered
 * (Core p.59's `INT or EDU`), the skill list stays the actor's own, and the blocks are the ones a
 * request can fill — an attack's range, traits and psionic reach belong to the answering sheet and
 * are §9's deferred cases.
 */
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
 * or this line could not resolve it — that line picks from its own vocabulary (§8's third state).
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
 * It goes through the same `terms()` as the dialog does, so the two paths cannot produce different
 * numbers — which is the whole of §11's first risk.
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

/* -------------------------------------------- */
/*  Core p.63-64 — working together             */
/* -------------------------------------------- */

/**
 * The answers the resolver's check chains from: every other line that has landed one, in the order
 * they landed. Item 8 — `tally = together` **broadcasts** the arming, where `armChain` is one
 * player clicking *Chain into…* on their own card and hoping.
 *
 * A source this client cannot see is left out rather than named: `#priorChecks` withholds an
 * invisible message anyway, and a chain term the roller cannot click back to is not auditable.
 * @returns {string[]}   ChatMessage ids
 */
function contributorAnswers(request, read) {
    if ( request.tally !== "together" ) return [];
    return request.reading
        .filter(line => (line.id !== read.id) && (line.status === "answered") && line.message)
        .map(line => line.message)
        .filter(id => game.messages.get(id)?.visible);
}

/* -------------------------------------------- */
/*  The nudge                                   */
/* -------------------------------------------- */

/**
 * Tell the addressees a request landed (§5). Fire-and-forget, and **degradable by design**: if the
 * query fails, the user left, or their setting is `off`, nothing is lost — the card is already in
 * their log. That is why this is a nudge and not a transport.
 *
 * `User.queryMany` settles per user internally (`documents/user.mjs`,
 * "const queryResults = await Promise.allSettled(queryPromises)"), which is what catches
 * `User#query`'s own `User [id] is not active` throw for a player who left between compose and
 * post. **No timeout is set**: a request must not expire while the referee is still talking.
 * @param {ChatMessage} message
 */
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

/**
 * The receiving half. `flash` pulses the card and the chat tab and **does not scroll**; `open`
 * scrolls and opens the roll. Client-scope, which is the direct correction of a world-scoped alert
 * with no opt-out.
 */
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
    // `open` opens the PROMPT even where the demand would otherwise be one click — a nudge that
    // rolled on its own would be the system answering for the player.
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

/* -------------------------------------------- */

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
 * §2 S4's `ASKED` strip, in the existing `.from` vocabulary and injected into the rendered card
 * rather than added to `roll.html` — §8 keeps that template unchanged, and the strip's own link is
 * picked up by the `chainSource` listener that runs after this.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
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
