/**
 * Gestion centralisée des modales
 * admin/js/utils/modal.js
 */

import { animateElement } from './ui.js';

const modalCloseCallbacks = new Map();

// Initialise toutes les modales
function initModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal, .close-btn');
    
    setupModalCloseHandlers(closeButtons);
    
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });
    
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const visibleModal = document.querySelector('.modal[style*="display: block"]');
            if (visibleModal) {
                hideModal(visibleModal);
            }
        }
    });
}

// Configure les gestionnaires de fermeture
function setupModalCloseHandlers(closeButtons) {
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                hideModal(modal);
            } else {
                const targetId = this.getAttribute('data-modal-target');
                if (targetId) {
                    const targetModal = document.getElementById(targetId);
                    if (targetModal) {
                        hideModal(targetModal);
                    }
                }
            }
        });
    });
}

// Affiche une modale
function showModal(modal, options = {}) {
    if (typeof modal === 'string') {
        modal = document.getElementById(modal);
    }
    
    if (!modal) {
        return;
    }
    
    if (options.onClose) {
        modalCloseCallbacks.set(modal, options.onClose);
    }
    
    if (options.animate !== false) {
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'translateY(20px)';
        }
        
        setTimeout(() => {
            modal.style.opacity = '1';
            if (content) {
                content.style.transform = 'translateY(0)';
            }
        }, 10);
    } else {
        modal.style.display = 'flex';
    }
    
    modal.dispatchEvent(new CustomEvent('modalOpened'));
    
    setTimeout(() => {
        const firstInput = modal.querySelector('input, select, textarea, button:not(.close-modal)');
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);
}

// Cache une modale
function hideModal(modal, options = {}) {
    if (typeof modal === 'string') {
        modal = document.getElementById(modal);
    }
    
    if (!modal) {
        return;
    }
    
    if (options.animate !== false) {
        modal.style.opacity = '0';
        
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'translateY(20px)';
        }
        
        setTimeout(() => {
            modal.style.display = 'none';
            
            modal.style.opacity = '';
            if (content) {
                content.style.transform = '';
            }
            
            executeCloseCallback(modal, options.result);
        }, 300);
    } else {
        modal.style.display = 'none';
        
        executeCloseCallback(modal, options.result);
    }
    
    modal.dispatchEvent(new CustomEvent('modalClosed'));
}

// Exécute le callback de fermeture d'une modale
function executeCloseCallback(modal, result) {
    if (modalCloseCallbacks.has(modal)) {
        const callback = modalCloseCallbacks.get(modal);
        callback(result);
        modalCloseCallbacks.delete(modal);
    }
}

// Affiche une modale de confirmation
function showConfirmModal(message, options = {}) {
    return new Promise(resolve => {
        let confirmModal = document.getElementById('confirmModal');
        
        if (!confirmModal) {
            confirmModal = document.createElement('div');
            confirmModal.id = 'confirmModal';
            confirmModal.className = 'modal';
            
            confirmModal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3 class="confirm-title">Confirmation</h3>
                    <p class="confirm-message"></p>
                    <div class="modal-actions">
                        <button class="action-btn secondary-btn cancel-btn">Annuler</button>
                        <button class="action-btn primary-btn confirm-btn">Confirmer</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmModal);
        }
        
        const title = confirmModal.querySelector('.confirm-title');
        const messageEl = confirmModal.querySelector('.confirm-message');
        const confirmBtn = confirmModal.querySelector('.confirm-btn');
        const cancelBtn = confirmModal.querySelector('.cancel-btn');
        
        if (options.title) {
            title.textContent = options.title;
        } else {
            title.textContent = 'Confirmation';
        }
        
        messageEl.textContent = message;
        
        if (options.confirmText) {
            confirmBtn.textContent = options.confirmText;
        } else {
            confirmBtn.textContent = 'Confirmer';
        }
        
        if (options.cancelText) {
            cancelBtn.textContent = options.cancelText;
        } else {
            cancelBtn.textContent = 'Annuler';
        }
        
        if (options.confirmClass) {
            confirmBtn.className = `action-btn ${options.confirmClass}`;
        } else {
            confirmBtn.className = 'action-btn primary-btn confirm-btn';
        }
        
        function handleConfirm() {
            cleanupListeners();
            hideModal(confirmModal);
            resolve(true);
        }
        
        function handleCancel() {
            cleanupListeners();
            hideModal(confirmModal);
            resolve(false);
        }
        
        function handleCloseModal() {
            cleanupListeners();
            resolve(false);
        }
        
        function cleanupListeners() {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modalCloseCallbacks.delete(confirmModal);
        }
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
        showModal(confirmModal, {
            onClose: handleCloseModal
        });
    });
}

export {
    initModals,
    showModal,
    hideModal,
    showConfirmModal,
    setupModalCloseHandlers
};