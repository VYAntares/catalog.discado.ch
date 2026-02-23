# Guide — Compiler l'app iOS Discado sur Mac

## Prérequis (une seule fois)

- [ ] Mac avec **macOS 13+**
- [ ] **Xcode 15+** (gratuit sur le Mac App Store)
- [ ] **Node.js 18+** (https://nodejs.org)
- [ ] Un **compte Apple gratuit** (login dans Xcode suffit pour AltStore — pas besoin de payer)

---

## Étape 1 — Copier le projet iOS sur le Mac

Récupère le dossier `ios/` depuis le serveur (via FTP/SFTP ou GitHub) et place le
dossier entier du projet sur le Mac :

```
catalog.discado.ch/
  ios/
    App/
      App.xcodeproj   ← c'est ce fichier qu'on ouvre dans Xcode
      App/
      CapApp-SPM/
  node_modules/
  ...
```

> **Alternative** : cloner/synchroniser tout le projet et lancer `npm install` puis
> `npm run ios:sync` pour regénérer les fichiers à jour.

---

## Étape 2 — Ouvrir dans Xcode

```bash
# Depuis le dossier du projet sur le Mac :
npm run ios:build
# Cela lance : npx cap sync ios + npx cap open ios
```

Ou manuellement : ouvrir **`ios/App/App.xcodeproj`** dans Xcode.

---

## Étape 3 — Configurer la signature dans Xcode

1. Sélectionner le projet **App** dans le panneau de gauche
2. Onglet **Signing & Capabilities**
3. **Team** → Ajouter ton compte Apple (gratuit suffit)
4. **Bundle Identifier** : `ch.discado.catalog` (déjà configuré)
5. Laisser Xcode gérer automatiquement la signature

---

## Étape 4 — Connecter l'iPhone et installer

1. Connecter l'iPhone avec le câble USB
2. **Faire confiance** à cet ordinateur sur l'iPhone si demandé
3. Sélectionner l'iPhone dans la barre de sélection en haut de Xcode (à côté du ▶)
4. Cliquer sur **▶ (Run)** — Xcode compile et installe l'app directement

✅ L'app **Discado** apparaît sur l'écran d'accueil de l'iPhone.

---

## Option AltStore (re-signer sans branchement toutes les 7 jours)

Si tu veux éviter de rebrancher tous les 7 jours :

1. Installer **AltServer** sur le Mac : https://altstore.io
2. Laisser AltServer tourner en arrière-plan sur le Mac
3. L'iPhone et le Mac doivent être sur le **même Wi-Fi**
4. AltStore re-signe automatiquement l'app quand elle est sur le point d'expirer

---

## Mettre à jour l'app

Quand tu fais des modifs sur le site, **pas besoin de recompiler** — l'app charge
directement depuis `https://catalog.discado.ch` (config `server.url`).

Si tu modifies la config Capacitor ou ajoutes des plugins natifs, alors :
```bash
# Sur le serveur Linux :
npm run ios:sync

# Puis sur le Mac : rouvrir Xcode et relancer ▶
```

---

## Structure des fichiers générés

```
ios/App/
  App.xcodeproj     → Projet Xcode (ouvrir ça)
  App/
    AppDelegate.swift
    capacitor.config.json
    Assets.xcassets/  → Icônes et splash screen
    public/           → Copie du frontend (non utilisée car server.url défini)
  CapApp-SPM/         → Dépendances Capacitor (Swift Package Manager)
```
