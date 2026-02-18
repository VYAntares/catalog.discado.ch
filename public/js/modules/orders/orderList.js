// public/js/modules/orders/orderList.js

import { fetchUserOrders, getInvoiceDownloadLink, fetchProducts } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { formatDate, formatPrice } from '../../utils/formatter.js';

const VAT_RATE = 0.081;

// Product name → image_url cache
const productImageCache = new Map();

export async function initOrdersList() {
    const container = document.getElementById('ordersList');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading your orders…</p>
        </div>
    `;

    try {
        const [orders] = await Promise.all([
            fetchUserOrders(),
            loadProductImages()
        ]);
        displayOrders(orders, container);
    } catch (error) {
        handleOrderLoadError(container);
    }
}

async function loadProductImages() {
    try {
        const products = await fetchProducts();
        // /api/products returns { Nom, imageUrl } via productService
        (Array.isArray(products) ? products : []).forEach(p => {
            const name     = p.Nom || p.name;
            const imageUrl = p.imageUrl || p.image_url;
            if (name && imageUrl) {
                productImageCache.set(name.toLowerCase().trim(), imageUrl);
            }
        });
    } catch (e) {
        // Non-critical — letter avatars used as fallback
    }
}

function getProductImage(productName) {
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

function handleOrderLoadError(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-exclamation-circle"></i></div>
            <h3>Unable to load your orders</h3>
            <p>An error occurred. Please try again.</p>
            <button id="retry-orders-btn" class="primary-btn">Retry</button>
        </div>
    `;
    document.getElementById('retry-orders-btn')?.addEventListener('click', () => initOrdersList());
}

function displayOrders(orders, container) {
    container.innerHTML = '';

    const standardOrders = (orders || []).filter(o => !o.isToDeliverItems);

    if (standardOrders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-box-open"></i></div>
                <h3>No orders yet</h3>
                <p>Your orders will appear here once you have placed an order.</p>
                <a href="/pages/catalog.html" class="primary-btn">Browse catalog</a>
            </div>
        `;
        return;
    }

    standardOrders
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((order, index) => {
            container.appendChild(createOrderCard(order, index));
        });
}

// ─── Order Card ─────────────────────────────────────────────────────────────

function createOrderCard(order, index) {
    const card = document.createElement('div');
    card.className = 'order-card';

    const { statusText, statusClass, barClass } = determineOrderStatus(order);
    const totalHT   = calculateOrderTotal(order);
    const tva       = totalHT * VAT_RATE;
    const totalTTC  = totalHT + tva;
    const itemCount = countItems(order);

    const topBar = document.createElement('div');
    topBar.className = `order-card-top-bar ${barClass}`;
    card.appendChild(topBar);

    const header = document.createElement('div');
    header.className = 'order-card-header';
    header.innerHTML = buildHeaderHTML(order, index, statusText, statusClass, totalHT, tva, totalTTC, itemCount);
    card.appendChild(header);

    const detailPanel = createDetailPanel(order);
    card.appendChild(detailPanel);

    header.querySelector('.btn-detail')?.addEventListener('click', () => {
        const isOpen = detailPanel.classList.contains('open');
        detailPanel.classList.toggle('open', !isOpen);
        header.classList.toggle('detail-open', !isOpen);
    });

    return card;
}

function determineOrderStatus(order) {
    if (['completed', 'shipped', 'partial'].includes(order.status)) {
        return { statusText: 'Delivered', statusClass: 'status-shipped', barClass: 'bar-success' };
    }
    return { statusText: 'Processing', statusClass: 'status-processing', barClass: 'bar-processing' };
}

function calculateOrderTotal(order) {
    if (order.status === 'partial' && order.deliveredItems?.length) {
        return order.deliveredItems.reduce((s, i) => s + parseFloat(i.prix) * i.quantity, 0);
    }
    return order.total || (order.items || []).reduce((s, i) => s + parseFloat(i.prix) * i.quantity, 0);
}

function countItems(order) {
    const src = (order.status === 'partial' && order.deliveredItems?.length)
        ? [...(order.deliveredItems || []), ...(order.remainingItems || [])]
        : (order.items || []);
    return src.reduce((s, i) => s + i.quantity, 0);
}

function buildHeaderHTML(order, index, statusText, statusClass, totalHT, tva, totalTTC, itemCount) {
    const date      = formatDate(order.date);
    const processed = order.lastProcessed ? formatDate(order.lastProcessed) : '';
    const orderId   = order.orderId || `#${index + 1}`;

    return `
        <div class="order-header-info">
            <div class="order-header-id">
                <span class="order-num">#${orderId}</span>
                <span class="order-status ${statusClass}">${statusText}</span>
            </div>
            <div class="order-header-meta">
                <span><i class="fas fa-calendar-alt"></i> ${date}</span>
                <span><i class="fas fa-box"></i> ${itemCount} item${itemCount > 1 ? 's' : ''}</span>
                ${processed ? `<span><i class="fas fa-check-circle"></i> Processed on ${processed}</span>` : ''}
                ${order.reference ? `<span><i class="fas fa-tag"></i> ${order.reference}</span>` : ''}
            </div>
        </div>

        <div class="order-header-totals">
            <div class="total-pill">
                <span class="total-pill-label">Excl. VAT</span>
                <span class="total-pill-value">${formatPrice(totalHT)} CHF</span>
            </div>
            <span class="total-pill-sep">+</span>
            <div class="total-pill">
                <span class="total-pill-label">VAT 8.1%</span>
                <span class="total-pill-value">${formatPrice(tva)} CHF</span>
            </div>
            <span class="total-pill-sep">=</span>
            <div class="total-pill total-pill-ttc">
                <span class="total-pill-label">Total incl. VAT</span>
                <span class="total-pill-value">${formatPrice(totalTTC)} CHF</span>
            </div>
        </div>

        <div class="order-header-actions">
            <button class="btn-detail">
                <i class="fas fa-list-ul"></i>
                <span>View details</span>
                <i class="fas fa-chevron-down btn-detail-chevron"></i>
            </button>
        </div>
    `;
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function createDetailPanel(order) {
    const panel = document.createElement('div');
    panel.className = 'order-detail-panel';

    const inner = document.createElement('div');
    inner.className = 'order-detail-inner';

    let deliveredItems = [];
    let pendingItems   = [];

    if (order.status === 'partial' && order.deliveredItems?.length) {
        deliveredItems = order.deliveredItems;
        pendingItems   = order.remainingItems || [];
    } else {
        deliveredItems = order.items || [];
        pendingItems   = [];
    }

    if (deliveredItems.length > 0) {
        inner.appendChild(buildItemsSection(deliveredItems, false));
    }

    if (pendingItems.length > 0) {
        const pendingBanner = document.createElement('div');
        pendingBanner.className = 'detail-pending-banner';
        pendingBanner.innerHTML = `
            <i class="fas fa-clock"></i>
            <span>Pending items — will be delivered as soon as stock is available</span>
        `;
        inner.appendChild(pendingBanner);
        inner.appendChild(buildItemsSection(pendingItems, true));
    }

    inner.appendChild(buildDetailFooter(order));
    panel.appendChild(inner);
    return panel;
}

function buildItemsSection(items, isPending) {
    const section = document.createElement('div');
    section.className = 'detail-items-section';

    const grouped = groupByCategory(items);

    Object.keys(grouped).sort().forEach(category => {
        const catTitle = document.createElement('div');
        catTitle.className = `detail-category-title ${isPending ? 'pending-cat' : ''}`;
        catTitle.innerHTML = `<i class="fas fa-tag"></i> ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        section.appendChild(catTitle);

        grouped[category].forEach(item => {
            section.appendChild(buildItemRow(item, isPending));
        });
    });

    return section;
}

function buildItemRow(item, isPending) {
    const row = document.createElement('div');
    row.className = `detail-item-row ${isPending ? 'detail-item-pending' : ''}`;

    const imageUrl = getProductImage(item.Nom);
    const initial  = (item.Nom || '?').charAt(0).toUpperCase();
    const color    = avatarColor(item.Nom || '');
    const total    = parseFloat(item.prix) * item.quantity;

    const imgHTML = imageUrl
        ? `<img src="${imageUrl}" alt="${item.Nom}" class="item-photo"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="item-photo-placeholder" style="background:${color};display:none;">${initial}</div>`
        : `<div class="item-photo-placeholder" style="background:${color};">${initial}</div>`;

    row.innerHTML = `
        <div class="item-img-wrap">${imgHTML}</div>
        <div class="item-info">
            <div class="item-name">${item.Nom}</div>
            <div class="item-unit-price">${isPending ? 'Awaiting delivery' : `${formatPrice(item.prix)} CHF / unit`}</div>
        </div>
        <div class="item-qty">× ${item.quantity}</div>
        <div class="item-total-price ${isPending ? 'item-total-pending' : ''}">
            ${isPending ? '—' : `${formatPrice(total)} CHF`}
        </div>
    `;
    return row;
}

function buildDetailFooter(order) {
    const footer = document.createElement('div');
    footer.className = 'detail-footer';

    const isInvoiceAvailable = !['pending', 'in progress'].includes(order.status);

    if (isInvoiceAvailable) {
        const btn = document.createElement('button');
        btn.className = 'download-invoice-btn';
        btn.innerHTML = `<i class="fas fa-file-pdf"></i><span>Download invoice PDF</span>`;
        btn.addEventListener('click', () => window.open(getInvoiceDownloadLink(order.orderId), '_blank'));
        footer.appendChild(btn);
    } else {
        footer.innerHTML = `
            <div class="invoice-not-available">
                <i class="fas fa-clock"></i>
                <span>Invoice available once the order has been processed</span>
            </div>
        `;
    }

    return footer;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function groupByCategory(items) {
    const grouped = {};
    items.forEach(item => {
        const cat = item.categorie || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });
    return grouped;
}

export function searchOrders(searchTerm) {
    // To be implemented if needed
}
