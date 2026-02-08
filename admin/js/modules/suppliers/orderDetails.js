/**
 * Vue détails d'une commande fournisseur
 * admin/js/modules/suppliers/orderDetails.js
 */

import * as API from '../../core/api.js';
import * as State from './state.js';
import * as Utils from './utils.js';
import * as SupplierDetails from './supplierDetails.js';
/**
 * Affiche les détails d'une commande
 */
export async function show(orderId) {
  State.setCurrentOrderId(orderId);
  State.setCurrentView('order');

  try {
    const [order, items] = await Promise.all([
      API.fetchSupplierOrderDetails(orderId),
      API.fetchSupplierOrderItems(orderId)
    ]);

    State.setCurrentOrderData(order);
    State.setCurrentOrderItems(items);

    fillOrderInfo(order);
    renderItemsList(items);
    attachEventListeners();

  } catch (error) {
    console.error('Erreur chargement détails commande:', error);
  }
}

/**
 * Remplit les informations de la commande
 */
function fillOrderInfo(order) {
  document.getElementById('orderInvoiceNumber').textContent = order.invoice_number;
  document.getElementById('orderDate').textContent = Utils.formatDate(order.order_date);
  document.getElementById('orderStatusSelect').value = order.status;
  document.getElementById('orderTotalAmount').value = (order.total_amount || 0).toFixed(2);
  document.getElementById('orderAmountPaid').value = (order.amount_paid || 0).toFixed(2);
  
  const remaining = Utils.calculateRemaining(order.total_amount, order.amount_paid);
  document.getElementById('orderRemaining').value = remaining.toFixed(2);
  
  document.getElementById('orderNotes').value = order.notes || '';
}

/**
 * Affiche la liste des items
 */
function renderItemsList(items) {
  const list = document.getElementById('orderItemsList');

  if (!items || items.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Aucun article dans cette commande.</p>';
    return;
  }

  list.innerHTML = items.map(item => createItemCard(item)).join('');
}

/**
 * Crée le HTML d'une carte item
 */
function createItemCard(item) {
  const imageUrl = item.image_url || '/images/placeholder.png';
  const category = item.category || 'N/A';
  const totalPrice = Utils.formatAmount(item.total_price);
  const unitPrice = (item.unit_price || 0).toFixed(2);

  return `
    <div class="item-card">
      <img src="${imageUrl}" 
           alt="${item.product_name}" 
           class="item-image"
           onerror="this.src='/images/placeholder.png'">
      <div class="item-details">
        <h4>${item.product_name}</h4>
        <p>Catégorie: ${category}</p>
        <p>Quantité: ${item.quantity} × ${unitPrice} CHF = <strong>${totalPrice}</strong></p>
      </div>
      <div class="item-actions">
        <button class="btn btn-danger btn-sm" data-item-id="${item.id}">Supprimer</button>
      </div>
    </div>
  `;
}

/**
 * Attache les event listeners
 */
function attachEventListeners() {
  // Changement de statut
  const statusSelect = document.getElementById('orderStatusSelect');
  statusSelect.removeEventListener('change', handleStatusChange);
  statusSelect.addEventListener('change', handleStatusChange);

  // Sauvegarde des montants
  const saveBtn = document.getElementById('saveAmountsBtn');
  saveBtn.removeEventListener('click', handleSaveAmounts);
  saveBtn.addEventListener('click', handleSaveAmounts);

  // Calcul automatique du reste à payer
  const amountPaidInput = document.getElementById('orderAmountPaid');
  amountPaidInput.removeEventListener('input', handleAmountPaidChange);
  amountPaidInput.addEventListener('input', handleAmountPaidChange);

  // Suppression commande
  const deleteBtn = document.getElementById('deleteOrderBtn');
  deleteBtn.removeEventListener('click', handleDeleteOrder);
  deleteBtn.addEventListener('click', handleDeleteOrder);

  // Suppression items
  document.querySelectorAll('.item-actions button').forEach(btn => {
    btn.addEventListener('click', handleDeleteItem);
  });
}

/**
 * Gère le changement de statut
 */
async function handleStatusChange(event) {
  const orderId = State.getCurrentOrderId();
  const newStatus = event.target.value;

  try {
    await API.updateSupplierOrderStatus(orderId, newStatus);
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
  }
}

/**
 * Gère la sauvegarde des montants
 */
async function handleSaveAmounts() {
  const orderId = State.getCurrentOrderId();
  const totalAmount = parseFloat(document.getElementById('orderTotalAmount').value);
  const amountPaid = parseFloat(document.getElementById('orderAmountPaid').value);

  try {
    await API.updateSupplierOrderAmounts(orderId, totalAmount, amountPaid);
    
    // Mettre à jour le champ "Reste à payer"
    const remaining = Utils.calculateRemaining(totalAmount, amountPaid);
    document.getElementById('orderRemaining').value = remaining.toFixed(2);
  } catch (error) {
    console.error('Erreur mise à jour montants:', error);
  }
}

/**
 * Gère le changement du montant payé
 */
function handleAmountPaidChange() {
  const total = parseFloat(document.getElementById('orderTotalAmount').value) || 0;
  const paid = parseFloat(document.getElementById('orderAmountPaid').value) || 0;
  const remaining = Utils.calculateRemaining(total, paid);
  document.getElementById('orderRemaining').value = remaining.toFixed(2);
}

/**
 * Gère la suppression de la commande
 */
async function handleDeleteOrder() {
  if (!confirm('Supprimer cette commande définitivement ?')) return;

  const orderId = State.getCurrentOrderId();
  const supplierId = State.getCurrentSupplierId();

  try {
    await API.deleteSupplierOrder(orderId);
    await SupplierDetails.show(supplierId);
  } catch (error) {
    console.error('Erreur suppression commande:', error);
  }
}

/**
 * Gère la suppression d'un item
 */
async function handleDeleteItem(event) {
  if (!confirm('Supprimer cet article ?')) return;

  const itemId = event.currentTarget.dataset.itemId;
  const orderId = State.getCurrentOrderId();

  try {
    await API.deleteSupplierOrderItem(itemId);
    // Recharger les détails de la commande
    await show(orderId);
  } catch (error) {
    console.error('Erreur suppression item:', error);
  }
}