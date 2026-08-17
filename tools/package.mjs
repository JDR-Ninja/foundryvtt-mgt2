#!/usr/bin/env node
/**
 * Builds the distributable archive — the one place that decides what ships.
 *
 *   node tools/package.mjs [out.zip]
 *
 * `INCLUDE` below *is* the package: everything else in the repo — `src/sass`, `web/`, `tools/`,
 * `packs/_source`, the workflows — is working material. The release workflow runs this script too,
 * so a tag and a local `npm run package` produce the same archive rather than two include lists
 * that drift.
 *
 * Compiled compendiums are not committed (see `.gitignore`); `npm run package` compiles them first.
 * A pack declared in `system.json` with nothing on disk fails the build here, because the failure it
 * replaces is a release that installs cleanly and shows an empty compendium.
 *
 * The archive is written by hand rather than shelled out to `zip`, which does not exist on Windows,
 * or to a dependency: 172 small files need a local header, a central directory and an EOCD record,
 * and nothing here approaches the zip64 limits.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const INCLUDE = [
    "system.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "src/module",
    "templates",
    "styles",
    "lang",
    "assets"
];

/** LevelDB writes these when it opens a database; they are not content. `NNNNNN.log` is. */
const LEVELDB_NOISE = new Set(["LOCK", "LOG", "LOG.old"]);

/** Fixed 1980-01-01, so the same tree always produces the same archive. */
const DOS_DATE = 0x0021;
const DOS_TIME = 0;

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for ( let i = 0; i < 256; i++ ) {
        let value = i;
        for ( let bit = 0; bit < 8; bit++ ) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        table[i] = value;
    }
    return table;
})();

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
const packs = (manifest.packs ?? []).map(pack => pack.path);
const files = [...INCLUDE, ...packs].flatMap(collect);
verify(files);

const archive = zip(files);
const out = path.join(ROOT, process.argv[2] ?? "mgt2.zip");
fs.writeFileSync(out, archive);

const raw = files.reduce((total, file) => total + file.data.length, 0);
console.log(`${manifest.id} ${manifest.version} — ${files.length} files, ${kb(raw)} → ${kb(archive.length)}`);
console.log(path.relative(ROOT, out));

/* -------------------------------------------- */
/*  Collecting                                  */
/* -------------------------------------------- */

/** Every file under one include entry, sorted, with paths as the archive stores them. */
function collect(entry) {
    const full = path.join(ROOT, entry);
    if ( !fs.existsSync(full) ) {
        fail(`${entry} is missing.`, entry.startsWith("packs/")
            ? "Compiled compendiums are not committed. Run `npm run compile` and package again."
            : "The include list at the top of this file names it: restore it, or drop it from the list.");
    }
    if ( fs.statSync(full).isFile() ) return [{ name: entry, data: fs.readFileSync(full) }];
    return fs.readdirSync(full).sort()
        .filter(name => !(entry.startsWith("packs/") && LEVELDB_NOISE.has(name)))
        .flatMap(name => collect(`${entry}/${name}`));
}

/**
 * Everything `system.json` promises is in the archive. The defect this catches is the one that put
 * it here: a manifest declaring a compendium the ZIP never carried, which Foundry reports only as an
 * empty pack at load, months after the release.
 */
function verify(files) {
    const shipped = new Set(files.map(file => file.name));
    const declared = [
        ...manifest.esmodules ?? [],
        ...(manifest.styles ?? []).map(style => style.src ?? style),
        ...(manifest.languages ?? []).map(language => language.path),
        // CURRENT is written by LevelDB itself: its presence is what tells a compiled pack from a
        // directory Foundry created empty at load.
        ...packs.map(pack => `${pack}/CURRENT`),
        ...manifest.background ? [manifest.background.replace(`systems/${manifest.id}/`, "")] : []
    ];
    const missing = declared.filter(name => !shipped.has(name));
    if ( missing.length ) {
        fail("system.json declares files the archive does not carry:", ...missing.map(name => `  ${name}`));
    }
}

function fail(...messages) {
    for ( const message of messages ) console.error(message);
    process.exit(1);
}

function kb(bytes) {
    return `${Math.round(bytes / 1024)} KB`;
}

/* -------------------------------------------- */
/*  Writing                                     */
/* -------------------------------------------- */

function crc32(buffer) {
    let crc = -1;
    for ( const byte of buffer ) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
}

/**
 * Sizes and CRC go in the local header, not in a trailing data descriptor, so the archive reads the
 * same whether the extractor streams it or seeks the central directory. Foundry streams it
 * (`unzipper`), and directory entries are omitted because it creates parents for every file itself.
 */
function zip(files) {
    const local = [];
    const central = [];
    let offset = 0;

    for ( const file of files ) {
        const name = Buffer.from(file.name, "utf8");
        const deflated = zlib.deflateRawSync(file.data, { level: 9 });
        const stored = deflated.length >= file.data.length;
        const body = stored ? file.data : deflated;
        const method = stored ? 0 : 8;
        const crc = crc32(file.data);

        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);                    // version needed
        header.writeUInt16LE(0x800, 6);                 // flags: UTF-8 names
        header.writeUInt16LE(method, 8);
        header.writeUInt16LE(DOS_TIME, 10);
        header.writeUInt16LE(DOS_DATE, 12);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(body.length, 18);
        header.writeUInt32LE(file.data.length, 22);
        header.writeUInt16LE(name.length, 26);
        local.push(header, name, body);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(0x0314, 4);                 // made by: UNIX, so the mode below is read
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x800, 8);
        entry.writeUInt16LE(method, 10);
        entry.writeUInt16LE(DOS_TIME, 12);
        entry.writeUInt16LE(DOS_DATE, 14);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(body.length, 20);
        entry.writeUInt32LE(file.data.length, 24);
        entry.writeUInt16LE(name.length, 28);
        entry.writeUInt32LE((0o100644 << 16) >>> 0, 38);  // regular file, rw-r--r--
        entry.writeUInt32LE(offset, 42);
        central.push(entry, name);

        offset += header.length + name.length + body.length;
    }

    const directory = central.reduce((total, chunk) => total + chunk.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(directory, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, ...central, end]);
}
