// public/js/modules/myInvoices.js
// Authenticated view of current user's invoices

class MyInvoicesView {
    constructor() {
        this.invoices = [];
        this.sortOrder = 'desc';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInvoices();
    }

    setupEventListeners() {
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) sortBtn.addEventListener('click', () => this.toggleSort());

        const exportBtn = document.getElementById('exportXlsxBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel());

        const closeBtn = document.getElementById('paymentsModalClose');
        const modal = document.getElementById('paymentsModal');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal(); });
    }

    async loadInvoices() {
        try {
            const res = await fetch('/api/my-invoices');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/pages/login.html';
                return;
            }
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to load invoices');
            }
            const data = await res.json();
            this.invoices = data.invoices || [];

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
            sortText.textContent = window.t ? window.t('invoices.newestFirst') : 'Newest first';
        } else {
            icon.className = 'fas fa-sort-amount-up';
            sortText.textContent = window.t ? window.t('invoices.oldestFirst') : 'Oldest first';
        }
        this.displayInvoices();
    }

    displayInvoices() {
        const tbody = document.getElementById('invoicesTableBody');

        if (!this.invoices || this.invoices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="no-data">${window.t ? window.t('invoices.noInvoices') : 'No invoices found'}</td></tr>`;
            this.renderMobileBadges([]);
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
            container.innerHTML = `<p class="no-data">${window.t ? window.t('invoices.noInvoices') : 'No invoices found'}</p>`;
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
                        <span class="inv-date-label">${window.t ? window.t('invoices.dueDate') : 'Due date'}</span>
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
                        <span class="inv-date-label">${window.t ? window.t('invoices.paidOn') : 'Paid on'}</span>
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
                                    <span class="inv-date-label">${window.t ? window.t('invoices.invoiceDate') : 'Invoice date'}</span>
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
                                    <span class="inv-amount-label">${window.t ? window.t('invoices.exclVAT') : 'Excl. VAT'}</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.subtotal_ht)}</span>
                                </div>
                                <div class="inv-amount-item">
                                    <span class="inv-amount-label">${window.t ? window.t('invoices.vat') : 'VAT'}</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.vat_amount)}</span>
                                </div>
                            </div>
                            <div class="inv-amounts-right">
                                <div class="inv-amount-item inv-amount-total">
                                    <span class="inv-amount-label">${window.t ? window.t('invoices.totalLabel') : 'Total'}</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.total_ttc)}</span>
                                </div>
                                <div class="inv-amount-item inv-amount-paid">
                                    <span class="inv-amount-label">${window.t ? window.t('invoices.paidLabel') : 'Paid'}</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.amount_paid)}</span>
                                </div>
                                <div class="inv-amount-item ${invoice.amount_due > 0 ? 'inv-amount-due' : 'inv-amount-clear'}">
                                    <span class="inv-amount-label">${window.t ? window.t('invoices.balance') : 'Balance'}</span>
                                    <span class="inv-amount-value">${this.formatCurrency(invoice.amount_due)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inv-card-actions">
                    <button class="inv-view-btn" data-invoice-id="${invoice.id}">
                        <i class="fas fa-eye"></i> ${window.t ? window.t('invoices.viewPayments') : 'View Payments'}
                    </button>
                    <button class="inv-pdf-btn" data-invoice-id="${invoice.id}">
                        <i class="fas fa-file-pdf"></i> ${window.t ? window.t('invoices.pdfBtn') : 'PDF'}
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

        document.getElementById('paymentsModalTitle').textContent = `${window.t ? window.t('invoices.paymentDetails') : 'Payment Details'} — ${invoice.order_id}`;
        document.getElementById('paymentsModalSubtitle').textContent = `${window.t ? window.t('invoices.invoiceTotal') : 'Invoice total'}: ${this.formatCurrency(invoice.total_ttc)}`;

        const modal = document.getElementById('paymentsModal');
        modal.style.display = 'flex';

        try {
            const res = await fetch(`/api/my-invoices/payments/${invoiceId}`);
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
            tbody.innerHTML = `<tr><td colspan="3" class="no-data">${window.t ? window.t('invoices.noPayments') : 'No payments recorded'}</td></tr>`;
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
            const res = await fetch('/api/my-invoices/export-xlsx');
            if (!res.ok) throw new Error('Error generating Excel');
            const blob = await res.blob();
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const clientName = this.invoices[0]?.client_full_name || 'invoices';
            link.setAttribute('href', url);
            link.setAttribute('download', `invoices_${clientName}.xlsx`);
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
            const res = await fetch(`/api/my-invoices/pdf/${invoiceId}`, { credentials: 'include' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error generating PDF');
            }
            const blob = await res.blob();
            const invoice = this.invoices.find(inv => inv.id == invoiceId);
            const invoiceNum = invoice ? invoice.order_id : invoiceId;
            const filename = `Invoice_${invoiceNum}.pdf`;

            const isCapacitorNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const isMobile = isIOS || /Android/i.test(navigator.userAgent);

            if ((isMobile || isCapacitorNative) && navigator.share) {
                try {
                    const file = new File([blob], filename, { type: 'application/pdf' });
                    await navigator.share({ files: [file], title: filename });
                    return;
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') return;
                    console.warn('Share failed:', shareErr);
                    if (isCapacitorNative) {
                        this._showPdfOverlay(blob, filename);
                        return;
                    }
                }
            }

            if (isCapacitorNative) {
                this._showPdfOverlay(blob, filename);
                return;
            }

            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    _showPdfOverlay(blob, filename) {
        document.getElementById('cap-pdf-overlay')?.remove();
        const objectUrl = URL.createObjectURL(blob);
        const overlay = document.createElement('div');
        overlay.id = 'cap-pdf-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;';
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#1a1a2e;flex-shrink:0;gap:8px;';
        const t = document.createElement('span');
        t.textContent = filename;
        t.style.cssText = 'color:#fff;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
        header.appendChild(t);
        const shareBtn = document.createElement('button');
        shareBtn.innerHTML = '<i class="fas fa-share-alt"></i> Partager';
        shareBtn.style.cssText = 'background:#3498db;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer;flex-shrink:0;';
        shareBtn.addEventListener('click', async () => {
            try { const f = new File([blob], filename, { type: 'application/pdf' }); await navigator.share({ files: [f], title: filename }); } catch (e) { if (e.name !== 'AbortError') console.warn(e); }
        });
        header.appendChild(shareBtn);
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:15px;cursor:pointer;flex-shrink:0;';
        closeBtn.addEventListener('click', () => { overlay.remove(); URL.revokeObjectURL(objectUrl); });
        header.appendChild(closeBtn);
        overlay.appendChild(header);
        const viewer = document.createElement('iframe');
        viewer.src = objectUrl;
        viewer.style.cssText = 'flex:1;border:none;background:#fff;';
        overlay.appendChild(viewer);
        document.body.appendChild(overlay);
    }

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
        const t = window.t;
        return {
            paid: t ? t('invoices.statusPaid') : 'Paid',
            partial: t ? t('invoices.statusPartial') : 'Partial',
            unpaid: t ? t('invoices.statusUnpaid') : 'Unpaid'
        }[status] || (t ? t('invoices.statusUnpaid') : 'Unpaid');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MyInvoicesView();
});
