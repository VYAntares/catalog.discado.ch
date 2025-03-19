/**
 * Gestion des modales
 * API standardisée pour gérer les modales dans l'application
 */

// Stockage des callback de fermeture
const modalCloseCallbacks = new Map();

/**
 * Initialise toutes les modales
 */
export function initModals() {
    try {
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
                const visibleModal = document.querySelector('.modal[style*="display: block"], .modal[style*="display: flex"]');
                if (visibleModal) {
                    hideModal(visibleModal);
                }
            }
        });
    } catch (error) {
        console.error('Error initializing modals:', error);
    }
}

/**
 * Configure les gestionnaires de fermeture
 * @param {NodeList} closeButtons - Collection de boutons de fermeture
 */
export function setupModalCloseHandlers(closeButtons) {
    try {
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
    } catch (error) {
        console.error('Error setting up modal close handlers:', error);
    }
}

/**
 * Affiche une modale
 * @param {HTMLElement|string} modal - Élément modale ou ID de la modale
 * @param {Object} options - Options pour la modale
 * @param {Function} options.onClose - Callback appelé à la fermeture
 * @param {boolean} options.animate - Animer l'ouverture
 */
export function showModal(modal, options = {}) {
    try {
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
    } catch (error) {
        console.error('Error showing modal:', error);
    }
}

/**
 * Cache une modale
 * @param {HTMLElement|string} modal - Élément modale ou ID de la modale
 * @param {Object} options - Options pour la fermeture
 * @param {boolean} options.animate - Animer la fermeture
 * @param {Object} options.result - Résultat à passer au callback onClose
 */
export function hideModal(modal, options = {}) {
    try {
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
    } catch (error) {
        console.error('Error hiding modal:', error);
        // Essai de fermeture d'urgence
        if (modal) {
            modal.style.display = 'none';
            executeCloseCallback(modal, options.result);
        }
    }
}

/**
 * Exécute le callback de fermeture d'une modale
 * @param {HTMLElement} modal - Élément modale
 * @param {Object} result - Résultat à passer au callback
 */
function executeCloseCallback(modal, result) {
    try {
        if (modalCloseCallbacks.has(modal)) {
            const callback = modalCloseCallbacks.get(modal);
            callback(result);
            modalCloseCallbacks.delete(modal);
        }
    } catch (error) {
        console.error('Error executing modal close callback:', error);
    }
}

/**
 * Crée une boîte de dialogue de confirmation
 * @param {string} message - Message de confirmation
 * @param {Object} options - Options pour la confirmation
 * @param {string} options.title - Titre de la confirmation
 * @param {string} options.confirmText - Texte du bouton de confirmation
 * @param {string} options.cancelText - Texte du bouton d'annulation
 * @param {string} options.confirmClass - Classe CSS du bouton de confirmation
 * @returns {Promise} Promise résolue avec true (confirmation) ou false (annulation)
 */
export function showConfirmModal(message, options = {}) {
    return new Promise(resolve => {
        try {
            // Retirer l'ancienne modale si elle existe
            const existingModal = document.getElementById('confirmModal');
            if (existingModal) {
                document.body.removeChild(existingModal);
            }
            
            // Créer une nouvelle modale à chaque fois
            const confirmModal = document.createElement('div');
            confirmModal.id = 'confirmModal';
            confirmModal.className = 'modal confirm-modal';
            
            // Structure pour la modale
            confirmModal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3 class="confirm-title">${options.title || 'Confirmation'}</h3>
                    <p class="confirm-message">${message}</p>
                    <div class="modal-actions">
                        <button class="secondary-btn cancel-btn">${options.cancelText || 'Cancel'}</button>
                        <button class="${options.confirmClass || 'primary-btn confirm-btn'}">${options.confirmText || 'Confirm'}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmModal);
            
            // Récupérer les éléments
            const closeBtn = confirmModal.querySelector('.close-modal');
            const confirmBtn = confirmModal.querySelector('.confirm-btn') || 
                               confirmModal.querySelector(`.${options.confirmClass}`) ||
                               confirmModal.querySelector('.modal-actions button:last-child');
            const cancelBtn = confirmModal.querySelector('.cancel-btn') || 
                              confirmModal.querySelector('.secondary-btn') ||
                              confirmModal.querySelector('.modal-actions button:first-child');
            
            // Fonction de nettoyage commune
            function cleanup() {
                // Supprimer les écouteurs d'événements
                if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
                if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                if (closeBtn) closeBtn.removeEventListener('click', handleClose);
                
                // Supprimer la modale du DOM après l'animation
                setTimeout(() => {
                    if (confirmModal && confirmModal.parentNode) {
                        document.body.removeChild(confirmModal);
                    }
                }, 300);
            }
            
            // Gestionnaires d'événements
            function handleConfirm() {
                hideModal(confirmModal);
                cleanup();
                resolve(true);
            }
            
            function handleCancel() {
                hideModal(confirmModal);
                cleanup();
                resolve(false);
            }
            
            function handleClose() {
                hideModal(confirmModal);
                cleanup();
                resolve(false);
            }
            
            // Ajouter les écouteurs d'événements
            if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
            if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
            if (closeBtn) closeBtn.addEventListener('click', handleClose);
            
            // Gérer le clic en dehors de la modale
            confirmModal.addEventListener('click', function(event) {
                if (event.target === confirmModal) {
                    handleCancel();
                }
            });
            
            // Gestion de la touche Echap
            const handleKeyDown = function(event) {
                if (event.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeyDown);
                    handleCancel();
                }
            };
            
            document.addEventListener('keydown', handleKeyDown);
            
            // Afficher la modale
            showModal(confirmModal);
            
        } catch (error) {
            console.error('Error in showConfirmModal:', error);
            resolve(false); // En cas d'erreur, résoudre par défaut à false
        }
    });
}