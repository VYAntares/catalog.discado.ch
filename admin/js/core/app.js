/**
 * Initialisation principale de l'application admin
 * admin/js/core/app.js
 */

import * as UI from '../utils/ui.js';
import * as Modal from '../utils/modal.js';
import * as Notification from '../utils/notification.js';

const AdminApp = {
    currentPage: null,
    isInitialized: false,
    user: null
};

// Initialise le panneau d'administration
function initAdminPanel() {
    if (AdminApp.isInitialized) return;
    
    UI.initTabs();
    Modal.initModals();
    checkAuthentication();
    setupEventListeners();
    detectCurrentPage();
    
    AdminApp.isInitialized = true;
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
    fetch('/api/check-auth')
        .then(response => {
            if (!response.ok) {
                window.location.href = '/';
                throw new Error('Session expirée');
            }
            return response.json();
        })
        .then(data => {
            AdminApp.user = data;
            document.querySelector('.admin-user span').textContent = data.username || 'Admin';
        })
        .catch(() => {
        });
}

// Détecte la page courante et charge le module correspondant
function detectCurrentPage() {
    const path = window.location.pathname;
    
    if (path.includes('order-history')) {
        AdminApp.currentPage = 'history';
        document.querySelector('a[href="/admin/order-history"]').classList.add('active');
        import('../modules/history/historyList.js').then(module => {
            module.loadTreatedOrders();
        });
    }
    else if (path.includes('clients')) {
        AdminApp.currentPage = 'clients';
        document.querySelector('a[href="/admin/clients"]').classList.add('active');
        import('../modules/clients/clientList.js').then(module => {
            module.loadClients();
        });
    }
    else if (path.includes('compta')) {
        AdminApp.currentPage = 'compta';
        document.querySelector('a[href="/admin/compta"]').classList.add('active');
        // Pour l'instant, pas de module JS spécifique
        // Vous pourrez ajouter plus tard :
    }
    else {
        AdminApp.currentPage = 'orders';
        document.querySelector('a[href="/admin"]').classList.add('active');
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
document.addEventListener('DOMContentLoaded', initAdminPanel);