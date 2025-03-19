/**
 * Vue Calendrier pour l'Historique des Commandes
 * Ce module remplace la vue hiérarchique existante par un calendrier mensuel
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as HistoryView from './historyView.js';

// Référence DOM
let historyOrderList;
let searchInput;
let searchBtn;
let monthSelector;
let yearSelector;

// Variables de stockage pour filtrage
let allTreatedOrders = [];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let calendarData = {};

/**
 * Charge les commandes traitées depuis l'API
 */
async function loadTreatedOrders() {
    // Obtenir les références DOM
    historyOrderList = document.getElementById('historyOrderList');
    searchInput = document.getElementById('searchOrderInput');
    searchBtn = document.getElementById('searchOrderBtn');
    
    if (!historyOrderList) {
        console.error("Conteneur d'historique non trouvé");
        return;
    }
    
    // Afficher l'indicateur de chargement
    historyOrderList.innerHTML = `
        <div class="loading">Chargement de l'historique des commandes...</div>
    `;
    
    try {
        // Appel API pour récupérer les commandes traitées
        const orders = await API.fetchTreatedOrders();
        
        // Stocker toutes les commandes pour la recherche
        allTreatedOrders = orders;
        
        // Structurer les données pour le calendrier
        organizeOrdersByDate(orders);
        
        // Créer les sélecteurs de mois et d'année
        createDateSelectors();
        
        // Afficher le calendrier
        displayCalendar(currentYear, currentMonth);
        
        // Initialiser les événements de recherche
        initSearchEvents();
    } catch (error) {
        console.error('Erreur lors du chargement de l\'historique des commandes:', error);
        
        // Afficher un message d'erreur avec bouton de réessai
        historyOrderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement de l'historique des commandes. Veuillez réessayer.</p>
                <button class="action-btn" id="retryLoadHistory">Réessayer</button>
            </div>
        `;
        
        // Ajouter l'écouteur pour le bouton de réessai
        const retryButton = document.getElementById('retryLoadHistory');
        if (retryButton) {
            retryButton.addEventListener('click', loadTreatedOrders);
        }
    }
}

/**
 * Organise les commandes par année, mois et jour pour le calendrier
 * @param {Array} orders - Liste des commandes
 */
function organizeOrdersByDate(orders) {
    calendarData = {};
    
    orders.forEach(order => {
        // Utiliser la date de traitement pour le classement
        const orderDate = new Date(order.lastProcessed || order.date);
        const year = orderDate.getFullYear();
        const month = orderDate.getMonth();
        const day = orderDate.getDate();
        
        // Créer les structures si elles n'existent pas
        if (!calendarData[year]) {
            calendarData[year] = {};
        }
        
        if (!calendarData[year][month]) {
            calendarData[year][month] = {};
        }
        
        if (!calendarData[year][month][day]) {
            calendarData[year][month][day] = [];
        }
        
        // Ajouter la commande au jour correspondant
        calendarData[year][month][day].push(order);
    });
}

/**
 * Crée les sélecteurs de date (mois et année)
 */
function createDateSelectors() {
    // Créer le conteneur des sélecteurs
    const selectors = document.createElement('div');
    selectors.className = 'calendar-selectors';
    
    // Générer les années jusqu'à 2030
    const currentDate = new Date();
    const realCurrentYear = currentDate.getFullYear();
    const years = [];
    
    // Ajouter les années de 2020 à 2030
    for (let year = 2020; year <= 2030; year++) {
        years.push(year);
    }
    
    // Trier les années par ordre décroissant
    years.sort((a, b) => b - a);
    
    // Créer le sélecteur d'année
    const yearSelectorHtml = `
        <div class="year-selector">
            <label for="year-select">Année:</label>
            <select id="year-select" class="calendar-select">
                ${years.map(year => `<option value="${year}" ${year == currentYear ? 'selected' : ''}>${year}</option>`).join('')}
            </select>
        </div>
    `;
    
    // Créer le sélecteur de mois
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
    
    // Ajouter les sélecteurs au conteneur
    selectors.innerHTML = yearSelectorHtml + monthSelectorHtml;
    
    // Ajouter au conteneur principal
    historyOrderList.innerHTML = '';
    historyOrderList.appendChild(selectors);
    
    // Ajouter le conteneur pour le calendrier
    const calendarContainer = document.createElement('div');
    calendarContainer.id = 'calendar-container';
    calendarContainer.className = 'calendar-container';
    historyOrderList.appendChild(calendarContainer);
    
    // Stocker les références des sélecteurs
    yearSelector = document.getElementById('year-select');
    monthSelector = document.getElementById('month-select');
    
    // Ajouter les écouteurs d'événements pour les sélecteurs
    yearSelector.addEventListener('change', function() {
        currentYear = parseInt(this.value);
        displayCalendar(currentYear, currentMonth);
    });
    
    monthSelector.addEventListener('change', function() {
        currentMonth = parseInt(this.value);
        displayCalendar(currentYear, currentMonth);
    });
}

/**
 * Affiche le calendrier pour le mois et l'année sélectionnés
 * @param {number} year - Année à afficher
 * @param {number} month - Mois à afficher (0-11)
 */
function displayCalendar(year, month) {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;
    
    // Obtenir des informations sur le mois
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
    
    // Ajuster pour commencer la semaine le lundi (0 = Lundi, ..., 6 = Dimanche)
    const adjustedStartDay = (startDayOfWeek === 0) ? 6 : startDayOfWeek - 1;
    
    // Noms des jours de la semaine (format court)
    const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    
    // Construire le HTML du calendrier
    let calendarHtml = `
        <div class="calendar">
            <div class="calendar-header">
                ${dayNames.map(day => `<div class="calendar-header-day">${day}</div>`).join('')}
            </div>
            <div class="calendar-body">
    `;
    
    // Récupérer les jours du mois précédent pour remplir le début du calendrier
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // Ajouter les jours du mois précédent
    for (let i = adjustedStartDay - 1; i >= 0; i--) {
        const prevMonthDay = prevMonthLastDay - i;
        calendarHtml += `<div class="calendar-day empty other-month">${prevMonthDay}</div>`;
    }
    
    // Ajouter les jours du mois actuel
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
    
    // Calculer combien de jours du mois suivant nous devons ajouter
    const totalDaysDisplayed = adjustedStartDay + daysInMonth;
    const remainingCells = 42 - totalDaysDisplayed; // 6 lignes de 7 jours = 42 cellules
    
    // Ajouter les jours du mois suivant
    for (let day = 1; day <= remainingCells; day++) {
        calendarHtml += `<div class="calendar-day empty other-month">${day}</div>`;
    }
    
    calendarHtml += `
            </div>
        </div>
    `;
    
    // Conteneur pour les commandes du jour sélectionné
    calendarHtml += `
        <div id="day-orders-container" class="day-orders-container">
            <h3 id="selected-date" class="selected-date">Sélectionnez un jour pour voir les commandes</h3>
            <div id="day-orders-list" class="day-orders-list"></div>
        </div>
    `;
    
    // Mettre à jour le conteneur
    calendarContainer.innerHTML = calendarHtml;
    
    // Ajouter les écouteurs pour les jours
    setupDayClickHandlers();
}

/**
 * Configure les écouteurs pour les clics sur les jours du calendrier
 */
function setupDayClickHandlers() {
    const calendarDays = document.querySelectorAll('.calendar-day:not(.empty)');
    
    calendarDays.forEach(dayElement => {
        dayElement.addEventListener('click', function() {
            // Retirer la sélection précédente
            document.querySelectorAll('.calendar-day.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // Ajouter la sélection au jour cliqué
            this.classList.add('selected');
            
            // Récupérer la date
            const day = parseInt(this.getAttribute('data-day'));
            const month = parseInt(this.getAttribute('data-month'));
            const year = parseInt(this.getAttribute('data-year'));
            
            // Afficher les commandes du jour
            displayDayOrders(year, month, day);
        });
    });
}

/**
 * Affiche les commandes d'un jour spécifique
 * @param {number} year - Année
 * @param {number} month - Mois (0-11)
 * @param {number} day - Jour
 */
function displayDayOrders(year, month, day) {
    const dayOrdersList = document.getElementById('day-orders-list');
    const selectedDateElement = document.getElementById('selected-date');
    
    if (!dayOrdersList || !selectedDateElement) return;
    
    // Formater la date
    const dateStr = new Date(year, month, day).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Mettre à jour le titre
    selectedDateElement.textContent = dateStr;
    
    // Vérifier s'il y a des commandes pour ce jour
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
    
    // Afficher les commandes
    dayOrdersList.innerHTML = '';
    
    dayOrders.forEach(order => {
        const orderElement = createOrderElement(order);
        dayOrdersList.appendChild(orderElement);
    });
}

/**
 * Crée un élément HTML pour une commande
 * @param {Object} order - Données de la commande
 * @returns {HTMLElement} Élément de commande
 */
function createOrderElement(order) {
    const orderDate = Formatter.formatDate(order.date);
    const processDate = Formatter.formatDate(order.lastProcessed);
    
    // Calculer le nombre total d'articles livrés
    const totalDeliveredItems = order.deliveredItems 
        ? order.deliveredItems.reduce((sum, item) => sum + item.quantity, 0)
        : 0;
    
    // Récupérer les 3 premiers noms d'articles pour l'aperçu
    const itemsPreview = (order.deliveredItems || []).slice(0, 3).map(item => {
        const shortName = item.Nom.split(' - ')[0];
        return shortName;
    }).join(', ');
    
    // Informations du client
    const userProfile = order.userProfile || {};
    const customerName = userProfile.fullName || order.userId;
    const shopName = userProfile.shopName || 'Non spécifié';
    const email = userProfile.email || 'Non spécifié';
    const phone = userProfile.phone || 'Non spécifié';
    
    // Créer l'élément de commande
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
            <button class="action-btn view-btn" onclick="viewOrderDetails('${order.orderId}', '${order.userId}')">
                <i class="fas fa-eye"></i> Voir détails
            </button>
            <a href="${API.getInvoiceDownloadLink(order.orderId, order.userId)}" class="action-btn download-btn" target="_blank">
                <i class="fas fa-file-pdf"></i> Facture
            </a>
        </div>
    `;
    
    return orderItem;
}

/**
 * Fonction globale pour voir les détails d'une commande (accessible par onclick)
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 */
window.viewOrderDetails = function(orderId, userId) {
    HistoryView.viewOrderDetails(orderId, userId);
};

/**
 * Initialise les événements de recherche et s'assure que les modales sont correctement configurées
 */
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
    
    // S'assurer que les modales sont initialisées
    const orderModal = document.getElementById('orderModal');
    if (orderModal) {
        const closeModal = orderModal.querySelector('.close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', function() {
                orderModal.style.display = 'none';
            });
        }
        
        // Fermer la modale en cliquant en dehors
        window.addEventListener('click', function(event) {
            if (event.target === orderModal) {
                orderModal.style.display = 'none';
            }
        });
    }
}

/**
 * Effectue une recherche dans les commandes
 */
function searchOrders() {
    const searchValue = searchInput.value.toLowerCase().trim();
    
    if (!searchValue) {
        // Réinitialiser la vue calendrier
        organizeOrdersByDate(allTreatedOrders);
        displayCalendar(currentYear, currentMonth);
        return;
    }
    
    // Filtrer les commandes
    const filteredOrders = allTreatedOrders.filter(order => {
        // Recherche par ID de commande
        if (order.orderId.toLowerCase().includes(searchValue)) return true;
        
        // Recherche par ID client
        if (order.userId.toLowerCase().includes(searchValue)) return true;
        
        // Recherche par infos client
        const userProfile = order.userProfile || {};
        const fullName = (userProfile.fullName || '').toLowerCase();
        const shopName = (userProfile.shopName || '').toLowerCase();
        const email = (userProfile.email || '').toLowerCase();
        const phone = (userProfile.phone || '').toLowerCase();
        
        // Recherche par articles
        const hasMatchingItem = (order.deliveredItems || []).some(item => 
            (item.Nom || '').toLowerCase().includes(searchValue)
        );
        
        return fullName.includes(searchValue) || 
               shopName.includes(searchValue) || 
               email.includes(searchValue) || 
               phone.includes(searchValue) ||
               hasMatchingItem;
    });
    
    // Réorganiser et afficher les résultats
    if (filteredOrders.length > 0) {
        // Mettre à jour le calendrier avec les résultats filtrés
        organizeOrdersByDate(filteredOrders);
        displayCalendar(currentYear, currentMonth);
        
        // Afficher un message indiquant les résultats de recherche
        Notification.showNotification(`${filteredOrders.length} commande(s) trouvée(s) pour "${searchValue}"`, 'info');
    } else {
        // Aucun résultat
        const calendarContainer = document.getElementById('calendar-container');
        if (calendarContainer) {
            calendarContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Aucune commande trouvée pour "${searchValue}"</p>
                    <button class="action-btn" id="resetSearch">Réinitialiser la recherche</button>
                </div>
            `;
            
            // Ajouter l'écouteur pour le bouton de réinitialisation
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

// Exposer les fonctions publiques
export {
    loadTreatedOrders,
    displayCalendar,
    displayDayOrders,
    searchOrders
};