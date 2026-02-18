// public/js/modules/orders/pendingItems.js

import { fetchUserOrders } from '../../core/api.js';
import { formatDate } from '../../utils/formatter.js';

let pendingDeliveryOrder = null;

function initPendingItems() {
    loadPendingItems();
    setupPendingItemsToggle();
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
    const btn = document.getElementById('pendingDeliveriesBtn');
    const countBadge = document.getElementById('pendingItemsCount');
    if (!btn || !countBadge) return;

    if (pendingOrder?.items?.length > 0) {
        const total = pendingOrder.items.reduce((sum, item) => sum + item.quantity, 0);

        countBadge.textContent = total;
        countBadge.classList.remove('hidden');

        const label = btn.querySelector('.pending-btn-label');
        if (label) {
            label.innerHTML = `
                Livraisons en attente
                <small>${total} article${total > 1 ? 's' : ''} en attente de disponibilité</small>
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

    if (pendingOrder?.items?.length > 0) {
        container.innerHTML = '';
        container.appendChild(createPendingDeliveryCard(pendingOrder));
    } else {
        container.innerHTML = '';
    }
}

function createPendingDeliveryCard(pendingOrder) {
    const items = pendingOrder.items || [];
    const grouped = pendingOrder.groupedItems || {};
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

    const card = document.createElement('div');
    card.className = 'pending-delivery-card';

    // Header
    const header = document.createElement('div');
    header.className = 'pending-delivery-header';
    header.innerHTML = `
        <div class="pending-delivery-header-info">
            <h3><i class="fas fa-truck" style="margin-right:8px;color:#d97706;"></i>Articles en attente de livraison</h3>
            <p>Ces articles seront expédiés dès que le stock sera disponible</p>
        </div>
        <span class="pending-delivery-badge">
            <i class="fas fa-box"></i>
            ${totalQty} article${totalQty > 1 ? 's' : ''}
        </span>
    `;
    card.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'pending-delivery-body';

    const hasGroups = Object.keys(grouped).length > 0;

    if (hasGroups) {
        Object.keys(grouped).sort().forEach(category => {
            body.appendChild(createCategorySection(category, grouped[category]));
        });
    } else {
        // Pas de groupement — tout en une section
        const section = document.createElement('div');
        section.className = 'pending-category-section';
        items.forEach(item => {
            section.appendChild(createItemRow(item));
        });
        body.appendChild(section);
    }

    card.appendChild(body);

    // Footer informatif
    const footer = document.createElement('div');
    footer.className = 'pending-delivery-footer';
    footer.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>Aucune action requise de votre part. Vous serez notifié lors de l'expédition de ces articles.</span>
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
    row.innerHTML = `
        <div class="pending-item-qty">×${item.quantity}</div>
        <div class="pending-item-name">${item.Nom}</div>
        <div class="pending-item-status-tag">En attente</div>
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
