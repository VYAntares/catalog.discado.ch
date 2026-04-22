# Scripts — Utilisation

Documentation rapide des scripts utilitaires dans ce dossier.

---

## `generate-fergy-backup-pdfs.js`

Régénère des PDFs (bon de livraison + facture) pour une ou plusieurs commandes existantes, en utilisant :

- `services/deliveryNoteService.backup.js` — rendu du bon de livraison
- `services/InvoiceService2.js` — rendu de la facture (version v2 avec QR-bill)

Le script détourne le `require.cache` Node pour que `deliveryNoteService.backup.js` utilise **InvoiceService2** à la place de `invoiceService.js`, sans modifier le code des services.

### Commandes

```bash
# Régénérer les 2 commandes Fergy de référence (par défaut)
node scripts/generate-fergy-backup-pdfs.js

# Un order_id précis — n'importe quel client (le user_id est lu depuis la DB)
node scripts/generate-fergy-backup-pdfs.js 260306-0085

# Plusieurs order_ids en une seule exécution
node scripts/generate-fergy-backup-pdfs.js 260306-0085 251227-0530 251010-0123
```

### Sortie

Les PDFs sont écrits dans :

```
public/images/pdf-backup-fergy/<ShopName>_<order_id>_v2.pdf
```

Format du nom : `shopName` du profil client (ou `firstName` / `username` en fallback), sanitizé (caractères non alphanumériques → `_`).

### Téléchargement

Express sert `public/images/` statiquement sur `/images/…`, donc les fichiers sont directement accessibles :

```
https://catalog.discado.ch/images/pdf-backup-fergy/<nom-du-fichier>.pdf
```

En local (VSCode), clic droit sur le fichier dans `public/images/pdf-backup-fergy/` → **Download…**.

### Ce que fait le script

Pour chaque `order_id` :

1. Lit la commande dans `orders` (récupère `user_id`).
2. Lit la facture associée dans `invoices` (pour `invoice_date`).
3. Charge `orderDetails` (articles livrés + restants) via `orderService.getOrderDetails`.
4. Charge le profil client via `userService.getUserProfile`.
5. Génère un PDF combiné : bon de livraison (backup) + facture v2 + numérotation de pages.

### Dépendances

- Base `database/discado.db` accessible (la commande + la facture doivent exister).
- `pdfkit` et `swissqrbill` installés (`package.json` déjà OK).

### Debug

Si un `order_id` n'existe pas, le script échoue avec `Order <id> not found in DB` et sort en code `1` sans générer les suivants. Corrige / retire l'ID fautif puis relance.

---

## `backfill-product-id.js`

(Script existant — voir son en-tête pour les détails.)
