/**
 * Application Configuration
 * Global configuration settings for the application
 */

export const AppConfig = {
    // API configuration
    API_BASE_URL: '',
    API_TIMEOUT: 30000,
    
    // Cart configuration
    MAX_CART_QUANTITY: 9999999,
    
    // UI configuration
    NOTIFICATION_DURATION: 3000,
    IMAGE_PREVIEW_ENABLED: true,
    
    // Storage keys
    STORAGE_KEYS: {
        CART: 'discado_cart',
        USER_SETTINGS: 'discado_settings',
        AUTH_TOKEN: 'discado_auth',
        SEARCH_HISTORY: 'discado_search_history'
    },
    
    // Product categories
    PRODUCT_CATEGORIES: [
        { id: 'all', name: 'All Products' },
        { id: 'magnet', name: 'Magnets' },
        { id: 'keyring', name: 'Keyrings' },
        { id: 'pens', name: 'Pens' },
        { id: 'bags', name: 'Bags' },
        { id: 'hats', name: 'Hats' },
        { id: 'caps', name: 'Caps' },
        { id: 'bells', name: 'Bells' },
        { id: 'softtoy', name: 'Soft-Toys' },
        { id: 'tshirt', name: 'T-Shirts' },
        { id: 'lighter', name: 'Lighters' },
        { id: 'gadget', name: 'Gadgets' }
    ]
};

export default AppConfig;