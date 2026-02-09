// services/invoiceManagementService.js
const db = require('./db');

/**
 * Récupère toutes les factures avec les informations clients
 */
function getAllInvoices(year = null) {
    try {
        let query = `
            SELECT 
                i.*,
                up.first_name,
                up.last_name,
                up.shop_name,
                up.email,
                up.phone,
                o.date as order_date
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            LEFT JOIN orders o ON i.order_id = o.order_id
        `;
        
        const params = [];
        if (year) {
            query += ` WHERE strftime('%Y', i.invoice_date) = ?`;
            params.push(year.toString());
        }
        
        query += `
            ORDER BY 
                CASE 
                    WHEN up.last_name IS NOT NULL THEN up.last_name
                    ELSE i.client_full_name
                END ASC,
                i.invoice_date DESC
        `;
        
        const invoices = db.db.prepare(query).all(...params);
        
        return invoices.map(invoice => ({
            ...invoice,
            displayName: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            shopName: invoice.shop_name || 'N/A',
            email: invoice.email || 'N/A',
            phone: invoice.phone || 'N/A'
        }));
    } catch (error) {
        console.error('Error getting all invoices:', error);
        throw error;
    }
}

/**
 * Récupère les factures d'un client spécifique
 */
function getClientInvoices(userId, year = null) {
    try {
        let query = `
            SELECT 
                i.*,
                up.first_name,
                up.last_name,
                up.shop_name,
                up.email,
                up.phone,
                o.date as order_date
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            LEFT JOIN orders o ON i.order_id = o.order_id
            WHERE i.user_id = ?
        `;
        
        const params = [userId];
        if (year) {
            query += ` AND strftime('%Y', i.invoice_date) = ?`;
            params.push(year.toString());
        }
        
        query += ` ORDER BY i.invoice_date DESC`;
        
        const invoices = db.db.prepare(query).all(...params);
        
        return invoices.map(invoice => ({
            ...invoice,
            displayName: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            shopName: invoice.shop_name || 'N/A'
        }));
    } catch (error) {
        console.error('Error getting client invoices:', error);
        throw error;
    }
}

/**
 * Récupère les détails d'une facture
 */
function getInvoiceDetails(invoiceId) {
    try {
        const invoice = db.db.prepare(`
            SELECT 
                i.*,
                up.first_name,
                up.last_name,
                up.shop_name,
                up.shop_address,
                up.shop_city,
                up.shop_zip_code,
                up.email,
                up.phone,
                o.date as order_date
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            LEFT JOIN orders o ON i.order_id = o.order_id
            WHERE i.id = ?
        `).get(invoiceId);
        
        if (!invoice) return null;
        
        return {
            ...invoice,
            displayName: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            shopName: invoice.shop_name || 'N/A'
        };
    } catch (error) {
        console.error('Error getting invoice details:', error);
        throw error;
    }
}

/**
 * Met à jour le statut de paiement d'une facture
 */
function updatePaymentStatus(invoiceId, paymentData) {
    try {
        const { amount_paid, amount_due, payment_status, paid_date, commission_status } = paymentData;

        const invoice = db.db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
        if (!invoice) {
            return { success: false, message: 'Facture non trouvée' };
        }

        // If only commission_status is being updated
        if (commission_status !== undefined && amount_paid === undefined) {
            const updateCommissionStmt = db.db.prepare(`
                UPDATE invoices
                SET
                    commission_status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            updateCommissionStmt.run(commission_status, invoiceId);
        } else {
            const updateStmt = db.db.prepare(`
                UPDATE invoices
                SET
                    amount_paid = ?,
                    amount_due = ?,
                    payment_status = ?,
                    paid_date = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            updateStmt.run(
                amount_paid,
                amount_due,
                payment_status,
                paid_date || null,
                invoiceId
            );
        }
        
        return { 
            success: true, 
            message: 'Statut de paiement mis à jour',
            invoice: getInvoiceDetails(invoiceId)
        };
    } catch (error) {
        console.error('Error updating payment status:', error);
        return { success: false, message: 'Erreur lors de la mise à jour' };
    }
}

/**
 * Récupère les statistiques globales
 */
function getInvoiceStatistics(year = null) {
    try {
        let query = `
            SELECT 
                COUNT(*) as total_invoices,
                SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                SUM(total_ttc) as total_amount,
                SUM(amount_paid) as total_paid,
                SUM(amount_due) as total_due
            FROM invoices
        `;
        
        const params = [];
        if (year) {
            query += ` WHERE strftime('%Y', invoice_date) = ?`;
            params.push(year.toString());
        }
        
        const stats = db.db.prepare(query).get(...params);
        
        return stats || {
            total_invoices: 0,
            paid_count: 0,
            unpaid_count: 0,
            partial_count: 0,
            total_amount: 0,
            total_paid: 0,
            total_due: 0
        };
    } catch (error) {
        console.error('Error getting invoice statistics:', error);
        throw error;
    }
}

/**
 * Récupère la liste des clients avec leurs totaux de factures
 */
function getClientsSummary(year = null) {
    try {
        let query = `
            SELECT
                i.user_id,
                up.first_name,
                up.last_name,
                up.shop_name,
                up.referral_source,
                COUNT(i.id) as invoice_count,
                SUM(i.total_ttc) as total_amount,
                SUM(i.amount_paid) as total_paid,
                SUM(i.amount_due) as total_due,
                SUM(CASE WHEN i.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN i.payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN i.payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                SUM(CASE WHEN i.payment_status = 'paid' THEN i.total_ttc ELSE 0 END) * 0.10 as commission_total,
                SUM(CASE WHEN i.payment_status = 'paid' AND i.commission_status = 'received' THEN i.total_ttc ELSE 0 END) * 0.10 as commission_received
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
        `;

        const params = [];
        if (year) {
            query += ` WHERE strftime('%Y', i.invoice_date) = ?`;
            params.push(year.toString());
        }

        query += `
            GROUP BY i.user_id
            ORDER BY
                COALESCE(up.referral_source, 'ZZZ') ASC,
                CASE
                    WHEN up.last_name IS NOT NULL THEN up.last_name
                    ELSE i.user_id
                END ASC
        `;

        const clients = db.db.prepare(query).all(...params);

        return clients.map(client => ({
            ...client,
            client_full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.user_id,
            displayName: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.user_id,
            shopName: client.shop_name || 'N/A',
            referral_source: client.referral_source || 'Non défini'
        }));
    } catch (error) {
        console.error('Error getting clients summary:', error);
        throw error;
    }
}

/**
 * Obtenir le détail des ventes par mois pour une année donnée
 * @param {number|null} year - Année à filtrer (null = toutes)
 * @param {string} type - Type de données ('total_amount', 'total_paid', 'total_due', 'total_invoices')
 * @returns {Object} Données mensuelles et résumé
 */
function getMonthlyBreakdown(year = null, type = 'total_amount') {
    try {
        // Récupérer toutes les factures (filtrées par année si spécifié)
        const invoices = getAllInvoices(year);
        
        // Initialiser les données pour les 12 mois
        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            invoice_count: 0,
            total_ht: 0,
            total_vat: 0,
            total_ttc: 0,
            total_paid: 0,
            total_due: 0
        }));

        // Agréger les données par mois
        invoices.forEach(invoice => {
            const month = new Date(invoice.invoice_date).getMonth(); // 0-11
            
            monthlyData[month].invoice_count++;
            monthlyData[month].total_ht += parseFloat(invoice.subtotal_ht) || 0;
            monthlyData[month].total_vat += parseFloat(invoice.vat_amount) || 0;
            monthlyData[month].total_ttc += parseFloat(invoice.total_ttc) || 0;
            monthlyData[month].total_paid += parseFloat(invoice.amount_paid) || 0;
            monthlyData[month].total_due += parseFloat(invoice.amount_due) || 0;
        });

        // Ne garder que les mois qui ont des données
        const activeMonths = monthlyData.filter(month => month.invoice_count > 0);

        // Calculer le résumé selon le type demandé
        const summary = {
            total: 0,
            invoice_count: invoices.length
        };

        switch(type) {
            case 'total_amount':
                summary.total = activeMonths.reduce((sum, m) => sum + m.total_ttc, 0);
                break;
            case 'total_paid':
                summary.total = activeMonths.reduce((sum, m) => sum + m.total_paid, 0);
                break;
            case 'total_due':
                summary.total = activeMonths.reduce((sum, m) => sum + m.total_due, 0);
                break;
            case 'total_invoices':
                summary.total = summary.invoice_count;
                break;
        }

        return {
            months: activeMonths,
            summary: summary,
            year: year,
            type: type
        };
    } catch (error) {
        console.error('Error getting monthly breakdown:', error);
        throw error;
    }
}

/**
 * Obtenir les factures détaillées d'un mois spécifique
 * @param {number} year - Année
 * @param {number} month - Mois (1-12)
 * @returns {Array} Liste des factures du mois
 */
function getMonthInvoices(year, month) {
    try {
        const query = `
            SELECT 
                i.*,
                up.first_name,
                up.last_name,
                up.shop_name,
                up.email,
                up.phone,
                o.date as order_date
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            LEFT JOIN orders o ON i.order_id = o.order_id
            WHERE strftime('%Y', i.invoice_date) = ?
            AND strftime('%m', i.invoice_date) = ?
            ORDER BY i.invoice_date DESC
        `;
        
        const yearStr = year.toString();
        const monthStr = month.toString().padStart(2, '0');
        
        const invoices = db.db.prepare(query).all(yearStr, monthStr);
        
        return invoices.map(invoice => ({
            ...invoice,
            client_full_name: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            displayName: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            shopName: invoice.shop_name || 'N/A',
            email: invoice.email || 'N/A',
            phone: invoice.phone || 'N/A'
        }));
    } catch (error) {
        console.error('Error getting month invoices:', error);
        throw error;
    }
}

/**
 * Récupère uniquement les factures NON PAYÉES (payment_status = 'unpaid')
 * @param {number|null} year - Année à filtrer (null = toutes)
 * @returns {Array} Liste des factures impayées
 */
function getUnpaidInvoices(year = null) {
    try {
        let query = `
            SELECT 
                i.*,
                up.first_name,
                up.last_name,
                up.shop_name,
                up.email,
                up.phone,
                o.date as order_date
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            LEFT JOIN orders o ON i.order_id = o.order_id
            WHERE i.payment_status = 'unpaid'
        `;
        
        const params = [];
        if (year) {
            query += ` AND strftime('%Y', i.invoice_date) = ?`;
            params.push(year.toString());
        }
        
        query += ` ORDER BY i.invoice_date DESC`;
        
        const invoices = db.db.prepare(query).all(...params);
        
        return invoices.map(invoice => ({
            ...invoice,
            client_full_name: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            displayName: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            shopName: invoice.shop_name || 'N/A',
            email: invoice.email || 'N/A',
            phone: invoice.phone || 'N/A'
        }));
    } catch (error) {
        console.error('Error getting unpaid invoices:', error);
        throw error;
    }
}

module.exports = {
    getAllInvoices,
    getClientInvoices,
    getInvoiceDetails,
    updatePaymentStatus,
    getInvoiceStatistics,
    getClientsSummary,
    getMonthlyBreakdown,
	getMonthInvoices,  // ← NOUVELLE FONCTION AJOUTÉE
	getUnpaidInvoices
};