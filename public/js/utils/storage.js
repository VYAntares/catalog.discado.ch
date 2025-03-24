import { AppConfig } from './config.js';

const KEYS = AppConfig.STORAGE_KEYS;

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

export function hasStorageItem(key, useSession = false) {
  const storage = useSession ? sessionStorage : localStorage;
  return storage.getItem(key) !== null;
}

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

export function getCart() {
  return getFromStorage(KEYS.CART, []);
}

export function saveCart(cart) {
  return saveToStorage(KEYS.CART, cart);
}

export function addToCart(product, quantity) {
  const cart = getCart();
  
  const existingItemIndex = cart.findIndex(item => 
    item.Nom === product.Nom && item.categorie === product.categorie
  );
  
  if (existingItemIndex !== -1) {
    cart[existingItemIndex].quantity += quantity;
    
    if (cart[existingItemIndex].quantity > AppConfig.MAX_CART_QUANTITY) {
      cart[existingItemIndex].quantity = AppConfig.MAX_CART_QUANTITY;
    }
  } else {
    cart.push({
      ...product,
      quantity: Math.min(quantity, AppConfig.MAX_CART_QUANTITY)
    });
  }
  
  saveCart(cart);
  
  return cart;
}

export function removeFromCart(index) {
  const cart = getCart();
  
  if (index >= 0 && index < cart.length) {
    cart.splice(index, 1);
    saveCart(cart);
  }
  
  return cart;
}

export function clearCart() {
  return removeFromStorage(KEYS.CART);
}

export function getCartItemCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => {
    return total + (parseFloat(item.prix) * item.quantity);
  }, 0);
}