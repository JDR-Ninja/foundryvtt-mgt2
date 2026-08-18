import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/** Mustering out — an **entitlement ledger**, and creation's full output map. */
export const Muster = {

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
                terms: record.system.termLog?.length || (record.system.terms ?? 0),
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
     * @returns {{formula: string, rows: [string, number][], labels: string[], total: number}}
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
        for ( const entry of Chargen.pending(actor, "benefit", career) ) {
            if ( (entry.kind === "dm") && entry.dm ) {
                rows.push([entry.note || game.i18n.localize("MGT2.Chargen.Roll.Pending"), entry.dm]);
            }
        }
        const { parts, labels, total } = Checks.modifiers(rows);
        return { formula: ["1d6", ...parts].join(""), rows, labels, total };
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
                modifiers: composed.labels
            })
        });
        // Life Event 10's `DM+2 to any one Benefit roll` is a one-shot tray entry that `compose`
        // above reads — so this is the roll that consumes it.
        await Chargen.spendPending(actor, "benefit", career);
        return { roll, composed };
    },

    /**
     * Record one benefit roll's outcome and spend the roll.
     * @param {object} benefit    A `system.entitlements` row: kind, category, credits, tl, …
     * @param {boolean} [options.spend]   Whether this consumes a Benefit roll from the ledger
     */
    async take(actor, benefit, { spend = true } = {}) {
        const row = {
            kind: "voucher", count: 1, redeemed: false, ...benefit,
            provenance: { term: Chargen.read(actor).term, ...(benefit.provenance ?? {}) }
        };
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
        await actor.update(update);

        if ( spend ) {
            await Chargen.update(actor, {
                benefitRolls: [...Chargen.read(actor).benefitRolls.map(entry => entry.toObject?.() ?? entry),
                    { value: -1, career: row.provenance.career ?? "", term: row.provenance.term,
                        note: row.category || row.kind }]
            });
        }
        return row;
    },

    /** Redeem a voucher against something the referee's library actually holds. */
    async redeem(actor, index, note = "") {
        const rows = (actor.system.entitlements ?? []).map(row => ({ ...row }));
        if ( !rows[index] ) return null;
        rows[index].redeemed = true;
        if ( note ) rows[index].note = note;
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
        const terms = record.system.termLog?.length || (record.system.terms ?? 0);
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
