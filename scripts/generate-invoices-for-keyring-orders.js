// scripts/generate-invoices-for-keyring-orders.js
// Génère les factures pour les commandes créées par l'arrivage de porte-clefs
//
// Utilisation :
//   node scripts/generate-invoices-for-keyring-orders.js [order_id_pattern]
//   node scripts/generate-invoices-for-keyring-orders.js 260507    (génère pour toutes les commandes du 2026-05-07)
//   node scripts/generate-invoices-for-keyring-orders.js           (génère pour toutes les commandes sans facture)

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const dbModule = require('../services/db');
const userService = require('../services/userService');

/**
 * Génère le numéro de facture suivant
 */
function generateInvoiceNumber() {
    try {
        const lastInvoice = dbModule.db.prepare(`
            SELECT invoice_number
            FROM invoices
            ORDER BY id DESC
            LIMIT 1
        `).get();

        if (!lastInvoice) {
            return 'INV-1';
        }

        let nextNumber = 1;

        if (lastInvoice.invoice_number.startsWith('INV-')) {
            const match = lastInvoice.invoice_number.match(/INV-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        } else if (lastInvoice.invoice_number.match(/^\d{6}-\d{4}$/)) {
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

        return `INV-${nextNumber}`;
    } catch (error) {
        console.error('Erreur génération numéro facture:', error.message);
        const timestamp = Date.now().toString().slice(-6);
        return `INV-${timestamp}`;
    }
}

/**
 * Crée une facture pour une commande
 */
function createInvoiceForOrder(orderId) {
    try {
        // Récupérer la commande
        const order = dbModule.db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
        if (!order) {
            console.log(`  ⚠️  Commande ${orderId} non trouvée`);
            return false;
        }

        // Vérifier qu'il n'existe pas déjà une facture
        const existingInvoice = dbModule.db.prepare(
            'SELECT id FROM invoices WHERE order_id = ?'
        ).get(orderId);
        if (existingInvoice) {
            console.log(`  ℹ️  Facture déjà existante pour ${orderId}`);
            return false;
        }

        // Récupérer les articles de la commande
        const items = dbModule.db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
        if (items.length === 0) {
            console.log(`  ⚠️  Aucun article trouvé pour ${orderId}`);
            return false;
        }

        // Récupérer le profil utilisateur
        const userProfile = dbModule.db.prepare('SELECT * FROM user_profiles WHERE username = ?').get(order.user_id);
        const clientFullName = userProfile
            ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || order.user_id
            : order.user_id;

        // Calculer le subtotal HT
        const subtotalHT = items.reduce((sum, item) => {
            return sum + (item.product_price * item.quantity);
        }, 0);

        const subtotalHTRounded = Math.round(subtotalHT * 100) / 100;

        // Calculer la TVA (8.1%) et arrondir au 5 centimes le plus proche
        const vatAmountBrut = subtotalHTRounded * 0.081;
        const vatAmount = Math.round(vatAmountBrut * 20) / 20;

        // Calculer le total TTC
        const totalTTC = Math.round((subtotalHTRounded + vatAmount) * 100) / 100;

        // Calculer la due_date (invoice_date + 1 mois)
        const invoiceDateObj = new Date(order.date);
        const dueDate = new Date(invoiceDateObj);
        dueDate.setMonth(dueDate.getMonth() + 1);

        // Générer le numéro de facture
        const invoiceNumber = generateInvoiceNumber();

        // Insérer la facture
        const now = new Date().toISOString();
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

        const result = insertInvoice.run(
            invoiceNumber,
            orderId,
            order.user_id,
            clientFullName,
            order.date,
            subtotalHTRounded,
            vatAmount,
            totalTTC,
            'unpaid',
            0,
            totalTTC,
            dueDate.toISOString(),
            null,
            now,
            now
        );

        console.log(`  ✅ Facture ${invoiceNumber} créée - ${totalTTC.toFixed(2)} CHF`);
        return true;

    } catch (error) {
        console.error(`  ❌ Erreur création facture pour ${orderId}:`, error.message);
        return false;
    }
}

/**
 * Récupère les commandes correspondant au pattern
 */
function getOrdersToProcess(datePattern) {
    let query = 'SELECT order_id, date, user_id FROM orders WHERE status = \'pending\'';
    let params = [];

    if (datePattern) {
        // Si un pattern de date est fourni (ex: 260507), chercher les commandes de ce jour
        query += ' AND order_id LIKE ?';
        params.push(`${datePattern}-%`);
    }

    // Filtrer les commandes sans facture
    query += ' AND order_id NOT IN (SELECT order_id FROM invoices)';
    query += ' ORDER BY date DESC';

    const stmt = dbModule.db.prepare(query);
    return params.length > 0 ? stmt.all(...params) : stmt.all();
}

/**
 * Main
 */
function main() {
    const datePattern = process.argv[2];

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  📄 GÉNÉRATION DE FACTURES POUR ARRIVAGE');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // Récupérer les commandes
        const orders = getOrdersToProcess(datePattern);

        if (orders.length === 0) {
            const msg = datePattern
                ? `Aucune commande du ${datePattern} sans facture`
                : 'Aucune commande sans facture';
            console.log(`⚠️  ${msg}\n`);
            return;
        }

        console.log(`📦 Trouvé ${orders.length} commande(s) à traiter\n`);

        let createdCount = 0;
        let skippedCount = 0;
        const invoices = [];

        for (const order of orders) {
            const orderDate = new Date(order.date).toISOString().split('T')[0];
            console.log(`\n📋 Commande: ${order.order_id} (${orderDate})`);

            if (createInvoiceForOrder(order.order_id)) {
                createdCount++;
                invoices.push(order.order_id);
            } else {
                skippedCount++;
            }
        }

        // Résumé
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  ✅ RÉSUMÉ');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`Factures créées: ${createdCount}`);
        console.log(`Factures sautées: ${skippedCount}`);

        if (invoices.length > 0) {
            console.log(`\nCommandes avec facture créée:`);
            for (const orderId of invoices) {
                const invoice = dbModule.db.prepare(
                    'SELECT invoice_number, total_ttc FROM invoices WHERE order_id = ?'
                ).get(orderId);
                console.log(`  - ${orderId}: ${invoice.invoice_number} (${invoice.total_ttc.toFixed(2)} CHF)`);
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

main();
