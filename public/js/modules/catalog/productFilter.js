//public/js/modules/catalog/productFilter.js

// Initialize product category filtering across different UI components
export function initProductFilter(filterCallback) {
    setupCategoryMenuItems(filterCallback);
    setupCategorySelect(filterCallback);
}

// Configure dropdown menu category selection
function setupCategoryMenuItems(filterCallback) {
    const categoryItems = document.querySelectorAll('.category-item');
    
    categoryItems.forEach(item => {
        item.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            updateCategoryUI(category, categoryItems);
            
            if (typeof filterCallback === 'function') {
                filterCallback(category);
            }
            
            // Close dropdown menu
            const dropdownMenu = document.getElementById('dropdownMenu');
            const menuOverlay = document.getElementById('menuOverlay');
            
            if (dropdownMenu) dropdownMenu.classList.remove('open');
            if (menuOverlay) menuOverlay.classList.remove('active');
        });
    });
}

// Setup hidden select for cross-browser and legacy compatibility
function setupCategorySelect(filterCallback) {
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            const category = this.value;
            
            updateCategoryUI(category);
            
            if (typeof filterCallback === 'function') {
                filterCallback(category);
            }
        });
    }
}

// Update UI to reflect selected category across different components
function updateCategoryUI(category, categoryItems = null) {
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.value = category;
    }
    
    // Update menu items
    const items = categoryItems || document.querySelectorAll('.category-item');
    items.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-category') === category);
    });
    
    updateCategoryButtons(category);
}

// List of available product categories
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
        { id: 'softtoy', name: 'Soft Toys' },
        { id: 'farceattrape', name: 'Farce & Attrape' }

    ];
}

// Get the currently selected product category
export function getCurrentCategory() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) return categoryFilter.value;
    
    const activeItem = document.querySelector('.category-item.active');
    if (activeItem) return activeItem.getAttribute('data-category');
    
    return 'all';
}

// Initialize horizontal category bar with dynamic filtering
export function initHorizontalCategories(filterCallback) {
    const categoriesBar = document.getElementById('categoriesBar');
    if (!categoriesBar) return;
    
    const categories = getAvailableCategories();
    
    if (!filterCallback) {
        try {
            import('./productList.js')
                .then(module => {
                    const filter = module.filterProducts || null;
                    setupCategoryButtons(categories, categoriesBar, filter);
                })
                .catch(() => setupCategoryButtons(categories, categoriesBar));
        } catch {
            setupCategoryButtons(categories, categoriesBar);
        }
    } else {
        setupCategoryButtons(categories, categoriesBar, filterCallback);
    }
}

// Create and configure category buttons for horizontal bar
function setupCategoryButtons(categories, container, filterCallback) {
    container.innerHTML = '';
    
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-button';
        button.setAttribute('data-category', category.id);
        button.textContent = category.name;
        
        // Default 'All Products' as active
        if (category.id === 'all') {
            button.classList.add('active');
        }
        
        button.addEventListener('click', function() {
            const categoryId = category.id;
            
            // Update button states
            document.querySelectorAll('.category-button').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Update hidden select
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) {
                categoryFilter.value = categoryId;
            }
            
            // Update menu items
            const categoryItems = document.querySelectorAll('.category-item');
            categoryItems.forEach(item => {
                item.classList.toggle('active', item.getAttribute('data-category') === categoryId);
            });
            
            // Apply filtering
            if (typeof filterCallback === 'function') {
                filterCallback(categoryId);
            } else if (categoryFilter) {
                const event = new Event('change');
                categoryFilter.dispatchEvent(event);
            }
        });
        
        container.appendChild(button);
    });
}

// Update category button visual state
function updateCategoryButtons(categoryId) {
    const buttons = document.querySelectorAll('.category-button');
    buttons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-category') === categoryId);
    });
}