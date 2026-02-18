// public/js/modules/orders/orderList.js

import { fetchUserOrders, getInvoiceDownloadLink } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { formatDate, formatPrice } from '../../utils/formatter.js';

const VAT_RATE = 0.081;

export function initOrdersList() {
    loadOrders();
}

async function loadOrders() {
    const ordersContainer = document.getElementById('ordersList');
    if (!ordersContainer) return;

    ordersContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Chargement de vos commandes…</p>
        </div>
    `;

    try {
        const orders = await fetchUserOrders();
        displayOrders(orders, ordersContainer);
    } catch (error) {
        handleOrderLoadError(ordersContainer);
    }
}

function handleOrderLoadError(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-exclamation-circle"></i></div>
            <h3>Impossible de charger vos commandes</h3>
            <p>Une erreur est survenue. Veuillez réessayer.</p>
            <button id="retry-orders-btn" class="primary-btn">Réessayer</button>
        </div>
    `;
    const retryBtn = document.getElementById('retry-orders-btn');
    if (retryBtn) retryBtn.addEventListener('click', loadOrders);
}

function displayOrders(orders, container) {
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-box-open"></i></div>
                <h3>Aucune commande pour l'instant</h3>
                <p>Vos commandes apparaîtront ici dès que vous aurez passé une commande.</p>
                <a href="/pages/catalog.html" class="primary-btn">Parcourir le catalogue</a>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    orders
        .filter(order => !order.isToDeliverItems)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((order, index) => createOrderCard(order, index, container));
}

function createOrderCard(order, index, container) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';

    const { statusText, statusClass, barClass } = determineOrderStatus(order);

    // Barre colorée statut
    const topBar = document.createElement('div');
    topBar.className = `order-card-top-bar ${barClass}`;
    orderCard.appendChild(topBar);

    // Corps header
    const cardBody = document.createElement('div');
    cardBody.className = 'order-card-body';
    cardBody.innerHTML = createOrderCardHeader(order, index, statusText, statusClass);
    orderCard.appendChild(cardBody);

    // Tableau articles
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'order-table-wrapper';
    tableWrapper.appendChild(createOrderItemsTable(order));
    orderCard.appendChild(tableWrapper);

    // Résumé / totaux
    orderCard.appendChild(createOrderSummary(order));

    container.appendChild(orderCard);
}

function determineOrderStatus(order) {
    if (['completed', 'shipped', 'partial'].includes(order.status)) {
        return { statusText: 'Livré', statusClass: 'status-shipped', barClass: 'bar-success' };
    }
    return { statusText: 'En traitement', statusClass: 'status-processing', barClass: 'bar-processing' };
}

function createOrderCardHeader(order, index, statusText, statusClass) {
    const orderDate = formatDate(order.date);
    const processDate = order.lastProcessed ? formatDate(order.lastProcessed) : '';
    const orderId = order.orderId || `#${index + 1}`;

    return `
        <div class="order-card-header">
            <div class="order-card-header-left">
                <h3>Commande <span class="order-id-highlight">#${orderId}</span></h3>
                <div class="order-date">
                    <i class="fas fa-calendar-alt" style="font-size:.72rem;margin-right:4px;"></i>${orderDate}
                    ${processDate ? `&nbsp;·&nbsp;<i class="fas fa-check" style="font-size:.72rem;margin-right:3px;"></i>Traité le ${processDate}` : ''}
                    ${order.reference ? `<br><span class="order-reference"><i class="fas fa-tag"></i> ${order.reference}</span>` : ''}
                </div>
            </div>
            <span class="order-status ${statusClass}">${statusText}</span>
        </div>
    `;
}

function createOrderItemsTable(order) {
    const tableContainer = document.createElement('div');
    const { itemsToDisplay, pendingItems } = processOrderItems(order);
    tableContainer.innerHTML = generateOrderTableHTML(itemsToDisplay, pendingItems);
    return tableContainer;
}

function processOrderItems(order) {
    if (order.status === 'partial' && order.deliveredItems) {
        return {
            itemsToDisplay: order.deliveredItems || [],
            pendingItems: order.remainingItems || []
        };
    }
    return { itemsToDisplay: order.items || [], pendingItems: [] };
}

function generateOrderTableHTML(itemsToDisplay, pendingItems) {
    const groupedItems = groupItemsByCategory(itemsToDisplay);
    const groupedPendingItems = groupItemsByCategory(pendingItems);

    let html = `
        <table class="order-details-table">
            <thead>
                <tr>
                    <th class="qty-column">Qté</th>
                    <th class="product-name-column">Produit</th>
                    <th class="unit-price-column">P.U.</th>
                    <th class="total-price-column">Total</th>
                </tr>
            </thead>
            <tbody>
    `;

    html += addItemsByCategory(groupedItems, 'delivered-item');

    if (Object.keys(groupedPendingItems).length > 0) {
        html += `
            <tr class="order-section-header">
                <td colspan="4" class="pending-section">
                    <i class="fas fa-clock" style="margin-right:6px;"></i>Articles en attente — livraison dès disponibilité
                </td>
            </tr>
        `;
        html += addItemsByCategory(groupedPendingItems, 'pending-item', true);
    }

    html += `</tbody></table>`;
    return html;
}

function groupItemsByCategory(items) {
    const grouped = {};
    items.forEach(item => {
        const cat = item.categorie || 'Divers';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });
    return grouped;
}

function addItemsByCategory(groupedItems, itemClass, isPending = false) {
    let html = '';
    Object.keys(groupedItems).sort().forEach(category => {
        html += `
            <tr class="category-header">
                <td colspan="4" class="category-section ${isPending ? 'pending-category' : ''}">
                    ${category.charAt(0).toUpperCase() + category.slice(1)}
                </td>
            </tr>
        `;
        groupedItems[category].forEach(item => {
            html += isPending ? createPendingItemRow(item) : createDeliveredItemRow(item);
        });
    });
    return html;
}

function createDeliveredItemRow(item) {
    const itemTotal = parseFloat(item.prix) * item.quantity;
    return `
        <tr class="delivered-item">
            <td class="qty-column">${item.quantity}</td>
            <td class="product-name-column">${item.Nom}</td>
            <td class="unit-price-column">${formatPrice(item.prix)} CHF</td>
            <td class="total-price-column">${formatPrice(itemTotal)} CHF</td>
        </tr>
    `;
}

function createPendingItemRow(item) {
    return `
        <tr class="pending-item">
            <td class="qty-column">${item.quantity}</td>
            <td class="product-name-column">${item.Nom}</td>
            <td class="unit-price-column">—</td>
            <td class="total-price-column">—</td>
        </tr>
    `;
}

// ─── Résumé / Totaux ───────────────────────────────────────────────────────

function createOrderSummary(order) {
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'order-summary';

    const totalHT = calculateOrderTotal(order);
    const tva = totalHT * VAT_RATE;
    const totalTTC = totalHT + tva;

    summaryContainer.innerHTML = createOrderSummaryHTML(order, totalHT, tva, totalTTC);
    setupInvoiceDownload(summaryContainer, order);
    return summaryContainer;
}

function calculateOrderTotal(order) {
    if (order.status === 'partial' && order.deliveredItems) {
        return order.deliveredItems.reduce((sum, item) =>
            sum + parseFloat(item.prix) * item.quantity, 0);
    }
    return order.total || (order.items || []).reduce((sum, item) =>
        sum + parseFloat(item.prix) * item.quantity, 0);
}

function createOrderSummaryHTML(order, totalHT, tva, totalTTC) {
    const isInvoiceAvailable = order.status !== 'pending' && order.status !== 'in progress';

    return `
        <div class="summary-amounts">
            <div class="summary-block">
                <div class="summary-block-label">Sous-total HT</div>
                <div class="summary-block-value">${formatPrice(totalHT)} CHF</div>
            </div>
            <div class="summary-block">
                <div class="summary-block-label">TVA 8.1%</div>
                <div class="summary-block-value">${formatPrice(tva)} CHF</div>
            </div>
            <div class="summary-block">
                <div class="summary-block-label">Total TTC</div>
                <div class="summary-block-value ttc">${formatPrice(totalTTC)} CHF</div>
            </div>
        </div>
        <div class="summary-actions">
            ${isInvoiceAvailable
                ? `<button class="download-invoice-btn" data-order-id="${order.orderId}">
                        <i class="fas fa-file-pdf"></i>
                        <span>Télécharger la facture</span>
                   </button>`
                : `<div class="invoice-not-available">
                        <i class="fas fa-clock"></i>
                        <span>Facture disponible après traitement</span>
                   </div>`
            }
        </div>
    `;
}

function setupInvoiceDownload(summaryContainer, order) {
    const invoiceBtn = summaryContainer.querySelector('.download-invoice-btn');
    if (invoiceBtn) {
        invoiceBtn.addEventListener('click', () => {
            window.open(getInvoiceDownloadLink(order.orderId), '_blank');
        });
    }
}

export function searchOrders(searchTerm) {
    // À implémenter si nécessaire
}
