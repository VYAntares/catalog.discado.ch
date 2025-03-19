/**
 * Module des articles en attente
 * Gère l'affichage et l'interaction avec les articles en attente de livraison
 */

import { fetchUserOrders } from '../../core/api.js';
import { formatDate } from '../../utils/formatter.js';

// Variable pour stocker la commande d'articles en attente
let pendingDeliveryOrder = null;

/**
 * Initialise la gestion des articles en attente
 */
function initPendingItems() {
    console.log('Pending items module initialized');
    loadPendingItems();
    setupPendingItemsToggle();
}

/**
 * Charge les articles en attente de livraison
 */
async function loadPendingItems() {
    try {
        // Charger toutes les commandes de l'utilisateur
        const orders = await fetchUserOrders();
        
        // Trouver la commande spéciale pour les articles en attente
        pendingDeliveryOrder = orders.find(order => order.isToDeliverItems);
        
        // Mettre à jour l'interface utilisateur
        updatePendingItemsUI(pendingDeliveryOrder);
    } catch (error) {
        console.error('Error loading pending items:', error);
        
        // Cacher le bouton des articles en attente en cas d'erreur
        hidePendingItemsButton();
    }
}

/**
 * Configure le bouton d'affichage/masquage des articles en attente
 */
function setupPendingItemsToggle() {
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    const pendingDeliveriesContainer = document.getElementById('pendingDeliveriesContainer');
    
    if (!pendingDeliveriesBtn || !pendingDeliveriesContainer) return;
    
    // Ajouter l'écouteur d'événement pour le bouton
    pendingDeliveriesBtn.addEventListener('click', function() {
        togglePendingDeliveries(pendingDeliveriesContainer);
    });
}

/**
 * Affiche/masque le conteneur des articles en attente
 * @param {HTMLElement} container - Conteneur des articles en attente
 */
function togglePendingDeliveries(container) {
    const isVisible = container.classList.contains('visible');
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    
    if (isVisible) {
        // Masquer
        container.classList.remove('visible');
        setTimeout(() => {
            container.style.display = 'none';
        }, 300); // Attendre la fin de l'animation
        
        // Changer le texte du bouton
        if (pendingDeliveriesBtn) {
            const pendingItemsCount = document.getElementById('pendingItemsCount');
            pendingDeliveriesBtn.innerHTML = `
                <i class="fas fa-truck"></i> View pending delivery items
                <span id="pendingItemsCount" class="pending-items-count">${pendingItemsCount?.textContent || '0'}</span>
            `;
        }
    } else {
        // Afficher
        container.style.display = 'block';
        
        // Déclencher le reflow pour que l'animation fonctionne
        void container.offsetWidth;
        
        container.classList.add('visible');
        
        // Changer le texte du bouton
        if (pendingDeliveriesBtn) {
            const pendingItemsCount = document.getElementById('pendingItemsCount');
            pendingDeliveriesBtn.innerHTML = `
                <i class="fas fa-chevron-up"></i> Hide pending delivery items
                <span id="pendingItemsCount" class="pending-items-count">${pendingItemsCount?.textContent || '0'}</span>
            `;
        }
    }
}

/**
 * Met à jour l'interface utilisateur pour les articles en attente
 * @param {Object} pendingOrder - Commande contenant les articles en attente
 */
function updatePendingItemsUI(pendingOrder) {
    // Mettre à jour le compteur et le style du bouton
    updatePendingItemsButton(pendingOrder);
    
    // Mettre à jour le contenu du conteneur
    updatePendingItemsContainer(pendingOrder);
}

/**
 * Met à jour le bouton des articles en attente
 * @param {Object} pendingOrder - Commande contenant les articles en attente
 */
function updatePendingItemsButton(pendingOrder) {
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    const pendingItemsCount = document.getElementById('pendingItemsCount');
    
    if (!pendingDeliveriesBtn || !pendingItemsCount) return;
    
    if (pendingOrder && pendingOrder.items && pendingOrder.items.length > 0) {
        // Calculer le nombre total d'articles en attente
        const pendingItemsTotal = pendingOrder.items.reduce((total, item) => total + item.quantity, 0);
        
        // Mettre à jour le compteur
        pendingItemsCount.textContent = pendingItemsTotal;
        pendingItemsCount.classList.remove('hidden');
        
        // Ajouter la classe pour l'animation si des articles sont en attente
        pendingDeliveriesBtn.classList.add('has-items');
        
        // Afficher le bouton
        pendingDeliveriesBtn.style.display = 'flex';
    } else {
        // Cacher le compteur s'il n'y a pas d'articles en attente
        pendingItemsCount.classList.add('hidden');
        pendingDeliveriesBtn.classList.remove('has-items');
        
        // Cacher le bouton complètement s'il n'y a pas d'articles en attente
        pendingDeliveriesBtn.style.display = 'none';
    }
}

/**
 * Met à jour le conteneur des articles en attente
 * @param {Object} pendingOrder - Commande contenant les articles en attente
 */
function updatePendingItemsContainer(pendingOrder) {
    const pendingDeliveriesContainer = document.getElementById('pendingDeliveriesContainer');
    
    if (!pendingDeliveriesContainer) return;
    
    if (pendingOrder && pendingOrder.items && pendingOrder.items.length > 0) {
        // Créer la carte pour les articles en attente
        const pendingDeliveryCard = createPendingDeliveryCard(pendingOrder);
        
        // Vider et remplir le conteneur
        pendingDeliveriesContainer.innerHTML = '';
        pendingDeliveriesContainer.appendChild(pendingDeliveryCard);
    } else {
        // Aucun article en attente
        pendingDeliveriesContainer.innerHTML = `
            <div class="empty-state">
                <p>No pending delivery items</p>
            </div>
        `;
    }
}

/**
 * Crée la carte pour les articles en attente
 * @param {Object} pendingOrder - Commande contenant les articles en attente
 * @returns {HTMLElement} Carte des articles en attente
 */
function createPendingDeliveryCard(pendingOrder) {
    // Récupérer les articles en attente
    const toDeliverItems = pendingOrder.items || [];
    const groupedItems = pendingOrder.groupedItems || {};
    
    // Créer la carte
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card pending-delivery-card';
    
    // En-tête
    orderCard.innerHTML = `
        <div class="order-card-header">
            <h3>Pending Delivery Items</h3>
            <span class="order-status status-processing">
                Pending Delivery
            </span>
        </div>
        <div class="order-date">Items waiting to be delivered from previous orders</div>
    `;
    
    // S'il y a des articles groupés par catégorie
    if (Object.keys(groupedItems).length > 0) {
        // Pour chaque catégorie
        for (const category in groupedItems) {
            // Créer une section pour la catégorie
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section';
            
            // En-tête de la catégorie
            categorySection.innerHTML = `
                <h4 class="category-header">${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
            `;
            
            // Tableau des articles
            const itemsTable = document.createElement('table');
            itemsTable.className = 'order-details-table';
            itemsTable.innerHTML = `
                <thead>
                    <tr>
                        <th class="qty-column">Qty</th>
                        <th class="product-name-column">Product</th>
                    </tr>
                </thead>
                <tbody>
                    ${groupedItems[category].map(item => {
                        return `
                            <tr class="pending-item">
                                <td class="qty-column">${item.quantity}</td>
                                <td class="product-name-column">${item.Nom}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            `;
            
            categorySection.appendChild(itemsTable);
            orderCard.appendChild(categorySection);
        }
    } else {
        // Affichage simple sans catégories
        const itemsTable = document.createElement('table');
        itemsTable.className = 'order-details-table';
        itemsTable.innerHTML = `
            <thead>
                <tr>
                    <th class="qty-column">Qty</th>
                    <th class="product-name-column">Product</th>
                </tr>
            </thead>
            <tbody>
                ${toDeliverItems.map(item => {
                    return `
                        <tr class="pending-item">
                            <td class="qty-column">${item.quantity}</td>
                            <td class="product-name-column">${item.Nom}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;
        
        orderCard.appendChild(itemsTable);
    }
    
    // Note d'information au lieu du total
    const noteSection = document.createElement('div');
    noteSection.className = 'order-summary';
    noteSection.innerHTML = `
        <div class="order-summary-note">
            <span class="invoice-not-available">
                <i class="fas fa-info-circle"></i> These items will be delivered when available
            </span>
        </div>
    `;
    
    orderCard.appendChild(noteSection);
    
    return orderCard;
}

/**
 * Cache le bouton des articles en attente
 */
function hidePendingItemsButton() {
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    if (pendingDeliveriesBtn) {
        pendingDeliveriesBtn.style.display = 'none';
    }
}

/**
 * Exporte les fonctions publiques
 */
export {
    initPendingItems,
    loadPendingItems,
    togglePendingDeliveries
};