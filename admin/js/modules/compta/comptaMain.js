// admin/js/modules/compta/comptaMain.js - Logique principale de la page comptabilité

import { formatCurrency } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';
import { ComptaChart } from './comptaChart.js';

class ComptaMain {
    constructor() {
        this.allClientsData = [];
        this.unpaidInvoices = [];
        this.unpaidSortOrder = 'desc';
		this.unpaidSortType = 'date';
        this.selectedYear = new Date().getFullYear();
        this.currentSortOption = 'total_desc';
        this.viewMode = 'all';
        this.editingCells = new Map();
		this.chart = null;
        this.init();
    }

    init() {
        this.populateYearSelect();
        this.setupEventListeners();
        this.checkUrlParams();
        this.loadOverviewData();
		this.loadAndRenderChart();
        this.loadClientsData();
    }

    populateYearSelect() {
        const yearSelect = document.getElementById('yearSelect');
        const currentYear = new Date().getFullYear();

        // Ajouter l'option "Toutes les années"
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Toutes les années';
        yearSelect.appendChild(allOption);

        // Ajouter les années individuelles
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
            this.selectedYear = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
            const activeTab = document.querySelector('.compta-tab-btn.active').dataset.tab;
            if (activeTab === 'clients') {
                this.loadClientsData();
            } else if (activeTab === 'unpaid') {
                this.loadUnpaidInvoices();
            } else {
                this.loadOverviewData();
				this.loadAndRenderChart();
            }
        });

        // Mode de vue (tous / par source)
        document.getElementById('viewModeSelect').addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            this.displayClientsData(this.allClientsData);
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

        // Export CSV clients
        document.getElementById('exportClientsCSVBtn').addEventListener('click', () => this.exportClientsToCSV());

        // Tri factures impayées
        const unpaidSortBtn = document.getElementById('unpaidSortBtn');
        if (unpaidSortBtn) {
            unpaidSortBtn.addEventListener('click', () => this.toggleUnpaidSort());
        }

		const unpaidSortClientBtn = document.getElementById('unpaidSortClientBtn');
		if (unpaidSortClientBtn) {
			unpaidSortClientBtn.addEventListener('click', () => this.toggleUnpaidClientSort());
		}

        // Export CSV factures impayées
        const exportUnpaidBtn = document.getElementById('exportUnpaidCSVBtn');
        if (exportUnpaidBtn) {
            exportUnpaidBtn.addEventListener('click', () => this.exportUnpaidToCSV());
        }
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        if (tab === 'clients') {
            document.querySelector('[data-tab="clients"]').click();
        } else if (tab === 'unpaid') {
            document.querySelector('[data-tab="unpaid"]').click();
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
			this.loadAndRenderChart();
		} else if (targetTab === 'unpaid') {
            this.loadUnpaidInvoices();
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

	async loadAndRenderChart() {
		try {
			this.chart = new ComptaChart(this.selectedYear);
			const success = await this.chart.loadData();
			
			if (success) {
				this.chart.render('chartWrapper');
			} else {
				document.getElementById('chartWrapper').innerHTML = 
					'<div class="error-message">Impossible de charger le graphique</div>';
			}
		} catch (error) {
			console.error('Erreur lors du chargement du graphique:', error);
			document.getElementById('chartWrapper').innerHTML = 
				'<div class="error-message">Erreur lors du chargement du graphique</div>';
		}
	}

    async loadClientsData() {
        try {
            const yearParam = this.selectedYear === 'all' ? '' : `year=${this.selectedYear}`;
            const separator = yearParam ? '?' : '';
            const response = await fetch(`/api/invoices/clients-summary${separator}${yearParam}`);
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

    async loadUnpaidInvoices() {
        try {
            const yearParam = this.selectedYear === 'all' ? '' : `year=${this.selectedYear}`;
            const separator = yearParam ? '?' : '';
            const response = await fetch(`/api/invoices/unpaid${separator}${yearParam}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des factures impayées');
            }

            const data = await response.json();
            this.unpaidInvoices = data.invoices || [];

            this.displayUnpaidInvoices();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des factures impayées', 'error');
            document.getElementById('unpaidInvoicesTableBody').innerHTML =
                '<tr><td colspan="12" class="error-message">Impossible de charger les factures</td></tr>';
        }
    }

    toggleUnpaidSort() {
        this.unpaidSortOrder = this.unpaidSortOrder === 'desc' ? 'asc' : 'desc';
        
        const sortBtn = document.getElementById('unpaidSortBtn');
        const sortText = document.getElementById('unpaidSortText');
        const icon = sortBtn.querySelector('i');

        if (this.unpaidSortOrder === 'desc') {
            icon.className = 'fas fa-sort-amount-down';
            sortText.textContent = 'Plus récente à plus ancienne';
        } else {
            icon.className = 'fas fa-sort-amount-up';
            sortText.textContent = 'Plus ancienne à plus récente';
        }

        this.displayUnpaidInvoices();
    }

	toggleUnpaidClientSort() {
		this.unpaidSortType = this.unpaidSortType === 'date' ? 'client' : 'date';
		
		const sortBtn = document.getElementById('unpaidSortClientBtn');
		const sortText = document.getElementById('unpaidSortClientText');
		const icon = sortBtn.querySelector('i');

		if (this.unpaidSortType === 'client') {
			icon.className = 'fas fa-sort-alpha-down';
			sortText.textContent = 'Trié par client (A-Z)';
			this.unpaidSortOrder = 'asc'; // Reset à alphabétique croissant
		} else {
			icon.className = 'fas fa-calendar-alt';
			sortText.textContent = 'Trié par date';
		}

		this.displayUnpaidInvoices();
	}

    displayUnpaidInvoices() {
		const tbody = document.getElementById('unpaidInvoicesTableBody');
		
		if (!this.unpaidInvoices || this.unpaidInvoices.length === 0) {
			tbody.innerHTML = '<tr><td colspan="12" class="no-data">Aucune facture impayée trouvée</td></tr>';
			return;
		}

		// REMPLACER TOUTE LA LOGIQUE DE TRI PAR CECI :
		const sortedInvoices = [...this.unpaidInvoices].sort((a, b) => {
			if (this.unpaidSortType === 'client') {
				// Tri alphabétique par nom de client
				const nameA = (a.client_full_name || '').toLowerCase();
				const nameB = (b.client_full_name || '').toLowerCase();
				return nameA.localeCompare(nameB);
			} else {
				// Tri par date
				const dateA = new Date(a.invoice_date);
				const dateB = new Date(b.invoice_date);
				return this.unpaidSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
			}
		});

		tbody.innerHTML = sortedInvoices.map(invoice => this.createUnpaidInvoiceRow(invoice)).join('');
		this.attachUnpaidEventListeners();
	}

    createUnpaidInvoiceRow(invoice) {
        const statusClass = 'status-unpaid';
        const statusText = 'Non payé';
        
        const paidDateValue = invoice.paid_date ? 
            new Date(invoice.paid_date).toISOString().split('T')[0] : '';
        const dueDateValue = invoice.due_date ? 
            new Date(invoice.due_date).toISOString().split('T')[0] : '';
        
        return `
            <tr data-invoice-id="${invoice.id}">
                <td class="invoice-number"><strong>${invoice.order_id}</strong></td>
                <td>${this.formatDateShort(invoice.invoice_date)}</td>
                <td>${invoice.client_full_name || 'N/A'}</td>
                <td class="text-right">${formatCurrency(invoice.subtotal_ht)}</td>
                <td class="text-right">${formatCurrency(invoice.vat_amount)}</td>
                <td class="text-right"><strong>${formatCurrency(invoice.total_ttc)}</strong></td>
                <td>${dueDateValue ? this.formatDateShort(invoice.due_date) : 'Non définie'}</td>
                <td class="editable-cell text-right" data-field="amount_paid" data-type="number">
                    ${formatCurrency(invoice.amount_paid)}
                </td>
                <td class="text-right text-danger">
                    ${formatCurrency(invoice.amount_due)}
                </td>
                <td class="editable-cell" data-field="paid_date" data-type="date">
                    ${paidDateValue ? this.formatDateShort(invoice.paid_date) : 'Non payée'}
                </td>
                <td class="editable-cell status-cell" data-field="payment_status" data-type="select">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td class="text-center">
                    <a href="/api/admin/download-invoice/${invoice.order_id}/${invoice.user_id}" 
                    class="action-btn download-btn" 
                    target="_blank"
                    title="Télécharger la facture">
                        <i class="fas fa-file-pdf"></i>
                    </a>
                </td>
            </tr>
        `;
    }

    formatDateShort(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    attachUnpaidEventListeners() {
        document.querySelectorAll('.editable-cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.startEdit(e.currentTarget));
        });
    }

    startEdit(cell) {
        const row = cell.closest('tr');
        const invoiceId = row.dataset.invoiceId;
        const field = cell.dataset.field;
        const type = cell.dataset.type;
        
        const invoice = this.unpaidInvoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;

        if (this.editingCells.has(cell)) return;

        const currentValue = invoice[field];
        let input;

        if (type === 'select') {
            input = document.createElement('select');
            input.className = 'inline-edit-select';
            input.innerHTML = `
                <option value="unpaid" ${invoice.payment_status === 'unpaid' ? 'selected' : ''}>Non payé</option>
                <option value="partial" ${invoice.payment_status === 'partial' ? 'selected' : ''}>Partiel</option>
                <option value="paid" ${invoice.payment_status === 'paid' ? 'selected' : ''}>Payé</option>
            `;
        } else if (type === 'date') {
            input = document.createElement('input');
            input.type = 'date';
            input.className = 'inline-edit-input';
            input.value = currentValue ? new Date(currentValue).toISOString().split('T')[0] : '';
        } else if (type === 'number') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.className = 'inline-edit-input';
            input.value = currentValue || 0;
        }

        const originalContent = cell.innerHTML;
        
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();

        if (type === 'number') {
            input.select();
        }

        this.editingCells.set(cell, originalContent);

        const save = async () => {
            const newValue = input.value;
            await this.saveEdit(invoiceId, field, newValue, cell, originalContent);
        };

        const cancel = () => {
            cell.innerHTML = originalContent;
            this.editingCells.delete(cell);
        };

        if (type === 'select') {
            input.addEventListener('change', save);
        } else {
            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    save();
                } else if (e.key === 'Escape') {
                    cancel();
                }
            });
        }
    }

    async saveEdit(invoiceId, field, newValue, cell, originalContent) {
        const invoice = this.unpaidInvoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;

        try {
            let updateData = {};

            if (field === 'amount_paid') {
                const amountPaid = parseFloat(newValue) || 0;
                const amountDue = invoice.total_ttc - amountPaid;
                
                let paymentStatus;
                if (amountPaid >= invoice.total_ttc) {
                    paymentStatus = 'paid';
                } else if (amountPaid > 0) {
                    paymentStatus = 'partial';
                } else {
                    paymentStatus = 'unpaid';
                }

                updateData = {
                    amount_paid: amountPaid,
                    amount_due: amountDue,
                    payment_status: paymentStatus,
                    paid_date: amountPaid > 0 && !invoice.paid_date ? new Date().toISOString() : invoice.paid_date
                };
            } else if (field === 'paid_date') {
                updateData = {
                    amount_paid: invoice.amount_paid,
                    amount_due: invoice.amount_due,
                    payment_status: invoice.payment_status,
                    paid_date: newValue || null
                };
            } else if (field === 'payment_status') {
                let amountPaid = invoice.amount_paid;
                let amountDue = invoice.amount_due;
                
                if (newValue === 'paid' && amountPaid < invoice.total_ttc) {
                    amountPaid = invoice.total_ttc;
                    amountDue = 0;
                } else if (newValue === 'unpaid') {
                    amountPaid = 0;
                    amountDue = invoice.total_ttc;
                }
                
                updateData = {
                    amount_paid: amountPaid,
                    amount_due: amountDue,
                    payment_status: newValue,
                    paid_date: newValue === 'paid' && !invoice.paid_date ? new Date().toISOString() : invoice.paid_date
                };
            }

            const response = await fetch(`/api/invoices/${invoiceId}/payment`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });

            const responseText = await response.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error('Cannot parse as JSON:', e);
                throw new Error('Le serveur a retourné une réponse invalide');
            }

            if (!response.ok) {
                throw new Error(responseData.error || responseData.message || 'Erreur lors de la mise à jour');
            }

            showNotification('Facture mise à jour avec succès', 'success');
            await this.loadUnpaidInvoices();
            
        } catch (error) {
            console.error('Erreur complète:', error);
            showNotification('Erreur: ' + error.message, 'error');
            cell.innerHTML = originalContent;
        }

        this.editingCells.delete(cell);
    }

    exportUnpaidToCSV() {
        if (!this.unpaidInvoices || this.unpaidInvoices.length === 0) {
            showNotification('Aucune facture impayée à exporter', 'warning');
            return;
        }

        const headers = [
            'Numéro facture',
            'Date facture',
            'Client',
            'Montant HT',
            'TVA',
            'Montant TTC',
            'Date échéance',
            'Montant encaissé',
            'Solde dû',
            'Date paiement',
            'Statut'
        ];

        const sortedInvoices = [...this.unpaidInvoices].sort((a, b) => {
            const dateA = new Date(a.invoice_date);
            const dateB = new Date(b.invoice_date);
            return this.unpaidSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // Calculer les totaux
        const totals = sortedInvoices.reduce((acc, invoice) => {
            acc.count += 1;
            acc.subtotal_ht += parseFloat(invoice.subtotal_ht) || 0;
            acc.vat_amount += parseFloat(invoice.vat_amount) || 0;
            acc.total_ttc += parseFloat(invoice.total_ttc) || 0;
            acc.amount_paid += parseFloat(invoice.amount_paid) || 0;
            acc.amount_due += parseFloat(invoice.amount_due) || 0;
            return acc;
        }, {
            count: 0,
            subtotal_ht: 0,
            vat_amount: 0,
            total_ttc: 0,
            amount_paid: 0,
            amount_due: 0
        });

        // Créer les lignes de données
        const rows = sortedInvoices.map(invoice => {
            return [
                invoice.order_id || '',
                this.formatDateShort(invoice.invoice_date),
                `"${(invoice.client_full_name || '').replace(/"/g, '""')}"`,
                this.formatNumberForCSV(invoice.subtotal_ht),
                this.formatNumberForCSV(invoice.vat_amount),
                this.formatNumberForCSV(invoice.total_ttc),
                invoice.due_date ? this.formatDateShort(invoice.due_date) : '',
                this.formatNumberForCSV(invoice.amount_paid),
                this.formatNumberForCSV(invoice.amount_due),
                invoice.paid_date ? this.formatDateShort(invoice.paid_date) : '',
                'Non payé'
            ].join(',');
        });

        // Ajouter une ligne vide
        rows.push('');

        // Ajouter la ligne de totaux
        const totalsRow = [
            `"TOTAL (${totals.count} factures impayées)"`,
            '',
            '',
            this.formatNumberForCSV(totals.subtotal_ht),
            this.formatNumberForCSV(totals.vat_amount),
            this.formatNumberForCSV(totals.total_ttc),
            '',
            this.formatNumberForCSV(totals.amount_paid),
            this.formatNumberForCSV(totals.amount_due),
            '',
            ''
        ].join(',');
        
        rows.push(totalsRow);

        // Combiner en-têtes et lignes
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const fileName = `factures_impayees_${this.selectedYear}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`Export CSV réussi : ${fileName}`, 'success');
    }

    formatNumberForCSV(number) {
        if (number === null || number === undefined) return '0.00';
        return parseFloat(number).toFixed(2);
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
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">Aucun client trouvé</td></tr>';
            return;
        }

        const sortedClients = this.sortClients(clients, this.currentSortOption);
        const isGroupBySource = this.viewMode === 'by_source';

        let html = '';

        if (isGroupBySource) {
            // Grouper par referral_source
            const groupedByReferral = {};
            sortedClients.forEach(client => {
                const source = client.referral_source || 'Non défini';
                if (!groupedByReferral[source]) {
                    groupedByReferral[source] = [];
                }
                groupedByReferral[source].push(client);
            });

            // Trier les sources alphabétiquement (Non défini à la fin)
            const sources = Object.keys(groupedByReferral).sort((a, b) => {
                if (a === 'Non défini') return 1;
                if (b === 'Non défini') return -1;
                return a.localeCompare(b);
            });

            sources.forEach(source => {
                const groupClients = groupedByReferral[source];
                const groupTotal = groupClients.reduce((sum, c) => sum + (c.total_amount || 0), 0);
                const groupPaid = groupClients.reduce((sum, c) => sum + (c.total_paid || 0), 0);
                const groupDue = groupClients.reduce((sum, c) => sum + (c.total_due || 0), 0);
                const groupCommissionTotal = groupClients.reduce((sum, c) => sum + (c.commission_total || 0), 0);
                const groupCommissionReceived = groupClients.reduce((sum, c) => sum + (c.commission_received || 0), 0);

                // Ligne d'en-tête du groupe
                html += `
                    <tr class="referral-group-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <td colspan="8" style="padding: 10px 15px; font-weight: bold;">
                            <i class="fas fa-users"></i> ${source}
                            <span style="float: right; font-size: 0.9em;">
                                ${groupClients.length} client(s) | Total: ${formatCurrency(groupTotal)} | Payé: ${formatCurrency(groupPaid)} | Dû: ${formatCurrency(groupDue)} | Commissions: ${formatCurrency(groupCommissionReceived)} reçu sur ${formatCurrency(groupCommissionTotal)} à recevoir
                            </span>
                        </td>
                    </tr>
                `;

                // Lignes des clients du groupe
                groupClients.forEach(client => {
                    html += `
                        <tr>
                            <td><strong>${client.user_id}</strong></td>
                            <td>${client.client_full_name || 'N/A'}</td>
                            <td>${client.referral_source || 'Non défini'}</td>
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
                    `;
                });
            });
        } else {
            // Affichage simple sans groupement
            html = sortedClients.map(client => `
                <tr>
                    <td><strong>${client.user_id}</strong></td>
                    <td>${client.client_full_name || 'N/A'}</td>
                    <td>${client.referral_source || 'Non défini'}</td>
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

        tbody.innerHTML = html;
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