import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

const { DialogV2 } = foundry.applications.api;

/** Normalised for lookup, so `Ship's Boat`, `ship shares` and `shipsBoat` all reduce to one token. */
const token = text => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const COUNTS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10 });

/** Mustering out — an **entitlement ledger**, and creation's full output map. */
export const Muster = {

    /**
     * Which folio 47 definition a printed `ref` names, and how many of it.
     * @returns {{slug: string, count: number}|null}   Null where the table has no such row.
     */
    definition(ref) {
        const wanted = token(ref);
        if ( !wanted ) return null;
        const counted = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(.+)$/.exec(wanted);
        const name = counted ? counted[2] : wanted;
        const count = counted ? (Number(counted[1]) || COUNTS[counted[1]] || 1) : 1;
        const found = Object.entries(MGT2.Benefits).find(([slug, entry]) =>
            (token(slug) === name) || (entry.names ?? []).some(alias => token(alias) === name));
        return found ? { slug: found[0], ...found[1], count } : null;
    },

    /**
     * One entitlement row from a printed ref. A ref the table does not define becomes a voucher
     * carrying the words the cell printed, which is the only honest reading of a benefit whose
     * definition this system does not hold.
     */
    fromRef(ref, extra = {}) {
        const found = this.definition(ref);
        if ( !found ) return { kind: "voucher", category: String(ref ?? "").trim(), ...extra };
        return {
            kind: found.kind, ref: found.slug, count: found.count,
            category: game.i18n.localize(`MGT2.Chargen.Benefits.${found.slug}`),
            credits: found.credits ?? null,
            tl: found.tl ?? null,
            constraint: found.constraint
                ? game.i18n.localize(`MGT2.Chargen.Benefits.Constraint.${found.constraint}`) : "",
            onRepeat: found.onRepeat ?? "another",
            ...extra
        };
    },

    /**
     * The printed row a 1D Benefit roll landed on, read off the career's own packed columns — the
     * last row is what a rank DM reaches.
     * @returns {{cell: object|null, cash: number}}
     */
    rowFor(record, column, total) {
        const rows = (column === "cash") ? record?.system.benefits.cash : record?.system.benefits.other;
        // The ceiling is the printed column's own length: the Core sets out seven rows and Bounty
        // Hunter p.6 eight, and a fixed clamp puts the eighth out of reach of every DM.
        const at = Math.clamp(total, 1, Math.max(1, rows?.length ?? 0)) - 1;
        if ( column === "cash" ) return { cell: null, cash: rows?.[at] ?? 0 };
        return { cell: rows?.[at] ?? null, cash: 0 };
    },

    /**
     * What a redemption may spend. Two printed repeat clauses raise it: armour trades the original
     * in for a Cr25000 ceiling, and an improved cybernetic implant exceeds both limits outright.
     * @param {string} [mode]   `base`, `tradeIn` or `improve`
     * @returns {{credits: number|null, tl: number|null}}
     */
    ceilings(row, mode = "base") {
        if ( mode === "improve" ) return { credits: null, tl: null };
        const raised = MGT2.Benefits[row?.ref]?.repeatCredits;
        if ( (mode === "tradeIn") && raised ) return { credits: raised, tl: row?.tl ?? null };
        return { credits: row?.credits ?? null, tl: row?.tl ?? null };
    },

    /** A voucher is a right with limits, so the ceilings are the label and the category the thing. */
    label(row) {
        const key = row?.ref ? `MGT2.Chargen.Benefits.${row.ref}` : "";
        const parts = [(key && game.i18n.has(key)) ? game.i18n.localize(key) : row?.category,
            row?.constraint];
        if ( (row?.credits ?? null) !== null ) parts.push(`Cr${MGT2Helper.credits(row.credits)}`);
        if ( (row?.tl ?? null) !== null ) parts.push(`TL${row.tl}`);
        if ( (row?.count ?? 1) > 1 ) parts.push(`x${row.count}`);
        return parts.filter(part => part).join(" · ")
            || game.i18n.localize(MGT2.BenefitKinds[row?.kind] ?? row?.kind ?? "");
    },

    /** Earlier rows of the same benefit still standing, which is what a repeat clause acts on. */
    siblings(actor, index) {
        const rows = actor?.system.entitlements ?? [];
        const ref = rows[index]?.ref;
        if ( !ref ) return [];
        return rows.map((row, at) => ({ ...row, index: at })).filter(row =>
            (row.index !== index) && (row.ref === ref) && row.redeemed && !row.surrendered);
    },

    /**
     * The Benefit-roll entitlement, career by career.
     * @returns {{careers: object[], rolls: number}}
     */
    entitlement(actor) {
        // Summed here rather than through `Chargen.benefitRolls`, and the difference is measurable:
        // that reader answers *what this career is worth right now*, so a row naming no career — a
        // Life Event's `lose one Benefit roll` — counts inside **every** career's total, which is
        // what a mid-term wager needs and what a sum across careers must not do.
        const rows = Chargen.read(actor).benefitRolls;
        const careers = Chargen.careers(actor).map(record => {
            const bonus = this.rankBonus(record, actor);
            return {
                id: record.id, name: record.name, record,
                terms: Chargen.termsIn(record),
                rank: bonus.rank,
                ledger: rows.reduce((sum, row) => (row.career === record.id) ? sum + row.value : sum, 0),
                bonusRolls: bonus.rolls,
                // Folio 46: the top rung carries `DM+1 to all Benefit rolls from this career`,
                // which is a per-career DM and not a Traveller-wide one.
                dm: bonus.dm,
                pension: this.pensionOf(record)
            };
        });
        const owned = new Set(careers.map(career => career.id));
        const unscoped = rows.reduce((sum, row) =>
            owned.has(row.career) ? sum : sum + row.value, 0);
        return {
            careers,
            rolls: careers.reduce((sum, career) => sum + career.ledger + career.bonusRolls, unscoped),
            unscoped
        };
    },

    /**
     * Folio 46's Benefits of Rank, read against the **highest rank reached** — which on a track
     * that can fall is a high-water mark and not the current value: a Hiver's status falls
     * as readily as it rises, and a Droyne's rank falls too.
     * @returns {{rank: number, rolls: number, dm: number}}
     */
    rankBonus(record, actor) {
        const ladders = record.system.rankLadders ?? [];
        const mine = ladders.find(ladder => ladder.id === record.system.ladder);
        const tracked = Chargen.read(actor).tracks[record.system.ladder]?.high;
        let rank = Math.max(record.system.rank ?? 0, tracked ?? 0);
        if ( (Rules.get("officerRankNumbering") === "combined") && mine?.officer ) {
            const enlisted = ladders.filter(ladder => !ladder.officer)
                .flatMap(ladder => ladder.rows.map(row => row.rank ?? 0));
            rank += enlisted.length ? Math.max(...enlisted) : 0;
        }
        // `upTo` is the row's UPPER bound, so the first row the rank fits in is the answer.
        const row = MGT2.MusterOut.rankBonus.find(entry => rank <= entry.upTo)
            ?? MGT2.MusterOut.rankBonus.at(-1);
        return { rank, rolls: row.rolls, dm: row.dm };
    },

    /** The lifetime Cash counter. @returns {{limit: number, taken: number, left: number}} */
    cash(actor) {
        const taken = (actor?.system.entitlements ?? [])
            .reduce((sum, row) => sum + ((row.kind === "cash") ? (row.count || 1) : 0), 0);
        const limit = MGT2.MusterOut.cashRolls;
        return { limit, taken, left: Math.max(0, limit - taken) };
    },

    /**
     * The DMs on one Benefit roll.
     * @param {string} [options.column]   `cash` or `other`
     * @param {string} [options.career]   The career record's id
     * @returns {{formula: string, rows: [string, number][], terms: object[], total: number}}
     */
    compose(actor, { column = "other", career = "" } = {}) {
        const rows = [];
        if ( column === "cash" ) {
            // "A Traveller with the Gambler skill gains DM+1 to all rolls on Cash columns" — any
            // level of it, which is why the level is not read.
            const gambler = MGT2.MusterOut.cashSkill;
            const held = Grants.skills(actor).find(skill =>
                gambler.skills.some(name => MGT2Helper.matchesSkill(skill.name, name)));
            if ( held ) rows.push([held.name, gambler.dm]);
        }
        const record = career ? actor?.items.get(career) : null;
        if ( record?.type === "career" ) {
            const bonus = this.rankBonus(record, actor);
            if ( bonus.dm ) rows.push([record.name, bonus.dm]);
        }
        // Life Event 10's `DM+2 to any one Benefit roll` and everything shaped like it.
        for ( const entry of Chargen.pending(actor, "benefit", record?.name ?? "") ) {
            if ( (entry.kind === "dm") && entry.dm ) {
                rows.push([entry.note || game.i18n.localize("MGT2.Chargen.Roll.Pending"), entry.dm]);
            }
        }
        const { parts, terms, total } = Checks.modifiers(rows);
        return { formula: ["1d6", ...parts].join(""), rows, terms, total };
    },

    /** Roll one benefit and post it. */
    async roll(actor, { column = "other", career = "" } = {}) {
        if ( (column === "cash") && !this.cash(actor).left ) {
            ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Muster.CashSpent"));
            return null;
        }
        const composed = this.compose(actor, { column, career });
        const roll = await new Roll(composed.formula).roll();
        await ChatMessage.create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            rolls: [roll],
            content: await renderRollCard({
                roll,
                rollTypeName: game.i18n.localize("MGT2.Chargen.Muster.Title"),
                rollObjectName: game.i18n.localize(`MGT2.Chargen.Muster.Column.${column}`),
                modifiers: composed.terms
            })
        });
        return { roll, composed };
    },

    /**
     * Record one benefit roll's outcome and spend the roll.
     * @param {object} benefit    A `system.entitlements` row: kind, category, credits, tl, …
     * @param {boolean} [options.spend]   Whether this consumes a Benefit roll and its tray one-shots
     */
    async take(actor, benefit, { spend = true } = {}) {
        let row = {
            kind: "voucher", count: 1, redeemed: false, ...benefit,
            provenance: { term: Chargen.read(actor).term, ...(benefit.provenance ?? {}) }
        };
        // Folio 48: TAS membership is once per Traveller and a second roll is Ship Shares instead.
        const convert = MGT2.Benefits[row.ref]?.convert;
        if ( convert && (actor.system.entitlements ?? []).some(held => held.ref === row.ref) ) {
            row = { ...row, ...convert, credits: null, tl: null, constraint: "",
                category: game.i18n.localize(`MGT2.Chargen.Benefits.${convert.ref}`) };
        }
        if ( row.kind === "membership" ) row.redeemed = true;
        const update = { "system.entitlements": [...(actor.system.entitlements ?? []), row] };

        if ( row.kind === "cash" ) {
            // Cash is money, not an entitlement to be redeemed later — the row exists so the
            // lifetime cap survives the flag's teardown.
            row.redeemed = true;
            update["system.finance.credits"] = (actor.system.finance.credits ?? 0) + (row.credits ?? 0);
        }
        if ( row.kind === "shipShare" ) {
            row.redeemed = true;
            update["system.finance.shipShares"] = (actor.system.finance.shipShares ?? 0) + (row.count ?? 1);
        }
        // A relationship is a `contact` Item and never a voucher; the row survives so the ledger
        // still says which roll produced it.
        if ( row.kind === "contact" ) row.redeemed = true;
        await actor.update(update);
        if ( row.kind === "contact" ) {
            const relation = MGT2.Benefits[row.ref]?.relation ?? "Contact";
            for ( let taken = 0; taken < (row.count || 1); taken++ ) {
                await Grants.contact(actor, { relation, provenance: row.provenance });
            }
        }

        if ( spend ) await this.spendRoll(actor, row.provenance, row.category || row.kind);
        return row;
    },

    /** Spend one Benefit roll, and with it the one-shots that were riding on it. */
    async spendRoll(actor, provenance = {}, note = "") {
        // Folio 46, Life Event 10: the `DM+2 to any one Benefit roll` goes with the outcome kept.
        await Chargen.spendPending(actor, "benefit", actor.items.get(provenance.career)?.name ?? "");
        return Chargen.update(actor, {
            benefitRolls: [...Chargen.read(actor).benefitRolls.map(entry => entry.toObject?.() ?? entry),
                { value: -1, career: provenance.career ?? "",
                    term: provenance.term ?? Chargen.read(actor).term, note }]
        });
    },

    /**
     * What the row the dice landed on said, asked where the career carries no packed column: the
     * printed table as a list, and free text for a benefit it does not define.
     * @returns {Promise<object|null>}
     */
    async promptRow(actor, { total = null, provenance = {} } = {}) {
        const escape = foundry.utils.escapeHTML;
        const defined = Object.keys(MGT2.Benefits).map(slug =>
            `<option value="${slug}">${escape(game.i18n.localize(`MGT2.Chargen.Benefits.${slug}`))}</option>`);
        const kinds = Object.entries(MGT2.BenefitKinds).map(([key, label]) =>
            `<option value="${key}">${escape(game.i18n.localize(label))}</option>`).join("");
        const typed = await DialogV2.prompt({
            window: { title: "MGT2.Chargen.Close.Record" },
            classes: ["mgt2"],
            content: `<p>${(total === null) ? game.i18n.localize("MGT2.Chargen.Benefits.PickHint")
                : game.i18n.format("MGT2.Chargen.Close.Rolled", { n: total })}</p>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Benefits.Printed")}</label>
                <select name="ref"><option value="">${escape(game.i18n.localize("MGT2.Chargen.Benefits.Other"))}</option>${defined.join("")}</select></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Kind")}</label>
                <select name="kind">${kinds}</select></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.What")}</label>
                <input type="text" name="category" value=""></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Credits")}</label>
                <input type="number" name="credits" value=""></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Tl")}</label>
                <input type="number" name="tl" value=""></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Count")}</label>
                <input type="number" name="count" value="1" min="1"></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Note")}</label>
                <input type="text" name="note" value=""></div>`,
            ok: { label: "MGT2.Chargen.Close.Take",
                callback: (event, button) => {
                    const form = button.form.elements;
                    const number = name => (form[name].value === "") ? null : Number(form[name].value);
                    return { ref: form.ref.value, kind: form.kind.value,
                        category: form.category.value.trim(), credits: number("credits"),
                        tl: number("tl"), count: Math.max(1, number("count") ?? 1),
                        note: form.note.value.trim() };
                } },
            rejectClose: false
        });
        if ( !typed ) return null;
        const extra = { note: typed.note, provenance };
        // A named row is the table's to describe; the fields below it only answer for a benefit
        // this system holds no definition for.
        if ( typed.ref ) return this.fromRef(typed.ref, { ...extra, count: typed.count });
        return { kind: typed.kind, category: typed.category, credits: typed.credits, tl: typed.tl,
            count: typed.count, ...extra };
    },

    /**
     * Redeem a voucher against something the referee's library actually holds.
     * @param {string} [picked.uuid]      The compendium document it was redeemed against
     * @param {string} [picked.item]      The embedded Item created from it
     * @param {number|null} [picked.tradeIn]   A sibling row given up to buy the higher ceiling
     */
    async redeem(actor, index, { note = "", uuid = "", item = "", tradeIn = null } = {}) {
        const rows = (actor.system.entitlements ?? []).map(row => ({ ...row }));
        if ( !rows[index] ) return null;
        Object.assign(rows[index], { redeemed: true },
            uuid ? { uuid } : {}, item ? { item } : {}, note ? { note } : {});
        if ( rows[tradeIn] ) {
            rows[tradeIn].surrendered = true;
            // The row records the right as exercised, so it states the ceiling that was spent.
            rows[index].credits = this.ceilings(rows[index], "tradeIn").credits;
            await actor.items.get(rows[tradeIn].item)?.delete();
        }
        await actor.update({ "system.entitlements": rows });
        return rows[index];
    },

    /** Every voucher still owed, which is what a sheet after creation has to be able to show. */
    outstanding(actor) {
        return (actor?.system.entitlements ?? [])
            .map((row, index) => ({ ...row, index }))
            .filter(row => !row.redeemed);
    },

    /**
     * The pension, per career: *a Traveller that leaves a career after at least five terms is
     * considered to have retired*.
     */
    pensionOf(record) {
        const { fromTerms, base, perTerm } = MGT2.MusterOut.pension;
        const terms = Chargen.termsIn(record);
        if ( !record.system.pensionable || (record.system.exitMode === "stillServing")
            || (terms < fromTerms) ) return 0;
        return base + (perTerm * (terms - fromTerms));
    },

    /**
     * Cr25000 a year for each ship given up when the table debates who keeps the only one, and
     * Cr1000 a year for a Ship Share never spent on a hull.
     */
    pensionInLieuOfShip(actor, shipsGivenUp = 0) {
        const shares = actor?.system.finance.shipShares ?? 0;
        return (shipsGivenUp * MGT2.MusterOut.shipForgone) + (shares * MGT2.MusterOut.shipShareUnspent);
    },

    /**
     * Everything a Traveller is owed and everything they have taken, in one reading — the number a
     * closing screen prints and the number the term loop checks before offering another term.
     */
    summary(actor) {
        const entitlement = this.entitlement(actor);
        const pension = entitlement.careers.reduce((sum, career) => sum + career.pension, 0);
        return {
            ...entitlement,
            cash: this.cash(actor),
            pension,
            shipShares: actor?.system.finance.shipShares ?? 0,
            outstanding: this.outstanding(actor),
            // Folio 46: what is left may buy personal equipment before play, and more expensive
            // items have to be sought out in play.
            preplayLimit: MGT2.MusterOut.preplayEquipment,
            age: Chargen.age(actor)
        };
    },

    /** Bank the pension and write it where a sheet already shows it. */
    async applyPension(actor, { shipsGivenUp = 0 } = {}) {
        const yearly = this.summary(actor).pension + this.pensionInLieuOfShip(actor, shipsGivenUp);
        return actor.update({ "system.finance.pension": yearly });
    },

    /**
     * A cost incurred **during** creation, where the cash model produces none before mustering out.
     * @returns {Promise<{paid: number, owed: number, refused: boolean}>}
     */
    async spend(actor, cost, { note = "" } = {}) {
        const cash = actor.system.finance.credits ?? 0;
        const paid = Math.min(cash, Math.max(0, cost));
        const owed = Math.max(0, cost - paid);
        if ( owed && !Rules.on("creationCostsBecomeDebt") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Muster.NoFunds",
                { name: actor.name, cost: MGT2Helper.credits(cost) }));
            return { paid: 0, owed: 0, refused: true };
        }
        await actor.update({
            "system.finance.credits": cash - paid,
            "system.finance.debt": (actor.system.finance.debt ?? 0) + owed,
            ...(note ? { "system.finance.notes": [actor.system.finance.notes, note]
                .filter(part => part).join(" · ") } : {})
        });
        return { paid, owed, refused: false };
    }
};
