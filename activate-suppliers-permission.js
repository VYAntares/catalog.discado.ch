// activate-suppliers-permission.js
const permissionService = require('./services/permissionService');

const USERNAME = 'luca'; // Remplacez par votre nom d'utilisateur

// Récupérer les permissions actuelles
const currentPerms = permissionService.getUserPermissions(USERNAME);

// Ajouter la permission suppliers
const newPerms = {
    ...currentPerms,
    suppliers: true
};

// Sauvegarder
permissionService.setUserPermissions(USERNAME, newPerms);

console.log('✅ Permission Fournisseurs activée pour', USERNAME);
console.log('Nouvelles permissions:', permissionService.getUserPermissions(USERNAME));