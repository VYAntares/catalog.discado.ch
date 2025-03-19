/**
 * Module de catalogue de produits - Version modifiée pour limiter la recherche à la catégorie sélectionnée
 */

import { fetchProducts } from '../../core/api.js';
import { AppConfig } from '../../core/config.js';
import { showNotification } from '../../utils/notification.js';
import { addToCart, getCart, getCartItemCount } from '../../core/storage.js';
import { initImagePreview } from './imagePreview.js';
import { searchProducts } from './productSearch.js';
import { initProductFilter, getCurrentCategory } from './productFilter.js';
import { debouncedSearch } from './productSearch.js';

// Variable pour stocker tous les produits
let allProducts = [];
// Variable pour stocker les produits actuellement affichés
let displayedProducts = [];
// Tableau pour produits sélectionnés en quantité > 0
let selectedProducts = [];
// Variable pour stocker la catégorie actuelle
let currentCategorySelected = 'all';

/**
 * Initialise la page catalogue
 */
function initCatalog() {
    console.log('Initializing catalog module');
    
    // Créer le bouton flottant d'ajout au panier
    createFloatingButton();
    
    // Chargement initial des produits
    loadProducts().then(() => {
        // Initialiser la recherche après le chargement des produits
        setupSearch();
        
        // Initialiser les filtres de catégorie
        initProductFilter(filterProducts);
    });
}

/**
 * Charge les produits depuis l'API
 */
async function loadProducts() {
    try {
        // Récupérer le conteneur de produits
        const productList = document.getElementById('productList');
        
        // Afficher l'indicateur de chargement
        if (productList) {
            productList.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Loading products...</p>
                </div>
            `;
        }
        
        // Charger les produits
        allProducts = await fetchProducts();
        
        // Filtrer les produits invalides
        allProducts = allProducts.filter(p => p.Nom && p.Nom.trim() !== "");
        
        // Mettre à jour la liste des produits affichés
        displayedProducts = [...allProducts];
        
        // Afficher les produits
        displayProducts(allProducts);
        
        // Initialiser la prévisualisation d'image
        initImagePreview();
        
        return allProducts;
        
    } catch (error) {
        console.error("Error loading products:", error);
        
        // Afficher une erreur
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
        
        return [];
    }
}

/**
 * Filtre les produits par catégorie de manière cohérente
 * @param {Array} products - Produits à filtrer
 * @param {string} category - Catégorie à filtrer
 * @returns {Array} - Produits filtrés par catégorie
 */
function filterByCategory(products, category) {
    if (category === "all") {
        return products;
    }
    
    return products.filter(p => {
        // Vérifier si le produit a une catégorie
        if (!p.categorie) return false;
        
        // Comparaison insensible à la casse
        const productCategory = p.categorie.toLowerCase();
        const selectedCategory = category.toLowerCase();
        
        // Vérification avec plusieurs variantes possibles
        return (
            productCategory === selectedCategory ||
            productCategory === selectedCategory.replace('-', '') || // Gérer les tirets
            productCategory === selectedCategory.replace('_', '') || // Gérer les underscores
            productCategory.includes(selectedCategory) ||  // Gérer les sous-chaînes
            selectedCategory.includes(productCategory)     // Gérer quand la catégorie est plus spécifique
        );
    });
}

/**
 * Affiche les produits dans la liste
 * @param {Array} products - Liste des produits à afficher
 * @param {string} category - Catégorie à filtrer (ignorée car le filtrage est fait en amont)
 */
function displayProducts(products, category = null) {
    const list = document.getElementById("productList");
    if (!list) return;
    
    // Ajouter un console.log pour déboguer
    console.log("Catégorie sélectionnée:", category || currentCategorySelected);
    console.log("Exemple de produit:", products.length > 0 ? products[0] : null);
    
    // Mettre à jour les produits actuellement affichés
    displayedProducts = products;
    
    // Vérifier s'il y a des produits à afficher
    if (products.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No products found in this category</p>
            </div>
        `;
        return;
    }
    
    // Vider la liste
    list.innerHTML = "";

    // Créer un élément pour chaque produit
    products.forEach((product, index) => {
        // Valeurs par défaut si les propriétés sont manquantes
        const productName = product.Nom || "Product without name";
        const productPrice = product.prix || "0.00";
        const productCategory = product.categorie || "default";
        const productImage = product.imageUrl;

        // Créer un élément pour le produit
        const li = document.createElement("li");
        li.className = "product-item";
        li.setAttribute('data-product-id', product.id || index);

        // Image du produit
        const imgContainer = document.createElement("div");
        imgContainer.className = "product-img-container";
        
        const img = document.createElement("img");
        img.src = productImage;
        img.alt = productName;
        img.className = "product-img";
        
        imgContainer.appendChild(img);

        // Informations produit
        const infoContainer = document.createElement("div");
        infoContainer.className = "product-info";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = productName;
        nameSpan.className = "product-name";

        const priceSpan = document.createElement("span");
        priceSpan.textContent = `${productPrice} CHF`;
        priceSpan.className = "product-price";

        infoContainer.appendChild(nameSpan);
        infoContainer.appendChild(priceSpan);

        // Actions produit (quantité)
        const actionContainer = document.createElement("div");
        actionContainer.className = "product-actions";

        // Conteneur de quantité simplifié
        const quantityContainer = document.createElement("div");
        quantityContainer.className = "quantity-container";

        // Input pour la quantité
        const quantityInput = document.createElement("input");
        quantityInput.type = "text"; 
        quantityInput.inputMode = "numeric";
        quantityInput.pattern = "[0-9]*"; 
        quantityInput.min = "0";
        quantityInput.value = "0";
        quantityInput.className = "quantity-input simplified";

        // Effacer automatiquement le "0" lorsque l'utilisateur clique sur le champ
        quantityInput.addEventListener('focus', function() {
            if (this.value === "0") {
                this.value = "";
            }
        });

        // Remettre "0" si l'utilisateur quitte le champ sans rien saisir
        quantityInput.addEventListener('blur', function() {
            if (this.value === "") {
                this.value = "0";
            }
        });

        // Permettre l'ajout au panier avec Enter
        quantityInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                addAllSelectedToCart();
            }
        });
        
        // Mise à jour du tableau selectedProducts quand la quantité change
        quantityInput.addEventListener('change', function() {
            updateSelectedProducts(product, parseInt(this.value) || 0, productImage);
        });

        quantityContainer.appendChild(quantityInput);
        actionContainer.appendChild(quantityContainer);

        // Assembler tous les éléments
        li.appendChild(imgContainer);
        li.appendChild(infoContainer);
        li.appendChild(actionContainer);

        list.appendChild(li);
    });
    
    // Déclencher un événement indiquant que les produits ont été chargés
    document.dispatchEvent(new CustomEvent('productsLoaded'));
}

/**
 * Filtre les produits par catégorie - FONCTION MODIFIÉE
 * @param {string} category - Catégorie à filtrer
 */
function filterProducts(category) {
    // Stocker la catégorie actuelle
    currentCategorySelected = category;
    
    // Mettre à jour l'interface utilisateur
    updateCategorySelection(category);
    
    // Obtenir la valeur de la recherche actuelle
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput?.value?.trim() || '';
    
    // Filtrer d'abord par catégorie
    const categoryFiltered = filterByCategory(allProducts, category);
    
    // Si une recherche est active, filtrer les résultats de recherche
    if (searchQuery) {
        const searchResults = searchProducts(searchQuery, categoryFiltered);
        displayProducts(searchResults);
    } else {
        // Sinon, afficher tous les produits de la catégorie
        displayProducts(categoryFiltered);
    }
}

/**
 * Met à jour la sélection de catégorie dans l'interface
 * @param {string} category - Catégorie sélectionnée
 */
function updateCategorySelection(category) {
    // Mettre à jour le sélecteur caché
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.value = category;
    }
    
    // Mettre à jour les éléments de catégorie dans le menu
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-category') === category) {
            item.classList.add('active');
        }
    });
    
    // Mettre à jour les boutons de catégorie dans la barre horizontale
    const categoryButtons = document.querySelectorAll('.category-button');
    categoryButtons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-category') === category) {
            button.classList.add('active');
        }
    });
}

/**
 * Configure la recherche - VERSION CORRIGÉE AVEC RECHERCHE AUTOMATIQUE
 */
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    if (searchInput) {
        // Fonction de recherche qui respecte la catégorie actuelle
        const performSearch = function(query) {
            // Filtrer d'abord par catégorie
            const categoryFiltered = filterByCategory(allProducts, currentCategorySelected);
            
            // Ensuite, appliquer la recherche textuelle
            if (!query) {
                displayProducts(categoryFiltered);
            } else {
                const searchResults = searchProducts(query, categoryFiltered);
                displayProducts(searchResults);
            }
        };
        
        // Événement d'input pour une recherche réactive et automatique
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            performSearch(query);
        });
        
        // Événement pour la touche Entrée (pour compatibilité)
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                performSearch(this.value.trim());
            }
        });
    }
    
    // Bouton de recherche (pour compatibilité)
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            if (searchInput) {
                performSearch(searchInput.value.trim());
            }
        });
    }
}

/**
 * Mise à jour de la liste des produits sélectionnés
 * @param {Object} product - Produit
 * @param {number} quantity - Quantité
 * @param {string} imageUrl - URL de l'image
 */
function updateSelectedProducts(product, quantity, imageUrl) {
    // S'assurer que la quantité est un nombre, avec 0 comme valeur par défaut
    quantity = parseInt(quantity) || 0;
    
    // Vérifier si le produit est déjà dans le tableau
    const existingProductIndex = selectedProducts.findIndex(item => 
        item.Nom === product.Nom && item.categorie === product.categorie
    );
    
    if (quantity <= 0) {
        // Si la quantité est 0 ou négative, supprimer du tableau si présent
        if (existingProductIndex !== -1) {
            selectedProducts.splice(existingProductIndex, 1);
        }
    } else {
        if (existingProductIndex !== -1) {
            // Mettre à jour la quantité si le produit existe déjà
            selectedProducts[existingProductIndex].quantity = quantity;
        } else {
            // Ajouter le nouveau produit au tableau
            selectedProducts.push({
                ...product,
                quantity: quantity,
                imageUrl: imageUrl
            });
        }
    }
    
    // Mettre à jour le compteur sur le bouton flottant
    updateFloatingButtonCounter();
}

/**
 * Mettre à jour le compteur sur le bouton flottant
 */
function updateFloatingButtonCounter() {
    const totalItems = selectedProducts.reduce((total, item) => total + item.quantity, 0);
    const counterElement = document.getElementById('floatingButtonCounter');
    if (counterElement) {
        counterElement.textContent = totalItems;
        
        // Afficher ou masquer le compteur en fonction du nombre d'articles
        if (totalItems > 0) {
            counterElement.style.display = 'flex';
        } else {
            counterElement.style.display = 'none';
        }
    }
}

/**
 * Ajouter tous les produits sélectionnés au panier
 */
function addAllSelectedToCart() {
    if (selectedProducts.length === 0) {
        showNotification('Please select at least one product', 'info');
        return;
    }
    
    // Ajouter chaque produit sélectionné au panier
    selectedProducts.forEach(product => {
        addToCart(product, product.quantity);
    });
    
    // Afficher une notification
    const totalItems = selectedProducts.reduce((total, item) => total + item.quantity, 0);
    showNotification(`${totalItems} items added to cart!`, 'success');
    
    // Réinitialiser toutes les quantités à zéro
    resetAllQuantities();
    
    // Mettre à jour le compteur du panier dans le header
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

/**
 * Réinitialiser toutes les quantités à zéro
 */
function resetAllQuantities() {
    // Réinitialiser les champs d'entrée
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.value = "0";
    });
    
    // Vider le tableau des produits sélectionnés
    selectedProducts = [];
    
    // Mettre à jour le compteur sur le bouton flottant
    updateFloatingButtonCounter();
}

/**
 * Crée le bouton flottant d'ajout au panier
 */
function createFloatingButton() {
    // Vérifier si le bouton existe déjà
    if (document.getElementById('floatingAddToCartBtn')) return;
    
    // Créer le bouton flottant
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'floatingAddToCartBtn';
    floatingBtn.className = 'floating-add-to-cart-btn';
    floatingBtn.innerHTML = `
        <span id="floatingButtonCounter" class="floating-button-counter">0</span>
        <i class="fas fa-shopping-cart"></i>
        Add to Cart
    `;
    
    // Ajouter l'événement de clic
    floatingBtn.addEventListener('click', addAllSelectedToCart);
    
    // Ajouter le bouton au body
    document.body.appendChild(floatingBtn);
}

/**
 * Exporte les fonctions et variables nécessaires
 */
export {
    initCatalog,
    displayProducts,
    filterProducts,
    selectedProducts,
    addAllSelectedToCart
};