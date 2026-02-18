// admin/js/modules/compta/comptaMain.js - Logique principale de la page comptabilité

import { formatCurrency } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';
import { ComptaChart } from './comptaChart.js';

class ComptaMain {
    constructor() {
        this.allClientsData = [];
        this.unpaidInvoices = [];
        this.allInvoicesData = [];
        this.allInvoicesFiltered = [];
        this.unpaidSortOrder = 'desc';
		this.unpaidSortType = 'date';
        this.selectedYear = new Date().getFullYear();
        this.currentSortOption = 'total_desc';
        this.allInvoicesSortOption = 'date_desc';
        this.viewMode = 'all';
        this.editingCells = new Map();
		this.chart = null;
        this._savedScrollY = null;
        this.init();
    }

    init() {
        this.populateYearSelect();
        this.restoreState();
        this.setupEventListeners();
        this.checkUrlParams();

        // Charger les données selon l'onglet actif
        const activeTab = document.querySelector('.compta-tab-btn.active');
        const tab = activeTab ? activeTab.dataset.tab : 'overview';
        if (tab === 'overview') {
            this.loadOverviewData();
            this.loadAndRenderChart();
        } else if (tab === 'clients') {
            this.loadClientsData();
        } else if (tab === 'all_invoices') {
            this.loadAllInvoices();
        } else if (tab === 'unpaid') {
            this.loadUnpaidInvoices();
        }
    }

    // === Sauvegarde / Restauration de l'état (tri, onglet, scroll, recherche) ===

    saveState() {
        const activeTab = document.querySelector('.compta-tab-btn.active');
        const state = {
            tab: activeTab ? activeTab.dataset.tab : 'overview',
            year: this.selectedYear,
            viewMode: this.viewMode,
            currentSortOption: this.currentSortOption,
            allInvoicesSortOption: this.allInvoicesSortOption,
            unpaidSortOrder: this.unpaidSortOrder,
            unpaidSortType: this.unpaidSortType,
            clientSearch: document.getElementById('clientSearchInput')?.value || '',
            allInvoicesSearch: document.getElementById('allInvoicesSearchInput')?.value || '',
            scrollY: window.scrollY
        };
        sessionStorage.setItem('comptaState', JSON.stringify(state));
    }

    restoreState() {
        const saved = sessionStorage.getItem('comptaState');
        if (!saved) return;

        try {
            const state = JSON.parse(saved);

            // Restaurer l'année
            if (state.year !== undefined) {
                this.selectedYear = state.year;
                const yearSelect = document.getElementById('yearSelect');
                if (yearSelect) yearSelect.value = state.year;
            }

            // Restaurer le mode de vue
            if (state.viewMode) {
                this.viewMode = state.viewMode;
                const viewModeSelect = document.getElementById('viewModeSelect');
                if (viewModeSelect) viewModeSelect.value = state.viewMode;
            }

            // Restaurer les options de tri
            if (state.currentSortOption) {
                this.currentSortOption = state.currentSortOption;
                const sortSelect = document.getElementById('sortSelect');
                if (sortSelect) sortSelect.value = state.currentSortOption;
            }

            if (state.allInvoicesSortOption) {
                this.allInvoicesSortOption = state.allInvoicesSortOption;
                const allInvSort = document.getElementById('allInvoicesSortSelect');
                if (allInvSort) allInvSort.value = state.allInvoicesSortOption;
            }

            if (state.unpaidSortOrder) {
                this.unpaidSortOrder = state.unpaidSortOrder;
            }

            if (state.unpaidSortType) {
                this.unpaidSortType = state.unpaidSortType;
                // Mettre à jour les boutons visuellement
                this.updateUnpaidSortButtons();
            }

            // Restaurer les recherches
            if (state.clientSearch) {
                const input = document.getElementById('clientSearchInput');
                if (input) input.value = state.clientSearch;
            }
            if (state.allInvoicesSearch) {
                const input = document.getElementById('allInvoicesSearchInput');
                if (input) input.value = state.allInvoicesSearch;
            }

            // Restaurer l'onglet actif (sans déclencher le chargement des données)
            if (state.tab && state.tab !== 'overview') {
                document.querySelectorAll('.compta-tab-btn').forEach(b => b.classList.remove('active'));
                const tabBtn = document.querySelector(`[data-tab="${state.tab}"]`);
                if (tabBtn) tabBtn.classList.add('active');
                document.querySelectorAll('.compta-tab-content').forEach(c => c.classList.remove('active'));
                const tabContent = document.getElementById(`${state.tab}-tab`);
                if (tabContent) tabContent.classList.add('active');
            }

            // Restaurer la position de scroll après le chargement des données
            if (state.scrollY) {
                this._savedScrollY = state.scrollY;
            }

        } catch (e) {
            console.error('Erreur restauration état compta:', e);
        }
    }

    updateUnpaidSortButtons() {
        const sortBtn = document.getElementById('unpaidSortBtn');
        const sortText = document.getElementById('unpaidSortText');
        const sortClientBtn = document.getElementById('unpaidSortClientBtn');
        const sortClientText = document.getElementById('unpaidSortClientText');

        if (sortBtn && sortText) {
            const icon = sortBtn.querySelector('i');
            if (this.unpaidSortOrder === 'desc') {
                if (icon) icon.className = 'fas fa-sort-amount-down';
                sortText.textContent = 'Plus récente à plus ancienne';
            } else {
                if (icon) icon.className = 'fas fa-sort-amount-up';
                sortText.textContent = 'Plus ancienne à plus récente';
            }
        }

        if (sortClientBtn && sortClientText) {
            const icon = sortClientBtn.querySelector('i');
            if (this.unpaidSortType === 'client') {
                if (icon) icon.className = 'fas fa-sort-alpha-down';
                sortClientText.textContent = 'Trié par client (A-Z)';
            } else {
                if (icon) icon.className = 'fas fa-calendar-alt';
                sortClientText.textContent = 'Trié par date';
            }
        }
    }

    restoreScrollPosition() {
        if (this._savedScrollY) {
            window.scrollTo(0, this._savedScrollY);
            this._savedScrollY = null;
        }
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
            this.saveState();
            const activeTab = document.querySelector('.compta-tab-btn.active').dataset.tab;
            if (activeTab === 'clients') {
                this.loadClientsData();
            } else if (activeTab === 'unpaid') {
                this.loadUnpaidInvoices();
            } else if (activeTab === 'all_invoices') {
                this.loadAllInvoices();
            } else {
                this.loadOverviewData();
				this.loadAndRenderChart();
            }
        });

        // Mode de vue (tous / par source)
        document.getElementById('viewModeSelect').addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            this.saveState();
            this.displayClientsData(this.allClientsData);
        });

        // Tri des clients
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSortOption = e.target.value;
            this.saveState();
            this.displayClientsData(this.allClientsData);
        });

        // Onglets
        document.querySelectorAll('.compta-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
                this.saveState();
            });
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

        // === Toutes les factures ===
        const allInvoicesSearchBtn = document.getElementById('allInvoicesSearchBtn');
        if (allInvoicesSearchBtn) {
            allInvoicesSearchBtn.addEventListener('click', () => this.searchAllInvoices());
        }
        const allInvoicesSearchInput = document.getElementById('allInvoicesSearchInput');
        if (allInvoicesSearchInput) {
            allInvoicesSearchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.searchAllInvoices();
            });
        }
        const allInvoicesSortSelect = document.getElementById('allInvoicesSortSelect');
        if (allInvoicesSortSelect) {
            allInvoicesSortSelect.addEventListener('change', (e) => {
                this.allInvoicesSortOption = e.target.value;
                this.saveState();
                this.displayAllInvoices();
            });
        }
        const exportAllInvoicesBtn = document.getElementById('exportAllInvoicesCSVBtn');
        if (exportAllInvoicesBtn) {
            exportAllInvoicesBtn.addEventListener('click', () => this.exportAllInvoicesToCSV());
        }

        // Sauvegarder l'état au moment de quitter la page (scroll inclus)
        window.addEventListener('beforeunload', () => this.saveState());
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);

        // Restaurer l'année si passée en paramètre
        const yearParam = urlParams.get('year');
        if (yearParam) {
            const yearSelect = document.getElementById('yearSelect');
            if (yearParam === 'all') {
                this.selectedYear = 'all';
                yearSelect.value = 'all';
            } else {
                const yearNum = parseInt(yearParam);
                if (!isNaN(yearNum)) {
                    this.selectedYear = yearNum;
                    yearSelect.value = yearNum;
                }
            }
        }

        const tab = urlParams.get('tab');
        if (tab === 'clients') {
            document.querySelector('[data-tab="clients"]').click();
        } else if (tab === 'unpaid') {
            document.querySelector('[data-tab="unpaid"]').click();
        } else if (tab === 'all_invoices') {
            document.querySelector('[data-tab="all_invoices"]').click();
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
		} else if (targetTab === 'all_invoices') {
            this.loadAllInvoices();
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
            // Appliquer la recherche sauvegardée si elle existe
            const searchInput = document.getElementById('clientSearchInput');
            if (searchInput && searchInput.value.trim()) {
                this.searchClients();
            } else {
                this.displayClientsData(this.allClientsData);
            }
            this.restoreScrollPosition();
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
            this.restoreScrollPosition();
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

        this.saveState();
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

		this.saveState();
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

		// Badges mobiles
		this.renderInvoicesBadges(sortedInvoices, 'unpaidBadgesContainer');
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

    // ===== BADGES MOBILES =====

    createClientBadgeHtml(client) {
        const commissionTotal = client.commission_total || 0;
        const commissionReceived = client.commission_received || 0;
        return `
            <div class="client-badge">
                <div class="client-badge-header">
                    <span class="client-badge-id">${client.user_id}</span>
                    <span class="client-badge-name">${client.client_full_name || 'N/A'}</span>
                </div>
                ${client.referral_source ? `<div class="client-badge-company"><i class="fas fa-tag" style="font-size:9px;margin-right:3px;color:#667eea;"></i>${client.referral_source}</div>` : ''}
                <div class="client-badge-stats">
                    <div class="client-badge-stat">
                        <span class="client-badge-stat-label">Fact.</span>
                        <span class="client-badge-stat-value">${client.invoice_count}</span>
                    </div>
                    <div class="client-badge-stat">
                        <span class="client-badge-stat-label">Total</span>
                        <span class="client-badge-stat-value">${formatCurrency(client.total_amount)}</span>
                    </div>
                    <div class="client-badge-stat">
                        <span class="client-badge-stat-label">Payé</span>
                        <span class="client-badge-stat-value success">${formatCurrency(client.total_paid)}</span>
                    </div>
                    <div class="client-badge-stat">
                        <span class="client-badge-stat-label">Dû</span>
                        <span class="client-badge-stat-value danger">${formatCurrency(client.total_due)}</span>
                    </div>
                    <a href="/admin/client-invoices?client_id=${encodeURIComponent(client.user_id)}&year=${this.selectedYear}"
                       class="badge-action-btn">
                        <i class="fas fa-eye"></i>
                    </a>
                </div>
                <div class="client-badge-commission">
                    <i class="fas fa-coins"></i>
                    <span class="commission-received">${formatCurrency(commissionReceived)}</span> reçu sur <span class="commission-total">${formatCurrency(commissionTotal)}</span> à recevoir
                </div>
            </div>
        `;
    }

    renderClientsBadges(clients, isGroupBySource = false) {
        const container = document.getElementById('clientsBadgesContainer');
        if (!container) return;

        if (!clients || clients.length === 0) {
            container.innerHTML = '<p class="no-data">Aucun client trouvé</p>';
            return;
        }

        if (isGroupBySource) {
            // Grouper par source
            const groups = {};
            clients.forEach(c => {
                const src = c.referral_source || 'Non défini';
                if (!groups[src]) groups[src] = [];
                groups[src].push(c);
            });
            const sources = Object.keys(groups).sort((a, b) => {
                if (a === 'Non défini') return 1;
                if (b === 'Non défini') return -1;
                return a.localeCompare(b);
            });
            let html = '';
            sources.forEach(source => {
                const groupClients = groups[source];
                const groupTotal = groupClients.reduce((s, c) => s + (c.total_amount || 0), 0);
                const groupPaid = groupClients.reduce((s, c) => s + (c.total_paid || 0), 0);
                const groupDue = groupClients.reduce((s, c) => s + (c.total_due || 0), 0);
                const groupCommissionTotal = groupClients.reduce((s, c) => s + (c.commission_total || 0), 0);
                const groupCommissionReceived = groupClients.reduce((s, c) => s + (c.commission_received || 0), 0);
                html += `<div class="client-badge-group-header">
                    <div class="group-header-title"><i class="fas fa-users"></i> ${source} — ${groupClients.length} client(s)</div>
                    <div class="group-header-stats">
                        <span>Total: ${formatCurrency(groupTotal)}</span>
                        <span class="success">Payé: ${formatCurrency(groupPaid)}</span>
                        <span class="danger">Dû: ${formatCurrency(groupDue)}</span>
                    </div>
                    <div class="group-header-commission">
                        <i class="fas fa-coins"></i> Comm: ${formatCurrency(groupCommissionReceived)} reçu / ${formatCurrency(groupCommissionTotal)}
                    </div>
                </div>`;
                groupClients.forEach(client => {
                    html += this.createClientBadgeHtml(client);
                });
            });
            container.innerHTML = html;
            return;
        }

        container.innerHTML = clients.map(client => this.createClientBadgeHtml(client)).join('');
    }

    renderInvoicesBadges(invoices, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!invoices || invoices.length === 0) {
            container.innerHTML = '<p class="no-data">Aucune facture trouvée</p>';
            return;
        }

        // Source des données selon le container
        const dataSource = containerId === 'unpaidBadgesContainer' ? 'unpaid' : 'all';

        container.innerHTML = invoices.map(invoice => {
            const statusClass = this.getInvoiceStatusClass(invoice.payment_status);
            const statusText = this.getInvoiceStatusText(invoice.payment_status);
            return `
            <div class="invoice-badge" data-invoice-id="${invoice.id}">
                <div class="invoice-badge-header">
                    <span class="invoice-badge-number">${invoice.order_id}</span>
                    <span class="invoice-badge-date">${this.formatDateShort(invoice.invoice_date)}</span>
                </div>
                <div class="invoice-badge-client">${invoice.client_full_name || 'N/A'}</div>
                <div class="invoice-badge-amounts">
                    <div class="invoice-badge-amount">
                        <span class="invoice-badge-amount-label">TTC</span>
                        <span class="invoice-badge-amount-value total">${formatCurrency(invoice.total_ttc)}</span>
                    </div>
                    <div class="invoice-badge-amount">
                        <span class="invoice-badge-amount-label">Payé</span>
                        <span class="invoice-badge-amount-value paid">${formatCurrency(invoice.amount_paid)}</span>
                    </div>
                    <div class="invoice-badge-amount">
                        <span class="invoice-badge-amount-label">Dû</span>
                        <span class="invoice-badge-amount-value due">${formatCurrency(invoice.amount_due)}</span>
                    </div>
                </div>
                <div class="invoice-badge-footer">
                    <span class="invoice-badge-status ${statusClass}">${statusText}</span>
                    <button class="invoice-badge-edit-btn" ontouchstart="void(0)" onclick="event.preventDefault();window._comptaEditBadge(${invoice.id},'${dataSource}')">
                        <i class="fas fa-pen"></i>
                    </button>
                    <a href="/api/admin/download-invoice/${invoice.order_id}/${invoice.user_id}"
                       class="invoice-badge-action" target="_blank">
                        <i class="fas fa-file-pdf"></i>
                    </a>
                </div>
            </div>
            `;
        }).join('');

        window._comptaEditBadge = (invoiceId, source) => this.openMobileEditModal(invoiceId, source);
    }

    openMobileEditModal(invoiceId, source) {
        // Chercher la facture dans la bonne source
        const list = source === 'unpaid' ? this.unpaidInvoices : this.allInvoicesData;
        const invoice = list.find(inv => inv.id == invoiceId);
        if (!invoice) return;

        document.getElementById('mobileEditOverlay')?.remove();

        const paidDateValue = invoice.paid_date ? new Date(invoice.paid_date).toISOString().split('T')[0] : '';
        const dueDateValue = invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : '';

        const overlay = document.createElement('div');
        overlay.id = 'mobileEditOverlay';
        overlay.className = 'mobile-edit-overlay';
        overlay.innerHTML = `
            <div class="mobile-edit-sheet">
                <h3><i class="fas fa-file-invoice" style="color:#667eea;margin-right:6px;"></i>${invoice.order_id}</h3>
                <span class="mobile-edit-subtitle">${invoice.client_full_name || ''} — TTC: ${formatCurrency(invoice.total_ttc)}</span>

                <div class="mobile-edit-field">
                    <label>Montant encaissé (CHF)</label>
                    <input type="number" id="meAmountPaid" step="0.01" min="0" value="${parseFloat(invoice.amount_paid || 0).toFixed(2)}">
                </div>
                <div class="mobile-edit-field">
                    <label>Date d'échéance</label>
                    <input type="date" id="meDueDate" value="${dueDateValue}">
                </div>
                <div class="mobile-edit-field">
                    <label>Date de paiement</label>
                    <input type="date" id="mePaidDate" value="${paidDateValue}">
                </div>
                <div class="mobile-edit-field">
                    <label>Statut paiement</label>
                    <select id="mePaymentStatus">
                        <option value="unpaid" ${invoice.payment_status === 'unpaid' ? 'selected' : ''}>Non payé</option>
                        <option value="partial" ${invoice.payment_status === 'partial' ? 'selected' : ''}>Partiel</option>
                        <option value="paid" ${invoice.payment_status === 'paid' ? 'selected' : ''}>Payé</option>
                    </select>
                </div>
                <div class="mobile-edit-actions">
                    <button class="mobile-edit-cancel" id="meCancel">Annuler</button>
                    <button class="mobile-edit-save" id="meSave"><i class="fas fa-check"></i> Enregistrer</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.getElementById('meCancel').addEventListener('click', () => overlay.remove());

        // Auto-remplir les champs selon le statut choisi
        document.getElementById('mePaymentStatus').addEventListener('change', (e) => {
            const status = e.target.value;
            const today = new Date().toISOString().split('T')[0];
            if (status === 'paid') {
                document.getElementById('meAmountPaid').value = parseFloat(invoice.total_ttc).toFixed(2);
                if (!document.getElementById('mePaidDate').value) {
                    document.getElementById('mePaidDate').value = today;
                }
            } else if (status === 'unpaid') {
                document.getElementById('meAmountPaid').value = '0.00';
                document.getElementById('mePaidDate').value = '';
            }
        });

        document.getElementById('meSave').addEventListener('click', async () => {
            const amountPaid = parseFloat(document.getElementById('meAmountPaid').value) || 0;
            const dueDate = document.getElementById('meDueDate').value;
            const paidDate = document.getElementById('mePaidDate').value;
            const paymentStatus = document.getElementById('mePaymentStatus').value;

            const amountDue = Math.max(0, invoice.total_ttc - amountPaid);
            const updateData = {
                amount_paid: amountPaid,
                amount_due: amountDue,
                payment_status: paymentStatus,
                paid_date: paidDate || null,
                due_date: dueDate || null
            };

            try {
                const resp = await fetch(`/api/invoices/${invoiceId}/payment`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updateData)
                });
                if (!resp.ok) throw new Error('Erreur mise à jour');
                showNotification('Facture mise à jour', 'success');
                overlay.remove();
                // Recharger selon la source
                if (source === 'unpaid') {
                    await this.loadUnpaidInvoices();
                } else {
                    await this.loadAllInvoices();
                }
            } catch (err) {
                showNotification('Erreur: ' + err.message, 'error');
            }
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
                let paidDate = invoice.paid_date;

                if (newValue === 'paid') {
                    amountPaid = invoice.total_ttc;
                    amountDue = 0;
                    if (!paidDate) paidDate = new Date().toISOString();
                } else if (newValue === 'unpaid') {
                    amountPaid = 0;
                    amountDue = invoice.total_ttc;
                    paidDate = null;
                }

                updateData = {
                    amount_paid: amountPaid,
                    amount_due: amountDue,
                    payment_status: newValue,
                    paid_date: paidDate
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
            showNotification('No unpaid invoices to export', 'warning');
            return;
        }

        const headers = [
            'Invoice Number',
            'Invoice Date',
            'Client',
            'Amount excl. VAT',
            'VAT',
            'Amount incl. VAT',
            'Due Date',
            'Amount Paid',
            'Balance Due',
            'Payment Date',
            'Status'
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
                'Unpaid'
            ].join(',');
        });

        // Ajouter une ligne vide
        rows.push('');

        // Ajouter la ligne de totaux
        const totalsRow = [
            `"TOTAL (${totals.count} unpaid invoices)"`,
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
        
        const fileName = `unpaid_invoices_${this.selectedYear}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`CSV export successful: ${fileName}`, 'success');
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

        // Badges mobiles
        this.renderClientsBadges(sortedClients, isGroupBySource);
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

    // ===== TOUTES LES FACTURES =====

    async loadAllInvoices() {
        try {
            const response = await fetch(`/api/invoices/all?year=${this.selectedYear}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des factures');
            }

            const data = await response.json();
            this.allInvoicesData = data.invoices || [];
            this.allInvoicesFiltered = [...this.allInvoicesData];
            // Appliquer la recherche sauvegardée si elle existe
            const searchInput = document.getElementById('allInvoicesSearchInput');
            if (searchInput && searchInput.value.trim()) {
                this.searchAllInvoices();
            } else {
                this.displayAllInvoices();
            }
            this.restoreScrollPosition();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des factures', 'error');
            document.getElementById('allInvoicesTableBody').innerHTML =
                '<tr><td colspan="12" class="error-message">Impossible de charger les factures</td></tr>';
        }
    }

    sortAllInvoices(invoices) {
        const sorted = [...invoices];
        switch (this.allInvoicesSortOption) {
            case 'date_desc':
                return sorted.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
            case 'date_asc':
                return sorted.sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));
            case 'total_desc':
                return sorted.sort((a, b) => (b.total_ttc || 0) - (a.total_ttc || 0));
            case 'total_asc':
                return sorted.sort((a, b) => (a.total_ttc || 0) - (b.total_ttc || 0));
            case 'paid_desc':
                return sorted.sort((a, b) => (b.amount_paid || 0) - (a.amount_paid || 0));
            case 'paid_asc':
                return sorted.sort((a, b) => (a.amount_paid || 0) - (b.amount_paid || 0));
            case 'due_desc':
                return sorted.sort((a, b) => (b.amount_due || 0) - (a.amount_due || 0));
            case 'due_asc':
                return sorted.sort((a, b) => (a.amount_due || 0) - (b.amount_due || 0));
            case 'name_asc':
                return sorted.sort((a, b) => (a.client_full_name || '').localeCompare(b.client_full_name || ''));
            case 'name_desc':
                return sorted.sort((a, b) => (b.client_full_name || '').localeCompare(a.client_full_name || ''));
            default:
                return sorted;
        }
    }

    displayAllInvoices() {
        const tbody = document.getElementById('allInvoicesTableBody');

        if (!this.allInvoicesFiltered || this.allInvoicesFiltered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="no-data">Aucune facture trouvée</td></tr>';
            this.updateAllInvoicesSummaryBar([]);
            return;
        }

        const sorted = this.sortAllInvoices(this.allInvoicesFiltered);
        tbody.innerHTML = sorted.map(invoice => this.createAllInvoiceRow(invoice)).join('');
        this.attachAllInvoicesEventListeners();
        this.updateAllInvoicesSummaryBar(this.allInvoicesFiltered);

        // Badges mobiles
        this.renderInvoicesBadges(sorted, 'allInvoicesBadgesContainer');
    }

    updateAllInvoicesSummaryBar(invoices) {
        let bar = document.getElementById('allInvoicesSummaryBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'allInvoicesSummaryBar';
            bar.className = 'invoices-summary-bar';
            const container = document.querySelector('#all_invoices-tab .client-invoices-container');
            if (container) container.parentNode.insertBefore(bar, container);
        }

        if (!invoices || invoices.length === 0) {
            bar.innerHTML = '';
            return;
        }

        const totals = invoices.reduce((acc, inv) => {
            acc.ttc += parseFloat(inv.total_ttc) || 0;
            acc.paid += parseFloat(inv.amount_paid) || 0;
            acc.due += parseFloat(inv.amount_due) || 0;
            return acc;
        }, { ttc: 0, paid: 0, due: 0 });

        bar.innerHTML = `
            <div class="summary-pill pill-count">
                <i class="fas fa-file-invoice"></i>
                <span><span class="pill-value">${invoices.length}</span> factures</span>
            </div>
            <div class="summary-pill pill-total">
                <i class="fas fa-coins"></i>
                <span>Total: <span class="pill-value">${formatCurrency(totals.ttc)}</span></span>
            </div>
            <div class="summary-pill pill-paid">
                <i class="fas fa-check-circle"></i>
                <span>Payé: <span class="pill-value">${formatCurrency(totals.paid)}</span></span>
            </div>
            <div class="summary-pill pill-due">
                <i class="fas fa-exclamation-circle"></i>
                <span>Dû: <span class="pill-value">${formatCurrency(totals.due)}</span></span>
            </div>
        `;
    }

    createAllInvoiceRow(invoice) {
        const statusClass = this.getInvoiceStatusClass(invoice.payment_status);
        const statusText = this.getInvoiceStatusText(invoice.payment_status);

        const paidDateValue = invoice.paid_date ?
            new Date(invoice.paid_date).toISOString().split('T')[0] : '';
        const dueDateValue = invoice.due_date ?
            new Date(invoice.due_date).toISOString().split('T')[0] : '';

        return `
            <tr data-invoice-id="${invoice.id}" data-source="all_invoices">
                <td class="invoice-number"><strong>${invoice.order_id}</strong></td>
                <td>${this.formatDateShort(invoice.invoice_date)}</td>
                <td>${invoice.client_full_name || 'N/A'}</td>
                <td class="text-right">${formatCurrency(invoice.subtotal_ht)}</td>
                <td class="text-right">${formatCurrency(invoice.vat_amount)}</td>
                <td class="text-right"><strong>${formatCurrency(invoice.total_ttc)}</strong></td>
                <td>${dueDateValue ? this.formatDateShort(invoice.due_date) : 'Non définie'}</td>
                <td class="all-inv-editable text-right" data-field="amount_paid" data-type="number">
                    ${formatCurrency(invoice.amount_paid)}
                </td>
                <td class="text-right ${invoice.amount_due > 0 ? 'text-danger' : 'text-success'}">
                    ${formatCurrency(invoice.amount_due)}
                </td>
                <td class="all-inv-editable" data-field="paid_date" data-type="date">
                    ${paidDateValue ? this.formatDateShort(invoice.paid_date) : 'Non payée'}
                </td>
                <td class="all-inv-editable status-cell" data-field="payment_status" data-type="select">
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

    getInvoiceStatusClass(status) {
        const map = { 'paid': 'status-paid', 'partial': 'status-partial', 'unpaid': 'status-unpaid' };
        return map[status] || 'status-unpaid';
    }

    getInvoiceStatusText(status) {
        const map = { 'paid': 'Paid', 'partial': 'Partial', 'unpaid': 'Unpaid' };
        return map[status] || 'Unpaid';
    }

    attachAllInvoicesEventListeners() {
        document.querySelectorAll('.all-inv-editable').forEach(cell => {
            cell.addEventListener('click', (e) => this.startEditAllInvoice(e.currentTarget));
        });
    }

    startEditAllInvoice(cell) {
        const row = cell.closest('tr');
        const invoiceId = row.dataset.invoiceId;
        const field = cell.dataset.field;
        const type = cell.dataset.type;

        const invoice = this.allInvoicesData.find(inv => inv.id == invoiceId);
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
            await this.saveEditAllInvoice(invoiceId, field, newValue, cell, originalContent);
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

    async saveEditAllInvoice(invoiceId, field, newValue, cell, originalContent) {
        const invoice = this.allInvoicesData.find(inv => inv.id == invoiceId);
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
                let paidDate = invoice.paid_date;

                if (newValue === 'paid') {
                    amountPaid = invoice.total_ttc;
                    amountDue = 0;
                    if (!paidDate) paidDate = new Date().toISOString();
                } else if (newValue === 'unpaid') {
                    amountPaid = 0;
                    amountDue = invoice.total_ttc;
                    paidDate = null;
                }

                updateData = {
                    amount_paid: amountPaid,
                    amount_due: amountDue,
                    payment_status: newValue,
                    paid_date: paidDate
                };
            }

            const response = await fetch(`/api/invoices/${invoiceId}/payment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
            await this.loadAllInvoices();

        } catch (error) {
            console.error('Erreur complète:', error);
            showNotification('Erreur: ' + error.message, 'error');
            cell.innerHTML = originalContent;
        }

        this.editingCells.delete(cell);
    }

    searchAllInvoices() {
        const searchTerm = document.getElementById('allInvoicesSearchInput').value.toLowerCase().trim();

        if (!searchTerm) {
            this.allInvoicesFiltered = [...this.allInvoicesData];
        } else {
            this.allInvoicesFiltered = this.allInvoicesData.filter(inv => {
                const name = (inv.client_full_name || '').toLowerCase();
                const orderId = (inv.order_id || '').toLowerCase();
                const userId = (inv.user_id || '').toLowerCase();
                return name.includes(searchTerm) || orderId.includes(searchTerm) || userId.includes(searchTerm);
            });
        }

        this.displayAllInvoices();
    }

    exportAllInvoicesToCSV() {
        if (!this.allInvoicesFiltered || this.allInvoicesFiltered.length === 0) {
            showNotification('No invoices to export', 'warning');
            return;
        }

        const sorted = this.sortAllInvoices(this.allInvoicesFiltered);

        const headers = [
            'Invoice Number', 'Invoice Date', 'Client',
            'Amount excl. VAT', 'VAT', 'Amount incl. VAT',
            'Due Date', 'Amount Paid', 'Balance Due',
            'Payment Date', 'Status'
        ];

        const totals = sorted.reduce((acc, inv) => {
            acc.count += 1;
            acc.subtotal_ht += parseFloat(inv.subtotal_ht) || 0;
            acc.vat_amount += parseFloat(inv.vat_amount) || 0;
            acc.total_ttc += parseFloat(inv.total_ttc) || 0;
            acc.amount_paid += parseFloat(inv.amount_paid) || 0;
            acc.amount_due += parseFloat(inv.amount_due) || 0;
            return acc;
        }, { count: 0, subtotal_ht: 0, vat_amount: 0, total_ttc: 0, amount_paid: 0, amount_due: 0 });

        const rows = sorted.map(inv => [
            inv.order_id || '',
            this.formatDateShort(inv.invoice_date),
            `"${(inv.client_full_name || '').replace(/"/g, '""')}"`,
            this.formatNumberForCSV(inv.subtotal_ht),
            this.formatNumberForCSV(inv.vat_amount),
            this.formatNumberForCSV(inv.total_ttc),
            inv.due_date ? this.formatDateShort(inv.due_date) : '',
            this.formatNumberForCSV(inv.amount_paid),
            this.formatNumberForCSV(inv.amount_due),
            inv.paid_date ? this.formatDateShort(inv.paid_date) : '',
            this.getInvoiceStatusText(inv.payment_status)
        ].join(','));

        rows.push('');
        rows.push([
            `"TOTAL (${totals.count} invoices)"`, '', '',
            this.formatNumberForCSV(totals.subtotal_ht),
            this.formatNumberForCSV(totals.vat_amount),
            this.formatNumberForCSV(totals.total_ttc),
            '',
            this.formatNumberForCSV(totals.amount_paid),
            this.formatNumberForCSV(totals.amount_due),
            '', ''
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const fileName = `all_invoices_${this.selectedYear}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`CSV export successful: ${fileName}`, 'success');
    }

    exportClientsToCSV() {
        if (!this.allClientsData || this.allClientsData.length === 0) {
            showNotification('No clients to export', 'warning');
            return;
        }

        const sortedData = this.sortClients(this.allClientsData, this.currentSortOption);

        const headers = [
            'Client ID',
            'Full Name',
            'Invoice Count',
            'Total incl. VAT',
            'Total Paid',
            'Total Due',
            'Payment Rate (%)'
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

        const fileName = `clients_invoices_${this.selectedYear}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`CSV export successful: ${fileName}`, 'success');
    }
}

// Initialiser quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    new ComptaMain();
});