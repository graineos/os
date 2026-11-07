# Ruches OS — Companion Windows (Ruche Desktop)

**Module du projet Ruches OS**, conçu pour Windows 11 en complément de **MyDockFinder**, non affilié à Apple ni aux auteurs de MyDockFinder.

## État réel

Version de travail : **0.7 alpha**. Ce module reste **expérimental**. L'archive source complète a passé **12 tests Node**, mais n'a pas encore été compilée ni testée graphiquement sur Windows 11. Aucune amélioration des performances de MyDockFinder n'est démontrée.

Cette intégration au dépôt public est en cours : seuls les fichiers présents ici sont considérés comme publiés. **Ne pas présenter ce répertoire comme une distribution installable complète tant que tous les sources 0.7 et les builds Windows ne sont pas présents et validés.**

## Rôle dans Ruches OS

- Le noyau à capacités et l'espace Ruches restent dans leurs répertoires historiques.
- Le Desktop Companion est un **client Windows facultatif** : il n'est ni une deuxième distribution Ruches OS, ni une modification du site, ni un remplacement du noyau Windows.
- MyDockFinder continue de gérer le Dock et la barre supérieure. Le Companion vise Finder, Quick Look, recherche, fenêtres sans décorations Windows, réglages et optimisation de **ses propres** effets graphiques.
- Ne jamais remplacer `explorer.exe` ou modifier les composants critiques du shell pour l'installation initiale.

## Architecture prévue

```text
Ruches OS (dépôt graineos/os)
  src/kernel/        noyau à capacités
  ruches/            applications Ruches
  desktop-companion/ complément Windows 11 / MyDockFinder
```

## Licence

Les nouveaux fichiers publiés sous `desktop-companion/` sont sous MIT (voir `LICENSE`), sauf mention contraire ; le reste du dépôt garde ses licences propres, notamment AGPL-3.0-only pour Ruches OS. Les ressources graphiques Apple et le code propriétaire de MyDockFinder ne sont pas inclus.

## Publication web

Les sources de ce module apparaissent dans le lecteur public : https://angel-beta.fr/atelier-code?source=ruches-os&chemin=desktop-companion
