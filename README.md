# MGT2 — Mongoose Traveller for Foundry VTT

An unofficial system that runs Mongoose Publishing's **Traveller** as a campaign rather than as a
character sheet: the damage chain, group character creation, space combat, trade, jump travel and
the ship's ledger — in French, English, Spanish and Brazilian Portuguese.

**Requires Foundry VTT v14** (14.366 minimum). Unofficial, and unaffiliated with Mongoose Publishing.

| | | |
|---|---|---|
| 🇫🇷 | **Français** | [README.fr.md](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.fr.md) |
| 🇬🇧 | **English** | [README.en.md](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.en.md) |
| 🇪🇸 | **Español** | [README.es.md](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.es.md) |
| 🇧🇷 | **Português (Brasil)** | [README.pt-BR.md](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.pt-BR.md) |

**Changelog** —
[Français](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/CHANGELOG.fr.md) ·
[English](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/CHANGELOG.en.md) ·
[Español](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/CHANGELOG.es.md) ·
[Português](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/CHANGELOG.pt-BR.md)

<!-- Absolute URLs on purpose: system.json points Foundry at the RAW file, where a relative link is
     dead. GitHub resolves these too, so one form works in both places. -->

---

## A session, as it runs

**Round one, at Medium range.**

![Space combat over Kessari](https://raw.githubusercontent.com/JDR-Ninja/foundryvtt-mgt2/main/web/screenshots/session/session-space.webp)

The screen carries a range band for every pair of ships, the thrust the pilot has to spend, the
initiative the side's Tactics check bought, and each crewed station with the combat duty it is
standing. In the log: the dorsal turret's hit, the damage it offers in three readings, and the
corsair's answer going wide.

**The boarding party is aboard.**

![The pilot's sheet during a boarding action](https://raw.githubusercontent.com/JDR-Ninja/foundryvtt-mgt2/main/web/screenshots/session/session-deck.webp)

The snub pistol's damage was applied by the player who took it, from the card, against the armour
she was actually wearing. Endurance is down five, the Endurance DM followed it, encumbrance
followed that — and the recovery strip is already offering first aid, surgery, medical care and the
day's rest.

**The referee asks the whole crew.**

![A roll request and the answers coming in](https://raw.githubusercontent.com/JDR-Ninja/foundryvtt-mgt2/main/web/screenshots/session/session-request.webp)

One demand — skill, characteristic, difficulty, a named DM, and who it goes to. Every Traveller
answers from their own screen; the card keeps the tally, and each answer carries a strip back to
the demand that produced it.

---

## Sheets, kit and creation

**Twenty-two skills, two careers, and a programme five weeks into its eight.**

![The Traveller sheet](https://raw.githubusercontent.com/JDR-Ninja/foundryvtt-mgt2/main/web/screenshots/session/session-sheet.webp)

The training strip names the level it is buying, the weeks logged against it and the button that
grants it. On the left, what the boarding action left behind: Endurance at 3 of 8, the Endurance DM
that follows it, and the carrying limit that follows that.

**Four containers, and a locker ashore that is an Actor of its own.**

![The inventory and a Stash](https://raw.githubusercontent.com/JDR-Ninja/foundryvtt-mgt2/main/web/screenshots/session/session-inventory.webp)

Every row names the container it is in. Beside it, a Stash: a bonded locker at the highport, with
its own weight, its own value, a lock, and a row per player saying who may open it. The pilot owns
it, the astrogator may read it, nobody else sees the sheet at all.

**Six Travellers, five terms, one career that went wrong.**

![Group character creation](https://raw.githubusercontent.com/JDR-Ninja/foundryvtt-mgt2/main/web/screenshots/session/session-chargen.webp)

Creation runs as a grid of Travellers by terms, and it is interruptible: close it, play a session,
come back. Each cell carries the career, the assignment and whether survival was passed — and where
it was not, the ejection and the note that says why. The strip underneath is the term itself, ten
steps in the order the book prints them.

---

## What the system does

### At the table

* **Roll requests.** The referee composes one demand and sends it to the whole roster. Each player
  answers from their own screen, the card counts who is in, who declined and what they scored.
* **Task chains.** A check can be offered into the next one. The receiving card names its sources
  and carries their total, so a chain is auditable without storing a chain anywhere.
* **The whole damage chain, resolved on the defender's side.** An attack offers damage in three
  readings; whoever was hit picks one, and armour, traits, scale, the damage track, the DMs that
  fall out of it and the recovery options all follow from there.
* **Play mode and edit mode**, per sheet, so a sheet in play shows what a player needs and nothing
  they can break.

### The Travellers

* **Seven Actor types** — Traveller, NPC, Vehicle, Spacecraft, Robot, World, Stash.
* **Eighteen Item types** — weapon, armour, ammunition, computer, drug, cargo lot, passage, ship
  component, crew role, contract, contact, disease, species, career and more.
* **Group character creation**, on a grid of Travellers × terms, interruptible without losing
  anything. Careers and species are templates the referee writes.
* **Training, ageing, benefits and mustering out**, on one log per Traveller.

### The ship

* **Space combat** with a range band for each pair of ships, thrust allocated by the pilot, and a
  station for every crew member.
* **Fleet battles**, for the day the two ships become two squadrons.
* **Voyages and jump**, with real fuel, the ship's mortgage and the crew's finances.
* **Trade** — parsed Universal World Profile, derived trade codes, speculative trade, stop traffic
  and the hold manifest.

### The world

* **Forty-nine optional and variant rules** in one settings screen — psionics, wealth, radiation,
  encumbrance, starvation, vacuum, the jump procedure, fleet battles and design validation among
  them. Each names the book and page it comes from, or says that no book settles it. The defaults
  are the game as printed.
* **Four languages** — French, English, Spanish and Brazilian Portuguese, interface and content
  strings alike.
* **Three compendiums it writes itself** — what the system does with the rules, one journal per
  language, and an annotated demo document for every type and sub-type it registers. A worked
  example, not a starter world: every figure in it is invented.
* **One accent recolours everything.** Four palette presets, eleven accents, light, dark or
  follow-the-system — and every text token clears 4.5:1 contrast in all of them.

## What it deliberately does not do

* **It never schedules time.** A region states its interval and its cost; the referee moves the
  clock. The combat round is the only exception, because Foundry already counts it.
* **It ships no content taken from the books** — no career table, no equipment catalogue, no rules
  text. It ships the structure and the ledgers that run them.

---

## Install

In Foundry, open **Game Systems → Install System** and paste this manifest URL:

```
https://github.com/JDR-Ninja/foundryvtt-mgt2/releases/latest/download/system.json
```

Then create a world on the **MGT2** system. Nothing else is required.

## Every screen, in your language

Each language's README carries six more screenshots of its own — the Traveller sheet, the
inventory, the roll window, group creation, space combat and the world sheet — taken in that
language, so you can see the system in the one your table plays in:
[Français](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.fr.md) ·
[English](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.en.md) ·
[Español](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.es.md) ·
[Português (Brasil)](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/README.pt-BR.md).

## Credits and licence

Built for Mongoose Publishing's Traveller, and specially for the French edition translated by
[Modül](https://www.gameontabletop.com/cf3161/traveller-vf.html). Traveller is a trademark of
Mongoose Publishing; this system is unofficial and unaffiliated. See [LICENSE](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/LICENSE)
and [CREDITS.md](https://github.com/JDR-Ninja/foundryvtt-mgt2/blob/main/CREDITS.md).
