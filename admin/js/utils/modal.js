/**
 * Gestion centralisée des modales
 * Ce module offre une API standardisée pour gérer les modales dans l'application
 */

import { animateElement } from './ui.js';

// Stockage des callback de fermeture
const modalCloseCallbacks = new Map();

/**
 * Initialise toutes les modales
 */
function initModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal, .close-btn');
    
    // Installer les gestionnaires pour tous les boutons de fermeture
    setupModalCloseHandlers(closeButtons);
    
    // Installer le gestionnaire de clic en dehors des modales
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });
    
    // Gestionnaire d'échappement pour fermer la modale active
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const visibleModal = document.querySelector('.modal[style*="display: block"]');
            if (visibleModal) {
                hideModal(visibleModal);
            }
        }
    });
}

/**
 * Configure les gestionnaires de fermeture
 * @param {NodeList} closeButtons - Collection de boutons de fermeture
 */
function setupModalCloseHandlers(closeButtons) {
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Trouver la modale parente
            const modal = this.closest('.modal');
            if (modal) {
                hideModal(modal);
            } else {
                // Si le bouton n'est pas dans une modale, chercher par attribut data
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

/**
 * Affiche une modale
 * @param {HTMLElement|string} modal - Élément modale ou ID de la modale
 * @param {Object} options - Options pour la modale
 * @param {Function} options.onClose - Callback appelé à la fermeture
 * @param {boolean} options.animate - Animer l'ouverture
 */
function showModal(modal, options = {}) {
    // Si un ID est passé, récupérer l'élément
    if (typeof modal === 'string') {
        modal = document.getElementById(modal);
    }
    
    if (!modal) {
        console.error('Modal not found');
        return;
    }
    
    // Stocker le callback de fermeture si fourni
    if (options.onClose) {
        modalCloseCallbacks.set(modal, options.onClose);
    }
    
    // Afficher la modale
    if (options.animate !== false) {
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        
        // Animer le contenu
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'translateY(20px)';
        }
        
        // Animation de fade in
        setTimeout(() => {
            modal.style.opacity = '1';
            if (content) {
                content.style.transform = 'translateY(0)';
            }
        }, 10);
    } else {
        modal.style.display = 'flex';
    }
    
    // Déclencher un événement
    modal.dispatchEvent(new CustomEvent('modalOpened'));
    
    // Focus sur le premier champ de formulaire si présent
    setTimeout(() => {
        const firstInput = modal.querySelector('input, select, textarea, button:not(.close-modal)');
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);
}

/**
 * Cache une modale
 * @param {HTMLElement|string} modal - Élément modale ou ID de la modale
 * @param {Object} options - Options pour la fermeture
 * @param {boolean} options.animate - Animer la fermeture
 * @param {Object} options.result - Résultat à passer au callback onClose
 */
function hideModal(modal, options = {}) {
    // Si un ID est passé, récupérer l'élément
    if (typeof modal === 'string') {
        modal = document.getElementById(modal);
    }
    
    if (!modal) {
        console.error('Modal not found');
        return;
    }
    
    // Animer la fermeture si requis
    if (options.animate !== false) {
        modal.style.opacity = '0';
        
        // Animer le contenu
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'translateY(20px)';
        }
        
        // Cacher après l'animation
        setTimeout(() => {
            modal.style.display = 'none';
            
            // Réinitialiser les propriétés d'animation
            modal.style.opacity = '';
            if (content) {
                content.style.transform = '';
            }
            
            // Exécuter le callback de fermeture si présent
            executeCloseCallback(modal, options.result);
        }, 300);
    } else {
        // Cacher immédiatement
        modal.style.display = 'none';
        
        // Exécuter le callback de fermeture si présent
        executeCloseCallback(modal, options.result);
    }
    
    // Déclencher un événement
    modal.dispatchEvent(new CustomEvent('modalClosed'));
}

/**
 * Exécute le callback de fermeture d'une modale
 * @param {HTMLElement} modal - Élément modale
 * @param {Object} result - Résultat à passer au callback
 */
function executeCloseCallback(modal, result) {
    if (modalCloseCallbacks.has(modal)) {
        const callback = modalCloseCallbacks.get(modal);
        callback(result);
        modalCloseCallbacks.delete(modal);
    }
}

/**
 * Affiche une modale de confirmation
 * @param {string} message - Message de confirmation
 * @param {Object} options - Options pour la confirmation
 * @param {string} options.title - Titre de la confirmation
 * @param {string} options.confirmText - Texte du bouton de confirmation
 * @param {string} options.cancelText - Texte du bouton d'annulation
 * @param {string} options.confirmClass - Classe CSS du bouton de confirmation
 * @returns {Promise} Promise résolue avec true (confirmation) ou false (annulation)
 */
function showConfirmModal(message, options = {}) {
    return new Promise(resolve => {
        // Créer la modale de confirmation si elle n'existe pas
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
        
        // Mettre à jour le contenu
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
        
        // Configurer les écouteurs
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
        
        // Ajouter les écouteurs
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
        // Afficher la modale
        showModal(confirmModal, {
            onClose: handleCloseModal
        });
    });
}

// Exposer les fonctions publiques
export {
    initModals,
    showModal,
    hideModal,
    showConfirmModal,
    setupModalCloseHandlers
};