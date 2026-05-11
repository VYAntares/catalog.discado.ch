// scripts/process-keyring-batch.js
// Traite un arrivage de porte-clefs (keyrings) en créant des commandes pour les clients
// qui ont des keyrings en pending_deliveries
//
// Utilisation :
//   node scripts/process-keyring-batch.js

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const dbModule = require('../services/db');
const userService = require('../services/userService');
const fs = require('fs');

// Gestionnaire du compteur de commandes (copié de orderService)
class OrderCounter {
    constructor() {
        this.counterFilePath = require('path').join(__dirname, '../data/orderCounter.json');
    }

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
        return 1;
    }

    saveCounter(counter) {
        try {
            const dir = require('path').dirname(this.counterFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.counterFilePath, JSON.stringify({ counter }, null, 2), 'utf8');
        } catch (error) {
            // Silencieux en cas d'erreur
        }
    }

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
    }
}

const orderCounter = new OrderCounter();

// Références des porte-clefs en arrivage
const KEYRING_REFERENCES = [
    'Keyring 7 - Cow edelweiss bottle opener',
    'Keyring 8 - Edelweiss swiss heart',
    'Keyring 10 - ringged dice',
    'Keyring 14 - Edelweiss chained Bell gold',
    'Keyring 14 - Edelweiss chained Bell gold slimer',
    'Keyring 14 - Edelweiss chained Bell silver',
    'Keyring 17 - Swiss sneaker label',
    'Keyring 22 - mosaic heart',
    'Keyring 24 - cow chocolate edelweiss label',
    'Keyring 26 - Watch switzerland label GOLD',
    'Keyring 26 - Watch switzerland label SILVER',
    'Keyring 32 - nail clippers',
    'Keyring 33 - Swiss Key',
    'Keyring 34 - white bear I love swiss',
    'Keyring 44 - swiss flag St-Bernard',
    'Keyring 50 - heart letter swiss',
    'Keyring 56G - swiss shield Gold',
    'Keyring 56S - swiss shield Silver',
    'Keyring 58 - Bern coat of arm',
    'Keyring 61 - Love switzerland white cross',
    'Keyring 65 - Nail clipper',
    'Keyring 74 - Edelweiss. cow and bell',
    'Keyring 78 - Tool Swiss army knife',
    'Keyring 83 - Swiss knife poya',
    'Keyring 85 - wooden swiss army knife',
    'Keyring 86 - swiss army knife',
    'Keyring 87 - Heart shaped switzerland',
    'Keyring 90 - compass bottle opener',
    'Keyring 91 - poya swiss army knife',
    'Keyring 99 - Dookie skiing',
    'Keyring 101 - I love Swiss',
    'Keyring 102 - Swiss Ski'
];

/**
 * Récupère tous les clients qui ont des keyrings en pending_deliveries
 */
function getClientsWithKeyringDeliveries() {
    const placeholders = KEYRING_REFERENCES.map(() => '?').join(',');
    const query = `
        SELECT DISTINCT user_id
        FROM pending_deliveries
        WHERE product_name IN (${placeholders})
        ORDER BY user_id
    `;

    const stmt = dbModule.db.prepare(query);
    const clients = stmt.all(...KEYRING_REFERENCES);

    console.log(`\n📦 Trouvé ${clients.length} clients avec des porte-clefs en pending_deliveries\n`);
    return clients.map(c => c.user_id);
}

/**
 * Récupère les articles en pending_deliveries pour un client spécifique
 */
function getClientKeyringItems(userId) {
    const placeholders = KEYRING_REFERENCES.map(() => '?').join(',');
    const query = `
        SELECT
            id as pending_delivery_id,
            product_id,
            product_name,
            product_price,
            quantity,
            category,
            size
        FROM pending_deliveries
        WHERE user_id = ? AND product_name IN (${placeholders})
        ORDER BY product_name
    `;

    const stmt = dbModule.db.prepare(query);
    return stmt.all(userId, ...KEYRING_REFERENCES);
}

/**
 * Vérifie si l'utilisateur existe et récupère ses informations
 */
function validateUser(userId) {
    const user = dbModule.db.prepare('SELECT * FROM users WHERE username = ?').get(userId);
    const profile = dbModule.db.prepare('SELECT * FROM user_profiles WHERE username = ?').get(userId);

    if (!user) {
        console.log(`⚠️  Utilisateur ${userId} n'existe pas dans la base`);
        return null;
    }

    return { user, profile };
}

/**
 * Crée une nouvelle commande pour un client
 */
function createOrderForClient(userId, keyringItems) {
    try {
        const orderId = orderCounter.generateOrderId();
        const now = new Date().toISOString();

        console.log(`\n📝 Création commande ${orderId} pour ${userId}`);

        // Créer la commande
        const insertOrder = dbModule.db.prepare(
            'INSERT INTO orders (order_id, user_id, status, date, reference) VALUES (?, ?, ?, ?, ?)'
        );

        insertOrder.run(orderId, userId, 'pending', now, '');
        console.log(`   ✅ Commande créée`);

        // Ajouter les articles à la commande
        let totalAmount = 0;
        const insertItem = dbModule.db.prepare(`
            INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, category, status, size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of keyringItems) {
            const quantity = item.quantity;
            const price = item.product_price;
            const itemTotal = quantity * price;

            insertItem.run(
                orderId,
                item.product_id || null,
                item.product_name,
                price,
                quantity,
                item.category || 'keyring',
                'pending',
                item.size || null
            );

            totalAmount += itemTotal;
            console.log(`   + ${item.product_name}: ${quantity}x @ ${price} CHF = ${itemTotal.toFixed(2)} CHF`);
        }

        console.log(`   💰 Total: ${totalAmount.toFixed(2)} CHF`);

        return {
            orderId,
            date: now,
            itemCount: keyringItems.length,
            totalAmount
        };

    } catch (error) {
        console.error(`❌ Erreur création commande pour ${userId}:`, error.message);
        throw error;
    }
}

/**
 * Supprime les articles en pending_deliveries qui ont été traités
 */
function removePendingDeliveryItems(pendingDeliveryIds) {
    if (pendingDeliveryIds.length === 0) return;

    const deleteStmt = dbModule.db.prepare('DELETE FROM pending_deliveries WHERE id = ?');

    for (const id of pendingDeliveryIds) {
        deleteStmt.run(id);
    }

    console.log(`   🗑️  ${pendingDeliveryIds.length} articles supprimés de pending_deliveries`);
}

/**
 * Main: Traite l'arrivage de porte-clefs
 */
function processKeyringBatch() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  🔑 TRAITEMENT ARRIVAGE PORTE-CLEFS');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        // Étape 1: Trouver tous les clients avec keyrings en pending_deliveries
        const clientUserIds = getClientsWithKeyringDeliveries();

        if (clientUserIds.length === 0) {
            console.log('\n⚠️  Aucun client avec keyrings en pending_deliveries');
            console.log('\nFin du traitement.\n');
            return;
        }

        // Étape 2: Créer une commande pour chaque client
        let processedCount = 0;
        let totalOrders = 0;
        let totalAmount = 0;
        const createdOrders = [];

        for (const userId of clientUserIds) {
            // Vérifier que l'utilisateur existe
            const userInfo = validateUser(userId);
            if (!userInfo) {
                console.log(`⏭️  Utilisateur ${userId} invalide, ignoré\n`);
                continue;
            }

            // Récupérer les keyrings en pending_deliveries
            const keyringItems = getClientKeyringItems(userId);

            if (keyringItems.length === 0) {
                console.log(`⏭️  Aucun keyring trouvé pour ${userId}\n`);
                continue;
            }

            // Créer la commande
            const orderResult = createOrderForClient(userId, keyringItems);

            // Supprimer les articles de pending_deliveries
            const pendingIds = keyringItems.map(item => item.pending_delivery_id);
            removePendingDeliveryItems(pendingIds);

            createdOrders.push(orderResult);
            processedCount++;
            totalOrders++;
            totalAmount += orderResult.totalAmount;

            console.log(`   ✨ Commande ${orderResult.orderId} complétée\n`);
        }

        // Étape 3: Résumé
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  ✅ RÉSUMÉ DU TRAITEMENT');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`\nClients traités: ${processedCount}/${clientUserIds.length}`);
        console.log(`Commandes créées: ${totalOrders}`);
        console.log(`Montant total: ${totalAmount.toFixed(2)} CHF`);
        console.log(`\nRéférences de porte-clefs traitées: ${KEYRING_REFERENCES.length}`);

        if (createdOrders.length > 0) {
            console.log(`\nCommandes créées:`);
            for (const order of createdOrders) {
                const date = new Date(order.date).toISOString().split('T')[0];
                console.log(`  - ${order.orderId} (${date}): ${order.itemCount} articles, ${order.totalAmount.toFixed(2)} CHF`);
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════\n');
        console.log('📌 À faire maintenant:');
        console.log('   1. Vérifier les commandes dans l\'interface');
        console.log('   2. Générer les factures pour les commandes');
        console.log('   3. Envoyer les commandes aux clients\n');

    } catch (error) {
        console.error('\n❌ ERREUR CRITIQUE:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Lancer le script
processKeyringBatch();
