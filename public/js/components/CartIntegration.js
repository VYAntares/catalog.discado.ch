// Save this as /public/js/components/CartIntegration.js

/**
 * Cart Integration Module
 * Properly connects the cart functionality to any page
 */

// Load cart modal HTML
function loadCartModal() {
    // Create container if it doesn't exist
    let cartModalContainer = document.getElementById('cart-modal-container');
    if (!cartModalContainer) {
        cartModalContainer = document.createElement('div');
        cartModalContainer.id = 'cart-modal-container';
        document.body.appendChild(cartModalContainer);
    }

    // Load cart modal HTML
    fetch('/components/cart-modal.html')
        .then(response => response.text())
        .then(data => {
            cartModalContainer.innerHTML = data;
            
            // After loading the cart HTML, set up the close button
            setupCartCloseButton();
            
            // Then initialize the cart manager
            initializeCartManager();
        })
        .catch(error => {
            console.error('Error loading cart modal:', error);
        });
}

// Specifically set up the cart close button
function setupCartCloseButton() {
    const cartModal = document.getElementById('cart-modal');
    const closeButton = cartModal?.querySelector('.close-modal');
    
    if (cartModal && closeButton) {
        // Add direct click handler to close button
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            hideCartModal();
        });
        
        // Add ESC key handler
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && isCartModalOpen()) {
                hideCartModal();
            }
        });
        
        // Add click outside handler
        cartModal.addEventListener('click', function(event) {
            if (event.target === cartModal) {
                hideCartModal();
            }
        });
        
        console.log('Cart close button setup complete');
    } else {
        console.warn('Could not find cart modal or close button');
    }
}

// Hide cart modal function
function hideCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (!cartModal) return;
    
    // First try to use the modal utility if available
    if (window.hideModal) {
        window.hideModal(cartModal);
    } else {
        // Fallback to direct style manipulation
        cartModal.style.opacity = '0';
        setTimeout(() => {
            cartModal.style.display = 'none';
            cartModal.style.opacity = '';
        }, 300);
    }
}

// Check if cart modal is open
function isCartModalOpen() {
    const cartModal = document.getElementById('cart-modal');
    return cartModal && (cartModal.style.display === 'flex' || cartModal.style.display === 'block');
}

// Show cart modal function
function showCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (!cartModal) return;
    
    // Display cart contents first
    if (window.displayCart) {
        window.displayCart();
    }
    
    // Then show the modal
    if (window.showModal) {
        window.showModal(cartModal);
    } else {
        // Fallback to direct style manipulation
        cartModal.style.display = 'flex';
        cartModal.style.opacity = '0';
        setTimeout(() => {
            cartModal.style.opacity = '1';
        }, 10);
    }
}

// Initialize cart manager
function initializeCartManager() {
    // Import cart manager module
    import('/js/modules/cart/cartManager.js')
        .then(module => {
            // Store reference to display cart function globally
            window.displayCart = module.displayCart;
            window.showCartModal = showCartModal;
            
            // Initialize cart functionality
            if (module.initCartManager) {
                module.initCartManager();
            }
            
            // Connect the cart functionality to the header
            if (window.DiscadoHeader && window.DiscadoHeader.connectCart) {
                window.DiscadoHeader.connectCart();
            }
            
            // Connect cart toggle button manually
            const cartToggle = document.getElementById('cartToggle');
            if (cartToggle) {
                cartToggle.addEventListener('click', showCartModal);
            }
        })
        .catch(error => {
            console.error('Error initializing cart:', error);
        });
}

// Import modal utilities if needed
function importModalUtils() {
    return import('/js/utils/modal.js')
        .then(module => {
            window.showModal = module.showModal;
            window.hideModal = module.hideModal;
            return module;
        })
        .catch(error => {
            console.error('Error importing modal utilities:', error);
        });
}

// Initialize everything when DOM is ready
function init() {
    // First import modal utilities
    importModalUtils()
        .then(() => {
            // Then load cart modal
            loadCartModal();
        });
}

// Make functions available globally
window.CartIntegration = {
    init: init,
    loadCartModal: loadCartModal,
    showCartModal: showCartModal,
    hideCartModal: hideCartModal
};

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', init);