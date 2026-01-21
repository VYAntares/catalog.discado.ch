// services/invoiceManagementService.js
const db = require('./db');

/**
 * Récupère toutes les factures avec les informations clients
 */
function getAllInvoices() {
    try {
        const invoices = db.db.prepare(`
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
            ORDER BY 
                CASE 
                    WHEN up.last_name IS NOT NULL THEN up.last_name
                    ELSE i.client_full_name
                END ASC,
                i.invoice_date DESC
        `).all();
        
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
function getClientInvoices(userId) {
    try {
        const invoices = db.db.prepare(`
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
            ORDER BY i.invoice_date DESC
        `).all(userId);
        
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
        const { amountPaid, paymentStatus, paidDate } = paymentData;
        
        const invoice = db.db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
        if (!invoice) {
            return { success: false, message: 'Facture non trouvée' };
        }
        
        const totalPaid = parseFloat(amountPaid);
        const totalDue = parseFloat(invoice.total_ttc);
        const newAmountDue = totalDue - totalPaid;
        
        let newStatus = paymentStatus;
        if (!newStatus) {
            if (totalPaid >= totalDue) {
                newStatus = 'paid';
            } else if (totalPaid > 0) {
                newStatus = 'partial';
            } else {
                newStatus = 'unpaid';
            }
        }
        
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
            totalPaid,
            newAmountDue,
            newStatus,
            paidDate || (newStatus === 'paid' ? new Date().toISOString() : null),
            invoiceId
        );
        
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
function getInvoiceStatistics() {
    try {
        const stats = db.db.prepare(`
            SELECT 
                COUNT(*) as total_invoices,
                SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                SUM(total_ttc) as total_amount,
                SUM(amount_paid) as total_paid,
                SUM(amount_due) as total_due
            FROM invoices
        `).get();
        
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
function getClientsSummary() {
    try {
        const clients = db.db.prepare(`
            SELECT 
                i.user_id,
                up.first_name,
                up.last_name,
                up.shop_name,
                COUNT(i.id) as invoice_count,
                SUM(i.total_ttc) as total_amount,
                SUM(i.amount_paid) as total_paid,
                SUM(i.amount_due) as total_due,
                SUM(CASE WHEN i.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN i.payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN i.payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            GROUP BY i.user_id
            ORDER BY 
                CASE 
                    WHEN up.last_name IS NOT NULL THEN up.last_name
                    ELSE i.user_id
                END ASC
        `).all();
        
        return clients.map(client => ({
            ...client,
            displayName: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.user_id,
            shopName: client.shop_name || 'N/A'
        }));
    } catch (error) {
        console.error('Error getting clients summary:', error);
        throw error;
    }
}

module.exports = {
    getAllInvoices,
    getClientInvoices,
    getInvoiceDetails,
    updatePaymentStatus,
    getInvoiceStatistics,
    getClientsSummary
};
