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
		console.log('🔍 ===== DÉBUT PROCESSORDER =====');
		console.log(`Commande: ${orderId}, User: ${userId}`);
		console.log('Articles livrés:', JSON.stringify(deliveredItems, null, 2));
		
		try {
			const date = new Date().toISOString();
			
			return dbModule.transaction(() => {
				const order = dbModule.getOrderById.get(orderId);
				
				if (!order) {
					throw new Error('Order not found');
				}
				
				console.log('📦 Commande trouvée:', order);
				
				const allItems = dbModule.getOrderItems.all(orderId);
				const remainingItems = [];
				const existingPendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
				
				console.log(`📋 ${allItems.length} articles dans la commande`);
				
				allItems.forEach(item => {
					const deliveredItem = deliveredItems.find(d => d.Nom === item.product_name);
					
					if (deliveredItem && deliveredItem.quantity > 0) {
						// 🆕 Décrémenter le stock
						this._decrementStock(item.product_name, deliveredItem.quantity);
						
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
						// 🆕 Article non livré → stock à 0
						this._setStockToZero(item.product_name);
						
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
				
				console.log(`✅ Commande ${orderId} mise à jour avec statut: ${newStatus}`);
				
				// ============================================
				// 🆕 CRÉATION AUTOMATIQUE DE LA FACTURE
				// ============================================
				console.log('📄 Tentative de création de facture...');
				try {
					const invoiceId = this._createInvoiceForOrder(orderId, userId, deliveredItems, date);
					if (invoiceId) {
						console.log(`✅ Facture créée avec succès (ID: ${invoiceId})`);
					}
				} catch (invoiceError) {
					console.error('⚠️ Erreur création facture (commande traitée quand même):', invoiceError);
				}
				
				console.log('🔍 ===== FIN PROCESSORDER =====');
				
				return {
					success: true,
					status: newStatus
				};
			});
		} catch (error) {
			console.error('❌ ERREUR PROCESSORDER:', error);
			console.error('Stack:', error.stack);
			throw error;
		}
	},

	// ============================================
	// 🆕 FONCTION : Génération du numéro de facture (CORRIGÉE)
	// ============================================
	_generateInvoiceNumber() {
		try {
			// Récupérer la dernière facture avec ORDER BY id DESC
			const lastInvoice = dbModule.db.prepare(`
				SELECT invoice_number 
				FROM invoices 
				ORDER BY id DESC 
				LIMIT 1
			`).get();
			
			if (!lastInvoice) {
				console.log('🆕 Première facture, numéro: INV-1');
				return 'INV-1';
			}
			
			console.log(`📋 Dernière facture trouvée: ${lastInvoice.invoice_number}`);
			
			// Extraire le numéro
			let nextNumber = 1;
			
			// Format INV-X (nouveau format simplifié)
			if (lastInvoice.invoice_number.startsWith('INV-')) {
				const match = lastInvoice.invoice_number.match(/INV-(\d+)/);
				if (match) {
					nextNumber = parseInt(match[1]) + 1;
				}
			} 
			// Ancien format YYMMDD-XXXX, chercher le dernier INV-X
			else if (lastInvoice.invoice_number.match(/^\d{6}-\d{4}$/)) {
				const lastInvFormat = dbModule.db.prepare(`
					SELECT invoice_number 
					FROM invoices 
					WHERE invoice_number LIKE 'INV-%'
					ORDER BY id DESC 
					LIMIT 1
				`).get();
				
				if (lastInvFormat) {
					const match = lastInvFormat.invoice_number.match(/INV-(\d+)/);
					nextNumber = match ? parseInt(match[1]) + 1 : 1;
				}
			}
			// Format MANUAL-YYYY-XXXX
			else if (lastInvoice.invoice_number.startsWith('MANUAL-')) {
				// Chercher le dernier INV-X
				const lastInvFormat = dbModule.db.prepare(`
					SELECT invoice_number 
					FROM invoices 
					WHERE invoice_number LIKE 'INV-%'
					ORDER BY id DESC 
					LIMIT 1
				`).get();
				
				if (lastInvFormat) {
					const match = lastInvFormat.invoice_number.match(/INV-(\d+)/);
					nextNumber = match ? parseInt(match[1]) + 1 : 1;
				}
			}
			
			const newInvoiceNumber = `INV-${nextNumber}`;
			console.log(`🆕 Nouveau numéro généré: ${newInvoiceNumber}`);
			
			return newInvoiceNumber;
			
		} catch (error) {
			console.error('❌ Erreur génération numéro facture:', error);
			console.error('Stack:', error.stack);
			// En cas d'erreur, générer un numéro basé sur le timestamp
			const timestamp = Date.now().toString().slice(-6);
			return `INV-${timestamp}`;
		}
	},

	// ============================================
	// 🆕 CRÉATION DE FACTURE (VERSION FINALE CORRIGÉE)
	// ============================================
	_createInvoiceForOrder(orderId, userId, deliveredItems, processDate) {
		console.log(`🔍 Début création facture pour commande ${orderId}`);
		
		try {
			// Récupérer le profil utilisateur
			const userProfile = userService.getUserProfile(userId);
			const clientFullName = userProfile 
				? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userId
				: userId;
			
			console.log(`👤 Client: ${clientFullName}`);
			
			// Récupérer la date de commande
			const order = dbModule.getOrderById.get(orderId);
			if (!order) {
				throw new Error(`Commande ${orderId} non trouvée`);
			}
			
			const invoiceDate = order.date;
			console.log(`📅 Date facture: ${invoiceDate}`);
			
			// Calculer le subtotal HT
			const subtotalHT = deliveredItems.reduce((sum, item) => {
				const itemTotal = parseFloat(item.prix) * item.quantity;
				console.log(`   ${item.Nom}: ${item.quantity} x ${item.prix} = ${itemTotal.toFixed(2)}`);
				return sum + itemTotal;
			}, 0);
			
			// Arrondir à 2 décimales
			const subtotalHTRounded = Math.round(subtotalHT * 100) / 100;
			
			// Calculer la TVA (8.1%) et arrondir au 5 centimes le plus proche
			const vatAmountBrut = subtotalHTRounded * 0.081;
			const vatAmount = Math.round(vatAmountBrut * 20) / 20;
			
			// Calculer le total TTC
			const totalTTC = Math.round((subtotalHTRounded + vatAmount) * 100) / 100;
			
			console.log(`💰 Montants calculés:`);
			console.log(`   - Subtotal HT: ${subtotalHTRounded.toFixed(2)} CHF`);
			console.log(`   - TVA 8.1%: ${vatAmount.toFixed(2)} CHF`);
			console.log(`   - Total TTC: ${totalTTC.toFixed(2)} CHF`);
			
			// Calculer la due_date (invoice_date + 1 mois)
			const invoiceDateObj = new Date(invoiceDate);
			const dueDate = new Date(invoiceDateObj);
			dueDate.setMonth(dueDate.getMonth() + 1);
			
			console.log(`📆 Date échéance: ${dueDate.toISOString()}`);
			
			// Générer le numéro de facture
			const invoiceNumber = this._generateInvoiceNumber();
			console.log(`📄 Numéro facture généré: ${invoiceNumber}`);
			
			// 🆕 IMPORTANT : AJOUTER created_at et updated_at !
			const now = new Date().toISOString();
			
			// Préparer et exécuter l'insertion
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
					paid_date,
					created_at,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);
			
			console.log('💾 Insertion dans la base de données...');
			
			const result = insertInvoice.run(
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
				null,                    // paid_date
				now,                     // created_at ✅
				now                      // updated_at ✅
			);
			
			console.log(`✅ Facture ${invoiceNumber} créée avec succès (ID: ${result.lastInsertRowid})`);
			console.log(`   Commande: ${orderId}`);
			console.log(`   Client: ${clientFullName}`);
			
			return result.lastInsertRowid;
			
		} catch (error) {
			console.error(`❌ ERREUR création facture pour ${orderId}:`, error.message);
			console.error('Stack trace:', error.stack);
			if (error.code) {
				console.error('SQL Error Code:', error.code);
			}
			
			// Relancer l'erreur pour que processOrder la catch
			throw error;
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

	/**
	 * Met à jour les articles d'une commande et recalcule la facture
	 */
	updateOrderItems(orderId, userId, modifications, deletions) {
		try {
			return dbModule.transaction(() => {
				// Vérifier que la commande existe
				const order = dbModule.getOrderById.get(orderId);
				if (!order) {
					throw new Error('Commande non trouvée');
				}
				
				// 🆕 GÉRER LES SUPPRESSIONS D'ABORD
				if (deletions && deletions.length > 0) {
					deletions.forEach(productName => {
						dbModule.db.prepare(`
							DELETE FROM order_items 
							WHERE order_id = ? AND product_name = ? AND status = 'delivered'
						`).run(orderId, productName);
						
						console.log(`✅ Article "${productName}" supprimé de la commande ${orderId}`);
					});
				}
				
				let subtotalHT = 0;
				
				// Mettre à jour chaque article modifié
				if (modifications && modifications.length > 0) {
					modifications.forEach(mod => {
						const { productName, product_name, quantity, unit_price } = mod;
						const finalProductName = product_name || productName;
						
						// Récupérer l'article actuel
						const currentItem = dbModule.db.prepare(`
							SELECT * FROM order_items 
							WHERE order_id = ? AND product_name = ? AND status = 'delivered'
						`).get(orderId, finalProductName);
						
						if (!currentItem) {
							console.warn(`Article ${finalProductName} non trouvé`);
							return;
						}
						
						// Déterminer les nouvelles valeurs
						const newProductName = product_name || currentItem.product_name;
						const newQuantity = quantity !== undefined ? parseInt(quantity) : currentItem.quantity;
						const newPrice = unit_price !== undefined ? parseFloat(unit_price) : currentItem.product_price;
						
						// Mettre à jour l'article
						if (product_name && product_name !== currentItem.product_name) {
							dbModule.db.prepare(`
								UPDATE order_items 
								SET product_name = ?, quantity = ?, product_price = ?
								WHERE order_id = ? AND product_name = ? AND status = 'delivered'
							`).run(newProductName, newQuantity, newPrice, orderId, finalProductName);
						} else {
							dbModule.db.prepare(`
								UPDATE order_items 
								SET quantity = ?, product_price = ?
								WHERE order_id = ? AND product_name = ? AND status = 'delivered'
							`).run(newQuantity, newPrice, orderId, finalProductName);
						}
					});
				}
				
				// Recalculer le subtotal complet APRÈS suppressions et modifications
				const allDeliveredItems = dbModule.db.prepare(`
					SELECT * FROM order_items 
					WHERE order_id = ? AND status = 'delivered'
				`).all(orderId);
				
				subtotalHT = allDeliveredItems.reduce((sum, item) => {
					return sum + (item.product_price * item.quantity);
				}, 0);
				
				// Arrondir le subtotal
				const subtotalHTRounded = Math.round(subtotalHT * 100) / 100;
				
				// Calculer la TVA (8.1%) arrondie au 5 centimes
				const vatAmountBrut = subtotalHTRounded * 0.081;
				const vatAmount = Math.round(vatAmountBrut * 20) / 20;
				
				// Calculer le total TTC
				const totalTTC = subtotalHTRounded + vatAmount;
				
				// Mettre à jour la facture
				const updateInvoice = dbModule.db.prepare(`
					UPDATE invoices 
					SET subtotal_ht = ?,
						vat_amount = ?,
						total_ttc = ?,
						amount_due = ?,
						updated_at = CURRENT_TIMESTAMP
					WHERE order_id = ?
				`);
				
				updateInvoice.run(
					subtotalHTRounded,
					vatAmount,
					totalTTC,
					totalTTC,
					orderId
				);
				
				console.log(`✅ Commande ${orderId} mise à jour`);
				console.log(`   Nouveau subtotal HT: ${subtotalHTRounded.toFixed(2)} CHF`);
				console.log(`   Nouvelle TVA: ${vatAmount.toFixed(2)} CHF`);
				console.log(`   Nouveau total TTC: ${totalTTC.toFixed(2)} CHF`);
				
				return {
					success: true,
					message: 'Commande mise à jour avec succès',
					totals: {
						subtotalHT: subtotalHTRounded,
						vatAmount: vatAmount,
						totalTTC: totalTTC
					}
				};
			});
		} catch (error) {
			console.error('Erreur updateOrderItems:', error);
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
    },

	// Décrémente le stock d'un produit
	_decrementStock(productName, quantity) {
		try {
			const updateStock = dbModule.db.prepare(`
				UPDATE products 
				SET stock = stock - ? 
				WHERE name = ?
			`);
			
			const result = updateStock.run(quantity, productName);
			
			if (result.changes > 0) {
				// Récupérer le nouveau stock pour logging
				const product = dbModule.db.prepare('SELECT stock FROM products WHERE name = ?').get(productName);
				console.log(`📦 Stock mis à jour: ${productName} → ${product.stock} (${quantity} livrés)`);
			}
		} catch (error) {
			console.error(`⚠️ Erreur décrément stock pour ${productName}:`, error);
		}
	},

	// Met le stock d'un produit à 0 (article indisponible)
	_setStockToZero(productName) {
		try {
			const updateStock = dbModule.db.prepare(`
				UPDATE products 
				SET stock = 0 
				WHERE name = ? AND stock > 0
			`);
			
			const result = updateStock.run(productName);
			
			if (result.changes > 0) {
				console.log(`❌ Stock mis à 0: ${productName} (article indisponible)`);
			}
		} catch (error) {
			console.error(`⚠️ Erreur mise à 0 stock pour ${productName}:`, error);
		}
	}
	
};

module.exports = orderService;