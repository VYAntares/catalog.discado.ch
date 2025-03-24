/**
 * Traitement des commandes en attente
 * admin/js/modules/orders/orderProcess.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as OrderList from './orderList.js';

let orderModal;
let orderDetailsContent;
let orderDetailsTitle;

let currentOrder;
let currentClientProfile;
let quantityInputs = [];
let orderTotalElement;

// Initialise le traitement d'une commande
async function processOrder(orderId, userId) {
    try {
        const clientProfile = await API.fetchClientDetails(userId);
        
        const orders = await API.fetchPendingOrders();
        const order = orders.find(o => o.orderId === orderId);
        
        if (!order) {
            throw new Error(`Commande ${orderId} non trouvée`);
        }
        
        showProcessOrderModal(order, clientProfile);
    } catch (error) {
        Notification.showNotification('Erreur lors du chargement des détails', 'error');
    }
}

// Affiche la modale de traitement de commande
function showProcessOrderModal(order, clientProfile) {
    currentOrder = order;
    currentClientProfile = clientProfile;
    
    orderModal = document.getElementById('orderModal');
    orderDetailsContent = document.getElementById('orderDetailsContent');
    orderDetailsTitle = document.getElementById('orderDetailsTitle');
    
    if (!orderModal || !orderDetailsContent) {
        return;
    }
    
    const orderDate = Formatter.formatDate(order.date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    orderDetailsContent.innerHTML = `
        <div class="order-process-container">
            <div class="order-header">
                <h1>Détails de la Commande #${order.orderId}</h1>
                <div class="order-info">
                    <span class="order-date">Commandé le ${orderDate}</span>
                    ${order.reference ? `<span class="order-reference"> | Référence: ${order.reference}</span>` : ''}
                </div>
            </div>

            <div class="client-info-grid">
                <div class="client-info-card">
                    <h3>Informations Personnelles</h3>
                    <div class="info-row">
                        <strong>Nom Complet:</strong> 
                        <span>${clientProfile.firstName} ${clientProfile.lastName}</span>
                    </div>
                    <div class="info-row">
                        <strong>Email:</strong> 
                        <a href="mailto:${clientProfile.email}">${clientProfile.email}</a>
                    </div>
                    <div class="info-row">
                        <strong>Téléphone:</strong> 
                        <a href="tel:${clientProfile.phone}">${clientProfile.phone}</a>
                    </div>
                </div>

                <div class="client-info-card">
                    <h3>Informations de la Boutique</h3>
                    <div class="info-row">
                        <strong>Nom de la Boutique:</strong> 
                        <span>${clientProfile.shopName}</span>
                    </div>
                    <div class="info-row">
                        <strong>Adresse:</strong> 
                        <span>${clientProfile.shopAddress}, ${clientProfile.shopCity} ${clientProfile.shopZipCode}</span>
                    </div>
                    <div class="info-row">
                        <strong>Dernière Mise à Jour:</strong> 
                        <span>${Formatter.formatDate(clientProfile.lastUpdated)}</span>
                    </div>
                </div>
            </div>

            <div class="order-items-section">
                <h2>Articles de la Commande</h2>
                <table class="process-order-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Article</th>
                            <th>Qty Demandé</th>
                            <th>Qty Livré</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${generateItemsByCategory(order.items)}
                    </tbody>
                </table>
            </div>
            
            <div class="order-summary">
                <div class="order-total">
                    <span>Total Commande:</span>
                    <strong>0.00 CHF</strong>
                </div>
            </div>
            
            <div class="order-process-actions">
                <button class="action-btn secondary-btn cancel-btn">
                    <i class="fas fa-times"></i> Annuler
                </button>
                <button class="action-btn primary-btn validate-delivery" 
                        data-order-id="${order.orderId}" 
                        data-user-id="${order.userId}">
                    <i class="fas fa-check"></i> Valider la Livraison
                </button>
            </div>
        </div>
    `;
    
    Modal.showModal(orderModal);
    
    quantityInputs = document.querySelectorAll('.delivered-quantity');
    orderTotalElement = document.querySelector('.order-total strong');
    
    setupQuantityEvents();
    setupActionButtons();
}

// Configure les gestionnaires d'événements pour les champs de quantité
function setupQuantityEvents() {
    document.querySelectorAll('.max-quantity-btn').forEach(button => {
        button.addEventListener('click', function() {
            const row = this.closest('tr');
            const quantityInput = row.querySelector('.delivered-quantity');
            const maxQuantity = parseInt(this.getAttribute('data-max-quantity'), 10);
            
            quantityInput.value = maxQuantity;
            
            row.classList.remove('item-unavailable');
            row.classList.add('delivered-item');
            quantityInput.disabled = false;
            
            calculateOrderTotal();
        });
    });
    
    document.querySelectorAll('.unavailable-btn').forEach(button => {
        button.addEventListener('click', function() {
            handleUnavailableItem(this);
        });
    });
    
    quantityInputs.forEach(input => {
        input.addEventListener('input', function() {
            const max = parseInt(this.getAttribute('data-max-quantity'), 10);
            const currentValue = parseInt(this.value, 10) || 0;
            
            const row = this.closest('tr');
            
            if (currentValue > max) {
                row.classList.add('exceeds-ordered');
                row.classList.remove('delivered-item');
            } else if (currentValue > 0) {
                row.classList.add('delivered-item');
                row.classList.remove('item-unavailable', 'exceeds-ordered');
            } else {
                row.classList.remove('delivered-item', 'exceeds-ordered');
            }
            
            calculateOrderTotal();
        });
    });
}

// Configure les gestionnaires pour les boutons d'action
function setupActionButtons() {
    const cancelBtn = document.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            Modal.hideModal(orderModal);
        });
    }
    
    const validateBtn = document.querySelector('.validate-delivery');
    if (validateBtn) {
        validateBtn.addEventListener('click', validateDelivery);
    }
}

// Gère les articles indisponibles
function handleUnavailableItem(button) {
    const row = button.closest('tr');
    const quantityInput = row.querySelector('.delivered-quantity');
    
    row.classList.add('item-unavailable');
    
    row.classList.remove('delivered-item');
    
    quantityInput.value = '0';
    quantityInput.disabled = true;
    row.dataset.unavailable = 'true';
    
    calculateOrderTotal();
}

// Calcule le total de la commande en fonction des quantités livrées
function calculateOrderTotal() {
    let totalAmount = 0;
    
    quantityInputs.forEach(input => {
        if (!input.disabled) {
            const quantity = parseInt(input.value, 10) || 0;
            const price = parseFloat(input.getAttribute('data-item-price'));
            totalAmount += quantity * price;
        }
    });
    
    orderTotalElement.textContent = `${totalAmount.toFixed(2)} CHF`;
    
    return totalAmount;
}

// Vérifie si tous les articles sont marqués comme indisponibles
function areAllItemsUnavailable() {
    const allItems = document.querySelectorAll('.process-order-table tbody tr');
    const unavailableItems = document.querySelectorAll('.process-order-table tbody tr.item-unavailable');
    
    return allItems.length > 0 && allItems.length === unavailableItems.length;
}

// Valide la livraison et envoie les données au serveur
async function validateDelivery() {
    try {
        const orderId = currentOrder.orderId;
        const userId = currentOrder.userId;
        
        let hasDeliveredItems = false;
        const deliveredItems = [];
        
        document.querySelectorAll('.delivered-quantity:not(:disabled)').forEach(input => {
            const quantity = parseInt(input.value, 10);
            if (quantity > 0) {
                hasDeliveredItems = true;
                deliveredItems.push({
                    Nom: input.getAttribute('data-item-name'),
                    quantity: quantity,
                    prix: input.getAttribute('data-item-price')
                });
            }
        });
        
        const allUnavailable = areAllItemsUnavailable();
        
        const validateBtn = document.querySelector('.validate-delivery');
        if (validateBtn) {
            validateBtn.disabled = true;
            validateBtn.textContent = 'Traitement en cours...';
        }
        
        const result = await API.processOrder(orderId, userId, deliveredItems);
        
        if (result.success) {
            Modal.hideModal(orderModal);
            
            OrderList.refreshOrderList();
        } else {
            Notification.showNotification('Erreur lors du traitement: ' + (result.message || 'Veuillez réessayer'), 'error');
            
            if (validateBtn) {
                validateBtn.disabled = false;
                validateBtn.innerHTML = '<i class="fas fa-check"></i> Valider la Livraison';
            }
        }
    } catch (error) {
        Notification.showNotification('Erreur lors du traitement de la commande', 'error');
        
        const validateBtn = document.querySelector('.validate-delivery');
        if (validateBtn) {
            validateBtn.disabled = false;
            validateBtn.innerHTML = '<i class="fas fa-check"></i> Valider la Livraison';
        }
    }
}

// Affiche l'image du produit en grand format dans une modal
function showProductImage(imageSrc, productName) {
    let imageModal = document.getElementById('productImageModal');
    
    if (!imageModal) {
        imageModal = document.createElement('div');
        imageModal.id = 'productImageModal';
        imageModal.className = 'product-image-modal';
        
        imageModal.innerHTML = `
            <div class="image-modal-content">
                <span class="close-image-modal">&times;</span>
                <h3 class="image-modal-title"></h3>
                <div class="image-container">
                    <img src="" alt="" class="product-full-image">
                </div>
            </div>
        `;
        
        document.body.appendChild(imageModal);
        
        const closeBtn = imageModal.querySelector('.close-image-modal');
        closeBtn.addEventListener('click', () => {
            imageModal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === imageModal) {
                imageModal.style.display = 'none';
            }
        });
    }
    
    const fullImage = imageModal.querySelector('.product-full-image');
    const title = imageModal.querySelector('.image-modal-title');
    
    fullImage.src = imageSrc;
    title.textContent = productName;
    
    imageModal.style.display = 'flex';
}

// Génère le HTML pour afficher les articles groupés par catégorie
function generateItemsByCategory(items) {
    const groupedItems = {};
    items.forEach(item => {
        const category = item.categorie || 'autres';
        if (!groupedItems[category]) {
            groupedItems[category] = [];
        }
        groupedItems[category].push(item);
    });

    let html = '';
    
    const sortedCategories = Object.keys(groupedItems).sort();
    
    sortedCategories.forEach(category => {
        html += `
            <tr class="category-header">
                <td colspan="5" class="category-section">${category.charAt(0).toUpperCase() + category.slice(1)}</td>
            </tr>
        `;
        
        groupedItems[category].forEach(item => {
            const shortName = item.Nom.split(' - ')[0];
            
            const productName = item.Nom || "Product without name";
            const productPrice = item.prix || "0.00";
            
            const productParts = shortName.split(' ');
            const productType = productParts[0].toLowerCase();
            
            let productNumber = '';
            if (productParts.length > 1) {
              const match = productParts[1].match(/(\d+[A-Za-z]*)/);
              if (match) {
                productNumber = match[0];
              }
            }
            
            let productImage = '/images/products/';
            
            if (productType === 'keyring') {
                productImage += `keyring/PC${productNumber}.jpg`;
            } 
            else if (productType === 'magnet') {
				productImage = `/images/products/magnet/M${productNumber}.jpg`;
			}
            else if (productType === 'caps') {
                productImage += `caps/C${productNumber}.jpg`;
            } 
            else {
                const capitalizedType = productType.charAt(0).toUpperCase() + productType.slice(1);
                productImage += `${productType}/${capitalizedType}${productNumber}.jpg`;
            }
            
            html += `
                <tr data-item-name="${item.Nom}">
                    <td class="product-image-cell">
                        <img src="${productImage}"
                            alt="${shortName}"
                            class="product-thumbnail"
                            onerror="this.src='/public/images/products/placeholder.jpg';this.onerror='';"
                            onclick="showProductImage('${productImage}', '${shortName}')"
                            title="${item.Nom}"
                        >
                    </td>
                    <td>
                        <div class="item-details">
                            <span class="item-name" title="${item.Nom}">${shortName}</span>
                            <span class="item-price">${Formatter.formatPrice(item.prix)} CHF</span>
                        </div>
                    </td>
                    <td class="quantity-cell">${item.quantity}</td>
                    <td>
                        <input
                            type="number"
                            min="0"
                            value="0"
                            class="delivered-quantity"
                            data-item-name="${item.Nom}"
                            data-item-price="${item.prix}"
                            data-max-quantity="${item.quantity}"
                            pattern="[0-9]*"
                            inputmode="numeric"
                            onfocus="if(this.value === '0') this.value = ''"
                            onblur="if(this.value === '') this.value = '0'"
                        >
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="max-quantity-btn" data-max-quantity="${item.quantity}">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="unavailable-btn" data-item-name="${item.Nom}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    });
    
    return html;
}

window.showProductImage = showProductImage;

export {
    processOrder,
    showProcessOrderModal,
    calculateOrderTotal,
    validateDelivery,
    handleUnavailableItem,
    showProductImage
};