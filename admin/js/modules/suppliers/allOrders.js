/**
 * Vue "Toutes les commandes" affichée sous la liste des fournisseurs
 * admin/js/modules/suppliers/allOrders.js
 */

import * as API from '../../core/api.js';
import * as State from './state.js';
import * as Utils from './utils.js';
import * as OrderDetails from './orderDetails.js';

let allOrders = [];
let currentFilter = '';

export async function init() {
  const filterSelect = document.getElementById('allOrdersStatusFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      render();
    });
  }

  await load();
}

export async function load() {
  try {
    allOrders = await API.fetchAllSupplierOrdersWithDetails();
    render();
  } catch (error) {
    console.error('Erreur chargement toutes les commandes:', error);
    const list = document.getElementById('allOrdersList');
    if (list) {
      list.innerHTML = '<p style="text-align: center; color: #e53e3e;">Erreur lors du chargement des commandes.</p>';
    }
  }
}

function render() {
  const list = document.getElementById('allOrdersList');
  if (!list) return;

  const filtered = currentFilter
    ? allOrders.filter(o => o.status === currentFilter)
    : allOrders;

  if (filtered.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Aucune commande trouvée.</p>';
    return;
  }

  list.innerHTML = filtered.map(order => createOrderCard(order)).join('');

  list.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', handleOrderClick);
  });
}

function createOrderCard(order) {
  const unpaid = Utils.calculateRemaining(order.total_amount, order.amount_paid);
  const statusClass = Utils.getStatusClass(order.status);
  const itemCount = order.item_count || 0;
  const itemCountFormatted = Utils.formatSwissNumber(itemCount, 0);
  const categories = order.categories ? order.categories.split(',').filter(c => c.trim()) : [];

  const categoriesHtml = categories.length > 0
    ? categories.map(c => `<span class="order-card-category">${c.trim()}</span>`).join('')
    : '<span class="order-card-category order-card-category--empty">Aucune catégorie</span>';

  const supplierName = order.supplier_name || 'Fournisseur inconnu';
  const supplierAvatar = order.supplier_image_url
    ? `<img class="order-card-supplier-avatar" src="${order.supplier_image_url}" alt="${supplierName}">`
    : `<span class="order-card-supplier-avatar order-card-supplier-avatar--placeholder"><i class="fas fa-truck"></i></span>`;

  return `
    <div class="order-card" data-order-id="${order.id}" data-supplier-id="${order.supplier_id}">
      <div class="order-card-supplier">
        ${supplierAvatar}
        <span>${supplierName}</span>
      </div>
      <div class="order-card-top">
        <div class="order-card-hero">
          <span class="order-card-total">${Utils.formatAmount(order.total_amount)}</span>
          <span class="order-card-item-count">${itemCountFormatted} article${itemCount !== 1 ? 's' : ''}</span>
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

async function handleOrderClick(event) {
  const orderId = event.currentTarget.dataset.orderId;
  const supplierId = event.currentTarget.dataset.supplierId;
  if (supplierId) {
    State.setCurrentSupplierId(supplierId);
  }
  await OrderDetails.show(orderId);
}
