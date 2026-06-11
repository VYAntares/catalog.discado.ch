// admin/js/modules/compta/comptaMonth.js - Gestion des factures par mois

import { formatCurrency, formatDate } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';
import { shareOrDownloadBlob } from '../../utils/fileDownload.js';
// downloadOrShareFile is loaded globally from inline <script> in HTML page

class ComptaMonth {
    constructor() {
        this.year = null;
        this.month = null;
        this.type = null;
        this.invoices = [];
        this.sortOrder = 'desc';
        this.editingCells = new Map();
        this.init();
    }

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.year = parseInt(urlParams.get('year')) || new Date().getFullYear();
        this.month = parseInt(urlParams.get('month'));
        this.type = urlParams.get('type') || 'total_amount';

        if (!this.month || this.month < 1 || this.month > 12) {
            showNotification('Mois invalide', 'error');
            window.location.href = '/admin/compta';
            return;
        }

        this.setupUI();
        this.setupEventListeners();
        this.setupPaymentsModal();
        this.loadMonthInvoices();
    }

    setupUI() {
        const monthNames = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        
        document.getElementById('monthName').textContent = monthNames[this.month - 1] + ' ' + this.year;
        document.getElementById('yearDisplay').textContent = this.year;
        
        // Configurer le bouton retour
        const backBtn = document.getElementById('backBtn');
        backBtn.href = `/admin/compta-details?year=${this.year}&type=${this.type}`;
    }

    setupEventListeners() {
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.toggleSort());
        }
        
        // Bouton export CSV
        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }
    }

    async loadMonthInvoices() {
        try {
            const response = await fetch(`/api/invoices/month-details?year=${this.year}&month=${this.month}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des factures');
            }

            const data = await response.json();
            this.invoices = data.invoices || [];

            this.displayInvoices();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des factures', 'error');
            document.getElementById('invoicesTableBody').innerHTML = 
                '<tr><td colspan="11" class="error-message">Impossible de charger les factures</td></tr>';
        }
    }

    toggleSort() {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
        
        const sortBtn = document.getElementById('sortBtn');
        const sortText = document.getElementById('sortText');
        const icon = sortBtn.querySelector('i');

        if (this.sortOrder === 'desc') {
            icon.className = 'fas fa-sort-amount-down';
            sortText.textContent = 'Plus récente à plus ancienne';
        } else {
            icon.className = 'fas fa-sort-amount-up';
            sortText.textContent = 'Plus ancienne à plus récente';
        }

        this.displayInvoices();
    }

    displayInvoices() {
        const tbody = document.getElementById('invoicesTableBody');
        
        if (!this.invoices || this.invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="no-data">Aucune facture trouvée</td></tr>';
            return;
        }

        const sortedInvoices = [...this.invoices].sort((a, b) => {
            const dateA = new Date(a.invoice_date);
            const dateB = new Date(b.invoice_date);
            return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        tbody.innerHTML = sortedInvoices.map(invoice => this.createTableRow(invoice)).join('');

        // Badges mobiles
        this.renderInvoicesBadges(sortedInvoices);

        // Attacher les listeners APRÈS que badges ET tableau sont dans le DOM
        this.attachEventListeners();
    }

    renderInvoicesBadges(invoices) {
        const container = document.getElementById('invoicesBadgesContainer');
        if (!container) return;

        if (!invoices || invoices.length === 0) {
            container.innerHTML = '<p class="no-data">Aucune facture trouvée</p>';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        container.innerHTML = invoices.map(invoice => {
            const pctPaid = invoice.total_ttc > 0 ? ((invoice.amount_paid / invoice.total_ttc) * 100).toFixed(1) : '0.0';
            const statusText = this.getStatusText(invoice.payment_status);
            const cardClass = invoice.payment_status === 'paid' ? 'inv-paid'
                : invoice.payment_status === 'partial' ? 'inv-partial' : 'inv-unpaid';
            const tagClass = invoice.payment_status === 'paid' ? 'inv-tag-paid'
                : invoice.payment_status === 'partial' ? 'inv-tag-partial' : 'inv-tag-unpaid';

            let dueDateHtml = '';
            if (invoice.due_date) {
                const dueDate = new Date(invoice.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const isOverdue = dueDate < today && invoice.payment_status !== 'paid';
                dueDateHtml = `
                <div class="inv-date-block inv-date-due ${isOverdue ? 'inv-overdue' : ''}">
                    <span class="inv-date-icon"><i class="fas fa-calendar-times"></i></span>
                    <div>
                        <span class="inv-date-label">Due date</span>
                        <span class="inv-date-value">${this.formatDateShort(invoice.due_date)}</span>
                    </div>
                </div>`;
            }

            let paidDateHtml = '';
            if (invoice.paid_date && invoice.payment_status === 'paid') {
                paidDateHtml = `
                <div class="inv-date-block inv-date-paid-on">
                    <span class="inv-date-icon"><i class="fas fa-check-circle"></i></span>
                    <div>
                        <span class="inv-date-label">Paid on</span>
                        <span class="inv-date-value">${this.formatDateShort(invoice.paid_date)}</span>
                    </div>
                </div>`;
            }

            return `
            <div class="inv-card ${cardClass}" data-invoice-id="${invoice.id}">
                <div class="inv-card-body">
                    <div class="inv-card-identity">
                        <span class="inv-card-number"><i class="fas fa-file-invoice"></i> ${invoice.order_id}</span>
                        <div class="inv-card-client">${invoice.client_full_name || 'N/A'}</div>
                        <div class="inv-card-dates">
                            <div class="inv-date-block inv-date-invoice">
                                <span class="inv-date-icon"><i class="fas fa-calendar-alt"></i></span>
                                <div>
                                    <span class="inv-date-label">Invoice date</span>
                                    <span class="inv-date-value">${this.formatDateShort(invoice.invoice_date)}</span>
                                </div>
                            </div>
                            ${dueDateHtml}
                            ${paidDateHtml}
                        </div>
                    </div>
                    <div class="inv-card-summary">
                        <div class="inv-card-tags">
                            <span class="inv-tag ${tagClass}">${statusText}</span>
                        </div>
                        <div class="inv-card-amounts">
                            <div class="inv-amounts-left">
                                <div class="inv-amount-item">
                                    <span class="inv-amount-label">Excl. VAT</span>
                                    <span class="inv-amount-value">${formatCurrency(invoice.subtotal_ht)}</span>
                                </div>
                                <div class="inv-amount-item">
                                    <span class="inv-amount-label">VAT</span>
                                    <span class="inv-amount-value">${formatCurrency(invoice.vat_amount)}</span>
                                </div>
                            </div>
                            <div class="inv-amounts-right">
                                <div class="inv-amount-item inv-amount-total">
                                    <span class="inv-amount-label">Total</span>
                                    <span class="inv-amount-value">${formatCurrency(invoice.total_ttc)}</span>
                                </div>
                                <div class="inv-amount-item inv-amount-paid">
                                    <span class="inv-amount-label">Paid</span>
                                    <span class="inv-amount-value">${formatCurrency(invoice.amount_paid)}</span>
                                </div>
                                <div class="inv-amount-item ${invoice.amount_due > 0 ? 'inv-amount-due' : 'inv-amount-clear'}">
                                    <span class="inv-amount-label">Balance</span>
                                    <span class="inv-amount-value">${formatCurrency(invoice.amount_due)}</span>
                                </div>
                                <div class="inv-amount-item">
                                    <span class="inv-amount-label">% payé</span>
                                    <span class="inv-amount-value" style="color:${parseFloat(pctPaid)<50?'#e74c3c':parseFloat(pctPaid)<80?'#f39c12':'#27ae60'}">${pctPaid}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inv-card-actions">
                    <button class="inv-accounting-btn ${invoice.accounting_mode ? 'is-active' : ''}" ontouchstart="void(0)" onclick="event.preventDefault();window._monthToggleAccounting(${invoice.id})" title="Aligner HT/VAT/TTC sur le montant encaissé">
                        <i class="fas fa-calculator"></i> Comptabiliser
                    </button>
                    <button class="inv-edit-btn" ontouchstart="void(0)" onclick="event.preventDefault();window._monthEditBadge(${invoice.id})">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="inv-payments-btn" ontouchstart="void(0)" onclick="event.preventDefault();window._monthOpenPayments(${invoice.id})">
                        <i class="fas fa-coins"></i> Paiements
                    </button>
                    <button class="inv-pdf-btn download-invoice-btn" ontouchstart="void(0)" onclick="event.preventDefault();window._monthDownloadPdf('/api/admin/download-invoice/${invoice.order_id}/${invoice.user_id}','Invoice_${invoice.order_id}.pdf')">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                </div>
            </div>
            `;
        }).join('');

        window._monthEditBadge = (invoiceId) => this.openMobileEditModal(invoiceId);
        window._monthOpenPayments = (invoiceId) => this.openPaymentsModal(invoiceId);
        window._monthDownloadPdf = (url, filename) => {
            window.downloadOrShareFile(url, filename).catch(err => showNotification('Erreur : ' + err.message, 'error'));
        };
        window._monthToggleAccounting = (invoiceId) => this.toggleAccountingMode(invoiceId);
    }

    async toggleAccountingMode(invoiceId) {
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;
        const willEnable = !invoice.accounting_mode;
        if (willEnable && (parseFloat(invoice.amount_paid) || 0) <= 0) {
            showNotification('Aucun paiement encaissé sur cette facture.', 'error');
            return;
        }
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/accounting-mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled: willEnable })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur');
            showNotification(willEnable ? 'Facture comptabilisée' : 'Facture restaurée', 'success');
            await this.loadMonthInvoices();
        } catch (err) {
            showNotification('Erreur : ' + err.message, 'error');
        }
    }

    openMobileEditModal(invoiceId) {
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
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
            let paidDate = document.getElementById('mePaidDate').value;

            // Auto-calculate payment status based on amount
            let paymentStatus;
            if (amountPaid <= 0) {
                paymentStatus = 'unpaid';
                paidDate = '';
            } else if (amountPaid >= invoice.total_ttc) {
                paymentStatus = 'paid';
                if (!paidDate) paidDate = new Date().toISOString().split('T')[0];
            } else {
                paymentStatus = 'partial';
            }

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
                await this.loadMonthInvoices();
            } catch (err) {
                showNotification('Erreur: ' + err.message, 'error');
            }
        });
    }

    createTableRow(invoice) {
        const statusClass = this.getStatusClass(invoice.payment_status);
        const statusText = this.getStatusText(invoice.payment_status);
        
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
				<td class="text-right ${invoice.amount_due > 0 ? 'text-danger' : 'text-success'}">
					${formatCurrency(invoice.amount_due)}
				</td>
				<td class="editable-cell" data-field="paid_date" data-type="date">
					${paidDateValue ? this.formatDateShort(invoice.paid_date) : 'Non payée'}
				</td>
				<td class="editable-cell status-cell" data-field="payment_status" data-type="select">
					<span class="status-badge ${statusClass}">${statusText}</span>
				</td>
				<!-- NOUVELLE COLONNE -->
				<td class="text-center">
					<button class="action-btn month-payments-btn" data-invoice-id="${invoice.id}" title="Suivi des paiements">
						<i class="fas fa-coins"></i>
					</button>
					<button class="action-btn download-btn download-invoice-btn"
					data-url="/api/admin/download-invoice/${invoice.order_id}/${invoice.user_id}"
					data-filename="Invoice_${invoice.order_id}.pdf"
					title="Télécharger la facture">
						<i class="fas fa-file-pdf"></i>
					</button>
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

    attachEventListeners() {
        document.querySelectorAll('.editable-cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.startEdit(e.currentTarget));
        });
        document.querySelectorAll('.month-payments-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openPaymentsModal(btn.dataset.invoiceId));
        });
        document.querySelectorAll('.download-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await window.downloadOrShareFile(btn.dataset.url, btn.dataset.filename);
                } catch (err) {
                    showNotification('Erreur : ' + err.message, 'error');
                }
            });
        });
    }

    // ===== SUIVI DES PAIEMENTS =====

    setupPaymentsModal() {
        const modal = document.getElementById('paymentsModal');
        const closeBtn = document.getElementById('paymentsModalClose');
        const addBtn = document.getElementById('addPaymentBtn');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closePaymentsModal());
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.closePaymentsModal(); });
        if (addBtn) addBtn.addEventListener('click', () => this.addPayment());

        const dateInput = document.getElementById('newPaymentDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    }

    async openPaymentsModal(invoiceId) {
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;
        this._paymentsModalInvoiceId = invoiceId;

        document.getElementById('paymentsModalTitle').textContent = `Paiements — ${invoice.order_id}`;
        document.getElementById('paymentsModalSubtitle').textContent = `Total facture: ${formatCurrency(invoice.total_ttc)}`;

        const modal = document.getElementById('paymentsModal');
        modal.style.display = 'flex';
        await this.loadAndRenderPayments(invoiceId, invoice);
    }

    closePaymentsModal() {
        document.getElementById('paymentsModal').style.display = 'none';
        this._paymentsModalInvoiceId = null;
    }

    async loadAndRenderPayments(invoiceId, invoice) {
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/payments`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur');
            this._renderPaymentsList(data.payments, invoice);
        } catch (err) {
            showNotification('Erreur: ' + err.message, 'error');
        }
    }

    _renderPaymentsList(payments, invoice) {
        const tbody = document.getElementById('paymentsHistoryBody');
        if (!payments || payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="no-data">Aucun paiement enregistré</td></tr>';
        } else {
            tbody.innerHTML = payments.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${this.formatDateShort(p.payment_date)}</td>
                    <td class="text-right">${formatCurrency(p.amount)}</td>
                    <td class="text-center">
                        <button class="payments-delete-btn" data-payment-id="${p.id}" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            tbody.querySelectorAll('.payments-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => this.deletePayment(btn.dataset.paymentId));
            });
        }
        const totalPaid = (payments || []).reduce((s, p) => s + p.amount, 0);
        const balanceDue = Math.max(0, invoice.total_ttc - totalPaid);
        document.getElementById('paymentsTotalPaid').textContent = formatCurrency(totalPaid);
        document.getElementById('paymentsBalanceDue').textContent = formatCurrency(balanceDue);
    }

    async addPayment() {
        const invoiceId = this._paymentsModalInvoiceId;
        if (!invoiceId) return;
        const amount = parseFloat(document.getElementById('newPaymentAmount').value);
        const payment_date = document.getElementById('newPaymentDate').value;
        if (!amount || amount <= 0) { showNotification('Montant invalide', 'error'); return; }
        if (!payment_date) { showNotification('Date requise', 'error'); return; }
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, payment_date })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur');
            document.getElementById('newPaymentAmount').value = '';
            const idx = this.invoices.findIndex(inv => inv.id == invoiceId);
            if (idx !== -1) this.invoices[idx] = { ...this.invoices[idx], ...data.invoice };
            this.displayInvoices();
            showNotification('Paiement enregistré', 'success');
            await this.openPaymentsModal(invoiceId);
        } catch (err) {
            showNotification('Erreur: ' + err.message, 'error');
        }
    }

    async deletePayment(paymentId) {
        const invoiceId = this._paymentsModalInvoiceId;
        if (!invoiceId) return;
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur');
            const idx = this.invoices.findIndex(inv => inv.id == invoiceId);
            if (idx !== -1) this.invoices[idx] = { ...this.invoices[idx], ...data.invoice };
            this.displayInvoices();
            showNotification('Paiement supprimé', 'success');
            await this.openPaymentsModal(invoiceId);
        } catch (err) {
            showNotification('Erreur: ' + err.message, 'error');
        }
    }

    startEdit(cell) {
        const row = cell.closest('tr');
        const invoiceId = row.dataset.invoiceId;
        const field = cell.dataset.field;
        const type = cell.dataset.type;
        
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
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
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
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
            await this.loadMonthInvoices();
            
        } catch (error) {
            console.error('Erreur complète:', error);
            showNotification('Erreur: ' + error.message, 'error');
            cell.innerHTML = originalContent;
        }

        this.editingCells.delete(cell);
    }

    async exportToCSV() {
        if (!this.invoices || this.invoices.length === 0) {
            showNotification('No invoices to export', 'warning');
            return;
        }

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

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

        const sortedInvoices = [...this.invoices].sort((a, b) => {
            const dateA = new Date(a.invoice_date);
            const dateB = new Date(b.invoice_date);
            return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
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
                this.getStatusText(invoice.payment_status)
            ].join(',');
        });

        // Ajouter une ligne vide
        rows.push('');

        // Ajouter la ligne de totaux
        const totalsRow = [
            `"TOTAL (${totals.count} invoices)"`,
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
        const monthName = monthNames[this.month - 1];
        const fileName = `invoices_${monthName}_${this.year}.csv`;
        await shareOrDownloadBlob(blob, fileName);
        showNotification(`CSV export successful: ${fileName}`, 'success');
    }

    formatNumberForCSV(number) {
        if (number === null || number === undefined) return '0.00';
        return parseFloat(number).toFixed(2);
    }

    getStatusClass(status) {
        const statusMap = {
            'paid': 'status-paid',
            'partial': 'status-partial',
            'unpaid': 'status-unpaid'
        };
        return statusMap[status] || 'status-unpaid';
    }

    getStatusText(status) {
        const textMap = {
            'paid': 'Paid',
            'partial': 'Partial',
            'unpaid': 'Unpaid'
        };
        return textMap[status] || 'Unpaid';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ComptaMonth();
});