<h1 align="center">Discado Catalog — v1</h1>

<p align="center">
  <b>A B2B wholesale ERP — product catalogue, ordering, stock, delivery notes,<br/>
  Swiss QR invoicing and accounting — built for and run by a real business.</b>
</p>

<p align="center">
  <a href="https://shop.discado.ch"><img src="https://img.shields.io/badge/v2_live-shop.discado.ch-2ea44f?style=for-the-badge" alt="v2 live"/></a>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"/>
  <img src="https://img.shields.io/badge/PWA_+_iOS-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA and iOS"/>
</p>

> [!NOTE]
> **This repository is version 1** — the implementation that went into production and ran
> the business. The platform now lives at **[shop.discado.ch](https://shop.discado.ch)**, a
> full rewrite on a modern frontend stack developed in a private repository; the original
> `catalog.discado.ch` domain redirects there. See [Version 2](#version-2) below.

---

## What this is

Discado is a wholesale business selling promotional products — caps, magnets, goodies and
textiles — to professional resellers. This is the system that runs it.

Clients log in to browse the catalogue, build an order, and track their invoices. Staff log
in to the same application and land in a back office instead: incoming orders, stock,
suppliers, client accounts, accounting, and statistics. One codebase, two entirely
different experiences, separated by a permission system rather than by two deployments.

It is not a demo or a course exercise. It handled real orders, real stock levels, and real
Swiss QR invoices that clients actually paid.

**Scale:** ~100 HTTP routes · 15 backend services · 24 pages · 4 languages · 295 commits.

---

## Features

### Client portal

| Feature | Detail |
|---|---|
| **Product catalogue** | Browsable and searchable, with a separate textile section carrying per-size stock |
| **Cart** | Server-side and persistent — it survives logout and follows the user across devices |
| **Wishlist** | Saved favourites with a live counter |
| **Ordering** | Orders submitted straight into the back office queue |
| **Order history** | Every past order with its delivered and pending lines |
| **Invoices** | Consult, download as PDF, track payments, export the whole year to Excel |
| **Profile** | Self-service details and password management |
| **Four languages** | French, German, Italian and English — the languages Swiss B2B actually needs |

### Admin back office

| Module | Detail |
|---|---|
| **Orders** | Pending and processed queues, line-by-line editing, partial delivery, conversion of pending items into firm orders |
| **Stock** | Per-product and per-size levels, bulk updates, low-stock alerts, out-of-stock view, barcodes, stock valuation |
| **Clients** | Account creation, profile management, full per-client order history |
| **Clients map** | Client accounts plotted geographically |
| **Suppliers** | Supplier records with images and contact details |
| **Accounting** | Expense tracking by category and by month, yearly filtering, monthly and detailed breakdowns |
| **Invoicing** | Generation in CHF and EUR, payment tracking, client-by-client views |
| **Statistics** | Sales and delivery statistics per product and per year |

---

## Swiss invoicing

Invoices are generated as PDFs with **PDFKit** and carry a compliant
[Swiss QR-bill](https://www.six-group.com/en/products-services/banking-services/payment-standardization/standards/qr-bill.html)
payment section, produced with `swissqrbill`. A client scans the code in their banking app
and the payment is pre-filled — no reference numbers typed by hand, no transcription
errors.

Both currencies are supported: **CHF** invoices carry the QR-bill, **EUR** invoices carry
the international bank details instead. Payments are recorded against each invoice, so an
invoice knows what it is still owed.

---

## Security

Handling another business's order book and accounting sets the bar, and the application is
built accordingly.

| Layer | Implementation |
|---|---|
| **Headers** | `helmet` with an explicit Content Security Policy covering scripts, styles, fonts, images and connections |
| **XSS** | Every string in every request body is recursively sanitised with **DOMPurify** before it reaches a handler |
| **Sessions** | Stored server-side in SQLite, not in the cookie — `httpOnly`, `sameSite: strict`, 3-hour lifetime |
| **Brute force** | Login throttled to 5 failed attempts per 15 minutes |
| **Weak passwords** | A password identical to the username locks the account out of everything until it is changed |
| **Authorisation** | Role-based, with granular per-page permissions resolved from the database on each request |
| **Read-only staff** | An `admin_observateur` role that can see the entire back office but has every write method blocked |
| **Uploads** | MIME **and** extension validated, held in memory rather than written to disk, size-capped at 5 MB for images and 10 MB for documents |
| **Image handling** | Every upload is re-encoded through **Sharp** — resized to 800 × 800 and recompressed, so nothing reaches disk in its original form |
| **Auditing** | Structured logging with **Winston** |

The permission model deserves a note. Rather than hardcoding role checks, `requirePermission()`
asks the database what the current user may reach. Denied users are not shown a dead end —
they are redirected to the first page they *are* allowed to open.

---

## Architecture

```
catalog.discado.ch/
├── index.js                  # Express app: middleware chain, ~100 routes
├── services/                 # all business logic, one module per domain
│   ├── db.js                 #   SQLite access layer
│   ├── userService.js        #   accounts and authentication
│   ├── permissionService.js  #   role and per-page permission resolution
│   ├── productService.js     #   catalogue and stock
│   ├── orderService.js       #   order lifecycle
│   ├── deliveryNoteService.js#   delivery notes
│   ├── invoiceService.js     #   invoice generation
│   ├── invoiceManagementService.js
│   ├── statsServices.js      #   sales and delivery statistics
│   ├── emailService.js       #   transactional mail
│   ├── cryptoService.js      #   hashing and tokens
│   └── navigationService.js  #   permission-aware menus
├── public/                   # client-facing PWA
│   ├── pages/                #   catalogue, cart, orders, invoices, profile
│   ├── components/ js/ css/
│   ├── i18n/                 #   fr · de · it · en
│   ├── manifest.json  sw.js  #   installable, offline-capable
│   └── .well-known/          #   Apple App Site Association
├── admin/                    # back office
│   └── pages/                #   orders, stock, clients, compta, stats, suppliers
├── ios/                      # Capacitor native wrapper
└── scripts/                  # maintenance and migration tooling
```

**Request flow**

```
request
   │
   ├─ helmet ─────────────── security headers, CSP
   ├─ body parsers ──────── urlencoded + json
   ├─ DOMPurify ─────────── recursive sanitisation of every string
   ├─ session ───────────── SQLite-backed, secure cookie
   │
   ├─ requireLogin ──────── authenticated?
   ├─ requireSecurePassword  password not equal to username?
   ├─ requireCompleteProfile profile filled in?
   ├─ requireAdmin ──────── staff only
   ├─ requirePermission ─── may this user reach this module?
   └─ blockWritesForObserver read-only roles stop here
   │
   ▼
service layer ──▶ SQLite
```

Business logic lives in `services/`, never in route handlers. Routes validate, authorise,
and delegate — which is why a file with a hundred endpoints stays readable.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Runtime** | Node.js + Express 4 | Small, explicit, no magic |
| **Database** | SQLite via `better-sqlite3` | Synchronous, transactional, zero operational overhead for a single-tenant ERP |
| **Sessions** | `better-sqlite3-session-store` | Sessions live beside the data, and survive restarts |
| **Frontend** | Vanilla JavaScript, no framework | A deliberate choice — see [Version 2](#version-2) |
| **Mobile** | Capacitor 8 (iOS) | One codebase, plus a real native build |
| **Offline** | Service worker + Web App Manifest | Installable, works on a weak connection |
| **PDF** | PDFKit + `swissqrbill` | Compliant Swiss invoices |
| **Spreadsheets** | ExcelJS + `csv-parser` | Exports accountants will actually accept |
| **Images** | Sharp | Optimisation and defensive re-encoding |
| **Mail** | Nodemailer | Password resets and notifications |
| **Validation** | `express-validator` + DOMPurify + `helmet` | Defence in depth |
| **Logging** | Winston | Structured, level-based |

---

## Running it

```bash
git clone https://github.com/VYAntares/catalog.discado.ch.git
cd catalog.discado.ch
npm install
npm start
```

The server listens on `http://localhost:3000`, or on `$PORT` if it is set. Mail and session
configuration is supplied through the environment.

### iOS

```bash
npm run ios:sync     # sync the web build into the native project
npm run ios:open     # open it in Xcode
npm run ios:build    # both at once
```

See `BUILD_IOS.md` for the signing and deployment steps.

---

## Version 2

### → **[shop.discado.ch](https://shop.discado.ch)**

The platform has been rewritten. Version 2 is live, serves the same business, and is
developed in a private repository.

**What changed.** The frontend moved from hand-written vanilla JavaScript to a **React**
application built with **Vite** and styled with **Tailwind CSS**, with **Lucide** icons and
Inter as the typeface. It ships as an installable, standalone **PWA** with maskable icons
and full Open Graph metadata — a catalogue a reseller can pin to their home screen and open
like a native app.

**What did not change.** The domain model. Products, per-size stock, orders, pending
deliveries, delivery notes, invoices, payments, permissions — v1 established all of it
against real business constraints, and v2 builds on that foundation rather than replacing
it.

**Why v1 was written without a framework.** Deliberately. Building the catalogue, the cart,
the permission-aware navigation and the invoice pipeline by hand meant understanding every
part of the system before abstracting any of it away. The rewrite was worth doing precisely
*because* the first version had already answered the hard questions — what the data model
needs to be, which flows the business actually uses, where the edge cases live. Reaching
for React first would have meant guessing at all three.

This repository stays public as the reference implementation, and because a system that
survived contact with real invoices, real stock and real clients says more than one that
never left localhost.

---

## License

ISC.
