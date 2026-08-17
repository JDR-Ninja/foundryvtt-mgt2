#!/usr/bin/env node
/**
 * Compendium packs are LevelDB directories, not files — `packs/<name>/` full of `.ldb`. Nothing
 * hand-edits that and a diff of it means nothing, so the readable JSON under `packs/_source/` is the
 * source of truth and this script is the only thing that writes the database.
 *
 *   node tools/packs.mjs compile  [name...] [--out DIR]  _source JSON  ->  LevelDB
 *   node tools/packs.mjs extract  [name...]              LevelDB       ->  _source JSON
 *   node tools/packs.mjs validate [name...]              every source document through its data model
 *   node tools/packs.mjs list     [name...]              what each compiled pack holds
 *   node tools/packs.mjs clean    [name...]              delete the compiled databases
 *
 * `compile` is what a bare clone, the CI and the release run: it needs nothing but this repository.
 * `packs/_source/` is committed and the compiled databases beside it are not — see `.gitignore`.
 *
 * A source file may hold one document or an array of them, and every `.json` under a pack's source
 * directory is read, so a generator can split its content however suits it.
 *
 * `--out DIR` writes the databases somewhere else. That is how a build is verified while Foundry
 * holds the live ones open: it locks every pack it has loaded, exclusively, for as long as it runs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { PACKS, PACK_BY_NAME } from "./packs.config.mjs";
import { flattenDocument, nestDocuments, COLLECTIONS } from "./lib/collections.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "packs", "_source");

const argv = process.argv.slice(2);
const flags = { force: argv.includes("--force"), out: readOption("--out") };
const names = argv.filter(argument => !argument.startsWith("--") && argument !== flags.out);
const command = names.shift() ?? "";
const packsDir = flags.out ? path.resolve(flags.out) : path.join(ROOT, "packs");

const selected = names.length ? names.map(name => {
    if ( !PACK_BY_NAME[name] ) fail(`Unknown pack "${name}".`, `The roster is: ${PACKS.map(p => p.name).join(", ")}.`);
    return PACK_BY_NAME[name];
}) : PACKS;

switch ( command ) {
    case "compile": {
        checkManifest();
        const failures = await validateAll();
        if ( failures && !flags.force ) {
            fail(`${failures} invalid documents — nothing compiled.`, "Re-run with --force to ignore.");
        }
        await compileAll();
        break;
    }
    case "extract": await extractAll(); break;
    case "validate": process.exit((await validateAll()) ? 1 : 0); break;
    case "list": checkManifest(); await list(); break;
    case "clean": clean(); break;
    default:
        console.error("Usage: node tools/packs.mjs compile|extract|validate|list|clean [pack...] [--out DIR]");
        process.exit(1);
}

/* -------------------------------------------- */
/*  The manifest                                */
/* -------------------------------------------- */

/**
 * The roster and `system.json` say the same thing, or the build stops. `tools/package.mjs` already
 * refuses to archive a declared pack with no database, which catches the same class of defect one
 * step later and only at release.
 */
function checkManifest() {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
    const declared = new Map((manifest.packs ?? []).map(pack => [pack.name, pack]));
    const problems = [];

    for ( const pack of PACKS ) {
        const entry = declared.get(pack.name);
        if ( !entry ) { problems.push(`${pack.name} — in the roster, not in system.json`); continue; }
        if ( entry.type !== pack.type ) problems.push(`${pack.name} — system.json says type ${entry.type}, the roster says ${pack.type}`);
        if ( entry.path !== `packs/${pack.name}` ) problems.push(`${pack.name} — system.json says path ${entry.path}`);
        if ( entry.label !== pack.i18n ) problems.push(`${pack.name} — system.json says label ${entry.label}, the roster says ${pack.i18n}`);
    }
    for ( const name of declared.keys() ) {
        if ( !PACK_BY_NAME[name] ) problems.push(`${name} — in system.json, not in the roster`);
    }

    if ( problems.length ) {
        fail("system.json and tools/packs.config.mjs disagree:", ...problems.map(problem => `  ${problem}`));
    }
}

/* -------------------------------------------- */
/*  Validating                                  */
/* -------------------------------------------- */

/**
 * Run every source document's `system` object through the system's real data model. Foundry reports a
 * bad one only as a console line at load, so the check happens here where it can name the file.
 *
 * It needs Foundry's `common/` on disk and is therefore a workspace convenience, not a build step: a
 * bare clone says so and carries on, exactly as the CI does.
 * @returns {Promise<number>}   How many documents failed.
 */
async function validateAll() {
    const packs = selected.filter(pack => ["Actor", "Item"].includes(pack.type));
    if ( !packs.length ) {
        console.log("  nothing to validate — no Actor or Item pack in the roster");
        return 0;
    }

    let validate;
    try {
        ({ validate } = await import("./lib/system.mjs"));
    } catch ( error ) {
        console.warn(`  validation skipped — the data models could not be loaded: ${error.message}`);
        return 0;
    }

    let failures = 0;
    for ( const pack of packs ) {
        const dir = path.join(SOURCE_DIR, pack.name);
        if ( !fs.existsSync(dir) ) continue;

        const reported = new Set();
        let checked = 0;
        for ( const file of walk(dir) ) {
            for ( const document of readFile(file) ) {
                if ( document._documentName === "Folder" ) continue;
                for ( const [name, documentName, type, source] of documentsOf(pack, document) ) {
                    checked++;
                    const result = validate(documentName, type, source);
                    if ( result.ok ) continue;
                    failures++;
                    const line = `${type}: ${result.error.split("\n").slice(0, 3).join(" | ")}`;
                    if ( reported.has(line) ) continue;
                    reported.add(line);
                    console.error(`  ✗ ${pack.name}/${path.basename(file)} — ${name}\n      ${line}`);
                }
            }
        }
        if ( checked ) console.log(`  ${pack.name.padEnd(14)} — ${checked} documents checked`);
    }
    return failures;
}

/** A document and each embedded Item it carries, as `[name, documentName, type, system]`. */
function* documentsOf(pack, document) {
    yield [document.name, pack.type, document.type, document.system ?? {}];
    for ( const embedded of document.items ?? [] ) {
        yield [`${document.name} › ${embedded.name}`, "Item", embedded.type, embedded.system ?? {}];
    }
}

/* -------------------------------------------- */
/*  Compiling                                   */
/* -------------------------------------------- */

async function compileAll() {
    let total = 0;
    for ( const pack of selected ) {
        const dir = path.join(SOURCE_DIR, pack.name);
        const documents = fs.existsSync(dir) ? readSource(dir) : [];
        if ( !documents.length ) {
            fail(`No source documents in packs/_source/${pack.name}.`, pack.generated
                ? `That pack is generated from ${pack.generated}: run its generator from the workspace.`
                : "They are committed — a checkout missing them is incomplete.");
        }
        const keys = await compile(pack, documents);
        total += documents.length;
        console.log(`  ${pack.name.padEnd(14)} — ${String(documents.length).padStart(5)} documents, ${keys} keys`);
    }
    console.log(`compiled ${total} documents into ${where(packsDir)}`);
}

/** Rebuild one pack from scratch: the database is destroyed first, so a removed document really goes. */
async function compile(pack, documents) {
    const location = path.join(packsDir, pack.name);
    // Foundry keeps every pack it has loaded open for as long as it runs, and Windows will not let the
    // directory go while it does. The bare EPERM is unreadable, so it is caught and named.
    try {
        fs.rmSync(location, { recursive: true, force: true });
    } catch ( error ) {
        if ( !["EPERM", "EBUSY"].includes(error.code) ) throw error;
        fail(`Cannot rewrite ${where(location)} — the database is locked.`,
            "Foundry holds its compendiums open while it runs. Quit Foundry and build again,",
            "or compile elsewhere with --out.");
    }
    fs.mkdirSync(location, { recursive: true });

    const db = new ClassicLevel(location, { keyEncoding: "utf8", valueEncoding: "json" });
    await db.open();
    const batch = db.batch();
    const seen = new Set();
    let keys = 0;

    for ( const document of documents ) {
        // Only a Folder differs from the pack's own type, and it says so rather than being guessed.
        const documentName = document._documentName ?? pack.type;
        delete document._documentName;
        for ( const [key, value] of flattenDocument(documentName, document) ) {
            if ( seen.has(key) ) throw new Error(`Duplicate key "${key}" in pack "${pack.name}" (${value.name})`);
            seen.add(key);
            batch.put(key, value);
            keys++;
        }
    }
    await batch.write();
    await db.close();
    return keys;
}

/* -------------------------------------------- */
/*  Extracting                                  */
/* -------------------------------------------- */

async function extractAll() {
    for ( const pack of selected ) {
        if ( pack.generated ) {
            console.log(`  ${pack.name.padEnd(14)} — generated from ${pack.generated}, not extracted`);
            continue;
        }
        const documents = await read(pack);
        if ( !documents ) continue;
        const dir = path.join(SOURCE_DIR, pack.name);
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${pack.name}.json`), `${JSON.stringify(documents, null, 2)}\n`);
        console.log(`  ${pack.name.padEnd(14)} — ${documents.length} documents extracted`);
    }
}

/** Every primary document of a compiled pack, children inlined, or null if it is not compiled. */
async function read(pack) {
    const location = path.join(packsDir, pack.name);
    if ( !fs.existsSync(location) ) {
        console.log(`  ${pack.name.padEnd(14)} — not compiled`);
        return null;
    }
    const db = new ClassicLevel(location, { keyEncoding: "utf8", valueEncoding: "json" });
    try {
        await db.open();
    } catch ( error ) {
        if ( !["EPERM", "EBUSY", "LEVEL_LOCKED"].includes(error.code) ) throw error;
        fail(`Cannot read ${where(location)} — the database is locked.`,
            "Foundry holds its compendiums open while it runs. Quit Foundry and try again.");
    }
    const entries = await db.iterator().all();
    await db.close();
    return nestDocuments(entries);
}

/* -------------------------------------------- */
/*  Listing and cleaning                        */
/* -------------------------------------------- */

async function list() {
    for ( const pack of selected ) {
        const documents = await read(pack);
        if ( !documents ) continue;
        const folders = documents.filter(document => document._documentName === "Folder").length;
        const source = fs.existsSync(path.join(SOURCE_DIR, pack.name))
            ? readSource(path.join(SOURCE_DIR, pack.name)).length : 0;
        console.log(`  ${pack.name.padEnd(14)} ${String(pack.type).padEnd(12)}`
            + ` ${String(documents.length - folders).padStart(5)} documents, ${folders} folders`
            + ` (${source} in source)`);
    }
}

function clean() {
    for ( const pack of selected ) {
        const location = path.join(packsDir, pack.name);
        if ( !fs.existsSync(location) ) continue;
        fs.rmSync(location, { recursive: true, force: true });
        console.log(`  removed ${where(location)}`);
    }
}

/** Repo-relative where that reads, absolute where `--out` has left the repository. */
function where(location) {
    const relative = path.relative(ROOT, location);
    return (!relative || relative.startsWith("..")) ? location : relative;
}

/* -------------------------------------------- */
/*  Reading                                     */
/* -------------------------------------------- */

/** Every `.json` under a pack's source directory, in a stable order, objects or arrays alike. */
function readSource(dir) {
    return walk(dir).flatMap(readFile);
}

function readFile(file) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [parsed];
}

function walk(dir) {
    const files = [];
    for ( const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)) ) {
        const full = path.join(dir, entry.name);
        if ( entry.isDirectory() ) files.push(...walk(full));
        else if ( entry.name.endsWith(".json") ) files.push(full);
    }
    return files;
}

function readOption(name) {
    const index = process.argv.indexOf(name);
    return (index > 0) ? process.argv[index + 1] : null;
}

function fail(...messages) {
    for ( const message of messages ) console.error(message);
    process.exit(1);
}
