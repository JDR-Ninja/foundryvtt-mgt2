# Screenshots

Two families, and they answer different questions.

**Sheet shots** — one folder per declared language. A README in that language embeds only the files
in its own folder, so a language with no screenshots yet simply shows none: nothing breaks and
nothing shows the wrong language.

**Session shots** — the root README's landing images: the whole interface, mid-game, with the chat
log carrying an exchange. **English only, on purpose.** The landing is the page a referee who
speaks no French reaches first, and one set of session images serves every reader; the per-language
detail is what the sheet shots are for.

```
web/screenshots/
├── fr/        ← sheet shots, français, the system's target language
├── en/        ← sheet shots, english
├── es/        ← sheet shots, español
├── pt-BR/     ← sheet shots, português (Brasil)
└── session/   ← session shots, english, for the root README
```

## Sheet shots

**Naming.** Same base name across languages, so the four READMEs stay symmetrical and a missing
file is obvious:

| File | What it shows |
|---|---|
| `character-sheet.webp` | the Traveller sheet, play mode, on *Traits & Skills* |
| `inventory.webp` | the inventory tab, *On Hand*, with a container and its contents |
| `roll-prompt.webp` | the roll window, formula and Effect live |
| `chargen.webp` | the group creation grid |
| `space-combat.webp` | the space-combat screen |
| `world.webp` | the world sheet with a parsed UWP |

**WebP, at twice the window's own size.** A 1000 px window lands as a 2000 px file of around
100 KB, which is what makes the text legible when GitHub scales it down. Each shot is the
**application window alone**, edge to edge — no desktop, no canvas, no chrome around it — so the
four sets sit side by side without a background that dates them.

**One crew, restated in the language of the shot.** Same Travellers, same ship, same world in all
four sets, so the reader compares the interface and not the fiction: Camille Ferrand, ex-Scout
turned free trader on the *Aurore*; four more Travellers mid-creation, one of them ejected after a
failed survival; the corsair *Nyx* at medium range; and Kessari, `B564743-9`, agricultural and
rich. The French set uses Modül's printed vocabulary — *Pilote*, *Combi*, *Mêlée*, *Polyvalent* —
and never a back-translation of the English.

**Retaking them.** Take the whole set in one sitting, at the same window sizes, on the same palette
(preset `classic`, accent `red`, ground `auto`), and switch language between passes rather than
editing text afterwards. A set half-retaken is worse than a stale one: the four READMEs are read as
one system, and one shot at a different width shows.

## Session shots

| File | What it shows |
|---|---|
| `session-space.webp` | round one of a space combat over a nebula, the screen and the log |
| `session-deck.webp` | a boarding action: the deck, the wounded pilot's sheet, the damage chain |
| `session-request.webp` | the referee's roll-request compose window and the card answering it |

**The whole interface, 1600 × 1000 at scale 2** — 3200 × 2000, 200-280 KB. Sidebar expanded on the
chat log, hotbar loaded, scene navigation visible, and **four player clients actually connected**,
because an offline roster reads "GM rolls" on every surface that names who answers.

**One continuous session, in this order.** The three are stages of the same fight, taken in one
pass without clearing the log between them, so the cards visible in a later shot are the ones the
earlier shot produced. Re-take all three together or none.

**The board is drawn, never sourced.** The space scene is one of the deep-sky plates this system
already ships. The deck is a set of Drawings — hull, spine corridor, compartments — generated for
the shot, because no deck plan may be taken from the books and a bare grid photographs badly.

**They cannot be produced the way the sheet shots are.** A session shot contains the WebGL board,
and a renderer that clones the DOM returns that canvas blank; these are real browser screenshots.
The harness for both families lives outside this repository.

## The package browser

`system.json`'s `media` entry is what Foundry shows a referee browsing systems, and it points at
`web/screenshots/session/session-space.webp`. The earlier shot at `web/foundryvtt/inventory.jpg` is
kept only as the file older manifests referred to.
