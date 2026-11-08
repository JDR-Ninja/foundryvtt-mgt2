# Changelog — MGT2

[English](CHANGELOG.en.md) · [Español](CHANGELOG.es.md) · [Português (Brasil)](CHANGELOG.pt-BR.md)

---

## [0.2.10]

**Vérifié sur Foundry VTT 14.370.**

**Une armure qui protège davantage contre un type de dégâts, et un équipement qui n'agit que porté**
([#8](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/8)). La seconde Protection qu'imprime le
Central Supply Catalogue, `+1 (+6 vs. lasers)`, s'applique maintenant aux dégâts, et celle des
robots aussi.

### ⚠ Ruptures

* **Un objet non équipé n'applique plus ses Effets Actifs.** Une armure, une arme ou un équipement
  ne transmet ses effets au Voyageur que s'il est équipé, et une augmentation que si elle est
  posée : un rembourrage rangé dans le sac ne coûte plus de MD de DEX. Un objet glissé sur une fiche
  arrive non équipé, comme avant, et ses effets attendent qu'on l'équipe. Les effets d'un talent,
  d'une espèce, d'une carrière ou d'une maladie ne changent pas, et un objet du monde qui
  n'appartient à aucun acteur montre toujours ses effets actifs sur sa propre fiche.
* **La seconde valeur d'un trait Armour s'ajoute contre son type de dégâts** (Robot Handbook p.32).
  `Armour (+7, +10 vs. lasers)` protège de 17 contre un laser et de 7 contre le reste, comme le
  Reflec d'un robot, qui s'ajoute à son armure. Le trait n'était qu'affiché : les robots imprimés
  qui le portent encaissent maintenant 10 de moins d'un laser. Sur un PNJ créature, le panneau dit
  si la seconde valeur s'applique ; une condition qui ne nomme aucun type, comme `vs. psionics`, ne
  s'applique pas.

### Armure et dégâts

* **Une armure peut avoir une Protection conditionnelle** (CSC p.18). En mode édition, sa fiche
  prend une seconde valeur et les types de dégâts qu'elle couvre. Contre une attaque d'un de ces
  types, cette valeur **remplace** la Protection de l'armure : l'Ablat, `+1 (+6 vs. lasers)`, arrête
  6 contre un laser et 1 contre le reste, et un Reflec porté sur une autre armure ajoute ses 10
  contre les lasers seulement. Une valeur de 0 compte : le bouclier d'énergie personnel,
  `+12 (+0 vs. lasers)`, laisse passer les lasers (CSC p.13). Remplacer plutôt qu'ajouter est une
  interprétation. Il faut que l'arme porte son type de dégâts. L'usure de l'Ablat, −1 par tir de
  laser, reste à l'arbitre.
* **Deux types de dégâts de plus, Plasma et Énergie**, pour les armes et les armures (CSC p.18). Il
  n'y a pas de type psionique : la protection du Neural Sheath contre les psioniques ne s'applique
  pas.
* **La fiche montre la Protection conditionnelle** sous la Protection de la ligne d'armure,
  « 6 vs. Laser », et dans une infobulle sur l'Armure de l'en-tête du Voyageur, du PNJ et du robot,
  qui donne la Protection contre chaque type.

### Correctifs

* **Entreposer un objet avec le bouton de la fiche le déséquipe.** Il restait équipé dans le sac, sa
  Protection et ses effets toujours comptés. La liste de rangement de la fiche d'objet et le
  glisser-déposer dans un conteneur le déséquipaient déjà.
* **L'onglet Effets se met à jour quand on équipe ou déséquipe un objet**, sans attendre que toute
  la fiche soit redessinée.

---

## [0.2.9]

**Vérifié sur Foundry VTT 14.369.**

**Un guide du système, une démonstration qui va jusqu'au bout de la création, et les vaisseaux, les
flottes, les véhicules et les robots remis d'accord avec leurs livres.** Trente pages décrivent le
système, et un `?` dans la barre de titre les ouvre à la page de la fenêtre. Les compendiums de
démonstration gagnent cinq carrières, quatre tables communes, cinq Voyageurs et une Scène. Jouer ces
Voyageurs a mis au jour des défauts de création, et écrire le guide ceux des vaisseaux, des flottes,
des régions et des fiches : ce qui change une partie en cours vient en premier.

### ⚠ Ruptures

* **Une crise de vieillissement fait aussi échouer un changement d'affectation et refuse une
  *Carrière proposée*** (Core p.20, p.49). Dans une carrière réglée sur *Se requalifier, garder son
  rang*, le changement échoue sans jet et sans choix d'affectation, même si *Automatique si*
  dispense le Voyageur du jet. Il reste dans son affectation, sans pénalité, et le journal de la
  période dit pourquoi. *Libre, à chaque période* ne demande aucun jet et reste permis. Une
  *Carrière proposée* ne dispense plus du jet : la qualification échoue, l'offre reste due et n'est
  pas dépensée, et une entrée forcée passe toujours. Deux interprétations.
* **La PSI réduite à 0 par le vieillissement n'est plus une crise, et toutes les capacités
  psioniques sont perdues pour toujours** (Aliens of Charted Space 1 p.275). Le Voyageur ne risque
  plus la mort et ne doit aucun soin, et les soins d'une autre crise ne relèvent pas sa PSI. Le test
  de PSI, la formation, l'apprentissage, les pouvoirs et les talents appris comme compétences sont
  refusés ; les talents restent sur la fiche, sans effet. Une attribution qui relèverait la PSI est
  refusée, et le vieillissement ne propose plus une PSI déjà à 0. **Le livre l'imprime pour les
  Voyageurs zhodani, et le système l'applique à tous les Voyageurs**, parce qu'il ne sait pas qui
  est Zhodani : une interprétation. **Une carrière dont la Qualification ne lit que la PSI, comme le
  Psion (Core p.236), est fermée** : une autre interprétation, car le livre ne parle que des
  capacités. Tout cela se lit sur les pertes enregistrées, si bien qu'un Voyageur déjà créé dont la
  PSI a vieilli jusqu'à 0 y passe dès cette version, même s'il avait payé les soins. Une perte
  inscrite avant le test de PSI ne verrouille rien, et le test l'efface.
* **Une entrée automatique n'échappe plus à la règle du non-retour** (Core p.18). Une carrière
  *Automatique*, ou dont le Voyageur atteint le seuil *Automatique si*, ne se reprend pas à la
  période qui suit son départ. La conscription, une carrière imposée ou proposée, une carrière
  toujours ouverte et un changement d'affectation y échappent toujours.
* **Une spécialité écrite seulement dans le nom d'un objet compte comme celle du champ** (Core
  p.58), pour l'attribution et pour le plafond de compétences. Une attribution sans spécialité,
  *Electronics* 1, crée maintenant sa propre ligne à côté d'*Electronics (Comms)*, au lieu de la
  relever. Une interprétation. **Un Voyageur déjà doublé n'est pas corrigé.**
* **Le vide et la température ne blessent plus que les Voyageurs et les PNJ** (Core p.82), **et le
  vide un robot biologique.** Une région *Vide* ou *Température* blessait aussi le véhicule, le
  vaisseau ou le robot qui s'y trouvait. Un robot suit maintenant sa propre règle (Robot Handbook
  p.34, voir *Régions et dangers*). Une région *Radiations* touche toujours les robots.
* **Un Propulseur-S désactivé ou détruit refuse le saut** (Core p.154), au voyage comme à un poste,
  et l'écran de voyage grise le bouton. **À un poste, il refuse aussi tout jet d'Ingénieur
  (propulseur de saut), action de réparation écrite avec cette spécialité comprise** : une
  interprétation. Une action de réparation écrite *Engineer* sans spécialité passe toujours. À un
  poste, cette spécialité ne se lit que sous son nom anglais ou français, comme
  `Engineer (j-drive)`.
* **La dispersion d'une flotte produit maintenant ses effets** (High Guard p.122). Tant que ses
  rounds courent, elle suspend les réparations, le début d'une rupture du combat, la séparation, le
  détachement et la jonction, mais ni le tir ni le Moral, et son MD atteint le *MD offensif*. Après
  un échec, un nouveau résultat attend que les deux rounds soient passés, et la séparation et le
  détachement restent fermés jusqu'à une dispersion réussie. Laisser le Moral ouvert, retenir toute
  la flotte et fermer la séparation après un échec sont trois interprétations.
* **Les MD permanents de celui qui lance (états, armure, augmentations, Effets Actifs) atteignent
  aussi les jets de poste, de véhicule, de commerce et de réanimation.** Un ingénieur fatigué lance
  plus bas qu'avant, sans que sa fiche ait changé.

### Création

* **Une carrière débloquée le reste après un jet raté** (Core p.17, p.46). L'entrée *Carrière
  débloquée* se dépense en entrant dans la carrière, et non plus avant le jet de qualification, et
  disparaît selon sa propre durée. Un échec ne fait plus perdre l'accord de l'arbitre.
* **Une carrière imposée introuvable n'immobilise plus le Voyageur.** Une *Carrière imposée* que ni
  le monde ni un compendium ne contient, ou qui n'en nomme aucune alors qu'aucune carrière à entrée
  forcée n'existe, est retirée, avec un avertissement et un message au joueur et à l'arbitre.
  Jusqu'ici toutes les carrières refusaient le Voyageur, sans proposer la conscription ni une
  carrière toujours ouverte.
* **Un enchaînement de sous-tables va jusqu'à dix tables**, s'arrête sur une table déjà tirée, et le
  dit dans un avertissement et le journal de la période. Il s'arrêtait en silence après deux
  renvois.
* **Une *Carrière proposée* n'ouvre plus une carrière *On n'y entre que si l'on y est envoyé***
  (Core p.52). Le joueur est refusé ; une condamnation, une conscription ou l'arbitre l'ouvrent
  toujours.
* **Une rétrogradation s'arrête au rang le plus bas que l'échelle imprime, et ne relève jamais un
  rang.** Un officier de rang 1 tombait à un rang 0 que son échelle n'a pas. Aucun livre ne prévoit
  ce cas : une interprétation.
* **La ligne de vieillissement inscrit l'âge de la fin de la période** (Core p.48) : la quatrième
  période vieillit à 34 ans, non plus à 30. Les lignes de blessure, de soins et d'événement gardent
  l'âge du début de la période.
* **La création écrit l'âge du Voyageur** : *Terminer* remplit le champ *Âge* s'il est vide. Un âge
  saisi à la main reste, et un âge écrit par la création se met à jour.
* ***Automatique si* dispense aussi du jet de changement d'affectation** sur *Se requalifier, garder
  son rang*, puisque ce jet relance la même ligne de Qualification. Une interprétation.
* **Un changement d'affectation réussi, ou libre, écrit sa ligne au journal de la période**, avec
  les deux affectations.

### Régions et dangers

* **L'exposition au vide se compte par combat** (Core p.82). Un jeton resté dans une région *Vide*
  gardait le round d'un combat passé, et les dégâts cumulatifs du combat suivant restaient bloqués à
  1D. L'exposition repart de 1 à chaque combat et monte de round en round.
* **La règle *Radiations* désactivée coupe vraiment les radiations.** Une région n'en lance plus, et
  aucune carte n'annonce qu'une armure de 0 a arrêté la dose. Un robot ignorait la règle et la suit
  maintenant.
* **Deux dangers au même instant ne s'effacent plus.** Le second écrivait sur le total lu avant le
  premier, et une blessure se perdait : ils s'appliquent maintenant l'un après l'autre.
* **Supprimer un jeton exposé au vide** ne produit plus d'erreur dans la console.
* **Un robot dans le vide suit le Robot Handbook p.34.** Une région *Vide* réduit son endurance de
  moitié et annonce un jet de panne toutes les heures, toutes les deux heures avec une protection
  contre les environnements hostiles, et aucun avec une protection contre le vide : l'arbitre le
  lance, le système ne le planifie pas. La fiche gagne *Robot biologique*, pour un robot qui souffre
  comme le vivant dont il suit le modèle, et *Étanchéité au vide*, qui l'emporte sur les lignes
  d'options : sans ce choix, seuls les noms anglais imprimés sont lus. Régler ce champ sur *Vide*
  rend aussitôt l'endurance à un robot déjà dans la région, et quitter la région ou supprimer sa
  Scène la rend aussi. Un robot déjà dans la région lors de la mise à jour n'est réduit qu'à sa
  prochaine entrée. Conserver la demi-endurance sous protection hostile est une interprétation (p.32
  et p.34).
* **Un PNJ prend maintenant sa dose de radiations** (Core p.79, p.81), et sa fiche gagne ses Rads et
  l'état de nausée. Une créature la prend sur ses Points de vie, sans END (Core p.84).

### Vaisseaux, flottes et voyage

* **Un tir d'ion depuis un poste ne blesse plus la coque à travers l'armure** (High Guard p.30). Les
  traits de l'arme suivent maintenant le tir jusqu'aux dégâts, salve de missiles comprise.
* **Un critique de Propulseur-M pèse sur les jets de pilotage** (Core p.154, p.170), l'Initiative
  exceptée. **Un critique de Propulseur-S pèse sur tout jet d'Ingénieur (propulseur de saut)** (Core
  p.170, p.171), au voyage comme à un poste, et l'écran de voyage l'affiche. À un poste, ces
  compétences ne se lisent que sous leur nom anglais ou français.
* **L'en-tête d'un vaisseau compte les personnes, et non les lignes d'équipage** : un vaisseau
  complet ne s'affiche plus à court.
* **Les écrans de défense d'un vaisseau** (*Amortisseur nucléaire*, *Écran à mésons*, *Sphère
  noire*) **se règlent sur la fiche**, dans le bloc *Montures & armes*, en mode édition.
* **L'outil *Fixer la zone de portée d’après deux jetons* place aussi un vaisseau entré par
  glisser-déposer.**
* **L'écran des flottes gagne *Séparer en une nouvelle flotte* et *Rejoindre une autre flotte***
  (High Guard p.122), et une première coque peut se déposer sur une flotte neuve. La séparation ne
  demande aucune chaîne de tâches, à l'écart du livre, qui en exige une.
* **Faire rejoindre une flotte demande confirmation**, car le système ne sait pas qui est allié.
  **Le Moral demande quelle flotte s'oppose** dès qu'il en reste plusieurs, après une séparation par
  exemple. Sans adversaire, le *Terrain céleste* vaut 0.
* **Le lot de fret ou de courrier sans échéance** n'écrit plus « jour de campagne null », et dit
  toujours que le paiement se fait à la livraison.
* **L'infobulle de la Zone Rouge** dit maintenant ce que le système applique : le trafic s'y tire
  toujours, à MD-4 pour les passagers et MD-6 pour le fret, et faire respecter l'interdiction
  revient à l'arbitre (Core p.239-240, p.260).

### Fiches et jets

* **Une créature a un champ pour ses Points de vie.**
* **Une armure sur un PNJ ou un robot se voit et se porte** : les deux fiches gagnent sa ligne.
* **Un MD personnalisé saisi apparaît dans les termes de la carte**, avec son opérateur s'il en a
  un.
* **Un Effet Actif écrit sur `system.modifiers.skills.<slug>.effect` atteint enfin le jet de cette
  compétence.**
* **Véhicules** (Vehicle Handbook 2026). *Effacer tous les critiques* couvre tous les emplacements
  et laisse la Structure, qui a sa propre réparation (p.11). Un critique de coque de Sévérité 5 ou 6
  divise la Structure, arrondie au supérieur (p.10), et le compteur *Structure réduite de moitié* se
  corrige à la main. La conduite de tir d'une monture atteint le jet et donne à l'arme le trait
  *Viseur* (p.101, p.104) ; elle l'emporte sur celle de l'arme. Un véhicule saisi à la main gagne
  ses champs *Structure* et *Confort*.
* **Le logiciel et le cerveau d'un robot** s'ouvrent et se suppriment depuis sa fiche.
* **Une réserve dit qu'un glisser copie** : ses textes disaient « pris ». Une réserve verrouillée ne
  dit plus à un joueur que ses lignes ne sont « jamais envoyées ». Le conteneur créé depuis
  l'inventaire s'appelle *Nouveau Conteneur* dans la langue de l'interface.

### Guide

* **Le compendium *MGT2 — Guide du système*** (`mgt2.guide`) **arrive, en trente pages** : ce que le
  système est et n'est pas, la mise en place d'un monde, un premier Voyageur, un premier jet, un
  premier combat et un premier vaisseau, puis chaque fiche et chaque écran, les règles optionnelles,
  les paramètres, les macros et l'API, et ce que le système ne fait pas exprès.
* **Le guide n'existe qu'en anglais**, et c'est l'anglais qui s'affiche dans les quatre langues. Un
  lecteur français lit donc l'anglais ; la traduction française est à venir.
* **Un `?` dans la barre de titre ouvre le guide à la page de la fenêtre** : sur les fiches de
  Voyageur, de PNJ, de véhicule, de vaisseau, de robot, de monde, de réserve et d'objet, sur la
  création, le combat spatial, le voyage, le Docket et la fenêtre de jet. Les batailles entre
  flottes, le commerce et l'explorateur de compendiums n'en portent pas : leurs pages se lisent dans
  le compendium. Le paramètre *Afficher le bouton du guide*, propre à chaque navigateur, le retire.

### Démonstration

* **Cinq Voyageurs sortis de la boucle de création** dans *MGT2 — Acteurs de démonstration,
  annotés*, chacun à partir d'un Acteur vierge, avec ses notes : *Demo — Tamsin Reeve* (l'école de
  cadets avec mention, puis la patrouille), *Demo — Corvin Dray* (un refus, la conscription, un Aléa
  et la note du chirurgien), *Demo — Mirel Aston* (une création interrompue : une fois importée,
  elle attend sur l'écran de création, à sa troisième période), *Demo — Hesper Lund* (une crise de
  vieillissement payée, une pension et une dette) et *Demo — Joren Pask* (l'université, un
  changement d'affectation, un contact, un rival et un allié).
* **Une Scène**, *Demo — Bellweather Roads*, dans un nouveau compendium, *MGT2 — Scènes de
  démonstration, annotées* (`mgt2.demo-scenes`) : une région *Vide* et une région *Radiations* à
  traverser avec un jeton. La seconde agit à l'entrée, la première au début de chaque round de
  combat : sans combat, elle ne fait rien à un Voyageur.
* **Cinq carrières et quatre tables communes** dans *MGT2 — Objets de démonstration, annotés*, pour
  qu'une création jouée avec le seul système ait où aller après un refus, une fois ces documents
  importés dans le monde. Elles portent la conscription, la carrière toujours ouverte, l'entrée
  automatique, l'accord de l'arbitre, l'entrée forcée et la libération, le Commandement et le
  changement d'affectation. Les carrières sont *Demo — Reach Guard*, *Demo — Fen Holders*, *Demo —
  Quay Hands*, *Demo — Pilots' Guild* et *Demo — Harbour Lock-up*.
* **Une compétence de démonstration porte son vrai nom** : *Seafarer* et non plus *Demo — Seafarer*,
  sur l'objet comme dans chaque référence. Une carrière de démonstration relève ainsi la compétence
  que le Voyageur détient, au lieu de lui en créer une seconde.
* **Un document de démonstration laissé dans son compendium ne répond plus qu'à son nom.** Il ne se
  propose plus de lui-même après un refus, pour une entrée forcée sans nom, pour « une autre
  carrière », dans un choix libre de compétence ou dans la liste d'un bon. Importé dans le monde, il
  répond comme n'importe quel document.
* **Les valeurs de la démonstration sont toutes inventées.** *Demo — Harbour Patrol*, *Demo —
  Harbour Cadet School*, *Demo — Engineer's Toolkit*, *Demo — Cargo Lot* et *Demo — Kestrel-class
  Courier* changent de chiffres, et le Kestrel a enfin un générateur à la mesure de ses systèmes. Un
  document déjà importé garde les siens.

### Documentation

* **Le journal d'audit des règles** (`mgt2.docs`) **est maintenant entier en espagnol et en
  portugais (Brésil)**, avec les deux listes de chaque écran. **Aucun lecteur de ces langues ne l'a
  relu livres en main** : les termes viennent des fichiers de langue, puis du vocabulaire
  communautaire de Mongoose, l'anglais reste là où ni l'un ni l'autre ne nomme le terme, et un terme
  peut encore changer.
* **Le même journal** suit cette version : la crise de vieillissement avec le changement
  d'affectation, la carrière proposée et la PSI, l'âge écrit par la création, la dispersion des
  flottes et le robot dans le vide.

### Correctifs

* **La fiche n'affiche plus de mots-clés bruts.** Une perte écrite par la création donnait le nom
  interne de sa table, comme `personalDevelopment` : elle se lit maintenant dans la langue de
  l'interface, lignes déjà enregistrées comprises, et une note saisie à la main reste telle quelle.
  La note d'un contact converti et celle d'une dépense s'écrivent traduites ; celles déjà écrites ne
  changent pas.
* **La fenêtre des pertes d'une blessure de création parle de blessure**, et non plus de
  vieillissement.
* **Une attribution trouve la compétence détenue quelle que soit la casse de sa spécialité** :
  *Electronics (comms)* relève *Electronics (Comms)* au lieu d'en créer une seconde.
* **Une arme ou un pouvoir dont la compétence liée est écrite par son nom** ouvre la fenêtre de jet
  sur cette compétence, et non plus sur *Incompétent*.
* **Une ligne de perte facturée au Voyageur**, soins d'une crise de vieillissement compris,
  **s'inscrit aussi dans ses notes financières.**
* **En anglais, la relation *Ally* s'écrivait *Allie*.**
* **Pour les macros** : `TravellerActorSheet.checkModifiers` devient
  `RollPromptHelper.checkModifiers`.

---

## [0.2.8]

**Vérifié sur Foundry VTT 14.369.**

### Jets, cartes et demandes

* **Une autre spécialité de la compétence se lance à +0** (Core p.58). Un Voyageur qui n'a que Pilot
  (spacecraft) 1 n'est plus incompétent pour piloter un petit vaisseau : sur Pilot (small craft), il
  lance à +0, sans le MD-3. Une compétence saisie sans spécialité, comme « Pilot » 2, compte à son
  niveau. Seul un Voyageur qui n'a la compétence sous aucune forme reste incompétent. Les jets de
  création, la compétence qu'exige une armure, les augmentations et la formation lisent ce même niveau.
* **La fenêtre de jet propose *Pilot, autre spécialité* à +0**, pour chaque compétence que le
  Voyageur n'a que dans des spécialités, après ses propres compétences.
* **Le poste d'un vaisseau, le Docket et la carte *Demande de jet* partent sur cette entrée**, au lieu
  d'*Incompétent*, quand le Voyageur n'a pas la spécialité demandée. Le Docket résout alors la demande
  pour ce Voyageur au lieu de la laisser non résolue, et la carte affiche *Pilot, autre spécialité 0*.
  Avec un lien `@Request`, c'est toujours le joueur qui choisit, et l'entrée figure dans la liste.

### Correctifs

* **Une spécialité saisie dans le champ *Spécialité*, et non dans le nom de la compétence, est
  reconnue partout** (Core p.58). Un objet « Pilot » dont le champ dit *spacecraft* est Pilot
  (spacecraft) pour les jets de création, la règle des connexions, la formation, l'Esquive, les postes
  d'un vaisseau, le Docket, les liens `@Request`, les augmentations et l'armure. Jusqu'ici, seuls son
  affichage et les attributions de création lisaient ce champ ; partout ailleurs, un jet sur Pilot
  (spacecraft) ne trouvait pas la compétence.

---

## [0.2.7]

**Vérifié sur Foundry VTT 14.369.**

**La création relue une troisième fois, à partir des lignes que les livres impriment.** Un nouvel
audit est parti des tables d'Événements et d'Aléas des livres plutôt que du code. Il a trouvé une
période qui ne se fermait pas après une éjection, une dizaine d'autres défauts, et plus d'une centaine
de lignes que le formulaire de carrière ne savait pas saisir : un choix à deux issues, un 2 naturel,
une compétence au choix, une conséquence qui dépend du SOC ou du sexe du Voyageur. Elles se saisissent
maintenant ([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). Le système ne livre
toujours aucune carrière : il fait tourner celles que l'arbitre saisit ou importe.

### ⚠ Ruptures

* **Le MD-3 de non-formé ne s'applique plus pendant la création, sauf si vous le demandez** (Core
  p.11). L'édition 2022 du livre écarte de la création tout modificateur venu des chapitres suivants ;
  la règle *Le MD-3 de non-formé s'applique pendant la création*, qui suivait une réponse de 2018,
  est donc désactivée par défaut. Un monde qui ne l'avait jamais modifiée joue désormais sans : pour
  la garder, réactivez-la dans *Règles optionnelles et variantes*.
* **Un Aléa tiré depuis un Événement fait quitter la carrière quand il le dit** (Core p.18 : un Aléa
  éjecte, sauf indication contraire). Une ligne d'Événement qui renvoie aux Aléas peut laisser l'Aléa
  en décider : *Comme le dit l'Aléa*, dans son menu *Éjecte*. Une ligne ajoutée à une table
  d'Événements part sur ce choix. **Les lignes déjà saisies ne changent pas** : à *Reste dans la
  carrière*, l'Aléa qu'elles tirent n'éjecte toujours pas. Passez à *Comme le dit l'Aléa* celles
  qui n'impriment pas « vous n'êtes pas éjecté », comme les Événements 3 de l'Agent, 8 du Média et 8
  du Noble.
* **Le menu des Blessures ne propose plus *Pas de blessure*** (Core p.49). Il servait à écarter la
  table sur la branche qu'une ligne ne prenait pas ; c'est maintenant le rôle de *Ce qui déclenche le
  jet sur la sous-table*. **Une ligne déjà saisie qui ne blesse que sur une branche**, un échec par
  exemple, tire désormais les Blessures à chaque fois : donnez-lui cette condition.
* **Une blessure de création qui mène une caractéristique à 0 n'est plus une crise pour la vie**
  (Core p.49), sous la règle *Une blessure de création à zéro est une crise de vieillissement*,
  activée par défaut. La crise ne dure que tant que la caractéristique reste à 0 : les soins qui la
  rétablissent y mettent fin. Avant que les pertes s'appliquent, le joueur voit le prix des soins et
  peut les placer autrement. Une perte de vieillissement à 0 reste une crise pour la vie.
* **La même éducation ne se suit pas deux fois** (Core p.16) : une autre peut suivre la première,
  mais celle déjà suivie est refusée.
* **Un 12 naturel à l'Avancement ne retient plus un Voyageur qu'un Événement empêche de se réengager
  ou envoie dans une autre carrière** (Core p.18 ; p.45, Événement 3 de l'Éclaireur) : il ne peut que
  partir, et la carrière se ferme. Le 12 ne l'oblige à rester que contre son propre choix de partir.
  Une interprétation : le livre imprime les deux règles sans dire laquelle l'emporte.
* **Un Aléa qui fait quitter la carrière coûte le jet d'Avantage de la période, d'où qu'il vienne**
  (Core p.18 ; p.23, Aléa 2 de l'Agent). Seul un échec de Survie le coûtait jusqu'ici. Un Événement
  qui éjecte sans passer par un Aléa garde le jet. Une interprétation.
* **Un effet sur les jets d'Avantage rencontré pendant une éducation passe à la première carrière qui
  suit**, gain comme perte, comme les MD du diplôme (Core p.16). Il se perdait avec l'éducation, qui
  n'a pas de jet d'Avantage. Une interprétation.

### Lignes d'Événement et d'Aléa

Le formulaire de carrière saisit maintenant ce que ces lignes impriment. Une ligne déjà saisie se joue
comme avant, sauf ce que disent les ruptures ci-dessus.

* **Deux jets au choix, chacun à sa difficulté** (Core p.45, Événement 3 de l'Éclaireur ;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)) : le bloc *Ou à la place* ajoute un
  *Autre jet*, avec ses compétences et sa difficulté. Le joueur choisit lequel tenter, et les branches
  de la ligne suivent le jet fait.
* **Chaque conséquence d'une ligne prend sa branche** (Core p.23, p.45 ;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)) : *Ce qui déclenche ce que la ligne
  accorde*, *Ce qui déclenche le jet sur la sous-table*, *Ce qui déclenche le départ de la carrière*
  et *Ce qui déclenche la carrière* rejoignent les conditions qu'avaient déjà les jets d'Avantage, la
  piste et les entrées en attente. Le départ et la carrière imposée se décident désormais après le
  jet, et une attribution faite *avant le jet* mais liée à une branche attend le jet. Une ligne déjà
  saisie reste sur *Toujours*.
* **Un 2 naturel** (Core p.23, Aléa 3 de l'Agent ; p.35, Événement 8 du Marchand) : *Seulement si le
  jet de la ligne fait un 2 naturel*. Une ligne qui imprime « lancez 2D » sans compétence se saisit
  avec une difficulté seule.
* **« Si vous acceptez… si vous refusez… » : une seule question par ligne** (Core p.46, Événement de
  la vie 11 ; p.57, Événement 3 du Prisonnier). *Seulement si le Voyageur accepte* et *Seulement si
  le Voyageur refuse* lisent une seule réponse, demandée une fois avant le jet ; un refus ne fait pas
  le jet. *Seulement si le Voyageur la prend* reste une question par conséquence.
* **La ligne dit comment elle tire les Blessures, et qui est blessé** (Core p.49 ; p.23, Aléas 2 et 5
  de l'Agent) : *Une fois*, *Deux fois, en gardant le plus bas*, *Deux fois, en gardant le plus
  haut*, *Gravement blessé (un résultat de 2)*. Un seul mode ne demande rien, plusieurs laissent le
  choix au joueur, aucun les propose tous. *Un proche* est blessé sans que le Voyageur perde rien.
* **Une compétence au choix** (Core p.17, p.23, p.25, p.57) : une attribution de compétence peut
  laisser le joueur choisir — *N'importe quelle compétence*, *Une compétence déjà possédée*, *Une
  compétence acquise cette période*, *La compétence jetée* — sauf celles que liste *sauf, séparées
  par des virgules*, comme Jack-of-all-Trades. *N'importe quelle compétence* propose celles du
  Voyageur, du monde et des compendiums, et accepte un nom absent de la liste.
* **Une seconde attribution, avec sa propre condition** (Core p.17, Événement de pré-carrière 4 ;
  p.31, Événement 3 du Média ; p.45, Événement 3 de l'Éclaireur) : *Ce que la ligne accorde aussi*,
  pour une ligne qui donne une chose sur chaque branche.
* **Un jet sur la compétence que la ligne vient d'accorder** (Core p.17, Événement de pré-carrière
  10 ; p.27, Événement 3 du Citoyen) : *sur la compétence accordée par la ligne* ou *sur une
  compétence acquise cette période*.
* **Un jet propre à une affectation** (Core p.37, Aléa 3 de la Marine spatiale) : le champ
  *Affectation* d'un jet. Un Voyageur dans cette affectation fait ce jet sans qu'on le lui demande, et
  les jets des autres affectations ne lui sont pas proposés.
* **Une ligne conditionnée à l'état du Voyageur** (Aliens of Charted Space 1 p.45, p.137, p.259) :
  *Conditionnée à* une caractéristique entre deux bornes, un sexe ou un échelon de piste. Chaque
  conséquence prend un côté, *Seulement si la condition de la ligne est remplie* ou *Seulement si la
  condition de la ligne n'est pas remplie*, et le journal de la période dit lequel. La condition se lit
  une fois, avant que la ligne ne change quoi que ce soit, si bien que la perte de SOC qu'elle impose
  ne la fait pas basculer. Une condition non remplie ne pose pas la question de la ligne et ne fait
  pas son jet facultatif, et un Voyageur sans sexe enregistré ne remplit aucune condition de sexe.
  Trois interprétations.
* **Une ligne déplace une piste de l'espèce**, comme le degré des K'kree (Aliens of Charted Space 1
  p.131-137), et plus seulement celle de la carrière.
* **Une caractéristique fixée, ou une perte arrêtée à un minimum** (Aliens of Charted Space 1 p.23,
  p.274) : le mode *Fixer à* donne à la caractéristique la valeur saisie, dans un sens comme dans
  l'autre, puisqu'un Aslan devenu Paria a SOC 2 même s'il était plus bas. La case *plancher* apparaît
  aussi avec *Ajouter*, où elle arrête une perte sans jamais relever une valeur déjà plus basse. Deux
  interprétations.
* **Une entrée en attente pour la période suivante seulement** (Core p.46, Événement inhabituel 1) :
  *La période suivante seulement* disparaît quand la période qui suit se ferme.

### Tables communes

* **Une ligne peut tirer une table propre à la carrière** (Core p.57, l'Événement de prison du
  Prisonnier ; [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)) : le champ *Sous-table*
  accepte le nom d'une carrière du type *Table commune*, tirée sur 1D si ses lignes s'arrêtent à 6,
  sinon sur 2D. Un nom qu'aucune table ne porte affiche un avertissement et une ligne au journal ; il
  ne faisait rien, ou tirait les Événements de la vie à la place.

### Éducation pré-carrière

* **Le jet de Commandement que permet le diplôme se fait avant la première période** (Core p.16-17 ;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). Une nouvelle entrée en attente, *Jet
  de Commandement avant la première période*, se pose sur la branche *Diplômé* avec la portée *La
  première carrière après le diplôme*. En entrant dans cette carrière, le joueur peut le tenter :
  réussi, le Voyageur commence au rang d'officier 1, avec son bonus, et l'Avancement de la période
  reste ouvert. Raté ou refusé, la première période garde son propre jet de Commandement, et un
  officier entré ainsi ne touche pas le bonus du rang 0 enrôlé : deux interprétations. **Une éducation
  déjà saisie ne change pas** : son MD et sa réussite automatique attendent le jet de la première
  période ; pour suivre le livre, ajoutez l'entrée à sa branche *Diplômé*.
* **Ce que le diplôme laisse s'arrête à la première carrière** (Core p.16) : une carrière proposée,
  imposée ou débloquée par le diplôme disparaît dès que le Voyageur entre dans une carrière. Un
  diplômé d'académie entré d'abord dans la Marine spatiale gardait l'entrée d'office dans l'Armée.

### Psionique

* **Un talent reçu en formation de base est un test pour l'apprendre** (Core p.229), comme sur une
  table de compétences ; il était donné au niveau 0.
* **La Télépathie n'est gratuite que comme tout premier talent** (Core p.228) : une nouvelle
  formation ne la rend plus gratuite à nouveau.

### Fin de carrière

* **Les jets d'Avantage supplémentaires dus au rang lisent le rang le plus élevé atteint** (Core
  p.46), rang enrôlé compris : un sergent de rang 4 devenu officier ne finit plus sur son rang
  d'officier 1. Deux carrières qui partagent une échelle de rangs ne partagent plus leur plus haut
  rang.
* **Plusieurs MD d'Avantage à usage unique en attente : le jet demande lesquels il utilise** (Core
  p.46). La fenêtre *MD sur ce jet* les coche tous par défaut ; ceux qu'on décoche attendent un jet
  suivant.
* **Un jet d'Avantage abandonné sur l'écran de clôture** ne laisse plus son choix de MD en suspens.

### Documentation

* **Le journal d'audit des règles** (`mgt2.docs`) décrit la création telle qu'elle est maintenant, et
  dit lesquels de ses points sont des interprétations.

### Correctifs

* ⚠ **Une période terminée par une éjection ne se fermait pas** (Core p.11, p.18). Après un Aléa qui
  fait quitter la carrière, le jet de compétence que garde la règle *Un Voyageur éjecté garde le jet
  de compétence de la période* était refusé, et la période restait ouverte : aucune période servie,
  quatre ans d'âge en moins, et tout ce qui compte les périodes, du vieillissement à la PSI et à la
  pension, à l'avenant. La période se ferme maintenant avec ses quatre ans. **Un Voyageur déjà créé
  n'est pas corrigé** : s'il a été éjecté pendant sa création, vérifiez son âge et ses périodes.
* **Un nom de compétence se reconnaît quelle que soit la façon d'en séparer les mots**
  ([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)) : « Jack of all Trades » est
  Jack-of-all-Trades. Écrit ainsi, il gardait le MD-3 de non-formé, était proposé comme un jet
  ordinaire, la formation ne l'excluait pas, et une attribution de création créait un second objet à
  côté.
* **Une compétence saisie avec sa spécialité**, « Pilot (spacecraft) », se range sous Pilot avec sa
  spécialité, au lieu de devenir une compétence distincte (Core p.19).
* **Changer d'affectation relance la qualification avec ses MD** (Core p.20) : le MD d'âge, celui par
  carrière précédente, les MD conditionnels et ceux de l'espèce, qui manquaient.
* **Un MD d'Avancement reporté sur le jet de Commandement, ou une réussite automatique, pouvait
  retirer une autre entrée qui lui ressemblait**, comme le MD d'Avantage d'une autre carrière (Core
  p.19). Chacun retire désormais exactement l'entrée qu'il a utilisée.
* **Une étape jouée sans carrière en cours**, comme les anagathiques en début de période, ne se rejoue
  plus (Core p.49).
* **Une ligne de table commune tirée depuis un Aléa qui n'éjecte pas** ne peut plus faire quitter la
  carrière (Core p.23).

---

## [0.2.6]

**Vérifié sur Foundry VTT 14.369.**

### Création

* **Un bonus de rang n'augmente plus une compétence déjà acquise** (Core p.18 ;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). Un rang imprime sa compétence avec
  un niveau — Recon 1, Leadership 1 — et le Voyageur ne l'obtient que si ce niveau dépasse celui
  qu'il possède. Un gain ajouté à une ligne de rang part désormais sur *Seulement si c'est plus
  élevé* ; il partait sur *Donner au niveau 1, ou augmenter de 1*, qui faisait passer un Recon 1
  à 2. **Les carrières saisies avant la 0.2.6 ne changent pas** : passez leurs bonus de rang à
  *Seulement si c'est plus élevé* à la main.
* **« SOC 10 ou SOC +1, le plus élevé des deux » se trouve plus facilement** : un gain de
  Caractéristique ne propose plus que *Ajouter* et *Augmenter de 1, sans jamais descendre sous*, et
  la case *plancher* apparaît avec le second, à la place de la valeur qu'il ne lit pas.
* **Un gain n'affiche que les champs que son type utilise** : un gain de Compétence n'affiche plus
  de caractéristique, un Contact plus de compétence, et ainsi de suite.

### Démonstration

* **Les bonus de rang de `Demo — Harbour Patrol` passent à *Seulement si c'est plus élevé*** :
  Seafarer 1 au rang Recruit et Investigate 1 au rang Senior Officer n'augmentent plus une
  compétence que le Voyageur possède déjà.

---

## [0.2.5]

**Vérifié sur Foundry VTT 14.368.**

### Création

* **Une ligne qui emprunte les tables d'une autre carrière les lance enfin** (Core p.23, événement 8
  de l'Agent ; [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). Le mode *Ses tables
  empruntées, sans y entrer* écrivait seulement une phrase dans le journal de la période. Chacune des
  trois tables de la carrière empruntée — Événements, une table de compétences, Aléas — est lancée
  sur la branche que la ligne indique : toujours, seulement si son jet est réussi, seulement s'il a
  échoué, ou si le Voyageur la prend. Le Voyageur n'entre jamais dans cette carrière.
* **Plusieurs carrières, ou n'importe laquelle** : *Nomme une autre carrière* accepte plusieurs noms
  séparés par des virgules (« Rogue, Citizen ») et le joueur en choisit un ; laissé vide, toute autre
  carrière est proposée.
* **La table de compétences se choisit** : n'importe laquelle de ses tables d'affectation, ou sa
  table de Compétences de service, de Développement personnel, d'Éducation avancée ou d'Officier.
* **Un Aléa emprunté n'éjecte jamais de la carrière servie** : c'est la ligne qui emprunte qui en
  décide, comme pour « Désastre ! Faites un jet sur la table des Aléas ». Le jet de compétence
  emprunté ne coûte rien au jet de la période.

---

## [0.2.4]

**Vérifié sur Foundry VTT 14.368.**

### Démonstration

* **`Demo — Harbour University`** rejoint les objets de démonstration : une université inventée,
  pendant de `Demo — Harbour Cadet School`. Elle enseigne d'après sa propre table de compétences,
  une compétence au niveau 0 et une au niveau 1, lance ses propres Événements, et le diplôme, avec ou
  sans mention, laisse un MD de qualification pour `Demo — Harbour Patrol` et, avec mention, un MD
  sur le premier jet de Commandement.

---

## [0.2.3]

**Vérifié sur Foundry VTT 14.368.**

**La création relue règle par règle contre le livre.** Un audit complet de la création de Voyageurs
a trouvé une trentaine d'endroits où un champ, un contrôle ou une règle existaient sans que rien ne
les lise : un bonus de rang jamais versé, des entrées en attente sans effet, une conscription réduite
à une phrase. Tous sont corrigés, et l'éducation pré-carrière fonctionne enfin
([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). Le système ne livre toujours aucune
carrière ni aucune table : il fait tourner celles que l'arbitre saisit ou importe.

### ⚠ Ruptures

* **Un commandement obtenu ferme le jet d'Avancement de la période** (Core p.19). 0.2.0 à 0.2.2
  suivaient l'ancienne mise à jour du livre, qui l'autorisait ; l'édition 2022 dit le contraire, et
  c'est elle qui fait foi. Un jet de Commandement raté laisse l'Avancement ouvert.
* **Chaque jet de la période ne se fait qu'une fois** (Core p.18-19) : une étape déjà jouée est
  refusée au lieu d'être relancée, et une qualification refusée ferme la période aux autres
  carrières, sauf à une carrière toujours ouverte. L'arbitre peut rouvrir une étape jouée par erreur
  (↺ *Rouvrir cette étape*).
* **Une seule carrière à la fois** : déposer une carrière sur un Voyageur qui en sert déjà une est
  refusé.
* **Une carrière à entrée forcée, comme le Prisonnier, ne s'entre plus volontairement** (Core p.52) :
  on y entre par une condamnation laissée en attente, par la conscription ou par la main de l'arbitre.
* **Migration des mondes.** Aucune carrière servie n'avait reçu son affectation ni son échelle de
  rangs. À la première ouverture en 0.2.3, chaque carrière déjà servie reçoit son affectation là où
  elle manque et où le modèle n'en propose qu'une, puis l'échelle que nomme cette affectation. **Le
  rang n'est jamais modifié**, et les bonus de rang que la carrière n'a jamais versés ne sont pas
  payés après coup : l'arbitre en reçoit la liste dans un message privé.
* **Pour les scripts et les modules** : le test d'une ligne d'Événement nomme désormais une liste,
  `check.skills`, et non plus `check.skill` — un modèle enregistré avant est lu tel quel. La ligne
  des Factures médicales d'une carrière (`medicalBillsRow`) prend l'un de trois identifiants,
  `military`, `civilian` ou `independent`, et un libellé saisi comme le livre l'imprime reste reconnu.

### Éducation pré-carrière

* **Une carrière du type *Formation pré-carrière* suit enfin ses propres règles** (Core p.16-17) :
  l'entrée n'est possible que pendant les trois premières périodes, une tentative par période, avec
  le MD de la période ; un refus laisse la période à une carrière.
* **Pendant l'éducation** : les compétences qu'elle enseigne — une université les choisit dans sa
  propre table, une académie militaire les lit dans les Compétences de service de sa carrière —, un
  jet sur les Événements de pré-carrière, et **ni jet de Survie, ni Commandement, ni jet
  d'Avantage**. La période compte quand même pour l'âge, le vieillissement et la PSI.
* **Le diplôme** se lance comme l'éducation l'imprime, avec sa mention, son plancher d'échec et ses
  MD conditionnels. Ce qu'il laisse — un MD de qualification, un MD ou une réussite automatique au
  premier jet de Commandement, l'entrée d'office dans la carrière de l'académie — vaut pour **la
  première carrière tentée ensuite**, et disparaît si elle refuse le Voyageur. Un cadet qui échoue
  sans faire 2 ou moins garde sa place, sans jet de Commandement la première période ; un Événement
  « vous échouez à votre diplôme » interdit le jet.
* **Une éducation n'est pas une carrière précédente** (Core p.16) : la première carrière qui suit
  garde toute sa formation de base et ne prend pas le MD−1 par carrière précédente, sauf si la
  nouvelle règle optionnelle en décide autrement. Deux éducations successives sont possibles — une
  interprétation : le livre ne fixe que la fenêtre et une tentative par période.
* **Le formulaire de carrière gagne un bloc *Éducation*** : la fenêtre, les MD par période, la
  carrière liée, la durée (les 22 + 2D3 ans du Compagnon s'écrivent `4+2D3`), les compétences
  choisies, l'acquis d'entrée, et le diplôme avec ses trois issues. Les options du Compagnon
  (p.32-34) s'y écrivent aussi.

### Tables communes

* **Les Événements de la vie, l'Événement inhabituel, la Conscription, les Événements de
  pré-carrière et les Compétences de base ont un emplacement** : chacune est une carrière du type
  *Table commune*, que l'arbitre relie dans le menu *Tables de création communes* des réglages du
  monde. Le système n'en livre aucune.
* **La fiche d'une table commune n'affiche que son type et ses Événements** : le reste de la
  carrière, qu'une table ne lit pas, reste enregistré et revient si l'on repasse au type *Carrière*.
* **Une fois reliées, elles se jouent comme les lignes d'une carrière** : un 7 aux Événements tire
  les Événements de la vie, et une ligne qui nomme une table la tire et l'applique — contact,
  trahison, MD en attente, jet d'Avantage perdu, Prisonnier. Sans table reliée, le système dit
  toujours laquelle lancer au livre.
* **La conscription se joue** (Core p.19) : une qualification refusée propose la conscription, une
  fois dans la vie, une carrière toujours ouverte comme le Vagabond, ou de décider plus tard. La
  conscription tire la table reliée et fait entrer dans la carrière tirée, sur l'affectation
  imprimée, sans jet de qualification. Un Événement qui enrôle impose cette carrière la période
  suivante (Core p.17).
* **Les Compétences de base** proposent leur liste là où l'espèce n'en imprime pas (Core p.9).

### La période

* **Entrer dans une carrière demande l'affectation**, avant le jet, et écrit l'échelle de rangs
  qu'elle nomme. Changer d'affectation chez l'Agent, le Citoyen, le Média ou le Marchand ouvre une
  nouvelle carrière (Core p.20) : la période se ferme, et la suivante se qualifie pour la nouvelle
  affectation.
* **Les entrées en attente font ce qu'elles disent** : une réussite automatique passe la promotion
  ou le commandement sans dés, une interdiction empêche son jet, une carrière proposée s'entre sans
  qualification, une carrière imposée est la seule ouverte, une carrière bloquée retire *Continuer*,
  une carrière débloquée lève la permission de l'arbitre. Un MD d'Avancement peut servir au jet de
  Commandement, au choix du joueur (Core p.19). **L'arbitre ajoute ou retire une entrée à la main.**
* **Les lignes d'Événement** : leur effet sur les jets d'Avantage peut dépendre de leur propre test,
  et les paris de la Marine spatiale, du Marchand et du Trafiquant se jouent (Core p.35, p.37, p.41)
  — une mise acceptée, refusée ou choisie parmi les jets dus, et une victoire qui rapporte la
  moitié de la mise en plus, arrondie au supérieur. Un test « si vous saisissez cette occasion » peut
  être refusé. Une ligne peut accorder sa compétence **avant** son test, comme la Marine spatiale et
  le Trafiquant l'impriment ; un test imprimé sur deux ou trois compétences se fait sur la meilleure
  du Voyageur, et une ligne peut faire gagner un niveau à la compétence utilisée, comme le Marchand —
  une interprétation de l'ordre imprimé, qu'aucun errata ne tranche.
* **Blessures et soins** (Core p.49) : une ligne qui renvoie aux Blessures les tire comme elle
  l'imprime, le joueur place les pertes, et les soins coûtent Cr5000 par point, moins la part de
  l'employeur lue sur les Factures médicales ; le reste est une dette, payée d'abord sur l'argent de
  la fin de carrière (Core p.52).
* **Les anagathiques** (Core p.49) : à partir de SOC 10, deux jets de Survie par période, les
  périodes sous traitement en MD positif au vieillissement, 1D × Cr25000 par période portés en
  dette, et un jet de vieillissement dès qu'ils s'arrêtent ; un 2 exact mène au Prisonnier.
* **Le Prisonnier** (Core p.52, p.57) : le seuil de libération conditionnelle est tiré à l'entrée,
  un détenu ne peut pas partir, et la libération — par l'Avancement ou par une évasion — met fin à la
  carrière.

### Espèces

* **Les trois périodes minimum des Aslan dans une carrière avant d'en tenter une autre** (Aliens of
  Charted Space 1 p.19) : la décision de la période le rappelle, une carrière quittée volontairement
  trop tôt refuse la suivante — la fin de carrière reste ouverte —, et une carrière que l'espèce
  exempte, ou qu'un Événement propose ou impose, n'est jamais refusée.
* **Une carrière réservée à une espèce ou à un sexe** refuse les autres Voyageurs ; une espèce nommée
  sans sa variante les admet toutes.
* **Une caractéristique de remplacement** — le CHA des Vargr, la RES des Hivers (Aliens of Charted
  Space 1 p.179, 2 p.255) — s'affiche à la place de celle qu'elle remplace et prend sa place dans le
  PUP.
* **Les modificateurs et les dés d'une espèce peuvent dépendre du sexe**, comme ceux du Gurvin
  (Aliens of Charted Space 4 p.167) ; un Voyageur dont le sexe n'est pas encore fixé lance les dés
  communs, et la fenêtre le dit.
* **L'attribution des caractéristiques** : une case sur les dés propres à l'espèce, comme le 1D+6
  des Hivers, garde son jet ; un dé de bonus s'ajoute à ces dés-là ; une valeur imprimée plutôt que
  tirée, comme le TER à 0 des Aslan, compte comme fixée.
* **Une piste qui *ne fait que monter* ne redescend jamais**, quelle que soit la règle du monde.
* **Un cadre d'espèce impose sa caractéristique au jet de Survie et au Commandement**, comme il le
  faisait déjà pour l'Avancement.

### Fin de carrière

* **Un jet d'Avantage n'est proposé qu'à une carrière qui en doit encore** (Core p.46), et le compte
  ne passe plus sous zéro.
* **Les clauses de répétition imprimées** (Core p.47) : une arme reçue deux fois peut devenir un
  niveau de compétence, un nouveau quart de l'hypothèque est payé, un Vaisseau Éclaireur se
  relance.
* **Une augmentation de caractéristique s'arrête au maximum de l'espèce**, 15 pour un humain (Core
  p.9), et le SOC en excès tiré d'une table d'Avantages devient des parts de vaisseau (Core p.47).
* **Les parts de vaisseau versées dans le vaisseau gardé** ne rapportent plus les Cr1000 annuels
  (Core p.48 ; le compte par part est une interprétation), et finir la création quand plusieurs
  Voyageurs gardent un vaisseau est signalé.
* **Les modificateurs permanents atteignent le jet d'Avantage**, comme le FOL 10+ des Truthers
  (Compagnon p.36).
* **Les Cr10000 d'équipement achetable avant le jeu** s'affichent (Core p.46).

### Psionique

* **Une nouvelle formation psionique coûte Cr100000** (Core p.228) : la première est gratuite, et
  chaque nouvelle, qui remet à zéro le malus cumulatif, se paie sur l'argent du Voyageur ou en dette.
  Une interprétation : le livre ne donne aucun prix pendant la création.
* **Un talent tiré sur une table de compétences** est un test pour l'apprendre (Core p.229), et non
  plus un talent acquis d'office.

### Contacts

* **Un contact peut être lié à la fiche d'un Voyageur ou d'un PNJ** : déposez l'Acteur sur la fiche
  du contact, qui l'ouvre d'un clic et peut le délier.

### Règles optionnelles et variantes

* **La fenêtre des règles se parcourt par domaine** : un menu à gauche n'affiche qu'une page à la
  fois, et les dix-huit interprétations de la création — là où le livre est muet ou ambigu — ont
  leur propre page, rangée par étape. Chaque règle tient sur une ligne et son explication s'ouvre à
  la demande ; une recherche parcourt toutes les pages, et un filtre montre ce que votre table a
  modifié, que le menu compte aussi.
* **Nouvelle, activée** : *Un Voyageur éjecté garde le jet de compétence de la période* — une
  interprétation, le livre faisant perdre le jet d'Avantage et la carrière sans rien dire du jet de
  compétence (Core p.18). Le journal de la période dit dans quel sens elle joue.
* **Nouvelle, désactivée** : *L'éducation pré-carrière compte comme une carrière précédente*.
* *L'argent dépensé en création devient une dette* couvre aussi les soins, les anagathiques et une
  nouvelle formation psionique.

### Démonstration et documentation

* **`Demo — Harbour Cadet School`** rejoint les objets de démonstration : une académie liée à
  `Demo — Harbour Patrol`, pour voir une éducation du début à la fin.
* **`Demo — Harbour Life Events`** aussi : une table commune inventée, à relier dans *Tables de
  création communes*, dont les lignes montrent ce qu'une table fait — l'Événement inhabituel et les
  Blessures en renvoi, un jet d'Avantage perdu, un Rival ou un Ennemi, une trahison, des MD en
  attente, une interdiction.
* **`Demo — Harbour Patrol` montre les nouvelles lignes d'Événement** : un test facultatif, un pari
  avec l'attribution avant le test, un test sur deux compétences qui fait gagner un niveau à celle
  utilisée, une réussite automatique en attente. Elle verse son bonus de rang 0 et nomme sa ligne des
  Factures médicales.
* **Le journal d'audit des règles** (`mgt2.docs`) décrit la création telle qu'elle est maintenant.

### Correctifs

* **Les bonus de rang enrôlés et civils n'étaient jamais versés** : seul un grade d'officier payait,
  après un commandement. Le rang 0 est versé à l'entrée, et chaque promotion verse le sien (Core
  p.19).
* **« Faites un jet sur la table des Aléas » ne lançait pas la table** (Core p.23). Elle se lance, et
  le Voyageur reste dans la carrière quand la ligne le dit.
* ⚠ **Le formulaire de carrière effaçait des données à chaque enregistrement** : la référence d'un
  Autre Avantage, la relation d'un contact (Allié, Rival, Ennemi), le plancher de « SOC 10 ou SOC +1 »
  et une liste de spécialités disparaissaient dès qu'on modifiait un autre champ, et un MD de
  qualification conditionnel ne pouvait pas se saisir. Une carrière importée puis retouchée en a
  peut-être perdu : vérifiez-la.
* **Un MD « pour votre prochain jet de Survie » était dépensé par le jet de vieillissement**, et un
  MD d'Avancement durable s'ajoutait aux tests des Événements.
* **Un Aléa qui n'éjecte pas annulait quand même** l'Événement, le Commandement et l'Avancement de
  la période (Core p.18).
* **Une Connexion n'ajoutait rien à une compétence déjà tenue** (Core p.19) : elle l'élève d'un
  niveau, jusqu'à 3.
* **Les pertes du vieillissement pouvaient toutes tomber sur la même caractéristique** (Core p.49).
* **La Télépathie n'était gratuite que tant qu'aucun talent n'était tenu** : elle l'est tant qu'aucun
  test n'a été tenté (Core p.228-229).
* **Le nombre de compétences de base** différait entre la pastille et la fenêtre de choix, et une
  espèce qui les donne « en plus », comme les Hivers, les voyait occuper le compte.
* **Une colonne *Cash* vide**, dans une carrière saisie à la main, versait Cr0 et consommait un
  jet : elle demande désormais le montant. Un avantage de caractéristique ou de compétence choisi à
  la main s'applique aussitôt.
* **La création en solo n'accordait pas sa compétence de niveau 1**, et un Voyageur mort en Homme de
  fer continuait sa période (Compagnon p.13).

---

## [0.2.2]

**Vérifié sur Foundry VTT 14.368.**

### Correctifs

* **La fenêtre *Règles optionnelles et variantes* défile** : la fin de la liste était inaccessible,
  même en plein écran ([#6](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/6)). Trois fenêtres
  avaient le même défaut : la description complète d'une espèce, le choix d'un bénéfice de fin de
  carrière et la *Formation psionique*.
* Changer d'espèce pendant la création n'affiche plus d'avertissement de compatibilité dans la
  console.

---

## [0.2.1]

**Les pas que la création n'avait jamais eus.** 0.2.0 livrait la boucle des périodes sans les trois
étapes qui la précèdent, et sans les contrôles de plusieurs règles qu'il calculait pourtant déjà.

### Création de Voyageurs

* **Les caractéristiques se lancent**, depuis l'écran de création — une pastille avant les périodes,
  qui garde le PUP obtenu — et depuis le bandeau de la fiche une fois la création lancée.
* **Les quatre méthodes d'attribution du réglage fonctionnent** : ordre libre, ordre imprimé, ou les
  12D du Companion répartis par paires, variante héroïque comprise. Là où un cadre impose ses propres
  dés, ou là où les dés de bonus sont en jeu, la réserve est refusée **en une phrase** plutôt qu'en
  silence.
* **Les compétences de jeunesse se prennent** (Core p.9) — DM d'EDU + 3, une deuxième pastille avant
  les périodes, au niveau 0. Une compétence que le cadre *déclare* remplit sa ligne : elle est
  imposée et non proposée.
* **La Force Psionique se teste et se travaille** (Core p.228), là où la table a adopté la
  caractéristique — le test d'abord, puis la fenêtre de formation : l'échelle des talents, la
  Télépathie offerte en premier, le malus cumulatif par tentative. **Une nouvelle formation est un
  contrôle à part** — quatre mois et Cr100000 ne sont pas un effet de bord de la consultation — et
  c'est elle qui remet enfin le malus à zéro, comme son réglage l'annonce.
* **La règle des connexions est jouable** (Core p.19) — deux Voyageurs, une compétence chacun,
  l'événement partagé noté. Elle vit sur le fronton de l'écran parce qu'elle écrit sur deux Voyageurs
  à la fois, ce qu'aucune fiche ne peut faire ; les quatre refus imprimés sont dits par leur nom.
* **Une trahison retourne une relation au lieu d'en inventer une** (Core p.20) : un Contact ou un
  Allié devient Rival ou Ennemi, et le repli imprimé s'applique quand il n'y en a aucun.
* **Une colonne accepte l'espèce qu'on y dépose** — en-tête ou cellule — et **remplace** celle qui s'y
  trouve, après confirmation. Les pistes déclarées par le seul ancien cadre partent avec lui.
* **Le fronton dit les termes de la table** : la méthode d'attribution, et seulement ce qui s'écarte
  du jeu imprimé.

### Correctifs

* Déposer une espèce sur un Voyageur vierge **retirait le bouton *Commencer* de sa fiche**.
* Ce que l'écran de création ne peut pas prendre est **refusé à voix haute** au lieu de disparaître.
* ⚠ **Un coût encouru pendant la création descendait les crédits sous zéro**, et le réglage
  *L'argent dépensé en création devient une dette* n'avait aucun effet. Un tel coût paie désormais
  ce qui est disponible, porte le reste en dette, et **refuse en entier** là où la règle est
  désactivée.

---

## [0.2.0]

**La plus grosse version du système à ce jour.** 0.1.x était une feuille de personnage ; 0.2.0 est un
système de jeu. Sept types d'Acteur, dix-huit types d'Objet, la création de Voyageurs en groupe, le
combat spatial et les batailles entre flottes, le commerce spéculatif et le trafic, le voyage et le
saut, la formation, la chaîne de dégâts complète, quarante-neuf règles optionnelles, un compendium de
documentation en quatre langues, et une démonstration commentée de chaque type que le système
déclare.

### ⚠ Ruptures

* **Nécessite Foundry VTT v14** (14.366 minimum). Le système ne fonctionne plus sur les v11 à v13.
* **Le type d'Acteur `vehicule` disparaît** au profit de `vehicle`, et **aucune migration n'est
  fournie** — les deux ne partagent presque aucun champ, une conversion ne reprendrait presque rien.
  Un Acteur de l'ancien type **n'est pas supprimé** : sa ligne reste en base. Mais Foundry ne sait
  plus le construire, donc il disparaît du répertoire des Acteurs et la console signale *is not a
  valid type* à chaque chargement. Si vous avez des véhicules, **notez ce qu'ils portaient avant de
  mettre à jour** et ressaisissez-les sur la nouvelle fiche.
* **Déposer une espèce ne modifie plus la caractéristique stockée.** L'espèce devient un Objet
  embarqué et son modificateur est dérivé. La migration retire le bonus déjà inscrit et **journalise
  chaque soustraction** dans la console, par nom d'Acteur. Deux cas ne peuvent pas être résolus et
  sont signalés plutôt que devinés : un Voyageur dont l'espèce a disparu du monde est laissé tel
  quel, et **un Voyageur qui avait reçu deux fois la même espèce garde une copie du bonus** — rien
  dans les données ne distingue un dépôt de deux. Vérifiez-le à la main.
* **Le PUG saisi à la main est supprimé** : il dérive des six caractéristiques canoniques.
* **Le carburant change de champ.** `fuelPerJump` devient `fuelPerMaxJump`, `fuelPerParcec` arrive, et
  la ligne *Carburant* du bloc Finance devient un coût au tonneau plus un plein — elle facturait un
  plein par période, une quantité qu'aucune règle n'énonce.
* **La feuille de style est chargée dans la couche CSS `system`**, ce qui permet enfin aux modules de
  surcharger le système proprement — et modifie l'ordre de priorité si vous aviez du CSS maison.

### Création de Voyageurs

* **Création en groupe**, dans une grille Voyageurs × périodes. Chaque joueur lance pour son propre
  Voyageur ; l'arbitre suit tout le monde sur le même écran.
* **Rien n'est perdu si la session s'interrompt.** Il n'y a pas de document de session : chaque
  résultat décidé s'écrit sur l'Acteur au moment où il est décidé. Fermer Foundry au milieu d'une
  création et revenir le lendemain ne coûte rien.
* **Les carrières sont des modèles que l'arbitre écrit lui-même**, avec un formulaire complet : rangs,
  affectations, tables de compétences, bénéfices, événements et mishaps, récompenses. Le système ne
  livre aucune table de carrière — il livre le registre qui les fait tourner.
* **Les espèces sont des cadres de création**, pas des blocs de paramètres : une espèce déclare ses
  propres périodes, ses tests, ses tables et ses pistes. La séquence du livre de base est le cadre par
  défaut.
* **Un jet de qualification peut porter un MD conditionnel** — *MD+2 si SOC 9+*, la forme qu'impriment
  certaines carrières et certaines espèces, et qu'il fallait jusqu'ici retenir et appliquer à la main.
* **Fin de carrière** : bénéfices, pension, parts de vaisseau, et une clôture de groupe où un seul
  Voyageur peut commencer propriétaire d'un vaisseau.
* **Vingt-deux règles optionnelles de création** (voir plus bas), dont seize là où aucun livre ne
  tranche : les livres se taisent, ou ils disent deux choses en deux lignes.
* **Journal signé des pertes permanentes de caractéristiques** — vieillissement, blessures, soins —
  dont la somme est dérivée. Il fonctionne sans la création et sert aussi en jeu.
* **Formation** : un registre de programmes, un par apprentissage en cours, chacun portant *quel livre
  le fait tourner*. Les Périodes d'Étude du livre de base et les Points d'Expérience du Companion sont
  deux façons de déplacer le même enregistrement. Un programme peut viser une caractéristique (SOC et
  PSI exclus), et un professeur est un Acteur dont le niveau est lu au moment du jet.

### Combat

* **Combat spatial** — un sous-type de Combat à part entière, avec trois phases par round et une zone
  de portée pour **chaque paire de vaisseaux**. Le groupe est le vaisseau, et son équipage agit à
  l'Initiative de la coque.
* **Batailles entre flottes** (Garde Haute), derrière un interrupteur de règle optionnelle. Une
  Fiche de vaisseau de flotte sur le vaisseau, un moteur qui résout sur un Facteur d'Attaque **sans
  jet pour toucher**, les escadrons de chasseurs, les salves de missiles en vol, le moral et la
  dispersion. Dans une bataille de flotte, le groupe est la flotte et le vaisseau devient un
  combattant.
* **Missiles et torpilles** (Companion ch. 29), derrière trois interrupteurs. Une salve a désormais un
  **type** — standard, dogfight, intercepteur ou torpille — et sa classe décide des zones de portée
  d'où elle peut partir. La défense se résout en trois couches : défense de zone, défense ponctuelle,
  et le tir rapproché du livre de base. Un lanceur en conteneur consomme un point d'emport, si bien
  qu'une coque de moins de 100 tonneaux n'en porte aucun.
* **Empoignade** — les huit issues du livre : à terre, désarmer, projeter, dégâts, pistolet ou lame
  courte, se dégager, entraîner, continuer.
* **Deux armes**, **Touche-à-tout** et **l'action prolongée interrompue** sont appliquées.
* **Un modificateur d'Initiative permanent a enfin où se poser** — sur tous les types d'Acteur. Le
  pont holographique du livre de base et de Garde Haute (*MD+2 à l'Initiative*) est la première chose
  qui s'en sert.
* **Une diagonale se mesure en euclidien**, comme le Companion p.173 le demande : dix cases affichaient
  15 m et affichent 21 m. Le réglage est mondial et prend la bonne valeur par défaut ; un monde où il
  a déjà été fixé à la main garde la sienne.
* **La portée se mesure depuis la cible** dans la fenêtre de jet, quand un jeton est visé.

### Santé, dégâts et récupération

* **La chaîne de dégâts complète** — l'ordre des dégâts s'édite dans une liste réordonnable : glisser
  pour classer, retirer, ajouter depuis les caractéristiques disponibles. Il est rappelé sous les
  caractéristiques de la fiche.
* **La carte de dégâts se résout côté défenseur** : le joueur visé applique, et l'armure, la
  Protection et les dégâts qui l'ignorent sont pris en compte au bon endroit. **Les dégâts qui
  ignorent l'armure étaient documentés et non appliqués** pour les Voyageurs et les PNJ.
* **Premiers soins, chirurgie et soins médicaux** partent de la carte de chat et écrivent sur les
  Voyageurs **contrôlés**. La chirurgie applique le nombre saisi, qui était affiché puis jeté.
* **Récupération psionique**, avec son échelle horaire.
* **Maladies, poisons et blessures sont des Objets**, et un trait d'arme qui en inflige un
  **construit l'Objet sur le défenseur** — toute la mécanique existait et rien ne l'appelait.
* **Doses de drogue et munitions chargées** : une dose est un Effet Actif, une munition chargée est
  une dérivation sur l'arme qui la tire.

### Vaisseaux, voyage et finances

* **Le vaisseau porte son étape de voyage** — ici, prochaine escale, distance en parsecs, file
  d'attente — et son niveau réel de carburant.
* **Saut et saut manqué**, avec la branche du Companion, et un réglage pour le temps perçu lors d'un
  saut en retard.
* **La fiche imprimée l'emporte sur la formule.** Six champs facultatifs — points de coque, énergie
  consommée, tonnage d'armure, tonnage et coût du pont, carburant par saut — laissent transcrire un
  vaisseau publié tel qu'il est imprimé, avec un marqueur qui dit lequel a été forcé.
* **Composants de vaisseau**, avec la vérification de conception : six contrôles sur le tonnage,
  l'énergie et le budget, derrière un interrupteur.
* **Ordinateurs, programmes et Bande passante** : la somme contre la Puissance de traitement, le
  plafond de Niveau Technologique, le déclassement des programmes trop lourds, et l'exception des
  programmes d'Interface. Sur un vaisseau, c'est le NT de **la coque** qui plafonne, jamais celui de
  l'ordinateur.
* **Hypothèque du vaisseau**, avec ses parts, son échéancier, l'option d'un prélèvement toutes les
  quatre semaines, et **Fuite devant les dettes**.
* **Un horodatage de maintenance** : le vaisseau retient le jour de campagne de sa dernière
  maintenance, et la fiche annonce de combien de périodes de quatre semaines elle est en retard. Rien
  n'est lancé et aucun modificateur n'en est dérivé — le livre de base p.154 dit que la maintenance
  *devrait* être faite, donc les MD de l'avoir sautée restent à l'arbitre.
* **Transfert de crédits** — le premier écran du système qui déplace de l'argent à la demande.
* **Poste d'équipage** comme type d'Objet : un poste est une description de fonction, et deux
  artilleurs peuvent partager le même.

### Commerce

* **Le Monde devient un Acteur** : Profil Universel de Monde collé d'un bloc et analysé, dix-huit
  codes commerciaux dérivés avec dérogation Auto/Oui/Non pour chacun, qualité et prix du carburant,
  taxe d'amarrage, et l'état du commerce spéculatif horodaté sur le *Jour de campagne*.
* **Un Monde sait où il est** : secteur par son nom et hex à l'intérieur du secteur — la paire que les
  livres impriment. Le sous-secteur et la coordonnée absolue en dérivent, et deux mondes de secteurs
  différents deviennent comparables. Vérifié contre 1 165 mondes publiés sans un seul écart.
* **Commerce spéculatif** : les trois tables du livre — les 18 codes, la table 36×8 des Biens
  commerciaux et les 29 lignes de Prix modifié. L'écran accepte un **Monde déposé** et cesse de
  demander ce que le document sait déjà.
* **Trafic d'escale** : passagers, fret et courrier deviennent des Objets sur le vaisseau, et un
  **Manifeste** sur la fiche du vaisseau permet de livrer une consignation et de débarquer un passage.
* **Lot de fret** et **Passage** comme types d'Objet, avec destination, échéance et tarif — trois
  champs qui existaient depuis le début et que rien n'écrivait jamais.
* **Le compteur se referme** : un prix négocié achète un lot et débite l'équipage, et la soute revend.

### Réputation et contrats

* **La Réputation (REP)** rejoint les caractéristiques qu'une table peut adopter, inactive par défaut.
  Elle se lit comme les autres — `REP 0` vaut MD−3 — et le jet de Changement de réputation prend
  **MD−1 par tranche de quatre REP déjà acquis** : une réputation déjà faite est plus dure à grandir.
  Les onze circonstances imprimées se recouvrent volontairement, et **seule la plus forte s'applique**
  — elles ne s'additionnent jamais.
* **Un contrat de prime** comme type d'Objet, et c'est le document **des Voyageurs** — la partie que le
  livre leur remet. Les lignes de l'arbitre se replient par courtoisie sur la même fiche : la
  Réputation minimale, le dernier lieu connu, qui sait quoi, les complications. La cible peut être une
  personne, un lieu ou un objet, et la cible, le commanditaire, les proches et le chasseur sont chacun
  un Acteur du monde déposé, qui retombe sur un nom stocké pour qui ne peut pas le voir.
* **Le groupe lance son propre contrat.** Les deux jets que le livre lui donne — négocier la prime, et
  se qualifier pour un contrat que sa Réputation n'atteint pas — se font depuis le siège des joueurs,
  sur un document qu'ils ne peuvent pas modifier par ailleurs.
* **Un onglet de génération** en tire un des tables imprimées : commanditaire, priorité, cible, prime,
  complication — huit tirages, chacun atterrissant dans le champ que son étape nomme.

### Le monde autour des Voyageurs

* **Quatre comportements de région** — gravité, température, vide, radiations. Ils énoncent
  l'intervalle et son coût ; **le système ne planifie jamais le temps**. Le round de combat est la
  seule exception, parce que Foundry le compte déjà.
* **Réserve** — un inventaire que personne ne porte : un tas de butin, le stock d'une boutique, une
  cache. Il a ses propres permissions, et c'est toute la raison d'en faire un Acteur.
* **Les conteneurs fonctionnent hors des Acteurs.** Un sac créé dans l'onglet Objets retient des
  objets du monde, se remplit en glissant un objet sur sa fiche et se vide en reposant l'objet dans la
  barre latérale. Supprimer un sac libère son contenu au lieu de l'emporter.
* **Les conteneurs s'imbriquent**, jusqu'à cinq niveaux, et le poids remonte la chaîne. Un conteneur
  ne peut jamais se retrouver dans lui-même. Un conteneur glissé depuis le monde ou un compendium
  arrive avec tout ce qu'il contient.
* **Encombrement** derrière un interrupteur, lu sur la FOR et la END courantes.

### Jets, cartes et demandes

* **Refonte de la fenêtre de jet** : la formule et l'Effet se lisent en direct pendant qu'on ajuste,
  bonus et malus compris.
* **Chaîne de tâches** — une carte de jet peut citer la précédente et en tirer son modificateur.
* **Le Docket** : l'arbitre compose une demande — compétence, caractéristique, difficulté, bonus ou
  malus, délai, un MD nommé et sa raison — la résout contre une liste de Voyageurs **avant de
  l'envoyer**, et la poste comme une carte que chacun répond depuis sa place.
* **Les cartes de chat portent leurs dés**, donc Dice So Nice les anime.
* **Glisser une compétence ou une arme sur la barre de macros crée le bon jet.** Avant, cela créait
  silencieusement une macro qui ouvrait la fiche.

### Interface

* **Refonte de la feuille de personnage** : colonne des caractéristiques avec jauge de déplétion,
  barre d'onglets ramenée dans la fiche, tableaux allégés.
* **Mode jeu et mode édition** sur les fiches, à la façon de dnd5e : les contrôles de structure
  disparaissent quand on joue.
* **Une seule palette, et elle appartient au lecteur.** Quatre préréglages, onze couleurs d'accent, et
  un axe *clair ou sombre* qui suit Foundry par défaut ou le remplace pour ce système seulement.
  Toutes les couleurs d'une fiche dérivent de cet unique accent, et chaque couleur de texte a été
  mesurée à 4,5:1 ou mieux sur tous les fonds. Deux interrupteurs l'accompagnent : un bandeau de
  fenêtre sombre sur les deux fonds, et une paire réussite/échec adaptée au daltonisme. Cinq réglages
  personnels, et aucun ne demande de recharger. **Les trois thèmes de 0.1.x disparaissent** — un
  client qui en portait un est migré et garde sa couleur.
* **Les feuilles, les dialogues et les cartes de chat suivent le thème clair ou sombre du joueur.**
* **Les fiches d'objet passent à cinq onglets** sur les mêmes blocs, avec un bandeau au-dessus : une
  fiche d'arme passe de 956 px à 489 px.
* **La fiche ne se redessine plus entièrement à chaque frappe** : seules les sections concernées sont
  reconstruites.
* **Une règle et sa page ne sont plus du texte sur la fiche** : la fiche énonce ce qu'elle fait, et la
  règle derrière est une infobulle.
* **Explorateur de compendiums**, sur le modèle de dnd5e : les compendiums du monde et ceux des
  modules, filtrables par Niveau Technologique, sous-type et échelle.
* **Bouton de création des compendiums du monde**, depuis les réglages : il livre la structure et
  jamais du contenu.

### Règles optionnelles et variantes

**Quarante-neuf règles sur six groupes** : *Voyageurs* 4, *Création* 22, *Combat* 5, *Santé* 4,
*Espace* 11, *Vaisseaux et robots* 3. Un seul menu dans les réglages du monde, et **elles ne sont pas
toutes désactivées au départ** — chaque valeur par défaut est la lecture que les ouvrages soutiennent
le mieux, si bien qu'une règle optionnelle est livrée inactive et qu'une règle que les livres
impriment *comme* une règle (encombrement, chargeurs, radiations) est livrée active.

Quatre formes : un interrupteur, un choix multiple (un ensemble), un choix de procédure et un compte —
parce qu'un booléen ne peut pas dire *quelle procédure imprimée est en vigueur* quand deux chapitres
ne sont pas la négation l'un de l'autre. Seize lignes ne citent aucun livre : quatorze affichent
*règle maison* et deux *non officiel*. Une règle maison existe précisément là où les livres se
taisent, ou là où ils disent deux choses en deux lignes.

Changer un interrupteur reprépare et redessine les fiches ouvertes ; rien ne demande de recharger.

### Documentation et langues

* **Le système livre son premier compendium** : `mgt2.docs`, un journal par langue, vingt-trois pages
  chacun. Chaque page dit deux choses pour un écran — **ce qu'il traite pour vous** et **ce qu'il vous
  laisse à la table**. C'est de la documentation *sur le système*, jamais du texte de règles.
* **Deux compendiums de démonstration, annotés** : un document pour **chaque type et sous-type que le
  système déclare** — 8 Acteurs et 27 Objets, tous nommés `Demo — `. Chacun porte à quoi sert le
  document, ce qui lit chaque champ, et le seul piège qu'il existe pour montrer. Un exemple travaillé
  plutôt qu'un monde de départ, et tous ses chiffres sont inventés.
* **Quatre langues déclarées** — français, anglais, espagnol, portugais (Brésil), **complètes toutes
  les quatre**. Le français est la cible du système ; le vocabulaire espagnol et portugais suit les
  traductions communautaires de Mongoose, et les titres d'ouvrages et les noms de traits restent en
  anglais là où aucune édition publiée ne les nomme.

### Correctifs

* `system.json` ne génère plus d'avertissements
  ([#3](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/3))
* Les polices Roboto, Roboto Condensed et Rubik Mono One étaient utilisées par les feuilles mais
  jamais chargées : elles retombaient silencieusement sur la police générique du navigateur
* Les dés des lignes d'inventaire, de compétences, de talents psioniques et de maladies ne lançaient
  plus rien : seuls l'initiative et les caractéristiques réagissaient
* Les notes financières n'étaient jamais enregistrées (le champ portait un nom absent du schéma)
* Le libellé vertical des feuilles d'objet restait rouge sur les thèmes Mwamba et Bleu
* Déposer un objet sur la ligne d'un conteneur dans l'inventaire ne rangeait rien : le gestionnaire
  cherchait une classe CSS qu'aucun gabarit n'émettait
* **Six types d'Objet ne pouvaient être déposés sur aucune fiche du système**, dont quatre de ceux
  dont une coque est faite : une liste d'exclusion codée en dur était héritée par toutes les fiches
  d'Acteur
* **Aucune zone de dépôt ne se colorait correctement** : le cache de glisser-déposer était vide en
  permanence, donc les trois zones affichaient « refusé » sur tout
* **Déposer une personne sur la ligne du second artilleur l'inscrivait sur celle du premier**
* Un vaisseau porteur payait l'entretien de tous les appareils embarqués sauf un, l'exclusion du livre
  n'en comptant qu'un par baie
* Les programmes ajoutés par le bouton `+` du bloc Ordinateur étaient invisibles au reste du système
* Une compétence dont le nom porte déjà sa spécialité — *Animaux (Dressage)*, la forme que retiennent
  les compendiums — l'énonçait deux fois : *Animaux (Dressage) (Dressage)* sur la fiche, dans le
  dialogue de jet et sur la carte de chat
* Le carburant d'un saut se calculait avec la portée maximale du vaisseau au lieu du taux imprimé
  (10 % de la coque par parsec) : un saut de 3 parsecs sur un vaisseau saut-2 consommait le double
* **Le bouton de premiers soins disparaissait dans un monde français**, la liste des compétences
  soignantes n'existant qu'en anglais
* Le libellé du réglage *Thème de couleurs* était en anglais approximatif, et trois réglages
  n'appliquaient rien tant qu'on ne rechargeait pas
* Une clé de durée portait un nom français dans le dictionnaire anglais, et cette faute était
  **enregistrée sur chaque talent psionique** exprimé en heures ; la migration réécrit la valeur
* Onze citations de page étaient une page trop haut, dont trois visibles par les joueurs
* Les codes commerciaux affichaient leur condition en anglais en dur, seul texte du système à
  échapper à la traduction

---

## [0.1.4] (2024-05-25)

### Correctifs
* Erreur lors du calcul du poids lors de différents événements (dépôt, suppression)

## [0.1.3] (2024-05-24)

### Correctifs
* Localisation
* Ajouter la valeur de la difficulté dans le libellé

### Nouveautés
* Support de la v12

## [0.1.2] (2024-05-16)

### Correctifs
* Affichage de la difficulté pour les Talents Psioniques
* Ajout d'une barre de défilement dans la feuille de personnage
* Glisser-déposer sur les fiches Carrières, Maladies, Contacts, Espèces
* Retrait du style sur les messages, le temps de les uniformiser
* Différents ajustements CSS

### Nouveautés
* Thème Bleu
* Amélioration du modèle Espèce : Description détaillée, Modificateurs (tableau) et Traits (tableau)
* Lors du dépôt d'une Espèce, copie des informations sur la fiche
* Ajout de la Durée pour les Talents Psioniques
* Bouton pour le jet de Durée des Talents Psioniques sur les messages
* Ajout de la difficulté sur la fenêtre des jets
