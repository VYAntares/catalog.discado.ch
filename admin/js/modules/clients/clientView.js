/**
 * Visualisation détaillée d'un client
 * admin/js/modules/clients/clientView.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as HistoryView from '../history/historyView.js';
import { downloadOrShareFile } from '../../utils/fileDownload.js';

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

// Échappe une valeur HTML pour usage dans des attributs
function escapeAttr(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Génère un champ éditable (span + input caché)
function editableField(label, fieldKey, value, opts = {}) {
    const placeholder = opts.placeholder || 'N/A';
    const type = opts.type || 'text';
    const display = value && String(value).trim() ? value : placeholder;
    const inputAttrs = opts.inputAttrs || '';
    return `
        <div class="info-item" data-editable-field="${fieldKey}">
            <span class="info-label">${label}</span>
            <span class="info-value" data-display>${escapeAttr(display)}</span>
            <input type="${type}" class="info-input" data-input
                   name="${fieldKey}" value="${escapeAttr(value || '')}"
                   ${inputAttrs} hidden>
        </div>
    `;
}

//Affiche les détails d'un client dans la modale
async function displayClientDetails(client, fromMap = false) {
    clientDetailsTitle.textContent = `Détails du client: ${client.clientId || 'N/A'}`;

    const lastUpdated = client.lastUpdated ? Formatter.formatDate(client.lastUpdated) : 'N/A';

    let html = `
        <div class="client-section" data-client-id="${escapeAttr(client.clientId)}">
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
                <button class="action-btn edit-client-btn btn-sm" id="editClientBtn" type="button">
                    <i class="fas fa-pen"></i> Modifier
                </button>
                <button class="action-btn primary-btn btn-sm" id="saveClientBtn" type="button" hidden>
                    <i class="fas fa-save"></i> Enregistrer
                </button>
                <button class="action-btn cancel-edit-btn btn-sm" id="cancelClientEditBtn" type="button" hidden>
                    <i class="fas fa-times"></i> Annuler
                </button>
            </div>

            <!-- Section Informations personnelles -->
            <div class="info-section">
                <h3 class="info-section-title">Informations personnelles</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">ID Client:</span>
                        <span class="info-value">${escapeAttr(client.clientId || 'N/A')}</span>
                    </div>
                    ${editableField('Prénom:', 'firstName', client.firstName)}
                    ${editableField('Nom:', 'lastName', client.lastName)}
                    ${editableField('Email:', 'email', client.email, { type: 'email' })}
                    ${editableField('Téléphone:', 'phone', client.phone, { type: 'tel', inputAttrs: 'inputmode="numeric"' })}
                    ${editableField('Source/Référence:', 'referralSource', client.referralSource, { placeholder: 'Non spécifiée' })}
                </div>
            </div>

            <!-- Section Informations boutique (livraison) -->
            <div class="info-section">
                <h3 class="info-section-title">Adresse de livraison (boutique)</h3>
                <div class="info-grid">
                    ${editableField('Nom de la boutique:', 'shopName', client.shopName)}
                    ${editableField('Adresse:', 'shopAddress', client.shopAddress || client.address)}
                    ${editableField('Ville:', 'shopCity', client.shopCity || client.city)}
                    ${editableField('Code postal:', 'shopZipCode', client.shopZipCode || client.postalCode, { inputAttrs: 'inputmode="numeric"' })}
                </div>
            </div>

            <!-- Section Adresse de facturation -->
            <div class="info-section" data-billing-section>
                <h3 class="info-section-title">
                    Adresse de facturation
                    <span class="billing-same-badge" data-billing-badge
                          style="font-size:12px;font-weight:500;color:#06b6d4;background:#ecfeff;padding:3px 10px;border-radius:12px;margin-left:8px;${client.billingSameAsShipping ? '' : 'display:none;'}">
                        identique à la livraison
                    </span>
                </h3>
                <label class="billing-same-edit-toggle" data-billing-toggle hidden>
                    <input type="checkbox" id="adminBillingSameAsShipping" ${client.billingSameAsShipping ? 'checked' : ''}>
                    <span>Identique à l'adresse de livraison</span>
                </label>
                <div class="info-grid" data-billing-grid>
                    ${editableField('Prénom:', 'billingFirstName', client.billingFirstName)}
                    ${editableField('Nom:', 'billingLastName', client.billingLastName)}
                    ${editableField('Société / Boutique:', 'billingShopName', client.billingShopName)}
                    ${editableField('Adresse:', 'billingAddress', client.billingAddress)}
                    ${editableField('Ville:', 'billingCity', client.billingCity)}
                    ${editableField('Code postal:', 'billingZipCode', client.billingZipCode, { inputAttrs: 'inputmode="numeric"' })}
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

    setupClientEditMode(client);
    
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
                    categorie: checkbox.getAttribute('data-category'),
                    product_id: checkbox.getAttribute('data-product-id')
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

// Crée une carte de commande
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
    const isInvoiceAvailable = !['pending', 'in progress'].includes(order.status);

    const orderDate   = Formatter.formatDate(order.date);
    const processDate = order.lastProcessed ? Formatter.formatDate(order.lastProcessed) : null;

    const card = document.createElement('div');
    card.className = 'admin-order-card';

    const topBar = document.createElement('div');
    topBar.className = `admin-order-card-top-bar ${barClass}`;
    card.appendChild(topBar);

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
                <button class="admin-btn-details action-btn details-btn">
                    <i class="fas fa-edit"></i>
                    <span>Détails</span>
                </button>
                ${isInvoiceAvailable ? `
                <button class="admin-btn-invoice">
                    <i class="fas fa-file-pdf"></i>
                    <span>Facture</span>
                </button>` : ''}
            </div>
        </div>
    `;
    card.appendChild(header);

    header.querySelector('.admin-btn-details').addEventListener('click', () => {
        HistoryView.showOrderDetailsFromClientView(order.orderId, clientId);
    });

    if (isInvoiceAvailable) {
        header.querySelector('.admin-btn-invoice').addEventListener('click', async () => {
            try {
                await downloadOrShareFile(
                    API.getInvoiceDownloadLink(order.orderId, clientId),
                    `Facture_${order.orderId}.pdf`
                );
            } catch (err) {
                Notification.showNotification('Erreur : ' + err.message, 'error');
            }
        });
    }

    return card;
}

// === Mode édition rapide du profil client (admin) ===
function setupClientEditMode(client) {
    const editBtn = document.getElementById('editClientBtn');
    const saveBtn = document.getElementById('saveClientBtn');
    const cancelBtn = document.getElementById('cancelClientEditBtn');
    if (!editBtn || !saveBtn || !cancelBtn) return;

    const section = clientDetailsContent.querySelector('.client-section');
    const billingBadge = section.querySelector('[data-billing-badge]');
    const billingToggle = section.querySelector('[data-billing-toggle]');
    const billingCheckbox = section.querySelector('#adminBillingSameAsShipping');
    const billingGrid = section.querySelector('[data-billing-grid]');

    const setMode = (editing) => {
        section.classList.toggle('editing', editing);
        editBtn.hidden = editing;
        saveBtn.hidden = !editing;
        cancelBtn.hidden = !editing;
        if (billingToggle) billingToggle.hidden = !editing;
        if (billingBadge) billingBadge.style.display = (!editing && client.billingSameAsShipping) ? '' : 'none';

        section.querySelectorAll('[data-editable-field]').forEach(item => {
            const display = item.querySelector('[data-display]');
            const input = item.querySelector('[data-input]');
            if (!display || !input) return;
            display.hidden = editing;
            input.hidden = !editing;
        });

        if (editing) applyBillingToggleState();
    };

    const applyBillingToggleState = () => {
        if (!billingCheckbox || !billingGrid) return;
        const sameAsShipping = billingCheckbox.checked;
        billingGrid.style.opacity = sameAsShipping ? '0.5' : '1';
        billingGrid.querySelectorAll('[data-input]').forEach(input => {
            input.disabled = sameAsShipping;
        });
        if (sameAsShipping) prefillBillingFromShipping();
    };

    const prefillBillingFromShipping = () => {
        const map = {
            billingFirstName: 'firstName',
            billingLastName: 'lastName',
            billingShopName: 'shopName',
            billingAddress: 'shopAddress',
            billingCity: 'shopCity',
            billingZipCode: 'shopZipCode'
        };
        Object.entries(map).forEach(([billing, shipping]) => {
            const bInput = section.querySelector(`[data-editable-field="${billing}"] [data-input]`);
            const sInput = section.querySelector(`[data-editable-field="${shipping}"] [data-input]`);
            if (bInput && sInput) bInput.value = sInput.value;
        });
    };

    const collect = () => {
        const data = {};
        section.querySelectorAll('[data-editable-field]').forEach(item => {
            const input = item.querySelector('[data-input]');
            if (input) data[input.name] = input.value.trim();
        });
        data.billingSameAsShipping = billingCheckbox ? billingCheckbox.checked : true;
        return data;
    };

    editBtn.addEventListener('click', () => setMode(true));

    cancelBtn.addEventListener('click', () => {
        // Restaure les valeurs initiales depuis le client
        section.querySelectorAll('[data-editable-field]').forEach(item => {
            const key = item.getAttribute('data-editable-field');
            const input = item.querySelector('[data-input]');
            if (input) input.value = client[key] || '';
        });
        if (billingCheckbox) billingCheckbox.checked = !!client.billingSameAsShipping;
        setMode(false);
    });

    if (billingCheckbox) billingCheckbox.addEventListener('change', applyBillingToggleState);

    saveBtn.addEventListener('click', async () => {
        const profileData = collect();
        saveBtn.disabled = true;
        const originalLabel = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

        try {
            const result = await API.updateClientProfile(client.clientId, profileData);
            if (result && result.profile) {
                Notification.showNotification('Client mis à jour avec succès', 'success');
                // Réaffiche avec les données fraîches
                displayClientDetails({ ...result.profile, clientId: client.clientId }, false);
            } else {
                Notification.showNotification('Erreur : ' + (result?.message || 'Mise à jour impossible'), 'error');
            }
        } catch (error) {
            Notification.showNotification('Erreur lors de la mise à jour : ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalLabel;
        }
    });
}

export {
    viewClientDetails,
    displayClientDetails,
    displayPendingDelivery,
    displayOrderHistory,
    createOrderFromPendingItems,
    deleteSelectedItems
};