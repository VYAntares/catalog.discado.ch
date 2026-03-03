/**
 * Gestion de la liste des clients
 * admin/js/modules/clients/clientList.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as ClientView from './clientView.js';
import * as ClientCreate from './clientCreate.js';

let clientTableBody;
let searchInput;
let searchBtn;
let createClientBtn;

let allClients = [];

//Charge la liste des clients depuis l'API
async function loadClients() {
    clientTableBody = document.getElementById('clientTableBody');
    searchInput = document.getElementById('searchInput');
    searchBtn = document.getElementById('searchBtn');
    createClientBtn = document.getElementById('createClientBtn');
    
    if (!clientTableBody) return;
    
    clientTableBody.innerHTML = `
        <tr>
            <td colspan="2" class="loading">Chargement des clients...</td>
        </tr>
    `;
    
    try {
        const clients = await API.fetchClientProfiles();
        allClients = clients;
        displayClients(clients);
        initEvents();

        // Ouvrir automatiquement la modale si ?client=USERNAME dans l'URL (lien depuis la carte)
        const params = new URLSearchParams(window.location.search);
        const openClient = params.get('client');
        if (openClient) {
            ClientView.viewClientDetails(openClient);
        }
    } catch (error) {
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="2" class="loading">
                    Erreur lors du chargement des clients. Veuillez réessayer.
                    <br><button class="action-btn" id="retryLoadClients">Réessayer</button>
                </td>
            </tr>
        `;
        
        const retryButton = document.getElementById('retryLoadClients');
        if (retryButton) {
            retryButton.addEventListener('click', loadClients);
        }
    }
}

//Affiche la liste des clients dans le tableau
function displayClients(clients) {
    if (!clients || clients.length === 0) {
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="2" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Aucun client trouvé.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    clientTableBody.innerHTML = '';
    
    clients.forEach(client => {
        const clientId = client.clientId || 'N/A';
        const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'N/A';
        const shopName = client.shopName || 'N/A';
        const shopAddress = [client.shopAddress, client.shopZipCode, client.shopCity]
            .filter(Boolean).join(', ');

        const row = document.createElement('tr');
        row.className = 'client-row';
        row.setAttribute('data-client-id', clientId);
        row.innerHTML = `
            <td class="col-identity">
                <div class="client-info">
                    <span class="client-name">${fullName}</span>
                    <span class="client-shop">${shopName}</span>
                    <span class="client-id-inline">${clientId}</span>
                </div>
            </td>
            <td class="col-address">
                ${shopAddress ? `<a href="/admin/clients-map?address=${encodeURIComponent(shopAddress)}&client=${encodeURIComponent(clientId)}" class="client-address" title="Voir sur la carte"><i class="fas fa-map-marker-alt"></i> ${shopAddress}</a>` : '<span class="client-address-empty">—</span>'}
            </td>
        `;
        
        clientTableBody.appendChild(row);
    });
    
    setupViewButtons();
}

//Recherche de clients selon les critères entrés
function searchClients() {
    const searchValue = searchInput.value.toLowerCase().trim();
    if (!searchValue) {
        displayClients(allClients);
        return;
    }
    
    clientTableBody.innerHTML = `
        <tr>
            <td colspan="2" class="loading">Recherche en cours...</td>
        </tr>
    `;
    
    const filteredClients = allClients.filter(client => {
        const fullName = (`${client.firstName || ''} ${client.lastName || ''}`).toLowerCase().trim();
        const shopName = (client.shopName || '').toLowerCase();
        const email = (client.email || '').toLowerCase();
        const phone = (client.phone || '').toLowerCase();
        const username = (client.username || '').toLowerCase();
        const city = (client.shopCity || client.city || '').toLowerCase();
        const cId = (client.clientId || '').toLowerCase();
        const referralSource = (client.referralSource || '').toLowerCase();
        
        return (
            fullName.includes(searchValue) ||
            shopName.includes(searchValue) ||
            email.includes(searchValue) ||
            phone.includes(searchValue) ||
            username.includes(searchValue) ||
            city.includes(searchValue) ||
            cId.includes(searchValue) ||
            referralSource.includes(searchValue)
        );
    });
    
    displayClients(filteredClients);
    
    if (filteredClients.length > 0) {
        Notification.showNotification(`${filteredClients.length} client(s) trouvé(s) pour "${searchValue}"`, 'info');
    } else {
        Notification.showNotification(`Aucun client trouvé pour "${searchValue}"`, 'info');
    }
}

//Rend chaque ligne de la table cliquable pour ouvrir le détail client
function setupViewButtons() {
    document.querySelectorAll('.client-row').forEach(row => {
        row.addEventListener('click', function(e) {
            if (e.target.closest('.client-address')) return;
            ClientView.viewClientDetails(this.getAttribute('data-client-id'));
        });
    });
}

//Initialise tous les événements (recherche, création de client, etc.)
function initEvents() {
    if (searchBtn) {
        searchBtn.addEventListener('click', searchClients);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                searchClients();
            }
        });
    }
    
    if (createClientBtn) {
        createClientBtn.addEventListener('click', function() {
            ClientCreate.showCreateClientModal();
        });
    }
}

//Rafraîchit la liste des clients après la création d'un client
function refreshClientList() {
    loadClients();
}

export {
    loadClients,
    displayClients,
    searchClients,
    refreshClientList
};