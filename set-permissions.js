// set-permissions.js
const permissionService = require('./services/permissionService');

// Modifier le username et les permissions ici
const USERNAME = 'luca';
const PERMISSIONS = {
  stock: false,
  compta: false,
  orders: true,
  clients: false,
  order_history: false
};

permissionService.setUserPermissions(USERNAME, PERMISSIONS);
console.log(`✅ Permissions de ${USERNAME} mises à jour:`);
console.log(permissionService.getUserPermissions(USERNAME));