// orderService.js
// services/orderService.js
// Service de gestion des commandes et articles
const fs = require('fs');
const path = require('path');
const dbModule = require('./db');
const userService = require('./userService');

// Gestionnaire du compteur de commandes
const orderCounter = {
  counterFilePath: path.join(__dirname, '../data/orderCounter.json'),
  
  // Chargement du compteur depuis le fichier
  loadCounter() {
    try {
      if (fs.existsSync(this.counterFilePath)) {
        const data = fs.readFileSync(this.counterFilePath, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.counter || 1;
      }
    } catch (error) {
      // Silencieux en cas d'erreur
    }
    return 1; // Valeur par défaut
  },
  
  // Sauvegarde du compteur dans le fichier
  saveCounter(counter) {
    try {
      const dir = path.dirname(this.counterFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.counterFilePath, JSON.stringify({ counter }, null, 2), 'utf8');
    } catch (error) {
      // Silencieux en cas d'erreur
    }
  },
  
  // Génération d'ID de commande au format YYMMDD-XXXX
  generateOrderId(date = new Date()) {
    let counter = this.loadCounter();
    
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const datePrefix = `${year}${month}${day}`;
    const counterStr = counter.toString().padStart(4, '0');
    
    counter++;
    if (counter > 9999) counter = 1;
    
    this.saveCounter(counter);
    return `${datePrefix}-${counterStr}`;
  },
  
  // Réinitialisation du compteur
  resetCounter(value = 1) {
    this.saveCounter(value);
    return value;
  }
};

// Service de gestion des commandes
const orderService = {
    // Réinitialisation manuelle du compteur
    resetOrderCounter(value = 1) {
        return orderCounter.resetCounter(value);
    },
    
    // Sauvegarde d'une nouvelle commande ou ajout à une commande existante
    saveOrder(userId, cartItems, reference = '') {
        try {
            const pendingOrder = this.getUserPendingOrder(userId);
            
            if (pendingOrder) {
                return this.appendToExistingOrder(pendingOrder.order_id, userId, cartItems, reference);
            } else {
                return this.createNewOrder(userId, cartItems, reference);
            }
        } catch (error) {
            throw error;
        }
    },
    
    // Récupération d'une commande en attente pour un utilisateur
    getUserPendingOrder(userId) {
        try {
            const pendingOrderQuery = dbModule.db.prepare(`
                SELECT * FROM orders 
                WHERE user_id = ? AND status = 'pending' 
                ORDER BY date DESC LIMIT 1
            `);
            
            return pendingOrderQuery.get(userId);
        } catch (error) {
            return null;
        }
    },
    
    // Création d'une nouvelle commande
    createNewOrder(userId, cartItems, reference = '') {
        return dbModule.transaction(() => {
            const orderId = orderCounter.generateOrderId();
            const date = new Date().toISOString();
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            
            dbModule.createOrder.run(orderId, userId, 'pending', date, reference);
            
            cartItems.forEach(item => {
                const pendingItem = pendingDeliveries.find(
                    pending => pending.product_name === item.Nom && 
                            pending.category === item.categorie
                );
                
                if (pendingItem) {
                    if (pendingItem.quantity <= item.quantity) {
                        dbModule.removePendingDelivery.run(pendingItem.id);
                        
                        dbModule.addOrderItem.run(
                            orderId,
                            item.Nom,
                            parseFloat(item.prix),
                            item.quantity,
                            item.categorie,
                            'pending'
                        );
                    } else {
                        const newPendingQuantity = pendingItem.quantity - item.quantity;
                        dbModule.updatePendingDeliveryQuantity.run(
                            newPendingQuantity,
                            pendingItem.id
                        );
                        
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
    
    // Ajout d'articles à une commande existante
    appendToExistingOrder(orderId, userId, cartItems, reference = '') {
        return dbModule.transaction(() => {
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            const existingItems = dbModule.getOrderItems.all(orderId);
            
            cartItems.forEach(item => {
                const pendingItem = pendingDeliveries.find(
                    pending => pending.product_name === item.Nom && 
                            pending.category === item.categorie
                );
                
                if (pendingItem) {
                    if (pendingItem.quantity <= item.quantity) {
                        dbModule.removePendingDelivery.run(pendingItem.id);
                    } else {
                        const newPendingQuantity = pendingItem.quantity - item.quantity;
                        dbModule.updatePendingDeliveryQuantity.run(
                            newPendingQuantity,
                            pendingItem.id
                        );
                    }
                }
                
                const existingItem = existingItems.find(
                    existing => existing.product_name === item.Nom && 
                                existing.category === item.categorie
                );
                
                if (existingItem) {
                    const newQuantity = existingItem.quantity + item.quantity;
                    
                    dbModule.updateOrderItemQuantity.run(
                        newQuantity,
                        orderId,
                        item.Nom,
                        item.categorie
                    );
                } else {
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
            
            if (reference) {
                dbModule.updateOrderDateAndReference.run(new Date().toISOString(), reference, orderId);
            } else {
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
    
    // Récupération de toutes les commandes d'un utilisateur
    getUserOrders(userId) {
        try {
            const orders = dbModule.getUserOrders.all(userId);
            const enrichedOrders = [];
            
            for (const order of orders) {
                const items = dbModule.getOrderItems.all(order.order_id);
                
                // Formater et regrouper les articles
                const formattedItems = this._formatItems(items);
                const groupedItems = this._groupItemsByCategory(formattedItems);
                
                // Récupérer les articles livrés
                const deliveredItems = items
                    .filter(item => item.status === 'delivered')
                    .map(item => this._formatSingleItem(item));
                
                const groupedDeliveredItems = this._groupItemsByCategory(deliveredItems);
                
                // Récupérer les articles restants
                const remainingItems = items
                    .filter(item => item.status === 'remaining')
                    .map(item => this._formatSingleItem(item));
                
                const groupedRemainingItems = this._groupItemsByCategory(remainingItems);
                
                // Créer l'objet commande
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
                
                if (deliveredItems.length > 0) {
                    orderObj.deliveredItems = deliveredItems;
                    orderObj.groupedDeliveredItems = groupedDeliveredItems;
                }
                
                if (remainingItems.length > 0) {
                    orderObj.remainingItems = remainingItems;
                    orderObj.groupedRemainingItems = groupedRemainingItems;
                }
                
                orderObj.userProfile = userService.getUserProfile(userId);
                
                enrichedOrders.push(orderObj);
            }
            
            // Vérifier les livraisons en attente
            this._addPendingDeliveriesToOrders(userId, enrichedOrders);
            
            return enrichedOrders;
        } catch (error) {
            return [];
        }
    },
    
    // Formatage d'un seul article
    _formatSingleItem(item) {
        return {
            Nom: item.product_name,
            prix: item.product_price.toString(),
            quantity: item.quantity,
            categorie: item.category
        };
    },
    
    // Formatage d'une liste d'articles
    _formatItems(items) {
        return items.map(item => this._formatSingleItem(item));
    },
    
    // Regroupement des articles par catégorie
    _groupItemsByCategory(items) {
        const groupedItems = {};
        items.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedItems[category]) {
                groupedItems[category] = [];
            }
            groupedItems[category].push(item);
        });
        return groupedItems;
    },
    
    // Ajout des livraisons en attente à la liste des commandes
    _addPendingDeliveriesToOrders(userId, enrichedOrders) {
        const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
        
        if (pendingDeliveries.length > 0) {
            const pendingItems = pendingDeliveries.map(item => this._formatSingleItem(item));
            const groupedItems = this._groupItemsByCategory(pendingItems);
            
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
    },
    
    // Récupération des commandes en attente (pour admin)
    getPendingOrders() {
        try {
            const pendingOrders = dbModule.getPendingOrders.all();
            const enrichedOrders = [];
            
            for (const order of pendingOrders) {
                const items = dbModule.getOrderItems.all(order.order_id);
                const formattedItems = this._formatItems(items);
                
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    items: formattedItems,
                    reference: order.reference,
                    userProfile: userService.getUserProfile(order.user_id)
                };
                
                enrichedOrders.push(orderObj);
            }
            
            return enrichedOrders;
        } catch (error) {
            return [];
        }
    },
    
    // Récupération des commandes traitées (pour admin)
    getTreatedOrders() {
        try {
            const treatedOrders = dbModule.getTreatedOrders.all();
            const enrichedOrders = [];
            
            for (const order of treatedOrders) {
                // Articles livrés
                const deliveredItems = dbModule.getOrderItemsByStatus.all(order.order_id, 'delivered');
                const formattedDeliveredItems = this._formatItems(deliveredItems);
                
                // Articles restants
                const remainingItems = dbModule.getOrderItemsByStatus.all(order.order_id, 'remaining');
                const formattedRemainingItems = this._formatItems(remainingItems);
                
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    lastProcessed: order.last_processed,
                    deliveredItems: formattedDeliveredItems,
                    reference: order.reference,
                    userProfile: userService.getUserProfile(order.user_id)
                };
                
                if (formattedRemainingItems.length > 0) {
                    orderObj.remainingItems = formattedRemainingItems;
                }
                
                enrichedOrders.push(orderObj);
            }
            
            return enrichedOrders;
        } catch (error) {
            return [];
        }
    },
    
    // Récupération des détails d'une commande
    getOrderDetails(orderId, userId) {
        try {
            const order = dbModule.getOrderById.get(orderId);
            
            if (!order) {
                throw new Error('Order not found');
            }
            
            const items = dbModule.getOrderItems.all(orderId);
            
            // Articles livrés
            const deliveredItems = items
                .filter(item => item.status === 'delivered')
                .map(item => this._formatSingleItem(item));
            
            const groupedDeliveredItems = this._groupItemsByCategory(deliveredItems);
            
            // Articles restants
            const remainingItems = items
                .filter(item => item.status === 'remaining')
                .map(item => this._formatSingleItem(item));
            
            const groupedRemainingItems = this._groupItemsByCategory(remainingItems);
            
            // Tous les articles
            const allItems = this._formatItems(items);
            const groupedItems = this._groupItemsByCategory(allItems);
            
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
            throw error;
        }
    },
    
	// Traitement d'une commande (livraison partielle ou complète)
	processOrder(orderId, userId, deliveredItems) {
		try {
			const date = new Date().toISOString();
			
			return dbModule.transaction(() => {
				const order = dbModule.getOrderById.get(orderId);
				
				if (!order) {
					throw new Error('Order not found');
				}
				
				const allItems = dbModule.getOrderItems.all(orderId);
				const remainingItems = [];
				const existingPendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
				
				allItems.forEach(item => {
					const deliveredItem = deliveredItems.find(d => d.Nom === item.product_name);
					
					if (deliveredItem && deliveredItem.quantity > 0) {
						if (deliveredItem.quantity >= item.quantity) {
							// Livraison complète
							dbModule.updateOrderItemQuantity.run(
								deliveredItem.quantity,
								orderId,
								item.product_name,
								item.category
							);
							
							dbModule.updateOrderItemStatus.run('delivered', orderId, item.product_name);
						} else {
							// Livraison partielle
							const remainingQuantity = item.quantity - deliveredItem.quantity;
							
							dbModule.updateOrderItemQuantity.run(
								deliveredItem.quantity,
								orderId,
								item.product_name,
								item.category
							);
							
							dbModule.updateOrderItemStatus.run('delivered', orderId, item.product_name);
							
							dbModule.addOrderItem.run(
								orderId,
								item.product_name,
								item.product_price,
								remainingQuantity,
								item.category,
								'remaining'
							);
							
							remainingItems.push({
								Nom: item.product_name,
								prix: item.product_price.toString(),
								quantity: remainingQuantity,
								categorie: item.category
							});
							
							this._updatePendingDeliveryItem(
								userId, 
								item.product_name, 
								item.category, 
								remainingQuantity, 
								item.product_price, 
								existingPendingDeliveries
							);
						}
					} else {
						// Aucune livraison
						dbModule.updateOrderItemStatus.run('remaining', orderId, item.product_name);
						
						remainingItems.push({
							Nom: item.product_name,
							prix: item.product_price.toString(),
							quantity: item.quantity,
							categorie: item.category
						});
						
						this._updatePendingDeliveryItem(
							userId, 
							item.product_name, 
							item.category, 
							item.quantity, 
							item.product_price, 
							existingPendingDeliveries
						);
					}
				});
				
				const newStatus = remainingItems.length > 0 ? 'partial' : 'completed';
				dbModule.updateOrderStatus.run(newStatus, date, orderId);
				
				// ============================================
				// 🆕 CRÉATION AUTOMATIQUE DE LA FACTURE
				// ============================================
				this._createInvoiceForOrder(orderId, userId, deliveredItems, date);
				
				return {
					success: true,
					status: newStatus
				};
			});
		} catch (error) {
			throw error;
		}
	},

	// ============================================
	// 🆕 NOUVELLE FONCTION : Création de facture
	// ============================================
	_createInvoiceForOrder(orderId, userId, deliveredItems, processDate) {
		try {
			// Récupérer le profil utilisateur
			const userProfile = userService.getUserProfile(userId);
			const clientFullName = userProfile 
				? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userId
				: userId;
			
			// Récupérer la date de commande
			const order = dbModule.getOrderById.get(orderId);
			const invoiceDate = order.date;
			
			// Calculer le subtotal HT
			const subtotalHT = deliveredItems.reduce((sum, item) => {
				return sum + (parseFloat(item.prix) * item.quantity);
			}, 0);
			
			// Arrondir à 2 décimales
			const subtotalHTRounded = Math.round(subtotalHT * 100) / 100;
			
			// Calculer la TVA (8.1%) et arrondir
			const vatAmount = Math.round(subtotalHTRounded * 0.081 * 100) / 100;
			
			// Calculer le total TTC et arrondir
			const totalTTC = Math.round((subtotalHTRounded + vatAmount) * 100) / 100;
			
			// Calculer la due_date (invoice_date + 1 mois)
			const invoiceDateObj = new Date(invoiceDate);
			const dueDate = new Date(invoiceDateObj);
			dueDate.setMonth(dueDate.getMonth() + 1);
			
			// Générer le numéro de facture
			const invoiceNumber = this._generateInvoiceNumber();
			
			// Insérer la facture
			const insertInvoice = dbModule.db.prepare(`
				INSERT INTO invoices (
					invoice_number,
					order_id,
					user_id,
					client_full_name,
					invoice_date,
					subtotal_ht,
					vat_amount,
					total_ttc,
					payment_status,
					amount_paid,
					amount_due,
					due_date,
					paid_date
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);
			
			insertInvoice.run(
				invoiceNumber,           // invoice_number
				orderId,                 // order_id
				userId,                  // user_id
				clientFullName,          // client_full_name
				invoiceDate,             // invoice_date
				subtotalHTRounded,       // subtotal_ht
				vatAmount,               // vat_amount
				totalTTC,                // total_ttc
				'unpaid',                // payment_status
				0,                       // amount_paid
				totalTTC,                // amount_due
				dueDate.toISOString(),   // due_date
				null                     // paid_date
			);
			
			console.log(`✅ Facture ${invoiceNumber} créée pour commande ${orderId}`);
			
		} catch (error) {
			console.error(`❌ Erreur création facture pour ${orderId}:`, error);
			// Ne pas faire échouer toute la transaction si la facture échoue
		}
	},

	// ============================================
	// 🆕 FONCTION : Génération du numéro de facture
	// ============================================
	_generateInvoiceNumber() {
		try {
			// Récupérer le dernier numéro de facture
			const lastInvoice = dbModule.db.prepare(`
				SELECT invoice_number FROM invoices 
				ORDER BY id DESC LIMIT 1
			`).get();
			
			if (lastInvoice && lastInvoice.invoice_number) {
				// Extraire le numéro (ex: "INV-123" -> 123)
				const lastNumber = parseInt(lastInvoice.invoice_number.split('-')[1]);
				const nextNumber = lastNumber + 1;
				return `INV-${nextNumber}`;
			} else {
				// Première facture
				return 'INV-1';
			}
		} catch (error) {
			console.error('Erreur génération numéro facture:', error);
			return `INV-${Date.now()}`; // Fallback
		}
	},
    
    // Mise à jour des articles en attente de livraison
    _updatePendingDeliveryItem(userId, productName, category, quantity, price, existingPendingDeliveries) {
        const existingItem = existingPendingDeliveries.find(
            p => p.product_name === productName && p.category === category
        );
        
        if (existingItem) {
            const updatedQuantity = existingItem.quantity + quantity;
            dbModule.updatePendingDeliveryQuantity.run(
                updatedQuantity,
                existingItem.id
            );
        } else {
            dbModule.addPendingDelivery.run(
                userId,
                productName,
                price,
                quantity,
                category
            );
        }
    },

    // Suppression d'articles en attente de livraison
    deletePendingItems(userId, items) {
        try {
            return dbModule.transaction(() => {
                let totalDeleted = 0;
                
                items.forEach(item => {
                    const pendingItem = dbModule.findPendingDeliveryItem.get(
                        userId,
                        item.Nom,
                        item.categorie
                    );
                    
                    if (pendingItem) {
                        if (pendingItem.quantity === item.quantity) {
                            dbModule.removePendingDelivery.run(pendingItem.id);
                            totalDeleted++;
                        } else if (pendingItem.quantity > item.quantity) {
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
            throw error;
        }
    },

    // Création d'une commande à partir d'articles en attente de livraison
    createOrderFromPendingItems(userId, items) {
        try {
            return dbModule.transaction(() => {
                const pendingOrder = this.getUserPendingOrder(userId);
                
                if (pendingOrder) {
                    return this.appendToExistingOrder(pendingOrder.order_id, userId, items);
                } else {
                    const orderId = orderCounter.generateOrderId();
                    const date = new Date().toISOString();
                    
                    dbModule.createOrder.run(orderId, userId, 'pending', date, '');
                    
                    items.forEach(item => {
                        dbModule.addOrderItem.run(
                            orderId,
                            item.Nom,
                            parseFloat(item.prix),
                            item.quantity,
                            item.categorie,
                            'pending'
                        );
                        
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
            throw error;
        }
    }
};

module.exports = orderService;