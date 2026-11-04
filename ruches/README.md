# Ruches

**Fichiers, documents, grilles, agenda, tâches et espaces : sur ton appareil, sans cloud obligatoire.**

Ruches est un projet français, libre (AGPL-3.0) et expérimental. Son ambition à long terme est de proposer une alternative complète aux grandes suites numériques (recherche, stockage, bureautique, communication…), mais en partant d'une autre architecture : **local d'abord**, un seul cœur commun à tous les modules, et des mécanismes simples plutôt qu'une infrastructure géante.

> État réel : version 0.2, laboratoire. Ce qui est listé « disponible » fonctionne et est testé ; le reste est dans la [feuille de route](ROADMAP.md).

## Ruches : le portail intégré

Depuis la 0.4, l'accueil de Ruches est un **portail** : une seule barre pour chercher dans tes contenus, dans l'index Ruches Search, ou sur le web avec Qwant ou Lilo ; des **raccourcis « ! »** (`!w`, `!sp`, `!lf`, `!carte`, `!trad`…), des **calculs instantanés**, la **recherche vocale**, et un catalogue de **services français du quotidien** (radio, TV, mail, messageries, itinéraires, musique, démarches…). Tout ce qui est calculé l'est sur l'appareil. Mettre `portal: null` dans la configuration rend l'accueil classique.

## Ce qui fonctionne aujourd'hui

| Module | Ce qu'il fait |
| --- | --- |
| **Fichiers** | Import (glisser-déposer), dossiers, aperçu (images, vidéos, audio, PDF, texte), favoris, historique, corbeille avec suppression définitive confirmée |
| **Plume** | Documents en texte enrichi, enregistrement automatique, versions, export HTML/TXT, impression/PDF |
| **Grille** | Tableur : formules FR/EN (`SOMME`, `MOYENNE`, `SI`…), références circulaires détectées, copier/coller, CSV/TSV, graphique en barres |
| **Agenda** | Mois, « à venir », événements avec lieu et notes ; les tâches à échéance y apparaissent aussi |
| **Tâches** | Ajout rapide en langage naturel (« appeler le traiteur vendredi » → échéance vendredi), regroupement retard / aujourd'hui / à venir |
| **Espaces** | Un espace réunit documents, grilles, fichiers, rendez-vous et tâches d'une activité. Un même élément peut vivre dans plusieurs espaces **sans être copié** |
| **Boussole** | Recherche instantanée dans tout, sans accents, faite sur l'appareil. Résultats privés toujours séparés des résultats web |
| **Ruches Search** | Moteur de recherche web **propre** : robot d'indexation respectueux (`search/crawl.ts`), index inversé publié en fichiers statiques, classement BM25 calculé dans le navigateur, explication de chaque résultat (« Pourquoi ? »), filtres par site, vue par source, dossier de sources vers Plume. Corpus limité et annoncé (voir [docs/LAB.md](docs/LAB.md)) |
| **Flow** | Sélectionne du texte dans Plume : une date devient un événement, des lignes `[ ]` deviennent des tâches, une liste devient une grille, des montants sont additionnés. Déterministe, sans IA |
| **Commandes** | `Ctrl+K` : une seule entrée pour tout faire. « dentiste jeudi 9h » propose directement l'événement ou la tâche |
| **Capsule** | Tout le coffre dans un seul fichier `.ruche` (sauvegarde ou changement d'appareil), intégrité vérifiée à l'import |

## L'idée centrale : les alvéoles

Chaque contenu est découpé selon ses octets (et non selon sa position), puis chaque morceau — une **alvéole** — est identifié par son empreinte SHA-256 et écrit une seule fois, compressé si c'est utile. Conséquences mesurées (voir [docs/LAB.md](docs/LAB.md)) :

- un fichier en double ne coûte presque rien ;
- insérer 50 octets dans un fichier de 3 Mo laisse 638 alvéoles sur 639 inchangées : une nouvelle version ne stocke que la différence ;
- une capsule de 6 Mo exportée puis réimportée redonne le fichier à l'octet près.

Ruches ne crée pas de capacité : il utilise celle de ton appareil (stockage privé du navigateur, OPFS), sans la gaspiller, et affiche séparément ce qui est réellement écrit et ce qui est économisé.

## Utiliser

Ruches est une bibliothèque React + un cœur TypeScript sans dépendance d'interface :

```tsx
import { RuchesApp } from "ruches/ui";

<RuchesApp ns={userId} search={state} go={setState} />
```

- `ns` : identifiant de l'espace de stockage (un coffre par compte et par appareil) ;
- `search` / `go` : état de navigation, branché sur le routeur de l'hôte ;
- `config` : nom, couleurs, modules et relais web de l'instance (voir `src/core/config.ts`).

L'hôte doit fournir React 19, Tailwind CSS 4 (avec `@source` vers `ruches/src`), framer-motion, lucide-react, date-fns et Radix (dialog, dropdown-menu, popover).

Le cœur seul (`src/core`) fonctionne sans navigateur React : `Vault.open(ns, { store: new MemoryStore() })`.

## Tests

```sh
cd ruches && bun test
```

## Moteur de recherche

```sh
bun ruches/search/crawl.ts public/ruches-index   # collecte + index (robots.txt respecté)
bun ruches/search/eval.ts public/ruches-index    # évaluation sur 20 requêtes jugées
```

Sites collectés : `search/sites.json`. Retrait d'une page : ajouter son adresse à `search/exclusions.txt` (elle disparaît à la collecte suivante). Rafraîchissement hebdomadaire : `.github/workflows/ruches-index.yml` (hôte actuel).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — modèle de données, couches, choix techniques
- [ROADMAP.md](ROADMAP.md) — phases, de la synchronisation au moteur de recherche web et à Ruches
- [docs/LAB.md](docs/LAB.md) — journal des expérimentations et mesures
- [SECURITY.md](SECURITY.md) — modèle de menace et signalement
- [CONTRIBUTING.md](CONTRIBUTING.md) — conventions
- [CHANGELOG.md](CHANGELOG.md)

## Hébergement actuel

Le laboratoire est servi temporairement sur `angel-beta.fr/lab` (comptes membres). Le code ne contient aucune adresse de ce domaine : changer d'hébergement ne demande que de monter `RuchesApp` ailleurs. Ce dossier est conçu pour être extrait tel quel dans son propre dépôt (`git subtree split --prefix=ruches`).

## Licence

AGPL-3.0-only — voir [LICENSE](LICENSE). © 2026 Angel Leclerc et contributeurs.
