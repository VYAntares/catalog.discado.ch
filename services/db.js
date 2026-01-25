// db.js - Module de gestion de base de données
// services/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Création du répertoire de la base de données si nécessaire
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialisation de la connexion à la base de données
const dbPath = path.join(dbDir, 'discado.db');
const db = new Database(dbPath);

// Activation des clés étrangères
db.pragma('foreign_keys = ON');


// Vérification de l'existence d'une colonne dans une table
function columnExists(tableName, columnName) {
    // Liste blanche des tables autorisées
    const allowedTables = ['users', 'user_profiles', 'products', 'orders', 'order_items', 'pending_deliveries'];
    
    if (!allowedTables.includes(tableName)) {
        return false;
    }
    
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(column => column.name === columnName);
}

function initDatabase() {
    // Création de la table users
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Vérification et mise à jour de la table user_profiles
    const userProfilesColumns = db.prepare("PRAGMA table_info(user_profiles)").all();
    const hasReferralSource = userProfilesColumns.some(col => col.name === 'referral_source');
    
    if (!hasReferralSource) {
        try {
            db.exec(`
            ALTER TABLE user_profiles 
            ADD COLUMN referral_source TEXT
            `);
        } catch (error) {
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
        }
    }

    // Vérification et mise à jour de la table orders
    const ordersColumns = db.prepare("PRAGMA table_info(orders)").all();
    const hasReference = ordersColumns.some(col => col.name === 'reference');
    
    if (!hasReference) {
        try {
            db.exec(`
            ALTER TABLE orders 
            ADD COLUMN reference TEXT
            `);
        } catch (error) {
            // Gestion silencieuse de l'erreur
        }
    }

    // Création de la table products
    db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        image_url TEXT,
        stock INTEGER DEFAULT 10000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Création de la table orders
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

    // Création de la table order_items
    db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        category TEXT,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )
    `);

    // Création de la table pending_deliveries
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

	// Création de la table invoices
	db.exec(`
	CREATE TABLE IF NOT EXISTS invoices (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		invoice_number TEXT UNIQUE NOT NULL,
		order_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		client_full_name TEXT,
		
		invoice_date TIMESTAMP NOT NULL,
		
		subtotal_ht REAL NOT NULL,
		vat_amount REAL NOT NULL,
		total_ttc REAL NOT NULL,
		
		payment_status TEXT DEFAULT 'unpaid',
		amount_paid REAL DEFAULT 0,
		amount_due REAL NOT NULL,
		
		due_date TIMESTAMP,
		paid_date TIMESTAMP,
		
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		
		FOREIGN KEY (order_id) REFERENCES orders(order_id),
		FOREIGN KEY (user_id) REFERENCES users(username)
	)
	`);
}

// Initialisation de la base de données
initDatabase();

// Export du module avec toutes les requêtes préparées organisées par catégorie
module.exports = {
    // Instance de base de données
    db,
    
    // Utilitaire de vérification de colonnes
    columnExists,
    
    // Transactions
    transaction: (callback) => {
        const runTransaction = db.transaction(callback);
        return runTransaction();
    },
    
    // Requêtes liées aux utilisateurs
    users: {
        getByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
        create: db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)'),
        getAll: db.prepare('SELECT * FROM users')
    },
    
    // Requêtes liées aux profils utilisateurs
    profiles: {
        getByUsername: db.prepare('SELECT * FROM user_profiles WHERE username = ?'),
        create: db.prepare(`
            INSERT INTO user_profiles 
            (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, referral_source, last_updated) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        update: db.prepare(`
            UPDATE user_profiles 
            SET first_name = ?, last_name = ?, email = ?, phone = ?, 
                shop_name = ?, shop_address = ?, shop_city = ?, shop_zip_code = ?, referral_source = ?, last_updated = ?
            WHERE username = ?
        `),
        // Requêtes de compatibilité sans referral_source
        fallbackCreate: db.prepare(`
            INSERT INTO user_profiles 
            (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, last_updated) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        fallbackUpdate: db.prepare(`
            UPDATE user_profiles 
            SET first_name = ?, last_name = ?, email = ?, phone = ?, 
                shop_name = ?, shop_address = ?, shop_city = ?, shop_zip_code = ?, last_updated = ?
            WHERE username = ?
        `),
        getAll: db.prepare('SELECT * FROM user_profiles')
    },
    
    // Requêtes liées aux commandes
    orders: {
        create: db.prepare('INSERT INTO orders (order_id, user_id, status, date, reference) VALUES (?, ?, ?, ?, ?)'),
        getById: db.prepare('SELECT * FROM orders WHERE order_id = ?'),
        getByUser: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC'),
        getPending: db.prepare("SELECT * FROM orders WHERE status = 'pending' ORDER BY date ASC"),
        getTreated: db.prepare("SELECT * FROM orders WHERE status IN ('completed', 'partial') ORDER BY date DESC"),
        updateStatus: db.prepare('UPDATE orders SET status = ?, last_processed = ? WHERE order_id = ?'),
        updateDate: db.prepare('UPDATE orders SET date = ? WHERE order_id = ?'),
        updateDateAndReference: db.prepare('UPDATE orders SET date = ?, reference = ? WHERE order_id = ?')
    },
    
    // Requêtes liées aux articles de commande
    orderItems: {
        add: db.prepare(`
            INSERT INTO order_items (order_id, product_name, product_price, quantity, category, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `),
        getByOrder: db.prepare('SELECT * FROM order_items WHERE order_id = ?'),
        getByOrderAndStatus: db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status = ?'),
        updateStatus: db.prepare('UPDATE order_items SET status = ? WHERE order_id = ? AND product_name = ?'),
        updateQuantity: db.prepare(`
            UPDATE order_items 
            SET quantity = ? 
            WHERE order_id = ? AND product_name = ? AND category = ?
        `)
    },
    
    // Requêtes liées aux livraisons en attente
    pendingDeliveries: {
        add: db.prepare(`
            INSERT INTO pending_deliveries (user_id, product_name, product_price, quantity, category) 
            VALUES (?, ?, ?, ?, ?)
        `),
        getByUser: db.prepare('SELECT * FROM pending_deliveries WHERE user_id = ?'),
        remove: db.prepare('DELETE FROM pending_deliveries WHERE id = ?'),
        updateQuantity: db.prepare('UPDATE pending_deliveries SET quantity = ? WHERE id = ?'),
        findItem: db.prepare(`
            SELECT * FROM pending_deliveries 
            WHERE user_id = ? AND product_name = ? AND category = ?
        `)
    },
    
    // Maintien des anciennes références pour la compatibilité avec le code existant
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    createUser: db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)'),
    getAllUsers: db.prepare('SELECT * FROM users'),
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
    createOrder: db.prepare('INSERT INTO orders (order_id, user_id, status, date, reference) VALUES (?, ?, ?, ?, ?)'),
    getOrderById: db.prepare('SELECT * FROM orders WHERE order_id = ?'),
    getUserOrders: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC'),
    getPendingOrders: db.prepare("SELECT * FROM orders WHERE status = 'pending' ORDER BY date ASC"),
    getTreatedOrders: db.prepare("SELECT * FROM orders WHERE status IN ('completed', 'partial') ORDER BY date DESC"),
    updateOrderStatus: db.prepare('UPDATE orders SET status = ?, last_processed = ? WHERE order_id = ?'),
    addOrderItem: db.prepare(`
        INSERT INTO order_items (order_id, product_name, product_price, quantity, category, status) 
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    getOrderItems: db.prepare('SELECT * FROM order_items WHERE order_id = ?'),
    getOrderItemsByStatus: db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status = ?'),
    updateOrderItemStatus: db.prepare('UPDATE order_items SET status = ? WHERE order_id = ? AND product_name = ?'),
    updateOrderItemQuantity: db.prepare(`
        UPDATE order_items 
        SET quantity = ? 
        WHERE order_id = ? AND product_name = ? AND category = ?
    `),
    updateOrderDate: db.prepare(`
        UPDATE orders 
        SET date = ? 
        WHERE order_id = ?
    `),
    updateOrderDateAndReference: db.prepare(`
        UPDATE orders 
        SET date = ?, reference = ? 
        WHERE order_id = ?
    `),
    addPendingDelivery: db.prepare(`
        INSERT INTO pending_deliveries (user_id, product_name, product_price, quantity, category) 
        VALUES (?, ?, ?, ?, ?)
    `),
    getUserPendingDeliveries: db.prepare('SELECT * FROM pending_deliveries WHERE user_id = ?'),
    removePendingDelivery: db.prepare('DELETE FROM pending_deliveries WHERE id = ?'),
    updatePendingDeliveryQuantity: db.prepare('UPDATE pending_deliveries SET quantity = ? WHERE id = ?'),
    findPendingDeliveryItem: db.prepare(`
        SELECT * FROM pending_deliveries 
        WHERE user_id = ? AND product_name = ? AND category = ?
    `)
};