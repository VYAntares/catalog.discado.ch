import { fetchUserOrders, getInvoiceDownloadLink } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { formatDate, formatPrice } from '../../utils/formatter.js';

// Initialize orders list page
export function initOrdersList() {
    loadOrders();
}

// Load user's orders from API
async function loadOrders() {
    const ordersContainer = document.getElementById('ordersList');
    if (!ordersContainer) return;
    
    ordersContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading your orders...</p>
        </div>
    `;
    
    try {
        const orders = await fetchUserOrders();
        displayOrders(orders, ordersContainer);
    } catch (error) {
        handleOrderLoadError(ordersContainer);
    }
}

// Handle error when loading orders
function handleOrderLoadError(container) {
    container.innerHTML = `
        <div class="error-message">
            <p>Error loading your orders. Please try again later.</p>
            <button id="retry-orders-btn" class="primary-btn">Retry</button>
        </div>
    `;
    
    const retryBtn = document.getElementById('retry-orders-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', loadOrders);
    }
}

// Display orders in the container
function displayOrders(orders, container) {
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>You have no orders yet.</p>
                <a href="/pages/catalog.html" class="primary-btn">Browse Products</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    const standardOrders = orders.filter(order => !order.isToDeliverItems);
    
    standardOrders
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((order, index) => {
            createOrderCard(order, index, container);
        });
}

// Create individual order card
function createOrderCard(order, index, container) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    
    const { statusText, statusClass } = determineOrderStatus(order);
    
    orderCard.innerHTML = createOrderCardHeader(order, index, statusText, statusClass);
    
    const itemsTable = createOrderItemsTable(order);
    orderCard.appendChild(itemsTable);
    
    const orderSummary = createOrderSummary(order);
    orderCard.appendChild(orderSummary);
    
    container.appendChild(orderCard);
}

// Determine order status
function determineOrderStatus(order) {
    let statusText = 'Processing';
    let statusClass = 'status-processing';
    
    if (['completed', 'shipped', 'partial'].includes(order.status)) {
        statusText = 'Completed';
        statusClass = 'status-shipped';
    }
    
    return { statusText, statusClass };
}

// Create order card header
function createOrderCardHeader(order, index, statusText, statusClass) {
    const orderDate = formatDate(order.date);
    const processDate = order.lastProcessed ? formatDate(order.lastProcessed) : '';
    
    return `
        <div class="order-card-header">
            <h3>Order #${order.orderId.split('_').pop() || index + 1}</h3>
            <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <div class="order-date">
            Ordered: ${orderDate}
            ${processDate ? `<br>Processed: ${processDate}` : ''}
            ${order.reference ? `<br><span class="order-reference">Reference: ${order.reference}</span>` : ''}
        </div>
    `;
}

// Create order items table
function createOrderItemsTable(order) {
    const tableContainer = document.createElement('div');
    
    const { itemsToDisplay, pendingItems } = processOrderItems(order);
    
    const tableHTML = generateOrderTableHTML(itemsToDisplay, pendingItems);
    
    tableContainer.innerHTML = tableHTML;
    return tableContainer;
}

// Process order items based on order status
function processOrderItems(order) {
    let itemsToDisplay, pendingItems;
    
    if (order.status === 'partial' && order.deliveredItems) {
        itemsToDisplay = order.deliveredItems || [];
        pendingItems = order.remainingItems || [];
    } else {
        itemsToDisplay = order.items || [];
        pendingItems = [];
    }
    
    return { itemsToDisplay, pendingItems };
}

// Generate HTML for order items table
function generateOrderTableHTML(itemsToDisplay, pendingItems) {
    const groupedItems = groupItemsByCategory(itemsToDisplay);
    const groupedPendingItems = groupItemsByCategory(pendingItems);
    
    let tableHTML = `
        <table class="order-details-table">
            <thead>
                <tr>
                    <th class="qty-column">Qty</th>
                    <th class="product-name-column">Product</th>
                    <th class="unit-price-column">Unit Price</th>
                    <th class="total-price-column">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add delivered items
    tableHTML += addItemsByCategory(groupedItems, 'delivered-item');
    
    // Add pending items if any
    if (Object.keys(groupedPendingItems).length > 0) {
        tableHTML += `
            <tr class="order-section-header">
                <td colspan="4" class="pending-section">
                    PENDING ITEMS - We will deliver as soon as stock is available
                </td>
            </tr>
        `;
        tableHTML += addItemsByCategory(groupedPendingItems, 'pending-item', true);
    }
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    return tableHTML;
}

// Group items by category
function groupItemsByCategory(items) {
    const groupedItems = {};
    
    items.forEach(item => {
        const category = item.categorie || 'others';
        if (!groupedItems[category]) {
            groupedItems[category] = [];
        }
        groupedItems[category].push(item);
    });
    
    return groupedItems;
}

// Add items to table by category
function addItemsByCategory(groupedItems, itemClass, isPending = false) {
    let tableHTML = '';
    
    Object.keys(groupedItems)
        .sort()
        .forEach(category => {
            // Add category header
            tableHTML += `
                <tr class="category-header">
                    <td colspan="4" class="category-section ${isPending ? 'pending-category' : ''}">
                        ${category.charAt(0).toUpperCase() + category.slice(1)}
                    </td>
                </tr>
            `;
            
            // Add items in this category
            groupedItems[category].forEach(item => {
                tableHTML += isPending 
                    ? createPendingItemRow(item)
                    : createDeliveredItemRow(item);
            });
        });
    
    return tableHTML;
}

// Create row for delivered item
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

// Create row for pending item
function createPendingItemRow(item) {
    return `
        <tr class="pending-item">
            <td class="qty-column">${item.quantity}</td>
            <td class="product-name-column">${item.Nom}</td>
            <td class="unit-price-column">-</td>
            <td class="total-price-column">-</td>
        </tr>
    `;
}

// Create order summary section
function createOrderSummary(order) {
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'order-summary';
    
    const totalAmount = calculateOrderTotal(order);
    
    summaryContainer.innerHTML = createOrderSummaryHTML(order, totalAmount);
    
    setupInvoiceDownload(summaryContainer, order);
    
    return summaryContainer;
}

// Calculate order total
function calculateOrderTotal(order) {
    if (order.status === 'partial' && order.deliveredItems) {
        return order.deliveredItems.reduce((total, item) => 
            total + (parseFloat(item.prix) * item.quantity), 0
        );
    }
    
    return order.total || order.items.reduce((total, item) => 
        total + (parseFloat(item.prix) * item.quantity), 0
    );
}

// Create HTML for order summary
function createOrderSummaryHTML(order, totalAmount) {
    const isInvoiceAvailable = order.status !== 'pending' && order.status !== 'in progress';
    
    return `
        <div class="order-summary-total">
            Total: ${formatPrice(totalAmount)} CHF
            ${isInvoiceAvailable ? 
                `<button class="download-invoice-btn" data-order-id="${order.orderId}">
                    <i class="fas fa-file-pdf"></i> Download Invoice
                </button>` : 
                `<span class="invoice-not-available">
                    <i class="fas fa-info-circle"></i> Invoice will be available after delivery
                </span>`
            }
        </div>
    `;
}

// Setup invoice download functionality
function setupInvoiceDownload(summaryContainer, order) {
    const invoiceBtn = summaryContainer.querySelector('.download-invoice-btn');
    if (invoiceBtn) {
        invoiceBtn.addEventListener('click', () => {
            window.open(getInvoiceDownloadLink(order.orderId), '_blank');
        });
    }
}

// Placeholder for order search functionality
export function searchOrders(searchTerm) {
    // To be implemented if needed
}