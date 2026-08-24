# Screenshots

One folder per declared language. A README in that language embeds only the files in its own folder,
so a language with no screenshots yet simply shows none — nothing breaks and nothing shows the wrong
language.

```
web/screenshots/
├── fr/       ← français, the system's target language
├── en/       ← english
├── es/       ← español
└── pt-BR/    ← português (Brasil)
```

**Naming.** Same base name across languages, so the four READMEs stay symmetrical and a missing file
is obvious:

| File | What it shows |
|---|---|
| `character-sheet.webp` | the Traveller sheet, play mode, on *Traits & Skills* |
| `inventory.webp` | the inventory tab, *On Hand*, with a container and its contents |
| `roll-prompt.webp` | the roll window, formula and Effect live |
| `chargen.webp` | the group creation grid |
| `space-combat.webp` | the space-combat screen |
| `world.webp` | the world sheet with a parsed UWP |

**WebP, at twice the window's own size.** A 1000 px window lands as a 2000 px file of around 100 KB,
which is what makes the text legible when GitHub scales it down. Each shot is the **application
window alone**, edge to edge — no desktop, no canvas, no chrome around it — so the four sets sit side
by side without a background that dates them.

**One crew, restated in the language of the shot.** Same Travellers, same ship, same world in all
four sets, so the reader compares the interface and not the fiction: Camille Ferrand, ex-Scout turned
free trader on the *Aurore*; four more Travellers mid-creation, one of them ejected after a failed
survival; the corsair *Nyx* at medium range; and Kessari, `B564743-9`, agricultural and rich. The
French set uses Modül's printed vocabulary — *Pilote*, *Combi*, *Mêlée*, *Polyvalent* — and never a
back-translation of the English.

**Retaking them.** Take the whole set in one sitting, at the same window sizes, on the same palette
(preset `classic`, accent `red`, ground `auto`), and switch language between passes rather than
editing text afterwards. A set half-retaken is worse than a stale one: the four READMEs are read as
one system, and one shot at a different width shows.

The legacy shot at `web/foundryvtt/inventory.jpg` is still what `system.json` hands Foundry's package
browser; the four sets do not replace it until that entry is repointed.
