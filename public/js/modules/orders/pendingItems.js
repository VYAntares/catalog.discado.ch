// public/js/modules/orders/pendingItems.js

import { fetchUserOrders } from '../../core/api.js';
import { formatDate } from '../../utils/formatter.js';

// Store pending delivery order
let pendingDeliveryOrder = null;

// Initialize pending items management
function initPendingItems() {
    loadPendingItems();
    setupPendingItemsToggle();
}

// Load pending delivery items
async function loadPendingItems() {
    try {
        const orders = await fetchUserOrders();
        
        pendingDeliveryOrder = orders.find(order => order.isToDeliverItems);
        
        updatePendingItemsUI(pendingDeliveryOrder);
    } catch (error) {
        hidePendingItemsButton();
    }
}

// Setup toggle functionality for pending items
function setupPendingItemsToggle() {
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    const pendingDeliveriesContainer = document.getElementById('pendingDeliveriesContainer');
    
    if (!pendingDeliveriesBtn || !pendingDeliveriesContainer) return;
    
    pendingDeliveriesBtn.addEventListener('click', () => {
        togglePendingDeliveries(pendingDeliveriesContainer);
    });
}

// Toggle visibility of pending deliveries container
function togglePendingDeliveries(container) {
    const isVisible = container.classList.contains('visible');
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    const pendingItemsCount = document.getElementById('pendingItemsCount');
    
    if (isVisible) {
        // Hide container
        container.classList.remove('visible');
        setTimeout(() => {
            container.style.display = 'none';
        }, 300);
        
        // Update button text
        if (pendingDeliveriesBtn) {
            pendingDeliveriesBtn.innerHTML = `
                <i class="fas fa-truck"></i> View pending delivery items
                <span id="pendingItemsCount" class="pending-items-count">
                    ${pendingItemsCount?.textContent || '0'}
                </span>
            `;
        }
    } else {
        // Show container
        container.style.display = 'block';
        void container.offsetWidth;
        container.classList.add('visible');
        
        // Update button text
        if (pendingDeliveriesBtn) {
            pendingDeliveriesBtn.innerHTML = `
                <i class="fas fa-chevron-up"></i> Hide pending delivery items
                <span id="pendingItemsCount" class="pending-items-count">
                    ${pendingItemsCount?.textContent || '0'}
                </span>
            `;
        }
    }
}

// Update UI for pending items
function updatePendingItemsUI(pendingOrder) {
    updatePendingItemsButton(pendingOrder);
    updatePendingItemsContainer(pendingOrder);
}

// Update pending items button
function updatePendingItemsButton(pendingOrder) {
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    const pendingItemsCount = document.getElementById('pendingItemsCount');
    
    if (!pendingDeliveriesBtn || !pendingItemsCount) return;
    
    if (pendingOrder?.items?.length > 0) {
        // Calculate total pending items
        const pendingItemsTotal = pendingOrder.items.reduce((total, item) => total + item.quantity, 0);
        
        // Update counter
        pendingItemsCount.textContent = pendingItemsTotal;
        pendingItemsCount.classList.remove('hidden');
        
        pendingDeliveriesBtn.classList.add('has-items');
        pendingDeliveriesBtn.style.display = 'flex';
    } else {
        pendingItemsCount.classList.add('hidden');
        pendingDeliveriesBtn.classList.remove('has-items');
        pendingDeliveriesBtn.style.display = 'none';
    }
}

// Update pending items container
function updatePendingItemsContainer(pendingOrder) {
    const pendingDeliveriesContainer = document.getElementById('pendingDeliveriesContainer');
    
    if (!pendingDeliveriesContainer) return;
    
    if (pendingOrder?.items?.length > 0) {
        const pendingDeliveryCard = createPendingDeliveryCard(pendingOrder);
        
        pendingDeliveriesContainer.innerHTML = '';
        pendingDeliveriesContainer.appendChild(pendingDeliveryCard);
    } else {
        pendingDeliveriesContainer.innerHTML = `
            <div class="empty-state">
                <p>No pending delivery items</p>
            </div>
        `;
    }
}

// Create pending delivery card
function createPendingDeliveryCard(pendingOrder) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card pending-delivery-card';
    
    // Card header
    orderCard.innerHTML = `
        <div class="order-card-header">
            <h3>Pending Delivery Items</h3>
            <span class="order-status status-processing">
                Pending Delivery
            </span>
        </div>
        <div class="order-date">
            Items waiting to be delivered from previous orders
        </div>
    `;
    
    // Add items
    const itemsContent = createPendingItemsContent(pendingOrder);
    orderCard.appendChild(itemsContent);
    
    // Note section
    const noteSection = document.createElement('div');
    noteSection.className = 'order-summary';
    noteSection.innerHTML = `
        <div class="order-summary-note">
            <span class="invoice-not-available">
                <i class="fas fa-info-circle"></i> These items will be delivered when available
            </span>
        </div>
    `;
    
    orderCard.appendChild(noteSection);
    
    return orderCard;
}

// Create pending items content
function createPendingItemsContent(pendingOrder) {
    const groupedItems = pendingOrder.groupedItems || {};
    const toDeliverItems = pendingOrder.items || [];
    
    const itemsContainer = document.createElement('div');
    
    if (Object.keys(groupedItems).length > 0) {
        // Grouped items by category
        for (const category in groupedItems) {
            const categorySection = createCategorySection(category, groupedItems[category]);
            itemsContainer.appendChild(categorySection);
        }
    } else {
        // Simple items list
        const itemsTable = createItemsTable(toDeliverItems);
        itemsContainer.appendChild(itemsTable);
    }
    
    return itemsContainer;
}

// Create category section
function createCategorySection(category, items) {
    const categorySection = document.createElement('div');
    categorySection.className = 'category-section';
    
    const categoryHeader = document.createElement('h4');
    categoryHeader.className = 'category-header';
    categoryHeader.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    
    const itemsTable = createItemsTable(items);
    
    categorySection.appendChild(categoryHeader);
    categorySection.appendChild(itemsTable);
    
    return categorySection;
}

// Create items table
function createItemsTable(items) {
    const itemsTable = document.createElement('table');
    itemsTable.className = 'order-details-table';
    
    itemsTable.innerHTML = `
        <thead>
            <tr>
                <th class="qty-column">Qty</th>
                <th class="product-name-column">Product</th>
            </tr>
        </thead>
        <tbody>
            ${items.map(item => `
                <tr class="pending-item">
                    <td class="qty-column">${item.quantity}</td>
                    <td class="product-name-column">${item.Nom}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    return itemsTable;
}

// Hide pending items button
function hidePendingItemsButton() {
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    if (pendingDeliveriesBtn) {
        pendingDeliveriesBtn.style.display = 'none';
    }
}

// Export public functions
export {
    initPendingItems,
    loadPendingItems,
    togglePendingDeliveries
};