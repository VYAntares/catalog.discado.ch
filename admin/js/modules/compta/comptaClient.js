// comptaClient.js - Gestion des factures par client

import { formatCurrency, formatDate } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';
import { openModal, closeModal } from '../../utils/modal.js';

class ComptaClient {
    constructor() {
        this.clientId = null;
        this.invoices = [];
        this.sortOrder = 'desc'; // desc = plus récente en premier
        this.init();
    }

    init() {
        // Récupérer l'ID client depuis l'URL
        const urlParams = new URLSearchParams(window.location.search);
        this.clientId = urlParams.get('client_id');

        if (!this.clientId) {
            showNotification('Aucun client spécifié', 'error');
            window.location.href = '/admin/compta';
            return;
        }

        this.setupEventListeners();
        this.loadClientInvoices();
    }

    setupEventListeners() {
        // Bouton de tri
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.toggleSort());
        }

        // Modal de paiement
        const paymentForm = document.getElementById('paymentForm');
        if (paymentForm) {
            paymentForm.addEventListener('submit', (e) => this.handlePaymentSubmit(e));
        }

        const cancelBtn = document.getElementById('cancelPayment');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => closeModal('paymentModal'));
        }

        // Fermeture des modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    closeModal(modal.id);
                }
            });
        });
    }

    async loadClientInvoices() {
        try {
            const response = await fetch(`/api/invoices/client/${this.clientId}`);
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des factures');
            }

            const data = await response.json();
            this.invoices = data.invoices || [];

            // Mettre à jour les informations du client
            if (this.invoices.length > 0) {
                document.getElementById('clientName').textContent = this.invoices[0].client_full_name || 'Client inconnu';
            }
            document.getElementById('clientId').textContent = this.clientId;

            this.displayInvoices();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement des factures', 'error');
            document.getElementById('invoicesList').innerHTML = 
                '<div class="error-message">Impossible de charger les factures</div>';
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
        const container = document.getElementById('invoicesList');
        
        if (!this.invoices || this.invoices.length === 0) {
            container.innerHTML = '<div class="no-data">Aucune facture trouvée pour ce client</div>';
            return;
        }

        // Trier les factures
        const sortedInvoices = [...this.invoices].sort((a, b) => {
            const dateA = new Date(a.invoice_date);
            const dateB = new Date(b.invoice_date);
            return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // Générer le HTML
        container.innerHTML = sortedInvoices.map(invoice => this.createInvoiceCard(invoice)).join('');

        // Ajouter les event listeners
        this.attachInvoiceEventListeners();
    }

    createInvoiceCard(invoice) {
        const statusClass = this.getStatusClass(invoice.payment_status);
        const statusText = this.getStatusText(invoice.payment_status);
        
        return `
            <div class="invoice-card" data-invoice-id="${invoice.id}">
                <div class="invoice-card-header">
                    <div class="invoice-number">
                        <i class="fas fa-file-invoice"></i>
                        Facture n° ${invoice.invoice_number}
                    </div>
                    <div class="invoice-status ${statusClass}">
                        ${statusText}
                    </div>
                </div>

                <div class="invoice-card-body">
                    <div class="invoice-info-grid">
                        <div class="invoice-info-item">
                            <label><i class="fas fa-hashtag"></i> Commande</label>
                            <span>${invoice.order_id}</span>
                        </div>
                        
                        <div class="invoice-info-item">
                            <label><i class="fas fa-calendar"></i> Date facture</label>
                            <span>${formatDate(invoice.invoice_date)}</span>
                        </div>

                        <div class="invoice-info-item">
                            <label><i class="fas fa-calendar-check"></i> Date échéance</label>
                            <span>${invoice.due_date ? formatDate(invoice.due_date) : 'Non définie'}</span>
                        </div>

                        <div class="invoice-info-item">
                            <label><i class="fas fa-calendar-day"></i> Date paiement</label>
                            <span>${invoice.paid_date ? formatDate(invoice.paid_date) : 'Non payée'}</span>
                        </div>
                    </div>

                    <div class="invoice-amounts">
                        <div class="amount-row">
                            <span class="amount-label">Sous-total HT:</span>
                            <span class="amount-value">${formatCurrency(invoice.subtotal_ht)}</span>
                        </div>
                        <div class="amount-row">
                            <span class="amount-label">TVA:</span>
                            <span class="amount-value">${formatCurrency(invoice.vat_amount)}</span>
                        </div>
                        <div class="amount-row total">
                            <span class="amount-label">Total TTC:</span>
                            <span class="amount-value">${formatCurrency(invoice.total_ttc)}</span>
                        </div>
                        <div class="amount-row paid">
                            <span class="amount-label">Montant payé:</span>
                            <span class="amount-value">${formatCurrency(invoice.amount_paid)}</span>
                        </div>
                        <div class="amount-row due ${invoice.amount_due > 0 ? 'outstanding' : ''}">
                            <span class="amount-label">Montant dû:</span>
                            <span class="amount-value">${formatCurrency(invoice.amount_due)}</span>
                        </div>
                    </div>
                </div>

                <div class="invoice-card-footer">
                    <button class="action-btn primary-btn edit-payment-btn" data-invoice-id="${invoice.id}">
                        <i class="fas fa-edit"></i> Modifier le paiement
                    </button>
                </div>
            </div>
        `;
    }

    attachInvoiceEventListeners() {
        document.querySelectorAll('.edit-payment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const invoiceId = e.currentTarget.dataset.invoiceId;
                this.openPaymentModal(invoiceId);
            });
        });
    }

    openPaymentModal(invoiceId) {
        const invoice = this.invoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;

        // Remplir le formulaire
        document.getElementById('paymentInvoiceId').value = invoice.id;
        document.getElementById('paymentInvoiceNumber').textContent = invoice.invoice_number;
        document.getElementById('paymentTotalAmount').textContent = formatCurrency(invoice.total_ttc);
        document.getElementById('paymentAmountPaid').value = invoice.amount_paid || 0;
        document.getElementById('paymentStatus').value = invoice.payment_status || 'unpaid';
        
        if (invoice.paid_date) {
            const date = new Date(invoice.paid_date);
            document.getElementById('paymentPaidDate').value = date.toISOString().split('T')[0];
        } else {
            document.getElementById('paymentPaidDate').value = '';
        }

        openModal('paymentModal');
    }

    async handlePaymentSubmit(e) {
        e.preventDefault();

        const invoiceId = document.getElementById('paymentInvoiceId').value;
        const amountPaid = parseFloat(document.getElementById('paymentAmountPaid').value);
        const paymentStatus = document.getElementById('paymentStatus').value;
        const paidDate = document.getElementById('paymentPaidDate').value;

        const invoice = this.invoices.find(inv => inv.id == invoiceId);
        if (!invoice) return;

        // Calculer le montant dû
        const amountDue = invoice.total_ttc - amountPaid;

        try {
            const response = await fetch(`/api/invoices/${invoiceId}/payment`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount_paid: amountPaid,
                    payment_status: paymentStatus,
                    amount_due: amountDue,
                    paid_date: paidDate || null
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la mise à jour du paiement');
            }

            showNotification('Paiement mis à jour avec succès', 'success');
            closeModal('paymentModal');
            
            // Recharger les factures
            await this.loadClientInvoices();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors de la mise à jour du paiement', 'error');
        }
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
            'paid': 'Payé',
            'partial': 'Partiellement payé',
            'unpaid': 'Non payé'
        };
        return textMap[status] || 'Non payé';
    }
}

// Initialiser quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    new ComptaClient();
});