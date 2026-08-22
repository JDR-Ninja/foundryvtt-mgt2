import { stripCardButton, wireChainSources } from "./chatHelper.js";
import { checkOf } from "./chat-message.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { RollPromptHelper } from "./roll-prompt.js";
import { TravellerActorSheet } from "./actors/character-sheet.js";

const fields = foundry.data.fields;

/** The body this message renders. `content` is only the fallback a world that lost the sub-type sees. */
const CARD = "systems/mgt2/templates/chat/request.html";

/** The second ChatMessage sub-type, beside `check` in `chat-message.js`. */
export const REQUEST = "request";

/** How the demand names a skill. */
export const SKILL_MODES = Object.freeze(["named", "none", "open"]);

/** The state machine. `closed` is the referee ticking Conclude; nothing concludes on its own. */
export const REQUEST_STATES = Object.freeze(["open", "closed", "withdrawn"]);

/** What a line can say. Superseding is a count on the reading, never a status. */
export const LINE_STATES = Object.freeze([
    "waiting", "answered", "declined", "unclaimed", "unable"
]);

/**
 * `skillItem`'s third state: this client could not match the typed name against that actor's own
 * Items.
 */
export const UNRESOLVED = "unresolved";

/**
 * What Conclude froze, in a vocabulary of its own because it belongs to the control that writes it.
 */
export const OUTCOME_KINDS = Object.freeze(["tally", "chain", "sum"]);

/** Core p.73: DM+6 to the side that is aware, DM-6 to the side that is not, first round only. */
export const AMBUSH_DM = 6;

/**
 * The two SEND modes, and only two: `ChatMessage#visible` hides a whispered message *without rolls*
 * from non-recipients, and a request card has no rolls — so `gm`/`blind`/`self` would post a demand
 * nobody could see or answer.
 */
export const VISIBILITY_MODES = Object.freeze({
    public: "MGT2.Request.Visibility.public",
    addressed: "MGT2.Request.Visibility.addressed"
});

/** What arriving does on the addressee's screen. `flash` never scrolls; `open` does. */
export const NUDGE_MODES = Object.freeze({
    flash: "MGT2.Request.Nudge.flash",
    open: "MGT2.Request.Nudge.open",
    off: "MGT2.Request.Nudge.off"
});

/** The two referee-only card buttons, neither of which is offered until the switch is turned on. */
export const ASK_SAME_SETTING = "request.askTheSame";
export const ASK_AGAIN_SETTING = "request.askAgain";

/**
 * One demand the referee composed and sent: the skill, the characteristic(s), the rung, the stance,
 * the timeframe, the one named DM, and the roster it was sent to.
 */
export class RequestMessageData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            skillMode: new fields.StringField({
                required: true, blank: false, initial: "named", choices: SKILL_MODES }),
            // The name the referee typed, and there is no key it could be instead: a skill is a
            // free-text embedded Item with no registry behind it.
            skill: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            // `system.flavor` — not the core `flavor`, which ChatMessage declares as an HTMLField
            // (`common/documents/chat-message.mjs`, "flavor: new fields.HTMLField()").
            flavor: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            // Cardinality IS the meaning (Core p.59): 0 = the player picks, 1 = fixed, 2+ =
            // offered.
            chars: new fields.ArrayField(new fields.StringField({
                required: true, blank: false, choices: MGT2.Characteristics }), { initial: [] }),
            // Blank is a real answer: Core p.61 permits a check with no stated difficulty, and the
            // assumed Average 8+ is recorded per ANSWER (`CheckMessageData.assumed`), because it
            // belongs to the check that was resolved rather than to the demand.
            difficulty: new fields.StringField({
                required: false, blank: true, initial: "", choices: MGT2.DifficultyChoices }),
            // Tri-state, never a count and never a stack (Core p.61).
            stance: new fields.StringField({
                required: true, blank: false, initial: "none", choices: MGT2.Stance }),
            timeframe: new fields.StringField({
                required: true, blank: false, initial: "Normal", choices: MGT2.Timeframes }),
            // Core p.64 constrains a DM's provenance, not who applies it — so the label is the
            // whole point of the row, and the Docket refuses to post a value carrying none.
            dm: new fields.SchemaField({
                label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                // No bounds: a min/max would state a rule, and the -6..+6 of the control is only a
                // control's range.
                value: new fields.NumberField({
                    required: true, nullable: false, integer: true, initial: 0 })
            }),
            tally: new fields.StringField({
                required: true, blank: false, initial: "solo", choices: MGT2.RequestTally }),
            // Core p.73's ambush is one rule with two signs, and the sign is the line's own — which
            // is why the shared DM row above cannot carry it.
            ambush: new fields.StringField({
                required: true, blank: false, initial: "none", choices: MGT2.RequestAmbush }),
            // Off does not hide the rung with CSS — the card is rendered per client, so a hidden
            // rung is simply not emitted for a non-GM.
            showTarget: new fields.BooleanField({ required: false, initial: true }),
            // Core p.73's OPPOSING FORCES collapse: one roll on the highest score in the chosen
            // characteristic.
            sideRoll: new fields.BooleanField({ required: false, initial: false }),
            state: new fields.StringField({
                required: true, blank: false, initial: "open", choices: REQUEST_STATES }),
            lines: new fields.ArrayField(new fields.SchemaField({
                // What an answer's `flags.mgt2.request.line` points back at, minted by the Docket.
                id: new fields.StringField({ required: true, blank: false, trim: true }),
                // ⚠ Not `embedded: false`: an unlinked token's Actor uuid carries a Token segment,
                // and the field would refuse every roster built from the canvas.
                actor: new fields.DocumentUUIDField({
                    type: "Actor", required: false, nullable: true, initial: null }),
                // The name as it read at compose time: a line whose actor is not loaded degrades to
                // this and never throws — the roster contract.
                name: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
                // Frozen at Post so two owners cannot both be told "yours" and the card does not
                // re-read differently on every client.
                user: new fields.DocumentIdField({
                    required: false, nullable: true, initial: null, readonly: false }),
                // THREE states, not two: an Item id is a frozen resolution, `null` is the referee
                // choosing untrained, and `"unresolved"` is this client failing to match the name.
                skillItem: new fields.StringField({
                    required: true, blank: false, nullable: true, initial: null,
                    validate: value => (value === UNRESOLVED)
                        || foundry.data.validators.isValidId(value),
                    validationError: `must be a Document ID or "${UNRESOLVED}"`
                }),
                // The four a line may disagree with the demand about. `null` is not a value — it is
                // "the demand decides", which is why an empty `chars` cannot mean it: at demand
                // level `[]` already means the player picks (Core p.59).
                skill: new fields.StringField({
                    required: false, blank: true, trim: true, nullable: true, initial: null }),
                difficulty: new fields.StringField({
                    required: false, blank: true, nullable: true, initial: null,
                    choices: MGT2.DifficultyChoices }),
                chars: new fields.ArrayField(new fields.StringField({
                    required: true, blank: false, choices: MGT2.Characteristics }),
                { required: false, nullable: true, initial: null }),
                // Core p.84: which OTHER line of this same request answers against this one. Mutual
                // by construction, so a pair carries one verdict and not two.
                opposes: new fields.StringField({
                    required: false, blank: false, trim: true, nullable: true, initial: null }),
                // Core p.63-64: who the contributors' rungs are summed into, on a `together` tally.
                resolver: new fields.BooleanField({ required: false, initial: false }),
                // The referee rolls this one, whispered to GMs — a self row, or Companion p.7's
                // secret check for a Traveller.
                self: new fields.BooleanField({ required: false, initial: false }),
                status: new fields.StringField({
                    required: true, blank: false, initial: "waiting", choices: LINE_STATES }),
                // Null, not zero: a line that has not answered has no Effect at all, and zero is a
                // real Effect — an exact success (Core p.61).
                effect: new fields.NumberField({
                    required: true, integer: true, nullable: true, initial: null }),
                message: new fields.DocumentIdField({
                    required: false, nullable: true, initial: null, readonly: false })
            }), { initial: [] }),
            // Written once, at Conclude, and `kind` is narrowed now that the control exists.
            outcome: new fields.SchemaField({
                kind: new fields.StringField({
                    required: false, blank: true, trim: true, choices: ["", ...OUTCOME_KINDS], initial: "" }),
                value: new fields.NumberField({
                    required: false, integer: true, nullable: true, initial: null }),
                label: new fields.StringField({ required: false, blank: true, trim: true, initial: "" })
            }, { required: false, nullable: true, initial: null })
        };
    }

    /** What every line says right now. @type {object[]} */
    get reading() {
        const answers = answersOf(this.parent.id);
        return this.lines.map(line => readLine(this, line, answers.get(line.id) ?? []));
    }

    /** The one write this document takes after it is posted. */
    async conclude() {
        if ( this.state !== "open" ) return null;
        const reading = this.reading;
        const lines = reading.map(read => ({
            id: read.id, actor: read.actor, name: read.name, user: read.user,
            skillItem: read.skillItem, resolver: read.resolver, self: read.self,
            skill: read.skill, difficulty: read.difficulty, chars: read.chars,
            opposes: read.opposes,
            status: read.status, effect: read.effect, message: read.message
        }));
        return this.parent.update({
            system: { state: "closed", lines, outcome: outcomeOf(this.tally, reading) } });
    }

    /** @inheritdoc */
    async renderHTML({ canDelete, canClose = false, ...rest } = {}) {
        const message = this.parent;
        const content = await foundry.applications.handlebars.renderTemplate(CARD, cardContext(this));
        const html = await foundry.applications.handlebars.renderTemplate(CONFIG.ChatMessage.template, {
            ...rest,
            canDelete: canDelete ?? game.user.isGM,
            canClose,
            // `system.flavor` is the referee's reason and belongs in the card body; the core
            // `flavor` this template prints in the head is an HTMLField and stays empty.
            message: { _id: message.id, timestamp: message.timestamp, flavor: message.flavor, content },
            user: game.user,
            author: message.author,
            alias: message.alias,
            cssClass: message.whisper.length ? "whisper" : "",
            isWhisper: message.whisper.length,
            whisperTo: message.whisper.map(id => game.users.get(id)?.name).filterJoin(", ")
        });
        return foundry.utils.parseHTML(html);
    }
}

/**
 * Every answer posted against one request, bucketed by the line it answers and earliest first —
 * Core p.63's chain and `superseded` both need the order, and neither may depend on the
 * collection's own.
 * @param {string} id   The request message's id
 * @returns {Map<string, ChatMessage[]>}
 */
function answersOf(id) {
    const byLine = new Map();
    for ( const message of game.messages ) {
        const flag = requestFlagOf(message);
        if ( flag?.message !== id ) continue;
        if ( !byLine.has(flag.line) ) byLine.set(flag.line, []);
        byLine.get(flag.line).push(message);
    }
    for ( const answers of byLine.values() ) answers.sort((a, b) => a.timestamp - b.timestamp);
    return byLine;
}

/**
 * What ONE line is being asked, which is the demand unless that line disagrees with it. `null` on a
 * line field is "the demand decides"; every other value, blank included, is the line's own.
 * @returns {{skillMode: string, skill: string, chars: string[], difficulty: string,
 *     overridden: boolean}}
 */
export function lineDemand(request, line) {
    return {
        // Not overridable: a line that named a skill on a characteristic-only demand would be a
        // second demand, and the roster is one demand resolved against several sheets.
        skillMode: request.skillMode,
        skill: line?.skill ?? request.skill,
        chars: line?.chars ?? request.chars,
        difficulty: line?.difficulty ?? request.difficulty,
        overridden: [line?.skill, line?.chars, line?.difficulty]
            .some(value => (value ?? null) !== null)
    };
}

/** Core p.62: the line this one answers against, where the referee paired them. */
function opposedLine(request, line) {
    return line?.opposes ? (request.lines.find(other => other.id === line.opposes) ?? null) : null;
}

/** The pairing before either side has rolled, which is what the referee set and nothing more. */
function pairingOf(request, reading, read) {
    const other = opposedLine(request, read);
    // A pairing across the visibility boundary is not shown as a name the reader cannot see.
    if ( !other || !reading.some(entry => entry.id === other.id) ) return null;
    return { outcome: "", name: other.name };
}

/** One line, read against the log. */
function readLine(request, line, answers) {
    const first = answers[0] ?? null;

    // A concluded card is a record and does not rescan; the cache is the reading, frozen.
    if ( request.state === "closed" ) {
        return { ...line, superseded: 0, late: !!first && (first.id !== line.message),
            total: rollTotal(game.messages.get(line.message)) };
    }

    if ( first ) {
        const declined = requestFlagOf(first).declined === true;
        return {
            ...line,
            status: declined ? "declined" : "answered",
            effect: declined ? null : (checkOf(first)?.effect ?? null),
            message: first.id,
            total: declined ? null : rollTotal(first),
            superseded: answers.length - 1,
            late: false
        };
    }

    // A line whose actor this client cannot see is NOT `unable` — it is unknown here, and saying
    // "cannot answer" about somebody else's Traveller would be a falsehood rather than a permission
    // boundary.
    const actor = line.actor ? foundry.utils.fromUuidSync(line.actor, { strict: false }) : null;
    const rollable = actor?.system?.rollableCharacteristics ?? null;
    const chars = lineDemand(request, line).chars;
    const unable = !!rollable && (chars.length > 0) && !chars.some(key => rollable.includes(key));
    const status = unable ? "unable" : ((!line.user && !line.self) ? "unclaimed" : "waiting");
    return { ...line, status, effect: null, message: null, total: null, superseded: 0, late: false };
}

/** The dice a check landed on. A referee's secret roll carries `rolls: []`, so this is often null. */
function rollTotal(message) {
    const total = message?.rolls?.[0]?.total;
    return Number.isFinite(total) ? total : null;
}

/** Core p.63-64: the contributors' rungs, summed, no cap — the rules print none. */
function chainTotal(reading) {
    return reading
        .filter(read => !read.resolver && (read.status === "answered") && Number.isInteger(read.effect))
        .reduce((sum, read) => sum + MGT2Helper.taskChainDM(read.effect), 0);
}

/** Mercenary Book 1 p.47 adds the Effects themselves, not the task chain rungs `together` reads. */
function effectTotal(reading) {
    return reading
        .filter(read => (read.status === "answered") && Number.isInteger(read.effect))
        .reduce((sum, read) => sum + read.effect, 0);
}

/** What Conclude freezes: the chain it fed, the Effects it added, or the answers it counted. */
function outcomeOf(tally, reading) {
    if ( tally === "together" ) {
        return { kind: "chain", value: chainTotal(reading),
            label: reading.find(read => read.resolver)?.name ?? "" };
    }
    if ( tally === "sum" ) return { kind: "sum", value: effectTotal(reading), label: "" };
    return { kind: "tally",
        value: reading.filter(read => read.status === "answered").length, label: "" };
}

/** Which end of Core p.73's DM+-6 one line sits at. @param {boolean} self  The referee's own row */
export function ambushDM(ambush, self) {
    if ( !ambush || (ambush === "none") ) return 0;
    return ((ambush === "self") === (self === true)) ? AMBUSH_DM : -AMBUSH_DM;
}

/**
 * The correlation an answer carries, and the only thing that ties one to a request:
 * `flags.mgt2.request = {message, line, declined?}` — the request card's id, the `lines[].id` it
 * answers, and `declined: true` on a decline.
 * @returns {{message: string, line: string, declined?: boolean}|null}
 */
export function requestFlagOf(message) {
    const flag = message?.flags?.mgt2?.request;
    return (flag?.message && flag?.line) ? flag : null;
}

/** The ladder cell a given Effect falls in, as a key into `MGT2.EffectBands`. */
function bandKeyOf(effect) {
    const band = MGT2Helper.getEffectBand(effect);
    return Object.keys(MGT2.EffectBands).find(key => MGT2.EffectBands[key] === band) ?? null;
}

/**
 * `≤−6` · `−5…−2` · `−1` · `0` · `+1…+5` · `≥+6` — how one band of `MGT2.EffectBands` names itself
 * on a `.spread`.
 */
export function bandRange({ min, max }) {
    const sign = value => MGT2Helper.signed(value, "0");
    if ( min === null ) return `≤${sign(max)}`;
    if ( max === null ) return `≥${sign(min)}`;
    return (min === max) ? sign(min) : `${sign(min)}…${sign(max)}`;
}

/** Core p.59's offer, in the reader's own language: `Intellect or Education`, never a key. */
function charsLabel(chars) {
    if ( chars.length === 0 ) return game.i18n.localize("MGT2.Request.CharsOpen");
    const names = chars.map(key => game.i18n.localize(MGT2.Characteristics[key] ?? key));
    return game.i18n.getListFormatter({ type: "disjunction" }).format(names);
}

/** Core p.59's DM-3 as folio 69's Jack-of-All-Trades leaves it, or the flat rule with no actor. */
function untrainedLabel(actor) {
    if ( actor ) {
        const untrained = RollPromptHelper.untrained(actor);
        return `${untrained.label} ${MGT2Helper.signed(untrained.dm)}`;
    }
    return `${game.i18n.localize("MGT2.Items.NotProficient")} ${MGT2Helper.signed(MGT2.Untrained.dm)}`;
}

/**
 * What one line cost this Traveller, in the words the rules use: the skill at its level, the
 * characteristic(s) offered, and the dice it landed on.
 */
function lineDetail(request, read, actor, showTarget, opposed = null) {
    const parts = [];
    const asked = lineDemand(request, read);
    if ( asked.skillMode === "named" ) {
        // This client could not match the typed name against that actor's own Items, so the line is
        // open-skill for this line only — which is the whole reason the third state exists.
        if ( read.skillItem === UNRESOLVED ) {
            parts.push(game.i18n.format("MGT2.Request.Line.OpenSkill", { skill: asked.skill }));
        }
        else if ( read.skillItem === null ) parts.push(untrainedLabel(actor));
        else {
            // The LEVEL, not the DM: `Recon 0` is a trained skill and `untrained -3` is not, and
            // `getRollDisplay()` prints nothing at all for a level of zero — which is the one
            // distinction Core p.58-59 makes and the one this card exists to keep legible.
            const item = actor?.items?.get(read.skillItem);
            parts.push(item ? `${item.getRollDisplay(false)} ${item.system.level ?? 0}` : asked.skill);
        }
    }
    parts.push(charsLabel(asked.chars));
    // A rung of the line's own is printed on the line, because the head states the demand's and one
    // of the two would otherwise be a lie about this Traveller (Companion p.151).
    if ( showTarget && ((read.difficulty ?? null) !== null) ) {
        parts.push(MGT2Helper.getDifficultyDisplay(read.difficulty)
            ?? game.i18n.localize("MGT2.Difficulty.NA"));
    }
    // Hiding the rung hides the totals with it: total minus Effect is the target.
    if ( showTarget && Number.isInteger(read.total) ) parts.push(String(read.total));
    // Core p.62: before the dice this says who the pair is, and after them which way it went.
    if ( opposed ) {
        parts.push(game.i18n.format(opposed.outcome
            ? `MGT2.Request.Line.Opposed.${opposed.outcome}` : "MGT2.Request.Line.Opposed.pair",
        { name: opposed.name }));
    }
    if ( read.superseded > 0 ) {
        parts.push(game.i18n.format("MGT2.Request.Line.Superseded", { count: read.superseded }));
    }
    return parts.filter(part => part).join(" · ");
}

/** Every term `answerRequest` would apply to this line, through the reducer both totals use. */
function lineChit(request, read, actor, chain) {
    const rows = [];
    const asked = lineDemand(request, read);
    const skill = ((asked.skillMode === "named") && (read.skillItem !== UNRESOLVED))
        ? ((read.skillItem === null) ? "NP" : read.skillItem) : "";
    const key = (asked.chars.length === 1) ? asked.chars[0] : "";

    if ( skill === "NP" ) {
        rows.push([game.i18n.localize("MGT2.Items.NotProficient"),
            actor ? RollPromptHelper.untrained(actor).dm : MGT2.Untrained.dm]);
    }
    else if ( skill ) {
        const item = actor?.items?.get(skill);
        if ( item ) rows.push([item.name, item.system.level ?? 0]);
    }
    const characteristic = key ? actor?.system?.characteristics?.[key] : null;
    if ( characteristic ) rows.push([game.i18n.localize(MGT2.Characteristics[key]), characteristic.dm]);
    if ( request.dm.value ) rows.push([request.dm.label, request.dm.value]);
    const ambush = ambushDM(request.ambush, read.self);
    if ( ambush ) rows.push([game.i18n.localize("MGT2.Request.Ambush"), ambush]);
    const timeframe = MGT2Helper.getTimeframeDM(request.timeframe);
    if ( timeframe ) rows.push([game.i18n.localize(MGT2.Timeframes[request.timeframe]), timeframe]);
    // Core p.63-64: the resolver's chit grows as each contributor lands.
    if ( read.resolver && chain ) rows.push([game.i18n.localize("MGT2.RollPrompt.Chain"), chain]);
    const standing = actor?.system?.characteristics ? TravellerActorSheet.checkModifiers(actor) : [];
    for ( const source of standing ) {
        const scoped = source.characteristics ? source.characteristics.includes(key)
            : (source.skills ? source.skills.includes(skill) : true);
        if ( scoped ) rows.push([MGT2Helper.modifierLabel(source), source.dm]);
    }
    return MGT2Helper.signed(Checks.modifiers(rows).total, "+0");
}

/**
 * Core p.62's comparison as the ANSWERS already carry it, named by the line it was measured against
 * where that line is in this same request.
 * @returns {Map<string, {outcome: string, effect: number, name: string}>}   Keyed by line id
 */
function opposedReading(reading) {
    const named = new Map();
    for ( const read of reading ) if ( read.message ) named.set(read.message, read.name);
    const verdicts = new Map();
    for ( const read of reading ) {
        const carried = read.message
            ? (checkOf(game.messages.get(read.message))?.opposed ?? null) : null;
        if ( carried ) {
            verdicts.set(read.id, { outcome: carried.outcome, effect: carried.effect,
                message: carried.message,
                name: named.get(carried.message) || carried.label || "" });
            continue;
        }
        // A referee's own row is whispered with `rolls: []`, so an addressee's answer cannot carry a
        // comparison against it — the card measures the pair itself on any client that sees both.
        const other = read.opposes ? reading.find(entry => entry.id === read.opposes) : null;
        if ( !Number.isInteger(read.effect) || !Number.isInteger(other?.effect) ) continue;
        verdicts.set(read.id, { effect: other.effect, message: other.message, name: other.name,
            outcome: (read.effect > other.effect) ? "won"
                : ((read.effect < other.effect) ? "lost" : "tie") });
    }
    return verdicts;
}

/**
 * Core p.62: the answer the paired line has already posted, where this client can read it — a
 * whispered referee roll is not one, and the card measures that pair instead.
 * @returns {string|null}   A ChatMessage id
 */
export function opposingAnswer(request, read) {
    const other = read?.opposes
        ? request.reading.find(line => line.id === read.opposes) : null;
    const message = other?.message ? game.messages.get(other.message) : null;
    return message?.visible ? message.id : null;
}

/**
 * Both halves of a pair record the same contest, so the aggregate counts unordered pairs — and a
 * verdict pointing outside this request counts once, on the only end that is here.
 * @returns {{settled: number, standstill: number}}
 */
function opposedTally(reading, verdicts) {
    const seen = new Set();
    let settled = 0;
    let standstill = 0;
    for ( const read of reading ) {
        const verdict = verdicts.get(read.id);
        if ( !verdict ) continue;
        const other = reading.find(entry => entry.message === verdict.message);
        const key = other ? [read.id, other.id].sort().join("~") : read.id;
        if ( seen.has(key) ) continue;
        seen.add(key);
        if ( verdict.outcome === "tie" ) standstill++;
        else settled++;
    }
    return { settled, standstill };
}

/** The foot, by tally — and the sum is over the reading THIS client may see. */
function footOf(request, reading, answered, chain) {
    if ( request.tally === "together" ) {
        return game.i18n.format("MGT2.Request.Chat.FootChain", {
            dm: MGT2Helper.signed(chain, "+0"),
            answered: answered.filter(read => !read.resolver).length,
            total: Math.max(0, reading.length - 1),
            resolver: reading.find(read => read.resolver)?.name ?? "" });
    }
    if ( request.tally === "sum" ) {
        return game.i18n.format("MGT2.Request.Chat.FootSum", {
            sum: MGT2Helper.signed(effectTotal(reading), "+0"),
            answered: answered.length,
            asked: reading.length });
    }
    // Parallel-independent is the commonest shape and Traveller prints no aggregation for it.
    return game.i18n.format("MGT2.Request.Chat.FootSolo", {
        asked: reading.length,
        answered: answered.length,
        declined: reading.filter(read => read.status === "declined").length });
}

/** Everything `templates/chat/request.html` prints, built per client from the live reading. */
function cardContext(request) {
    const gm = game.user.isGM;
    const again = gm && game.settings.get("mgt2", ASK_AGAIN_SETTING);
    // Off does not hide the rung with CSS: the card is rendered per client, so it is not emitted.
    const showTarget = request.showTarget || gm;
    const withdrawn = request.state === "withdrawn";
    const stateLabel = (request.state === "open") ? (request.parent.author?.name ?? "")
        : game.i18n.localize(`MGT2.Request.State.${request.state}`);

    const context = {
        who: [game.i18n.localize("MGT2.Request.Card"), stateLabel].filter(part => part).join(" · "),
        demand: (request.skillMode === "none") ? game.i18n.localize("MGT2.Request.SkillMode.none")
            : (((request.skillMode === "open") || !request.skill)
                ? game.i18n.localize("MGT2.Request.Chat.AnySkill") : request.skill),
        target: showTarget ? MGT2Helper.getDifficultyDisplay(request.difficulty) : null,
        reason: withdrawn ? game.i18n.localize("MGT2.Request.Chat.Withdrawn") : request.flavor,
        lateLabel: game.i18n.localize("MGT2.Request.Chat.Late"),
        resolverHint: game.i18n.localize("MGT2.Request.Chat.ResolverHint"),
        terms: [],
        lines: [],
        buttons: []
    };

    if ( withdrawn ) {
        if ( again ) {
            context.buttons.push({ action: "requestAskAgain",
                label: game.i18n.localize("MGT2.Request.Chat.AskAgain") });
        }
        return context;
    }

    context.terms.push({ label: charsLabel(request.chars) });
    if ( request.stance !== "none" ) {
        context.terms.push({ label: game.i18n.localize(MGT2.Stance[request.stance]),
            negative: request.stance === "bane" });
    }
    if ( request.timeframe !== "Normal" ) {
        const dm = MGT2Helper.getTimeframeDM(request.timeframe);
        context.terms.push({
            label: `${game.i18n.localize(MGT2.Timeframes[request.timeframe])} ${MGT2Helper.signed(dm)}`,
            negative: dm < 0 });
    }
    // Core p.64 constrains a DM's provenance, not who applies it, so the label is the row.
    if ( request.dm.value ) {
        context.terms.push({ label: `${request.dm.label} ${MGT2Helper.signed(request.dm.value)}`,
            negative: request.dm.value < 0 });
    }
    if ( request.sideRoll ) {
        context.terms.push({ label: game.i18n.localize("MGT2.Request.SideRoll") });
    }
    // A player sees only their own side, so the term states the one sign that reaches them; a
    // referee sees both and gets the rule as the book prints it.
    if ( request.ambush !== "none" ) {
        const signs = new Set(request.lines.filter(line => gm || !line.self)
            .map(line => ambushDM(request.ambush, line.self)));
        const one = (signs.size === 1) ? [...signs][0] : null;
        context.terms.push({ negative: one < 0, label: `${
            game.i18n.localize("MGT2.Request.Ambush")} ${
            one === null ? `±${AMBUSH_DM}` : MGT2Helper.signed(one)}` });
    }

    // *rows you may not see, you do not see*: a referee's own row is absent from a player's
    // copy entirely — not shown as permanently unanswered — because its answer is a `check`
    // whispered to GMs and a row that can never resolve reads as somebody forgetting to roll.
    const reading = gm ? request.reading : request.reading.filter(read => !read.self);
    const chain = chainTotal(reading);
    const answered = reading.filter(read => read.status === "answered");

    // One marker per answer, on the band its Effect landed in.
    const markers = {};
    for ( const read of answered ) {
        if ( !Number.isInteger(read.effect) ) continue;
        (markers[bandKeyOf(read.effect)] ??= []).push({ self: read.self });
    }
    context.spread = Object.entries(MGT2.EffectBands).map(([key, band]) => ({
        range: bandRange(band),
        band: game.i18n.localize(band.label),
        tone: band.tone,
        markers: markers[key] ?? []
    }));

    const verdicts = opposedReading(reading);
    for ( const read of reading ) {
        const actor = read.actor ? foundry.utils.fromUuidSync(read.actor, { strict: false }) : null;
        const mine = (read.user === game.user.id) || (gm && read.self);
        // The chit is enabled for the addressee and for the referee, who owns everything.
        const offered = (request.state === "open") && !!read.actor
            && (((read.status === "waiting") && (mine || gm))
                || ((read.status === "unclaimed") && gm));
        const line = {
            id: read.id,
            name: read.name,
            detail: lineDetail(request, read, actor, showTarget,
                verdicts.get(read.id) ?? pairingOf(request, reading, read)),
            mine,
            resolver: read.resolver && (request.tally === "together"),
            // Core p.63-64 needs ONE Traveller to make the final check, and no book says which: it
            // is the referee's call, and this is the only surface that knows who has landed.
            pick: gm && (request.tally === "together") && (request.state === "open"),
            message: read.message,
            late: read.late
        };
        if ( offered ) line.chit = lineChit(request, read, actor, chain);
        else if ( read.status === "answered" ) {
            line.value = MGT2Helper.signed(read.effect, "+0");
            line.tone = MGT2Helper.getEffectBand(read.effect).tone;
        }
        else line.state = game.i18n.localize(`MGT2.Request.Line.${read.status}`);
        context.lines.push(line);
    }
    // Core p.63-64 puts the resolver last, after everyone who fed it.
    context.lines.sort((a, b) => Number(a.resolver) - Number(b.resolver));

    context.foot = footOf(request, reading, answered, chain);
    // Core p.62 is resolved per answer and always has been; what the card adds is the count, and
    // only once an answer has actually carried one — there is no control and no mode.
    if ( verdicts.size ) {
        const { settled, standstill } = opposedTally(reading, verdicts);
        context.opposedFoot = game.i18n.format("MGT2.Request.Chat.FootOpposed",
            { settled, standstill });
    }

    if ( gm ) {
        // Nothing auto-concludes: -1 and 0 are referee decisions (p.61), so the last die is where
        // the referee's job starts.
        if ( request.state === "open" ) {
            context.buttons.push({ action: "requestConclude",
                label: game.i18n.localize("MGT2.Request.Chat.Conclude"),
                hot: reading.every(read => read.status !== "waiting") });
        }
        if ( again ) {
            context.buttons.push({ action: "requestAskAgain",
                label: game.i18n.localize("MGT2.Request.Chat.AskAgain") });
        }
        if ( request.state === "open" ) {
            context.buttons.push({ action: "requestWithdraw",
                label: game.i18n.localize("MGT2.Request.Chat.Withdraw") });
        }
    }
    // Declining is not an error and costs no permission: it posts a message of its own.
    else if ( (request.state === "open")
        && reading.some(read => (read.user === game.user.id) && (read.status === "waiting")) ) {
        context.buttons.push({ action: "requestDecline",
            label: game.i18n.localize("MGT2.Request.Chat.Decline") });
    }
    return context;
}

/** One render at a time per card: two answers landing together must not race to replace the node. */
const rendering = new Map();

/**
 * Re-render a request card **because a different message arrived**.
 * @param {string} id   The request message's id
 */
export function rerenderRequest(id) {
    const next = (rendering.get(id) ?? Promise.resolve()).catch(() => {}).then(() => renderInPlace(id));
    rendering.set(id, next);
    next.finally(() => {
        if ( rendering.get(id) === next ) rendering.delete(id);
    });
    return next;
}

async function renderInPlace(id) {
    const message = game.messages.get(id);
    if ( (message?.type !== REQUEST) || !message.visible ) return;
    // The sidebar log, the popped-out log and the notifications copy, in one pass — the same way
    // `jumpToMessage` already searches `document` rather than trusting one root.
    for ( const li of document.querySelectorAll(`.chat-message[data-message-id="${id}"]`) ) {
        const notification = !!li.closest("#chat-notifications");
        const html = await message.renderHTML(
            notification ? { canDelete: false, canClose: true } : {});
        // Core hangs its auto-dismiss clock on the notification ELEMENT, so a replacement that does
        // not carry it over restarts the countdown and re-pins a card the reader dismissed.
        if ( "_lifeSpan" in li ) {
            html._lifeSpan = li._lifeSpan;
            const hover = event => html.classList.toggle("hovered", event.type === "pointerenter");
            html.addEventListener("pointerenter", hover);
            html.addEventListener("pointerleave", hover);
        }
        li.replaceWith(html);
    }
}

/** The card is a render and not an injection, so a switch flip re-renders rather than edits. */
export function refreshRequestCards() {
    for ( const message of game.messages ) {
        if ( message.type === REQUEST ) rerenderRequest(message.id);
    }
}

/** The two hooks that make the card live. */
export function registerRequestHooks() {
    for ( const hook of ["createChatMessage", "deleteChatMessage"] ) {
        Hooks.on(hook, message => {
            const id = requestFlagOf(message)?.message;
            if ( id ) rerenderRequest(id);
        });
    }
}

/** Wire one rendered request card. */
export function setupRequestCard(message, html) {
    for ( const control of html.querySelectorAll('[data-action^="request"]') ) {
        control.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            return onRequestAction(message, control.dataset, event);
        });
    }
    wireChainSources(html);
}

function onRequestAction(message, dataset, event) {
    const request = message.system;
    switch ( dataset.action ) {
        case "requestConclude": return request.conclude();
        case "requestWithdraw": return message.update({ system: { state: "withdrawn" } });
        case "requestAskAgain": return askAgain(message);
        case "requestDecline": return decline(message);
        case "requestResolver": return setResolver(message, dataset.line);
        // Item 7 owns the seeding and the one-click-versus-prompt routing; the affordance, its
        // gating and its arithmetic are the card's.
        case "requestRoll": return answerRequest(message, dataset.line, { prompt: event.shiftKey });
    }
}

/**
 * Core p.61 prints no reroll, so *Ask again* is the retry and it is the honest record: a second
 * card, at the same roster, leaving the first one's answers in the log as the checks they are.
 */
async function askAgain(message) {
    const system = message.system.toObject();
    system.state = "open";
    system.outcome = null;
    system.lines = system.lines.map(line => ({
        ...line, status: "waiting", effect: null, message: null }));
    return postRequest(system, { whisper: [...message.whisper] });
}

/**
 * Core p.63-64: working together is several contributors checking to add task chain modifiers into
 * **one** Traveller's final check, and no book says which one — it is the referee's call, taken on
 * the surface that knows who has already landed.
 */
async function setResolver(message, lineId) {
    if ( !game.user.isGM ) return null;
    const lines = message.system.toObject().lines.map(line => ({
        ...line, resolver: (line.id === lineId) && !line.resolver }));
    return message.update({ system: { lines } });
}

/**
 * Declining posts a message rather than writing the line, because a player cannot update a
 * ChatMessage — it declares only `create`/`delete`, `update` falls back to OWNER and ChatMessage
 * has no ownership field.
 */
async function decline(message) {
    const line = message.system.reading.find(
        read => (read.user === game.user.id) && (read.status === "waiting"));
    if ( !line ) return null;
    return getDocumentClass("ChatMessage").create({
        author: game.user.id,
        whisper: [...message.whisper],
        flags: { mgt2: { request: { message: message.id, line: line.id, declined: true } } },
        content: await renderRollCard({
            rollTypeName: game.i18n.localize("MGT2.Request.Card"),
            rollObjectName: game.i18n.localize("MGT2.Request.Chat.Declined"),
            lines: [game.i18n.format("MGT2.Request.Chat.DeclinedBy", { name: line.name })]
        })
    });
}

/** Roll one line's answer. */
export function answerRequest(message, lineId, options = {}) {
    const answer = game.mgt2?.request?.answer;
    if ( typeof answer !== "function" ) {
        return ui.notifications.warn(game.i18n.localize("MGT2.Errors.AnswerUnavailable"));
    }
    return answer(message, lineId, options);
}

/** The last ten demands the referee sent, and the one list three of the four doors read. */
const RECENT_LIMIT = 10;

/** The compose fields, and nothing the roster or the log put there. */
const DEMAND_FIELDS = Object.freeze(["skillMode", "skill", "flavor", "chars", "difficulty", "stance",
    "timeframe", "dm", "tally", "showTarget", "sideRoll", "ambush"]);

/** The demand alone, which is what a recent entry is and what its hash is taken over. */
export function demandOf(payload) {
    const demand = {};
    for ( const key of DEMAND_FIELDS ) {
        if ( payload?.[key] !== undefined ) demand[key] = foundry.utils.deepClone(payload[key]);
    }
    return demand;
}

/** FNV-1a over the demand's canonical form. @returns {string} */
export function requestHash(demand) {
    const canonical = JSON.stringify(demand, (key, value) => {
        if ( Array.isArray(value) ) return [...value].sort();
        if ( value && (typeof value === "object") ) {
            return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
        }
        return value;
    });
    let hash = 0x811c9dc5;
    for ( let i = 0; i < canonical.length; i++ ) {
        hash = Math.imul(hash ^ canonical.charCodeAt(i), 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

/** @returns {object[]} `{hash, at, payload}`, most recent first. */
export function recentRequests() {
    return game.settings.get("mgt2", "request.recent") ?? [];
}

// The list is built synchronously so two posts in one second cannot lose the first, and only the
// WRITE is debounced.
let pendingRecent = null;
const flushRecent = foundry.utils.debounce(() => {
    const entries = pendingRecent;
    pendingRecent = null;
    if ( entries ) game.settings.set("mgt2", "request.recent", entries);
}, 1000);

/** @param {object} payload   A request's `system` payload, or a demand on its own */
export function rememberRequest(payload) {
    if ( !game.user.isGM ) return;
    const demand = demandOf(payload);
    const hash = requestHash(demand);
    const kept = (pendingRecent ?? recentRequests()).filter(entry => entry.hash !== hash);
    pendingRecent = [{ hash, at: Date.now(), payload: demand }, ...kept].slice(0, RECENT_LIMIT);
    flushRecent();
}

/** One line of plain words for a stored demand — rebuilt on read, never stored, so it follows the
 *  reader's language rather than the language it was composed in. */
export function recentLabel(demand) {
    const parts = [MGT2Helper.getDifficultyDisplay(demand.difficulty)];
    if ( demand.skillMode === "named" ) parts.push(demand.skill);
    else if ( demand.skillMode === "none" ) parts.push(game.i18n.localize("MGT2.Request.SkillMode.none"));
    else parts.push(game.i18n.localize("MGT2.Request.Chat.AnySkill"));
    parts.push(charsLabel(demand.chars ?? []));
    if ( demand.stance && (demand.stance !== "none") ) parts.push(game.i18n.localize(MGT2.Stance[demand.stance]));
    return parts.filter(part => part).join(" · ");
}

/**
 * Create the card. @returns {Promise<ChatMessage>}
 * @param {object} system            A `RequestMessageData` payload
 * @param {string[]} [options.whisper]   `Addressed` = the frozen users plus the GMs; `Public` = none
 * @param {string} [options.content]     The fallback body, when the caller prints a richer one
 */
export async function postRequest(system, { whisper = [], content } = {}) {
    const message = await getDocumentClass("ChatMessage").create({
        author: game.user.id,
        type: REQUEST,
        whisper,
        content: content ?? `<div class="mgt2 theme-light card"><p class="bare">${
            Handlebars.Utils.escapeExpression(recentLabel(system))}</p></div>`,
        system
    });
    if ( message ) rememberRequest(system);
    return message;
}

/**
 * The seam every door goes through.
 * @param {object} [seed]   A partial demand to pre-fill, plus `from` naming the roster source
 */
export function openDocket(seed = {}) {
    const docket = game.mgt2?.docket;
    // `game.mgt2.docket` is registered as the open function itself; an object carrying `open` is
    // accepted too, so a module or a later phase may swap the shape without breaking three doors.
    const open = (typeof docket === "function") ? docket : docket?.open;
    if ( typeof open !== "function" ) {
        return ui.notifications.warn(game.i18n.localize("MGT2.Errors.DocketUnavailable"));
    }
    return open(seed);
}

/** Three doors, and the fourth is *Ask again* on the card itself. */
export function registerRequestControls() {
    // `#chat-controls` is one persistent element that core moves between the sidebar form and the
    // notifications pane, so the injection is idempotent and hangs off every event that moves it.
    Hooks.on("renderChatInput", (app, elements) => injectDocketControl(elements["#chat-controls"]));
    Hooks.on("renderChatLog", (app, html) => injectDocketControl(html.querySelector("#chat-controls")));
    Hooks.on("changeSidebarTab",
        app => injectDocketControl(app?.element?.querySelector?.("#chat-controls")));

    // Core p.73: everyone rolls DEX or INT and the Effect IS the initiative.
    Hooks.on("getCombatTrackerContextOptions", (application, options) => {
        options.push({
            label: "MGT2.Request.Chat.AskInitiative",
            icon: '<i class="fa-regular fa-clipboard-list"></i>',
            visible: () => game.user.isGM && !!application.viewed,
            onClick: () => openDocket({
                from: "combat",
                skillMode: "none",
                chars: ["dexterity", "intellect"],
                difficulty: "",
                tally: "solo"
            })
        });
    });
}

/** The chat-log control: left-click composes, right-click fires one of the last ten. */
function injectDocketControl(root) {
    if ( !game.user.isGM || !root || root.querySelector("#mgt2-docket-control") ) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "mgt2-docket-control";
    button.className = "ui-control icon fa-regular fa-clipboard-list";
    button.setAttribute("data-tooltip", "");
    button.ariaLabel = game.i18n.localize("MGT2.Request.Card");
    button.addEventListener("click", () => openDocket());
    root.append(button);

    // A recent fires immediately at the current roster, with no window — which is the whole reason
    // the RECENT rail and the footer button were cut: one affordance over one list.
    const menu = new foundry.applications.ux.ContextMenu(root, "#mgt2-docket-control", [], {
        jQuery: false,
        fixed: true,
        onOpen: () => {
            // `label`/`onClick`, never `name`/`callback`: both are deprecated in v14 and removed in
            // v16, and the old pair still logs a compatibility warning when it works.
            menu.menuItems = recentRequests().map(entry => ({
                label: recentLabel(entry.payload),
                icon: '<i class="fa-regular fa-clock-rotate-left"></i>',
                onClick: () => openDocket({ ...entry.payload, from: "recent", fire: true })
            }));
        }
    });
}

/**
 * *Ask the same*, injected into a rendered `check` card rather than into `roll.html`, which keeps
 * that template unchanged, so a check posted before this feature existed still gets the button.
 */
export function injectAskTheSame(message, html) {
    const existing = html.querySelector('[data-action="askTheSame"]');
    const check = checkOf(message);
    if ( !game.user.isGM || !check || !game.settings.get("mgt2", ASK_SAME_SETTING) ) {
        return stripCardButton(existing);
    }
    if ( existing ) return;
    const card = html.querySelector(".mgt2.card");
    if ( !card ) return;

    let buttons = card.querySelector(".cbtns");
    if ( !buttons ) {
        buttons = document.createElement("div");
        buttons.className = "cbtns";
        card.append(buttons);
    }
    const button = document.createElement("button");
    button.dataset.action = "askTheSame";
    button.textContent = game.i18n.localize("MGT2.Request.Chat.AskTheSame");
    button.addEventListener("click", event => {
        event.preventDefault();
        // Core p.61 records the assumed Average on the ANSWER, so a check that assumed one seeds no
        // rung at all rather than seeding a difficulty the referee never stated.
        const difficulty = check.assumed ? "" : (Object.keys(MGT2.DifficultyTargets)
            .find(key => MGT2.DifficultyTargets[key] === check.target) ?? "");
        openDocket({ from: "check", skillMode: "named", skill: check.label ?? "", difficulty });
    });
    buttons.append(button);
}

/** The switch reaches the cards already in the log — sidebar, popout and notifications alike. */
export function refreshAskTheSame() {
    for ( const li of document.querySelectorAll(".chat-message[data-message-id]") ) {
        const message = game.messages.get(li.dataset.messageId);
        if ( message ) injectAskTheSame(message, li);
    }
}
