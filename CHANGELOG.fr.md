# Changelog — MGT2

[English](CHANGELOG.en.md) · [Español](CHANGELOG.es.md) · [Português (Brasil)](CHANGELOG.pt-BR.md)

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
