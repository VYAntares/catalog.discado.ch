/**
 * Visualisation détaillée d'une commande de l'historique
 * admin/js/modules/history/historyView.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as OrderEdit from '../clients/clientOrderEdit.js';

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
    
    const totalAmount = (order.deliveredItems || []).reduce((total, item) => {
        return total + (parseFloat(item.prix) * item.quantity);
    }, 0).toFixed(2);
    
    let statusText = 'COMPLÈTE';
    let statusClass = 'status-completed';
    
    if (order.remainingItems && order.remainingItems.length > 0) {
        statusText = 'PARTIELLEMENT LIVRÉE';
        statusClass = 'status-partial';
    }
    
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

        <div class="order-items-section">
            <h3 class="section-title">Articles livrés</h3>
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
                const itemTotal = (parseFloat(item.prix) * item.quantity).toFixed(2);
                
                detailsHTML += `
                    <tr data-product-name="${item.Nom}">
                        <td class="qty-column">${item.quantity}</td>
                        <td class="product-column">
                            <span class="product-name">${item.Nom}</span>
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
    `;
    
    if (order.remainingItems && order.remainingItems.length > 0) {
        detailsHTML += `
            <div class="pending-items-section">
                <h3 class="section-title pending-title">Articles en attente</h3>
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
                detailsHTML += `
                    <tr class="pending-item">
                        <td class="qty-column">${item.quantity}</td>
                        <td class="product-column">
                            <span class="product-name">${item.Nom}</span>
                        </td>
                        <td class="unit-price-column">${Formatter.formatPrice(item.prix)} CHF</td>
                        <td class="total-column">En attente</td>
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
        `;
    }
    
    detailsHTML += `
        <div class="order-summary">
            <div class="order-total">
                <span class="order-total-label">Total livré</span>
                <span class="order-total-amount">${totalAmount} CHF</span>
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
                </div>
            </div>
        </div>

        <div class="order-actions-footer">
            <button class="edit-order-btn" id="editOrderBtn" data-order-id="${order.orderId}" data-user-id="${order.userId}">
                <i class="fas fa-edit"></i> Modifier la commande
            </button>
            <a href="${API.getInvoiceDownloadLink(order.orderId, order.userId)}" 
               class="download-invoice-btn" 
               target="_blank">
                <i class="fas fa-file-pdf"></i> Télécharger la Facture
            </a>
            <button class="close-detail-btn" id="closeOrderDetailBtn">
                <i class="fas fa-times"></i> Fermer
            </button>
        </div>
    `;
    
    container.innerHTML = detailsHTML;
    
    // Marquer le conteneur avec l'ID de commande pour l'édition
    container.setAttribute('data-order-id', order.orderId);
    
    // Ajouter le gestionnaire pour le bouton d'édition
    const editBtn = container.querySelector('.edit-order-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            
            // Activer l'édition
            OrderEdit.enableOrderEditing(orderId, userId);
            
            // Changer le texte du bouton
            this.innerHTML = '<i class="fas fa-check"></i> Mode édition activé';
            this.disabled = true;
            this.style.backgroundColor = '#28a745';
            
            Notification.showNotification('Mode édition activé - Cliquez sur les cellules pour modifier', 'info');
        });
    }
    
    // Ajouter le gestionnaire d'événement au bouton Fermer
    const closeBtn = container.querySelector('.close-detail-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('orderModal').style.display = 'none';
        });
    }
    
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .order-detail-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #2575fc;
        }
        
        .order-number {
            font-size: 22px;
            font-weight: 700;
            color: #2575fc;
            margin-bottom: 5px;
        }
        
        .order-dates {
            color: #666;
            font-size: 14px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }
        
        .status-completed {
            background-color: #d4edda;
            color: #155724;
        }
        
        .status-partial {
            background-color: #fff3cd;
            color: #856404;
        }
        
        .section-title {
            margin: 20px 0 15px;
            font-size: 18px;
            color: #333;
            font-weight: 600;
        }
        
        .pending-title {
            color: #856404;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .items-table th {
            background-color: #f8f9fa;
            padding: 12px 15px;
            text-align: left;
            border-bottom: 2px solid #e1e8ed;
            font-weight: 600;
            color: #666;
        }
        
        .items-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e1e8ed;
        }
        
        .items-table tr:last-child td {
            border-bottom: none;
        }
        
        .qty-column {
            width: 10%;
            text-align: center;
        }
        
        .product-column {
            width: 50%;
        }
        
        .unit-price-column, .total-column {
            width: 20%;
            text-align: right;
        }
        
        .pending-table th, .pending-table td {
            background-color: #fff8e6;
        }
        
        .pending-notice {
            background-color: #fff8e6;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 10px 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .client-detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .client-detail-item {
            background-color: #f8f9fa;
            padding: 12px 15px;
            border-radius: 6px;
        }
        
        .client-detail-label {
            display: block;
            color: #666;
            font-size: 13px;
            margin-bottom: 5px;
        }
        
        .client-detail-value {
            display: block;
            font-weight: 500;
        }
        
        .order-summary {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            text-align: right;
        }
        
        .order-total-label {
            font-weight: 600;
            margin-right: 15px;
        }
        
        .order-total-amount {
            font-size: 20px;
            font-weight: 700;
            color: #28a745;
        }
        
        .order-actions-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            border-top: 1px solid #e1e8ed;
            padding-top: 20px;
            gap: 10px;
        }
        
        .edit-order-btn {
            background-color: #ff9800;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        
        .edit-order-btn:hover {
            background-color: #e68900;
            transform: translateY(-2px);
        }
        
        .edit-order-btn:disabled {
            background-color: #28a745;
            cursor: not-allowed;
            transform: none;
        }
        
        .download-invoice-btn {
            background-color: #28a745;
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .download-invoice-btn:hover {
            background-color: #218838;
        }
        
        .close-detail-btn {
            background-color: #6c757d;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .close-detail-btn:hover {
            background-color: #5a6268;
        }
        
        .no-items {
            text-align: center;
            color: #666;
            padding: 20px;
        }
        
        /* Styles pour l'édition */
        .order-detail-editable {
            cursor: pointer;
            position: relative;
            transition: background-color 0.2s;
        }
        
        .order-detail-editable:hover {
            background-color: #fff9e6 !important;
            box-shadow: inset 0 0 0 2px #ffd700;
        }
        
        .order-detail-editable::after {
            content: '✎';
            position: absolute;
            right: 4px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0;
            transition: opacity 0.2s;
            font-size: 12px;
            color: #999;
        }
        
        .order-detail-editable:hover::after {
            opacity: 1;
        }
        
        .inline-order-edit-input {
            width: 100%;
            padding: 6px 8px;
            border: 2px solid #2575fc;
            border-radius: 4px;
            font-size: 13px;
            font-family: inherit;
            box-sizing: border-box;
        }
        
        .inline-order-edit-input:focus {
            outline: none;
            border-color: #1a5cb8;
            box-shadow: 0 0 0 3px rgba(37, 117, 252, 0.2);
        }
        
        .save-order-changes-btn {
            background-color: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        
        .save-order-changes-btn:hover {
            background-color: #218838;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .save-order-changes-btn:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
            transform: none;
        }
        
        .order-modified-indicator {
            display: inline-block;
            background-color: #ff9800;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        @media (max-width: 768px) {
            .order-detail-header {
                flex-direction: column;
            }
            
            .order-status {
                margin-top: 10px;
            }
            
            .client-detail-grid {
                grid-template-columns: 1fr;
            }
            
            .items-table {
                font-size: 14px;
            }
            
            .items-table th, .items-table td {
                padding: 8px;
            }
            
            .order-actions-footer {
                flex-direction: column;
            }
        }
    `;
    
    container.appendChild(styleEl);
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