# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the server
npm start          # runs: node index.js

# No test suite is configured
```

The app is a Node.js/Express server — there is no build step. Changes to backend files take effect on server restart; frontend files (HTML/CSS/JS) are served statically and take effect immediately.

## Architecture Overview

This is a **B2B catalog and order management system** (Discado) built as a monolith:

- **Backend:** Single `index.js` (3000+ lines) containing all Express routes, middleware, and business logic. No separate router files — all routes are defined inline.
- **Services:** `services/` contains the data layer. `db.js` initializes the SQLite schema. Other services (productService, orderService, invoiceService, statsServices, etc.) contain business logic called from `index.js`.
- **Database:** SQLite via `better-sqlite3` (synchronous API). DB file is at `database/discado.db` (gitignored). Foreign keys are enabled.
- **Frontend:** Vanilla JS with ES6 modules. No bundler or framework. Pages in `public/pages/` and `admin/pages/` load scripts directly. `public/js/core/api.js` is the shared API client.
- **Admin vs Public:** Two separate UI trees — `public/` (client-facing: catalog, cart, orders, profile) and `admin/` (internal: clients, stock, suppliers, compta/accounting, stats).

## Key Architectural Patterns

**Authentication & Authorization:**
- Session-based auth (`express-session`). All protected routes check `req.session.userId`.
- Role-based: `user` vs `admin`, plus granular permissions stored in `user_permissions` table (orders, clients, compta, stock, suppliers, stats).
- Profile completion is required before catalog access — checked in the `/pages/catalog.html` route.
- Login is throttled (15-minute lockout window tracked in memory).

**Security Middleware (applied globally):**
- `sanitizeMiddleware` runs on every request to strip XSS from all body/query/param inputs using DOMPurify + jsdom.
- CSRF protection via `csurf` — token must be sent as `_csrf` in forms/POST requests.
- Helmet for HTTP headers, CSP configured inline.

**Data Flow:**
- Routes in `index.js` call service functions → services use `better-sqlite3` prepared statements → return data directly (synchronous).
- File uploads: multer with memory storage (no temp files). Images processed with Sharp before use.
- PDF generation: PDFKit + swissqrbill for invoices with Swiss QR bill support.

**Frontend Module Pattern:**
- Each page imports from `public/js/core/` (api.js, app.js, config.js) and `public/js/modules/` (feature modules).
- No global state management — LocalStorage used for cart and user settings via `public/js/core/storage.js`.
- Notifications via `public/js/utils/notification.js`, modals via `public/js/utils/modal.js`.

## Database Schema (Key Tables)

- `users` + `user_profiles` + `user_permissions` — auth and access control
- `products` — catalog items (name, price, category, stock, image_url, barcode, origin_price)
- `orders` + `order_items` — client orders
- `suppliers` + `order_supplier` + `order_supplier_items` — supplier order management with batch tracking
- `invoices` — invoice records with commission and payment status tracking
- `pending_deliveries` — delivery tracking

## Important Notes

- **Language:** UI and comments are in French throughout.
- **Config is gitignored:** `config/`, `database/`, `.env`, `.htaccess` are all excluded from git. The `config/keys.js` generates encryption keys from env vars or auto-generates them.
- **Helper scripts** at the root (`fixInvoices.js`, `set-permissions.js`, `activate-suppliers-permission.js`) are one-off migration/admin tools, not part of the application flow.
- **No tests** are configured. The test script in package.json is a placeholder.
- The `.htaccess` blocks direct HTTP access to `index.js`, `config/*.js`, and `services/*.js` — these are server-side only files.
