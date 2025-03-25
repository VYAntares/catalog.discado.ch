//public/js/core/app.js
import { checkAuthentication } from './api.js';
import { showNotification } from '../utils/notification.js';

const App = {
  currentPage: null,
  isInitialized: false,
  user: null,
  isAuthenticated: false,
  theme: 'light'
};

export function initApp() {
  if (App.isInitialized) return;
  
  detectCurrentPage();
  checkUserAuthentication();
  setupGlobalEventListeners();
  loadUserSettings();
  
  App.isInitialized = true;
}

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
    App.currentPage = 'index';
  }
}

function checkUserAuthentication() {
  checkAuthentication()
    .then(data => {
      App.user = data;
      App.isAuthenticated = true;
      
      document.dispatchEvent(new CustomEvent('userAuthenticated', { 
        detail: { user: data }
      }));
    })
    .catch(error => {
      App.user = null;
      App.isAuthenticated = false;
      
      if (['profile', 'orders'].includes(App.currentPage)) {
        showNotification('Please log in to access this page', 'info');
        setTimeout(() => {
          window.location.href = '/pages/login.html';
        }, 1500);
      }
    });
}

function setupGlobalEventListeners() {
  window.addEventListener('error', function(e) {
    showNotification('An error occurred: ' + e.message, 'error');
  });
  
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    
    if (link && link.href && link.href.startsWith(window.location.origin)) {
      if (e.ctrlKey || e.metaKey) return;
      
      if (link.hasAttribute('download') || link.hasAttribute('target')) return;
    }
  });
  
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      checkUserAuthentication();
    }
  });
}

function loadUserSettings() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    App.theme = savedTheme;
    applyTheme(savedTheme);
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  App.theme = theme;
}

export function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem('theme', theme);
}

export function isAuthenticated() {
  return App.isAuthenticated;
}

export function getCurrentPage() {
  return App.currentPage;
}

export function getUser() {
  return App.user;
}

document.addEventListener('DOMContentLoaded', initApp);

export {
  App,
  detectCurrentPage,
  checkUserAuthentication,
  setupGlobalEventListeners,
  loadUserSettings,
  applyTheme
};