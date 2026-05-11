/**
 * Module d'édition des commandes dans la vue client
 * admin/js/modules/clients/clientOrderEdit.js
 */

import * as Notification from '../../utils/notification.js';
import * as AddItemModal from './clientOrderEditAddItem.js';

let currentOrderId = null;
let currentUserId = null;
let orderModifications = new Map();
let deletedItems = new Set();
let pendingAdditions = new Map();
let isEditing = false;

/**
 * Active l'édition pour une commande
 */
function enableOrderEditing(orderId, userId) {
    currentOrderId = orderId;
    currentUserId = userId;
    orderModifications.clear();
    deletedItems.clear();
    pendingAdditions.clear();

    // Rendre les cellules éditables
    const deliveredRows = document.querySelectorAll(`[data-order-id="${orderId}"] .items-table tbody tr:not(.category-header):not(.pending-item)`);

    deliveredRows.forEach(row => {
        const productCell = row.querySelector('td:nth-child(2)');
        const quantityCell = row.querySelector('td:nth-child(1)');
        const priceCell = row.querySelector('td:nth-child(3)');

        if (productCell && quantityCell && priceCell) {
            makeEditable(productCell, 'product_name', row);
            makeEditable(quantityCell, 'quantity', row);
            makeEditable(priceCell, 'unit_price', row);
            addDeleteButton(row);
        }
    });

    // Ajouter les boutons d'action en mode édition
    addSaveButton(orderId);
    addAddItemButton(orderId);

    isEditing = true;
}

/**
 * Ajoute un bouton de suppression à une ligne
 */
function addDeleteButton(row) {
    const totalCell = row.querySelector('td:nth-child(4)');
    if (!totalCell || totalCell.querySelector('.delete-item-btn')) return;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-item-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Supprimer cet article';
    deleteBtn.style.cssText = 'margin-left: 10px; background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s;';
    
    deleteBtn.onmouseover = function() {
        this.style.background = '#c82333';
    };
    
    deleteBtn.onmouseout = function() {
        if (!this.disabled) {
            this.style.background = '#dc3545';
        }
    };
    
    deleteBtn.onclick = function() {
        const productName = row.querySelector('td:nth-child(2)').textContent.trim();

        // Cas spécial: ligne ajoutée en attente — on la retire de pendingAdditions, pas de la DB
        const pendingAddId = row.getAttribute('data-pending-add-id');
        if (pendingAddId) {
            if (confirm(`Retirer "${productName}" des articles à ajouter ?`)) {
                pendingAdditions.delete(pendingAddId);
                row.remove();
                if (pendingAdditions.size === 0 && orderModifications.size === 0 && deletedItems.size === 0) {
                    const indicator = document.querySelector('.order-modified-indicator');
                    if (indicator) indicator.remove();
                }
            }
            return;
        }

        const orderItemId = parseInt(row.getAttribute('data-order-item-id'), 10) || null;
        if (confirm(`Êtes-vous sûr de vouloir supprimer "${productName}" de cette commande ?`)) {
            deletedItems.add(JSON.stringify({ order_item_id: orderItemId, product_name: productName }));
            orderModifications.delete(orderItemId || productName);

            row.style.opacity = '0.5';
            row.style.textDecoration = 'line-through';
            row.style.backgroundColor = '#ffe6e6';
            row.classList.add('item-deleted');

            deleteBtn.disabled = true;
            deleteBtn.style.background = '#6c757d';
            deleteBtn.style.cursor = 'not-allowed';

            // Désactiver les champs éditables
            row.querySelectorAll('.order-detail-editable').forEach(cell => {
                cell.classList.remove('order-detail-editable');
                cell.style.pointerEvents = 'none';
            });

            showModificationIndicator();
        }
    };
    
    totalCell.appendChild(deleteBtn);
}

/**
 * Reconstruit la cellule produit (nom + pastille de taille)
 */
function rebuildProductCell(cell, name, size) {
    const safeName = String(name || '');
    const sizePill = size ? ` <span class="order-detail-size-pill">Taille ${size}</span>` : '';
    cell.innerHTML = `<span class="product-name">${safeName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>${sizePill}`;
}

/**
 * Rend une cellule éditable
 */
function makeEditable(cell, fieldType, row) {
    cell.classList.add('order-detail-editable');
    
    cell.addEventListener('click', function() {
        if (!isEditing || row.classList.contains('item-deleted')) return;

        // Pour le nom de produit, lire uniquement le span .product-name (ignorer la pastille de taille)
        const productNameSpan = cell.querySelector('.product-name');
        const sizeText = row.getAttribute('data-size') || '';
        const currentValue = (fieldType === 'product_name' && productNameSpan)
            ? productNameSpan.textContent.trim()
            : cell.textContent.trim().replace(' CHF', '');
        const originalValue = currentValue;
        const productNameCell = row.querySelector('td:nth-child(2)');
        const productNameSpanForKey = productNameCell ? productNameCell.querySelector('.product-name') : null;
        const originalProductName = productNameSpanForKey
            ? productNameSpanForKey.textContent.trim()
            : (productNameCell ? productNameCell.textContent.trim() : '');
        const orderItemId = parseInt(row.getAttribute('data-order-item-id'), 10) || null;
        const mapKey = orderItemId || originalProductName;
        
        let input;
        if (fieldType === 'quantity') {
            input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.className = 'inline-order-edit-input';
            input.value = currentValue;
        } else if (fieldType === 'unit_price') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.min = '0';
            input.className = 'inline-order-edit-input';
            input.value = currentValue;
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'inline-order-edit-input';
            input.value = currentValue;
        }
        
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        const pendingAddId = row.getAttribute('data-pending-add-id') || null;

        const save = () => {
            const newValue = input.value.trim();

            if (newValue && newValue !== originalValue) {
                if (pendingAddId && pendingAdditions.has(pendingAddId)) {
                    // Ligne ajoutée en attente : mettre à jour pendingAdditions directement
                    const addition = pendingAdditions.get(pendingAddId);
                    if (fieldType === 'product_name') addition.product_name = newValue;
                    else if (fieldType === 'quantity') addition.quantity = parseInt(newValue, 10);
                    else if (fieldType === 'unit_price') addition.unit_price = parseFloat(newValue);
                } else {
                    if (!orderModifications.has(mapKey)) {
                        orderModifications.set(mapKey, { order_item_id: orderItemId, productName: originalProductName });
                    }
                    const modifications = orderModifications.get(mapKey);
                    modifications[fieldType] = newValue;
                }

                // Mettre à jour l'affichage
                if (fieldType === 'unit_price') {
                    cell.textContent = `${parseFloat(newValue).toFixed(2)} CHF`;
                } else if (fieldType === 'product_name') {
                    rebuildProductCell(cell, newValue, sizeText);
                } else {
                    cell.textContent = newValue;
                }

                if (fieldType === 'quantity' || fieldType === 'unit_price') {
                    updateRowTotal(row);
                }

                showModificationIndicator();
            } else {
                if (fieldType === 'product_name') {
                    rebuildProductCell(cell, originalValue, sizeText);
                } else {
                    cell.textContent = originalValue + (fieldType === 'unit_price' ? ' CHF' : '');
                }
            }

            cell.classList.add('order-detail-editable');
        };

        const cancel = () => {
            if (fieldType === 'product_name') {
                rebuildProductCell(cell, originalValue, sizeText);
            } else {
                cell.textContent = originalValue + (fieldType === 'unit_price' ? ' CHF' : '');
            }
            cell.classList.add('order-detail-editable');
        };
        
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            } else if (e.key === 'Escape') {
                cancel();
            }
        });
        
        cell.classList.remove('order-detail-editable');
    });
}

/**
 * Met à jour le total d'une ligne
 */
function updateRowTotal(row) {
    const quantityCell = row.querySelector('td:nth-child(1)');
    const priceCell = row.querySelector('td:nth-child(3)');
    const totalCell = row.querySelector('td:nth-child(4)');
    
    if (quantityCell && priceCell && totalCell) {
        const quantity = parseFloat(quantityCell.textContent.trim());
        const price = parseFloat(priceCell.textContent.replace(' CHF', '').trim());
        
        const total = quantity * price;
        totalCell.textContent = `${total.toFixed(2)} CHF`;
    }
}

/**
 * Affiche l'indicateur de modification
 */
function showModificationIndicator() {
    const orderHeader = document.querySelector(`[data-order-id="${currentOrderId}"] .order-detail-header h3, [data-order-id="${currentOrderId}"] .order-number`);
    
    if (orderHeader && !document.querySelector('.order-modified-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'order-modified-indicator';
        indicator.innerHTML = '<i class="fas fa-exclamation-circle"></i> Non sauvegardé';
        orderHeader.appendChild(indicator);
    }
}

/**
 * Ajoute le bouton de sauvegarde
 */
function addSaveButton(orderId) {
    const actionsFooter = document.querySelector(`[data-order-id="${orderId}"] .order-actions-footer`);

    if (actionsFooter && !document.querySelector('.save-order-changes-btn')) {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-order-changes-btn';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder les modifications';
        saveBtn.addEventListener('click', saveOrderChanges);

        actionsFooter.insertBefore(saveBtn, actionsFooter.firstChild);
    }
}

/**
 * Ajoute le bouton "Ajouter un article" (mode édition uniquement)
 */
function addAddItemButton(orderId) {
    const actionsFooter = document.querySelector(`[data-order-id="${orderId}"] .order-actions-footer`);
    if (!actionsFooter) return;
    if (actionsFooter.querySelector('.add-item-to-order-btn')) return;

    const addBtn = document.createElement('button');
    addBtn.className = 'add-item-to-order-btn';
    addBtn.type = 'button';
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Ajouter un article';
    addBtn.addEventListener('click', () => {
        AddItemModal.openAddItemModal(handleItemAdd);
    });

    const saveBtn = actionsFooter.querySelector('.save-order-changes-btn');
    if (saveBtn) {
        actionsFooter.insertBefore(addBtn, saveBtn.nextSibling);
    } else {
        actionsFooter.insertBefore(addBtn, actionsFooter.firstChild);
    }
}

/**
 * Callback appelé quand l'utilisateur ajoute un article via la modale
 */
function handleItemAdd(item) {
    const pendingAddId = `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    pendingAdditions.set(pendingAddId, {
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        category: item.category || null,
        size: item.size || null
    });

    insertPendingRow(pendingAddId, item);
    showModificationIndicator();

    Notification.showNotification(`"${item.product_name}" ajouté (à sauvegarder)`, 'success');
}

/**
 * Insère une ligne dans la bonne section catégorie d'un tbody.
 * Si la catégorie n'existe pas encore, crée son en-tête et l'ajoute en fin de tbody.
 */
function insertRowInCategory(tbody, row, category) {
    const cat = (category || 'autres').toString().toLowerCase();
    const headerText = cat.charAt(0).toUpperCase() + cat.slice(1);

    // Cherche un .category-header existant correspondant à cette catégorie
    const headers = tbody.querySelectorAll('tr.category-header');
    let matchedHeader = null;
    headers.forEach(h => {
        const txt = (h.textContent || '').trim().toLowerCase();
        if (txt === cat) matchedHeader = h;
    });

    if (matchedHeader) {
        // Avance jusqu'à la prochaine en-tête de catégorie (ou fin de tbody)
        let cursor = matchedHeader.nextElementSibling;
        while (cursor && !cursor.classList.contains('category-header')) {
            cursor = cursor.nextElementSibling;
        }
        // Insère avant cette frontière (ou en fin si aucune)
        if (cursor) {
            tbody.insertBefore(row, cursor);
        } else {
            tbody.appendChild(row);
        }
        return;
    }

    // Pas d'en-tête existant : créer un nouveau bloc catégorie en fin de tbody
    const headerRow = document.createElement('tr');
    headerRow.className = 'category-header';
    headerRow.innerHTML = `<td colspan="4" class="category-section">${headerText}</td>`;
    tbody.appendChild(headerRow);
    tbody.appendChild(row);
}

/**
 * Insère visuellement une ligne pour un article ajouté en attente
 */
function insertPendingRow(pendingAddId, item) {
    const orderContainer = document.querySelector(`[data-order-id="${currentOrderId}"]`);
    if (!orderContainer) return;

    // Cible : la première table .items-table dans la section livrée (pas celle des pending-table)
    let table = orderContainer.querySelector('#delivered-items-content .items-table');
    if (!table) {
        // fallback : première table non-pending
        table = orderContainer.querySelector('.items-table:not(.pending-table)');
    }
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Si la table affichait "Aucun article livré", on retire ce placeholder
    const noItemsRow = tbody.querySelector('.no-items');
    if (noItemsRow) noItemsRow.closest('tr').remove();

    const baseName = item.product_name;
    const total = (item.unit_price * item.quantity).toFixed(2);
    const unitPriceFmt = parseFloat(item.unit_price).toFixed(2);
    const sizePill = item.size ? `<span class="order-detail-size-pill">Taille ${item.size}</span>` : '';

    const row = document.createElement('tr');
    row.className = 'item-added';
    row.setAttribute('data-pending-add-id', pendingAddId);
    row.setAttribute('data-product-name', baseName);
    row.setAttribute('data-product-id', item.product_id || '');
    row.setAttribute('data-order-item-id', '');
    row.setAttribute('data-size', item.size || '');

    row.innerHTML = `
        <td class="qty-column">${item.quantity}</td>
        <td class="product-column"><span class="product-name">${baseName}</span>${sizePill}</td>
        <td class="unit-price-column">${unitPriceFmt} CHF</td>
        <td class="total-column">${total} CHF</td>
    `;

    insertRowInCategory(tbody, row, item.category);

    // Ouvre la section livrée si elle est repliée pour que l'admin voie l'ajout
    const collapsibleContent = document.getElementById('delivered-items-content');
    if (collapsibleContent && collapsibleContent.style.display === 'none') {
        collapsibleContent.style.display = 'block';
        const header = orderContainer.querySelector('.collapsible-header[data-target="delivered-items-content"]');
        if (header) {
            const icon = header.querySelector('.collapsible-icon');
            if (icon) icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
            header.classList.add('collapsible-open');
        }
    }

    // Rendre cellules éditables + bouton supprimer pour cohérence avec les autres lignes
    const productCell = row.querySelector('td:nth-child(2)');
    const quantityCell = row.querySelector('td:nth-child(1)');
    const priceCell = row.querySelector('td:nth-child(3)');
    if (productCell && quantityCell && priceCell) {
        makeEditable(productCell, 'product_name', row);
        makeEditable(quantityCell, 'quantity', row);
        makeEditable(priceCell, 'unit_price', row);
        addDeleteButton(row);
    }
}

/**
 * Sauvegarde les modifications de la commande
 */
async function saveOrderChanges() {
    if (orderModifications.size === 0 && deletedItems.size === 0 && pendingAdditions.size === 0) {
        Notification.showNotification('Aucune modification à sauvegarder', 'info');
        return;
    }
    
    const saveBtn = document.querySelector('.save-order-changes-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
    }
    
    try {
        const modifications = [];

        for (const [, changes] of orderModifications.entries()) {
            const modif = {
                order_item_id: changes.order_item_id,
                productName: changes.productName
            };

            if (changes.quantity !== undefined) {
                modif.quantity = parseInt(changes.quantity);
            }
            if (changes.unit_price !== undefined) {
                modif.unit_price = parseFloat(changes.unit_price);
            }

            modifications.push(modif);
        }

        const deletions = Array.from(deletedItems).map(s => JSON.parse(s));

        const additions = Array.from(pendingAdditions.values()).map(a => ({
            product_id: a.product_id || null,
            product_name: a.product_name,
            unit_price: parseFloat(a.unit_price),
            quantity: parseInt(a.quantity, 10),
            category: a.category || null,
            size: a.size || null
        }));

        console.log('📤 Envoi au serveur:', {
            orderId: currentOrderId,
            userId: currentUserId,
            modifications,
            deletions,
            additions
        });

        const response = await fetch('/api/admin/update-order-items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: currentOrderId,
                userId: currentUserId,
                modifications: modifications,
                deletions: deletions,
                additions: additions
            })
        });
        
        const result = await response.json();
        
        console.log('📥 Réponse serveur:', result);
        
        if (result.success) {
            Notification.showNotification('Modifications sauvegardées avec succès', 'success');

            // Retirer l'indicateur de modification
            const indicator = document.querySelector('.order-modified-indicator');
            if (indicator) {
                indicator.remove();
            }

            const refreshOrderId = currentOrderId;
            const refreshUserId = currentUserId;

            // Réinitialiser l'état d'édition
            orderModifications.clear();
            deletedItems.clear();
            pendingAdditions.clear();
            isEditing = false;

            // Re-render le détail de la commande sans recharger toute la page
            if (typeof window.viewOrderDetails === 'function') {
                window.viewOrderDetails(refreshOrderId, refreshUserId);
            } else {
                // Fallback : recharger la page si le re-render n'est pas disponible
                setTimeout(() => location.reload(), 800);
            }
        } else {
            throw new Error(result.message || 'Erreur lors de la sauvegarde');
        }
    } catch (error) {
        console.error('❌ Erreur:', error);
        Notification.showNotification('Erreur lors de la sauvegarde: ' + error.message, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder les modifications';
        }
    }
}

/**
 * Annule le mode édition sans sauvegarder
 */
function cancelOrderEditing() {
    orderModifications.clear();
    deletedItems.clear();
    pendingAdditions.clear();
    isEditing = false;
    currentOrderId = null;
    currentUserId = null;
}

export {
    enableOrderEditing,
    cancelOrderEditing,
    saveOrderChanges
};