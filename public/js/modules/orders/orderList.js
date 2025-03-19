/**
 * Module de liste des commandes
 * Gère l'affichage de l'historique des commandes de l'utilisateur
 */

import { fetchUserOrders, getInvoiceDownloadLink } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { formatDate, formatPrice } from '../../utils/formatter.js';

/**
 * Initialise la liste des commandes
 */
export function initOrdersList() {
    console.log('Orders list module initialized');
    loadOrders();
}

/**
 * Charge les commandes de l'utilisateur
 */
async function loadOrders() {
    // Récupérer le conteneur des commandes
    const ordersContainer = document.getElementById('ordersList');
    if (!ordersContainer) return;
    
    // Afficher l'indicateur de chargement
    ordersContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading your orders...</p>
        </div>
    `;
    
    try {
        // Charger les commandes depuis l'API
        const orders = await fetchUserOrders();
        
        // Afficher les commandes
        displayOrders(orders, ordersContainer);
    } catch (error) {
        console.error('Error loading orders:', error);
        
        // Afficher un message d'erreur
        ordersContainer.innerHTML = `
            <div class="error-message">
                <p>Error loading your orders. Please try again later.</p>
                <button id="retry-orders-btn" class="primary-btn">Retry</button>
            </div>
        `;
        
        // Ajouter un écouteur pour le bouton de réessai
        const retryBtn = document.getElementById('retry-orders-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', loadOrders);
        }
    }
}

/**
 * Affiche les commandes dans le conteneur
 * @param {Array} orders - Liste des commandes
 * @param {HTMLElement} container - Conteneur pour les commandes
 */
function displayOrders(orders, container) {
    // Vérifier s'il y a des commandes à afficher
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>You have no orders yet.</p>
                <a href="/pages/catalog.html" class="primary-btn">Browse Products</a>
            </div>
        `;
        return;
    }
    
    // Vider le conteneur
    container.innerHTML = '';
    
    // Exclure les commandes spéciales (articles en attente)
    const standardOrders = orders.filter(order => !order.isToDeliverItems);
    
    // Trier les commandes de la plus récente à la plus ancienne
    standardOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Créer une carte pour chaque commande
    standardOrders.forEach((order, index) => {
        createOrderCard(order, index, container);
    });
}

function createOrderCard(order, index, container) {
    // Formater la date de commande
    const orderDate = formatDate(order.date);
    const processDate = order.lastProcessed ? formatDate(order.lastProcessed) : '';
    
    // Déterminer le statut de la commande
    // MODIFICATION: Afficher toutes les commandes traitées comme "Completed"
    let statusText = 'Processing';
    let statusClass = 'status-processing';
    
    if (order.status === 'completed' || order.status === 'shipped' || order.status === 'partial') {
        statusText = 'Completed';
        statusClass = 'status-shipped';
    }
    
    // Créer la carte de commande
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    
    // En-tête de la carte
    orderCard.innerHTML = `
        <div class="order-card-header">
            <h3>Order #${order.orderId.split('_').pop() || index + 1}</h3>
            <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <div class="order-date">
            Ordered: ${orderDate}
            ${processDate ? `<br>Processed: ${processDate}` : ''}
        </div>
    `;
    
    // Ajouter le tableau des articles
    const itemsTable = createOrderItemsTable(order);
    orderCard.appendChild(itemsTable);
    
    // Ajouter le résumé de la commande (total + téléchargement facture)
    const orderSummary = createOrderSummary(order);
    orderCard.appendChild(orderSummary);
    
    // Ajouter la carte au conteneur
    container.appendChild(orderCard);
}

function createOrderItemsTable(order) {
    const tableContainer = document.createElement('div');
    
    // Determine which items to display according to the status
    let itemsToDisplay, pendingItems;
    
    if (order.status === 'partial' && order.deliveredItems) {
        // For partial orders, display delivered and pending items
        itemsToDisplay = order.deliveredItems || [];
        pendingItems = order.remainingItems || [];
    } else {
        // For other orders, display all items
        itemsToDisplay = order.items || [];
        pendingItems = [];
    }
    
    // Group items by category
    const groupedItems = {};
    
    itemsToDisplay.forEach(item => {
        const category = item.categorie || 'autres';
        if (!groupedItems[category]) {
            groupedItems[category] = [];
        }
        groupedItems[category].push(item);
    });
    
    // Create the table structure
    let tableHTML = `
        <table class="order-details-table">
            <thead>
                <tr>
                    <th class="qty-column">Qty</th>
                    <th class="product-name-column">Product</th>
                    <th class="unit-price-column">Unit Price</th>
                    <th class="total-price-column">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Sort categories alphabetically
    const sortedCategories = Object.keys(groupedItems).sort();
    
    // Add delivered items by category
    for (const category of sortedCategories) {
        // Add category header
        tableHTML += `
            <tr class="category-header">
                <td colspan="4" class="category-section">${category.charAt(0).toUpperCase() + category.slice(1)}</td>
            </tr>
        `;
        
        // Add items in this category
        groupedItems[category].forEach(item => {
            const itemTotal = parseFloat(item.prix) * item.quantity;
            
            tableHTML += `
                <tr class="delivered-item">
                    <td class="qty-column">${item.quantity}</td>
                    <td class="product-name-column">${item.Nom}</td>
                    <td class="unit-price-column">${formatPrice(item.prix)} CHF</td>
                    <td class="total-price-column">${formatPrice(itemTotal)} CHF</td>
                </tr>
            `;
        });
    }
    
    // Add pending items if any
    if (pendingItems.length > 0) {
        tableHTML += `
            <tr class="order-section-header">
                <td colspan="4" class="pending-section">PENDING ITEMS</td>
            </tr>
        `;
        
        // Group pending items by category
        const groupedPendingItems = {};
        
        pendingItems.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedPendingItems[category]) {
                groupedPendingItems[category] = [];
            }
            groupedPendingItems[category].push(item);
        });
        
        // Sort pending categories alphabetically
        const sortedPendingCategories = Object.keys(groupedPendingItems).sort();
        
        // Add pending items by category
        for (const category of sortedPendingCategories) {
            // Add category header
            tableHTML += `
                <tr class="category-header">
                    <td colspan="4" class="category-section pending-category">${category.charAt(0).toUpperCase() + category.slice(1)}</td>
                </tr>
            `;
            
            // Add items in this category
            groupedPendingItems[category].forEach(item => {
                tableHTML += `
                    <tr class="pending-item">
                        <td class="qty-column">${item.quantity}</td>
                        <td class="product-name-column">${item.Nom}</td>
                        <td class="unit-price-column">-</td>
                        <td class="total-price-column">-</td>
                    </tr>
                `;
            });
        }
    }
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    tableContainer.innerHTML = tableHTML;
    return tableContainer;
}

function createOrderSummary(order) {
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'order-summary';
    
    // Calculer le montant total
    let totalAmount;
    
    if (order.status === 'partial' && order.deliveredItems) {
        // Pour les commandes partielles, calculer le total des articles livrés
        totalAmount = order.deliveredItems.reduce((total, item) => 
            total + (parseFloat(item.prix) * item.quantity), 0
        );
    } else {
        // Pour les autres commandes, utiliser le total existant ou calculer
        totalAmount = order.total || order.items.reduce((total, item) => 
            total + (parseFloat(item.prix) * item.quantity), 0
        );
    }
    
    // Créer le contenu du résumé
    // MODIFICATION: Permettre le téléchargement des factures pour les commandes partielles aussi
    summaryContainer.innerHTML = `
        <div class="order-summary-total">
            Total: ${formatPrice(totalAmount)} CHF
            ${order.status !== 'pending' && order.status !== 'in progress' ? 
                `<button class="download-invoice-btn" data-order-id="${order.orderId}">
                    <i class="fas fa-file-pdf"></i> Download Invoice
                </button>` : 
                `<span class="invoice-not-available">
                    <i class="fas fa-info-circle"></i> Invoice will be available after delivery
                </span>`
            }
        </div>
    `;
    
    // Ajouter l'écouteur pour le téléchargement de la facture
    const invoiceBtn = summaryContainer.querySelector('.download-invoice-btn');
    if (invoiceBtn) {
        invoiceBtn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            window.open(getInvoiceDownloadLink(orderId), '_blank');
        });
    }
    
    return summaryContainer;
}

/**
 * Recherche de commandes par terme
 * @param {string} searchTerm - Terme de recherche
 */
export function searchOrders(searchTerm) {
    // À implémenter si nécessaire
}