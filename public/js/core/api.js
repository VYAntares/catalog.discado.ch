/**
 * API Core Module - Version corrigée
 * Centralisation de tous les appels API
 * Toutes les requêtes au serveur passent par ce module
 */

import { showNotification } from '../utils/notification.js';

// Configuration par défaut pour les requêtes
const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'same-origin' // Pour envoyer les cookies de session
};

/**
 * Fonction helper pour gérer les réponses d'API
 * @param {Response} response - La réponse de fetch
 * @returns {Promise} - Retourne la réponse JSON ou rejette avec une erreur
 */
async function handleApiResponse(response) {
  // Obtenir le corps de la réponse au format texte
  const responseText = await response.text();
  
  // Essayer de parser le JSON
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    responseData = { success: false, message: responseText || `Error: ${response.status}` };
  }
  
  // Pour les réponses concernant le mot de passe, traiter de manière spéciale
  if (response.url.includes('/api/change-password') || 
      (response.url.includes('/api/save-profile') && responseData.passwordChanged !== undefined)) {
    
    // Même en cas d'échec HTTP, si le message indique que le mot de passe a été changé
    // ou si passwordChanged est true, on considère que c'est un succès
    if (responseData.success || responseData.passwordChanged) {
      return responseData;
    }
    
    // Gérer spécifiquement les erreurs de mot de passe sans notification
    if (responseData.code === 'INVALID_CURRENT_PASSWORD' || 
        responseData.code === 'PASSWORD_SAME_AS_USERNAME') {
      return responseData;
    }
  }
  
  // Pour les réponses non-OK générales, afficher une notification et rejeter
  if (!response.ok) {
    const errorMessage = responseData.message || responseData.error || `Error: ${response.status}`;
    
    // Ne pas afficher de notification pour les erreurs d'authentification
    // Ces erreurs seront gérées spécifiquement par les fonctions appelantes
    if (response.status !== 401 && !response.url.includes('/api/change-password')) {
      showNotification(errorMessage, 'error');
    }
    
    // Retourner quand même les données pour permettre un traitement particulier
    return responseData;
  }
  
  return responseData;
}

/**
 * Récupère tous les produits du catalogue
 * @returns {Promise<Array>} Liste des produits
 */
export async function fetchProducts() {
  try {
    const response = await fetch('/api/products', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * Récupère les détails d'un produit
 * @param {string} productId - ID du produit
 * @returns {Promise<Object>} Détails du produit
 */
export async function fetchProductDetails(productId) {
  try {
    const response = await fetch(`/api/products/${productId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error fetching product details for ${productId}:`, error);
    throw error;
  }
}

/**
 * Enregistre une commande
 * @param {Object} orderData - Données de la commande
 * @returns {Promise<Object>} Résultat de l'enregistrement
 */
export async function saveOrder(orderData) {
  try {
    const response = await fetch('/api/save-order', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(orderData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      showNotification('Order placed successfully!', 'success');
    }
    
    return result;
  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
}

/**
 * Récupère les commandes de l'utilisateur
 * @returns {Promise<Array>} Liste des commandes
 */
export async function fetchUserOrders() {
  try {
    const response = await fetch('/api/user-orders', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    throw error;
  }
}

/**
 * Récupère le profil de l'utilisateur
 * @returns {Promise<Object>} Profil utilisateur
 */
export async function fetchUserProfile() {
  try {
    console.log('Fetching user profile from API...');
    const response = await fetch('/api/user-profile', API_CONFIG);
    const data = await handleApiResponse(response);
    console.log('API returned profile data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Sauvegarde le profil utilisateur
 * @param {Object} profileData - Données du profil
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
export async function saveUserProfile(profileData) {
  try {
    const response = await fetch('/api/save-profile', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(profileData)
    });
    
    const result = await handleApiResponse(response);
    
    return result;
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
}

/**
 * Génère un lien pour télécharger une facture
 * @param {string} orderId - ID de la commande
 * @returns {string} URL de téléchargement
 */
export function getInvoiceDownloadLink(orderId) {
  return `/api/download-invoice/${orderId}`;
}

/**
 * Vérifie l'état de l'authentification
 * @returns {Promise<Object>} Informations sur l'utilisateur connecté
 */
export async function checkAuthentication() {
  try {
    const response = await fetch('/api/check-auth', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error checking authentication:', error);
    throw error;
  }
}

/**
 * Sauvegarde le mot de passe de l'utilisateur
 * @param {Object} passwordData - Données du mot de passe {currentPassword, newPassword}
 * @returns {Promise<Object>} Résultat de la mise à jour
 */
export async function saveUserPassword(passwordData) {
  try {
    const response = await fetch('/api/change-password', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(passwordData)
    });
    
    const result = await handleApiResponse(response);
    
    // Afficher une notification uniquement en cas de succès
    if (result.success) {
      showNotification('Mot de passe mis à jour avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mot de passe:', error);
    
    // Retourner un objet d'erreur structuré plutôt que de lancer une exception
    return {
      success: false,
      message: error.message || 'Erreur réseau lors de la mise à jour du mot de passe',
      error: error
    };
  }
}