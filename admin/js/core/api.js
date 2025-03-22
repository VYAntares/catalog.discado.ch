/**
 * Gestion des appels API centralisée
 * Toutes les requêtes au serveur passent par ce module
 * admin/js/core/api.js
 */

import * as Notification from '../utils/notification.js';

// Configuration par défaut pour les requêtes
const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'same-origin' // Pour envoyer les cookies de session
};

/**
 * Fonction helper pour gérer les erreurs d'API
 * @param {Response} response - La réponse de fetch
 * @returns {Promise} - Retourne la réponse JSON ou rejette avec une erreur
 */
async function handleApiResponse(response) {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || `Erreur: ${response.status}`;
    } catch (e) {
      errorMessage = `Erreur: ${response.status}`;
    }
    
    Notification.showNotification(errorMessage, 'error');
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * Récupère les commandes en attente
 * @returns {Promise<Array>} Liste des commandes en attente
 */
async function fetchPendingOrders() {
  try {
    const response = await fetch('/api/admin/pending-orders', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    throw error;
  }
}

/**
 * Récupère les commandes traitées
 * @returns {Promise<Array>} Liste des commandes traitées
 */
async function fetchTreatedOrders() {
  try {
    const response = await fetch('/api/admin/treated-orders', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching treated orders:', error);
    throw error;
  }
}

/**
 * Récupère tous les profils clients
 * @returns {Promise<Array>} Liste des profils clients
 */
async function fetchClientProfiles() {
  try {
    const response = await fetch('/api/admin/client-profiles', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching client profiles:', error);
    throw error;
  }
}

/**
 * Récupère les détails d'un client
 * @param {string} clientId - ID du client
 * @returns {Promise<Object>} Détails du client
 */
async function fetchClientDetails(clientId) {
  try {
    const response = await fetch(`/api/admin/client-profile/${clientId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error fetching client details for ${clientId}:`, error);
    throw error;
  }
}

/**
 * Récupère l'historique des commandes d'un client
 * @param {string} clientId - ID du client
 * @returns {Promise<Array>} Historique des commandes
 */
async function fetchClientOrders(clientId) {
  try {
    const response = await fetch(`/api/admin/client-orders/${clientId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error fetching orders for client ${clientId}:`, error);
    throw error;
  }
}

/**
 * Récupère les détails d'une commande
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} Détails de la commande
 */
async function fetchOrderDetails(orderId, userId) {
  try {
    const response = await fetch(`/api/admin/order-details/${orderId}/${userId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error fetching order details for ${orderId}:`, error);
    throw error;
  }
}

/**
 * Traite une commande
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 * @param {Array} deliveredItems - Articles livrés
 * @returns {Promise<Object>} Résultat du traitement
 */
async function processOrder(orderId, userId, deliveredItems) {
  try {
    const response = await fetch('/api/admin/process-order', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify({
        orderId,
        userId,
        deliveredItems
      })
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Commande traitée avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    console.error('Error processing order:', error);
    throw error;
  }
}

/**
 * Supprime des articles en attente
 * @param {string} userId - ID de l'utilisateur
 * @param {Array} items - Articles à supprimer
 * @returns {Promise<Object>} Résultat de la suppression
 */
async function deletePendingItems(userId, items) {
  try {
    const response = await fetch('/api/admin/delete-pending-items', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify({
        userId,
        items
      })
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Articles supprimés avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    console.error('Error deleting pending items:', error);
    throw error;
  }
}

/**
 * Crée un nouveau client
 * @param {Object} clientData - Données du client
 * @returns {Promise<Object>} Résultat de la création
 */
async function createNewClient(clientData) {
  try {
    const response = await fetch('/api/admin/create-client', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(clientData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification(`Client ${clientData.username} créé avec succès`, 'success');
    }
    
    return result;
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
}

/**
 * Génère un lien pour télécharger une facture
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 * @returns {string} URL de téléchargement
 */
function getInvoiceDownloadLink(orderId, userId) {
  return `/api/admin/download-invoice/${orderId}/${userId}`;
}

/**
 * Sauvegarde le nouveau mot de passe de l'utilisateur
 * @param {Object} passwordData - Données du mot de passe (currentPassword, newPassword)
 * @returns {Promise<Object>} Résultat de l'opération
 */
async function saveUserPassword(passwordData) {
  try {
      const response = await fetch('/api/update-password', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(passwordData),
          credentials: 'same-origin'
      });

      if (!response.ok) {
          const errorData = await response.json();
          return {
              success: false,
              message: errorData.message || 'Failed to update password',
              code: errorData.code || 'UNKNOWN_ERROR'
          };
      }

      const data = await response.json();
      return {
          success: true,
          ...data
      };
  } catch (error) {
      console.error('API Error (saveUserPassword):', error);
      return {
          success: false,
          message: error.message || 'Network error while updating password',
          code: 'NETWORK_ERROR'
      };
  }
}

// Exposer toutes les fonctions de l'API
export {
  fetchPendingOrders,
  fetchTreatedOrders,
  fetchClientProfiles,
  fetchClientDetails,
  fetchClientOrders,
  fetchOrderDetails,
  processOrder,
  deletePendingItems,
  createNewClient,
  getInvoiceDownloadLink,
  saveUserPassword
};