/**
 * Gestion de la liste des clients
 * Ce module gère le chargement et l'affichage de la liste des clients
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as ClientView from './clientView.js';
import * as ClientCreate from './clientCreate.js';

// Références DOM
let clientTableBody;
let searchInput;
let searchBtn;
let createClientBtn;

// Variable de stockage pour filtrage
let allClients = [];

/**
 * Charge la liste des clients depuis l'API
 */
async function loadClients() {
    // Obtenir les références DOM
    clientTableBody = document.getElementById('clientTableBody');
    searchInput = document.getElementById('searchInput');
    searchBtn = document.getElementById('searchBtn');
    createClientBtn = document.getElementById('createClientBtn');
    
    if (!clientTableBody) {
        console.error("Table des clients non trouvée");
        return;
    }
    
    // Afficher l'indicateur de chargement
    clientTableBody.innerHTML = `
        <tr>
            <td colspan="4" class="loading">Chargement des clients...</td>
        </tr>
    `;
    
    try {
        // Appel API pour récupérer tous les profils clients
        const clients = await API.fetchClientProfiles();
        
        // Stocker tous les clients pour la recherche
        allClients = clients;
        
        // Afficher les clients
        displayClients(clients);
        
        // Initialiser les événements
        initEvents();
    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
        
        // Afficher un message d'erreur avec bouton de réessai
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="loading">
                    Erreur lors du chargement des clients. Veuillez réessayer.
                    <br><button class="action-btn" id="retryLoadClients">Réessayer</button>
                </td>
            </tr>
        `;
        
        // Ajouter l'écouteur pour le bouton de réessai
        const retryButton = document.getElementById('retryLoadClients');
        if (retryButton) {
            retryButton.addEventListener('click', loadClients);
        }
    }
}

/**
 * Extrait du fichier admin/js/modules/clients/clientList.js
 * Modification de la fonction displayClients pour afficher la source de référence
 */
function displayClients(clients) {
    // Vérifier s'il y a des clients
    if (!clients || clients.length === 0) {
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Aucun client trouvé.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Vider le tableau
    clientTableBody.innerHTML = '';
    
    // Créer une ligne pour chaque client
    clients.forEach(client => {
        // Récupérer l'ID du client
        const clientId = client.clientId || 'N/A';
        
        // Concaténer Prénom + Nom pour l'affichage (ou 'N/A' si vide)
        const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'N/A';
        const shopName = client.shopName || 'N/A';
        const email = client.email || 'N/A';
        const phone = client.phone || 'N/A';
        const referralSource = client.referralSource || '';
        
        // Créer la ligne avec un design amélioré
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="client-id">${clientId}</span>
            </td>
            <td>
                <div class="client-info">
                    <span class="client-name">${fullName}</span>
                    <span class="client-shop">${shopName}</span>
                    <div class="client-contact">
                        <a href="mailto:${email}" class="contact-link" title="Envoyer un email">
                            <i class="fas fa-envelope"></i> ${email}
                        </a>
                        <a href="tel:${phone}" class="contact-link" title="Appeler">
                            <i class="fas fa-phone"></i> ${phone}
                        </a>
                        ${referralSource ? `<div class="client-referral" title="Source"><i class="fas fa-user-tag"></i> ${referralSource}</div>` : ''}
                    </div>
                </div>
            </td>
            <td style="text-align: center;">
                <button class="action-btn details-btn view-client-btn" data-client-id="${clientId}">
                    <i class="fas fa-eye"></i> Voir détails
                </button>
            </td>
        `;
        
        // Ajouter la ligne au tableau
        clientTableBody.appendChild(row);
    });
    
    // Ajouter les écouteurs d'événements pour les boutons "Voir détails"
    setupViewButtons();
}

/**
 * Modification de la fonction searchClients pour inclure la recherche par source de référence
 */
function searchClients() {
    const searchValue = searchInput.value.toLowerCase().trim();
    
    if (!searchValue) {
        // Si la recherche est vide, afficher tous les clients
        displayClients(allClients);
        return;
    }
    
    // Afficher une indication de recherche
    clientTableBody.innerHTML = `
        <tr>
            <td colspan="4" class="loading">Recherche en cours...</td>
        </tr>
    `;
    
    // Filtrer les clients
    const filteredClients = allClients.filter(client => {
        const fullName = (`${client.firstName || ''} ${client.lastName || ''}`).toLowerCase().trim();
        const shopName = (client.shopName || '').toLowerCase();
        const email = (client.email || '').toLowerCase();
        const phone = (client.phone || '').toLowerCase();
        const username = (client.username || '').toLowerCase();
        const city = (client.shopCity || client.city || '').toLowerCase();
        const cId = (client.clientId || '').toLowerCase();  // Pour pouvoir chercher par ID
        const referralSource = (client.referralSource || '').toLowerCase(); // Recherche par référence
        
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
    
    // Afficher les clients filtrés
    displayClients(filteredClients);
    
    // Afficher un message indiquant les résultats de recherche
    if (filteredClients.length > 0) {
        Notification.showNotification(`${filteredClients.length} client(s) trouvé(s) pour "${searchValue}"`, 'info');
    } else {
        Notification.showNotification(`Aucun client trouvé pour "${searchValue}"`, 'info');
    }
}

/**
 * Configure les écouteurs d'événements pour les boutons "Voir détails"
 */
function setupViewButtons() {
    document.querySelectorAll('.view-client-btn').forEach(button => {
        button.addEventListener('click', function() {
            const clientId = this.getAttribute('data-client-id');
            ClientView.viewClientDetails(clientId);
        });
    });
}

/**
 * Initialise tous les événements (recherche, création de client, etc.)
 */
function initEvents() {
    // Écouteur pour le bouton de recherche
    if (searchBtn) {
        searchBtn.addEventListener('click', searchClients);
    }
    
    // Recherche en appuyant sur Entrée
    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                searchClients();
            }
        });
    }
    
    // Écouteur pour le bouton de création de client
    if (createClientBtn) {
        createClientBtn.addEventListener('click', function() {
            ClientCreate.showCreateClientModal();
        });
    }
}

/**
 * Rafraîchit la liste des clients 
 * (utilisé après la création d'un client)
 */
function refreshClientList() {
    loadClients();
}

// Exposer les fonctions publiques
export {
    loadClients,
    displayClients,
    searchClients,
    refreshClientList
};