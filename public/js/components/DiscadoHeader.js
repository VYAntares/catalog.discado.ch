/**
 * Enhanced Header Component for Discado
 * Version 2.0 - Responsive and Professional
 */

// Function to initialize the header
function initDiscadoHeader() {
    // Check if header already exists to prevent duplication
    if (document.querySelector('.discado-header-initialized')) {
        return;
    }

    // Add header HTML structure
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) {
        console.error('Header container not found on page');
        return;
    }

    // Add header content
    headerContainer.innerHTML = `
    <!-- Header -->
    <header class="discado-header-initialized">
        <div class="header-container">
            <!-- Left Section: PDF Catalog & Contact Info -->
            <div class="left-section">
                <div class="pdf-catalog-container">
                    <button id="pdfCatalogToggle" class="icon-btn-with-text" aria-label="PDF Catalog">
                        <i class="fas fa-file-pdf"></i>
                        <span>Catalog PDF</span>
                    </button>
                </div>
                
                <!-- Contact information with icons -->
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
            
            <!-- Logo, centered -->
            <div class="logo-container">
                <a href="/pages/catalog.html">
                    <img src="/images/logo/logo_discado_noir.png" alt="Discado Logo" id="logo">
                </a>
            </div>
            
            <!-- Right section for cart and user -->
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
    <!-- User Menu -->
    <div id="userMenu" class="user-menu">
        <a href="/pages/profile.html"><i class="fas fa-user-circle"></i> Profile</a>
        <a href="/pages/orders.html"><i class="fas fa-shopping-bag"></i> My Orders</a>
        <a href="/logout"><i class="fas fa-sign-out-alt"></i> Logout</a>
    </div>
    <!-- Menu Overlay -->
    <div id="menuOverlay" class="menu-overlay"></div>
    `;

    // Initialize functionality
    setupUserMenu();
    setupPdfCatalog();
    setupCartEvents();
    setupClickOutsideListener();

    // Load cart count badge
    updateCartCountBadge();
}

/**
 * Update the cart count badge
 */
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

/**
 * Get cart item count
 */
function getCartItemCount() {
    try {
        // Try to get cart from localStorage
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

/**
 * Setup user menu toggle functionality
 */
function setupUserMenu() {
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userMenu = document.getElementById('userMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!userMenuToggle || !userMenu || !menuOverlay) return;
    
    userMenuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleUserMenu();
    });

    // Close when overlay is clicked
    menuOverlay.addEventListener('click', closeAllMenus);
}

/**
 * Toggle the user menu
 */
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!userMenu || !menuOverlay) return;
    
    // Toggle user menu
    userMenu.classList.toggle('open');
    
    // Toggle overlay
    if (userMenu.classList.contains('open')) {
        menuOverlay.classList.add('active');
    } else {
        menuOverlay.classList.remove('active');
    }
}

/**
 * Setup click outside listener to close menus
 */
function setupClickOutsideListener() {
    document.addEventListener('click', function(e) {
        const userMenu = document.getElementById('userMenu');
        const userMenuToggle = document.getElementById('userMenuToggle');
        
        if (userMenu && userMenu.classList.contains('open')) {
            // Check if click is outside the menu and the toggle button
            if (!userMenu.contains(e.target) && !userMenuToggle.contains(e.target)) {
                closeAllMenus();
            }
        }
    });
}

/**
 * Close the user menu
 */
function closeUserMenu() {
    const userMenu = document.getElementById('userMenu');
    
    if (userMenu && userMenu.classList.contains('open')) {
        userMenu.classList.remove('open');
    }
}

/**
 * Close all menus
 */
function closeAllMenus() {
    closeUserMenu();
    
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) {
        menuOverlay.classList.remove('active');
    }
}

/**
 * Setup PDF catalog with confirmation dialog
 */
function setupPdfCatalog() {
    const pdfToggle = document.getElementById('pdfCatalogToggle');
    
    if (pdfToggle) {
        pdfToggle.addEventListener('click', function() {
            // PDF catalog URL
            const pdfUrl = 'https://www.dropbox.com/scl/fi/0gymxq4jtwdno6q1l5td2/Catalogue-Discado-2025.pdf?rlkey=zx8p1syhojya62atiteib8660&e=1&st=ol0xk3lc&dl=1';
            
            // Ask for confirmation before downloading
            if (confirm('Voulez-vous télécharger le catalogue PDF?')) {
                window.open(pdfUrl, '_blank');
            }
        });
    }
}

/**
 * Setup cart-related events
 */
function setupCartEvents() {
    const cartToggle = document.getElementById('cartToggle');
    if (cartToggle) {
        cartToggle.addEventListener('click', function() {
            if (window.showCartModal) {
                window.showCartModal();
            } else {
                // Fallback - redirect to catalog page which has the cart
                window.location.href = '/pages/catalog.html';
            }
        });
    }
    
    // Update cart badge when custom events are triggered
    document.addEventListener('cartUpdated', updateCartCountBadge);
    
    // Also listen for storage events to update cart across tabs
    window.addEventListener('storage', function(e) {
        if (e.key === 'discado_cart') {
            updateCartCountBadge();
        }
    });
}

// Connect cart functionality to the header (to be called after cart module is loaded)
function connectCartToHeader() {
    setupCartEvents();
    updateCartCountBadge();
}

// Export functions for use in other modules
window.DiscadoHeader = {
    init: initDiscadoHeader,
    connectCart: connectCartToHeader,
    updateCartBadge: updateCartCountBadge
};

// Initialize header when script loads
document.addEventListener('DOMContentLoaded', initDiscadoHeader);