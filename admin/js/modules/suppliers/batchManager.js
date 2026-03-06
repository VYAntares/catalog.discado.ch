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
let currentSearchQuery = '';

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
        <div class="batch-search-wrapper">
          <i class="fas fa-search batch-search-icon"></i>
          <input type="text" id="batchItemSearch" class="batch-search-input" placeholder="Rechercher un article...">
        </div>
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

      <img src="${imageUrl}" alt="${item.product_name}" class="batch-item-image"
           onerror="this.src='/images/placeholder.png'">

      <div class="batch-item-info consolidated-layout">
        <div class="consolidated-name">
          <h5>${item.product_name}</h5>
          <div class="batch-status-cell" style="margin-top: 4px;">
            <select class="item-status-select" data-item-id="${item.id}"
                    style="padding:3px 8px;border-radius:12px;border:1px solid ${isLivre ? '#48bb78' : '#ed8936'};
                           background:${isLivre ? '#f0fff4' : '#fffaf0'};color:${isLivre ? '#276749' : '#9c4221'};
                           font-size:12px;font-weight:600;cursor:pointer;outline:none;">
              <option value="commandé" ${!isLivre ? 'selected' : ''}>Commandé</option>
              <option value="livré" ${isLivre ? 'selected' : ''}>Livré</option>
            </select>
          </div>
        </div>
        <button class="product-stats-btn"
                data-product-id="${item.product_id}"
                data-product-name="${item.product_name}"
                title="Voir les statistiques"
                style="background:none;border:none;color:#4299e1;cursor:pointer;padding:4px;font-size:16px;line-height:1;justify-self:center;">
          <i class="fas fa-question-circle"></i>
        </button>
        <span class="quantity-badge">${item.quantity} unités</span>
        <span class="price-tag consolidated-price">${Utils.formatSwissNumber(item.unit_price)} USD/u</span>
        <span class="batch-item-total">Total: <strong>${Utils.formatSwissNumber(item.quantity * item.unit_price)} USD</strong></span>
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
  
  // Barre de recherche articles
  const searchInput = document.getElementById('batchItemSearch');
  if (searchInput) {
    searchInput.value = currentSearchQuery;
    searchInput.addEventListener('input', () => filterBatchItems(searchInput.value));
  }

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

	// Mettre à jour l'indicateur avec le total d'articles
	const indicator = document.getElementById('batchPositionIndicator');
	if (indicator) {
	  if (batchNumber === 0) {
		const allItems = State.getCurrentOrderItems();
		const totalQty    = allItems.reduce((s, i) => s + i.quantity, 0);
		const totalAmount = allItems.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0);
		indicator.innerHTML = `Tous les batch &nbsp;·&nbsp; <strong>${allItems.length}</strong> réf. &nbsp;·&nbsp; <strong>${Utils.formatSwissNumber(totalQty, 0)}</strong> unités &nbsp;·&nbsp; <strong>${Utils.formatSwissNumber(totalAmount)} USD</strong>`;
	  } else {
		const batchStat = currentBatches.find(b => b.batch_number === batchNumber);
		if (batchStat) {
		  indicator.innerHTML = `Batch ${batchNumber} &nbsp;·&nbsp; <strong>${batchStat.item_count}</strong> réf. &nbsp;·&nbsp; <strong>${Utils.formatSwissNumber(batchStat.total_quantity, 0)}</strong> unités &nbsp;·&nbsp; <strong>${Utils.formatSwissNumber(batchStat.total_amount)} USD</strong>`;
		} else {
		  indicator.textContent = `Batch ${batchNumber}`;
		}
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
    // Ré-appliquer la recherche après navigation
    if (currentSearchQuery) filterBatchItems(currentSearchQuery);
}

/**
 * Filtre les articles visibles selon la recherche
 */
function filterBatchItems(query) {
  currentSearchQuery = query;
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.batch-item-card').forEach(card => {
    const name = card.querySelector('h5')?.textContent?.toLowerCase() || '';
    const visible = !q || name.includes(q);
    card.classList.toggle('batch-item-hidden', !visible);
  });
  // Masquer les séparateurs de batch si tous leurs items sont masqués
  document.querySelectorAll('.batch-items-container > div[style*="background: #edf2f7"]').forEach(sep => {
    const nextItems = [];
    let el = sep.nextElementSibling;
    while (el && el.classList.contains('batch-item-card')) {
      nextItems.push(el);
      el = el.nextElementSibling;
    }
    sep.style.display = nextItems.length && nextItems.some(i => i.style.display !== 'none') ? '' : 'none';
  });
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
      const productId = btn.getAttribute('data-product-id');
      const productName = btn.getAttribute('data-product-name');
      if (window.ProductStatsModal) {
        window.ProductStatsModal.open(productId, productName);
      } else {
        console.error('ProductStatsModal not loaded');
      }
    });
  });

  // Bouton Déplacer (vue consolidée)
  document.querySelectorAll('.consolidated-move-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDistributeModal(btn.dataset.productName);
    });
  });

  // Bouton Modifier (vue consolidée)
  document.querySelectorAll('.consolidated-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openConsolidatedEdit(btn.dataset.productName);
    });
  });

  // Bouton Supprimer (vue consolidée)
  document.querySelectorAll('.consolidated-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const productName = e.currentTarget.dataset.productName;
      if (!confirm(`Supprimer TOUTES les occurrences de "${productName}" dans TOUS les batchs ?`)) return;

      const orderId = State.getCurrentOrderId();
      const allItems = State.getCurrentOrderItems();
      const productItems = allItems.filter(i => i.product_name === productName);

      try {
        await Promise.all(productItems.map(i => API.deleteSupplierOrderItem(i.id)));
        const items = await API.fetchSupplierOrderItems(orderId);
        State.setCurrentOrderItems(items);
        await initBatchView(orderId, false);
      } catch (err) {
        console.error('Erreur suppression consolidée:', err);
        alert('Erreur lors de la suppression de l\'article.');
      }
    });
  });
}

/**
 * Ouvre la modale de répartition des quantités par batch (vue consolidée)
 */
function openDistributeModal(productName) {
  // Empêcher l'ouverture de plusieurs modales simultanées
  if (document.getElementById('distributeModal')) return;

  const allItems     = State.getCurrentOrderItems();
  const orderId      = State.getCurrentOrderId();
  const productItems = allItems.filter(i => i.product_name === productName);
  const totalQty     = productItems.reduce((s, i) => s + i.quantity, 0);
  const firstItem    = productItems[0];

  // Map batch → {quantity, item_id}
  const batchDistrib = {};
  currentBatches.forEach(b => {
    const found = productItems.find(i => i.batch_number === b.batch_number);
    batchDistrib[b.batch_number] = {
      quantity: found ? found.quantity : 0,
      item_id:  found ? found.id       : null
    };
  });

  const batchRows = currentBatches.map(b => `
    <div class="distribute-row">
      <span class="distribute-batch-label">Batch ${b.batch_number}</span>
      <input type="number" class="distribute-qty-input"
             data-batch="${b.batch_number}" min="0"
             value="${batchDistrib[b.batch_number].quantity}">
      <span class="distribute-batch-unit">unités</span>
    </div>
  `).join('');

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="distributeModal" style="display:flex;">
      <div class="modal-content" style="max-width:420px;width:100%;">
        <div class="modal-header">
          <h2><i class="fas fa-layer-group"></i> Répartir les quantités</h2>
          <button class="modal-close" id="closeDistributeModal">&times;</button>
        </div>
        <div class="modal-body">

          <p style="margin:0 0 20px 0;font-size:15px;font-weight:600;color:#2d3748;">${productName}</p>

          <div style="background:#f7fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">Quantité totale</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="number" id="distributeTotalQty" min="1" value="${totalQty}"
                     style="width:100px;padding:6px 10px;font-size:22px;font-weight:700;text-align:center;border:2px solid #e2e8f0;border-radius:8px;color:#2d3748;outline:none;-moz-appearance:textfield;appearance:textfield;">
              <style>#distributeTotalQty::-webkit-outer-spin-button,#distributeTotalQty::-webkit-inner-spin-button,.distribute-qty-input::-webkit-outer-spin-button,.distribute-qty-input::-webkit-inner-spin-button{display:none;}</style>
              <span style="color:#718096;font-size:14px;">unités au total</span>
            </div>
          </div>

          <div style="font-size:11px;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">Répartition par batch</div>
          <div id="distributeRows">${batchRows}</div>

          <div id="distributePendingBox" style="margin-top:14px;padding:10px 14px;border-radius:6px;border-left:3px solid transparent;">
            <span id="distributePendingText" style="font-size:13px;"></span>
          </div>

        </div>
        <div class="modal-footer">
          <button type="button" class="modal-btn modal-btn-secondary" id="cancelDistribute">Annuler</button>
          <button type="button" class="modal-btn modal-btn-primary" id="confirmDistribute">
            <i class="fas fa-check"></i> Confirmer
          </button>
        </div>
      </div>
    </div>
  `);

  const modal       = document.getElementById('distributeModal');
  const totalInput  = document.getElementById('distributeTotalQty');
  const pendingBox  = document.getElementById('distributePendingBox');
  const pendingText = document.getElementById('distributePendingText');

  // Handlers en premier — jamais bloqués par les calculs
  document.getElementById('closeDistributeModal').onclick = () => modal.remove();
  document.getElementById('cancelDistribute').onclick     = () => modal.remove();
  document.getElementById('confirmDistribute').onclick    = () =>
    handleConfirmDistribute(batchDistrib, orderId, firstItem);

  function updatePending() {
    const currentTotal = parseInt(totalInput.value) || 0;
    const used = Array.from(modal.querySelectorAll('.distribute-qty-input'))
                      .reduce((s, inp) => s + (parseInt(inp.value) || 0), 0);
    const pending = currentTotal - used;
    if (pending > 0) {
      pendingBox.style.cssText = 'margin-top:14px;padding:10px 14px;border-radius:6px;border-left:3px solid #ed8936;background:#fffaf0;';
      pendingText.style.color = '#9c4221';
      pendingText.innerHTML = `En attente : <strong>${Utils.formatSwissNumber(pending, 0)} unités</strong> à placer`;
    } else if (pending < 0) {
      pendingBox.style.cssText = 'margin-top:14px;padding:10px 14px;border-radius:6px;border-left:3px solid #fc8181;background:#fff5f5;';
      pendingText.style.color = '#c53030';
      pendingText.innerHTML = `Dépassement : <strong>${Utils.formatSwissNumber(Math.abs(pending), 0)} unités</strong> en trop`;
    } else {
      pendingBox.style.cssText = 'margin-top:14px;padding:10px 14px;border-radius:6px;border-left:3px solid #48bb78;background:#f0fff4;';
      pendingText.style.color = '#276749';
      pendingText.innerHTML = `<i class="fas fa-check-circle"></i> Toutes les unités réparties`;
    }
  }

  [totalInput, ...modal.querySelectorAll('.distribute-qty-input')].forEach(inp => {
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', updatePending);
  });
  updatePending();
}

/**
 * Valide et applique la répartition des quantités entre batchs
 */
async function handleConfirmDistribute(batchDistrib, orderId, firstItem) {
  const modal      = document.getElementById('distributeModal');
  const totalInput = modal ? modal.querySelector('#distributeTotalQty') : null;
  const inputs     = modal ? modal.querySelectorAll('.distribute-qty-input') : [];

  const newTotal      = parseInt(totalInput ? totalInput.value : 0) || 0;
  const totalInputted = Array.from(inputs).reduce((s, inp) => s + (parseInt(inp.value) || 0), 0);

  if (totalInputted !== newTotal) {
    alert(`Total des batchs (${totalInputted}) ≠ quantité totale (${newTotal}). Ajustez la répartition.`);
    return;
  }

  const promises = [];
  inputs.forEach(inp => {
    const batchNumber = parseInt(inp.dataset.batch);
    const newQty      = parseInt(inp.value) || 0;
    const existing    = batchDistrib[batchNumber];

    if (newQty > 0 && existing.item_id) {
      if (newQty !== existing.quantity) {
        promises.push(API.updateSupplierOrderItem(existing.item_id, { quantity: newQty }));
      }
    } else if (newQty > 0 && !existing.item_id) {
      promises.push(API.addSupplierOrderItem(orderId, {
        product_name: firstItem.product_name,
        quantity:     newQty,
        unit_price:   firstItem.unit_price,
        batch_number: batchNumber,
        product_id:   firstItem.product_id || null,
        image_url:    firstItem.image_url  || null,
        category:     firstItem.category   || null
      }));
    } else if (newQty === 0 && existing.item_id) {
      promises.push(API.deleteSupplierOrderItem(existing.item_id));
    }
  });

  try {
    await Promise.all(promises);
    modal.remove();
    const items = await API.fetchSupplierOrderItems(orderId);
    State.setCurrentOrderItems(items);
    await initBatchView(orderId, false);
  } catch (err) {
    console.error('Erreur répartition:', err);
    alert('Erreur lors de la répartition des quantités.');
  }
}

/**
 * Édition inline depuis la vue consolidée (nom + prix, toutes occurrences)
 */
function openConsolidatedEdit(productName) {
  const orderId      = State.getCurrentOrderId();
  const allItems     = State.getCurrentOrderItems();
  const productItems = allItems.filter(i => i.product_name === productName);
  const firstItem    = productItems[0];

  const editBtn  = Array.from(document.querySelectorAll('.consolidated-edit-btn'))
                       .find(btn => btn.dataset.productName === productName);
  const itemCard = editBtn ? editBtn.closest('.batch-item-card') : null;
  if (!itemCard) return;

  const itemInfo = itemCard.querySelector('.batch-item-info');
  itemInfo.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;grid-column:1/-1;">
      <label style="font-size:13px;flex-basis:100%;">Nom :
        <input type="text" id="consolidatedEditName"
               value="${firstItem.product_name}"
               style="width:100%;padding:4px 6px;border:1px solid #cbd5e0;border-radius:4px;">
      </label>
      <label style="font-size:13px;">Prix unit. (USD) :
        <input type="number" id="consolidatedEditPrice"
               value="${firstItem.unit_price}" min="0" step="0.01"
               style="width:100px;padding:4px 6px;border:1px solid #cbd5e0;border-radius:4px;">
      </label>
      <button class="btn btn-primary btn-sm" id="consolidatedSaveEdit">Enregistrer</button>
      <button class="btn btn-sm" id="consolidatedCancelEdit"
              style="background:#e2e8f0;color:#4a5568;">Annuler</button>
    </div>
  `;

  document.getElementById('consolidatedSaveEdit').onclick = async () => {
    const newName  = document.getElementById('consolidatedEditName').value.trim();
    const newPrice = parseFloat(document.getElementById('consolidatedEditPrice').value);
    if (!newName) { alert('Le nom ne peut pas être vide.'); return; }
    try {
      await Promise.all(productItems.map(i =>
        API.updateSupplierOrderItem(i.id, { product_name: newName, unit_price: newPrice })
      ));
      const items = await API.fetchSupplierOrderItems(orderId);
      State.setCurrentOrderItems(items);
      await initBatchView(orderId, false);
    } catch (err) {
      console.error('Erreur modification consolidée:', err);
    }
  };

  document.getElementById('consolidatedCancelEdit').onclick = async () => {
    await initBatchView(orderId, false);
  };
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

    // Fusionner les lignes identiques par nom de produit
    const merged = {};
    allItems.forEach(item => {
      const key = item.product_name;
      if (!merged[key]) {
        merged[key] = {
          ...item,
          quantity: 0,
          total_price: 0,
          batch_count: 0,
          batch_quantities: {}
        };
      }
      merged[key].quantity    += item.quantity;
      merged[key].total_price += (item.total_price || item.quantity * item.unit_price);
      merged[key].batch_count += 1;
      merged[key].batch_quantities[item.batch_number] = item.quantity;
    });

    const mergedItems = Object.values(merged).sort((a, b) => a.product_name.localeCompare(b.product_name));
    const totalQty    = mergedItems.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = mergedItems.reduce((s, i) => s + i.total_price, 0);

    const html = `
      <div class="batch-container">
        <div class="batch-header">
          <h4><i class="fas fa-layer-group"></i> Vue consolidée — toutes références</h4>
        </div>
        <div class="batch-items-container">
          ${mergedItems.map(item => createConsolidatedItemCard(item)).join('')}
        </div>
        <div class="batch-footer">
          <div class="batch-stats">
            <span><strong>${mergedItems.length}</strong> référence${mergedItems.length > 1 ? 's' : ''}</span>
            <span><strong>${Utils.formatSwissNumber(totalQty, 0)}</strong> unités totales</span>
            <span><strong>${Utils.formatAmount(totalAmount)}</strong> USD</span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Crée une carte consolidée (lecture seule, sans actions)
   */
  function createConsolidatedItemCard(item) {
    const imageUrl = item.image_url || '/images/placeholder.png';
    const batchBadges = Object.entries(item.batch_quantities)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([b, q]) =>
        `<span class="consolidated-batch-badge">Batch ${b}&nbsp;: ${Utils.formatSwissNumber(q, 0)}</span>`
      ).join('');

    return `
      <div class="batch-item-card" data-item-id="${item.id}" data-batch-number="0">
        <img src="${imageUrl}" alt="${item.product_name}" class="batch-item-image"
             onerror="this.src='/images/placeholder.png'">
        <div class="batch-item-info consolidated-layout">
          <div class="consolidated-name-block">
            <h5>${item.product_name}</h5>
            <span class="consolidated-unit-price">${Utils.formatSwissNumber(item.unit_price)} USD/u</span>
          </div>
          <button class="product-stats-btn"
                  data-product-id="${item.product_id}"
                  data-product-name="${item.product_name}"
                  title="Voir les statistiques">
            <i class="fas fa-question-circle"></i>
          </button>
          <span class="quantity-badge">${Utils.formatSwissNumber(item.quantity, 0)} unités</span>
          <div class="consolidated-batch-badges">${batchBadges}</div>
          <span class="batch-item-total"><strong>${Utils.formatSwissNumber(item.total_price)} USD</strong></span>
        </div>
        <div class="batch-item-actions">
          <button class="batch-item-action-btn consolidated-move-btn"
                  data-action="distribute"
                  data-product-name="${item.product_name}"
                  title="Répartir entre les batchs">
            <i class="fas fa-arrows-alt"></i>
          </button>
          <button class="btn btn-sm consolidated-edit-btn"
                  data-product-name="${item.product_name}"
                  title="Modifier">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm consolidated-delete-btn"
                  data-product-name="${item.product_name}"
                  title="Tout supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
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