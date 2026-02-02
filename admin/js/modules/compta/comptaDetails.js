// admin/js/modules/compta/comptaDetails.js - Détails mensuels des ventes

import { formatCurrency, formatSwissNumber } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';

class ComptaDetails {
    constructor() {
        this.year = null;
        this.type = null;
        this.monthlyData = [];
        this.init();
    }

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.year = parseInt(urlParams.get('year')) || new Date().getFullYear();
        this.type = urlParams.get('type') || 'total_amount';

        if (!['total_amount', 'total_paid', 'total_due', 'total_invoices'].includes(this.type)) {
            showNotification('Type de données invalide', 'error');
            window.location.href = '/admin/compta';
            return;
        }

        this.setupUI();
        this.setupEventListeners();
        this.loadMonthlyData();
    }

    setupUI() {
        // Mettre à jour le titre de la page
        const titles = {
            'total_amount': 'Total TTC par mois',
            'total_paid': 'Total Payé par mois',
            'total_due': 'Total Dû par mois',
            'total_invoices': 'Nombre de Factures par mois'
        };
        
        document.getElementById('pageTitle').textContent = titles[this.type];
        document.getElementById('yearDisplay').textContent = this.year;

        const typeLabels = {
            'total_amount': 'Total TTC',
            'total_paid': 'Total Payé',
            'total_due': 'Total Dû',
            'total_invoices': 'Nombre de Factures'
        };
        
        document.getElementById('summaryType').textContent = typeLabels[this.type];
    }

    setupEventListeners() {
        document.getElementById('exportMonthlyCSVBtn').addEventListener('click', () => {
            this.exportToCSV();
        });
    }

    async loadMonthlyData() {
        try {
            const response = await fetch(`/api/invoices/monthly-breakdown?year=${this.year}&type=${this.type}`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des données');
            }

            const data = await response.json();
            this.monthlyData = data.months || [];

            this.updateSummary(data.summary);
            this.displayMonthlyData();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des données mensuelles', 'error');
            document.getElementById('monthlyGrid').innerHTML = 
                '<div class="error-message">Impossible de charger les données</div>';
        }
    }

    updateSummary(summary) {
        if (!summary) return;

        const isMonetary = this.type !== 'total_invoices';
        
        document.getElementById('summaryTotal').textContent = 
            isMonetary ? formatCurrency(summary.total) : summary.total;
        
        document.getElementById('summaryCount').textContent = 
            summary.invoice_count || 0;
    }

    displayMonthlyData() {
        const container = document.getElementById('monthlyGrid');
        
        if (!this.monthlyData || this.monthlyData.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-inbox"></i>
                    <p>Aucune donnée disponible pour ${this.year}</p>
                </div>
            `;
            return;
        }

        const monthNames = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];

        const isMonetary = this.type !== 'total_invoices';

        container.innerHTML = this.monthlyData.map(month => {
            const monthName = monthNames[month.month - 1];
            
            return `
                <div class="month-card" data-month="${month.month}">
                    <div class="month-header">
                        <div class="month-name">${monthName}</div>
                        <div class="month-count">${month.invoice_count} facture(s)</div>
                    </div>
                    <div class="month-details">
                        ${this.renderMonthDetails(month, isMonetary)}
                    </div>
                </div>
            `;
        }).join('');

        this.attachMonthCardListeners();
    }

    renderMonthDetails(month, isMonetary) {
        if (this.type === 'total_amount') {
            return `
                <div class="month-detail-row">
                    <span class="detail-label">Total TTC</span>
                    <span class="detail-value primary">${formatCurrency(month.total_ttc)}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">Total HT</span>
                    <span class="detail-value">${formatCurrency(month.total_ht)}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">TVA</span>
                    <span class="detail-value">${formatCurrency(month.total_vat)}</span>
                </div>
            `;
        } else if (this.type === 'total_paid') {
            return `
                <div class="month-detail-row">
                    <span class="detail-label">Total Payé</span>
                    <span class="detail-value success">${formatCurrency(month.total_paid)}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">Total Facturé</span>
                    <span class="detail-value">${formatCurrency(month.total_ttc)}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">Taux de paiement</span>
                    <span class="detail-value">${this.calculatePaymentRate(month.total_paid, month.total_ttc)}%</span>
                </div>
            `;
        } else if (this.type === 'total_due') {
            return `
                <div class="month-detail-row">
                    <span class="detail-label">Total Dû</span>
                    <span class="detail-value danger">${formatCurrency(month.total_due)}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">Total Facturé</span>
                    <span class="detail-value">${formatCurrency(month.total_ttc)}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">Taux impayé</span>
                    <span class="detail-value">${this.calculatePaymentRate(month.total_due, month.total_ttc)}%</span>
                </div>
            `;
        } else { // total_invoices
            return `
                <div class="month-detail-row">
                    <span class="detail-label">Factures</span>
                    <span class="detail-value primary">${month.invoice_count}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">Total TTC</span>
                    <span class="detail-value">${formatCurrency(month.total_ttc)}</span>
                </div>
                <div class="month-detail-row">
                    <span class="detail-label">Montant moyen</span>
                    <span class="detail-value">${formatCurrency(month.total_ttc / month.invoice_count)}</span>
                </div>
            `;
        }
    }

    calculatePaymentRate(amount, total) {
        if (!total || total === 0) return '0.00';
        return ((amount / total) * 100).toFixed(2);
    }

    attachMonthCardListeners() {
        document.querySelectorAll('.month-card').forEach(card => {
            card.addEventListener('click', () => {
                const month = card.dataset.month;
                this.showMonthDetails(month);
            });
        });
    }

    showMonthDetails(month) {
		// Rediriger vers la nouvelle page de détails du mois
		window.location.href = `/admin/compta-month?year=${this.year}&month=${month}&type=${this.type}`;
	}

    exportToCSV() {
        if (!this.monthlyData || this.monthlyData.length === 0) {
            showNotification('Aucune donnée à exporter', 'warning');
            return;
        }

        const monthNames = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];

        const isMonetary = this.type !== 'total_invoices';

        let headers, rows;

        // Calculer les totaux annuels
        const totals = this.monthlyData.reduce((acc, month) => {
            acc.invoice_count += month.invoice_count || 0;
            acc.total_ht += month.total_ht || 0;
            acc.total_vat += month.total_vat || 0;
            acc.total_ttc += month.total_ttc || 0;
            acc.total_paid += month.total_paid || 0;
            acc.total_due += month.total_due || 0;
            return acc;
        }, { invoice_count: 0, total_ht: 0, total_vat: 0, total_ttc: 0, total_paid: 0, total_due: 0 });

        if (this.type === 'total_amount') {
            headers = ['Mois', 'Nombre de factures', 'Total HT', 'TVA', 'Total TTC'];
            rows = this.monthlyData.map(month => [
                monthNames[month.month - 1],
                month.invoice_count,
                formatSwissNumber(month.total_ht),
                formatSwissNumber(month.total_vat),
                formatSwissNumber(month.total_ttc)
            ].join(','));
            // Ajouter ligne vide puis ligne de totaux
            rows.push('');
            rows.push(['TOTAL ANNUEL', totals.invoice_count, formatSwissNumber(totals.total_ht), formatSwissNumber(totals.total_vat), formatSwissNumber(totals.total_ttc)].join(','));
        } else if (this.type === 'total_paid') {
            headers = ['Mois', 'Nombre de factures', 'Total Facturé', 'Total Payé', 'Taux de paiement (%)'];
            rows = this.monthlyData.map(month => [
                monthNames[month.month - 1],
                month.invoice_count,
                formatSwissNumber(month.total_ttc),
                formatSwissNumber(month.total_paid),
                this.calculatePaymentRate(month.total_paid, month.total_ttc)
            ].join(','));
            // Ajouter ligne vide puis ligne de totaux
            rows.push('');
            rows.push(['TOTAL ANNUEL', totals.invoice_count, formatSwissNumber(totals.total_ttc), formatSwissNumber(totals.total_paid), this.calculatePaymentRate(totals.total_paid, totals.total_ttc)].join(','));
        } else if (this.type === 'total_due') {
            headers = ['Mois', 'Nombre de factures', 'Total Facturé', 'Total Dû', 'Taux impayé (%)'];
            rows = this.monthlyData.map(month => [
                monthNames[month.month - 1],
                month.invoice_count,
                formatSwissNumber(month.total_ttc),
                formatSwissNumber(month.total_due),
                this.calculatePaymentRate(month.total_due, month.total_ttc)
            ].join(','));
            // Ajouter ligne vide puis ligne de totaux
            rows.push('');
            rows.push(['TOTAL ANNUEL', totals.invoice_count, formatSwissNumber(totals.total_ttc), formatSwissNumber(totals.total_due), this.calculatePaymentRate(totals.total_due, totals.total_ttc)].join(','));
        } else { // total_invoices
            headers = ['Mois', 'Nombre de factures', 'Total TTC', 'Montant moyen'];
            rows = this.monthlyData.map(month => [
                monthNames[month.month - 1],
                month.invoice_count,
                formatSwissNumber(month.total_ttc),
                formatSwissNumber(month.total_ttc / month.invoice_count)
            ].join(','));
            // Ajouter ligne vide puis ligne de totaux
            rows.push('');
            rows.push(['TOTAL ANNUEL', totals.invoice_count, formatSwissNumber(totals.total_ttc), formatSwissNumber(totals.total_ttc / totals.invoice_count)].join(','));
        }

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const typeNames = {
            'total_amount': 'total_ttc',
            'total_paid': 'total_paye',
            'total_due': 'total_du',
            'total_invoices': 'nb_factures'
        };
        
        const fileName = `details_mensuels_${typeNames[this.type]}_${this.year}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`Export CSV réussi : ${fileName}`, 'success');
    }
}

// Initialiser quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    new ComptaDetails();
});