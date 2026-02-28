/**
 * Vue détails d'une commande fournisseur
 * admin/js/modules/suppliers/orderDetails.js
 */

import * as API from '../../core/api.js';
import * as State from './state.js';
import * as Utils from './utils.js';
import * as SupplierDetails from './supplierDetails.js';
import * as BatchManager from './batchManager.js';
// downloadOrShareFile is loaded globally from inline <script> in HTML page

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
    await loadAttachments();
    await BatchManager.initBatchView(orderId);
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
  const totalAmountEl = document.getElementById('orderTotalAmount');
  totalAmountEl.value = Utils.formatSwissNumber(order.total_amount || 0);
  totalAmountEl.dataset.raw = order.total_amount || 0;

  // Set default payment date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('paymentDate').value = today;

  document.getElementById('orderNotes').value = order.notes || '';

  // Set default transport date to today
  document.getElementById('transportDate').value = today;

  // Load payments history and update summaries
  loadPayments();
  loadTransportCosts();
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
  const unitPriceFormatted = Utils.formatSwissNumber(item.unit_price || 0);

  return `
    <div class="item-card" data-item-id="${item.id}">
      <img src="${imageUrl}"
           alt="${item.product_name}"
           class="item-image"
           onerror="this.src='/images/placeholder.png'">
      <div class="item-details">
        <h4>${item.product_name}</h4>
        <p>Catégorie: ${category}</p>
        <div class="item-display" data-item-id="${item.id}">
          <p>Quantité: ${item.quantity} × ${unitPriceFormatted} USD = <strong>${totalPrice}</strong></p>
        </div>
        <div class="item-edit" data-item-id="${item.id}" style="display:none;">
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <label style="font-size:13px;">Qté:
              <input type="number" class="edit-quantity" value="${item.quantity}" min="1" style="width:70px; padding:4px 6px; border:1px solid #cbd5e0; border-radius:4px;">
            </label>
            <label style="font-size:13px;">Prix unit. (USD):
              <input type="number" class="edit-price" value="${unitPrice}" min="0" step="0.01" style="width:90px; padding:4px 6px; border:1px solid #cbd5e0; border-radius:4px;">
            </label>
            <button class="btn btn-primary btn-sm save-edit-btn" data-item-id="${item.id}">Enregistrer</button>
            <button class="btn btn-sm cancel-edit-btn" data-item-id="${item.id}" style="background:#e2e8f0; color:#4a5568;">Annuler</button>
          </div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm edit-item-btn" data-item-id="${item.id}" style="background:#edf2f7; color:#4a5568; margin-bottom:4px;">Modifier</button>
        <button class="btn btn-danger btn-sm delete-item-btn" data-item-id="${item.id}">Supprimer</button>
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

  // Sauvegarde des frais de transport
  const saveTransportBtn = document.getElementById('saveTransportBtn');
  if (saveTransportBtn) {
    saveTransportBtn.removeEventListener('click', handleSaveTransport);
    saveTransportBtn.addEventListener('click', handleSaveTransport);
  }

  // Suppression commande
  const deleteBtn = document.getElementById('deleteOrderBtn');
  deleteBtn.removeEventListener('click', handleDeleteOrder);
  deleteBtn.addEventListener('click', handleDeleteOrder);

  // Sauvegarde des notes (debounce)
  const notesField = document.getElementById('orderNotes');
  notesField.removeEventListener('input', handleNotesInput);
  notesField.addEventListener('input', handleNotesInput);

  // Export PDF
  const exportPdfBtn = document.getElementById('exportOrderPdfBtn');
  if (exportPdfBtn) {
    exportPdfBtn.onclick = async () => {
      const orderId = State.getCurrentOrderId();
      try {
        await window.downloadOrShareFile(
          `/api/order-suppliers/${orderId}/export-pdf`,
          `Commande_${orderId}.pdf`
        );
      } catch (err) {
        console.error('Erreur export PDF:', err);
      }
    };
  }

  // Upload pièce jointe
  const uploadBtn = document.getElementById('uploadAttachmentBtn');
  const attachmentInput = document.getElementById('attachmentInput');
  if (uploadBtn) {
    uploadBtn.removeEventListener('click', handleUploadClick);
    uploadBtn.addEventListener('click', handleUploadClick);
  }
  if (attachmentInput) {
    attachmentInput.removeEventListener('change', handleAttachmentChange);
    attachmentInput.addEventListener('change', handleAttachmentChange);
  }

  // Boutons pièces jointes
  document.querySelectorAll('.rename-attachment-btn').forEach(btn => {
    btn.addEventListener('click', handleRenameAttachment);
  });
  document.querySelectorAll('.delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteAttachment);
  });
  document.querySelectorAll('.view-attachment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await window.downloadOrShareFile(btn.dataset.url, btn.dataset.filename);
      } catch (err) {
        console.error('Erreur ouverture pièce jointe:', err);
      }
    });
  });

  // Boutons items
  document.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteItem);
  });
  document.querySelectorAll('.edit-item-btn').forEach(btn => {
    btn.addEventListener('click', handleEditItem);
  });
  document.querySelectorAll('.save-edit-btn').forEach(btn => {
    btn.addEventListener('click', handleSaveItem);
  });
  document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
    btn.addEventListener('click', handleCancelEdit);
  });
}

/**
 * Gère la saisie des notes avec debounce
 */
let notesTimeout;
function handleNotesInput() {
  clearTimeout(notesTimeout);
  notesTimeout = setTimeout(() => saveNotes(), 800);
}

async function saveNotes() {
  const orderId = State.getCurrentOrderId();
  const notes = document.getElementById('orderNotes').value;

  try {
    await API.updateSupplierOrderNotes(orderId, notes);
  } catch (error) {
    console.error('Erreur sauvegarde notes:', error);
  }
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
    const totalAmount = parseFloat(document.getElementById('orderTotalAmount').dataset.raw) || 0;

    // Calculate totals from payments
    let totalPaidUsd = 0;
    let totalPaidChf = 0;
    payments.forEach(p => {
      totalPaidUsd += p.amount_usd || 0;
      totalPaidChf += p.amount_chf || 0;
    });

    // Update summary fields
    document.getElementById('orderTotalPaidUsd').value = Utils.formatSwissNumber(totalPaidUsd);
    document.getElementById('orderTotalPaidChf').value = Utils.formatSwissNumber(totalPaidChf);
    document.getElementById('orderRemaining').value = Utils.formatSwissNumber(totalAmount - totalPaidUsd);

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
      <td>${Utils.formatSwissNumber(p.amount_usd || 0)} USD</td>
      <td>${Utils.formatSwissNumber(p.amount_chf || 0)} CHF</td>
      <td>
        <button class="btn btn-danger btn-sm delete-payment-btn" data-payment-id="${p.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <h4 style="margin: 24px 0 12px 0; color: #4a5568;">Historique des paiements</h4>
    <div class="table-scroll">
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
    </div>
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

// ===== FRAIS DE TRANSPORT =====

/**
 * Gère l'ajout d'un frais de transport
 */
async function handleSaveTransport() {
  const orderId = State.getCurrentOrderId();
  const amountChf = parseFloat(document.getElementById('transportAmountChf').value) || 0;
  const transportDate = document.getElementById('transportDate').value;

  if (!amountChf || amountChf <= 0) {
    alert('Veuillez entrer un montant CHF valide');
    return;
  }
  if (!transportDate) {
    alert('Veuillez sélectionner une date');
    return;
  }

  try {
    await API.addSupplierOrderTransport(orderId, amountChf, transportDate);
    document.getElementById('transportAmountChf').value = '';
    await loadTransportCosts();
  } catch (error) {
    console.error('Erreur ajout frais de transport:', error);
  }
}

/**
 * Charge et affiche les frais de transport
 */
async function loadTransportCosts() {
  const orderId = State.getCurrentOrderId();

  try {
    const transports = await API.getSupplierOrderTransport(orderId);
    renderTransportTable(transports);
  } catch (error) {
    console.error('Erreur chargement frais de transport:', error);
  }
}

/**
 * Affiche le tableau des frais de transport
 */
function renderTransportTable(transports) {
  const container = document.getElementById('transportHistoryContainer');

  if (!transports || transports.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = transports.map(t => `
    <tr>
      <td>${Utils.formatDate(t.transport_date)}</td>
      <td>${Utils.formatSwissNumber(t.amount_chf || 0)} CHF</td>
      <td>
        <button class="btn btn-danger btn-sm delete-transport-btn" data-transport-id="${t.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <h4 style="margin: 24px 0 12px 0; color: #4a5568;">Historique des frais de transport</h4>
    <div class="table-scroll">
      <table class="payments-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Montant CHF</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.delete-transport-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteTransport(btn.dataset.transportId));
  });
}

/**
 * Supprime un frais de transport
 */
async function handleDeleteTransport(transportId) {
  if (!confirm('Supprimer ce frais de transport ?')) return;

  const orderId = State.getCurrentOrderId();

  try {
    await API.deleteSupplierOrderTransport(orderId, transportId);
    await loadTransportCosts();
  } catch (error) {
    console.error('Erreur suppression frais de transport:', error);
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
 * Affiche les champs d'édition d'un item
 */
function handleEditItem(event) {
  const itemId = event.currentTarget.dataset.itemId;
  document.querySelector(`.item-display[data-item-id="${itemId}"]`).style.display = 'none';
  document.querySelector(`.item-edit[data-item-id="${itemId}"]`).style.display = 'block';
  event.currentTarget.style.display = 'none';
}

/**
 * Annule l'édition d'un item
 */
function handleCancelEdit(event) {
  const itemId = event.currentTarget.dataset.itemId;
  document.querySelector(`.item-display[data-item-id="${itemId}"]`).style.display = '';
  document.querySelector(`.item-edit[data-item-id="${itemId}"]`).style.display = 'none';
  document.querySelector(`.edit-item-btn[data-item-id="${itemId}"]`).style.display = '';
}

/**
 * Sauvegarde les modifications d'un item
 */
async function handleSaveItem(event) {
  const itemId = event.currentTarget.dataset.itemId;
  const card = document.querySelector(`.item-card[data-item-id="${itemId}"]`);
  const quantity = parseInt(card.querySelector('.edit-quantity').value);
  const unitPrice = parseFloat(card.querySelector('.edit-price').value);

  if (!quantity || quantity < 1 || isNaN(unitPrice)) {
    alert('Veuillez entrer une quantité et un prix valides');
    return;
  }

  const orderId = State.getCurrentOrderId();

  try {
    await API.updateSupplierOrderItem(itemId, unitPrice, quantity);
    await show(orderId);
  } catch (error) {
    console.error('Erreur modification item:', error);
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

// ===== PIÈCES JOINTES =====

/**
 * Charge et affiche les pièces jointes
 */
async function loadAttachments() {
  const orderId = State.getCurrentOrderId();
  const container = document.getElementById('orderAttachmentsList');

  try {
    const attachments = await API.fetchOrderAttachments(orderId);
    renderAttachmentsList(attachments, container);
  } catch (error) {
    console.error('Erreur chargement pièces jointes:', error);
  }
}

/**
 * Affiche la liste des pièces jointes
 */
function renderAttachmentsList(attachments, container) {
  if (!attachments || attachments.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #a0aec0; font-size: 13px;">Aucune pièce jointe.</p>';
    return;
  }

  container.innerHTML = attachments.map(att => {
    const icon = att.file_type === 'pdf' ? 'fa-file-pdf' : 'fa-file-csv';
    const iconColor = att.file_type === 'pdf' ? '#e53e3e' : '#38a169';
    const sizeKB = (att.file_size / 1024).toFixed(1);
    const date = Utils.formatDate(att.created_at);

    return `
      <div class="attachment-item" data-attachment-id="${att.id}">
        <div class="attachment-info">
          <i class="fas ${icon}" style="color: ${iconColor}; font-size: 20px;"></i>
          <div>
            <span class="attachment-name">${att.original_name}</span>
            <span class="attachment-meta">${sizeKB} KB - ${date}</span>
          </div>
        </div>
        <div class="attachment-actions">
          <button class="btn btn-sm view-attachment-btn"
             data-url="/api/order-suppliers/${State.getCurrentOrderId()}/attachments/${att.id}/download"
             data-filename="${att.original_name}"
             style="background:#edf2f7; color:#4a5568;">
            <i class="fas fa-eye"></i> Voir
          </button>
          <button class="btn btn-sm rename-attachment-btn" data-attachment-id="${att.id}" data-attachment-name="${att.original_name}" style="background:#edf2f7; color:#4a5568;">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-sm delete-attachment-btn" data-attachment-id="${att.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Ouvre le sélecteur de fichier
 */
function handleUploadClick() {
  document.getElementById('attachmentInput').click();
}

/**
 * Gère l'upload après sélection du fichier
 */
async function handleAttachmentChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  const orderId = State.getCurrentOrderId();

  try {
    await API.uploadOrderAttachment(orderId, file);
    await loadAttachments();
    attachEventListeners();
  } catch (error) {
    console.error('Erreur upload pièce jointe:', error);
  }

  // Reset l'input pour permettre de re-sélectionner le même fichier
  event.target.value = '';
}

/**
 * Gère le renommage d'une pièce jointe
 */
async function handleRenameAttachment(event) {
  const btn = event.currentTarget;
  const attachmentId = btn.dataset.attachmentId;
  const currentName = btn.dataset.attachmentName;

  const newName = prompt('Nouveau nom :', currentName);
  if (!newName || newName.trim() === '' || newName === currentName) return;

  const orderId = State.getCurrentOrderId();

  try {
    await API.renameOrderAttachment(orderId, attachmentId, newName.trim());
    await loadAttachments();
    attachEventListeners();
  } catch (error) {
    console.error('Erreur renommage pièce jointe:', error);
  }
}

/**
 * Gère la suppression d'une pièce jointe
 */
async function handleDeleteAttachment(event) {
  if (!confirm('Supprimer cette pièce jointe ?')) return;

  const attachmentId = event.currentTarget.dataset.attachmentId;
  const orderId = State.getCurrentOrderId();

  try {
    await API.deleteOrderAttachment(orderId, attachmentId);
    await loadAttachments();
    attachEventListeners();
  } catch (error) {
    console.error('Erreur suppression pièce jointe:', error);
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
        ${product.origin_price > 0 ? `<p style="color: #718096; font-size: 12px;">Prix d'origine: ${Utils.formatSwissNumber(product.origin_price)} USD</p>` : ''}
      </div>

      <div class="product-list-price">
        ${Utils.formatSwissNumber(product.origin_price || 0)} USD
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

      // La modale reste ouverte pour permettre l'ajout de plusieurs produits
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