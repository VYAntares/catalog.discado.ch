/**
 * Vue Calendrier pour l'Historique des Commandes
 * admin/js/modules/history/historyList.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as HistoryView from './historyView.js';

let historyOrderList;
let searchInput;
let searchBtn;
let monthSelector;
let yearSelector;

let allTreatedOrders = [];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let calendarData = {};


//Charge les commandes traitées depuis l'API
async function loadTreatedOrders() {
    historyOrderList = document.getElementById('historyOrderList');
    searchInput = document.getElementById('searchOrderInput');
    searchBtn = document.getElementById('searchOrderBtn');
    
    if (!historyOrderList) return;
    
    historyOrderList.innerHTML = `
        <div class="loading">Chargement de l'historique des commandes...</div>
    `;
    
    try {
        const orders = await API.fetchTreatedOrders();
        allTreatedOrders = orders;
        organizeOrdersByDate(orders);
        createDateSelectors();
        displayCalendar(currentYear, currentMonth);
        initSearchEvents();
    } catch (error) {
        historyOrderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement de l'historique des commandes. Veuillez réessayer.</p>
                <button class="action-btn" id="retryLoadHistory">Réessayer</button>
            </div>
        `;
        
        const retryButton = document.getElementById('retryLoadHistory');
        if (retryButton) {
            retryButton.addEventListener('click', loadTreatedOrders);
        }
    }
}

//Organise les commandes par année, mois et jour pour le calendrier
function organizeOrdersByDate(orders) {
    calendarData = {};
    
    orders.forEach(order => {
        const orderDate = new Date(order.lastProcessed || order.date);
        const year = orderDate.getFullYear();
        const month = orderDate.getMonth();
        const day = orderDate.getDate();
        
        if (!calendarData[year]) {
            calendarData[year] = {};
        }
        if (!calendarData[year][month]) {
            calendarData[year][month] = {};
        }
        if (!calendarData[year][month][day]) {
            calendarData[year][month][day] = [];
        }
        
        calendarData[year][month][day].push(order);
    });
}

//Crée les sélecteurs de date (mois et année)
function createDateSelectors() {
    const selectors = document.createElement('div');
    selectors.className = 'calendar-selectors';
    
    const currentDate = new Date();
    const realCurrentYear = currentDate.getFullYear();
    const years = [];
    
    for (let year = 2020; year <= 2030; year++) {
        years.push(year);
    }
    
    years.sort((a, b) => b - a);
    
    const yearSelectorHtml = `
        <div class="year-selector">
            <label for="year-select">Année:</label>
            <select id="year-select" class="calendar-select">
                ${years.map(year => `<option value="${year}" ${year == currentYear ? 'selected' : ''}>${year}</option>`).join('')}
            </select>
        </div>
    `;
    
    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    
    const monthSelectorHtml = `
        <div class="month-selector">
            <label for="month-select">Mois:</label>
            <select id="month-select" class="calendar-select">
                ${monthNames.map((name, idx) => `<option value="${idx}" ${idx === currentMonth ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
        </div>
    `;
    
    selectors.innerHTML = yearSelectorHtml + monthSelectorHtml;
    
    historyOrderList.innerHTML = '';
    historyOrderList.appendChild(selectors);
    
    const calendarContainer = document.createElement('div');
    calendarContainer.id = 'calendar-container';
    calendarContainer.className = 'calendar-container';
    historyOrderList.appendChild(calendarContainer);
    
    yearSelector = document.getElementById('year-select');
    monthSelector = document.getElementById('month-select');
    
    yearSelector.addEventListener('change', function() {
        currentYear = parseInt(this.value);
        displayCalendar(currentYear, currentMonth);
    });
    
    monthSelector.addEventListener('change', function() {
        currentMonth = parseInt(this.value);
        displayCalendar(currentYear, currentMonth);
    });
}

//Affiche le calendrier pour le mois et l'année sélectionnés
function displayCalendar(year, month) {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const adjustedStartDay = (startDayOfWeek === 0) ? 6 : startDayOfWeek - 1;
    
    const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    
    let calendarHtml = `
        <div class="calendar">
            <div class="calendar-header">
                ${dayNames.map(day => `<div class="calendar-header-day">${day}</div>`).join('')}
            </div>
            <div class="calendar-body">
    `;
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    for (let i = adjustedStartDay - 1; i >= 0; i--) {
        const prevMonthDay = prevMonthLastDay - i;
        calendarHtml += `<div class="calendar-day empty other-month">${prevMonthDay}</div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const hasOrders = calendarData[year]?.[month]?.[day]?.length > 0;
        const orderCount = hasOrders ? calendarData[year][month][day].length : 0;
        const isToday = (new Date().getDate() === day &&
                        new Date().getMonth() === month &&
                        new Date().getFullYear() === year);
        
        calendarHtml += `
            <div class="calendar-day ${hasOrders ? 'has-orders' : ''} ${isToday ? 'selected' : ''}"
                data-day="${day}" data-month="${month}" data-year="${year}">
                ${day}
                ${hasOrders ? `<div class="order-count">${orderCount}</div>` : ''}
            </div>
        `;
    }
    
    const totalDaysDisplayed = adjustedStartDay + daysInMonth;
    const remainingCells = 42 - totalDaysDisplayed;
    
    for (let day = 1; day <= remainingCells; day++) {
        calendarHtml += `<div class="calendar-day empty other-month">${day}</div>`;
    }
    
    calendarHtml += `
            </div>
        </div>
    `;
    
    calendarHtml += `
        <div id="day-orders-container" class="day-orders-container">
            <h3 id="selected-date" class="selected-date">Sélectionnez un jour pour voir les commandes</h3>
            <div id="day-orders-list" class="day-orders-list"></div>
        </div>
    `;
    
    calendarContainer.innerHTML = calendarHtml;
    
    setupDayClickHandlers();
}

//Configure les écouteurs pour les clics sur les jours du calendrier
function setupDayClickHandlers() {
    const calendarDays = document.querySelectorAll('.calendar-day:not(.empty)');
    
    calendarDays.forEach(dayElement => {
        dayElement.addEventListener('click', function() {
            document.querySelectorAll('.calendar-day.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            this.classList.add('selected');
            
            const day = parseInt(this.getAttribute('data-day'));
            const month = parseInt(this.getAttribute('data-month'));
            const year = parseInt(this.getAttribute('data-year'));
            
            displayDayOrders(year, month, day);
        });
    });
}

//Affiche les commandes d'un jour spécifique
function displayDayOrders(year, month, day) {
    const dayOrdersList = document.getElementById('day-orders-list');
    const selectedDateElement = document.getElementById('selected-date');
    
    if (!dayOrdersList || !selectedDateElement) return;
    
    const dateStr = new Date(year, month, day).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    selectedDateElement.textContent = dateStr;
    
    const dayOrders = calendarData[year]?.[month]?.[day] || [];
    
    if (dayOrders.length === 0) {
        dayOrdersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-day"></i>
                <p>Aucune commande pour ce jour</p>
            </div>
        `;
        return;
    }
    
    dayOrdersList.innerHTML = '';
    
    dayOrders.forEach(order => {
        const orderElement = createOrderElement(order);
        dayOrdersList.appendChild(orderElement);
    });

    // Ajouter des gestionnaires d'événements pour les boutons de détails
    setupOrderDetailsButtons();
}

//Crée un élément HTML pour une commande
function createOrderElement(order) {
    const orderDate = Formatter.formatDate(order.date);
    const processDate = Formatter.formatDate(order.lastProcessed);
    
    const totalDeliveredItems = order.deliveredItems
        ? order.deliveredItems.reduce((sum, item) => sum + item.quantity, 0)
        : 0;
    
    const itemsPreview = (order.deliveredItems || []).slice(0, 3).map(item => {
        const shortName = item.Nom.split(' - ')[0];
        return shortName;
    }).join(', ');
    
    const userProfile = order.userProfile || {};
    const customerName = userProfile.fullName || order.userId;
    const shopName = userProfile.shopName || 'Non spécifié';
    const email = userProfile.email || 'Non spécifié';
    const phone = userProfile.phone || 'Non spécifié';
    
    const orderItem = document.createElement('div');
    orderItem.className = 'order-item';
    orderItem.innerHTML = `
        <h3 class="order-date-header">
            <span class="order-icon"><i class="fas fa-clipboard-check"></i></span>
            Commande #${order.orderId}
        </h3>
        <div class="order-date-info">
            <div>Commandée le: ${orderDate}, ${new Date(order.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</div>
            <div>Traitée le: ${processDate}, ${new Date(order.lastProcessed).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</div>
            ${order.reference ? `<div>Référence client: ${order.reference}</div>` : ''}
        </div>
        <div class="order-client-info">
            <div class="client-name-section">
                <div class="client-name">${customerName}</div>
                <div class="client-shop">Boutique: ${shopName}</div>
                <div class="client-contact">Email: ${email} | Tél: ${phone}</div>
            </div>
        </div>
        <div class="order-items-summary">
            <div class="item-count">${totalDeliveredItems} article${totalDeliveredItems > 1 ? 's' : ''} livré${totalDeliveredItems > 1 ? 's' : ''}</div>
            <div class="items-preview">${itemsPreview}${(order.deliveredItems || []).length > 3 ? '...' : ''}</div>
        </div>
        <div class="order-actions">
            <button class="action-btn view-btn view-order-details-btn" data-order-id="${order.orderId}" data-user-id="${order.userId}">
                <i class="fas fa-eye"></i> Voir détails
            </button>
            <a href="${API.getInvoiceDownloadLink(order.orderId, order.userId)}" class="action-btn download-btn" target="_blank">
                <i class="fas fa-file-pdf"></i> Facture
            </a>
        </div>
    `;
    
    return orderItem;
}

// Configurer les gestionnaires d'événements pour les boutons de détails
function setupOrderDetailsButtons() {
    document.querySelectorAll('.view-order-details-btn').forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            HistoryView.viewOrderDetails(orderId, userId);
        });
    });
}

//Initialise les événements de recherche et s'assure que les modales sont correctement configurées
function initSearchEvents() {
    if (searchBtn) {
        searchBtn.addEventListener('click', searchOrders);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                searchOrders();
            }
        });
    }
    
    const orderModal = document.getElementById('orderModal');
    if (orderModal) {
        const closeModal = orderModal.querySelector('.close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', function() {
                orderModal.style.display = 'none';
            });
        }
        
        window.addEventListener('click', function(event) {
            if (event.target === orderModal) {
                orderModal.style.display = 'none';
            }
        });
    }
}

//Effectue une recherche dans les commandes
function searchOrders() {
    const searchValue = searchInput.value.toLowerCase().trim();
    
    if (!searchValue) {
        organizeOrdersByDate(allTreatedOrders);
        displayCalendar(currentYear, currentMonth);
        return;
    }
    
    const filteredOrders = allTreatedOrders.filter(order => {
        if (order.orderId.toLowerCase().includes(searchValue)) return true;
        if (order.userId.toLowerCase().includes(searchValue)) return true;
        
        const userProfile = order.userProfile || {};
        const fullName = (userProfile.fullName || '').toLowerCase();
        const shopName = (userProfile.shopName || '').toLowerCase();
        const email = (userProfile.email || '').toLowerCase();
        const phone = (userProfile.phone || '').toLowerCase();
        
        const hasMatchingItem = (order.deliveredItems || []).some(item =>
            (item.Nom || '').toLowerCase().includes(searchValue)
        );
        
        return fullName.includes(searchValue) ||
               shopName.includes(searchValue) ||
               email.includes(searchValue) ||
               phone.includes(searchValue) ||
               hasMatchingItem;
    });
    
    if (filteredOrders.length > 0) {
        organizeOrdersByDate(filteredOrders);
        displayCalendar(currentYear, currentMonth);
        Notification.showNotification(`${filteredOrders.length} commande(s) trouvée(s) pour "${searchValue}"`, 'info');
    } else {
        const calendarContainer = document.getElementById('calendar-container');
        if (calendarContainer) {
            calendarContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Aucune commande trouvée pour "${searchValue}"</p>
                    <button class="action-btn" id="resetSearch">Réinitialiser la recherche</button>
                </div>
            `;
            
            const resetButton = document.getElementById('resetSearch');
            if (resetButton) {
                resetButton.addEventListener('click', function() {
                    searchInput.value = '';
                    organizeOrdersByDate(allTreatedOrders);
                    displayCalendar(currentYear, currentMonth);
                });
            }
        }
        
        Notification.showNotification(`Aucune commande trouvée pour "${searchValue}"`, 'info');
    }
}

export {
    loadTreatedOrders,
    displayCalendar,
    displayDayOrders,
    searchOrders
};