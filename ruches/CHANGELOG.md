# Journal des versions

## 0.4.1 — 2026-11-04 — Ruches OS

- L'accueil redevient celui de Ruches. Le portail devient le module **Web** (`portal.asHome: false`, par défaut) ; `asHome: true` le remet en page d'accueil.
- **Modules de l'hôte** (`extensions`) : un hôte ajoute ses propres écrans dans la navigation et la palette de commandes, dans la charte de Ruches (ex. « Mon site » sur angel-beta.fr).
- Navigation mobile resserrée à cinq entrées (Accueil, Web, Fichiers, Tâches + module de l'hôte) ; Agenda et Espaces restent accessibles depuis l'accueil et la palette.

## 0.4.0 — 2026-11-04 — OpenRuches

- **Fusion avec le portail OpenDoor** : l'accueil devient le portail OpenRuches (option `portal` de la configuration ; `null` pour garder l'accueil classique). L'ancien accueil (stockage, capsule, place) passe dans « Ma Ruche ».
- **Une seule barre** : tes contenus (cherchés sur l'appareil), Ruches Search, Qwant ou Lilo, onglets Tous / Actualités / Images / Vidéos / Cartes, recherche vocale, historique local effaçable, suggestions de l'hôte facultatives.
- **Raccourcis « ! »** (`src/core/bangs.ts`) : Wikipédia, Service-Public, Légifrance, Insee, Vie-publique, Assemblée nationale, cartes IGN, OpenStreetMap, Mappy, Météo-France, Reverso, Gallica, leboncoin, AlloCiné, Dailymotion, Deezer… au début ou à la fin de la saisie, avec `!` ou `&` ; `?` force la recherche dans Ruches.
- **Calculs instantanés** sur l'appareil (« 12*7 », « 15 % de 80 »), sans `eval`.
- **Catalogue des services français** (`src/portail/catalogue.ts`) : radios et podcasts, TV, messageries e-mail et instantanées, réseaux, itinéraires, musique, sites utiles, bonne action.
- Bonjour, date et météo locale à la demande (Open-Meteo, position arrondie gardée sur l'appareil) ; résumé « Ta Ruche » (bientôt, récents, créer).
- Emplacements pour l'hôte : `afterSearch`, `aside`, `end`, `assistant`, `headerEnd`, préférence de moteur synchronisée.

## 0.3.1 — 2026-10-14

- Corrections de la 3e revue : relecture inter-onglets placée dans la file d'écriture ; manifeste enregistré avant l'effacement physique des alvéoles ; export de capsule en instantané cohérent ; capsule avec reste partiel ou alvéole manquante refusée ; arborescence importée réparée (parent non-dossier, boucles) ; plages de formules bornées ; Grille fenêtrée (seules les cellules visibles sont créées) ; regroupement des tâches correct au changement d'heure ; couleurs d'espace limitées aux codes hexadécimaux ; modules désactivés inaccessibles par lien direct ; aperçu PDF compatible avec la politique de sécurité ; nombre réel de tâches créées affiché.
- Changement de compte : l'ancien coffre disparaît immédiatement de l'écran.

## 0.3.0 — 2026-10-14

- **Ruches Search** : robot d'indexation respectueux, index inversé statique, classement BM25 calculé dans le navigateur avec explication, onglets Tout / Mes contenus / Web, filtres par site, vue par source, dossier de sources vers Plume, carte d'accueil. Évaluation publiée.
- Corrections de la 2e revue : transactions IndexedDB confirmées, lecture des gros fichiers sans tout charger en mémoire, capsule corrompue refusée, limite de versions à la restauration, nom unique à la restauration, saisie Grille enregistrée avant arrière-plan, priorité de `^`, textes « #… ».

## 0.2.0 — 2026-10-14

- Projet rendu indépendant : dossier `ruches/`, licence AGPL-3.0, cœur sans dépendance, kit d'interface propre (Radix), identité visuelle propre (clair/sombre), configuration d'instance.
- Modèle universel v2 : événements, tâches, espaces, propriétés structurées ; migration automatique depuis v1.
- Nouveaux modules : Agenda, Tâches, Espaces. Les tâches à échéance apparaissent dans l'agenda.
- Flow : actions déterministes sur la sélection dans Plume (date → événement, cases → tâches, liste → grille, total des montants).
- Palette de commandes `Ctrl+K` avec compréhension des dates en français.
- Grille : graphique en barres (export SVG).
- Tests du cœur (`bun test`).
- Montage expérimental sur `/lab`.

## 0.1.1

- Corrections de revue : écritures sûres entre onglets, capsule lue/écrite par morceaux et validée, nettoyage des alvéoles orphelines, `SI` paresseux, TSV, restauration hors dossiers jetés, impression limitée à Plume.

## 0.1.0

- Coffre à alvéoles, Fichiers, Plume, Grille, Boussole, capsule.
