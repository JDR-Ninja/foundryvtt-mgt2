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
 * `generated` names the workspace document a pack is built from. Such a pack is written by its own
 * generator, and `extract` refuses it: the source files are the generator's to lay out, and an
 * extract would flatten its per-language files into one.
 */

export const PACKS = [
    { name: "docs", label: "Rules coverage", i18n: "MGT2.Compendium.Docs", type: "JournalEntry",
        generated: "docs/RULES-AUDIT.md" }
];

export const PACK_BY_NAME = Object.fromEntries(PACKS.map(pack => [pack.name, pack]));
