import { MGT2 } from "./config.js";

/**
 * Where a world sits in Charted Space, and how far one is from another.
 *
 * A sector is 32 columns of 40 hexes, sixteen subsectors of 8 by 10 lettered A to P in reading order,
 * and a world's printed location is its column and row **within its own sector** — Craw's `1939` is
 * column 19, row 39 of the Spinward Marches. The pair means nothing without the sector beside it,
 * which is why 122 hexes of Behind the Claw are printed twice: the book covers two sectors and each
 * has its own grid. `worldSpace` folds the sector's own position in and produces the one frame in
 * which every world in Charted Space has an unambiguous pair of numbers.
 *
 * **Even-numbered columns are drawn half a hex lower**, so a step sideways changes the row for one
 * parity and not the other, and the two readings disagree. This one was checked against the only two
 * distances the books state outright: Craw 1939 → Glisten 2036 is 3 parsecs (Behind the Claw p.131)
 * and Arcanum 2126 → Deneb 1925 is 2 (p.165). The other parity gives 4 and 2.
 *
 * Distance is computed in cube coordinates rather than on the offset grid: the offset form needs a
 * parity correction at every step, the cube form is half the sum of three differences.
 *
 * This is a **second implementation on purpose** — `mgt2-data/tools/lib/space.mjs` is the same
 * geometry for the Node generators, which run without a browser and read `tools/data/sectors.json`
 * off disk. Neither runtime can import the other's module. The two must agree, and the module's
 * build checks that they do.
 */

/** The grid every sector is drawn on. */
export const SECTOR = Object.freeze({
    columns: 32, rows: 40, subsectorColumns: 8, subsectorRows: 10, subsectorsAcross: 4
});

/** Folded sector names, so a hand-typed `spinward marches` still resolves. `MGT2.Sectors` is frozen. */
let folded = null;

/**
 * `"1939"` → `{col: 19, row: 39}`. Anything else is not a location on a sector map: a book listing a
 * star system orbit by orbit files `orbit 5` in the same column.
 * @param {string} printed
 * @returns {{col: number, row: number}|null}
 */
export function parseHex(printed) {
    const match = /^(\d{2})(\d{2})$/.exec(String(printed ?? "").trim());
    if ( !match ) return null;
    const col = Number(match[1]);
    const row = Number(match[2]);
    if ( (col < 1) || (col > SECTOR.columns) || (row < 1) || (row > SECTOR.rows) ) return null;
    return { col, row };
}

/** Which of the sixteen a hex falls in — `A` top spinward, `P` bottom trailing. */
export function subsectorLetter({ col, row }) {
    const across = Math.floor((col - 1) / SECTOR.subsectorColumns);
    const down = Math.floor((row - 1) / SECTOR.subsectorRows);
    return String.fromCharCode(65 + (down * SECTOR.subsectorsAcross) + across);
}

/**
 * A sector-local hex in the world space of the whole map, so worlds of different sectors compare.
 * @param {{x: number, y: number}} sector   The sector's own position, from `MGT2.Sectors`.
 * @param {{col: number, row: number}} cell
 */
export function worldSpace(sector, { col, row }) {
    return {
        x: (sector.x * SECTOR.columns) - 1 + col,
        y: (sector.y * SECTOR.rows) - SECTOR.rows + row
    };
}

/** Zero is not a column, so the parity that shifts the map's EVEN columns down is the odd one here. */
function cube({ x, y }) {
    const z = y - ((x - (x & 1)) / 2);
    return { x, y: -x - z, z };
}

/**
 * Jump distance in parsecs between two world-space points.
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {number}
 */
export function distance(from, to) {
    const a = cube(from);
    const b = cube(to);
    return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}

/** The registry entry for a sector name, matched exactly first and then case-insensitively. */
export function findSector(name) {
    const wanted = String(name ?? "").trim();
    if ( !wanted ) return null;
    if ( MGT2.Sectors[wanted] ) return MGT2.Sectors[wanted];
    folded ??= new Map(Object.entries(MGT2.Sectors).map(([key, sector]) => [key.toLowerCase(), sector]));
    return folded.get(wanted.toLowerCase()) ?? null;
}

/**
 * Everything the typed pair means. **Nothing here throws and nothing here is required**: a world with
 * no location, or one in a sector the registry never heard of, is a legitimate state and simply has
 * no `coords` — a homebrew sector has no origin to fold in, and a referee is not obliged to place a
 * world before using its profile. The sector-local halves still resolve without the registry, because
 * the subsector a hex falls in is a property of the grid and not of the sector.
 * @param {string} sector   The sector's printed name.
 * @param {string} hex      The hex **within that sector**, as the books print it.
 * @returns {{cell: {col: number, row: number}|null, subsector: string|null, subsectorName: string|null,
 *            coords: {x: number, y: number}|null, known: boolean}}
 */
export function locate(sector, hex) {
    const cell = parseHex(hex);
    const found = findSector(sector);
    const letter = cell ? subsectorLetter(cell) : null;
    return {
        cell,
        subsector: letter,
        subsectorName: (found && letter) ? (found.subsectors[letter] ?? null) : null,
        coords: (found && cell) ? worldSpace(found, cell) : null,
        known: found !== null
    };
}
