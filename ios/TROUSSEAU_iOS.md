# Trousseau iOS — Password AutoFill

## Configuration actuelle

- `App.entitlements` : `webcredentials:catalog.discado.ch?mode=developer`
- `apple-app-site-association` : Team ID `72525UXDFK`
- `project.pbxproj` : `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` (Debug + Release)

## Avant publication App Store

Enlever `?mode=developer` dans `ios/App/App/App.entitlements` :

```xml
<!-- DEV (actuel) -->
<string>webcredentials:catalog.discado.ch?mode=developer</string>

<!-- PROD (avant App Store) -->
<string>webcredentials:catalog.discado.ch</string>
```

Le mode developer bypass le cache CDN Apple et ne fonctionne que pour les builds Xcode.
En production, iOS utilise le CDN Apple (`app-site-association.cdn-apple.com`) qui met 24-48h à se rafraîchir.

## Fichiers concernés

- `ios/App/App/App.entitlements` — Associated Domains
- `public/.well-known/apple-app-site-association` — fichier AASA servi par le serveur
- `ios/App/App.xcodeproj/project.pbxproj` — référence aux entitlements
- `index.js` (ligne ~341) — route Express qui sert le fichier AASA
