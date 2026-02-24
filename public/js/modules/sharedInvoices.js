// public/js/modules/sharedInvoices.js
// Read-only public view of client invoices via share token

class SharedInvoicesView {
    constructor() {
        this.token = null;
        this.invoices = [];
        this.clientId = null;
        this.sortOrder = 'desc';
        this.init();
    }

    init() {
        // Extract token from URL: /shared/invoices/:token
        const parts = window.location.pathname.split('/');
        this.token = parts[parts.length - 1];

        if (!this.token) {
            document.getElementById('invoicesTableBody').innerHTML =
                '<tr><td colspan="12" class="error-message">Invalid share link</td></tr>';
            return;
        }

        this.setupEventListeners();
        this.loadInvoices();
    }

    setupEventListeners() {
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) sortBtn.addEventListener('click', () => this.toggleSort());

        const exportBtn = document.getElementById('exportXlsxBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel());

        // Modal
        const closeBtn = document.getElementById('paymentsModalClose');
        const modal = document.getElementById('paymentsModal');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal(); });
    }

    async loadInvoices() {
        try {
            const res = await fetch(`/api/public/shared-invoices/${this.token}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to load invoices');
            }
            const data = await res.json();
            this.invoices = data.invoices || [];
            this.clientId = data.client_id || null;

            // Pre-fill login button with username
            if (this.clientId) {
                const loginBtn = document.querySelector('.shared-login-btn');
                if (loginBtn) loginBtn.href = `/pages/login.html?username=${encodeURIComponent(this.clientId)}&redirect=/pages/my-invoices.html`;
            }

            if (this.invoices.length > 0) {
                document.getElementById('clientName').textContent = this.invoices[0].client_full_name || 'Client';
                document.title = `Invoices - ${this.invoices[0].client_full_name || 'Client'} - Discado`;
            }

            this.updateSummary();
            this.displayInvoices();
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('invoicesTableBody').innerHTML =
                `<tr><td colspan="12" class="error-message">${error.message}</td></tr>`;
        }
    }

    updateSummary() {
        const total = this.invoices.length;
        const totalAmount = this.invoices.reduce((s, i) => s + (parseFloat(i.total_ttc) || 0), 0);
        const totalPaid = this.invoices.reduce((s, i) => s + (parseFloat(i.amount_paid) || 0), 0);
        const totalDue = this.invoices.reduce((s, i) => s + (parseFloat(i.amount_due) || 0), 0);

        document.getElementById('totalInvoices').textContent = total;
        document.getElementById('totalAmount').textContent = this.formatCurrency(totalAmount);
        document.getElementById('totalPaid').textContent = this.formatCurrency(totalPaid);
        document.getElementById('totalDue').textContent = this.formatCurrency(totalDue);
    }

    toggleSort() {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
        const sortBtn = document.getElementById('sortBtn');
        const sortText = document.getElementById('sortText');
        const icon = sortBtn.querySelector('i');

        if (this.sortOrder === 'desc') {
            icon.className = 'fas fa-sort-amount-down';
            sortText.textContent = 'Newest first';
        } else {
            icon.className = 'fas fa-sort-amount-up';
            sortText.textContent = 'Oldest first';
        }
        this.displayInvoices();
    }

    displayInvoices() {
        const tbody = document.getElementById('invoicesTableBody');

        if (!this.invoices || this.invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="no-data">No invoices found</td></tr>';
            return;
        }

        const statusOrder = { unpaid: 0, partial: 1, paid: 2 };
        const sorted = [...this.invoices].sort((a, b) => {
            const sa = statusOrder[a.payment_status] ?? 1;
            const sb = statusOrder[b.payment_status] ?? 1;
            if (sa !== sb) return sa - sb;
            const dateA = new Date(a.invoice_date);
            const dateB = new Date(b.invoice_date);
            return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        tbody.innerHTML = sorted.map(inv => this.createTableRow(inv)).join('');
        this.attachEventListeners();
        this.renderMobileBadges(sorted);
    }

    createTableRow(invoice) {
        const statusClass = this.getStatusClass(invoice.payment_status);
        const statusText = this.getStatusText(invoice.payment_status);
        const paidDate = invoice.paid_date ? this.formatDateShort(invoice.paid_date) : '—';
        const dueDate = invoice.due_date ? this.formatDateShort(invoice.due_date) : '—';

        return `
            <tr data-invoice-id="${invoice.id}">
                <td class="invoice-number"><strong>${invoice.order_id}</strong></td>
                <td>${this.formatDateShort(invoice.invoice_date)}</td>
                <td>${invoice.client_full_name || 'N/A'}</td>
                <td class="text-right">${this.formatCurrency(invoice.subtotal_ht)}</td>
                <td class="text-right">${this.formatCurrency(invoice.vat_amount)}</td>
                <td class="text-right"><strong>${this.formatCurrency(invoice.total_ttc)}</strong></td>
                <td>${dueDate}</td>
                <td class="text-right">${this.formatCurrency(invoice.amount_paid)}</td>
                <td class="text-right ${invoice.amount_due > 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(invoice.amount_due)}</td>
                <td>${paidDate}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="text-center">
                    <button class="shared-details-btn" data-invoice-id="${invoice.id}" title="View payment details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="shared-pdf-btn" data-invoice-id="${invoice.id}" title="Download PDF" style="margin-left:6px;">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    renderMobileBadges(invoices) {
        const container = document.getElementById('invoicesBadgesContainer');
        if (!container) return;

        if (!invoices || invoices.length === 0) {
            container.innerHTML = '<p class="no-data">No invoices found</p>';
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
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.subtotal_ht)}</span>
                                </div>
                                <div class="inv-amount-item">
                                    <span class="inv-amount-label">VAT</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.vat_amount)}</span>
                                </div>
                            </div>
                            <div class="inv-amounts-right">
                                <div class="inv-amount-item inv-amount-total">
                                    <span class="inv-amount-label">Total</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.total_ttc)}</span>
                                </div>
                                <div class="inv-amount-item inv-amount-paid">
                                    <span class="inv-amount-label">Paid</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.amount_paid)}</span>
                                </div>
                                <div class="inv-amount-item ${invoice.amount_due > 0 ? 'inv-amount-due' : 'inv-amount-clear'}">
                                    <span class="inv-amount-label">Balance</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.amount_due)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inv-card-actions">
                    <button class="inv-view-btn" data-invoice-id="${invoice.id}">
                        <i class="fas fa-eye"></i> View Payments
                    </button>
                    <button class="inv-pdf-btn" data-invoice-id="${invoice.id}">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                </div>
            </div>
            `;
        }).join('');

        container.querySelectorAll('.inv-view-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openPaymentsModal(btn.dataset.invoiceId));
        });
        container.querySelectorAll('.inv-pdf-btn').forEach(btn => {
            btn.addEventListener('click', () => this.downloadPDF(btn.dataset.invoiceId));
        });
    }

    attachEventListeners() {
        document.querySelectorAll('.shared-details-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openPaymentsModal(btn.dataset.invoiceId));
        });
        document.querySelectorAll('.shared-pdf-btn').forEach(btn => {
            btn.addEventListener('click', () => this.downloadPDF(btn.dataset.invoiceId));
        });
    }

    async openPaymentsModal(invoiceId) {
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;

        document.getElementById('paymentsModalTitle').textContent = `Payment Details — ${invoice.order_id}`;
        document.getElementById('paymentsModalSubtitle').textContent = `Invoice total: ${this.formatCurrency(invoice.total_ttc)}`;

        const modal = document.getElementById('paymentsModal');
        modal.style.display = 'flex';

        try {
            const res = await fetch(`/api/public/shared-invoices/${this.token}/payments/${invoiceId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error');
            this.renderPayments(data.payments, invoice);
        } catch (err) {
            document.getElementById('paymentsHistoryBody').innerHTML =
                `<tr><td colspan="3" class="error-message">${err.message}</td></tr>`;
        }
    }

    renderPayments(payments, invoice) {
        const tbody = document.getElementById('paymentsHistoryBody');
        if (!payments || payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="no-data">No payments recorded</td></tr>';
        } else {
            tbody.innerHTML = payments.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${this.formatDateShort(p.payment_date)}</td>
                    <td class="text-right">${this.formatCurrency(p.amount)}</td>
                </tr>
            `).join('');
        }
        const totalPaid = (payments || []).reduce((s, p) => s + p.amount, 0);
        const balanceDue = Math.max(0, invoice.total_ttc - totalPaid);
        document.getElementById('paymentsTotalPaid').textContent = this.formatCurrency(totalPaid);
        document.getElementById('paymentsBalanceDue').textContent = this.formatCurrency(balanceDue);
    }

    closeModal() {
        document.getElementById('paymentsModal').style.display = 'none';
    }

    async exportToExcel() {
        if (!this.invoices || this.invoices.length === 0) return;
        try {
            const res = await fetch(`/api/public/shared-invoices/${this.token}/export-xlsx`);
            if (!res.ok) throw new Error('Error generating Excel');
            const blob = await res.blob();
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const clientName = this.invoices[0]?.client_full_name || 'client';
            const fileName = `invoices_${clientName}.xlsx`;
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    async downloadPDF(invoiceId) {
        try {
            const res = await fetch(`/api/public/shared-invoices/${this.token}/pdf/${invoiceId}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error generating PDF');
            }
            const blob = await res.blob();
            const invoice = this.invoices.find(inv => inv.id == invoiceId);
            const invoiceNum = invoice ? invoice.order_id : invoiceId;
            const filename = `Invoice_${invoiceNum}.pdf`;

            // iOS / mobile : ouvre le share sheet natif (AirDrop, Mail, Imprimer…)
            if (navigator.canShare && navigator.share) {
                const file = new File([blob], filename, { type: 'application/pdf' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: filename });
                    return;
                }
            }

            // Fallback desktop : téléchargement classique
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // Utility methods
    formatCurrency(amount) {
        if (amount === null || amount === undefined) return '0.00 CHF';
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(num)) return '0.00 CHF';
        const fixed = num.toFixed(2);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        return parts.join('.') + ' CHF';
    }

    formatDateShort(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    getStatusClass(status) {
        return { paid: 'status-paid', partial: 'status-partial', unpaid: 'status-unpaid' }[status] || 'status-unpaid';
    }

    getStatusText(status) {
        return { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }[status] || 'Unpaid';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SharedInvoicesView();
});
