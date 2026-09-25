# OpenBook

Launcher plein écran pour Windows, inspiré de Googlebook OS (2026), construit avec Tauri 2 (Rust + WebView2).
Comme un launcher Android, c'est une appli qui sert d'écran d'accueil et lance les autres applis. Elle se lance et se quitte comme un logiciel normal, et ne modifie aucun réglage de Windows.

## Superposition au bureau Windows

OpenBook se place **par-dessus le bureau Windows** :

- **Plein écran** (par défaut) : une fenêtre sans bordure qui couvre tout l'écran, barre des tâches comprise, et qui n'apparaît pas dans la barre des tâches.
- Les applis lancées s'ouvrent **au-dessus** d'OpenBook. Quand tu les fermes ou les réduis, tu retombes sur OpenBook, comme sur un écran d'accueil.
- **Win+D, Win+M et « Afficher le bureau »** : si Windows réduit OpenBook, il est restauré en moins d'une demi-seconde. Tu retombes donc sur OpenBook, pas sur le bureau Windows (à confirmer sur ta machine).
- Tuile **Plein écran** désactivée : OpenBook occupe l'écran moins la barre des tâches, et reste **sous toutes les autres fenêtres**, comme un fond d'écran interactif.

Pour retrouver Windows : **Réglages rapides → Quitter OpenBook**.

Limites : OpenBook ne remplace pas l'explorateur de Windows (`explorer.exe`) et ne se lance pas tout seul au démarrage. La touche Windows ouvre toujours le menu Démarrer.

## État d'avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Barre du haut, réglages rapides, notifications, alimentation | ✅ |
| 2 | Dock centré, applis épinglées, point « récemment ouverte » | ✅ |
| 3 | Tiroir d'applis, recherche, Gemini, épingler | ✅ |
| 4 | Bureau : fonds, raccourcis déplaçables, widgets | PR suivante |
| 5 | Bulle Gemini (secouer le curseur) | PR suivante |
| 6 | Glowbar | PR suivante |
| 7 | Commandes Rust `open_app`, `open_files`, `power` | ✅ |
| 8 | Icônes favicon + pastille-lettre de secours | ✅ |
| — | Workflow Windows et Release `openbook-v0.1.0` | ✅ |

## Structure

```
openbook/
├── src/                  Front en HTML/CSS/JS pur (sans framework ni bundler)
│   ├── index.html
│   ├── styles.css        Material 3 Expressive
│   ├── js/               Modules ES : thème, barre du haut, dock, tiroir…
│   └── vendor/mcu.js     @material/material-color-utilities (vendorisé)
├── src-tauri/            Application Rust (Tauri 2)
├── demo/                 Démo navigateur avec simulation de window.__TAURI__
├── scripts/              Captures Playwright, vendorisation
├── screenshots/          Captures 1920×1080 et 1366×768, clair et sombre
└── assets/logo.svg       Logo « O » (source des icônes)
```

## Tester sans Windows

```sh
cd openbook
npm install
npm run demo          # http://localhost:4173/demo/
```

La démo charge `src/index.html` dans une page qui simule `window.__TAURI__` : les commandes (ouvrir une appli, éteindre…) s'affichent en bas à gauche au lieu de s'exécuter. Ajoute `?clean` à l'URL pour masquer ce journal.

Captures (serveur de démo lancé) :

```sh
npm run screenshots
# Derrière un proxy (HTTPS_PROXY) : NODE_USE_ENV_PROXY=1 npm run screenshots
```

## Sous Windows

Télécharge l'installateur dans la Release GitHub **openbook-v0.1.0** (ou dans les artefacts du workflow « OpenBook (Windows) »).

Pour développer : Rust stable, Node 22 et WebView2 (déjà présent sur Windows 10/11), puis :

```sh
cd openbook
npm install
npm run dev
```

## Commandes natives (Rust)

| Commande | Effet |
|---|---|
| `open_app(url)` | N'accepte que `https://`. Lance Chrome (Program Files, Program Files (x86), LocalAppData), sinon Edge, avec `--app=URL` et sans shell. Le navigateur utilise ton profil habituel, donc tu restes connecté à Google. Sans navigateur trouvé : ouverture dans le navigateur par défaut. |
| `open_files()` | Lance `explorer.exe`. |
| `power(action)` | `lock`, `restart` ou `shutdown`, via `rundll32 user32.dll,LockWorkStation` et `shutdown.exe`. L'interface demande toujours une confirmation avant. |

## Ce qu'OpenBook ne reproduit pas

- la vraie Glowbar, qui est une lumière sur le capot de l'ordinateur ;
- la touche Quick Insert ;
- « Continue on » avec un téléphone Android ;
- le Magic Pointer à l'échelle de tout Windows : il ne marchera qu'au-dessus d'OpenBook ;
- le réglage de la luminosité : le curseur est affiché mais désactivé.

## Régénérer

```sh
npm run icons    # icônes depuis assets/logo.svg
npm run vendor   # src/vendor/mcu.js
```
