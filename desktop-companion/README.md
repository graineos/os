# Ruches OS — Companion Windows (Ruche Desktop)

**Module du projet Ruches OS**, conçu pour Windows 11 en complément de **MyDockFinder**, non affilié à Apple ni aux auteurs de MyDockFinder.

## État réel

Version de travail : **0.7 alpha**. Ce module reste **expérimental**. L'archive source complète a passé **12 tests Node**, mais n'a pas encore été compilée ni testée graphiquement sur Windows 11. Aucune amélioration des performances de MyDockFinder n'est démontrée.

**Publication :** le code source complet 0.7 est présent dans `src/` et `tests/`, et une archive de référence est conservée dans `source-v0.7.zip`. Les 12 tests Node sont passés dans le workflow d'extraction GitHub Actions. Cela ne vaut pas validation graphique sous Windows 11 et aucun installateur `.exe` n'a encore été vérifié.

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

## Démarrer le code (Windows 11)

Pré-requis : Node.js 22 et npm. Dans ce dossier :

```powershell
npm install
npm run check
npm start
```

La commande `npm run build:win` prépare un exécutable Windows portable si l'environnement de compilation et Electron Builder fonctionnent. **Installateurs alpha :** [Télécharger l'installateur Windows (.exe)](https://github.com/graineos/os/releases/download/ruche-companion-v0.7.0/Ruche-Companion-Setup.exe) ou [la version portable (.exe)](https://github.com/graineos/os/releases/download/ruche-companion-v0.7.0/Ruche-Companion-Portable.exe), dès la réussite du workflow Windows. Les exécutables sont non signés et expérimentaux ; Windows SmartScreen peut afficher un avertissement. **La version n'est pas validée visuellement sur Windows 11.**

La version open source reste expérimentale ; la compatibilité avec MyDockFinder et la fidélité visuelle macOS Tahoe doivent être validées sur un vrai PC.
