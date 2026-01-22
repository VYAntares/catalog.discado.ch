/**
 * Module d'édition des commandes dans la vue client
 * admin/js/modules/clients/clientOrderEdit.js
 */

import * as Notification from '../../utils/notification.js';

let currentOrderId = null;
let currentUserId = null;
let orderModifications = new Map();
let isEditing = false;

/**
 * Active l'édition pour une commande
 */
function enableOrderEditing(orderId, userId) {
    currentOrderId = orderId;
    currentUserId = userId;
    orderModifications.clear();
    
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
        }
    });
    
    // Ajouter le bouton de sauvegarde
    addSaveButton(orderId);
    
    isEditing = true;
}

/**
 * Rend une cellule éditable
 */
function makeEditable(cell, fieldType, row) {
    cell.classList.add('order-detail-editable');
    
    cell.addEventListener('click', function() {
        if (!isEditing) return;
        
        const currentValue = cell.textContent.trim().replace(' CHF', '');
        const originalValue = currentValue;
        
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
        
        const save = () => {
            const newValue = input.value.trim();
            
            if (newValue && newValue !== originalValue) {
                // Enregistrer la modification
                const productName = row.querySelector('td:nth-child(2)').textContent.trim();
                
                if (!orderModifications.has(productName)) {
                    orderModifications.set(productName, {});
                }
                
                const modifications = orderModifications.get(productName);
                modifications[fieldType] = newValue;
                
                // Mettre à jour l'affichage
                if (fieldType === 'unit_price') {
                    cell.textContent = `${parseFloat(newValue).toFixed(2)} CHF`;
                } else {
                    cell.textContent = newValue;
                }
                
                // Recalculer le total si quantité ou prix changé
                if (fieldType === 'quantity' || fieldType === 'unit_price') {
                    updateRowTotal(row);
                }
                
                // Afficher l'indicateur de modification
                showModificationIndicator();
            } else {
                cell.textContent = originalValue + (fieldType === 'unit_price' ? ' CHF' : '');
            }
            
            cell.classList.add('order-detail-editable');
        };
        
        const cancel = () => {
            cell.textContent = originalValue + (fieldType === 'unit_price' ? ' CHF' : '');
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
    const orderHeader = document.querySelector(`[data-order-id="${currentOrderId}"] .order-detail-header h3`);
    
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
 * Sauvegarde les modifications de la commande
 */
async function saveOrderChanges() {
    if (orderModifications.size === 0) {
        Notification.showNotification('Aucune modification à sauvegarder', 'info');
        return;
    }
    
    const saveBtn = document.querySelector('.save-order-changes-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
    }
    
    try {
        const modifications = Array.from(orderModifications.entries()).map(([productName, changes]) => ({
            productName,
            ...changes
        }));
        
        const response = await fetch('/api/admin/update-order-items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: currentOrderId,
                userId: currentUserId,
                modifications: modifications
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            Notification.showNotification('Modifications sauvegardées avec succès', 'success');
            
            // Retirer l'indicateur de modification
            const indicator = document.querySelector('.order-modified-indicator');
            if (indicator) {
                indicator.remove();
            }
            
            // Réinitialiser
            orderModifications.clear();
            
            // Recharger les détails de la commande
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            throw new Error(result.message || 'Erreur lors de la sauvegarde');
        }
    } catch (error) {
        console.error('Erreur:', error);
        Notification.showNotification('Erreur lors de la sauvegarde: ' + error.message, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder les modifications';
        }
    }
}

export {
    enableOrderEditing,
    saveOrderChanges
};