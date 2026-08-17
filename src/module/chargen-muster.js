import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/**
 * Mustering out — an **entitlement ledger**, and creation's full output map (§9.40).
 *
 * **Most Other Benefits are vouchers, not objects.** The table does not grant items; it grants
 * *rights with limits* — *"any armour up to Cr10000 and TL12"*, *"any augmentation up to Cr75000"*.
 * The system cannot create those, because it has no catalogue and never will (§9.36), and it should
 * not pretend to. So a benefit is recorded as a voucher carrying its category and its two ceilings,
 * and the player redeems it against the library the referee built — which is also what lets a group
 * finish creation and shop afterwards.
 *
 * **`system.entitlements` is the log of benefit rolls TAKEN**, one row per roll whatever it produced,
 * and it is on the actor rather than on the ledger flag for one reason: mustering out **consumes**
 * the flag and the teardown follows it (§9.50), so anything held there is gone one action later. The
 * lifetime Cash cap — *"you may only roll on the Cash column a maximum of three times across all
 * your careers"* — is derived from that log and is therefore still true after creation ends.
 *
 * **What is here and what is not.** The roll count, the DMs, the cap and the pension are computed
 * here. The two **group-level** closing steps are not: *only one Traveller may start the campaign
 * owning a ship*, and the skills package is chosen collectively and drained one skill at a time in
 * turn. Both are a negotiation between players rather than a field on anybody, which is why §9.40
 * puts them on §9.38's screen and not on a sheet — and `pensionInLieuOfShip` below is the arithmetic
 * that screen will need once it exists.
 */
export const Muster = {

    /* -------------------------------------------- */
    /*  What a Traveller is owed                    */
    /* -------------------------------------------- */

    /**
     * The Benefit-roll entitlement, career by career.
     *
     * **The ledger and the rank bonus are different facts and are added, never merged.** The ledger
     * on the flag is what the terms and the events produced — one roll per full term, minus the term
     * a failed Survival cost, plus the thirty printed rows that wipe, grant, remove or retain rolls
     * and the two that let a player wager them (§9.50). The rank bonus is read off the record and is
     * **never written to the ledger**, because writing a derivation into a ledger double-counts it
     * the next time anything recomputes.
     *
     * @param {Actor} actor
     * @returns {{careers: object[], rolls: number}}
     */
    entitlement(actor) {
        // Summed here rather than through `Chargen.benefitRolls`, and the difference is measurable:
        // that reader answers *what this career is worth right now*, so a row naming no career — a
        // Life Event's `lose one Benefit roll` — counts inside **every** career's total, which is
        // what a mid-term wager needs and what a sum across careers must not do. Measured: two
        // careers of 5 and one unscoped −1 read back as 4 and 4 through it.
        const rows = Chargen.read(actor).benefitRolls;
        const careers = Chargen.careers(actor).map(record => {
            const bonus = this.rankBonus(record, actor);
            return {
                id: record.id, name: record.name, record,
                terms: record.system.termLog?.length || (record.system.terms ?? 0),
                rank: bonus.rank,
                ledger: rows.reduce((sum, row) => (row.career === record.id) ? sum + row.value : sum, 0),
                bonusRolls: bonus.rolls,
                // Folio 46: the top rung carries `DM+1 to all Benefit rolls from this career`, which
                // is a per-career DM and not a Traveller-wide one.
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
     * Folio 46's Benefits of Rank, read against the **highest rank reached** — which on a track that
     * can fall is a high-water mark and not the current value (§9.54): a Hiver's status falls as
     * readily as it rises, and a Droyne's rank falls too.
     *
     * **§9.56 item 4 decides officer numbering: the printed number, no conversion.** The two ladders
     * are numbered independently and a commission restarts at 1; a widespread blog claim that they
     * combine has no text behind it. With `combined` chosen, an officer rank continues from the top
     * of the record's own enlisted ladder — read off the record's copy of the template, so no career
     * name reaches this (§9.47).
     *
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
        // `upTo` is the row's UPPER bound, so the first row the rank fits in is the answer. A rank
        // past the printed table — which only `combined` can produce — reads the top row, because
        // extrapolating a fourth rung would invent a rule the game does not have.
        const row = MGT2.MusterOut.rankBonus.find(entry => rank <= entry.upTo)
            ?? MGT2.MusterOut.rankBonus.at(-1);
        return { rank, rolls: row.rolls, dm: row.dm };
    },

    /**
     * The lifetime Cash counter. Derived from the log of benefit rolls and **not held per career**,
     * because the limit is *"a maximum of three times across all your careers"*.
     * @returns {{limit: number, taken: number, left: number}}
     */
    cash(actor) {
        const taken = (actor?.system.entitlements ?? [])
            .reduce((sum, row) => sum + ((row.kind === "cash") ? (row.count || 1) : 0), 0);
        const limit = MGT2.MusterOut.cashRolls;
        return { limit, taken, left: Math.max(0, limit - taken) };
    },

    /**
     * The DMs on one Benefit roll. A benefit roll is **1D against a table row**, not 2D against a
     * target, so it is composed here rather than through §9.40's 2D creation composer — but it goes
     * through the same totalling engine, because two of those would be a defect.
     *
     * @param {Actor} actor
     * @param {object} options
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

    /**
     * Roll one benefit and post it. **Nothing is applied** — the row the dice land on is the
     * referee's table and this system ships none of it (§9.36), so the outcome is read aloud and
     * `take` records whatever it turned out to be.
     */
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
        // Life Event 10's `DM+2 to any one Benefit roll` is a one-shot tray entry that `compose` above
        // reads — so this is the roll that consumes it. Composing a tray DM and never spending it makes
        // a once-in-a-lifetime bonus permanent, which is what a second copy of the spender would have
        // hidden: it lives in `Chargen` beside `pending` precisely so that every composer owes it.
        await Chargen.spendPending(actor, "benefit", career);
        return { roll, composed };
    },

    /* -------------------------------------------- */
    /*  What it produces                            */
    /* -------------------------------------------- */

    /**
     * Record one benefit roll's outcome and spend the roll. The entitlement row is the audit trail
     * the lifetime Cash cap reads, so **a cash payout is logged here as well as banked** — the money
     * lands in `finance.credits`, which is the field the sheet draws under *Cash on hand*, and the
     * row says which roll bought it.
     *
     * Excess SOC is the one output that changes kind on the way out: *"characteristic increases above
     * 15 are lost, with the exception of SOC — every point of excess SOC becomes a Ship Share"*
     * (folio 47), which is why the caller passes what was rolled and this returns what applied.
     *
     * @param {Actor} actor
     * @param {object} benefit    A `system.entitlements` row: kind, category, credits, tl, …
     * @param {object} [options]
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

    /**
     * Redeem a voucher against something the referee's library actually holds. **Redeemed, not
     * deleted**: what a Traveller was owed is part of their history, and a referee auditing a sheet
     * mid-campaign needs the row that paid for the gun.
     */
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

    /* -------------------------------------------- */

    /**
     * The pension, per career: *a Traveller that leaves a career after at least five terms is
     * considered to have retired*. The four excluded careers are the template's `pensionable`
     * boolean and never a name list in this code (§9.40, §9.47), and a career still being served
     * pays nothing.
     *
     * Folio 48 prints five rows and they are one arithmetic progression — Cr10000 at five terms plus
     * Cr2000 a term after that, which is exactly what its `9+: Cr2000 per term beyond 8` continues.
     */
    pensionOf(record) {
        const { fromTerms, base, perTerm } = MGT2.MusterOut.pension;
        const terms = record.system.termLog?.length || (record.system.terms ?? 0);
        if ( !record.system.pensionable || (record.system.exitMode === "stillServing")
            || (terms < fromTerms) ) return 0;
        return base + (perTerm * (terms - fromTerms));
    },

    /**
     * Cr25000 a year for each ship given up when the table debates who keeps the only one, and Cr1000
     * a year for a Ship Share never spent on a hull. Both are pensions and **neither is cash** — a
     * Ship Share cannot be redeemed for money at all.
     *
     * The ship half is the group's decision and this only prices it (§9.40).
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

    /**
     * Bank the pension and write it where a sheet already shows it. Called once, when the group's
     * ship debate has settled — which is why the ships given up are an argument rather than a
     * reading: nothing on one actor knows how the table decided.
     */
    async applyPension(actor, { shipsGivenUp = 0 } = {}) {
        const yearly = this.summary(actor).pension + this.pensionInLieuOfShip(actor, shipsGivenUp);
        return actor.update({ "system.finance.pension": yearly });
    },

    /* -------------------------------------------- */

    /**
     * A cost incurred **during** creation, where the cash model produces none before mustering out.
     * One printed career event spends `Cr1000 × Advocate²` on a lawyer and the reference does not say
     * where the money comes from; §9.56 item 15 decides **debt carried into play**, because the only
     * printed mechanism for a cost incurred during creation is debt against benefits with the unpaid
     * remainder following the Traveller.
     *
     * With the rule off the cost is simply refused where there is no cash, which is the referee who
     * would rather the event did not fire than let a Traveller start owing money.
     *
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
