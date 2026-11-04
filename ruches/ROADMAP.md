# Feuille de route

Ambition : un écosystème complet (recherche, stockage, bureautique, communication, médias), puis un environnement système. Exécution : progressive, chaque étape livrée utilisable et mesurée.

## Livré

- **0.1** — Coffre à alvéoles (découpage par contenu, déduplication, compression, versions, capsule), Fichiers, Plume, Grille, Boussole, corbeille.
- **0.2** — Projet indépendant (`ruches/`, AGPL-3.0, tests), modèle universel (événements, tâches, espaces, propriétés), Agenda, Tâches, Espaces, Flow (actions déterministes), palette de commandes, graphique dans Grille, identité visuelle propre, montage `/lab`.

- **0.3** — Ruches Search : robot respectueux, index statique, classement BM25 explicable dans le navigateur, filtres, vue par source, dossier de sources ; évaluation publiée (docs/LAB.md) ; rafraîchissement hebdomadaire par workflow.

## Phase 1 — Fondation (en cours)

- [ ] Journal d'opérations : chaque modification devient une opération adressée par empreinte (historique, annulation, audit, base de la synchro). Migration automatique depuis le manifeste v2.
- [ ] Chiffrement des alvéoles (AES-GCM, clé par coffre dérivée d'une phrase secrète) — prérequis à tout relais serveur.
- [ ] Références vivantes ou figées : intégrer une plage de Grille dans un document, soit à jour, soit figée sur une version (empreinte).
- [ ] Collections dynamiques : une recherche enregistrée devient un espace qui se remplit seul.
- [ ] Plume en blocs (titres, listes, tableaux, images) au lieu de `contentEditable` brut.

## Phase 2 — Ruche de confiance (synchronisation entre ses propres appareils)

- [ ] Association par QR code (échange de clés).
- [ ] Synchronisation « qu'est-ce qui te manque ? » : comparaison des empreintes, transfert des seules alvéoles absentes, vérifiées à l'arrivée.
- [ ] Signalisation WebRTC via un service déjà disponible chez l'hôte ; relais d'alvéoles **chiffrées** en secours.
- [ ] Indicateur de copies par fichier (1 copie = risque de perte, affiché).
- Limite connue : sans serveur relais (TURN), une partie des réseaux ne peut pas se connecter en direct ; à mesurer.

## Phase 3 — Recherche publique

- [x] Robot respectueux (robots.txt, canonical, charge) sur un corpus choisi et annoncé.
- [x] Index inversé + BM25, publié en fichiers statiques découpés par terme : le navigateur ne télécharge que les morceaux utiles et calcule le classement lui-même.
- [x] « Pourquoi ce résultat » : classement explicable.
- [x] Évaluation sur un jeu de requêtes jugées à la main (20 requêtes, docs/LAB.md).
- [x] Vues liste / par source, filtre par site, dossier de sources vers Plume.
- [ ] Élargir le corpus par lots mesurés (objectif suivant : 20 000 pages), index de proximité (expressions), synonymes et correction orthographique.
- [ ] Autres formes de résultats (frise, tableau comparatif, carte) fondées uniquement sur les sources trouvées.
- [ ] Liens entre pages (popularité) comme signal de classement, avec explication.

## Phase 4 — Productivité étendue

- [ ] Présentations comme prisme de Plume + Grille.
- [ ] Formulaires (nécessite un point de collecte serveur).
- [ ] Photos locales (métadonnées, doublons, albums = espaces).
- [ ] Cartes : tuiles OpenStreetMap France en un seul fichier statique (PMTiles), attribution OSM.
- [ ] Collaboration en temps réel (CRDT).

## Phase 5+ — Chantiers d'infrastructure (feuilles de route séparées, validation explicite requise)

- Messagerie électronique réelle (SMTP/IMAP, SPF/DKIM/DMARC, réputation) — exige un serveur et des réglages DNS.
- Visioconférence (WebRTC + relais TURN).
- Navigateur : d'abord une extension, puis une coque sur un moteur ouvert existant.
- Ruches OS : distribution sur un noyau libre existant, Ruches comme environnement ; portage du cœur (stockage, découpage) en Rust lorsque le format sera stable.

## Ce qui est écarté (et pourquoi)

- **Un éditeur unique pour texte, tableaux et diapositives** : interactions trop différentes ; on partage les données, pas le moteur d'édition.
- **Déduplication entre utilisateurs** : permettrait de deviner qu'un autre possède un fichier donné.
- **Stockage sur les appareils d'inconnus** : disponibilité aléatoire, responsabilité juridique.
- **Indexer tout le Web maintenant** : exige une infrastructure permanente ; on commence petit et mesuré.
