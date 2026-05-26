/**
 * Module de gestion du panier (serveur)
 * public/js/modules/cart/cartManager.js
 */

import { showNotification } from '../../utils/notification.js';
import { getCart, addCartItem, removeCartItem, updateCartItem, clearCartItems, getCartItemCount, migrateLocalStorageCart } from '../../core/cartApi.js';
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

export async function initCartManager() {
    await migrateLocalStorageCart();
    setupCartModal();
    setupEventListeners();
    await updateCartCountDisplay();
}

function setupCartModal() {
    document.querySelectorAll('#cartToggle, .cart-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            await displayCart();
            const modal = document.getElementById('cart-modal');
            if (modal) showModal(modal);
        });
    });
    document.addEventListener('cartUpdated', updateCartCountDisplay);
}

function setupEventListeners() {
    document.addEventListener('cartUpdated', async () => {
        await updateCartCountDisplay();
        const modal = document.getElementById('cart-modal');
        if (modal && modal.style.display === 'flex') await displayCart();
    });

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', processCheckout);

    const viewOrdersBtn = document.getElementById('view-orders-btn');
    if (viewOrdersBtn) viewOrdersBtn.addEventListener('click', () => {
        window.location.href = '/pages/orders.html';
    });
}

// ===== AFFICHAGE DU PANIER =====

export async function displayCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    // Reset modal state
    container.style.display = '';
    const cartTotalEl    = document.querySelector('.cart-total');
    const cartActionsEl  = document.querySelector('.cart-actions');
    const cartFooterLink = document.querySelector('.cart-footer-link');
    const cartConfirmEl  = document.getElementById('cart-confirmation');
    if (cartTotalEl)    cartTotalEl.style.display    = '';
    if (cartActionsEl)  cartActionsEl.style.display   = '';
    if (cartFooterLink) cartFooterLink.style.display  = '';
    if (cartConfirmEl)  cartConfirmEl.classList.remove('visible');

    container.innerHTML = `<div class="cart-loading"><div class="loading-spinner" style="width:24px;height:24px;margin:20px auto;"></div></div>`;

    const cart = await getCart();
    container.innerHTML = '';

    if (cart.length === 0) {
        const justOrdered = sessionStorage.getItem('cart.justOrdered') === '1';
        if (justOrdered) sessionStorage.removeItem('cart.justOrdered');

        container.innerHTML = `
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
        cart.forEach(item => container.appendChild(buildCartItem(item)));

        container.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                await removeFromCart(parseInt(this.dataset.cartId));
            });
        });

        container.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id  = parseInt(this.dataset.cartId);
                const row = this.closest('.cart-item');
                const qty = parseInt(row.querySelector('.qty-input').value);
                await changeQuantity(id, qty - 1);
            });
        });

        container.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id  = parseInt(this.dataset.cartId);
                const row = this.closest('.cart-item');
                const qty = parseInt(row.querySelector('.qty-input').value);
                await changeQuantity(id, qty + 1);
            });
        });

        container.querySelectorAll('.qty-input').forEach(input => {
            input.addEventListener('change', async function() {
                const id  = parseInt(this.dataset.cartId);
                const val = parseInt(this.value);
                if (isNaN(val) || val < 1) { this.value = 1; return; }
                await changeQuantity(id, val);
            });
            input.addEventListener('wheel', e => e.preventDefault(), { passive: false });
        });
    }

    updateTotalsDisplay(cart);

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function buildCartItem(item) {
    const el      = document.createElement('div');
    el.className  = 'cart-item';

    const initial = (item.Nom || '?').charAt(0).toUpperCase();
    const color   = avatarColor(item.Nom || '');
    const imgHTML = item.imageUrl
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
            <button class="qty-btn qty-minus" data-cart-id="${item.cartItemId}">−</button>
            <input class="qty-input" type="number" min="1" value="${item.quantity}" data-cart-id="${item.cartItemId}">
            <button class="qty-btn qty-plus" data-cart-id="${item.cartItemId}">+</button>
        </div>
        <div class="cart-item-price">${formatPrice(itemTotal)} CHF</div>
        <button class="remove-item-btn" data-cart-id="${item.cartItemId}" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;
    return el;
}

function updateTotalsDisplay(cart) {
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

async function updateCartCountDisplay() {
    try {
        const count = await getCartItemCount();
        const badge = document.getElementById('cartCountBadge');
        if (badge) {
            badge.textContent    = count > 99 ? '99+' : count;
            badge.style.display  = count > 0 ? 'flex' : 'none';
            badge.classList.toggle('large-number', count > 99);
        }
        document.querySelectorAll('.cart-count').forEach(el => { el.textContent = count; });
    } catch (e) { /* non bloquant */ }
}

// ===== GESTION DES ARTICLES =====

export async function addToCart(product, quantity) {
    if (!product || !product.Nom || !product.prix) {
        showNotification('Invalid product', 'error');
        return;
    }
    quantity = parseInt(quantity) || 1;
    if (quantity <= 0) return;

    try {
        await addCartItem(product, quantity);
        showNotification(`${quantity} × ${product.Nom} added to cart!`, 'success');
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    } catch (e) {
        showNotification('Erreur lors de l\'ajout au panier', 'error');
    }
}

async function removeFromCart(cartItemId) {
    try {
        await removeCartItem(cartItemId);
        showNotification('Article retiré du panier', 'info');
        await displayCart();
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    } catch (e) {
        showNotification('Erreur lors de la suppression', 'error');
    }
}

async function changeQuantity(cartItemId, newQuantity) {
    try {
        if (newQuantity <= 0) {
            await removeFromCart(cartItemId);
            return;
        }
        await updateCartItem(cartItemId, newQuantity);
        await displayCart();
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    } catch (e) {
        showNotification('Erreur mise à jour quantité', 'error');
    }
}

// ===== PROCESSUS DE COMMANDE =====

async function processCheckout() {
    const cart = await getCart();
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }

    document.getElementById('cart-items').style.display      = 'none';
    const cartTotalEl    = document.querySelector('.cart-total');
    const cartActionsEl  = document.querySelector('.cart-actions');
    const cartFooterLink = document.querySelector('.cart-footer-link');
    if (cartTotalEl)    cartTotalEl.style.display    = 'none';
    if (cartActionsEl)  cartActionsEl.style.display   = 'none';
    if (cartFooterLink) cartFooterLink.style.display  = 'none';

    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) confirmation.classList.add('visible');

    await submitOrder(cart);
}

async function submitOrder(cart) {
    try {
        const orderReference = document.getElementById('order-reference')?.value || '';
        const response = await fetch('/api/save-order', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart, reference: orderReference })
        });

        const data = await response.json();

        if (data.success) {
            const msg = data.merged
                ? 'Articles ajoutés à votre commande en cours !'
                : 'Commande passée avec succès !';

            await clearCartItems();
            sessionStorage.setItem('cart.justOrdered', '1');
            document.dispatchEvent(new CustomEvent('cartUpdated'));
            showNotification(msg, 'success');
        } else {
            restoreCartDisplay();
            showNotification(data.message || 'Erreur lors de la commande', 'error');
        }
    } catch (e) {
        restoreCartDisplay();
        showNotification('Erreur lors de la commande. Veuillez réessayer.', 'error');
    }
}

function restoreCartDisplay() {
    document.getElementById('cart-items').style.display      = '';
    const cartTotalEl    = document.querySelector('.cart-total');
    const cartActionsEl  = document.querySelector('.cart-actions');
    const cartFooterLink = document.querySelector('.cart-footer-link');
    if (cartTotalEl)    cartTotalEl.style.display    = '';
    if (cartActionsEl)  cartActionsEl.style.display   = '';
    if (cartFooterLink) cartFooterLink.style.display  = '';

    const confirmation = document.getElementById('cart-confirmation');
    if (confirmation) confirmation.classList.remove('visible');
}
