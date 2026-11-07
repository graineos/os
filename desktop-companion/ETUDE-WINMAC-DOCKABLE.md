# Ruche OS Desktop 0.2 — Étude WinMac et Dockable

## Analyse des références (7 novembre 2026)

### WinMac — https://github.com/Asteski/WinMac
- Projet de personnalisation Windows 11 fondé sur un assemblage d'outils : WinMac Menu, PowerToys, Everything, StartAllBack, Windhawk, Nexus, QuickLook, WinLaunch, AutoHotkey, etc.
- Les scripts originaux PowerShell, AutoHotkey et C sont annoncés sous licence MIT, sous réserve de conserver les notices.
- Les images, icônes et thèmes originaux du projet sont sous CC BY-NC 4.0 : ne pas réutiliser dans une distribution commerciale.
- Les logiciels tiers imposent chacun leurs propres licences. StartAllBack et plusieurs éléments sont propriétaires.
- Le lanceur WinMac lance un script PowerShell en mode ExecutionPolicy Bypass ; l'installation complète peut modifier des comportements de Windows et requiert des privilèges d'administrateur : **ne pas exécuter automatiquement**.
- **Ruche en retient** : installation modulaire/réversible, Launchpad, Quick Look, coins actifs, recherche et raccourcis. Aucun outil tiers ni thème WinMac importé à ce stade.

### Dockable — https://dockable.app/
- Application Windows 11 native fondée sur C#/WPF/.NET 9/CsWin32 selon le site officiel.
- Interface Liquid Glass, magnification d'icônes, indicateurs des apps actives, Dock personnalisable, barre de menus, DPI multimoniteur, animations Genie/Suck/Scale.
- Présentée sur Steam comme un logiciel commercial. Le code source et une licence permettant de le réutiliser n'ont pas été vérifiés : **aucun code Dockable recopié**.
- **Ruche en retient** : une animation de magnification des icônes reconstruite indépendamment, ainsi que des objectifs de compatibilité native, non encore tous réalisés.

## Version 0.2 : changement réalisé
- Zoom progressif des icônes du Dock selon leur distance au curseur et déplacement vertical doux.
- Respect de l'option système de réduction des animations.
- Aucun code ni aucun thème tiers ajouté : implementation locale dans l'interface du prototype Electron.
- Version mise à jour pour éviter de confondre ce prototype avec un produit terminé.

## Fonctionnalités encore absentes
- Gestion des fenêtres actives et indicateurs réels ; animations des fenêtres ; équivalent Quick Look ; coins actifs ; menu contextuel ; barre native ; multiécran de production ; intégration OPENDOOR OS ; installeur signé ; tests sur une véritable machine Windows 11.
- Aucun script ne doit désactiver l'antivirus, supprimer Explorer, remplacer le shell au démarrage ou modifier le registre sans contrôle et sauvegarde.

## Architecture proposée
1. UI Shell : Dock, Menu Bar, Spotlight, Launchpad, Preferences.
2. Adaptateur système Windows : shortcuts, applications actives, gestion fenêtre, notifications, affichage/DPI.
3. Couche Ruche Core : événements, préférences locales, autorisations, rollback, modules isolés.
4. Pont OPENDOOR OS optionnel, jamais obligatoire au fonctionnement du Dock.

## Test / livraison
Exécuter `npm install`, `npm run check`, puis `npm start` sur Windows 11. Pour générer un exécutable, `npm run build:win` (environnement Windows conseillé). Un contrôle de syntaxe ne valide ni le rendu graphique ni la compatibilité Win32.
