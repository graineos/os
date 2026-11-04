# Contribuer à Ruches

- Le cœur (`src/core`) ne dépend ni de React ni d'un service externe. Toute nouvelle dépendance doit être justifiée (rôle, licence, poids, remplaçant possible) dans ARCHITECTURE.md.
- Une fonctionnalité affichée comme disponible doit fonctionner et être testée ; sinon elle n'apparaît pas, ou elle est marquée « expérimentale ».
- Aucune donnée fictive présentée comme réelle ; aucune promesse de performance sans mesure reproductible (voir docs/LAB.md).
- Toute action destructrice ou irréversible passe par une confirmation explicite.
- Accessibilité : clavier et lecteurs d'écran (rôles ARIA, étiquettes), contraste en clair et en sombre.
- Mobile d'abord : vérifier à 412 px de large.
- Tests : `bun test` dans `ruches/` doit passer ; ajouter un test pour tout correctif du cœur.
- Langue : interface et commentaires en français.
- Format sur disque : toute modification incrémente `MANIFEST_VERSION` et fournit une migration automatique.
