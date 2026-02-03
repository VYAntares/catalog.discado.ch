// productService.js
// services/userService.js
// Service de gestion des produits
const dbModule = require('./db');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Service de gestion des produits
const productService = {
    // Récupération de tous les produits (depuis DB ou CSV)
    async getProducts() {
        try {
            // Vérifier si des produits existent en base de données
            const stmt = dbModule.db.prepare('SELECT COUNT(*) as count FROM products');
            const { count } = stmt.get();
            
            if (count > 0) {
                // Récupérer les produits de la base de données
                const products = dbModule.db.prepare('SELECT * FROM products').all();
                
                return products.map(product => ({
                    id: product.id.toString(),
                    Nom: product.name,
                    prix: product.price.toString(),
                    categorie: product.category,
                    imageUrl: product.image_url
                }));
            } else {
                // Utiliser l'ancien système CSV et migrer vers DB
                const legacyProducts = await this._getLegacyProducts();
                this._migrateProductsToDatabase(legacyProducts);
                return legacyProducts;
            }
        } catch (error) {
            // Fallback vers le système legacy en cas d'erreur
            return this._getLegacyProducts();
        }
    },
    
    // Ajout d'un produit en base de données
    addProduct(product) {
        try {
            const stmt = dbModule.db.prepare(`
				INSERT INTO products (name, price, category, supplier, image_url, stock)
				VALUES (?, ?, ?, ?, ?, ?)
			`);

			const result = stmt.run(
				product.Nom,
				parseFloat(product.prix),
				product.categorie,
				product.supplier || 'Non défini',
				product.imageUrl,
				product.stock || 10000
			);
            
            return {
                success: true,
                id: result.lastInsertRowid
            };
        } catch (error) {
            throw error;
        }
    },
    
    // Mise à jour d'un produit existant
    updateProduct(id, product) {
        try {
            const stmt = dbModule.db.prepare(`
    UPDATE products 
    SET name = ?, price = ?, category = ?, supplier = ?, image_url = ?
    WHERE id = ?
			`);

			stmt.run(
				product.Nom,
				parseFloat(product.prix),
				product.categorie,
				product.supplier || 'Non défini',
				product.imageUrl,
				id
			);
            
            return { success: true };
        } catch (error) {
            throw error;
        }
    },
    
    // Récupération des produits depuis les fichiers CSV (système legacy)
    async _getLegacyProducts() {
        return new Promise((resolve, reject) => {
            const dataFolder = path.join(__dirname, '../data');
            fs.readdir(dataFolder, (err, files) => {
                if (err) {
                    return resolve([]);
                }
                
                const csvFiles = files.filter(file => file.endsWith('.csv'));
                let products = [];
                let filesProcessed = 0;
                
                if (csvFiles.length === 0) return resolve(products);
                
                csvFiles.forEach(file => {
                    const filePath = path.join(dataFolder, file);
                    const categoryName = file.replace('.csv', '');
                    
                    fs.createReadStream(filePath)
                        .pipe(csv({ 
                            separator: ';',
                            maxRows: 0 
                        }))
                        .on('data', (row) => {
                            // Ajouter la catégorie
                            row.categorie = categoryName;
                            
                            // Rechercher l'URL d'image
                            let imageUrl = null;
                            
                            Object.keys(row).forEach(key => {
                                const value = row[key];
                                if (typeof value === 'string' && 
                                    (value.includes('/images/') || 
                                    value.includes('/public/images/'))) {
                                    imageUrl = value;
                                }
                            });
                            
                            // Nettoyer l'URL d'image
                            if (imageUrl) {
                                imageUrl = imageUrl.replace('/public', '');
                                
                                if (!imageUrl.startsWith('/')) {
                                    imageUrl = '/' + imageUrl;
                                }
                                
                                row.imageUrl = imageUrl;
                            } else {
                                // Image par défaut
                                row.imageUrl = `/images/${categoryName}/${categoryName}-default.jpg`;
                            }
                            
                            // Nettoyer l'objet
                            const cleanedRow = {};
                            Object.keys(row).forEach(key => {
                                if (isNaN(parseInt(key)) && key !== '' && row[key] !== '') {
                                    cleanedRow[key] = row[key];
                                }
                            });
                            
                            products.push(cleanedRow);
                        })
                        .on('end', () => {
                            filesProcessed++;
                            if (filesProcessed === csvFiles.length) {
                                resolve(products);
                            }
                        })
                        .on('error', (error) => {
                            filesProcessed++;
                            if (filesProcessed === csvFiles.length) {
                                resolve(products);
                            }
                        });
                });
            });
        });
    },
    
    // Migration des produits des fichiers CSV vers la base de données
    async _migrateProductsToDatabase(products) {
        try {
            // Vérifier si des produits existent déjà
            const stmt = dbModule.db.prepare('SELECT COUNT(*) as count FROM products');
            const { count } = stmt.get();
            
            if (count > 0) {
                // Produits déjà existants, annuler la migration
                return;
            }
            
            // Préparer l'insertion AVEC supplier
			const insertProduct = dbModule.db.prepare(`
				INSERT INTO products (name, price, category, supplier, image_url, stock)
				VALUES (?, ?, ?, ?, ?, ?)
			`);

			// Transaction pour de meilleures performances
			const insertMany = dbModule.db.transaction((products) => {
				for (const product of products) {
					if (!product.Nom || !product.prix) continue;
					
					insertProduct.run(
						product.Nom,
						parseFloat(product.prix),
						product.categorie || 'default',
						product.supplier || 'Non défini',  // ← AJOUTÉ
						product.imageUrl || '',
						10000  // ← Stock par défaut
					);
				}
			});
            
            // Insérer tous les produits
            insertMany(products);
        } catch (error) {
            // Gestion silencieuse des erreurs
        }
    },

	// Récupération des produits pour la gestion du stock (format brut SQLite)
	async getProductsStock() {
		try {
			const products = dbModule.db.prepare('SELECT * FROM products ORDER BY category, name').all();
			
			return products.map(product => ({
				id: product.id,
				name: product.name,
				price: Number(product.price) || 0,
				origin_price: Number(product.origin_price) || 0, // ✅ ICI
				category: product.category,
				supplier: product.supplier || 'Non défini',  // ← AJOUTÉ
				image_url: product.image_url,
				stock: Number(product.stock) || 0,
				barcode: product.barcode || '',
				created_at: product.created_at
			}));
		} catch (error) {
			console.error('❌ Erreur getProductsStock:', error);
			throw error;
		}
	},
};

module.exports = productService;