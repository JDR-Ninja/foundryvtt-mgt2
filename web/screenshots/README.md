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
| `character-sheet.jpg` | the Traveller sheet, play mode |
| `inventory.jpg` | the inventory tab, with a container open |
| `roll-prompt.jpg` | the roll window, formula and Effect live |
| `space-combat.jpg` | the space-combat screen |
| `chargen.jpg` | the group creation grid |
| `world.jpg` | the world sheet with a parsed UWP |

Take them at the same window size in every language, with the same world and the same theme, so the
set reads as one system rather than four. The legacy shot lives at `web/foundryvtt/inventory.jpg` and
is referenced by the old GitHub raw URL; leave it until the four sets exist.
