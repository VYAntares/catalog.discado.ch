/**
 * Visualisation détaillée d'une commande de l'historique
 * admin/js/modules/history/historyView.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as OrderEdit from '../clients/clientOrderEdit.js';
// downloadOrShareFile is loaded globally from inline <script> in HTML page

//Affiche les détails d'une commande
async function viewOrderDetails(orderId, userId) {
    const orderModal = document.getElementById('orderModal');
    const orderDetailsContent = document.getElementById('orderModalContent');
    
    if (!orderModal) {
        Notification.showNotification("Erreur: Modal de détails non trouvée", "error");
        return;
    }
    
    let contentContainer = orderDetailsContent;
    if (!contentContainer) {
        contentContainer = orderModal.querySelector('.modal-content');
        if (!contentContainer) {
            const newContent = document.createElement('div');
            newContent.id = 'orderModalContent';
            newContent.className = 'order-modal-content';
            
            if (orderModal.firstElementChild) {
                orderModal.firstElementChild.appendChild(newContent);
            } else {
                const modalContent = document.createElement('div');
                modalContent.className = 'modal-content';
                const closeBtn = document.createElement('span');
                closeBtn.className = 'close-order-modal';
                closeBtn.innerHTML = '&times;';
                closeBtn.addEventListener('click', function() {
                    document.getElementById('orderModal').style.display = 'none';
                });
                
                const title = document.createElement('h2');
                title.className = 'order-details-title';
                title.textContent = 'Détails de la commande';
                
                modalContent.appendChild(closeBtn);
                modalContent.appendChild(title);
                modalContent.appendChild(newContent);
                orderModal.appendChild(modalContent);
            }
            contentContainer = newContent;
        }
    }
    
    contentContainer.innerHTML = `<div class="loading">Chargement des détails...</div>`;
    
    try {
        Modal.showModal(orderModal);
    } catch (e) {
        orderModal.style.display = 'flex';
    }
    
    try {
        const orderDetails = await API.fetchOrderDetails(orderId, userId);
        displayOrderDetails(orderDetails, contentContainer);
    } catch (error) {
        contentContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails de la commande.</p>
                <p>Détails: ${error.message || "Erreur inconnue"}</p>
                <button class="action-btn retry-btn" data-order-id="${orderId}" data-user-id="${userId}">
                    <i class="fas fa-sync"></i> Réessayer
                </button>
            </div>
        `;
        
        const retryBtn = contentContainer.querySelector('.retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', function() {
                const orderId = this.getAttribute('data-order-id');
                const userId = this.getAttribute('data-user-id');
                viewOrderDetails(orderId, userId);
            });
        }
        
        Notification.showNotification("Erreur lors du chargement des détails", "error");
    }
}

//Affiche les détails d'une commande dans la modale
function displayOrderDetails(order, container) {
    const orderDate = Formatter.formatDate(order.date);
    const processDate = Formatter.formatDate(order.lastProcessed);
    
    const totalAmount = Formatter.formatSwissNumber(
        (order.deliveredItems || []).reduce((total, item) => {
            return total + (parseFloat(item.prix) * item.quantity);
        }, 0)
    );
    
    let statusText = 'COMPLÈTE';
    let statusClass = 'status-completed';
    
    if (order.remainingItems && order.remainingItems.length > 0) {
        statusText = 'PARTIELLEMENT LIVRÉE';
        statusClass = 'status-partial';
    }
    
    // Build shop address string
    const shopAddress = order.userProfile?.shopAddress || '';
    const shopCity = order.userProfile?.shopCity || '';
    const shopZipCode = order.userProfile?.shopZipCode || '';
    const fullAddress = [shopAddress, shopZipCode, shopCity].filter(Boolean).join(', ');

    // Count items
    const deliveredCount = (order.deliveredItems || []).length;
    const pendingCount = (order.remainingItems || []).length;

    const pendingTotalAmount = Formatter.formatSwissNumber(
        (order.remainingItems || []).reduce((total, item) => {
            return total + (parseFloat(item.prix) * item.quantity);
        }, 0)
    );

    let detailsHTML = `
        <div class="order-detail-header">
            <div class="order-detail-title">
                <div class="order-number">Commande #${order.orderId}</div>
                <div class="order-dates">
                    <div>Commandée le: ${orderDate}</div>
                    <div>Traitée le: ${processDate || '-'}</div>
                    ${order.reference ? `<div>Référence client: ${order.reference}</div>` : ''}
                </div>
            </div>
            <div class="order-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        </div>

        <div class="client-info-section">
            <h3 class="section-title">Informations du Client</h3>
            <div class="client-details">
                <div class="client-detail-grid">
                    <div class="client-detail-item">
                        <span class="client-detail-label">Nom</span>
                        <span class="client-detail-value">${order.userProfile?.fullName || order.userId || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="client-detail-label">Email</span>
                        <span class="client-detail-value">${order.userProfile?.email || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="client-detail-label">Téléphone</span>
                        <span class="client-detail-value">${order.userProfile?.phone || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="client-detail-label">Boutique</span>
                        <span class="client-detail-value">${order.userProfile?.shopName || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="client-detail-label">Adresse</span>
                        ${fullAddress
                            ? `<a href="https://maps.apple.com/?daddr=${encodeURIComponent(fullAddress)}" class="client-detail-value client-address-link" target="_blank" rel="noopener">${fullAddress}</a>`
                            : `<span class="client-detail-value">N/A</span>`
                        }
                    </div>
                    ${fullAddress ? `
                    <div class="client-detail-item client-detail-map">
                        <a href="/admin/clients-map?openClient=${encodeURIComponent(order.userId)}" class="btn-view-on-map" target="_blank">
                            <i class="fas fa-map-marker-alt"></i> Voir sur la carte
                        </a>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <div class="collapsible-section">
            <div class="collapsible-header" data-target="delivered-items-content">
                <div class="collapsible-title">
                    <i class="fas fa-chevron-right collapsible-icon"></i>
                    <h3 class="section-title">Articles livrés</h3>
                    <span class="collapsible-badge delivered-badge">${deliveredCount}</span>
                    <span class="collapsible-total">${totalAmount} CHF</span>
                </div>
            </div>
            <div class="collapsible-content" id="delivered-items-content" style="display:none;">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="qty-column">Qté</th>
                            <th class="product-column">Produit</th>
                            <th class="unit-price-column">Prix Unitaire</th>
                            <th class="total-column">Total</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (order.deliveredItems && order.deliveredItems.length > 0) {
        const groupedItems = {};
        order.deliveredItems.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedItems[category]) {
                groupedItems[category] = [];
            }
            groupedItems[category].push(item);
        });

        const sortedCategories = Object.keys(groupedItems).sort();

        sortedCategories.forEach(category => {
            detailsHTML += `
                <tr class="category-header">
                    <td colspan="4" class="category-section">
                        ${category.charAt(0).toUpperCase() + category.slice(1)}
                    </td>
                </tr>
            `;

            groupedItems[category].forEach(item => {
                const itemTotal = Formatter.formatSwissNumber(parseFloat(item.prix) * item.quantity);

                const sizePill = item.size ? `<span class="order-detail-size-pill">Taille ${item.size}</span>` : '';
                detailsHTML += `
                    <tr data-product-name="${item.Nom}" data-product-id="${item.product_id || ''}" data-order-item-id="${item.order_item_id || ''}" data-size="${item.size || ''}">
                        <td class="qty-column">${item.quantity}</td>
                        <td class="product-column">
                            <span class="product-name">${item.Nom}</span>${sizePill}
                        </td>
                        <td class="unit-price-column">${Formatter.formatPrice(item.prix)} CHF</td>
                        <td class="total-column">${itemTotal} CHF</td>
                    </tr>
                `;
            });
        });
    } else {
        detailsHTML += `
            <tr>
                <td colspan="4" class="no-items">Aucun article livré</td>
            </tr>
        `;
    }

    detailsHTML += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    if (order.remainingItems && order.remainingItems.length > 0) {
        detailsHTML += `
            <div class="collapsible-section">
                <div class="collapsible-header" data-target="pending-items-content">
                    <div class="collapsible-title">
                        <i class="fas fa-chevron-right collapsible-icon"></i>
                        <h3 class="section-title pending-title">Articles en attente</h3>
                        <span class="collapsible-badge pending-badge">${pendingCount}</span>
                        <span class="collapsible-total pending-total-inline">${pendingTotalAmount} CHF</span>
                    </div>
                </div>
                <div class="collapsible-content" id="pending-items-content" style="display:none;">
                    <table class="items-table pending-table">
                        <thead>
                            <tr>
                                <th class="qty-column">Qté</th>
                                <th class="product-column">Produit</th>
                                <th class="unit-price-column">Prix Unitaire</th>
                                <th class="total-column">Total</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        const groupedRemainingItems = {};
        order.remainingItems.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedRemainingItems[category]) {
                groupedRemainingItems[category] = [];
            }
            groupedRemainingItems[category].push(item);
        });

        const sortedRemainingCategories = Object.keys(groupedRemainingItems).sort();

        sortedRemainingCategories.forEach(category => {
            detailsHTML += `
                <tr>
                    <td colspan="4" class="category-section pending-category">
                        ${category.charAt(0).toUpperCase() + category.slice(1)}
                    </td>
                </tr>
            `;

            groupedRemainingItems[category].forEach(item => {
                const itemTotal = Formatter.formatSwissNumber(parseFloat(item.prix) * item.quantity);
                const sizePill = item.size ? `<span class="order-detail-size-pill">Taille ${item.size}</span>` : '';
                detailsHTML += `
                    <tr class="pending-item" data-size="${item.size || ''}">
                        <td class="qty-column">${item.quantity}</td>
                        <td class="product-column">
                            <span class="product-name">${item.Nom}</span>${sizePill}
                        </td>
                        <td class="unit-price-column">${Formatter.formatPrice(item.prix)} CHF</td>
                        <td class="total-column">${itemTotal} CHF</td>
                    </tr>
                `;
            });
        });

        detailsHTML += `
                        </tbody>
                    </table>
                    <div class="pending-notice">
                        <i class="fas fa-info-circle"></i>
                        Ces articles seront livrés ultérieurement lorsqu'ils seront disponibles.
                    </div>
                </div>
            </div>
        `;
    }

    detailsHTML += `
        <div class="order-summary">
    `;

    if (order.remainingItems && order.remainingItems.length > 0) {
        detailsHTML += `
            <div class="order-total pending-total">
                <span class="order-total-label">Total en attente</span>
                <span class="order-total-amount pending-amount">${pendingTotalAmount} CHF</span>
            </div>
        `;
    }

    detailsHTML += `
            <div class="order-total">
                <span class="order-total-label">Total livré</span>
                <span class="order-total-amount">${totalAmount} CHF</span>
            </div>
        </div>

        <div class="order-actions-footer">
            <button class="edit-order-btn" id="editOrderBtn" data-order-id="${order.orderId}" data-user-id="${order.userId}">
                <i class="fas fa-edit"></i> Modifier la commande
            </button>
            <button class="close-detail-btn" id="closeOrderDetailBtn">
                <i class="fas fa-times"></i> Fermer
            </button>
        </div>
    `;
    
    container.innerHTML = detailsHTML;

    // Marquer le conteneur avec l'ID de commande pour l'édition
    container.setAttribute('data-order-id', order.orderId);

    // Collapsible sections toggle
    container.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const content = document.getElementById(targetId);
            const icon = header.querySelector('.collapsible-icon');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
                header.classList.add('collapsible-open');
            } else {
                content.style.display = 'none';
                icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
                header.classList.remove('collapsible-open');
            }
        });
    });

    // Bouton facture PDF — créé en DOM avec listener direct (comme public/orderList.js)
    const actionsFooter = container.querySelector('.order-actions-footer');
    const dlBtn = document.createElement('button');
    dlBtn.className = 'download-invoice-btn';
    dlBtn.innerHTML = `<i class="fas fa-file-pdf"></i> Télécharger la Facture`;
    dlBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await window.downloadOrShareFile(
                API.getInvoiceDownloadLink(order.orderId, order.userId),
                `Invoice_${order.orderId}.pdf`
            );
        } catch (err) {
            Notification.showNotification('Erreur : ' + err.message, 'error');
        }
    });
    // Insérer avant le bouton Fermer
    const closeDetailBtn = actionsFooter.querySelector('.close-detail-btn');
    actionsFooter.insertBefore(dlBtn, closeDetailBtn);
    
    // Ajouter le gestionnaire pour le bouton d'édition
    const editBtn = container.querySelector('.edit-order-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');

            const isCurrentlyEditing = this.classList.contains('editing-active');

            if (!isCurrentlyEditing) {
                // Activer le mode édition
                OrderEdit.enableOrderEditing(orderId, userId);

                this.innerHTML = '<i class="fas fa-times"></i> Annuler mode édition';
                this.classList.add('editing-active');
                this.style.backgroundColor = '#dc3545';

                Notification.showNotification('Mode édition activé — Cliquez sur les cellules pour modifier', 'info');
            } else {
                // Annuler sans sauvegarder : réafficher la commande depuis les données originales
                OrderEdit.cancelOrderEditing();
                viewOrderDetails(orderId, userId);
            }
        });
    }
    
    // Ajouter le gestionnaire d'événement au bouton Fermer
    const closeBtn = container.querySelector('.close-detail-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('orderModal').style.display = 'none';
        });
    }
    

}

//Affiche les détails d'une commande directement depuis la vue client
function showOrderDetailsFromClientView(orderId, userId) {
    let orderModal = document.getElementById('orderModal');
    
    if (!orderModal) {
        const modalHTML = `
            <div id="orderModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="orderDetailsTitle">Détails de la commande #${orderId}</h2>
                        <span class="close-modal">&times;</span>
                    </div>
                    <div id="orderModalContent" class="modal-body">
                        <div class="loading">Chargement des détails...</div>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        orderModal = document.getElementById('orderModal');
        
        const closeBtn = orderModal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                orderModal.style.display = 'none';
            });
        }
        
        window.addEventListener('click', function(event) {
            if (event.target === orderModal) {
                orderModal.style.display = 'none';
            }
        });
    }
    
    orderModal.style.display = 'block';
    
    viewOrderDetails(orderId, userId);
}

//Génère le lien de téléchargement de facture
function generateInvoiceLink(orderId, userId) {
    return API.getInvoiceDownloadLink(orderId, userId);
}

// Définir le gestionnaire pour les événements de vue des détails
function setupViewDetailHandlers() {
    document.querySelectorAll('.view-order-detail-btn').forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            viewOrderDetails(orderId, userId);
        });
    });
}

// Fonction globale pour exposer viewOrderDetails à window
function initGlobalHandlers() {
    window.viewOrderDetails = function(orderId, userId) {
        viewOrderDetails(orderId, userId);
    };
    
    window.showOrderDetailsFromClientView = function(orderId, userId) {
        showOrderDetailsFromClientView(orderId, userId);
    };
}

// Initialiser les gestionnaires globaux
initGlobalHandlers();

export {
    viewOrderDetails,
    displayOrderDetails,
    generateInvoiceLink,
    showOrderDetailsFromClientView,
    setupViewDetailHandlers
};