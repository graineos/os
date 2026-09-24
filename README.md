# GraineOS

GraineOS est un prototype de système d’exploitation convergent, minimaliste et modulaire.

L’objectif du dépôt est double :

1. développer le modèle de noyau (cellules, capacités, portails, délégation et révocation) ;
2. fournir une VM web interactive servant de banc d’essai à l’interface et au comportement du système.

## Direction produit

- **Apparence** : langage visuel très proche d’un macOS moderne — palette système, matériaux translucides, blur, profondeur, fenêtres raffinées, contrôles rouge/orange/vert, typographie système et animations fluides.
- **Disposition** : logique spatiale inspirée de Windows — barre principale en bas, lanceur à gauche, applications épinglées, zone système et horloge à droite.
- **Barre** : flottante et translucide autorisée.
- **Principe** : ne pas mélanger deux identités visuelles. L’identité visuelle reste macOS ; seuls les emplacements principaux sont réorganisés.

## Architecture actuelle

```text
src/
├─ kernel/
│  ├─ kernel.ts       # noyau pur : cellules, capacités, délégation, révocation, check()
│  └─ vm.ts           # instance de la VM web (cellules Shell et Moniteur)
├─ main.tsx           # bureau, fenêtres, terminal et moniteur
└─ styles.css         # design system et matériaux visuels
```

## OPENDOOR OS (`opendoor/`)

Le dossier `opendoor/` reprend le cœur OPENDOOR OS (ex-`angel-os/`) issu du dépôt du site `angel-leclerc.fr`. C’est une couche d’orchestration (événements, workflows durables, synchro, déploiement, récupération), distincte du noyau à capacités de `src/kernel/`. Elle n’est pas encore branchée à la VM web ni incluse dans le build (`tsconfig.json` ne couvre que `src/`).

Ses fichiers portent l’en-tête `GPL-2.0-only`, alors que ce dépôt est sous GPL-3.0 : à harmoniser avant de mélanger les deux codes.

La VM web n’est pas encore un noyau bare-metal. Elle sert à stabiliser l’architecture, l’UX et les règles du système avant les étapes bas niveau.

## Lancer en local

```bash
npm install
npm run dev
```

## Tester le noyau

```bash
npm test
```

`src/kernel/kernel.ts` n’a aucune dépendance : il est copié tel quel dans le site `angel-leclerc.fr`, qui s’en sert comme autorité d’accès.

## Compiler

```bash
npm run build
```

Le projet est compatible avec un déploiement statique Vercel.
