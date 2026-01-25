// Stock Management Module
class StockManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.stockFilter = 'all';
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.setupEventListeners();
        this.renderCategoryTabs();
        this.displayProducts();
        this.updateStats();
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Erreur de chargement des produits');
            this.products = await response.json();
			console.log('Produits chargés:', this.products); // Pour debug
			// Vérifier si c'est un tableau
			if (!Array.isArray(this.products)) {
				this.products = [];
			}
            this.filteredProducts = [...this.products];
        } catch (error) {
            console.error('Erreur:', error);
            this.showNotification('Erreur de chargement des produits', 'error');
        }
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterProducts();
            });
        }

        // Stock filter
        const stockFilter = document.getElementById('stock-filter');
        if (stockFilter) {
            stockFilter.addEventListener('change', (e) => {
                this.stockFilter = e.target.value;
                this.filterProducts();
            });
        }

        // Sort select
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortProducts(e.target.value);
            });
        }
    }

    renderCategoryTabs() {
        const categories = this.getCategories();
        const tabsContainer = document.querySelector('.category-tabs');
        
        if (!tabsContainer) return;

        tabsContainer.innerHTML = `
            <div class="category-tab ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">
                <i class="fas fa-th"></i> Tous
            </div>
            ${categories.map(cat => `
                <div class="category-tab ${this.currentCategory === cat ? 'active' : ''}" data-category="${cat}">
                    <i class="${this.getCategoryIcon(cat)}"></i> ${this.formatCategoryName(cat)}
                </div>
            `).join('')}
        `;

        // Add click events
        tabsContainer.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentCategory = tab.dataset.category;
                this.filterProducts();
                this.updateActiveTabs();
            });
        });
    }

    updateActiveTabs() {
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === this.currentCategory);
        });
    }

    getCategories() {
		const categories = this.products
			.map(p => p.category ?? p.categorie)
			.filter(cat => typeof cat === 'string' && cat.trim() !== '');

		return [...new Set(categories)].sort();
	}



    getCategoryIcon(category) {
        const icons = {
            'tshirt': 'fas fa-tshirt',
            'caps': 'fas fa-hat-cowboy',
            'bags': 'fas fa-shopping-bag',
            'keyring': 'fas fa-key',
            'pens': 'fas fa-pen',
            'lifestyle': 'fas fa-heart',
            'gadget': 'fas fa-rocket',
            'patches': 'fas fa-shapes',
            'cloths': 'fas fa-mitten',
            'lighter': 'fas fa-fire',
            'magnet': 'fas fa-magnet',
            'bells': 'fas fa-bell',
            'plates': 'fas fa-compact-disc',
            'softtoy': 'fas fa-teddy-bear',
            'hats': 'fas fa-user-crown',
            'farceattrape': 'fas fa-smile-wink'
        };
        return icons[category] || 'fas fa-box';
    }

    formatCategoryName(category) {
        const names = {
            'tshirt': 'T-Shirts',
            'caps': 'Casquettes',
            'bags': 'Sacs',
            'keyring': 'Porte-clés',
            'pens': 'Stylos',
            'lifestyle': 'Lifestyle',
            'gadget': 'Gadgets',
            'patches': 'Patches',
            'cloths': 'Textiles',
            'lighter': 'Briquets',
            'magnet': 'Aimants',
            'bells': 'Clochettes',
            'plates': 'Plaques',
            'softtoy': 'Peluches',
            'hats': 'Chapeaux',
            'farceattrape': 'Farces & Attrapes'
        };
        return names[category] || category;
    }

	filterProducts() {
		this.filteredProducts = this.products.filter(product => {
			// Category filter
			const productCategory = product.category ?? product.categorie; // <- prend category ou categorie
			const categoryMatch =
				this.currentCategory === 'all' ||
				(typeof productCategory === 'string' && productCategory === this.currentCategory);
						
			// Search filter
			const searchMatch = !this.searchTerm || 
				product.name.toLowerCase().includes(this.searchTerm);
			
			// Stock filter
			let stockMatch = true;
			if (this.stockFilter === 'in-stock') {
				stockMatch = product.stock > 10;
			} else if (this.stockFilter === 'low-stock') {
				stockMatch = product.stock > 0 && product.stock <= 10;
			} else if (this.stockFilter === 'out-of-stock') {
				stockMatch = product.stock === 0;
			}

			return categoryMatch && searchMatch && stockMatch;
		});

		this.displayProducts();
		this.updateStats();
	}


    sortProducts(sortBy) {
        switch(sortBy) {
            case 'name-asc':
                this.filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                this.filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'stock-asc':
                this.filteredProducts.sort((a, b) => a.stock - b.stock);
                break;
            case 'stock-desc':
                this.filteredProducts.sort((a, b) => b.stock - a.stock);
                break;
            case 'price-asc':
                this.filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case 'price-desc':
                this.filteredProducts.sort((a, b) => b.price - a.price);
                break;
        }
        this.displayProducts();
    }

    displayProducts() {
        const container = document.getElementById('products-container');
        if (!container) return;

        if (this.filteredProducts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>Aucun produit trouvé</h3>
                    <p>Essayez de modifier vos filtres de recherche</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredProducts.map(product => this.createProductCard(product)).join('');

        // Add event listeners to update buttons
        this.attachUpdateListeners();
    }

	createProductCard(product) {
		const name = product.name ?? product.Nom ?? '—';
		const price = Number(product.price) || 0;
		const category = product.category ?? product.categorie ?? 'autre';
		const imageUrl = product.image_url ?? product.imageUrl ?? '';
		const stock = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 0;
		const stockStatus = this.getStockStatus(stock);
		console.log(`Produit: ${name}, Stock reçu:`, product.stock, 'Stock affiché:', stock);

		return `
			<div class="product-card" data-product-id="${product.id}">
				<div class="product-image-container">
					${imageUrl
						? `<img src="${imageUrl}" alt="${name}" class="product-image"
							onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
						<i class="fas fa-image no-image" style="display:none;"></i>`
						: `<i class="fas fa-image no-image"></i>`
					}
					<span class="stock-badge ${stockStatus.class}">
						${stockStatus.text}
					</span>
				</div>

				<div class="product-info">
					<h3 class="product-name">${name}</h3>
					<span class="product-category">
						${this.formatCategoryName(category)}
					</span>

					<div class="product-price">
						${price.toFixed(2)} CHF
					</div>

					<div class="stock-control">
						<div class="stock-display">
							<span class="stock-label">Stock actuel :</span>
							<span class="stock-value" id="stock-value-${product.id}">
								${stock}
							</span>
						</div>

						<div class="stock-input-group">
							<input type="number"
								id="stock-input-${product.id}"
								value="${stock}"
								min="0"
								class="stock-input">

							<button class="stock-btn primary update-stock-btn"
									data-product-id="${product.id}">
								<i class="fas fa-sync"></i> Mettre à jour
							</button>
						</div>
					</div>
				</div>
			</div>
		`;
	}

    getStockStatus(stock) {
        if (stock === 0) {
            return { class: 'out-of-stock', text: 'Rupture' };
        } else if (stock <= 10) {
            return { class: 'low-stock', text: 'Stock faible' };
        } else {
            return { class: 'in-stock', text: 'En stock' };
        }
    }

    attachUpdateListeners() {
        document.querySelectorAll('.update-stock-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const productId = e.currentTarget.dataset.productId;
                await this.updateStock(productId);
            });
        });

        // Allow Enter key to update
        document.querySelectorAll('.stock-input').forEach(input => {
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const productId = e.target.id.replace('stock-input-', '');
                    await this.updateStock(productId);
                }
            });
        });
    }

    async updateStock(productId) {
        const input = document.getElementById(`stock-input-${productId}`);
        const newStock = parseInt(input.value);

        if (isNaN(newStock) || newStock < 0) {
            this.showNotification('Veuillez entrer un nombre valide', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/products/${productId}/stock`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ stock: newStock })
            });

            if (!response.ok) throw new Error('Erreur de mise à jour');

            // Update local data
            const productIndex = this.products.findIndex(p => p.id == productId);
            if (productIndex !== -1) {
                this.products[productIndex].stock = newStock;
            }

            // Update display
            document.getElementById(`stock-value-${productId}`).textContent = newStock;
            this.showNotification('Stock mis à jour avec succès', 'success');
            
            // Refresh to update badge
            this.filterProducts();

        } catch (error) {
            console.error('Erreur:', error);
            this.showNotification('Erreur lors de la mise à jour du stock', 'error');
        }
    }

	updateStats() {
		const totalProducts = this.products.length;
		const inStock = this.products.filter(p => Number(p.stock) > 10).length;
		const lowStock = this.products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 10).length;
		const outOfStock = this.products.filter(p => Number(p.stock) === 0).length;
		const totalValue = this.products.reduce((sum, p) => sum + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);

		document.getElementById('total-products').textContent = totalProducts;
		document.getElementById('in-stock-count').textContent = inStock;
		document.getElementById('low-stock-count').textContent = lowStock;
		document.getElementById('out-stock-count').textContent = outOfStock;
	}


    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StockManager();
});