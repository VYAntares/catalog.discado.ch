# Plan de refonte — catalog.discado.ch

> **À l'attention d'une future session Claude (Opus 4.8 ou ultérieur) :**
> Ce document est auto-suffisant. Il décrit l'état du projet et un plan complet et incrémental
> pour le restructurer. Lis-le en entier, puis exécute les phases **dans l'ordre**, en faisant
> **un commit par phase** et en lançant la checklist de tests après chacune.
> Le projet est en production (peu utilisé). **Principe non négociable : on DÉPLACE le code, on ne
> le RÉÉCRIT pas.** On change comment c'est branché, jamais ce que ça fait.
>
> **Comment démarrer cette refonte (pour la future session) :**
> 1. Lire ce fichier en entier.
> 2. Vérifier que l'état actuel correspond toujours à la « Carte du projet » ci-dessous (le code a
>    pu évoluer). Si écart majeur, ré-explorer avant d'agir.
> 3. Exécuter la **Phase 0** (branche + tag + checklist + suppression des doublons), puis enchaîner.
> 4. Après chaque phase : commit + checklist de tests manuels (section « Vérification »).

---

## Contexte (pourquoi cette refonte)

Application Express (Node.js) qui gère un catalogue produits, les commandes clients, les fournisseurs,
la comptabilité/facturation, les statistiques et un espace admin. Elle fonctionne et couvre beaucoup
de fonctionnalités, mais elle est **difficile à naviguer** :

- **`index.js` ≈ 4848 lignes** contient **169 routes** mélangées à de la logique métier (génération
  de PDF, requêtes SQL inline, etc.). C'est le cœur du problème : tout est au même endroit.
- **`services/db.js` ≈ 1281 lignes** : toutes les requêtes de ~20 tables dans un seul fichier.
- Le front (`admin/` et `public/`) est rangé par fonctionnalité, mais il y a de la **duplication**
  entre admin et public (formatter, modal, notification, fileDownload…).
- Pas de **couche de validation** ; gestion d'erreurs **incohérente** (`{success:false}` vs `{error}`) ;
  `winston` installé mais **jamais utilisé** (que des `console.log`).
- Quelques **routes dupliquées** dans `index.js` (la 2e ne s'exécute jamais) → pièges latents.

**Objectif** : découper le monolithe en fichiers clairs, rangés par domaine, **sans changer le
comportement**. On reste sur **Express + better-sqlite3 + JavaScript pur (modules ES6), sans bundler
ni TypeScript**. Périmètre : « refonte moyenne » (découpage + validation + erreurs centralisées +
db.js par entité + mutualisation front).

**Contraintes décidées par le propriétaire :**
- Ampleur : **refonte moyenne**. Pas de build, pas de framework front, pas de TypeScript.
- Production : **en ligne mais peu utilisée** → migration incrémentale, petites interruptions tolérées.
- Code mort (`services/*.backup.js`, `services/InvoiceService2.js`) : **NE PAS Y TOUCHER**.

---

## Carte du projet (état au moment de la rédaction)

```
catalog.discado.ch/
├── index.js                  (~4848 lignes, 169 routes + middleware + logique inline)  ← PROBLÈME PRINCIPAL
├── package.json              (Express 4, better-sqlite3, pdfkit, exceljs, swissqrbill, helmet,
│                              express-validator, multer, sharp, nodemailer, winston, jsdom, dompurify…)
├── config/keys.js            (SECRET_KEY session / clés de chiffrement)
├── services/                 (BONNE couche métier déjà existante — fonctions, pas de classes sauf invoice)
│   ├── db.js                 (~1281 lignes ; exporte UN objet { db, columnExists, transaction,
│   │                          users, profiles, suppliers, orderSupplier, products, orders, ... })  ← À DÉCOUPER
│   ├── orderService.js       (~1089)  invoiceManagementService.js (~726)
│   ├── invoiceService.js     (~469, dessin PDF facture)  statsServices.js (~427)
│   ├── userService.js        (~420)  InvoiceService2.js (~445, MORT)
│   ├── deliveryNoteService.js (~268)  productService.js (~237)  permissionService.js (~139)
│   ├── emailService.js (~118)  navigationService.js (~97)  cryptoService.js (~69)
│   └── invoiceService.backup.js, deliveryNoteService.backup.js   ← MORT, NE PAS TOUCHER
├── database/discado.db       (SQLite, ~3.5 Mo)  +  database/migrations/
├── admin/                    (dashboard admin)
│   ├── pages/ (≈13 HTML)   css/ (≈13k lignes)
│   └── js/ ├── core/ (api.js ≈859, app.js ≈152)
│           ├── utils/ (adminMenu, fileDownload, formatter, modal, notification, tabsPermissions, ui)
│           └── modules/ (clients, compta [comptaMain ≈2508 !], stock [stockManager ≈1494],
│                         suppliers [batchManager ≈1436, orderDetails ≈1023], orders, history, stats, results)
├── public/                   (app client, même organisation : core/, utils/, modules/, components/)
│   ├── pages/ (≈11 HTML)   css/ (≈7.9k lignes)   i18n/ (en, fr, de, it)   images/ (≈1277 fichiers)
│   └── js/ core/ (api.js, app.js, cartApi.js, config.js, i18n.js, storage.js)
│           components/ (DiscadoHeader.js, CartIntegration.js)   utils/ (formatter, modal, notification…)
│           modules/ (catalog, cart, orders, profile, wishlist, ui, myInvoices, sharedInvoices)
└── scripts/                  (scripts ponctuels : backfill, génération PDF/factures, admin, etc.)
```

**Pile technique** : pas de moteur de template (HTML statiques + rendu client via fetch). Auth =
`express-session` + store SQLite, cookie 3h `secure/httpOnly/sameSite=strict`. Rôles : `user`, `admin`,
`admin_observateur` (lecture seule). Permissions granulaires via table `user_permissions`
(stock, compta, orders, clients, order_history, suppliers, stats). Front = modules ES6 natifs,
**aucun build** (`<script type="module">` + `import`/`export`, chemins relatifs).

**Domaines fonctionnels** : auth · produits/stock · panier · wishlist · commandes (client + admin) ·
fournisseurs/achats (gros morceau : batchs, paiements, transport, pièces jointes) ·
factures/comptabilité · dépenses · statistiques · gestion clients (notes, localisations, carte) ·
factures partagées (liens publics à jeton).

**Atouts déjà présents (facilitent le découpage) :**
- Les routes suivent déjà un format propre et composable :
  `app.METHOD(path, requireLogin, requireAdmin, requirePermission(...), handler)`.
- `db.js` exporte déjà un objet **rangé par entité** → le découpage est surtout mécanique.
- Le front est déjà modulaire (ES6), juste dupliqué entre admin et public.

**Repères de lignes dans `index.js`** (peuvent avoir bougé, à reconfirmer avant d'agir) :
middleware inline — `sanitizeMiddleware` ~28, `checkLoginThrottling` ~151, `requireLogin` ~173,
`requireAdmin` ~178, `blockWritesForObserver` ~193, `requirePermission` ~208,
`requireCompleteProfile` ~298, `requireSecurePassword` ~316. Boilerplate PDF inline (`new PDFDocument`)
à ~6 endroits (≈917, 2024, 2185, 2276, 3027, 4826) — mais le **dessin** est déjà délégué aux services.

---

## Arborescence cible

```
catalog.discado.ch/
├── index.js                  # PASSE de ~4848 à ~60 lignes : setup app, montage routeurs, listen
├── src/
│   ├── middleware/
│   │   ├── auth.js           # requireLogin, requireAdmin, requireSecurePassword, requireCompleteProfile
│   │   ├── permissions.js    # requirePermission, blockWritesForObserver
│   │   ├── sanitize.js       # sanitizeMiddleware (DOMPurify/JSDOM)
│   │   ├── throttle.js       # checkLoginThrottling + son état mémoire
│   │   ├── asyncHandler.js   # wrapper qui capture les erreurs async
│   │   └── errorHandler.js   # gestion d'erreurs centralisée + route 404 (notFound)
│   ├── routes/
│   │   ├── index.js          # agrège et monte tous les routeurs de domaine
│   │   ├── auth.routes.js          pages.routes.js        products.routes.js
│   │   ├── cart.routes.js          wishlist.routes.js     orders.routes.js
│   │   ├── adminOrders.routes.js   suppliers.routes.js    invoices.routes.js
│   │   ├── myInvoices.routes.js    sharedInvoices.routes.js
│   │   ├── expenses.routes.js      stats.routes.js        clients.routes.js
│   │   └── profile.routes.js
│   ├── db/
│   │   ├── index.js          # branche tout : connexion + initDatabase + ré-exporte toutes les entités
│   │   ├── connection.js     # SEUL endroit qui ouvre la base (new Database(...))
│   │   ├── schema.js         # tous les CREATE TABLE + migrations (corps de initDatabase) + columnExists
│   │   ├── users.js  profiles.js  suppliers.js  orderSupplier.js
│   │   ├── products.js  orders.js  cart.js  wishlists.js
│   │   └── invoices.js  expenses.js  clientLocations.js  passwordResetTokens.js
│   ├── pdf/
│   │   └── invoicePdf.js     # boilerplate PDF (créer doc, headers, pipe) ; délègue au dessin de invoiceService
│   └── lib/
│       └── logger.js         # instance winston (console + fichier)
├── services/                 # INCHANGÉ. db.js devient une simple redirection (shim) vers src/db
├── admin/  public/           # front (Phase 8)
└── shared-frontend/          # NOUVEAU : utils front partagés, servis sur /shared-js
```

### Décision clé : routes-avec-handler, PAS de couche `controllers`

On garde les handlers **directement dans les fichiers de routes**
(`router.get(path, mw, async (req,res) => {...})`). On n'ajoute **pas** de dossier `controllers/`.

Pourquoi :
- La transformation la plus sûre est `app.get(...)` → `router.get(...)` : corps du handler **identique**,
  un seul mot change. Une couche contrôleurs obligerait à *déplacer* chaque corps → deux fois plus de risques.
- Une vraie couche métier **existe déjà** (`orderService`, `invoiceService`…). C'est *ça* la séparation.
  Des contrôleurs seraient une 3e couche quasi vide.
- Moins de fichiers à ouvrir pour déboguer.

Règle : si un fichier de routes dépasse ~600 lignes (cas des fournisseurs), le scinder
**par sous-domaine** (`suppliers.routes.js` + `orderSuppliers.routes.js`), pas en contrôleurs.

---

## Plan par phases (l'ordre compte — le site marche après chaque phase)

> **Un commit par phase.** Lancer la checklist de tests (section Vérification) avant de pousser.

### Phase 0 — Filet de sécurité (aucun déplacement de code)
1. `git checkout -b refactor/structure` (la branche `main` reste déployable).
2. `git tag pre-refactor` (point de retour).
3. Rédiger / relire la **checklist de tests manuels** (section Vérification). Elle sert de « suite de
   tests » puisqu'il n'y en a pas d'automatisée. À rejouer après chaque phase.
4. **Supprimer les routes dupliquées** dans `index.js` (faible risque, gros gain). Repérées :
   `GET /api/products`, `GET /api/products/stock`, `PUT /api/products/:id`, `GET /admin/stats`,
   enregistrées **deux fois** ; en Express seule la **première** s'exécute. Confirmer que la 2e est
   bien morte, puis supprimer la copie morte. À faire **avant** le découpage pour éviter de monter
   deux handlers en conflit dans des routeurs différents. Commit.

### Phase 1 — asyncHandler + logger winston + gestion d'erreurs centralisée (additif, risque faible)
Donne les outils dont dépendent les phases suivantes, sans changer le comportement.
1. `src/lib/logger.js` : instance winston (transport console + transport fichier). L'exporter.
2. `src/middleware/asyncHandler.js` :
   ```js
   module.exports = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
   ```
3. `src/middleware/errorHandler.js` : exporte `notFound` et `errorHandler(err, req, res, next)`.
   Il logue via winston et renvoie un **format unique**. Standardiser sur **`{ error: message }`**
   (déjà majoritaire ≈208 vs ≈48). **Ne pas** réécrire en masse les `success:false` maintenant : le
   handler central n'attrape que les erreurs *lancées / non gérées*.
4. Dans `index.js`, enregistrer `app.use(notFound)` puis `app.use(errorHandler)` **juste avant
   `app.listen`**. Tant que les routes ne font pas `next(err)`, c'est un simple filet → 100% rétrocompatible.

### Phase 2 — Extraire les middleware vers `src/middleware/` (déplacement mécanique)
1. Créer `auth.js`, `permissions.js`, `sanitize.js`, `throttle.js`. **Copier** chaque fonction telle
   quelle depuis `index.js`. Corriger les chemins de `require` (`./services/...` → `../../services/...`).
   Pour `throttle.js`, déplacer aussi l'**état mémoire** du throttling (la Map/objet utilisée).
2. Dans `index.js`, remplacer les définitions inline par
   `const { requireLogin, requireAdmin, ... } = require('./src/middleware/auth')`. Les usages dans les
   routes restent identiques (mêmes noms).
3. `sanitizeMiddleware` est global et enregistré tôt (~ligne 76), dépend de DOMPurify/JSDOM → déplacer
   ces `require` dans `sanitize.js`. Le **garder enregistré avant les routeurs**.

Tester : throttling login, blocage écriture observateur, gating permissions.

### Phase 3 — Découper `db.js` en `src/db/*` (UNE seule connexion)
Le plus mécanique (db.js est déjà un objet par entité). **Seul vrai risque : la base doit être
ouverte exactement une fois** par better-sqlite3.
1. `src/db/connection.js` : déplacer ici l'ouverture (`new Database(dbPath)` + pragma). **Seul** endroit
   qui ouvre la base. Exporte `db`.
2. `src/db/schema.js` : déplacer `columnExists` + `initDatabase` (gros bloc CREATE TABLE + migrations).
   Importe `db` depuis `connection.js`. Exporte `initDatabase`, `columnExists`.
3. Un fichier par groupe d'entité : importe `db`, exporte son objet de prepared-statements (copié tel
   quel). Regrouper les tables liées : commandes+items+pending → `orders.js` ; tous les `orderSupplier*`
   → `orderSupplier.js` ; produits+stock par taille → `products.js`.
4. `src/db/index.js` : appelle `initDatabase()` **avant** de requérir les fichiers d'entité, puis
   ré-exporte un objet de **forme identique** à l'export actuel de `db.js`
   (`{ db, columnExists, transaction, users, profiles, ... }`).
5. **Étape de compatibilité critique** : transformer l'ancien `services/db.js` en une seule ligne :
   ```js
   module.exports = require('../src/db');
   ```
   Ainsi tous les `require('./services/db')` existants continuent de marcher sans modification.
   C'est ce qui rend le découpage sûr et réversible.

> Ordre de chargement : `initDatabase()` doit s'exécuter **avant** tout `db.prepare(...)` référençant
> une table (comme aujourd'hui au chargement du module). `src/db/index.js` requiert donc `schema` et
> appelle `initDatabase()` d'abord, puis requiert les modules d'entité.

Tester en profondeur (tous les domaines touchent la base).

### Phase 4 — Extraire le boilerplate PDF vers `src/pdf/invoicePdf.js`
Le *dessin* est déjà délégué à `invoiceService`/`deliveryNoteService` ; `index.js` ne fait que le
boilerplate (créer doc, headers, `pipe(res)`), répété à ~6 endroits.
1. `src/pdf/invoicePdf.js` : helper `streamInvoicePdf(res, {...})` qui fait ce boilerplate et appelle
   `invoiceService.generateInvoicePDF(...)`.
2. Remplacer les ~6 copies inline par des appels au helper. **Laisser** la logique de dessin dans les
   services. Le bon de livraison (marge différente) → helper dédié ou paramètre.

Tester tous les PDF : facture client, facture admin CHF, facture admin EUR, facture partagée, bon de livraison.

### Phase 5 — Découper les routes vers `src/routes/*`, UN domaine à la fois
**Ne pas** déplacer les 169 routes d'un coup. Un domaine par commit → régression isolée.

Mécanique par domaine :
- Créer `src/routes/<domaine>.routes.js` : `const router = require('express').Router();`, requérir
  middleware/services nécessaires, coller les blocs `app.METHOD(...)` concernés en changeant
  `app.` → `router.`. **Garder les chemins complets** (`/api/...`) et monter le routeur sur `/`
  → évite les erreurs de réécriture de chemin (plus sûr).
- Envelopper chaque handler async d'`asyncHandler(...)` au passage (permet de retirer les try/catch
  internes plus tard).
- Dans `index.js`, remplacer les blocs déplacés par `app.use(require('./src/routes/<domaine>.routes'))`.

**Ordre conseillé** (du moins couplé au plus risqué ; auth en dernier) :
1. expenses → 2. stats → 3. wishlist → 4. cart → 5. products → 6. clients → 7. profile →
8. myInvoices → 9. sharedInvoices (public — tester **sans** être connecté) → 10. invoices (compta admin) →
11. orders (client) + adminOrders → 12. suppliers (le plus gros — scinder si >600 lignes) →
13. pages (HTML + redirections) → 14. **auth** (login/logout/reset — tester login + throttling + reset).

> **Piège d'ordre de routes** : Express teste dans l'ordre d'enregistrement. Une route `:param`
> (`/api/products/:id`) peut masquer une route littérale (`/api/products/stock`). **Ne pas réordonner
> les routes à l'intérieur d'un domaine** et monter les routeurs dans un ordre sain. Les doublons
> ayant été retirés en Phase 0, c'est bien plus sûr.

Quand quelques routeurs existent, créer `src/routes/index.js` qui les agrège → `index.js` a **une**
ligne `app.use(routes)` au lieu de 15.

Commit + test **après chaque domaine**.

### Phase 6 — Standardiser la gestion d'erreurs progressivement (au fil de l'eau)
Maintenant que les handlers sont dans des routeurs et enveloppés d'`asyncHandler` :
- Remplacer les `try/catch ... console.error` ad hoc par `throw`/`next(err)` → le handler central
  logue (winston) et renvoie le format standard.
- Remplacer `console.*` → `logger.*` fichier par fichier, quand on y touche déjà.
Faire ça **par domaine** quand on le revisite, pas en un grand coup risqué.

### Phase 7 — Alléger `index.js` (optionnel : `src/app.js`)
Une fois routes/middleware/db/pdf extraits, `index.js` ≈ 60 lignes : requires, création `app`,
middleware globaux (`express.json`, helmet, session, sanitize, static), `app.use(routes)`,
errorHandler, `app.listen`. Option : tout sauf `app.listen` dans `src/app.js` faisant
`module.exports = app` (utile pour des tests automatisés futurs ; `index.js` requiert `src/app` et listen).

### Phase 8 — Mutualiser le front SANS build
Les copies admin/public de `formatter.js`, `modal.js`, `notification.js`, `fileDownload.js` sont
actuellement **différentes** → pas de fusion aveugle.
1. Créer `shared-frontend/utils/` + montage statique :
   `app.use('/shared-js', express.static(path.join(__dirname, 'shared-frontend')))`
   (avec le même réglage `Content-Type` que le montage JS admin existant).
2. Pour chaque util dupliqué : **comparer (diff)** les deux versions, réconcilier en UNE version
   « superset » dans `shared-frontend/utils/<nom>.js` (module ES `export`).
3. Migrer les imports progressivement vers `import { formatDate } from '/shared-js/utils/formatter.js'`
   (chemin absolu → marche avec les modules ES natifs, **sans bundler**). Vérifier, continuer. Garder
   les anciens fichiers par côté jusqu'à migration complète, puis supprimer.
4. Commencer par l'util le plus proche entre les deux côtés (probablement `formatter.js`). Laisser
   dupliqués ceux qui divergent vraiment (forcer la fusion = risque sans gain).

> Note bonus (hors périmètre strict, à ne faire que si demandé) : les très gros modules front
> (`comptaMain.js` ≈2508, `stockManager.js` ≈1494, `batchManager.js` ≈1436) gagneraient à être
> scindés par sous-fonctionnalité, selon la même logique « déplacer, pas réécrire ».

---

## Fichiers critiques

- `index.js` — source de tout le découpage (routes, middleware, boilerplate PDF inline)
- `services/db.js` — à découper puis transformer en shim vers `src/db`
- `services/invoiceService.js` — dessin PDF (reste en place)
- `admin/js/utils/formatter.js` + `public/js/utils/formatter.js` — premiers candidats à la mutualisation

---

## Sécurité & réversibilité (résumé)

- Une phase = un commit sur `refactor/structure` → `git revert <sha>` annule une phase proprement.
- Phases 1–4 : additives ou pur déplacement avec **shim** (`services/db.js`) → les `require` existants
  ne cassent jamais.
- Phase 5 : un domaine par commit → régression isolée à un domaine, un seul revert.
- La base est ouverte dans **un seul** fichier neuf ; le shim garantit aucune double ouverture ni
  churn d'appelants.
- Comportement préservé en copiant les handlers **tels quels** et en conservant l'ordre des routes par domaine.

### Points de vigilance
- **Connexion unique** : seul `src/db/connection.js` fait `new Database(...)`. Les scripts ponctuels
  (`fixInvoices.js`, `migrate-*.js`, `generate-catalog.js`, dossier `scripts/`) peuvent ouvrir la leur
  — OK pour du one-shot, mais **le serveur** ne doit en avoir qu'une.
- **Masquage par routes `:param`** : préserver l'ordre (doublons retirés en Phase 0).
- **`sanitizeMiddleware` global et tôt** : le garder enregistré avant les routeurs dans `index.js`.
- **État session/throttle en mémoire** : déplacer `checkLoginThrottling` dans un module garde la Map
  au scope module = même sémantique qu'aujourd'hui (reset au redémarrage).
- **CSP / helmet** : la config Content-Security-Policy d'`index.js` (sources autorisées : cdnjs,
  fonts.googleapis, tuiles OpenStreetMap/Google, nominatim, blob pour PDF iOS) doit rester identique.

---

## Vérification (comment tester de bout en bout)

Pas de tests automatisés → **checklist manuelle** à rejouer après **chaque** commit, avant de pousser :

1. **Démarrage** : `npm start` démarre sans erreur ; logs winston visibles (après Phase 1).
2. **Auth** : login OK ; mauvais mot de passe rejeté ; throttling après 5 essais ; logout ;
   reset password (email → lien → nouveau mdp).
3. **Client** : voir le catalogue ; ajouter au panier ; passer une commande ; voir ses commandes ;
   télécharger une facture (PDF) ; wishlist.
4. **Admin** : commandes en attente ; traiter une commande ; voir clients ; voir fournisseurs +
   une commande fournisseur ; voir stats ; voir comptabilité.
5. **PDF** : facture client, facture admin CHF, facture admin EUR, facture partagée (lien public
   **sans** login), bon de livraison.
6. **Permissions** : un compte `admin_observateur` ne peut pas écrire (POST/PUT/DELETE bloqués) ;
   un compte sans permission « stock » ne voit pas l'onglet stock.

Vérifs supplémentaires selon la phase : `require('./services/db')` marche toujours (Phase 3) ;
tous les PDF marchent (Phase 4) ; chaque domaine de routes répond comme avant (Phase 5).

---

## « Terminé » ressemble à quoi (critères de fin)

- `index.js` ≈ 60 lignes (setup + montage routeurs + listen), plus aucune route ni logique métier dedans.
- Tous les domaines de routes vivent dans `src/routes/*.routes.js`.
- Tout le middleware custom vit dans `src/middleware/*`.
- `db.js` est un shim d'une ligne ; les requêtes sont réparties dans `src/db/*` ; une seule connexion.
- Le boilerplate PDF est centralisé dans `src/pdf/`.
- Les erreurs non gérées passent par le handler central (winston + format `{ error }`).
- Au moins le premier util front (`formatter.js`) est mutualisé via `/shared-js` (le reste peut suivre).
- La checklist de Vérification passe à 100% sur la branche `refactor/structure`.

---

## Ce qui n'est PAS dans ce plan (volontairement)

- Pas de bundler / minification / TypeScript / framework front (hors périmètre « refonte moyenne »).
- Pas de suppression du code mort (`services/*.backup.js`, `services/InvoiceService2.js`) — demandé de
  ne pas y toucher.
- Pas de réécriture de la logique métier des services (on déplace, on ne réécrit pas).
- Pas de refonte du schéma de base de données (inchangé).
```