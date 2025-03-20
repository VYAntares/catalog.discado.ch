/**
 * Traitement des commandes en attente
 * Ce module gère le traitement et la validation des commandes
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as OrderList from './orderList.js';

// Références DOM
let orderModal;
let orderDetailsContent;
let orderDetailsTitle;

// Variables pour le traitement
let currentOrder;
let currentClientProfile;
let quantityInputs = [];
let orderTotalElement;

/**
 * Initialise le traitement d'une commande
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 */
async function processOrder(orderId, userId) {
    try {
        // Récupérer les détails du client
        const clientProfile = await API.fetchClientDetails(userId);
        
        // Récupérer les commandes en attente pour trouver celle qui correspond
        const orders = await API.fetchPendingOrders();
        const order = orders.find(o => o.orderId === orderId);
        
        if (!order) {
            throw new Error(`Commande ${orderId} non trouvée`);
        }
        
        // Afficher la modale de traitement
        showProcessOrderModal(order, clientProfile);
    } catch (error) {
        console.error('Erreur lors du chargement des détails:', error);
        Notification.showNotification('Erreur lors du chargement des détails', 'error');
    }
}

function showProcessOrderModal(order, clientProfile) {
    // Stocker les références pour utilisation ultérieure
    currentOrder = order;
    currentClientProfile = clientProfile;
    
    // Obtenir les références DOM
    orderModal = document.getElementById('orderModal');
    orderDetailsContent = document.getElementById('orderDetailsContent');
    orderDetailsTitle = document.getElementById('orderDetailsTitle');
    
    if (!orderModal || !orderDetailsContent) {
        console.error("Modal de commande non trouvée");
        return;
    }
    
    // Formater la date pour l'affichage
    const orderDate = Formatter.formatDate(order.date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Construire le contenu de la modale
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
    
    // Afficher la modale
    Modal.showModal(orderModal);
    
    // Stocker les références aux éléments DOM importants
    quantityInputs = document.querySelectorAll('.delivered-quantity');
    orderTotalElement = document.querySelector('.order-total strong');
    
    // Configurer les gestionnaires d'événements
    setupQuantityEvents();
    setupActionButtons();
}

/**
 * Configure les gestionnaires d'événements pour les champs de quantité
 */
function setupQuantityEvents() {
    // Ajouter des écouteurs pour les boutons de quantité maximale
    document.querySelectorAll('.max-quantity-btn').forEach(button => {
        button.addEventListener('click', function() {
            const row = this.closest('tr');
            const quantityInput = row.querySelector('.delivered-quantity');
            const maxQuantity = parseInt(this.getAttribute('data-max-quantity'), 10);
            
            // Mettre à jour la quantité livrée avec la quantité maximale
            quantityInput.value = maxQuantity;
            
            // Retirer la classe d'indisponibilité si présente
            row.classList.remove('item-unavailable');
            // Ajouter la classe delivered-item pour colorer la ligne en vert
            row.classList.add('delivered-item');
            quantityInput.disabled = false;
            
            // Recalculer le total
            calculateOrderTotal();
        });
    });
    
    // Ajouter des écouteurs pour les boutons d'articles indisponibles
    document.querySelectorAll('.unavailable-btn').forEach(button => {
        button.addEventListener('click', function() {
            handleUnavailableItem(this);
        });
    });
    
    // Gestion dynamique du total lors de la modification des quantités
    quantityInputs.forEach(input => {
        input.addEventListener('input', function() {
            // Obtenir la quantité maximale commandée (pour référence)
            const max = parseInt(this.getAttribute('data-max-quantity'), 10);
            const currentValue = parseInt(this.value, 10) || 0;
            
            // Mettre à jour les classes selon la quantité saisie
            const row = this.closest('tr');
            
            if (currentValue > max) {
                // Quantité qui dépasse la commande - style différent
                row.classList.add('exceeds-ordered');
                row.classList.remove('delivered-item');
            } else if (currentValue > 0) {
                // Quantité normale
                row.classList.add('delivered-item');
                row.classList.remove('item-unavailable', 'exceeds-ordered');
            } else {
                // Quantité à zéro
                row.classList.remove('delivered-item', 'exceeds-ordered');
            }
            
            calculateOrderTotal();
        });
    });
}

/**
 * Configure les gestionnaires pour les boutons d'action
 */
function setupActionButtons() {
    // Bouton Annuler
    const cancelBtn = document.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            Modal.hideModal(orderModal);
        });
    }
    
    // Bouton Valider la livraison
    const validateBtn = document.querySelector('.validate-delivery');
    if (validateBtn) {
        validateBtn.addEventListener('click', validateDelivery);
    }
}

/**
 * Gère les articles indisponibles
 * @param {HTMLElement} button - Bouton d'indisponibilité cliqué
 */
function handleUnavailableItem(button) {
    const row = button.closest('tr');
    const quantityInput = row.querySelector('.delivered-quantity');
    
    // Toujours marquer comme indisponible au clic (sans toggle)
    row.classList.add('item-unavailable');
    
    // Retirer la classe 'delivered-item' si elle existe pour éviter le conflit visuel
    row.classList.remove('delivered-item');
    
    // Mettre la quantité à 0 et désactiver le champ
    quantityInput.value = '0';
    quantityInput.disabled = true;
    row.dataset.unavailable = 'true';
    
    // Recalculer le total
    calculateOrderTotal();
}

/**
 * Calcule le total de la commande en fonction des quantités livrées
 */
function calculateOrderTotal() {
    let totalAmount = 0;
    
    // Parcourir tous les champs de quantité
    quantityInputs.forEach(input => {
        if (!input.disabled) {
            const quantity = parseInt(input.value, 10) || 0;
            const price = parseFloat(input.getAttribute('data-item-price'));
            totalAmount += quantity * price;
        }
    });
    
    // Mettre à jour l'affichage du total
    orderTotalElement.textContent = `${totalAmount.toFixed(2)} CHF`;
    
    return totalAmount;
}

/**
 * Vérifie si tous les articles sont marqués comme indisponibles
 */
function areAllItemsUnavailable() {
    const allItems = document.querySelectorAll('.process-order-table tbody tr');
    const unavailableItems = document.querySelectorAll('.process-order-table tbody tr.item-unavailable');
    
    return allItems.length > 0 && allItems.length === unavailableItems.length;
}

/**
 * Valide la livraison et envoie les données au serveur
 */
async function validateDelivery() {
    try {
        const orderId = currentOrder.orderId;
        const userId = currentOrder.userId;
        
        // Vérifier qu'au moins un article est livré ou que tous sont indisponibles
        let hasDeliveredItems = false;
        const deliveredItems = [];
        
        // Récupérer les quantités livrées
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
        
        // Vérifier si tous les articles sont marqués comme indisponibles
        const allUnavailable = areAllItemsUnavailable();
        
        // Désactiver le bouton pendant le traitement
        const validateBtn = document.querySelector('.validate-delivery');
        if (validateBtn) {
            validateBtn.disabled = true;
            validateBtn.textContent = 'Traitement en cours...';
        }
        
        // Envoyer les données au serveur
        const result = await API.processOrder(orderId, userId, deliveredItems);
        
        if (result.success) {
            // Fermer la modale
            Modal.hideModal(orderModal);
            
            // Rafraîchir la liste des commandes
            OrderList.refreshOrderList();
        } else {
            Notification.showNotification('Erreur lors du traitement: ' + (result.message || 'Veuillez réessayer'), 'error');
            
            // Réactiver le bouton
            if (validateBtn) {
                validateBtn.disabled = false;
                validateBtn.innerHTML = '<i class="fas fa-check"></i> Valider la Livraison';
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        Notification.showNotification('Erreur lors du traitement de la commande', 'error');
        
        // Réactiver le bouton
        const validateBtn = document.querySelector('.validate-delivery');
        if (validateBtn) {
            validateBtn.disabled = false;
            validateBtn.innerHTML = '<i class="fas fa-check"></i> Valider la Livraison';
        }
    }
}

/**
 * Affiche l'image du produit en grand format dans une modal
 * @param {string} imageSrc - Source de l'image
 * @param {string} productName - Nom du produit
 */
function showProductImage(imageSrc, productName) {
    // Créer une modal si elle n'existe pas déjà
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
        
        // Ajouter l'écouteur pour fermer
        const closeBtn = imageModal.querySelector('.close-image-modal');
        closeBtn.addEventListener('click', () => {
            imageModal.style.display = 'none';
        });
        
        // Fermer en cliquant en dehors
        window.addEventListener('click', (event) => {
            if (event.target === imageModal) {
                imageModal.style.display = 'none';
            }
        });
    }
    
    // Mettre à jour l'image et le titre
    const fullImage = imageModal.querySelector('.product-full-image');
    const title = imageModal.querySelector('.image-modal-title');
    
    fullImage.src = imageSrc;
    title.textContent = productName;
    
    // Afficher la modal
    imageModal.style.display = 'flex';
}

/**
 * Génère le HTML pour afficher les articles groupés par catégorie
 * @param {Array} items - Tableau d'objets représentant les articles
 * @returns {string} - Code HTML généré
 */
function generateItemsByCategory(items) {
    // Grouper les articles par catégorie
    const groupedItems = {};
    items.forEach(item => {
        const category = item.categorie || 'autres';
        if (!groupedItems[category]) {
            groupedItems[category] = [];
        }
        groupedItems[category].push(item);
    });

    // Générer le HTML
    let html = '';
    
    // Trier les catégories par ordre alphabétique
    const sortedCategories = Object.keys(groupedItems).sort();
    
    sortedCategories.forEach(category => {
        // Ajouter l'en-tête de catégorie
        html += `
            <tr class="category-header">
                <td colspan="5" class="category-section">${category.charAt(0).toUpperCase() + category.slice(1)}</td>
            </tr>
        `;
        
        // Ajouter les articles de cette catégorie
        groupedItems[category].forEach(item => {
            // Extraire la partie du nom avant le premier tiret
            const shortName = item.Nom.split(' - ')[0];
            
            // Exactement comme dans displayProducts
            const productName = item.Nom || "Product without name";
            const productPrice = item.prix || "0.00";
            
            // === RÉSOLUTION DU PROBLÈME D'IMAGE ===
            // 1. Identifier le produit au format standard (comme dans votre base de données)
            const productParts = shortName.split(' ');
            const productType = productParts[0].toLowerCase(); // "bags", "magnet", etc.
            
            // 2. Extraire le numéro du produit 
            // Par exemple: "Bags 312" -> "312"
            let productNumber = '';
            if (productParts.length > 1) {
              // Modifier cette ligne pour capturer les chiffres ET les lettres qui suivent
              // Utiliser une expression régulière qui capture les chiffres suivis de lettres optionnelles
              const match = productParts[1].match(/(\d+[A-Za-z]*)/);
              if (match) {
                productNumber = match[0]; // Cela va prendre "312A" dans "Bags 312A"
              }
            }
            
            // 3. Construire le chemin d'image basé sur le format standard de votre base de données
            let productImage = '/images/products/';
            
            // Si c'est "Keyring", le format est un peu différent (PC suivi du numéro)
            if (productType === 'keyring') {
                productImage += `keyring/PC${productNumber}.jpg`;
            } 
            else if (productType === 'magnet') {
				productImage = `/images/products/magnet/M${productNumber}.jpg`;
			}
            else if (productType === 'caps') {
                productImage += `caps/C${productNumber}.jpg`;
            } 
            // Pour les autres types (bags, caps, etc.), c'est la première lettre majuscule du type suivie du numéro
            else {
                const capitalizedType = productType.charAt(0).toUpperCase() + productType.slice(1);
                productImage += `${productType}/${capitalizedType}${productNumber}.jpg`;
            }
            
            // Log pour debug
            console.log(`Produit: ${item.Nom}, Chemin d'image généré: ${productImage}`);
            
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

// Ajouter la fonction au window pour qu'elle soit accessible depuis le HTML
window.showProductImage = showProductImage;

// Exposer les fonctions publiques
export {
    processOrder,
    showProcessOrderModal,
    calculateOrderTotal,
    validateDelivery,
    handleUnavailableItem,
    showProductImage
};