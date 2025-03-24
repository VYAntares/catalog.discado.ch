import { AppConfig } from '../core/config.js';

const DEFAULT_DURATION = AppConfig.NOTIFICATION_DURATION || 4000;
const notificationTimeouts = new Map();

export function showNotification(message, type = 'success', options = {}) {
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
        <div class="notification-progress">
            <div class="notification-progress-bar"></div>
        </div>
    `;
    
    container.appendChild(notification);
    
    if (options.dismissible !== false) {
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                removeNotification(notification, options.onClose);
            });
        }
    }
    
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

function getNotificationContainer() {
    let container = document.getElementById('notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
    
    return container;
}

function removeNotification(notification, onClose) {
    if (notificationTimeouts.has(notification)) {
        clearTimeout(notificationTimeouts.get(notification));
        notificationTimeouts.delete(notification);
    }
    
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

export function clearAllNotifications() {
    const container = document.getElementById('notification-container');
    
    if (container) {
        container.querySelectorAll('.notification').forEach(notification => {
            if (notificationTimeouts.has(notification)) {
                clearTimeout(notificationTimeouts.get(notification));
                notificationTimeouts.delete(notification);
            }
            
            notification.classList.add('hiding');
        });
        
        setTimeout(() => {
            container.innerHTML = '';
        }, 300);
    }
}

export const notifySuccess = (message, options) => showNotification(message, 'success', options);
export const notifyError = (message, options) => showNotification(message, 'error', options);
export const notifyInfo = (message, options) => showNotification(message, 'info', options);
export const notifyWarning = (message, options) => showNotification(message, 'warning', options);