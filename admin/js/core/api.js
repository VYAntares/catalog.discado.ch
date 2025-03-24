/**
 * Module centralisé pour la gestion des appels API
 * admin/js/core/api.js
 */

import * as Notification from '../utils/notification.js';

const API_CONFIG = {
  headers: {'Content-Type': 'application/json'},
  credentials: 'same-origin'
};

// Gère les réponses API et extrait les messages d'erreur
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

// Récupère les commandes en attente
async function fetchPendingOrders() {
  try {
    const response = await fetch('/api/admin/pending-orders', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère les commandes traitées
async function fetchTreatedOrders() {
  try {
    const response = await fetch('/api/admin/treated-orders', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère tous les profils clients
async function fetchClientProfiles() {
  try {
    const response = await fetch('/api/admin/client-profiles', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère les détails d'un client
async function fetchClientDetails(clientId) {
  try {
    const response = await fetch(`/api/admin/client-profile/${clientId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère l'historique des commandes d'un client
async function fetchClientOrders(clientId) {
  try {
    const response = await fetch(`/api/admin/client-orders/${clientId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère les détails d'une commande
async function fetchOrderDetails(orderId, userId) {
  try {
    const response = await fetch(`/api/admin/order-details/${orderId}/${userId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Traite une commande
async function processOrder(orderId, userId, deliveredItems) {
  try {
    const response = await fetch('/api/admin/process-order', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify({orderId, userId, deliveredItems})
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Commande traitée avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Supprime des articles en attente
async function deletePendingItems(userId, items) {
  try {
    const response = await fetch('/api/admin/delete-pending-items', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify({userId, items})
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Articles supprimés avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Crée un nouveau client
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
    throw error;
  }
}

// Génère un lien pour télécharger une facture
function getInvoiceDownloadLink(orderId, userId) {
  return `/api/admin/download-invoice/${orderId}/${userId}`;
}

// Sauvegarde le nouveau mot de passe de l'utilisateur
async function saveUserPassword(passwordData) {
  try {
    const response = await fetch('/api/update-password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
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
    return {success: true, ...data};
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Network error while updating password',
      code: 'NETWORK_ERROR'
    };
  }
}

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