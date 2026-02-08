/**
 * Vue liste des fournisseurs
 * admin/js/modules/suppliers/suppliersList.js
 */

import * as State from './state.js';
import * as SupplierDetails from './supplierDetails.js';

/**
 * Affiche la liste des fournisseurs
 */
export function render() {
  const grid = document.getElementById('suppliersGrid');
  const suppliers = State.getSuppliers();
  
  if (!suppliers || suppliers.length === 0) {
    grid.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Aucun fournisseur trouvé.</p>';
    return;
  }

  grid.innerHTML = suppliers.map(supplier => createSupplierCard(supplier)).join('');
  
  attachEventListeners();
}

/**
 * Crée le HTML d'une carte fournisseur
 */
function createSupplierCard(supplier) {
  const emails = supplier.emails || 'N/A';
  const phones = supplier.phones || 'N/A';
  
  return `
    <div class="supplier-card" data-supplier-id="${supplier.id}">
      <h3>${supplier.name}</h3>
      <div class="supplier-card-stats">
        <span>📧 ${emails}</span>
        <span>📞 ${phones}</span>
      </div>
    </div>
  `;
}

/**
 * Attache les event listeners aux cartes
 */
function attachEventListeners() {
  document.querySelectorAll('.supplier-card').forEach(card => {
    card.addEventListener('click', handleSupplierClick);
  });
}

/**
 * Gère le clic sur une carte fournisseur
 */
async function handleSupplierClick(event) {
  const supplierId = event.currentTarget.dataset.supplierId;
  await SupplierDetails.show(supplierId);
}

/**
 * Affiche la vue liste
 */
export function show() {
  State.setCurrentView('list');
  render();
}