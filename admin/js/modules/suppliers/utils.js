/**
 * Fonctions utilitaires pour le module Fournisseurs
 * admin/js/modules/suppliers/utils.js
 */

/**
 * Formate une date au format français (JJ/MM/AAAA)
 */
export function formatDate(dateString) {
	const date = new Date(dateString);
	return date.toLocaleDateString('fr-CH', {
	  day: '2-digit',
	  month: '2-digit',
	  year: 'numeric'
	});
  }
  
  /**
   * Formate un nombre au format suisse (apostrophe pour milliers, point pour décimales)
   */
  export function formatSwissNumber(number, decimals = 2) {
	if (number === null || number === undefined) return '0.00';
	const num = typeof number === 'string' ? parseFloat(number) : number;
	if (isNaN(num)) return '0.00';
	const fixed = num.toFixed(decimals);
	const parts = fixed.split('.');
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
	return parts.join('.');
  }

  /**
   * Formate un montant en USD
   */
  export function formatAmount(amount) {
	return `${formatSwissNumber(amount || 0)} USD`;
  }
  
  /**
   * Calcule le montant restant à payer
   */
  export function calculateRemaining(totalAmount, amountPaid) {
	return (totalAmount || 0) - (amountPaid || 0);
  }
  
  /**
   * Génère une classe CSS pour le statut
   */
  export function getStatusClass(status) {
	return status.toLowerCase().replace(/\s+/g, '-');
  }
  
  /**
   * Calcule le total d'un item (quantité × prix unitaire)
   */
  export function calculateItemTotal(quantity, unitPrice) {
	return (quantity || 0) * (unitPrice || 0);
  }
  
  /**
   * Vérifie si une chaîne est vide ou null
   */
  export function isEmpty(value) {
	return !value || value.trim() === '';
  }
  
  /**
   * Génère un ID unique pour les items du modal
   */
  let itemIdCounter = 0;
  export function generateItemId() {
	return ++itemIdCounter;
  }
  
  /**
   * Réinitialise le compteur d'ID
   */
  export function resetItemIdCounter() {
	itemIdCounter = 0;
  }