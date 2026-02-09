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
// ============================================
// API FOURNISSEURS ET COMMANDES FOURNISSEURS
// ============================================

// Récupère tous les fournisseurs
async function fetchSuppliers() {
  try {
    const response = await fetch('/api/suppliers', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère les commandes d'un fournisseur spécifique
async function fetchSupplierOrders(supplierId) {
  try {
    const response = await fetch(`/api/suppliers/${supplierId}/orders`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère les statistiques d'un fournisseur
async function fetchSupplierStats(supplierId) {
  try {
    const response = await fetch(`/api/suppliers/${supplierId}/stats`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère toutes les commandes fournisseurs
async function fetchAllSupplierOrders() {
  try {
    const response = await fetch('/api/order-suppliers', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère les détails d'une commande fournisseur
async function fetchSupplierOrderDetails(orderId) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Récupère les items d'une commande fournisseur
async function fetchSupplierOrderItems(orderId) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/items`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Crée une nouvelle commande fournisseur
async function createSupplierOrder(orderData) {
  try {
    const response = await fetch('/api/order-suppliers', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(orderData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Commande fournisseur créée avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Met à jour une commande fournisseur
async function updateSupplierOrder(orderId, orderData) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}`, {
      ...API_CONFIG,
      method: 'PUT',
      body: JSON.stringify(orderData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Commande mise à jour avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Met à jour le statut d'une commande fournisseur
async function updateSupplierOrderStatus(orderId, status) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/status`, {
      ...API_CONFIG,
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Statut mis à jour avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Met à jour les notes d'une commande fournisseur
async function updateSupplierOrderNotes(orderId, notes) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/notes`, {
      ...API_CONFIG,
      method: 'PATCH',
      body: JSON.stringify({ notes })
    });

    return await handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Met à jour les montants d'une commande fournisseur
async function updateSupplierOrderAmounts(orderId, total_amount, amount_paid) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/amounts`, {
      ...API_CONFIG,
      method: 'PATCH',
      body: JSON.stringify({ total_amount, amount_paid })
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Montants mis à jour avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Récupère les paiements d'une commande fournisseur
async function getSupplierOrderPayments(orderId) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/payments`, API_CONFIG);
    return await handleApiResponse(response);
  } catch (error) {
    throw error;
  }
}

// Ajoute un paiement à une commande fournisseur
async function addSupplierOrderPayment(orderId, amount_usd, amount_chf, payment_date) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/payments`, {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify({ amount_usd, amount_chf, payment_date })
    });

    const result = await handleApiResponse(response);

    if (result.success) {
      Notification.showNotification('Paiement enregistré avec succès', 'success');
    }

    return result;
  } catch (error) {
    throw error;
  }
}

// Supprime un paiement d'une commande fournisseur
async function deleteSupplierOrderPayment(orderId, paymentId) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/payments/${paymentId}`, {
      ...API_CONFIG,
      method: 'DELETE'
    });

    const result = await handleApiResponse(response);

    if (result.success) {
      Notification.showNotification('Paiement supprimé', 'success');
    }

    return result;
  } catch (error) {
    throw error;
  }
}

// Ajoute un item à une commande fournisseur
async function addSupplierOrderItem(orderId, itemData) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}/items`, {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(itemData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Article ajouté avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Met à jour un item d'une commande fournisseur (prix, quantité)
async function updateSupplierOrderItem(itemId, unitPrice, quantity) {
  try {
    const response = await fetch(`/api/order-supplier-items/${itemId}`, {
      ...API_CONFIG,
      method: 'PUT',
      body: JSON.stringify({ unit_price: unitPrice, quantity })
    });

    const result = await handleApiResponse(response);

    if (result.success) {
      Notification.showNotification('Article mis à jour', 'success');
    }

    return result;
  } catch (error) {
    throw error;
  }
}

// Supprime un item d'une commande fournisseur
async function deleteSupplierOrderItem(itemId) {
  try {
    const response = await fetch(`/api/order-supplier-items/${itemId}`, {
      ...API_CONFIG,
      method: 'DELETE'
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Article supprimé avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Supprime une commande fournisseur
async function deleteSupplierOrder(orderId) {
  try {
    const response = await fetch(`/api/order-suppliers/${orderId}`, {
      ...API_CONFIG,
      method: 'DELETE'
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      Notification.showNotification('Commande supprimée avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    throw error;
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
  saveUserPassword,
  fetchSuppliers,
  fetchSupplierOrders,
  fetchSupplierStats,
  fetchAllSupplierOrders,
  fetchSupplierOrderDetails,
  fetchSupplierOrderItems,
  createSupplierOrder,
  updateSupplierOrder,
  updateSupplierOrderStatus,
  updateSupplierOrderNotes,
  updateSupplierOrderAmounts,
  addSupplierOrderItem,
  updateSupplierOrderItem,
  deleteSupplierOrderItem,
  deleteSupplierOrder,
  getSupplierOrderPayments,
  addSupplierOrderPayment,
  deleteSupplierOrderPayment
};