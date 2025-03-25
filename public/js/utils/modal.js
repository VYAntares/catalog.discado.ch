// public/js/utils/modal.js

const modalCloseCallbacks = new Map();

export function initModals() {
    try {
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

export function setupModalCloseHandlers(closeButtons) {
    try {
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
    } catch (error) {
        console.error('Error setting up modal close handlers:', error);
    }
}

export function showModal(modal, options = {}) {
    try {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        
        if (!modal) {
            console.error('Modal not found');
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
    } catch (error) {
        console.error('Error showing modal:', error);
    }
}

export function hideModal(modal, options = {}) {
    try {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        
        if (!modal) {
            console.error('Modal not found');
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
    } catch (error) {
        console.error('Error hiding modal:', error);
        if (modal) {
            modal.style.display = 'none';
            executeCloseCallback(modal, options.result);
        }
    }
}

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

export function showConfirmModal(message, options = {}) {
    return new Promise(resolve => {
        try {
            const existingModal = document.getElementById('confirmModal');
            if (existingModal) {
                document.body.removeChild(existingModal);
            }
            
            const confirmModal = document.createElement('div');
            confirmModal.id = 'confirmModal';
            confirmModal.className = 'modal confirm-modal';
            
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
            
            const closeBtn = confirmModal.querySelector('.close-modal');
            const confirmBtn = confirmModal.querySelector('.confirm-btn') || 
                               confirmModal.querySelector(`.${options.confirmClass}`) ||
                               confirmModal.querySelector('.modal-actions button:last-child');
            const cancelBtn = confirmModal.querySelector('.cancel-btn') || 
                              confirmModal.querySelector('.secondary-btn') ||
                              confirmModal.querySelector('.modal-actions button:first-child');
            
            function cleanup() {
                if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
                if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                if (closeBtn) closeBtn.removeEventListener('click', handleClose);
                
                setTimeout(() => {
                    if (confirmModal && confirmModal.parentNode) {
                        document.body.removeChild(confirmModal);
                    }
                }, 300);
            }
            
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
            
            if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
            if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
            if (closeBtn) closeBtn.addEventListener('click', handleClose);
            
            confirmModal.addEventListener('click', function(event) {
                if (event.target === confirmModal) {
                    handleCancel();
                }
            });
            
            const handleKeyDown = function(event) {
                if (event.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeyDown);
                    handleCancel();
                }
            };
            
            document.addEventListener('keydown', handleKeyDown);
            
            showModal(confirmModal);
            
        } catch (error) {
            console.error('Error in showConfirmModal:', error);
            resolve(false);
        }
    });
}