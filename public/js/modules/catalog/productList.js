//public/js/modules/catalog/productList.js
import { fetchProducts } from '../../core/api.js';
import { addToCart } from '../../core/storage.js';
import { showNotification } from '../../utils/notification.js';
import { initImagePreview } from './imagePreview.js';
import { searchProducts } from './productSearch.js';
import { initProductFilter, getCurrentCategory } from './productFilter.js';

// State management
let allProducts = [];
let displayedProducts = [];
let selectedProducts = [];
let currentCategorySelected = 'all';

// Initialize catalog page
function initCatalog() {
    createFloatingButton();
    
    loadProducts().then(() => {
        setupSearch();
        initProductFilter(filterProducts);
    });
}

// Fetch and load products from API
async function loadProducts() {
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
        
        displayedProducts = [...allProducts];
        displayProducts(allProducts);
        
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

// Display products in the list
function displayProducts(products) {
    const list = document.getElementById("productList");
    if (!list) return;
    
    displayedProducts = products;
    
    if (products.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No products found in this category</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = "";

    products.forEach((product, index) => {
        const li = createProductElement(product, index);
        list.appendChild(li);
    });
    
    document.dispatchEvent(new CustomEvent('productsLoaded'));
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

    const nameSpan = document.createElement("span");
    nameSpan.textContent = product.Nom || "Product without name";
    nameSpan.className = "product-name";

    const priceSpan = document.createElement("span");
    priceSpan.textContent = `${product.prix || "0.00"} CHF`;
    priceSpan.className = "product-price";

    infoContainer.append(nameSpan, priceSpan);
    return infoContainer;
}

// Create product action container with quantity input
function createActionContainer(product) {
    const actionContainer = document.createElement("div");
    actionContainer.className = "product-actions";

    const quantityContainer = document.createElement("div");
    quantityContainer.className = "quantity-container";

    const quantityInput = createQuantityInput(product);
    
    quantityContainer.appendChild(quantityInput);
    actionContainer.appendChild(quantityContainer);

    return actionContainer;
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
    
    const categoryFiltered = filterByCategory(allProducts, category);
    
    if (searchQuery) {
        const searchResults = searchProducts(searchQuery, categoryFiltered);
        displayProducts(searchResults);
    } else {
        displayProducts(categoryFiltered);
    }
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
            const categoryFiltered = filterByCategory(allProducts, currentCategorySelected);
            
            if (!query) {
                displayProducts(categoryFiltered);
            } else {
                const searchResults = searchProducts(query, categoryFiltered);
                displayProducts(searchResults);
            }
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
function updateSelectedProducts(product, quantity, imageUrl) {
    quantity = parseInt(quantity) || 0;
    
    const existingProductIndex = selectedProducts.findIndex(item => 
        item.Nom === product.Nom && item.categorie === product.categorie
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
function addAllSelectedToCart() {
    if (selectedProducts.length === 0) {
        showNotification('Please select at least one product', 'info');
        return;
    }
    
    selectedProducts.forEach(product => {
        addToCart(product, product.quantity);
    });
    
    const totalItems = selectedProducts.reduce((total, item) => total + item.quantity, 0);
    showNotification(`${totalItems} items added to cart!`, 'success');
    
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