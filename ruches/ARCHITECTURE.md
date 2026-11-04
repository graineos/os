# Architecture de Ruches

## Principes

1. **Local d'abord.** Les données vivent sur l'appareil ; un serveur, quand il viendra, sera un relais facultatif, jamais la source de vérité obligatoire.
2. **Un cœur, plusieurs vues.** Tous les modules lisent et écrivent le même coffre. Une tâche avec échéance apparaît dans Tâches *et* dans l'Agenda : c'est la même donnée.
3. **Référencer plutôt que copier.** Contenu adressé par empreinte, espaces par référence, sources des événements par identifiant.
4. **Déterministe avant génératif.** Les « actions intelligentes » (Flow) sont des règles vérifiables ; aucune IA n'est utilisée aujourd'hui.
5. **Monolithe modulaire.** Un seul paquet, des frontières nettes ; on n'extrait un service que lorsqu'un besoin mesuré l'impose.

## Couches

```
ui/        RuchesApp, Plume, Grille, Agenda, Tâches, Espaces, palette, kit (Radix)
           ─ dépend de React ; ne connaît ni le domaine ni l'authentification de l'hôte
core/      vault      objets, versions, corbeille, espaces, recherche, capsule
           detect     Flow : dates FR, montants, e-mails, liens, listes, cases à cocher
           sheet      moteur de calcul (séparé de l'interface)
           sanitize   nettoyage HTML des documents
           chunker    découpage par le contenu (famille FastCDC)
           store      magasins d'octets : OPFS, IndexedDB, mémoire
           config     configuration d'une instance
```

`core/` n'importe rien de `ui/` ni de React : c'est la partie réutilisable dans une application native ou, à terme, un environnement système.

## Modèle universel

Un objet (`RucheNode`) :

| Champ | Rôle |
| --- | --- |
| `id` | identifiant stable (UUID) |
| `kind` | `folder`, `file`, `doc`, `sheet`, `event`, `task`, `space` |
| `name` | nom affiché |
| `parent` | dossier (arborescence des fichiers) |
| `versions` | contenu versionné : liste d'empreintes d'alvéoles (fichiers, documents, grilles) |
| `props` | propriétés structurées, petites valeurs JSON (date d'un événement, échéance d'une tâche, couleur d'un espace…) |
| `spaces` | espaces d'appartenance, par référence |
| `text` | texte indexé pour la recherche |
| `trashed`, `starred` | état |

Le noyau est commun ; les contenus complexes gardent un format spécialisé (HTML nettoyé pour Plume, JSON de cellules pour Grille).

### Format sur disque

- `manifest.json` : tous les objets + taille stockée de chaque alvéole (`v: 2`, migration automatique depuis `v: 1`).
- `c/ab/<sha256>` : une alvéole = 1 octet d'en-tête (0 brut, 1 deflate) + données.

### Capsule `.ruche`

`RUCHE1\n` · longueur de l'en-tête (u32) · en-tête JSON (objets) · puis pour chaque alvéole : empreinte (32 octets) · longueur (u32) · données. Lecture et écriture par morceaux ; chaque alvéole importée est vérifiée par son empreinte ; chaque objet importé est validé.

## Ruches pour le web (moteur de site en alvéoles)

`src/web/alveoles.ts` applique le même principe que le coffre à un site public : une page est un arbre JSON ; chaque objet placé dans une liste (section, carte, bouton…) devient une alvéole identifiée par l'empreinte SHA-256 de son JSON canonique, et ne garde de ses enfants que leurs empreintes (arbre de Merkle, une empreinte racine par page).

```
alveoles/sources/<site>/<page>.json   contenu lisible (et _partagees.json : alvéoles vivantes, { "$nom": "x" })
        │  bun scripts/alveoles.ts
        ▼
alveoles/store/<ab>/<empreinte>.json  alvéoles, jamais modifiées ni supprimées (historique vérifiable)
alveoles/plans/<site>/<page>.json     empreinte racine + historique des versions
        │  intégrés au build, assemblés côté serveur
        ▼
page HTML normale                      chaque alvéole revérifiée par son empreinte ; rien n'est stocké chez le visiteur
```

- Une alvéole identique n'est stockée qu'une fois, quelle que soit la page ; modifier un texte ne crée que les alvéoles qui changent.
- Alvéole vivante : modifier une entrée de `_partagees.json` met à jour toutes les pages qui l'insèrent.
- La CI refuse une source modifiée sans publication (`bun scripts/alveoles.ts --verifier`).
- Première page servie ainsi : la vitrine d'angel-beta.fr (`/atelier`).
- Limites V1 : la publication passe par un commit (pas encore d'édition depuis un outil), pas encore de page « historique d'une alvéole ».

## Ruches Search (recherche web)

```
search/crawl.ts   robot : robots.txt (Allow/Disallow, jokers, Crawl-delay), sitemaps, ≥ 1,1 s entre deux
                  requêtes sur un même site, noindex/nofollow, canonique, doublons, français uniquement
        │  écrit
        ▼
index.json        manifeste : nombre de pages, longueur moyenne, longueur de chaque page, sites, date
t/<xx>.json       postings par préfixe de 2 lettres : « terme » → « id:tf,… » (titre compté triple)
d/<n>.json        fiches de 100 pages : adresse, titre, extrait, longueur, date de collecte
        │  lu à la demande par
        ▼
core/websearch    client : télécharge seulement les morceaux des termes de la requête, classe (BM25
                  k1 = 1,2, b = 0,75 + bonus de titre et d'expression exacte), explique chaque score
```

- **Pas de serveur de recherche** : de simples fichiers statiques, mis en cache par le navigateur et le CDN. Coût marginal d'une requête ≈ zéro.
- **Confidentialité** : le serveur ne voit passer que les préfixes de termes demandés (`t/pa.json`), jamais la requête complète ni l'historique ; aucun cookie, aucun journal propre à Ruches.
- **Même découpage des mots** côté robot et côté client (`terms()` : accents retirés, mots vides, racinisation légère).
- **Séparation stricte** : l'index web ne contient que des pages publiques ; les contenus personnels ne quittent jamais l'appareil et s'affichent dans une section distincte.
- Limites : corpus restreint (quelques milliers de pages), fraîcheur = fréquence de collecte, pas de correction orthographique ni de synonymes, pas d'images.

## Concurrence

Les écritures passent par une file, protégée entre onglets par un verrou du navigateur (Web Locks), et repartent toujours du dernier manifeste enregistré. Les autres onglets sont prévenus par `BroadcastChannel`.

## Limites connues (assumées)

- Le manifeste est un seul fichier JSON réécrit à chaque modification : parfait jusqu'à quelques milliers d'objets, mais c'est la prochaine évolution (journal d'opérations, voir ROADMAP) et la condition de la synchronisation.
- Pas encore de chiffrement des alvéoles au repos (le stockage du navigateur est privé à l'origine du site).
- Un coffre par appareil : pas de synchronisation entre appareils hors capsule.
- Plume repose sur `contentEditable` / `execCommand` (déprécié mais universellement supporté) ; un moteur de blocs est prévu.

## Dépendances

| Dépendance | Rôle | Licence | Remplaçable |
| --- | --- | --- | --- |
| React | interface | MIT | cœur indépendant |
| Radix (dialog, dropdown-menu, popover) | accessibilité des fenêtres et menus | MIT | oui |
| framer-motion | animations | MIT | oui (CSS) |
| lucide-react | icônes | ISC | oui |
| date-fns | dates relatives | MIT | oui (Intl) |
| Tailwind CSS 4 | utilitaires de mise en page | MIT | oui |

Le cœur n'a **aucune** dépendance : Web Crypto, CompressionStream, OPFS et IndexedDB sont fournis par la plateforme.
