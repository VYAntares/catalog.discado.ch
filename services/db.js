// db.js - Module de gestion de base de données
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
    const allowedTables = ['users', 'user_profiles', 'products', 'orders', 'order_items', 'pending_deliveries', 'suppliers', 'user_permissions', 'invoices', 'order_supplier_items', 'expenses', 'client_locations', 'wishlists'];
    
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
                notes TEXT,
                last_updated TIMESTAMP,
                FOREIGN KEY (username) REFERENCES users(username)
            )
            `);
        }
    }

    // Ajouter la colonne notes à user_profiles si elle n'existe pas
    if (!columnExists('user_profiles', 'notes')) {
        try {
            db.exec(`ALTER TABLE user_profiles ADD COLUMN notes TEXT`);
            console.log('✅ Colonne notes ajoutée à user_profiles');
        } catch (error) {
            console.error('⚠️ Erreur ajout colonne notes:', error.message);
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
        supplier TEXT,
        image_url TEXT,
        stock INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        origin_price REAL DEFAULT 0,
        barcode TEXT
    )
    `);

    // Ajout de la colonne origin_price à products si elle n'existe pas
    if (!columnExists('products', 'origin_price')) {
        try {
            db.exec(`
                ALTER TABLE products 
                ADD COLUMN origin_price REAL DEFAULT 0
            `);
            console.log('✅ Colonne origin_price ajoutée à la table products');
        } catch (error) {
            console.error('⚠️ Erreur lors de l\'ajout de origin_price:', error.message);
        }
    }

    if (!columnExists('products', 'barcode')) {
        try {
            db.exec(`
                ALTER TABLE products 
                ADD COLUMN barcode TEXT
            `);
            console.log('✅ Colonne barcode ajoutée à la table products');
        } catch (error) {
            console.error('⚠️ Erreur lors de l\'ajout de barcode:', error.message);
        }
    }

        // Ajouter la colonne suppliers si elle n'existe pas
    if (!columnExists('user_permissions', 'suppliers')) {
        try {
            db.exec(`ALTER TABLE user_permissions ADD COLUMN suppliers INTEGER DEFAULT 0`);
            console.log('✅ Colonne suppliers ajoutée à user_permissions');
        } catch (error) {
            console.error('⚠️ Erreur ajout colonne suppliers:', error.message);
        }
    }

    // Ajouter la colonne stats si elle n'existe pas
    if (!columnExists('user_permissions', 'stats')) {
        try {
            db.exec(`ALTER TABLE user_permissions ADD COLUMN stats INTEGER DEFAULT 0`);
            console.log('✅ Colonne stats ajoutée à user_permissions');
        } catch (error) {
            console.error('⚠️ Erreur ajout colonne stats:', error.message);
        }
    }

    // Ajouter la colonne commission_status si elle n'existe pas
    if (!columnExists('invoices', 'commission_status')) {
        try {
            db.exec(`ALTER TABLE invoices ADD COLUMN commission_status TEXT DEFAULT 'not_received'`);
            console.log('✅ Colonne commission_status ajoutée à invoices');
        } catch (error) {
            console.error('⚠️ Erreur ajout colonne commission_status:', error.message);
        }
    }

    // Création de la table suppliers
    db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        emails TEXT,
        wechats TEXT,
        phones TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);
    console.log('✅ Table suppliers créée ou déjà existante');

    // Création de la table client_locations
    db.exec(`
    CREATE TABLE IF NOT EXISTS client_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT,
        label TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES user_profiles(username)
    )
    `);
    console.log('✅ Table client_locations créée ou déjà existante');

    // Table pour les commandes fournisseurs
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_supplier (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          supplier_id INTEGER NOT NULL,
          invoice_number TEXT UNIQUE NOT NULL,
          order_date DATE NOT NULL,
          status TEXT DEFAULT 'Passée',
          total_amount DECIMAL(10,2) DEFAULT 0,
          amount_paid DECIMAL(10,2) DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
      `);
  
      // Table pour les items des commandes fournisseurs
      db.exec(`
        CREATE TABLE IF NOT EXISTS order_supplier_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_supplier_id INTEGER NOT NULL,
          product_id INTEGER NULL,
          product_name TEXT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          quantity INTEGER NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          category TEXT,
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          batch_number INTEGER DEFAULT 1,
          item_status TEXT DEFAULT 'commandé',
          FOREIGN KEY (order_supplier_id) REFERENCES order_supplier(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        )
      `);

        // Ajouter la colonne batch_number si elle n'existe pas (pour les bases existantes)
    if (!columnExists('order_supplier_items', 'batch_number')) {
        try {
            db.exec(`
                ALTER TABLE order_supplier_items 
                ADD COLUMN batch_number INTEGER DEFAULT 1
            `);
            console.log('✅ Colonne batch_number ajoutée à order_supplier_items');
        } catch (error) {
            console.error('⚠️ Erreur ajout batch_number:', error.message);
        }
    }

    // Ajouter la colonne item_status si elle n'existe pas
    if (!columnExists('order_supplier_items', 'item_status')) {
        try {
            db.exec(`
                ALTER TABLE order_supplier_items
                ADD COLUMN item_status TEXT DEFAULT 'commandé'
            `);
            console.log('✅ Colonne item_status ajoutée à order_supplier_items');
        } catch (error) {
            console.error('⚠️ Erreur ajout item_status:', error.message);
        }
    }

    // Table pour les paiements des commandes fournisseurs
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_supplier_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_supplier_id INTEGER NOT NULL,
          amount_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
          amount_chf DECIMAL(10,2) DEFAULT 0,
          payment_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_supplier_id) REFERENCES order_supplier(id) ON DELETE CASCADE
        )
      `);

    // Table pour les frais de transport des commandes fournisseurs
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_supplier_transport (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_supplier_id INTEGER NOT NULL,
          amount_chf DECIMAL(10,2) NOT NULL DEFAULT 0,
          transport_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_supplier_id) REFERENCES order_supplier(id) ON DELETE CASCADE
        )
      `);

    // Table pour les pièces jointes des commandes fournisseurs
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_supplier_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_supplier_id INTEGER NOT NULL,
          original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_supplier_id) REFERENCES order_supplier(id) ON DELETE CASCADE
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
        reference TEXT,
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

    // Migration : ajout product_id aux tables existantes (nullable pour compatibilité)
    try { db.exec('ALTER TABLE order_items ADD COLUMN product_id INTEGER REFERENCES products(id)'); } catch(e) { /* colonne déjà présente */ }
    try { db.exec('ALTER TABLE pending_deliveries ADD COLUMN product_id INTEGER REFERENCES products(id)'); } catch(e) { /* colonne déjà présente */ }

    // Création de la table wishlists
    db.exec(`
    CREATE TABLE IF NOT EXISTS wishlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL,
        category TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(username),
        UNIQUE(user_id, product_id)
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
        commission_status TEXT DEFAULT 'not_received',

        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (user_id) REFERENCES users(username)
    )
    `);

    db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
    `);

    db.exec(`
    CREATE TABLE IF NOT EXISTS share_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        client_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users(username)
    )
    `);

    db.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
        username TEXT PRIMARY KEY,
        stock INTEGER DEFAULT 0,
        compta INTEGER DEFAULT 0,
        orders INTEGER DEFAULT 1,
        clients INTEGER DEFAULT 0,
        order_history INTEGER DEFAULT 1,
        stats INTEGER DEFAULT 0,
        suppliers INTEGER DEFAULT 0,
        FOREIGN KEY (username) REFERENCES users(username)
    )
    `);

    // Création de la table expenses (suivi des dépenses)
    db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        date DATE NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('loyer','salaire','frais_divers','fournisseurs','poste','transporteur')),
        description TEXT,
        supplier_payment_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);
    console.log('✅ Table expenses créée ou déjà existante');

    // Migration : mettre à jour le CHECK constraint pour ajouter les nouvelles catégories
    try {
        const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'").get();
        if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'essence'")) {
            db.exec(`
                CREATE TABLE expenses_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL NOT NULL,
                    date DATE NOT NULL,
                    category TEXT NOT NULL CHECK(category IN ('loyer','salaire','frais_divers','fournisseurs','poste','transporteur','essence')),
                    description TEXT,
                    supplier_payment_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            db.exec(`INSERT INTO expenses_new SELECT id, amount, date, category, description, supplier_payment_id, created_at, updated_at FROM expenses`);
            db.exec(`DROP TABLE expenses`);
            db.exec(`ALTER TABLE expenses_new RENAME TO expenses`);
            console.log('✅ Table expenses migrée avec catégorie essence');
        }
    } catch (migErr) {
        console.error('⚠️ Erreur migration CHECK expenses:', migErr.message);
    }

    // Ajouter la colonne supplier_payment_id si elle n'existe pas
    if (!columnExists('expenses', 'supplier_payment_id')) {
        try {
            db.exec(`ALTER TABLE expenses ADD COLUMN supplier_payment_id INTEGER`);
            console.log('✅ Colonne supplier_payment_id ajoutée à expenses');
        } catch (error) {
            console.error('⚠️ Erreur ajout colonne supplier_payment_id:', error.message);
        }
    }

    // Ajouter la colonne transport_payment_id si elle n'existe pas
    if (!columnExists('expenses', 'transport_payment_id')) {
        try {
            db.exec(`ALTER TABLE expenses ADD COLUMN transport_payment_id INTEGER`);
            console.log('✅ Colonne transport_payment_id ajoutée à expenses');
        } catch (error) {
            console.error('⚠️ Erreur ajout colonne transport_payment_id:', error.message);
        }
    }

    // Table pour les tokens de réinitialisation de mot de passe
    db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (username) REFERENCES users(username)
    )
    `);
    console.log('✅ Table password_reset_tokens créée ou déjà existante');

    // Migration unique : importer les paiements fournisseurs existants dans expenses
    try {
        const existingPayments = db.prepare(`
            SELECT p.id, p.order_supplier_id, p.amount_chf, p.payment_date,
                   s.name as supplier_name, o.invoice_number
            FROM order_supplier_payments p
            JOIN order_supplier o ON o.id = p.order_supplier_id
            JOIN suppliers s ON s.id = o.supplier_id
            WHERE p.amount_chf > 0
            AND p.id NOT IN (SELECT supplier_payment_id FROM expenses WHERE supplier_payment_id IS NOT NULL)
        `).all();

        if (existingPayments.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO expenses (amount, date, category, description, supplier_payment_id)
                VALUES (?, ?, 'fournisseurs', ?, ?)
            `);
            const migrateAll = db.transaction((payments) => {
                for (const p of payments) {
                    const desc = `Paiement fournisseur ${p.supplier_name}${p.invoice_number ? ' - Cmd ' + p.invoice_number : ''}`;
                    insertStmt.run(p.amount_chf, p.payment_date, desc, p.id);
                }
            });
            migrateAll(existingPayments);
            console.log(`✅ ${existingPayments.length} paiement(s) fournisseur migré(s) dans expenses`);
        }
    } catch (migErr) {
        console.error('⚠️ Erreur migration paiements fournisseurs:', migErr.message);
    }
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
        getAll: db.prepare('SELECT * FROM user_profiles'),
        getNotes: db.prepare('SELECT notes FROM user_profiles WHERE username = ?'),
        updateNotes: db.prepare('UPDATE user_profiles SET notes = ?, last_updated = ? WHERE username = ?')
    },
    
    // Requêtes liées aux fournisseurs
    suppliers: {
        getAll: db.prepare('SELECT * FROM suppliers ORDER BY name ASC'),
        getById: db.prepare('SELECT * FROM suppliers WHERE id = ?'),
        getByName: db.prepare('SELECT * FROM suppliers WHERE name = ?'),
        create: db.prepare(`
            INSERT INTO suppliers (name, emails, wechats, phones, notes) 
            VALUES (?, ?, ?, ?, ?)
        `),
        update: db.prepare(`
            UPDATE suppliers 
            SET name = ?, emails = ?, wechats = ?, phones = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `),
        delete: db.prepare('DELETE FROM suppliers WHERE id = ?')
    },

    // Gestion des commandes fournisseurs
    orderSupplier: {
        getAll: db.prepare('SELECT * FROM order_supplier ORDER BY order_date DESC'),
        
        getById: db.prepare('SELECT * FROM order_supplier WHERE id = ?'),
        
        getBySupplierId: db.prepare(`
        SELECT * FROM order_supplier 
        WHERE supplier_id = ? 
        ORDER BY order_date DESC
        `),
        
        create: db.prepare(`
        INSERT INTO order_supplier (
            supplier_id, invoice_number, order_date, status, 
            total_amount, amount_paid, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        
        update: db.prepare(`
        UPDATE order_supplier 
        SET supplier_id = ?, invoice_number = ?, order_date = ?, 
            status = ?, total_amount = ?, amount_paid = ?, 
            notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `),
        
        updateAmounts: db.prepare(`
        UPDATE order_supplier 
        SET total_amount = ?, amount_paid = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `),
        
        updateStatus: db.prepare(`
        UPDATE order_supplier
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `),

        updateNotes: db.prepare(`
        UPDATE order_supplier
        SET notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `),
        
        delete: db.prepare('DELETE FROM order_supplier WHERE id = ?'),
        
        // Stats par fournisseur
        getStatsBySupplierId: db.prepare(`
        SELECT 
            COUNT(*) as total_orders,
            SUM(total_amount) as total_spent,
            SUM(amount_paid) as total_paid
        FROM order_supplier 
        WHERE supplier_id = ?
        `)
    },

    // Gestion des items des commandes fournisseurs
    orderSupplierPayments: {
        getByOrderId: db.prepare(`
        SELECT * FROM order_supplier_payments
        WHERE order_supplier_id = ?
        ORDER BY payment_date DESC, created_at DESC
        `),

        insert: db.prepare(`
        INSERT INTO order_supplier_payments (
            order_supplier_id, amount_usd, amount_chf, payment_date
        ) VALUES (?, ?, ?, ?)
        `),

        delete: db.prepare('DELETE FROM order_supplier_payments WHERE id = ?'),

        sumByOrderId: db.prepare(`
        SELECT COALESCE(SUM(amount_usd), 0) as total_paid_usd,
               COALESCE(SUM(amount_chf), 0) as total_paid_chf
        FROM order_supplier_payments
        WHERE order_supplier_id = ?
        `)
    },

    orderSupplierTransport: {
        getByOrderId: db.prepare(`
        SELECT * FROM order_supplier_transport
        WHERE order_supplier_id = ?
        ORDER BY transport_date DESC, created_at DESC
        `),

        insert: db.prepare(`
        INSERT INTO order_supplier_transport (
            order_supplier_id, amount_chf, transport_date
        ) VALUES (?, ?, ?)
        `),

        delete: db.prepare('DELETE FROM order_supplier_transport WHERE id = ?'),
    },

    orderSupplierAttachments: {
        getByOrderId: db.prepare(`
        SELECT * FROM order_supplier_attachments
        WHERE order_supplier_id = ?
        ORDER BY created_at DESC
        `),

        getById: db.prepare('SELECT * FROM order_supplier_attachments WHERE id = ?'),

        insert: db.prepare(`
        INSERT INTO order_supplier_attachments (
            order_supplier_id, original_name, stored_name, file_type, file_size
        ) VALUES (?, ?, ?, ?, ?)
        `),

        updateName: db.prepare('UPDATE order_supplier_attachments SET original_name = ? WHERE id = ?'),

        delete: db.prepare('DELETE FROM order_supplier_attachments WHERE id = ?'),

        deleteByOrderId: db.prepare('DELETE FROM order_supplier_attachments WHERE order_supplier_id = ?')
    },

    orderSupplierItems: {
        getAll: db.prepare('SELECT * FROM order_supplier_items'),
        
        getById: db.prepare('SELECT * FROM order_supplier_items WHERE id = ?'),
        
        getByOrderId: db.prepare(`
            SELECT * FROM order_supplier_items 
            WHERE order_supplier_id = ? 
            ORDER BY batch_number ASC, created_at ASC
        `),
        
        add: db.prepare(`
            INSERT INTO order_supplier_items (
                order_supplier_id, product_id, product_name,
                unit_price, quantity, total_price, category, image_url,
                batch_number, item_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),

        update: db.prepare(`
            UPDATE order_supplier_items
            SET product_id = ?, product_name = ?, unit_price = ?,
                quantity = ?, total_price = ?, category = ?, image_url = ?,
                batch_number = ?, item_status = ?
            WHERE id = ?
        `),

        updateItemStatus: db.prepare(`
            UPDATE order_supplier_items
            SET item_status = ?
            WHERE id = ?
        `),
        
        delete: db.prepare('DELETE FROM order_supplier_items WHERE id = ?'),
        
        deleteByOrderId: db.prepare('DELETE FROM order_supplier_items WHERE order_supplier_id = ?'),
        
        getTotalByOrderId: db.prepare(`
            SELECT SUM(total_price) as total 
            FROM order_supplier_items 
            WHERE order_supplier_id = ?
        `),
        
        getByOrderIdAndBatch: db.prepare(`
            SELECT * FROM order_supplier_items 
            WHERE order_supplier_id = ? AND batch_number = ?
            ORDER BY created_at ASC
        `),
        
        getBatchNumbersByOrderId: db.prepare(`
            SELECT DISTINCT batch_number 
            FROM order_supplier_items 
            WHERE order_supplier_id = ?
            ORDER BY batch_number ASC
        `),
        
        countBatchesByOrderId: db.prepare(`
            SELECT COUNT(DISTINCT batch_number) as batch_count
            FROM order_supplier_items 
            WHERE order_supplier_id = ?
        `),
        
        updateItemBatchNumber: db.prepare(`
            UPDATE order_supplier_items 
            SET batch_number = ?
            WHERE id = ?
        `),
        
        getBatchStatsByOrderId: db.prepare(`
            SELECT 
                batch_number,
                COUNT(*) as item_count,
                SUM(quantity) as total_quantity,
                SUM(total_price) as total_amount
            FROM order_supplier_items 
            WHERE order_supplier_id = ?
            GROUP BY batch_number
            ORDER BY batch_number ASC
        `),
        
        findItemInBatch: db.prepare(`
            SELECT * FROM order_supplier_items 
            WHERE order_supplier_id = ? 
            AND product_id = ? 
            AND batch_number = ?
        `),
        
        getTotalQuantityByProduct: db.prepare(`
            SELECT 
                product_id,
                product_name,
                SUM(quantity) as total_quantity
            FROM order_supplier_items 
            WHERE order_supplier_id = ? AND product_id = ?
            GROUP BY product_id, product_name
        `)
    },

    // Requêtes liées aux produits
    products: {
        getAll: db.prepare('SELECT * FROM products'),
        getById: db.prepare('SELECT * FROM products WHERE id = ?'),
        create: db.prepare(`
            INSERT INTO products (name, price, category, supplier, image_url, stock, origin_price, barcode) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `),
        update: db.prepare(`
            UPDATE products 
            SET name = ?, price = ?, category = ?, supplier = ?, image_url = ?, stock = ?, origin_price = ?, barcode = ?
            WHERE id = ?
        `),
        updateStock: db.prepare('UPDATE products SET stock = ? WHERE id = ?'),
        delete: db.prepare('DELETE FROM products WHERE id = ?')
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
            INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, category, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        getByOrder: db.prepare('SELECT * FROM order_items WHERE order_id = ?'),
        getByOrderAndStatus: db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status = ?'),
        updateStatus: db.prepare('UPDATE order_items SET status = ? WHERE id = ?'),
        updateQuantity: db.prepare('UPDATE order_items SET quantity = ? WHERE id = ?'),
        updateQuantityAndStatus: db.prepare('UPDATE order_items SET quantity = ?, status = ? WHERE id = ?'),
        deleteById: db.prepare('DELETE FROM order_items WHERE id = ?')
    },

    // Requêtes liées aux livraisons en attente
    pendingDeliveries: {
        add: db.prepare(`
            INSERT INTO pending_deliveries (user_id, product_id, product_name, product_price, quantity, category)
            VALUES (?, ?, ?, ?, ?, ?)
        `),
        getByUser: db.prepare('SELECT * FROM pending_deliveries WHERE user_id = ?'),
        remove: db.prepare('DELETE FROM pending_deliveries WHERE id = ?'),
        updateQuantity: db.prepare('UPDATE pending_deliveries SET quantity = ? WHERE id = ?'),
        findItem: db.prepare(`
            SELECT * FROM pending_deliveries
            WHERE user_id = ? AND product_id = ?
        `)
    },
    
    // Maintien des anciennes références pour la compatibilité
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
        INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, category, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    getOrderItems: db.prepare('SELECT * FROM order_items WHERE order_id = ?'),
    getOrderItemsByStatus: db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status = ?'),
    updateOrderItemStatus: db.prepare('UPDATE order_items SET status = ? WHERE id = ?'),
    updateOrderItemQuantity: db.prepare('UPDATE order_items SET quantity = ? WHERE id = ?'),
    updateOrderDate: db.prepare('UPDATE orders SET date = ? WHERE order_id = ?'),
    updateOrderDateAndReference: db.prepare('UPDATE orders SET date = ?, reference = ? WHERE order_id = ?'),
    addPendingDelivery: db.prepare(`
        INSERT INTO pending_deliveries (user_id, product_id, product_name, product_price, quantity, category)
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    getUserPendingDeliveries: db.prepare('SELECT * FROM pending_deliveries WHERE user_id = ?'),
    removePendingDelivery: db.prepare('DELETE FROM pending_deliveries WHERE id = ?'),
    updatePendingDeliveryQuantity: db.prepare('UPDATE pending_deliveries SET quantity = ? WHERE id = ?'),
    findPendingDeliveryItem: db.prepare(`
        SELECT * FROM pending_deliveries
        WHERE user_id = ? AND product_id = ?
    `),

    // Requêtes liées aux dépenses
    expenses: {
        getAll: db.prepare('SELECT * FROM expenses ORDER BY date DESC'),
        getByYear: db.prepare("SELECT * FROM expenses WHERE strftime('%Y', date) = ? ORDER BY date DESC"),
        getById: db.prepare('SELECT * FROM expenses WHERE id = ?'),
        create: db.prepare(`
            INSERT INTO expenses (amount, date, category, description)
            VALUES (?, ?, ?, ?)
        `),
        createWithSupplierPayment: db.prepare(`
            INSERT INTO expenses (amount, date, category, description, supplier_payment_id)
            VALUES (?, ?, 'fournisseurs', ?, ?)
        `),
        createWithTransportPayment: db.prepare(`
            INSERT INTO expenses (amount, date, category, description, transport_payment_id)
            VALUES (?, ?, 'transporteur', ?, ?)
        `),
        update: db.prepare(`
            UPDATE expenses
            SET amount = ?, date = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `),
        delete: db.prepare('DELETE FROM expenses WHERE id = ?'),
        getBySupplierPaymentId: db.prepare('SELECT * FROM expenses WHERE supplier_payment_id = ?'),
        deleteBySupplierPaymentId: db.prepare('DELETE FROM expenses WHERE supplier_payment_id = ?'),
        deleteByTransportPaymentId: db.prepare('DELETE FROM expenses WHERE transport_payment_id = ?'),
        getSummaryByYear: db.prepare(`
            SELECT category, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE strftime('%Y', date) = ?
            GROUP BY category
        `),
        getMonthlyByYear: db.prepare(`
            SELECT strftime('%m', date) as month, category, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE strftime('%Y', date) = ?
            GROUP BY strftime('%m', date), category
            ORDER BY month ASC
        `),
        getGrandTotalByYear: db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
            FROM expenses
            WHERE strftime('%Y', date) = ?
        `)
    },

    // Requêtes liées aux localisations clients (carte)
    clientLocations: {
        getAll: db.prepare('SELECT * FROM client_locations ORDER BY created_at DESC'),
        getById: db.prepare('SELECT * FROM client_locations WHERE id = ?'),
        create: db.prepare(`
            INSERT INTO client_locations (client_id, label, latitude, longitude, notes)
            VALUES (?, ?, ?, ?, ?)
        `),
        update: db.prepare(`
            UPDATE client_locations
            SET label = ?, latitude = ?, longitude = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `),
        delete: db.prepare('DELETE FROM client_locations WHERE id = ?')
    },

    // Requêtes liées à la wishlist
    wishlists: {
        getByUser: db.prepare('SELECT * FROM wishlists WHERE user_id = ? ORDER BY created_at DESC'),
        add: db.prepare(`
            INSERT OR IGNORE INTO wishlists (user_id, product_id, product_name, product_price, category, image_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `),
        remove: db.prepare('DELETE FROM wishlists WHERE id = ? AND user_id = ?'),
        removeByProductId: db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?'),
        findItem: db.prepare('SELECT * FROM wishlists WHERE user_id = ? AND product_id = ?'),
        countByUser: db.prepare('SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?')
    },

    // Requêtes liées aux tokens de réinitialisation de mot de passe
    passwordResetTokens: {
        create: db.prepare(`
            INSERT INTO password_reset_tokens (username, token, expires_at)
            VALUES (?, ?, ?)
        `),
        getByToken: db.prepare(`
            SELECT * FROM password_reset_tokens
            WHERE token = ? AND used = 0 AND expires_at > datetime('now')
        `),
        markUsed: db.prepare(`
            UPDATE password_reset_tokens SET used = 1 WHERE token = ?
        `),
        invalidateForUser: db.prepare(`
            UPDATE password_reset_tokens SET used = 1 WHERE username = ? AND used = 0
        `),
        cleanup: db.prepare(`
            DELETE FROM password_reset_tokens WHERE expires_at < datetime('now', '-1 day')
        `),
        getUserByEmail: db.prepare(`
            SELECT u.username, up.email, up.first_name
            FROM users u
            JOIN user_profiles up ON u.username = up.username
            WHERE up.email = ?
        `)
    }
};