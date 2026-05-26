// Service de stockage local
// Gestion de localStorage/sessionStorage
// public/js/core/storage.js

import { AppConfig } from './config.js';

// Clés de stockage
const KEYS = AppConfig.STORAGE_KEYS;

// Sauvegarde dans le stockage
export function saveToStorage(key, data, useSession = false) {
  const storage = useSession ? sessionStorage : localStorage;
  try {
    const serializedData = JSON.stringify(data);
    storage.setItem(key, serializedData);
    return true;
  } catch (error) {
    console.error(`Error saving to ${useSession ? 'session' : 'local'} storage:`, error);
    return false;
  }
}

// Récupération depuis le stockage
export function getFromStorage(key, defaultValue = null, useSession = false) {
  const storage = useSession ? sessionStorage : localStorage;
  try {
    const serializedData = storage.getItem(key);
    if (serializedData === null) {
      return defaultValue;
    }
    return JSON.parse(serializedData);
  } catch (error) {
    console.error(`Error retrieving from ${useSession ? 'session' : 'local'} storage:`, error);
    return defaultValue;
  }
}

// Suppression du stockage
export function removeFromStorage(key, useSession = false) {
  const storage = useSession ? sessionStorage : localStorage;
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing from ${useSession ? 'session' : 'local'} storage:`, error);
    return false;
  }
}

// Vérification d'existence dans le stockage
export function hasStorageItem(key, useSession = false) {
  const storage = useSession ? sessionStorage : localStorage;
  return storage.getItem(key) !== null;
}

// Effacement complet du stockage
export function clearStorage(useSession = false) {
  const storage = useSession ? sessionStorage : localStorage;
  try {
    storage.clear();
    return true;
  } catch (error) {
    console.error(`Error clearing ${useSession ? 'session' : 'local'} storage:`, error);
    return false;
  }
}

// Fonctions spécifiques au panier

// Récupération du panier
export function getCart() {
  return getFromStorage(KEYS.CART, []);
}

// Sauvegarde du panier
export function saveCart(cart) {
  return saveToStorage(KEYS.CART, cart);
}

// Ajout au panier
export function addToCart(product, quantity) {
  const cart = getCart();

  // Vérification de produit existant (inclut la taille pour les textiles)
  const existingItemIndex = cart.findIndex(item =>
    item.Nom === product.Nom && item.categorie === product.categorie && (item.size || null) === (product.size || null)
  );
  
  if (existingItemIndex !== -1) {
    // Mise à jour de la quantité
    cart[existingItemIndex].quantity += quantity;
    
    // Limitation à la quantité maximale
    if (cart[existingItemIndex].quantity > AppConfig.MAX_CART_QUANTITY) {
      cart[existingItemIndex].quantity = AppConfig.MAX_CART_QUANTITY;
    }
  } else {
    // Ajout du nouveau produit
    cart.push({
      ...product,
      quantity: Math.min(quantity, AppConfig.MAX_CART_QUANTITY)
    });
  }
  
  saveCart(cart);
  return cart;
}

// Suppression du panier
export function removeFromCart(index) {
  const cart = getCart();
  
  if (index >= 0 && index < cart.length) {
    cart.splice(index, 1);
    saveCart(cart);
  }
  
  return cart;
}

// Vidage du panier
export function clearCart() {
  return removeFromStorage(KEYS.CART);
}

// Comptage des articles
export function getCartItemCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.quantity, 0);
}

// Calcul du total
export function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => {
    return total + (parseFloat(item.prix) * item.quantity);
  }, 0);
}

// Mise à jour de la quantité d'un article (supprime si quantité <= 0)
export function updateCartItemQuantity(index, newQuantity) {
  const cart = getCart();
  if (index < 0 || index >= cart.length) return cart;
  if (newQuantity <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = Math.min(newQuantity, AppConfig.MAX_CART_QUANTITY);
  }
  saveCart(cart);
  return cart;
}