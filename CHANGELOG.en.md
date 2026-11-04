# Changelog — MGT2

[Français](CHANGELOG.fr.md) · [Español](CHANGELOG.es.md) · [Português (Brasil)](CHANGELOG.pt-BR.md)

---

## [0.2.9]

**Verified on Foundry VTT 14.369.**

**A guide to the system, a demo that goes all the way through creation, and ships, fleets, vehicles
and robots brought back into line with their books.** Thirty pages describe the system, and a `?` in
the title bar opens them at the window's own page. The demo compendiums gain five careers, four
shared tables, five Travellers and a Scene. Playing those Travellers brought creation defects to
light, and writing the guide those of ships, fleets, regions and sheets: what changes a game in
progress comes first.

### ⚠ Breaking changes

* **An ageing crisis also fails a change of assignment and refuses a *Career offered*** (Core p.20,
  p.49). In a career set to *Re-qualify, keep rank*, the change fails with no roll and no pick of
  assignment, even where *Automatic if* would spare the Traveller the roll. They stay in their
  assignment, without penalty, and the term log says why. *Free, every term* takes no roll and stays
  allowed. A *Career offered* no longer waives the roll: the Qualification fails, the offer stays
  owed and is not spent, and a forced entry still goes through. Two rulings.
* **PSI aged to 0 is no longer a crisis, and every psionic ability is lost for good** (Aliens of
  Charted Space 1 p.275). The Traveller no longer risks death and owes no care, and the care for
  another crisis does not lift their PSI. The PSI test, training, learning, powers and talents
  learned as skills are refused; the talents stay on the sheet, with no effect. A grant that would
  raise PSI is refused, and ageing no longer offers a PSI already at 0. **The book prints this for
  Zhodani Travellers, and the system applies it to every Traveller**, because it does not know who
  is Zhodani: a ruling. **A career whose Qualification reads PSI alone, such as the Psion (Core
  p.236), is shut**: another ruling, since the book speaks only of abilities. All of it is read off
  the recorded losses, so a Traveller already created whose PSI aged to 0 comes under it from this
  release on, even if the care was paid. A loss written before the PSI test locks nothing, and the
  test erases it.
* **An automatic entry no longer escapes the no-return rule** (Core p.18). A career set to
  *Automatic*, or whose *Automatic if* threshold the Traveller meets, cannot be taken up again in
  the term after leaving it. The draft, a career compelled or offered, a career always open and a
  change of assignment still escape it.
* **A speciality written only in an Item's name counts as the one in the field** (Core p.58), for
  grants and for the skill cap. A grant with no speciality, *Electronics* 1, now creates its own row
  beside *Electronics (Comms)*, instead of raising it. A ruling. **A Traveller already doubled is
  not corrected.**
* **Vacuum and temperature now wound only Travellers and NPCs** (Core p.82), **and vacuum a
  biological robot.** A *Vacuum* or *Temperature* region also wounded the vehicle, spacecraft or
  robot standing in it. A robot now follows its own rule (Robot Handbook p.34, see *Regions and
  hazards*). A *Radiation* region still reaches robots.
* **A disabled or destroyed Jump Drive refuses the jump** (Core p.154), on the voyage and at a
  station alike, and the voyage screen greys the button. **At a station it also refuses every
  Engineer (j-drive) check, a repair action typed with that speciality included**: a ruling. A
  repair action typed *Engineer* with no speciality still goes through. At a station, that
  speciality is read only under its English or French name, such as `Engineer (j-drive)`.
* **A fleet's dispersal now has its effects** (High Guard p.122). While its rounds run, it holds
  repairs, the start of a break-off, Split, Detach and Fold, but neither fire nor Morale, and its DM
  reaches the *Offensive DM*. After a failure, a new result waits until the two rounds have passed,
  and Split and Detach stay shut until a dispersal succeeds. Leaving Morale open, holding the whole
  fleet and shutting Split after a failure are three rulings.
* **The standing DMs of whoever rolls (states, armour, augments, Active Effects) now also reach
  station, vehicle, trade and revival rolls.** A fatigued engineer rolls lower than before, with
  nothing changed on the sheet.

### Creation

* **A career unlocked stays unlocked after a failed roll** (Core p.17, p.46). The *Career unlocked*
  entry is spent on entering the career, no longer before the Qualification roll, and lapses by its
  own duration. A failure no longer costs the referee's leave.
* **A compelled career that cannot be found no longer strands the Traveller.** A *Career compelled*
  that neither the world nor a compendium holds, or that names none where no forced-entry career
  exists, is dropped, with a warning and a message to the player and the referee. Until now every
  career refused the Traveller, with neither the draft nor a career always open on offer.
* **A chain of sub-tables follows up to ten tables**, stops at a table already rolled, and says so
  in a warning and the term log. It used to stop silently after two hops.
* **A *Career offered* no longer opens a career set to *Entered only when sent*** (Core p.52). The
  player is refused; a sentence, a draft or the referee still opens it.
* **A demotion stops at the lowest rank the ladder prints, and never raises a rank.** An officer at
  rank 1 fell to a rank 0 their ladder does not have. No book covers the case: a ruling.
* **The ageing row records the age at the end of the term** (Core p.48): the fourth term ages at 34,
  no longer at 30. Injury, care and event rows keep the age the term began.
* **Creation writes the Traveller's age**: *Finish* fills the *Age* field when it is blank. An age
  typed by hand stays, and an age creation wrote is kept up to date.
* ***Automatic if* also waives the roll for a change of assignment** under *Re-qualify, keep rank*,
  since that roll repeats the same Qualification line. A ruling.
* **A change of assignment that passes, or a free one, writes its line in the term log**, naming
  both assignments.

### Regions and hazards

* **Exposure to vacuum is counted per combat** (Core p.82). A token left in a *Vacuum* region kept a
  past combat's round, and the next combat's cumulative damage stayed stuck at 1D. Exposure starts
  over at 1 in each combat and climbs round by round.
* **The *Radiation* rule switched off really does switch radiation off.** A region no longer rolls
  any, and no card announces that 0 of armour stopped the dose. A robot ignored the rule and now
  follows it.
* **Two hazards at the same moment no longer erase each other.** The second wrote over the total
  read before the first, and a wound was lost: they now apply one after the other.
* **Deleting a token exposed to vacuum** no longer throws an error in the console.
* **A robot in vacuum follows Robot Handbook p.34.** A *Vacuum* region halves its endurance and
  announces a malfunction check every hour, every two hours with hostile environment protection, and
  none with vacuum environment protection: the referee rolls it, the system does not schedule it.
  The sheet gains *Biological robot*, for a robot that suffers as the lifeform it is modelled on,
  and *Vacuum sealing*, which outranks the option rows: left blank, only the printed English names
  are read. Setting that field to *Vacuum* gives a robot already in the region its endurance back at
  once, and leaving the region or deleting its Scene gives it back too. A robot already in the
  region when the system is updated is halved only at its next entry. Keeping half endurance under
  hostile protection is a ruling (p.32 and p.34).
* **An NPC now takes a radiation dose** (Core p.79, p.81), and its sheet gains its Rads and the
  nausea state. A creature takes it on Hits, with no END (Core p.84).

### Ships, fleets and voyage

* **An ion shot from a station no longer hurts the hull through armour** (High Guard p.30). The
  weapon's traits now follow the shot to the damage, a missile salvo included.
* **A Manoeuvre Drive critical weighs on piloting checks** (Core p.154, p.170), Initiative excepted.
  **A Jump Drive critical weighs on every Engineer (j-drive) check** (Core p.170, p.171), on the
  voyage and at a station alike, and the voyage screen shows it. At a station, these skills are read
  only under their English or French name.
* **A ship's header counts people, not crew rows**: a full ship no longer reads short.
* **A ship's defence screens** (*Nuclear damper*, *Meson screen*, *Black globe*) **are set on the
  sheet**, in the *Mounts & weapons* block, in edit mode.
* **The *Set the range band from two tokens* tool also places a ship that joined by drag and drop.**
* **The fleet screen gains *Split into a new fleet* and *Fold one fleet into another*** (High Guard
  p.122), and a first hull can be dropped on a new fleet. Split asks for no task chain, a departure
  from the book, which requires one.
* **Fold asks for confirmation**, because the system does not know who is an ally. **Morale asks
  which fleet opposes** once several remain, after a Split for instance. With no opponent,
  *Celestial terrain* is 0.
* **A freight or mail lot with no deadline** no longer writes "campaign day null", and still says
  payment falls on delivery.
* **The Red Zone tooltip** now says what the system applies: traffic is still rolled there, at DM-4
  for passengers and DM-6 for freight, and enforcing the ban falls to the referee (Core p.239-240,
  p.260).

### Sheets and rolls

* **A creature has a field for its Hits.**
* **Armour on an NPC or a robot can be seen and worn**: both sheets gain its row.
* **A typed Custom DM shows in the card's terms**, with its operator if it has one.
* **An Active Effect written to `system.modifiers.skills.<slug>.effect` at last reaches that skill's
  roll.**
* **Vehicles** (Vehicle Handbook 2026). *Clear every critical* covers every location and leaves
  Structure, which has its own repair (p.11). A Hull critical of Severity 5 or 6 halves Structure,
  rounded up (p.10), and the *Structure halved* counter is corrected by hand. A mount's fire control
  reaches the roll and gives the weapon the *Scope* trait (p.101, p.104); it outranks the weapon's
  own. A vehicle entered by hand gains its *Structure* and *Comfort* fields.
* **A robot's software and brain** open and delete from its sheet.
* **A stash says a drag copies**: its strings said "taken". A locked stash no longer tells a player
  its rows are "never sent". The container created from the inventory is called *New Container* in
  the interface's language.

### Guide

* **The compendium *MGT2 — Guide to the system*** (`mgt2.guide`) **arrives, in thirty pages**: what
  the system is and is not, setting up a world, a first Traveller, a first check, a first fight and
  a first ship, then every sheet and screen, the optional rules, the settings, macros and the API,
  and what the system deliberately does not do.
* **The guide exists in English only**, and English is what shows in all four languages. A French
  reader therefore reads the English; the French translation is to come.
* **A `?` in the title bar opens the guide at the window's own page**: on the Traveller, NPC,
  vehicle, spacecraft, robot, world, stash and item sheets, and on creation, space combat, the
  voyage, the Docket and the roll prompt. Fleet battles, trade and the compendium explorer carry
  none: their pages are read in the compendium. The *Show the guide button* setting, which belongs
  to each browser, removes it.

### Demo

* **Five Travellers out of the creation loop** in *MGT2 — Demo actors, annotated*, each from a blank
  Actor, with its notes: *Demo — Tamsin Reeve* (the cadet school with honours, then the patrol),
  *Demo — Corvin Dray* (a refusal, the draft, a Mishap and the surgeon's bill), *Demo — Mirel Aston*
  (a creation left open: once imported, she waits on the creation screen in her third term), *Demo —
  Hesper Lund* (an ageing crisis paid for, a pension and a debt) and *Demo — Joren Pask* (the
  university, a change of assignment, a contact, a rival and an ally).
* **A Scene**, *Demo — Bellweather Roads*, in a new compendium, *MGT2 — Demo scenes, annotated*
  (`mgt2.demo-scenes`): a *Vacuum* region and a *Radiation* region to cross with a token. The second
  acts on entry, the first at the start of each combat round: with no combat, it does nothing to a
  Traveller.
* **Five careers and four shared tables** in *MGT2 — Demo items, annotated*, so that a creation
  played on the system alone has somewhere to go after a refusal, once these documents are imported
  into the world. Between them they carry the draft, the career always open, automatic entry, the
  referee's leave, forced entry and release, a commission and a change of assignment. The careers
  are *Demo — Reach Guard*, *Demo — Fen Holders*, *Demo — Quay Hands*, *Demo — Pilots' Guild* and
  *Demo — Harbour Lock-up*.
* **A demo skill carries its real name**: *Seafarer* and no longer *Demo — Seafarer*, on the Item
  and in every reference to it. A demo career thus raises the skill the Traveller holds, instead of
  creating a second one.
* **A demo document left in its compendium now answers only to its name.** It no longer puts itself
  forward after a refusal, for a forced entry naming no career, for "any other career", in an open
  skill pick or in a voucher's list. Imported into the world, it answers like any other document.
* **The demo's values are all invented.** *Demo — Harbour Patrol*, *Demo — Harbour Cadet School*,
  *Demo — Engineer's Toolkit*, *Demo — Cargo Lot* and *Demo — Kestrel-class Courier* change their
  figures, and the Kestrel at last has a power plant sized to its systems. A document already
  imported keeps its own.

### Documentation

* **The rules audit journal** (`mgt2.docs`) **is now whole in Spanish and Brazilian Portuguese**,
  the two lists of each screen included. **No reader of those languages has gone through it with the
  books open**: its terms come from the language files, then from Mongoose's community vocabulary,
  English stands where neither names the term, and a term may yet change.
* **The same journal** follows this release: the ageing crisis with the change of assignment, the
  career offered and PSI, the age creation writes, fleet dispersal and the robot in vacuum.

### Fixes

* **The sheet no longer shows raw keys.** A loss written by creation gave the internal name of its
  table, such as `personalDevelopment`: it now reads in the interface's language, rows already
  recorded included, and a note typed by hand stays as it is. A converted contact's note and a
  spending note are written translated; those already written do not change.
* **The loss window of a creation injury talks about injury**, no longer about ageing.
* **A grant finds the skill held whatever the case of its speciality**: *Electronics (comms)* raises
  *Electronics (Comms)* instead of creating a second one.
* **A weapon or power whose bound skill is written by name** opens the roll prompt on that skill, no
  longer on *Not proficient*.
* **A loss row billed to the Traveller**, ageing crisis care included, **also goes into their
  finance notes.**
* **In English, the *Ally* relation was spelled *Allie*.**
* **For macros**: `TravellerActorSheet.checkModifiers` becomes `RollPromptHelper.checkModifiers`.

---

## [0.2.8]

**Verified on Foundry VTT 14.369.**

### Rolls, cards and requests

* **Another speciality of a skill rolls at +0** (Core p.58). A Traveller holding only Pilot
  (spacecraft) 1 is no longer unskilled at flying a small craft: on Pilot (small craft) they roll at
  +0, without the DM-3. A skill entered without a speciality, such as "Pilot" 2, counts at its level.
  Only a Traveller who holds the skill in no form at all stays not proficient. Creation throws, an
  armour's required skill, augments and training read the same level.
* **The roll prompt offers *Pilot, another speciality* at +0**, for each skill the Traveller holds
  only in specialities, after their own skills.
* **A ship's station, the Docket and the *Roll request* card start on that entry**, instead of on
  *Not proficient*, when the Traveller lacks the speciality asked for. The Docket then resolves the
  demand for that Traveller instead of leaving it unresolved, and the card reads *Pilot, another
  speciality 0*. With an `@Request` link the player still chooses, and the entry is in the list.

### Fixes

* **A speciality entered in the *Speciality* field, rather than in the skill's name, is recognised
  everywhere** (Core p.58). A "Pilot" Item whose field says *spacecraft* is Pilot (spacecraft) for
  creation throws, the Connections Rule, training, Dodge, a ship's stations, the Docket, `@Request`
  links, augments and armour. Until now only its display and creation's grants read that field;
  everywhere else, a roll on Pilot (spacecraft) did not find the skill.

---

## [0.2.7]

**Verified on Foundry VTT 14.369.**

**Creation read a third time, from the rows the books print.** A new audit started from the books'
Events and Mishaps tables rather than from the code. It found a term that never closed after an
ejection, about ten other defects, and more than a hundred rows the career form could not hold: a
choice with two outcomes, a natural 2, a skill of the player's choice, a consequence that turns on
the Traveller's SOC or sex. They can be typed now
([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). The system still ships no career: it
runs the ones the referee types or imports.

### ⚠ Breaking changes

* **The untrained DM-3 no longer applies during creation unless you ask for it** (Core p.11). The
  2022 printing keeps every modifier from the later chapters out of creation; the rule *The untrained
  DM-3 applies during creation*, which followed a 2018 answer, is therefore off by default. A world
  that never changed it now plays without it: to keep it, turn it back on in *Optional and variant
  rules*.
* **A Mishap rolled from an Event ejects when it says so** (Core p.18: a Mishap ejects unless
  otherwise stated). An Events row that sends to the Mishaps can let the Mishap decide: *As the Mishap
  says*, in its *Ejects* menu. A row added to an Events table starts on that choice. **Rows already
  typed do not change**: at *Stays in the career*, the Mishap they roll still never ejects. Set to *As
  the Mishap says* those that do not print "you are not ejected", such as Agent event 3, Entertainer
  event 8 and Noble event 8.
* **The Injury menu no longer offers *No injury*** (Core p.49). It kept the table off the branch a
  row did not take; *What earns the roll on the sub-table* does that now. **A row already typed that
  injures on one branch only**, a failure for instance, now rolls the Injury table every time: give
  it that condition.
* **A creation injury that takes a characteristic to 0 is no longer a crisis for life** (Core p.49),
  under the rule *A creation injury to zero is an ageing crisis*, on by default. The crisis lasts only
  while the characteristic stays at 0: the care that restores it ends it. Before the losses apply,
  the player sees the price of care and may place them differently. An ageing loss to 0 is still a
  crisis for life.
* **The same education cannot be attended twice** (Core p.16): another may follow the first, but the
  one already attended is refused.
* **A natural 12 on Advancement no longer holds a Traveller whom an Event bars from re-enlisting or
  sends to another career** (Core p.18; p.45, Scout event 3): they can only leave, and the career
  closes. The 12 holds them only against their own choice to leave. A ruling: the book prints both
  rules without saying which wins.
* **A Mishap that ejects costs the term's Benefit roll, wherever it came from** (Core p.18; p.23,
  Agent mishap 2). Only a failed Survival roll cost it until now. An Event that ejects without going
  through a Mishap keeps the roll. A ruling.
* **An effect on Benefit rolls met during an education carries to the first career after it**, gain
  or loss alike, as graduation's DMs do (Core p.16). It was lost with the education, which has no
  Benefit roll. A ruling.

### Events and Mishaps rows

The career form now holds what these rows print. A row already typed plays as before, except for what
the breaking changes above say.

* **Two rolls to choose from, each at its own target** (Core p.45, Scout event 3;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): the *Or instead* block adds an *Other
  roll*, with its skills and its target. The player picks which to attempt, and the row's branches
  follow the roll made.
* **Every consequence of a row takes its branch** (Core p.23, p.45;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): *What earns the grant*, *What earns
  the roll on the sub-table*, *What earns the ejection* and *What earns the career* join the
  conditions Benefit rolls, the track and pending entries already had. Ejection and a compelled
  career are now decided after the roll, and a grant made *before the throw* but bound to a branch
  waits for the roll. A row already typed stays at *Always*.
* **A natural 2** (Core p.23, Agent mishap 3; p.35, Merchant event 8): *Only if the row's throw came
  up a natural 2*. A row that prints "roll 2D" with no skill is typed with a target alone.
* **"If you accept… if you refuse…": one question per row** (Core p.46, Life Event 11; p.57,
  Prisoner event 3). *Only if the Traveller accepts* and *Only if the Traveller refuses* read a single
  answer, asked once before the roll; a refusal makes no roll. *Only if the Traveller takes it* is
  still one question per consequence.
* **The row says how it rolls the Injury table, and who is hurt** (Core p.49; p.23, Agent mishaps 2
  and 5): *Once*, *Twice, keeping the lower*, *Twice, keeping the higher*, *Severely injured (a result
  of 2)*. One mode asks nothing, several are the player's pick, none offers all four. *An associate*
  is hurt at no cost to the Traveller.
* **A skill of the player's choice** (Core p.17, p.23, p.25, p.57): a skill grant can let the player
  pick — *Any skill*, *A skill already held*, *A skill gained this term*, *The skill thrown* — except
  those listed in *except, comma-separated*, such as Jack-of-all-Trades. *Any skill* suggests the
  Traveller's own, the world's and the compendiums', and takes a name that is not on the list.
* **A second grant, with its own condition** (Core p.17, Pre-career event 4; p.31, Entertainer event
  3; p.45, Scout event 3): *What the row also grants*, for a row that gives one thing on each branch.
* **A roll on the skill the row has just granted** (Core p.17, Pre-career event 10; p.27, Citizen
  event 3): *on the skill the row granted* or *on a skill gained this term*.
* **A roll keyed to an assignment** (Core p.37, Navy mishap 3): a roll's *Assignment* field. A
  Traveller in that assignment makes that roll without being asked, and the other assignments' rolls
  are not offered.
* **A row gated on the Traveller's state** (Aliens of Charted Space 1 p.45, p.137, p.259): *Gated on*
  a characteristic between two bounds, a sex or a track rung. Each consequence takes a side, *Only if
  the row's gate is met* or *Only if the row's gate is not met*, and the term log says which. The gate
  is read once, before the row changes anything, so the SOC loss it imposes cannot flip it. A gate not
  met asks the row's question of no one and makes no optional roll, and a Traveller with no sex
  recorded meets no sex gate. Three rulings.
* **A row moves a species track**, such as the K'kree degree (Aliens of Charted Space 1 p.131-137),
  and no longer only the career's own.
* **A characteristic set, or a loss stopped at a minimum** (Aliens of Charted Space 1 p.23, p.274):
  the *Set to* mode gives the characteristic the value typed, either way, since an Aslan made Outcast
  has SOC 2 even from lower. The *floor* box now appears with *Add* too, where it stops a loss without
  ever raising a score already below it. Two rulings.
* **A pending entry for the next term only** (Core p.46, Unusual Event 1): *The next term only* lapses
  when the term after it closes.

### Shared tables

* **A row can roll a table of the career's own** (Core p.57, the Prisoner's Prison Event;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): the *Sub-table* field takes the name
  of a career of kind *Shared table*, rolled on 1D where its rows stop at 6, else on 2D. A name no
  table carries shows a warning and a line in the log; it used to do nothing, or roll Life Events
  instead.

### Pre-career education

* **The commission roll graduation allows is made before the first term** (Core p.16-17;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). A new pending entry, *Commission roll
  before the first term*, goes on the *Graduated* arm with the scope *The first career after
  graduating*. On entering that career the player may attempt it: passed, the Traveller starts at
  officer rank 1, with its bonus, and the term's Advancement stays open. Failed or declined, the first
  term keeps its own commission roll, and an officer who entered this way takes no enlisted rank 0
  bonus: two rulings. **An education already typed does not change**: its DM and its automatic pass
  wait for the first term's roll; to follow the book, add the entry to its *Graduated* arm.
* **What graduation leaves ends with the first career** (Core p.16): a career offered, compelled or
  unlocked by graduation lapses as soon as the Traveller enters a career. An academy graduate who
  joined the Navy first used to keep automatic entry to the Army.

### Psionics

* **A talent taken as basic training is a check to learn it** (Core p.229), as on a skill table; it
  used to be granted at level 0.
* **Telepathy is free only as the very first talent** (Core p.228): a new course no longer makes it
  free again.

### Mustering out

* **The extra Benefit rolls for rank read the highest rank reached** (Core p.46), enlisted rank
  included: a rank-4 sergeant who was commissioned no longer musters out on officer rank 1. Two
  careers sharing a rank ladder no longer share their highest rank.
* **Several one-shot Benefit DMs pending: the roll asks which it uses** (Core p.46). The *DMs on this
  roll* window ticks them all by default; those unticked wait for a later roll.
* **A Benefit roll discarded on the closing screen** no longer leaves its DM choice standing.

### Documentation

* **The rules audit journal** (`mgt2.docs`) describes creation as it now stands, and says which of
  its points are rulings.

### Fixes

* ⚠ **A term ended by an ejection never closed** (Core p.11, p.18). After a Mishap that ejects, the
  skill roll the rule *An ejected Traveller still takes the term's skill roll* keeps was refused, and
  the term stayed open: no term served, four years short in age, and everything that counts terms,
  from ageing to PSI and the pension, short with it. The term now closes with its four years. **A
  Traveller already created is not corrected**: if they were ejected during creation, check their age
  and terms.
* **A skill name is recognised however its words are separated**
  ([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): "Jack of all Trades" is
  Jack-of-all-Trades. Typed that way, it kept the untrained DM-3, was offered as an ordinary roll,
  training did not bar it, and a creation grant made a second Item beside it.
* **A skill typed with its speciality**, "Pilot (spacecraft)", goes under Pilot with its speciality,
  instead of becoming a separate skill (Core p.19).
* **Changing assignment rolls qualification with its DMs** (Core p.20): the age DM, the DM per
  previous career, the conditional DMs and the species' own, which were missing.
* **An Advancement DM carried over to the commission roll, or an automatic pass, could remove
  another entry that looked like it**, such as another career's Benefit DM (Core p.19). Each now
  removes exactly the entry it used.
* **A step taken with no career in progress**, such as anagathics at the start of a term, is not
  taken again (Core p.49).
* **A shared-table row rolled from a Mishap that does not eject** can no longer eject (Core p.23).

---

## [0.2.6]

**Verified on Foundry VTT 14.369.**

### Creation

* **A rank bonus no longer raises a skill already held** (Core p.18;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). A rank prints its skill with a
  level — Recon 1, Leadership 1 — and the Traveller gains it only if that level is higher than the
  one they hold. A grant added to a rank row now starts at *Only if it is higher*; it used to start
  at *Grant at 1, or raise by 1*, which took a held Recon 1 to 2. **Careers typed before 0.2.6 are
  not changed**: set their rank bonuses to *Only if it is higher* by hand.
* **"SOC 10 or SOC +1, whichever is higher" is easier to find**: a Characteristic grant now offers
  only *Add* and *Raise by 1, but never below*, and the *floor* box appears with the second, in
  place of the value it does not read.
* **A grant shows only the fields its kind uses**: a Skill grant no longer shows a characteristic,
  a Contact no longer shows a skill, and so on.

### Demo

* **`Demo — Harbour Patrol`'s rank bonuses are *Only if it is higher***: Seafarer 1 at Recruit and
  Investigate 1 at Senior Officer no longer raise a skill the Traveller already holds.

---

## [0.2.5]

**Verified on Foundry VTT 14.368.**

### Creation

* **A row that borrows another career's tables finally rolls them** (Core p.23, Agent event 8;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). The *Its tables borrowed, without
  entering* mode only wrote a sentence in the term log. Each of the borrowed career's three tables —
  Events, a skill table, Mishaps — is rolled on the branch the row names: always, only if its check
  passed, only if it failed, or if the Traveller takes it. The Traveller never enters that career.
* **Several careers, or any**: *Names another career* takes several names separated by commas
  ("Rogue, Citizen") and the player picks one; left blank, every other career is offered.
* **The skill table is chosen**: any of its assignment tables, or its Service Skills, Personal
  Development, Advanced Education or Officer table.
* **A borrowed Mishap never ejects from the career being served**: the borrowing row decides, as for
  "Disaster! Roll on the Mishap table". The borrowed skill roll costs the term's own nothing.

---

## [0.2.4]

**Verified on Foundry VTT 14.368.**

### Demo

* **`Demo — Harbour University`** joins the demo items: an invented university, the counterpart to
  `Demo — Harbour Cadet School`. It teaches from its own skill table, one skill at level 0 and one
  at level 1, rolls its own Events, and graduation, with or without honours, leaves a qualification
  DM for `Demo — Harbour Patrol` and, with honours, a DM on the first Commission roll.

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
