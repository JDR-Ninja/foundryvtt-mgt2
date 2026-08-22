import { MGT2 } from "../config.js";
import { locate } from "../space.js";

const fields = foundry.data.fields;

/** Core p.248 prints the profile in eHex — 0-9 then A onwards, skipping I and O. This alphabet is
 * 31 symbols and stops at W, which covers every digit the schema allows. */
const HEX_DIGITS = "0123456789ABCDEFGHJKLMNPQRSTUVW";

/** The printed line, e.g. `A788899-C`. `X` is a port that does not exist rather than a digit. */
const UWP_LINE = /^([A-EX])([0-9A-HJ-NP-W])([0-9A-HJ-NP-W])([0-9A-HJ-NP-W])([0-9A-HJ-NP-W])([0-9A-HJ-NP-W])([0-9A-HJ-NP-W])-([0-9A-HJ-NP-W])$/i;

/** The eight profile cells, in the order the line prints them after the starport letter. */
const UWP_ORDER = ["size", "atmosphere", "hydrographics", "population", "government", "lawLevel",
    "techLevel"];

/** Schema and behaviour of the `world` Actor sub-type. @extends {foundry.abstract.TypeDataModel} */
export class WorldData extends foundry.abstract.TypeDataModel {

    /** Labels every field from `MGT2.Actor.world.FIELDS.<path>.label`. */
    static LOCALIZATION_PREFIXES = ["MGT2.Actor.world"];

    static defineSchema() {
        const count = (initial = 0) => new fields.NumberField({
            required: false, nullable: false, integer: true, min: 0, initial });

        return {
            // The printed profile (Core p.248).
            uwp: new fields.SchemaField({
                starport: new fields.StringField({
                    required: false, blank: false, initial: "C", choices: MGT2.Starports }),
                size: count(),
                atmosphere: count(),
                hydrographics: count(),
                population: count(),
                government: count(),
                lawLevel: count(),
                techLevel: count()
            }),

            // WHAT THE BOOKS PRINT, and only that: the sector by name and the hex INSIDE that
            // sector, so `0605` is column 6 row 5 of its own grid — the pair a referee reads off a
            // subsector map and can type for a world of their own.
            sector: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),
            hex: new fields.StringField({ required: false, blank: true, trim: true, initial: "" }),

            // Read by BOTH traffic tables with opposite signs — passengers Amber +1 / Red −4 (Core
            // p.239), freight Amber −2 / Red −6 (Core p.240) — and a Red Zone is forbidden.
            zone: new fields.StringField({
                required: false, blank: false, initial: "green", choices: MGT2.TravelZones }),

            bases: new fields.SetField(
                new fields.StringField({ required: true, blank: false, choices: MGT2.WorldBases }),
                { required: false, initial: [] }),
            gasGiants: count(0),

            // "Roll once per starport and record it — prices are stable at any given port" (Core
            // p.258).
            berthing: new fields.NumberField({ required: false, nullable: true, initial: null }),

            // Core p.241-245. Speculative trade state is keyed on (planet, month) and OUTLIVES any
            // voyage, which is the property that kept it off the ship's leg and lands it here.
            trade: new fields.SchemaField({
                // Day-stamps of every supplier search made here.
                attempts: new fields.ArrayField(
                    new fields.NumberField({ required: true, nullable: false, integer: true }),
                    { initial: [] }),
                // "Cannot deal with that supplier again for at least a month" (Core p.243).
                refusedOn: new fields.NumberField({ required: false, nullable: true, initial: null })
            }),

            // Derive by default, allow an override — mgt2e shipped automatic codes and then had to
            // undo them.
            codeOverrides: new fields.TypedObjectField(
                new fields.BooleanField({ required: true }),
                { initial: {}, validateKey: key => MGT2.TradeCodes.some(row => row.code === key) }),

            description: new fields.HTMLField({ required: false, blank: true, trim: true, initial: "" }),
            notes: new fields.HTMLField({ required: false, blank: true, trim: true, initial: "" })
        };
    }

    /**
     * Everything a world publishes beyond the eight digits is computed here — the eighteen trade
     * codes, the fuel grade and its price, the berthing band and both traffic tables' Starport DM.
     * @inheritDoc
     */
    prepareDerivedData() {
        const port = MGT2.Starports[this.uwp.starport] ?? MGT2.Starports.X;
        this.profile = WorldData.formatUwp(this.uwp);

        // Advisory beside the stored set, never merged into it: `derived` is what the
        // digits say, `codes` is what the sheet publishes after the referee's hand.
        this.derivedCodes = MGT2.TradeCodes.filter(row => row.test(this.uwp)).map(row => row.code);
        this.codes = MGT2.TradeCodes
            .filter(row => this.codeOverrides[row.code] ?? row.test(this.uwp))
            .map(row => row.code);
        this.overridden = Object.keys(this.codeOverrides).length > 0;

        this.starport = {
            key: this.uwp.starport,
            label: port.label,
            // Core p.257: A/B refine, C/D do not, E/X sell none.
            fuel: port.fuel,
            fuelPrice: (port.fuel === "refined") ? MGT2.ShipCosts.fuelRefined
                : (port.fuel === "unrefined") ? MGT2.ShipCosts.fuelUnrefined : 0,
            berthingPerDie: port.berthingPerDie,
            trafficDM: port.trafficDM
        };

        // The typed pair read out: the hex parsed, the subsector it falls in, and the absolute
        // world-space coordinate a route is measured in.
        this.location = locate(this.sector, this.hex);

        const zone = MGT2.TravelZones[this.zone] ?? MGT2.TravelZones.green;
        this.travel = {
            passengerDM: zone.passengerDM,
            freightDM: zone.freightDM,
            forbidden: zone.forbidden === true
        };
    }

    /**
     * Whether a supplier here is still shut, and how many searches this month already cost a DM.
     * @param {number} day   `mgt2.campaignDay`
     * @returns {{attemptsThisMonth: number, searchDM: number, closedUntil: number|null}}
     */
    tradeStanding(day) {
        const month = Math.floor(day / MGT2.Calendar.daysPerMonth);
        const attemptsThisMonth = this.trade.attempts
            .filter(stamp => Math.floor(stamp / MGT2.Calendar.daysPerMonth) === month).length;
        const reopens = (this.trade.refusedOn === null) ? null
            : this.trade.refusedOn + MGT2.Calendar.daysPerMonth;
        return {
            attemptsThisMonth,
            // Core p.241: DM−1 per previous attempt on the same planet in the same month.
            searchDM: -attemptsThisMonth,
            closedUntil: (reopens !== null) && (day < reopens) ? reopens : null
        };
    }

    /**
     * A search is stamped with the day it happened, never counted: Core p.241's DM−1 per previous
     * attempt this month is then a filter over the stamps, with no counter to clear at a month
     * boundary.
     * @param {number} day   `mgt2.campaignDay`
     */
    async recordSearch(day) {
        return this.parent.update({ "system.trade.attempts": [...this.trade.attempts, day] });
    }

    async clearSearches() {
        return this.parent.update({ "system.trade.attempts": [] });
    }

    /** "Cannot deal with that supplier again for at least a month" (Core p.243). */
    async refuseSupplier(day) {
        return this.parent.update({ "system.trade.refusedOn": day });
    }

    async clearRefusal() {
        return this.parent.update({ "system.trade.refusedOn": null });
    }

    /** A world is the referee's, and the players read it. @inheritDoc */
    async _preCreate(data, options, user) {
        // A duplicate or an import arrives with its own ownership; only a blank world takes the default.
        if ( data.ownership?.default !== undefined ) return;
        // v14 trap, measured: given no `ownership` in the creation data, `_source.ownership` IS the
        // schema field's own `initial` object — ONE object shared by every Actor of every sub-type
        // — and `updateSource` merges into it in place, `recursive: false` included.
        this.parent._source.ownership = { ...this.parent._source.ownership };
        this.parent.updateSource({
            ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
    }

    /**
     * A subsector is 8×10 hexes and `packs` is empty, so day one is zero worlds and several hundred
     * typed digits.
     * @param {string} line   the bare nine characters, e.g. `A788899-C`. The regex is ANCHORED: a
     *     full catalogue row such as `Cogri 0101 CA6A643-9 N Ri Wa A` does not parse, and the zone
     *     letter is stripped by the caller, not here
     * @returns {object|null}   A `uwp` payload, or null when the line is not a profile
     */
    static parseUwp(line) {
        const match = UWP_LINE.exec(String(line ?? "").trim().toUpperCase());
        if ( !match ) return null;
        const uwp = { starport: match[1] };
        UWP_ORDER.forEach((key, i) => { uwp[key] = HEX_DIGITS.indexOf(match[i + 2]); });
        return uwp;
    }

    /** The same profile back as the books print it. @returns {string} */
    static formatUwp(uwp) {
        const digit = value => HEX_DIGITS[Math.min(Math.max(0, value), HEX_DIGITS.length - 1)] ?? "0";
        const body = UWP_ORDER.slice(0, -1).map(key => digit(uwp[key])).join("");
        return `${uwp.starport}${body}-${digit(uwp.techLevel)}`;
    }
}
