/**
 * Backfill product_id dans order_items et pending_deliveries
 * Associe chaque ligne à son produit via le nom (exact puis nom de base sans taille)
 * Usage: node scripts/backfill-product-id.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/discado.db');
const db = new Database(dbPath);

// Charge tous les produits une seule fois
const products = db.prepare('SELECT id, name FROM products').all();

function findProductId(productName) {
    // 1. Correspondance exacte
    const exact = products.find(p => p.name === productName);
    if (exact) return exact.id;

    // 2. Nom de base (retire le dernier " - {taille}" pour les textiles)
    if (productName.includes(' - ')) {
        const baseName = productName.substring(0, productName.lastIndexOf(' - '));
        const base = products.find(p => p.name === baseName);
        if (base) return base.id;
    }

    return null;
}

function backfillTable(tableName, nameColumn) {
    const rows = db.prepare(`SELECT id, ${nameColumn} FROM ${tableName} WHERE product_id IS NULL`).all();

    if (rows.length === 0) {
        console.log(`${tableName}: aucune ligne à mettre à jour.`);
        return;
    }

    const update = db.prepare(`UPDATE ${tableName} SET product_id = ? WHERE id = ?`);

    let updated = 0;
    let notFound = 0;

    const run = db.transaction(() => {
        for (const row of rows) {
            const productId = findProductId(row[nameColumn]);
            if (productId !== null) {
                update.run(productId, row.id);
                updated++;
            } else {
                console.warn(`  [?] Produit introuvable: "${row[nameColumn]}" (id=${row.id})`);
                notFound++;
            }
        }
    });

    run();

    console.log(`${tableName}: ${updated} mis à jour, ${notFound} non trouvés (sur ${rows.length} total).`);
}

console.log(`\nBackfill product_id — base: ${dbPath}\n`);
backfillTable('order_items', 'product_name');
backfillTable('pending_deliveries', 'product_name');
console.log('\nTerminé.\n');

db.close();
