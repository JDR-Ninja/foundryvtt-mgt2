import { Checks } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

/** The `mgt2-data` pack holding Mongoose's printed rows; the system ships none of them. */
const TABLES_PACK = "mgt2-data.tables";

/**
 * Bounty Hunter p.22-27. The system holds the order, the target field and the address; the module
 * holds every row, and the dice stay the RollTable's — the four contract tables print two different
 * formulas, so one stored here would be a second truth. `after` names the step whose result carries
 * this one's table. A stamped key would address a packed table better than its name does.
 */
const SEQUENCE = Object.freeze([
    { step: 1, table: "Client and Priority", folio: "22", field: "client" },
    { step: 2, table: null, after: 1, folio: "22", field: "priority" },
    { step: 3, table: "{priority} Priority Contracts", folio: "22-25", field: "wantedFor" },
    { step: 4, table: "Bounty Offered — {priority} Priority", folio: "27", field: "fee" },
    { step: 5, table: "Opposition", folio: "25", field: "information" },
    { step: 6, table: "Regional Location Hubs", folio: "26", field: "lastSeen" },
    { step: 7, table: "Clues", folio: "26", field: "describe" },
    { step: 8, table: "Mark's Final Location", folio: "27", field: "complications" }
].map(Object.freeze));

/** The referee rows the eight draws write; the REP floor is the referee's own call and is not one. */
const REFEREE_FIELDS = new Set(["information", "lastSeen", "describe", "complications"]);

/** Punctuation and case differ between the book, the pack and this file — compare words only. */
const normalise = name => String(name ?? "").toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

/** Does one normalised phrase appear as whole words inside another? */
const holds = (text, word) => word && ` ${text} `.includes(` ${word} `);

const SCALES = Object.freeze({ mcr: 1e6, kcr: 1e3, cr: 1 });

/** A drawn row that is a figure in Credits — `Cr4000`, `MCr1.2`. @returns {number|null} */
function credits(text) {
    const match = /(mcr|kcr|cr)\s*([\d.,]+)/i.exec(String(text ?? ""));
    if ( !match ) return null;
    const amount = Number(match[2].replace(/,/g, ""));
    return Number.isFinite(amount) ? Math.round(amount * SCALES[match[1].toLowerCase()]) : null;
}

/** The rung of a `{max}` ladder a number falls on; `max: null` closes it. */
function rung(ladder, n) {
    return ladder.find(row => (row.max === null) || (n <= row.max)) ?? ladder.at(-1);
}

/** Bounty Hunter p.18-19's contract: its two printed player rolls and its generator. */
export class Contract {

    /** @see SEQUENCE */
    static get sequence() {
        return SEQUENCE;
    }

    /** Bounty Hunter p.10, read on the hunter's REP. @returns {number} */
    static negotiationPercent(total) {
        return rung(MGT2.BountyNegotiation, total).percent;
    }

    /** Bounty Hunter p.10: the difficulty of asking anyway, off the REP difference. */
    static qualificationDifficulty(difference) {
        return rung(MGT2.RepQualification, difference).difficulty;
    }

    /** Why a printed roll cannot be made, never a silent no-op. @returns {string|null} */
    static refusal(item, rule) {
        const system = item.system;
        if ( !system.given ) return game.i18n.localize("MGT2.Contract.Refused.NotGiven");
        if ( system.hunterRep === null ) return game.i18n.localize("MGT2.Contract.Refused.NoHunter");
        if ( (rule === "negotiate") && system.negotiated ) {
            return game.i18n.localize("MGT2.Contract.Refused.Negotiated");
        }
        if ( (rule === "qualify") && system.qualificationRolled ) {
            return game.i18n.localize("MGT2.Contract.Refused.Qualified");
        }
        return null;
    }

    /** Bounty Hunter p.10: 2D + REP DM, once, and it can settle LOWER than the offer. */
    static async negotiate(item) {
        const refused = Contract.refusal(item, "negotiate");
        if ( refused ) return ui.notifications.warn(refused);

        const actor = item.system.hunterActor;
        const { parts, terms } = Checks.modifiers([Contract.#repRow(actor)]);
        const outcome = await Checks.resolve({ formula: ["2d6", ...parts].join("") });
        if ( !outcome ) return null;

        const percent = Contract.negotiationPercent(outcome.roll.total);
        const offered = item.system.fee;
        // A percentage of the offer, rounded to the hundred Credits.
        const agreed = Math.max(0, Math.round((offered * (100 + percent)) / 100 / 100) * 100);

        await item.update({ system: {
            agreed,
            negotiation: { total: outcome.roll.total, percent, offered }
        } });
        return Checks.post(outcome, {
            actor,
            label: game.i18n.localize("MGT2.Contract.Negotiate"),
            rollTypeName: game.i18n.localize("MGT2.Contract.Negotiate"),
            rollObjectName: item.name,
            modifiers: terms,
            lines: [game.i18n.format("MGT2.Contract.NegotiatedLine", {
                percent: MGT2Helper.signed(percent),
                from: MGT2Helper.credits(offered), to: MGT2Helper.credits(agreed)
            })]
        });
    }

    /**
     * Bounty Hunter p.10: a hunter under the client's minimum REP may ask anyway. Failure costs the
     * TRAVELLER REP-1, floored at zero, and the difficulty is frozen with the outcome.
     */
    static async qualify(item) {
        const refused = Contract.refusal(item, "qualify");
        if ( refused ) return ui.notifications.warn(refused);
        const system = item.system;
        if ( !system.repFloorShown ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Contract.Refused.FloorHidden"));
        }
        // Folio 10's check is for a hunter SHORT of the minimum; one who meets it has nothing to ask.
        if ( system.hunterRep >= system.repFloor ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Contract.Refused.NotShort"));
        }

        const actor = system.hunterActor;
        const difficulty = Contract.qualificationDifficulty(system.repFloor - system.hunterRep);
        const { parts, terms } = Checks.modifiers([Contract.#repRow(actor)]);
        const outcome = await Checks.resolve({ formula: ["2d6", ...parts].join(""), difficulty });
        if ( !outcome ) return null;

        const passed = outcome.effect >= 0;
        const lines = [];
        if ( !passed ) {
            const base = actor.system.characteristics.reputation.base;
            await actor.update({ "system.characteristics.reputation.base": Math.max(0, base - 1) });
            lines.push(game.i18n.format("MGT2.Contract.QualifyFailedLine", { name: actor.name }));
        }
        await item.update({ "system.qualification": {
            target: outcome.target, total: outcome.roll.total, passed } });

        return Checks.post(outcome, {
            actor,
            label: game.i18n.localize("MGT2.Contract.Qualify"),
            rollTypeName: game.i18n.localize("MGT2.Contract.Qualify"),
            rollObjectName: item.name,
            difficulty,
            modifiers: terms,
            lines
        });
    }

    /** The one named DM both printed rolls carry, read off the Traveller. */
    static #repRow(actor) {
        return [game.i18n.localize("MGT2.Characteristics.reputation.name"),
            actor.system.characteristics.reputation.dm];
    }

    /** Whether the module holding the printed rows is installed. */
    static get hasTables() {
        return game.packs.get(TABLES_PACK)?.documentName === "RollTable";
    }

    /** A contract already handed over is not re-drawn: a new draw is a new document. */
    static generatorRefusal(item) {
        if ( !Contract.hasTables ) return game.i18n.localize("MGT2.Contract.Refused.NoModule");
        if ( item.system.given ) return game.i18n.localize("MGT2.Contract.Refused.AlreadyGiven");
        return null;
    }

    /** Bounty Hunter p.22-27. @returns {Promise<object[]|null>}   One log row per step */
    static async generate(item) {
        const refused = Contract.generatorRefusal(item);
        if ( refused ) {
            ui.notifications.warn(refused);
            return null;
        }
        const pack = game.packs.get(TABLES_PACK);
        const index = await pack.getIndex();
        const log = [];
        const drawn = {};
        let chained = null;

        for ( const step of SEQUENCE ) {
            const name = step.after ? null : step.table.replace(/\{(\w+)\}/g,
                (token, key) => Contract.#word(drawn[key]) || token);
            const table = step.after ? chained : await Contract.#find(pack, index, name);
            chained = null;
            if ( !table ) {
                log.push({ ...step, name, missing: true });
                continue;
            }
            // ⚠ `recursive: false`: core resolves an inner table and returns ITS row instead, which
            // would collapse two steps into one and lose the result this sequence chains on.
            const { roll, results } = await table.roll({ recursive: false });
            const text = results.map(Contract.#text).join(" ");
            drawn[step.field] = text;
            // A result that names another RollTable IS the next step's table.
            chained = await Contract.#inner(results);
            log.push({ ...step, name: table.name, formula: table.formula,
                total: roll.total, text, missing: false });
        }

        await item.update({ system: Contract.#draft(item, drawn) });
        return log;
    }

    /** A table by name, punctuation and case aside. @returns {Promise<RollTable|null>} */
    static async #find(pack, index, name) {
        const wanted = normalise(name);
        const entry = index.find(row => normalise(row.name) === wanted);
        return entry ? pack.getDocument(entry._id) : null;
    }

    /** A drawn row whole: `name` is cut at 120 characters when the body did not fit it. */
    static #text(result) {
        return (result.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            || result.name;
    }

    /** The RollTable a drawn row points at, where it points at one. */
    static async #inner(results) {
        for ( const result of results ) {
            if ( result.type !== "document" ) continue;
            const inner = await fromUuid(result.documentUuid);
            if ( inner?.documentName === "RollTable" ) return inner;
        }
        return null;
    }

    /** The English word a `{token}` stands for: the four priorities are capitalised keys. */
    static #word(text) {
        const key = Contract.#priority(text);
        return key ? key[0].toUpperCase() + key.slice(1) : "";
    }

    /** Which key of a config table a drawn row names, matched on the label the referee reads. */
    static #key(table, text) {
        const drawn = normalise(text);
        if ( !drawn ) return null;
        return Object.keys(table).find(key =>
            holds(drawn, normalise(game.i18n.localize(table[key])))) ?? null;
    }

    static #priority(text) {
        return Contract.#key(MGT2.ContractPriorities, text);
    }

    static #client(text) {
        return Contract.#key(MGT2.ContractClients, text);
    }

    /** A drawn row this system cannot read back as one of its keys is left for the referee. */
    static #draft(item, drawn) {
        const system = {
            negotiation: { total: null, percent: null, offered: null },
            qualification: { target: null, total: null, passed: false },
            agreed: null, status: "offered"
        };
        const client = Contract.#client(drawn.client);
        const priority = Contract.#priority(drawn.priority);
        if ( client ) system.client = client;
        if ( priority ) system.priority = priority;
        if ( drawn.wantedFor ) system.wantedFor = drawn.wantedFor;
        const fee = credits(drawn.fee);
        if ( fee !== null ) system.fee = fee;

        // The referee's rows go back to held: the party has not been told any of it yet.
        system.referee = item.system.referee.map(row =>
            (REFEREE_FIELDS.has(row.key) && (drawn[row.key] !== undefined))
                ? { ...row, value: drawn[row.key], shown: false } : { ...row });
        return system;
    }
}
