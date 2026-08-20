import { Checks } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { ambushDM, lineDemand, opposingAnswer, REQUEST, UNRESOLVED } from "./request.js";
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

    const asked = lineDemand(request, read);
    const talent = powerOf(request, read, actor);
    // Core p.229: "A Traveller with no PSI points cannot attempt to activate a power."
    if ( talent && actor.system.isCharacteristicShown("psionic")
        && (actor.system.characteristics.psionic.value <= 0) ) {
        return void ui.notifications.warn(
            game.i18n.format("MGT2.Errors.NoPsiPoints", { name: actor.name }));
    }

    const imposed = imposedOf(request, read, asked);
    const rollOptions = seedOptions(request, read, actor, imposed, asked, talent);
    // Core p.63-64: on a `together` tally the resolver's prompt opens with the contributors'
    // answers already armed, summed and named.
    const chain = read.resolver ? contributorAnswers(request, read) : [];
    rollOptions.armed = chain;
    // Core p.62: the referee paired this line with another, and the pair is settled by whichever of
    // the two answers second.
    const against = opposingAnswer(request, read);

    // One click, no dialog. A power keeps its dialog: folio 229's reach is a spend, not a DM, and
    // there is no other surface on which to decline it.
    const direct = !prompt && (asked.chars.length === 1) && !talent
        && (asked.skillMode !== "open") && (read.skillItem !== UNRESOLVED);
    const data = direct
        ? directAnswer(request, read, actor, rollOptions, chain, asked)
        : await RollPromptHelper.roll(rollOptions);
    if ( !data ) return null;
    if ( against && !MGT2Helper.hasValue(data, "opposed") ) data.opposed = against;

    // Core p.64's imposed DM through the documented `extra` slot, which is where `#onRoll` already
    // puts its own terms. Core p.73's ambush is a second one, and its sign is this line's own.
    const extra = request.dm.value ? [[request.dm.label, request.dm.value]] : [];
    if ( imposed.ambush ) {
        extra.push([game.i18n.localize("MGT2.Request.Ambush"), imposed.ambush]);
    }
    const { formula, modifiers, chainSources, stance } =
        RollPromptHelper.terms(data, actor, rollOptions.checkModifiers, extra);

    const difficulty = Object.hasOwn(data, "difficulty") ? data.difficulty : asked.difficulty;
    const outcome = await Checks.resolve({
        formula, rollData: actor.getRollData(), difficulty, prompt: data });
    if ( !outcome ) return null;

    // Core folio 229: the power is paid for now, out of the reserve, and the card states what it
    // cost — the same call the sheet's own psionic roll makes.
    const psiLine = (talent && rollOptions.blocks.psionic)
        ? await TravellerActorSheet.spendPsi(actor, talent, data, outcome.effect) : null;
    const label = answerLabel(actor, asked);
    // The correlation is the only thing tying an answer to a request; a power's own duration rides
    // beside it in the flag the card's buttons already read.
    const flags = { mgt2: { request: { message: message.id, line: read.id } } };
    const cardButtons = rollOptions.cardButtons ?? [];
    if ( cardButtons.length ) flags.mgt2.buttons = cardButtons;
    return Checks.post(outcome, {
        actor,
        label,
        psiLine,
        cardButtons,
        flags,
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

/** The `imposed` block, read off what THIS line was asked and its own frozen resolution. */
function imposedOf(request, read, asked) {
    return {
        difficulty: asked.difficulty,
        chars: [...asked.chars],
        // Meaningless on a demand that names no skill, and `null` there would read as the referee
        // choosing untrained — so `skillMode` is read FIRST, which is the card's rule too.
        skillItem: ((asked.skillMode === "named") && (read.skillItem !== UNRESOLVED))
            ? read.skillItem : undefined,
        stance: request.stance,
        timeframe: request.timeframe,
        dm: { label: request.dm.label, value: request.dm.value },
        // Core p.73's DM+-6, resolved to the one sign this line sits at.
        ambush: ambushDM(request.ambush, read.self),
        flavor: request.flavor
    };
}

/** Core p.229's power, where the line's frozen resolution named one. @returns {Item|null} */
function powerOf(request, read, actor) {
    if ( (request.skillMode !== "named") || !read.skillItem || (read.skillItem === UNRESOLVED) ) {
        return null;
    }
    const item = actor.items.get(read.skillItem);
    return ((item?.type === "talent") && (item.system.subType === "psionic")) ? item : null;
}

/** What the seeded prompt opens on. */
function seedOptions(request, read, actor, imposed, asked, talent) {
    const characteristics = RollPromptHelper.actorCharacteristics(actor);
    const offered = asked.chars.filter(key => characteristics.some(entry => entry._id === key));
    // Core p.229: activating a power is a skill check "adding their PSI DM", so a demand that named
    // no characteristic gets one — but only where the sheet shows PSI at all.
    const tracked = Boolean(talent) && actor.system.isCharacteristicShown("psionic");
    const options = {
        rollTypeName: game.i18n.localize("MGT2.Request.Prompt.Asked"),
        rollObjectName: answerLabel(actor, asked),
        // Two or more offered is the referee narrowing a choice the player still makes, so the
        // blank "no characteristic" entry goes with them: the demand named characteristics.
        characteristics: offered.length
            ? characteristics.filter(entry => offered.includes(entry._id)) : characteristics,
        characteristic: (offered.length > 1) ? bestCharacteristic(actor, offered) : (offered[0] ?? ""),
        skills: RollPromptHelper.actorSkills(actor),
        skill: skillKey(asked, read),
        checkModifiers: TravellerActorSheet.checkModifiers(actor),
        difficulty: asked.difficulty,
        blocks: { skill: asked.skillMode !== "none", range: false, traits: false,
            psionic: tracked, attack: false, extended: false },
        ceiling: actor.system.taskCeiling,
        strengthDM: actor.system.characteristics.strength?.dm ?? 0,
        cardButtons: [],
        imposed
    };
    if ( !talent ) return options;

    options.talent = talent;
    // The power IS the skill being checked and the roster froze its id, so the prompt's own list
    // has to carry it: `actorSkills` lists skills alone.
    options.skills.splice(1, 0, { _id: talent.id, name: talent.getRollDisplay(false),
        term: talent.name, dm: talent.system.level });
    if ( tracked && !options.characteristic && !offered.length ) options.characteristic = "psionic";
    if ( MGT2Helper.hasValue(talent.system.psionic, "duration") ) {
        options.cardButtons.push({
            label: game.i18n.localize("MGT2.Items.Duration"),
            formula: talent.system.psionic.duration,
            message: { objectName: talent.name, flavor: "{0} ".concat(
                game.i18n.localize(`MGT2.Durations.${talent.system.psionic.durationUnit}`)) }
        });
    }
    return options;
}

/**
 * The prompt's own `skill` sentinel for this line: an Item id where the referee's client resolved
 * one, `NP` where the referee chose untrained, and nothing at all where the demand named no skill
 * or this line could not resolve it — that line picks from its own vocabulary.
 */
function skillKey(asked, read) {
    if ( asked.skillMode !== "named" ) return "";
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
function answerLabel(actor, asked) {
    if ( (asked.skillMode === "named") && asked.skill ) return asked.skill;
    const key = (asked.chars.length === 1) ? asked.chars[0]
        : bestCharacteristic(actor, asked.chars);
    return key ? game.i18n.localize(MGT2.Characteristics[key] ?? key)
        : game.i18n.localize("MGT2.Request.Card");
}

/**
 * The one-click answer: the form the prompt would have come back with, built from the demand alone.
 */
function directAnswer(request, read, actor, rollOptions, chain, asked) {
    const characteristic = rollOptions.characteristic;
    const skill = rollOptions.skill;
    const data = {
        characteristic,
        timeframes: request.timeframe,
        imposedStance: request.stance,
        difficulty: asked.difficulty,
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
