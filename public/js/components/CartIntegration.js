// Module d'intégration du panier
// Connecte les fonctionnalités du panier à n'importe quelle page
//public/js/components/CartIntegration.js

let _cartIntegrationInitialized = false;

// Chargement du HTML du modal panier
function loadCartModal() {
    // Création du conteneur si nécessaire
    let cartModalContainer = document.getElementById('cart-modal-container');
    if (!cartModalContainer) {
        cartModalContainer = document.createElement('div');
        cartModalContainer.id = 'cart-modal-container';
        document.body.appendChild(cartModalContainer);
    }

    // Chargement du HTML du modal
    fetch('/components/cart-modal.html')
        .then(response => response.text())
        .then(data => {
            cartModalContainer.innerHTML = data;
            if (window.i18n) window.i18n.applyAll(cartModalContainer);
            setupCartCloseButton();
            initializeCartManager();
        })
        .catch(error => {
            console.error('Error loading cart modal:', error);
        });
}

// Configuration du bouton de fermeture
function setupCartCloseButton() {
    const cartModal = document.getElementById('cart-modal');
    const closeButton = cartModal?.querySelector('.close-modal');
    
    if (cartModal && closeButton) {
        // Gestionnaire de clic sur le bouton
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            hideCartModal();
        });
        
        // Gestionnaire de touche ESC
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && isCartModalOpen()) {
                hideCartModal();
            }
        });
        
        // Gestionnaire de clic en dehors
        cartModal.addEventListener('click', function(event) {
            if (event.target === cartModal) {
                hideCartModal();
            }
        });
    }
}

// Masquer le modal panier
function hideCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (!cartModal) return;
    
    if (window.hideModal) {
        window.hideModal(cartModal);
    } else {
        cartModal.style.opacity = '0';
        setTimeout(() => {
            cartModal.style.display = 'none';
            cartModal.style.opacity = '';
        }, 300);
    }
}

// Vérifier si le modal est ouvert
function isCartModalOpen() {
    const cartModal = document.getElementById('cart-modal');
    return cartModal && (cartModal.style.display === 'flex' || cartModal.style.display === 'block');
}

// Afficher le modal panier
function showCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (!cartModal) return;
    
    // Afficher le contenu du panier d'abord
    if (window.displayCart) {
        window.displayCart();
    }
    
    // Puis afficher le modal
    if (window.showModal) {
        window.showModal(cartModal);
    } else {
        cartModal.style.display = 'flex';
        cartModal.style.opacity = '0';
        setTimeout(() => {
            cartModal.style.opacity = '1';
        }, 10);
    }
}

// Initialisation du gestionnaire de panier
function initializeCartManager() {
    import('/js/modules/cart/cartManager.js')
        .then(module => {
            // Rendre les fonctions disponibles globalement
            window.displayCart = module.displayCart;
            window.showCartModal = showCartModal;
            
            // Initialiser les fonctionnalités
            if (module.initCartManager) {
                module.initCartManager();
            }
            
            // Connecter au header
            if (window.DiscadoHeader && window.DiscadoHeader.connectCart) {
                window.DiscadoHeader.connectCart();
            }
            
            // Connecter le bouton de basculement
            const cartToggle = document.getElementById('cartToggle');
            if (cartToggle) {
                cartToggle.addEventListener('click', showCartModal);
            }
        })
        .catch(error => {
            console.error('Error initializing cart:', error);
        });
}

// Importer les utilitaires de modal
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

// Initialisation globale
function init() {
    if (_cartIntegrationInitialized) return;
    _cartIntegrationInitialized = true;

    importModalUtils()
        .then(() => {
            loadCartModal();
        });
}

// Rendre les fonctions disponibles globalement
window.CartIntegration = {
    init,
    loadCartModal,
    showCartModal,
    hideCartModal
};

// Auto-initialisation
document.addEventListener('DOMContentLoaded', init);