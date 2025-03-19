/**
 * Header module
 * Handles all header interactions and functionality
 */

import { showModal, hideModal } from '../../utils/modal.js';
import { initCartManager } from '../cart/cartManager.js';

/**
 * Initialize the header functionality
 */
export function initHeader() {
    console.log('Header module initialized');
    
    // Toggle menu
    setupMobileMenu();
    
    // Initialize user menu
    setupUserMenu();
    
    // Initialize cart functionality
    initCartManaxager();
    
    // Handle scroll behavior
    setupScrollBehavior();
    
    // Initialize PDF catalog
    setupPdfCatalog();
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
 * Setup scroll behavior
 */
function setupScrollBehavior() {
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (!header) return;
        
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Make header smaller on scroll down
        if (currentScrollTop > 50) {
            header.classList.add('header-compact');
        } else {
            header.classList.remove('header-compact');
        }
        
        // Hide header on scroll down, show on scroll up
        if (currentScrollTop > lastScrollTop && currentScrollTop > 120) {
            // Scrolling down
            if (!header.style.transform || header.style.transform !== 'translateY(-100%)') {
                header.style.transform = 'translateY(-100%)';
            }
        } else {
            // Scrolling up
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = currentScrollTop;
    });
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