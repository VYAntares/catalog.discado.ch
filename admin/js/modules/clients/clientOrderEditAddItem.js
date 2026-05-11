/**
 * Modale d'ajout d'article à une commande client (édition historique)
 * admin/js/modules/clients/clientOrderEditAddItem.js
 */

import * as Notification from '../../utils/notification.js';

const TEXTILE_CATS = ['tshirt', 'hoodie'];
const ADULT_SIZES = ['S', 'M', 'L', 'XL', '2XL'];
const KID_SIZES = ['2-4ans', '6-8ans', '10-12ans'];

const CATEGORY_LABELS = {
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
    'hoodie': 'Hoodies',
    'farceattrape': 'Farces & Attrapes'
};

let allProducts = [];
let onAddCallback = null;
let initialized = false;

function ensureModalInDOM() {
    return document.getElementById('addClientItemModal');
}

function getEls() {
    return {
        modal: document.getElementById('addClientItemModal'),
        closeBtn: document.getElementById('aciCloseBtn'),
        searchInput: document.getElementById('aciSearchInput'),
        supplierSelect: document.getElementById('aciSupplierSelect'),
        categorySelect: document.getElementById('aciCategorySelect'),
        productsContainer: document.getElementById('aciProductsContainer'),
    };
}

function formatCategoryName(category) {
    return CATEGORY_LABELS[category] || category;
}

async function loadAllProducts() {
    const { productsContainer } = getEls();
    try {
        const response = await fetch('/api/products/stock', { credentials: 'include' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        allProducts = await response.json();

        if (!Array.isArray(allProducts) || allProducts.length === 0) {
            productsContainer.innerHTML = '<div class="aci-empty"><i class="fas fa-box-open"></i><p>Aucun produit trouvé</p></div>';
            return;
        }

        populateFilters(allProducts);
        applyFilters();
    } catch (error) {
        console.error('Erreur chargement produits:', error);
        productsContainer.innerHTML = '<div class="aci-empty" style="color:#f56565;">Erreur de chargement des produits</div>';
    }
}

function populateFilters(products) {
    const { supplierSelect, categorySelect } = getEls();

    const suppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))].sort();
    supplierSelect.innerHTML = '<option value="">Tous les fournisseurs</option>' +
        suppliers.map(s => `<option value="${s}">${s}</option>`).join('');

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    categorySelect.innerHTML = '<option value="">Toutes les catégories</option>' +
        categories.map(c => `<option value="${c}">${formatCategoryName(c)}</option>`).join('');
}

function applyFilters() {
    const { searchInput, supplierSelect, categorySelect, productsContainer } = getEls();
    const searchTerm = (searchInput.value || '').toLowerCase().trim();
    const selectedSupplier = supplierSelect.value;
    const selectedCategory = categorySelect.value;

    let filtered = allProducts;

    if (searchTerm) {
        filtered = filtered.filter(p => {
            const name = (p.name || '').toLowerCase();
            const barcode = (p.barcode || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const supplier = (p.supplier || '').toLowerCase();
            const numberMatch = (p.name || '').match(/\d+/g);
            const numbers = numberMatch ? numberMatch.join(' ') : '';
            return name.includes(searchTerm) ||
                   barcode.includes(searchTerm) ||
                   category.includes(searchTerm) ||
                   supplier.includes(searchTerm) ||
                   numbers.includes(searchTerm);
        });
    }

    if (selectedSupplier) {
        filtered = filtered.filter(p => p.supplier === selectedSupplier);
    }

    if (selectedCategory) {
        filtered = filtered.filter(p => p.category === selectedCategory);
    }

    renderProductsList(filtered.slice(0, 100));

    if (filtered.length > 100) {
        productsContainer.insertAdjacentHTML('afterbegin', `
            <div class="aci-info-banner">
                <i class="fas fa-info-circle"></i> <strong>${filtered.length} produits trouvés</strong> — affichage limité à 100. Affinez votre recherche.
            </div>
        `);
    }
}

function renderProductsList(products) {
    const { productsContainer } = getEls();

    if (products.length === 0) {
        productsContainer.innerHTML = '<div class="aci-empty"><i class="fas fa-search"></i><p>Aucun produit trouvé</p></div>';
        return;
    }

    productsContainer.innerHTML = products.map(product => {
        const category = (product.category || '').toLowerCase();
        const isTextile = TEXTILE_CATS.includes(category);
        const sizes = isTextile ? (/kid/i.test(product.name) ? KID_SIZES : ADULT_SIZES) : [];
        const sizeSelector = isTextile
            ? `<select class="aci-size-select" data-product-id="${product.id}">
                 <option value="">-- Taille --</option>
                 ${sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
               </select>`
            : '';

        const priceCHF = parseFloat(product.prix || product.price || 0);

        return `
        <div class="aci-product-item" data-product-id="${product.id}">
            <div class="aci-img-wrap">
                <img src="${product.image_url || ''}"
                     alt="${escapeAttr(product.name)}"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="aci-img-fallback">
                    <i class="fas fa-image" style="color:#cbd5e0; font-size:24px;"></i>
                </div>
            </div>
            <div class="aci-product-info">
                <h4>${escapeHtml(product.name || '')}</h4>
                <p><i class="fas fa-tag"></i> ${formatCategoryName(product.category) || 'Autre'}</p>
                <p><i class="fas fa-barcode"></i> ${escapeHtml(product.barcode || 'N/A')}</p>
            </div>
            <div class="aci-product-price">
                ${priceCHF.toFixed(2)} CHF
            </div>
            <div class="aci-product-actions">
                ${sizeSelector}
                <input type="number"
                       class="aci-price-input"
                       value="${priceCHF.toFixed(2)}"
                       min="0"
                       step="0.01"
                       data-product-id="${product.id}"
                       title="Prix unitaire CHF"
                       onfocus="this.select()">
                <input type="number"
                       class="aci-qty-input"
                       value="1"
                       min="1"
                       data-product-id="${product.id}"
                       title="Quantité"
                       onfocus="this.select()">
                <button class="aci-add-btn"
                        type="button"
                        data-product-id="${product.id}"
                        data-product-name="${escapeAttr(product.name || '')}"
                        data-product-category="${escapeAttr(product.category || '')}"
                        data-product-image="${escapeAttr(product.image_url || '')}"
                        data-is-textile="${isTextile}">
                    <i class="fas fa-plus"></i> Ajouter
                </button>
            </div>
        </div>`;
    }).join('');

    attachAddButtonListeners();
}

function attachAddButtonListeners() {
    document.querySelectorAll('#addClientItemModal .aci-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const productId = btn.dataset.productId;
            const productName = btn.dataset.productName;
            const productCategory = btn.dataset.productCategory;
            const productImage = btn.dataset.productImage;
            const isTextile = btn.dataset.isTextile === 'true';

            const priceInput = document.querySelector(`#addClientItemModal .aci-price-input[data-product-id="${productId}"]`);
            const qtyInput = document.querySelector(`#addClientItemModal .aci-qty-input[data-product-id="${productId}"]`);

            const unitPrice = parseFloat(priceInput.value);
            const quantity = parseInt(qtyInput.value, 10);

            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                Notification.showNotification('Prix invalide', 'error');
                return;
            }
            if (!Number.isFinite(quantity) || quantity <= 0) {
                Notification.showNotification('Quantité invalide', 'error');
                return;
            }

            let size = null;
            if (isTextile) {
                const sizeSelect = document.querySelector(`#addClientItemModal .aci-size-select[data-product-id="${productId}"]`);
                size = sizeSelect ? sizeSelect.value : null;
                if (!size) {
                    Notification.showNotification('Veuillez sélectionner une taille', 'error');
                    return;
                }
            }

            if (typeof onAddCallback === 'function') {
                onAddCallback({
                    product_id: parseInt(productId, 10),
                    product_name: productName,
                    unit_price: unitPrice,
                    quantity: quantity,
                    category: productCategory,
                    image_url: productImage,
                    size: size
                });
            }
        });
    });
}

function setupListenersOnce() {
    if (initialized) return;
    const { closeBtn, searchInput, supplierSelect, categorySelect, modal } = getEls();
    if (!modal) return;

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applyFilters(), 250);
    });
    supplierSelect.addEventListener('change', applyFilters);
    categorySelect.addEventListener('change', applyFilters);

    initialized = true;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Ouvre la modale d'ajout. `onAdd(item)` est appelé à chaque clic sur "Ajouter".
 */
export function openAddItemModal(onAdd) {
    const modal = ensureModalInDOM();
    if (!modal) {
        Notification.showNotification('Modale d\'ajout introuvable sur cette page', 'error');
        return;
    }

    onAddCallback = typeof onAdd === 'function' ? onAdd : null;
    setupListenersOnce();

    modal.style.display = 'flex';

    const { searchInput } = getEls();
    if (searchInput) {
        searchInput.value = '';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (!isMobile) setTimeout(() => searchInput.focus(), 50);
    }

    if (allProducts.length === 0) {
        loadAllProducts();
    } else {
        applyFilters();
    }
}

export function closeModal() {
    const modal = ensureModalInDOM();
    if (modal) modal.style.display = 'none';
    onAddCallback = null;
}
