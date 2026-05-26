// scripts/delete-order.js
// Supprime une commande et toutes les données liées (articles, factures, paiements)
//
// Utilisation :
//   node scripts/delete-order.js <order_id>
//
// Ajouter --confirm pour exécuter réellement la suppression (sans: mode dry-run)

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const dbModule = require('../services/db');
const db = dbModule.db;

const orderId = process.argv[2];
const isDryRun = !process.argv.includes('--confirm');

if (!orderId) {
  console.error('Usage: node scripts/delete-order.js <order_id> [--confirm]');
  console.error('  Sans --confirm : dry-run (affiche ce qui sera supprimé sans toucher à la DB)');
  process.exit(1);
}

// Vérifier que la commande existe
const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
if (!order) {
  console.error(`La commande "${orderId}" n'existe pas.`);
  process.exit(1);
}

// Récupérer les données liées
const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
const invoices = db.prepare('SELECT * FROM invoices WHERE order_id = ?').all(orderId);
const invoiceIds = invoices.map(i => i.id);
const payments = invoiceIds.length > 0
  ? db.prepare(`SELECT * FROM invoice_payments WHERE invoice_id IN (${invoiceIds.map(() => '?').join(',')})`).all(...invoiceIds)
  : [];

console.log(`\nCommande: ${orderId}`);
console.log(`  Client  : ${order.user_id}`);
console.log(`  Statut  : ${order.status}`);
console.log(`  Date    : ${order.date}`);
console.log(`  Réf     : ${order.reference || '(aucune)'}`);
console.log(`\nDonnées liées à supprimer:`);
console.log(`  order_items      : ${items.length} article(s)`);
console.log(`  invoices         : ${invoices.length} facture(s)`);
console.log(`  invoice_payments : ${payments.length} paiement(s)`);

if (isDryRun) {
  console.log('\n[DRY-RUN] Rien n\'a été modifié. Relancer avec --confirm pour supprimer réellement.');
  process.exit(0);
}

try {
  db.pragma('foreign_keys = OFF');

  const transaction = db.transaction(() => {
    if (payments.length > 0) {
      const payResult = db.prepare(`DELETE FROM invoice_payments WHERE invoice_id IN (${invoiceIds.map(() => '?').join(',')})`)
        .run(...invoiceIds);
      console.log(`\n✓ invoice_payments supprimés: ${payResult.changes}`);
    }

    if (invoices.length > 0) {
      const invResult = db.prepare('DELETE FROM invoices WHERE order_id = ?').run(orderId);
      console.log(`✓ invoices supprimées: ${invResult.changes}`);
    }

    const itemsResult = db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    console.log(`✓ order_items supprimés: ${itemsResult.changes}`);

    const orderResult = db.prepare('DELETE FROM orders WHERE order_id = ?').run(orderId);
    console.log(`✓ order supprimée: ${orderResult.changes}`);
  });

  transaction();

  db.pragma('foreign_keys = ON');

  console.log(`\n✓ Commande "${orderId}" supprimée avec succès.`);
  process.exit(0);
} catch (err) {
  db.pragma('foreign_keys = ON');
  console.error('Erreur lors de la suppression:', err.message);
  process.exit(1);
}
