# Changelog — MGT2

[Français](CHANGELOG.fr.md) · [Español](CHANGELOG.es.md) · [Português (Brasil)](CHANGELOG.pt-BR.md)

---

## [0.2.0]

**The largest release this system has had.** 0.1.x was a character sheet; 0.2.0 is a game system.
Seven Actor types, eighteen Item types, group Traveller creation, space combat and fleet battles,
speculative trade and stop traffic, voyages and jump, training, the whole damage chain, forty-nine
optional rules, and a documentation compendium in four languages.

### ⚠ Breaking changes

* **Requires Foundry VTT v14** (14.366 minimum). It no longer runs on v11 to v13.
* **The `vehicule` Actor type is gone**, replaced by `vehicle`. No migration is shipped: no known
  world held one.
* **Dropping a species no longer edits the stored characteristic.** The species becomes an embedded
  Item and its modifier is derived. The migration subtracts the bonus already written and **logs every
  subtraction** to the console, by Actor name. Two cases cannot be resolved and are reported rather
  than guessed: a Traveller whose species Item is gone from the world is left exactly as stored, and
  **a Traveller who was given the same species twice keeps one copy of the bonus** — nothing in the
  data distinguishes one drop from two. Check those by hand.
* **The hand-typed UPP is gone**: it derives from the six canonical characteristics.
* **Fuel changed fields.** `fuelPerJump` became `fuelPerMaxJump`, `fuelPerParsec` arrived, and the
  Finance block's *Fuel* line became a cost per ton plus a tank fill — it used to bill a full tank per
  period, a quantity no rule states.
* **The stylesheet now loads in the `system` CSS layer**, which finally lets modules override the
  system cleanly — and changes precedence if you had custom CSS.

### Traveller creation

* **Group creation**, on a grid of Travellers × terms. Each player rolls for their own Traveller; the
  referee follows everybody on one screen.
* **Nothing is lost when a session is interrupted.** There is no session document: every decided
  outcome writes to the Actor as it is decided. Closing Foundry mid-creation and coming back the next
  day costs nothing.
* **Careers are templates the referee writes**, with a full form: ranks, assignments, skill tables,
  benefits, events and mishaps, awards. The system ships no career table — it ships the ledger that
  runs them.
* **Species are creation frames**, not parameter blocks: a species declares its own terms, checks,
  tables and tracks. The Core sequence is the default frame.
* **Mustering out**: benefits, pension, ship shares, and a group-level close where only one Traveller
  may start owning a ship.
* **Twenty-two optional creation rules** (see below), sixteen of them where no book settles the
  question — the books are silent, or they say two things within two lines.
* **A signed log of permanent characteristic loss** — ageing, injury, medical care — whose sum is
  derived. It works without creation and is just as useful in play.
* **Training**: a register of programmes, one per endeavour, each carrying *which book runs it*. Core
  Study Periods and the Companion's Experience Points are two ways of moving one record. A programme
  may target a characteristic (SOC and PSI barred), and a teacher is an Actor whose level is read at
  the roll.

### Combat

* **Space combat** — a Combat sub-type of its own, with three phases a round and a range band for
  **each pair of ships**. The group is the ship, and its crew acts on the hull's Initiative.
* **Fleet battles** (High Guard), behind an optional-rule switch. A Fleet Ship Sheet on the
  spacecraft, an engine that resolves on an Attack Factor **with no roll to hit**, fighter squadrons,
  missile salvos in flight, morale and dispersal. In a fleet battle the group is the fleet and a ship
  becomes a combatant.
* **Grappling** — the book's eight outcomes: prone, disarm, throw, damage, pistol or small blade,
  escape, drag, continue.
* **Dual weapons**, **Jack-of-All-Trades** and **the interrupted extended action** are applied.
* **A standing Initiative modifier finally has somewhere to land**, on every Actor type. The
  holographic bridge of the Core rulebook and High Guard (*DM+2 when rolling for Initiative*) is the
  first thing to use it.
* **A diagonal measures Euclidean**, as Companion p.173 asks: ten squares read 15 m and now read
  21 m. The setting is world-scoped and takes the right default; a world where it was already set by
  hand keeps its own.
* **Range is measured from the target** in the roll prompt, when a token is targeted.

### Health, damage and recovery

* **The whole damage chain** — the damage order is edited in a reorderable list: drag to rank, remove,
  add from the available characteristics. It is echoed under the sheet's characteristics.
* **The damage card resolves on the defender's side**: the targeted player applies it, and armour,
  Protection and armour-ignoring damage are honoured in the right place. **Armour-ignoring damage was
  documented and not applied** for Travellers and NPCs.
* **First aid, surgery and medical care** start from the chat card and write to the **controlled**
  Travellers. Surgery applies the number you type, which used to be displayed and then discarded.
* **Psionic recovery**, with its hour ladder.
* **Diseases, poisons and injuries are Items**, and a weapon trait that inflicts one **builds the Item
  on the defender** — the whole pipeline existed and nothing called it.
* **Drug doses and loaded rounds**: a dose is an Active Effect, a loaded round is a derivation on the
  weapon that fires it.

### Spacecraft, voyages and finance

* **The ship carries its voyage leg** — here, next stop, distance in parsecs, queue — and its real
  fuel level.
* **Jump and misjump**, with the Companion branch, and a setting for perceived time on a late jump.
* **The printed statblock beats the formula.** Six optional fields — hull points, power draw, armour
  tonnage, bridge tonnage and cost, jump fuel — let a published ship be transcribed exactly as
  printed, with a marker saying which figure was forced.
* **Ship components**, with design validation: six checks over tonnage, power and budget, behind a
  switch.
* **Computers, software and Bandwidth**: the sum against Processing, the Tech Level gate, the
  downgrade of oversized packages, and the Interface-software exception. On a ship it is **the hull's**
  TL that caps, never the computer's.
* **Ship mortgage**, with its shares, its schedule, an option for a four-week period, and **Skipping
  on Debts**.
* **Credit transfer** — the first screen in this system that moves money on demand.
* **Crew role** as an Item type: a role is a job description, and two gunners may share one.

### Trade

* **The World becomes an Actor**: a Universal World Profile pasted in one block and parsed, eighteen
  derived trade codes each with an Auto/On/Off override, fuel quality and price, berthing cost, and
  speculative-trade state stamped with the *Campaign day*.
* **A world knows where it is**: sector by name and hex inside that sector — the pair the books print.
  The subsector and one absolute coordinate derive from it, so two worlds in different sectors become
  comparable. Checked against 1 165 published worlds with no mismatch.
* **Speculative trade**: the book's three tables — the 18 codes, the 36×8 Trade Goods table and the
  29-row Modified Price table. The screen takes a **dropped world** and stops asking for what the
  document already knows.
* **Stop traffic**: passengers, freight and mail become Items on the ship, and a **Manifest** on the
  spacecraft sheet delivers a consignment and puts a passage ashore.
* **Cargo lot** and **Passage** as Item types, with destination, due day and fare — three fields that
  had existed since the type did and that nothing had ever written.
* **The counter closes**: a settled price buys a lot and debits the crew, and the hold sells back.

### The world around the Travellers

* **Four region behaviours** — gravity, temperature, vacuum, radiation. They state the interval and
  its cost; **the system never schedules time**. The combat round is the only exception, because
  Foundry already counts it.
* **Stash** — an inventory nobody carries: a loot pile, a shop's stock, a cache. It has its own
  permissions, and that is the whole reason it is an Actor.
* **Containers work off an Actor.** A bag created in the Items tab holds world items, fills by
  dragging an item onto its sheet, and empties by dropping the item back in the sidebar. Deleting a
  bag frees its contents instead of taking them with it.
* **Containers nest**, up to five levels, and weight travels up the chain. A container can never end
  up inside itself. A container dragged from the world or a compendium arrives with everything in it.
* **Encumbrance** behind a switch, read off the *current* STR and END.

### Rolls, cards and requests

* **The roll prompt was rebuilt**: the formula and the Effect read live as you adjust, boons and banes
  included.
* **Task chain** — a roll card can cite the previous one and take its modifier from it.
* **The Docket**: the referee composes one demand — skill, characteristic, difficulty, boon or bane,
  timeframe, one named DM and the reason for it — resolves it against a roster of Travellers **before
  it is sent**, and posts it as a card each player answers from their own seat.
* **Chat cards carry their dice**, so Dice So Nice animates them.
* **Dragging a skill or a weapon onto the hotbar creates the right roll.** It used to silently create
  a macro that opened the item sheet.

### Interface

* **The character sheet was rebuilt**: a characteristics column with a depletion gauge, the tab bar
  brought back inside the sheet, lighter tables.
* **Play mode and edit mode** on the sheets, on the dnd5e model: structural controls disappear while
  you play.
* **Sheets, dialogs and chat cards follow the player's light or dark theme.**
* **Item sheets moved to five tabs** over the same blocks, with a masthead above them: a weapon sheet
  goes from 956 px to 489 px.
* **The sheet no longer redraws entirely on every keystroke**: only the affected sections rebuild.
* **A rule and its page are no longer body text on a sheet**: the sheet states what it is doing, and
  the rule behind it is a tooltip.
* **Compendium explorer**, on the dnd5e model: world packs and module packs, filterable by Tech
  Level, sub-type and scale.
* **A world-compendium creation button** in the settings: it ships structure and never content.

### Optional and variant rules

**Forty-nine rules over six groups**: *Travellers* 4, *Creation* 22, *Combat* 5, *Health* 4,
*Space* 11, *Craft* 3. One menu in the world settings, and **they do not all start off** — each
default is the reading the books best support, so an optional rule ships off and a rule the books
print *as* a rule (encumbrance, magazines, radiation) ships on.

Four shapes: a switch, a picker (a set), a choice of procedure and a count — because a boolean cannot
say *which printed procedure is in force* when two chapters are not the negation of one another.
Sixteen rows cite no book: fourteen print *house rule* and two *unofficial*. A house rule exists
precisely where the books are silent, or where they say two things within two lines.

Changing a switch re-prepares and re-renders open sheets; nothing asks you to reload.

### Documentation and languages

* **The system ships its first compendium**: `mgt2.docs`, one journal per language, twenty-three pages
  each. Every page says two things about one screen — **what it handles for you** and **what it leaves
  to you at the table**. It is documentation *about the system*, never rules text.
* **Four declared languages** — French, English, Spanish, Brazilian Portuguese, and **all four are
  complete**. French is the system's target; the Spanish and Brazilian Portuguese vocabulary follows
  Mongoose's community translations, and book titles and trait names stay in English where no
  published edition names them.

### Fixes

* `system.json` no longer emits warnings
  ([#3](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/3))
* Roboto, Roboto Condensed and Rubik Mono One were used by the sheets and never loaded: they fell
  back silently to the browser's generic font
* The dice on inventory, skill, psionic-talent and disease rows rolled nothing: only initiative and
  characteristics responded
* Finance notes were never saved (the field carried a name absent from the schema)
* The vertical label on item sheets stayed red on the Mwamba and Blue themes
* Dropping an item on a container row in the inventory stored nothing: the handler looked for a CSS
  class no template emitted
* **Six Item types could not be dropped on any sheet in the system**, four of them the ones a hull is
  made of: a hard-coded exclusion list was inherited by every Actor sheet
* **No drop zone ever highlighted correctly**: the drag cache was permanently empty, so all three
  zones painted "deny" on everything
* **Dropping a person on the second gunner's row wrote them onto the first gunner's**
* A carrier paid maintenance on every craft it carried but one, the book's exclusion counting only one
  per bay
* Software added by the Computer block's own `+` control was invisible to the rest of the system
* A skill whose name already carries its speciality — *Animals (Training)*, the form the compendiums
  use — stated it twice: *Animals (Training) (Training)* on the sheet, in the roll dialog and on the
  chat card
* Jump fuel was computed from the ship's maximum range instead of the printed rate (10 % of the hull
  per parsec): a 3-parsec jump on a jump-2 ship burned twice what it should
* **The first-aid button vanished in a French world**, the list of healing skills existing only in
  English
* The *Colour theme* setting label was broken English, and three settings applied nothing until you
  reloaded
* A duration key carried a French name in the English dictionary, and that typo was **persisted on
  every psionic talent** measured in hours; the migration rewrites the stored value
* Eleven page citations were one page high, three of them visible to players
* Trade codes printed their condition in hard-coded English, the only user-facing string in the system
  outside the translation layer

---

## [0.1.4] (2024-05-25)

### Fixes
* Error when computing weight on various events (drop, delete)

## [0.1.3] (2024-05-24)

### Fixes
* Localisation
* Add the difficulty value to the label

### Features
* v12 support

## [0.1.2] (2024-05-16)

### Fixes
* Difficulty display for Psionic Talents
* Scrollbar added to the character sheet
* Drag & drop on the Career, Disease, Contact and Species sheets
* Message styling removed, pending a uniform pass
* Various CSS adjustments

### Features
* Blue theme
* Species model improved: Detailed Description, Modifiers (table) and Traits (table)
* Dropping a Species copies its information onto the sheet
* Duration added to Psionic Talents
* A button on messages to roll a Psionic Talent's Duration
* Difficulty added to the roll window
