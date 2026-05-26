// scripts/transfer-order.js
// Transfère une commande d'un client à un autre (orders + invoices)
//
// Utilisation :
//   node scripts/transfer-order.js <order_id> <new_username>
//
// Ajouter --confirm pour exécuter réellement le transfert (sans: mode dry-run)

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const dbModule = require('../services/db');
const db = dbModule.db;

const orderId = process.argv[2];
const newUsername = process.argv[3];
const isDryRun = !process.argv.includes('--confirm');

if (!orderId || !newUsername) {
  console.error('Usage: node scripts/transfer-order.js <order_id> <new_username> [--confirm]');
  console.error('  Sans --confirm : dry-run (affiche ce qui sera modifié sans toucher à la DB)');
  process.exit(1);
}

// Vérifier que la commande existe
const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
if (!order) {
  console.error(`La commande "${orderId}" n'existe pas.`);
  process.exit(1);
}

// Vérifier que le nouveau client existe
const newUser = db.prepare('SELECT * FROM users WHERE username = ?').get(newUsername);
if (!newUser) {
  console.error(`L'utilisateur "${newUsername}" n'existe pas.`);
  process.exit(1);
}

if (order.user_id === newUsername) {
  console.error(`La commande appartient déjà à "${newUsername}".`);
  process.exit(1);
}

// Récupérer le profil du nouveau client pour mettre à jour client_full_name dans les factures
const newProfile = db.prepare('SELECT * FROM user_profiles WHERE username = ?').get(newUsername);
const newFullName = newProfile
  ? [newProfile.first_name, newProfile.last_name].filter(Boolean).join(' ') || newUsername
  : newUsername;

// Récupérer les factures liées
const invoices = db.prepare('SELECT id, invoice_number, client_full_name FROM invoices WHERE order_id = ?').all(orderId);

console.log(`\nCommande: ${orderId}`);
console.log(`  Client actuel : ${order.user_id}`);
console.log(`  Nouveau client: ${newUsername} (${newFullName})`);
console.log(`  Statut        : ${order.status}`);
console.log(`  Date          : ${order.date}`);
console.log(`\nModifications prévues:`);
console.log(`  orders.user_id         : "${order.user_id}" → "${newUsername}"`);
if (invoices.length > 0) {
  invoices.forEach(inv => {
    console.log(`  invoices #${inv.invoice_number}.user_id         : "${order.user_id}" → "${newUsername}"`);
    console.log(`  invoices #${inv.invoice_number}.client_full_name : "${inv.client_full_name}" → "${newFullName}"`);
  });
} else {
  console.log(`  invoices         : (aucune facture liée)`);
}

if (isDryRun) {
  console.log('\n[DRY-RUN] Rien n\'a été modifié. Relancer avec --confirm pour transférer réellement.');
  process.exit(0);
}

try {
  db.pragma('foreign_keys = OFF');

  const transaction = db.transaction(() => {
    const orderResult = db.prepare('UPDATE orders SET user_id = ? WHERE order_id = ?')
      .run(newUsername, orderId);
    console.log(`\n✓ orders mis à jour: ${orderResult.changes}`);

    if (invoices.length > 0) {
      const invResult = db.prepare('UPDATE invoices SET user_id = ?, client_full_name = ? WHERE order_id = ?')
        .run(newUsername, newFullName, orderId);
      console.log(`✓ invoices mises à jour: ${invResult.changes}`);
    }
  });

  transaction();

  db.pragma('foreign_keys = ON');

  console.log(`\n✓ Commande "${orderId}" transférée à "${newUsername}" avec succès.`);
  process.exit(0);
} catch (err) {
  db.pragma('foreign_keys = ON');
  console.error('Erreur lors du transfert:', err.message);
  process.exit(1);
}
