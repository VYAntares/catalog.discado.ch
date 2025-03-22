// orderService.js - Handle order operations
const fs = require('fs');
const path = require('path');
const dbModule = require('./db');
const userService = require('./userService');

// Objet pour gérer le compteur de commandes
const orderCounter = {
  counterFilePath: path.join(__dirname, '../data/orderCounter.json'),
  
  loadCounter() {
    try {
      if (fs.existsSync(this.counterFilePath)) {
        const data = fs.readFileSync(this.counterFilePath, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.counter || 1;
      }
    } catch (error) {
      console.error('Erreur lors du chargement du compteur:', error);
    }
    return 1; // Valeur par défaut
  },
  
  saveCounter(counter) {
    try {
      const dir = path.dirname(this.counterFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.counterFilePath, JSON.stringify({ counter }, null, 2), 'utf8');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du compteur:', error);
    }
  },
  
  generateOrderId(date = new Date()) {
    // Charger le compteur actuel
    let counter = this.loadCounter();
    
    // Format de date YYMMDD
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const datePrefix = `${year}${month}${day}`;
    
    // Formater le compteur sur 4 chiffres
    const counterStr = counter.toString().padStart(4, '0');
    
    // Incrémenter le compteur pour la prochaine utilisation
    counter++;
    
    // Réinitialiser le compteur s'il dépasse 9999
    if (counter > 9999) {
      counter = 1;
    }
    
    // Sauvegarder le nouveau compteur
    this.saveCounter(counter);
    
    // Retourner l'ID formaté
    return `${datePrefix}-${counterStr}`;
  },
  
  resetCounter(value = 1) {
    this.saveCounter(value);
    return value;
  }
};

// Service for managing orders
const orderService = {
    // Réinitialiser le compteur manuellement
    resetOrderCounter(value = 1) {
        return orderCounter.resetCounter(value);
    },
    
    // Save a new order
    saveOrder(userId, cartItems, reference = '') {
        try {
            // Check if the user has a pending order
            const pendingOrder = this.getUserPendingOrder(userId);
            
            if (pendingOrder) {
                // User has a pending order, add items to it
                return this.appendToExistingOrder(pendingOrder.order_id, userId, cartItems, reference);
            } else {
                // No pending order, create a new one
                return this.createNewOrder(userId, cartItems, reference);
            }
        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    },
    
    // Get user's pending order (if any)
    getUserPendingOrder(userId) {
        try {
            // Find the most recent pending order for this user
            const pendingOrderQuery = dbModule.db.prepare(`
                SELECT * FROM orders 
                WHERE user_id = ? AND status = 'pending' 
                ORDER BY date DESC LIMIT 1
            `);
            
            return pendingOrderQuery.get(userId);
        } catch (error) {
            console.error('Error getting pending order:', error);
            return null;
        }
    },
    
    // Create a new order
    createNewOrder(userId, cartItems, reference = '') {
        return dbModule.transaction(() => {
            // Utiliser notre générateur d'ID
            const orderId = orderCounter.generateOrderId();
            const date = new Date().toISOString();
            
            // Récupérer les articles en attente de livraison pour ce client
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            
            // Créer l'enregistrement de commande avec référence
            dbModule.createOrder.run(orderId, userId, 'pending', date, reference);
            
            // Traiter chaque article du panier
            cartItems.forEach(item => {
                // Existing cart item processing...
                // [Code kept the same as in the original file]
                
                // Vérifier si l'article existe dans la liste "à livrer"
                const pendingItem = pendingDeliveries.find(
                    pending => pending.product_name === item.Nom && 
                            pending.category === item.categorie
                );
                
                if (pendingItem) {
                    // L'article existe dans "à livrer", gérer la déduction
                    if (pendingItem.quantity <= item.quantity) {
                        // La quantité commandée est supérieure ou égale à celle "à livrer"
                        // Supprimer complètement l'article de "à livrer"
                        dbModule.removePendingDelivery.run(pendingItem.id);
                        
                        // Ajouter à la commande normalement
                        dbModule.addOrderItem.run(
                            orderId,
                            item.Nom,
                            parseFloat(item.prix),
                            item.quantity,
                            item.categorie,
                            'pending'
                        );
                    } else {
                        // La quantité commandée est inférieure à celle "à livrer"
                        // Réduire la quantité dans "à livrer"
                        const newPendingQuantity = pendingItem.quantity - item.quantity;
                        dbModule.updatePendingDeliveryQuantity.run(
                            newPendingQuantity,
                            pendingItem.id
                        );
                        
                        // Ajouter à la commande normalement
                        dbModule.addOrderItem.run(
                            orderId,
                            item.Nom,
                            parseFloat(item.prix),
                            item.quantity,
                            item.categorie,
                            'pending'
                        );
                    }
                } else {
                    // L'article n'existe pas dans "à livrer", l'ajouter normalement
                    dbModule.addOrderItem.run(
                        orderId,
                        item.Nom,
                        parseFloat(item.prix),
                        item.quantity,
                        item.categorie,
                        'pending'
                    );
                }
            });
            
            return { success: true, orderId, message: 'New order created successfully' };
        });
    },
    
    // Add items to an existing order
    appendToExistingOrder(orderId, userId, cartItems, reference = '') {
        return dbModule.transaction(() => {
            // Récupérer les articles en attente de livraison pour ce client
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            
            // Get existing items in the order
            const existingItems = dbModule.getOrderItems.all(orderId);
            
            // Process each new item
            cartItems.forEach(item => {
                // Vérifier si l'article existe dans la liste "à livrer"
                const pendingItem = pendingDeliveries.find(
                    pending => pending.product_name === item.Nom && 
                            pending.category === item.categorie
                );
                
                if (pendingItem) {
                    // L'article existe dans "à livrer", gérer la déduction
                    if (pendingItem.quantity <= item.quantity) {
                        // La quantité commandée est supérieure ou égale à celle "à livrer"
                        // Supprimer complètement l'article de "à livrer"
                        dbModule.removePendingDelivery.run(pendingItem.id);
                    } else {
                        // La quantité commandée est inférieure à celle "à livrer"
                        // Réduire la quantité dans "à livrer"
                        const newPendingQuantity = pendingItem.quantity - item.quantity;
                        dbModule.updatePendingDeliveryQuantity.run(
                            newPendingQuantity,
                            pendingItem.id
                        );
                    }
                }
                
                // Vérifier si l'article existe déjà dans la commande
                const existingItem = existingItems.find(
                    existing => existing.product_name === item.Nom && 
                                existing.category === item.categorie
                );
                
                if (existingItem) {
                    // Item exists, update the quantity
                    const newQuantity = existingItem.quantity + item.quantity;
                    
                    // Update the item quantity
                    dbModule.updateOrderItemQuantity.run(
                        newQuantity,
                        orderId,
                        item.Nom,
                        item.categorie
                    );
                } else {
                    // New item, add it to the order
                    dbModule.addOrderItem.run(
                        orderId,
                        item.Nom,
                        parseFloat(item.prix),
                        item.quantity,
                        item.categorie,
                        'pending'
                    );
                }
            });
            
            // Update the order date and reference if provided
            if (reference) {
                // Si une référence est fournie, mettre à jour la date et la référence
                dbModule.updateOrderDateAndReference.run(new Date().toISOString(), reference, orderId);
            } else {
                // Sinon, mettre à jour uniquement la date
                dbModule.updateOrderDate.run(new Date().toISOString(), orderId);
            }
            
            return { 
                success: true, 
                orderId, 
                merged: true,
                message: 'Items added to your existing pending order' 
            };
        });
    },
    
    // Get all orders for a user
    getUserOrders(userId) {
        try {
            const orders = dbModule.getUserOrders.all(userId);
            const enrichedOrders = [];
            
            for (const order of orders) {
                // Get order items
                const items = dbModule.getOrderItems.all(order.order_id);
                
                // Format items to match expected structure
                const formattedItems = items.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Group items by category
                const groupedItems = {};
                formattedItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedItems[category]) {
                        groupedItems[category] = [];
                    }
                    groupedItems[category].push(item);
                });
                
                // Get delivered items
                const deliveredItems = items
                    .filter(item => item.status === 'delivered')
                    .map(item => ({
                        Nom: item.product_name,
                        prix: item.product_price.toString(),
                        quantity: item.quantity,
                        categorie: item.category
                    }));
                
                // Group delivered items by category
                const groupedDeliveredItems = {};
                deliveredItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedDeliveredItems[category]) {
                        groupedDeliveredItems[category] = [];
                    }
                    groupedDeliveredItems[category].push(item);
                });
                
                // Get remaining items
                const remainingItems = items
                    .filter(item => item.status === 'remaining')
                    .map(item => ({
                        Nom: item.product_name,
                        prix: item.product_price.toString(),
                        quantity: item.quantity,
                        categorie: item.category
                    }));
                
                // Group remaining items by category
                const groupedRemainingItems = {};
                remainingItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedRemainingItems[category]) {
                        groupedRemainingItems[category] = [];
                    }
                    groupedRemainingItems[category].push(item);
                });
                
                // Build order object
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    items: formattedItems,
                    groupedItems: groupedItems,
                    lastProcessed: order.last_processed,
                    reference: order.reference
                };
                
                // Add delivered and remaining items if they exist
                if (deliveredItems.length > 0) {
                    orderObj.deliveredItems = deliveredItems;
                    orderObj.groupedDeliveredItems = groupedDeliveredItems;
                }
                
                if (remainingItems.length > 0) {
                    orderObj.remainingItems = remainingItems;
                    orderObj.groupedRemainingItems = groupedRemainingItems;
                }
                
                // Get user profile
                orderObj.userProfile = userService.getUserProfile(userId);
                
                enrichedOrders.push(orderObj);
            }
            
            // Check for pending deliveries
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            
            if (pendingDeliveries.length > 0) {
                // Format pending deliveries
                const pendingItems = pendingDeliveries.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Group by category
                const groupedItems = {};
                pendingItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedItems[category]) {
                        groupedItems[category] = [];
                    }
                    groupedItems[category].push(item);
                });
                
                // Add pending delivery "order"
                enrichedOrders.unshift({
                    orderId: 'pending-delivery',
                    userId: userId,
                    status: 'pending-delivery',
                    date: new Date().toISOString(),
                    items: pendingItems,
                    isToDeliverItems: true,
                    groupedItems: groupedItems
                });
            }
            
            return enrichedOrders;
        } catch (error) {
            console.error('Error getting user orders:', error);
            return []; // Return empty array instead of legacy fallback
        }
    },
    
    // Get pending orders (for admin)
    getPendingOrders() {
        try {
            const pendingOrders = dbModule.getPendingOrders.all();
            const enrichedOrders = [];
            
            for (const order of pendingOrders) {
                // Get order items
                const items = dbModule.getOrderItems.all(order.order_id);
                
                // Format items to match expected structure
                const formattedItems = items.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Build order object
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    items: formattedItems,
                    reference: order.reference
                };
                
                // Get user profile
                orderObj.userProfile = userService.getUserProfile(order.user_id);
                
                enrichedOrders.push(orderObj);
            }
            
            return enrichedOrders;
        } catch (error) {
            console.error('Error getting pending orders:', error);
            return []; // Return empty array instead of legacy fallback
        }
    },
    
    // Get treated orders (for admin)
    getTreatedOrders() {
        try {
            const treatedOrders = dbModule.getTreatedOrders.all();
            const enrichedOrders = [];
            
            for (const order of treatedOrders) {
                // Get delivered items
                const deliveredItems = dbModule.getOrderItemsByStatus.all(order.order_id, 'delivered');
                
                // Format items to match expected structure
                const formattedDeliveredItems = deliveredItems.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Get remaining items
                const remainingItems = dbModule.getOrderItemsByStatus.all(order.order_id, 'remaining');
                
                // Format remaining items
                const formattedRemainingItems = remainingItems.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Build order object
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    lastProcessed: order.last_processed,
                    deliveredItems: formattedDeliveredItems,
                    reference: order.reference
                };
                
                // Add remaining items if they exist
                if (formattedRemainingItems.length > 0) {
                    orderObj.remainingItems = formattedRemainingItems;
                }
                
                // Get user profile
                orderObj.userProfile = userService.getUserProfile(order.user_id);
                
                enrichedOrders.push(orderObj);
            }
            
            return enrichedOrders;
        } catch (error) {
            console.error('Error getting treated orders:', error);
            return []; // Return empty array instead of legacy fallback
        }
    },
    
    // Get order details
    getOrderDetails(orderId, userId) {
        try {
            const order = dbModule.getOrderById.get(orderId);
            
            if (!order) {
                throw new Error('Order not found');
            }
            
            // Get all items
            const items = dbModule.getOrderItems.all(orderId);
            
            // Format items based on status
            const deliveredItems = items
                .filter(item => item.status === 'delivered')
                .map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
            
            // Group delivered items by category
            const groupedDeliveredItems = {};
            deliveredItems.forEach(item => {
                const category = item.categorie || 'autres';
                if (!groupedDeliveredItems[category]) {
                    groupedDeliveredItems[category] = [];
                }
                groupedDeliveredItems[category].push(item);
            });
            
            const remainingItems = items
                .filter(item => item.status === 'remaining')
                .map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
            
            // Group remaining items by category
            const groupedRemainingItems = {};
            remainingItems.forEach(item => {
                const category = item.categorie || 'autres';
                if (!groupedRemainingItems[category]) {
                    groupedRemainingItems[category] = [];
                }
                groupedRemainingItems[category].push(item);
            });
            
            // All items (for pending orders)
            const allItems = items.map(item => ({
                Nom: item.product_name,
                prix: item.product_price.toString(),
                quantity: item.quantity,
                categorie: item.category
            }));
            
            // Group all items by category
            const groupedItems = {};
            allItems.forEach(item => {
                const category = item.categorie || 'autres';
                if (!groupedItems[category]) {
                    groupedItems[category] = [];
                }
                groupedItems[category].push(item);
            });
            
            // Build order object
            const orderObj = {
                orderId: order.order_id,
                userId: order.user_id,
                status: order.status,
                date: order.date,
                lastProcessed: order.last_processed,
                items: allItems,
                groupedItems: groupedItems,
                userProfile: userService.getUserProfile(userId),
                reference: order.reference
            };
            
            // Add delivered and remaining items if they exist
            if (deliveredItems.length > 0) {
                orderObj.deliveredItems = deliveredItems;
                orderObj.groupedDeliveredItems = groupedDeliveredItems;
            }
            
            if (remainingItems.length > 0) {
                orderObj.remainingItems = remainingItems;
                orderObj.groupedRemainingItems = groupedRemainingItems;
            }
            
            return orderObj;
        } catch (error) {
            console.error('Error getting order details:', error);
            throw error; // Just propagate the error instead of fallback
        }
    },
    
    // Mise à jour de la fonction processOrder
    processOrder(orderId, userId, deliveredItems) {
        try {
            const date = new Date().toISOString();
            
            return dbModule.transaction(() => {
                // Get the order first
                const order = dbModule.getOrderById.get(orderId);
                
                if (!order) {
                    throw new Error('Order not found');
                }
                
                // Get all order items
                const allItems = dbModule.getOrderItems.all(orderId);
                
                // Track remaining items
                const remainingItems = [];
                
                // Récupérer les articles déjà en attente de livraison pour cet utilisateur
                const existingPendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
                
                // Process each original item
                allItems.forEach(item => {
                    // Find if the item was delivered
                    const deliveredItem = deliveredItems.find(
                        d => d.Nom === item.product_name
                    );
                    
                    if (deliveredItem && deliveredItem.quantity > 0) {
                        if (deliveredItem.quantity >= item.quantity) {
                            // Fully delivered or excess quantity - update both status and quantity
                            
                            // Modifier la quantité de l'article original pour refléter la quantité réellement livrée
                            dbModule.updateOrderItemQuantity.run(
                                deliveredItem.quantity, // Utiliser la quantité réellement livrée (même si > commandée)
                                orderId,
                                item.product_name,
                                item.category
                            );
                            
                            // Marquer l'article comme livré
                            dbModule.updateOrderItemStatus.run('delivered', orderId, item.product_name);
                        } else if (deliveredItem.quantity < item.quantity) {
                            // Partially delivered - create two entries
                            const remainingQuantity = item.quantity - deliveredItem.quantity;
                            
                            // Modifier la quantité de l'article original pour refléter ce qui a été livré
                            dbModule.updateOrderItemQuantity.run(
                                deliveredItem.quantity,
                                orderId,
                                item.product_name,
                                item.category
                            );
                            
                            // Marquer l'article comme livré
                            dbModule.updateOrderItemStatus.run('delivered', orderId, item.product_name);
                            
                            // Créer un nouvel article avec la quantité restante
                            dbModule.addOrderItem.run(
                                orderId,
                                item.product_name,
                                item.product_price,
                                remainingQuantity,
                                item.category,
                                'remaining'
                            );
                            
                            // Add to remaining items
                            remainingItems.push({
                                Nom: item.product_name,
                                prix: item.product_price.toString(),
                                quantity: remainingQuantity,
                                categorie: item.category
                            });
                            
                            // Gérer les articles en attente de livraison
                            // Rechercher si l'article existe déjà dans les articles en attente
                            const existingPendingItem = existingPendingDeliveries.find(
                                p => p.product_name === item.product_name && p.category === item.category
                            );
                            
                            if (existingPendingItem) {
                                // L'article est déjà en attente, mettre à jour la quantité
                                // Nous additionnons la quantité restante à la quantité existante
                                const updatedQuantity = existingPendingItem.quantity + remainingQuantity;
                                dbModule.updatePendingDeliveryQuantity.run(
                                    updatedQuantity,
                                    existingPendingItem.id
                                );
                            } else {
                                // L'article n'existe pas encore, l'ajouter
                                dbModule.addPendingDelivery.run(
                                    userId,
                                    item.product_name,
                                    item.product_price,
                                    remainingQuantity,
                                    item.category
                                );
                            }
                        }
                    } else {
                        // Not delivered at all, mark as remaining
                        dbModule.updateOrderItemStatus.run('remaining', orderId, item.product_name);
                        
                        // Add to remaining items
                        remainingItems.push({
                            Nom: item.product_name,
                            prix: item.product_price.toString(),
                            quantity: item.quantity,
                            categorie: item.category
                        });
                        
                        // Gérer les articles en attente de livraison
                        // Rechercher si l'article existe déjà dans les articles en attente
                        const existingPendingItem = existingPendingDeliveries.find(
                            p => p.product_name === item.product_name && p.category === item.category
                        );
                        
                        if (existingPendingItem) {
                            // L'article est déjà en attente, mettre à jour la quantité
                            // Nous additionnons la quantité non livrée à la quantité existante
                            const updatedQuantity = existingPendingItem.quantity + item.quantity;
                            dbModule.updatePendingDeliveryQuantity.run(
                                updatedQuantity,
                                existingPendingItem.id
                            );
                        } else {
                            // L'article n'existe pas encore, l'ajouter
                            dbModule.addPendingDelivery.run(
                                userId,
                                item.product_name,
                                item.product_price,
                                item.quantity,
                                item.category
                            );
                        }
                    }
                });
                
                // Déterminer le statut de la commande
                const newStatus = remainingItems.length > 0 ? 'partial' : 'completed';
                
                dbModule.updateOrderStatus.run(newStatus, date, orderId);
                
                return {
                    success: true,
                    status: newStatus
                };
            });
        } catch (error) {
            console.error('Error processing order:', error);
            throw error;
        }
    },

    /**
 * Supprime les articles en attente de livraison
 * @param {string} userId - ID de l'utilisateur
 * @param {Array} items - Articles à supprimer
 * @returns {Object} Résultat de l'opération
 */
    deletePendingItems(userId, items) {
        try {
            return dbModule.transaction(() => {
                let totalDeleted = 0;
                
                // Traiter chaque article à supprimer
                items.forEach(item => {
                    // Rechercher l'article dans la table pending_deliveries
                    const pendingItem = dbModule.findPendingDeliveryItem.get(
                        userId,
                        item.Nom,
                        item.categorie
                    );
                    
                    if (pendingItem) {
                        // Si la quantité à supprimer est égale à la quantité en attente,
                        // supprimer complètement l'entrée
                        if (pendingItem.quantity === item.quantity) {
                            dbModule.removePendingDelivery.run(pendingItem.id);
                            totalDeleted++;
                        } else if (pendingItem.quantity > item.quantity) {
                            // Si la quantité en attente est supérieure, réduire la quantité
                            const newQuantity = pendingItem.quantity - item.quantity;
                            dbModule.updatePendingDeliveryQuantity.run(
                                newQuantity,
                                pendingItem.id
                            );
                            totalDeleted++;
                        }
                    }
                });
                
                return {
                    success: true,
                    deleted: totalDeleted,
                    message: `${totalDeleted} article(s) supprimé(s) avec succès`
                };
            });
        } catch (error) {
            console.error('Erreur lors de la suppression des articles en attente:', error);
            throw error;
        }
    },

    createOrderFromPendingItems(userId, items) {
        try {
            return dbModule.transaction(() => {
                // Utiliser la méthode existante pour vérifier si une commande en attente existe
                const pendingOrder = this.getUserPendingOrder(userId);
                
                if (pendingOrder) {
                    // Réutiliser la fonction existante appendToExistingOrder
                    const result = this.appendToExistingOrder(pendingOrder.order_id, userId, items);
                    return result; // Cette fonction retourne déjà { success: true, orderId, merged: true, message: '...' }
                } else {
                    // Pas de commande en attente, créer une nouvelle
                    const orderId = orderCounter.generateOrderId();
                    const date = new Date().toISOString();
                    
                    // Créer l'enregistrement de commande
                    dbModule.createOrder.run(orderId, userId, 'pending', date, '');
                    
                    // Ajouter les articles à la commande
                    items.forEach(item => {
                        dbModule.addOrderItem.run(
                            orderId,
                            item.Nom,
                            parseFloat(item.prix),
                            item.quantity,
                            item.categorie,
                            'pending'
                        );
                        
                        // Trouver et supprimer cet article des livraisons en attente
                        // (Cette partie reste inchangée)
                        const pendingDeliveryItem = dbModule.findPendingDeliveryItem.get(
                            userId,
                            item.Nom,
                            item.categorie
                        );
                        
                        if (pendingDeliveryItem) {
                            if (pendingDeliveryItem.quantity === item.quantity) {
                                dbModule.removePendingDelivery.run(pendingDeliveryItem.id);
                            } else if (pendingDeliveryItem.quantity > item.quantity) {
                                const newQuantity = pendingDeliveryItem.quantity - item.quantity;
                                dbModule.updatePendingDeliveryQuantity.run(
                                    newQuantity,
                                    pendingDeliveryItem.id
                                );
                            }
                        }
                    });
                    
                    return {
                        success: true,
                        orderId,
                        message: 'Commande créée avec succès'
                    };
                }
            });
        } catch (error) {
            console.error('Error creating order from pending items:', error);
            throw error;
        }
    }
};

module.exports = orderService;