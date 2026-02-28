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
  const emails  = Array.isArray(supplier.emails)  ? supplier.emails  : (supplier.emails  ? [supplier.emails]  : []);
  const phones  = Array.isArray(supplier.phones)  ? supplier.phones  : (supplier.phones  ? [supplier.phones]  : []);
  const wechats = Array.isArray(supplier.wechats) ? supplier.wechats : (supplier.wechats ? [supplier.wechats] : []);

  const rows = (items, icon, cssClass) =>
    items.map(v => `<div class="sc-contact-row sc-contact-${cssClass}">
      <i class="${icon}"></i><span>${v}</span>
    </div>`).join('');

  const contactsHtml = [
    rows(emails,  'fas fa-envelope', 'email'),
    rows(phones,  'fas fa-phone',    'phone'),
    rows(wechats, 'fab fa-weixin',   'wechat'),
  ].join('');

  return `
    <div class="supplier-card" data-supplier-id="${supplier.id}">
      <div class="sc-name">
        <span class="sc-icon"><i class="fas fa-truck"></i></span>
        <span>${supplier.name}</span>
      </div>
      ${contactsHtml
        ? `<div class="sc-contacts">${contactsHtml}</div>`
        : `<p class="sc-empty">Aucun contact renseigné</p>`
      }
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