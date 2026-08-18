/**
 * Reading `packs/_source/`, which is the one direction anything reads it: a pack's source is a
 * directory of `.json` files, each holding one document or an array of them, walked recursively and
 * **sorted by name** so the order a pack compiles in is the order the files sit in.
 *
 * Both readers below are the same walk. `readSource` hands back documents, which is all the compiler
 * wants; `readSourceFiles` keeps the file each document came from, which is all the linter wants,
 * because a defect reported without its file is a defect nobody can find.
 */
import fs from "node:fs";
import path from "node:path";

/** Every `.json` under a pack's source directory, in a stable order, objects or arrays alike. */
export function readSource(dir) {
    return readSourceFiles(dir).flatMap(entry => entry.documents);
}

/** The same, grouped: `[{file, documents}]`, `file` absolute. */
export function readSourceFiles(dir) {
    return walk(dir).map(file => ({ file, documents: readFile(file) }));
}

export function readFile(file) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [parsed];
}

export function walk(dir) {
    const files = [];
    for ( const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)) ) {
        const full = path.join(dir, entry.name);
        if ( entry.isDirectory() ) files.push(...walk(full));
        else if ( entry.name.endsWith(".json") ) files.push(full);
    }
    return files;
}
