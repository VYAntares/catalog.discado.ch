// Search products with flexible matching
export function searchProducts(query, products) {
    if (!query || query.trim() === '') {
        return products;
    }
    
    const cleanQuery = cleanSearchQuery(query);
    
    return products.filter(product => {
        if (!product.Nom) return false;
        
        const cleanProductName = cleanSearchQuery(product.Nom);
        const cleanProductCategory = cleanSearchQuery(product.categorie || '');
        
        const queryWords = cleanQuery.split(' ');
        
        return queryWords.every(word => 
            cleanProductName.includes(word) || 
            cleanProductCategory.includes(word)
        );
    });
}

// Clean search query for flexible comparison
function cleanSearchQuery(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

// Highlight search terms in text
export function highlightSearchTerm(text, query) {
    if (!query || query.trim() === '' || !text) {
        return text;
    }
    
    const cleanQuery = cleanSearchQuery(query);
    const cleanText = text;
    
    const queryWords = cleanQuery.split(' ');
    const regex = new RegExp(`(${queryWords.join('|')})`, 'gi');
    
    return cleanText.replace(regex, '<mark>$1</mark>');
}

// Save search term to local storage history
export function saveSearchToHistory(query, maxHistory = 10) {
    if (!query || query.trim() === '') return;
    
    query = query.trim();
    
    const searchHistory = getSearchHistory();
    
    // Remove existing occurrence
    const filteredHistory = searchHistory.filter(item => item !== query);
    
    // Add new term to the beginning
    filteredHistory.unshift(query);
    
    // Limit history size
    const updatedHistory = filteredHistory.slice(0, maxHistory);
    
    try {
        localStorage.setItem('search_history', JSON.stringify(updatedHistory));
    } catch (e) {
        console.error('Error saving search history:', e);
    }
}

// Retrieve search history from local storage
export function getSearchHistory() {
    try {
        const storedHistory = localStorage.getItem('search_history');
        return storedHistory ? JSON.parse(storedHistory) : [];
    } catch (e) {
        console.error('Error loading search history:', e);
        return [];
    }
}

// Create debounced search function
export function debouncedSearch(callback, delay = 300) {
    let timeout;
    
    return function(query, products) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const results = searchProducts(query, products);
            callback(results, query);
        }, delay);
    };
}