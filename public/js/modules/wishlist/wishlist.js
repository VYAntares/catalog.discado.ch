// public/js/modules/wishlist/wishlist.js
import { fetchWishlist, removeFromWishlistApi } from '../../core/api.js';
import { addToCart } from '../../core/storage.js';
import { showNotification } from '../../utils/notification.js';
import { formatPrice } from '../../utils/formatter.js';

let wishlistItems = [];

async function initWishlist() {
    await loadWishlist();
}

async function loadWishlist() {
    const container = document.getElementById('wishlistContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading your favourites...</p>
        </div>
    `;

    try {
        wishlistItems = await fetchWishlist();
        renderWishlist();
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Error loading your favourites. Please try again.</p>
            </div>
        `;
    }
}

function renderWishlist() {
    const container = document.getElementById('wishlistContainer');
    if (!container) return;

    updateWishlistCount(wishlistItems.length);

    if (!wishlistItems || wishlistItems.length === 0) {
        container.innerHTML = `
            <div class="wishlist-empty">
                <i class="fas fa-heart wishlist-empty-icon"></i>
                <h3>Your favourites list is empty</h3>
                <p>Add products from the catalogue by clicking the heart icon on each item.</p>
                <a href="/pages/catalog.html" class="primary-btn">Browse catalogue</a>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    wishlistItems.forEach(item => {
        container.appendChild(createWishlistItem(item));
    });
}

function createWishlistItem(item) {
    const li = document.createElement('li');
    li.className = 'wishlist-item';
    li.setAttribute('data-id', item.id);

    const price = item.product_price ? `${formatPrice(item.product_price)} CHF` : '';

    li.innerHTML = `
        <div class="wishlist-item-img-container">
            ${item.image_url
                ? `<img src="${item.image_url}" alt="${item.product_name}" class="wishlist-item-img">`
                : `<div class="wishlist-item-img-placeholder"><i class="fas fa-image"></i></div>`
            }
        </div>
        <div class="wishlist-item-info">
            <span class="wishlist-item-name">${item.product_name}</span>
            ${price ? `<span class="wishlist-item-price">${price}</span>` : ''}
        </div>
        <div class="wishlist-item-actions">
            <button class="wishlist-add-cart-btn" title="Add to cart">
                <i class="fas fa-shopping-cart"></i>
            </button>
            <button class="wishlist-remove-btn" title="Remove from favourites">
                <i class="fas fa-heart-broken"></i>
            </button>
        </div>
    `;

    li.querySelector('.wishlist-add-cart-btn').addEventListener('click', () => {
        addToCart({
            id: item.product_id,
            Nom: item.product_name,
            prix: item.product_price,
            categorie: item.category,
            imageUrl: item.image_url
        }, 1);
        showNotification(`${item.product_name} added to cart!`, 'success');
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    });

    li.querySelector('.wishlist-remove-btn').addEventListener('click', async () => {
        try {
            await removeFromWishlistApi(item.product_id);
            wishlistItems = wishlistItems.filter(i => i.id !== item.id);
            li.remove();
            updateWishlistCount(wishlistItems.length);
            if (wishlistItems.length === 0) renderWishlist();
            if (window.DiscadoHeader && window.DiscadoHeader.updateWishlistBadge) {
                window.DiscadoHeader.updateWishlistBadge(wishlistItems.length);
            }
        } catch (e) {
            showNotification('Error removing item', 'error');
        }
    });

    return li;
}

function updateWishlistCount(count) {
    const countEl = document.getElementById('wishlistCount');
    if (countEl) countEl.textContent = count;
    if (window.DiscadoHeader && window.DiscadoHeader.updateWishlistBadge) {
        window.DiscadoHeader.updateWishlistBadge(count);
    }
}

export { initWishlist };
