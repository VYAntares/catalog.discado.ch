// public/js/modules/orders/pendingItems.js

import { fetchUserOrders, fetchProducts } from '../../core/api.js';

// Product image cache (built independently — browser caches the HTTP request)
const productImageCache = new Map();

let pendingDeliveryOrder = null;

async function initPendingItems() {
    // Load images and orders in parallel
    await Promise.all([loadProductImages(), loadPendingItems()]);
    setupPendingItemsToggle();
}

async function loadProductImages() {
    try {
        const products = await fetchProducts();
        (Array.isArray(products) ? products : []).forEach(p => {
            const name     = p.Nom || p.name;
            const imageUrl = p.imageUrl || p.image_url;
            if (imageUrl) {
                if (p.id) productImageCache.set(`id:${p.id}`, imageUrl);
                if (name) productImageCache.set(name.toLowerCase().trim(), imageUrl);
            }
        });
    } catch (e) {
        // Non-critical — letter avatars used as fallback
    }
}

function getProductImage(productName, productId) {
    if (productId) {
        const byId = productImageCache.get(`id:${productId}`);
        if (byId) return byId;
    }
    if (!productName) return null;
    return productImageCache.get(productName.toLowerCase().trim()) || null;
}

function avatarColor(str) {
    const palette = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#0ea5e9','#14b8a6','#ef4444'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}

async function loadPendingItems() {
    try {
        const orders = await fetchUserOrders();
        pendingDeliveryOrder = orders.find(order => order.isToDeliverItems);
        updatePendingItemsUI(pendingDeliveryOrder);
    } catch (error) {
        hidePendingItemsButton();
    }
}

function setupPendingItemsToggle() {
    const btn = document.getElementById('pendingDeliveriesBtn');
    const container = document.getElementById('pendingDeliveriesContainer');
    if (!btn || !container) return;

    btn.addEventListener('click', () => togglePendingDeliveries(container));
}

function togglePendingDeliveries(container) {
    const isVisible = container.classList.contains('visible');
    const btn = document.getElementById('pendingDeliveriesBtn');

    if (isVisible) {
        container.classList.remove('visible');
        setTimeout(() => { container.style.display = 'none'; }, 550);
        btn?.classList.remove('open');
    } else {
        container.style.display = 'block';
        void container.offsetWidth;
        container.classList.add('visible');
        btn?.classList.add('open');
    }
}

function updatePendingItemsUI(pendingOrder) {
    updatePendingItemsButton(pendingOrder);
    updatePendingItemsContainer(pendingOrder);
}

function updatePendingItemsButton(pendingOrder) {
    const btn        = document.getElementById('pendingDeliveriesBtn');
    const countBadge = document.getElementById('pendingItemsCount');
    if (!btn || !countBadge) return;

    if (pendingOrder?.items?.length > 0) {
        const total = pendingOrder.items.reduce((sum, item) => sum + item.quantity, 0);

        countBadge.textContent = total;
        countBadge.classList.remove('hidden');

        const label = btn.querySelector('.pending-btn-label');
        if (label) {
            label.innerHTML = `
                ${window.t ? window.t('orders.pendingDeliveries') : 'Pending deliveries'}
                <small>${total} ${total > 1 ? (window.t ? window.t('orders.itemsPlural') : 'items') : (window.t ? window.t('orders.itemsSingular') : 'item')} ${window.t ? window.t('orders.awaitingStockSuffix') : 'awaiting stock availability'}</small>
            `;
        }

        btn.classList.add('has-items');
        btn.style.display = 'flex';
    } else {
        countBadge.classList.add('hidden');
        btn.classList.remove('has-items');
        btn.style.display = 'none';
    }
}

function updatePendingItemsContainer(pendingOrder) {
    const container = document.getElementById('pendingDeliveriesContainer');
    if (!container) return;

    container.innerHTML = '';
    if (pendingOrder?.items?.length > 0) {
        container.appendChild(createPendingDeliveryCard(pendingOrder));
    }
}

function createPendingDeliveryCard(pendingOrder) {
    const items    = pendingOrder.items || [];
    const grouped  = pendingOrder.groupedItems || {};
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

    const card = document.createElement('div');
    card.className = 'pending-delivery-card';

    // Header
    const header = document.createElement('div');
    header.className = 'pending-delivery-header';
    header.innerHTML = `
        <div class="pending-delivery-header-info">
            <h3><i class="fas fa-truck" style="margin-right:8px;color:#d97706;"></i>${window.t ? window.t('orders.pendingHeader') : 'Items awaiting delivery'}</h3>
            <p>${window.t ? window.t('orders.pendingSubtitle') : 'These items will be shipped as soon as stock is available'}</p>
        </div>
        <span class="pending-delivery-badge">
            <i class="fas fa-box"></i>
            ${totalQty} ${totalQty > 1 ? (window.t ? window.t('orders.itemsPlural') : 'items') : (window.t ? window.t('orders.itemsSingular') : 'item')}
        </span>
    `;
    card.appendChild(header);

    // Body — items with photos
    const body = document.createElement('div');
    body.className = 'pending-delivery-body';

    const hasGroups = Object.keys(grouped).length > 0;

    if (hasGroups) {
        Object.keys(grouped).sort().forEach(category => {
            body.appendChild(createCategorySection(category, grouped[category]));
        });
    } else {
        const section = document.createElement('div');
        section.className = 'pending-category-section';
        items.forEach(item => section.appendChild(createItemRow(item)));
        body.appendChild(section);
    }

    card.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'pending-delivery-footer';
    footer.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>${window.t ? window.t('orders.pendingFooter') : 'No action required. You will be notified when these items are shipped.'}</span>
    `;
    card.appendChild(footer);

    return card;
}

function createCategorySection(category, items) {
    const section = document.createElement('div');
    section.className = 'pending-category-section';

    const title = document.createElement('div');
    title.className = 'pending-category-title';
    title.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    section.appendChild(title);

    items.forEach(item => section.appendChild(createItemRow(item)));
    return section;
}

function createItemRow(item) {
    const row = document.createElement('div');
    row.className = 'pending-item-row';

    const imageUrl = getProductImage(item.Nom, item.product_id);
    const initial  = (item.Nom || '?').charAt(0).toUpperCase();
    const color    = avatarColor(item.Nom || '');

    const imgHTML = imageUrl
        ? `<img src="${imageUrl}" alt="${item.Nom}" class="item-photo"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="item-photo-placeholder" style="background:${color};display:none;">${initial}</div>`
        : `<div class="item-photo-placeholder" style="background:${color};">${initial}</div>`;

    row.innerHTML = `
        <div class="item-img-wrap">${imgHTML}</div>
        <div class="pending-item-name">${item.Nom}</div>
        <div class="pending-item-qty">× ${item.quantity}</div>
        <div class="pending-item-status-tag">${window.t ? window.t('orders.awaitingStock') : 'Awaiting stock'}</div>
    `;
    return row;
}

function hidePendingItemsButton() {
    const btn = document.getElementById('pendingDeliveriesBtn');
    if (btn) btn.style.display = 'none';
}

export {
    initPendingItems,
    loadPendingItems,
    togglePendingDeliveries
};
