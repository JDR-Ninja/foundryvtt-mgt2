## [0.2.0]

### Ruptures
* Nécessite Foundry VTT **v14**. Le système ne fonctionne plus sur les v11 à v13.

### Correctifs
* `system.json` ne génère plus d'avertissements ([#3](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/3))
* Les polices Roboto, Roboto Condensed et Rubik Mono One étaient utilisées par les feuilles mais
  jamais chargées : elles retombaient silencieusement sur la police générique du navigateur
* Les dés des lignes d'inventaire, de compétences, de talents psioniques et de maladies ne
  lançaient plus rien : seuls l'initiative et les caractéristiques réagissaient
* Les notes financières n'étaient jamais enregistrées (le champ portait un nom absent du schéma)
* Le libellé vertical des feuilles d'objet restait rouge sur les thèmes Mwamba et Bleu
* Déposer un objet sur la ligne d'un conteneur dans l'inventaire ne rangeait rien : le gestionnaire
  cherchait une classe CSS qu'aucun gabarit n'émettait

### Features
* Support de la v14 (ApplicationV2, DialogV2, modèles de données)
* La feuille de style est désormais chargée dans la couche CSS `system`, ce qui permet aux modules
  de surcharger le système proprement
* Refonte de la feuille de personnage : colonne des caractéristiques avec jauge de déplétion,
  barre d'onglets ramenée dans la fiche, tableaux allégés
* Les feuilles, les dialogues et les cartes de chat suivent le thème clair ou sombre du joueur
* L'ordre des dégâts s'édite dans une liste réordonnable : glisser pour classer, retirer, ajouter
  depuis les caractéristiques disponibles. Il est rappelé sous les caractéristiques de la fiche
* La fiche ne se redessine plus entièrement à chaque frappe : seules les sections concernées
  sont reconstruites
* Les conteneurs fonctionnent hors des acteurs : un sac créé dans l'onglet Items retient des objets
  du monde, se remplit en glissant un objet sur sa fiche et se vide en reposant l'objet dans la
  barre latérale. Supprimer un sac du monde libère son contenu au lieu de l'emporter
* Les conteneurs s'imbriquent, jusqu'à cinq niveaux, et le poids remonte la chaîne. Un conteneur ne
  peut jamais se retrouver dans lui-même
* Un conteneur glissé depuis le monde ou un compendium arrive avec tout ce qu'il contient

## [0.1.4] (2024-05-25)

### Correctifs
* Erreur lors du calcul du poids lors de différent événement (Drop, Delete)

## [0.1.3] (2024-05-24)

### Correctifs
* Localisation
* Ajouter valeur de la difficulté dans le label

### Features
* Support de la v12

## [0.1.2] (2024-05-16)

### Correctifs
* Affichage de la difficulté pour les Talents Psioniques
* Ajout de scrollbar dans la feuille de personnage
* Drag & Drop sur la fiche des Carrières, Maladies, Contacts, Espèces
* Retrait du style sur les messages (le temps d'uniformiser les messages)
* Différents ajustements css

### Features
* Thème Bleu
* Amélioration du modèle Espèce
    * Ajout des champs : Description Détaillée, Modificateurs (tableau) et Traits (tableau)
* Lors du Drop d'une Espèce, copie des informations sur la fiche
* Ajout de la Durée pour les Talents Psioniques
* Bouton pour le jet de la Durée des Talents Psionique sur les messages
* Ajout de la difficulté sur la fenêtre des Jets
* Affichage du succès et de l'échec sur les messages