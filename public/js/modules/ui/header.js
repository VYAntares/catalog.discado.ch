// public/js/modules/ui/header.js

import { showModal, hideModal } from '../../utils/modal.js';
import { initCartManager } from '../cart/cartManager.js';

export function initHeader() {
    setupMobileMenu();
    setupUserMenu();
    initCartManager();
    setupScrollBehavior();
    setupPdfCatalog();
}

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

function toggleDropdownMenu() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!dropdownMenu || !menuOverlay) return;
    
    closeUserMenu();
    
    dropdownMenu.classList.toggle('open');
    
    if (dropdownMenu.classList.contains('open')) {
        menuOverlay.classList.add('active');
    } else {
        menuOverlay.classList.remove('active');
    }
}

function setupUserMenu() {
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userMenu = document.getElementById('userMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!userMenuToggle || !userMenu || !menuOverlay) return;
    
    userMenuToggle.addEventListener('click', function() {
        toggleUserMenu();
    });
}

function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (!userMenu || !menuOverlay) return;
    
    closeDropdownMenu();
    
    userMenu.classList.toggle('open');
    
    if (userMenu.classList.contains('open')) {
        menuOverlay.classList.add('active');
    } else {
        menuOverlay.classList.remove('active');
    }
}

function closeUserMenu() {
    const userMenu = document.getElementById('userMenu');
    
    if (userMenu && userMenu.classList.contains('open')) {
        userMenu.classList.remove('open');
    }
}

function closeDropdownMenu() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    
    if (dropdownMenu && dropdownMenu.classList.contains('open')) {
        dropdownMenu.classList.remove('open');
    }
}

function closeAllMenus() {
    closeDropdownMenu();
    closeUserMenu();
    
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) {
        menuOverlay.classList.remove('active');
    }
}

function setupScrollBehavior() {
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (!header) return;
        
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (currentScrollTop > 50) {
            header.classList.add('header-compact');
        } else {
            header.classList.remove('header-compact');
        }
        
        if (currentScrollTop > lastScrollTop && currentScrollTop > 120) {
            if (!header.style.transform || header.style.transform !== 'translateY(-100%)') {
                header.style.transform = 'translateY(-100%)';
            }
        } else {
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = currentScrollTop;
    });
}

function setupPdfCatalog() {
    const pdfToggle = document.getElementById('pdfCatalogToggle');
    
    if (pdfToggle) {
        pdfToggle.addEventListener('click', function() {
            const pdfUrl = 'https://www.dropbox.com/scl/fi/0gymxq4jtwdno6q1l5td2/Catalogue-Discado-2025.pdf?rlkey=zx8p1syhojya62atiteib8660&e=1&st=ol0xk3lc&dl=1';
            window.open(pdfUrl, '_blank');
        });
    }
}

export {
    setupMobileMenu,
    toggleDropdownMenu,
    setupUserMenu,
    toggleUserMenu,
    closeUserMenu,
    closeDropdownMenu,
    closeAllMenus,
    setupScrollBehavior,
    setupPdfCatalog
};