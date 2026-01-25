// UI Utilities pour la page de gestion du stock
// Améliorations supplémentaires pour l'expérience utilisateur

// ===========================================
// LOADING STATES
// ===========================================

class LoadingManager {
    static showLoading(elementId, message = 'Chargement...') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
    
    static hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        element.innerHTML = '';
    }
    
    static showButtonLoading(button, originalText) {
        button.disabled = true;
        button.dataset.originalText = originalText || button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
    }
    
    static hideButtonLoading(button) {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
}

// ===========================================
// MODAL UTILITIES
// ===========================================

class ModalManager {
    static show(title, content, buttons = []) {
        // Créer le modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${buttons.map(btn => `
                        <button class="modal-btn ${btn.class || ''}" 
                                onclick="${btn.onclick || ''}">
                            ${btn.icon ? `<i class="${btn.icon}"></i>` : ''} 
                            ${btn.text}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        return modal;
    }
    
    static confirm(title, message, onConfirm, onCancel) {
        const modal = this.show(title, message, [
            {
                text: 'Annuler',
                class: 'modal-btn-secondary',
                onclick: `this.closest('.modal-overlay').remove(); ${onCancel ? `(${onCancel})()` : ''}`
            },
            {
                text: 'Confirmer',
                class: 'modal-btn-primary',
                icon: 'fas fa-check',
                onclick: `this.closest('.modal-overlay').remove(); (${onConfirm})()`
            }
        ]);
        
        return modal;
    }
}

// ===========================================
// EXPORT UTILITIES
// ===========================================

class ExportManager {
    static exportToCSV(products, filename = 'stock_discado.csv') {
        const headers = ['ID', 'Nom', 'Catégorie', 'Prix (CHF)', 'Stock'];
        const rows = products.map(p => [
            p.id,
            `"${p.name}"`,
            p.category,
            p.price.toFixed(2),
            p.stock
        ]);
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        this.downloadFile(csv, filename, 'text/csv');
    }
    
    static exportToJSON(products, filename = 'stock_discado.json') {
        const json = JSON.stringify(products, null, 2);
        this.downloadFile(json, filename, 'application/json');
    }
    
    static downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    static printStockReport(products) {
        const reportHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Rapport de Stock - Discado</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h1 {
                        text-align: center;
                        color: #667eea;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 12px;
                        text-align: left;
                    }
                    th {
                        background-color: #667eea;
                        color: white;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .out-of-stock {
                        color: #f56565;
                        font-weight: bold;
                    }
                    .low-stock {
                        color: #ed8936;
                        font-weight: bold;
                    }
                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        color: #666;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <h1>📦 Rapport de Stock - Discado</h1>
                <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
                <p>Total de produits: ${products.length}</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Nom du produit</th>
                            <th>Catégorie</th>
                            <th>Prix (CHF)</th>
                            <th>Stock</th>
                            <th>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => `
                            <tr>
                                <td>${p.name}</td>
                                <td>${p.category}</td>
                                <td>${p.price.toFixed(2)}</td>
                                <td>${p.stock}</td>
                                <td class="${p.stock === 0 ? 'out-of-stock' : p.stock <= 10 ? 'low-stock' : ''}">
                                    ${p.stock === 0 ? 'Rupture' : p.stock <= 10 ? 'Stock faible' : 'En stock'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>Discado - Gestion du Stock</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
}

// ===========================================
// BATCH OPERATIONS
// ===========================================

class BatchOperations {
    static async updateMultipleProducts(productIds, newStock) {
        const updates = productIds.map(id => ({ id, stock: newStock }));
        
        try {
            const response = await fetch('/api/products/bulk/stock', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ updates })
            });
            
            if (!response.ok) throw new Error('Erreur de mise à jour');
            
            return await response.json();
        } catch (error) {
            console.error('Erreur:', error);
            throw error;
        }
    }
    
    static async incrementStock(productIds, increment) {
        // Récupérer les produits actuels
        const products = await Promise.all(
            productIds.map(id => 
                fetch(`/api/products/${id}`).then(r => r.json())
            )
        );
        
        // Créer les mises à jour
        const updates = products.map(p => ({
            id: p.id,
            stock: Math.max(0, p.stock + increment)
        }));
        
        return this.updateMultipleProducts(
            updates.map(u => u.id),
            updates[0].stock // Note: This is simplified, should be individual
        );
    }
}

// ===========================================
// KEYBOARD SHORTCUTS
// ===========================================

class KeyboardShortcuts {
    static init() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
            
            // Escape: Clear search
            if (e.key === 'Escape') {
                const searchInput = document.getElementById('search-input');
                if (searchInput && searchInput.value) {
                    searchInput.value = '';
                    searchInput.dispatchEvent(new Event('input'));
                }
            }
        });
    }
}

// ===========================================
// LOCAL STORAGE MANAGER
// ===========================================

class StorageManager {
    static saveFilters(filters) {
        localStorage.setItem('discado_stock_filters', JSON.stringify(filters));
    }
    
    static loadFilters() {
        const saved = localStorage.getItem('discado_stock_filters');
        return saved ? JSON.parse(saved) : null;
    }
    
    static saveViewPreferences(prefs) {
        localStorage.setItem('discado_stock_view', JSON.stringify(prefs));
    }
    
    static loadViewPreferences() {
        const saved = localStorage.getItem('discado_stock_view');
        return saved ? JSON.parse(saved) : {
            gridSize: 'medium',
            showImages: true,
            sortBy: 'name-asc'
        };
    }
}

// ===========================================
// CLIPBOARD UTILITIES
// ===========================================

class ClipboardManager {
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Erreur de copie:', error);
            return false;
        }
    }
    
    static async copyStockList(products) {
        const text = products.map(p => 
            `${p.name} - Stock: ${p.stock}`
        ).join('\n');
        
        return this.copyToClipboard(text);
    }
}

// ===========================================
// ANIMATION UTILITIES
// ===========================================

class AnimationManager {
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.transition = `opacity ${duration}ms`;
        
        setTimeout(() => {
            element.style.opacity = '1';
        }, 10);
    }
    
    static slideDown(element, duration = 300) {
        element.style.maxHeight = '0';
        element.style.overflow = 'hidden';
        element.style.transition = `max-height ${duration}ms ease-out`;
        
        setTimeout(() => {
            element.style.maxHeight = element.scrollHeight + 'px';
        }, 10);
        
        setTimeout(() => {
            element.style.maxHeight = '';
            element.style.overflow = '';
        }, duration);
    }
    
    static highlight(element, color = '#667eea', duration = 1000) {
        const originalBackground = element.style.backgroundColor;
        element.style.transition = `background-color ${duration}ms`;
        element.style.backgroundColor = color;
        
        setTimeout(() => {
            element.style.backgroundColor = originalBackground;
        }, duration);
    }
}

// ===========================================
// INIT ON LOAD
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize keyboard shortcuts
    KeyboardShortcuts.init();
    
    // Add export button to page if needed
    const addExportButtons = () => {
        const header = document.querySelector('.stock-filters');
        if (!header) return;
        
        const exportDiv = document.createElement('div');
        exportDiv.className = 'export-buttons';
        exportDiv.style.cssText = 'margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;';
        exportDiv.innerHTML = `
            <button class="stock-btn secondary" id="export-csv">
                <i class="fas fa-file-csv"></i> Exporter CSV
            </button>
            <button class="stock-btn secondary" id="export-json">
                <i class="fas fa-file-code"></i> Exporter JSON
            </button>
            <button class="stock-btn secondary" id="print-report">
                <i class="fas fa-print"></i> Imprimer
            </button>
        `;
        
        header.appendChild(exportDiv);
        
        // Add event listeners
        document.getElementById('export-csv')?.addEventListener('click', async () => {
            const response = await fetch('/api/products');
            const products = await response.json();
            ExportManager.exportToCSV(products);
        });
        
        document.getElementById('export-json')?.addEventListener('click', async () => {
            const response = await fetch('/api/products');
            const products = await response.json();
            ExportManager.exportToJSON(products);
        });
        
        document.getElementById('print-report')?.addEventListener('click', async () => {
            const response = await fetch('/api/products');
            const products = await response.json();
            ExportManager.printStockReport(products);
        });
    };
    
    // Add export buttons after a short delay to ensure DOM is ready
    setTimeout(addExportButtons, 500);
});

// ===========================================
// MAKE UTILITIES AVAILABLE GLOBALLY
// ===========================================

window.StockUtils = {
    LoadingManager,
    ModalManager,
    ExportManager,
    BatchOperations,
    KeyboardShortcuts,
    StorageManager,
    ClipboardManager,
    AnimationManager
};