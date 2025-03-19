// productService.js - Handle product operations
const dbModule = require('./db');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Service for managing products
const productService = {
    // Get all products
    async getProducts() {
        try {
            // First check if products exist in database
            const stmt = dbModule.db.prepare('SELECT COUNT(*) as count FROM products');
            const { count } = stmt.get();
            
            if (count > 0) {
                // Products exist in database, fetch them
                const products = dbModule.db.prepare('SELECT * FROM products').all();
                
                return products.map(product => ({
                    id: product.id.toString(),
                    Nom: product.name,
                    prix: product.price.toString(),
                    categorie: product.category,
                    imageUrl: product.image_url
                }));
            } else {
                // No products in database, use legacy CSV method and migrate to DB
                const legacyProducts = await this._getLegacyProducts();
                
                // Migrate products to database in background
                this._migrateProductsToDatabase(legacyProducts);
                
                return legacyProducts;
            }
        } catch (error) {
            console.error('Error getting products:', error);
            
            // Fallback to legacy system
            return this._getLegacyProducts();
        }
    },
    
    // Add a product
    addProduct(product) {
        try {
            const stmt = dbModule.db.prepare(`
                INSERT INTO products (name, price, category, image_url)
                VALUES (?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                product.Nom,
                parseFloat(product.prix),
                product.categorie,
                product.imageUrl
            );
            
            return {
                success: true,
                id: result.lastInsertRowid
            };
        } catch (error) {
            console.error('Error adding product:', error);
            throw error;
        }
    },
    
    // Update a product
    updateProduct(id, product) {
        try {
            const stmt = dbModule.db.prepare(`
                UPDATE products 
                SET name = ?, price = ?, category = ?, image_url = ?
                WHERE id = ?
            `);
            
            stmt.run(
                product.Nom,
                parseFloat(product.prix),
                product.categorie,
                product.imageUrl,
                id
            );
            
            return { success: true };
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    },
    
    // Helper: Get products from legacy CSV files
    async _getLegacyProducts() {
        return new Promise((resolve, reject) => {
            const dataFolder = path.join(__dirname, '../data');
            fs.readdir(dataFolder, (err, files) => {
                if (err) {
                    console.error("Error reading data folder:", err);
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
                            // Add category
                            row.categorie = categoryName;
                            
                            // Find image URL
                            let imageUrl = null;
                            
                            Object.keys(row).forEach(key => {
                                const value = row[key];
                                if (typeof value === 'string' && 
                                    (value.includes('/images/') || 
                                    value.includes('/public/images/'))) {
                                    imageUrl = value;
                                }
                            });
                            
                            // Clean image URL
                            if (imageUrl) {
                                imageUrl = imageUrl.replace('/public', '');
                                
                                if (!imageUrl.startsWith('/')) {
                                    imageUrl = '/' + imageUrl;
                                }
                                
                                row.imageUrl = imageUrl;
                            } else {
                                // Default image
                                row.imageUrl = `/images/${categoryName}/${categoryName}-default.jpg`;
                            }
                            
                            // Clean object
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
                            console.error(`Error reading CSV file ${file}:`, error);
                            filesProcessed++;
                            if (filesProcessed === csvFiles.length) {
                                resolve(products);
                            }
                        });
                });
            });
        });
    },
    
    // Helper: Migrate products from CSV to database
    async _migrateProductsToDatabase(products) {
        try {
            // First check if products already exist
            const stmt = dbModule.db.prepare('SELECT COUNT(*) as count FROM products');
            const { count } = stmt.get();
            
            if (count > 0) {
                // Products already exist, skip migration
                return;
            }
            
            // Start transaction for better performance
            const insertProduct = dbModule.db.prepare(`
                INSERT INTO products (name, price, category, image_url)
                VALUES (?, ?, ?, ?)
            `);
            
            const insertMany = dbModule.db.transaction((products) => {
                for (const product of products) {
                    if (!product.Nom || !product.prix) continue;
                    
                    insertProduct.run(
                        product.Nom,
                        parseFloat(product.prix),
                        product.categorie || 'default',
                        product.imageUrl || ''
                    );
                }
            });
            
            // Insert all products
            insertMany(products);
            
            console.log(`Migrated ${products.length} products to database`);
        } catch (error) {
            console.error('Error migrating products to database:', error);
        }
    }
};

module.exports = productService;