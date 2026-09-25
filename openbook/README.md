# OpenBook

Launcher plein écran pour Windows, inspiré de Googlebook OS (2026), construit avec Tauri 2 (Rust + WebView2).
Il se superpose au bureau Windows et, en un clic, habille tout Windows aux couleurs de Googlebook. Aucune appli tierce à installer : tout est dans OpenBook.

## Installation

1. Télécharge **[OpenBook-setup.exe](https://github.com/graineos/os/releases/latest/download/OpenBook-setup.exe)** (toujours la dernière version), ou depuis la page Labo d'angel-beta.fr.
2. Lance-le : il s'installe sans droits administrateur. SmartScreen peut avertir, car l'appli n'est pas signée : « Informations complémentaires » puis « Exécuter quand même ».
3. Au premier lancement, clique sur **Transformer Windows**. C'est tout : dès la prochaine ouverture de session, OpenBook s'affiche directement et Windows n'apparaît plus.

## Nouveautés de la version 2

Reprises des comportements d'AOSP (barre des tâches de bureau d'Android, réglages rapides de SystemUI) et de ChromeOS (lanceur, Vue d'ensemble, Quick Insert), réimplémentés sur Windows. Le code propre à Googlebook OS n'est pas publié.

| | Fonction | Détail |
|---|---|---|
| Surcouche totale | Ouverture au démarrage | OpenBook se lance à l'ouverture de session (option du Mode Googlebook, retirée par « Revenir à Windows »). |
| | Touche Windows | La touche Windows seule ouvre le lanceur d'OpenBook au lieu du menu Démarrer ; Win+Tab ouvre la Vue d'ensemble. Win+E, Win+L, Win+V… restent intacts. |
| Fenêtres façon Android | Barre fusionnée | Applis épinglées et fenêtres ouvertes regroupées par appli (Gmail, YouTube… reconnus même dans Chrome), indicateur de fenêtre active, clic pour afficher ou réduire. |
| | Aperçus en direct | Au survol, miniatures en direct (DWM) des fenêtres de l'appli, avec fermeture. |
| | Ancrage | Clic droit : ancrer à gauche/droite, agrandir, réduire, fermer. |
| | Vue d'ensemble | Toutes les fenêtres en miniatures en direct, avec ancrage et fermeture. |
| Lanceur ChromeOS | Recherche unifiée | Applis, fichiers (Bureau, Documents, Téléchargements, Images, Musique, Vidéos), 28 pages des Paramètres Windows, calculs, conversions (longueurs, masses, volumes, températures, vitesses, données), Google et Gemini. Navigation au clavier. |
| | Continuer | Les fichiers récents de Windows en tête du lanceur. |
| Réglages rapides réels | Wi-Fi et Bluetooth | Vraies bascules (API Radios), liste des réseaux Wi-Fi, connexion en un clic aux réseaux enregistrés. |
| | Volume | Curseur réel du périphérique de sortie (Core Audio) et coupure du son. |
| | Multimédia | Titre, artiste et pochette de la musique ou vidéo en cours, lecture/pause, précédent, suivant (toute appli compatible Windows). |
| Quick Insert complet | Verr. Maj | Panneau près du curseur texte : emoji (recherche en français), historique du presse-papiers (en mémoire, 25 éléments), date et heure, calculs et conversions, inséré directement dans l'appli en cours. |

## Ce que fait OpenBook

| | Fonction | Détail |
|---|---|---|
| 1 | Barre du haut | Heure, date, réseau, batterie réelle. Réglages rapides : thème sombre, ne pas déranger, plein écran, Internet, Bluetooth, éclairage nocturne, luminosité (écran de portable), volume. Notifications OpenBook. Verrouiller, redémarrer, éteindre, avec confirmation. |
| 2 | Dock | Pilule centrée translucide : lanceur « O », applis épinglées, puis **les fenêtres ouvertes** (clic pour y aller, clic droit pour fermer). Il remplace la barre des tâches. |
| 3 | Tiroir d'applis | Applis Google **et applis Windows installées** (lues dans le menu Démarrer, avec leurs vraies icônes), Paramètres Windows, Microsoft Store. Recherche, Entrée → Google, « Demander à Gemini ». |
| 4 | Bureau | 8 fonds d'écran Material 3, raccourcis déplaçables, widgets Horloge, Coup d'œil, Météo (Open-Meteo), Recherche et Pense-bête, en 2 tailles. Clic droit ou appui long sur le bureau. |
| 5 | Magic Pointer | Secoue la souris **n'importe où dans Windows** : une bulle « Demander à Gemini… » apparaît près du pointeur. La question est copiée, puis Gemini s'ouvre. |
| 6 | Glowbar | Barre lumineuse en haut de l'écran : balayage au démarrage, pulsation pendant la bulle Gemini, niveau de batterie quand on branche le chargeur. |
| 7 | Quick Insert | **Verr. Maj** ouvre Quick Insert depuis n'importe quelle appli. Maj + Verr. Maj active toujours les majuscules. |
| 8 | Mode Googlebook | Applique à Windows le thème clair/sombre, la couleur d'accent Material You, le même fond d'écran et masque la barre des tâches. **Réversible** : « Revenir à Windows » ou la désinstallation remettent tout comme avant. |

Chaque fonction se désactive dans **Paramètres OpenBook**, via le rouage des réglages rapides ou le clic droit sur le bureau.

## Superposition au bureau Windows

- **Plein écran** (par défaut) : OpenBook couvre tout l'écran, barre des tâches comprise, et n'apparaît pas dans la barre des tâches. Les applis lancées s'ouvrent par-dessus ; en les fermant, tu retombes sur OpenBook.
- **Win+D / Win+M** : si Windows réduit OpenBook, il revient aussitôt.
- Tuile **Plein écran** désactivée : OpenBook laisse la barre des tâches et reste sous toutes les fenêtres, comme un fond d'écran interactif.
- Une seule instance : relancer OpenBook ramène la fenêtre existante.

## Ce qu'OpenBook modifie dans Windows (Mode Googlebook)

Seulement pour ton compte (HKEY_CURRENT_USER), jamais sans ton clic, toujours sauvegardé avant :

| Réglage | Emplacement |
|---|---|
| Thème clair/sombre, transparence | `Themes\Personalize` : `AppsUseLightTheme`, `SystemUsesLightTheme`, `EnableTransparency` |
| Couleur d'accent | `Explorer\Accent` (`AccentPalette`, `AccentColorMenu`, `StartColorMenu`), `DWM` (`AccentColor`, `ColorizationColor`), `Control Panel\Desktop\AutoColorization` |
| Fond d'écran | image PNG dans `%APPDATA%\fr.graineos.openbook\`, `WallpaperStyle`, `TileWallpaper` |
| Barre des tâches | masquage automatique (API `SHAppBarMessage`) |
| Ouverture au démarrage | `Software\Microsoft\Windows\CurrentVersion\Run` : valeur `OpenBook` |

Les valeurs d'origine sont stockées dans `%APPDATA%\fr.graineos.openbook\googlebook-backup.json`. `OpenBook.exe --restore` les remet ; le désinstalleur le lance automatiquement.

## Ce qui reste hors de portée

- La vraie Glowbar, qui est une lumière sur le capot de l'ordinateur.
- « Continue on » avec un téléphone Android.
- Les boîtes de dialogue anciennes de Windows, le Panneau de configuration et l'écran de connexion gardent leur style Windows.
- La luminosité ne se règle que sur l'écran intégré d'un portable (pas sur un écran externe).
- L'éclairage nocturne et l'appairage Bluetooth ouvrent la page des Paramètres Windows correspondante ; un réseau Wi-Fi jamais utilisé se configure dans les Paramètres (mot de passe).
- Les notifications des autres applis restent celles de Windows.
- L'écran de connexion de Windows s'affiche toujours avant OpenBook.

## Structure

```
openbook/
├── src/                     Front en HTML/CSS/JS pur (sans framework ni bundler)
│   ├── index.html           Fenêtre principale
│   ├── bubble.html          Bulle Gemini (Magic Pointer)
│   ├── glow.html            Glowbar
│   ├── styles.css           Material 3 Expressive
│   ├── js/                  Modules ES
│   └── vendor/mcu.js        @material/material-color-utilities (vendorisé)
├── src-tauri/
│   ├── src/lib.rs           Commandes Tauri
│   ├── src/win/             API Win32 : réglages, applis, fenêtres, entrées, système
│   └── installer-hooks.nsh  Restauration à la désinstallation
├── demo/                    Démo navigateur avec simulation de window.__TAURI__
├── scripts/                 Captures Playwright, vendorisation
└── screenshots/             Captures 1920×1080 et 1366×768, clair et sombre
```

## Tester sans Windows

```sh
cd openbook
npm install
npm run demo          # http://localhost:4173/demo/
```

La démo simule les commandes Windows : elles s'affichent dans l'encart en bas à droite, avec des boutons pour simuler la secousse, Verr. Maj et le chargeur. Ajoute `?clean` à l'URL pour masquer l'encart.

Tests (serveur de démo lancé) : `npm test` rejoue 112 vérifications d'interface.
Captures : `npm run screenshots` (derrière un proxy : `NODE_USE_ENV_PROXY=1 npm run screenshots`).

## Développer sous Windows

Rust stable, Node 22, WebView2 (présent sur Windows 10/11) :

```sh
cd openbook
npm install
npm run dev
```

`npm run icons` régénère les icônes depuis `assets/logo.svg`, `npm run vendor` régénère `src/vendor/mcu.js`.
