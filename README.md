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
│  └─ kernel.ts       # simulation du modèle capacités/cellules
├─ main.tsx           # bureau, fenêtres, terminal et moniteur
└─ styles.css         # design system et matériaux visuels
```

La VM web n’est pas encore un noyau bare-metal. Elle sert à stabiliser l’architecture, l’UX et les règles du système avant les étapes bas niveau.

## Lancer en local

```bash
npm install
npm run dev
```

## Compiler

```bash
npm run build
```

Le projet est compatible avec un déploiement statique Vercel.
