// db.js - Ajout des fonctions manquantes
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'discado.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initDatabase() {
    // Create users table
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Vérifier si la colonne referral_source existe dans la table user_profiles
    const userProfilesColumns = db.prepare("PRAGMA table_info(user_profiles)").all();
    const hasReferralSource = userProfilesColumns.some(col => col.name === 'referral_source');
    const ordersColumns = db.prepare("PRAGMA table_info(orders)").all();
    const hasReference = ordersColumns.some(col => col.name === 'reference');

    // Create user_profiles table with referral_source column
    if (!hasReferralSource) {
        // Si la table existe déjà, ajouter la colonne
        try {
            db.exec(`
            ALTER TABLE user_profiles 
            ADD COLUMN referral_source TEXT
            `);
            console.log('Colonne referral_source ajoutée à la table user_profiles');
        } catch (error) {
            // La table n'existe pas encore, on la crée avec la colonne
            db.exec(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                username TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                email TEXT,
                phone TEXT,
                shop_name TEXT,
                shop_address TEXT,
                shop_city TEXT,
                shop_zip_code TEXT,
                referral_source TEXT,
                last_updated TIMESTAMP,
                FOREIGN KEY (username) REFERENCES users(username)
            )
            `);
            console.log('Table user_profiles créée avec la colonne referral_source');
        }
    } else {
        // La table existe déjà avec la colonne referral_source
        console.log('La colonne referral_source existe déjà dans la table user_profiles');
    }

    if (!hasReference) {
        try {
            db.exec(`
            ALTER TABLE orders 
            ADD COLUMN reference TEXT
            `);
            console.log('Column reference added to the orders table');
        } catch (error) {
            console.error('Error adding reference column to orders table:', error);
        }
    } else {
        console.log('The reference column already exists in the orders table');
    }

    // Create products table
    db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Create orders table
    db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        last_processed TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(username)
    )
    `);

    // Create order_items table
    db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        category TEXT,
        status TEXT DEFAULT 'pending', -- pending, delivered, remaining
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )
    `);

    // Create pending_deliveries table for items waiting to be delivered
    db.exec(`
    CREATE TABLE IF NOT EXISTS pending_deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(username)
    )
    `);

    console.log('Database initialized successfully');
}

// Initialize the database
initDatabase();

// Function to check if a column exists in a table
function columnExists(tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(column => column.name === columnName);
}

// Export database instance and prepared statements
module.exports = {
    db,
    
    // Column checking utility
    columnExists,
    
    // User-related queries
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    createUser: db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)'),
    getAllUsers: db.prepare('SELECT * FROM users'),
    
    // User profile queries with referral_source
    getUserProfile: db.prepare('SELECT * FROM user_profiles WHERE username = ?'),
    createUserProfile: db.prepare(`
        INSERT INTO user_profiles 
        (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, referral_source, last_updated) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateUserProfile: db.prepare(`
        UPDATE user_profiles 
        SET first_name = ?, last_name = ?, email = ?, phone = ?, 
            shop_name = ?, shop_address = ?, shop_city = ?, shop_zip_code = ?, referral_source = ?, last_updated = ?
        WHERE username = ?
    `),
    
    // Fallback queries without referral_source for compatibility
    fallbackCreateUserProfile: db.prepare(`
        INSERT INTO user_profiles 
        (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, last_updated) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    fallbackUpdateUserProfile: db.prepare(`
        UPDATE user_profiles 
        SET first_name = ?, last_name = ?, email = ?, phone = ?, 
            shop_name = ?, shop_address = ?, shop_city = ?, shop_zip_code = ?, last_updated = ?
        WHERE username = ?
    `),
    
    getAllProfiles: db.prepare('SELECT * FROM user_profiles'),
    
    // Order queries
    createOrder: db.prepare('INSERT INTO orders (order_id, user_id, status, date, reference) VALUES (?, ?, ?, ?, ?)'),
    getOrderById: db.prepare('SELECT * FROM orders WHERE order_id = ?'),
    getUserOrders: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC'),
    getPendingOrders: db.prepare("SELECT * FROM orders WHERE status = 'pending' ORDER BY date ASC"),
    getTreatedOrders: db.prepare("SELECT * FROM orders WHERE status IN ('completed', 'partial') ORDER BY date DESC"),
    updateOrderStatus: db.prepare('UPDATE orders SET status = ?, last_processed = ? WHERE order_id = ?'),
    
    // Order items queries
    addOrderItem: db.prepare(`
        INSERT INTO order_items (order_id, product_name, product_price, quantity, category, status) 
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    getOrderItems: db.prepare('SELECT * FROM order_items WHERE order_id = ?'),
    getOrderItemsByStatus: db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status = ?'),
    updateOrderItemStatus: db.prepare('UPDATE order_items SET status = ? WHERE order_id = ? AND product_name = ?'),
    // Requête pour mettre à jour la quantité d'un article de commande
    updateOrderItemQuantity: db.prepare(`
        UPDATE order_items 
        SET quantity = ? 
        WHERE order_id = ? AND product_name = ? AND category = ?
    `),

    // Requête pour mettre à jour la date d'une commande
    updateOrderDate: db.prepare(`
        UPDATE orders 
        SET date = ? 
        WHERE order_id = ?
    `),

    // Add a new prepared statement to update both date and reference
    updateOrderDateAndReference: db.prepare(`
        UPDATE orders 
        SET date = ?, reference = ? 
        WHERE order_id = ?
    `),

    
    // Pending deliveries
    addPendingDelivery: db.prepare(`
        INSERT INTO pending_deliveries (user_id, product_name, product_price, quantity, category) 
        VALUES (?, ?, ?, ?, ?)
    `),
    getUserPendingDeliveries: db.prepare('SELECT * FROM pending_deliveries WHERE user_id = ?'),
    removePendingDelivery: db.prepare('DELETE FROM pending_deliveries WHERE id = ?'),
    updatePendingDeliveryQuantity: db.prepare('UPDATE pending_deliveries SET quantity = ? WHERE id = ?'),
    
    // Nouvelle requête pour trouver un article en attente de livraison spécifique
    findPendingDeliveryItem: db.prepare(`
        SELECT * FROM pending_deliveries 
        WHERE user_id = ? AND product_name = ? AND category = ?
    `),

    // Transaction wrapper
    transaction: (callback) => {
        const runTransaction = db.transaction(callback);
        return runTransaction();
    }
};