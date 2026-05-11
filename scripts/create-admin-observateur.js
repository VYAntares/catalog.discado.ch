// scripts/create-admin-observateur.js
// Crée (ou met à jour) un compte admin_observateur en lecture seule.
//
// Utilisation :
//   node scripts/create-admin-observateur.js <username> <password>

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const dbModule = require('../services/db');
const userService = require('../services/userService');
const permissionService = require('../services/permissionService');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node scripts/create-admin-observateur.js <username> <password>');
  process.exit(1);
}

const existing = userService.getUser(username);

if (existing) {
  if (existing.role !== 'admin_observateur') {
    dbModule.db.prepare('UPDATE users SET role = ? WHERE username = ?')
      .run('admin_observateur', username);
    console.log(`Rôle de "${username}" mis à jour vers admin_observateur.`);
  } else {
    console.log(`L'utilisateur "${username}" existe déjà avec le rôle admin_observateur.`);
  }
} else {
  userService.createUser(username, password, 'admin_observateur');
  console.log(`Utilisateur "${username}" créé avec le rôle admin_observateur.`);
}

// Donner accès à TOUTES les sections en lecture (l'écriture est bloquée
// globalement par le middleware blockWritesForObserver dans index.js).
permissionService.setUserPermissions(username, {
  stock: true,
  compta: true,
  orders: true,
  clients: true,
  order_history: true,
  suppliers: true,
  stats: true
});

console.log('Permissions de lecture accordées sur toutes les sections.');
console.log('Compte prêt. Connexion via la page de login habituelle.');
