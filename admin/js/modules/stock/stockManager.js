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
        this.setupAddProductButton();
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products/stock');
            if (!response.ok) throw new Error('Erreur de chargement des produits');
            this.products = await response.json();
			console.log('Produits chargés:', this.products);
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

    setupAddProductButton() {
        const headerFilters = document.querySelector('.stock-filters');
        if (!headerFilters) return;

        const addButton = document.createElement('button');
        addButton.className = 'stock-btn success add-product-btn';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Ajouter un produit';
        addButton.style.marginTop = '15px';
        addButton.addEventListener('click', () => this.openAddProductModal());
        
        headerFilters.appendChild(addButton);
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
			const productCategory = product.category ?? product.categorie;
			const categoryMatch =
				this.currentCategory === 'all' ||
				(typeof productCategory === 'string' && productCategory === this.currentCategory);
						
			const searchMatch = !this.searchTerm || 
				product.name.toLowerCase().includes(this.searchTerm);
			
			let stockMatch = true;
			if (this.stockFilter === 'in-stock') {
				stockMatch = product.stock > 250;
			} else if (this.stockFilter === 'low-stock') {
				stockMatch = product.stock > 0 && product.stock <= 250;
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

        this.attachUpdateListeners();
        this.attachEditListeners();
    }

	createProductCard(product) {
		const name = product.name ?? product.Nom ?? '—';
		const price = Number(product.price) || 0;
		const category = product.category ?? product.categorie ?? 'autre';
		const supplier = product.supplier ?? 'Non défini';
		const imageUrl = product.image_url ?? product.imageUrl ?? '';
		const stock = Number(product.stock) || 0;

		const stockStatus = this.getStockStatus(stock);

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
					<span class="product-supplier">
						<i class="fas fa-truck"></i> ${supplier}
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
								value=""
								min="0"
								class="stock-input"
								inputmode="numeric"
								pattern="[0-9]*"
								placeholder="Quantité"
								onfocus="this.select()">

							<button class="stock-btn primary update-stock-btn"
									data-product-id="${product.id}">
								<i class="fas fa-sync"></i> Mettre à jour
							</button>
						</div>
						
						<div class="product-actions">
							<button class="stock-btn secondary edit-product-btn"
									data-product-id="${product.id}">
								<i class="fas fa-edit"></i> Modifier le produit
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
        } else if (stock <= 250) {
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

        document.querySelectorAll('.stock-input').forEach(input => {
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const productId = e.target.id.replace('stock-input-', '');
                    await this.updateStock(productId);
                }
            });
        });
    }

    attachEditListeners() {
        document.querySelectorAll('.edit-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = e.currentTarget.dataset.productId;
                this.openEditProductModal(productId);
            });
        });
    }

    openEditProductModal(productId) {
        const product = this.products.find(p => p.id == productId);
        
        if (!product) {
            this.showNotification('Produit non trouvé', 'error');
            return;
        }

        // Supprimer tout modal existant
        const existingModal = document.getElementById('edit-product-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div class="modal-overlay" id="edit-product-modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> Modifier le produit</h3>
                        <button type="button" class="modal-close" id="modal-close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-product-form" class="edit-product-form">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="edit-name">
                                        <i class="fas fa-tag"></i> Nom du produit *
                                    </label>
                                    <input type="text" 
                                           id="edit-name" 
                                           name="name" 
                                           value="${this.escapeHtml(product.name || '')}"
                                           required>
                                </div>

                                <div class="form-group">
                                    <label for="edit-price">
                                        <i class="fas fa-coins"></i> Prix (CHF) *
                                    </label>
                                    <input type="number" 
                                           id="edit-price" 
                                           name="price" 
                                           value="${product.price || 0}"
                                           step="0.01"
                                           min="0"
                                           required>
                                </div>

                                <div class="form-group">
                                    <label for="edit-category">
                                        <i class="fas fa-folder"></i> Catégorie *
                                    </label>
                                    <select id="edit-category" name="category" required>
                                        ${this.getCategoryOptions(product.category)}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="edit-supplier">
                                        <i class="fas fa-truck"></i> Fournisseur
                                    </label>
                                    <input type="text" 
                                           id="edit-supplier" 
                                           name="supplier" 
                                           value="${this.escapeHtml(product.supplier || '')}"
                                           placeholder="Nom du fournisseur">
                                </div>

                                <div class="form-group">
                                    <label for="edit-stock">
                                        <i class="fas fa-boxes"></i> Stock *
                                    </label>
                                    <input type="number" 
                                           id="edit-stock" 
                                           name="stock" 
                                           value="${product.stock || 0}"
                                           min="0"
                                           required>
                                </div>

                                <div class="form-group full-width">
                                    <label for="edit-image-url">
                                        <i class="fas fa-image"></i> URL de l'image
                                    </label>
                                    <input type="text" 
                                           id="edit-image-url" 
                                           name="image_url" 
                                           value="${this.escapeHtml(product.image_url || '')}"
                                           placeholder="/images/category/product.jpg">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" 
                                class="modal-btn modal-btn-secondary" 
                                id="modal-cancel-btn">
                            <i class="fas fa-times"></i> Annuler
                        </button>
                        <button type="button" 
                                class="modal-btn modal-btn-danger" 
                                id="modal-delete-btn">
                            <i class="fas fa-trash"></i> Supprimer
                        </button>
                        <button type="button" 
                                class="modal-btn modal-btn-primary" 
                                id="modal-save-btn">
                            <i class="fas fa-save"></i> Enregistrer
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // IMMÉDIATEMENT après l'insertion, attacher les événements
        const modal = document.getElementById('edit-product-modal');
        const closeBtn = document.getElementById('modal-close-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const deleteBtn = document.getElementById('modal-delete-btn');
        const saveBtn = document.getElementById('modal-save-btn');

        console.log('🔍 Modal trouvé:', modal);
        console.log('🔍 Boutons trouvés:', { closeBtn, cancelBtn, deleteBtn, saveBtn });

        if (!modal) {
            console.error('❌ Modal non trouvé dans le DOM!');
            return;
        }

        // Fonction pour fermer le modal
        const closeModal = () => {
            console.log('✅ Fermeture du modal...');
            modal.remove();
            console.log('✅ Modal supprimé');
        };

        // Event: Close button (X)
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                console.log('🖱️ Click sur X détecté');
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            };
        } else {
            console.error('❌ Close button non trouvé!');
        }

        // Event: Cancel button
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                console.log('🖱️ Click sur Annuler détecté');
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            };
        } else {
            console.error('❌ Cancel button non trouvé!');
        }

        // Event: Delete button
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                console.log('🖱️ Click sur Supprimer détecté');
                e.preventDefault();
                e.stopPropagation();
                this.deleteProduct(productId);
            };
        }

        // Event: Save button
        if (saveBtn) {
            saveBtn.onclick = (e) => {
                console.log('🖱️ Click sur Enregistrer détecté');
                e.preventDefault();
                e.stopPropagation();
                this.saveProductChanges(productId);
            };
        }

        // Event: Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) {
                console.log('🖱️ Click sur overlay détecté');
                closeModal();
            }
        };

        // Event: Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                console.log('⌨️ Touche Escape détectée');
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        console.log('✅ Tous les événements attachés');
    }

    // Méthode helper pour échapper le HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCategoryOptions(currentCategory) {
        const categories = this.getCategories();
        const allCategories = ['tshirt', 'caps', 'bags', 'keyring', 'pens', 'lifestyle', 
                               'gadget', 'patches', 'cloths', 'lighter', 'magnet', 
                               'bells', 'plates', 'softtoy', 'hats', 'farceattrape'];
        
        // Fusionner les catégories existantes avec toutes les catégories possibles
        const uniqueCategories = [...new Set([...categories, ...allCategories])].sort();
        
        return uniqueCategories.map(cat => `
            <option value="${cat}" ${cat === currentCategory ? 'selected' : ''}>
                ${this.formatCategoryName(cat)}
            </option>
        `).join('');
    }

    async saveProductChanges(productId) {
        const form = document.getElementById('edit-product-form');
        const formData = new FormData(form);
        
        const productData = {
            name: formData.get('name'),
            price: parseFloat(formData.get('price')),
            category: formData.get('category'),
            supplier: formData.get('supplier'),
            stock: parseInt(formData.get('stock')),
            image_url: formData.get('image_url')
        };

        // Validation
        if (!productData.name || !productData.price || !productData.category) {
            this.showNotification('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        if (productData.price < 0 || productData.stock < 0) {
            this.showNotification('Le prix et le stock ne peuvent pas être négatifs', 'error');
            return;
        }

        try {
            console.log(`📤 Envoi PUT /api/products/${productId}`, productData);

            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });

            console.log('📥 Réponse reçue, status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erreur du serveur:', errorText);
                throw new Error(errorText || 'Erreur de mise à jour');
            }

            const result = await response.json();
            console.log('✅ Résultat:', result);

            // Mettre à jour les données locales
            const productIndex = this.products.findIndex(p => p.id == productId);
            if (productIndex !== -1) {
                this.products[productIndex] = {
                    ...this.products[productIndex],
                    ...result.product
                };
            }

            // Fermer le modal
            document.getElementById('edit-product-modal').remove();

            // Rafraîchir l'affichage
            await this.loadProducts();
            this.filterProducts();

            this.showNotification('Produit mis à jour avec succès', 'success');

        } catch (error) {
            console.error('❌ Erreur complète:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.')) {
            return;
        }

        try {
            console.log(`🗑️ Suppression produit ${productId}`);

            const response = await fetch(`/api/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Erreur de suppression');
            }

            const result = await response.json();
            console.log('✅ Produit supprimé:', result);

            // Retirer le produit des données locales
            this.products = this.products.filter(p => p.id != productId);

            // Fermer le modal
            const modal = document.getElementById('edit-product-modal');
            if (modal) modal.remove();

            // Rafraîchir l'affichage
            this.filterProducts();

            this.showNotification('Produit supprimé avec succès', 'success');

        } catch (error) {
            console.error('❌ Erreur suppression:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

	async updateStock(productId) {
		const input = document.getElementById(`stock-input-${productId}`);
		const newStock = parseInt(input.value);

		if (isNaN(newStock) || newStock < 0) {
			this.showNotification('Veuillez entrer un nombre valide', 'error');
			return;
		}

		try {
			console.log(`📤 Envoi PUT /api/products/${productId}/stock avec stock:`, newStock);
			
			const response = await fetch(`/api/products/${productId}/stock`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ stock: newStock })
			});

			console.log('📥 Réponse reçue, status:', response.status);
			
			if (!response.ok) {
				const errorText = await response.text();
				console.error('❌ Erreur du serveur:', errorText);
				
				try {
					const errorData = JSON.parse(errorText);
					throw new Error(errorData.error || errorData.message || 'Erreur de mise à jour');
				} catch (parseError) {
					throw new Error(errorText || 'Erreur de mise à jour');
				}
			}

			const result = await response.json();
			console.log('✅ Résultat:', result);

			const productIndex = this.products.findIndex(p => p.id == productId);
			if (productIndex !== -1) {
				this.products[productIndex].stock = newStock;
			}

			document.getElementById(`stock-value-${productId}`).textContent = newStock;
			this.showNotification('Stock mis à jour avec succès', 'success');
			
			this.filterProducts();

		} catch (error) {
			console.error('❌ Erreur complète:', error);
			this.showNotification('Erreur: ' + error.message, 'error');
		}
	}

    // ===== MODAL D'ÉDITION =====
    openEditProductModal(productId) {
        const product = this.products.find(p => p.id == productId);
        if (!product) return;

        const modalHTML = `
            <div class="modal-overlay" id="edit-product-modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> Modifier le produit</h3>
                        <button class="modal-close" onclick="document.getElementById('edit-product-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-product-form">
                            <input type="hidden" id="edit-product-id" value="${product.id}">
                            
                            <div class="form-group">
                                <label for="edit-name">Nom du produit *</label>
                                <input type="text" id="edit-name" value="${product.name}" required>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="edit-price">Prix (CHF) *</label>
                                    <input type="number" id="edit-price" step="0.01" value="${product.price}" required>
                                </div>

                                <div class="form-group">
                                    <label for="edit-stock">Stock *</label>
                                    <input type="number" id="edit-stock" value="${product.stock}" required>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="edit-category">Catégorie *</label>
                                    <select id="edit-category" required>
                                        ${this.getCategoryOptions(product.category)}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="edit-supplier">Fournisseur</label>
                                    <input type="text" id="edit-supplier" value="${product.supplier || ''}" placeholder="Nom du fournisseur">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="edit-image-url">Chemin de l'image</label>
                                <input type="text" id="edit-image-url" value="${product.image_url || ''}" placeholder="/images/category/product.jpg">
                                <small>Exemple: /images/tshirt/tshirt-001.jpg</small>
                            </div>

                            <div class="modal-actions">
                                <button type="button" class="modal-btn secondary" onclick="document.getElementById('edit-product-modal').remove()">
                                    Annuler
                                </button>
                                <button type="submit" class="modal-btn primary">
                                    <i class="fas fa-save"></i> Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProductEdit();
        });
    }

    // ===== MODAL D'AJOUT =====
    openAddProductModal() {
        const modalHTML = `
            <div class="modal-overlay" id="add-product-modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-plus"></i> Ajouter un nouveau produit</h3>
                        <button class="modal-close" onclick="document.getElementById('add-product-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="add-product-form">
                            <div class="form-group">
                                <label for="add-name">Nom du produit *</label>
                                <input type="text" id="add-name" required placeholder="Ex: T-Shirt Rock Band">
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="add-price">Prix (CHF) *</label>
                                    <input type="number" id="add-price" step="0.01" required placeholder="19.90">
                                </div>

                                <div class="form-group">
                                    <label for="add-stock">Stock initial *</label>
                                    <input type="number" id="add-stock" value="10000" required>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="add-category">Catégorie *</label>
                                    <select id="add-category" required>
                                        ${this.getCategoryOptions()}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="add-supplier">Fournisseur</label>
                                    <input type="text" id="add-supplier" placeholder="Nom du fournisseur">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="add-image-url">Chemin de l'image</label>
                                <input type="text" id="add-image-url" placeholder="/images/category/product.jpg">
                                <small>Exemple: /images/tshirt/tshirt-001.jpg</small>
                            </div>

                            <div class="modal-actions">
                                <button type="button" class="modal-btn secondary" onclick="document.getElementById('add-product-modal').remove()">
                                    Annuler
                                </button>
                                <button type="submit" class="modal-btn primary">
                                    <i class="fas fa-plus"></i> Ajouter
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('add-product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveNewProduct();
        });
    }

    getCategoryOptions(selectedCategory = '') {
        const categories = [
            { value: 'tshirt', label: 'T-Shirts' },
            { value: 'caps', label: 'Casquettes' },
            { value: 'bags', label: 'Sacs' },
            { value: 'keyring', label: 'Porte-clés' },
            { value: 'pens', label: 'Stylos' },
            { value: 'lifestyle', label: 'Lifestyle' },
            { value: 'gadget', label: 'Gadgets' },
            { value: 'patches', label: 'Patches' },
            { value: 'cloths', label: 'Textiles' },
            { value: 'lighter', label: 'Briquets' },
            { value: 'magnet', label: 'Aimants' },
            { value: 'bells', label: 'Clochettes' },
            { value: 'plates', label: 'Plaques' },
            { value: 'softtoy', label: 'Peluches' },
            { value: 'hats', label: 'Chapeaux' },
            { value: 'farceattrape', label: 'Farces & Attrapes' }
        ];

        return categories.map(cat => 
            `<option value="${cat.value}" ${selectedCategory === cat.value ? 'selected' : ''}>${cat.label}</option>`
        ).join('');
    }

    async saveProductEdit() {
        const productId = document.getElementById('edit-product-id').value;
        const productData = {
            name: document.getElementById('edit-name').value,
            price: parseFloat(document.getElementById('edit-price').value),
            stock: parseInt(document.getElementById('edit-stock').value),
            category: document.getElementById('edit-category').value,
            supplier: document.getElementById('edit-supplier').value || 'Non défini',
            image_url: document.getElementById('edit-image-url').value
        };

        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });

            if (!response.ok) throw new Error('Erreur lors de la modification');

            this.showNotification('Produit modifié avec succès', 'success');
            document.getElementById('edit-product-modal').remove();
            await this.loadProducts();
            this.filterProducts();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    async saveNewProduct() {
        const productData = {
            name: document.getElementById('add-name').value,
            price: parseFloat(document.getElementById('add-price').value),
            stock: parseInt(document.getElementById('add-stock').value),
            category: document.getElementById('add-category').value,
            supplier: document.getElementById('add-supplier').value || 'Non défini',
            image_url: document.getElementById('add-image-url').value
        };

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });

            if (!response.ok) throw new Error('Erreur lors de l\'ajout');

            this.showNotification('Produit ajouté avec succès', 'success');
            document.getElementById('add-product-modal').remove();
            await this.loadProducts();
            this.renderCategoryTabs();
            this.filterProducts();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

	updateStats() {
		const totalProducts = this.products.length;
		const inStock = this.products.filter(p => Number(p.stock) > 250).length;
		const lowStock = this.products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 250).length;
		const outOfStock = this.products.filter(p => Number(p.stock) === 0).length;

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

document.addEventListener('DOMContentLoaded', () => {
    window.stockManagerInstance = new StockManager();
});