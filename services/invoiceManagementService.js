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
                up.referral_source,
                o.date as order_date
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            LEFT JOIN orders o ON i.order_id = o.order_id
        `;
        
        query += `
            ORDER BY
                CASE
                    WHEN up.last_name IS NOT NULL THEN up.last_name
                    ELSE i.client_full_name
                END ASC,
                i.invoice_date DESC
        `;

        let invoices = db.db.prepare(query).all();

        // Filter by year in JavaScript to avoid SQLite strftime UTC vs local-timezone mismatch
        if (year) {
            const y = parseInt(year);
            invoices = invoices.filter(inv => new Date(inv.invoice_date).getFullYear() === y);
        }

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
        query += ` ORDER BY i.invoice_date DESC`;

        let invoices = db.db.prepare(query).all(...params);

        // Filter by year in JavaScript to avoid SQLite strftime UTC vs local-timezone mismatch
        if (year) {
            const y = parseInt(year);
            invoices = invoices.filter(inv => new Date(inv.invoice_date).getFullYear() === y);
        }
        const paymentsStmt = db.db.prepare(
            'SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date ASC, id ASC'
        );
        return invoices.map(invoice => ({
            ...invoice,
            displayName: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            shopName: invoice.shop_name || 'N/A',
            payments: paymentsStmt.all(invoice.id)
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
        const { amount_paid, amount_due, payment_status, paid_date, commission_status, due_date, invoice_date } = paymentData;

        const invoice = db.db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
        if (!invoice) {
            return { success: false, message: 'Facture non trouvée' };
        }

        // If only commission_status is being updated
        if (commission_status !== undefined && amount_paid === undefined && invoice_date === undefined && due_date === undefined) {
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
                    amount_paid = COALESCE(?, amount_paid),
                    amount_due = COALESCE(?, amount_due),
                    payment_status = COALESCE(?, payment_status),
                    paid_date = CASE WHEN ? IS NOT NULL THEN ? ELSE paid_date END,
                    due_date = CASE WHEN ? IS NOT NULL THEN ? ELSE due_date END,
                    invoice_date = CASE WHEN ? IS NOT NULL THEN ? ELSE invoice_date END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            updateStmt.run(
                amount_paid !== undefined ? amount_paid : null,
                amount_due !== undefined ? amount_due : null,
                payment_status || null,
                paid_date || null, paid_date || null,
                due_date || null, due_date || null,
                invoice_date || null, invoice_date || null,
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
        // Use JS date filtering to stay consistent with other functions (UTC vs local-timezone)
        const invoices = getAllInvoices(year);

        const stats = {
            total_invoices: invoices.length,
            paid_count: 0,
            unpaid_count: 0,
            partial_count: 0,
            total_amount: 0,
            total_paid: 0,
            total_due: 0
        };

        for (const inv of invoices) {
            if (inv.payment_status === 'paid') stats.paid_count++;
            else if (inv.payment_status === 'unpaid') stats.unpaid_count++;
            else if (inv.payment_status === 'partial') stats.partial_count++;
            stats.total_amount += parseFloat(inv.total_ttc) || 0;
            stats.total_paid += parseFloat(inv.amount_paid) || 0;
            stats.total_due += parseFloat(inv.amount_due) || 0;
        }

        return stats;
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
                SUM(CASE WHEN i.payment_status IN ('paid', 'partial') THEN i.amount_paid ELSE 0 END) * 0.10 as commission_total,
                SUM(CASE WHEN i.payment_status IN ('paid', 'partial') AND i.commission_status = 'received' THEN i.amount_paid ELSE 0 END) * 0.10 as commission_received
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
        `;

        query += `
            GROUP BY i.user_id
            ORDER BY
                COALESCE(up.referral_source, 'ZZZ') ASC,
                CASE
                    WHEN up.last_name IS NOT NULL THEN up.last_name
                    ELSE i.user_id
                END ASC
        `;

        let clients = db.db.prepare(query).all();

        // Filter by year in JavaScript to avoid SQLite strftime UTC vs local-timezone mismatch
        if (year) {
            const y = parseInt(year);
            // We need to re-aggregate after filtering, so fetch individual invoices instead
            const invoices = getAllInvoices(year.toString());
            const clientMap = new Map();
            for (const inv of invoices) {
                if (!clientMap.has(inv.user_id)) {
                    clientMap.set(inv.user_id, {
                        user_id: inv.user_id,
                        first_name: inv.first_name,
                        last_name: inv.last_name,
                        shop_name: inv.shop_name,
                        referral_source: inv.referral_source,
                        invoice_count: 0,
                        total_amount: 0,
                        total_paid: 0,
                        total_due: 0,
                        paid_count: 0,
                        unpaid_count: 0,
                        partial_count: 0,
                        commission_total: 0,
                        commission_received: 0
                    });
                }
                const c = clientMap.get(inv.user_id);
                c.invoice_count++;
                c.total_amount += parseFloat(inv.total_ttc) || 0;
                c.total_paid += parseFloat(inv.amount_paid) || 0;
                c.total_due += parseFloat(inv.amount_due) || 0;
                if (inv.payment_status === 'paid') c.paid_count++;
                else if (inv.payment_status === 'unpaid') c.unpaid_count++;
                else if (inv.payment_status === 'partial') c.partial_count++;
                if (inv.payment_status === 'paid' || inv.payment_status === 'partial') {
                    c.commission_total += (parseFloat(inv.amount_paid) || 0) * 0.10;
                    if (inv.commission_status === 'received') {
                        c.commission_received += (parseFloat(inv.amount_paid) || 0) * 0.10;
                    }
                }
            }
            clients = Array.from(clientMap.values()).sort((a, b) => {
                const refA = a.referral_source || 'ZZZ';
                const refB = b.referral_source || 'ZZZ';
                if (refA !== refB) return refA.localeCompare(refB);
                const nameA = a.last_name || a.user_id;
                const nameB = b.last_name || b.user_id;
                return nameA.localeCompare(nameB);
            });
        }

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
        // Use getAllInvoices + JS date filtering to stay consistent with
        // getMonthlyBreakdown (avoids SQLite strftime UTC vs local-timezone mismatch)
        const allInvoices = getAllInvoices(year.toString());

        const filtered = allInvoices.filter(invoice => {
            const d = new Date(invoice.invoice_date);
            return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
        });

        // Sort by invoice_date descending
        filtered.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));

        return filtered;
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

        query += ` ORDER BY i.invoice_date DESC`;

        let invoices = db.db.prepare(query).all();

        if (year) {
            const y = parseInt(year);
            invoices = invoices.filter(inv => new Date(inv.invoice_date).getFullYear() === y);
        }
        
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

function getPartialInvoices(year = null) {
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
            WHERE i.payment_status = 'partial'
        `;

        query += ` ORDER BY i.invoice_date DESC`;

        let invoices = db.db.prepare(query).all();

        if (year) {
            const y = parseInt(year);
            invoices = invoices.filter(inv => new Date(inv.invoice_date).getFullYear() === y);
        }

        return invoices.map(invoice => ({
            ...invoice,
            client_full_name: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            displayName: invoice.client_full_name || `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
            shopName: invoice.shop_name || 'N/A',
            email: invoice.email || 'N/A',
            phone: invoice.phone || 'N/A'
        }));
    } catch (error) {
        console.error('Error getting partial invoices:', error);
        throw error;
    }
}

function getInvoicePayments(invoiceId) {
    try {
        const payments = db.db.prepare(
            'SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date ASC, id ASC'
        ).all(invoiceId);
        return { success: true, payments };
    } catch (error) {
        console.error('Error getting invoice payments:', error);
        return { success: false, message: 'Erreur lors du chargement des paiements' };
    }
}

function _recalcInvoiceTotals(invoiceId) {
    const invoice = db.db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    if (!invoice) return;
    const row = db.db.prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM invoice_payments WHERE invoice_id = ?'
    ).get(invoiceId);
    const totalPaid = row.total;
    // Si la facture est en mode "comptabiliser", on ré-aligne HT/VAT/TTC sur le nouveau montant payé
    // pour garder l'invariant total_ttc = amount_paid. Le taux TVA d'origine est conservé.
    if (invoice.accounting_mode === 1 && invoice.original_subtotal_ht != null) {
        const origHt  = parseFloat(invoice.original_subtotal_ht) || 0;
        const origVat = parseFloat(invoice.original_vat_amount)  || 0;
        const vatRate = origHt > 0 ? origVat / origHt : 0;
        const newTtc = +totalPaid.toFixed(2);
        const newHt  = +(totalPaid / (1 + vatRate)).toFixed(2);
        const newVat = +(totalPaid - newHt).toFixed(2);
        const status = totalPaid <= 0 ? 'unpaid' : 'paid';
        let paidDate = invoice.paid_date;
        if (status === 'paid' && !invoice.paid_date) {
            const lastPayment = db.db.prepare(
                'SELECT payment_date FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC LIMIT 1'
            ).get(invoiceId);
            if (lastPayment) paidDate = lastPayment.payment_date;
        } else if (status !== 'paid') {
            paidDate = null;
        }
        db.db.prepare(`
            UPDATE invoices
            SET subtotal_ht = ?, vat_amount = ?, total_ttc = ?,
                amount_paid = ?, amount_due = 0,
                payment_status = ?, paid_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(newHt, newVat, newTtc, totalPaid, status, paidDate, invoiceId);
        return;
    }
    const amountDue = Math.max(0, invoice.total_ttc - totalPaid);
    let paymentStatus;
    if (totalPaid <= 0) {
        paymentStatus = 'unpaid';
    } else if (totalPaid >= invoice.total_ttc) {
        paymentStatus = 'paid';
    } else {
        paymentStatus = 'partial';
    }
    // Si fully paid, set paid_date to the most recent payment date
    let paidDate = invoice.paid_date;
    if (paymentStatus === 'paid' && !invoice.paid_date) {
        const lastPayment = db.db.prepare(
            'SELECT payment_date FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC LIMIT 1'
        ).get(invoiceId);
        if (lastPayment) paidDate = lastPayment.payment_date;
    } else if (paymentStatus !== 'paid') {
        paidDate = null;
    }
    db.db.prepare(`
        UPDATE invoices SET amount_paid = ?, amount_due = ?, payment_status = ?, paid_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(totalPaid, amountDue, paymentStatus, paidDate, invoiceId);
}

function addInvoicePayment(invoiceId, amount, payment_date) {
    try {
        const invoice = db.db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
        if (!invoice) return { success: false, message: 'Facture non trouvée' };
        db.db.prepare(
            'INSERT INTO invoice_payments (invoice_id, amount, payment_date) VALUES (?, ?, ?)'
        ).run(invoiceId, amount, payment_date);
        _recalcInvoiceTotals(invoiceId);
        return {
            success: true,
            invoice: getInvoiceDetails(invoiceId),
            payments: getInvoicePayments(invoiceId).payments
        };
    } catch (error) {
        console.error('Error adding invoice payment:', error);
        return { success: false, message: 'Erreur lors de l\'ajout du paiement' };
    }
}

/**
 * Active ou désactive le mode "comptabiliser" :
 *   - ON  : snapshot des valeurs HT/VAT/TTC d'origine dans original_*, puis recalcul
 *           pour que total_ttc = amount_paid en conservant le taux TVA d'origine.
 *           HT_new = paid / (1 + tauxTVA), VAT_new = paid - HT_new.
 *   - OFF : restaure HT/VAT/TTC depuis les colonnes original_*.
 * amount_paid n'est jamais modifié — il provient de invoice_payments.
 */
function toggleAccountingMode(invoiceId, enabled) {
    try {
        const invoice = db.db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
        if (!invoice) return { success: false, message: 'Facture non trouvée' };

        const wantOn = enabled ? 1 : 0;

        if (wantOn === 1) {
            const paid = parseFloat(invoice.amount_paid) || 0;
            if (paid <= 0) {
                return { success: false, message: 'Impossible de comptabiliser une facture sans paiement encaissé.' };
            }

            // Snapshot des valeurs originales seulement à la première activation
            const origHt  = invoice.original_subtotal_ht != null ? invoice.original_subtotal_ht : invoice.subtotal_ht;
            const origVat = invoice.original_vat_amount  != null ? invoice.original_vat_amount  : invoice.vat_amount;
            const origTtc = invoice.original_total_ttc   != null ? invoice.original_total_ttc   : invoice.total_ttc;

            // Taux TVA effectif basé sur l'original (évite la dérive en cas de toggles répétés)
            const origHtNum = parseFloat(origHt) || 0;
            const vatRate = origHtNum > 0 ? (parseFloat(origVat) || 0) / origHtNum : 0;

            const newHt  = +(paid / (1 + vatRate)).toFixed(2);
            const newVat = +(paid - newHt).toFixed(2);
            const newTtc = +paid.toFixed(2);

            // Snapshot du paid_date d'origine pour pouvoir le restaurer plus tard
            let paidDate = invoice.paid_date;
            if (!paidDate) {
                const lastPayment = db.db.prepare(
                    'SELECT payment_date FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC LIMIT 1'
                ).get(invoiceId);
                if (lastPayment) paidDate = lastPayment.payment_date;
            }

            db.db.prepare(`
                UPDATE invoices
                SET original_subtotal_ht = COALESCE(original_subtotal_ht, ?),
                    original_vat_amount  = COALESCE(original_vat_amount, ?),
                    original_total_ttc   = COALESCE(original_total_ttc, ?),
                    subtotal_ht = ?,
                    vat_amount  = ?,
                    total_ttc   = ?,
                    amount_due  = 0,
                    payment_status = 'paid',
                    paid_date = COALESCE(paid_date, ?),
                    accounting_mode = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(origHt, origVat, origTtc, newHt, newVat, newTtc, paidDate, invoiceId);
        } else {
            // Retour à l'original
            if (invoice.original_total_ttc == null) {
                // Jamais comptabilisé : juste s'assurer que le flag est à 0
                db.db.prepare('UPDATE invoices SET accounting_mode = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(invoiceId);
            } else {
                const restoredTtc = parseFloat(invoice.original_total_ttc) || 0;
                const paid = parseFloat(invoice.amount_paid) || 0;
                const restoredDue = Math.max(0, restoredTtc - paid);
                let restoredStatus;
                if (paid <= 0) restoredStatus = 'unpaid';
                else if (paid >= restoredTtc) restoredStatus = 'paid';
                else restoredStatus = 'partial';
                const restoredPaidDate = restoredStatus === 'paid' ? invoice.paid_date : null;

                db.db.prepare(`
                    UPDATE invoices
                    SET subtotal_ht = original_subtotal_ht,
                        vat_amount  = original_vat_amount,
                        total_ttc   = original_total_ttc,
                        amount_due  = ?,
                        payment_status = ?,
                        paid_date = ?,
                        accounting_mode = 0,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(restoredDue, restoredStatus, restoredPaidDate, invoiceId);
            }
        }

        return { success: true, invoice: getInvoiceDetails(invoiceId) };
    } catch (error) {
        console.error('Error toggling accounting mode:', error);
        return { success: false, message: 'Erreur lors du changement de mode comptabilisé' };
    }
}

function deleteInvoicePayment(paymentId) {
    try {
        const payment = db.db.prepare('SELECT * FROM invoice_payments WHERE id = ?').get(paymentId);
        if (!payment) return { success: false, message: 'Paiement non trouvé' };
        const invoiceId = payment.invoice_id;
        db.db.prepare('DELETE FROM invoice_payments WHERE id = ?').run(paymentId);
        _recalcInvoiceTotals(invoiceId);
        return {
            success: true,
            invoice: getInvoiceDetails(invoiceId),
            payments: getInvoicePayments(invoiceId).payments
        };
    } catch (error) {
        console.error('Error deleting invoice payment:', error);
        return { success: false, message: 'Erreur lors de la suppression du paiement' };
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
	getUnpaidInvoices,
    getPartialInvoices,
    getInvoicePayments,
    addInvoicePayment,
    deleteInvoicePayment,
    toggleAccountingMode
};