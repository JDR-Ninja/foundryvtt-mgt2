/**
 * The pack roster: one source of truth for `tools/packs.mjs` and for the check it runs against
 * `system.json`. A pack the manifest declares and this list does not — or the reverse — fails the
 * build, because the failure it replaces is a release that installs cleanly and shows an empty
 * compendium.
 *
 * **A pack label is localised by Foundry itself** (`compendium-collection.mjs` runs `metadata.label`
 * through `game.i18n`), so `i18n` carries the key the manifest declares and `label` the English the
 * tools print. A document's own name is stored data that no `game.i18n` reaches — which is why the
 * `docs` pack ships one journal per language rather than one journal translated at load.
 *
 * A pack declares **who writes its source**, and `extract` refuses both for their own reason —
 * an extract destroys the source directory and writes one flat file in its place, so a pack whose
 * layout means something cannot survive one:
 *
 * - `generated` names what a pack is built from, which lives outside this repository. The source
 *   files are the generator's to lay out, and an extract would flatten its per-language files into
 *   one.
 * - `authored` marks a pack written by hand, one JSON file per document. An
 *   extract would take every `flags.mgt2.demo` with it. Such a pack also answers to the linter,
 *   `tools/lint-packs.mjs`, which is what replaces the sheet that never filled it in.
 *
 * A pack with neither is nobody's, and nothing but `compile` will touch it.
 */

export const PACKS = [
    { name: "docs", label: "Rules coverage", i18n: "MGT2.Compendium.Docs", type: "JournalEntry",
        generated: "the rules audit" },
    // The guide is off the roster until its pages are written — the `?` button hides itself when
    // nothing answers, so the machine ships without the pack and costs a reader nothing.
    { name: "demo-actors", label: "Demo actors", i18n: "MGT2.Compendium.DemoActors", type: "Actor",
        authored: true },
    { name: "demo-items", label: "Demo items", i18n: "MGT2.Compendium.DemoItems", type: "Item",
        authored: true }
];

export const PACK_BY_NAME = Object.fromEntries(PACKS.map(pack => [pack.name, pack]));
