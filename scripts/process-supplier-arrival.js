// scripts/process-supplier-arrival.js
// Traite l'arrivage d'une commande FOURNISSEUR : "sort" du backlog pending_deliveries
// de chaque client les articles présents dans la commande fournisseur, et les
// convertit en commande client (status 'pending').
//
// Matching : par product_id (les product_id de la commande fournisseur).
// Règle :    si le client a déjà une commande 'pending' -> on y ajoute (merge),
//            sinon -> on crée une nouvelle commande 'pending'.
//
// Utilisation :
//   node scripts/process-supplier-arrival.js --order=5 --batch=1            # DRY-RUN
//   node scripts/process-supplier-arrival.js --order=5 --batch=1 --commit   # applique
//
// --order : order_supplier.id (5 = Sunmay 25SM532, 8 = Gerada1)
// --batch : batch_number à traiter. Omis => tous les batchs de la commande.

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const fs = require('fs');
const dbModule = require('../services/db');

// ─── Configuration ───────────────────────────────────────────────────────────
const argOf = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const rawOrder = argOf('order');
const rawBatch = argOf('batch');

if (rawOrder === null) {
  console.error('❌ --order=<order_supplier_id> est obligatoire.');
  console.error('   ex: node scripts/process-supplier-arrival.js --order=5 --batch=1');
  process.exit(1);
}

const ORDER_SUPPLIER_ID = Number(rawOrder);
if (!Number.isInteger(ORDER_SUPPLIER_ID)) {
  console.error(`❌ --order invalide : "${rawOrder}"`);
  process.exit(1);
}

const BATCH_NUMBER = rawBatch === null ? null : Number(rawBatch);
if (BATCH_NUMBER !== null && !Number.isInteger(BATCH_NUMBER)) {
  console.error(`❌ --batch invalide : "${rawBatch}"`);
  process.exit(1);
}

const COMMIT = process.argv.includes('--commit');

// ─── Compteur de commandes (copié de orderService / process-keyring-batch) ───
class OrderCounter {
  constructor() {
    this.counterFilePath = path.join(__dirname, '../data/orderCounter.json');
  }
  loadCounter() {
    try {
      if (fs.existsSync(this.counterFilePath)) {
        return JSON.parse(fs.readFileSync(this.counterFilePath, 'utf8')).counter || 1;
      }
    } catch (_) {}
    return 1;
  }
  saveCounter(counter) {
    const dir = path.dirname(this.counterFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.counterFilePath, JSON.stringify({ counter }, null, 2), 'utf8');
  }
  generateOrderId(date = new Date()) {
    let counter = this.loadCounter();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const id = `${y}${m}${d}-${counter.toString().padStart(4, '0')}`;
    counter++;
    if (counter > 9999) counter = 1;
    this.saveCounter(counter);
    return id;
  }
}
const orderCounter = new OrderCounter();

// ─── Statements ──────────────────────────────────────────────────────────────
const db = dbModule.db;

const getSupplierProductIds = db.prepare(
  `SELECT DISTINCT product_id FROM order_supplier_items
   WHERE order_supplier_id = ? AND product_id IS NOT NULL
     AND (? IS NULL OR batch_number = ?)`
);

const getUserPendingOrder = db.prepare(
  `SELECT * FROM orders WHERE user_id = ? AND status = 'pending' ORDER BY date DESC LIMIT 1`
);
const getOrderItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
const insertOrder = db.prepare(
  `INSERT INTO orders (order_id, user_id, status, date, reference) VALUES (?, ?, ?, ?, ?)`
);
const insertItem = db.prepare(
  `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, category, status, size)
   VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
);
const updateItemQty = db.prepare(`UPDATE order_items SET quantity = ? WHERE id = ?`);
const updateOrderDate = db.prepare(`UPDATE orders SET date = ? WHERE order_id = ?`);
const deletePending = db.prepare(`DELETE FROM pending_deliveries WHERE id = ?`);
const validateUser = db.prepare(`SELECT username FROM users WHERE username = ?`);

// ─── Préparation ─────────────────────────────────────────────────────────────
const productIds = getSupplierProductIds
  .all(ORDER_SUPPLIER_ID, BATCH_NUMBER, BATCH_NUMBER)
  .map((r) => r.product_id);
if (productIds.length === 0) {
  console.error(
    `❌ Aucun product_id trouvé pour order_supplier_id=${ORDER_SUPPLIER_ID}` +
      (BATCH_NUMBER !== null ? ` batch_number=${BATCH_NUMBER}` : '')
  );
  process.exit(1);
}
const placeholders = productIds.map(() => '?').join(',');

const getClients = db.prepare(
  `SELECT DISTINCT user_id FROM pending_deliveries WHERE product_id IN (${placeholders})`
);
const getClientItems = db.prepare(
  `SELECT id AS pending_id, product_id, product_name, product_price, quantity, category, size
   FROM pending_deliveries WHERE user_id = ? AND product_id IN (${placeholders})
   ORDER BY category, product_name`
);

const clients = getClients.all(...productIds).map((r) => r.user_id);

const orderInfo = db
  .prepare(
    `SELECT os.invoice_number, s.name AS supplier FROM order_supplier os
     LEFT JOIN suppliers s ON s.id = os.supplier_id WHERE os.id = ?`
  )
  .get(ORDER_SUPPLIER_ID);

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  📦 ARRIVAGE FOURNISSEUR — order_supplier_id=${ORDER_SUPPLIER_ID}`);
console.log(
  `  ${orderInfo ? `${orderInfo.supplier} / ${orderInfo.invoice_number}` : '⚠️ commande introuvable'}` +
    `  —  batch ${BATCH_NUMBER !== null ? BATCH_NUMBER : 'TOUS'}`
);
console.log(`  Mode: ${COMMIT ? '🔴 COMMIT (écriture réelle)' : '🟢 DRY-RUN (aucune écriture)'}`);
console.log('═══════════════════════════════════════════════════════════');
console.log(`Produits fournisseur (product_id) : ${productIds.length}`);
console.log(`Clients concernés                 : ${clients.length}\n`);

// ─── Construction du plan (lecture seule) ────────────────────────────────────
const plan = [];
let totalLines = 0;
let totalQty = 0;
let nbCreate = 0;
let nbAppend = 0;
const previewCounter = orderCounter.loadCounter(); // pour afficher les futurs id en dry-run
let previewIdx = previewCounter;

for (const userId of clients) {
  const exists = validateUser.get(userId);
  const items = getClientItems.all(userId, ...productIds);
  if (items.length === 0) continue;

  const pendingOrder = getUserPendingOrder.get(userId);
  const action = pendingOrder ? 'append' : 'create';
  if (action === 'append') nbAppend++;
  else nbCreate++;

  const qty = items.reduce((s, it) => s + it.quantity, 0);
  totalLines += items.length;
  totalQty += qty;

  let label;
  if (action === 'append') {
    label = `→ ${pendingOrder.order_id} (existante)`;
  } else {
    const today = new Date();
    const y = today.getFullYear().toString().slice(-2);
    const m = (today.getMonth() + 1).toString().padStart(2, '0');
    const d = today.getDate().toString().padStart(2, '0');
    label = `→ ${y}${m}${d}-${previewIdx.toString().padStart(4, '0')} (nouvelle)`;
    previewIdx++;
  }

  plan.push({ userId, exists: !!exists, action, pendingOrder, items, qty });
  console.log(
    `${exists ? '  ' : '⚠️'} ${userId.padEnd(28)} ${label.padEnd(26)} ` +
      `${items.length} lignes / ${qty} u.${exists ? '' : '  [USER INTROUVABLE]'}`
  );
}

console.log('\n───────────────────────────────────────────────────────────');
console.log(`Commandes à CRÉER   : ${nbCreate}`);
console.log(`Commandes à COMPLÉTER (append) : ${nbAppend}`);
console.log(`Lignes pending à sortir : ${totalLines}`);
console.log(`Quantité totale         : ${totalQty}`);
console.log('───────────────────────────────────────────────────────────\n');

const unknownUsers = plan.filter((p) => !p.exists);
if (unknownUsers.length > 0) {
  console.log(`⚠️  ${unknownUsers.length} user(s) introuvable(s) dans 'users' — ignorés au commit.\n`);
}

// ─── DRY-RUN : on s'arrête ici ───────────────────────────────────────────────
if (!COMMIT) {
  const args =
    `--order=${ORDER_SUPPLIER_ID}` + (BATCH_NUMBER !== null ? ` --batch=${BATCH_NUMBER}` : '');
  console.log('🟢 DRY-RUN terminé. Aucune donnée modifiée.');
  console.log(`   Pour appliquer : node scripts/process-supplier-arrival.js ${args} --commit\n`);
  process.exit(0);
}

// ─── COMMIT ──────────────────────────────────────────────────────────────────
// Backup de la base avant écriture
const backupPath = path.join(
  __dirname,
  '..',
  'database',
  `discado.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
);

(async () => {
  await db.backup(backupPath);
  console.log(`💾 Backup DB créé : ${path.relative(process.cwd(), backupPath)}\n`);

  const apply = db.transaction(() => {
    let created = 0;
    let appended = 0;
    let movedLines = 0;

    for (const p of plan) {
      if (!p.exists) continue; // on n'écrit pas pour un user introuvable

      const now = new Date().toISOString();
      let orderId;

      if (p.action === 'create') {
        orderId = orderCounter.generateOrderId();
        insertOrder.run(orderId, p.userId, 'pending', now, '');
        created++;
      } else {
        orderId = p.pendingOrder.order_id;
        appended++;
      }

      const existingItems = p.action === 'append' ? getOrderItems.all(orderId) : [];

      for (const it of p.items) {
        // merge si une ligne identique (product_id + size) existe déjà
        const match = existingItems.find((ex) =>
          it.product_id && ex.product_id
            ? ex.product_id === it.product_id && (ex.size || null) === (it.size || null)
            : ex.product_name === it.product_name &&
              ex.category === it.category &&
              (ex.size || null) === (it.size || null)
        );

        if (match) {
          updateItemQty.run(match.quantity + it.quantity, match.id);
        } else {
          insertItem.run(
            orderId,
            it.product_id || null,
            it.product_name,
            it.product_price,
            it.quantity,
            it.category || null,
            it.size || null
          );
        }

        deletePending.run(it.pending_id);
        movedLines++;
      }

      if (p.action === 'append') updateOrderDate.run(now, orderId);
    }

    return { created, appended, movedLines };
  });

  const res = apply();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ COMMIT TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Commandes créées    : ${res.created}`);
  console.log(`Commandes complétées : ${res.appended}`);
  console.log(`Lignes pending sorties : ${res.movedLines}`);
  console.log(`\nBackup : ${path.relative(process.cwd(), backupPath)}`);
  console.log('\n📌 À faire : vérifier les commandes dans l\'admin, générer les factures.\n');
})();
