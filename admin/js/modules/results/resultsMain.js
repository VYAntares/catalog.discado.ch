// admin/js/modules/results/resultsMain.js - Module principal de la page Résultats

import { formatCurrency } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';

const CATEGORY_CONFIG = {
    loyer: { label: 'Loyer', icon: 'fas fa-home', colorClass: 'loyer' },
    salaire: { label: 'Salaire', icon: 'fas fa-user-tie', colorClass: 'salaire' },
    frais_divers: { label: 'Frais divers', icon: 'fas fa-receipt', colorClass: 'frais_divers' },
    fournisseurs: { label: 'Fournisseurs', icon: 'fas fa-truck', colorClass: 'fournisseurs' },
    poste: { label: 'Poste', icon: 'fas fa-box', colorClass: 'poste' },
    transporteur: { label: 'Transporteur', icon: 'fas fa-shipping-fast', colorClass: 'transporteur' },
    essence: { label: 'Essence', icon: 'fas fa-gas-pump', colorClass: 'essence' }
};

const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

class ResultsMain {
    constructor() {
        this.expenses = [];
        this.summary = [];
        this.monthly = [];
        this.grandTotal = { total: 0, count: 0 };
        this.selectedYear = new Date().getFullYear();
        this.filterCategory = 'all';
        this.searchQuery = '';
        this.sortField = 'date';
        this.sortOrder = 'desc';
        this.viewMode = 'annual'; // 'annual' ou 'monthly'
        this.filterMonth = new Date().getMonth() + 1; // mois courant (1-12)
        this.editingExpenseId = null;
        this.deleteExpenseId = null;
        this.monthlyOpen = false;
        this.expensesListOpen = true;
        this.init();
    }

    init() {
        this.populateYearSelect();
        this.setDefaultMonth();
        this.setupEventListeners();
        this.loadData();
    }

    // ===== Année =====

    setDefaultMonth() {
        const monthSelect = document.getElementById('filterMonth');
        if (monthSelect) monthSelect.value = this.filterMonth;
    }

    populateYearSelect() {
        const select = document.getElementById('yearSelect');
        if (!select) return;
        const currentYear = new Date().getFullYear();
        select.innerHTML = '';
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            if (y === this.selectedYear) option.selected = true;
            select.appendChild(option);
        }
    }

    // ===== Event Listeners =====

    setupEventListeners() {
        // Sélecteur année
        document.getElementById('yearSelect')?.addEventListener('change', (e) => {
            this.selectedYear = parseInt(e.target.value);
            this.loadData();
        });

        // Filtre catégorie
        document.getElementById('filterCategory')?.addEventListener('change', (e) => {
            this.filterCategory = e.target.value;
            this.renderExpensesTable();
        });

        // Barre de recherche
        document.getElementById('searchExpenses')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.renderExpensesTable();
        });

        // Vue annuelle / mensuelle
        document.getElementById('viewAnnual')?.addEventListener('click', () => {
            this.setViewMode('annual');
        });
        document.getElementById('viewMonthly')?.addEventListener('click', () => {
            this.setViewMode('monthly');
        });

        // Filtre mois
        document.getElementById('filterMonth')?.addEventListener('change', (e) => {
            this.filterMonth = parseInt(e.target.value);
            this.renderExpensesTable();
        });

        // Bouton ajouter
        document.getElementById('btnAddExpense')?.addEventListener('click', () => {
            this.openModal();
        });

        // Modale : fermer
        document.getElementById('expenseModalClose')?.addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('expenseModalOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });
        document.getElementById('btnModalCancel')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Modale : sauvegarder
        document.getElementById('btnModalSave')?.addEventListener('click', () => {
            this.saveExpense();
        });

        // Confirm delete : annuler
        document.getElementById('btnConfirmCancel')?.addEventListener('click', () => {
            this.closeConfirmModal();
        });
        document.getElementById('confirmModalOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeConfirmModal();
        });

        // Confirm delete : confirmer
        document.getElementById('btnConfirmDelete')?.addEventListener('click', () => {
            this.confirmDelete();
        });

        // Toggle mensuel
        document.getElementById('monthlyToggle')?.addEventListener('click', () => {
            this.toggleMonthly();
        });

        // Toggle liste dépenses
        document.getElementById('expensesToggle')?.addEventListener('click', () => {
            this.toggleExpensesList();
        });

        // Tri colonnes
        document.querySelectorAll('.results-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (this.sortField === field) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortField = field;
                    this.sortOrder = field === 'amount' ? 'desc' : 'desc';
                }
                this.updateSortIcons();
                this.renderExpensesTable();
            });
        });
    }

    // ===== Chargement des données =====

    async loadData() {
        try {
            await Promise.all([this.loadExpenses(), this.loadSummary()]);
            this.renderSummaryCards();
            this.renderExpensesTable();
            this.renderMonthlyBreakdown();
        } catch (error) {
            console.error('Erreur chargement données résultats:', error);
            showNotification('Erreur de chargement des données', 'error');
        }
    }

    async loadExpenses() {
        const res = await fetch(`/api/expenses?year=${this.selectedYear}`);
        const data = await res.json();
        if (data.success) {
            this.expenses = data.expenses;
        } else {
            throw new Error(data.error);
        }
    }

    async loadSummary() {
        const res = await fetch(`/api/expenses/summary?year=${this.selectedYear}`);
        const data = await res.json();
        if (data.success) {
            this.summary = data.summary;
            this.monthly = data.monthly;
            this.grandTotal = data.grandTotal;
        } else {
            throw new Error(data.error);
        }
    }

    // ===== Rendu des cartes résumé =====

    renderSummaryCards() {
        const grid = document.getElementById('summaryGrid');
        if (!grid) return;

        // Construire un map par catégorie
        const summaryMap = {};
        for (const cat of Object.keys(CATEGORY_CONFIG)) {
            summaryMap[cat] = { count: 0, total: 0 };
        }
        for (const row of this.summary) {
            if (summaryMap[row.category]) {
                summaryMap[row.category] = { count: row.count, total: row.total };
            }
        }

        let html = '';
        for (const [cat, config] of Object.entries(CATEGORY_CONFIG)) {
            const data = summaryMap[cat];
            html += `
                <div class="summary-card">
                    <div class="summary-card-icon ${config.colorClass}">
                        <i class="${config.icon}"></i>
                    </div>
                    <div class="summary-card-content">
                        <div class="summary-card-label">${config.label}</div>
                        <div class="summary-card-amount">${formatCurrency(data.total)}</div>
                        <div class="summary-card-count">${data.count} dépense${data.count > 1 ? 's' : ''}</div>
                    </div>
                </div>
            `;
        }

        // Carte total
        html += `
            <div class="summary-card">
                <div class="summary-card-icon total">
                    <i class="fas fa-calculator"></i>
                </div>
                <div class="summary-card-content">
                    <div class="summary-card-label">TOTAL</div>
                    <div class="summary-card-amount">${formatCurrency(this.grandTotal.total)}</div>
                    <div class="summary-card-count">${this.grandTotal.count} dépense${this.grandTotal.count > 1 ? 's' : ''}</div>
                </div>
            </div>
        `;

        grid.innerHTML = html;
    }

    // ===== Rendu du tableau des dépenses =====

    setViewMode(mode) {
        this.viewMode = mode;
        const btnAnnual = document.getElementById('viewAnnual');
        const btnMonthly = document.getElementById('viewMonthly');
        const monthSelect = document.getElementById('filterMonth');
        if (btnAnnual) btnAnnual.classList.toggle('active', mode === 'annual');
        if (btnMonthly) btnMonthly.classList.toggle('active', mode === 'monthly');
        if (monthSelect) monthSelect.style.display = mode === 'monthly' ? '' : 'none';
        this.renderExpensesTable();
    }

    getFilteredExpenses() {
        let filtered = [...this.expenses];
        // Filtre par mois si vue mensuelle
        if (this.viewMode === 'monthly') {
            filtered = filtered.filter(e => {
                const d = new Date(e.date);
                return (d.getMonth() + 1) === this.filterMonth;
            });
        }
        if (this.filterCategory !== 'all') {
            filtered = filtered.filter(e => e.category === this.filterCategory);
        }
        // Recherche texte
        if (this.searchQuery) {
            const q = this.searchQuery;
            filtered = filtered.filter(e => {
                const dateStr = this.formatDateShort(e.date).toLowerCase();
                const amount = String(e.amount).toLowerCase();
                const amountFormatted = formatCurrency(e.amount).toLowerCase();
                const desc = (e.description || '').toLowerCase();
                const catLabel = (CATEGORY_CONFIG[e.category]?.label || e.category).toLowerCase();
                return dateStr.includes(q) || amount.includes(q) || amountFormatted.includes(q) || desc.includes(q) || catLabel.includes(q);
            });
        }
        // Tri
        filtered.sort((a, b) => {
            let valA, valB;
            if (this.sortField === 'date') {
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
            } else if (this.sortField === 'amount') {
                valA = a.amount;
                valB = b.amount;
            } else if (this.sortField === 'category') {
                valA = a.category;
                valB = b.category;
            } else {
                valA = a.date;
                valB = b.date;
            }
            if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    }

    renderExpensesTable() {
        const tbody = document.getElementById('expensesTableBody');
        const countEl = document.getElementById('expensesCount');
        if (!tbody) return;

        const filtered = this.getFilteredExpenses();

        if (countEl) {
            countEl.textContent = `${filtered.length} dépense${filtered.length > 1 ? 's' : ''}`;
        }

        if (filtered.length === 0) {
            const periodLabel = this.viewMode === 'monthly'
                ? `${MONTH_NAMES[this.filterMonth - 1]} ${this.selectedYear}`
                : this.selectedYear;
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-table-message">
                            <i class="fas fa-inbox"></i>
                            Aucune dépense enregistrée pour ${periodLabel}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(expense => {
            const config = CATEGORY_CONFIG[expense.category] || { label: expense.category, colorClass: '' };
            const dateFormatted = this.formatDateShort(expense.date);
            const isLinked = !!(expense.supplier_payment_id || expense.transport_payment_id);
            const linkedTitle = expense.transport_payment_id ? 'Lié à un frais de transport' : 'Lié au paiement fournisseur';
            const linkedBadge = isLinked ? ` <i class="fas fa-link" title="${linkedTitle}" style="color:#8b5cf6;font-size:11px;margin-left:4px;"></i>` : '';
            return `
                <tr data-id="${expense.id}">
                    <td>${dateFormatted}</td>
                    <td><span class="category-badge ${config.colorClass}"><i class="${config.icon}"></i> ${config.label}</span>${linkedBadge}</td>
                    <td class="amount-cell">${formatCurrency(expense.amount)}</td>
                    <td class="description-cell" title="${this.escapeHtml(expense.description || '')}">${this.escapeHtml(expense.description || '—')}</td>
                    <td class="actions-cell">
                        ${isLinked ? `<span style="font-size:11px;color:#94a3b8;" title="Géré depuis la page Fournisseurs"><i class="fas fa-lock"></i></span>` : `
                        <button class="btn-action edit" title="Modifier" onclick="resultsApp.editExpense(${expense.id})">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-action delete" title="Supprimer" onclick="resultsApp.deleteExpense(${expense.id})">
                            <i class="fas fa-trash"></i>
                        </button>`}
                    </td>
                </tr>
            `;
        }).join('');

        this.updateSortIcons();
    }

    updateSortIcons() {
        document.querySelectorAll('.results-table th.sortable').forEach(th => {
            const field = th.dataset.sort;
            const icon = th.querySelector('i');
            if (!icon) return;
            if (field === this.sortField) {
                icon.className = this.sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            } else {
                icon.className = 'fas fa-sort';
            }
        });
    }

    // ===== Rendu du tableau mensuel =====

    renderMonthlyBreakdown() {
        const tbody = document.getElementById('monthlyTableBody');
        const tfoot = document.getElementById('monthlyTableFoot');
        if (!tbody) return;

        // Construire matrice mois × catégorie
        const matrix = {};
        for (let m = 1; m <= 12; m++) {
            const key = String(m).padStart(2, '0');
            matrix[key] = {};
            for (const cat of Object.keys(CATEGORY_CONFIG)) {
                matrix[key][cat] = 0;
            }
        }
        for (const row of this.monthly) {
            if (matrix[row.month]) {
                matrix[row.month][row.category] = row.total;
            }
        }

        // Totaux par catégorie
        const catTotals = {};
        for (const cat of Object.keys(CATEGORY_CONFIG)) {
            catTotals[cat] = 0;
        }
        let grandMonthlyTotal = 0;

        let html = '';
        for (let m = 1; m <= 12; m++) {
            const key = String(m).padStart(2, '0');
            const row = matrix[key];
            let rowTotal = 0;
            let cells = '';
            for (const cat of Object.keys(CATEGORY_CONFIG)) {
                const val = row[cat] || 0;
                rowTotal += val;
                catTotals[cat] += val;
                cells += `<td>${val > 0 ? formatCurrency(val) : '—'}</td>`;
            }
            grandMonthlyTotal += rowTotal;
            html += `
                <tr>
                    <td>${MONTH_NAMES[m - 1]}</td>
                    ${cells}
                    <td style="font-weight:700;">${rowTotal > 0 ? formatCurrency(rowTotal) : '—'}</td>
                </tr>
            `;
        }
        tbody.innerHTML = html;

        // Footer
        if (tfoot) {
            let footCells = '';
            for (const cat of Object.keys(CATEGORY_CONFIG)) {
                footCells += `<td>${formatCurrency(catTotals[cat])}</td>`;
            }
            tfoot.innerHTML = `
                <tr>
                    <td>TOTAL</td>
                    ${footCells}
                    <td>${formatCurrency(grandMonthlyTotal)}</td>
                </tr>
            `;
        }
    }

    // ===== Toggle mensuel =====

    toggleMonthly() {
        this.monthlyOpen = !this.monthlyOpen;
        const btn = document.getElementById('monthlyToggle');
        const content = document.getElementById('monthlyContent');
        if (btn) btn.classList.toggle('open', this.monthlyOpen);
        if (content) content.classList.toggle('open', this.monthlyOpen);
    }

    toggleExpensesList() {
        this.expensesListOpen = !this.expensesListOpen;
        const btn = document.getElementById('expensesToggle');
        const content = document.getElementById('expensesContent');
        if (btn) btn.classList.toggle('open', this.expensesListOpen);
        if (content) content.classList.toggle('open', this.expensesListOpen);
    }

    // ===== Modale CRUD =====

    openModal(expense = null) {
        this.editingExpenseId = expense ? expense.id : null;
        const overlay = document.getElementById('expenseModalOverlay');
        const title = document.getElementById('expenseModalTitle');
        const form = document.getElementById('expenseForm');

        if (title) {
            title.textContent = expense ? 'Modifier la dépense' : 'Ajouter une dépense';
        }

        if (form) {
            form.reset();
            if (expense) {
                document.getElementById('expenseCategory').value = expense.category;
                document.getElementById('expenseAmount').value = expense.amount;
                document.getElementById('expenseDate').value = expense.date;
                document.getElementById('expenseDescription').value = expense.description || '';
            } else {
                // Pré-remplir la date du jour
                document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
            }
        }

        if (overlay) overlay.classList.add('active');
    }

    closeModal() {
        const overlay = document.getElementById('expenseModalOverlay');
        if (overlay) overlay.classList.remove('active');
        this.editingExpenseId = null;
    }

    async saveExpense() {
        const category = document.getElementById('expenseCategory')?.value;
        const amount = parseFloat(document.getElementById('expenseAmount')?.value);
        const date = document.getElementById('expenseDate')?.value;
        const description = document.getElementById('expenseDescription')?.value?.trim();

        if (!category || !amount || !date) {
            showNotification('Veuillez remplir tous les champs obligatoires', 'warning');
            return;
        }

        if (amount <= 0) {
            showNotification('Le montant doit être positif', 'warning');
            return;
        }

        const payload = { category, amount, date, description };

        try {
            let res;
            if (this.editingExpenseId) {
                res = await fetch(`/api/expenses/${this.editingExpenseId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (data.success) {
                showNotification(
                    this.editingExpenseId ? 'Dépense modifiée avec succès' : 'Dépense ajoutée avec succès',
                    'success'
                );
                this.closeModal();
                await this.loadData();
            } else {
                showNotification(data.error || 'Erreur lors de la sauvegarde', 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde dépense:', error);
            showNotification('Erreur réseau', 'error');
        }
    }

    editExpense(id) {
        const expense = this.expenses.find(e => e.id === id);
        if (expense) {
            this.openModal(expense);
        }
    }

    deleteExpense(id) {
        this.deleteExpenseId = id;
        const overlay = document.getElementById('confirmModalOverlay');
        if (overlay) overlay.classList.add('active');
    }

    closeConfirmModal() {
        const overlay = document.getElementById('confirmModalOverlay');
        if (overlay) overlay.classList.remove('active');
        this.deleteExpenseId = null;
    }

    async confirmDelete() {
        if (!this.deleteExpenseId) return;

        try {
            const res = await fetch(`/api/expenses/${this.deleteExpenseId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                showNotification('Dépense supprimée', 'success');
                this.closeConfirmModal();
                await this.loadData();
            } else {
                showNotification(data.error || 'Erreur lors de la suppression', 'error');
            }
        } catch (error) {
            console.error('Erreur suppression dépense:', error);
            showNotification('Erreur réseau', 'error');
        }
    }

    // ===== Utilitaires =====

    formatDateShort(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Instanciation globale
const resultsApp = new ResultsMain();
window.resultsApp = resultsApp;

export default ResultsMain;
