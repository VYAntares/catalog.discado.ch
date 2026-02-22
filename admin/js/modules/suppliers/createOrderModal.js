/**
 * Modal de création d'une commande fournisseur
 * admin/js/modules/suppliers/createOrderModal.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as State from './state.js';
import * as SupplierDetails from './supplierDetails.js';

/**
 * Initialise les event listeners du modal
 */
export function init() {
  const closeBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelModalBtn');
  const submitBtn = document.getElementById('submitOrderBtn');
  
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
}

/**
 * Ouvre le modal pour un fournisseur spécifique
 */
export function open(supplierId) {
  const modal = document.getElementById('createOrderModal');
  const suppliers = State.getSuppliers();
  const supplier = suppliers.find(s => s.id == supplierId);
  
  if (!supplier) {
    alert('Fournisseur introuvable');
    return;
  }
  
  // Remplir le fournisseur (lecture seule)
  document.getElementById('modalSupplierName').value = supplier.name;
  document.getElementById('modalSupplierId').value = supplier.id;
  
  // Définir la date du jour par défaut
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('modalOrderDate').value = today;
  
  // Réinitialiser les autres champs
  document.getElementById('modalInvoiceNumber').value = '';
  document.getElementById('modalStatus').value = 'Passée';
  document.getElementById('modalNotes').value = '';

  modal.style.display = 'flex';
}

/**
 * Ferme le modal
 */
export function close() {
  const modal = document.getElementById('createOrderModal');
  modal.style.display = 'none';
}

/**
 * Gère la soumission du formulaire
 */
async function handleSubmit() {
  const supplierId = document.getElementById('modalSupplierId').value;
  const invoiceNumber = document.getElementById('modalInvoiceNumber').value;
  const orderDate = document.getElementById('modalOrderDate').value;
  const status = document.getElementById('modalStatus').value;
  const notes = document.getElementById('modalNotes').value;

  // Validation
  if (!supplierId || !invoiceNumber || !orderDate) {
    alert('Veuillez remplir tous les champs obligatoires');
    return;
  }

  try {
    const result = await API.createSupplierOrder({
      supplier_id: parseInt(supplierId),
      invoice_number: invoiceNumber,
      order_date: orderDate,
      status: status,
      notes: notes,
      items: [] // Commande vide, articles ajoutés après
    });

    console.log('✅ Commande créée:', result);
    
    close();
    
    // Recharger la vue du fournisseur
    await SupplierDetails.show(supplierId);
    
    // Success notification already shown by API.createSupplierOrder()
  } catch (error) {
    console.error('❌ Erreur création commande:', error);
    Notification.showNotification('Erreur lors de la création de la commande', 'error');
  }
}