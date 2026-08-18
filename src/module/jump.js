import { MGT2 } from "./config.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";

/** What a jump did, under whichever procedure the hull declares. */
export class Jump {

    /**
     * Core folio 158's three outcomes, read on the Effect of the failed Engineer check.
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

    /**
     * Companion folios 150-153, in the order the chapter resolves them: both variance tables, then
     * the misjump trigger, then whichever of the two consequence tables the pair earns.
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
        // Misjumps are accompanied by the effects of a Very Bad Jump".
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

    /** Folio 151, 2D + the astrogator's Effect. */
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
     * taken off the 160-hour baseline, on a 1D that the folio reads odd for long and even for
     * short.
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

    /** Folio 152's table, and the ladder in front of it. */
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

    /** Every dice expression a table row carries, rolled once and keyed as the row names them. */
    static async #values(row, sink) {
        const values = {};
        for ( const key of ["parsecs", "days", "hours", "diameters", "work", "perceived", "hullPerDay"] ) {
            if ( !row[key] ) continue;
            // Core folio 158 OFFERS the time the crew perceives rather than imposing it, so a world
            // that has not adopted it never rolls the die — and the clause reporting it goes with
            // the figure, in `VoyageScreen#outcome`.
            if ( (key === "perceived") && !Rules.on("perceivedTime") ) continue;
            const value = await Jump.#roll(row[key], sink);
            if ( value !== null ) values[key] = value;
        }
        return values;
    }

    /** A printed expression, rolled. */
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
