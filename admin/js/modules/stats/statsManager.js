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
            this.currentYear = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
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
        
        // Ajouter l'option "Toutes les années"
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Toutes les années';
        yearSelect.appendChild(allOption);
        
        // Ajouter les années individuelles
        for (let year = currentYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === this.currentYear && this.currentYear !== 'all') {
                option.selected = true;
        }
        yearSelect.appendChild(option);
        }
        
        // Sélectionner l'année actuelle par défaut
        if (this.currentYear === 'all') {
            allOption.selected = true;
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
            const yearParam = this.currentYear === 'all' ? '' : `?year=${this.currentYear}`;
            const response = await fetch(`/api/stats/overview${yearParam}`);

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des statistiques');
            }

            const stats = await response.json();
            console.log('📊 Overview data:', stats);
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
            const params = new URLSearchParams();

            if (this.currentYear !== 'all') {
                params.append('year', this.currentYear);
            }

            if (this.currentCategory !== 'all') {
                params.append('category', this.currentCategory);
            }

            params.append('limit', '50');

            const response = await fetch(`/api/stats/top-products?${params.toString()}`);

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
            const yearParam = this.currentYear === 'all' ? '' : `?year=${this.currentYear}`;
            const response = await fetch(`/api/stats/category-details${yearParam}`);
            
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
            const params = new URLSearchParams();

            if (this.currentYear !== 'all') {
                params.append('year', this.currentYear);
            }

            params.append('limit', '20');

            const response = await fetch(`/api/stats/top-clients?${params.toString()}`);

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
            const yearParam = this.currentYear === 'all' ? '' : `?year=${this.currentYear}`;
            const response = await fetch(`/api/stats/monthly-evolution${yearParam}`);

            if (!response.ok) {
                throw new Error('Erreur lors du chargement de l\'évolution');
            }

            const data = await response.json();
            console.log('📈 Monthly evolution data:', data);
            this.renderMonthlyEvolution(data);
        } catch (error) {
            console.error('❌ Erreur:', error);
            container.innerHTML = '<div class="no-data">Erreur lors du chargement de l\'évolution mensuelle</div>';
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

        if (!products || products.length === 0) {
            container.innerHTML = '<div class="no-data">Aucun produit trouvé</div>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Produit</th>
                        <th>Catégorie</th>
                        <th>Quantité totale</th>
                        <th>Livré</th>
                        <th>Restant</th>
                        <th>CA Total</th>
                        <th>Prix unitaire</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map((product, index) => `
                        <tr>
                            <td><strong>${index + 1}</strong></td>
                            <td><strong>${this.escapeHtml(product.product_name)}</strong></td>
                            <td><span class="category-badge">${this.escapeHtml(product.category)}</span></td>
                            <td><strong>${product.total_quantity}</strong></td>
                            <td>${product.total_delivered}</td>
                            <td>${product.total_remaining}</td>
                            <td><strong>${this.formatCurrency(product.sum_total_quantity_price)}</strong></td>
                            <td>${this.formatCurrency(product.unit_price)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    renderCategoryStats(categories) {
        const container = document.getElementById('categoryStatsTable');
        if (!container) return;

        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="no-data">Aucune catégorie trouvée</div>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Catégorie</th>
                        <th>Quantité totale</th>
                        <th>Livré</th>
                        <th>Restant</th>
                        <th>CA Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${categories.map(cat => `
                        <tr>
                            <td><span class="category-badge">${this.escapeHtml(cat.category)}</span></td>
                            <td><strong>${cat.total_quantity}</strong></td>
                            <td>${cat.total_delivered}</td>
                            <td>${cat.total_remaining}</td>
                            <td><strong>${this.formatCurrency(cat.sum_total_quantity_price)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    renderTopClients(clients) {
        const container = document.getElementById('topClientsTable');
        if (!container) return;

        if (!clients || clients.length === 0) {
            container.innerHTML = '<div class="no-data">Aucun client trouvé</div>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Client</th>
                        <th>Boutique</th>
                        <th>Commandes</th>
                        <th>Total dépensé</th>
                        <th>Payé</th>
                        <th>En attente</th>
                        <th>Panier moyen</th>
                        <th>Dernière commande</th>
                    </tr>
                </thead>
                <tbody>
                    ${clients.map((client, index) => `
                        <tr>
                            <td><strong>${index + 1}</strong></td>
                            <td>${this.escapeHtml(client.client_full_name || client.user_id)}</td>
                            <td>${this.escapeHtml(client.shop_name || '-')}</td>
                            <td>${client.total_orders}</td>
                            <td><strong>${this.formatCurrency(client.total_spent)}</strong></td>
                            <td>${this.formatCurrency(client.total_paid)}</td>
                            <td>${this.formatCurrency(client.total_due)}</td>
                            <td>${this.formatCurrency(client.average_order_value)}</td>
                            <td>${this.formatDate(client.last_order_date)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    renderMonthlyEvolution(data) {
        const container = document.getElementById('monthlyChart');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="no-data">Aucune donnée disponible</div>';
            return;
        }

        const maxRevenue = Math.max(...data.map(d => d.totalRevenue || 0));
        const chartHeight = 300;

        const html = `
            <div class="chart-bars">
                ${data.map(item => {
                    const barHeight = maxRevenue > 0 ? ((item.totalRevenue || 0) / maxRevenue) * chartHeight : 0;
                    const label = this.currentYear === 'all' ? item.yearMonth : item.month;

                    return `
                        <div class="chart-bar-container">
                            <div class="chart-bar" style="height: ${barHeight}px;" title="${this.formatCurrency(item.totalRevenue || 0)}">
                                <div class="chart-bar-value">${this.formatCurrency(item.totalRevenue || 0)}</div>
                            </div>
                            <div class="chart-bar-label">${label || ''}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    // Méthodes utilitaires
    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-CH', {
            style: 'currency',
            currency: 'CHF'
        }).format(amount || 0);
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatCategoryName(category) {
        if (!category) return 'Sans catégorie';
        return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialiser le gestionnaire
document.addEventListener('DOMContentLoaded', () => {
    new StatsManager();
});