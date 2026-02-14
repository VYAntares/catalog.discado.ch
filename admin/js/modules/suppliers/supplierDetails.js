/**
 * Vue détails d'un fournisseur
 * admin/js/modules/suppliers/supplierDetails.js
 */

import * as API from '../../core/api.js';
import * as State from './state.js';
import * as Utils from './utils.js';
import * as OrderDetails from './orderDetails.js';
import * as CreateOrderModal from './createOrderModal.js';


/**
 * Affiche les détails d'un fournisseur
 */
export async function show(supplierId) {
  State.setCurrentSupplierId(supplierId);
  State.setCurrentView('supplier');
  
  const supplier = State.getCurrentSupplier();
  
  if (!supplier) {
    console.error('Fournisseur introuvable');
    return;
  }

  try {
    // Charger les stats et commandes
    const [stats, orders] = await Promise.all([
      API.fetchSupplierStats(supplierId),
      API.fetchSupplierOrders(supplierId)
    ]);

    State.setCurrentSupplierOrders(orders);

    // Remplir les informations
    fillSupplierInfo(supplier);
    fillSupplierStats(stats);
    renderOrdersList(orders);

  } catch (error) {
    console.error('Erreur chargement détails fournisseur:', error);
  }
  const createOrderBtn = document.getElementById('createOrderBtn');
  if (createOrderBtn) {
    createOrderBtn.onclick = () => CreateOrderModal.open(supplierId);
  }
}

/**
 * Remplit les informations du fournisseur
 */
function fillSupplierInfo(supplier) {
  document.getElementById('supplierName').textContent = supplier.name;
  
  const contacts = [];
  if (supplier.emails) contacts.push(`📧 ${supplier.emails}`);
  if (supplier.phones) contacts.push(`📞 ${supplier.phones}`);
  if (supplier.wechats) contacts.push(`💬 ${supplier.wechats}`);
  
  document.getElementById('supplierContacts').innerHTML = 
    contacts.map(c => `<span>${c}</span>`).join('');
}

/**
 * Remplit les statistiques du fournisseur
 */
function fillSupplierStats(stats) {
  document.getElementById('statTotalOrders').textContent = stats.total_orders || 0;
  document.getElementById('statTotalSpent').textContent = Utils.formatAmount(stats.total_spent);
  
  const unpaid = Utils.calculateRemaining(stats.total_spent, stats.total_paid);
  document.getElementById('statUnpaid').textContent = Utils.formatAmount(unpaid);
}

/**
 * Affiche la liste des commandes du fournisseur
 */
function renderOrdersList(orders) {
  const list = document.getElementById('supplierOrdersList');

  if (!orders || orders.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Aucune commande trouvée pour ce fournisseur.</p>';
    return;
  }

  list.innerHTML = orders.map(order => createOrderCard(order)).join('');
  
  attachEventListeners();
}

/**
 * Crée le HTML d'une carte commande
 */
function createOrderCard(order) {
  const unpaid = Utils.calculateRemaining(order.total_amount, order.amount_paid);
  const statusClass = Utils.getStatusClass(order.status);
  const itemCount = order.item_count || 0;
  const categories = order.categories ? order.categories.split(',').filter(c => c.trim()) : [];

  const categoriesHtml = categories.length > 0
    ? categories.map(c => `<span class="order-card-category">${c.trim()}</span>`).join('')
    : '<span class="order-card-category order-card-category--empty">Aucune catégorie</span>';

  return `
    <div class="order-card" data-order-id="${order.id}">
      <div class="order-card-top">
        <div class="order-card-hero">
          <span class="order-card-total">${Utils.formatAmount(order.total_amount)}</span>
          <span class="order-card-item-count">${itemCount} article${itemCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="order-card-meta">
          <div class="order-card-header">
            <h4>Facture ${order.invoice_number}</h4>
            <span class="status-badge ${statusClass}">${order.status}</span>
          </div>
          <div class="order-card-date">${Utils.formatDate(order.order_date)}</div>
          <div class="order-card-amounts">
            <span class="order-card-amount"><strong>Payé</strong> ${Utils.formatAmount(order.amount_paid)}</span>
            <span class="order-card-amount order-card-amount--remaining"><strong>Reste</strong> ${Utils.formatAmount(unpaid)}</span>
          </div>
        </div>
      </div>
      <div class="order-card-categories">
        ${categoriesHtml}
      </div>
    </div>
  `;
}

/**
 * Attache les event listeners aux cartes commandes
 */
function attachEventListeners() {
  document.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', handleOrderClick);
  });
}

/**
 * Gère le clic sur une carte commande
 */
async function handleOrderClick(event) {
  const orderId = event.currentTarget.dataset.orderId;
  await OrderDetails.show(orderId);
}