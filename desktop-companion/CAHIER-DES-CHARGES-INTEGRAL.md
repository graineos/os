# RUCHE OS DESKTOP — CAHIER DES CHARGES INTEGRAL
Version de travail : 0.3-alpha / 7 novembre 2026

## 0. Vision et définition honnête du produit
Ruche OS Desktop est une **distribution d'environnement de bureau** pour Windows 11. Elle doit produire une impression d'usage proche de macOS Tahoe dans l'ensemble des interactions quotidiennes, et non seulement fournir un thème ou un Dock. Le noyau, les pilotes, la sécurité Windows et les applications Win32 restent ceux de Windows. Ne jamais commercialiser le projet comme une copie officielle de macOS ou un portage d'Apple.

Expérience cible : au lancement de la session Windows, l'utilisateur retrouve un bureau Ruche original, une barre de menus supérieure, un Dock, un Finder, un Launchpad, un Spotlight, des contrôles rapides, des espaces de travail, une navigation au clavier et des animations homogènes. Tous les modules doivent suivre une même grammaire visuelle : matériaux translucides, profondeur mesurée, typographie soignée, espacements cohérents, retours immédiats, accessibilité.

### Invariants non négociables
- Le retour à Windows doit être toujours accessible : raccourci d'urgence, menu de sortie, désinstallation simple.
- Aucune modification automatique du registre, du shell utilisateur, de `explorer.exe`, des permissions système, de Windows Update ou de la sécurité Windows pendant l'alpha.
- Aucune installation d'outil tiers, aucun téléchargement distant d'exécutable ou exécution non vérifiée sans consentement explicite.
- Aucune dépendance obligatoire à une IA, à un serveur privé, à l'authentification, à FoundationDB, à Apache Flink ou au site personnel.
- Un bouton non opérationnel doit être indiqué comme un renvoi aux paramètres Windows ou une fonctionnalité à venir, jamais comme une fonction native active.
- Pas d'assets propriétaires Apple ni de récupération non autorisée de ressources de macOS ou d'icônes propriétaires.
- Les licences et avis d'attribution de toute dépendance doivent être conservés.

## 1. État du code réellement présent en 0.3

| Module | État 0.3 | Précision |
|---|---|---|
| Bureau Ruche | prototype codé | fenêtre qui affiche le fond et les raccourcis, pas un shell Windows alternatif |
| Dock | prototype codé | applications épinglées, agrandissement au pointeur, pas de regroupement fiable par processus |
| Barre de menus | prototype codé | horloge et boutons Ruche ; pas de menu Windows contextuel global |
| Launchpad | prototype codé | raccourcis du menu Démarrer + recherche par nom, pas les apps Store absentes des raccourcis |
| Spotlight | prototype codé | filtre des raccourcis ; ni index des fichiers ni moteur sémantique |
| Finder | prototype codé | consultation limitée au dossier personnel ; ouverture avec le programme par défaut |
| Centre de contrôle | prototype codé | liens authentiques vers les paramètres Windows, pas des interrupteurs réseau/son natifs |
| Vue des fenêtres | prototype codé | détection PowerShell de certaines fenêtres, sans activation/aperçus |
| Paramètres Ruche | prototype codé | thème, couleur, fonds, transparence, épinglage, bureau, réduction du mouvement |
| Icônes natives | prototype codé | extraction via Electron pour les raccourcis découverts |
| Sécurité | première couche | validation IPC, isolation renderer, contrôle des chemins, pas d'exécution arbitraire côté UI |
| Sortie | codé | `Ctrl+Alt+Échap` et menu tray, fermeture restaure l'environnement Windows existant |
| Packaging Windows | workflow fourni | compilation Windows x64 non exécutée dans cet environnement Linux |
| Gestion du shell | non implémenté | pas de remplacement ni interception d'explorer.exe |
| Multimoniteur avancé | non implémenté | fenêtre Ruche sur écran principal ; les autres écrans restent Windows |
| Mises à jour avec rollback | non implémenté | seul le cahier des charges est spécifié |
| Ruche OS Core | non connecté | projet OPENDOOR OS conservé séparé |

## 2. Expérience d'interface « Mac au quotidien »

### 2.1 Démarrage et écran principal
- Après une première installation volontaire, Ruche peut proposer un démarrage à l'ouverture de session, désactivé par défaut.
- Écran de première configuration : choisir thème clair/sombre/auto, fond d'écran, épinglage d'applications, raccourcis et mode de récupération.
- Fond dynamique original Ruche avec variantes locales, animation limitée aux GPU compatibles et préférence système « réduire les animations ».
- Desktop sur chaque moniteur à terme, gestion fiable des coordonnées DPI et de la zone de travail.
- Ne pas masquer la barre Windows tant qu'une solution stable et réversible n'est pas validée sur un jeu de machines Windows 11.

### 2.2 Dock
- Dock repositionnable bas/gauche/droite, auto-masquage, délais configurables.
- Grossissement fluide en fonction de la distance du pointeur, interpolation sans oscillation, durée cible < 160 ms.
- Icônes Windows réelles, cache mémoire+disque, mises à jour de l'icône lorsque l'application change.
- Applications épinglées, ouvertes et récemment utilisées distinguées, points d'activité basés sur les vrais processus.
- Clic pour ouvrir/activer, clic secondaire pour menu contextuel, drag-and-drop pour épingler et réordonner.
- Indicateurs de plusieurs fenêtres, prévisualisation et menus « Nouvelle fenêtre », « Fermer » seulement lorsque réalisables.
- Bouton Corbeille éventuellement via API Windows officielle, sans emuler de suppression arbitraire.

### 2.3 Barre supérieure
- Menu Ruche principal, nom de l'application active, commandes de l'application lorsque l'API permet l'intégration.
- Centre de contrôle réel : statuts et contrôles Wi-Fi, son, Bluetooth, luminosité selon permissions et matériel.
- Horloge locale, batterie, connectivité, notifications, raccourcis de recherche.
- Gérer les zones de notification / tray grâce aux APIs Windows, pas au scraping fragile de fenêtres.
- Panneau propre pour chaque contrôle ; si non disponible, ouvrir la page Windows correspondante en l'indiquant clairement.

### 2.4 Launchpad
- Découverte des raccourcis du menu Démarrer et applications UWP/MSIX, sans doublons.
- Grille paginée et performante, dossiers de groupes, favoris, re-classement, drag-and-drop.
- Recherche intégrée, navigation clavier, navigation lecteur d'écran.
- Zéro suppression ou désinstallation automatique d'applications.

### 2.5 Spotlight
- Indexation locale contrôlée : applications, fichiers autorisés, signets.
- Recherche incrémentale < 100 ms sur index chaud ; des tâches asynchrones non bloquantes pour la recherche de fichiers.
- Commandes mathématiques, calculatrice, conversion d'unités en mode local optionnel.
- Résultats groupés, actions explicites, permissions et historique effaçable.
- Extension IA locale ultérieure, complètement facultative.

### 2.6 Finder
- Barre latérale Favoris, Bureau, Téléchargements, Documents, Images, Musique.
- Colonnes, liste, grille, fil d'Ariane, recherche, tags locaux et Quick Look par barre Espace.
- Opérations déplacer/copier/renommer/supprimer uniquement après tests et confirmations adaptées.
- Prévention des traversées de répertoire, traitement des liens symboliques, fichiers verrouillés, chemins Unicode/UNC.
- Gestion des droits NTFS et des erreurs, aucun contournement des ACL Windows.

### 2.7 Fenêtres et bureaux virtuels
- Vue Mission Control indépendante, représentations réellement synchronisées des fenêtres existantes.
- Espaces Windows via APIs/documentation officielles ; pas de dépendance fragile à des offsets internes non documentés.
- Activation et basculement des fenêtres, agrandissement, minimisation, snapping, exposé, raccourcis.
- Compatibilité applications Win32, WinUI3, UWP, jeux plein écran, RDP, applications élevées.
- Focus et z-order respectés ; aucun programme ne doit rester bloqué derrière le bureau Ruche.

### 2.8 Paramètres et récupération
- Apparence, thème, fond, transparence, Dock, raccourcis, sécurité, modules, performances, notifications.
- `Ctrl+Alt+Échap` comme mécanisme d'urgence en alpha ; conserver un deuxième accès tray.
- Un "mode sans Ruche" et une désinstallation normale Windows avant toute fonction de démarrage automatique.
- Sauvegarde locale des paramètres et retour aux valeurs par défaut.

## 3. Architecture technique recommandée, sans collage de projets

### Étape A : base 0.x
Electron + renderer web de l'archive actuelle : garder cette base pour prototyper rapidement l'expérience et valider les interactions. APIs système exposées via une passerelle IPC à liste blanche et validation stricte dans le processus principal.

### Étape B : service natif Windows
Créer un **Ruche Windows Bridge** indépendant en C#/.NET + WinUI/Win32 ou Rust, selon les besoins réels, avec une API locale versionnée et une authentification par capacité/processus. Fonctions natives : fenêtres, applications, icônes, virtual desktops, volume, écran, notifications.

### Étape C : architecture stable
Extraire progressivement les écrans sur un moteur UI léger si les mesures de consommation mémoire/GPU le justifient. Ne pas réécrire simplement pour changer de framework. Mesurer avant de migrer.

### Modules
```
ruche-desktop/
  app/                # bureau, dock, bar, finder, launchpad, search, settings
  bridge-windows/     # Win32/WinRT/WMI contrôlés
  core/               # événements, configuration, stockage, permissions
  resources/          # assets originaux Ruche
  recovery/           # mécanismes de retour Windows
  updater/            # packages vérifiés, rollback
  tests/              # UI, sécurité, performances, compatibilité
  .github/workflows/  # packaging, checks, release candidats
```

## 4. Inventaire des sources externes et usage autorisé
- `Asteski/WinMac` : étude du workflow hybride, scripts originaux MIT, thèmes sous CC BY-NC. Pas de copie globale.
- `dockable.app` : référence UX seulement, licence du code non établie.
- `Apollo199999999/LauncherX` : C#/WinUI3 MIT ; intérêt pour découverte de fichiers, raccourcis, icônes, stockage JSON. Vérifier ses notices tiers.
- `punkable/booki` : référence du Dock, licence et dépendances à vérifier pour chaque portion effectivement reprise.
- `Flow-Launcher/Flow.Launcher` : recherche et extensibilité.
- `cairoshell/ManagedShell` : services Windows shell et notification.
- `eythaann/Seelen-UI` : architecture d'environnement alternatif ; AGPL, intégration sous conformité juridique requise.
- `jensroth-git/WinLaunch` : grille d'apps et ergonomie, code réutilisable seulement selon sa licence.
- `amnweb/yasb` : widgets de barre supérieure et statuts système.
- `microsoft/WindowsAppSDK` : SDK natif Windows, non code complet de Windows 11.
- `apple-open-source/macos` : inspiration architectures disponibles, pas d'autorisation sur l'interface propriétaire macOS.
- `apple/foundationdb`, `flink.apache.org` : infrastructure serveur optionnelle, hors du client Desktop.
- `rxliuli/apple-release` : publication macOS/iOS, pas de pipeline Windows.
- `GreyXor/Windows-11` : archivage MS-DOS sous titre trompeur, exclu du build.
- Steam bootstrapper fichiers langue : sources d'inspiration pour UX de mise à jour ; pas de code de mise à jour Steam.

## 5. Sécurité, confidentialité, licences
- Tout objet retourné par IPC est sérialisé avec données nécessaires uniquement ; aucun token ni mot de passe.
- Refuser chemins non autorisés et symlinks qui franchissent le périmètre du dossier personnel pour le Finder alpha.
- Pas de commande terminale issue d'un champ de recherche ; commandes système prédéfinies uniquement.
- Ne jamais utiliser l'élévation UAC pour de simples fonctions de personnalisation.
- Traiter la récupération et restauration comme fonctionnalités de première classe.
- Vérifier les licences transitives, avis et icônes avant diffusion.
- Préparer SBOM, SHA256 des artefacts, signature Authenticode lorsqu'un certificat valide est disponible.

## 6. Performances — critères d'acceptation
- Mesurer le temps de démarrage à froid et à chaud sur plusieurs machines Windows 11.
- Établir budget RAM et CPU mesurés, pas des nombres annoncés sans test ; aucune boucle de rafraîchissement coûteuse dans Dock.
- Les scans de raccourcis ne bloquent pas le rendu ; les icônes sont chargées paresseusement et mises en cache.
- Tester 1080p/1440p/4K, 100/125/150/200 % DPI, multiécran, changements d'affichage, veille/reprise.
- Tests d'accessibilité clavier, contraste, screen readers, mouvement réduit.

## 7. Livraison et définition de terminé
1. Construire l'artefact Windows x64 sur runner Windows à partir d'un commit immuable.
2. Vérifier le résultat du workflow et le journal de compilation.
3. Installer sur VM Windows 11 propre, puis sur PC de test avec consentement.
4. Vérifier launchpad/dock/finder/centre de contrôle/paramètres/raccourcis.
5. Tester démarrage, sortie normale, sortie urgence et restauration Windows.
6. Test de mise à jour Windows ; comparaison du comportement avec Ruche arrêté et lancé.
7. Valider licences et mentions, publier la release candidate accompagnée des limitations.
8. Ne déclarer version finale que lorsque tous les critères sont réellement satisfaits.

## 8. Priorités claires après alpha 0.3
**P0** : comportement de bureau robuste : z-order, focus, multiécran, barre Windows, récupération, construction Windows et tests de régression.
**P1** : Dock dynamique réel et bar système native ; Launchpad avec apps MSIX, ouverture/reprise/fermeture de fenêtres ; menus contextuels.
**P2** : Finder complet, Spotlight fichiers, Mission Control/Spaces, QuickLook, notifications.
**P3** : updater robuste avec signature et rollback, personnalisation avancée, mesure télémétrie locale opt-in.
**P4** : intégrations Ruche/OPENDOOR OS facultatives ; système d'extensions documenté avec sandbox et permissions.
