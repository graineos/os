# Laboratoire — expérimentations et mesures

Chaque expérimentation : hypothèse, mécanisme, mesure, limites, décision. Aucune comparaison avec un autre produit sans protocole reproductible.

## 1. Découpage par le contenu (FastCDC simplifié)

- **Hypothèse** : couper selon les octets (table « gear » à graine fixe, masques normalisés) rend les versions et doublons presque gratuits.
- **Paramètres** : petits fichiers min 1 Kio / moy. 4 Kio / max 16 Kio ; à partir de 4 Mio : 64 / 256 / 1024 Kio.
- **Mesure** (`tests/core.test.ts`) : fichier aléatoire de 3 Mo, 50 octets insérés à la position 1000 → 638 alvéoles sur 639 réutilisées. Moyenne observée ≈ 4,7 Kio (petits) et ≈ 290 Kio (grands).
- **Limites** : les formats qui se réécrivent entièrement à chaque modification (archives compressées, certaines vidéos) dédupliquent peu.
- **Décision** : conservé.

## 2. Compression sélective

- **Mécanisme** : deflate natif (CompressionStream) par alvéole, gardé seulement si le gain dépasse 5 % ; jamais tenté sur les formats déjà compressés (JPEG, PNG, vidéo, ZIP, PDF…).
- **Mesure** : deux fichiers texte identiques de 9,4 Kio (texte répétitif) → 285 octets réellement écrits. Sur du contenu aléatoire, gain nul et aucune alvéole compressée.
- **Limites** : le gain dépend entièrement du contenu ; l'interface affiche toujours séparément « réellement stocké » et « sans Ruches ».
- **Décision** : conservé.

## 3. Capsule

- **Mesure** : coffre contenant un fichier de 6 Mio → capsule de 1,05 Mo (contenu périodique), réimport identique à l'octet près ; capsule tronquée refusée sans alvéole orpheline.
- **Décision** : conservé ; base de la future synchronisation (même logique « alvéoles manquantes »).

## 4. Écritures entre onglets

- **Mesure** : deux onglets créent chacun 10 documents simultanément → 20 documents conservés (Web Locks + relecture du manifeste).
- **Limite** : chaque écriture relit le manifeste entier ; coût linéaire avec le nombre d'objets. Remplacé à terme par le journal d'opérations.

## 5. Flow déterministe

- **Hypothèse** : des règles simples suffisent pour les actions courantes (dates, montants, listes) sans IA.
- **Couverture testée** : « 12 mars à 14h30 », « 1er novembre 2026 », « 15/10 », « demain 9h », « lundi prochain » ; rejet de « 3.5 », « 1-2 », « 31 avril ».
- **Limites** : pas de plages (« du 3 au 5 »), pas de durées, français uniquement.
- **Décision** : conservé ; étendre avant d'envisager un modèle de langue local.

## 6. Ruches Search : index statique et classement dans le navigateur

- **Hypothèse** : pour un corpus de quelques milliers de pages, un index inversé publié en fichiers statiques suffit, sans aucun serveur de recherche ; le navigateur ne télécharge que les morceaux utiles et calcule le classement BM25 lui-même.
- **Collecte du 13 octobre 2026** : 2771 pages, 85 772 termes, 1 040 morceaux, 9,9 Mo sur disque (le plus gros morceau : 256 Ko, 117 Ko compressé). Robots.txt respectés, ≥ 1,1 s entre deux requêtes sur un même site, ≈ 15 minutes au total.
- **Sites** : Wikipédia (520), Service Public (380), franceinfo (200), CNIL (160), Futura (160), Insee (120), impots.gouv.fr (120), Radio France (120), Ministère de la Culture (110), France Travail (110), Santé publique France (110), CNRS (100), Inria (90), BnF (80), Sénat (80), Conseil constitutionnel (80), CAF (60), IGN (60), Musée du Louvre (50), INRAE (28), Angel Leclerc (17), Le Monde (14), Ministère du Travail (1), CEA (1).
- **Exclus volontairement** (refus des robots : 403 ou défi JavaScript) : elysee.fr, info.gouv.fr, education.gouv.fr, vie-publique.fr, economie.gouv.fr, legifrance.gouv.fr, ameli.fr, interieur.gouv.fr, ouest-france.fr. 20minutes.fr, travail-emploi.gouv.fr, cea.fr, inrae.fr et lemonde.fr n'ont livré que peu ou pas de pages (blocage ou pages hors critères) : à revoir.
- **Évaluation** (20 requêtes, critères écrits avant de voir les résultats, `search/eval.ts`) :

| Requête | Pages trouvées | Rang du 1er bon | Précision@5 | 1er résultat |
| --- | --- | --- | --- | --- |
| passeport | 36 | 1 | 40 % | Passeport \| Service Public (service-public.gouv.fr) |
| renouveler carte d'identité | 5 | — | 0 % | Pass Recherche \| BnF - Site institutionnel (bnf.fr) |
| déclaration de revenus | 118 | 1 | 60 % | Dois-je reporter mon résultat (bénéfice ou déficit) sur ma d (impots.gouv.fr) |
| révolution française | 140 | 1 | 20 % | Révolution française — Wikipédia (fr.wikipedia.org) |
| intelligence artificielle | 119 | 1 | 80 % | Intelligence artificielle — Wikipédia (fr.wikipedia.org) |
| données personnelles RGPD | 77 | 1 | 100 % | Comment intégrer le RGPD à votre startup ? \| CNIL (cnil.fr) |
| taux de chômage | 71 | 1 | 20 % | Taux de chômage — Wikipédia (fr.wikipedia.org) |
| allocations familiales | 69 | 1 | 100 % | Allocations familiales (famille de 2 enfants ou plus) \| Serv (service-public.gouv.fr) |
| musée du Louvre | 48 | 1 | 100 % | Offres d'emploi - Bienvenue sur l'espace de recrutement de l (louvre.fr) |
| réchauffement climatique | 95 | 1 | 40 % | Réchauffement climatique \| Planète (futura-sciences.com) |
| inflation prix | 34 | 1 | 60 % | Convertisseur franc-euro : pouvoir d'achat de l'euro et du f (insee.fr) |
| question prioritaire de constitutionnalité | 22 | 1 | 100 % | Numéro 3 - octobre 2019 \| Conseil constitutionnel (conseil-constitutionnel.fr) |
| vaccination grippe | 6 | 1 | 40 % | Prévention - Vaccinations \| Service Public (service-public.gouv.fr) |
| Paris | 734 | 2 | 60 % | Attaque devant Notre-Dame de Paris - Actualité, infos et vid (franceinfo.fr) |
| cuisine française | 35 | 1 | 40 % | Cuisine française — Wikipédia (fr.wikipedia.org) |
| recherche scientifique CNRS | 81 | 1 | 100 % | Expertise scientifique collective \| CNRS (cnrs.fr) |
| carte topographique randonnée | 11 | 2 | 60 % | Topographie — Wikipédia (fr.wikipedia.org) |
| impôt sur le revenu | 149 | 1 | 100 % | Impôt sur le revenu - Comment indiquer son changement d'adre (service-public.gouv.fr) |
| Angel Leclerc communication | 17 | 1 | 100 % | Angel Leclerc Communication — Conseil & Rédaction (angel-leclerc.fr) |
| inscription demandeur d'emploi | 25 | 1 | 60 % | Chômage : inscription à France Travail (anciennement Pôle em (service-public.gouv.fr) |

Réussite@3 : 19/20 (95 %) · Précision@5 moyenne : 64 % · MRR : 0.90 · temps médian : 3 ms (lecture disque, première requête incluse)

- **Lecture** : 19 requêtes sur 20 trouvent une bonne page dans les 3 premiers résultats. L'échec (« renouveler carte d'identité ») vient de la couverture : la fiche correspondante n'a pas été collectée. La précision@5 (64 %) est limitée par la petite taille du corpus : quand peu de pages traitent d'un sujet, le reste du top 5 est hors sujet.
- **Temps de réponse** : 1 à 10 ms de calcul dans le navigateur, une fois les morceaux téléchargés (un morceau par terme de la requête, souvent en cache).
- **Limites** : pas de correction orthographique ni de synonymes, pas d'index de position (les expressions exactes ne sont qu'un bonus sur le titre et l'extrait), fraîcheur = une collecte par semaine au mieux. Aucune comparaison avec un moteur commercial : le corpus n'est pas comparable.
- **Décision** : conservé. Prochaine étape mesurée : 20 000 pages (morceaux découpés plus finement), puis signal de liens entre pages.
