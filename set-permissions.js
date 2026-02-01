// set-permissions.js
const permissionService = require('./services/permissionService');

// Modifier le username et les permissions ici
const USERNAME = 'carole';
const PERMISSIONS = {
  stock: true,
  compta: false,
  orders: true,
  clients: true,
  order_history: true
};

permissionService.setUserPermissions(USERNAME, PERMISSIONS);
console.log(`✅ Permissions de ${USERNAME} mises à jour:`);
console.log(permissionService.getUserPermissions(USERNAME));