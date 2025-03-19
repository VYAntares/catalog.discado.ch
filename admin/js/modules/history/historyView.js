/**
 * Visualisation détaillée d'une commande de l'historique
 * Ce module gère l'affichage des détails d'une commande traitée
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';

/**
 * Affiche les détails d'une commande
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 */
async function viewOrderDetails(orderId, userId) {
    // Obtenir les références DOM
    const orderModal = document.getElementById('orderModal');
    const orderDetailsContent = document.getElementById('orderModalContent');
    
    if (!orderModal) {
        console.error("Modal de détails de commande non trouvée");
        Notification.showNotification("Erreur: Modal de détails non trouvée", "error");
        return;
    }
    
    // Si orderDetailsContent n'existe pas, essayons de trouver un autre conteneur dans la modale
    let contentContainer = orderDetailsContent;
    if (!contentContainer) {
        contentContainer = orderModal.querySelector('.modal-content');
        // Si on trouve toujours pas de conteneur, on en crée un
        if (!contentContainer) {
            const newContent = document.createElement('div');
            newContent.id = 'orderModalContent';
            newContent.className = 'order-modal-content';
            
            // Si la modale a une structure basique, on ajoute notre conteneur
            if (orderModal.firstElementChild) {
                orderModal.firstElementChild.appendChild(newContent);
            } else {
                const modalContent = document.createElement('div');
                modalContent.className = 'modal-content';
                modalContent.innerHTML = `
                    <span class="close-order-modal" onclick="document.getElementById('orderModal').style.display='none'">&times;</span>
                    <h2 class="order-details-title">Détails de la commande</h2>
                `;
                modalContent.appendChild(newContent);
                orderModal.appendChild(modalContent);
            }
            contentContainer = newContent;
        }
    }
    
    // Afficher l'indicateur de chargement
    contentContainer.innerHTML = `<div class="loading">Chargement des détails...</div>`;
    
    // Afficher la modale - d'abord essayer la fonction du module Modal
    try {
        Modal.showModal(orderModal);
    } catch (e) {
        // Fallback en cas d'erreur - afficher manuellement
        orderModal.style.display = 'flex';
    }
    
    try {
        // Récupérer les détails de la commande
        const orderDetails = await API.fetchOrderDetails(orderId, userId);
        
        // Afficher les détails de la commande
        displayOrderDetails(orderDetails, contentContainer);
    } catch (error) {
        console.error('Erreur lors du chargement des détails de la commande:', error);
        
        // Afficher un message d'erreur
        contentContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails de la commande.</p>
                <p>Détails: ${error.message || "Erreur inconnue"}</p>
                <button class="action-btn retry-btn" onclick="window.viewOrderDetails('${orderId}', '${userId}')">
                    <i class="fas fa-sync"></i> Réessayer
                </button>
            </div>
        `;
        
        // Notification d'erreur
        Notification.showNotification("Erreur lors du chargement des détails", "error");
    }
}

/**
 * Affiche les détails d'une commande dans la modale
 * @param {Object} order - Détails de la commande
 * @param {HTMLElement} container - Conteneur pour afficher les détails
 */
function displayOrderDetails(order, container) {
    // Formater les dates pour l'affichage (garder cette partie inchangée)
    const orderDate = Formatter.formatDate(order.date);
    const processDate = Formatter.formatDate(order.lastProcessed);
    
    // Calculer le montant total uniquement pour les articles livrés (garder cette partie inchangée)
    const totalAmount = (order.deliveredItems || []).reduce((total, item) => {
        return total + (parseFloat(item.prix) * item.quantity);
    }, 0).toFixed(2);
    
    // Déterminer le statut de la commande (garder cette partie inchangée)
    let statusText = 'COMPLÈTE';
    let statusClass = 'status-completed';
    
    if (order.remainingItems && order.remainingItems.length > 0) {
        statusText = 'PARTIELLEMENT LIVRÉE';
        statusClass = 'status-partial';
    }
    
    // Construire le contenu HTML des détails de la commande
    let detailsHTML = `
        <div class="order-detail-header">
            <div class="order-detail-title">
                <div class="order-number">Commande #${order.orderId}</div>
                <div class="order-dates">
                    <div>Commandée le: ${orderDate}</div>
                    <div>Traitée le: ${processDate || '-'}</div>
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
    
    // Ajouter les articles livrés groupés par catégorie
    if (order.deliveredItems && order.deliveredItems.length > 0) {
        // Grouper les articles par catégorie
        const groupedItems = {};
        order.deliveredItems.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedItems[category]) {
                groupedItems[category] = [];
            }
            groupedItems[category].push(item);
        });
        
        // Trier les catégories par ordre alphabétique
        const sortedCategories = Object.keys(groupedItems).sort();
        
        // Ajouter chaque catégorie et ses articles
        sortedCategories.forEach(category => {
            detailsHTML += `
                <tr>
                    <td colspan="4" class="category-section">
                        ${category.charAt(0).toUpperCase() + category.slice(1)}
                    </td>
                </tr>
            `;
            
            groupedItems[category].forEach(item => {
                const itemTotal = (parseFloat(item.prix) * item.quantity).toFixed(2);
                
                detailsHTML += `
                    <tr>
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
    
    // Ajouter la section des articles en attente s'il y en a
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
        
        // Grouper les articles en attente par catégorie
        const groupedRemainingItems = {};
        order.remainingItems.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedRemainingItems[category]) {
                groupedRemainingItems[category] = [];
            }
            groupedRemainingItems[category].push(item);
        });
        
        // Trier les catégories par ordre alphabétique
        const sortedRemainingCategories = Object.keys(groupedRemainingItems).sort();
        
        // Ajouter chaque catégorie et ses articles
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
    
    // Ajouter le total et les informations du client
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
            <a href="${API.getInvoiceDownloadLink(order.orderId, order.userId)}" 
               class="download-invoice-btn" 
               target="_blank">
                <i class="fas fa-file-pdf"></i> Télécharger la Facture
            </a>
            <button class="close-detail-btn" onclick="document.getElementById('orderModal').style.display='none'">
                <i class="fas fa-times"></i> Fermer
            </button>
        </div>
    `;
    
    // Mettre à jour le contenu de la modale
    container.innerHTML = detailsHTML;
    
    // Ajouter des styles spécifiques pour la modale de détails
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
        }
    `;
    
    container.appendChild(styleEl);
}

/**
 * Afficher les détails d'une commande directement depuis la vue client
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID du client
 */
function showOrderDetailsFromClientView(orderId, userId) {
    // Vérifier si la modale existe
    let orderModal = document.getElementById('orderModal');
    
    // Si la modale n'existe pas, la créer
    if (!orderModal) {
        // Créer la structure HTML de la modale
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
        
        // Ajouter la modale au DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        // Récupérer la référence mise à jour
        orderModal = document.getElementById('orderModal');
        
        // Ajouter le gestionnaire d'événement pour fermer la modale
        const closeBtn = orderModal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                orderModal.style.display = 'none';
            });
        }
        
        // Fermeture en cliquant à l'extérieur
        window.addEventListener('click', function(event) {
            if (event.target === orderModal) {
                orderModal.style.display = 'none';
            }
        });
    }
    
    // Afficher la modale
    orderModal.style.display = 'block';
    
    // Utiliser directement la fonction viewOrderDetails 
    // (qui existe dans le même fichier)
    viewOrderDetails(orderId, userId);
}

/**
 * Génère le lien de téléchargement de facture
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 * @returns {string} URL de téléchargement
 */
function generateInvoiceLink(orderId, userId) {
    return API.getInvoiceDownloadLink(orderId, userId);
}

// Exposer les fonctions dans window pour les rendres accessibles depuis HTML
window.viewOrderDetails = viewOrderDetails;
window.showOrderDetailsFromClientView = showOrderDetailsFromClientView;


// Exposer les fonctions publiques
export {
    viewOrderDetails,
    displayOrderDetails,
    generateInvoiceLink,
    showOrderDetailsFromClientView
};