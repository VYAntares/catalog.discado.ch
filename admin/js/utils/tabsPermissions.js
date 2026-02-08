/**
 * Gestion de l'affichage des onglets selon les permissions
 * admin/js/utils/tabsPermissions.js
 */

// Map des chemins vers les permissions requises
const TAB_PERMISSIONS = {
  '/admin/orders': 'orders',
  '/admin/order-history': 'order_history',
  '/admin/clients': 'clients',
  '/admin/compta': 'compta',
  '/admin/stock': 'stock',
  '/admin/suppliers': 'suppliers',
  '/admin/stats': 'stats'
};

// Map des sous-pages vers leur page parente
const SUBPAGE_TO_PARENT = {
  '/admin/client-invoices': '/admin/compta',
  '/admin/compta-details': '/admin/compta',
  '/admin/compta-month': '/admin/compta'
};

/**
 * Masque les onglets auxquels l'utilisateur n'a pas accès
 */
async function hideInaccessibleTabs() {
  try {
    // Récupérer les pages accessibles depuis l'API
    const response = await fetch('/api/accessible-pages');
    
    if (!response.ok) {
      console.error('❌ Impossible de récupérer les pages accessibles');
      return;
    }
    
    const data = await response.json();
    const accessiblePaths = data.pages.map(page => page.path);
    
    console.log('✅ Pages accessibles:', accessiblePaths);
    
    // Parcourir tous les onglets de navigation
    const tabs = document.querySelectorAll('.admin-tabs .tab, .admin-tabs a.tab');
    
    let hiddenCount = 0;
    let visibleCount = 0;
    
    tabs.forEach(tab => {
      const href = tab.getAttribute('href');
      
      // Vérifier si cet onglet est accessible
      if (!accessiblePaths.includes(href)) {
        // Masquer l'onglet complètement
        tab.style.display = 'none';
        hiddenCount++;
        console.log(`🚫 Onglet masqué: ${href}`);
      } else {
        // S'assurer que l'onglet est visible
        tab.style.display = '';
        visibleCount++;
        console.log(`✅ Onglet visible: ${href}`);
      }
    });
    
    console.log(`📊 Résumé: ${visibleCount} onglet(s) visible(s), ${hiddenCount} onglet(s) masqué(s)`);
    
    // S'assurer qu'au moins un onglet est visible
    if (visibleCount === 0) {
      console.error('⚠️ Aucun onglet visible - cela ne devrait pas arriver');
      showNoAccessMessage();
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du masquage des onglets:', error);
  }
}

/**
 * Affiche un message si aucun onglet n'est accessible
 */
function showNoAccessMessage() {
  const tabsContainer = document.querySelector('.admin-tabs');
  if (tabsContainer) {
    tabsContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #f56565; background: #fff3f3; border-radius: 8px; margin: 10px;">
        <i class="fas fa-exclamation-triangle"></i>
        <p style="margin: 10px 0;">Aucune section accessible. Veuillez contacter votre administrateur.</p>
      </div>
    `;
  }
}

/**
 * Vérifie si l'utilisateur a accès à la page actuelle
 * Si non, sera redirigé automatiquement par le serveur
 */
async function checkCurrentPageAccess() {
  const currentPath = window.location.pathname;
  
  try {
    const response = await fetch('/api/accessible-pages');
    
    if (!response.ok) {
      return;
    }
    
    const data = await response.json();
    const accessiblePaths = data.pages.map(page => page.path);
    
    // Vérifier si la page actuelle est accessible
    // Soit directement, soit via sa page parente (pour les sous-pages)
    const parentPath = SUBPAGE_TO_PARENT[currentPath];
    const hasAccess = accessiblePaths.includes(currentPath) ||
                      (parentPath && accessiblePaths.includes(parentPath));

    if (!hasAccess && data.pages.length > 0) {
      console.log(`⚠️ Pas d'accès à ${currentPath}, redirection...`);
      window.location.href = data.pages[0].path;
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification d\'accès:', error);
  }
}

/**
 * Initialise le système de gestion des permissions des onglets
 */
function initTabsPermissions() {
  console.log('🔧 Initialisation du système de permissions des onglets');
  
  // Masquer les onglets non accessibles
  hideInaccessibleTabs();
  
  // Vérifier l'accès à la page actuelle (sécurité supplémentaire)
  checkCurrentPageAccess();
}

// Exporter les fonctions
export {
  hideInaccessibleTabs,
  checkCurrentPageAccess,
  initTabsPermissions
};

// Auto-initialisation au chargement du DOM
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initTabsPermissions);
}