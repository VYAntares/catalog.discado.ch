/**
 * Visualisation détaillée d'un client
 * admin/js/modules/clients/clientView.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as HistoryView from '../history/historyView.js';

let clientModal;
let clientDetailsContent;
let clientDetailsTitle;
let currentClientId;

//Affiche les détails d'un client dans une modale
async function viewClientDetails(clientId) {
    currentClientId = clientId;
    clientModal = document.getElementById('clientModal');
    clientDetailsContent = document.getElementById('clientDetailsContent');
    clientDetailsTitle = document.getElementById('clientDetailsTitle');
    
    if (!clientModal || !clientDetailsContent) return;
    
    clientDetailsContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;
    
    Modal.showModal(clientModal);
    
    try {
        const clients = await API.fetchClientProfiles();
        const client = clients.find(c => c.clientId === clientId);
        
        if (client) {
            displayClientDetails(client);
        } else {
            clientDetailsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <p>Client non trouvé</p>
                    <p>Détails recherchés : ${clientId}</p>
                </div>
            `;
        }
    } catch (error) {
        clientDetailsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails du client</p>
                <button class="action-btn" id="retryLoadClient">Réessayer</button>
            </div>
        `;
        
        const retryButton = document.getElementById('retryLoadClient');
        if (retryButton) {
            retryButton.addEventListener('click', function() {
                viewClientDetails(clientId);
            });
        }
    }
}

//Affiche les détails d'un client dans la modale
async function displayClientDetails(client) {
    clientDetailsTitle.textContent = `Détails du client: ${client.clientId || 'N/A'}`;
    
    const lastUpdated = client.lastUpdated ? Formatter.formatDate(client.lastUpdated) : 'N/A';
    
    let html = `
        <div class="client-section">
            <div class="client-header">
                <h2 class="client-title">Détails du client: ${client.clientId || 'N/A'}</h2>
                <button class="client-close-btn" id="closeClientModal">&times;</button>
            </div>

            <!-- Section Informations personnelles -->
            <div class="info-section">
                <h3 class="info-section-title">Informations personnelles</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">ID Client:</span>
                        <span class="info-value">${client.clientId || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Prénom:</span>
                        <span class="info-value">${client.firstName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Nom:</span>
                        <span class="info-value">${client.lastName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${client.email || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Téléphone:</span>
                        <span class="info-value">${client.phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Source/Référence:</span>
                        <span class="info-value">${client.referralSource || 'Non spécifiée'}</span>
                    </div>
                </div>
            </div>

            <!-- Section Informations boutique -->
            <div class="info-section">
                <h3 class="info-section-title">Informations boutique</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Nom de la boutique:</span>
                        <span class="info-value">${client.shopName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Adresse:</span>
                        <span class="info-value">${client.shopAddress || client.address || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ville:</span>
                        <span class="info-value">${client.shopCity || client.city || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Code postal:</span>
                        <span class="info-value">${client.shopZipCode || client.postalCode || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div id="pending-delivery-container"></div>
            <div id="client-orders-container"></div>
        </div>
    `;
    
    clientDetailsContent.innerHTML = html;
    
    document.getElementById('closeClientModal').addEventListener('click', function() {
        Modal.hideModal(clientModal);
    });
    
    try {
        const orders = await API.fetchClientOrders(client.clientId);
        
        const pendingDeliveryContainer = document.getElementById('pending-delivery-container');
        const ordersContainer = document.getElementById('client-orders-container');
        
        const pendingDelivery = orders.find(order => order.orderId === 'pending-delivery');
        const regularOrders = orders.filter(order => order.orderId !== 'pending-delivery');
        
        displayPendingDelivery(pendingDeliveryContainer, pendingDelivery, client.clientId);
        
        displayOrderHistory(ordersContainer, regularOrders, client.clientId);
    } catch (error) {
        document.getElementById('pending-delivery-container').innerHTML = `
            <div class="empty-state">
                <p>Erreur lors du chargement des articles en attente</p>
            </div>
        `;
        
        document.getElementById('client-orders-container').innerHTML = `
            <div class="empty-state">
                <p>Erreur lors du chargement de l'historique des commandes</p>
            </div>
        `;
    }
}

//Affiche les articles en attente de livraison
function displayPendingDelivery(container, pendingDelivery, clientId) {
    if (!pendingDelivery || !pendingDelivery.items || pendingDelivery.items.length === 0) {
        return;
    }
    
    const groupedItems = {};
    pendingDelivery.items.forEach(item => {
        const category = item.categorie || 'autres';
        if (!groupedItems[category]) {
            groupedItems[category] = [];
        }
        groupedItems[category].push(item);
    });
    
    let html = `
        <div class="delivery-section">
            <h3 class="info-section-title">
                <i class="fas fa-truck delivery-icon"></i>Articles en attente de livraison
            </h3>
            <div class="delivery-table-container">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="select-all-pending" title="Sélectionner tout"></th>
                            <th>Article</th>
                            <th>Catégorie</th>
                            <th>Quantité</th>
                            <th>Prix unitaire</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    const sortedCategories = Object.keys(groupedItems).sort();
    
    let itemCounter = 0;
    
    sortedCategories.forEach(category => {
        html += `
            <tr>
                <td colspan="5" class="category-header">${category.charAt(0).toUpperCase() + category.slice(1)}</td>
            </tr>
        `;
        
        groupedItems[category].forEach(item => {
            const itemId = `pending-item-${itemCounter++}`;
            html += `
                <tr>
                    <td>
                        <input type="checkbox" 
                               id="${itemId}" 
                               class="select-pending-item" 
                               data-name="${item.Nom}" 
                               data-price="${item.prix}" 
                               data-quantity="${item.quantity}" 
                               data-category="${item.categorie || 'autres'}">
                    </td>
                    <td>${item.Nom}</td>
                    <td>${item.categorie || 'Autre'}</td>
                    <td>${item.quantity}</td>
                    <td>${Formatter.formatPrice(item.prix)} CHF</td>
                </tr>
            `;
        });
    });
    
    html += `
        </tbody>
    </table>
    </div>
    <div class="pending-actions" style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px; width: 100%;">
        <button id="delete-selected-items" class="action-btn delete-btn" data-client-id="${clientId}">
            <i class="fas fa-trash"></i> Supprimer les articles sélectionnés
        </button>
        <button id="create-order-from-pending" class="action-btn primary-btn" data-client-id="${clientId}">
            <i class="fas fa-shopping-cart"></i> Créer une commande
        </button>
    </div>
    `;
    
    container.innerHTML = html;
    
    setupPendingDeliveryEvents(clientId);
}

//Configure les écouteurs d'événements pour les articles en attente
function setupPendingDeliveryEvents(clientId) {
    const selectAllCheckbox = document.getElementById('select-all-pending');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            document.querySelectorAll('.select-pending-item').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });
    }
    
    const createOrderBtn = document.getElementById('create-order-from-pending');
    if (createOrderBtn) {
        createOrderBtn.addEventListener('click', function() {
            const selectedItems = [];
            document.querySelectorAll('.select-pending-item:checked').forEach(checkbox => {
                selectedItems.push({
                    Nom: checkbox.getAttribute('data-name'),
                    prix: checkbox.getAttribute('data-price'),
                    quantity: parseInt(checkbox.getAttribute('data-quantity')),
                    categorie: checkbox.getAttribute('data-category')
                });
            });
            
            if (selectedItems.length > 0) {
                createOrderFromPendingItems(clientId, selectedItems);
            } else {
                Notification.showNotification('Veuillez sélectionner au moins un article', 'warning');
            }
        });
    }
    
    const deleteSelectedBtn = document.getElementById('delete-selected-items');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', function() {
            const selectedItems = [];
            document.querySelectorAll('.select-pending-item:checked').forEach(checkbox => {
                selectedItems.push({
                    Nom: checkbox.getAttribute('data-name'),
                    prix: checkbox.getAttribute('data-price'),
                    quantity: parseInt(checkbox.getAttribute('data-quantity')),
                    categorie: checkbox.getAttribute('data-category')
                });
            });
            
            if (selectedItems.length > 0) {
                deleteSelectedItems(clientId, selectedItems);
            } else {
                Notification.showNotification('Veuillez sélectionner au moins un article à supprimer', 'warning');
            }
        });
    }
}

//Supprime les articles sélectionnés
async function deleteSelectedItems(clientId, items) {
    const confirmDelete = confirm(`Êtes-vous sûr de vouloir supprimer définitivement les ${items.length} articles sélectionnés ?`);
    
    if (!confirmDelete) return;
    
    try {
        const response = await fetch('/api/admin/delete-pending-items', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId: clientId, items: items})
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            Notification.showNotification('Articles supprimés avec succès', 'success');
            viewClientDetails(clientId);
        } else {
            Notification.showNotification(`Erreur: ${result.message}`, 'error');
        }
    } catch (error) {
        Notification.showNotification('Erreur de communication avec le serveur: ' + error.message, 'error');
    }
}

//Crée une commande à partir des articles en attente sélectionnés
async function createOrderFromPendingItems(clientId, items) {
    try {
        const response = await fetch('/api/admin/create-order-from-pending', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId: clientId, items: items})
        });
        
        const result = await response.json();
        
        if (result.success) {
            Notification.showNotification('Commande mise à jour avec succès', 'success');
            viewClientDetails(clientId);
        } else {
            Notification.showNotification(`Erreur: ${result.message}`, 'error');
        }
    } catch (error) {
        Notification.showNotification('Erreur de communication avec le serveur', 'error');
    }
}

//Affiche l'historique des commandes d'un client
function displayOrderHistory(container, orders, clientId) {
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Aucune commande pour ce client</p>
            </div>
        `;
        return;
    }
    
    orders.sort((a, b) => new Date(b.lastProcessed || b.date) - new Date(a.lastProcessed || a.date));
    
    let html = `
        <div class="orders-history-section">
            <h3 class="info-section-title">Historique des commandes</h3>
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Commande #</th>
                        <th>Date</th>
                        <th>Statut</th>
                        <th>Articles</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    orders.forEach(order => {
        if (order.orderId === 'pending-delivery') return;
        
        const orderDate = Formatter.formatDate(order.date);
        const processDate = order.lastProcessed ? Formatter.formatDate(order.lastProcessed) : 'N/A';
        
        let statusText = 'EN ATTENTE';
        let statusClass = 'status-pending';
        
        if (order.status === 'completed' || order.status === 'partial') {
            statusText = 'COMPLÈTE';
            statusClass = 'status-completed';
        }
        
        const totalItems = (order.deliveredItems || order.items || []).reduce((sum, item) => sum + item.quantity, 0);
        
        html += `
            <tr>
                <td class="order-id">${order.orderId}</td>
                <td class="order-date">
                    Commandé: ${orderDate}<br>
                    ${order.lastProcessed ? `Traité: ${processDate}` : ''}
                </td>
                <td><span class="order-status">${statusText}</span></td>
                <td class="order-count">${totalItems} article${totalItems > 1 ? 's' : ''}</td>
                <td>
                    <button class="action-btn details-btn view-order-btn" data-order-id="${order.orderId}" data-user-id="${clientId}">
                        <i class="fas fa-eye"></i> Détails
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Ajouter les écouteurs d'événements pour les boutons de détails
    setupOrderDetailButtonHandlers();
}

// Configurer les gestionnaires d'événements pour les boutons de détails de commande
function setupOrderDetailButtonHandlers() {
    document.querySelectorAll('.view-order-btn').forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            HistoryView.showOrderDetailsFromClientView(orderId, userId);
        });
    });
}

export {
    viewClientDetails,
    displayClientDetails,
    displayPendingDelivery,
    displayOrderHistory,
    createOrderFromPendingItems,
    deleteSelectedItems
};