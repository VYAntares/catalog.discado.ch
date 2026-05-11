// scripts/update-username.js
// Modifie le username d'un user dans TOUTES les tables concernées
//
// Utilisation :
//   node scripts/update-username.js <old_username> <new_username>

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const dbModule = require('../services/db');
const db = dbModule.db;

const oldUsername = process.argv[2];
const newUsername = process.argv[3];

if (!oldUsername || !newUsername) {
  console.error('Usage: node scripts/update-username.js <old_username> <new_username>');
  process.exit(1);
}

if (oldUsername === newUsername) {
  console.error('Les usernames ancien et nouveau sont identiques.');
  process.exit(1);
}

// Vérifier que l'ancien username existe
const oldUser = db.prepare('SELECT * FROM users WHERE username = ?').get(oldUsername);
if (!oldUser) {
  console.error(`L'utilisateur "${oldUsername}" n'existe pas.`);
  process.exit(1);
}

// Vérifier que le nouveau username n'existe pas
const newUser = db.prepare('SELECT * FROM users WHERE username = ?').get(newUsername);
if (newUser) {
  console.error(`L'utilisateur "${newUsername}" existe déjà.`);
  process.exit(1);
}

console.log(`Modification du username de "${oldUsername}" vers "${newUsername}"...\n`);

try {
  // Désactiver temporairement les contraintes de clés étrangères
  db.pragma('foreign_keys = OFF');

  // Démarrer une transaction
  const transaction = db.transaction(() => {
    // Mettre à jour la table users
    const usersResult = db.prepare('UPDATE users SET username = ? WHERE username = ?')
      .run(newUsername, oldUsername);
    console.log(`✓ users: ${usersResult.changes} record(s)`);

    // Mettre à jour la table user_profiles
    const profilesResult = db.prepare('UPDATE user_profiles SET username = ? WHERE username = ?')
      .run(newUsername, oldUsername);
    console.log(`✓ user_profiles: ${profilesResult.changes} record(s)`);

    // Mettre à jour la table orders (user_id)
    const ordersResult = db.prepare('UPDATE orders SET user_id = ? WHERE user_id = ?')
      .run(newUsername, oldUsername);
    console.log(`✓ orders: ${ordersResult.changes} record(s)`);

    // Mettre à jour la table pending_deliveries (user_id)
    const pendingResult = db.prepare('UPDATE pending_deliveries SET user_id = ? WHERE user_id = ?')
      .run(newUsername, oldUsername);
    console.log(`✓ pending_deliveries: ${pendingResult.changes} record(s)`);

    // Mettre à jour la table invoices (user_id)
    const invoicesResult = db.prepare('UPDATE invoices SET user_id = ? WHERE user_id = ?')
      .run(newUsername, oldUsername);
    console.log(`✓ invoices: ${invoicesResult.changes} record(s)`);

    // Mettre à jour la table user_permissions
    const permissionsResult = db.prepare('UPDATE user_permissions SET username = ? WHERE username = ?')
      .run(newUsername, oldUsername);
    if (permissionsResult.changes > 0) {
      console.log(`✓ user_permissions: ${permissionsResult.changes} record(s)`);
    }

    // Mettre à jour la table share_tokens (client_id)
    const shareTokensResult = db.prepare('UPDATE share_tokens SET client_id = ? WHERE client_id = ?')
      .run(newUsername, oldUsername);
    if (shareTokensResult.changes > 0) {
      console.log(`✓ share_tokens: ${shareTokensResult.changes} record(s)`);
    }

    // Mettre à jour la table password_reset_tokens (username)
    const resetTokensResult = db.prepare('UPDATE password_reset_tokens SET username = ? WHERE username = ?')
      .run(newUsername, oldUsername);
    if (resetTokensResult.changes > 0) {
      console.log(`✓ password_reset_tokens: ${resetTokensResult.changes} record(s)`);
    }
  });

  transaction();

  // Réactiver les contraintes de clés étrangères
  db.pragma('foreign_keys = ON');

  // Vérifier le changement
  const verifyUser = db.prepare('SELECT * FROM users WHERE username = ?').get(newUsername);
  if (verifyUser) {
    console.log('\n✓ Changement effectué avec succès!');
    console.log(`\nNouveau user: ${newUsername}`);
    console.log(`Role: ${verifyUser.role}`);
    process.exit(0);
  } else {
    console.error('Erreur: Le changement n\'a pas pu être vérifié.');
    process.exit(1);
  }
} catch (err) {
  console.error('Erreur lors de la mise à jour:', err.message);
  process.exit(1);
}
