/**
 * Module de filtrage de produits
 * Gère les filtres de catégorie dans le catalogue
 */

/**
 * Initialise les filtres de catégorie
 * @param {Function} filterCallback - Fonction à appeler pour filtrer les produits
 */
export function initProductFilter(filterCallback) {
    // Initialiser le filtre de catégorie (menu déroulant)
    setupCategoryMenuItems(filterCallback);
    
    // Initialiser le filtre de catégorie (select caché)
    setupCategorySelect(filterCallback);
}

/**
 * Configure les éléments de catégorie dans le menu déroulant
 * @param {Function} filterCallback - Fonction à appeler pour filtrer les produits
 */
function setupCategoryMenuItems(filterCallback) {
    const categoryItems = document.querySelectorAll('.category-item');
    
    categoryItems.forEach(item => {
        item.addEventListener('click', function() {
            // Récupérer la catégorie sélectionnée
            const category = this.getAttribute('data-category');
            
            // Mettre à jour l'interface
            updateCategoryUI(category, categoryItems);
            
            // Appeler le callback pour filtrer les produits
            if (typeof filterCallback === 'function') {
                filterCallback(category);
            }
            
            // Fermer le menu après la sélection
            const dropdownMenu = document.getElementById('dropdownMenu');
            const menuOverlay = document.getElementById('menuOverlay');
            
            if (dropdownMenu) {
                dropdownMenu.classList.remove('open');
            }
            
            if (menuOverlay) {
                menuOverlay.classList.remove('active');
            }
        });
    });
}

/**
 * Configure le select caché pour compatibilité avec le code existant
 * @param {Function} filterCallback - Fonction à appeler pour filtrer les produits
 */
function setupCategorySelect(filterCallback) {
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            const category = this.value;
            
            // Mettre à jour l'interface
            updateCategoryUI(category);
            
            // Appeler le callback pour filtrer les produits
            if (typeof filterCallback === 'function') {
                filterCallback(category);
            }
        });
    }
}

/**
 * Met à jour l'interface utilisateur pour refléter la catégorie sélectionnée
 * @param {string} category - Catégorie sélectionnée
 * @param {NodeList} categoryItems - Éléments de catégorie dans le menu
 */
function updateCategoryUI(category, categoryItems = null) {
    // Mettre à jour le select caché
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.value = category;
    }
    
    // Mettre à jour les éléments du menu si fournis
    if (categoryItems) {
        categoryItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-category') === category) {
                item.classList.add('active');
            }
        });
    } else {
        // Sinon, chercher les éléments
        const items = document.querySelectorAll('.category-item');
        items.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-category') === category) {
                item.classList.add('active');
            }
        });
    }
    
    // Mettre à jour les boutons de catégorie dans la barre horizontale
    updateCategoryButtons(category);
}

/**
 * Récupère les catégories disponibles
 * @returns {Array} Liste des catégories
 */
export function getAvailableCategories() {
    return [
        { id: 'all', name: 'All Products' },
        { id: 'magnet', name: 'Magnets' },
        { id: 'keyring', name: 'Keyrings' },
        { id: 'bags', name: 'Bags & Totebags' },
        { id: 'gadget', name: 'Gadgets' },
        { id: 'patches', name: 'Patches' },
        { id: 'cloths', name: 'Cloths' },
        { id: 'plates', name: 'Plates' },
        { id: 'bells', name: 'Bells' },
        { id: 'lighter', name: 'Lighters' },
        { id: 'tshirt', name: 'T-Shirts' },
        { id: 'caps', name: 'Caps' },
        { id: 'hats', name: 'Hats' },
        { id: 'pens', name: 'Pens' },
        { id: 'softtoy', name: 'Soft Toys' }
    ];
}


/**
 * Récupère la catégorie actuellement sélectionnée
 * @returns {string} ID de la catégorie active
 */
export function getCurrentCategory() {
    // Vérifier le select caché d'abord
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        return categoryFilter.value;
    }
    
    // Sinon, vérifier les éléments du menu
    const activeItem = document.querySelector('.category-item.active');
    if (activeItem) {
        return activeItem.getAttribute('data-category');
    }
    
    // Par défaut, retourner "all"
    return 'all';
}

/**
 * NOUVELLE FONCTIONNALITÉ: Barre de catégories horizontale
 */

/**
 * Initialise la barre de catégories horizontale
 * @param {Function} filterCallback - Fonction optionnelle de filtrage à appeler (sera cherchée automatiquement si non fournie)
 */
export function initHorizontalCategories(filterCallback) {
    const categoriesBar = document.getElementById('categoriesBar');
    if (!categoriesBar) return;
    
    // Récupérer les catégories disponibles
    const categories = getAvailableCategories();
    
    // Si le callback de filtrage n'est pas fourni, essayer de le récupérer depuis le module de catalogue
    if (!filterCallback) {
        try {
            // Essayer d'importer dynamiquement le module de catalogue
            import('./productList.js')
                .then(module => {
                    if (module && typeof module.filterProducts === 'function') {
                        setupCategoryButtons(categories, categoriesBar, module.filterProducts);
                    } else {
                        // Fallback: utiliser la fonction de filtrage simple
                        setupCategoryButtons(categories, categoriesBar);
                    }
                })
                .catch(err => {
                    console.error('Erreur lors de l\'importation du module de catalogue:', err);
                    // Fallback: utiliser la fonction de filtrage simple
                    setupCategoryButtons(categories, categoriesBar);
                });
        } catch (err) {
            console.error('Erreur lors de la récupération de la fonction de filtrage:', err);
            // Fallback: utiliser la fonction de filtrage simple
            setupCategoryButtons(categories, categoriesBar);
        }
    } else {
        // Si le callback est fourni, l'utiliser directement
        setupCategoryButtons(categories, categoriesBar, filterCallback);
    }
}

/**
 * Configure les boutons de catégorie avec le gestionnaire d'événements approprié
 * @param {Array} categories - Les catégories à afficher
 * @param {HTMLElement} container - Le conteneur des boutons
 * @param {Function} filterCallback - Fonction à appeler pour filtrer les produits
 */
function setupCategoryButtons(categories, container, filterCallback) {
    // Vider le conteneur pour éviter les doublons
    container.innerHTML = '';
    
    // Créer les boutons de catégorie
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-button';
        button.setAttribute('data-category', category.id);
        button.textContent = category.name;
        
        // Définir l'état actif pour "All Products" par défaut
        if (category.id === 'all') {
            button.classList.add('active');
        }
        
        // Ajouter le gestionnaire de clic
        button.addEventListener('click', function() {
            const categoryId = category.id;
            
            // Mettre à jour l'interface visuelle des boutons
            document.querySelectorAll('.category-button').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Mettre à jour le select caché (pour compatibilité avec le code existant)
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) {
                categoryFilter.value = categoryId;
            }
            
            // Mettre à jour les éléments du menu si présents
            const categoryItems = document.querySelectorAll('.category-item');
            categoryItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-category') === categoryId) {
                    item.classList.add('active');
                }
            });
            
            // Appeler la fonction de filtrage si disponible
            if (typeof filterCallback === 'function') {
                filterCallback(categoryId);
            } else {
                // Fallback: déclencher l'événement change sur le select
                if (categoryFilter) {
                    const event = new Event('change');
                    categoryFilter.dispatchEvent(event);
                }
            }
        });
        
        container.appendChild(button);
    });
}

/**
 * Met à jour l'état visuel des boutons de catégorie
 * @param {string} categoryId - ID de la catégorie active
 */
function updateCategoryButtons(categoryId) {
    const buttons = document.querySelectorAll('.category-button');
    buttons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-category') === categoryId) {
            button.classList.add('active');
        }
    });
}