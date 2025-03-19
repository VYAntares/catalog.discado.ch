/**
 * Module de gestion du panier
 * Gère toutes les interactions avec le panier d'achat
 */

import { showNotification } from '../../utils/notification.js';
import { 
    getCart, saveCart, addToCart as addToStorage, 
    removeFromCart as removeFromStorage, clearCart,
    getCartTotal, getCartItemCount
} from '../../core/storage.js';
import { formatPrice } from '../../utils/formatter.js';
import { showModal, hideModal, showConfirmModal } from '../../utils/modal.js';
import { initCheckout } from './checkout.js';

/**
 * Initialise le gestionnaire de panier
 */
export function initCartManager() {
    // Initialiser le modal du panier
    setupCartModal();
    
    // Configurer les écouteurs d'événements
    setupEventListeners();
    
    // Initialiser le processus de checkout
    initCheckout();
    
    // Mettre à jour le compteur du panier
    updateCartCountDisplay();
    
    console.log('Cart manager initialized');
}

/**
 * Configure le modal du panier
 */
function setupCartModal() {
    // Trouver tous les boutons qui ouvrent le panier
    const cartToggleButtons = document.querySelectorAll('#cartToggle, .cart-toggle');
    
    cartToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            displayCart();
            
            const cartModal = document.getElementById('cart-modal');
            if (cartModal) {
                showModal(cartModal);
            }
        });
    });
    
    // Événements pour les boutons du panier
    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCartHandler);
    }
    
    document.addEventListener('cartUpdated', updateCartCountDisplay);
}

/**
 * Affiche le contenu du panier dans le modal
 */
export function displayCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) return;
    
    const cart = getCart();
    
    cartItemsContainer.innerHTML = '';
    
    let totalAmount = 0;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
    } else {
        cart.forEach((item, index) => {
            const itemTotal = parseFloat(item.prix) * item.quantity;
            totalAmount += itemTotal;
            
            const cartItemElement = document.createElement('div');
            cartItemElement.className = 'cart-item';
            cartItemElement.innerHTML = `
                <div class="cart-item-quantity">${item.quantity}×</div>
                <div class="cart-item-name">${item.Nom}</div>
                <div class="cart-item-price">${formatPrice(itemTotal)} CHF</div>
                <button class="remove-item-btn" data-index="${index}">×</button>
            `;
            
            cartItemsContainer.appendChild(cartItemElement);
        });
        
        // Ajouter des écouteurs d'événements pour les boutons de suppression
        document.querySelectorAll('.remove-item-btn').forEach(button => {
            button.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeFromCart(index);
            });
        });
    }
    
    // Mettre à jour le montant total
    const totalAmountElement = document.getElementById('cart-total-amount');
    if (totalAmountElement) {
        totalAmountElement.textContent = formatPrice(totalAmount);
    }
    
    // Activer/désactiver le bouton de commande selon le contenu du panier
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.disabled = cart.length === 0;
    }
}

/**
 * Met à jour l'affichage du nombre d'articles dans le panier
 */
function updateCartCountDisplay() {
    const cartCount = getCartItemCount();
    
    // Mettre à jour le badge dans l'en-tête
    const cartCountBadge = document.getElementById('cartCountBadge');
    if (cartCountBadge) {
        cartCountBadge.textContent = cartCount;
        cartCountBadge.style.display = cartCount > 0 ? 'flex' : 'none';
        
        // Ajouter une classe pour les grands nombres
        if (cartCount > 99) {
            cartCountBadge.textContent = '99+';
            cartCountBadge.classList.add('large-number');
        } else {
            cartCountBadge.classList.remove('large-number');
        }
    }
    
    // Mettre à jour d'autres éléments qui pourraient afficher le nombre d'articles
    const cartCountElements = document.querySelectorAll('.cart-count');
    cartCountElements.forEach(element => {
        element.textContent = cartCount;
    });
}

/**
 * Configure les écouteurs d'événements
 */
function setupEventListeners() {
    // Gestionnaire pour l'événement de mise à jour du panier
    document.addEventListener('cartUpdated', function() {
        updateCartCountDisplay();
        
        // Mettre à jour l'affichage du panier s'il est ouvert
        const cartModal = document.getElementById('cart-modal');
        if (cartModal && cartModal.style.display === 'flex') {
            displayCart();
        }
    });
    
    // Gestionnaire pour le bouton de checkout
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', processCheckout);
    }
    
    // Gestionnaire pour le bouton "View My Orders" après le checkout
    const viewOrdersBtn = document.getElementById('view-orders-btn');
    if (viewOrdersBtn) {
        viewOrdersBtn.addEventListener('click', function() {
            window.location.href = '/pages/orders.html';
        });
    }
}

/**
 * Ajoute un produit au panier
 * @param {Object} product - Produit à ajouter
 * @param {number} quantity - Quantité à ajouter
 */
export function addToCart(product, quantity) {
    if (!product || !product.Nom || !product.prix) {
        showNotification('Invalid product', 'error');
        return;
    }
    
    quantity = parseInt(quantity) || 1;
    if (quantity <= 0) return;
    
    // Ajouter au storage
    const cart = addToStorage(product, quantity);
    
    // Notification
    showNotification(`${quantity} × ${product.Nom} added to cart!`, 'success');
    
    // Déclencher l'événement de mise à jour
    document.dispatchEvent(new CustomEvent('cartUpdated'));
    
    return cart;
}

/**
 * Supprime un article du panier
 * @param {number} index - Index de l'article à supprimer
 */
export function removeFromCart(index) {
    // Récupérer l'article avant de le supprimer pour afficher son nom
    const cart = getCart();
    const item = cart[index];
    
    if (!item) return;
    
    // Supprimer du storage
    removeFromStorage(index);
    
    // Notification
    showNotification(`${item.Nom} removed from cart`, 'info');
    
    // Mettre à jour l'affichage
    displayCart();
    
    // Déclencher l'événement de mise à jour
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

/**
 * Gestionnaire pour vider le panier
 */
async function clearCartHandler() {
    // Demander confirmation
    const confirmed = await showConfirmModal(
        'Are you sure you want to clear your cart?', 
        {
            title: 'Clear Cart',
            confirmText: 'Yes, Clear Cart',
            confirmClass: 'danger-btn',
            cancelText: 'Cancel'
        }
    );
    
    if (confirmed) {
        // Vider le panier
        clearCart();
        
        // Notification
        showNotification('Cart has been cleared', 'info');
        
        // Mettre à jour l'affichage
        displayCart();
        
        // Déclencher l'événement de mise à jour
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    }
}

/**
 * Lance le processus de commande
 */
function processCheckout() {
    const cart = getCart();
    
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }
    
    // Cacher les éléments du panier
    document.getElementById('cart-items').style.display = 'none';
    document.querySelector('.cart-total').style.display = 'none';
    document.querySelector('.cart-actions').style.display = 'none';
    
    // Montrer la confirmation
    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) {
        confirmation.classList.add('visible');
    }
    
    // Envoyer la commande au serveur
    submitOrder(cart);
}

async function submitOrder(cart) {
    try {
        const response = await fetch('/api/save-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items: cart })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Message personnalisé selon si la commande a été fusionnée ou non
            let successMessage = 'Order placed successfully!';
            if (data.merged) {
                successMessage = 'Items added to your existing pending order!';
            }
            
            // Vider le panier
            clearCart();
            
            // Déclencher l'événement de mise à jour
            document.dispatchEvent(new CustomEvent('cartUpdated'));
            
            // Afficher le message approprié
            if (document.querySelector('#cart-confirmation p:first-child')) {
                document.querySelector('#cart-confirmation p:first-child').textContent = successMessage;
            }
            
            // Notification de succès (optionnelle si la confirmation visuelle est déjà présente)
            showNotification(successMessage, 'success');
        } else {
            // En cas d'erreur, revenir à l'affichage normal du panier
            document.getElementById('cart-items').style.display = 'block';
            document.querySelector('.cart-total').style.display = 'block';
            document.querySelector('.cart-actions').style.display = 'flex';
            
            // Cacher la confirmation
            const confirmation = document.getElementById('cart-confirmation');
            if (confirmation) {
                confirmation.classList.remove('visible');
            }
            
            // Notification d'erreur
            showNotification(data.message || 'Error placing order', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        
        // En cas d'erreur, revenir à l'affichage normal du panier
        document.getElementById('cart-items').style.display = 'block';
        document.querySelector('.cart-total').style.display = 'block';
        document.querySelector('.cart-actions').style.display = 'flex';
        
        // Cacher la confirmation
        const confirmation = document.getElementById('cart-confirmation');
        if (confirmation) {
            confirmation.classList.remove('visible');
        }
        
        // Notification d'erreur
        showNotification('Error placing order. Please try again.', 'error');
    }
}