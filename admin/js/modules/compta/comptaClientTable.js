// comptaClientTable.js - Gestion des factures par client (version tableau Excel)

import { formatCurrency, formatDate } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';
import { shareOrDownloadBlob } from '../../utils/fileDownload.js';
// downloadOrShareFile is loaded globally from inline <script> in HTML page

class ComptaClientTable {
    constructor() {
        this.clientId = null;
        this.invoices = [];
        this.sortOrder = 'desc';
        this.editingCells = new Map();
        this.init();
    }

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.clientId = urlParams.get('client_id');
        this.year = urlParams.get('year') || new Date().getFullYear();
        this.notesTimeout = null;

        if (!this.clientId) {
            showNotification('Aucun client spécifié', 'error');
            window.location.href = '/admin/compta';
            return;
        }

        // Mettre à jour le bouton retour avec l'année
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.href = `/admin/compta?tab=clients&year=${this.year}`;
        }

        this.setupEventListeners();
        this.loadClientInvoices();
        this.loadClientNotes();
    }

    setupEventListeners() {
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.toggleSort());
        }
        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }
        const shareBtn = document.getElementById('shareLinkBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.generateShareLink());
        }
        this.setupPaymentsModal();
    }

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
            const invoice = this.invoices.find(inv => inv.id == invoiceId);
            this._renderPaymentsList(data.payments, invoice);
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
            const invoice = this.invoices.find(inv => inv.id == invoiceId);
            this._renderPaymentsList(data.payments, invoice);
            this.displayInvoices();
            showNotification('Paiement supprimé', 'success');
            await this.openPaymentsModal(invoiceId);
        } catch (err) {
            showNotification('Erreur: ' + err.message, 'error');
        }
    }

    async loadClientInvoices() {
        try {
            const response = await fetch(`/api/invoices/client/${this.clientId}?year=${this.year}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des factures');
            }

            const data = await response.json();
            this.invoices = data.invoices || [];

            if (this.invoices.length > 0) {
                document.getElementById('clientName').textContent = 
                    this.invoices[0].client_full_name || 'Client inconnu';
            }
            document.getElementById('clientId').textContent = this.clientId;

            this.displayInvoices();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des factures', 'error');
            document.getElementById('invoicesTableBody').innerHTML = 
                '<tr><td colspan="13" class="error-message">Impossible de charger les factures</td></tr>';
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
            tbody.innerHTML = '<tr><td colspan="13" class="no-data">Aucune facture trouvée</td></tr>';
            return;
        }

        const statusOrder = { unpaid: 0, partial: 1, paid: 2 };
        const sortedInvoices = [...this.invoices].sort((a, b) => {
            const sa = statusOrder[a.payment_status] ?? 1;
            const sb = statusOrder[b.payment_status] ?? 1;
            if (sa !== sb) return sa - sb;
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
            const statusText = this.getStatusText(invoice.payment_status);
            const cardClass = invoice.payment_status === 'paid' ? 'inv-paid'
                : invoice.payment_status === 'partial' ? 'inv-partial' : 'inv-unpaid';
            const tagClass = invoice.payment_status === 'paid' ? 'inv-tag-paid'
                : invoice.payment_status === 'partial' ? 'inv-tag-partial' : 'inv-tag-unpaid';
            const commissionReceived = invoice.commission_status === 'received';
            const commissionTagClass = commissionReceived ? 'inv-tag-comm-ok' : 'inv-tag-comm-no';
            const commissionText = commissionReceived ? 'Comm. received' : 'Comm. pending';

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
                            <span class="inv-tag ${commissionTagClass}">${commissionText}</span>
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
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inv-card-actions">
                    <button class="inv-edit-btn" ontouchstart="void(0)" onclick="event.preventDefault();window._editInvoiceBadge(${invoice.id})">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="inv-payments-btn" ontouchstart="void(0)" onclick="event.preventDefault();window._openPaymentsBadge(${invoice.id})">
                        <i class="fas fa-coins"></i> Paiements
                    </button>
                    <button class="inv-pdf-btn" ontouchstart="void(0)" onclick="event.preventDefault();window._clientDownloadPdf('/api/admin/download-invoice/${invoice.order_id}/${this.clientId}','Invoice_${invoice.order_id}.pdf')">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                </div>
            </div>
            `;
        }).join('');

        window._editInvoiceBadge = (invoiceId) => this.openMobileEditModal(invoiceId);
        window._openPaymentsBadge = (invoiceId) => this.openPaymentsModal(invoiceId);
        window._clientDownloadPdf = (url, filename) => {
            window.downloadOrShareFile(url, filename).catch(err => showNotification('Erreur : ' + err.message, 'error'));
        };
    }

    openMobileEditModal(invoiceId) {
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;

        // Supprimer un éventuel modal existant
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
                <div class="mobile-edit-field">
                    <label>Commission</label>
                    <select id="meCommissionStatus">
                        <option value="not_received" ${invoice.commission_status !== 'received' ? 'selected' : ''}>Non reçue</option>
                        <option value="received" ${invoice.commission_status === 'received' ? 'selected' : ''}>Reçue</option>
                    </select>
                </div>
                <div class="mobile-edit-actions">
                    <button class="mobile-edit-cancel" id="meCancel">Annuler</button>
                    <button class="mobile-edit-save" id="meSave"><i class="fas fa-check"></i> Enregistrer</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Fermer en cliquant sur l'overlay
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
            const commissionStatus = document.getElementById('meCommissionStatus').value;

            const amountDue = Math.max(0, invoice.total_ttc - amountPaid);
            const updateData = {
                amount_paid: amountPaid,
                amount_due: amountDue < 0 ? 0 : amountDue,
                payment_status: paymentStatus,
                paid_date: paidDate || null,
                due_date: dueDate || null
            };

            try {
                // Sauvegarder paiement
                const resp1 = await fetch(`/api/invoices/${invoiceId}/payment`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updateData)
                });
                if (!resp1.ok) throw new Error('Erreur mise à jour paiement');

                // Sauvegarder commission si changée
                if (commissionStatus !== invoice.commission_status) {
                    const resp2 = await fetch(`/api/invoices/${invoiceId}/payment`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ commission_status: commissionStatus })
                    });
                    if (!resp2.ok) throw new Error('Erreur mise à jour commission');
                }

                showNotification('Facture mise à jour', 'success');
                overlay.remove();
                await this.loadClientInvoices();
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
				<td class="editable-cell status-cell" data-field="commission_status" data-type="commission_select">
					<span class="status-badge ${invoice.commission_status === 'received' ? 'status-paid' : 'status-unpaid'}">${invoice.commission_status === 'received' ? 'Reçu' : 'Non reçu'}</span>
				</td>
				<td class="text-center actions-cell">
					<button class="action-btn payments-btn" data-invoice-id="${invoice.id}" title="Suivi des paiements">
						<i class="fas fa-coins"></i>
					</button>
					<button class="action-btn download-btn download-invoice-btn"
					data-url="/api/admin/download-invoice/${invoice.order_id}/${this.clientId}"
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
        document.querySelectorAll('.payments-btn').forEach(btn => {
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
        } else if (type === 'commission_select') {
            input = document.createElement('select');
            input.className = 'inline-edit-select';
            input.innerHTML = `
                <option value="not_received" ${invoice.commission_status !== 'received' ? 'selected' : ''}>Non reçu</option>
                <option value="received" ${invoice.commission_status === 'received' ? 'selected' : ''}>Reçu</option>
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

        if (type === 'select' || type === 'commission_select') {
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
            } else if (field === 'commission_status') {
                updateData = {
                    commission_status: newValue
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
            await this.loadClientInvoices();
            
        } catch (error) {
            console.error('Erreur complète:', error);
            showNotification('Erreur: ' + error.message, 'error');
            cell.innerHTML = originalContent;
        }

        this.editingCells.delete(cell);
    }

    // ===== NOTES CLIENT =====

    async loadClientNotes() {
        try {
            const response = await fetch(`/api/clients/${encodeURIComponent(this.clientId)}/notes`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Erreur chargement notes');
            const data = await response.json();
            const textarea = document.getElementById('clientNotes');
            if (textarea) {
                textarea.value = data.notes || '';
                textarea.addEventListener('input', () => this.handleNotesInput());
            }
        } catch (error) {
            console.error('Erreur chargement notes client:', error);
        }
    }

    handleNotesInput() {
        const statusEl = document.getElementById('notesSaveStatus');
        if (statusEl) {
            statusEl.textContent = 'Modification...';
            statusEl.className = 'notes-save-status saving';
        }
        clearTimeout(this.notesTimeout);
        this.notesTimeout = setTimeout(() => this.saveClientNotes(), 800);
    }

    async saveClientNotes() {
        const textarea = document.getElementById('clientNotes');
        const statusEl = document.getElementById('notesSaveStatus');
        if (!textarea) return;

        try {
            const response = await fetch(`/api/clients/${encodeURIComponent(this.clientId)}/notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes: textarea.value })
            });
            if (!response.ok) throw new Error('Erreur sauvegarde');
            if (statusEl) {
                statusEl.textContent = 'Sauvegardé';
                statusEl.className = 'notes-save-status saved';
                setTimeout(() => {
                    statusEl.textContent = '';
                    statusEl.className = 'notes-save-status';
                }, 2000);
            }
        } catch (error) {
            console.error('Erreur sauvegarde notes:', error);
            if (statusEl) {
                statusEl.textContent = 'Erreur de sauvegarde';
                statusEl.className = 'notes-save-status error';
            }
        }
    }

	async generateShareLink() {
		if (!this.clientId) {
			showNotification('No client specified', 'error');
			return;
		}
		try {
			const res = await fetch('/api/share/client-invoices', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ client_id: this.clientId })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Error');

			const url = data.url;

			// Sur mobile (iPhone, Android) : Web Share API
			const isMobile = navigator.share && window.matchMedia('(pointer: coarse)').matches;
			if (isMobile) {
				try {
					await navigator.share({ title: 'Factures', url });
					return;
				} catch (shareErr) {
					if (shareErr.name === 'AbortError') return;
				}
			}

			// Sur desktop : Clipboard API
			try {
				await navigator.clipboard.writeText(url);
				showNotification('Lien copié dans le presse-papier !', 'success');
				return;
			} catch (clipErr) {
				// ignore, fallback ci-dessous
			}

			// Priorité 3 : Fallback manuel (textarea + execCommand)
			const textarea = document.createElement('textarea');
			textarea.value = url;
			textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			try {
				document.execCommand('copy');
				showNotification('Lien copié !', 'success');
			} catch (e) {
				prompt('Copiez ce lien :', url);
			} finally {
				document.body.removeChild(textarea);
			}
		} catch (err) {
			showNotification('Erreur : ' + err.message, 'error');
		}
	}

	async exportToCSV() {
		if (!this.invoices || this.invoices.length === 0) {
			showNotification('No invoices to export', 'warning');
			return;
		}
		try {
			const year = this.year || 'all';
			const res = await fetch(`/api/invoices/client/${this.clientId}/export-xlsx?year=${year}`, { credentials: 'include' });
			if (!res.ok) throw new Error('Erreur génération Excel');
			const blob = await res.blob();
			const clientName = this.invoices[0]?.client_full_name || this.clientId;
			const fileName = `invoices_${clientName}_${year}.xlsx`;
			await shareOrDownloadBlob(blob, fileName);
			showNotification(`Export Excel réussi: ${fileName}`, 'success');
		} catch (err) {
			showNotification('Erreur: ' + err.message, 'error');
		}
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
    new ComptaClientTable();
});