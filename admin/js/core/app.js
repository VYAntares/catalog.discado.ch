/**
 * Initialisation principale de l'application admin
 * admin/js/core/app.js
 */

console.log('🔵 app.js chargé');

import * as UI from '../utils/ui.js';
import * as Modal from '../utils/modal.js';
import * as Notification from '../utils/notification.js';
import * as TabsPermissions from '../utils/tabsPermissions.js';

console.log('✅ Modules importés');

const AdminApp = {
    currentPage: null,
    isInitialized: false,
    user: null
};

function initAdminPanel() {
    console.log('🚀 initAdminPanel() - DÉBUT');
    
    if (AdminApp.isInitialized) {
        console.log('⚠️ Déjà initialisé, sortie');
        return;
    }
    
    UI.initTabs();
    Modal.initModals();
    checkAuthentication();
    setupEventListeners();
    detectCurrentPage();
    
    // ✅ INITIALISER LES PERMISSIONS DES ONGLETS
    console.log('🔐 Appel initTabsPermissions()');
    TabsPermissions.initTabsPermissions();
    
    AdminApp.isInitialized = true;
    console.log('✅ initAdminPanel() - FIN');
}

// Configure les écouteurs d'événements globaux
function setupEventListeners() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                window.location.href = '/logout';
            }
        });
    }
    
    window.addEventListener('error', function(e) {
        Notification.showNotification(
            'Une erreur est survenue: ' + e.message,
            'error'
        );
    });
    
    window.addEventListener('beforeunload', function(e) {
        const modalOpen = document.querySelector('.modal[style*="display: block"]');
        if (modalOpen) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });
}

// Vérifie l'authentification de l'utilisateur
function checkAuthentication() {
    console.log('🔐 checkAuthentication()');
    
    fetch('/api/check-auth')
        .then(response => {
            if (!response.ok) {
                console.error('❌ Auth failed');
                window.location.href = '/';
                throw new Error('Session expirée');
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ User authentifié:', data);
            AdminApp.user = data;
            const userSpan = document.querySelector('.admin-user span');
            if (userSpan) {
                userSpan.textContent = data.username || 'Admin';
            }
        })
        .catch((err) => {
            console.error('❌ Erreur auth:', err);
        });
}

// Détecte la page courante et charge le module correspondant
function detectCurrentPage() {
    console.log('🔍 detectCurrentPage()');
    const path = window.location.pathname;
    console.log('📍 Path:', path);
    
    if (path.includes('order-history')) {
        AdminApp.currentPage = 'history';
        const tab = document.querySelector('a[href="/admin/order-history"]');
        if (tab) tab.classList.add('active');
        import('../modules/history/historyList.js').then(module => {
            module.loadTreatedOrders();
        });
    }
    else if (path.includes('clients')) {
        AdminApp.currentPage = 'clients';
        const tab = document.querySelector('a[href="/admin/clients"]');
        if (tab) tab.classList.add('active');
        import('../modules/clients/clientList.js').then(module => {
            module.loadClients();
        });
    }
    else if (path.includes('compta')) {
        AdminApp.currentPage = 'compta';
        const tab = document.querySelector('a[href="/admin/compta"]');
        if (tab) tab.classList.add('active');
    }
    else if (path.includes('stock')) {
        AdminApp.currentPage = 'stock';
        const tab = document.querySelector('a[href="/admin/stock"]');
        if (tab) tab.classList.add('active');
    }
    else {
        AdminApp.currentPage = 'orders';
        const tab = document.querySelector('a[href="/admin/orders"]');
        if (tab) tab.classList.add('active');
        import('../modules/orders/orderList.js').then(module => {
            module.loadPendingOrders();
        });
    }
}

export {
    initAdminPanel,
    checkAuthentication,
    AdminApp
};

// Initialiser l'application au chargement du document
console.log('📄 Ajout event listener DOMContentLoaded');
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOMContentLoaded déclenché');
    initAdminPanel();
});

console.log('✅ app.js - Fin du chargement');