/**
 * Visualisation détaillée d'un client
 * admin/js/modules/clients/clientView.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as HistoryView from '../history/historyView.js';

let clientModal;
let clientDetailsContent;
let clientDetailsTitle;
let currentClientId;

//Affiche les détails d'un client dans une modale
async function viewClientDetails(clientId, fromMap = false) {
    currentClientId = clientId;
    clientModal = document.getElementById('clientModal');
    clientDetailsContent = document.getElementById('clientDetailsContent');
    clientDetailsTitle = document.getElementById('clientDetailsTitle');

    if (!clientModal || !clientDetailsContent) return;

    clientDetailsContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;

    Modal.showModal(clientModal);

    try {
        const clients = await API.fetchClientProfiles();
        const client = clients.find(c => c.clientId === clientId);

        if (client) {
            displayClientDetails(client, fromMap);
        } else {
            clientDetailsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <p>Client non trouvé</p>
                    <p>Détails recherchés : ${clientId}</p>
                </div>
            `;
        }
    } catch (error) {
        clientDetailsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails du client</p>
                <button class="action-btn" id="retryLoadClient">Réessayer</button>
            </div>
        `;
        
        const retryButton = document.getElementById('retryLoadClient');
        if (retryButton) {
            retryButton.addEventListener('click', function() {
                viewClientDetails(clientId);
            });
        }
    }
}

//Affiche les détails d'un client dans la modale
async function displayClientDetails(client, fromMap = false) {
    clientDetailsTitle.textContent = `Détails du client: ${client.clientId || 'N/A'}`;
    
    const lastUpdated = client.lastUpdated ? Formatter.formatDate(client.lastUpdated) : 'N/A';
    
    let html = `
        <div class="client-section">
            <div class="client-header">
                <h2 class="client-title">Détails du client: ${client.clientId || 'N/A'}</h2>
                <button class="client-close-btn" id="closeClientModal">&times;</button>
            </div>
            <div class="client-modal-actions">
                <a href="/admin/client-invoices?client_id=${encodeURIComponent(client.clientId)}&year=all${fromMap ? '&from=map' : ''}"
                   class="action-btn primary-btn btn-sm"
                   title="Voir les factures de ce client en comptabilité">
                    <i class="fas fa-file-invoice"></i> Voir factures compta
                </a>
            </div>

            <!-- Section Informations personnelles -->
            <div class="info-section">
                <h3 class="info-section-title">Informations personnelles</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">ID Client:</span>
                        <span class="info-value">${client.clientId || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Prénom:</span>
                        <span class="info-value">${client.firstName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Nom:</span>
                        <span class="info-value">${client.lastName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${client.email || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Téléphone:</span>
                        <span class="info-value">${client.phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Source/Référence:</span>
                        <span class="info-value">${client.referralSource || 'Non spécifiée'}</span>
                    </div>
                </div>
            </div>

            <!-- Section Informations boutique -->
            <div class="info-section">
                <h3 class="info-section-title">Informations boutique</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Nom de la boutique:</span>
                        <span class="info-value">${client.shopName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Adresse:</span>
                        <span class="info-value">${client.shopAddress || client.address || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ville:</span>
                        <span class="info-value">${client.shopCity || client.city || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Code postal:</span>
                        <span class="info-value">${client.shopZipCode || client.postalCode || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div id="pending-delivery-container"></div>
            <div id="client-orders-container"></div>
        </div>
    `;
    
    clientDetailsContent.innerHTML = html;
    
    document.getElementById('closeClientModal').addEventListener('click', function() {
        Modal.hideModal(clientModal);
    });
    
    try {
        const orders = await API.fetchClientOrders(client.clientId);
        
        const pendingDeliveryContainer = document.getElementById('pending-delivery-container');
        const ordersContainer = document.getElementById('client-orders-container');
        
        const pendingDelivery = orders.find(order => order.orderId === 'pending-delivery');
        const regularOrders = orders.filter(order => order.orderId !== 'pending-delivery');
        
        displayPendingDelivery(pendingDeliveryContainer, pendingDelivery, client.clientId);
        
        displayOrderHistory(ordersContainer, regularOrders, client.clientId);
    } catch (error) {
        document.getElementById('pending-delivery-container').innerHTML = `
            <div class="empty-state">
                <p>Erreur lors du chargement des articles en attente</p>
            </div>
        `;
        
        document.getElementById('client-orders-container').innerHTML = `
            <div class="empty-state">
                <p>Erreur lors du chargement de l'historique des commandes</p>
            </div>
        `;
    }
}

//Affiche les articles en attente de livraison
function displayPendingDelivery(container, pendingDelivery, clientId) {
    if (!pendingDelivery || !pendingDelivery.items || pendingDelivery.items.length === 0) {
        return;
    }

    const totalQty = pendingDelivery.items.reduce((sum, item) => sum + item.quantity, 0);

    const groupedItems = {};
    pendingDelivery.items.forEach(item => {
        const category = item.categorie || 'autres';
        if (!groupedItems[category]) groupedItems[category] = [];
        groupedItems[category].push(item);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'delivery-section';

    // Bouton toggle accordéon
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'admin-pending-toggle-btn';
    toggleBtn.innerHTML = `
        <i class="fas fa-truck" style="color:#d97706; font-size:18px; flex-shrink:0;"></i>
        <div class="admin-pending-toggle-label">
            <span class="admin-pending-toggle-title">Articles en attente de livraison</span>
            <small>${totalQty} article${totalQty > 1 ? 's' : ''} en attente de stock</small>
        </div>
        <span class="admin-pending-count-badge">${totalQty}</span>
        <i class="fas fa-chevron-down admin-pending-chevron"></i>
    `;
    wrapper.appendChild(toggleBtn);

    // Contenu collapsible
    const collapse = document.createElement('div');
    collapse.className = 'admin-pending-collapse';

    const sortedCategories = Object.keys(groupedItems).sort();
    let itemCounter = 0;
    let tableHTML = `
        <div class="delivery-table-container" style="margin-top:14px;">
            <table class="items-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="select-all-pending" title="Sélectionner tout"></th>
                        <th>Article</th>
                        <th>Catégorie</th>
                        <th>Quantité</th>
                        <th>Prix unitaire</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedCategories.forEach(category => {
        tableHTML += `
            <tr>
                <td colspan="5" class="category-header">${category.charAt(0).toUpperCase() + category.slice(1)}</td>
            </tr>
        `;
        groupedItems[category].forEach(item => {
            const itemId = `pending-item-${itemCounter++}`;
            tableHTML += `
                <tr>
                    <td>
                        <input type="checkbox"
                               id="${itemId}"
                               class="select-pending-item"
                               data-name="${item.Nom}"
                               data-price="${item.prix}"
                               data-quantity="${item.quantity}"
                               data-category="${item.categorie || 'autres'}">
                    </td>
                    <td>${item.Nom}</td>
                    <td>${item.categorie || 'Autre'}</td>
                    <td>${item.quantity}</td>
                    <td>${Formatter.formatPrice(item.prix)} CHF</td>
                </tr>
            `;
        });
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
        <div class="pending-actions" style="margin-top: 14px; display: flex; flex-direction: column; gap: 10px; width: 100%;">
            <button id="delete-selected-items" class="action-btn delete-btn" data-client-id="${clientId}">
                <i class="fas fa-trash"></i> Supprimer les articles sélectionnés
            </button>
            <button id="create-order-from-pending" class="action-btn primary-btn" data-client-id="${clientId}">
                <i class="fas fa-shopping-cart"></i> Créer une commande
            </button>
        </div>
    `;

    collapse.innerHTML = tableHTML;
    wrapper.appendChild(collapse);
    container.appendChild(wrapper);

    toggleBtn.addEventListener('click', () => {
        const isOpen = collapse.classList.contains('open');
        collapse.classList.toggle('open', !isOpen);
        toggleBtn.classList.toggle('open', !isOpen);
    });

    setupPendingDeliveryEvents(clientId);
}

//Configure les écouteurs d'événements pour les articles en attente
function setupPendingDeliveryEvents(clientId) {
    const selectAllCheckbox = document.getElementById('select-all-pending');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            document.querySelectorAll('.select-pending-item').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });
    }
    
    const createOrderBtn = document.getElementById('create-order-from-pending');
    if (createOrderBtn) {
        createOrderBtn.addEventListener('click', function() {
            const selectedItems = [];
            document.querySelectorAll('.select-pending-item:checked').forEach(checkbox => {
                selectedItems.push({
                    Nom: checkbox.getAttribute('data-name'),
                    prix: checkbox.getAttribute('data-price'),
                    quantity: parseInt(checkbox.getAttribute('data-quantity')),
                    categorie: checkbox.getAttribute('data-category')
                });
            });
            
            if (selectedItems.length > 0) {
                createOrderFromPendingItems(clientId, selectedItems);
            } else {
                Notification.showNotification('Veuillez sélectionner au moins un article', 'warning');
            }
        });
    }
    
    const deleteSelectedBtn = document.getElementById('delete-selected-items');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', function() {
            const selectedItems = [];
            document.querySelectorAll('.select-pending-item:checked').forEach(checkbox => {
                selectedItems.push({
                    Nom: checkbox.getAttribute('data-name'),
                    prix: checkbox.getAttribute('data-price'),
                    quantity: parseInt(checkbox.getAttribute('data-quantity')),
                    categorie: checkbox.getAttribute('data-category')
                });
            });
            
            if (selectedItems.length > 0) {
                deleteSelectedItems(clientId, selectedItems);
            } else {
                Notification.showNotification('Veuillez sélectionner au moins un article à supprimer', 'warning');
            }
        });
    }
}

//Supprime les articles sélectionnés
async function deleteSelectedItems(clientId, items) {
    const confirmDelete = confirm(`Êtes-vous sûr de vouloir supprimer définitivement les ${items.length} articles sélectionnés ?`);
    
    if (!confirmDelete) return;
    
    try {
        const response = await fetch('/api/admin/delete-pending-items', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId: clientId, items: items})
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            Notification.showNotification('Articles supprimés avec succès', 'success');
            viewClientDetails(clientId);
        } else {
            Notification.showNotification(`Erreur: ${result.message}`, 'error');
        }
    } catch (error) {
        Notification.showNotification('Erreur de communication avec le serveur: ' + error.message, 'error');
    }
}

//Crée une commande à partir des articles en attente sélectionnés
async function createOrderFromPendingItems(clientId, items) {
    try {
        const response = await fetch('/api/admin/create-order-from-pending', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId: clientId, items: items})
        });
        
        const result = await response.json();
        
        if (result.success) {
            Notification.showNotification('Commande mise à jour avec succès', 'success');
            viewClientDetails(clientId);
        } else {
            Notification.showNotification(`Erreur: ${result.message}`, 'error');
        }
    } catch (error) {
        Notification.showNotification('Erreur de communication avec le serveur', 'error');
    }
}

//Affiche l'historique des commandes d'un client sous forme de cartes extensibles
function displayOrderHistory(container, orders, clientId) {
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Aucune commande pour ce client</p>
            </div>
        `;
        return;
    }

    orders.sort((a, b) => new Date(b.lastProcessed || b.date) - new Date(a.lastProcessed || a.date));

    const section = document.createElement('div');
    section.className = 'orders-history-section';

    const title = document.createElement('h3');
    title.className = 'info-section-title';
    title.innerHTML = '<i class="fas fa-history" style="margin-right:6px;"></i>Historique des commandes';
    section.appendChild(title);

    orders.forEach(order => {
        if (order.orderId === 'pending-delivery') return;
        section.appendChild(createAdminOrderCard(order, clientId));
    });

    container.appendChild(section);
}

// Crée une carte de commande extensible
function createAdminOrderCard(order, clientId) {
    const deliveredItems = order.deliveredItems || order.items || [];
    const pendingItems   = order.remainingItems || [];
    const allItems       = [...deliveredItems, ...pendingItems];
    const totalQty       = allItems.reduce((s, i) => s + i.quantity, 0);
    const totalHT        = deliveredItems.reduce((s, i) => s + parseFloat(i.prix) * i.quantity, 0);

    const isComplete = ['completed', 'partial', 'shipped'].includes(order.status);
    const statusText  = isComplete ? 'Complète' : 'En attente';
    const statusClass = isComplete ? 'status-completed' : 'status-pending';
    const barClass    = isComplete ? 'admin-order-bar-success' : 'admin-order-bar-pending';

    const orderDate   = Formatter.formatDate(order.date);
    const processDate = order.lastProcessed ? Formatter.formatDate(order.lastProcessed) : null;

    const card = document.createElement('div');
    card.className = 'admin-order-card';

    // Barre colorée en haut
    const topBar = document.createElement('div');
    topBar.className = `admin-order-card-top-bar ${barClass}`;
    card.appendChild(topBar);

    // Header cliquable
    const header = document.createElement('div');
    header.className = 'admin-order-card-header';
    header.innerHTML = `
        <div class="admin-order-header-info">
            <div class="admin-order-header-id">
                <span class="admin-order-num">#${order.orderId}</span>
                <span class="order-status ${statusClass}">${statusText}</span>
            </div>
            <div class="admin-order-header-meta">
                <span><i class="fas fa-calendar-alt"></i> ${orderDate}</span>
                <span><i class="fas fa-box"></i> ${totalQty} article${totalQty > 1 ? 's' : ''}</span>
                ${processDate ? `<span><i class="fas fa-check-circle"></i> Traité le ${processDate}</span>` : ''}
                ${order.reference ? `<span><i class="fas fa-tag"></i> ${order.reference}</span>` : ''}
            </div>
        </div>
        <div class="admin-order-header-right">
            <div class="admin-order-total">
                <span class="admin-order-total-label">Total HT</span>
                <span class="admin-order-total-value">${Formatter.formatPrice(totalHT)} CHF</span>
            </div>
            <div class="admin-order-header-actions">
                <button class="admin-btn-expand">
                    <i class="fas fa-list-ul"></i>
                    <span>Voir les articles</span>
                    <i class="fas fa-chevron-down admin-expand-chevron"></i>
                </button>
                <button class="admin-btn-edit action-btn details-btn">
                    <i class="fas fa-edit"></i>
                    <span>Modifier</span>
                </button>
            </div>
        </div>
    `;
    card.appendChild(header);

    // Panneau de détail extensible
    const panel = createAdminOrderDetailPanel(order, clientId, deliveredItems, pendingItems);
    card.appendChild(panel);

    // Événements
    header.querySelector('.admin-btn-expand').addEventListener('click', () => {
        const isOpen = panel.classList.contains('open');
        panel.classList.toggle('open', !isOpen);
        header.classList.toggle('detail-open', !isOpen);
    });

    header.querySelector('.admin-btn-edit').addEventListener('click', () => {
        HistoryView.showOrderDetailsFromClientView(order.orderId, clientId);
    });

    return card;
}

// Crée le panneau de détail d'une commande (articles + facture)
function createAdminOrderDetailPanel(order, clientId, deliveredItems, pendingItems) {
    const panel = document.createElement('div');
    panel.className = 'admin-order-detail-panel';

    const inner = document.createElement('div');
    inner.className = 'admin-order-detail-inner';

    if (deliveredItems.length > 0) {
        inner.appendChild(buildAdminItemsSection(deliveredItems, false));
    }

    if (pendingItems.length > 0) {
        const banner = document.createElement('div');
        banner.className = 'admin-detail-pending-banner';
        banner.innerHTML = `<i class="fas fa-clock"></i> Articles en attente de stock — seront livrés dès disponibilité`;
        inner.appendChild(banner);
        inner.appendChild(buildAdminItemsSection(pendingItems, true));
    }

    inner.appendChild(buildAdminDetailFooter(order, clientId));
    panel.appendChild(inner);
    return panel;
}

// Construit une section d'articles groupés par catégorie
function buildAdminItemsSection(items, isPending) {
    const section = document.createElement('div');
    section.className = 'admin-detail-items-section';

    const grouped = {};
    items.forEach(item => {
        const cat = item.categorie || 'Autre';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    Object.keys(grouped).sort().forEach(category => {
        const catTitle = document.createElement('div');
        catTitle.className = `admin-detail-category-title${isPending ? ' admin-detail-cat-pending' : ''}`;
        catTitle.innerHTML = `<i class="fas fa-tag"></i> ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        section.appendChild(catTitle);

        grouped[category].forEach(item => {
            section.appendChild(buildAdminItemRow(item, isPending));
        });
    });

    return section;
}

// Construit une ligne d'article
function buildAdminItemRow(item, isPending) {
    const row = document.createElement('div');
    row.className = `admin-detail-item-row${isPending ? ' admin-detail-item-pending' : ''}`;

    const total = parseFloat(item.prix) * item.quantity;
    row.innerHTML = `
        <div class="admin-item-info">
            <div class="admin-item-name">${item.Nom}</div>
            <div class="admin-item-unit">${isPending ? 'En attente de livraison' : `${Formatter.formatPrice(item.prix)} CHF / unité`}</div>
        </div>
        <div class="admin-item-qty">× ${item.quantity}</div>
        <div class="admin-item-total ${isPending ? 'admin-item-total-pending' : ''}">
            ${isPending ? '—' : `${Formatter.formatPrice(total)} CHF`}
        </div>
    `;
    return row;
}

// Construit le footer avec bouton facture + modifier
function buildAdminDetailFooter(order, clientId) {
    const footer = document.createElement('div');
    footer.className = 'admin-detail-footer';

    const isInvoiceAvailable = !['pending', 'in progress'].includes(order.status);

    if (isInvoiceAvailable) {
        const invoiceBtn = document.createElement('button');
        invoiceBtn.className = 'admin-download-invoice-btn';
        invoiceBtn.innerHTML = `<i class="fas fa-file-pdf"></i><span>Télécharger la facture PDF</span>`;
        invoiceBtn.addEventListener('click', async () => {
            try {
                await window.downloadOrShareFile(
                    API.getInvoiceDownloadLink(order.orderId, clientId),
                    `Facture_${order.orderId}.pdf`
                );
            } catch (err) {
                Notification.showNotification('Erreur : ' + err.message, 'error');
            }
        });
        footer.appendChild(invoiceBtn);
    } else {
        const notice = document.createElement('div');
        notice.className = 'admin-invoice-not-available';
        notice.innerHTML = `<i class="fas fa-clock"></i><span>Facture disponible une fois la commande traitée</span>`;
        footer.appendChild(notice);
    }

    return footer;
}

export {
    viewClientDetails,
    displayClientDetails,
    displayPendingDelivery,
    displayOrderHistory,
    createOrderFromPendingItems,
    deleteSelectedItems
};