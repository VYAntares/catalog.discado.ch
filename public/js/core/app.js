/**
 * Application Core
 * Point d'entrée central et initialisation globale de l'application
 */

import { checkAuthentication } from './api.js';
import { showNotification } from '../utils/notification.js';

// Variable globale pour stocker l'état de l'application
const App = {
  currentPage: null,
  isInitialized: false,
  user: null,
  isAuthenticated: false,
  theme: 'light'
};

/**
 * Initialise l'application
 * Cette fonction est appelée au chargement de chaque page
 */
export function initApp() {
  if (App.isInitialized) return;
  
  console.log('Application initialized');
  
  // Détecter la page actuelle
  detectCurrentPage();
  
  // Vérifier l'authentification
  checkUserAuthentication();
  
  // Configurer les écouteurs d'événements globaux
  setupGlobalEventListeners();
  
  // Charger les paramètres utilisateur (thème, etc.)
  loadUserSettings();
  
  // Marquer l'app comme initialisée
  App.isInitialized = true;
}

/**
 * Détecte la page actuelle en fonction de l'URL
 */
function detectCurrentPage() {
  const path = window.location.pathname;
  
  if (path.includes('/pages/catalog.html')) {
    App.currentPage = 'catalog';
  } 
  else if (path.includes('/pages/orders.html')) {
    App.currentPage = 'orders';
  }
  else if (path.includes('/pages/profile.html')) {
    App.currentPage = 'profile';
  }
  else if (path.includes('/pages/login.html')) {
    App.currentPage = 'login';
  }
  else {
    // Page par défaut: index
    App.currentPage = 'index';
  }
  
  console.log(`Current page: ${App.currentPage}`);
}

/**
 * Vérifie l'état de l'authentification utilisateur
 */
function checkUserAuthentication() {
  checkAuthentication()
    .then(data => {
      App.user = data;
      App.isAuthenticated = true;
      
      // Déclencher un événement indiquant que l'utilisateur est authentifié
      document.dispatchEvent(new CustomEvent('userAuthenticated', { 
        detail: { user: data }
      }));
      
      console.log('User authenticated:', data.username);
    })
    .catch(error => {
      App.user = null;
      App.isAuthenticated = false;
      
      // Rediriger vers la page de connexion si on est sur une page protégée
      if (['profile', 'orders'].includes(App.currentPage)) {
        showNotification('Please log in to access this page', 'info');
        setTimeout(() => {
          window.location.href = '/pages/login.html';
        }, 1500);
      }
    });
}

/**
 * Configure les écouteurs d'événements globaux
 */
function setupGlobalEventListeners() {
  // Gestionnaire d'erreurs globales
  window.addEventListener('error', function(e) {
    showNotification('An error occurred: ' + e.message, 'error');
  });
  
  // Intercepter les clics sur les liens pour la navigation fluide
  document.addEventListener('click', function(e) {
    // Trouver le lien le plus proche si l'événement n'est pas directement sur un lien
    const link = e.target.closest('a');
    
    if (link && link.href && link.href.startsWith(window.location.origin)) {
      // Liens internes uniquement, pas les liens externes
      const targetUrl = new URL(link.href);
      
      // Ignorer si la touche Ctrl ou Cmd est enfoncée (ouverture dans un nouvel onglet)
      if (e.ctrlKey || e.metaKey) return;
      
      // Ignorer les liens de téléchargement ou ceux avec attribut target
      if (link.hasAttribute('download') || link.hasAttribute('target')) return;
      
      // Navigation fluide (à implémenter si besoin)
      // e.preventDefault();
      // navigateTo(targetUrl.pathname);
    }
  });
  
  // Écouter les événements de visibilité de la page pour gérer les sessions
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      // L'utilisateur est revenu sur l'onglet, vérifier la session
      checkUserAuthentication();
    }
  });
}

/**
 * Charge les paramètres utilisateur depuis localStorage
 */
function loadUserSettings() {
  // Charger le thème
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    App.theme = savedTheme;
    applyTheme(savedTheme);
  }
  
  // D'autres paramètres utilisateur peuvent être chargés ici
}

/**
 * Applique le thème à l'application
 * @param {string} theme - Nom du thème (light/dark)
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  App.theme = theme;
}

/**
 * Change le thème de l'application
 * @param {string} theme - Nom du thème (light/dark)
 */
export function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem('theme', theme);
}

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns {boolean} État de l'authentification
 */
export function isAuthenticated() {
  return App.isAuthenticated;
}

/**
 * Obtenir la page actuelle
 * @returns {string} Nom de la page actuelle
 */
export function getCurrentPage() {
  return App.currentPage;
}

/**
 * Obtenir l'utilisateur connecté
 * @returns {Object|null} Informations sur l'utilisateur ou null
 */
export function getUser() {
  return App.user;
}

// Initialiser l'application au chargement du document
document.addEventListener('DOMContentLoaded', initApp);