#!/usr/bin/env node
/**
 * The gate over a **hand-authored** compendium pack, and the only one of three a clone can run.
 *
 *   node tools/lint-packs.mjs [pack...]              every `authored` pack in the roster
 *   node tools/lint-packs.mjs --source DIR           a directory of JSON, roster or no roster
 *   node tools/lint-packs.mjs --selftest             the rules against their own fixtures
 *
 * Plain Node over the JSON and `system.json`, nothing else, so CI and a bare clone both run it. It
 * is deliberately the **cheap** gate and it carries the useful half of the work: the failures a
 * hand-written document actually hits are not schema violations. A `robot` with `manipulators: []`
 * is valid and yields STR 0 / DEX 0; a trait `Armour (+7)` whose `params[].num` is null is valid and
 * yields Protection 0; a `spacecraft` with `hull.base` above zero is valid and silently *adds* to
 * the derived points. They are failures of **presence and meaning over well-typed data**, and the
 * second gate buys the other, smaller half — it runs every document through its real data model,
 * which means loading Foundry's `common/` from an installed build, outside every repository, so it
 * cannot live here. The third is a read-only pass in a running Foundry, which is the only place a
 * *derived* value can be observed at all: a model instantiated in Node has no parent Document, so
 * `prepareDerivedData` cannot run.
 *
 * WHAT THIS REPLACES. Nothing here is a style preference. Every rule below stands in for a sheet
 * that would have filled the field in, or for a `_preCreate` that never runs for a packed document,
 * and each names the cliff it belongs to.
 *
 * THE COUPLING IS CHECKED, NOT ASSUMED. `CLIFFS` and `RULES` are two views of one list, so a cliff
 * with no rule is a cliff nobody checks. The script refuses to run if any entry has none — a demo
 * document that teaches a new cliff owes a rule in the same change, and this is what makes that a
 * property rather than a hope.
 *
 * AND THE RULES HAVE THEIR OWN FIXTURES. `--selftest` runs `fixtures/broken/` — one deliberate
 * defect per rule — and `fixtures/clean/`, which must stay silent. A rule that stops firing and a
 * rule that starts crying wolf are both regressions, and both are invisible until a rule list is
 * asked to prove itself — and while the roster carries no authored pack, the self-test is the only
 * thing exercising them at all, which is why CI runs it beside the gate itself.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACKS, PACK_BY_NAME } from "./packs.config.mjs";
import { readSourceFiles } from "./lib/source.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "packs", "_source");

/* -------------------------------------------- */
/*  The cliffs: what cannot be guessed         */
/* -------------------------------------------- */

const CLIFFS = [
    [1, "A ship's crew roster"],
    [2, "A ship's mounts"],
    [3, "Software points at its computer"],
    [4, "Active Effect phases"],
    [5, "Traits"],
    [6, "Skills are Items"],
    [7, "A species never writes `base`"],
    [8, "A career template"],
    [9, "A robot's manipulators"],
    [10, "`null` is not `0`"],
    [11, "A world's UWP"],
    [12, "Hull points are derived"],
    [13, "Two fuel fields"]
];

/**
 * The fields whose **emptiness is the lesson**: each carries a rule in the schema that a filled-in
 * value would hide. They are exempt from the demo packs' *fill everything in* rule, and the price of
 * the exemption is that the document says so — a `null` nobody explained is indistinguishable from
 * an oversight, and no gate can tell them apart. So the sentence is the mechanism, and this is where
 * it is enforced.
 */
const DELIBERATE = {
    vehicle: [
        ["system.armour.top", "top"],
        ["system.armour.bottom", "bottom"],
        ["system.systems.camouflage", "camouflage"],
        ["system.systems.stealth", "stealth"],
        ["system.submersible", "submersible"],
        ["system.remote", "remote"]
    ],
    spacecraft: [["system.characteristics.hull.base", "hull"]]
};

/** RH p.26's six, which a packed robot carries explicitly because `_preCreate` never runs. */
const ROBOT_TRAVELLER_KEYS = ["strength", "dexterity", "endurance", "intellect", "education", "social"];

/** `MGT2.TL`'s keys, which no `choices` list defends — see the `index-fields` rule. */
const TL_KEY = /^(TL\d{2}|NA|Unknow|NotIdentified)$/;

/**
 * `1D`, `D3`, `-1D`: the books' own die forms, which `new Roll` refuses with *"Unresolved
 * StringTerm"*. A demo document is invented, so it has no excuse to carry one. The lookahead
 * keeps ordinary prose out — `Demo — Deck Vest` has a `D` that no digit follows.
 */
const BOOK_DIE = /(?:^|[\s+\-*/(,])[+-]?\d*[dD](?!6)(?=\d|$|[\s+\-*/),])/;

/* -------------------------------------------- */
/*  The rules                                   */
/* -------------------------------------------- */

/**
 * A rule sees one subject: a primary document, or an Item embedded on one. `scope` says which —
 * `"primary"` for a rule about the packed document itself, `"any"` for one that must hold wherever
 * the data appears, since an embedded weapon carries traits exactly as a loose one does.
 */
const RULES = [
    {
        id: "crew-role-id", cliff: 1, scope: "primary", type: "spacecraft",
        check(subject, report) {
            const crew = subject.system?.crew ?? [];
            let resolved = 0;
            crew.forEach((row, index) => {
                if ( row?.role == null ) return;
                const item = subject.embedded.get(row.role);
                if ( !item ) report(`crew[${index}].role "${row.role}" is not the _id of anything embedded on this Actor`);
                else if ( item.type !== "role" ) report(`crew[${index}].role points at a "${item.type}" Item, not a role`);
                else resolved++;
            });
            if ( !resolved ) report("no crew row resolves to an embedded role Item — the roster is what this document exists to show");
        }
    },
    {
        id: "mount-weapon-ids", cliff: 2, scope: "primary", type: "spacecraft",
        check(subject, report) {
            const mounts = subject.system?.mounts ?? [];
            let armed = 0;
            mounts.forEach((mount, index) => {
                for ( const id of mount?.weapons ?? [] ) {
                    const item = subject.embedded.get(id);
                    if ( !item ) report(`mounts[${index}].weapons holds "${id}", which is not embedded on this Actor`);
                    else if ( item.type !== "weapon" ) report(`mounts[${index}].weapons points at a "${item.type}" Item, not a weapon`);
                    else armed++;
                }
            });
            if ( !armed ) report("no mount resolves to an embedded weapon Item — a mount carrying a label instead of a weapon is the defect this rule exists for: the ship scans as armed, and nothing can fire");
        }
    },
    {
        id: "software-computer-id", cliff: 3, scope: "any", type: "item",
        check(subject, report) {
            if ( subject.system?.subType !== "software" ) return;
            const id = subject.system?.software?.computerId ?? "";
            if ( !subject.parent ) {
                if ( id ) report(`software.computerId is set to "${id}" on a loose Item — there is no Actor for it to resolve against`);
                return;
            }
            if ( !id ) return report("software.computerId is blank on an embedded Item — the third id graph is the point of this document");
            const item = subject.parent.embedded.get(id);
            if ( !item ) report(`software.computerId "${id}" is not the _id of anything embedded on the same Actor`);
            else if ( item.type !== "computer" ) report(`software.computerId points at a "${item.type}" Item, not a computer`);
        }
    },
    {
        id: "effect-phase", cliff: 4, scope: "any",
        check(subject, report) {
            (subject.document.effects ?? []).forEach((effect, ei) => {
                (effect?.changes ?? []).forEach((change, ci) => {
                    if ( !change?.phase ) {
                        report(`effects[${ei}].changes[${ci}] carries no phase — core renders it as a hidden input, so a change aimed at a derived value looks broken instead of failing`);
                    }
                });
            });
        }
    },
    {
        id: "trait-num", cliff: 5, scope: "any",
        check(subject, report) {
            for ( const [field, entries] of traitArrays(subject.system) ) {
                entries.forEach((entry, index) => {
                    (entry?.params ?? []).forEach((param, pi) => {
                        const printed = Number.parseFloat(param?.value);
                        if ( !Number.isFinite(printed) ) return;
                        const where = `${field}[${index}] (${entry.key}) params[${pi}]`;
                        if ( param.num == null ) report(`${where} reads "${param.value}" and carries num: null — refreshTraitNumbers runs on sheet submit only, so the score is 0`);
                        else if ( param.num !== printed ) report(`${where} reads "${param.value}" but carries num: ${param.num}`);
                    });
                });
            }
        }
    },
    {
        id: "skills-are-items", cliff: 6, scope: "primary", kind: "Actor",
        check(subject, report) {
            if ( subject.system?.skills !== undefined ) report("system.skills does not exist on any Actor — a skill is a talent Item with subType \"skill\"");
            if ( subject.type !== "character" ) return;
            const skills = subject.items.filter(item => (item.type === "talent") && (item.system?.subType === "skill"));
            if ( !skills.length ) report("a character with no embedded talent/skill Item shows the one thing a referee cannot guess");
        }
    },
    {
        id: "species-feeds-auto", cliff: 7, scope: "primary", kind: "Actor",
        check(subject, report) {
            if ( !subject.items.some(item => item.type === "species") ) return;
            for ( const [key, value] of Object.entries(subject.system?.characteristics ?? {}) ) {
                if ( value?.auto !== undefined ) report(`characteristics.${key}.auto is written by hand on an Actor carrying a species Item — the species feeds .auto, and a value written beside it is added rather than replaced — so it grows on every re-run`);
            }
        }
    },
    {
        id: "species-rolls", cliff: 7, scope: "any", type: "species",
        check(subject, report) {
            if ( !size(subject.system?.characteristicRolls) ) report("characteristicRolls is empty — a species that rolls nothing feeds nothing");
            if ( subject.system?.characteristics !== undefined ) report("system.characteristics is not a field a species has — the rolls live in characteristicRolls[], and anything else is dropped with no message at all");
        }
    },
    {
        id: "career-complete", cliff: 8, scope: "any", type: "career",
        check(subject, report) {
            for ( const key of ["rankLadders", "assignments", "tables", "benefits", "eventTable"] ) {
                if ( !size(subject.system?.[key]) ) report(`${key} is empty — chargen cannot run against a career missing it`);
            }
        }
    },
    {
        id: "robot-manipulators", cliff: 9, scope: "primary", type: "robot",
        check(subject, report) {
            const manipulators = subject.system?.manipulators ?? [];
            if ( !manipulators.length ) return report("manipulators is empty — _preCreate writes the free pair and never runs for a packed document, so this robot is STR 0 / DEX 0");
            manipulators.forEach((limb, index) => {
                if ( !(limb?.count > 0) ) report(`manipulators[${index}].count is ${limb?.count} — a limb nobody has`);
            });
        }
    },
    {
        id: "deliberate-null-named", cliff: 10, scope: "primary",
        check(subject, report) {
            const trap = String(subject.document.flags?.mgt2?.demo?.trap ?? "");
            for ( const [pointer, leaf] of DELIBERATE[subject.type] ?? [] ) {
                const value = read(subject.document, pointer);
                const empty = (value === null) || (value === undefined) || ((pointer.endsWith("hull.base")) && (value === 0));
                if ( empty && !trap.includes(leaf) ) {
                    report(`${pointer} is empty and flags.mgt2.demo.trap never says so — a null nobody explained reads as an oversight`);
                }
            }
        }
    },
    {
        id: "uwp-integers", cliff: 11, scope: "primary", type: "world",
        check(subject, report) {
            const uwp = subject.system?.uwp ?? {};
            if ( typeof uwp.starport !== "string" ) report("uwp.starport is the one letter of the seven — the rest are integers");
            for ( const [key, value] of Object.entries(uwp) ) {
                if ( key === "starport" ) continue;
                if ( !Number.isInteger(value) ) report(`uwp.${key} is ${JSON.stringify(value)} — the cells are integers, not pseudo-hex characters`);
            }
        }
    },
    {
        id: "hull-base-zero", cliff: 12, scope: "primary", type: "spacecraft",
        check(subject, report) {
            const base = read(subject.document, "system.characteristics.hull.base");
            if ( (base !== undefined) && (base !== 0) ) {
                report(`characteristics.hull.base is ${base} — on a spacecraft it ADDS to the derived points. Contrast a vehicle, where it is the printed figure`);
            }
        }
    },
    {
        id: "two-fuel-fields", cliff: 13, scope: "primary", type: "spacecraft",
        check(subject, report) {
            if ( typeof read(subject.document, "system.fuel.tons") !== "number" ) report("fuel.tons is unset — the design tank");
            if ( typeof read(subject.document, "system.ops.fuel") !== "number" ) report("ops.fuel is unset — the real level, which nothing derives from the tank");
        }
    },

    /* ---- the pack's own hygiene: marking, presets and the two indexed fields ---- */

    {
        id: "demo-name", cliff: null, scope: "primary",
        check(subject, report) {
            if ( !String(subject.document.name ?? "").startsWith("Demo — ") ) {
                report("a demo document is named `Demo — …` so nothing here is ever mistaken for published content");
            }
        }
    },
    {
        id: "demo-flag", cliff: null, scope: "primary",
        check(subject, report) {
            const demo = subject.document.flags?.mgt2?.demo;
            if ( !demo ) return report("flags.mgt2.demo is missing — the guide's demo chapter is assembled from it, one row per document");
            if ( !Number.isInteger(demo.order) ) report("flags.mgt2.demo.order must be an integer");
            if ( !String(demo.trap ?? "").trim() ) report("flags.mgt2.demo.trap is blank — it is what tells a deliberate empty field from an oversight");
            if ( !size(demo.teaches) ) report("flags.mgt2.demo.teaches is empty");
            for ( const sentence of demo.teaches ?? [] ) {
                if ( typeof sentence !== "string" ) report("flags.mgt2.demo.teaches holds short English sentences");
            }
        }
    },
    {
        id: "core-icon", cliff: null, scope: "any",
        check(subject, report) {
            const img = subject.document.img;
            if ( img && !String(img).startsWith("icons/svg/") ) {
                report(`img "${img}" — the system ships four space backgrounds and one screen image, so a demo document uses core icons only`);
            }
        }
    },
    {
        id: "actor-link", cliff: null, scope: "primary", kind: "Actor",
        check(subject, report) {
            if ( typeof subject.document.prototypeToken?.actorLink !== "boolean" ) {
                report("prototypeToken.actorLink is unset — six _preCreate methods write it and none of them runs for a packed document");
            }
        }
    },
    {
        id: "npc-presets", cliff: null, scope: "primary", type: "npc",
        check(subject, report) {
            if ( !size(subject.system?.config?.damageOrder) ) report("config.damageOrder is empty — the four damage states go quiet");
            if ( !subject.system?.config?.initiative ) report("config.initiative is unset");
            if ( (subject.system?.subType === "creature") && !(read(subject.document, "system.characteristics.hits.base") > 0) ) {
                report("a creature needs characteristics.hits.base above 0 as well as \"hits\" in damageOrder");
            }
            for ( const [key, value] of Object.entries(subject.system?.characteristics ?? {}) ) {
                if ( typeof value?.show !== "boolean" ) report(`characteristics.${key}.show is unset — the preset writes all of them`);
            }
        }
    },
    {
        id: "robot-show", cliff: null, scope: "primary", type: "robot",
        check(subject, report) {
            for ( const key of ROBOT_TRAVELLER_KEYS ) {
                if ( typeof subject.system?.characteristics?.[key]?.show !== "boolean" ) {
                    report(`characteristics.${key}.show is unset — the six are declared on every robot`);
                }
            }
        }
    },
    {
        id: "die-form", cliff: null, scope: "any",
        check(subject, report) {
            for ( const [pointer, value] of strings(subject.document) ) {
                if ( BOOK_DIE.test(value) ) report(`${pointer} reads "${value}" — the books' die form. new Roll throws "Unresolved StringTerm" on 1D, D3 and -1D`);
            }
        }
    },
    {
        id: "index-fields", cliff: null, scope: "any",
        check(subject, report) {
            for ( const key of ["tl", "subType"] ) {
                if ( !(key in (subject.system ?? {})) ) continue;
                const value = subject.system[key];
                if ( (value === null) || (value === "") || (value === undefined) ) {
                    report(`system.${key} is blank — it is one of the two compendiumIndexFields this system declares, so the explorer cannot see this document at all`);
                }
            }
            // `tl` is a NumberField on a component and on every Actor, and a StringField over
            // MGT2.TL's own keys everywhere else — with NO `choices`, so `12` is quietly cleaned to
            // the string "12" and stored. `MGT2CompendiumExplorer.tlLabel` then falls through to the
            // raw string (`compendium-explorer.js:144`), so the row reads `12` beside every other
            // document's `TL12` — different value, different filter, no error anywhere. The schema
            // gate cannot see it either: nothing was refused and nothing was dropped.
            const tl = subject.system?.tl;
            if ( (typeof tl === "string") && !TL_KEY.test(tl) ) {
                report(`system.tl reads ${JSON.stringify(tl)} — the vocabulary is TL00…TL15, NA, Unknow and NotIdentified, and nothing enforces it but this rule`);
            }
        }
    }
];

/* -------------------------------------------- */
/*  The coupling, checked                       */
/* -------------------------------------------- */

const uncovered = CLIFFS.filter(([n]) => !RULES.some(rule => rule.cliff === n));
if ( uncovered.length ) {
    fail("A cliff above has no rule here, and a cliff with no rule is a cliff nobody checks:",
        ...uncovered.map(([n, title]) => `  ${n}. ${title}`));
}

/* -------------------------------------------- */
/*  Running                                     */
/* -------------------------------------------- */

const argv = process.argv.slice(2);
const source = readOption("--source");
const names = argv.filter(argument => !argument.startsWith("--") && argument !== source);

const TYPE_CLASS = readTypeClasses();
let documents = 0;
let problems = 0;

if ( argv.includes("--selftest") ) {
    selftest();
} else if ( source ) {
    lintDirectory(path.resolve(source), path.basename(source));
} else {
    const selected = (names.length ? names.map(pick) : PACKS).filter(pack => pack.authored);
    if ( !selected.length ) {
        console.log("nothing to lint — no authored pack in the roster (tools/packs.config.mjs).");
        console.log("No pack declares `authored: true`, so this gate has no subject yet.");
        process.exit(0);
    }
    for ( const pack of selected ) {
        const dir = path.join(SOURCE_DIR, pack.name);
        if ( !fs.existsSync(dir) ) fail(`${pack.name} is authored but packs/_source/${pack.name} does not exist.`);
        lintDirectory(dir, pack.name);
    }
}

console.log(`${documents} documents, ${RULES.length} rules over ${CLIFFS.length} cliffs, ${problems} problems`);
if ( problems ) process.exit(1);

/**
 * The rules against their own fixtures: every cliff must fire on `broken/`, and `clean/` must be
 * silent. Quiet output on success — a self-test that prints a wall of text on a green run is one
 * nobody reads on a red one.
 */
function selftest() {
    const broken = path.join(ROOT, "tools", "fixtures", "broken");
    const clean = path.join(ROOT, "tools", "fixtures", "clean");
    const fired = new Set();
    const problemsBefore = [];

    silence(() => lintDirectory(broken, "broken", rule => fired.add(rule.cliff)));
    const brokenProblems = problems;
    const missing = CLIFFS.filter(([n]) => !fired.has(n));

    problems = 0;
    silence(() => lintDirectory(clean, "clean", () => {}, problemsBefore));
    const noisy = problems;

    if ( missing.length ) {
        fail("These cliffs have a rule that did not fire on tools/fixtures/broken:",
            ...missing.map(([n, title]) => `  ${n}. ${title}`),
            "Either the fixture no longer carries the defect, or the rule stopped seeing it.");
    }
    if ( noisy ) fail(`tools/fixtures/clean is correct and drew ${noisy} problems.`, ...problemsBefore);
    console.log(`selftest ok — ${CLIFFS.length} cliffs all fire on the broken fixtures (${brokenProblems} problems), the clean ones draw none`);
    process.exit(0);
}

/** Runs a lint pass with its report captured rather than printed. */
function silence(run) {
    const write = console.error;
    console.error = () => {};
    try { run(); } finally { console.error = write; }
}

function lintDirectory(dir, label, onProblem = () => {}, collect = null) {
    for ( const { file, documents: batch } of readSourceFiles(dir) ) {
        for ( const document of batch ) {
            documents++;
            for ( const subject of subjectsOf(document, label) ) {
                // Collected before anything is printed, so one subject's problems arrive under one
                // heading: a gate is read by whoever has to fix it, and twenty repetitions of the
                // same path is a report nobody scans.
                const found = [];
                for ( const rule of RULES ) {
                    if ( !applies(rule, subject) ) continue;
                    rule.check(subject, message => {
                        found.push(`  [${rule.id}${rule.cliff ? `, cliff ${rule.cliff}` : ""}] ${message}`);
                        onProblem(rule);
                    });
                }
                if ( !found.length ) continue;
                problems += found.length;
                console.error(`${where(file)}  ${subject.label}`);
                for ( const line of found ) console.error(line);
                if ( collect ) collect.push(`  ${subject.label}${found[0]}`);
            }
        }
    }
}

/** Repo-relative where that reads, absolute where `--source` has left the repository. */
function where(file) {
    const relative = path.relative(ROOT, file);
    return (!relative || relative.startsWith("..")) ? file : relative;
}

/** The packed document, then every Item embedded on it — one subject each. */
function subjectsOf(document, pack) {
    const kind = TYPE_CLASS[document.type];
    if ( !kind ) fail(`${pack}: document "${document.name}" has type "${document.type}", which system.json declares for no document class.`);
    const items = (kind === "Actor") ? (document.items ?? []) : [];
    const primary = {
        document, pack, kind, type: document.type, system: document.system ?? {},
        items, embedded: new Map(items.map(item => [item._id, item])),
        parent: null, scope: "primary", label: `${document.name} (${document.type})`
    };
    return [primary, ...items.map(item => ({
        document: item, pack, kind: "Item", type: item.type, system: item.system ?? {},
        items: [], embedded: new Map(), parent: primary, scope: "embedded",
        label: `${document.name} › ${item.name} (${item.type})`
    }))];
}

function applies(rule, subject) {
    if ( (rule.scope === "primary") && (subject.scope !== "primary") ) return false;
    if ( rule.type && (rule.type !== subject.type) ) return false;
    if ( rule.kind && (rule.kind !== subject.kind) ) return false;
    return true;
}

/* -------------------------------------------- */
/*  Reading the shapes                          */
/* -------------------------------------------- */

/** Which document class declares each type, read from the manifest rather than assumed. */
function readTypeClasses() {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
    const map = {};
    for ( const [documentName, types] of Object.entries(manifest.documentTypes ?? {}) ) {
        for ( const type of Object.keys(types) ) map[type] ??= documentName;
    }
    return map;
}

/** Every `{family, key, params}` array on a `system` object, by the field that holds it. */
function traitArrays(system) {
    const found = [];
    for ( const [key, value] of Object.entries(system ?? {}) ) {
        if ( !Array.isArray(value) || !value.length ) continue;
        if ( value.every(entry => entry && (typeof entry === "object") && ("family" in entry) && ("key" in entry)) ) found.push([key, value]);
    }
    return found;
}

/** Every string in a document, with the pointer that reaches it. */
function strings(value, pointer = "", found = []) {
    if ( typeof value === "string" ) found.push([pointer, value]);
    else if ( Array.isArray(value) ) value.forEach((entry, index) => strings(entry, `${pointer}[${index}]`, found));
    else if ( value && (typeof value === "object") ) {
        for ( const [key, entry] of Object.entries(value) ) strings(entry, pointer ? `${pointer}.${key}` : key, found);
    }
    return found;
}

function read(object, pointer) {
    return pointer.split(".").reduce((value, key) => (value == null) ? undefined : value[key], object);
}

function size(value) {
    if ( Array.isArray(value) ) return value.length;
    if ( value && (typeof value === "object") ) return Object.keys(value).length;
    return 0;
}

function pick(name) {
    if ( !PACK_BY_NAME[name] ) fail(`Unknown pack "${name}".`, `The roster is: ${PACKS.map(p => p.name).join(", ")}.`);
    return PACK_BY_NAME[name];
}

function readOption(name) {
    const index = argv.indexOf(name);
    return (index >= 0) ? argv[index + 1] : null;
}

function fail(...messages) {
    for ( const message of messages ) console.error(message);
    process.exit(1);
}
