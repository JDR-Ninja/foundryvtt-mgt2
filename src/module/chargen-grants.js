import { Chargen } from "./chargen.js";
import { CreationOptions } from "./chargen-rolls.js";
import { renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/**
 * What creation writes to a Traveller that is not a `career` record: skills, relationships and the
 * six characteristics themselves.
 *
 * **Granting a skill needs no compendium, and that is the finding this module is built on** (§9.45).
 * The system ships no skill list at all — a skill is a `talent` Item with `subType: "skill"`, and no
 * content ships (§9.36) — so a grant **creates a bare Item from a typed name**, at the level the
 * table printed, with §9.38's provenance on it. When the referee's library exists the same control
 * becomes a pick-list instead of a text field and nothing here changes. This holds for every skill
 * grant in creation and is the answer to anyone who concludes the ledger is blocked on content.
 */
export const Grants = {

    /* -------------------------------------------- */
    /*  §9.45 — background skills and the two caps  */
    /* -------------------------------------------- */

    /**
     * The background-skill allowance, and it is the first place a species modifier changes an
     * OUTCOME rather than a display (§9.45): the DM is read off EDU *at this moment*, which after
     * §9.18 is `base + auto` with the species contribution already derived in. A patriarch's EDU+2
     * can buy a whole extra background skill, and a species modifier that landed wrong would hand
     * out the wrong number of them.
     *
     * `EDU DM + 3` is a **default and not arithmetic** — every published species prints its own
     * count — so a frame that declares a formula replaces it outright. A fixed number is answered
     * here; a dice formula is handed back for the caller to roll.
     *
     * @param {Actor} actor
     * @returns {{count: number|null, formula: string, eduDM: number, choices: string[],
     *            mandatory: string[]}}
     */
    backgroundSkills(actor) {
        const block = Chargen.frame(actor)?.system.backgroundSkills;
        const eduDM = actor?.system.characteristics?.education?.dm ?? 0;
        const declared = (block?.formula ?? "").trim();
        const fixed = declared ? Number(declared) : NaN;
        const limits = MGT2.CreationLimits;
        return {
            count: declared
                ? (Number.isFinite(fixed) ? fixed : null)
                : Math.clamp(eduDM + limits.backgroundBase, limits.backgroundMin, limits.backgroundMax),
            formula: (declared && !Number.isFinite(fixed)) ? declared : "",
            eduDM,
            // Empty is the honest state of a world that has typed no list: the referee's whole
            // library is open, and a list of names pointing at nothing would be worse than none.
            choices: [...(block?.choices ?? [])],
            mandatory: [...(block?.mandatory ?? [])]
        };
    },

    /** Every skill Item on a Traveller, which is what both caps count and what a grant looks in. */
    skills(actor) {
        return (actor?.items ?? []).filter(item =>
            (item.type === "talent") && (item.system.subType === "skill"));
    },

    /**
     * Folio 18's second limit — `no more total skill levels than 3 × (INT + EDU)` — and the one no
     * table tracks by hand, which on its own justifies the creation screen (§9.38).
     *
     * **§9.56 item 9 decides that a speciality level counts separately**, because the cap counts
     * skill *levels* and a speciality level is a level. It bites specialists sooner, which is the
     * honest reading; with the rule off, only skills with no speciality are counted.
     *
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
            // Off leaves the cap untracked entirely, which is the referee who does not want the
            // bookkeeping rather than one who reads the limit differently (§9.56 item 3).
            enforced: Rules.on("skillCapBreach")
        };
    },

    /**
     * Grant one skill, at a level, from a typed name — the primitive every table roll, every basic
     * training and every benefit row ends at.
     *
     * Two limits apply and they are not the same shape. **Level 4 is a ceiling**: *"a skill may
     * never be increased beyond level 4 during Traveller creation; once a skill has reached level 4,
     * any additional increases are lost"*, so the excess is discarded silently, as printed. **The
     * `3 × (INT + EDU)` cap degrades instead**: folio 55 prints the only on-breach procedure
     * anywhere — written for post-career study and transposed by §9.56 item 3 — so a grant that
     * would breach it lands the skill at level 0 rather than being refused. A refusal would leave
     * the table with a printed grant and nowhere to put it.
     *
     * @param {Actor} actor
     * @param {object} grant
     * @param {string} grant.name            The skill as the referee typed it
     * @param {string} [grant.speciality]
     * @param {number} [grant.level]         What the cell prints
     * @param {string} [grant.mode]          A `MGT2.GrantModes` key
     * @param {number|null} [grant.floor]    The per-row floor of `SOC 10 or SOC +1, whichever is higher`
     * @param {object} [grant.provenance]    `{term, career, table, note}` (§9.38)
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

        // The cap counts what is HELD, so a grant is measured against the room left rather than
        // against the total it would produce — which is the same number and the cheaper reading.
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

    /* -------------------------------------------- */
    /*  §9.44 — relationships, in bulk and rarely detailed  */
    /* -------------------------------------------- */

    /**
     * A blank contact is a first-class row, and that is the design rule rather than a tolerance
     * (§9.44): the book says outright to note each one at whatever level of detail suits, and
     * *"Rival in Navy"* is enough. So the ledger creates them unnamed, several at a time, and the
     * fiction arrives later or never.
     *
     * **The mirror is never created.** A's Rival need not hold A as anything at all.
     *
     * @param {Actor} actor
     * @param {object} contact
     * @param {string} [contact.name]
     * @param {string} [contact.relation]   A `MGT2.ContactRelations` key
     * @param {string} [contact.uuid]       The Actor this relationship stands for, where one exists
     * @param {object} [contact.provenance]
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

    /**
     * Folio 20's betrayal: a Contact or Ally **converts** into a Rival or Enemy. It is a field change
     * plus a provenance entry and never an erasure, so where the ally came from survives the
     * betrayal (§9.44).
     */
    async convert(contact, relation, note = "") {
        if ( !contact ) return null;
        const trail = [contact.system.provenance?.note, note].filter(part => part).join(" · ");
        return contact.update({ "system.relation": relation, "system.provenance.note": trail });
    },

    /* -------------------------------------------- */

    /**
     * The Connections Rule (folio 19), which is the transaction a single sheet cannot express and
     * therefore the whole argument for §9.38's grid: *if two players agree, an event rolled by one
     * may involve the other, and both gain one extra skill.*
     *
     * **A connection and a contact are two separate outcomes of one agreement** (§9.44). Making the
     * other Traveller a Contact, Ally or Rival *also* qualifies but is not required, so nothing here
     * creates one — coupling them would forbid the plain case where two Travellers were simply in
     * the same story.
     *
     * The allowance lives on the ledger flag and not on the actor, and that is deliberate: it is
     * spent during creation and means nothing afterwards, where the two skills it bought are
     * ordinary skills. What survives is their provenance.
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
        // people, organisations and places instead (§9.46).
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
     * Record the agreement and pay both sides. Reciprocal by definition — *both* gain one extra
     * skill — which is the one place in this module a mirror IS written, and the reason is that the
     * rule says so where §9.44's contacts say the opposite.
     *
     * @param {Actor} actor
     * @param {Actor} other
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
            // so in practice the referee performs it. Refused with a sentence rather than half
            // applied, because paying one side and not the other is worse than paying neither.
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
                written.push(await this.grantSkill(side, { name: skill, level: 1, mode: "atLeast",
                    provenance: { term: Chargen.read(side).term, table: "connection",
                        note: note || partner.name } }));
            }
        }
        return written;
    },

    /* -------------------------------------------- */
    /*  §9.46 — the six rolls, and the only write to `base`  */
    /* -------------------------------------------- */

    /**
     * What this Traveller rolls, and with which dice. **The set and the dice belong to the species**
     * (§9.46, §9.54): CHA instead of SOC, no SOC at all for one species, a seventh characteristic
     * for another — and the dice themselves differ, one rolling `1D+1` as a base and another `1D+6`.
     * So a frame that declares `characteristicRolls` replaces folio 9's six outright.
     *
     * The Companion's **boon dice** apply to the first N of them: 3D drop the lowest, for two
     * characteristics, or four, or all six (§9.46).
     *
     * @returns {{method: string, boon: number, entries: object[]}}
     */
    plan(actor) {
        const species = Chargen.frame(actor);
        const declared = species?.system.characteristicRolls ?? [];
        const without = species?.system.withoutCharacteristics ?? new Set();
        const boon = CreationOptions.boon();
        const entries = (declared.length
            ? declared.map(row => ({ characteristic: row.characteristic, formula: row.formula || "2D",
                replaces: row.replaces }))
            : MGT2.RolledCharacteristics.filter(key => !without.has?.(key))
                .map(characteristic => ({ characteristic, formula: "2D", replaces: "" })))
            .filter(entry => entry.characteristic);
        for ( const [index, entry] of entries.entries() ) {
            entry.boon = index < boon.count;
            entry.label = game.i18n.localize(MGT2.Characteristics[entry.characteristic] ?? entry.characteristic);
            entry.rolled = entry.boon ? boon.formula : MGT2Helper.damageFormula(entry.formula);
        }
        return { method: Rules.get("creationAssignment"), boon: boon.count, entries };
    },

    /**
     * Roll the set and post it. **The dice are public** — this is the moment the grid earns its
     * existence socially, because the table rolls together and the first row is six numbers per
     * column (§9.46). Nothing is written: the results come back for the player to assign.
     * @returns {Promise<{method: string, results: object[]}|null>}
     */
    async rollCharacteristics(actor) {
        const plan = this.plan(actor);
        if ( !plan.entries.length ) return null;
        const results = [];
        for ( const entry of plan.entries ) {
            const roll = await new Roll(entry.rolled).roll();
            results.push({ ...entry, total: roll.total, roll });
        }
        // One card carrying every die, rather than six cards: the set is read across, and the
        // assignment decision is made against all of them at once.
        await ChatMessage.create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            rolls: results.map(r => r.roll),
            content: await renderRollCard({
                rollTypeName: game.i18n.localize("MGT2.Chargen.Roll.Characteristics"),
                rollObjectName: game.i18n.localize(`MGT2.Rules.creationAssignment.${plan.method}`),
                lines: results.map(r => `${r.label} ${r.total}`)
            })
        });
        return { method: plan.method, results };
    },

    /**
     * **The only write to `base` in the whole system** (§9.39, §9.46). Every later change — a skill
     * table, a benefit, ageing, an injury, medical care — is a signed row in `characteristicLog`
     * that derives into `auto`, so `base` holds the characteristics as first rolled and nothing ever
     * writes it again. A caller that reaches for `base` after this has the wrong mechanism.
     *
     * Order does not matter here and that is §9.18's payoff, not an accident: the species modifier
     * is a derivation, so attaching the frame before, during or after this leaves every DM right at
     * every moment. Two printed frames are the exception and both are write-once log entries.
     *
     * @param {Actor} actor
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
