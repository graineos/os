# Ruches OS

**Un système libre, français et local d'abord : un noyau à capacités, un espace de travail en alvéoles, et les applis qui vont avec.**

Ruches OS réunit en un seul projet ce qui s'appelait jusqu'ici **GraineOS** (le noyau et la VM web) et **Ruches** (fichiers, documents, tableur, agenda, tâches, recherche, stockage en alvéoles). Un seul nom, un seul dépôt, une seule licence : **AGPL-3.0**.

> État réel : laboratoire. Ce qui est décrit comme disponible fonctionne et est testé ; le reste est en chantier.

## Ce qu'il y a dedans

```text
src/              Noyau et VM web (ex-GraineOS)
├─ kernel/        cellules, capacités, délégation, révocation, check() — aucune dépendance
├─ system/        services système de la VM
└─ main.tsx       bureau, fenêtres, terminal, moniteur
ruches/           Espace Ruches : fichiers, Plume, Grille, agenda, tâches, espaces, Ruches Search, alvéoles
opendoor/         Couche d'orchestration (événements, workflows, synchro, déploiement) — fondue dans Ruches côté site
openbook/         Liseuse / bibliothèque (Tauri)
desktop-companion/  Module Windows 11 pour compléter MyDockFinder (alpha Electron)
angelmovies-tv/   Appli TV (Android)
tests/            Tests du noyau
```

### Le noyau (ex-GraineOS)

Un modèle de sécurité par **capacités** : chaque cellule (programme) ne peut agir que sur ce qu'on lui a explicitement délégué, et toute délégation se révoque en cascade. `src/kernel/kernel.ts` n'a aucune dépendance : le site angel-leclerc.fr s'en sert comme autorité d'accès. La VM web sert de banc d'essai à l'interface et au comportement du système ; ce n'est pas encore un noyau qui démarre sur une machine nue.

### L'espace Ruches

Fichiers, documents, tableur, agenda, tâches et espaces, **sur l'appareil**, sans cloud obligatoire. Chaque contenu est découpé en **alvéoles** identifiées par leur empreinte SHA-256 et écrites une seule fois : un doublon ne coûte presque rien, une nouvelle version ne stocke que la différence, et tout le coffre tient dans un fichier `.ruche`. Détails dans [`ruches/README.md`](ruches/README.md) et [`ruches/ARCHITECTURE.md`](ruches/ARCHITECTURE.md).

## Direction

- **Local d'abord** : l'appareil est la source de vérité, le serveur est une option.
- **Un seul cœur** pour tous les modules, des mécanismes simples plutôt qu'une infrastructure géante.
- **Interface** : bureau sobre et fluide, barre en bas, lanceur à gauche ; côté web, la charte miel de Ruches.

## Lancer

```bash
npm install
npm run dev      # VM web et bureau
npm test         # tests du noyau
cd ruches && bun test   # tests de l'espace Ruches
```

## Licence

Ruches OS est distribué sous **GNU AGPL-3.0-only** (fichier [`LICENSE`](LICENSE)). Si tu fais tourner une version modifiée en ligne, tu dois en publier le code. Les composants tiers gardent leur propre licence.

Le code publié sur [angel-beta.fr/atelier-code](https://angel-beta.fr/atelier-code) est celui de ce dépôt. Le module [Ruche Desktop Companion](desktop-companion/README.md) est publié dans ce même dépôt, avec sa propre licence MIT et un statut alpha.
