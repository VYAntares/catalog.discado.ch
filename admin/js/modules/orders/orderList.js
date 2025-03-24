/**
 * Gestion de l'affichage des commandes en attente
 * admin/js/modules/orders/orderList.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as OrderProcess from './orderProcess.js';

let orderListContainer;

// Charge les commandes en attente depuis l'API
async function loadPendingOrders() {
    orderListContainer = document.getElementById('orderList');
    
    if (!orderListContainer) return;
    
    orderListContainer.innerHTML = `
        <div class="loading">Chargement des commandes...</div>
    `;
    
    try {
        const orders = await API.fetchPendingOrders();
        displayOrders(orders);
    } catch (error) {
        orderListContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des commandes.</p>
                <button class="action-btn" id="retryLoadOrders">Réessayer</button>
            </div>
        `;
        
        const retryButton = document.getElementById('retryLoadOrders');
        if (retryButton) {
            retryButton.addEventListener('click', loadPendingOrders);
        }
    }
}

// Affiche les commandes dans le conteneur
function displayOrders(orders) {
    if (!orders || orders.length === 0) {
        orderListContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>Aucune commande en attente pour le moment.</p>
            </div>
        `;
        return;
    }
    
    orderListContainer.innerHTML = '';
    
    orders.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    orders.forEach(order => {
        const orderDate = Formatter.formatDate(order.date);
        
        const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
        
        const itemsPreview = order.items.slice(0, 3).map(item => {
            return item.Nom.split(' - ')[0];
        }).join(', ');
        
        const userProfile = order.userProfile || {};
        const customerName = userProfile.fullName || order.userId;
        const shopName = userProfile.shopName || 'Non spécifié';
        const email = userProfile.email || 'Non spécifié';
        const phone = userProfile.phone || 'Non spécifié';
        
        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        orderItem.innerHTML = `
            <div class="order-details">
                <div class="order-id">
                    <i class="fas fa-shopping-cart"></i>
                    Commande #${order.orderId}
                </div>
                <div class="order-date">${orderDate}</div>
                <div class="customer-info">
                    <div class="customer-name">${customerName}</div>
                    <div class="customer-shop">Boutique: ${shopName}</div>
                    <div class="customer-contact">Email: ${email} | Tél: ${phone}</div>
                </div>
                <div class="order-items">
                    <div class="item-count">${totalItems} article${totalItems > 1 ? 's' : ''} au total</div>
                    <div class="items-preview">${itemsPreview}${order.items.length > 3 ? '...' : ''}</div>
                </div>
            </div>
            <div class="order-actions">
                <button class="action-btn process-btn" data-order-id="${order.orderId}" data-user-id="${order.userId}">
                    <i class="fas fa-check"></i> Traiter commande
                </button>
            </div>
        `;
        
        orderListContainer.appendChild(orderItem);
    });
    
    setupOrderActions();
}

// Configure les écouteurs d'événements pour les actions sur les commandes
function setupOrderActions() {
    const processButtons = document.querySelectorAll('.process-btn');
    
    processButtons.forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            
            OrderProcess.processOrder(orderId, userId);
        });
    });
}

// Rafraîchit la liste des commandes après le traitement d'une commande
function refreshOrderList() {
    loadPendingOrders();
}

export {
    loadPendingOrders,
    displayOrders,
    refreshOrderList
};