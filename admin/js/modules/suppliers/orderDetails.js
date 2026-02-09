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
    State.setCurrentOrder(order);

    fillOrderInfo(order);
    renderItemsList(items);
    attachEventListeners();
  
  } catch (error) {
    console.error('Erreur chargement détails commande:', error);
  }
  const addItemBtn = document.getElementById('addItemToOrderBtn');
  if (addItemBtn) {
    addItemBtn.onclick = () => openAddItemModal();
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

/**
 * Ouvre le modal d'ajout d'article
 */
export function openAddItemModal() {
  const modal = document.getElementById('addItemToOrderModal');
  const orderId = State.getCurrentOrderId();
  const order = State.getCurrentOrder();
  
  if (!order) {
    alert('Commande introuvable');
    return;
  }
  
  // Charger les produits du fournisseur
  loadSupplierProducts(order.supplier_id);
  
  // Event listeners
  setupAddItemModalListeners();
  
  modal.style.display = 'flex';
}

/**
 * Charge les produits du fournisseur
 */
async function loadSupplierProducts(supplierId) {
  const container = document.getElementById('productsListContainer');
  const suppliers = State.getSuppliers();
  const supplier = suppliers.find(s => s.id == supplierId);
  
  if (!supplier) {
    container.innerHTML = '<p style="text-align: center; color: #718096;">Fournisseur introuvable</p>';
    return;
  }
  
  try {
    // Récupérer tous les produits
    const response = await fetch('/api/products');
    const allProducts = await response.json();
    
    // Filtrer par fournisseur
    const supplierProducts = allProducts.filter(p => p.supplier === supplier.name);
    
    if (supplierProducts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          <p>Aucun produit trouvé pour ce fournisseur</p>
        </div>
      `;
      return;
    }
    
    // Stocker les produits pour la recherche
    window.currentSupplierProducts = supplierProducts;
    
    // Afficher les produits
    renderProductsList(supplierProducts);
    
  } catch (error) {
    console.error('Erreur chargement produits:', error);
    container.innerHTML = '<p style="text-align: center; color: #f56565;">Erreur de chargement</p>';
  }
}

/**
 * Affiche la liste des produits
 */
function renderProductsList(products) {
  const container = document.getElementById('productsListContainer');
  
  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>Aucun produit trouvé</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = products.map(product => `
    <div class="product-list-item">
      <img src="${product.image_url || '/images/placeholder.png'}" 
           alt="${product.name}" 
           class="product-list-image"
           onerror="this.src='/images/placeholder.png'">
      
      <div class="product-list-info">
        <h4>${product.name}</h4>
        <p><i class="fas fa-tag"></i> ${product.category || 'Autre'}</p>
        <p><i class="fas fa-barcode"></i> ${product.barcode || 'N/A'}</p>
      </div>
      
      <div class="product-list-price">
        ${(product.origin_price || 0).toFixed(2)} CHF
      </div>
      
      <div class="product-list-actions">
        <input type="number" 
               class="item-quantity-input" 
               value="50" 
               min="1"
               data-product-id="${product.id}">
        <button class="btn btn-primary btn-icon add-item-btn" 
                data-product-id="${product.id}"
                data-product-name="${product.name}"
                data-product-price="${product.origin_price || 0}"
                data-product-category="${product.category || ''}"
                data-product-image="${product.image_url || ''}">
          <i class="fas fa-plus"></i> Ajouter
        </button>
      </div>
    </div>
  `).join('');
  
  // Attacher les event listeners
  attachAddItemButtonsListeners();
}

/**
 * Event listeners pour les boutons d'ajout
 */
function attachAddItemButtonsListeners() {
  document.querySelectorAll('.add-item-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productId = btn.dataset.productId;
      const productName = btn.dataset.productName;
      const productPrice = parseFloat(btn.dataset.productPrice);
      const productCategory = btn.dataset.productCategory;
      const productImage = btn.dataset.productImage;
      
      const quantityInput = document.querySelector(`.item-quantity-input[data-product-id="${productId}"]`);
      const quantity = parseInt(quantityInput.value) || 50;
      
      await addItemToCurrentOrder(productId, productName, productPrice, quantity, productCategory, productImage);
    });
  });
}

/**
 * Ajoute un article à la commande courante
 */
async function addItemToCurrentOrder(productId, productName, price, quantity, category, imageUrl) {
  const orderId = State.getCurrentOrderId();
  
  try {
    const result = await API.addSupplierOrderItem(orderId, {
      product_id: parseInt(productId),
      product_name: productName,
      unit_price: price,
      quantity: quantity,
      category: category,
      image_url: imageUrl
    });
    
    if (result.success) {
      // Recharger la commande
      await show(orderId);
      
      // Fermer le modal
      document.getElementById('addItemToOrderModal').style.display = 'none';
    }
  } catch (error) {
    console.error('Erreur ajout article:', error);
    alert('Erreur lors de l\'ajout de l\'article');
  }
}

/**
 * Configure les event listeners du modal
 */
function setupAddItemModalListeners() {
  const closeBtn = document.getElementById('closeAddItemModal');
  const searchInput = document.getElementById('searchProductInput');
  
  // Fermeture
  closeBtn.onclick = () => {
    document.getElementById('addItemToOrderModal').style.display = 'none';
  };
  
  // Recherche
  searchInput.oninput = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const products = window.currentSupplierProducts || [];
    
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm)) ||
      (p.category && p.category.toLowerCase().includes(searchTerm))
    );
    
    renderProductsList(filtered);
  };
}