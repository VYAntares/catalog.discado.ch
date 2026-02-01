// statsManager.js - Gestionnaire de la page Statistiques

import { showNotification } from '../../utils/notification.js';

class StatsManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.init();
    }

    async init() {
        console.log('📊 Initialisation StatsManager');
        
        // Initialiser le sélecteur d'année
        this.initYearSelector();
        
        // Charger les statistiques
        await this.loadStatistics();
        
        // Écouter les changements d'année
        document.getElementById('yearSelect')?.addEventListener('change', async (e) => {
            this.currentYear = parseInt(e.target.value);
            await this.loadStatistics();
        });
    }

    initYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        const startYear = 2020; // Année de départ

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

    async loadStatistics() {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;

        statsGrid.innerHTML = '<div class="loading">Chargement des statistiques...</div>';

        try {
            // Récupérer les statistiques depuis l'API
            const response = await fetch(`/api/invoices/stats?year=${this.currentYear}`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des statistiques');
            }

            const stats = await response.json();
            
            this.renderStatistics(stats);
        } catch (error) {
            console.error('❌ Erreur:', error);
            statsGrid.innerHTML = '<div class="loading">Erreur lors du chargement des statistiques</div>';
            showNotification('Erreur lors du chargement des statistiques', 'error');
        }
    }

    renderStatistics(stats) {
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

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-CH', {
            style: 'currency',
            currency: 'CHF'
        }).format(amount);
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
}

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    new StatsManager();
});

export default StatsManager;