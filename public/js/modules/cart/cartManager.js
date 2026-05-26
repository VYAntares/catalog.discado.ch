/**
 * Module de gestion du panier
 * public/js/modules/cart/cartManager.js
 */

import { showNotification } from '../../utils/notification.js';
import {
    getCart, saveCart, addToCart as addToStorage,
    removeFromCart as removeFromStorage, clearCart,
    getCartTotal, getCartItemCount, updateCartItemQuantity
} from '../../core/storage.js';
import { formatPrice } from '../../utils/formatter.js';
import { showModal, hideModal } from '../../utils/modal.js';

const VAT_RATE = 0.081;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avatarColor(str) {
    const palette = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#0ea5e9','#14b8a6','#ef4444'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

// ===== INITIALISATION =====

export function initCartManager() {
    setupCartModal();
    setupEventListeners();
    updateCartCountDisplay();
}

function setupCartModal() {
    const cartToggleButtons = document.querySelectorAll('#cartToggle, .cart-toggle');
    cartToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            displayCart();
            const cartModal = document.getElementById('cart-modal');
            if (cartModal) showModal(cartModal);
        });
    });

    document.addEventListener('cartUpdated', updateCartCountDisplay);
}

function setupEventListeners() {
    document.addEventListener('cartUpdated', function() {
        updateCartCountDisplay();
        const cartModal = document.getElementById('cart-modal');
        if (cartModal && cartModal.style.display === 'flex') {
            displayCart();
        }
    });

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', processCheckout);
    }

    const viewOrdersBtn = document.getElementById('view-orders-btn');
    if (viewOrdersBtn) {
        viewOrdersBtn.addEventListener('click', function() {
            window.location.href = '/pages/orders.html';
        });
    }
}

// ===== AFFICHAGE DU PANIER =====

export function displayCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) return;

    // Reset modal state
    cartItemsContainer.style.display = '';
    const cartTotalEl   = document.querySelector('.cart-total');
    const cartActionsEl = document.querySelector('.cart-actions');
    const cartConfirmEl = document.getElementById('cart-confirmation');
    if (cartTotalEl)   cartTotalEl.style.display   = '';
    if (cartActionsEl) cartActionsEl.style.display  = '';
    if (cartConfirmEl) cartConfirmEl.classList.remove('visible');

    const cart = getCart();
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        const justOrdered = sessionStorage.getItem('cart.justOrdered') === '1';
        if (justOrdered) sessionStorage.removeItem('cart.justOrdered');

        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-basket"></i>
                <p>${window.t ? window.t('cart.empty') : 'Your cart is empty'}</p>
                <div class="empty-cart-actions">
                    <a href="/pages/catalog.html" class="empty-cart-btn empty-cart-btn--secondary">
                        <i class="fas fa-th-large"></i>
                        ${window.t ? window.t('cart.browseCatalogue') : 'Browse Catalogue'}
                    </a>
                    <a href="/pages/orders.html" class="empty-cart-btn empty-cart-btn--primary${justOrdered ? ' empty-cart-btn--highlight' : ''}">
                        <i class="fas fa-receipt"></i>
                        ${window.t ? window.t('cart.viewOrders') : 'My Orders'}
                    </a>
                </div>
            </div>
        `;
    } else {
        cart.forEach((item, index) => {
            cartItemsContainer.appendChild(buildCartItem(item, index));
        });

        cartItemsContainer.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                removeFromCart(parseInt(this.dataset.index));
            });
        });

        cartItemsContainer.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const cart  = getCart();
                if (!cart[index]) return;
                updateQuantity(index, cart[index].quantity - 1);
            });
        });

        cartItemsContainer.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const cart  = getCart();
                if (!cart[index]) return;
                updateQuantity(index, cart[index].quantity + 1);
            });
        });

        cartItemsContainer.querySelectorAll('.qty-input').forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                const val   = parseInt(this.value);
                if (isNaN(val) || val < 1) {
                    this.value = getCart()[index]?.quantity || 1;
                    return;
                }
                updateQuantity(index, val);
            });
            // Empêche la molette de changer la valeur accidentellement
            input.addEventListener('wheel', e => e.preventDefault(), { passive: false });
        });
    }

    updateTotalsDisplay();

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function buildCartItem(item, index) {
    const el       = document.createElement('div');
    el.className   = 'cart-item';

    const initial  = (item.Nom || '?').charAt(0).toUpperCase();
    const color    = avatarColor(item.Nom || '');
    const imgHTML  = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.Nom}" class="cart-item-photo"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="cart-item-avatar" style="background:${color};display:none;">${initial}</div>`
        : `<div class="cart-item-avatar" style="background:${color};">${initial}</div>`;

    const itemTotal = parseFloat(item.prix) * item.quantity;

    el.innerHTML = `
        <div class="cart-item-photo-wrap">${imgHTML}</div>
        <div class="cart-item-info">
            <div class="cart-item-name">${item.Nom}</div>
            ${item.categorie ? `<div class="cart-item-category">${item.categorie}</div>` : ''}
        </div>
        <div class="cart-item-qty-control">
            <button class="qty-btn qty-minus" data-index="${index}">−</button>
            <input class="qty-input" type="number" min="1" value="${item.quantity}" data-index="${index}">
            <button class="qty-btn qty-plus" data-index="${index}">+</button>
        </div>
        <div class="cart-item-price">${formatPrice(itemTotal)} CHF</div>
        <button class="remove-item-btn" data-index="${index}" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;
    return el;
}

function updateTotalsDisplay() {
    const cart   = getCart();
    const totalHT  = cart.reduce((s, i) => s + parseFloat(i.prix) * i.quantity, 0);
    const tva      = totalHT * VAT_RATE;
    const totalTTC = totalHT + tva;

    const htEl  = document.getElementById('cart-total-ht');
    const tvaEl = document.getElementById('cart-total-tva');
    const ttcEl = document.getElementById('cart-total-amount');
    if (htEl)  htEl.textContent  = `${formatPrice(totalHT)} CHF`;
    if (tvaEl) tvaEl.textContent = `${formatPrice(tva)} CHF`;
    if (ttcEl) ttcEl.textContent = `${formatPrice(totalTTC)} CHF`;
}

function updateCartCountDisplay() {
    const cartCount = getCartItemCount();
    const cartCountBadge = document.getElementById('cartCountBadge');
    if (cartCountBadge) {
        cartCountBadge.textContent = cartCount > 99 ? '99+' : cartCount;
        cartCountBadge.style.display = cartCount > 0 ? 'flex' : 'none';
        cartCountBadge.classList.toggle('large-number', cartCount > 99);
    }
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = cartCount;
    });
}

// ===== GESTION DES ARTICLES =====

export function addToCart(product, quantity) {
    if (!product || !product.Nom || !product.prix) {
        showNotification('Invalid product', 'error');
        return;
    }
    quantity = parseInt(quantity) || 1;
    if (quantity <= 0) return;

    const cart = addToStorage(product, quantity);
    showNotification(`${quantity} × ${product.Nom} added to cart!`, 'success');
    document.dispatchEvent(new CustomEvent('cartUpdated'));
    return cart;
}

export function removeFromCart(index) {
    const cart = getCart();
    const item = cart[index];
    if (!item) return;

    removeFromStorage(index);
    showNotification(`${item.Nom} removed from cart`, 'info');
    displayCart();
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

function updateQuantity(index, newQuantity) {
    const cart = getCart();
    const item = cart[index];
    if (!item) return;

    if (newQuantity <= 0) {
        removeFromCart(index);
        return;
    }
    updateCartItemQuantity(index, newQuantity);
    displayCart();
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

// ===== PROCESSUS DE COMMANDE =====

function processCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }

    document.getElementById('cart-items').style.display       = 'none';
    const cartTotalEl    = document.querySelector('.cart-total');
    const cartActionsEl  = document.querySelector('.cart-actions');
    const cartFooterLink = document.querySelector('.cart-footer-link');
    if (cartTotalEl)    cartTotalEl.style.display    = 'none';
    if (cartActionsEl)  cartActionsEl.style.display   = 'none';
    if (cartFooterLink) cartFooterLink.style.display  = 'none';

    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) confirmation.classList.add('visible');

    submitOrder(cart);
}

async function submitOrder(cart) {
    try {
        const orderReference = document.getElementById('order-reference')?.value || '';
        const response = await fetch('/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart, reference: orderReference })
        });

        const data = await response.json();

        if (data.success) {
            const msg = data.merged
                ? 'Items added to your existing pending order!'
                : 'Order placed successfully!';

            clearCart();
            sessionStorage.setItem('cart.justOrdered', '1');
            document.dispatchEvent(new CustomEvent('cartUpdated'));
            showNotification(msg, 'success');
        } else {
            restoreCartDisplay();
            showNotification(data.message || 'Error placing order', 'error');
        }
    } catch (error) {
        restoreCartDisplay();
        showNotification('Error placing order. Please try again.', 'error');
    }
}

function restoreCartDisplay() {
    document.getElementById('cart-items').style.display       = '';
    const cartTotalEl    = document.querySelector('.cart-total');
    const cartActionsEl  = document.querySelector('.cart-actions');
    const cartFooterLink = document.querySelector('.cart-footer-link');
    if (cartTotalEl)    cartTotalEl.style.display    = '';
    if (cartActionsEl)  cartActionsEl.style.display   = '';
    if (cartFooterLink) cartFooterLink.style.display  = '';

    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) confirmation.classList.remove('visible');
}
