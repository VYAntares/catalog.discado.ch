// set-permissions.js
const permissionService = require('./services/permissionService');

// Modifier le username et les permissions ici
const USERNAME = 'luca';
const PERMISSIONS = {
  stock: true,
  compta: true,
  orders: true,
  clients: true,
  order_history: true
};

permissionService.setUserPermissions(USERNAME, PERMISSIONS);
console.log(`✅ Permissions de ${USERNAME} mises à jour:`);
console.log(permissionService.getUserPermissions(USERNAME));