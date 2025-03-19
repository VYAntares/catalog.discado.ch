/**
 * Gestion de l'affichage des commandes en attente
 * Ce module gère le chargement et l'affichage de la liste des commandes
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as OrderProcess from './orderProcess.js';

// Référence DOM
let orderListContainer;

/**
 * Charge les commandes en attente depuis l'API
 */
async function loadPendingOrders() {
    // Obtenir la référence du conteneur
    orderListContainer = document.getElementById('orderList');
    
    if (!orderListContainer) {
        console.error("Conteneur de liste de commandes non trouvé");
        return;
    }
    
    // Afficher l'indicateur de chargement
    orderListContainer.innerHTML = `
        <div class="loading">Chargement des commandes...</div>
    `;
    
    try {
        // Appel API pour récupérer les commandes en attente
        const orders = await API.fetchPendingOrders();
        
        // Afficher les commandes
        displayOrders(orders);
    } catch (error) {
        console.error('Erreur lors du chargement des commandes:', error);
        
        // Afficher un message d'erreur avec bouton de réessai
        orderListContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des commandes.</p>
                <button class="action-btn" id="retryLoadOrders">Réessayer</button>
            </div>
        `;
        
        // Ajouter l'écouteur pour le bouton de réessai
        const retryButton = document.getElementById('retryLoadOrders');
        if (retryButton) {
            retryButton.addEventListener('click', loadPendingOrders);
        }
    }
}

/**
 * Affiche les commandes dans le conteneur
 * @param {Array} orders - Liste des commandes à afficher
 */
function displayOrders(orders) {
    // Vérifier s'il y a des commandes
    if (!orders || orders.length === 0) {
        orderListContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>Aucune commande en attente pour le moment.</p>
            </div>
        `;
        return;
    }
    
    // Vider le conteneur
    orderListContainer.innerHTML = '';
    
    // Trier les commandes du plus ancien au plus récent
    orders.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Créer un élément pour chaque commande
    orders.forEach(order => {
        // Formater la date de commande
        const orderDate = Formatter.formatDate(order.date);
        
        // Calculer le nombre total d'articles
        const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
        
        // Récupérer les 3 premiers noms d'articles pour l'aperçu
        const itemsPreview = order.items.slice(0, 3).map(item => {
            return item.Nom.split(' - ')[0]; // Simplifier les noms pour l'aperçu
        }).join(', ');
        
        // Informations du client
        const userProfile = order.userProfile || {};
        const customerName = userProfile.fullName || order.userId;
        const shopName = userProfile.shopName || 'Non spécifié';
        const email = userProfile.email || 'Non spécifié';
        const phone = userProfile.phone || 'Non spécifié';
        
        // Créer l'élément de commande
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
        
        // Ajouter l'élément au conteneur
        orderListContainer.appendChild(orderItem);
    });
    
    // Configurer les actions sur les commandes
    setupOrderActions();
}

/**
 * Configure les écouteurs d'événements pour les actions sur les commandes
 */
function setupOrderActions() {
    // Trouver tous les boutons de traitement
    const processButtons = document.querySelectorAll('.process-btn');
    
    // Ajouter des écouteurs pour chaque bouton
    processButtons.forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            
            // Appeler la fonction de traitement de commande
            OrderProcess.processOrder(orderId, userId);
        });
    });
}

/**
 * Rafraîchit la liste des commandes 
 * (utilisé après le traitement d'une commande)
 */
function refreshOrderList() {
    loadPendingOrders();
}

// Exposer les fonctions publiques
export {
    loadPendingOrders,
    displayOrders,
    refreshOrderList
};