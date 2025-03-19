/**
 * Module de paiement
 * Gère le processus de commande
 */

import { saveOrder } from '../../core/api.js';
import { getCart, clearCart, getCartTotal } from '../../core/storage.js';
import { showNotification } from '../../utils/notification.js';
import { hideModal } from '../../utils/modal.js';
import { formatPrice } from '../../utils/formatter.js';

/**
 * Initialise le module de checkout
 */
export function initCheckout() {
    // Les événements sont configurés dans cartManager.js
    console.log('Checkout module initialized');
}

/**
 * Traite le processus de commande
 * @returns {Promise<Object>} Résultat de la commande
 */
export async function processCheckout() {
    // Récupérer le panier
    const cart = getCart();
    
    // Vérifier que le panier n'est pas vide
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return { success: false, message: 'Empty cart' };
    }
    
    // Récupérer le total
    const total = getCartTotal();
    
    try {
        // Préparer les données de la commande
        const orderData = {
            items: cart,
            total: total,
            date: new Date().toISOString()
        };
        
        // Envoyer la commande au serveur
        const result = await saveOrder(orderData);
        
        if (result.success) {
            // Afficher le message de succès
            showOrderConfirmation(result.orderId);
            
            // Vider le panier
            clearCart();
            
            // Déclencher l'événement de mise à jour du panier
            document.dispatchEvent(new CustomEvent('cartUpdated'));
            
            return { success: true, orderId: result.orderId };
        } else {
            // Afficher l'erreur
            showNotification(result.message || 'Error placing your order', 'error');
            return { success: false, message: result.message };
        }
    } catch (error) {
        console.error('Error during checkout:', error);
        showNotification('Error processing your order. Please try again.', 'error');
        return { success: false, message: error.message };
    }
}

/**
 * Affiche la confirmation de commande
 * @param {string} orderId - ID de la commande
 */
function showOrderConfirmation(orderId) {
    // Masquer les éléments du panier
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.querySelector('.cart-total');
    const cartActions = document.querySelector('.cart-actions');
    
    if (cartItems) cartItems.style.display = 'none';
    if (cartTotal) cartTotal.style.display = 'none';
    if (cartActions) cartActions.style.display = 'none';
    
    // Afficher la confirmation
    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) {
        // Mettre à jour le message si besoin
        if (orderId) {
            const confirmationMessage = confirmation.querySelector('p:first-child');
            if (confirmationMessage) {
                confirmationMessage.textContent = `Your order #${orderId} has been placed successfully!`;
            }
        }
        
        confirmation.classList.add('visible');
    }
}

/**
 * Réinitialise l'affichage du panier après le checkout
 */
export function resetCheckoutDisplay() {
    // Afficher les éléments du panier
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.querySelector('.cart-total');
    const cartActions = document.querySelector('.cart-actions');
    
    if (cartItems) cartItems.style.display = 'block';
    if (cartTotal) cartTotal.style.display = 'block';
    if (cartActions) cartActions.style.display = 'flex';
    
    // Masquer la confirmation
    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) {
        confirmation.classList.remove('visible');
    }
    
    // Fermer le modal du panier
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
        hideModal(cartModal);
    }
}

/**
 * Vérifie si l'utilisateur est connecté avant de procéder au checkout
 * @returns {Promise<boolean>} True si l'utilisateur est connecté
 */
export async function checkLoginBeforeCheckout() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        return data.isAuthenticated === true;
    } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
    }
}

/**
 * Redirige l'utilisateur vers la page de connexion pour checkout
 */
export function redirectToLogin() {
    // Sauvegarder l'état du panier en session si nécessaire
    
    // Rediriger vers la page de connexion avec returnUrl
    window.location.href = '/pages/login.html?returnUrl=' + encodeURIComponent('/pages/catalog.html?checkout=true');
}