/**
 * Initialisation principale de l'application admin
 * Points d'entrée et configuration générale
 */

// Import des dépendances
import * as UI from '../utils/ui.js';
import * as Modal from '../utils/modal.js';
import * as Notification from '../utils/notification.js';

// Variable globale pour stocker l'état de l'application
const AdminApp = {
  currentPage: null,
  isInitialized: false,
  user: null
};

/**
 * Initialise le panel administrateur
 * Cette fonction est appelée au chargement de chaque page
 */
function initAdminPanel() {
  if (AdminApp.isInitialized) return;
  
  console.log('Admin panel initialized');
  
  // Initialiser les composants UI
  UI.initTabs();
  
  // Initialiser les modales
  Modal.initModals();
  
  // Vérifier l'authentification
  checkAuthentication();
  
  // Configurer les écouteurs d'événements
  setupEventListeners();
  
  // Détecter la page actuelle
  detectCurrentPage();
  
  // Marquer l'app comme initialisée
  AdminApp.isInitialized = true;
}

/**
 * Configure les écouteurs d'événements globaux
 */
function setupEventListeners() {
  // Gestionnaire de déconnexion
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // Confirmer la déconnexion
      if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        window.location.href = '/logout';
      }
    });
  }
  
  // Gestionnaire pour les notifications système
  window.addEventListener('error', function(e) {
    Notification.showNotification(
      'Une erreur est survenue: ' + e.message,
      'error'
    );
  });
  
  // Gestionnaire pour empêcher la fermeture accidentelle
  window.addEventListener('beforeunload', function(e) {
    const modalOpen = document.querySelector('.modal[style*="display: block"]');
    if (modalOpen) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}

/**
 * Vérifie l'authentification admin
 * Redirige vers la page de connexion si non authentifié
 */
function checkAuthentication() {
  // Cette fonction pourrait faire un appel API pour vérifier
  // que l'utilisateur est toujours authentifié et a les droits admin
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
      // Gestion silencieuse, la redirection est déjà traitée
    });
}

/**
 * Détecte la page actuelle et charge les modules correspondants
 */
function detectCurrentPage() {
  const path = window.location.pathname;
  
  if (path.includes('order-history')) {
    AdminApp.currentPage = 'history';
    document.querySelector('a[href="/admin/order-history"]').classList.add('active');
    // Charger le module d'historique dynamiquement
    import('../modules/history/historyList.js').then(module => {
      module.loadTreatedOrders();
    });
  } 
  else if (path.includes('clients')) {
    AdminApp.currentPage = 'clients';
    document.querySelector('a[href="/admin/clients"]').classList.add('active');
    // Charger le module clients dynamiquement
    import('../modules/clients/clientList.js').then(module => {
      module.loadClients();
    });
  }
  else {
    // Page par défaut: commandes en attente
    AdminApp.currentPage = 'orders';
    document.querySelector('a[href="/admin"]').classList.add('active');
    // Charger le module commandes dynamiquement
    import('../modules/orders/orderList.js').then(module => {
      module.loadPendingOrders();
    });
  }
}

// Exposer les fonctions publiques
export {
  initAdminPanel,
  checkAuthentication,
  AdminApp
};

// Initialiser l'application au chargement du document
document.addEventListener('DOMContentLoaded', initAdminPanel);