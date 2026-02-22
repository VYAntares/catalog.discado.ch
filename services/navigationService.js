// services/navigationService.js
const permissionService = require('./permissionService');

// Ordre de priorité des pages (de la plus importante à la moins importante)
const PAGE_PRIORITY = [
  { permission: 'orders', path: '/admin/orders', name: 'Gestion des commandes' },
  { permission: 'order_history', path: '/admin/order-history', name: 'Historique des commandes' },
  { permission: 'clients', path: '/admin/clients', name: 'Client Database' },
  { permission: 'compta', path: '/admin/compta', name: 'Compta' },
  { permission: 'stock', path: '/admin/stock', name: 'Stock' },
  { permission: 'suppliers', path: '/admin/suppliers', name: 'Fournisseurs' },
  { permission: 'stats', path: '/admin/stats', name: 'Statistiques' },
  { permission: 'results', path: '/admin/results', name: 'Résultat' }
];

/**
 * Trouve la première page accessible pour un utilisateur
 * @param {string} username - Le nom d'utilisateur
 * @returns {Object|null} - { path: string, name: string } ou null si aucune page accessible
 */
function getFirstAccessiblePage(username) {
  for (const page of PAGE_PRIORITY) {
    if (permissionService.hasPermission(username, page.permission)) {
      return {
        path: page.path,
        name: page.name
      };
    }
  }
  return null;
}

/**
 * Vérifie si l'utilisateur a accès à la page demandée
 * Si non, retourne la première page accessible
 * @param {string} username - Le nom d'utilisateur
 * @param {string} requestedPath - Le chemin demandé
 * @returns {Object} - { hasAccess: boolean, redirectPath: string|null }
 */
function checkPageAccess(username, requestedPath) {
  // Map des chemins vers les permissions
  const pathPermissionMap = {
    '/admin/orders': 'orders',
    '/admin/order-history': 'order_history',
    '/admin/clients': 'clients',
    '/admin/compta': 'compta',
    '/admin/stock': 'stock',
    '/admin/suppliers': 'suppliers',
    '/admin/client-invoices': 'compta',
    '/admin/compta-details': 'compta',
    '/admin/compta-month': 'compta',
    '/admin/stats': 'stats'
  };

  const requiredPermission = pathPermissionMap[requestedPath];

  // Si la page ne nécessite pas de permission spécifique, autoriser l'accès
  if (!requiredPermission) {
    return { hasAccess: true, redirectPath: null };
  }

  // Vérifier si l'utilisateur a la permission
  const hasAccess = permissionService.hasPermission(username, requiredPermission);

  if (hasAccess) {
    return { hasAccess: true, redirectPath: null };
  }

  // Trouver la première page accessible
  const firstPage = getFirstAccessiblePage(username);

  return {
    hasAccess: false,
    redirectPath: firstPage ? firstPage.path : null,
    message: firstPage 
      ? `Accès refusé. Redirection vers ${firstPage.name}` 
      : 'Aucune page accessible'
  };
}

/**
 * Récupère toutes les pages accessibles pour un utilisateur
 * @param {string} username - Le nom d'utilisateur
 * @returns {Array} - Liste des pages accessibles
 */
function getAccessiblePages(username) {
  return PAGE_PRIORITY.filter(page => 
    permissionService.hasPermission(username, page.permission)
  );
}

module.exports = {
  getFirstAccessiblePage,
  checkPageAccess,
  getAccessiblePages,
  PAGE_PRIORITY
};