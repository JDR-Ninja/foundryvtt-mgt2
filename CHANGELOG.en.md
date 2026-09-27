# Changelog — MGT2

[Français](CHANGELOG.fr.md) · [Español](CHANGELOG.es.md) · [Português (Brasil)](CHANGELOG.pt-BR.md)

---

## [0.2.3]

**Verified on Foundry VTT 14.368.**

**Creation, re-read rule by rule against the book.** A complete audit of Traveller creation found
some thirty places where a field, a control or a rule existed and nothing read it: a rank bonus never
paid, pending entries with no effect, a draft reduced to a sentence. All of them are fixed, and
pre-career education finally works ([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)).
The system still ships no career and no table: it runs the ones the referee types or imports.

### ⚠ Breaking changes

* **A commission gained closes that term's Advancement roll** (Core p.19). 0.2.0 to 0.2.2 followed
  the book's old update, which allowed it; the 2022 edition says the opposite, and it governs. A
  failed Commission roll leaves Advancement open.
* **Each roll of a term is made once** (Core p.18-19): a step already taken is refused rather than
  rolled again, and a refused qualification closes the term to other careers, except one that is
  always open. The referee can reopen a step taken by mistake (↺ *Reopen this step*).
* **One career at a time**: dropping a career on a Traveller already serving one is refused.
* **A forced-entry career, such as the Prisoner, can no longer be entered voluntarily** (Core p.52):
  it is entered through a sentence left pending, through the draft, or by the referee's hand.
* **World migration.** No career served had ever been given its assignment or its rank ladder. The
  first time a world opens in 0.2.3, each career already served receives its assignment where it is
  missing and the template offers only one, then the ladder that assignment names. **Rank is never
  changed**, and the rank bonuses the career never paid are not paid after the fact: the referee
  receives the list in a private message.
* **For scripts and modules**: an Events row's check now names a list, `check.skills`, rather than
  `check.skill` — a template saved before is read as it stands. A career's Medical Bills row
  (`medicalBillsRow`) takes one of three ids, `military`, `civilian` or `independent`, and a label
  typed as the book prints it is still recognised.

### Pre-career education

* **A career of the *Pre-career education* kind finally follows its own rules** (Core p.16-17):
  entry only during the first three terms, one attempt a term, with that term's DM; a refusal leaves
  the term to a career.
* **During the education**: the skills it teaches — a university picks them from its own table, a
  military academy reads them off its career's Service Skills —, one roll on the Pre-Career Events,
  and **no Survival roll, no Commission, no Benefit roll**. The term still counts for age, ageing and
  PSI.
* **Graduation** is rolled as the education prints it, with its honours, its failure floor and its
  conditional DMs. What it leaves — a qualification DM, a DM or an automatic success on the first
  Commission roll, automatic entry into the academy's career — applies to **the first career
  attempted next**, and is lost if that career refuses the Traveller. A cadet who fails without
  rolling 2 or less keeps their place, with no Commission roll the first term; an Event's *"you fail
  to graduate"* forbids the roll.
* **An education is not a previous career** (Core p.16): the first career after it keeps its whole
  basic training and takes no DM−1 per previous career, unless the new optional rule says otherwise.
  Two educations in a row are possible — a ruling: the book sets only the window and one attempt a
  term.
* **The career form gains an *Education* block**: the window, the DMs by term, the tied career, the
  length (the Companion's 22 + 2D3 years is written `4+2D3`), the chosen skills, the entry grant, and
  graduation with its three outcomes. The Companion's options (p.32-34) are written there too.

### Shared tables

* **Life Events, the Unusual Event, the Draft, the Pre-Career Events and the Background Skills have a
  home**: each is a career of the *Shared table* kind, which the referee links in the *Shared creation
  tables* menu of the world settings. The system ships none of them.
* **A shared table's sheet shows only its kind and its Events**: the rest of the career, which a
  table never reads, stays stored and comes back if the kind is set back to *Career*.
* **Once linked, they play like a career's own rows**: a 7 on Events rolls Life Events, and a row
  naming a table rolls it and applies it — a contact, a betrayal, a pending DM, a lost Benefit roll,
  the Prisoner. With no table linked, the system still says which one to roll from the book.
* **The draft is played** (Core p.19): a refused qualification offers the draft, once in a lifetime,
  a career that is always open such as the Drifter, or deciding later. The draft rolls the linked
  table and enters the career drawn, on the assignment printed, with no qualification roll. An Event
  that drafts the Traveller compels that career the next term (Core p.17).
* **The Background Skills** offer their list where the species prints none (Core p.9).

### The term

* **Entering a career asks for the assignment**, before the roll, and writes the rank ladder it
  names. Changing assignment in the Agent, Citizen, Entertainer or Merchant opens a new career (Core
  p.20): the term closes, and the next one qualifies for the new assignment.
* **Pending entries do what they say**: an automatic success passes the promotion or the commission
  without dice, a prohibition stops its roll, an offered career is entered without qualifying, a
  compelled career is the only one open, a blocked career takes *Continue* away, an unlocked career
  lifts the referee's permission. An Advancement DM can go to the Commission roll, at the player's
  choice (Core p.19). **The referee adds or removes an entry by hand.**
* **Events rows**: their effect on Benefit rolls can depend on their own check, and the Navy,
  Merchant and Rogue wagers are played (Core p.35, p.37, p.41) — a stake taken, declined or chosen
  from the rolls owed, and a win paying half the stake again, rounded up. A check *"if you take this
  opportunity"* can be declined. A row can grant its skill **before** its check, as the Navy and the
  Rogue print it; a check printed on two or three skills is made on the Traveller's best, and a row
  can give a level to the skill used, as the Merchant does — a ruling on the printed order, which no
  errata settles.
* **Injury and medical care** (Core p.49): a row sending to the Injury table rolls it as the row
  prints it, the player places the losses, and care costs Cr5000 a point, less the employer's share
  read on Medical Bills; the rest is a debt, paid first out of mustering-out cash (Core p.52).
* **Anagathics** (Core p.49): from SOC 10, two Survival rolls a term, the terms on them a positive DM
  on ageing, 1D × Cr25000 a term carried as debt, and an ageing roll as soon as they stop; an exact 2
  leads to the Prisoner.
* **The Prisoner** (Core p.52, p.57): the Parole Threshold is rolled on entry, a prisoner cannot
  leave, and release — through Advancement or an escape — ends the career.

### Species

* **The Aslan's three terms in a career before attempting another** (Aliens of Charted Space 1
  p.19): the term's decision says so, a career left by choice too early refuses the next — mustering
  out stays open —, and a career the species exempts, or one an Event offers or compels, is never
  refused.
* **A career open to one species or one sex** refuses other Travellers; a species named without its
  variant admits every variant.
* **A replacement characteristic** — the Vargr's CHA, the Hiver's RES (Aliens of Charted Space 1
  p.179, 2 p.255) — shows in place of the one it replaces and takes its place in the UPP.
* **A species' modifiers and dice can depend on sex**, like the Gurvin's (Aliens of Charted Space 4
  p.167); a Traveller whose sex is not yet set rolls the shared dice, and the dialog says so.
* **Characteristic assignment**: a slot on the species' own dice, like the Hiver's 1D+6, keeps its
  roll; a boon die adds to those dice; a value printed rather than rolled, like the Aslan's TER of 0,
  counts as set.
* **A track that *only ever climbs* never falls**, whatever the world rule.
* **A species frame imposes its characteristic on the Survival roll and the Commission**, as it
  already did on Advancement.

### Mustering out

* **A Benefit roll is offered only to a career still owed one** (Core p.46), and the count no longer
  goes below zero.
* **The printed repeat clauses** (Core p.47): a weapon received twice can become a skill level,
  another quarter of the mortgage is paid, a Scout Ship is rolled again.
* **A characteristic increase stops at the species' maximum**, 15 for a human (Core p.9), and excess
  SOC from a Benefit table becomes Ship Shares (Core p.47).
* **Ship Shares put into the kept ship** no longer pay the Cr1000 a year (Core p.48; counting per
  share is a ruling), and finishing creation while several Travellers keep a ship is flagged.
* **Standing modifiers reach the Benefit roll**, like the Truthers' FOL 10+ (Companion p.36).
* **The Cr10000 of equipment a Traveller may buy before play** is shown (Core p.46).

### Psionics

* **A new course of psionic training costs Cr100000** (Core p.228): the first is free, and each new
  one, which starts the cumulative penalty again, is paid from the Traveller's cash or as debt. A
  ruling: the book prices nothing during creation.
* **A talent rolled on a skill table** is a check to learn it (Core p.229), no longer a talent gained
  outright.

### Contacts

* **A contact can be linked to a Traveller's or an NPC's sheet**: drop the Actor on the contact's
  sheet, which then opens it in one click and can unlink it.

### Optional and variant rules

* **The rules window is read one domain at a time**: a rail on the left shows one page at a time,
  and creation's eighteen interpretations — where the book is silent or ambiguous — have a page of
  their own, sorted by step. Each rule fits on one line and opens its explanation on request; a
  search reads every page, and a filter shows what your table changed, which the rail counts as
  well.
* **New, on**: *An ejected Traveller still takes the term's skill roll* — a ruling, since the book
  takes the Benefit roll and the career and says nothing of the skill roll (Core p.18). The term's
  log says which way it runs.
* **New, off**: *Pre-career education counts as a previous career*.
* *Money spent during creation becomes debt* now also covers medical care, anagathics and a new
  psionic course.

### Demo and documentation

* **`Demo — Harbour Cadet School`** joins the demo items: an academy tied to `Demo — Harbour Patrol`,
  to see an education from start to finish.
* **`Demo — Harbour Life Events`** too: an invented shared table, to link in *Shared creation tables*,
  whose rows show what a table does — the Unusual Event and the Injury table as sub-tables, a lost
  Benefit roll, a Rival or an Enemy, a betrayal, pending DMs, a prohibition.
* **`Demo — Harbour Patrol` shows the new Events rows**: an optional check, a wager with its grant
  first, a check on two skills that raises the one used, a pending automatic success. It pays its
  rank-0 bonus and names its Medical Bills row.
* **The rules audit journal** (`mgt2.docs`) describes creation as it now stands.

### Fixes

* **Enlisted and civilian rank bonuses were never paid**: only an officer grade paid, after a
  commission. Rank 0 is paid on entry, and each promotion pays its own (Core p.19).
* **"Roll on the Mishap table" did not roll the table** (Core p.23). It rolls, and the Traveller
  stays in the career where the row says so.
* ⚠ **The career form erased data on every save**: an Other Benefit reference, a contact's relation
  (Ally, Rival, Enemy), the floor of *"SOC 10 or SOC +1"* and a list of specialities vanished as soon
  as another field was edited, and a conditional qualification DM could not be typed at all. A career
  imported then edited may have lost some: check it.
* **A DM "to your next Survival roll" was spent by the ageing roll**, and a lasting Advancement DM
  was added to Events checks.
* **A Mishap that does not eject still cancelled** the term's Event, Commission and Advancement
  (Core p.18).
* **A Connection added nothing to a skill already held** (Core p.19): it raises it by one level, up
  to 3.
* **Ageing losses could all fall on the same characteristic** (Core p.49).
* **Telepathy was free only while no talent was held**: it is free while no check has been attempted
  (Core p.228-229).
* **The number of background skills** differed between the chip and the picker, and a species that
  gives them *"in addition"*, like the Hivers, saw them fill the count.
* **An empty Cash column**, on a career typed by hand, paid Cr0 and spent a roll: it now asks for the
  amount. A characteristic or skill benefit chosen by hand applies at once.
* **Solo generation did not grant its level-1 skill**, and a Traveller dead under Iron Man carried
  on with the term (Companion p.13).

---

## [0.2.2]

**Verified on Foundry VTT 14.368.**

### Fixes

* **The *Optional and variant rules* window scrolls**: the end of the list was out of reach, even
  full-screen ([#6](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/6)). Three windows had the
  same defect: a species' full description, the mustering-out Benefit picker and *Psionic training*.
* Changing species during creation no longer logs a compatibility warning to the console.

---

## [0.2.1]

**The steps creation never had.** 0.2.0 shipped the term loop without the three steps that come
before it, and without controls for several rules it was already computing.

### Traveller creation

* **Characteristics roll**, from the creation screen — a chip ahead of the terms, carrying the UPP it
  produced — and from the sheet's banner once creation is running.
* **All four assignment methods in the setting work**: any order, the printed order, or the
  Companion's 12D assigned in pairs, heroic variant included. Where a frame has dice of its own, or
  boon dice are in play, the pool is refused **in a sentence** rather than in silence.
* **Background skills are taken** (Core p.9) — EDU DM + 3, a second chip ahead of the terms, at level
  0. A skill the frame *declares* fills its own row: it is imposed rather than offered.
* **Psionic Strength is tested and trained** (Core p.228), where the table has adopted the
  characteristic — the test first, then the training window: the talent ladder, Telepathy free as the
  first, the cumulative penalty per attempt. **A new course is a control of its own** — four months
  and Cr100000 are not a side effect of looking — and it is what finally resets that penalty, as its
  setting has always said.
* **The Connections Rule is playable** (Core p.19) — two Travellers, one skill each, the shared event
  noted. It lives on the screen's masthead because it writes two Travellers at once, which no sheet
  can do; the four printed refusals are each named.
* **A betrayal turns an associate rather than inventing one** (Core p.20): a Contact or Ally becomes
  a Rival or Enemy, and the printed fallback applies where there is none.
* **A column takes the species dropped on it** — head or cell — and **replaces** the one standing
  there, after a confirm. Tracks the old frame alone declared go with it.
* **The masthead states the table's terms**: the assignment method, and only what departs from the
  printed game.

### Fixes

* Dropping a species on a blank Traveller **took the *Start* button off their sheet**.
* What the creation screen cannot take is now **refused out loud** instead of vanishing.
* ⚠ **A cost incurred during creation drove credits below zero**, and the *Money spent during
  creation becomes debt* setting had no effect at all. Such a cost now pays what is available,
  carries the rest as debt, and **refuses whole** where the rule is off.

---

## [0.2.0]

**The largest release this system has had.** 0.1.x was a character sheet; 0.2.0 is a game system.
Seven Actor types, eighteen Item types, group Traveller creation, space combat and fleet battles,
speculative trade and stop traffic, voyages and jump, training, the whole damage chain, forty-nine
optional rules, a documentation compendium in four languages, and a worked demo of every type the
system registers.

### ⚠ Breaking changes

* **Requires Foundry VTT v14** (14.366 minimum). It no longer runs on v11 to v13.
* **The `vehicule` Actor type is gone**, replaced by `vehicle`, and **no migration is shipped** — the
  two share almost no field, so a conversion would carry almost nothing across. An Actor of the old
  type is **not deleted**: its row stays in the database. But Foundry can no longer build it, so it
  disappears from the Actors directory and the console reports *is not a valid type* on every load.
  If you have vehicles, **write down what they carried before you upgrade** and enter them again on
  the new sheet.
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
* **A qualification roll can carry a conditional DM** — *DM+2 if SOC 9+*, the shape some careers and
  some species print, which until now had to be remembered and applied by hand.
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
* **Missiles and torpedoes** (Companion ch. 29), behind three switches. A salvo is **typed** —
  standard, dogfight, interceptor or torpedo — and its class decides the range bands it may be
  launched in. Defence resolves in three layers: area defence, point defence, and the Core's close-in
  fire. A container launcher spends a hardpoint, so a hull under 100 tons may carry none.
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
* **A maintenance stamp**: the ship records the campaign day it was last serviced, and the sheet says
  how many four-week periods it is overdue. Nothing is rolled and no modifier is derived — Core p.154
  says maintenance *should* be done, so the DMs for skipping it stay the referee's.
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

### Reputation and contracts

* **Reputation (REP)** joins the characteristics a table may adopt, off by default. It reads like any
  other — `REP 0` is DM−3 — and the Reputation Change roll takes **DM−1 for every four REP already
  held**, so a name already made is harder to grow. The eleven printed circumstances overlap on
  purpose, and **only the highest one applies**: they are never summed.
* **A bounty contract** as an Item type, and it is the **party's** document — the portion the book
  hands over. The referee's own rows fold behind a courtesy on the same sheet: the reward floor, the
  last known location, who knows what, the complications. The subject may be a person, a place or a
  thing, and the subject, the issuer, the associates and the hunter are each a dropped world Actor
  that degrades to a stored name for a reader who cannot see it.
* **The party rolls its own contract.** The two rolls the book gives them — negotiating the fee, and
  qualifying for a contract their Reputation does not reach — are made from the players' seats, on a
  document they cannot otherwise edit.
* **A generator tab** draws one from the printed tables: client, priority, subject, reward,
  complication, eight draws each landing in the field its step names.

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
* **One palette, and it belongs to the reader.** Four presets, eleven accent colours, and a *light or
  dark* axis that follows Foundry by default or overrules it for this system alone. Every colour on a
  sheet derives from that one accent, and every text token was measured at 4.5:1 or better on every
  ground. Two switches go with it: a dark window bar on both grounds, and a colour-blind pair for
  success and failure. Five client settings, and none of them asks for a reload. **The three themes of
  0.1.x are gone** — a client holding one is migrated and keeps its colour.
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
* **Two demo compendiums, annotated**: one document for **every type and sub-type the system
  registers** — 8 Actors and 27 Items, each named `Demo — `. Every one carries what the document is
  for, what reads each field, and the one trap it exists to show. A worked example rather than a
  starter world, and every figure in it is invented.
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
