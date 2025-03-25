//public/js/core/api.js
import { showNotification } from '../utils/notification.js';

const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'same-origin'
};

async function handleApiResponse(response) {
  const responseText = await response.text();
  
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    responseData = { success: false, message: responseText || `Error: ${response.status}` };
  }
  
  if (response.url.includes('/api/change-password') || 
      (response.url.includes('/api/save-profile') && responseData.passwordChanged !== undefined)) {
    
    if (responseData.success || responseData.passwordChanged) {
      return responseData;
    }
    
    if (responseData.code === 'INVALID_CURRENT_PASSWORD' || 
        responseData.code === 'PASSWORD_SAME_AS_USERNAME') {
      return responseData;
    }
  }
  
  if (!response.ok) {
    const errorMessage = responseData.message || responseData.error || `Error: ${response.status}`;
    
    if (response.status !== 401 && !response.url.includes('/api/change-password')) {
      showNotification(errorMessage, 'error');
    }
    
    return responseData;
  }
  
  return responseData;
}

export async function fetchProducts() {
  try {
    const response = await fetch('/api/products', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

export async function fetchProductDetails(productId) {
  try {
    const response = await fetch(`/api/products/${productId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error fetching product details for ${productId}:`, error);
    throw error;
  }
}

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

export async function fetchUserOrders() {
  try {
    const response = await fetch('/api/user-orders', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    throw error;
  }
}

export async function fetchUserProfile() {
  try {
    const response = await fetch('/api/user-profile', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

export async function saveUserProfile(profileData) {
  try {
    const response = await fetch('/api/save-profile', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(profileData)
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
}

export function getInvoiceDownloadLink(orderId) {
  return `/api/download-invoice/${orderId}`;
}

export async function checkAuthentication() {
  try {
    const response = await fetch('/api/check-auth', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error checking authentication:', error);
    throw error;
  }
}

export async function saveUserPassword(passwordData) {
  try {
    const response = await fetch('/api/change-password', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(passwordData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      showNotification('Mot de passe mis à jour avec succès', 'success');
    }
    
    return result;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mot de passe:', error);
    
    return {
      success: false,
      message: error.message || 'Erreur réseau lors de la mise à jour du mot de passe',
      error: error
    };
  }
}