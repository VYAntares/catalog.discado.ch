// Stock Management Module
class StockManager {
    constructor() {
		this.products = [];
		this.filteredProducts = [];
		this.suppliers = []; // NOUVEAU: Liste des fournisseurs
		this.currentCategory = 'all';
		this.searchTerm = '';
		this.stockFilter = 'all';
		this.supplierFilter = 'all';
		this.init();
	}


    async init() {
		await this.loadSuppliers(); // NOUVEAU: Charger les fournisseurs en premier
		await this.loadProducts();
		this.setupEventListeners();
		this.renderCategoryTabs();
		this.renderSupplierFilter();
		this.updateStats();
		this.setupAddProductButton();
		this.sortProducts('name-asc');
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

	async loadSuppliers() {
		try {
			const response = await fetch('/api/suppliers');
			if (!response.ok) throw new Error('Erreur de chargement des fournisseurs');
			this.suppliers = await response.json();
			console.log('Fournisseurs chargés:', this.suppliers);
		} catch (error) {
			console.error('Erreur chargement fournisseurs:', error);
			this.suppliers = [];
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

        // NOUVEAU: Supplier filter
        const supplierFilter = document.getElementById('supplier-filter');
        if (supplierFilter) {
            supplierFilter.addEventListener('change', (e) => {
                this.supplierFilter = e.target.value;
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

    // NOUVEAU: Remplir le filtre fournisseur
    renderSupplierFilter() {
        const supplierFilter = document.getElementById('supplier-filter');
        if (!supplierFilter) return;
        
        const suppliers = this.getUniqueSuppliers();
        
        supplierFilter.innerHTML = `
            <option value="all">Tous les fournisseurs</option>
            ${suppliers.map(supplier => `
                <option value="${supplier}">${supplier}</option>
            `).join('')}
        `;
    }

    // NOUVEAU: Obtenir la liste unique des fournisseurs
    getUniqueSuppliers() {
        const suppliers = this.products
            .map(p => p.supplier || 'Non défini')
            .filter(s => s && s.trim() !== '');
        
        return [...new Set(suppliers)].sort();
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
            'tshirt': 'T-Shirt',
            'caps': 'Caps',
            'bags': 'Bags',
            'keyring': 'Keyrings',
            'pens': 'Pens',
            'lifestyle': 'Lifestyle',
            'gadget': 'Gadgets',
            'patches': 'Patches',
            'cloths': 'Cloths',
            'lighter': 'Lighter',
            'magnet': 'Magnets',
            'bells': 'Bells',
            'plates': 'Plates',
            'softtoy': 'Soft-Toy',
            'hats': 'Hats',
            'farceattrape': 'Farce & Attrape'
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

			const supplierMatch = this.supplierFilter === 'all' || 
				(product.supplier || 'Non défini') === this.supplierFilter;

			return categoryMatch && searchMatch && stockMatch && supplierMatch;
		});

		// ✅ AJOUTER : Réappliquer le tri par défaut après filtrage
		this.filteredProducts.sort((a, b) => this.naturalSort(a.name, b.name));

		this.displayProducts();
		this.updateStats();
	}

    // Fonction de tri naturel (gère correctement les numéros dans les noms)
	naturalSort(a, b) {
		return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
	}

	sortProducts(sortBy) {
		switch(sortBy) {
			case 'name-asc':
				this.filteredProducts.sort((a, b) => this.naturalSort(a.name, b.name));
				break;
			case 'name-desc':
				this.filteredProducts.sort((a, b) => this.naturalSort(b.name, a.name));
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
							style="cursor: pointer;"
							onclick="window.stockManagerInstance.openImageViewer('${imageUrl}', '${this.escapeHtml(name)}')"
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
										<i class="fas fa-coins"></i> Prix de vente (CHF) *
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
									<label for="edit-origin-price">
										<i class="fas fa-dollar-sign"></i> Prix d'achat (USD)
									</label>
									<input type="number" 
										id="edit-origin-price" 
										name="origin_price" 
										value="${product.origin_price || 0}"
										step="0.01"
										min="0">
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
									<select id="edit-supplier" name="supplier">
										<option value="">Non défini</option>
										${this.getSupplierOptions(product.supplier)}
									</select>
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
									<label for="edit-barcode">
										<i class="fas fa-barcode"></i> Code barre
									</label>
									<input type="text" 
										id="edit-barcode" 
										name="barcode" 
										value="${this.escapeHtml(product.barcode || '')}"
										placeholder="Code barre du produit">
								</div>

								<div class="form-group full-width">
									<label>
										<i class="fas fa-image"></i> Image du produit
									</label>
									
									<!-- Prévisualisation de l'image actuelle -->
									<div class="image-preview-container" style="margin-bottom: 15px;">
										${product.image_url ? `
											<img src="${product.image_url}" 
												alt="Image actuelle" 
												id="current-product-image"
												style="max-width: 200px; max-height: 200px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer;"
												onclick="window.stockManagerInstance.openImageViewer('${product.image_url}', '${this.escapeHtml(product.name)}')">
											<div style="margin-top: 5px;">
												<small style="color: #666;">Cliquez sur l'image pour l'agrandir</small>
											</div>
										` : `
											<div style="padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
												<i class="fas fa-image" style="font-size: 48px; color: #ccc;"></i>
												<p style="color: #999; margin-top: 10px;">Aucune image</p>
											</div>
										`}
									</div>
									
									<!-- Upload de nouvelle image -->
									<div class="image-upload-section">
										<input type="file" 
											id="product-image-upload" 
											accept="image/jpeg,image/png,image/gif,image/webp"
											style="display: none;">
										
										<button type="button" 
												class="stock-btn secondary" 
												onclick="document.getElementById('product-image-upload').click()"
												style="width: 100%; margin-bottom: 10px;">
											<i class="fas fa-upload"></i> Télécharger une nouvelle image
										</button>
										
										<div id="upload-preview" style="display: none; margin-top: 10px;">
											<img id="upload-preview-img" 
												style="max-width: 200px; max-height: 200px; border: 2px solid #667eea; border-radius: 8px;">
											<div style="margin-top: 5px;">
												<small id="upload-filename" style="color: #667eea;"></small>
											</div>
										</div>
									</div>
									
									<!-- Champ caché pour l'URL de l'image -->
									<input type="hidden" id="edit-image-url" name="image_url" value="${this.escapeHtml(product.image_url || '')}">
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

		// Gestionnaire d'upload d'image
		const imageInput = document.getElementById('product-image-upload');
		imageInput.addEventListener('change', async (e) => {
			const file = e.target.files[0];
			if (!file) return;
			
			// Prévisualisation
			const reader = new FileReader();
			reader.onload = (e) => {
				const preview = document.getElementById('upload-preview');
				const previewImg = document.getElementById('upload-preview-img');
				const filename = document.getElementById('upload-filename');
				
				previewImg.src = e.target.result;
				filename.textContent = file.name;
				preview.style.display = 'block';
			};
			reader.readAsDataURL(file);
		});

		const modal = document.getElementById('edit-product-modal');
		const closeBtn = document.getElementById('modal-close-btn');
		const cancelBtn = document.getElementById('modal-cancel-btn');
		const deleteBtn = document.getElementById('modal-delete-btn');
		const saveBtn = document.getElementById('modal-save-btn');

		const closeModal = () => {
			modal.remove();
		};

		if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); };
		if (cancelBtn) cancelBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); };
		if (deleteBtn) deleteBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.deleteProduct(productId); };
		if (saveBtn) saveBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.saveProductChanges(productId); };

		modal.onclick = (e) => { if (e.target === modal) closeModal(); };

		const escapeHandler = (e) => {
			if (e.key === 'Escape') {
				closeModal();
				document.removeEventListener('keydown', escapeHandler);
			}
		};
		document.addEventListener('keydown', escapeHandler);
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

	getSupplierOptions(currentSupplier) {
		return this.suppliers.map(supplier => `
			<option value="${this.escapeHtml(supplier.name)}" 
					${supplier.name === currentSupplier ? 'selected' : ''}>
				${this.escapeHtml(supplier.name)}
			</option>
		`).join('');
	}


	// Ouvrir la visionneuse d'image
	openImageViewer(imagePath, productName) {
		const viewerHTML = `
			<div class="modal-overlay" id="image-viewer-modal" style="z-index: 10000; background: rgba(0,0,0,0.9);">
				<div class="image-viewer-content" style="position: relative; width: 90%; max-width: 1200px; margin: 50px auto;">
					<div class="image-viewer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
						<h3 style="color: white; margin: 0;">
							<i class="fas fa-image"></i> ${this.escapeHtml(productName)}
						</h3>
						<div>
							<button class="stock-btn primary" onclick="window.stockManagerInstance.downloadImage('${imagePath}', '${this.escapeHtml(productName)}')" style="margin-right: 10px;">
								<i class="fas fa-download"></i> Télécharger
							</button>
							<button class="modal-close" onclick="document.getElementById('image-viewer-modal').remove()" style="background: white; color: #333; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
								<i class="fas fa-times"></i>
							</button>
						</div>
					</div>
					<div class="image-viewer-body" style="text-align: center; background: white; padding: 20px; border-radius: 12px;">
						<img src="${imagePath}" 
							alt="${this.escapeHtml(productName)}" 
							style="max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
					</div>
				</div>
			</div>
		`;
		
		document.body.insertAdjacentHTML('beforeend', viewerHTML);
		
		// Fermer en cliquant en dehors
		document.getElementById('image-viewer-modal').addEventListener('click', (e) => {
			if (e.target.id === 'image-viewer-modal') {
				e.target.remove();
			}
		});
		
		// Fermer avec Escape
		const escapeHandler = (e) => {
			if (e.key === 'Escape') {
				const modal = document.getElementById('image-viewer-modal');
				if (modal) modal.remove();
				document.removeEventListener('keydown', escapeHandler);
			}
		};
		document.addEventListener('keydown', escapeHandler);
	}

	// Télécharger l'image
	downloadImage(imagePath, productName) {
		const link = document.createElement('a');
		link.href = imagePath;
		
		// Extraire l'extension du fichier (ex: .jpg, .png)
		const extension = imagePath.substring(imagePath.lastIndexOf('.'));
		
		// Créer un nom de fichier sécurisé
		const fileName = productName.replace(/[^a-zA-Z0-9]/g, '-') + extension;
		
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// Modifier saveProductChanges pour gérer l'upload
	async saveProductChanges(productId) {
		const form = document.getElementById('edit-product-form');
		const formData = new FormData(form);
		
		let imageUrl = document.getElementById('edit-image-url').value;
		
		// Vérifier s'il y a une nouvelle image à uploader
		const imageInput = document.getElementById('product-image-upload');
		if (imageInput && imageInput.files.length > 0) {
			try {
				// Upload de l'image
				const uploadFormData = new FormData();
				uploadFormData.append('image', imageInput.files[0]);
				uploadFormData.append('category', formData.get('category'));
				
				const uploadResponse = await fetch('/api/products/upload-image', {
					method: 'POST',
					body: uploadFormData
				});
				
				if (!uploadResponse.ok) {
					const errorData = await uploadResponse.json();
					throw new Error(errorData.error || 'Erreur lors de l\'upload');
				}
				
				const uploadResult = await uploadResponse.json();
				imageUrl = uploadResult.imagePath;
				
				this.showNotification('Image uploadée avec succès', 'success');
			} catch (error) {
				this.showNotification('Erreur upload image: ' + error.message, 'error');
				return;
			}
		}
		
		const productData = {
			name: formData.get('name'),
			price: parseFloat(formData.get('price')),
			origin_price: parseFloat(formData.get('origin_price')) || 0,
			category: formData.get('category'),
			supplier: formData.get('supplier') || 'Non défini',
			stock: parseInt(formData.get('stock')),
			image_url: imageUrl,
			barcode: formData.get('barcode') || ''
		};

		// Validation
		if (!productData.name || !productData.price || !productData.category) {
			this.showNotification('Veuillez remplir tous les champs obligatoires', 'error');
			return;
		}

		if (productData.price < 0 || productData.stock < 0 || productData.origin_price < 0) {
			this.showNotification('Les prix et le stock ne peuvent pas être négatifs', 'error');
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

			const productIndex = this.products.findIndex(p => p.id == productId);
			if (productIndex !== -1) {
				this.products[productIndex] = {
					...this.products[productIndex],
					...result.product
				};
			}

			document.getElementById('edit-product-modal').remove();

			await this.loadProducts();
			this.renderSupplierFilter();
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
            this.renderSupplierFilter(); // Rafraîchir la liste des fournisseurs
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
										${this.getCategoryOptionsForAdd()}
									</select>
								</div>

								<div class="form-group">
									<label for="add-supplier">Fournisseur</label>
									<select id="add-supplier">
										<option value="">Non défini</option>
										${this.suppliers.map(supplier => `
											<option value="${this.escapeHtml(supplier.name)}">
												${this.escapeHtml(supplier.name)}
											</option>
										`).join('')}
									</select>
								</div>
							</div>

							<!-- Section Upload d'image -->
							<div class="form-group">
								<label>
									<i class="fas fa-image"></i> Image du produit
								</label>
								
								<div class="image-upload-section" style="border: 2px dashed #ddd; padding: 15px; border-radius: 8px; background: #f9f9f9;">
									<input type="file" 
										id="add-product-image-upload" 
										accept="image/jpeg,image/png,image/gif,image/webp"
										style="display: none;">
									
									<button type="button" 
											class="stock-btn secondary" 
											onclick="document.getElementById('add-product-image-upload').click()"
											style="width: 100%; margin-bottom: 10px;">
										<i class="fas fa-upload"></i> Sélectionner une image
									</button>
									
									<!-- Prévisualisation de l'image -->
									<div id="add-upload-preview" style="display: none; margin-top: 10px; text-align: center;">
										<img id="add-upload-preview-img" 
											style="max-width: 200px; max-height: 200px; border: 2px solid #667eea; border-radius: 8px;">
										<div style="margin-top: 5px;">
											<small id="add-upload-filename" style="color: #667eea; font-weight: 600;"></small>
										</div>
										<button type="button" 
												class="stock-btn secondary" 
												onclick="document.getElementById('add-product-image-upload').value=''; document.getElementById('add-upload-preview').style.display='none';"
												style="margin-top: 10px;">
											<i class="fas fa-times"></i> Supprimer l'image
										</button>
									</div>
								</div>
							</div>

							<div class="modal-actions" style="margin-top: 20px;">
								<button type="button" class="modal-btn secondary" onclick="document.getElementById('add-product-modal').remove()">
									<i class="fas fa-times"></i> Annuler
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

		// Gestionnaire d'upload d'image pour le modal d'ajout
		const addImageInput = document.getElementById('add-product-image-upload');
		addImageInput.addEventListener('change', (e) => {
			const file = e.target.files[0];
			if (!file) return;
			
			// Prévisualisation
			const reader = new FileReader();
			reader.onload = (e) => {
				const preview = document.getElementById('add-upload-preview');
				const previewImg = document.getElementById('add-upload-preview-img');
				const filename = document.getElementById('add-upload-filename');
				
				previewImg.src = e.target.result;
				filename.textContent = file.name;
				preview.style.display = 'block';
			};
			reader.readAsDataURL(file);
		});

		document.getElementById('add-product-form').addEventListener('submit', async (e) => {
			e.preventDefault();
			await this.saveNewProduct();
		});
	}

    getCategoryOptionsForAdd() {
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
            `<option value="${cat.value}">${cat.label}</option>`
        ).join('');
    }

	async saveNewProduct() {
		const category = document.getElementById('add-category').value;
		let imageUrl = '';
		
		// Vérifier s'il y a une image à uploader
		const imageInput = document.getElementById('add-product-image-upload');
		if (imageInput && imageInput.files.length > 0) {
			try {
				// Upload de l'image d'abord
				const uploadFormData = new FormData();
				uploadFormData.append('image', imageInput.files[0]);
				uploadFormData.append('category', category);
				
				console.log('📤 Upload image pour nouveau produit...');
				
				const uploadResponse = await fetch('/api/products/upload-image', {
					method: 'POST',
					body: uploadFormData
				});
				
				if (!uploadResponse.ok) {
					const errorData = await uploadResponse.json();
					throw new Error(errorData.error || 'Erreur lors de l\'upload de l\'image');
				}
				
				const uploadResult = await uploadResponse.json();
				imageUrl = uploadResult.imagePath;
				
				console.log('✅ Image uploadée:', imageUrl);
				
				this.showNotification('Image uploadée avec succès', 'success');
			} catch (error) {
				this.showNotification('Erreur upload image: ' + error.message, 'error');
				return; // Arrêter si l'upload de l'image échoue
			}
		}
		
		// Créer le produit avec l'URL de l'image
		const productData = {
			name: document.getElementById('add-name').value,
			price: parseFloat(document.getElementById('add-price').value),
			stock: parseInt(document.getElementById('add-stock').value),
			category: category,
			supplier: document.getElementById('add-supplier').value || 'Non défini',
			image_url: imageUrl,
			barcode: ''
		};

		console.log('📤 Création du produit:', productData);

		try {
			const response = await fetch('/api/products', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(productData)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(errorText || 'Erreur lors de l\'ajout');
			}

			const result = await response.json();
			console.log('✅ Produit créé:', result);

			this.showNotification('Produit ajouté avec succès', 'success');
			document.getElementById('add-product-modal').remove();
			
			// Rafraîchir l'affichage
			await this.loadProducts();
			this.renderCategoryTabs();
			this.renderSupplierFilter();
			this.filterProducts();
			
		} catch (error) {
			console.error('❌ Erreur création produit:', error);
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