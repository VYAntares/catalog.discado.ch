/**
 * Système de notifications
 * Gère l'affichage de messages de notification temporaires
 */

import { AppConfig } from '../core/config.js';

// Durée d'affichage par défaut des notifications (ms)
const DEFAULT_DURATION = AppConfig.NOTIFICATION_DURATION || 4000;

// Stockage des timeouts de notifications pour pouvoir les annuler
const notificationTimeouts = new Map();

/**
 * Affiche une notification
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification ('success', 'error', 'info', 'warning')
 * @param {Object} options - Options pour la notification
 * @param {number} options.duration - Durée d'affichage en ms
 * @param {boolean} options.dismissible - Si la notification peut être fermée manuellement
 * @param {Function} options.onClose - Callback appelé à la fermeture
 * @returns {HTMLElement} Élément de notification créé
 */
export function showNotification(message, type = 'success', options = {}) {
    // Récupérer le conteneur ou le créer s'il n'existe pas
    const container = getNotificationContainer();
    
    // Créer la notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    
    // Icône selon le type
    let icon = '✓';
    switch (type) {
        case 'error':
            icon = '✕';
            break;
        case 'info':
            icon = 'ℹ';
            break;
        case 'warning':
            icon = '⚠';
            break;
    }
    
    // Structure de la notification
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">${icon}</div>
            <div class="notification-message">${message}</div>
            ${options.dismissible !== false ? '<button class="notification-close">&times;</button>' : ''}
        </div>
        <div class="notification-progress">
            <div class="notification-progress-bar"></div>
        </div>
    `;
    
    // Ajouter au conteneur
    container.appendChild(notification);
    
    // Configurer le bouton de fermeture
    if (options.dismissible !== false) {
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                removeNotification(notification, options.onClose);
            });
        }
    }
    
    // Supprimer après un délai
    const duration = options.duration || DEFAULT_DURATION;
    const timeout = setTimeout(() => {
        removeNotification(notification, options.onClose);
        notificationTimeouts.delete(notification);
    }, duration);
    
    // Stocker le timeout pour pouvoir l'annuler
    notificationTimeouts.set(notification, timeout);
    
    // Mettre en pause le timer quand la souris est sur la notification
    notification.addEventListener('mouseenter', () => {
        if (notificationTimeouts.has(notification)) {
            clearTimeout(notificationTimeouts.get(notification));
        }
    });
    
    // Reprendre le timer quand la souris quitte la notification
    notification.addEventListener('mouseleave', () => {
        const timeout = setTimeout(() => {
            removeNotification(notification, options.onClose);
            notificationTimeouts.delete(notification);
        }, duration / 2); // Délai réduit après hover
        
        notificationTimeouts.set(notification, timeout);
    });
    
    return notification;
}

/**
 * Crée et retourne le conteneur de notifications
 * @returns {HTMLElement} Conteneur de notifications
 */
function getNotificationContainer() {
    let container = document.getElementById('notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
    
    return container;
}

/**
 * Supprime une notification
 * @param {HTMLElement} notification - Élément de notification à supprimer
 * @param {Function} onClose - Callback à appeler après suppression
 */
function removeNotification(notification, onClose) {
    // Annuler le timeout si présent
    if (notificationTimeouts.has(notification)) {
        clearTimeout(notificationTimeouts.get(notification));
        notificationTimeouts.delete(notification);
    }
    
    // Animation de sortie
    notification.classList.add('hiding');
    
    // Supprimer après l'animation
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
        
        // Exécuter le callback si présent
        if (typeof onClose === 'function') {
            onClose();
        }
    }, 300);
}

/**
 * Supprime toutes les notifications
 */
export function clearAllNotifications() {
    const container = document.getElementById('notification-container');
    
    if (container) {
        // Annuler tous les timeouts
        container.querySelectorAll('.notification').forEach(notification => {
            if (notificationTimeouts.has(notification)) {
                clearTimeout(notificationTimeouts.get(notification));
                notificationTimeouts.delete(notification);
            }
            
            // Supprimer la notification
            notification.classList.add('hiding');
        });
        
        // Vider le conteneur après les animations
        setTimeout(() => {
            container.innerHTML = '';
        }, 300);
    }
}

// Fonctions de raccourci pour les types courants de notifications
export const notifySuccess = (message, options) => showNotification(message, 'success', options);
export const notifyError = (message, options) => showNotification(message, 'error', options);
export const notifyInfo = (message, options) => showNotification(message, 'info', options);
export const notifyWarning = (message, options) => showNotification(message, 'warning', options);