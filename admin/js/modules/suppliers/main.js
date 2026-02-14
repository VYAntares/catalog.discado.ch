/**
 * Point d'entrée principal du module Fournisseurs
 * admin/js/modules/suppliers/index.js
 */

import * as API from '../../core/api.js';
import * as State from './state.js';
import * as SuppliersList from './suppliersList.js';
import * as SupplierDetails from './supplierDetails.js';
import * as OrderDetails from './orderDetails.js';
import * as CreateOrderModal from './createOrderModal.js';
import * as CreateSupplierModal from './createSupplierModal.js';

/**
 * Initialisation du module
 */
export async function init() {
  console.log('🚀 Initialisation module Fournisseurs...');
  
  try {
    await loadInitialData();
    initNavigation();
    initLogout();
    CreateOrderModal.init();
    CreateSupplierModal.init();

    // Afficher la vue initiale
    SuppliersList.show();
    
    console.log('✅ Module Fournisseurs initialisé');
  } catch (error) {
    console.error('❌ Erreur initialisation module Fournisseurs:', error);
  }
}

/**
 * Charge les données initiales
 */
async function loadInitialData() {
  try {
    const [suppliers, productsResponse] = await Promise.all([
      API.fetchSuppliers(),
      fetch('/api/products')
    ]);

    const products = await productsResponse.json();

    State.setSuppliers(suppliers);
    State.setProducts(products);
    
    console.log(`📦 Chargé: ${suppliers.length} fournisseurs, ${products.length} produits`);
  } catch (error) {
    console.error('Erreur chargement données:', error);
    throw error;
  }
}

/**
 * Initialise la navigation entre les vues
 */
function initNavigation() {
  // Bouton retour vers liste fournisseurs
  document.getElementById('backToSuppliersBtn')?.addEventListener('click', () => {
    SuppliersList.show();
  });

  // Bouton retour vers détails fournisseur
  document.getElementById('backToSupplierBtn')?.addEventListener('click', () => {
    const supplierId = State.getCurrentSupplierId();
    if (supplierId) {
      SupplierDetails.show(supplierId);
    }
  });
}

/**
 * Initialise le bouton de déconnexion
 */
function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Déconnexion ?')) {
      window.location.href = '/logout';
    }
  });
}

/**
 * Expose les fonctions principales pour le routing externe si nécessaire
 */
export {
  SuppliersList,
  SupplierDetails,
  OrderDetails
};