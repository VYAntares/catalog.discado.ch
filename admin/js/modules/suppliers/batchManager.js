/**
 * Module de gestion des BATCH
 * admin/js/modules/suppliers/batchManager.js
 */

import * as API from '../../core/api.js';
import * as State from './state.js';
import * as Utils from './utils.js';
import '../suppliers/productStatsModal.js?v=9';

// État local pour les batch
let currentBatches = [];
let currentBatchFilter = 'all'; // 'all' ou numéro de batch
let currentVisibleBatch = 0;
let currentView = 'list'; // 'list' ou 'grid'

/**
 * Initialise la vue batch dans la page orderDetails
 * @param {boolean} resetPosition - Si true, revient à "Tous les batch" (défaut: true)
 */
export async function initBatchView(orderId, resetPosition = true) {
  try {
    // Sauvegarder la position de scroll et le batch actuel avant re-rendu
    const savedBatch = currentVisibleBatch;
    const savedView = currentView;
    const scrollY = window.scrollY;

    // Charger les stats des batch
    const batchStats = await API.getSupplierOrderBatchStats(orderId);
    currentBatches = batchStats.batches || [];

    // Afficher la section batch
    renderBatchSection(orderId, batchStats);

    if (resetPosition) {
      // Premier chargement : initialiser sur "Tous les batch"
      currentVisibleBatch = 0;
      navigateToBatch(0);
    } else {
      // Restaurer la position précédente
      currentView = savedView;
      const targetBatch = savedBatch <= currentBatches.length ? savedBatch : 0;
      currentVisibleBatch = targetBatch;
      navigateToBatch(targetBatch);
      // Restaurer le scroll après re-rendu
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }

    // Initialiser les event listeners
    initBatchEventListeners(orderId);
    // Attacher les listeners des boutons items
    reattachBatchItemListeners();
  } catch (error) {
    console.error('Erreur initialisation batch:', error);
  }
}

/**
 * Affiche la section de gestion des batch
 */
function renderBatchSection(orderId, batchStats) {
  const container = document.getElementById('orderItemsList');
  
  // Créer la toolbar batch
  const toolbar = createBatchToolbar(batchStats);
  
  // Créer les conteneurs de batch
  const batchContainers = createBatchContainers(orderId, batchStats);
  
  // Injecter dans le DOM
  container.innerHTML = `
    ${toolbar}
    <div id="batchContainersWrapper">
      ${batchContainers}
    </div>
  `;
}

/**
 * Crée la barre d'outils batch
 */
function createBatchToolbar(batchStats) {
  const batchCount = batchStats.batch_count || 1;
  
  return `
    <div class="batch-toolbar">
      <div class="batch-toolbar-left">
        <h3>
          <i class="fas fa-boxes"></i> 
          Gestion des Batch 
          <span class="batch-count-badge">${batchCount} batch${batchCount > 1 ? 'es' : ''}</span>
        </h3>
      </div>
      
      <div class="batch-toolbar-right">
        <div style="background: rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 8px; color: white; font-weight: 600;">
          <span id="batchPositionIndicator">Tous les batch</span>
        </div>
        
        <div class="batch-nav-arrows" style="display: flex; gap: 8px;">
          <button id="prevBatchBtn" class="batch-btn" style="padding: 10px 16px;">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button id="nextBatchBtn" class="batch-btn" style="padding: 10px 16px;">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        
        <button id="toggleViewBtn" class="batch-btn" style="padding: 10px 16px;" title="Changer de vue">
          <i class="fas fa-th"></i>
        </button>
        
        <button id="createNewBatchBtn" class="batch-btn batch-btn-primary">
          <i class="fas fa-plus"></i> Nouveau Batch
        </button>
      </div>
    </div>
  `;
}

/**
 * Crée les conteneurs de batch
 */
function createBatchContainers(orderId, batchStats) {
  if (!batchStats.batches || batchStats.batches.length === 0) {
    return '<p style="text-align: center; color: #7f8c8d; padding: 40px;">Aucun batch trouvé</p>';
  }
  
  return batchStats.batches.map(batch => createBatchContainer(orderId, batch)).join('');
}

/**
 * Crée un conteneur de batch
 */
function createBatchContainer(orderId, batch) {
  const items = State.getCurrentOrderItems().filter(item => item.batch_number === batch.batch_number);
  
  const isEmpty = items.length === 0;
  const deleteBtn = isEmpty ? `
    <button class="batch-delete-btn" data-batch="${batch.batch_number}" title="Supprimer ce batch vide">
      <i class="fas fa-trash"></i>
    </button>
  ` : '';
  
  return `
    <div class="batch-container ${isEmpty ? 'batch-empty' : ''}" 
         data-batch-number="${batch.batch_number}"
         ${!isEmpty ? 'data-batch-id="batch-' + batch.batch_number + '"' : ''}>
      
      <div class="batch-header">
        <h4>
          <i class="fas fa-box"></i> 
          BATCH ${batch.batch_number}
        </h4>
        ${deleteBtn}
      </div>
      
      <div class="batch-items-container" 
	  		data-batch-number="${batch.batch_number}">
        ${isEmpty ? createEmptyBatchZone(batch.batch_number) : createBatchItems(items, batch.batch_number)}
      </div>
      
      <div class="batch-footer">
        <div class="batch-stats">
          <span><strong>${batch.item_count}</strong> article${batch.item_count > 1 ? 's' : ''}</span>
          <span><strong>${batch.total_quantity}</strong> unités</span>
          <span><strong>${Utils.formatAmount(batch.total_amount)}</strong> USD</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Crée la zone vide d'un batch
 */
function createEmptyBatchZone(batchNumber) {
	return `
	  <div class="empty-batch-message">
		<i class="fas fa-box-open" style="font-size: 48px; color: #cbd5e0; margin-bottom: 12px;"></i>
		<p style="color: #718096; margin: 0;">Batch vide</p>
		<p style="color: #a0aec0; font-size: 13px; margin-top: 4px;">
		  Utilisez le bouton <i class="fas fa-arrows-alt"></i> pour déplacer des articles ici
		</p>
	  </div>
	`;
  }

/**
 * Crée les cartes des articles d'un batch
 */
function createBatchItems(items, batchNumber) {
  return items.map(item => createBatchItemCard(item, batchNumber)).join('');
}

/**
 * Crée une carte d'article 
 */
function createBatchItemCard(item, batchNumber) {
	const imageUrl = item.image_url || '/images/placeholder.png';
	const itemStatus = item.item_status || 'commandé';
	const isLivre = itemStatus === 'livré';

	return `
	  <div class="batch-item-card"
		   data-item-id="${item.id}"
		   data-batch-number="${batchNumber}">

      <img src="${imageUrl}" alt="${item.product_name}" class="batch-item-image">

      <div class="batch-item-info">
        <!-- Header avec titre + icône stats -->
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px; margin-bottom: 8px;">
          <h5 style="flex: 1; margin: 0;">${item.product_name}</h5>
          <button class="product-stats-btn"
                  data-product-name="${item.product_name}"
                  title="Voir les statistiques"
                  style="background: none; border: none; color: #4299e1; cursor: pointer; padding: 4px; font-size: 16px; line-height: 1; flex-shrink: 0; transition: all 0.2s ease;">
            <i class="fas fa-question-circle"></i>
          </button>
        </div>

        <p class="batch-item-details">
          <span class="quantity-badge">${item.quantity} unités</span>
          <span class="price-tag">${Utils.formatSwissNumber(item.unit_price)} USD/u</span>
        </p>
        <p class="batch-item-total">
          Total: <strong>${Utils.formatSwissNumber(item.quantity * item.unit_price)} USD</strong>
        </p>
        <div style="margin-top: 6px;">
          <select class="item-status-select" data-item-id="${item.id}"
                  style="padding: 3px 8px; border-radius: 12px; border: 1px solid ${isLivre ? '#48bb78' : '#ed8936'};
                         background: ${isLivre ? '#f0fff4' : '#fffaf0'}; color: ${isLivre ? '#276749' : '#9c4221'};
                         font-size: 12px; font-weight: 600; cursor: pointer; outline: none;">
            <option value="commandé" ${!isLivre ? 'selected' : ''}>Commandé</option>
            <option value="livré" ${isLivre ? 'selected' : ''}>Livré</option>
          </select>
        </div>
      </div>
      
      <div class="batch-item-actions">
        <button class="batch-item-action-btn" data-action="move" data-item-id="${item.id}" title="Déplacer">
          <i class="fas fa-arrows-alt"></i>
        </button>
        <button class="btn btn-sm edit-item-btn" data-item-id="${item.id}" title="Modifier" style="background:#edf2f7; color:#4a5568;">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-danger btn-sm delete-item-btn" data-item-id="${item.id}" title="Supprimer">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Initialise les event listeners des batch
 */
function initBatchEventListeners(orderId) {
  
  // Bouton créer nouveau batch
  const createBatchBtn = document.getElementById('createNewBatchBtn');
  if (createBatchBtn) {
    createBatchBtn.addEventListener('click', () => handleCreateNewBatch(orderId));
  }
  
  // Boutons supprimer batch vide
  document.querySelectorAll('.batch-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const batchNumber = e.currentTarget.dataset.batch;
      handleDeleteEmptyBatch(orderId, batchNumber);
    });
  });
  
  // Actions sur les items
  document.querySelectorAll('.batch-item-action-btn').forEach(btn => {
    btn.addEventListener('click', handleItemAction);
  });

  // Navigation flèches
const prevBtn = document.getElementById('prevBatchBtn');
const nextBtn = document.getElementById('nextBatchBtn');

if (prevBtn) {
	prevBtn.addEventListener('click', () => {
	  if (currentVisibleBatch > 0) {
		currentVisibleBatch--;
		navigateToBatch(currentVisibleBatch);
	  }
	});
  }
  
  if (nextBtn) {
	nextBtn.addEventListener('click', () => {
	  const maxBatch = currentBatches.length;
	  if (currentVisibleBatch < maxBatch) {
		currentVisibleBatch++;
		navigateToBatch(currentVisibleBatch);
	  }
	});
  }
    // Toggle vue liste/grille
  const toggleViewBtn = document.getElementById('toggleViewBtn');
  if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
      currentView = currentView === 'list' ? 'grid' : 'list';
      toggleViewBtn.querySelector('i').className = currentView === 'list' ? 'fas fa-th' : 'fas fa-list';
      applyCurrentView();
    });
  }
}

function applyCurrentView() {
  const wrapper = document.getElementById('batchContainersWrapper');
  
  if (currentView === 'grid') {
    wrapper.classList.add('batch-grid-view');
    wrapper.classList.remove('batch-list-view');
  } else {
    wrapper.classList.add('batch-list-view');
    wrapper.classList.remove('batch-grid-view');
  }
}

function navigateToBatch(batchNumber) {
	currentVisibleBatch = batchNumber;
	
	// Mettre à jour l'indicateur
	const indicator = document.getElementById('batchPositionIndicator');
	if (indicator) {
	  if (batchNumber === 0) {
		indicator.textContent = 'Tous les batch';
	  } else {
		indicator.textContent = `Batch ${batchNumber}`;
	  }
	}
	
	// Afficher le batch correspondant
	if (batchNumber === 0) {
	  showAllBatchesMerged();
	} else {
	  showSingleBatchOnly(batchNumber);
	}
    reattachBatchItemListeners();
    applyCurrentView();
}

function reattachBatchItemListeners() {
  // Bouton déplacer
  document.querySelectorAll('.batch-item-action-btn').forEach(btn => {
    btn.addEventListener('click', handleItemAction);
  });
  
  // Réattacher les event listeners d'origine pour edit/delete
  const orderId = State.getCurrentOrderId();
  
  document.querySelectorAll('.edit-item-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const itemId = e.currentTarget.dataset.itemId;
      const itemCard = document.querySelector(`.batch-item-card[data-item-id="${itemId}"]`);
      
      // Cacher l'affichage normal, montrer l'édition
      const itemInfo = itemCard.querySelector('.batch-item-info');
      const currentItem = State.getCurrentOrderItems().find(i => i.id == itemId);
      itemInfo.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <label style="font-size:13px; flex-basis:100%;">Nom:
            <input type="text" class="edit-name-${itemId}" value="${currentItem.product_name}" style="width:100%; padding:4px 6px; border:1px solid #cbd5e0; border-radius:4px;">
          </label>
          <label style="font-size:13px;">Qté:
            <input type="number" class="edit-quantity-${itemId}" value="${currentItem.quantity}" min="1" style="width:70px; padding:4px 6px; border:1px solid #cbd5e0; border-radius:4px;">
          </label>
          <label style="font-size:13px;">Prix unit. (USD):
            <input type="number" class="edit-price-${itemId}" value="${currentItem.unit_price}" min="0" step="0.01" style="width:90px; padding:4px 6px; border:1px solid #cbd5e0; border-radius:4px;">
          </label>
          <button class="btn btn-primary btn-sm save-edit-${itemId}">Enregistrer</button>
          <button class="btn btn-sm cancel-edit-${itemId}" style="background:#e2e8f0; color:#4a5568;">Annuler</button>
        </div>
      `;
      
      // Listeners pour save/cancel
      document.querySelector(`.save-edit-${itemId}`).onclick = async () => {
        const productName = document.querySelector(`.edit-name-${itemId}`).value.trim();
        const quantity = parseInt(document.querySelector(`.edit-quantity-${itemId}`).value);
        const unitPrice = parseFloat(document.querySelector(`.edit-price-${itemId}`).value);

        if (!productName) {
          alert('Le nom du produit ne peut pas être vide');
          return;
        }

        try {
          await API.updateSupplierOrderItem(itemId, { product_name: productName, quantity, unit_price: unitPrice });
          const items = await API.fetchSupplierOrderItems(orderId);
          State.setCurrentOrderItems(items);
          await initBatchView(orderId, false);
        } catch (error) {
          console.error('Erreur:', error);
        }
      };

      document.querySelector(`.cancel-edit-${itemId}`).onclick = async () => {
        await initBatchView(orderId, false);
      };
    });
  });
  
  document.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
      if (!confirm('Supprimer cet article ?')) return;
      
      const itemId = e.currentTarget.dataset.itemId;
      
      try {
        await API.deleteSupplierOrderItem(itemId);
        const items = await API.fetchSupplierOrderItems(orderId);
        State.setCurrentOrderItems(items);
        await initBatchView(orderId, false);
      } catch (error) {
        console.error('Erreur:', error);
      }
    });
  });
   // Event listeners pour le changement de statut item
   document.querySelectorAll('.item-status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const itemId = e.target.dataset.itemId;
      const newStatus = e.target.value;

      try {
        await API.updateSupplierOrderItemStatus(itemId, newStatus);
        // Mettre à jour le style du select
        const isLivre = newStatus === 'livré';
        e.target.style.borderColor = isLivre ? '#48bb78' : '#ed8936';
        e.target.style.background = isLivre ? '#f0fff4' : '#fffaf0';
        e.target.style.color = isLivre ? '#276749' : '#9c4221';
        // Mettre à jour l'item dans le state
        const items = State.getCurrentOrderItems();
        const item = items.find(i => i.id == itemId);
        if (item) item.item_status = newStatus;
      } catch (error) {
        console.error('Erreur mise à jour statut item:', error);
      }
    });
  });

   // Event listeners pour les boutons de stats
   document.querySelectorAll('.product-stats-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Empêcher la propagation de l'événement
      const productName = btn.getAttribute('data-product-name');
      if (window.ProductStatsModal) {
        window.ProductStatsModal.open(productName);
      } else {
        console.error('ProductStatsModal not loaded');
      }
    });
  });
}

  function showSingleBatchOnly(batchNumber) {
	const container = document.getElementById('batchContainersWrapper');
	const orderId = State.getCurrentOrderId();
	
	// Trouver les stats du batch
	const batchStat = currentBatches.find(b => b.batch_number === batchNumber);
	
	if (!batchStat) {
	  container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 40px;">Batch introuvable</p>';
	  return;
	}
	
	// Afficher uniquement ce batch
	container.innerHTML = createBatchContainer(orderId, batchStat);
  }


  function showAllBatchesMerged() {
    const container = document.getElementById('batchContainersWrapper');
    const allItems = State.getCurrentOrderItems();

    // Grouper les items par batch_number
    const byBatch = {};
    allItems.forEach(item => {
      const b = item.batch_number || 1;
      if (!byBatch[b]) byBatch[b] = [];
      byBatch[b].push(item);
    });
    const sortedBatchNums = Object.keys(byBatch).map(Number).sort((a, b) => a - b);

    const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = allItems.reduce((s, i) => s + i.total_price, 0);

    const html = `
      <div class="batch-container">
        <div class="batch-header">
          <h4><i class="fas fa-layer-group"></i> Tous les batch</h4>
        </div>
        <div class="batch-items-container">
          ${sortedBatchNums.map(bNum => `
            <div style="padding: 8px 12px; background: #edf2f7; color: #4a5568; font-weight: 600; font-size: 13px; border-radius: 6px; margin: 8px 0 4px 0;">
              <i class="fas fa-box"></i> Batch ${bNum}
              <span style="font-weight: 400; color: #718096; margin-left: 8px;">${byBatch[bNum].length} article${byBatch[bNum].length > 1 ? 's' : ''}</span>
            </div>
            ${byBatch[bNum].map(item => createBatchItemCard(item, item.batch_number)).join('')}
          `).join('')}
        </div>
        <div class="batch-footer">
          <div class="batch-stats">
            <span><strong>${allItems.length}</strong> article${allItems.length > 1 ? 's' : ''}</span>
            <span><strong>${totalQty}</strong> unités totales</span>
            <span><strong>${Utils.formatAmount(totalAmount)}</strong> USD</span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }
/**
 * Gère la création d'un nouveau batch
 */
async function handleCreateNewBatch(orderId) {
  try {
    const result = await API.createSupplierOrderBatch(orderId);
    
    if (result.success) {
		// Ajouter manuellement le batch vide aux stats
		const newBatchNumber = result.batch_number;
		
		// Ajouter à currentBatches
		currentBatches.push({
		  batch_number: newBatchNumber,
		  item_count: 0,
		  total_quantity: 0,
		  total_amount: 0
		});
		
		// Recharger la vue
		const items = await API.fetchSupplierOrderItems(orderId);
		State.setCurrentOrderItems(items);
		await initBatchView(orderId, false);
	  }
  } catch (error) {
    console.error('Erreur création batch:', error);
    alert('Erreur lors de la création du batch');
  }
}

/**
 * Gère la suppression d'un batch vide
 */
async function handleDeleteEmptyBatch(orderId, batchNumber) {
  if (!confirm(`Supprimer le batch ${batchNumber} ?`)) return;
  
  try {
    const result = await API.deleteSupplierOrderBatch(orderId, batchNumber);
    
    if (result.success) {
      // Recharger la vue
      const items = await API.fetchSupplierOrderItems(orderId);
      State.setCurrentOrderItems(items);
      await initBatchView(orderId, false);
    }
  } catch (error) {
    console.error('Erreur suppression batch:', error);
  }
}

/**
 * Gère les actions sur un item
 */
function handleItemAction(e) {
  const action = e.currentTarget.dataset.action;
  const itemId = e.currentTarget.dataset.itemId;
  
  if (action === 'move') {
    openMoveItemModal(itemId);
  }
}

/**
 * Ouvre le modal de déplacement d'item
 */
function openMoveItemModal(itemId) {
  const item = State.getCurrentOrderItems().find(i => i.id == itemId);
  if (!item) return;
  
  const orderId = State.getCurrentOrderId();
  const batchStats = currentBatches;
  
  // Créer le modal dynamiquement
  const modalHtml = `
    <div class="modal-overlay" id="moveItemModal" style="display: flex;">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2><i class="fas fa-arrows-alt"></i> Déplacer l'article</h2>
          <button class="modal-close" id="closeMoveItemModal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="background: #f7fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0;">${item.product_name}</h4>
            <p style="color: #718096; margin: 0;">
              Actuellement dans <strong>Batch ${item.batch_number}</strong>
            </p>
            <p style="color: #718096; margin: 4px 0 0 0;">
              Quantité disponible: <strong>${item.quantity} unités</strong>
            </p>
          </div>
          
          <div class="form-group">
            <label>Batch de destination *</label>
            <select id="targetBatchSelect" class="form-input">
              ${batchStats.map(b => {
                if (b.batch_number === item.batch_number) return '';
                return `<option value="${b.batch_number}">Batch ${b.batch_number}</option>`;
              }).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label>Quantité à déplacer *</label>
            <input type="number" 
                   id="quantityToMoveInput" 
                   class="form-input"
                   min="1" 
                   max="${item.quantity}"
                   value="${item.quantity}"
                   placeholder="Quantité">
            <small style="color: #718096; display: block; margin-top: 4px;">
              Maximum: ${item.quantity} unités
            </small>
          </div>
          
          <div style="background: #edf2f7; padding: 12px; border-radius: 6px; border-left: 3px solid #4299e1;">
            <p style="margin: 0; font-size: 13px; color: #2d3748;">
              <i class="fas fa-info-circle"></i> 
              Si vous déplacez une partie seulement, l'article sera divisé en deux lignes.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="modal-btn modal-btn-secondary" id="cancelMoveItem">Annuler</button>
          <button type="button" class="modal-btn modal-btn-primary" id="confirmMoveItem">
            <i class="fas fa-check"></i> Déplacer
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Injecter le modal
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Event listeners
  document.getElementById('closeMoveItemModal').onclick = () => document.getElementById('moveItemModal').remove();
  document.getElementById('cancelMoveItem').onclick = () => document.getElementById('moveItemModal').remove();
  document.getElementById('confirmMoveItem').onclick = () => handleConfirmMoveItem(itemId, orderId);
}

/**
 * Confirme le déplacement d'un item
 */
async function handleConfirmMoveItem(itemId, orderId) {
  const targetBatch = document.getElementById('targetBatchSelect').value;
  const quantityToMove = parseInt(document.getElementById('quantityToMoveInput').value);
  
  if (!targetBatch || !quantityToMove || quantityToMove <= 0) {
    alert('Veuillez remplir tous les champs correctement');
    return;
  }
  
  try {
    const result = await API.moveItemToBatch(orderId, itemId, parseInt(targetBatch), quantityToMove);
    
    if (result.success) {
      // Fermer le modal
      document.getElementById('moveItemModal').remove();

      // Recharger la vue
      const items = await API.fetchSupplierOrderItems(orderId);
      State.setCurrentOrderItems(items);
      await initBatchView(orderId, false);
    }
  } catch (error) {
    console.error('Erreur déplacement item:', error);
    alert('Erreur lors du déplacement de l\'article');
  }
}

// Export des fonctions
export {
  handleCreateNewBatch,
  handleDeleteEmptyBatch
};