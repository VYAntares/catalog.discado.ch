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

  // Set default payment date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('paymentDate').value = today;

  document.getElementById('orderNotes').value = order.notes || '';

  // Load payments history and update summaries
  loadPayments();
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
        <p>Quantité: ${item.quantity} × ${unitPrice} USD = <strong>${totalPrice}</strong></p>
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

  // Sauvegarde des paiements
  const saveBtn = document.getElementById('saveAmountsBtn');
  saveBtn.removeEventListener('click', handleSavePayment);
  saveBtn.addEventListener('click', handleSavePayment);

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
 * Gère l'ajout d'un paiement
 */
async function handleSavePayment() {
  const orderId = State.getCurrentOrderId();
  const amountUsd = parseFloat(document.getElementById('paymentAmountUsd').value) || 0;
  const amountChf = parseFloat(document.getElementById('paymentAmountChf').value) || 0;
  const paymentDate = document.getElementById('paymentDate').value;

  if (!amountUsd && !amountChf) {
    alert('Veuillez entrer un montant USD ou CHF');
    return;
  }
  if (!paymentDate) {
    alert('Veuillez sélectionner une date de paiement');
    return;
  }

  try {
    await API.addSupplierOrderPayment(orderId, amountUsd, amountChf, paymentDate);

    // Reset input fields
    document.getElementById('paymentAmountUsd').value = '';
    document.getElementById('paymentAmountChf').value = '';

    // Reload payments and order data
    await loadPayments();
  } catch (error) {
    console.error('Erreur ajout paiement:', error);
  }
}

/**
 * Charge et affiche l'historique des paiements
 */
async function loadPayments() {
  const orderId = State.getCurrentOrderId();

  try {
    const payments = await API.getSupplierOrderPayments(orderId);
    const totalAmount = parseFloat(document.getElementById('orderTotalAmount').value) || 0;

    // Calculate totals from payments
    let totalPaidUsd = 0;
    let totalPaidChf = 0;
    payments.forEach(p => {
      totalPaidUsd += p.amount_usd || 0;
      totalPaidChf += p.amount_chf || 0;
    });

    // Update summary fields
    document.getElementById('orderTotalPaidUsd').value = totalPaidUsd.toFixed(2);
    document.getElementById('orderTotalPaidChf').value = totalPaidChf.toFixed(2);
    document.getElementById('orderRemaining').value = (totalAmount - totalPaidUsd).toFixed(2);

    // Render payments table
    renderPaymentsTable(payments);
  } catch (error) {
    console.error('Erreur chargement paiements:', error);
  }
}

/**
 * Affiche le tableau d'historique des paiements
 */
function renderPaymentsTable(payments) {
  const container = document.getElementById('paymentsHistoryContainer');

  if (!payments || payments.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = payments.map(p => `
    <tr>
      <td>${Utils.formatDate(p.payment_date)}</td>
      <td>${(p.amount_usd || 0).toFixed(2)} USD</td>
      <td>${(p.amount_chf || 0).toFixed(2)} CHF</td>
      <td>
        <button class="btn btn-danger btn-sm delete-payment-btn" data-payment-id="${p.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <h4 style="margin: 24px 0 12px 0; color: #4a5568;">Historique des paiements</h4>
    <table class="payments-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Montant USD</th>
          <th>Montant CHF</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // Attach delete listeners
  container.querySelectorAll('.delete-payment-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeletePayment(btn.dataset.paymentId));
  });
}

/**
 * Supprime un paiement
 */
async function handleDeletePayment(paymentId) {
  if (!confirm('Supprimer ce paiement ?')) return;

  const orderId = State.getCurrentOrderId();

  try {
    await API.deleteSupplierOrderPayment(orderId, paymentId);
    await loadPayments();
  } catch (error) {
    console.error('Erreur suppression paiement:', error);
  }
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
 * Charge TOUS les produits du catalogue
 */
async function loadSupplierProducts(supplierId) {
  const container = document.getElementById('productsListContainer');
  
  try {
    // Récupérer tous les produits
    const response = await fetch('/api/products/stock');
    const allProducts = await response.json();
    
    console.log('📦 Total produits chargés:', allProducts.length);
    
    if (allProducts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          <p>Aucun produit trouvé</p>
        </div>
      `;
      return;
    }
    
    // Stocker tous les produits
    window.currentSupplierProducts = allProducts;
    
    // Remplir les filtres
    populateFilters(allProducts);
    
    // Afficher les produits (limiter à 50 par défaut)
    applyFilters();
    
  } catch (error) {
    console.error('Erreur chargement produits:', error);
    container.innerHTML = '<p style="text-align: center; color: #f56565;">Erreur de chargement</p>';
  }
}

/**
 * Remplit les filtres fournisseur et catégorie
 */
function populateFilters(products) {
  // Extraire les fournisseurs uniques
  const suppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))].sort();
  const supplierSelect = document.getElementById('filterSupplierSelect');
  supplierSelect.innerHTML = '<option value="">Tous les fournisseurs</option>' +
    suppliers.map(s => `<option value="${s}">${s}</option>`).join('');
  
  // Extraire les catégories uniques
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const categorySelect = document.getElementById('filterCategorySelect');
  categorySelect.innerHTML = '<option value="">Toutes les catégories</option>' +
    categories.map(c => `<option value="${c}">${formatCategoryName(c)}</option>`).join('');
}

/**
 * Formate le nom de catégorie
 */
function formatCategoryName(category) {
  const names = {
    'tshirt': 'T-Shirts',
    'caps': 'Casquettes',
    'bags': 'Sacs',
    'keyring': 'Porte-clés',
    'pens': 'Stylos',
    'lifestyle': 'Lifestyle',
    'gadget': 'Gadgets',
    'patches': 'Patches',
    'cloths': 'Textiles',
    'lighter': 'Briquets',
    'magnet': 'Aimants',
    'bells': 'Clochettes',
    'plates': 'Plaques',
    'softtoy': 'Peluches',
    'hats': 'Chapeaux',
    'farceattrape': 'Farces & Attrapes'
  };
  return names[category] || category;
}

/**
 * Applique tous les filtres
 */
function applyFilters() {
  const products = window.currentSupplierProducts || [];
  const searchTerm = document.getElementById('searchProductInput').value.toLowerCase().trim();
  const selectedSupplier = document.getElementById('filterSupplierSelect').value;
  const selectedCategory = document.getElementById('filterCategorySelect').value;
  
  let filtered = products;
  
  // Filtre par recherche
  if (searchTerm) {
    filtered = filtered.filter(p => {
      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const category = (p.category || '').toLowerCase();
      const supplier = (p.supplier || '').toLowerCase();
      const numberMatch = p.name.match(/\d+/g);
      const numbers = numberMatch ? numberMatch.join(' ') : '';
      
      return name.includes(searchTerm) ||
             barcode.includes(searchTerm) ||
             category.includes(searchTerm) ||
             supplier.includes(searchTerm) ||
             numbers.includes(searchTerm);
    });
  }
  
  // Filtre par fournisseur
  if (selectedSupplier) {
    filtered = filtered.filter(p => p.supplier === selectedSupplier);
  }
  
  // Filtre par catégorie
  if (selectedCategory) {
    filtered = filtered.filter(p => p.category === selectedCategory);
  }
  
  console.log(`🔍 Filtres appliqués: ${filtered.length} résultats`);
  
  // Limiter à 100 résultats pour la performance
  renderProductsList(filtered.slice(0, 100));
  
  // Message si trop de résultats
  const container = document.getElementById('productsListContainer');
  if (filtered.length > 100) {
    container.insertAdjacentHTML('afterbegin', `
      <div style="background: #fff3e0; padding: 12px; border-radius: 6px; margin-bottom: 16px; text-align: center; color: #f57c00;">
        <i class="fas fa-info-circle"></i> <strong>${filtered.length} produits trouvés</strong> - Affichage limité à 100. Affinez votre recherche.
      </div>
    `);
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
      <div style="position: relative; width: 80px; height: 80px;">
        <img src="${product.image_url || ''}" 
             alt="${product.name}" 
             class="product-list-image"
             style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; background: #f7fafc; border: 1px solid #e2e8f0;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div style="display: none; width: 80px; height: 80px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; align-items: center; justify-content: center;">
          <i class="fas fa-image" style="color: #cbd5e0; font-size: 24px;"></i>
        </div>
      </div>
      
      <div class="product-list-info">
        <h4>${product.name}</h4>
        <p><i class="fas fa-tag"></i> ${product.category || 'Autre'}</p>
        <p><i class="fas fa-barcode"></i> ${product.barcode || 'N/A'}</p>
        ${product.origin_price > 0 ? `<p style="color: #718096; font-size: 12px;">Prix d'origine: ${product.origin_price.toFixed(2)} USD</p>` : ''}
      </div>
      
      <div class="product-list-price">
        ${(product.origin_price || 0).toFixed(2)} USD
      </div>
      
      <div class="product-list-actions">
        <input type="number" 
               class="item-quantity-input" 
               value="50" 
               min="1"
               placeholder="Qté"
               data-product-id="${product.id}"
               onfocus="this.select()">
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
  attachQuantityInputListeners();
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
  const supplierSelect = document.getElementById('filterSupplierSelect');
  const categorySelect = document.getElementById('filterCategorySelect');
  
  // Fermeture
  closeBtn.onclick = () => {
    document.getElementById('addItemToOrderModal').style.display = 'none';
  };
  
  // Recherche en temps réel
  let searchTimeout;
  searchInput.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => applyFilters(), 300);
  };
  
  // Filtres
  supplierSelect.onchange = () => applyFilters();
  categorySelect.onchange = () => applyFilters();
  
  // Focus automatique sur la recherche
  searchInput.focus();
}