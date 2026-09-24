# OPENDOOR OS — architecture distribuée hybride

## Frontière officielle

**OPENDOOR OS** est le noyau, la plateforme et l’infrastructure. Il doit pouvoir fonctionner sans intelligence artificielle.

**OPENDOOR OS IA** est une distribution construite au-dessus d’OPENDOOR OS. Elle ajoute les fournisseurs IA, la conversation, l’analyse, la génération, les agents et les automatisations intelligentes. OPENDOOR OS IA dépend d’OPENDOOR OS ; OPENDOOR OS ne dépend jamais d’OPENDOOR OS IA.

`angel-leclerc.fr` est une application qui utilise OPENDOOR OS et, pour certaines fonctions, OPENDOOR OS IA.

## Principe

OPENDOOR OS ne remplace pas les services externes fonctionnels. Il les combine avec ses moteurs natifs afin d’augmenter la capacité globale, la continuité de service et l’observabilité.

```text
GitHub -> Angel Release / Angel Deploy -> Vercel
                                  \----> Angel Node Linux

clients -> Angel Gateway -> noeud sain
                    |
                    -> OPENDOOR OS Core
                        |- Event Log
                        |- Telemetry
                        |- Memory Index
                        |- Durable Workflows
                        |- Hybrid Orchestrator
                        |- Guardian / Recovery
                        |- Sync
                        |- Storage
                        |- Realtime
                        `- Workers

OPENDOOR OS IA -> utilise ces capacités via adaptateurs
```

## Services système OPENDOOR OS

### Angel Release
Décrit une release immuable : version, commit, checksum et état de chaque cible.

### Angel Deploy
Orchestre la publication d’une même release vers plusieurs cibles. Vercel est une cible, Angel Node une autre. Un échec d’une cible ne doit pas automatiquement invalider les autres.

### Angel Node
Cible Linux prévue pour exécuter le web, les API, les workers et les workflows OPENDOOR OS. Un nœud physique reste nécessaire : OPENDOOR OS ne prétend pas créer du CPU ou du réseau sans machine.

### Angel Gateway
Classe les nœuds selon santé, priorité et latence, afin de sélectionner la meilleure cible disponible. Un basculement de domaine réellement transparent nécessite toujours une couche réseau/DNS/proxy compatible.

### Angel Data / Sync
Les données ne doivent pas être liées à un serveur web. Sync gère version, fraîcheur, doublons et conflits entre représentations.

### Angel Memory
Index transversal destiné aux informations utiles provenant des différentes applications et services.

### Angel Realtime
Cache TTL, files, pub/sub, verrous et état éphémère. Redis peut augmenter cette capacité lorsqu’il est disponible ; le moteur Angel Native reste complémentaire.

### Durable Workflow Engine
Tâches avec état, étapes, checkpoints, retries et reprise.

### Event Log + Telemetry
Chronologie des actions et métriques de fonctionnement.

### Guardian + Recovery
Guardian détecte les anomalies. Recovery choisit une stratégie : retry, fallback, rollback, resync, invalidation de cache, isolation de fournisseur ou restauration d’un checkpoint.

### Hybrid Orchestrator
Combine fournisseurs externes et moteurs natifs en cascade, race, merge ou stratégie adaptative.

## Stockage

- GitHub : code et historique de développement.
- Stockage applicatif existant : opérations courantes.
- Google Drive / `OPENDOOR OS Storage` : gros fichiers, archives, sauvegardes et exports.
- Angel Native Storage : persistance locale/offline adaptée.
- Angel Realtime / Redis disponible : cache et état temporaire.

Google Drive n’est pas utilisé comme fausse base transactionnelle.

## Technologies cibles

React, TypeScript, Tailwind CSS, Vite et Framer Motion forment la couche web actuelle. Express, MySQL, Redis, Python et Rust sont utilisés lorsqu’ils peuvent réellement renforcer OPENDOOR OS sans introduire de dépendance manuelle inutile. Les équivalents Angel Native restent complémentaires, pas des imitations affichées comme de vrais services.

## Règle de vérité

Une capacité ne doit jamais être affichée comme active si elle n’est pas réellement câblée. Les couches système continuent de fonctionner même si OPENDOOR OS IA est indisponible. Les services externes existants ne sont pas supprimés lorsqu’ils rendent le système plus puissant.
