// admin/js/modules/compta/comptaChart.js - Module pour le graphique comptable

import { formatCurrency } from '../../utils/formatter.js';

export class ComptaChart {
    constructor(year) {
        this.year = year;
        this.monthlyData = [];
        this.maxValue = 0;
        this.displayMaxValue = 0;
        this.chartHeight = 375; // Hauteur disponible pour les barres (420px - 40px de marge)
    }

    async loadData() {
        try {
            const response = await fetch(`/api/invoices/monthly-breakdown?year=${this.year}&type=total_amount`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des données mensuelles');
            }

            const data = await response.json();
            this.monthlyData = data.months || [];
            
            // Calculer la valeur maximale en prenant TOUTES les valeurs affichées
            const allValues = this.monthlyData.flatMap(m => [
                m.total_ttc || 0,
                m.total_paid || 0,
                m.total_due || 0
            ]);
            
            this.maxValue = Math.max(...allValues, 100);

            return true;
        } catch (error) {
            console.error('Erreur:', error);
            return false;
        }
    }

    render(containerId) {
        const container = document.getElementById(containerId);

        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        if (!this.monthlyData || this.monthlyData.length === 0) {
            container.innerHTML = this.renderNoData();
            return;
        }

        // Adapter la hauteur des barres à la taille d'écran (wrapper CSS - 40px labels)
        const w = window.innerWidth;
        if (w <= 768) {
            this.chartHeight = 340; // 380px wrapper - 40px
        } else if (w <= 1024) {
            this.chartHeight = 340; // 380px wrapper - 40px
        } else {
            this.chartHeight = 375; // valeur originale desktop (420px wrapper)
        }

        // Générer les labels Y pour initialiser displayMaxValue
        this.yAxisLabels = this.generateYAxisLabels();

        container.innerHTML = this.renderChart();
    }

    renderNoData() {
        return `
            <div class="no-data-chart">
                <i class="fas fa-chart-bar"></i>
                <p>Aucune donnée disponible pour ${this.year}</p>
            </div>
        `;
    }

    renderChart() {
        const monthNames = [
            'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
            'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
        ];

        // Utiliser les labels Y déjà générés
        const yAxisLabels = this.yAxisLabels;
        const gridLines = yAxisLabels.map(() => '<div class="grid-line"></div>').join('');

        // Générer les barres pour chaque mois
        const monthBars = this.monthlyData.map(month => {
            const monthName = monthNames[month.month - 1];
            return this.renderMonthGroup(month, monthName);
        }).join('');

        return `
            <div class="y-axis">
                ${yAxisLabels.map(label => `<div class="y-axis-label">${formatCurrency(label)}</div>`).reverse().join('')}
            </div>
            <div class="chart-scroll-area">
                <div class="chart-inner">
                    <div class="grid-lines">
                        ${gridLines}
                    </div>
                    <div class="chart-canvas">
                        ${monthBars}
                    </div>
                </div>
            </div>
        `;
    }

    renderMonthGroup(month, monthName) {
        const totalHeight = this.calculateBarHeight(month.total_ttc || 0);
        const paidHeight = this.calculateBarHeight(month.total_paid || 0);
        const dueHeight = this.calculateBarHeight(month.total_due || 0);

        return `
            <div class="month-group">
                <div class="bars-container">
                    ${this.renderBar('total', totalHeight, month.total_ttc, 'Total TTC')}
                    ${this.renderBar('paid', paidHeight, month.total_paid, 'Payé')}
                    ${this.renderBar('due', dueHeight, month.total_due, 'Dû')}
                </div>
                <div class="month-label">${monthName}</div>
            </div>
        `;
    }

    renderBar(type, heightPx, value, label) {
        // Si la valeur est nulle ou zéro, on n'affiche pas de barre
        if (!value || value === 0) {
            return `<div class="bar ${type}" style="height: 0px"></div>`;
        }
        
        // Sinon on affiche la barre avec sa hauteur calculée (minimum 2px pour visibilité)
        const finalHeight = Math.max(heightPx, 2);
        
        return `
            <div class="bar ${type}" style="height: ${finalHeight}px">
                <div class="bar-tooltip">
                    ${label}: ${formatCurrency(value)}
                </div>
            </div>
        `;
    }

    calculateBarHeight(value) {
        if (!value || value === 0) {
            return 0;
        }
        
        if (this.displayMaxValue === 0) {
            return 0;
        }
        
        // Calculer la hauteur en pixels de façon proportionnelle
        // Formule: (valeur / max) × hauteur_disponible
        const heightPx = (value / this.displayMaxValue) * this.chartHeight;
        
        return heightPx;
    }

    generateYAxisLabels() {
        // Arrondir au multiple de 10'000 supérieur
        const roundedMax = Math.ceil(this.maxValue / 10000) * 10000;
        
        // Mettre à jour displayMaxValue pour les calculs de hauteur
        this.displayMaxValue = roundedMax;
        
        // Calculer le nombre d'intervalles de 10'000
        const numIntervals = roundedMax / 10000;
        
        // Générer les labels tous les 10'000
        const labels = [];
        for (let i = 0; i <= numIntervals; i++) {
            labels.push(i * 10000);
        }
        
        return labels;
    }
}