# OPENDOOR OS IA — couche personnelle intelligente

OPENDOOR OS IA est la distribution personnelle et intelligente construite au-dessus d'OPENDOOR OS.

## Principe

OPENDOOR OS reste neutre, réutilisable et système. Il fournit les primitives d'exécution : événements, workflows, mémoire système, données, synchronisation, stockage, déploiement, nœuds, supervision technique et reprise.

OPENDOOR OS IA exploite ces primitives pour les usages personnels : assistant, agents, mémoire personnelle, recommandations, priorisation, candidatures, mails, agenda, actualités personnalisées, films/Movix et automatisations intelligentes.

## Règle de dépendance

```text
OPENDOOR OS IA -> OPENDOOR OS
OPENDOOR OS -X-> OPENDOOR OS IA
```

Une panne d'OPENDOOR OS IA ne doit pas empêcher OPENDOOR OS de continuer à servir les fonctions système.

## Répartition

### OPENDOOR OS

- Core
- Event Bus
- Durable Workflow Engine
- Event Log
- Telemetry
- Memory primitives
- Data / Sync
- Storage
- Release / Deploy
- Node / Gateway
- Guardian / Recovery
- Application Runtime

### OPENDOOR OS IA

- fournisseurs IA
- conversation
- génération
- analyse
- agents
- mémoire personnelle
- préférences et historique utilisateur
- recommandations
- priorisation personnelle
- supervision intelligente
- candidatures
- mails
- agenda
- actualités personnalisées
- recommandations films / Movix
- automatisations intelligentes

## Règle d'architecture

OPENDOOR OS observe et exécute. OPENDOOR OS IA comprend, personnalise, recommande et décide dans les limites autorisées.
