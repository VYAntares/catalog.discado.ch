// admin/js/modules/compta/comptaMain.js - Logique principale de la page comptabilité

import { formatCurrency } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';

class ComptaMain {
    constructor() {
        this.allClientsData = [];
        this.selectedYear = new Date().getFullYear();
        this.currentSortOption = 'total_desc';
        this.init();
    }

    init() {
        this.populateYearSelect();
        this.setupEventListeners();
        this.checkUrlParams();
        this.loadOverviewData();
        this.loadClientsData();
    }

    populateYearSelect() {
        const yearSelect = document.getElementById('yearSelect');
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= 2025; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
        yearSelect.value = this.selectedYear;
    }

    setupEventListeners() {
        // Changement d'année
        document.getElementById('yearSelect').addEventListener('change', (e) => {
            this.selectedYear = parseInt(e.target.value);
            const activeTab = document.querySelector('.compta-tab-btn.active').dataset.tab;
            if (activeTab === 'clients') {
                this.loadClientsData();
            } else {
                this.loadOverviewData();
            }
        });

        // Tri des clients
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSortOption = e.target.value;
            this.displayClientsData(this.allClientsData);
        });

        // Onglets
        document.querySelectorAll('.compta-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Recherche
        document.getElementById('clientSearchBtn').addEventListener('click', () => this.searchClients());
        document.getElementById('clientSearchInput').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.searchClients();
        });

        // Export CSV
        document.getElementById('exportClientsCSVBtn').addEventListener('click', () => this.exportClientsToCSV());
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'clients') {
            document.querySelector('[data-tab="clients"]').click();
        }
    }

    switchTab(targetTab) {
        // Mettre à jour les boutons actifs
        document.querySelectorAll('.compta-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-tab="${targetTab}"]`).classList.add('active');
        
        // Afficher le bon contenu
        document.querySelectorAll('.compta-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${targetTab}-tab`).classList.add('active');
        
        // Charger les données si nécessaire
        if (targetTab === 'clients') {
            this.loadClientsData();
        } else if (targetTab === 'overview') {
            this.loadOverviewData();
        }
    }

    async loadOverviewData() {
        try {
            const response = await fetch(`/api/invoices/stats?year=${this.selectedYear}`);
            const data = await response.json();
            
            const statsGrid = document.getElementById('statsGrid');
            statsGrid.innerHTML = `
                <div class="stat-card clickable" data-stat="total_invoices">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Total Factures</div>
                        <div class="stat-value">${data.total_invoices || 0}</div>
                    </div>
                </div>
                <div class="stat-card clickable" data-stat="total_amount">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Total TTC</div>
                        <div class="stat-value">${formatCurrency(data.total_amount || 0)}</div>
                    </div>
                </div>
                <div class="stat-card clickable" data-stat="total_paid">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Total Payé</div>
                        <div class="stat-value">${formatCurrency(data.total_paid || 0)}</div>
                    </div>
                </div>
                <div class="stat-card clickable" data-stat="total_due">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Total Dû</div>
                        <div class="stat-value">${formatCurrency(data.total_due || 0)}</div>
                    </div>
                </div>
            `;

            // Ajouter les event listeners pour les cartes cliquables
            this.attachStatCardListeners();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des statistiques', 'error');
        }
    }

    attachStatCardListeners() {
        document.querySelectorAll('.stat-card.clickable').forEach(card => {
            card.addEventListener('click', () => {
                const statType = card.dataset.stat;
                this.navigateToDetailPage(statType);
            });
        });
    }

    navigateToDetailPage(statType) {
        // Redirection vers la nouvelle page de détails
        window.location.href = `/admin/compta-details?year=${this.selectedYear}&type=${statType}`;
    }

    async loadClientsData() {
        try {
            const response = await fetch(`/api/invoices/clients-summary?year=${this.selectedYear}`);
            const data = await response.json();
            this.allClientsData = data.clients || [];
            this.displayClientsData(this.allClientsData);
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des clients', 'error');
            document.getElementById('clientsSummaryTableBody').innerHTML = 
                '<tr><td colspan="7" class="error">Impossible de charger les données</td></tr>';
        }
    }

    sortClients(clients, sortOption) {
        const sorted = [...clients];
        
        switch(sortOption) {
            case 'total_desc':
                return sorted.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
            case 'total_asc':
                return sorted.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
            case 'paid_desc':
                return sorted.sort((a, b) => (b.total_paid || 0) - (a.total_paid || 0));
            case 'paid_asc':
                return sorted.sort((a, b) => (a.total_paid || 0) - (b.total_paid || 0));
            case 'due_desc':
                return sorted.sort((a, b) => (b.total_due || 0) - (a.total_due || 0));
            case 'due_asc':
                return sorted.sort((a, b) => (a.total_due || 0) - (b.total_due || 0));
            case 'invoices_desc':
                return sorted.sort((a, b) => (b.invoice_count || 0) - (a.invoice_count || 0));
            case 'invoices_asc':
                return sorted.sort((a, b) => (a.invoice_count || 0) - (b.invoice_count || 0));
            case 'name_asc':
                return sorted.sort((a, b) => {
                    const nameA = (a.client_full_name || '').toLowerCase();
                    const nameB = (b.client_full_name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
            case 'name_desc':
                return sorted.sort((a, b) => {
                    const nameA = (a.client_full_name || '').toLowerCase();
                    const nameB = (b.client_full_name || '').toLowerCase();
                    return nameB.localeCompare(nameA);
                });
            default:
                return sorted;
        }
    }

    displayClientsData(clients) {
        const tbody = document.getElementById('clientsSummaryTableBody');
        
        if (!clients || clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">Aucun client trouvé</td></tr>';
            return;
        }

        const sortedClients = this.sortClients(clients, this.currentSortOption);

        tbody.innerHTML = sortedClients.map(client => `
            <tr>
                <td><strong>${client.user_id}</strong></td>
                <td>${client.client_full_name || 'N/A'}</td>
                <td>${client.invoice_count}</td>
                <td>${formatCurrency(client.total_amount)}</td>
                <td class="text-success">${formatCurrency(client.total_paid)}</td>
                <td class="text-danger">${formatCurrency(client.total_due)}</td>
                <td>
                    <a href="/admin/client-invoices?client_id=${encodeURIComponent(client.user_id)}&year=${this.selectedYear}" 
                    class="action-btn primary-btn btn-sm">
                        <i class="fas fa-eye"></i> Voir factures
                    </a>
                </td>
            </tr>
        `).join('');
    }

    searchClients() {
        const searchTerm = document.getElementById('clientSearchInput').value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.displayClientsData(this.allClientsData);
            return;
        }

        const filtered = this.allClientsData.filter(client => {
            const name = (client.client_full_name || '').toLowerCase();
            const id = (client.user_id || '').toLowerCase();
            return name.includes(searchTerm) || id.includes(searchTerm);
        });

        this.displayClientsData(filtered);
    }

    exportClientsToCSV() {
        if (!this.allClientsData || this.allClientsData.length === 0) {
            showNotification('Aucun client à exporter', 'warning');
            return;
        }

        const sortedData = this.sortClients(this.allClientsData, this.currentSortOption);

        const headers = [
            'ID Client',
            'Nom complet',
            'Nombre de factures',
            'Total TTC',
            'Total payé',
            'Total dû',
            'Taux de paiement (%)'
        ];

        const grandTotals = sortedData.reduce((acc, client) => {
            acc.invoice_count += client.invoice_count || 0;
            acc.total_amount += parseFloat(client.total_amount) || 0;
            acc.total_paid += parseFloat(client.total_paid) || 0;
            acc.total_due += parseFloat(client.total_due) || 0;
            return acc;
        }, {
            invoice_count: 0,
            total_amount: 0,
            total_paid: 0,
            total_due: 0
        });

        const rows = sortedData.map(client => {
            const paymentRate = client.total_amount > 0 
                ? ((client.total_paid / client.total_amount) * 100).toFixed(2)
                : '0.00';
            
            return [
                `"${(client.user_id || '').replace(/"/g, '""')}"`,
                `"${(client.client_full_name || '').replace(/"/g, '""')}"`,
                client.invoice_count || 0,
                (client.total_amount || 0).toFixed(2),
                (client.total_paid || 0).toFixed(2),
                (client.total_due || 0).toFixed(2),
                paymentRate
            ].join(',');
        });

        rows.push('');

        const grandPaymentRate = grandTotals.total_amount > 0 
            ? ((grandTotals.total_paid / grandTotals.total_amount) * 100).toFixed(2)
            : '0.00';

        const totalsRow = [
            `"TOTAL (${sortedData.length} clients)"`,
            '',
            grandTotals.invoice_count,
            grandTotals.total_amount.toFixed(2),
            grandTotals.total_paid.toFixed(2),
            grandTotals.total_due.toFixed(2),
            grandPaymentRate
        ].join(',');
        
        rows.push(totalsRow);

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const fileName = `clients_factures_${this.selectedYear}.csv`;
        
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
    new ComptaMain();
});