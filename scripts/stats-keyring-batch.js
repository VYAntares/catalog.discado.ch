// scripts/stats-keyring-batch.js
// Affiche les statistiques sur l'arrivage de porte-clefs
//
// Utilisation :
//   node scripts/stats-keyring-batch.js

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const dbModule = require('../services/db');

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

function getPendingDeliveriesStats() {
    const placeholders = KEYRING_REFERENCES.map(() => '?').join(',');
    const stats = dbModule.db.prepare(`
        SELECT
            COUNT(DISTINCT user_id) as client_count,
            COUNT(*) as item_count,
            SUM(quantity) as total_quantity,
            SUM(quantity * product_price) as total_value
        FROM pending_deliveries
        WHERE product_name IN (${placeholders})
    `).get(...KEYRING_REFERENCES);

    return stats;
}

function getOrdersStats(datePattern) {
    let query = 'SELECT COUNT(*) as count, SUM(SUM_total) as total FROM (';
    let params = [];

    query += `
        SELECT
            o.order_id,
            SUM(oi.product_price * oi.quantity) as SUM_total
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.user_id IN (
            SELECT DISTINCT user_id FROM pending_deliveries
            WHERE product_name IN (${KEYRING_REFERENCES.map(() => '?').join(',')})
        )
        AND o.order_id LIKE ?
    `;

    params = [...KEYRING_REFERENCES, datePattern + '-%'];

    query += ' GROUP BY o.order_id) subquery';

    const stmt = dbModule.db.prepare(query);
    return stmt.get(...params);
}

function getInvoicesStats(datePattern) {
    let query = `
        SELECT
            COUNT(*) as count,
            SUM(total_ttc) as total_ttc,
            SUM(vat_amount) as total_vat,
            SUM(subtotal_ht) as total_ht
        FROM invoices
        WHERE order_id LIKE ?
    `;

    const stmt = dbModule.db.prepare(query);
    return stmt.get(datePattern + '-%');
}

function getDetailedClientList(datePattern) {
    const placeholders = KEYRING_REFERENCES.map(() => '?').join(',');
    const clients = dbModule.db.prepare(`
        SELECT
            pd.user_id,
            COUNT(DISTINCT pd.product_name) as variety,
            COUNT(*) as item_count,
            SUM(pd.quantity) as total_qty,
            SUM(pd.quantity * pd.product_price) as pending_value,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(oi.product_price * oi.quantity) as order_total
        FROM pending_deliveries pd
        LEFT JOIN orders o ON o.user_id = pd.user_id AND o.order_id LIKE ?
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        WHERE pd.product_name IN (${placeholders})
        GROUP BY pd.user_id
        ORDER BY pending_value DESC
    `).all(datePattern + '-%', ...KEYRING_REFERENCES);

    return clients;
}

function getTopClients() {
    const placeholders = KEYRING_REFERENCES.map(() => '?').join(',');
    const topClients = dbModule.db.prepare(`
        SELECT
            pd.user_id,
            COUNT(DISTINCT pd.product_name) as product_variety,
            SUM(pd.quantity) as total_quantity,
            ROUND(SUM(pd.quantity * pd.product_price), 2) as total_value
        FROM pending_deliveries pd
        WHERE pd.product_name IN (${placeholders})
        GROUP BY pd.user_id
        ORDER BY total_value DESC
        LIMIT 10
    `).all(...KEYRING_REFERENCES);

    return topClients;
}

function main() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  📊 STATISTIQUES ARRIVAGE PORTE-CLEFS');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // Statistiques pending_deliveries
        const pendingStats = getPendingDeliveriesStats();
        console.log('📦 PENDING_DELIVERIES');
        console.log('─────────────────────────────────────────────────────────');
        console.log(`  Clients avec keyrings: ${pendingStats.client_count}`);
        console.log(`  Articles en attente: ${pendingStats.item_count}`);
        console.log(`  Quantité totale: ${pendingStats.total_quantity} unités`);
        console.log(`  Valeur totale: ${pendingStats.total_value.toFixed(2)} CHF`);

        // Statistiques orders
        const datePattern = '260507';
        const ordersStats = getOrdersStats(datePattern);
        console.log(`\n📋 COMMANDES CRÉÉES (${datePattern})`);
        console.log('─────────────────────────────────────────────────────────');
        if (ordersStats.count > 0) {
            console.log(`  Commandes créées: ${ordersStats.count}`);
            console.log(`  Montant total: ${ordersStats.total.toFixed(2)} CHF`);
            console.log(`  Montant moyen: ${(ordersStats.total / ordersStats.count).toFixed(2)} CHF`);
        } else {
            console.log(`  Aucune commande créée pour cette date`);
        }

        // Statistiques invoices
        const invoicesStats = getInvoicesStats(datePattern);
        console.log(`\n📄 FACTURES CRÉÉES (${datePattern})`);
        console.log('─────────────────────────────────────────────────────────');
        if (invoicesStats.count > 0) {
            console.log(`  Factures créées: ${invoicesStats.count}`);
            console.log(`  Montant HT: ${invoicesStats.total_ht.toFixed(2)} CHF`);
            console.log(`  TVA (8.1%): ${invoicesStats.total_vat.toFixed(2)} CHF`);
            console.log(`  Montant TTC: ${invoicesStats.total_ttc.toFixed(2)} CHF`);
        } else {
            console.log(`  Aucune facture créée pour cette date`);
        }

        // Top 10 clients
        const topClients = getTopClients();
        console.log(`\n🏆 TOP 10 CLIENTS PAR VALEUR`);
        console.log('─────────────────────────────────────────────────────────');
        topClients.forEach((client, index) => {
            console.log(`  ${(index + 1).toString().padEnd(2)}. ${client.user_id.padEnd(30)} ${client.product_variety}x variétés, ${client.total_quantity} unités → ${client.total_value.toFixed(2)} CHF`);
        });

        // Résumé général
        console.log(`\n📊 RÉSUMÉ GÉNÉRAL`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`  Références de keyrings traitées: ${KEYRING_REFERENCES.length}`);
        console.log(`  Clients concernés: ${pendingStats.client_count}`);
        console.log(`  Montant total en attente: ${pendingStats.total_value.toFixed(2)} CHF`);
        if (ordersStats.count > 0) {
            console.log(`  Commandes créées: ${ordersStats.count}`);
            console.log(`  Factures créées: ${invoicesStats.count || 0}`);
            const percentageProcessed = (invoicesStats.count / ordersStats.count * 100).toFixed(1);
            console.log(`  Progression: ${percentageProcessed}% traité`);
        }
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

main();
