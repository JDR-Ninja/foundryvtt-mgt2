import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Muster } from "./chargen-muster.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Rows drawn per render. */
const PAGE = 200;

/**
 * Redeeming a voucher against the library the referee actually built: the ceilings folio 47 prints
 * are the filter, and a world holding no pack simply has nothing to offer.
 * @extends {ApplicationV2}
 */
export class BenefitPicker extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: "mgt2-benefit-picker",
        classes: ["mgt2"],
        position: { width: 700, height: 620 },
        window: { resizable: true, icon: "fa-solid fa-ticket",
            title: "MGT2.Chargen.Benefits.Redeem" },
        actions: {
            setMode: BenefitPicker.#onSetMode,
            choose: BenefitPicker.#onChoose,
            byHand: BenefitPicker.#onByHand
        }
    };

    /** @inheritDoc */
    static PARTS = {
        body: { template: "systems/mgt2/templates/benefit-picker.html", scrollable: [""] }
    };

    #actor = null;
    #index = 0;
    #mode = "base";

    static open(actor, index) {
        const picker = foundry.applications.instances.get("mgt2-benefit-picker") ?? new BenefitPicker();
        picker.#actor = actor;
        picker.#index = Number(index);
        picker.#mode = "base";
        return picker.render({ force: true });
    }

    /** @type {object|null} */
    get row() {
        return this.#actor?.system.entitlements?.[this.#index] ?? null;
    }

    /**
     * Everything the shown packs hold that this voucher may be spent on.
     * @returns {Promise<{spec: object|null, rows: object[]}>}
     */
    async #candidates() {
        const row = this.row;
        const spec = MGT2.Benefits[row?.ref]?.pick ?? null;
        if ( !spec ) return { spec, rows: [] };
        const { credits, tl } = Muster.ceilings(row, this.#mode);
        const packs = game.packs.filter(pack => pack.visible && (pack.documentName === spec.doc));
        await Promise.all(packs.map(pack =>
            pack.indexed ? null : pack.getIndex().catch(error => console.error(error))));

        const rows = [];
        for ( const pack of packs ) {
            for ( const entry of pack.index ) {
                if ( spec.types && !spec.types.includes(entry.type) ) continue;
                if ( spec.subTypes && !spec.subTypes.includes(entry.system?.subType) ) continue;
                const melee = entry.system?.range?.isMelee;
                // A field the pack never indexed reads `undefined`, and an absent value is no bound
                // rather than a mismatch — otherwise one missing column empties the whole list.
                if ( (spec.melee !== undefined) && (melee !== undefined) && (melee !== spec.melee) ) continue;
                const cost = entry.system?.cost ?? null;
                const level = MGT2Helper.tlNumber(entry.system?.tl);
                if ( (credits !== null) && (cost !== null) && (cost > credits) ) continue;
                if ( (tl !== null) && (level !== null) && (level > tl) ) continue;
                rows.push({
                    uuid: entry.uuid, name: entry.name, img: entry.img ?? null, pack: pack.title,
                    cost: (cost === null) ? "" : `Cr${MGT2Helper.credits(cost)}`,
                    tl: entry.system?.tl ?? "",
                    order: cost ?? -1
                });
            }
        }
        // Dearest first, because the cap has to drop something and a Cr3000 voucher is not spent on
        // the cheapest two hundred rows a library holds.
        rows.sort((a, b) => (b.order - a.order) || a.name.localeCompare(b.name));
        return { spec, rows };
    }

    /**
     * The two printed repeat clauses that act on a row already redeemed, offered only where such a
     * row exists: armour trades its original in, a cybernetic implant improves the one fitted.
     */
    #modes(entry, siblings) {
        const offered = ["base"];
        if ( siblings.length && entry.repeatCredits ) offered.push("tradeIn");
        if ( siblings.length && (entry.onRepeat === "improveExisting") ) offered.push("improve");
        return (offered.length > 1) ? offered.map(key => ({
            key, on: key === this.#mode, label: `MGT2.Chargen.Benefits.Mode.${key}`
        })) : [];
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const row = this.row;
        const entry = MGT2.Benefits[row?.ref] ?? {};
        const { spec, rows } = await this.#candidates();
        const { credits, tl } = Muster.ceilings(row, this.#mode);
        Object.assign(context, {
            who: this.#actor?.name ?? "",
            label: Muster.label(row),
            constraint: row?.constraint ?? "",
            alternative: entry.alternative
                ? game.i18n.localize(`MGT2.Chargen.Benefits.${entry.alternative}`) : "",
            ceiling: (credits === null) ? "" : `Cr${MGT2Helper.credits(credits)}`,
            tl: (tl === null) ? "" : `TL${tl}`,
            modes: this.#modes(entry, Muster.siblings(this.#actor, this.#index)),
            // A ship or a vehicle is a document with an owner and a place to live, which creation
            // does not decide — so an Actor is named by the row and never created from it.
            names: spec?.doc === "Actor",
            unredeemable: !spec,
            rows: rows.slice(0, PAGE),
            matched: rows.length,
            capped: rows.length > PAGE
        });
        return context;
    }

    static #onSetMode(event, target) {
        this.#mode = target.dataset.mode;
        return this.render();
    }

    /** @this {BenefitPicker} */
    static async #onChoose(event, target) {
        const document = await fromUuid(target.closest("[data-uuid]")?.dataset.uuid);
        if ( !document || !this.#actor ) return;
        let item = "";
        if ( document.documentName === "Item" ) {
            const data = MGT2Helper.stripIds(document.toObject());
            foundry.utils.setProperty(data, "_stats.compendiumSource", document.uuid);
            const [created] = await this.#actor.createEmbeddedDocuments("Item", [data]);
            item = created?.id ?? "";
        }
        const traded = (this.#mode === "tradeIn")
            ? Muster.siblings(this.#actor, this.#index)[0]?.index ?? null : null;
        const note = (this.#mode === "improve")
            ? game.i18n.format("MGT2.Chargen.Benefits.ImprovedNote", { name: document.name })
            : document.name;
        await Muster.redeem(this.#actor, this.#index,
            { uuid: document.uuid, item, note, tradeIn: traded });
        return this.close();
    }

    /** What redemption degrades to where no pack answers: the referee writes down what was taken. */
    static async #onByHand() {
        const typed = await DialogV2.prompt({
            window: { title: "MGT2.Chargen.Benefits.ByHand" },
            classes: ["mgt2"],
            content: `<p>${game.i18n.localize("MGT2.Chargen.Benefits.ByHandHint")}</p>
                <div class="form-group"><label>${game.i18n.localize("MGT2.Chargen.Close.Note")}</label>
                <input type="text" name="note" value="${foundry.utils.escapeHTML(this.row?.note ?? "")}"></div>`,
            ok: { label: "MGT2.Chargen.Close.Redeem",
                callback: (event, button) => button.form.elements.note.value.trim() },
            rejectClose: false
        });
        if ( typed === null ) return;
        await Muster.redeem(this.#actor, this.#index, { note: typed });
        return this.close();
    }
}
