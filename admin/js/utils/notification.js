/**
 * Système de notifications
 * admin/js/utils/notification.js
 */

const DEFAULT_DURATION = 3000;

const notificationTimeouts = new Map();
const DEDUP_WINDOW_MS = 1500; // Ignore duplicate message+type within this window
const recentNotifications = new Map();

// Affiche une notification
function showNotification(message, type = 'success', options = {}) {
    // Deduplication: skip if same message+type was shown recently
    const dedupeKey = `${type}::${message}`;
    const now = Date.now();
    if (recentNotifications.has(dedupeKey)) {
        const lastShown = recentNotifications.get(dedupeKey);
        if (now - lastShown < DEDUP_WINDOW_MS) {
            return null; // Skip duplicate
        }
    }
    recentNotifications.set(dedupeKey, now);
    // Clean old entries periodically
    if (recentNotifications.size > 50) {
        for (const [key, time] of recentNotifications) {
            if (now - time > DEDUP_WINDOW_MS) recentNotifications.delete(key);
        }
    }

    const container = getNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    
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
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">${icon}</div>
            <div class="notification-message">${message}</div>
            ${options.dismissible !== false ? '<button class="notification-close">&times;</button>' : ''}
        </div>
    `;
    
    container.appendChild(notification);
    
    if (options.dismissible !== false) {
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            removeNotification(notification, options.onClose);
        });
    }
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    const duration = options.duration || DEFAULT_DURATION;
    const timeout = setTimeout(() => {
        removeNotification(notification, options.onClose);
        notificationTimeouts.delete(notification);
    }, duration);
    
    notificationTimeouts.set(notification, timeout);
    
    notification.addEventListener('mouseenter', () => {
        if (notificationTimeouts.has(notification)) {
            clearTimeout(notificationTimeouts.get(notification));
        }
    });
    
    notification.addEventListener('mouseleave', () => {
        const timeout = setTimeout(() => {
            removeNotification(notification, options.onClose);
            notificationTimeouts.delete(notification);
        }, duration / 2);
        
        notificationTimeouts.set(notification, timeout);
    });
    
    return notification;
}

// Crée et retourne le conteneur de notifications
function getNotificationContainer() {
    let container = document.getElementById('notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    return container;
}

// Supprime une notification
function removeNotification(notification, onClose) {
    if (notificationTimeouts.has(notification)) {
        clearTimeout(notificationTimeouts.get(notification));
        notificationTimeouts.delete(notification);
    }
    
    notification.classList.remove('show');
    notification.classList.add('hiding');
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
        
        if (typeof onClose === 'function') {
            onClose();
        }
    }, 300);
}

// Supprime toutes les notifications
function clearAllNotifications() {
    const container = document.getElementById('notification-container');
    
    if (container) {
        container.querySelectorAll('.notification').forEach(notification => {
            if (notificationTimeouts.has(notification)) {
                clearTimeout(notificationTimeouts.get(notification));
                notificationTimeouts.delete(notification);
            }
            
            notification.classList.remove('show');
            notification.classList.add('hiding');
        });
        
        setTimeout(() => {
            container.innerHTML = '';
        }, 300);
    }
}

// Fonction de raccourci pour les types courants de notifications
const notifySuccess = (message, options) => showNotification(message, 'success', options);
const notifyError = (message, options) => showNotification(message, 'error', options);
const notifyInfo = (message, options) => showNotification(message, 'info', options);
const notifyWarning = (message, options) => showNotification(message, 'warning', options);

export {
    showNotification,
    removeNotification,
    clearAllNotifications,
    notifySuccess,
    notifyError,
    notifyInfo,
    notifyWarning
};