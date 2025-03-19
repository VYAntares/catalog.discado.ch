/**
 * Service de stockage local
 * Gère toutes les interactions avec localStorage/sessionStorage
 */

import { AppConfig } from './config.js';

// Clés de stockage pour plus de lisibilité
const KEYS = AppConfig.STORAGE_KEYS;

/**
 * Sauvegarde les données dans le stockage local
 * @param {string} key - Clé de stockage
 * @param {any} data - Données à stocker
 * @param {boolean} useSession - Utiliser sessionStorage au lieu de localStorage
 */
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

/**
 * Récupère les données du stockage local
 * @param {string} key - Clé de stockage
 * @param {any} defaultValue - Valeur par défaut si la clé n'existe pas
 * @param {boolean} useSession - Utiliser sessionStorage au lieu de localStorage
 * @returns {any} Les données récupérées ou la valeur par défaut
 */
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

/**
 * Supprime des données du stockage local
 * @param {string} key - Clé de stockage
 * @param {boolean} useSession - Utiliser sessionStorage au lieu de localStorage
 */
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

/**
 * Vérifie si une clé existe dans le stockage
 * @param {string} key - Clé à vérifier
 * @param {boolean} useSession - Utiliser sessionStorage au lieu de localStorage
 * @returns {boolean} True si la clé existe
 */
export function hasStorageItem(key, useSession = false) {
  const storage = useSession ? sessionStorage : localStorage;
  return storage.getItem(key) !== null;
}

/**
 * Efface tout le stockage local
 * @param {boolean} useSession - Utiliser sessionStorage au lieu de localStorage
 */
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

// Fonctions spécifiques pour le panier
/**
 * Récupère le panier actuel
 * @returns {Array} Contenu du panier
 */
export function getCart() {
  return getFromStorage(KEYS.CART, []);
}

/**
 * Sauvegarde le panier
 * @param {Array} cart - Contenu du panier
 * @returns {boolean} True si réussite
 */
export function saveCart(cart) {
  return saveToStorage(KEYS.CART, cart);
}

/**
 * Ajoute un produit au panier
 * @param {Object} product - Produit à ajouter
 * @param {number} quantity - Quantité à ajouter
 * @returns {Object} Le panier mis à jour
 */
export function addToCart(product, quantity) {
  const cart = getCart();
  
  // Vérifier si le produit est déjà dans le panier
  const existingItemIndex = cart.findIndex(item => 
    item.Nom === product.Nom && item.categorie === product.categorie
  );
  
  if (existingItemIndex !== -1) {
    // Mettre à jour la quantité
    cart[existingItemIndex].quantity += quantity;
    
    // Limiter à la quantité maximale configurée
    if (cart[existingItemIndex].quantity > AppConfig.MAX_CART_QUANTITY) {
      cart[existingItemIndex].quantity = AppConfig.MAX_CART_QUANTITY;
    }
  } else {
    // Ajouter le nouveau produit
    cart.push({
      ...product,
      quantity: Math.min(quantity, AppConfig.MAX_CART_QUANTITY)
    });
  }
  
  // Sauvegarder le panier mis à jour
  saveCart(cart);
  
  return cart;
}

/**
 * Supprime un article du panier
 * @param {number} index - Index de l'article à supprimer
 * @returns {Object} Le panier mis à jour
 */
export function removeFromCart(index) {
  const cart = getCart();
  
  if (index >= 0 && index < cart.length) {
    cart.splice(index, 1);
    saveCart(cart);
  }
  
  return cart;
}

/**
 * Vide complètement le panier
 * @returns {boolean} True si réussite
 */
export function clearCart() {
  return removeFromStorage(KEYS.CART);
}

/**
 * Obtient le nombre total d'articles dans le panier
 * @returns {number} Nombre d'articles
 */
export function getCartItemCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Calcule le montant total du panier
 * @returns {number} Montant total
 */
export function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => {
    return total + (parseFloat(item.prix) * item.quantity);
  }, 0);
}