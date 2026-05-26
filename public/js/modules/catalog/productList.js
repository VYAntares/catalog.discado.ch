//public/js/modules/catalog/productList.js
import { fetchProducts, fetchWishlist, addToWishlistApi, removeFromWishlistApi } from '../../core/api.js';
import { addCartItem } from '../../core/cartApi.js';
import { showNotification } from '../../utils/notification.js';
import { initImagePreview } from './imagePreview.js';
import { searchProducts } from './productSearch.js';
import { initProductFilter, getCurrentCategory } from './productFilter.js';
import { formatPrice } from '../../utils/formatter.js';

// State management
let allProducts = [];
let displayedProducts = [];
let selectedProducts = [];
let currentCategorySelected = 'magnet';

// Wishlist state: Map of product_id => wishlist item id
let wishlistMap = new Map();
let favouritesFilterActive = false;

// Textile size configuration
const TEXTILE_CATEGORIES = ['tshirt', 'hoodie'];
const ADULT_SIZES = ['S', 'M', 'L', 'XL', '2XL'];
const KID_SIZES = ['2-4ans', '6-8ans', '10-12ans'];

function isTextile(product) {
    if (!product.categorie) return false;
    return TEXTILE_CATEGORIES.includes(product.categorie.toLowerCase());
}

function isKidProduct(product) {
    return product.Nom && /kid/i.test(product.Nom);
}

function getSizes(product) {
    return isKidProduct(product) ? KID_SIZES : ADULT_SIZES;
}

// Load wishlist state from server
async function loadWishlistState() {
    try {
        const items = await fetchWishlist();
        wishlistMap.clear();
        if (Array.isArray(items)) {
            items.forEach(item => wishlistMap.set(String(item.product_id), item.id));
        }
    } catch (e) {
        // non bloquant
    }
}

// Toggle wishlist for a product
async function toggleWishlist(product, btn) {
    const productId = String(product.id);
    const isInWishlist = wishlistMap.has(productId);

    if (isInWishlist) {
        try {
            await removeFromWishlistApi(productId);
            wishlistMap.delete(productId);
            btn.classList.remove('active');
            btn.title = 'Add to favourites';
            updateWishlistBadge();
        } catch (e) {
            showNotification('Error removing from favourites', 'error');
        }
    } else {
        try {
            const result = await addToWishlistApi({
                product_id: productId,
                product_name: product.Nom,
                product_price: parseFloat(product.prix) || 0,
                category: product.categorie,
                image_url: product.imageUrl
            });
            if (result && result.item) {
                wishlistMap.set(productId, result.item.id);
            }
            btn.classList.add('active');
            btn.title = 'Remove from favourites';
            updateWishlistBadge();
        } catch (e) {
            showNotification('Error adding to favourites', 'error');
        }
    }
}

// Update the header wishlist badge
function updateWishlistBadge() {
    if (window.DiscadoHeader && window.DiscadoHeader.updateWishlistBadge) {
        window.DiscadoHeader.updateWishlistBadge(wishlistMap.size);
    }
}

// Applique les filtres actifs (catégorie + favoris si actif)
function applyFilters(category) {
    const categoryFiltered = filterByCategory(allProducts, category);
    return favouritesFilterActive
        ? categoryFiltered.filter(p => wishlistMap.has(String(p.id)))
        : categoryFiltered;
}

// Handle wishlist filter toggle from header
function handleWishlistFilterToggle() {
    favouritesFilterActive = !favouritesFilterActive;
    if (window.DiscadoHeader && window.DiscadoHeader.setWishlistFilterActive) {
        window.DiscadoHeader.setWishlistFilterActive(favouritesFilterActive);
    }
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput?.value?.trim() || '';
    const filtered = applyFilters(currentCategorySelected);
    displayProducts(searchQuery ? searchProducts(searchQuery, filtered) : filtered);
}

// Initialize catalog page
// options.defaultCategory: first category to display (default: 'magnet')
function initCatalog(options = {}) {
    const defaultCategory = options.defaultCategory || 'magnet';
    currentCategorySelected = defaultCategory;

    createFloatingButton();

    document.addEventListener('wishlistFilterToggle', handleWishlistFilterToggle);

    loadWishlistState().then(() => {
        loadProducts(defaultCategory).then(() => {
            setupSearch();
            initProductFilter(filterProducts);

            // Activer le filtre favoris si demandé via URL
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('filter') === 'favourites') {
                favouritesFilterActive = true;
                if (window.DiscadoHeader && window.DiscadoHeader.setWishlistFilterActive) {
                    window.DiscadoHeader.setWishlistFilterActive(true);
                }
                displayProducts(applyFilters(currentCategorySelected));
            }
        });
    });
}

// Fetch and load products from API
async function loadProducts(defaultCategory = 'magnet') {
    try {
        const productList = document.getElementById('productList');

        if (productList) {
            productList.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Loading products...</p>
                </div>
            `;
        }

        allProducts = await fetchProducts();

        // Filter out invalid products
        allProducts = allProducts.filter(p => p.Nom && p.Nom.trim() !== "");

        displayedProducts = filterByCategory(allProducts, defaultCategory);
        displayProducts(displayedProducts);

        initImagePreview();

        return allProducts;

    } catch (error) {
        handleProductLoadError();
        return [];
    }
}

// Handle product loading error
function handleProductLoadError() {
    const productList = document.getElementById('productList');
    if (productList) {
        productList.innerHTML = `
            <div class="error-message">
                <p>Error loading products. Please try again.</p>
                <button id="retry-btn" class="primary-btn">Retry</button>
            </div>
        `;
        
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', loadProducts);
        }
    }
}

// Filter products by category
function filterByCategory(products, category) {
    if (category === "all") return products;
    
    return products.filter(p => {
        if (!p.categorie) return false;
        
        const productCategory = p.categorie.toLowerCase();
        const selectedCategory = category.toLowerCase();
        
        return (
            productCategory === selectedCategory ||
            productCategory === selectedCategory.replace('-', '') ||
            productCategory === selectedCategory.replace('_', '') ||
            productCategory.includes(selectedCategory) ||
            selectedCategory.includes(productCategory)
        );
    });
}

// Build display list for a category: mix of real products and hero image placeholders
// Hero placeholders have { _hero: true, src, cls }
function applyCategorySort(products, category) {
    if (category === 'tshirt') {
        const kids  = products.filter(p => p.Nom && /kid/i.test(p.Nom));
        const others = products
            .filter(p => !p.Nom || !/kid/i.test(p.Nom))
            .sort((a, b) => (a.prix || 0) - (b.prix || 0));

        const beforeSeven = others.filter(p => (p.prix || 0) < 7);
        const sevenPlus   = others.filter(p => (p.prix || 0) >= 7);

        return [
            { _hero: true, src: '/images/lifestyle/kid.jpg',         cls: 'hero-contain' },
            ...kids,
            { _hero: true, src: '/images/lifestyle/unisex.jpg',      cls: 'hero-newline' },
            ...beforeSeven,
            { _hero: true, src: '/images/lifestyle/Tshirt_face.jpg', cls: 'hero-2x2' },
            ...sevenPlus
        ];
    }
    return products;
}

// Display products in the list
function displayProducts(products) {
    const list = document.getElementById("productList");
    if (!list) return;

    const displayList = applyCategorySort(products, currentCategorySelected);
    displayedProducts = displayList.filter(p => !p._hero);

    if (displayedProducts.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No products found in this category, like a product to add it</p>
            </div>
        `;
        return;
    }

    list.innerHTML = "";

    // Explicitly-placed hero images (prepended, use CSS grid-column/row)
    const explicitHeroes = {
        hoodie: [
            { src: '/images/lifestyle/hoodie_profile.jpg', cls: 'hero-right' }
        ]
    };
    if (explicitHeroes[currentCategorySelected]) {
        explicitHeroes[currentCategorySelected].forEach(({ src, cls }) => {
            const heroLi = document.createElement('li');
            heroLi.className = `product-item lifestyle-hero ${cls}`;
            heroLi.innerHTML = `<img src="${src}" alt="Lifestyle" class="lifestyle-hero-img">`;
            list.appendChild(heroLi);
        });
    }

    // Render the display list in order (products + inline hero images)
    let productIndex = 0;
    displayList.forEach(item => {
        if (item._hero) {
            const heroLi = document.createElement('li');
            heroLi.className = `product-item lifestyle-hero${item.cls ? ' ' + item.cls : ''}`;
            heroLi.innerHTML = `<img src="${item.src}" alt="Lifestyle" class="lifestyle-hero-img">`;
            list.appendChild(heroLi);
        } else {
            list.appendChild(createProductElement(item, productIndex++));
        }
    });

    document.dispatchEvent(new CustomEvent('productsLoaded'));
}

// Create wishlist heart button
function createWishlistButton(product) {
    const btn = document.createElement('button');
    btn.className = 'wishlist-btn' + (wishlistMap.has(String(product.id)) ? ' active' : '');
    btn.title = wishlistMap.has(String(product.id)) ? 'Remove from favourites' : 'Add to favourites';
    btn.setAttribute('aria-label', 'Toggle favourite');
    btn.innerHTML = '<i class="fas fa-heart"></i>';

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWishlist(product, btn);
    });

    return btn;
}

// Create individual product element
function createProductElement(product, index) {
    const li = document.createElement("li");
    li.className = "product-item";
    li.setAttribute('data-product-id', product.id || index);

    const imgContainer = createImageContainer(product);
    const infoContainer = createInfoContainer(product);
    const actionContainer = createActionContainer(product);

    li.append(imgContainer, infoContainer, actionContainer);
    return li;
}

// Create product image container
function createImageContainer(product) {
    const imgContainer = document.createElement("div");
    imgContainer.className = "product-img-container";

    const img = document.createElement("img");
    img.src = product.imageUrl;
    img.alt = product.Nom || "Product image";
    img.className = "product-img";

    imgContainer.appendChild(img);
    return imgContainer;
}

// Create product info container
function createInfoContainer(product) {
    const infoContainer = document.createElement("div");
    infoContainer.className = "product-info";

    // Name row: product name + wishlist heart side by side
    const nameRow = document.createElement("div");
    nameRow.className = "product-name-row";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = product.Nom || "Product without name";
    nameSpan.className = "product-name";

    const wishlistBtn = createWishlistButton(product);

    nameRow.append(nameSpan, wishlistBtn);

    const priceSpan = document.createElement("span");
    priceSpan.textContent = `${formatPrice(product.prix || 0)} CHF`;
    priceSpan.className = "product-price";

    const stockBadge = document.createElement("span");
    const stockQty = Number(product.stock) || 0;
    if (stockQty > 0) {
        stockBadge.textContent = window.t ? window.t('catalog.inStock') : "In stock";
        stockBadge.className = "stock-badge in-stock";
    } else {
        stockBadge.textContent = window.t ? window.t('catalog.outOfStock') : "Out of stock";
        stockBadge.className = "stock-badge out-of-stock";
    }

    infoContainer.append(nameRow, priceSpan, stockBadge);
    return infoContainer;
}

// Create product action container with quantity input (or size selector for textiles)
function createActionContainer(product) {
    const actionContainer = document.createElement("div");
    actionContainer.className = "product-actions";

    if (isTextile(product)) {
        actionContainer.appendChild(createSizeSelectorContainer(product));
    } else {
        const quantityContainer = document.createElement("div");
        quantityContainer.className = "quantity-container";
        quantityContainer.appendChild(createQuantityInput(product));
        actionContainer.appendChild(quantityContainer);
    }

    return actionContainer;
}

// Create size selector grid for textile products
function createSizeSelectorContainer(product) {
    const sizes = getSizes(product);
    const sizeSelector = document.createElement("div");
    sizeSelector.className = "size-selector";

    sizes.forEach(size => {
        const sizeCol = document.createElement("div");
        sizeCol.className = "size-col";

        const label = document.createElement("span");
        label.className = "size-label";
        label.textContent = size;

        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.pattern = "[0-9]*";
        input.value = "0";
        input.className = "quantity-input size-qty";

        input.addEventListener('focus', () => {
            if (input.value === "0") input.value = "";
        });
        input.addEventListener('blur', () => {
            if (input.value === "") input.value = "0";
        });
        input.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') addAllSelectedToCart();
        });
        input.addEventListener('change', () => {
            updateSelectedProducts(product, parseInt(input.value) || 0, product.imageUrl, size);
        });

        sizeCol.append(label, input);
        sizeSelector.appendChild(sizeCol);
    });

    return sizeSelector;
}

// Create quantity input with event listeners
function createQuantityInput(product) {
    const quantityInput = document.createElement("input");
    quantityInput.type = "text";
    quantityInput.inputMode = "numeric";
    quantityInput.pattern = "[0-9]*";
    quantityInput.min = "0";
    quantityInput.value = "0";
    quantityInput.className = "quantity-input simplified";

    quantityInput.addEventListener('focus', () => {
        if (quantityInput.value === "0") {
            quantityInput.value = "";
        }
    });

    quantityInput.addEventListener('blur', () => {
        if (quantityInput.value === "") {
            quantityInput.value = "0";
        }
    });

    quantityInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            addAllSelectedToCart();
        }
    });
    
    quantityInput.addEventListener('change', () => {
        updateSelectedProducts(
            product, 
            parseInt(quantityInput.value) || 0, 
            product.imageUrl
        );
    });

    return quantityInput;
}

// Filter products by category and search query
function filterProducts(category) {
    currentCategorySelected = category;
    updateCategorySelection(category);

    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput?.value?.trim() || '';

    const filtered = applyFilters(category);
    displayProducts(searchQuery ? searchProducts(searchQuery, filtered) : filtered);
}

// Update category selection in UI
function updateCategorySelection(category) {
    const elements = [
        { selector: '#categoryFilter', prop: 'value' },
        { selector: '.category-item', className: 'active', dataProp: 'data-category' },
        { selector: '.category-button', className: 'active', dataProp: 'data-category' }
    ];

    elements.forEach(el => {
        const items = document.querySelectorAll(el.selector);
        items.forEach(item => {
            if (el.className) {
                item.classList.toggle(
                    el.className, 
                    el.dataProp ? item.getAttribute(el.dataProp) === category : false
                );
            }
            if (el.prop) {
                item[el.prop] = category;
            }
        });
    });
}

// Configure search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    if (searchInput) {
        const performSearch = (query) => {
            const filtered = applyFilters(currentCategorySelected);
            displayProducts(query ? searchProducts(query, filtered) : filtered);
        };
        
        searchInput.addEventListener('input', () => performSearch(searchInput.value.trim()));
        searchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                performSearch(searchInput.value.trim());
            }
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            if (searchInput) {
                performSearch(searchInput.value.trim());
            }
        });
    }
}

// Update selected products list
// size est stocké séparément (plus intégré dans le Nom)
function updateSelectedProducts(product, quantity, imageUrl, size = null) {
    quantity = parseInt(quantity) || 0;

    const existingProductIndex = selectedProducts.findIndex(item =>
        item.Nom === product.Nom && item.categorie === product.categorie && item.size === size
    );

    if (quantity <= 0) {
        if (existingProductIndex !== -1) {
            selectedProducts.splice(existingProductIndex, 1);
        }
    } else {
        if (existingProductIndex !== -1) {
            selectedProducts[existingProductIndex].quantity = quantity;
        } else {
            selectedProducts.push({
                ...product,
                Nom: product.Nom,
                size: size,
                quantity: quantity,
                imageUrl: imageUrl
            });
        }
    }

    updateFloatingButtonCounter();
}

// Update floating button counter
function updateFloatingButtonCounter() {
    const totalItems = selectedProducts.reduce((total, item) => total + item.quantity, 0);
    const counterElement = document.getElementById('floatingButtonCounter');
    
    if (counterElement) {
        counterElement.textContent = totalItems;
        counterElement.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

// Add all selected products to cart
async function addAllSelectedToCart() {
    if (selectedProducts.length === 0) {
        showNotification('Please select at least one product', 'info');
        return;
    }

    try {
        await Promise.all(selectedProducts.map(product => addCartItem(product, product.quantity)));
        const totalItems = selectedProducts.reduce((total, item) => total + item.quantity, 0);
        showNotification(`${totalItems} ${window.t ? window.t('cart.addedNotif') : 'items added to cart!'}`, 'success');
    } catch (e) {
        showNotification('Erreur lors de l\'ajout au panier', 'error');
    }

    resetAllQuantities();
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

// Reset all quantity inputs
function resetAllQuantities() {
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.value = "0";
    });
    
    selectedProducts = [];
    updateFloatingButtonCounter();
}

// Create floating add to cart button
function createFloatingButton() {
    if (document.getElementById('floatingAddToCartBtn')) return;
    
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'floatingAddToCartBtn';
    floatingBtn.className = 'floating-add-to-cart-btn';
    floatingBtn.innerHTML = `
        <span id="floatingButtonCounter" class="floating-button-counter">0</span>
        <i class="fas fa-shopping-cart"></i>
        Add to Cart
    `;
    
    floatingBtn.addEventListener('click', addAllSelectedToCart);
    document.body.appendChild(floatingBtn);
}

// Export necessary functions and variables
export {
    initCatalog,
    displayProducts,
    filterProducts,
    selectedProducts,
    addAllSelectedToCart
};