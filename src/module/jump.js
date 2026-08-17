import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/**
 * What a jump did, under whichever procedure the hull declares (§9.89).
 *
 * The two branches are not two spellings of one rule. **Core** reads the failed Engineer (j-drive)
 * check and nothing else, so the astrogator's Effect reaches it only as the chain DM the roll prompt
 * already applied [Core folio 158]. **Companion** reads the SUM of both Effects for the trigger and
 * each Effect on a variance table of its own, so neither roll can resolve first and no chain can
 * carry it [Companion folios 150-153].
 *
 * Both entry points ROLL, which is why they are async and why nothing here is called from a render:
 * `VoyageScreen` keeps the reading a roll produced and discards it when an Effect changes, rather
 * than re-reading dice that were rolled against different numbers.
 */
export class Jump {

    /**
     * Core folio 158's three outcomes, read on the Effect of the failed Engineer check. The folio
     * offers the third "at the referee's option" and hands the worst band to "a merciful referee",
     * so both are flagged rather than silently promoted to results.
     * @param {number} effect
     * @returns {Promise<object>}
     */
    static async core(effect) {
        const row = MGT2.readTable(MGT2.Misjumps.core.outcomes, effect);
        const rolls = [];
        return {
            ruleset: "core", effect,
            misjumped: !row.clean,
            row,
            values: await Jump.#values(row, rolls),
            rolls
        };
    }

    /* -------------------------------------------- */

    /**
     * Companion folios 150-153, in the order the chapter resolves them: both variance tables, then
     * the misjump trigger, then whichever of the two consequence tables the pair earns.
     *
     * @param {object} input
     * @param {number} input.astrogator   The plot check's Effect
     * @param {number} input.engineer     The jump check's Effect
     * @param {string} [input.gravity]    A `MGT2.JumpGravity` key — the referee's, not derived
     * @returns {Promise<object>}
     */
    static async companion({ astrogator, engineer, gravity = "none" } = {}) {
        const rules = MGT2.Misjumps.companion;
        const sum = astrogator + engineer;
        const rolls = [];

        const distance = await Jump.#distance(astrogator, rolls);
        const time = await Jump.#time(engineer, rolls);

        // Folio 152. A misjump is the sum, a SERIOUS misjump is both checks failed, and a misjump
        // averted is one failure the other roll outran — which still costs a Bad Jump.
        const misjumped = sum <= rules.trigger;
        const serious = misjumped && (astrogator < 0) && (engineer < 0);
        const averted = !misjumped && ((astrogator < 0) || (engineer < 0));

        // Folio 152 states this twice and not identically: VERY BAD JUMPS says "if both variance
        // tables indicate a Bad Jump, **or the ship misjumps**", while MISJUMPS below it separates
        // the grades — "All Misjumps are accompanied by the effects of a Bad Jump and Serious
        // Misjumps are accompanied by the effects of a Very Bad Jump". The second is the more
        // specific statement and the one that makes the two grades mean anything, so it is followed
        // (§9.89).
        const badJump = distance.bad || time.bad || misjumped || averted;
        const veryBad = (distance.bad && time.bad) || serious;

        const reading = {
            ruleset: "companion",
            astrogator, engineer, sum, gravity,
            distance, time,
            misjumped, serious, averted, badJump, veryBad,
            misjump: misjumped ? await Jump.#misjump(sum, rolls) : null,
            veryBadJump: veryBad
                ? await Jump.#veryBad({ distance, time, misjumped, gravity }, rolls) : null,
            rolls
        };
        return reading;
    }

    /* -------------------------------------------- */

    /**
     * Folio 151, 2D + the astrogator's Effect. The row is an emergence DISTANCE and not a variance,
     * so a low roll can put the ship inside the limit — and folio 150 precipitates it back out at
     * exactly 100 diameters rather than letting it arrive closer.
     */
    static async #distance(effect, sink) {
        const rules = MGT2.Misjumps.companion;
        const roll = await Jump.#dice(2, sink);
        const total = roll + effect;
        const row = MGT2.readTable(rules.distance, total);
        const diameters = await Jump.#roll(row.diameters, sink);
        return {
            roll, effect, total, row, bad: row.bad === true,
            diameters,
            precipitated: diameters < rules.limit,
            emergence: Math.max(rules.limit, diameters)
        };
    }

    /**
     * Folio 151, 2D + the engineer's Effect, and this one IS a variance: the hours are added to or
     * taken off the 160-hour baseline, on a 1D that the folio reads odd for long and even for short.
     */
    static async #time(effect, sink) {
        const rules = MGT2.Misjumps.companion;
        const roll = await Jump.#dice(2, sink);
        const total = roll + effect;
        const row = MGT2.readTable(rules.time, total);
        const hours = await Jump.#roll(row.hours, sink) ?? 0;
        const swing = await Jump.#dice(1, sink);
        const long = (swing % 2 === 1) === rules.longOnOdd;
        return {
            roll, effect, total, row, bad: row.bad === true,
            hours, swing, long: hours ? long : null,
            duration: rules.baselineHours + (long ? hours : -hours)
        };
    }

    /** Folio 153, 2D with the combined Effect as a DM. The trigger caps the sum, so it reads low. */
    static async #misjump(sum, sink) {
        const roll = await Jump.#dice(2, sink);
        const total = roll + sum;
        const row = MGT2.readTable(MGT2.Misjumps.companion.table, total);
        return { roll, dm: sum, total, row, values: await Jump.#values(row, sink) };
    }

    /**
     * Folio 152's table, and the ladder in front of it. "Only one modifier is used — the Referee
     * should use the highest applicable to the ship", which makes it a max over what applies rather
     * than the sum every other modifier list in this system is. Two of the four are read off the
     * jump; gravity is typed, because nothing tracks where the drive was fired.
     */
    static async #veryBad({ distance, time, misjumped, gravity }, sink) {
        const dms = MGT2.Misjumps.companion.veryBadDMs;
        const applicable = [];
        if ( distance.bad && time.bad ) applicable.push(["bothVariances", dms.bothVariances]);
        if ( distance.precipitated ) applicable.push(["precipitation", dms.precipitation]);
        if ( misjumped ) applicable.push(["misjump", dms.misjump]);
        if ( gravity in dms ) applicable.push([gravity, dms[gravity]]);

        const [source, dm] = applicable.reduce((worst, entry) =>
            (entry[1] > worst[1]) ? entry : worst, applicable[0] ?? ["misjump", 0]);
        const roll = await Jump.#dice(2, sink);
        const total = roll + dm;
        const row = MGT2.readTable(MGT2.Misjumps.companion.veryBad, total);
        return { roll, dm, source, total, row, values: await Jump.#values(row, sink) };
    }

    /* -------------------------------------------- */

    /** Every dice expression a table row carries, rolled once and keyed as the row names them. */
    static async #values(row, sink) {
        const values = {};
        for ( const key of ["parsecs", "days", "hours", "diameters", "work", "perceived", "hullPerDay"] ) {
            if ( !row[key] ) continue;
            // Core folio 158 OFFERS the time the crew perceives rather than imposing it, so a world
            // that has not adopted it never rolls the die — and the clause reporting it goes with the
            // figure, in `VoyageScreen#outcome`.
            if ( (key === "perceived") && !Rules.on("perceivedTime") ) continue;
            const value = await Jump.#roll(row[key], sink);
            if ( value !== null ) values[key] = value;
        }
        return values;
    }

    /**
     * A printed expression, rolled. The books write `2D`, `1D3` and `100+2Dx10`; the multiplication
     * sign is the one thing the tables here spell as Foundry needs it, because `x` is not an
     * operator in any dice grammar and normalising it would hide which figure is a die.
     *
     * `sink` collects the `Roll` behind each figure so the card the referee posts can carry them
     * (§9.117). A misjump is a dozen small rolls and the reading keeps only their totals, so without
     * the sink there is nothing left to attach by the time anything is posted.
     */
    static async #roll(expression, sink) {
        if ( !expression ) return null;
        const formula = MGT2Helper.damageFormula(expression);
        if ( !Roll.validate(formula) ) return null;
        const roll = await new Roll(formula).roll();
        sink?.push(roll);
        return roll.total;
    }

    static async #dice(count, sink) {
        const roll = await new Roll(`${count}d6`).roll();
        sink?.push(roll);
        return roll.total;
    }
}
