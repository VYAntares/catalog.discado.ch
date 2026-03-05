// services/statsService.js - Service de gestion des statistiques
const dbModule = require('./db');

class StatsService {
    /**
     * Récupère les statistiques générales pour une année
     */
    getYearlyOverview(year) {
        let query;
        let params = [];

        if (year) {
            // Pour une année spécifique
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            query = `
                SELECT
                    COUNT(DISTINCT i.invoice_number) as invoice_count,
                    COUNT(DISTINCT i.user_id) as client_count,
                    COALESCE(SUM(i.total_ttc), 0) as total_revenue,
                    COALESCE(SUM(i.amount_paid), 0) as total_paid,
                    COALESCE(SUM(i.amount_due), 0) as total_due,
                    COUNT(DISTINCT CASE WHEN i.payment_status != 'paid' THEN i.invoice_number END) as unpaid_count,
                    COALESCE(AVG(i.total_ttc), 0) as average_order_value
                FROM invoices i
                WHERE DATE(i.invoice_date) BETWEEN ? AND ?
            `;
            params = [startDate, endDate];
        } else {
            // Pour toutes les années
            query = `
                SELECT
                    COUNT(DISTINCT i.invoice_number) as invoice_count,
                    COUNT(DISTINCT i.user_id) as client_count,
                    COALESCE(SUM(i.total_ttc), 0) as total_revenue,
                    COALESCE(SUM(i.amount_paid), 0) as total_paid,
                    COALESCE(SUM(i.amount_due), 0) as total_due,
                    COUNT(DISTINCT CASE WHEN i.payment_status != 'paid' THEN i.invoice_number END) as unpaid_count,
                    COALESCE(AVG(i.total_ttc), 0) as average_order_value
                FROM invoices i
            `;
        }

        const stmt = dbModule.db.prepare(query);
        const row = stmt.get(...params);

        return {
            invoiceCount: row.invoice_count || 0,
            clientCount: row.client_count || 0,
            totalRevenue: row.total_revenue || 0,
            totalPaid: row.total_paid || 0,
            totalDue: row.total_due || 0,
            unpaidCount: row.unpaid_count || 0,
            averageOrderValue: row.average_order_value || 0
        };
    }

    /**
     * Récupère les produits les plus vendus
     */
    getTopProducts({ year, category, limit = 10 }) {
        let whereClause = '';
        const params = [];
    
        if (year) {
            whereClause += ` AND strftime('%Y', o.date) = ?`;
            params.push(year.toString());
        }
    
        if (category) {
            whereClause += ` AND oi.category = ?`;
            params.push(category);
        }
    
        params.push(limit);
    
        // Groupement par product_id quand disponible (aggrège les variantes de taille),
        // sinon par product_name (anciennes commandes sans product_id)
        const query = `
            SELECT
                COALESCE(p.name, oi.product_name) AS product_name,
                oi.product_id,
                oi.category,
                SUM(CASE WHEN oi.status = 'delivered' THEN oi.quantity ELSE 0 END) AS total_delivered,
                SUM(CASE WHEN oi.status = 'delivered' THEN oi.product_price * oi.quantity ELSE 0 END) AS sum_total_delivered_price,
                ROUND(AVG(oi.product_price), 2) as unit_price
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            INNER JOIN orders o ON oi.order_id = o.order_id
            WHERE 1=1 ${whereClause}
            GROUP BY COALESCE(CAST(oi.product_id AS TEXT), oi.product_name), oi.category
        `;

        const deliveredStmt = dbModule.db.prepare(query);
        const deliveredRows = deliveredStmt.all(...params.slice(0, -1)); // Sans le limit

        // Pour chaque produit, récupérer les pending_deliveries
        // Utilise product_id quand disponible pour aggrèger toutes les tailles
        const results = deliveredRows.map(row => {
            let pendingWhereClause = '';
            const hasPid = !!row.product_id;
            const pendingParams = hasPid ? [row.product_id] : [row.product_name];

            // 🆕 Ajouter le filtre année si nécessaire
            if (year) {
                pendingWhereClause = ` AND strftime('%Y', created_at) = ?`;
                pendingParams.push(year.toString());
            }

            const pendingQuery = `
                SELECT
                    SUM(quantity) as total_remaining,
                    SUM(product_price * quantity) as sum_total_remaining_price
                FROM pending_deliveries
                WHERE ${hasPid ? 'product_id = ?' : 'product_name = ?'} ${pendingWhereClause}
            `;

            const pendingStmt = dbModule.db.prepare(pendingQuery);
            const pendingResult = pendingStmt.get(...pendingParams);
            
            const total_remaining = pendingResult?.total_remaining || 0;
            const sum_total_remaining_price = pendingResult?.sum_total_remaining_price || 0;
            
            return {
                ...row,
                total_remaining: total_remaining,
                total_quantity: row.total_delivered + total_remaining,
                sum_total_remaining_price: sum_total_remaining_price,
                sum_total_quantity_price: row.sum_total_delivered_price + sum_total_remaining_price
            };
        });
        
        // Trier par quantité totale et limiter
        return results
            .sort((a, b) => b.total_quantity - a.total_quantity)
            .slice(0, limit);
    }

    /**
     * Récupère l'évolution mensuelle du chiffre d'affaires
     */
    getMonthlyEvolution(year) {
        // Si aucune année n'est fournie, retourner toutes les années
        if (!year) {
            const query = `
                SELECT
                    strftime('%Y-%m', invoice_date) as year_month,
                    COUNT(invoice_number) as invoice_count,
                    COALESCE(SUM(total_ttc), 0) as total_revenue,
                    COALESCE(SUM(amount_paid), 0) as total_paid,
                    COALESCE(SUM(amount_due), 0) as total_due
                FROM invoices
                GROUP BY strftime('%Y-%m', invoice_date)
                ORDER BY year_month
            `;

            const stmt = dbModule.db.prepare(query);
            const rows = stmt.all();

            return rows.map(row => ({
                yearMonth: row.year_month,
                invoiceCount: row.invoice_count,
                totalRevenue: row.total_revenue,
                totalPaid: row.total_paid,
                totalDue: row.total_due
            }));
        }

        // Pour une année spécifique
        const query = `
            SELECT
                strftime('%m', invoice_date) as month,
                strftime('%Y-%m', invoice_date) as year_month,
                COUNT(invoice_number) as invoice_count,
                COALESCE(SUM(total_ttc), 0) as total_revenue,
                COALESCE(SUM(amount_paid), 0) as total_paid,
                COALESCE(SUM(amount_due), 0) as total_due
            FROM invoices
            WHERE strftime('%Y', invoice_date) = ?
            GROUP BY strftime('%Y-%m', invoice_date)
            ORDER BY year_month
        `;

        const stmt = dbModule.db.prepare(query);
        const rows = stmt.all(year.toString());

        // Créer un tableau avec tous les mois (1-12)
        const months = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];

        const result = months.map((monthName, index) => {
            const monthNumber = (index + 1).toString().padStart(2, '0');
            const data = rows.find(r => r.month === monthNumber);

            return {
                month: monthName,
                monthNumber: monthNumber,
                invoiceCount: data ? data.invoice_count : 0,
                totalRevenue: data ? data.total_revenue : 0,
                totalPaid: data ? data.total_paid : 0,
                totalDue: data ? data.total_due : 0
            };
        });

        return result;
    }

    /**
     * Récupère les meilleurs clients
     */
    getTopClients({ year, limit = 10 }) {
        let whereClause = '';
        const params = [];

        if (year) {
            whereClause = ` WHERE strftime('%Y', i.invoice_date) = ?`;
            params.push(year.toString());
        }

        params.push(limit);

        const query = `
            SELECT
                i.user_id,
                i.client_full_name,
                up.shop_name,
                COUNT(DISTINCT i.invoice_number) as total_orders,
                COALESCE(SUM(i.total_ttc), 0) as total_spent,
                COALESCE(SUM(i.amount_paid), 0) as total_paid,
                COALESCE(SUM(i.amount_due), 0) as total_due,
                COALESCE(AVG(i.total_ttc), 0) as average_order_value,
                MAX(i.invoice_date) as last_order_date
            FROM invoices i
            LEFT JOIN user_profiles up ON i.user_id = up.username
            ${whereClause}
            GROUP BY i.user_id, i.client_full_name, up.shop_name
            ORDER BY total_spent DESC
            LIMIT ?
        `;

        const stmt = dbModule.db.prepare(query);
        const rows = stmt.all(...params);

        return rows || [];
    }

    /**
     * Récupère les statistiques par catégorie
     */
    getCategoryStats(year) {
        let whereClause = '';
        const params = [];

        if (year) {
            whereClause = ` WHERE strftime('%Y', o.date) = ?`;
            params.push(year.toString());
        }

        const query = `
            SELECT
                oi.category,
                COUNT(DISTINCT oi.order_id) as order_count,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.product_price * oi.quantity) as total_revenue,
                AVG(oi.product_price) as avg_product_price,
                COUNT(DISTINCT oi.product_name) as product_variety
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.order_id
            ${whereClause}
            GROUP BY oi.category
            ORDER BY total_revenue DESC
        `;

        const stmt = dbModule.db.prepare(query);
        const rows = stmt.all(...params);

        return rows || [];
    }

    /**
     * Récupère les statistiques de paiement
     */
    getPaymentStats(year) {
        let whereClause = '';
        const params = [];

        if (year) {
            whereClause = ` WHERE strftime('%Y', invoice_date) = ?`;
            params.push(year.toString());
        }

        const query = `
            SELECT
                payment_status,
                COUNT(invoice_number) as count,
                COALESCE(SUM(total_ttc), 0) as total_amount,
                COALESCE(SUM(amount_paid), 0) as amount_paid,
                COALESCE(SUM(amount_due), 0) as amount_due
            FROM invoices
            ${whereClause}
            GROUP BY payment_status
        `;

        const stmt = dbModule.db.prepare(query);
        const rows = stmt.all(...params);

        return rows || [];
    }

    /**
     * Récupère les catégories disponibles
     */
    getAvailableCategories() {
        const query = `
            SELECT DISTINCT category
            FROM order_items
            WHERE category IS NOT NULL
            ORDER BY category
        `;

        const stmt = dbModule.db.prepare(query);
        const rows = stmt.all();

        return rows.map(r => r.category);
    }

    /**
     * Récupère les statistiques détaillées par catégorie (avec remaining/delivered)
     */
    getCategoryDetails(year) {
        let whereClause = '';
        const params = [];
    
        if (year) {
            whereClause = ` WHERE strftime('%Y', o.date) = ?`;
            params.push(year.toString());
        }
    
        // D'abord récupérer les stats livrées par catégorie
        const deliveredQuery = `
            SELECT
                oi.category,
                SUM(CASE WHEN oi.status = 'delivered' THEN oi.quantity ELSE 0 END) AS total_delivered,
                SUM(CASE WHEN oi.status = 'delivered' THEN oi.product_price * oi.quantity ELSE 0 END) AS sum_total_delivered_price
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.order_id
            ${whereClause}
            GROUP BY oi.category
        `;
    
        const deliveredStmt = dbModule.db.prepare(deliveredQuery);
        const deliveredRows = deliveredStmt.all(...params);
        
        // 🆕 Récupérer les pending_deliveries par catégorie AVEC filtre année
        let pendingWhereClause = '';
        const pendingParams = [];
    
        if (year) {
            pendingWhereClause = ` WHERE strftime('%Y', created_at) = ?`;
            pendingParams.push(year.toString());
        }
    
        const pendingQuery = `
            SELECT
                category,
                SUM(quantity) AS total_remaining,
                SUM(product_price * quantity) AS sum_total_remaining_price
            FROM pending_deliveries
            ${pendingWhereClause}
            GROUP BY category
        `;
        
        const pendingStmt = dbModule.db.prepare(pendingQuery);
        const pendingRows = pendingStmt.all(...pendingParams);
        
        // Fusionner les résultats
        const categoryMap = {};
        
        // Ajouter les données livrées
        deliveredRows.forEach(row => {
            categoryMap[row.category] = {
                category: row.category,
                total_delivered: row.total_delivered,
                total_remaining: 0,
                sum_total_delivered_price: row.sum_total_delivered_price,
                sum_total_remaining_price: 0
            };
        });
        
        // Ajouter les données en attente
        pendingRows.forEach(row => {
            if (!categoryMap[row.category]) {
                categoryMap[row.category] = {
                    category: row.category,
                    total_delivered: 0,
                    total_remaining: 0,
                    sum_total_delivered_price: 0,
                    sum_total_remaining_price: 0
                };
            }
            categoryMap[row.category].total_remaining = row.total_remaining;
            categoryMap[row.category].sum_total_remaining_price = row.sum_total_remaining_price;
        });
        
        // Calculer les totaux et pourcentages
        const results = Object.values(categoryMap).map(cat => {
            const total_quantity = cat.total_delivered + cat.total_remaining;
            const total_price = cat.sum_total_delivered_price + cat.sum_total_remaining_price;
            const remaining_ratio = total_price > 0 
                ? Math.round((cat.sum_total_remaining_price / total_price) * 100 * 100) / 100
                : 0;
            
            return {
                ...cat,
                total_quantity,
                total_price,
                remaining_ratio
            };
        });
        
        return results.sort((a, b) => b.total_remaining - a.total_remaining);
    }
}

module.exports = new StatsService();