import { saveOrder } from '../../core/api.js';
import { getCart, clearCart, getCartTotal } from '../../core/storage.js';
import { showNotification } from '../../utils/notification.js';
import { hideModal } from '../../utils/modal.js';

// Initialisation du module de checkout
export function initCheckout() {}

// Traitement de la commande
export async function processCheckout() {
    const cart = getCart();
    
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return { success: false, message: 'Empty cart' };
    }
    
    const total = getCartTotal();
    const orderReference = document.getElementById('order-reference')?.value || '';
    
    try {
        const orderData = {
            items: cart,
            total: total,
            date: new Date().toISOString(),
            reference: orderReference
        };
        
        const result = await saveOrder(orderData);
        
        if (result.success) {
            showOrderConfirmation(result.orderId, orderReference);
            clearCart();
            document.dispatchEvent(new CustomEvent('cartUpdated'));
            
            return { success: true, orderId: result.orderId };
        } else {
            showNotification(result.message || 'Error placing your order', 'error');
            return { success: false, message: result.message };
        }
    } catch (error) {
        showNotification('Error processing your order. Please try again.', 'error');
        return { success: false, message: error.message };
    }
}

// Affichage de la confirmation de commande
function showOrderConfirmation(orderId, reference) {
    const elementsToHide = [
        'cart-items', 
        '.cart-total', 
        '.cart-actions', 
        '.order-reference-container'
    ];
    
    elementsToHide.forEach(selector => {
        const element = typeof selector === 'string' && selector.startsWith('.')
            ? document.querySelector(selector)
            : document.getElementById(selector);
        if (element) element.style.display = 'none';
    });
    
    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) {
        if (orderId) {
            const confirmationMessage = confirmation.querySelector('p:first-child');
            if (confirmationMessage) {
                confirmationMessage.textContent = `Your order #${orderId} has been placed successfully!`;
                
                if (reference) {
                    const referenceNote = document.createElement('p');
                    referenceNote.className = 'cart-confirmation-note';
                    referenceNote.textContent = `Your reference: ${reference}`;
                    confirmationMessage.parentNode.insertBefore(referenceNote, confirmationMessage.nextSibling);
                }
            }
        }
        
        confirmation.classList.add('visible');
    }
}

// Réinitialisation de l'affichage après checkout
export function resetCheckoutDisplay() {
    const elementsToShow = [
        'cart-items', 
        '.cart-total', 
        '.cart-actions'
    ];
    
    elementsToShow.forEach(selector => {
        const element = typeof selector === 'string' && selector.startsWith('.')
            ? document.querySelector(selector)
            : document.getElementById(selector);
        if (element) element.style.display = element.tagName === 'DIV' ? 'block' : 'flex';
    });
    
    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) {
        confirmation.classList.remove('visible');
    }
    
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
        hideModal(cartModal);
    }
}

// Vérification de connexion avant checkout
export async function checkLoginBeforeCheckout() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        return data.isAuthenticated === true;
    } catch (error) {
        return false;
    }
}

// Redirection vers la page de connexion
export function redirectToLogin() {
    window.location.href = '/pages/login.html?returnUrl=' + encodeURIComponent('/pages/catalog.html?checkout=true');
}