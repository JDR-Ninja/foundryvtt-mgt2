import { MGT2 } from "./config.js";
import { Checks, renderRollCard } from "./checks.js";
import { MGT2Helper } from "./helper.js";
import { Rules } from "./rules.js";
import { SQUADRON } from "./fleet.js";

/**
 * The fleet attack path (HG folios 116-121) — the half of the chapter that shares nothing with
 * `combat.js`, because **it does not roll to hit**. Folio 118: "only spinal mount weapons require a
 * roll to hit. All other attacks are assumed to hit with varying degrees of success." What replaces
 * the check is the Attack Factor read against the Attack Effectiveness table, which is a multiplier
 * on a damage subtotal rather than a success test — so `Checks.resolve` has nothing to resolve here
 * and only the spinal path goes through it.
 *
 * **`fleet.js` must not import this module.** The dependency runs one way, exactly as `fleet.js`'s
 * own does on `combat.js`: the documents know nothing about the arithmetic that reads them.
 */

/** §9.100's finding, and the whole reason folio 112 needs no transcription: 3.5 is the mean of 1D. */
const FLEET_DIVISOR = 3.5;

/** Folio 111: "for turrets, count each weapon" — and folio 118 exempts turrets from two rules. */
const TURRETS = Object.freeze(["singleTurret", "doubleTurret", "tripleTurret"]);

/**
 * Core folio 167's `attackDM` column prints the same +1 Short / -2 Long / -4 Very Long that HG folio
 * 118 does, and carries -6 at Distant where the fleet chapter prints no row at all. One table, one
 * exception.
 */
const NO_FLEET_RANGE_DM = Object.freeze(["distant"]);

/** Folio 119's four nullifications, largest hull first: what a ship of that size still feels. */
const CRITICAL_IMMUNITY = Object.freeze([
    { overTons: 100000, mounts: ["largeBay", "spinal"] },
    { overTons: 10000, mounts: ["mediumBay", "largeBay", "spinal"] },
    // "Ships larger than 2,000 tons ignore critical hits from turrets and barbettes" — stated as
    // what is ignored rather than as what lands, so this row is its complement.
    { overTons: 2000, mounts: ["smallBay", "mediumBay", "largeBay", "spinal", "fixed"] }
]);

/** Folio 119: the extra critical an offensively superior ship scores. */
const SUPERIORITY = 4;

/** The die count of a printed damage expression: `4D` is a fleet Damage of 4 (§9.100). */
const DICE = /(\d*)\s*[dD]/;

const BANDS = Object.freeze(Object.keys(MGT2.ShipRangeBands));

function localize(key, data) {
    return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

/* -------------------------------------------- */

/**
 * Folio 112's Fleet Combat Weapons table, derived: its Damage column is the number of dice the
 * ordinary weapon rolls and its Multiple column is `ShipMounts[…].damageMultiple`, so a `4D` fusion
 * gun in a small bay reads 6/10 without a row being transcribed anywhere.
 *
 * A spinal mount needs no factor field either. The book prints the Pantheress's x11 meson mount as
 * `6/11,000` — base dice over multiple times factor — while a weapon Item storing the whole 66D
 * reads 66/1,000. The product is the same 66,000 either way.
 */
export function fleetDamage(formula) {
    const match = DICE.exec(String(formula ?? ""));
    if (!match) return 0;
    return match[1] === "" ? 1 : Number(match[1]);
}

/**
 * One WEAPONS row of the Fleet Ship Sheet (folios 111-112). The number of like weapons FIRED is not
 * here: folio 117 makes it the attacker's declaration — "a ship with 20 particle beam barbettes may
 * use all of them against a single target or divide them into smaller batteries".
 *
 * @param {Actor} actor          A `spacecraft`
 * @param {number} mountIndex    Into `system.mounts`
 * @param {string} [weaponId]    Which of the mount's weapons; the first by default
 * @returns {object|null}
 */
export function fleetWeaponRow(actor, mountIndex, weaponId = "") {
    const mount = actor?.system.mounts?.[mountIndex];
    if (!mount) return null;
    const id = weaponId || mount.weapons[0];
    const weapon = id ? actor.items.get(id) : null;
    const mountClass = MGT2.ShipMounts[mount.type] ?? MGT2.ShipMounts.fixed;
    const traits = weapon?.system.traitMap ?? {};
    return {
        id: weapon?.id ?? "",
        name: weapon?.name || mount.label || game.i18n.localize(mountClass.label),
        mount: mount.type,
        mountLabel: mountClass.label,
        index: mountIndex,
        turret: TURRETS.includes(mount.type),
        spinal: mount.type === "spinal",
        damage: fleetDamage(weapon?.system.damage),
        multiple: mountClass.damageMultiple ?? 1,
        // A mount that names a weapon in its label and resolves no Item reads `0/N` and is the one
        // row on this sheet that is wrong rather than empty — the ship's DEFENCES came out of that
        // same label and are right (§9.106). The row says so instead of printing a bare zero.
        inert: Boolean(actor.system.mountsInert?.[mountIndex]),
        band: weapon?.system.range?.band ?? "",
        fireControl: weapon?.system.fireControl ?? 0,
        ion: Boolean(traits.ion),
        // Folio 111: ortillery "is expected to be used specifically as ortillery and not typically
        // employed during fleet combat against other ships", so it is excluded rather than costed.
        ortillery: Boolean(traits["orbital-bombardment"] || traits["orbital-strike"]),
        traits
    };
}

/** Every mount's row, ortillery struck out — folio 111's exclusion, as a filter over `traits.js`. */
export function fleetWeaponRows(actor) {
    return (actor?.system.mounts ?? []).map((mount, index) => fleetWeaponRow(actor, index))
        .filter(row => row && !row.ortillery);
}

/**
 * The WEAPONS panel as folio 107 prints it: `100 x Turrets (beam lasers)` on one line, not a hundred
 * lines. `mounts[]` has no count field — one row IS one mount — so the battery is the grouping the
 * printed sheet already does, and it is also folio 117's unit of declaration: "a ship with 20
 * particle beam barbettes may use all of them against a single target or divide them into smaller
 * batteries". The group's size is therefore what a battery may fire at most, and the referee's typed
 * number is what fires.
 *
 * Grouped on what folio 112's own table distinguishes — the mount, the weapon and its Damage — so
 * two turrets carrying different lasers stay two rows.
 * @param {Actor} actor
 * @returns {object[]}   `fleetWeaponRow`s plus `count` and `indices`
 */
export function fleetBatteries(actor) {
    const groups = new Map();
    for ( const row of fleetWeaponRows(actor) ) {
        const key = [row.mount, row.id, row.name, row.damage, row.band].join("|");
        const battery = groups.get(key);
        if ( battery ) {
            battery.count++;
            battery.indices.push(row.index);
        }
        else groups.set(key, { ...row, count: 1, indices: [row.index] });
    }
    return [...groups.values()];
}

/* -------------------------------------------- */

/**
 * What a fleet attack resolves to. Every method is a pure reading except `apply`, `criticals` and
 * the three `resolve*` doors, which write.
 */
export class FleetAttack {

    /**
     * `OPTIONAL-RULES.md` §3.4 D5, on the doors that WRITE. The readings above are not gated and do
     * not need to be: with the switch off `system.fleet` is null, so every DM they read is 0 and
     * every figure they answer is a nought. What a switched-off rule must not do is post a card or
     * wound a ship, which is what these four do.
     */
    static #gate() {
        if ( Rules.on("fleetBattles") ) return true;
        ui.notifications.warn(game.i18n.localize("MGT2.Fleet.RuleOff"));
        return false;
    }

    /** The two levels of a fleet battle put the band on the FLEETS, never on the two contacts. */
    static bandBetween(attacker, target) {
        const combat = attacker?.parent;
        const from = attacker?.system.fleetGroup;
        const to = target?.system.fleetGroup;
        if ( !combat || !from || !to ) return null;
        // Two contacts of the same fleet are at that fleet's own internal spacing (folio 117).
        if ( from.id === to.id ) return from.system.formation;
        return combat.system?.bandBetween?.(from, to) ?? null;
    }

    /** Folio 118: a weapon "cannot attack a target beyond their maximum range". */
    static inRange(weapon, band) {
        if ( !weapon?.band || !band ) return true;
        return BANDS.indexOf(band) <= BANDS.indexOf(weapon.band);
    }

    /**
     * Folio 111's Armour, plus the one Trait that changes it: Reflec "increases Armour against
     * turret weapons by +10%, rounding up".
     */
    static armourAgainst(target, weapon) {
        const armour = target?.system.armour ?? 0;
        const reflec = MGT2.FleetTraits.reflec.armourBonus;
        const has = (target?.system.stats?.traits ?? []).some(trait => trait.key === "reflec");
        return (has && weapon?.turret) ? Math.ceil(armour * (1 + reflec)) : armour;
    }

    /**
     * Folio 118's Attack Factor, as named rows so the card prints its own arithmetic. The rows go
     * through `Checks.modifiers` for the reason every other total does: one adder, so a preview and
     * a resolution can never disagree.
     *
     * @param {object} options
     * @param {Combatant} options.attacker
     * @param {Combatant} options.target
     * @param {object} options.weapon        A `fleetWeaponRow`
     * @param {string} options.band
     * @param {boolean} [options.missile]    Reads the missile Offensive DM instead of the standard one
     * @param {boolean} [options.halved]     Folio 119's antiradiation torpedo
     * @returns {{rows: object, total: number, multiple: number, row: object}}
     */
    static factor({ attacker, target, weapon, band, missile = false, halved = false }) {
        // `system.offensive` is optional-chained because a SALVO is a legitimate attacker here and
        // §9.78's actorless Combatant carries no Offensive DM at all.
        const offensive = missile
            ? (attacker?.system.offensive?.missile ?? 0) : (attacker?.system.offensive?.standard ?? 0);
        const full = target?.system.defensiveAgainst?.(attacker?.system.fleetGroup) ?? 0;
        // Folio 119: "a target's Defensive DM is halved (round down) against a salvo of these
        // torpedoes." The Defensive DM enters a missile's arithmetic only here, so this is the one
        // place the rule can bite.
        const defensive = halved ? Math.floor(full / 2) : full;
        const entries = [
            [localize("MGT2.Fleet.Attack.Offensive"), offensive],
            [localize(halved ? "MGT2.Fleet.Attack.DefensiveHalved" : "MGT2.Fleet.Attack.Defensive"),
                -defensive]
        ];

        const rangeDM = NO_FLEET_RANGE_DM.includes(band)
            ? 0 : (MGT2.ShipRangeBands[band]?.attackDM ?? 0);
        if ( band ) {
            entries.push([localize(MGT2.ShipRangeBands[band]?.label ?? "MGT2.Fleet.Attack.Range"), rangeDM]);
        }

        // Folio 118's small-target rule REPLACES Core folio 167's "+1 per full 1,000 tons": same
        // place in the arithmetic, opposite sign, a different quantity.
        const small = MGT2.FleetSmallTarget;
        const tons = this.tonnage(target);
        if ( tons && (tons < small.underTons) && !small.mounts.includes(weapon?.mount) ) {
            entries.push([localize("MGT2.Fleet.Attack.SmallTarget"), small.dm]);
        }

        const rows = Checks.modifiers(entries);
        const row = MGT2.FleetEffectiveness.find(entry =>
            (entry.max === null) || (rows.total <= entry.max)) ?? MGT2.FleetEffectiveness.at(-1);
        return { rows, total: rows.total, multiple: row.multiple, row };
    }

    /** One hull's tonnage — a squadron's is one fighter's, which is what folio 118's rule measures. */
    static tonnage(combatant) {
        const actor = (combatant?.type === SQUADRON)
            ? combatant.system.fighter : combatant?.system.ship;
        return actor?.system.hull.tons ?? 0;
    }

    /**
     * Folio 118's damage for turrets, barbettes and bays, in the order it prints them.
     *
     * Two of its bullets are **options rather than derivations**, and deliberately: "fusion gun and
     * railgun bays add DM+1 when attacking armoured ships" and the High Yield / Intense Focus DM+1
     * both name a weapon by the words on its page, and the only thing the data holds is a name a
     * human typed. §9.75's rule is to match a name only against a table that lists both languages,
     * and neither of these has one — so they are offered and never guessed. `ignoresArmour` is the
     * third: folio 118 exempts meson guns, and `AP ∞` does not survive `traits.js`'s `int` slot.
     *
     * @param {object} options
     * @param {object} options.weapon              A `fleetWeaponRow`
     * @param {number} options.count               How many like weapons are firing
     * @param {number} options.armour              The target's fleet Armour
     * @param {number} options.effectiveness       The Attack Effectiveness multiple, from `factor`
     * @param {boolean} [options.ignoresArmour]    Meson
     * @param {boolean} [options.armourPiercing]   A fusion or railgun bay against an armoured ship
     * @param {boolean} [options.customised]       High Yield or Intense Focus; not cumulative
     */
    static damage({ weapon, count = 1, armour = 0, effectiveness = 1,
        ignoresArmour = false, armourPiercing = false, customised = false } = {}) {
        const base = weapon?.damage ?? 0;
        const bonus = (armourPiercing && (armour > 0) ? 1 : 0) + (customised ? 1 : 0);
        // Folio 118's sidebar: "if a weapon's Damage value is less than half of a ship's Armour, it
        // does no damage". Its own worked example makes 4 impervious to Armour 8, which is "at most
        // half" rather than "less than half"; the example is followed and the sentence recorded.
        const impervious = !ignoresArmour && (armour > 0) && (base <= (armour / 2));
        const adjusted = ignoresArmour
            ? (base + bonus) : Math.max(0, base + bonus - armour);
        const subtotal = impervious ? 0 : (adjusted * (weapon?.multiple ?? 1) * Math.max(0, count));
        return {
            base, bonus, armour, adjusted, subtotal, impervious,
            // Folio 118: "multiply the damage subtotal by the Damage Multiple for the final damage".
            // Rounded, because the table's 0.25 steps do not divide a whole hull evenly.
            total: Math.round(subtotal * effectiveness)
        };
    }

    /* -------------------------------------------- */

    /**
     * Folio 118's whole standard attack: no dice, one factor, one multiplier, one damage figure.
     * Nothing is applied — folio 117 has the attacker declare every battery before any of them fire,
     * so the damage is reported and `apply` is a separate step the referee takes.
     */
    static async resolveStandard({ attacker, target, weapon, count = 1, band, ...options }) {
        if ( !this.#gate() ) return null;
        const at = band ?? this.bandBetween(attacker, target);
        if ( !this.inRange(weapon, at) ) {
            ui.notifications.warn(localize("MGT2.Fleet.Attack.OutOfRange", {
                weapon: weapon.name, band: localize(MGT2.ShipRangeBands[at]?.label ?? "") }));
            return null;
        }
        const factor = this.factor({ attacker, target, weapon, band: at });
        const armour = options.ignoresArmour ? 0 : this.armourAgainst(target, weapon);
        const damage = this.damage({
            ...options, weapon, count, armour, effectiveness: factor.multiple });

        await this.#post(attacker, {
            rollTypeName: attacker.name,
            rollObjectName: localize("MGT2.Fleet.Attack.Weapons", { count, name: weapon.name }),
            modifiers: factor.rows.labels,
            lines: this.#lines(target, factor, damage, options)
        });
        return { factor, damage, band: at };
    }

    /**
     * Folio 118-119's one exception: "spinal mounts are the only weapons that must roll to hit. The
     * standard space combat rules apply, using the Crew Skill score for the Gunner skill." So this
     * is the only door in the chapter that goes through `Checks.resolve`, and its damage does NOT
     * pass the Attack Effectiveness table — folio 119 applies the multiple and stops.
     */
    static async resolveSpinal({ attacker, target, weapon, band, difficulty = "Average", ...options }) {
        if ( !this.#gate() ) return null;
        const at = band ?? this.bandBetween(attacker, target);
        const tons = this.tonnage(target);
        const spinal = MGT2.ShipMounts.spinal;
        const size = spinal.targetTonnageDM.find(step => tons <= step.maxTons);
        if ( size?.cannotAttack ) {
            ui.notifications.warn(localize("MGT2.Fleet.Spinal.CannotAttack"));
            return null;
        }
        const bulk = spinal.attackerTonnageDM
            .find(step => (step.maxTons === null) || (this.tonnage(attacker) <= step.maxTons));

        const entries = [[localize("MGT2.Fleet.Spinal.Gunner"), attacker.system.crewSkill]];
        if ( weapon.fireControl ) {
            entries.push([localize("MGT2.Items.FireControl"), weapon.fireControl]);
        }
        if ( MGT2.ShipRangeBands[at]?.attackDM ) {
            entries.push([localize(MGT2.ShipRangeBands[at].label), MGT2.ShipRangeBands[at].attackDM]);
        }
        if ( size?.dm ) entries.push([localize("MGT2.Fleet.Spinal.TargetTonnage"), size.dm]);
        if ( bulk?.[at] ) entries.push([localize("MGT2.Fleet.Spinal.Bulk"), bulk[at]]);

        const rows = Checks.modifiers(entries);
        const outcome = await Checks.resolve({
            formula: ["2d6", ...rows.parts].join(" + "), difficulty });
        if ( !outcome ) return null;

        const hit = outcome.effect >= 0;
        const armour = options.ignoresArmour ? 0 : this.armourAgainst(target, weapon);
        const damage = hit
            ? this.damage({ ...options, weapon, count: 1, armour, effectiveness: 1 }) : null;

        await Checks.post(outcome, {
            actor: attacker.actor, label: weapon.name, difficulty,
            rollTypeName: attacker.name, rollObjectName: weapon.name, modifiers: rows.labels,
            lines: hit
                ? [localize("MGT2.Fleet.Attack.Final", { damage: damage.total, target: target.name })]
                : [localize("MGT2.Fleet.Spinal.Missed")]
        });
        return { outcome, hit, damage, band: at };
    }

    /**
     * Folio 119's missile step: the salvo's own damage, once the defences have taken their bite.
     * `hits` is how many warheads detonated on target and is this door's input rather than its work
     * — folio 113's Salvo Defence pool is the other half of the chapter.
     *
     * **A reading, and the chapter does not settle it:** folio 119 lists three steps for a missile
     * and does not name the Attack Effectiveness table, while folio 110 derives a missile Offensive
     * DM that nothing else in the chapter reads. `effectiveness` is therefore an option, defaulting
     * to the printed three steps — and folio 119's antiradiation torpedo rides on it, because the
     * Defensive DM it halves appears nowhere else in a missile's arithmetic.
     */
    static async resolveMissiles({ attacker, target, warhead, hits = 0, band,
        mount = "", effectiveness = false }) {
        if ( !this.#gate() ) return null;
        const at = band ?? this.bandBetween(attacker, target);
        const entry = MGT2.FleetWarheads?.[warhead] ?? null;
        const base = entry?.damage ?? 0;
        const armour = target.system.armour ?? 0;
        const halved = entry?.halvesDefensive === true;
        const factor = effectiveness
            ? this.factor({ attacker, target, weapon: { mount }, band: at, missile: true, halved })
            : null;
        const adjusted = Math.max(0, base - armour);
        const total = Math.round(adjusted * Math.max(0, hits) * (factor?.multiple ?? 1));

        await this.#post(attacker, {
            rollTypeName: attacker.name,
            rollObjectName: localize(entry?.label ?? "MGT2.Fleet.Attack.Missiles"),
            modifiers: factor?.rows.labels ?? [],
            lines: [localize("MGT2.Fleet.Attack.Salvo", { hits, damage: adjusted }),
                localize("MGT2.Fleet.Attack.Final", { damage: total, target: target.name })]
        });
        return { base, adjusted, hits, total, factor, halved, band: at };
    }

    /**
     * Folio 111-112's ion weapons: they inflict no damage at all and buy a round of the target's
     * performance instead. The quotient is over the target's ADJUSTED Hull points, which is the Ion
     * Damage table's own column header and not the raw figure the paragraph above it says.
     */
    static async resolveIon({ attacker, target, weapon, count = 1 }) {
        if ( !this.#gate() ) return null;
        const traits = target.system.stats?.traits ?? [];
        if ( traits.some(trait => trait.key === "hardened") ) {
            ui.notifications.info(localize("MGT2.Fleet.Ion.Immune", { name: target.name }));
            return { immune: true, result: 0, rounds: 0 };
        }
        const perWeapon = MGT2.FleetIon.perWeapon[weapon?.mount] ?? 0;
        const effect = perWeapon * Math.max(0, count);
        const hull = target.system.hull.max || 1;
        const result = Math.min(MGT2.FleetIon.maxResult, Math.floor(effect / hull));
        // Folio 112: "the effect lasts for one round unless the attacking ship's Offensive DM is
        // twice the Defensive DM of the target ship, in which case it lasts for two rounds."
        const defensive = target.system.defensiveAgainst?.(attacker.system.fleetGroup) ?? 0;
        const rounds = (attacker.system.offensive.standard >= (2 * defensive))
            ? MGT2.FleetIon.longDuration : MGT2.FleetIon.duration;

        await this.#post(attacker, {
            rollTypeName: attacker.name,
            rollObjectName: localize("MGT2.Fleet.Ion.Title"),
            lines: result > 0
                ? [localize("MGT2.Fleet.Ion.Total", { effect, hull }),
                    localize("MGT2.Fleet.Ion.Result", { n: result, name: target.name }),
                    localize("MGT2.Fleet.Ion.Rounds", { n: rounds })]
                : [localize("MGT2.Fleet.Ion.Total", { effect, hull }),
                    localize("MGT2.Fleet.Ion.NoEffect")]
        });
        return { immune: false, effect, result, rounds };
    }

    /* -------------------------------------------- */

    /**
     * Take a fleet-combat damage figure off a contact, and answer how many critical thresholds it
     * crossed.
     *
     * **A ship's pool is not stored twice.** Folio 111's Adjusted Hull Points are the Actor's own
     * Hull points divided by the mean of 1D (§9.102), so damage dealt in fleet space is multiplied
     * back before it is written: one wound, on the sheet, where a repair crew will find it. The 10 %
     * ladder then answers identically over either pool, which is `SUSTAINED_FRACTION` and not a
     * second ladder (§9.100). A squadron is the exception — ten wings fly one fighter Actor, so its
     * pool is the Combatant's own (§9.95).
     *
     * @param {Combatant} combatant
     * @param {number} amount      In fleet points, already through the Effectiveness table
     */
    static async apply(combatant, amount) {
        if ( !this.#gate() ) return { damage: 0, crossings: 0 };
        const damage = Math.max(0, Math.round(Number(amount) || 0));
        if ( !damage ) return { damage: 0, crossings: 0 };

        if ( combatant.type === SQUADRON ) {
            const before = combatant.system.hull;
            await combatant.update({ system: { damage: combatant.system.damage + damage } });
            const after = combatant.system.hull;
            return { damage, crossings: 0, lost: after.lost - before.lost, strength: after.strength };
        }

        const actor = combatant.system.ship;
        if ( !actor ) return { damage: 0, crossings: 0 };
        // `raw`, because folio 118 already subtracted Armour in fleet space: letting the ordinary
        // damage path reduce it a second time would apply the undivided Protection to a divided pool.
        const result = await actor.system.applyDamage(Math.round(damage * FLEET_DIVISOR), { raw: true });
        return { damage, crossings: result?.crossings ?? 0, wound: result?.wound ?? 0 };
    }

    /**
     * Folio 119's critical hits: one per 10 % of the adjusted pool crossed, plus one more when the
     * attacker is offensively superior, less whatever the target's tonnage ignores.
     *
     * @param {object} options
     * @param {Combatant} options.attacker
     * @param {Combatant} options.target
     * @param {number} options.crossings   What `apply` answered
     * @param {object} options.weapon      A `fleetWeaponRow` — the mount decides what a big hull feels
     * @param {boolean} [options.roll]     Roll the locations and store them; off reports only
     */
    static async criticals({ attacker, target, crossings = 0, weapon, roll = true }) {
        // Folio 119: "add the Offensive DM to the Crew Skill score of the attacking ship and
        // subtract the Defensive DM of the target ship. If the total is four or higher, an
        // additional Critical Hit is scored."
        const superiority = (attacker?.system.offensive?.standard ?? 0)
            + (attacker?.system.crewSkill ?? 0)
            - (target?.system.defensiveAgainst?.(attacker?.system.fleetGroup) ?? 0);
        const extra = (superiority >= SUPERIORITY) ? 1 : 0;
        const wanted = Math.max(0, crossings) + extra;

        const tons = this.tonnage(target);
        const immunity = CRITICAL_IMMUNITY.find(step => tons > step.overTons);
        const felt = !immunity || immunity.mounts.includes(weapon?.mount);
        const count = felt ? wanted : 0;

        const hits = [];
        const actor = target?.system.ship;
        if ( roll && count && actor ) {
            for ( let i = 0; i < count; i++ ) hits.push(await this.#critical(actor));
        }
        return { superiority, extra, wanted, count, nullified: wanted - count, tons, hits };
    }

    /**
     * One critical. The location is folio 121's 2D table, which is Core folio 169's location for
     * location, so `MGT2.ShipCriticals` answers it unchanged. The severity is 1: folio 119's ladder
     * is Core folio 140's Sustained Damage over a different pool, and that rule deals Severity 1.
     *
     * **The Hull cell is HG's and not Core's**, and this is the one place the difference is
     * mechanical: folio 120 reads "Adjusted Hull Points incur ND% damage, round up" where Core folio
     * 170 reads a flat ND. The figure is reported and never applied — applying it would deal damage
     * that crosses more thresholds, and the chapter gives no rule for where that stops.
     */
    static async #critical(actor) {
        const roll = await foundry.dice.Roll.create("2d6").evaluate();
        const location = Object.entries(MGT2.ShipCriticals).find(([, entry]) =>
            (roll.total >= entry.roll[0]) && (roll.total <= entry.roll[1]))?.[0] ?? "hull";
        const applied = await actor.system.applyCritical(location, 1);
        const severity = applied?.severity ?? 1;
        return {
            roll: roll.total, location, severity,
            label: MGT2.ShipCriticals[location].label,
            hullPercent: (location === "hull")
                ? { formula: `${severity}d6`, of: actor.system.fleet?.hull ?? 0 } : null
        };
    }

    /* -------------------------------------------- */

    static #lines(target, factor, damage, options) {
        const lines = [];
        if ( damage.impervious ) {
            lines.push(localize("MGT2.Fleet.Attack.Impervious",
                { name: target.name, damage: damage.base, armour: damage.armour }));
        }
        if ( options?.ignoresArmour ) lines.push(localize("MGT2.Fleet.Attack.Meson"));
        lines.push(localize("MGT2.Fleet.Attack.Factor", {
            factor: MGT2Helper.signed(factor.total, "0"), multiple: factor.multiple }));
        lines.push(localize("MGT2.Fleet.Attack.Subtotal", { subtotal: damage.subtotal }));
        lines.push(localize("MGT2.Fleet.Attack.Final", { damage: damage.total, target: target.name }));
        return lines;
    }

    /** The chapter's own card: a reading with no dice in it, which is what folio 118 resolves to. */
    static async #post(attacker, card) {
        return getDocumentClass("ChatMessage").create({
            author: game.user.id,
            speaker: attacker.actor ? ChatMessage.getSpeaker({ actor: attacker.actor }) : null,
            content: await renderRollCard(card)
        });
    }
}
