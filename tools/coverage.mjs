#!/usr/bin/env node
/**
 * Builds the system's `docs` compendium from `docs/RULES-AUDIT.md` — **one JournalEntry per
 * language**, each with one page per audited screen, all in the same pack.
 *
 *   node tools/coverage.mjs check    parse and verify the contract; write nothing
 *   node tools/coverage.mjs build    check, then write packs/_source
 *
 * The audit lives in the workspace and never ships, so only this tool needs it — and it stops at the
 * source. `tools/packs.mjs compile` turns `packs/_source/`, which is committed, into the LevelDB, and
 * is therefore what a bare clone, the CI and the release run. The database is derived and is not
 * committed — see `.gitignore`.
 *
 * LANGUAGES, and why not Babele. Babele translates documents at load time from a module, which means
 * a dependency, a second document identity to keep aligned, and nothing in the pack a reader can open
 * directly. Here every language is a real JournalEntry carrying `flags.mgt2.lang`, so the pack is
 * browsable in any language with no module installed and nothing to reconcile at runtime.
 *
 * English is the audit itself and needs no file. Every other language is one overlay in
 * `docs/rules-audit-lang/<code>.json`, and **the files present are the journals built** — adding a
 * language is adding a file. An overlay may translate any of: `chrome` (the strings this generator
 * owns), `screens`, `entries`, `states`, `correct` (all keyed by the English original), plus `verdict`
 * as an array of paragraphs and `severity` as `{A, B, C, D}`. Anything missing falls back to English
 * and **is counted**: every run prints per-language coverage, and orphaned keys — translations whose
 * English original has left the audit — so a rewritten audit shows up as a number rather than as a
 * silently half-English page.
 *
 * THE CONTRACT, which is deliberately four things and no more. The audit is a working document and
 * is expected to be rewritten often; everything the generator does not read here, it ignores, and it
 * reports how much it ignored so that drift is visible rather than silent.
 *
 *   1. `## <n>. <Screen>`                    one page
 *   2. `### | #### <A|B|C|D> — <title>`      one row on that page; `~~struck~~` means settled, and
 *                                            the state is whatever follows the title
 *   3. `### Correct on this screen`          the bullet list under it, passed through
 *   4. `## Verdict` and `## Severity`        the opening page
 *
 * Nothing is hand-copied: the per-screen and per-severity counts are computed here and checked
 * against the audit's own `## Index` table, so a stale index fails the build rather than shipping.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACK_BY_NAME } from "./packs.config.mjs";
import { stableId } from "./lib/ids.mjs";

const SYSTEM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = path.resolve(SYSTEM, "..");
const AUDIT = path.join(WORKSPACE, "docs", "RULES-AUDIT.md");
const LANG_DIR = path.join(WORKSPACE, "docs", "rules-audit-lang");
const PACK = PACK_BY_NAME.docs;
const SOURCE_DIR = path.join(SYSTEM, "packs", "_source", PACK.name);

/** The id namespace, frozen: renaming the pack must not change what its documents are. */
const ID_SPACE = "docs";

/** Everything the generator says itself, as opposed to what it lifts out of the audit. */
const CHROME = {
    journal: "What this system does with the rules",
    intro: "Generated from the system's own rules audit. It records what each screen does with the"
        + " printed rules and where it has diverged — it is not a checklist of the rulebook.",
    howToRead: "How to read this",
    severity: "Severity",
    byScreen: "By screen",
    correct: "What this screen gets right",
    audited: "Audited",
    colScreen: "Screen",
    colOpen: "Open",
    colSettled: "Settled",
    colWhat: "What",
    colState: "State",
    colPages: "Pages",
    colMeaning: "Meaning",
    totals: "{entries} entries over {screens} screens; {open} open.",
    empty: "Nothing recorded for this screen.",
    untranslated: "This page is in English: the audit it is generated from has not been translated"
        + " into this language yet."
};

const SEVERITIES = ["A", "B", "C", "D"];

const command = process.argv[2] ?? "build";
if ( !["check", "build"].includes(command) ) {
    console.error("Usage: node tools/coverage.mjs check|build");
    process.exit(1);
}

const parsed = parse(read());
report(parsed);
verify(parsed);

const languages = readLanguages();
const journals = languages.map(language => buildJournal(parsed, language));
reportLanguages(languages);
if ( command === "build" ) writeSource(journals);

/* -------------------------------------------- */
/*  Reading                                     */
/* -------------------------------------------- */

function read() {
    if ( !fs.existsSync(AUDIT) ) {
        fail(`Cannot find ${AUDIT}.`,
            "The audit lives in the workspace, not in the system repo. A bare clone cannot run `build`,",
            "and does not need to: `pack` compiles the same database from the committed packs/_source.");
    }
    return fs.readFileSync(AUDIT, "utf8");
}

/**
 * Split the audit into the four things the contract names, and count everything else as ignored.
 * A block is a run of lines between two headings.
 */
function parse(markdown) {
    const lines = markdown.split(/\r?\n/);
    const screens = [];
    const meta = { verdict: [], severity: [], index: [] };

    let section = null;      // "verdict" | "severity" | "index" | null
    let screen = null;
    let entry = null;
    let correct = null;      // collecting the "Correct on this screen" bullets
    let ignored = 0;

    for ( const line of lines ) {
        const heading = /^(#{2,4})\s+(.*)$/.exec(line);
        if ( heading ) {
            const [, hashes, text] = heading;
            const level = hashes.length;
            correct = null;

            if ( level === 2 ) {
                const numbered = /^(\d+)\.\s+(.+)$/.exec(text);
                if ( numbered ) {
                    screen = { number: Number(numbered[1]), name: strip(numbered[2]), entries: [], correct: [] };
                    screens.push(screen);
                    section = null;
                    entry = null;
                    continue;
                }
                screen = null;
                entry = null;
                section = /^verdict$/i.test(text) ? "verdict"
                    : /^severity$/i.test(text) ? "severity"
                    : /^index$/i.test(text) ? "index" : null;
                continue;
            }

            if ( /^correct on this screen$/i.test(text) ) {
                correct = screen;
                entry = null;
                continue;
            }

            const row = /^([A-Z])\s+—\s+(.*)$/.exec(text);
            if ( row && screen ) {
                if ( !SEVERITIES.includes(row[1]) ) {
                    fail(`Unknown severity "${row[1]}" in "${text}".`,
                        `The contract knows ${SEVERITIES.join("/")}. Add it to SEVERITIES here, or fix the heading.`);
                }
                entry = { severity: row[1], ...title(row[2]), citations: [] };
                screen.entries.push(entry);
                continue;
            }

            entry = null;
            continue;      // a sub-heading the contract does not read, e.g. `### 4.2 Skills panel`
        }

        // A blank line ends a paragraph, so the prose sections keep theirs; nothing else needs them.
        if ( !line.trim() ) {
            if ( section ) meta[section].push("");
            continue;
        }

        if ( correct && line.startsWith("- ") ) { correct.correct.push(line.slice(2)); continue; }
        if ( correct && /^\s+\S/.test(line) ) {
            correct.correct[correct.correct.length - 1] += ` ${line.trim()}`;
            continue;
        }
        if ( section === "verdict" ) { meta.verdict.push(line); continue; }
        if ( section === "severity" ) { meta.severity.push(line); continue; }
        if ( section === "index" ) { meta.index.push(line); continue; }
        if ( entry ) { entry.citations.push(...citations(line)); continue; }
        ignored++;
    }

    for ( const s of screens ) for ( const e of s.entries ) e.citations = [...new Set(e.citations)];
    return { screens, ...meta, ignored, index: indexTable(meta.index) };
}

/**
 * An entry's title carries its own state: struck through when settled, with the outcome after it.
 * `~~the 100-metre rule is off by default~~ ✅ built` → settled, "✅ built".
 */
function title(text) {
    const struck = /^~~(.+?)~~\s*(.*)$/.exec(text);
    if ( struck ) return { title: strip(struck[1]), state: strip(struck[2]) || "settled", open: false };
    return { title: strip(text), state: "open", open: true };
}

/** Book references, in either bracket or parenthesis form. `[Core p.78]`, `(HG p.30)`, `Core folio 79`. */
function citations(line) {
    const found = [];
    for ( const match of line.matchAll(/[[(]([^[\]()]*(?:p\.\s?\d|folio\s?\d)[^[\]()]*)[\])]/g) ) {
        found.push(strip(match[1]).replace(/\s+/g, " "));
    }
    return found;
}

/** The audit's own index table, as `{screen, open, settled}` — the figures this build checks against. */
function indexTable(lines) {
    const rows = [];
    for ( const line of lines ) {
        const cells = line.split("|").slice(1, -1).map(cell => strip(cell.trim()));
        if ( cells.length < 6 ) continue;
        if ( /^-+$/.test(cells[0]) || /^screen$/i.test(cells[0]) ) continue;
        const counts = cells.slice(1, 5).map(cell => (cell === "—" || cell === "") ? 0 : Number(cell));
        if ( counts.some(Number.isNaN) ) continue;
        rows.push({
            screen: cells[0].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
            open: counts.reduce((a, b) => a + b, 0),
            settled: Number(cells[5]) || 0
        });
    }
    return rows;
}

/* -------------------------------------------- */
/*  Checking                                    */
/* -------------------------------------------- */

function report({ screens, ignored, index }) {
    const entries = screens.reduce((n, s) => n + s.entries.length, 0);
    const open = screens.reduce((n, s) => n + s.entries.filter(e => e.open).length, 0);
    console.log(`${screens.length} screens · ${entries} entries (${open} open, ${entries - open} settled)`);
    console.log(`${index.length} index rows · ${ignored} source lines outside the contract`);
}

/**
 * The build fails rather than ships a journal that disagrees with its source. Two things are checked:
 * that there is anything at all to ship, and that the audit's hand-written index matches the entries
 * underneath it — which is the whole reason the table is generated instead of written.
 */
function verify({ screens, index }) {
    if ( !screens.length ) {
        fail("No `## <n>. <Screen>` heading found.",
            "Either the audit was restructured or the file is wrong. The contract is at the top of this tool.");
    }

    const problems = [];
    for ( const screen of screens ) {
        const row = index.find(r => matches(r.screen, screen.name));
        if ( !row ) { problems.push(`§${screen.number} ${screen.name} — no row in the index table`); continue; }
        const open = screen.entries.filter(e => e.open).length;
        const settled = screen.entries.length - open;
        if ( row.open !== open ) problems.push(`§${screen.number} ${screen.name} — index says ${row.open} open, the entries say ${open}`);
        if ( row.settled !== settled ) problems.push(`§${screen.number} ${screen.name} — index says ${row.settled} settled, the entries say ${settled}`);
    }
    for ( const row of index ) {
        if ( !screens.some(s => matches(row.screen, s.name)) ) problems.push(`index row "${row.screen}" — no screen section`);
    }

    if ( problems.length ) {
        fail(`The audit's index disagrees with its own entries, ${problems.length} times:`,
            problems.map(p => `  ${p}`).join("\n"),
            "Fix the index in docs/RULES-AUDIT.md. Nothing is copied from it — it is checked against.");
    }
}

/**
 * Translation coverage, per language, printed every run. A miss is not an error — English is a
 * correct fallback — but an unreported miss is how a half-translated journal ships without anyone
 * noticing. Orphans are the other direction: the audit moved and the overlay still answers the old
 * question.
 */
function reportLanguages(languages) {
    for ( const language of languages ) {
        if ( language.code === "en" ) { console.log(`  en    — the audit itself`); continue; }
        const total = language.hits + language.misses.length;
        const percent = total ? Math.round((language.hits / total) * 100) : 0;
        const orphans = language.orphans.length ? `, ${language.orphans.length} orphaned` : "";
        console.log(`  ${language.code.padEnd(5)} — ${language.hits}/${total} translated (${percent}%)${orphans}`);
        for ( const orphan of language.orphans.slice(0, 5) ) console.log(`          orphan  ${orphan}`);
    }
}

/** Index rows carry a markdown link; screen headings do not. Compare on the visible words. */
function matches(a, b) {
    const clean = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return clean(a) === clean(b);
}

function fail(...messages) {
    for ( const message of messages ) console.error(message);
    process.exit(1);
}

/* -------------------------------------------- */
/*  Building                                    */
/* -------------------------------------------- */

/**
 * English is the audit itself and needs no file. Every other language is one overlay under
 * `docs/rules-audit-lang/`, and the set of files *is* the set of journals — adding a language is
 * adding a file, and no list anywhere has to be kept in step with it.
 */
function readLanguages() {
    const languages = [{ code: "en", label: "English", overlay: {}, hits: 0, misses: [], orphans: [] }];
    if ( !fs.existsSync(LANG_DIR) ) return languages;
    for ( const file of fs.readdirSync(LANG_DIR).filter(name => name.endsWith(".json")).sort() ) {
        const code = path.basename(file, ".json");
        const overlay = JSON.parse(fs.readFileSync(path.join(LANG_DIR, file), "utf8"));
        languages.push({ code, label: overlay.label ?? code, overlay, hits: 0, misses: [], orphans: [] });
    }
    return languages;
}

/**
 * One lookup for every translatable string, so that coverage is counted rather than guessed at. A
 * miss falls back to English and is recorded; English itself is never counted, having nothing to miss.
 */
function say(language, section, key) {
    if ( language.code === "en" ) return key;
    const value = language.overlay[section]?.[key];
    if ( value === undefined ) {
        language.misses.push(`${section}: ${key}`);
        return key;
    }
    language.hits++;
    return value;
}

function chrome(language, key) {
    return language.code === "en" ? CHROME[key] : (language.overlay.chrome?.[key] ?? CHROME[key]);
}

function buildJournal(parsed, language) {
    const pages = [intro(parsed, language)];
    for ( const screen of parsed.screens ) pages.push(screenPage(screen, language));
    countOrphans(parsed, language);
    return {
        _id: stableId(ID_SPACE, `journal:coverage:${language.code}`),
        name: chrome(language, "journal"),
        pages: pages.map((page, sort) => ({ ...page, sort: (sort + 1) * 100 })),
        folder: null,
        flags: { mgt2: { generated: "docs/RULES-AUDIT.md", lang: language.code } }
    };
}

function intro({ screens, verdict, severity }, language) {
    const entries = screens.reduce((n, s) => n + s.entries.length, 0);
    const open = screens.reduce((n, s) => n + s.entries.filter(e => e.open).length, 0);
    const rows = screens.map(s => {
        const screenOpen = s.entries.filter(e => e.open).length;
        return `<tr><td>${html(say(language, "screens", s.name))}</td>`
            + `<td>${screenOpen || "—"}</td><td>${s.entries.length - screenOpen}</td></tr>`;
    });
    const content = [
        `<p><em>${html(chrome(language, "intro"))}</em></p>`,
        ...prose(verdict, language),
        `<h2>${html(chrome(language, "severity"))}</h2>`,
        ...severityBlock(severity, language),
        `<h2>${html(chrome(language, "byScreen"))}</h2>`,
        table([chrome(language, "colScreen"), chrome(language, "colOpen"), chrome(language, "colSettled")].map(html), rows),
        `<p>${html(chrome(language, "totals"))
            .replace("{entries}", entries).replace("{screens}", screens.length).replace("{open}", open)}</p>`
    ].join("\n");
    return page(chrome(language, "howToRead"), content, language);
}

/** The verdict is the audit's own prose: an overlay replaces it whole, or it stays English. */
function prose(lines, language) {
    const replacement = language.overlay.verdict;
    if ( !replacement ) {
        if ( language.code !== "en" ) return [`<p><em>${html(chrome(language, "untranslated"))}</em></p>`, ...blocks(lines)];
        return blocks(lines);
    }
    language.hits++;
    return replacement.map(paragraph => `<p>${inline(paragraph)}</p>`);
}

/** The severity legend is four short definitions, which an overlay gives as `{A, B, C, D}`. */
function severityBlock(lines, language) {
    const replacement = language.overlay.severity;
    if ( !replacement ) return blocks(lines);
    language.hits++;
    const rows = SEVERITIES.filter(key => replacement[key])
        .map(key => `<tr><td><strong>${key}</strong></td><td>${inline(replacement[key])}</td></tr>`);
    return [table(["", chrome(language, "colMeaning")].map(html), rows)];
}

function screenPage(screen, language) {
    const parts = [];
    if ( screen.correct.length ) {
        parts.push(`<h2>${html(chrome(language, "correct"))}</h2>`);
        parts.push(`<ul>${screen.correct.map(item => `<li>${inline(say(language, "correct", item))}</li>`).join("")}</ul>`);
    }
    if ( screen.entries.length ) {
        parts.push(`<h2>${html(chrome(language, "audited"))}</h2>`);
        const headers = ["", chrome(language, "colWhat"), chrome(language, "colState"), chrome(language, "colPages")];
        parts.push(table(headers.map(html), screen.entries.map(entry => [
            "<tr>",
            `<td>${entry.severity}</td>`,
            `<td>${inline(say(language, "entries", entry.title))}</td>`,
            `<td>${inline(say(language, "states", entry.state))}</td>`,
            `<td>${entry.citations.map(inline).join("; ") || "—"}</td>`,
            "</tr>"
        ].join(""))));
    }
    if ( !parts.length ) parts.push(`<p><em>${html(chrome(language, "empty"))}</em></p>`);
    return page(`${screen.number}. ${say(language, "screens", screen.name)}`, parts.join("\n"), language);
}

/** A translation whose English source has gone: the audit moved and the overlay did not follow. */
function countOrphans({ screens }, language) {
    if ( language.code === "en" ) return;
    const live = {
        screens: new Set(screens.map(s => s.name)),
        entries: new Set(screens.flatMap(s => s.entries.map(e => e.title))),
        states: new Set(screens.flatMap(s => s.entries.map(e => e.state))),
        correct: new Set(screens.flatMap(s => s.correct))
    };
    for ( const [section, keys] of Object.entries(live) ) {
        for ( const key of Object.keys(language.overlay[section] ?? {}) ) {
            if ( !keys.has(key) ) language.orphans.push(`${section}: ${key}`);
        }
    }
}

function page(name, content, language) {
    return {
        _id: stableId(ID_SPACE, `page:${language.code}:${name}`),
        name,
        type: "text",
        title: { show: true, level: 1 },
        text: { format: 1, content },
        ownership: { default: -2 }
    };
}

function table(headers, rows) {
    return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>`
        + `<tbody>${rows.join("")}</tbody></table>`;
}

/** Paragraphs and markdown tables. The audit uses nothing else in the two sections read here. */
function blocks(lines) {
    const out = [];
    let paragraph = [];
    let rows = [];
    const flushParagraph = () => { if ( paragraph.length ) { out.push(`<p>${inline(paragraph.join(" "))}</p>`); paragraph = []; } };
    const flushTable = () => {
        if ( !rows.length ) return;
        const cells = rows.filter(row => !/^\|[\s|:-]+\|$/.test(row))
            .map(row => row.split("|").slice(1, -1).map(cell => cell.trim()));
        const [head, ...body] = cells;
        out.push(table(head.map(inline), body.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join("")}</tr>`)));
        rows = [];
    };
    for ( const line of lines ) {
        if ( !line.trim() ) { flushParagraph(); flushTable(); continue; }
        if ( line.startsWith("|") ) { flushParagraph(); rows.push(line); continue; }
        flushTable();
        paragraph.push(line);
    }
    flushParagraph();
    flushTable();
    return out;
}

/** Markdown inline to HTML. Internal `[text](#anchor)` links become their text: nothing resolves in a journal. */
function inline(text) {
    return html(text)
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/~~([^~]+)~~/g, "<s>$1</s>")
        .replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>");
}

function html(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function strip(text) {
    return text.replace(/\s+$/, "").replace(/^\s+/, "");
}

/* -------------------------------------------- */
/*  Writing                                     */
/* -------------------------------------------- */

function writeSource(journals) {
    fs.rmSync(SOURCE_DIR, { recursive: true, force: true });
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
    for ( const journal of journals ) {
        const file = path.join(SOURCE_DIR, `coverage.${journal.flags.mgt2.lang}.json`);
        fs.writeFileSync(file, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
    }
    console.log(`wrote ${journals.length} journals to ${path.relative(WORKSPACE, SOURCE_DIR)}`);
}
