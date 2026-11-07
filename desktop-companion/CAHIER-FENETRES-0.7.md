# Ruche OS Companion 0.7 — fenêtres, interactions et conformité

## Objectif
Ruche complète MyDockFinder : aucun second Dock, aucune seconde barre système. Elle ne modifie pas les fenêtres d'applications Windows tierces ni leurs ressources propriétaires. **Toutes les fenêtres Ruche** passent par Electron `BrowserWindow({frame:false,transparent:true})`, avec une barre de titre dessinée dans l'application. Uniquement les trois boutons rouge/jaune/vert à gauche, pas de barre ni de boutons de légende Windows.

## Géométrie de référence implémentée
- Boutons : diamètre 13 pixels CSS ; écart 8 px ; retrait gauche 18 px.
- Barre de titre : hauteur 52 px CSS ; titre centré.
- Fenêtre : rayon principal 18 px CSS ; rayon secondaire 10 px ; trait de séparation discret.
- Mac-like glass : dégradé de surface, transparence et flou configurables ; ombre à deux profondeurs. Les performances basses retirent le flou.
- **Ce sont des paramètres de la charte Ruche**, pas la preuve d'une reproduction exacte de pixels macOS : il faut confronter sur Windows à des captures autorisées de référence et aux facteurs de mise à l'échelle.

## Contrôles et comportement
- Rouge : masque la fenêtre Ruche ; l'application reste lancée en tray.
- Jaune : réduit la fenêtre par l'API Electron.
- Vert : bascule maximiser/restaurer ; Alt + clic : bascule plein écran.
- Double clic dans la barre de titre : maximise/restaure. La barre utilise la zone de glissement native Electron (`-webkit-app-region:drag`) ; les boutons sont exclus du glissement.
- Les fenêtres Finder, Réglages, Activité, Recherche, Centre de contrôle sont redimensionnables. Les dimensions et positions doivent encore être contrôlées sur un PC Windows 11.

## Applications
### Finder
Navigation dans le dossier personnel (limitation de sécurité), onglets, favoris, historique, vues icônes/liste/colonnes simplifiées/galerie simplifiée, recherche du dossier, panneau d'aperçu, création/renommage/copie/déplacement/corbeille. Aperçu rapide sur Espace ou menu contextuel, pour images et fichiers texte ; autres formats ouvrables via Windows. Les vues en colonnes/galerie ne prétendent pas reproduire intégralement Finder d'Apple.
### Réglages
Fenêtre Ruche unifiée avec barre supérieure et commandes Mac-like. Détection de MyDockFinder, apparence et mode économie de ressources, sans simulation de paramètres Windows.
### Centre de contrôle
Fenêtre Ruche frameless avec barre de titre ; raccourcis vers les véritables paramètres Windows.
### Activité
Liste des fenêtres du système, activation à la demande ; Windows peut refuser le focus.
### Recherche
Panneau sans décorations Windows, recherche des applications connues ; pas encore d'indexation universelle des fichiers.
### Quick Look
Panneau d'aperçu **dans Finder** et non processus autonome, Espace pour ouvrir/fermer. Formats supportés : image et texte limités en taille ; pas encore PDF/vidéo/Office.

## Sécurité et compatibilité
- Pas de patch Explorer, pas de modification du registre, pas de hook global sur d'autres applications, pas de masquage des contrôles des fenêtres externes.
- Réglage compagnon par défaut activé ; Dock/Bar/Desktop Ruche masqués.
- `Ctrl+Alt+Escape` termine Ruche et laisse Windows/MyDockFinder intacts.
- Graphisme non certifié pixel-perfect, intégration graphique Windows et accélération MyDockFinder non mesurées.

## Vérifications à effectuer sur Windows 11
1. Vérifier que les boutons Windows n'apparaissent **sur aucune** fenêtre Ruche.
2. Tester rouge/jaune/vert, Alt+vert, double clic titre, déplacement, redimensionnement et DPI 100 %, 125 %, 150 %.
3. Tester les coins et transparences, avec MyDockFinder actif et désactivé.
4. Tester Finder sur fichiers et dossiers temporaires, corbeille et aperçu rapide.
5. Comparer des captures à résolution égale pour contrôler la fidélité, puis ajuster les variables CSS.
6. Mesurer CPU/RAM/GPU/FPS avant/après avec MyDockFinder : aucune amélioration n'est encore démontrée.
