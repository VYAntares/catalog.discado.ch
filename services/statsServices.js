// services/statsService.js - Service de gestion des statistiques
const dbModule = require('./db');

class StatsService {
    /**
     * Récupère les statistiques générales pour une année
     */
    getYearlyOverview(year) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const query = `
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

        const stmt = dbModule.db.prepare(query);
        const row = stmt.get(startDate, endDate);

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

        const query = `
            SELECT
                oi.product_name,
                oi.category,
                SUM(CASE WHEN oi.status = 'remaining' THEN oi.quantity ELSE 0 END) AS total_remaining,
                SUM(CASE WHEN oi.status = 'delivered' THEN oi.quantity ELSE 0 END) AS total_delivered,
                (SUM(CASE WHEN oi.status = 'remaining' THEN oi.quantity ELSE 0 END) +
                 SUM(CASE WHEN oi.status = 'delivered' THEN oi.quantity ELSE 0 END)) AS total_quantity,
                SUM(CASE WHEN oi.status = 'remaining' THEN oi.product_price * oi.quantity ELSE 0 END) AS sum_total_remaining_price,
                SUM(CASE WHEN oi.status = 'delivered' THEN oi.product_price * oi.quantity ELSE 0 END) AS sum_total_delivered_price,
                (SUM(CASE WHEN oi.status = 'remaining' THEN oi.product_price * oi.quantity ELSE 0 END) +
                 SUM(CASE WHEN oi.status = 'delivered' THEN oi.product_price * oi.quantity ELSE 0 END)) AS sum_total_quantity_price,
                ROUND(oi.product_price, 2) as unit_price
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.order_id
            WHERE 1=1 ${whereClause}
            GROUP BY oi.product_name, oi.category, oi.product_price
            ORDER BY total_quantity DESC
            LIMIT ?
        `;

        const stmt = dbModule.db.prepare(query);
        const rows = stmt.all(...params);

        return rows || [];
    }

    /**
     * Récupère l'évolution mensuelle du chiffre d'affaires
     */
    getMonthlyEvolution(year) {
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

        const query = `
            WITH category_stats AS (
                SELECT
                    oi.category,
                    SUM(CASE WHEN oi.status = 'remaining' THEN oi.quantity ELSE 0 END) AS total_remaining,
                    SUM(CASE WHEN oi.status = 'delivered' THEN oi.quantity ELSE 0 END) AS total_delivered,
                    (SUM(CASE WHEN oi.status = 'remaining' THEN oi.quantity ELSE 0 END) +
                     SUM(CASE WHEN oi.status = 'delivered' THEN oi.quantity ELSE 0 END)) AS total_quantity,
                    SUM(CASE WHEN oi.status = 'remaining' THEN oi.product_price * oi.quantity ELSE 0 END) AS sum_total_remaining_price,
                    SUM(CASE WHEN oi.status = 'delivered' THEN oi.product_price * oi.quantity ELSE 0 END) AS sum_total_delivered_price,
                    (SUM(CASE WHEN oi.status = 'remaining' THEN oi.product_price * oi.quantity ELSE 0 END) +
                     SUM(CASE WHEN oi.status = 'delivered' THEN oi.product_price * oi.quantity ELSE 0 END)) AS total_price
                FROM order_items oi
                INNER JOIN orders o ON oi.order_id = o.order_id
                ${whereClause}
                GROUP BY oi.category
            )
            SELECT
                category,
                total_remaining,
                total_delivered,
                total_quantity,
                sum_total_remaining_price,
                sum_total_delivered_price,
                total_price,
                ROUND(
                    CASE 
                        WHEN total_price > 0 THEN (sum_total_remaining_price / total_price) * 100
                        ELSE 0
                    END,
                    2
                ) AS remaining_ratio
            FROM category_stats
            ORDER BY total_remaining DESC
        `;

        const stmt = dbModule.db.prepare(query);
        const rows = stmt.all(...params);

        return rows || [];
    }
}

module.exports = new StatsService();