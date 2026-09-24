# Angel Native Stack

Objectif : rendre OPENDOOR OS nettement plus puissant en combinant les services externes déjà fonctionnels avec des moteurs internes développés pour OPENDOOR OS.

## Principe

Angel Native n’est pas un plan de sortie des services externes. C’est une couche d’amplification.

Quand un service externe apporte des données, une infrastructure ou une puissance utile, OPENDOOR OS le conserve. En parallèle, les briques Angel Native prétraitent, enrichissent, mettent en cache, agrègent, automatisent, journalisent, priorisent et reprennent les tâches après erreur.

La puissance cible vient donc de l’addition : externe + natif.

## Base active

- React / TypeScript / Tailwind CSS / Vite / Framer Motion : interface et cockpit.
- TanStack Start : serveur web/API actuel.
- Angel Native Storage : persistance locale/offline structurée.
- Angel Native Cache : cache et état éphémère.
- Angel Native Worker : moteur de tâches interne.
- Request Queue OPENDOOR OS : file de tâches.
- Hybrid Orchestrator : coordination adaptative entre fournisseurs externes et moteurs internes.
- Durable Workflow Engine : workflows avec checkpoints, retries, reprise et historique.
- Angel Event Log : journal central immuable des événements fonctionnels et techniques.
- Angel Telemetry : métriques, latences, succès, erreurs et santé des moteurs.
- Angel Memory Index : mémoire unifiée et recherche interne multi-source.
- Storage Orchestrator : sélection et réplication entre stockage principal, archive et sauvegarde.

## Stockage hybride

Google Drive est la couche d’archive externe de référence pour les gros fichiers et les données qui n’ont pas besoin d’un stockage transactionnel : médias lourds, pièces jointes, exports et sauvegardes. Le dossier racine est `OPENDOOR OS Storage`, structuré en `Media`, `Backups`, `Attachments` et `Exports`.

Le stockage de production déjà fonctionnel reste le stockage principal pour les opérations courantes. Le Storage Orchestrator peut ensuite envoyer ou référencer une copie d’archive sans bloquer la fonction principale si Drive est indisponible. Le navigateur ne simule jamais un upload Drive sans autorisation Google réelle côté serveur ; l’archivage Drive est assuré par les automatisations OPENDOOR OS lorsqu’elles disposent de l’accès nécessaire.

Vercel n’est pas considéré comme un stockage applicatif obligatoire : il reste une couche de déploiement/front lorsque pertinente. GitHub conserve le code ; Drive prend les fichiers lourds ; OPENDOOR OS orchestre les traitements et l’indexation.

## Équivalents internes complémentaires

| Technologie de référence | Besoin OPENDOOR OS | Brique Angel Native | Rôle complémentaire |
|---|---|---|---|
| Express | routage API, middleware, contrôles | Angel Native API Router | centraliser et pré/post-traiter les appels |
| MySQL | collections, relations, index, requêtes structurées | Angel Native Data Engine | index, vues dérivées et données calculées |
| Redis | cache, TTL, files, pub/sub, verrous | Angel Native Realtime Core | accélération, coordination et temps réel |
| Python | automatisation, pipelines, traitement | Angel Native Automation Engine | analyses et enrichissements spécialisés |
| Rust | tâches intensives et fonctions bas niveau | Angel Native Compute Layer | accélérer les traitements coûteux |
| ZTP | bootstrap automatique | Angel Native Bootstrap | préparer et réparer l’environnement |

## Orchestration adaptative

Le Hybrid Orchestrator sait fonctionner en `cascade`, `race`, `merge` et `adaptive`. Le mode adaptatif classe les fournisseurs selon priorité, fiabilité, latence et coût relatif. Il utilise le cache, journalise les défaillances et peut enrichir les résultats via les workers internes.

## Workflows durables

Chaque opération importante peut être découpée en étapes avec état persistant, compteur de tentatives, retry exponentiel, checkpoint après chaque étape et reprise à partir de la dernière étape réussie. Les événements `workflow.*` alimentent le journal central et la télémétrie.

## Mémoire et observabilité

Angel Memory Index fournit une recherche transversale sur les contenus indexés (articles, candidatures, fichiers, conversations, tâches ou autres sources branchées). Angel Telemetry collecte les métriques et Angel Event Log fournit la chronologie globale des actions.

## Règles

1. Un service externe fonctionnel n’est jamais supprimé simplement parce qu’un équivalent Angel Native existe.
2. Les briques Angel Native doivent augmenter vitesse, résilience, contexte, automatisation, enrichissement ou capacité hors ligne.
3. Plusieurs moteurs peuvent travailler sur la même tâche si leur combinaison produit un meilleur résultat.
4. Aucun écran ne doit afficher « connecté » ou « actif » si la fonction correspondante n’existe pas réellement.
5. Une brique maison vise la parité ou un avantage fonctionnel sur les besoins d’OPENDOOR OS, pas la reproduction intégrale d’un moteur généraliste.
6. Aucune configuration manuelle utilisateur n’est requise pour les fonctions Angel Native.
7. Les données sensibles ou multi-appareils restent sur la couche de production fiable ; Angel Native peut les indexer et les enrichir.
8. Le critère de réussite est la puissance obtenue par la combinaison des couches.
9. Un stockage secondaire ou d’archive ne doit jamais faire échouer un upload principal déjà fonctionnel.
