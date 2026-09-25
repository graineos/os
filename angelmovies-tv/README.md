# Angel Movies TV

Appli Android d'Angel Movies (Films & Séries d'angel-beta.fr) pour Google TV, Chromecast avec Google TV, Android TV, Fire TV, tablettes et téléphones Android.

L'appli ouvre `https://angel-beta.fr/films-series` en plein écran. La navigation se fait à la télécommande (flèches, OK, Retour).

### Pointeur (lecteur intégré)
Le lecteur de Movix vient d'un autre site : on ne peut pas y naviguer avec les flèches. Dès que le lecteur est à l'écran, l'appli affiche donc un **pointeur** :
- **Flèches** : déplacer le pointeur (plus vite si on reste appuyé). Au bord haut ou bas de l'écran, la page défile.
- **OK** : cliquer.
- **Appui long sur OK** : couper le pointeur.
- **Menu / Info / Guide** : activer ou couper le pointeur n'importe où.
- **Retour** : fermer le lecteur, puis la fiche.

Aucune page de pub ne s'affiche. Quand un lecteur exige « Ouvrir la pub », l'appli lui fournit une fenêtre invisible qui ne charge rien (comme un bloqueur de pub), puis simule le retour sur le film : la vidéo se débloque sans pub. Si un lecteur résiste quand même, choisir une autre source (lien du lecteur, ou menu ⋯ → Changer de source). La vidéo passe en plein écran et la session reste connectée.

- Téléchargement direct : **https://angel-beta.fr/apk**. Ce lien redirige vers l'APK de la release `angel-movies-tv`.
- Guide d'installation selon l'appareil : **https://angel-beta.fr/films-tv**.

## Construire

```sh
cd angelmovies-tv
gradle assembleRelease        # Android SDK requis (ANDROID_HOME ou local.properties)
```

La CI (`.github/workflows/angel-movies-tv.yml`) construit l'APK à chaque modification de ce dossier sur `main`. Elle le publie ensuite sous le nom `AngelMovies-TV.apk` dans la release fixe `angel-movies-tv`. Le numéro de version suit le numéro d'exécution de la CI.

## Signature

`signing/angelmovies-tv.jks` signe toutes les versions avec la même clé : les mises à jour s'installent donc par-dessus l'ancienne version. La clé est versionnée pour que la CI fonctionne sans secret. C'est un compromis acceptable pour une appli installée à la main, hors Play Store. Pour aller plus loin, on peut placer la clé dans un secret GitHub et définir `ANGEL_TV_STORE_PASSWORD` et `ANGEL_TV_KEY_PASSWORD`.
