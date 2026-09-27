import { Chargen } from "./chargen.js";
import { CreationOptions } from "./chargen-rolls.js";
import { renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/** The provenance a mustering-out Benefit roll writes, and the one folio 47's conversion reads. */
export const MUSTER_TABLE = "muster";

/** What creation writes to a Traveller that is not a `career` record: skills, relationships, characteristics. */
export const Grants = {

    /**
     * The background-skill allowance, and the first place a species modifier changes an OUTCOME
     * rather than a display: the DM is read off EDU at this moment, which is `base + auto` with the
     * species contribution already derived in.
     * @returns {{count: number|null, formula: string, eduDM: number, choices: string[],
     *            mandatory: string[], inAddition: boolean}}
     */
    backgroundSkills(actor) {
        const block = Chargen.law(actor, Chargen.frame(actor)?.system.backgroundSkills);
        const eduDM = actor?.system.characteristics?.education?.dm ?? 0;
        const declared = (block?.formula ?? "").trim();
        const fixed = declared ? Number(declared) : NaN;
        const limits = MGT2.CreationLimits;
        return {
            count: declared
                ? (Number.isFinite(fixed) ? fixed : null)
                : Math.clamp(eduDM + limits.backgroundBase, limits.backgroundMin, limits.backgroundMax),
            formula: (declared && !Number.isFinite(fixed)) ? declared : "",
            fromFrame: !!declared,
            eduDM,
            // Empty is the honest state of a world that typed no list: the referee's whole library is open.
            choices: [...(block?.choices ?? [])],
            mandatory: [...(block?.mandatory ?? [])],
            inAddition: block?.inAddition === true
        };
    },

    /** Every skill Item on a Traveller, which is what both caps count and what a grant looks in. */
    skills(actor) {
        return (actor?.items ?? []).filter(item =>
            (item.type === "talent") && (item.system.subType === "skill"));
    },

    /**
     * Folio 18's second limit — `no more total skill levels than 3 × (INT + EDU)` — and the one no
     * table tracks by hand, which on its own justifies the creation screen.
     * @returns {{held: number, cap: number, room: number, breached: boolean, enforced: boolean}}
     */
    capacity(actor) {
        const specialities = Rules.on("specialitiesCountToCap");
        let held = 0;
        for ( const skill of this.skills(actor) ) {
            if ( !specialities && skill.system.skill?.speciality ) continue;
            held += skill.system.level ?? 0;
        }
        const characteristics = actor?.system.characteristics ?? {};
        const cap = MGT2.CreationLimits.skillCapFactor * MGT2.CreationLimits.skillCapCharacteristics
            .reduce((sum, key) => sum + (characteristics[key]?.value ?? 0), 0);
        return {
            held, cap, room: cap - held, breached: held > cap,
            // Off leaves the cap untracked, for a referee who does not want the bookkeeping.
            enforced: Rules.on("skillCapBreach")
        };
    },

    /**
     * Grant one skill, at a level, from a typed name — the primitive every table roll, every basic
     * training and every benefit row ends at.
     * @param {string} grant.name            The skill as the referee typed it
     * @param {number} [grant.level]         What the cell prints
     * @param {string} [grant.mode]          A `MGT2.GrantModes` key
     * @param {number|null} [grant.floor]    The per-row floor of `SOC 10 or SOC +1, whichever is higher`
     * @param {object} [grant.provenance]    `{term, career, table, note}`
     * @returns {Promise<{item: Item, from: number, to: number, lost: number, degraded: boolean}|null>}
     */
    async grantSkill(actor, { name, speciality = "", level = 1, mode = "raise", floor = null,
        provenance = {} } = {}) {
        const wanted = String(name ?? "").trim();
        if ( !actor || !wanted ) return null;

        const existing = this.skills(actor).find(skill =>
            MGT2Helper.matchesSkill(skill.name, wanted)
            && ((skill.system.skill?.speciality ?? "") === speciality));
        const from = existing?.system.level ?? 0;
        let to = { raise: from + level, add: from + level, atLeast: Math.max(from, level),
            floor: Math.max(from + 1, floor ?? level) }[mode] ?? (from + level);

        const ceiling = MGT2.CreationLimits.skillLevel;
        const lost = Math.max(0, to - ceiling);
        to = Math.min(to, ceiling);

        // The cap counts what is HELD, so a grant is measured against the room left.
        const capacity = this.capacity(actor);
        const degraded = capacity.enforced && (to > from) && ((to - from) > Math.max(0, capacity.room));
        if ( degraded ) to = existing ? from : 0;

        if ( existing ) {
            if ( to === from ) return { item: existing, from, to, lost, degraded };
            await existing.update({ "system.level": to });
            return { item: existing, from, to, lost, degraded };
        }
        const [created] = await actor.createEmbeddedDocuments("Item", [{
            name: speciality ? `${wanted} (${speciality})` : wanted,
            type: "talent",
            system: { subType: "skill", level: to, skill: { speciality }, provenance }
        }]);
        return { item: created, from, to, lost, degraded };
    },

    /** A characteristic change is a signed row in the log and never a write to `base`. */
    async grantCharacteristic(actor, grant, provenance = {}) {
        if ( !grant.characteristic ) return "";
        const held = actor.system.characteristics[grant.characteristic];
        const current = (held?.base ?? 0) + (held?.auto ?? 0);
        // The one form that lives on rank rows: `SOC 10 or SOC +1, whichever is higher` is max(current
        // + 1, floor), and the floor is per ROW because one ladder prints 10 then 12.
        const wanted = (grant.mode === "floor")
            ? Math.max(current + 1, grant.floor ?? 0) - current : grant.value;
        // Core p.9 and p.47: an increase stops at the racial maximum, augments aside. Capping every
        // creation increase is a ruling; only a Benefit's excess SOC becomes Ship Shares, as p.47 prints.
        const ceiling = Chargen.frame(actor)?.system.racialMaximum ?? MGT2.CreationDefaults.racialMaximum;
        const delta = (wanted > 0) ? Math.min(wanted, Math.max(0, ceiling - current)) : wanted;
        const excess = wanted - delta;
        const shares = ((grant.characteristic === "social") && (provenance.table === MUSTER_TABLE)) ? excess : 0;
        if ( delta ) {
            const log = actor.system.characteristicLog.map(entry => ({ ...entry }));
            log.push({ source: "event", term: provenance.term ?? null, age: Chargen.age(actor), roll: null,
                changes: { [grant.characteristic]: delta }, cost: 0, note: provenance.table ?? "" });
            await actor.update({ "system.characteristicLog": log });
        }
        if ( shares ) await actor.update({ "system.finance.shipShares": (actor.system.finance.shipShares ?? 0) + shares });
        if ( !wanted ) return "";
        const lines = [`${game.i18n.localize(MGT2.Characteristics[grant.characteristic])} ${MGT2Helper.signed(delta)}`];
        if ( shares ) lines.push(MGT2Helper.plural("MGT2.Chargen.Term.ExcessShares", shares, { n: shares }));
        else if ( excess ) lines.push(MGT2Helper.plural("MGT2.Chargen.Term.ExcessLost", excess, { n: excess }));
        return lines.join(" · ");
    },

    /**
     * A blank contact is a first-class row: the book notes each at whatever detail suits, *"Rival in Navy"*.
     * @param {string} [contact.relation]   A `MGT2.ContactRelations` key
     * @param {string} [contact.uuid]       The Actor this relationship stands for, where one exists
     * @returns {Promise<Item|null>}
     */
    async contact(actor, { name = "", relation = "Contact", uuid = null, provenance = {} } = {}) {
        if ( !actor ) return null;
        const [created] = await actor.createEmbeddedDocuments("Item", [{
            name: name || game.i18n.localize("MGT2.Actor.NewContact"),
            type: "contact",
            system: { relation, actor: uuid, provenance }
        }]);
        return created;
    },

    /** Folio 20's betrayal: a Contact or Ally **converts** into a Rival or Enemy. */
    async convert(contact, relation, note = "") {
        if ( !contact ) return null;
        const trail = [contact.system.provenance?.note, note].filter(part => part).join(" · ");
        return contact.update({ "system.relation": relation, "system.provenance.note": trail });
    },

    /**
     * The Connections Rule (folio 19), which is the transaction a single sheet cannot express and
     * therefore the whole argument for the grid: *if two players agree, an event rolled by one
     * may involve the other, and both gain one extra skill.* **A connection and a contact are two
     * separate outcomes of one agreement**.
     */
    connections(actor) {
        return [...Chargen.read(actor).connections];
    },

    /**
     * Whether these two may connect, and **why not** where they may not — four printed constraints,
     * each checked separately so the refusal can say which one bit.
     * @returns {{ok: boolean, reason: string}}
     */
    canConnect(actor, other, skill = "") {
        const limits = MGT2.CreationLimits;
        const refuse = reason => ({ ok: false, reason });
        // Solo generation removes the Connections Rule outright — the referee supplies a list of
        // people, organisations and places instead.
        if ( CreationOptions.solo() ) return refuse("MGT2.Chargen.Connect.Solo");
        if ( !actor || !other || (actor.id === other.id) ) return refuse("MGT2.Chargen.Connect.Self");
        for ( const [side, partner] of [[actor, other], [other, actor]] ) {
            const held = this.connections(side);
            if ( held.length >= limits.connections ) return refuse("MGT2.Chargen.Connect.Full");
            // "Each with a DIFFERENT Traveller" — the same pair may not agree twice.
            if ( held.some(entry => entry.with === partner.id) ) return refuse("MGT2.Chargen.Connect.Repeat");
        }
        if ( skill ) {
            if ( limits.connectionExcluded.some(name => MGT2Helper.matchesSkill(skill, name)) ) {
                return refuse("MGT2.Chargen.Connect.Excluded");
            }
            const level = Grants.skillLevelOf(actor, skill);
            if ( level >= limits.connectionLevel ) return refuse("MGT2.Chargen.Connect.TooHigh");
        }
        return { ok: true, reason: "" };
    },

    /** What a connection's extra level would take a skill to, which folio 19 caps at 3. */
    skillLevelOf(actor, skill) {
        const held = this.skills(actor).find(item => MGT2Helper.matchesSkill(item.name, skill));
        return held?.system.level ?? 0;
    },

    /**
     * Record the agreement and pay both sides.
     * @param {object} skills   `{[actor.id]: "Streetwise", [other.id]: "Deception"}`
     * @param {string} [note]   The shared event, in the table's own words
     */
    async connect(actor, other, skills = {}, note = "") {
        for ( const [side, partner] of [[actor, other], [other, actor]] ) {
            const skill = skills[side.id] ?? "";
            const verdict = this.canConnect(side, partner, skill);
            if ( !verdict.ok ) {
                ui.notifications.warn(game.i18n.format(verdict.reason,
                    { name: side.name, other: partner.name }));
                return null;
            }
            // **Both sides are written, so both sides must be writable.** A connection is the one
            // transaction in creation that spans two Travellers, and a player owns only their own —
            // so in practice the referee performs it.
            if ( !side.canUserModify(game.user, "update") ) {
                ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: side.name }));
                return null;
            }
        }
        const written = [];
        for ( const [side, partner] of [[actor, other], [other, actor]] ) {
            const skill = skills[side.id] ?? "";
            await Chargen.update(side, {
                connections: [...this.connections(side), { with: partner.id, skill, note }]
            });
            if ( skill ) {
                written.push(await this.grantSkill(side, { name: skill, level: 1, mode: "raise",
                    provenance: { term: Chargen.read(side).term, table: "connection",
                        note: note || partner.name } }));
            }
        }
        return written;
    },

    /**
     * What this Traveller rolls, and with which dice.
     * @returns {{method: string, boon: number, entries: object[],
     *            pool: {dice: number, heroic: boolean}|null, note: string}}
     */
    plan(actor) {
        const species = Chargen.frame(actor);
        const sex = MGT2Helper.skillSlug(actor.system.personal?.sex);
        const sexed = (species?.system.characteristicRolls ?? []).filter(row => row.sex);
        const declared = (species?.system.characteristicRolls ?? []).filter(row => !row.sex).map(row =>
            sexed.find(one => (one.characteristic === row.characteristic) && (MGT2Helper.skillSlug(one.sex) === sex)) ?? row);
        const without = species?.system.withoutCharacteristics ?? new Set();
        const boon = CreationOptions.boon();
        const entries = (declared.length
            ? declared.map(row => ({ characteristic: row.characteristic, formula: row.formula || "2D",
                replaces: row.replaces, label: row.label }))
            : MGT2.RolledCharacteristics.filter(key => !without.has?.(key))
                .map(characteristic => ({ characteristic, formula: "2D", replaces: "", label: "" })))
            .filter(entry => entry.characteristic);
        for ( const [index, entry] of entries.entries() ) {
            entry.boon = index < boon.count;
            entry.label = entry.label
                || game.i18n.localize(MGT2.Characteristics[entry.characteristic] ?? entry.characteristic);
            entry.rolled = entry.boon ? boonOn(entry.formula) : MGT2Helper.damageFormula(entry.formula);
        }
        const method = Rules.get("creationAssignment");
        const planned = { method, boon: boon.count, entries, ...pooling(method, entries, boon.count) };
        // ACS 4 p.167: a species rolling by sex rolls its generic dice until the Traveller's sex is set.
        if ( sexed.length && !sex ) planned.note = [planned.note, game.i18n.localize("MGT2.Chargen.Characteristics.NoteSex")]
            .filter(line => line).join(" ");
        return planned;
    },

    /**
     * Roll the set and post it — the totals under a per-characteristic method, the loose dice under
     * an assignment one.
     * @returns {Promise<{method: string, plan: object, results: object[], dice: number[]}|null>}
     */
    async rollCharacteristics(actor) {
        const plan = this.plan(actor);
        if ( !plan.entries.length ) return null;
        const results = [];
        const dice = [];
        const rolls = [];
        if ( plan.pool ) {
            const roll = await new Roll(`${plan.pool.dice}d6`).roll();
            rolls.push(roll);
            dice.push(...roll.dice[0].results.map(die => die.result));
            if ( plan.pool.heroic ) replaceLowest(dice);
        }
        else for ( const entry of plan.entries ) {
            const roll = await new Roll(entry.rolled).roll();
            rolls.push(roll);
            results.push({ ...entry, total: roll.total, roll });
        }
        // One card carrying every die, rather than six cards: the set is read across, and the
        // assignment decision is made against all of them at once.
        await ChatMessage.create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            rolls,
            content: await renderRollCard({
                rollTypeName: game.i18n.localize("MGT2.Chargen.Roll.Characteristics"),
                rollObjectName: game.i18n.localize(`MGT2.Rules.creationAssignment.${plan.method}`),
                lines: [cardLine(plan, results, dice)]
            })
        });
        return { method: plan.method, plan, results, dice };
    },

    /**
     * **The only write to `base` in the whole system**.
     * @param {Record<string, number>} scores   Keyed by `MGT2.Characteristics` key
     */
    async assignCharacteristics(actor, scores) {
        const update = {};
        for ( const [key, value] of Object.entries(scores ?? {}) ) {
            if ( !(key in MGT2.Characteristics) || !Number.isFinite(value) ) continue;
            update[`system.characteristics.${key}.base`] = Math.max(0, Math.round(value));
        }
        return Object.keys(update).length ? actor.update(update) : actor;
    }
};

/**
 * Whether Companion p.13's loose dice can express this Traveller's set: a pair of d6 is not a
 * frame's own formula and not a boon die, so either one sends the set back to per-slot rolls.
 * @returns {{pool: {dice: number, heroic: boolean}|null, note: string}}
 */
function pooling(method, entries, boon) {
    const rule = MGT2.CreationPool;
    if ( !rule.methods.includes(method) ) return { pool: null, note: "" };
    if ( boon ) return { pool: null, note: game.i18n.localize("MGT2.Chargen.Characteristics.NoteBoon") };
    const own = entries.find(entry => MGT2Helper.damageFormula(entry.formula) !== rule.slot);
    if ( own ) {
        return { pool: null, note: game.i18n.format("MGT2.Chargen.Characteristics.NoteFrame",
            { characteristic: own.label, formula: MGT2Helper.showFormula(own.formula) }) };
    }
    return { pool: { dice: entries.length * rule.dicePerSlot, heroic: method === rule.heroic }, note: "" };
}

/** A Boon on the slot's own dice, one more die and the lowest dropped (Core p.62); a printed constant takes none. */
function boonOn(formula) {
    return MGT2Helper.damageFormula(formula).replace(/(\d*)d6(?!k)/, (match, count) =>
        `${(Number(count) || 1) + 1}d6kh${Number(count) || 1}`);
}

/** Companion p.13's heroic variant. The two lowest is the only choice of two that is never worse. */
function replaceLowest(dice) {
    const rule = MGT2.CreationPool;
    [...dice.keys()].sort((a, b) => dice[a] - dice[b]).slice(0, rule.replace)
        .filter(index => dice[index] < rule.face)
        .forEach(index => { dice[index] = rule.face; });
}

/** The card names each slot only where the method has already decided which one a total lands in. */
function cardLine(plan, results, dice) {
    if ( plan.pool ) {
        return game.i18n.format("MGT2.Chargen.Characteristics.Dice", { dice: dice.join(" · ") });
    }
    if ( plan.method === MGT2.CreationPool.printed ) {
        return results.map(result => `${result.label} ${result.total}`).join(" · ");
    }
    return game.i18n.format("MGT2.Chargen.Characteristics.Unassigned",
        { values: results.map(result => result.total).join(" · ") });
}
