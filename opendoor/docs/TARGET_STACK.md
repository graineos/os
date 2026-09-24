# OPENDOOR OS — architecture cible

## Principe

OPENDOOR OS évolue vers une architecture auto-gérée sans imposer d'action manuelle à l'utilisateur. Une technologie n'est activée que si elle peut être installée, configurée, testée et exploitée automatiquement avec l'infrastructure déjà accessible.

Si une technologie exige une nouvelle clé, un nouveau compte, une configuration DNS, un paiement ou une intervention manuelle, elle reste différée. Le service fonctionnel existant reste utilisé comme fallback.

## Interface active

- React
- TypeScript
- Tailwind CSS
- Vite
- Framer Motion

Cette base est déjà utilisée par le site et doit rester la voie principale pour les interfaces publiques et administrateur.

## API

La voie active reste TanStack Start et ses routes serveur. Express devient une cible uniquement pour une future instance OPENDOOR OS autonome si une machine peut être provisionnée automatiquement. Aucun double backend ne doit être ajouté sans besoin réel.

## Données

MySQL est la cible portable pour une future installation auto-hébergée. Tant qu'aucune instance MySQL ne peut être provisionnée automatiquement, OPENDOOR OS conserve la couche de données de production actuelle.

Le code applicatif doit progressivement éviter les accès directs au fournisseur de données afin de rendre un changement de moteur possible sans réécrire l'interface.

## Cache et files

Redis est la cible pour :

- cache serveur ;
- files de tâches ;
- sessions éphémères ;
- limitation de débit ;
- état temporaire des agents.

Tant qu'une instance Redis ne peut pas être créée automatiquement, les mécanismes existants restent utilisés.

## Python

Python peut être utilisé immédiatement pour les scripts ou workers exécutables dans l'environnement technique existant, à condition qu'aucune installation ou configuration utilisateur ne soit nécessaire. Une fonction TypeScript équivalente reste le fallback lorsque Python n'est pas disponible dans l'environnement de production.

## Rust

Rust est réservé aux outils système ou aux traitements où il apporte un avantage mesurable. Il n'est pas ajouté aux pages web ni aux tâches ordinaires. Sans chaîne de compilation automatique disponible, la fonction reste en TypeScript/Node.

## Zero-touch provisioning

Le ZTP est une cible de déploiement d'une future instance OPENDOOR OS. Son rôle sera de préparer automatiquement une machine Linux, installer les services nécessaires, appliquer les migrations et lancer les contrôles de santé.

Aucune installation ZTP n'est déclarée active tant qu'OPENDOOR OS ne possède pas l'accès à une machine provisionnable sans intervention utilisateur.

## Règle de fallback

Pour chaque capacité optionnelle :

1. détecter si elle est réellement disponible ;
2. l'activer uniquement si aucun secret ou réglage manuel n'est requis ;
3. vérifier son fonctionnement ;
4. en cas d'échec, revenir automatiquement au chemin fonctionnel précédent ;
5. ne jamais afficher une capacité comme connectée si elle ne l'est pas.

Le registre `angel-os/core/capabilities.ts` est la source de vérité technique pour cet état.
