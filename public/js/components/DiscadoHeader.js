/**
 * Enhanced Header Component for Discado
 * Header 100% statique - ne bouge pas du tout pendant le défilement
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
            <button id="menuToggle" class="menu-toggle" aria-label="Toggle menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
                
            <!-- Logo -->
            <div class="logo-container">
                <a href="/pages/catalog.html">
                    <img src="/images/logo/logo_discado_noir.png" alt="Discado Logo" id="logo">
                </a>
            </div>

            <div class="header-right">
                <button id="pdfCatalogToggle" class="icon-btn" aria-label="PDF Catalog">
                    <i class="fas fa-file-pdf"></i>
                </button>

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

    <!-- Dropdown Menu -->
    <div id="dropdownMenu" class="dropdown-menu">
        <div class="menu-section">
            <h3>Category</h3>
            <ul class="category-list">
                <li class="category-item active" data-category="all">All Products</li>
                <li class="category-item" data-category="magnet">MAGNETS</li>
                <li class="category-item" data-category="keyring">KEYRINGS</li>
                <li class="category-item" data-category="bags">TOTEBAGS & BAGS</li>
                <li class="category-item" data-category="gadget">GADGETS</li>
                <li class="category-item" data-category="patches">PATCHES</li>
                <li class="category-item" data-category="cloths">CLOTHS</li>
                <li class="category-item" data-category="plates">PLATES</li>
                <li class="category-item" data-category="bells">BELLS</li>
                <li class="category-item" data-category="lighter">LIGHTERS</li>
                <li class="category-item" data-category="tshirt">T-SHIRTS</li>
                <li class="category-item" data-category="caps">CAPS</li>
                <li class="category-item" data-category="hats">HATS</li>
                <li class="category-item" data-category="pens">PENS</li>
                <li class="category-item" data-category="softtoy">SOFT TOYS</li>
            </ul>
        </div>
    </div>

    <!-- User Menu -->
    <div id="userMenu" class="user-menu">
        <a href="/pages/profile.html">My Profile</a>
        <a href="/pages/orders.html">My Orders</a>
        <a href="/logout">Log Out</a>
    </div>

    <!-- Menu Overlay -->
    <div id="menuOverlay" class="menu-overlay"></div>
    `;

    // Initialize functionality
    setupMobileMenu();
    setupUserMenu();
    setupPdfCatalog();
    // SUPPRIMÉ: setupScrollBehavior(); - On ne change plus rien au scroll

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
        
        return cart.reduce((total, item) => total + (item.quantity || 0), 0);
    } catch (e) {
        console.warn('Error getting cart count:', e);
        return 0;
    }
}

/**
 * Setup mobile menu toggle functionality
 */
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!menuToggle || !dropdownMenu || !menuOverlay) return;
    
    menuToggle.addEventListener('click', function() {
        toggleDropdownMenu();
    });
    
    menuOverlay.addEventListener('click', function() {
        closeAllMenus();
    });
}

/**
 * Toggle the dropdown menu
 */
function toggleDropdownMenu() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!dropdownMenu || !menuOverlay) return;
    
    // Close user menu if open
    closeUserMenu();
    
    // Toggle dropdown menu
    dropdownMenu.classList.toggle('open');
    
    // Toggle overlay
    if (dropdownMenu.classList.contains('open')) {
        menuOverlay.classList.add('active');
    } else {
        menuOverlay.classList.remove('active');
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
    
    userMenuToggle.addEventListener('click', function() {
        toggleUserMenu();
    });
}

/**
 * Toggle the user menu
 */
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!userMenu || !menuOverlay) return;
    
    // Close dropdown menu if open
    closeDropdownMenu();
    
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
 * Close the user menu
 */
function closeUserMenu() {
    const userMenu = document.getElementById('userMenu');
    
    if (userMenu && userMenu.classList.contains('open')) {
        userMenu.classList.remove('open');
    }
}

/**
 * Close the dropdown menu
 */
function closeDropdownMenu() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    
    if (dropdownMenu && dropdownMenu.classList.contains('open')) {
        dropdownMenu.classList.remove('open');
    }
}

/**
 * Close all menus
 */
function closeAllMenus() {
    closeDropdownMenu();
    closeUserMenu();
    
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) {
        menuOverlay.classList.remove('active');
    }
}

/**
 * Setup PDF catalog
 */
function setupPdfCatalog() {
    const pdfToggle = document.getElementById('pdfCatalogToggle');
    
    if (pdfToggle) {
        pdfToggle.addEventListener('click', function() {
            const pdfUrl = 'https://www.dropbox.com/scl/fi/0gymxq4jtwdno6q1l5td2/Catalogue-Discado-2025.pdf?rlkey=zx8p1syhojya62atiteib8660&e=1&st=ol0xk3lc&dl=1';
            window.open(pdfUrl, '_blank');
        });
    }
}

// Handle cart-related events
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
}

// Connect cart functionality to the header (to be called after cart module is loaded)
function connectCartToHeader() {
    setupCartEvents();
}

// Export functions for use in other modules
window.DiscadoHeader = {
    init: initDiscadoHeader,
    connectCart: connectCartToHeader
};

// Initialize header when script loads
document.addEventListener('DOMContentLoaded', initDiscadoHeader);