// backfill_invoices.js
// Script pour générer rétroactivement les factures manquantes

const Database = require('better-sqlite3');
const path = require('path');

// Ajustez ce chemin selon l'emplacement de votre base de données
const DB_PATH = path.join(__dirname, 'database/discado.db');

console.log('🔧 Connexion à la base de données...');
const db = new Database(DB_PATH);

/**
 * Génère un numéro de facture unique
 */
function generateInvoiceNumber() {
    try {
        // Récupérer le dernier numéro de facture
        const lastInvoice = db.prepare(`
            SELECT invoice_number 
            FROM invoices 
            ORDER BY id DESC 
            LIMIT 1
        `).get();
        
        let nextNumber = 1;
        
        if (lastInvoice && lastInvoice.invoice_number) {
            // Extraire le numéro (format: INV-YYYY-XXXX)
            const match = lastInvoice.invoice_number.match(/INV-(\d{4})-(\d+)/);
            if (match) {
                const year = parseInt(match[1]);
                const num = parseInt(match[2]);
                const currentYear = new Date().getFullYear();
                
                // Si c'est la même année, incrémenter, sinon recommencer à 1
                if (year === currentYear) {
                    nextNumber = num + 1;
                }
            }
        }
        
        const currentYear = new Date().getFullYear();
        const invoiceNumber = `INV-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
        
        return invoiceNumber;
    } catch (error) {
        console.error('❌ Erreur génération numéro facture:', error);
        // Fallback: utiliser timestamp
        return `INV-${new Date().getFullYear()}-${Date.now()}`;
    }
}

/**
 * Crée une facture pour une commande
 */
function createInvoiceForOrder(orderId, userId, deliveredItems, order) {
    try {
        // Récupérer le profil utilisateur
        const userProfile = db.prepare(`
            SELECT first_name, last_name 
            FROM user_profiles 
            WHERE username = ?
        `).get(userId);
        
        const clientFullName = userProfile 
            ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userId
            : userId;
        
        // Utiliser la date de la commande
        const invoiceDate = order.date;
        
        // Calculer le subtotal HT
        const subtotalHT = deliveredItems.reduce((sum, item) => {
            return sum + (item.product_price * item.quantity);
        }, 0);
        
        // Arrondir à 2 décimales
        const subtotalHTRounded = Math.round(subtotalHT * 100) / 100;
        
        // Calculer la TVA (8.1%) et arrondir au 5 centimes le plus proche
        const vatAmountBrut = subtotalHTRounded * 0.081;
        const vatAmount = Math.round(vatAmountBrut * 20) / 20;  // Arrondi au 0.05 CHF
        
        // Calculer le total TTC
        const totalTTC = subtotalHTRounded + vatAmount;
        
        // Calculer la due_date (invoice_date + 1 mois)
        const invoiceDateObj = new Date(invoiceDate);
        const dueDate = new Date(invoiceDateObj);
        dueDate.setMonth(dueDate.getMonth() + 1);
        
        // Générer le numéro de facture
        const invoiceNumber = generateInvoiceNumber();
        
        // Insérer la facture
        const insertInvoice = db.prepare(`
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
        
        insertInvoice.run(
            invoiceNumber,                  // invoice_number
            orderId,                        // order_id
            userId,                         // user_id
            clientFullName,                 // client_full_name
            invoiceDate,                    // invoice_date
            subtotalHTRounded,              // subtotal_ht
            vatAmount,                      // vat_amount
            totalTTC,                       // total_ttc
            'unpaid',                       // payment_status
            0,                              // amount_paid
            totalTTC,                       // amount_due
            dueDate.toISOString(),          // due_date
            null,                           // paid_date
            order.last_processed || order.date,  // created_at (utiliser last_processed)
            order.last_processed || order.date   // updated_at
        );
        
        console.log(`   ✅ Facture ${invoiceNumber} créée`);
        console.log(`      Client: ${clientFullName}`);
        console.log(`      Subtotal HT: ${subtotalHTRounded.toFixed(2)} CHF`);
        console.log(`      TVA 8.1%: ${vatAmount.toFixed(2)} CHF`);
        console.log(`      Total TTC: ${totalTTC.toFixed(2)} CHF`);
        
        return {
            success: true,
            invoiceNumber,
            totalTTC
        };
        
    } catch (error) {
        console.error(`   ❌ Erreur création facture:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Fonction principale
 */
function backfillInvoices() {
    console.log('\n📋 Recherche des commandes traitées sans facture...\n');
    
    // Récupérer toutes les commandes traitées (partial ou completed)
    const processedOrders = db.prepare(`
        SELECT * FROM orders 
        WHERE status IN ('partial', 'completed')
        ORDER BY date ASC
    `).all();
    
    console.log(`📦 ${processedOrders.length} commande(s) traitée(s) trouvée(s)\n`);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    // Utiliser une transaction pour toutes les opérations
    const processAll = db.transaction(() => {
        for (const order of processedOrders) {
            // Vérifier si une facture existe déjà
            const existingInvoice = db.prepare(`
                SELECT invoice_number 
                FROM invoices 
                WHERE order_id = ?
            `).get(order.order_id);
            
            if (existingInvoice) {
                console.log(`⏭️  Commande ${order.order_id} - Facture déjà existante (${existingInvoice.invoice_number})`);
                skipped++;
                continue;
            }
            
            // Récupérer les articles livrés
            const deliveredItems = db.prepare(`
                SELECT * FROM order_items 
                WHERE order_id = ? AND status = 'delivered'
            `).all(order.order_id);
            
            if (deliveredItems.length === 0) {
                console.log(`⚠️  Commande ${order.order_id} - Aucun article livré trouvé`);
                skipped++;
                continue;
            }
            
            console.log(`\n🔨 Traitement commande ${order.order_id} (${order.user_id})`);
            console.log(`   Date: ${new Date(order.date).toLocaleString('fr-CH')}`);
            console.log(`   ${deliveredItems.length} article(s) livré(s)`);
            
            // Créer la facture
            const result = createInvoiceForOrder(
                order.order_id,
                order.user_id,
                deliveredItems,
                order
            );
            
            if (result.success) {
                created++;
            } else {
                errors++;
            }
        }
    });
    
    try {
        processAll();
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 RÉSUMÉ');
        console.log('='.repeat(60));
        console.log(`✅ Factures créées: ${created}`);
        console.log(`⏭️  Factures déjà existantes: ${skipped}`);
        console.log(`❌ Erreurs: ${errors}`);
        console.log('='.repeat(60) + '\n');
        
        if (created > 0) {
            console.log('✨ Backfill terminé avec succès!');
        } else {
            console.log('ℹ️  Aucune facture à créer.');
        }
        
    } catch (error) {
        console.error('\n❌ ERREUR CRITIQUE:', error);
        throw error;
    }
}

// Exécution
try {
    backfillInvoices();
    db.close();
    console.log('\n🔒 Base de données fermée.\n');
} catch (error) {
    console.error('\n💥 Erreur fatale:', error);
    db.close();
    process.exit(1);
}