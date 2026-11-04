# Sécurité

## Modèle de menace (version 0.2)

| Menace | Situation actuelle |
| --- | --- |
| Lecture des données par un autre site | Impossible : le stockage (OPFS / IndexedDB) est isolé par origine. |
| Autre compte sur le même appareil et le même navigateur | Coffre séparé par compte (`ns`), mais pas chiffré : quelqu'un qui a accès à la session du navigateur peut lire les données. |
| Vol ou accès physique à l'appareil | Non couvert par Ruches (dépend du chiffrement de l'appareil). Chiffrement des alvéoles prévu (ROADMAP, phase 1). |
| Capsule malveillante reçue d'un tiers | Chaque alvéole est vérifiée par son empreinte ; chaque objet est validé (type, nom, dates, empreintes) ; le HTML des documents est nettoyé (aucun script, attribut d'événement ou style ; liens http/https/mailto seulement). |
| Exécution de script via un fichier importé | Les aperçus n'ouvrent jamais de HTML/SVG dans un onglet ; les téléchargements sont forcés en `application/octet-stream`. |
| Perte de données | Corbeille réversible, suppression définitive confirmée, historique des versions, capsule. Les données disparaissent si les données du site sont effacées dans le navigateur : bouton « Protéger mon stockage » (stockage persistant) et capsule recommandés. |
| Fuite réseau | Aucune donnée personnelle n'est envoyée. Ruches Search télécharge des fichiers d'index statiques : le serveur voit les préfixes de termes demandés, jamais la requête complète ni un identifiant. Le relais vers un moteur externe est signalé et désactivable (`config.webSearch = null`). |
| Résultat web piégé | Seules les adresses http(s) sont rendues cliquables (`rel="noopener noreferrer nofollow"`) ; titres et extraits sont affichés comme du texte, jamais comme du HTML. |
| Robot d'indexation | User-Agent identifiable (`RuchesBot`), robots.txt et Crawl-delay respectés, ≥ 1,1 s entre deux requêtes sur un même site, `noindex`/`nofollow` respectés, retrait possible via `search/exclusions.txt`. Les sites qui refusent les robots (403, défi JavaScript) sont exclus. |

Règle : on n'invente aucun algorithme cryptographique ; seules les primitives Web Crypto standard sont utilisées.

## Signaler une faille

Écrire au mainteneur (adresse indiquée sur le profil du dépôt) sans publier les détails avant correction.
