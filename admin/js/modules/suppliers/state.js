/**
 * Gestion de l'état global du module Fournisseurs
 * admin/js/modules/suppliers/state.js
 */

export const state = {
	suppliers: [],
	products: [],
	currentView: 'list', // 'list', 'supplier', 'order'
	currentSupplierId: null,
	currentOrderId: null,
	currentSupplierOrders: [],
	currentOrderData: null,
	currentOrderItems: []
  };
  
  // ===== GETTERS =====
  
  export function getSuppliers() {
	return state.suppliers;
  }
  
  export function getCurrentSupplier() {
	return state.suppliers.find(s => s.id == state.currentSupplierId);
  }
  
  export function getCurrentView() {
	return state.currentView;
  }
  
  export function getProducts() {
	return state.products;
  }
  
  export function getCurrentOrderData() {
	return state.currentOrderData;
  }
  
  export function getCurrentOrderItems() {
	return state.currentOrderItems;
  }
  
  // ===== SETTERS =====
  
  export function setSuppliers(suppliers) {
	state.suppliers = suppliers;
  }
  
  export function setProducts(products) {
	state.products = products;
  }
  
  export function setCurrentView(view) {
	state.currentView = view;
	updateViewVisibility();
  }
  
  export function setCurrentSupplierId(id) {
	state.currentSupplierId = id;
  }
  
  export function setCurrentOrderId(id) {
	state.currentOrderId = id;
  }
  
  export function setCurrentSupplierOrders(orders) {
	state.currentSupplierOrders = orders;
  }
  
  export function setCurrentOrderData(orderData) {
	state.currentOrderData = orderData;
  }
  
  export function setCurrentOrderItems(items) {
	state.currentOrderItems = items;
  }
  
  export function getCurrentSupplierId() {
	return state.currentSupplierId;
  }
  
  export function getCurrentOrderId() {
	return state.currentOrderId;
  }
  
  export function getCurrentSupplierOrders() {
	return state.currentSupplierOrders;
  }
  
  // ===== GESTION DES VUES =====
  
  function updateViewVisibility() {
	// Cacher toutes les vues
	document.querySelectorAll('.view').forEach(view => {
	  view.classList.remove('active');
	});
  
	// Afficher la vue demandée
	switch(state.currentView) {
	  case 'list':
		document.getElementById('suppliersListView')?.classList.add('active');
		break;
	  case 'supplier':
		document.getElementById('supplierDetailsView')?.classList.add('active');
		break;
	  case 'order':
		document.getElementById('orderDetailsView')?.classList.add('active');
		break;
	}
  }

let currentOrder = null;

export function setCurrentOrder(order) {
  currentOrder = order;
  currentOrderId = order ? order.id : null;
}

export function getCurrentOrder() {
  return currentOrder;
}
