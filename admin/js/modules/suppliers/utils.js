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
   * Formate un montant en USD
   */
  export function formatAmount(amount) {
	return `${(amount || 0).toFixed(2)} USD`;
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