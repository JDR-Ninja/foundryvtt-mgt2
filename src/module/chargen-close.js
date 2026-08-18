import { Chargen } from "./chargen.js";
import { Grants } from "./chargen-grants.js";
import { Muster } from "./chargen-muster.js";
import { CreationOptions } from "./chargen-rolls.js";
import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PARTS_PATH = "systems/mgt2/templates/chargen";

/** The pool the table chose, world-scoped and not user-facing. */
export const PACKAGE_SETTING = "chargenPackage";

/** Stamped on every skill the package grants, so a sheet can tell one from a career table's. */
const PACKAGE_TABLE = "package";

/**
 * Folio 50's shared skills package: *"as a group, all Travellers select one of the following skill
 * packages … each Traveller takes it in turns to select an item from the package.
 */
export const Package = {

    /** @returns {{name: string, skills: string[]}} */
    read() {
        const stored = game.settings.get("mgt2", PACKAGE_SETTING) ?? {};
        return { name: stored.name ?? "", skills: [...(stored.skills ?? [])] };
    },

    async write({ name = "", skills = [] } = {}) {
        return game.settings.set("mgt2", PACKAGE_SETTING, { name, skills });
    },

    /** One typed entry read as a grant. @returns {{label: string, name: string, level: number}} */
    entry(text) {
        const label = String(text ?? "").trim();
        const match = label.match(/^(.*?)\s+(\d+)$/);
        return match
            ? { label, name: match[1].trim(), level: Number(match[2]) }
            : { label, name: label, level: 1 };
    },

    picks(actor) {
        return [...Chargen.read(actor).packagePicks];
    },

    /**
     * What is left of the pool — a **multiset** difference and not a set one, because one printed
     * package lists the same skill twice and taking it once must leave the other.
     * @returns {string[]}
     */
    remaining(roster) {
        const declared = this.read();
        const taken = new Map();
        const bump = name => taken.set(name.toLowerCase(), (taken.get(name.toLowerCase()) ?? 0) + 1);
        for ( const actor of roster ) for ( const pick of this.picks(actor) ) bump(this.entry(pick).name);
        for ( const actor of game.actors ) {
            if ( (actor.type !== "character") || Chargen.isInCreation(actor) ) continue;
            for ( const skill of Grants.skills(actor) ) {
                const provenance = skill.system.provenance;
                if ( (provenance?.table === PACKAGE_TABLE) && (provenance.note === declared.name) ) bump(skill.name);
            }
        }
        return declared.skills.filter(text => {
            const key = this.entry(text).name.toLowerCase();
            const held = taken.get(key) ?? 0;
            if ( !held ) return true;
            taken.set(key, held - 1);
            return false;
        });
    },

    /**
     * Whose turn it is: fewest picks taken, the roster's own order breaking the tie.
     * @returns {Actor|null}
     */
    turn(roster) {
        if ( !roster.length ) return null;
        const fewest = Math.min(...roster.map(actor => this.picks(actor).length));
        return roster.find(actor => this.picks(actor).length === fewest) ?? null;
    },

    /** Take one entry out of the pool. */
    async take(actor, text) {
        const entry = this.entry(text);
        if ( !actor || !entry.name ) return null;
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        await Chargen.update(actor, { packagePicks: [...this.picks(actor), entry.label] });
        return Grants.grantSkill(actor, {
            name: entry.name, level: entry.level, mode: "atLeast",
            provenance: { term: Chargen.read(actor).term, table: PACKAGE_TABLE, note: this.read().name }
        });
    }
};

/**
 * Folio 48's ship debate: *"only one Traveller may start the campaign owning a ship … each of the
 * others gains Cr25000 per year, per ship rolled"*.
 */
const Ships = {

    /** @returns {object[]} Rows carrying their own index, which is what a write back addresses. */
    rows(actor) {
        return (actor?.system.entitlements ?? [])
            .map((row, index) => ({ ...row, index }))
            .filter(row => row.kind === "ship");
    },

    kept(actor) {
        return this.rows(actor).filter(row => !row.surrendered).length;
    },

    givenUp(actor) {
        return this.rows(actor).filter(row => row.surrendered).length;
    },

    /**
     * Settle it for the whole table at once.
     * @param {string} keeper   The actor id that starts the campaign owning a ship
     */
    async elect(roster, keeper) {
        const holders = roster.filter(actor => this.rows(actor).length);
        for ( const actor of holders ) {
            if ( actor.canUserModify(game.user, "update") ) continue;
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        for ( const actor of holders ) {
            const surrendered = actor.id !== keeper;
            const rows = (actor.system.entitlements ?? []).map(row =>
                (row.kind === "ship") ? { ...row, surrendered } : { ...row });
            await actor.update({ "system.entitlements": rows });
        }
        return holders;
    }
};

/**
 * The closing screen — the two steps that are group-level by construction, and the transition out
 * of creation.
 * @extends {ApplicationV2}
 */
export class ChargenClose extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-chargen-close",
        classes: ["mgt2", "chargen", "chargen-close", "nopad"],
        position: { width: 980, height: 660 },
        window: { resizable: true, icon: "fa-solid fa-flag-checkered", title: "MGT2.Chargen.Close.Title" },
        actions: {
            benefit: ChargenClose.#onBenefit,
            redeem: ChargenClose.#onRedeem,
            keepShip: ChargenClose.#onKeepShip,
            takeSkill: ChargenClose.#onTakeSkill,
            editPackage: ChargenClose.#onEditPackage,
            finish: ChargenClose.#onFinish,
            finishAll: ChargenClose.#onFinishAll,
            openActor: ChargenClose.#onOpenActor
        }
    };

    /** @inheritDoc */
    static PARTS = {
        masthead: { template: `${PARTS_PATH}/close-masthead.html` },
        roster: { template: `${PARTS_PATH}/close-roster.html`, scrollable: [""] },
        ship: { template: `${PARTS_PATH}/close-ship.html` },
        package: { template: `${PARTS_PATH}/close-package.html` }
    };

    static async open() {
        const screen = foundry.applications.instances.get("mgt2-chargen-close") ?? new ChargenClose();
        return screen.render({ force: true });
    }

    /** Every actor this screen has written into `apps`, which is not the same as the current roster. */
    #registered = new Set();

    /**
     * The same two registrations the creation grid needs, and the same array hazard:
     * `game.actors.apps` is an ARRAY where a document's `apps` is a Record, so a window reopened
     * during its own closing animation leaves an orphan in it that re-renders for the rest of the
     * session.
     */
    #syncRegistrations(actors) {
        const wanted = new Set(actors.filter(actor => actor));
        for ( const actor of this.#registered ) {
            if ( !wanted.has(actor) ) delete actor.apps[this.id];
        }
        for ( const actor of wanted ) actor.apps[this.id] = this;
        this.#registered = wanted;
        const apps = game.actors.apps;
        for ( let i = apps.length - 1; i >= 0; i-- ) {
            if ( (apps[i] !== this) && (apps[i] instanceof ChargenClose) ) apps.splice(i, 1);
        }
        if ( !apps.includes(this) ) apps.push(this);
    }

    /** @inheritDoc */
    _tearDown(options) {
        super._tearDown(options);
        for ( const actor of this.#registered ) delete actor.apps[this.id];
        this.#registered = new Set();
        const index = game.actors.apps.indexOf(this);
        if ( index >= 0 ) game.actors.apps.splice(index, 1);
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const roster = Chargen.roster().sort((a, b) => a.name.localeCompare(b.name));
        this.#syncRegistrations(roster);

        // Solo generation removes the Connections Rule and **both** of these steps, degenerating
        // the grid to one column.
        const solo = CreationOptions.solo();
        context.solo = solo;
        context.empty = !roster.length;
        context.columns = roster.map(actor => ChargenClose.#row(actor));
        // Tearing the table down is a GROUP action, so it is offered only to a user who may write
        // every column: a player who may write one gets a half-applied roster — measured, one
        // Traveller torn down and one refused — which is the state `Ships.elect` already refuses
        // whole for.
        context.canFinishAll = !context.empty && context.columns.every(column => column.canEdit);
        context.serving = context.columns.filter(column => column.serving).length;
        context.owed = context.columns.reduce((sum, column) => sum + column.rolls, 0);
        context.ship = solo ? null : ChargenClose.#ship(context.columns);
        context.package = solo ? null : ChargenClose.#package(roster);
        return context;
    }

    /** One Traveller's whole account, read off the actor and the ledger. Nothing here is stored. */
    static #row(actor) {
        const summary = Muster.summary(actor);
        const ships = Ships.rows(actor);
        return {
            id: actor.id, name: actor.name, actor,
            canEdit: actor.canUserModify(game.user, "update"),
            age: summary.age,
            serving: Chargen.isServing(actor),
            terms: Chargen.termsServed(actor),
            // What the ledger still owes, plus the rank bonus that is DERIVED and never written
            // into it — writing a derivation into a ledger double-counts it on the next recompute
            //.
            rolls: summary.rolls,
            careers: summary.careers.map(career => ({
                id: career.id, name: career.name, terms: career.terms, rank: career.rank,
                rolls: career.ledger + career.bonusRolls,
                pension: career.pension ? MGT2Helper.credits(career.pension) : ""
            })),
            cash: summary.cash,
            pension: summary.pension,
            pensionText: MGT2Helper.credits(summary.pension
                + Muster.pensionInLieuOfShip(actor, Ships.givenUp(actor))),
            shipShares: summary.shipShares,
            ships: { held: ships.length, kept: Ships.kept(actor), givenUp: Ships.givenUp(actor) },
            benefits: (actor.system.entitlements ?? []).map((row, index) => ({
                index,
                kind: game.i18n.localize(MGT2.BenefitKinds[row.kind] ?? row.kind),
                label: ChargenClose.#benefitLabel(row),
                redeemed: row.redeemed, surrendered: row.surrendered,
                open: !row.redeemed && !row.surrendered
            }))
        };
    }

    /** A voucher is a right with limits, so the ceilings are the label and the category is the thing. */
    static #benefitLabel(row) {
        const parts = [row.category, row.constraint];
        if ( row.credits !== null ) parts.push(MGT2Helper.credits(row.credits));
        if ( row.tl !== null ) parts.push(`TL${row.tl}`);
        if ( (row.count ?? 1) > 1 ) parts.push(`x${row.count}`);
        return parts.filter(part => part).join(" · ")
            || game.i18n.localize(MGT2.BenefitKinds[row.kind] ?? row.kind);
    }

    /** The ship election. */
    static #ship(columns) {
        const holders = columns.filter(column => column.ships.held);
        const kept = holders.filter(column => column.ships.kept);
        // **Settled is not "somebody still holds one"** — before the debate every holder does.
        const settled = (kept.length === 1)
            && holders.every(column => column.ships.kept || column.ships.givenUp);
        return {
            holders: holders.map(column => ({ ...column, keeps: settled && !!column.ships.kept })),
            keeperName: settled ? kept[0].name : "",
            perYear: MGT2Helper.credits(MGT2.MusterOut.shipForgone),
            shareYear: MGT2Helper.credits(MGT2.MusterOut.shipShareUnspent)
        };
    }

    /** The pool, what is left of it, and whose turn it is — all three derived from the roster. */
    static #package(roster) {
        const declared = Package.read();
        const remaining = Package.remaining(roster);
        const turn = Package.turn(roster);
        return {
            name: declared.name,
            declared: declared.skills.length,
            remaining,
            drained: (declared.skills.length > 0) && !remaining.length,
            turnId: turn?.id ?? "",
            turnName: turn?.name ?? "",
            // The tally is what makes the rotation legible — and it is also what the rotation is
            // computed from, so a table can see why it is whose turn it is.
            takenBy: roster.map(actor => ({ name: actor.name, n: Package.picks(actor).length })),
            canEdit: game.user.isGM
        };
    }

    static #actorOf(target) {
        return game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
    }

    /** One Benefit roll, end to end in one action. */
    static async #onBenefit(event, target) {
        const actor = ChargenClose.#actorOf(target);
        if ( !actor ) return;
        const asked = await ChargenClose.#askBenefit(actor);
        if ( !asked ) return;
        const rolled = await Muster.roll(actor, asked);
        if ( !rolled ) return;
        const benefit = await ChargenClose.#askOutcome(actor, asked, rolled.roll.total);
        if ( !benefit ) {
            return ui.notifications.warn(game.i18n.localize("MGT2.Chargen.Close.RollDiscarded"));
        }
        await Muster.take(actor, benefit);
        return this.render();
    }

    /** Which career the roll belongs to and which column it is made on. */
    static async #askBenefit(actor) {
        const entitlement = Muster.entitlement(actor);
        const careers = entitlement.careers.filter(career => career.record.system.exitMode !== "stillServing");
        if ( !careers.length ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Close.NoCareers", { name: actor.name }));
            return null;
        }
        const cash = Muster.cash(actor);
        const options = careers.map(career =>
            `<option value="${career.id}">${foundry.utils.escapeHTML(career.name)} — `
            + `${game.i18n.format("MGT2.Chargen.Close.RollsLeft", { n: career.ledger + career.bonusRolls })}`
            + `</option>`).join("");
        const columns = [["other", "MGT2.Chargen.Muster.Column.other"], ["cash", "MGT2.Chargen.Muster.Column.cash"]]
            .map(([value, key]) => `<option value="${value}"${(value === "cash") && !cash.left ? " disabled" : ""}>`
                + `${game.i18n.localize(key)}</option>`).join("");
        return DialogV2.prompt({
            window: { title: "MGT2.Chargen.Close.RollBenefit" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.Chargen.Close.CashLeft",
                { taken: cash.taken, limit: cash.limit })}</p>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Career")}</label>
                <select name="career">${options}</select></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Column")}</label>
                <select name="column">${columns}</select></div>`,
            ok: { label: "MGT2.Chargen.Close.Roll",
                callback: (event, button) => ({ career: button.form.elements.career.value,
                    column: button.form.elements.column.value }) },
            rejectClose: false
        });
    }

    /** What the row the dice landed on actually said. */
    static async #askOutcome(actor, asked, total) {
        const kinds = Object.entries(MGT2.BenefitKinds).map(([key, label]) =>
            `<option value="${key}"${(key === ((asked.column === "cash") ? "cash" : "voucher")) ? " selected" : ""}>`
            + `${game.i18n.localize(label)}</option>`).join("");
        return DialogV2.prompt({
            window: { title: "MGT2.Chargen.Close.Record" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.Chargen.Close.Rolled", { n: total })}</p>
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
                    return {
                        kind: form.kind.value,
                        category: form.category.value.trim(),
                        credits: number("credits"), tl: number("tl"),
                        count: Math.max(1, number("count") ?? 1),
                        note: form.note.value.trim(),
                        provenance: { career: asked.career, table: "muster",
                            note: game.i18n.localize(`MGT2.Chargen.Muster.Column.${asked.column}`) }
                    };
                } },
            rejectClose: false
        });
    }

    /** @this {ChargenClose} */
    static async #onRedeem(event, target) {
        const actor = ChargenClose.#actorOf(target);
        if ( !actor ) return;
        await Muster.redeem(actor, Number(target.dataset.index));
        return this.render();
    }

    /**
     * The election, and it writes every holder rather than one: electing an owner is also declaring
     * the rest paid off, so the two halves cannot be separate gestures.
     */
    static async #onKeepShip(event, target) {
        const actor = ChargenClose.#actorOf(target);
        if ( !actor ) return;
        await Ships.elect(Chargen.roster(), actor.id);
        return this.render();
    }

    /** @this {ChargenClose} */
    static async #onTakeSkill(event, target) {
        const actor = ChargenClose.#actorOf(target);
        if ( !actor ) return;
        await Package.take(actor, target.dataset.entry);
        return this.render();
    }

    /** The table declares the package, once. */
    static async #onEditPackage() {
        const current = Package.read();
        const typed = await DialogV2.prompt({
            window: { title: "MGT2.Chargen.Close.PackageEdit" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.localize("MGT2.Chargen.Close.PackageHint")}</p>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.PackageName")}</label>
                <input type="text" name="name" value="${foundry.utils.escapeHTML(current.name)}"></div>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.PackageSkills")}</label>
                <textarea name="skills" rows="4">${foundry.utils.escapeHTML(current.skills.join(", "))}</textarea></div>`,
            ok: { label: "MGT2.Chargen.Close.PackageSave",
                callback: (event, button) => ({
                    name: button.form.elements.name.value.trim(),
                    skills: button.form.elements.skills.value.split(/[,\n]/)
                        .map(entry => entry.trim()).filter(entry => entry)
                }) },
            rejectClose: false
        });
        if ( !typed ) return;
        await Package.write(typed);
        return this.render();
    }

    /** The transition out, one Traveller at a time. */
    static async #onFinish(event, target) {
        const actor = ChargenClose.#actorOf(target);
        if ( !actor ) return;
        const confirmed = await ChargenClose.#confirmFinish([actor]);
        if ( !confirmed ) return;
        await ChargenClose.finish(actor);
        return this.render();
    }

    /** @this {ChargenClose} */
    static async #onFinishAll() {
        const roster = Chargen.roster();
        if ( !roster.length ) return;
        // Whole or not at all, as the ship election is: a roster half torn down is worse than one
        // not torn down, and the confirmation must never name a Traveller this user cannot write.
        for ( const actor of roster ) {
            if ( actor.canUserModify(game.user, "update") ) continue;
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return;
        }
        const confirmed = await ChargenClose.#confirmFinish(roster);
        if ( !confirmed ) return;
        for ( const actor of roster ) await ChargenClose.finish(actor);
        return this.render();
    }

    /**
     * Finishing is irreversible in one direction only — the flag goes and the decided history stays
     * — so what is confirmed is the state that is being thrown away: rolls not taken, a career
     * still open, a package not drained.
     */
    static async #confirmFinish(actors) {
        const warnings = [];
        const serving = actors.filter(actor => Chargen.isServing(actor));
        const owed = actors.reduce((sum, actor) => sum + Muster.entitlement(actor).rolls, 0);
        if ( serving.length ) {
            warnings.push(game.i18n.format("MGT2.Chargen.Close.WarnServing",
                { names: serving.map(actor => actor.name).join(", ") }));
        }
        if ( owed > 0 ) warnings.push(game.i18n.format("MGT2.Chargen.Close.WarnRolls", { n: owed }));
        const left = CreationOptions.solo() ? 0 : Package.remaining(Chargen.roster()).length;
        if ( left ) warnings.push(game.i18n.format("MGT2.Chargen.Close.WarnPackage", { n: left }));
        const list = warnings.map(text => `<li>${foundry.utils.escapeHTML(text)}</li>`).join("");
        return DialogV2.confirm({
            window: { title: "MGT2.Chargen.Close.Finish" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.format("MGT2.Chargen.Close.FinishHint",
                { names: actors.map(actor => actor.name).join(", ") })}</p>`
                + (list ? `<ul>${list}</ul>` : ""),
            rejectClose: false
        });
    }

    /** Bank the pension and take the flag off, in that order. */
    static async finish(actor) {
        if ( !actor.canUserModify(game.user, "update") ) {
            ui.notifications.warn(game.i18n.format("MGT2.Chargen.Screen.NoPermission", { name: actor.name }));
            return null;
        }
        await Muster.applyPension(actor, { shipsGivenUp: Ships.givenUp(actor) });
        return Chargen.finish(actor);
    }

    /** @this {ChargenClose} */
    static #onOpenActor(event, target) {
        ChargenClose.#actorOf(target)?.sheet?.render({ force: true });
    }
}

/**
 * The package is world-scoped and never shown in the settings pane: it is the table's own list,
 * edited from the closing screen where it is used, on the precedent of `migrationVersion` and the
 * world-packs ids.
 */
export function registerChargenSettings() {
    game.settings.register("mgt2", PACKAGE_SETTING, {
        scope: "world",
        config: false,
        type: new foundry.data.fields.ObjectField(),
        default: { name: "", skills: [] }
    });
}
