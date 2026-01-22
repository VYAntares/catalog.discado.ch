// comptaClientTable.js - Gestion des factures par client (version tableau Excel)

import { formatCurrency, formatDate } from '../../utils/formatter.js';
import { showNotification } from '../../utils/notification.js';

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

        if (!this.clientId) {
            showNotification('Aucun client spécifié', 'error');
            window.location.href = '/admin/compta';
            return;
        }

        this.setupEventListeners();
        this.loadClientInvoices();
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
        this.attachEventListeners();
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
            await this.loadClientInvoices();
            
        } catch (error) {
            console.error('Erreur complète:', error);
            showNotification('Erreur: ' + error.message, 'error');
            cell.innerHTML = originalContent;
        }

        this.editingCells.delete(cell);
    }

	exportToCSV() {
		if (!this.invoices || this.invoices.length === 0) {
			showNotification('Aucune facture à exporter', 'warning');
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
			`"TOTAL (${totals.count} factures)"`,
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
		
		const clientName = this.invoices[0]?.client_full_name || this.clientId;
		const fileName = `factures_${clientName}_${this.year}.csv`;
		
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
            'partial': 'Partiel',
            'unpaid': 'Non payé'
        };
        return textMap[status] || 'Non payé';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ComptaClientTable();
});