// Composant Header pour Discado
// Version 2.0 - Responsive et Professionnel

// Initialisation du header
function initDiscadoHeader() {
    // Vérifier si le header existe déjà
    if (document.querySelector('.discado-header-initialized')) {
        return;
    }

    // Récupérer le conteneur
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) {
        console.error('Header container not found on page');
        return;
    }

    // Injecter le HTML du header
    headerContainer.innerHTML = `
    <!-- Header -->
    <header class="discado-header-initialized">
        <div class="header-container">
            <!-- Section gauche: Catalogue PDF & Informations de contact -->
            <div class="left-section">
                <div class="pdf-catalog-container">
                    <button id="pdfCatalogToggle" class="icon-btn-with-text" aria-label="PDF Catalog">
                        <i class="fas fa-file-pdf"></i>
                        <span>Catalog PDF</span>
                    </button>
                </div>
                
                <!-- Informations de contact avec icônes -->
                <div class="contact-info">
                    <div class="contact-details">
                        <div class="contact-item">
                            <a href="tel:+41783433631"><i class="fas fa-phone"></i><span>+41 78 343 36 31</span></a>
                        </div>
                        <div class="contact-item">
                            <a href="mailto:catalog.discado@gmail.com"><i class="fas fa-envelope"></i><span>catalog.discado@gmail.com</span></a>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Logo, centré -->
            <div class="logo-container">
                <a href="/pages/catalog.html">
                    <img src="/images/logo/logo_discado_noir.png" alt="Discado Logo" id="logo">
                </a>
            </div>
            
            <!-- Section droite pour panier et utilisateur -->
            <div class="header-right">
                <button id="cartToggle" class="icon-btn" aria-label="Shopping cart">
                    <i class="fas fa-shopping-cart"></i>
                    <span id="cartCountBadge" class="cart-count-badge">0</span>
                </button>
                <button id="userMenuToggle" class="icon-btn" aria-label="User menu">
                    <i class="fas fa-user"></i>
                </button>
            </div>
        </div>
    </header>
    <!-- Menu Utilisateur -->
    <div id="userMenu" class="user-menu">
        <a href="/pages/profile.html"><i class="fas fa-user-circle"></i> Profile</a>
        <a href="/pages/orders.html"><i class="fas fa-shopping-bag"></i> My Orders</a>
        <a href="/logout"><i class="fas fa-sign-out-alt"></i> Logout</a>
    </div>
    <!-- Overlay du Menu -->
    <div id="menuOverlay" class="menu-overlay"></div>
    `;

    // Initialiser les fonctionnalités
    setupUserMenu();
    setupPdfCatalog();
    setupCartEvents();
    setupClickOutsideListener();

    // Mettre à jour le badge du panier
    updateCartCountBadge();
}

// Mise à jour du badge de comptage du panier
function updateCartCountBadge() {
    try {
        const cartCount = getCartItemCount();
        const cartCountBadge = document.getElementById('cartCountBadge');
        
        if (cartCountBadge) {
            cartCountBadge.textContent = cartCount;
            cartCountBadge.style.display = cartCount > 0 ? 'flex' : 'none';
            
            if (cartCount > 99) {
                cartCountBadge.textContent = '99+';
                cartCountBadge.classList.add('large-number');
            } else {
                cartCountBadge.classList.remove('large-number');
            }
        }
    } catch (e) {
        console.warn('Error updating cart badge:', e);
    }
}

// Obtenir le nombre d'articles dans le panier
function getCartItemCount() {
    try {
        const cartJson = localStorage.getItem('discado_cart');
        if (!cartJson) return 0;
        
        const cart = JSON.parse(cartJson);
        if (!Array.isArray(cart)) return 0;
        
        return cart.reduce((total, item) => total + (parseInt(item.quantity) || 0), 0);
    } catch (e) {
        console.warn('Error getting cart count:', e);
        return 0;
    }
}

// Configuration du menu utilisateur
function setupUserMenu() {
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userMenu = document.getElementById('userMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!userMenuToggle || !userMenu || !menuOverlay) return;
    
    userMenuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleUserMenu();
    });

    menuOverlay.addEventListener('click', closeAllMenus);
}

// Basculer le menu utilisateur
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!userMenu || !menuOverlay) return;
    
    userMenu.classList.toggle('open');
    
    if (userMenu.classList.contains('open')) {
        menuOverlay.classList.add('active');
    } else {
        menuOverlay.classList.remove('active');
    }
}

// Configuration de l'écoute des clics en dehors
function setupClickOutsideListener() {
    document.addEventListener('click', function(e) {
        const userMenu = document.getElementById('userMenu');
        const userMenuToggle = document.getElementById('userMenuToggle');
        
        if (userMenu && userMenu.classList.contains('open')) {
            if (!userMenu.contains(e.target) && !userMenuToggle.contains(e.target)) {
                closeAllMenus();
            }
        }
    });
}

// Fermer le menu utilisateur
function closeUserMenu() {
    const userMenu = document.getElementById('userMenu');
    
    if (userMenu && userMenu.classList.contains('open')) {
        userMenu.classList.remove('open');
    }
}

// Fermer tous les menus
function closeAllMenus() {
    closeUserMenu();
    
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) {
        menuOverlay.classList.remove('active');
    }
}

// Configuration du catalogue PDF
function setupPdfCatalog() {
    const pdfToggle = document.getElementById('pdfCatalogToggle');
    
    if (pdfToggle) {
        pdfToggle.addEventListener('click', function() {
            const pdfUrl = 'https://www.dropbox.com/scl/fi/0gymxq4jtwdno6q1l5td2/Catalogue-Discado-2025.pdf?rlkey=zx8p1syhojya62atiteib8660&e=1&st=ol0xk3lc&dl=1';
            
            if (confirm('Voulez-vous télécharger le catalogue PDF?')) {
                window.open(pdfUrl, '_blank');
            }
        });
    }
}

// Configuration des événements du panier
function setupCartEvents() {
    const cartToggle = document.getElementById('cartToggle');
    if (cartToggle) {
        cartToggle.addEventListener('click', function() {
            if (window.showCartModal) {
                window.showCartModal();
            } else {
                window.location.href = '/pages/catalog.html';
            }
        });
    }
    
    document.addEventListener('cartUpdated', updateCartCountBadge);
    
    window.addEventListener('storage', function(e) {
        if (e.key === 'discado_cart') {
            updateCartCountBadge();
        }
    });
}

// Connecter les fonctionnalités du panier au header
function connectCartToHeader() {
    setupCartEvents();
    updateCartCountBadge();
}

// Exporter les fonctions
window.DiscadoHeader = {
    init: initDiscadoHeader,
    connectCart: connectCartToHeader,
    updateCartBadge: updateCartCountBadge
};

// Initialiser le header au chargement
document.addEventListener('DOMContentLoaded', initDiscadoHeader);