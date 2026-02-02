// statsManager.js - Gestionnaire de la page Statistiques

import { showNotification } from '../../utils/notification.js';

class StatsManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.currentCategory = 'all';
        this.categories = [];
        this.init();
    }

    async init() {
        console.log('📊 Initialisation StatsManager');
        
        // Charger les catégories disponibles
        await this.loadCategories();
        
        // Initialiser le sélecteur d'année
        this.initYearSelector();
        
        // Initialiser le sélecteur de catégorie
        this.initCategorySelector();
        
        // Charger toutes les statistiques
        await this.loadAllStats();
        
        // Écouter les changements d'année
        document.getElementById('yearSelect')?.addEventListener('change', async (e) => {
            this.currentYear = parseInt(e.target.value);
            await this.loadAllStats();
        });

        // Écouter les changements de catégorie
        document.getElementById('categorySelect')?.addEventListener('change', async (e) => {
            this.currentCategory = e.target.value;
            await this.loadTopProducts();
        });
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/stats/categories-list');
            if (response.ok) {
                this.categories = await response.json();
            }
        } catch (error) {
            console.error('❌ Erreur chargement catégories:', error);
        }
    }

    initYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        const startYear = 2020;

        yearSelect.innerHTML = '';
        
        for (let year = currentYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === this.currentYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        }
    }

    initCategorySelector() {
        const categorySelect = document.getElementById('categorySelect');
        if (!categorySelect) return;

        categorySelect.innerHTML = '<option value="all">Toutes les catégories</option>';
        
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = this.formatCategoryName(category);
            categorySelect.appendChild(option);
        });
    }

    async loadAllStats() {
        await Promise.all([
            this.loadOverview(),
            this.loadTopProducts(),
            this.loadCategoryStats(),
            this.loadTopClients(),
            this.loadMonthlyEvolution()
        ]);
    }

    async loadOverview() {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;

        statsGrid.innerHTML = '<div class="loading">Chargement des statistiques...</div>';

        try {
            const response = await fetch(`/api/stats/overview?year=${this.currentYear}`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des statistiques');
            }

            const stats = await response.json();
            this.renderOverview(stats);
        } catch (error) {
            console.error('❌ Erreur:', error);
            statsGrid.innerHTML = '<div class="loading">Erreur lors du chargement des statistiques</div>';
            showNotification('Erreur lors du chargement des statistiques', 'error');
        }
    }

    async loadTopProducts() {
        const container = document.getElementById('topProductsTable');
        if (!container) return;

        container.innerHTML = '<div class="loading">Chargement...</div>';

        try {
            const categoryParam = this.currentCategory !== 'all' ? `&category=${this.currentCategory}` : '';
            const response = await fetch(`/api/stats/top-products?year=${this.currentYear}${categoryParam}&limit=50`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des produits');
            }

            const products = await response.json();
            this.renderTopProducts(products);
        } catch (error) {
            console.error('❌ Erreur:', error);
            container.innerHTML = '<div class="loading">Erreur lors du chargement</div>';
        }
    }

    async loadCategoryStats() {
        const container = document.getElementById('categoryStatsTable');
        if (!container) return;

        container.innerHTML = '<div class="loading">Chargement...</div>';

        try {
            const response = await fetch(`/api/stats/category-details?year=${this.currentYear}`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des catégories');
            }

            const categories = await response.json();
            this.renderCategoryStats(categories);
        } catch (error) {
            console.error('❌ Erreur:', error);
            container.innerHTML = '<div class="loading">Erreur lors du chargement</div>';
        }
    }

    async loadTopClients() {
        const container = document.getElementById('topClientsTable');
        if (!container) return;

        container.innerHTML = '<div class="loading">Chargement...</div>';

        try {
            const response = await fetch(`/api/stats/top-clients?year=${this.currentYear}&limit=20`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des clients');
            }

            const clients = await response.json();
            this.renderTopClients(clients);
        } catch (error) {
            console.error('❌ Erreur:', error);
            container.innerHTML = '<div class="loading">Erreur lors du chargement</div>';
        }
    }

    async loadMonthlyEvolution() {
        const container = document.getElementById('monthlyChart');
        if (!container) return;

        try {
            const response = await fetch(`/api/stats/monthly-evolution?year=${this.currentYear}`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement de l\'évolution');
            }

            const data = await response.json();
            this.renderMonthlyEvolution(data);
        } catch (error) {
            console.error('❌ Erreur:', error);
        }
    }

    renderOverview(stats) {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;

        const cards = [
            {
                title: 'Chiffre d\'affaires total',
                value: this.formatCurrency(stats.totalRevenue || 0),
                description: `${stats.invoiceCount || 0} factures`,
                colorClass: 'primary'
            },
            {
                title: 'Montant encaissé',
                value: this.formatCurrency(stats.totalPaid || 0),
                description: 'Paiements reçus',
                colorClass: 'success'
            },
            {
                title: 'Montant en attente',
                value: this.formatCurrency(stats.totalDue || 0),
                description: `${stats.unpaidCount || 0} factures impayées`,
                colorClass: 'warning'
            },
            {
                title: 'Nombre de clients',
                value: stats.clientCount || 0,
                description: 'Clients actifs',
                colorClass: 'primary'
            },
            {
                title: 'Panier moyen',
                value: this.formatCurrency(stats.averageOrderValue || 0),
                description: 'Par commande',
                colorClass: 'success'
            },
            {
                title: 'Taux de paiement',
                value: this.calculatePaymentRate(stats.totalPaid, stats.totalRevenue) + '%',
                description: 'Factures payées',
                colorClass: this.getPaymentRateColor(stats.totalPaid, stats.totalRevenue)
            }
        ];

        statsGrid.innerHTML = cards.map(card => `
            <div class="stat-card ${card.colorClass}">
                <h3>${card.title}</h3>
                <div class="stat-value">${card.value}</div>
                <div class="stat-description">${card.description}</div>
            </div>
        `).join('');
    }

    renderTopProducts(products) {
        const container = document.getElementById('topProductsTable');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<div class="no-data">Aucun produit trouvé</div>';
            return;
        }

        const table = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Produit</th>
                            <th>Catégorie</th>
                            <th>Prix unitaire</th>
                            <th>Qté livrée</th>
                            <th>Qté à livrer</th>
                            <th>Qté totale</th>
                            <th>CA livré</th>
                            <th>CA à livrer</th>
                            <th>CA total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map((product, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td class="product-name">${product.product_name}</td>
                                <td><span class="category-badge">${this.formatCategoryName(product.category)}</span></td>
                                <td>${this.formatCurrency(product.unit_price)}</td>
                                <td class="text-success"><strong>${product.total_delivered}</strong></td>
                                <td class="text-warning"><strong>${product.total_remaining}</strong></td>
                                <td class="text-primary"><strong>${product.total_quantity}</strong></td>
                                <td class="text-success">${this.formatCurrency(product.sum_total_delivered_price)}</td>
                                <td class="text-warning">${this.formatCurrency(product.sum_total_remaining_price)}</td>
                                <td class="text-primary"><strong>${this.formatCurrency(product.sum_total_quantity_price)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="4"><strong>TOTAL</strong></td>
                            <td class="text-success"><strong>${this.sumField(products, 'total_delivered')}</strong></td>
                            <td class="text-warning"><strong>${this.sumField(products, 'total_remaining')}</strong></td>
                            <td class="text-primary"><strong>${this.sumField(products, 'total_quantity')}</strong></td>
                            <td class="text-success"><strong>${this.formatCurrency(this.sumField(products, 'sum_total_delivered_price'))}</strong></td>
                            <td class="text-warning"><strong>${this.formatCurrency(this.sumField(products, 'sum_total_remaining_price'))}</strong></td>
                            <td class="text-primary"><strong>${this.formatCurrency(this.sumField(products, 'sum_total_quantity_price'))}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        container.innerHTML = table;
    }

    renderCategoryStats(categories) {
        const container = document.getElementById('categoryStatsTable');
        if (!container) return;

        if (categories.length === 0) {
            container.innerHTML = '<div class="no-data">Aucune catégorie trouvée</div>';
            return;
        }

        const table = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Catégorie</th>
                            <th>Qté livrée</th>
                            <th>Qté à livrer</th>
                            <th>Qté totale</th>
                            <th>CA livré</th>
                            <th>CA à livrer</th>
                            <th>CA total</th>
                            <th>% à livrer</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categories.map(cat => `
                            <tr>
                                <td><span class="category-badge">${this.formatCategoryName(cat.category)}</span></td>
                                <td class="text-success"><strong>${cat.total_delivered}</strong></td>
                                <td class="text-warning"><strong>${cat.total_remaining}</strong></td>
                                <td class="text-primary"><strong>${cat.total_quantity}</strong></td>
                                <td class="text-success">${this.formatCurrency(cat.sum_total_delivered_price)}</td>
                                <td class="text-warning">${this.formatCurrency(cat.sum_total_remaining_price)}</td>
                                <td class="text-primary"><strong>${this.formatCurrency(cat.total_price)}</strong></td>
                                <td>
                                    <div class="progress-container">
                                        <div class="progress-bar" style="width: ${cat.remaining_ratio}%"></div>
                                        <span class="progress-text">${cat.remaining_ratio}%</span>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td><strong>TOTAL</strong></td>
                            <td class="text-success"><strong>${this.sumField(categories, 'total_delivered')}</strong></td>
                            <td class="text-warning"><strong>${this.sumField(categories, 'total_remaining')}</strong></td>
                            <td class="text-primary"><strong>${this.sumField(categories, 'total_quantity')}</strong></td>
                            <td class="text-success"><strong>${this.formatCurrency(this.sumField(categories, 'sum_total_delivered_price'))}</strong></td>
                            <td class="text-warning"><strong>${this.formatCurrency(this.sumField(categories, 'sum_total_remaining_price'))}</strong></td>
                            <td class="text-primary"><strong>${this.formatCurrency(this.sumField(categories, 'total_price'))}</strong></td>
                            <td>-</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        container.innerHTML = table;
    }

    renderTopClients(clients) {
        const container = document.getElementById('topClientsTable');
        if (!container) return;

        if (clients.length === 0) {
            container.innerHTML = '<div class="no-data">Aucun client trouvé</div>';
            return;
        }

        const table = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Client</th>
                            <th>Boutique</th>
                            <th>Commandes</th>
                            <th>CA total</th>
                            <th>Payé</th>
                            <th>Dû</th>
                            <th>Panier moyen</th>
                            <th>Dernière commande</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clients.map((client, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td class="client-name">${client.client_full_name || client.user_id}</td>
                                <td>${client.shop_name || '-'}</td>
                                <td><strong>${client.total_orders}</strong></td>
                                <td class="text-primary"><strong>${this.formatCurrency(client.total_spent)}</strong></td>
                                <td class="text-success">${this.formatCurrency(client.total_paid)}</td>
                                <td class="text-${client.total_due > 0 ? 'warning' : 'muted'}">${this.formatCurrency(client.total_due)}</td>
                                <td>${this.formatCurrency(client.average_order_value)}</td>
                                <td>${this.formatDate(client.last_order_date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = table;
    }

    renderMonthlyEvolution(data) {
        const container = document.getElementById('monthlyChart');
        if (!container) return;

        const maxRevenue = Math.max(...data.map(d => d.totalRevenue));
        
        const chart = `
            <div class="bar-chart">
                ${data.map(month => {
                    const percentage = maxRevenue > 0 ? (month.totalRevenue / maxRevenue) * 100 : 0;
                    return `
                        <div class="bar-item">
                            <div class="bar-label">${month.month.substring(0, 3)}</div>
                            <div class="bar-wrapper">
                                <div class="bar" style="height: ${percentage}%" title="${this.formatCurrency(month.totalRevenue)}">
                                    <span class="bar-value">${this.formatCurrency(month.totalRevenue)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = chart;
    }

    // Utilitaires
    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-CH', {
            style: 'currency',
            currency: 'CHF'
        }).format(amount);
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('fr-CH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    }

    formatCategoryName(category) {
        if (!category) return 'Non catégorisé';
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    calculatePaymentRate(paid, total) {
        if (!total || total === 0) return 0;
        return Math.round((paid / total) * 100);
    }

    getPaymentRateColor(paid, total) {
        const rate = this.calculatePaymentRate(paid, total);
        if (rate >= 80) return 'success';
        if (rate >= 50) return 'warning';
        return 'danger';
    }

    sumField(array, field) {
        return array.reduce((sum, item) => sum + (item[field] || 0), 0);
    }
}

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    new StatsManager();
});

export default StatsManager;