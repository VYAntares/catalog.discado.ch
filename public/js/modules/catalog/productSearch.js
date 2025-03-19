/**
 * Module de recherche de produits
 * Gère les fonctionnalités de recherche dans le catalogue
 */

/**
 * Effectue une recherche dans la liste des produits avec une correspondance flexible
 * @param {string} query - Terme de recherche
 * @param {Array} products - Liste des produits dans laquelle chercher
 * @returns {Array} Produits correspondant à la recherche
 */
export function searchProducts(query, products) {
    if (!query || query.trim() === '') {
        return products; // Retourne tous les produits si la recherche est vide
    }
    
    // Nettoyer et préparer la requête de recherche
    const cleanQuery = cleanSearchQuery(query);
    
    return products.filter(product => {
        // Vérifier si le produit a un nom valide
        if (!product.Nom) return false;
        
        // Nettoyer le nom du produit
        const cleanProductName = cleanSearchQuery(product.Nom);
        const cleanProductCategory = cleanSearchQuery(product.categorie || '');
        
        // Séparer les mots de la requête et du produit
        const queryWords = cleanQuery.split(' ');
        const productNameWords = cleanProductName.split(' ');
        
        // Vérifier si tous les mots de la requête sont présents
        return queryWords.every(word => 
            cleanProductName.includes(word) || 
            cleanProductCategory.includes(word)
        );
    });
}

/**
 * Nettoie une chaîne de recherche pour une comparaison flexible
 * @param {string} text - Texte à nettoyer
 * @returns {string} Texte nettoyé
 */
function cleanSearchQuery(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()           // Convertir en minuscules
        .normalize('NFD')         // Décomposer les caractères accentués
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/[^a-z0-9\s]/g, '') // Supprimer les caractères spéciaux
        .trim();                  // Supprimer les espaces en début et fin
}

/**
 * Crée une mise en évidence des termes de recherche dans le texte
 * @param {string} text - Texte original
 * @param {string} query - Terme de recherche
 * @returns {string} Texte avec mise en évidence HTML
 */
export function highlightSearchTerm(text, query) {
    if (!query || query.trim() === '' || !text) {
        return text;
    }
    
    // Nettoyer la requête et le texte
    const cleanQuery = cleanSearchQuery(query);
    const cleanText = text;
    
    // Créer une expression régulière flexible
    const queryWords = cleanQuery.split(' ');
    const regex = new RegExp(`(${queryWords.join('|')})`, 'gi');
    
    return cleanText.replace(regex, '<mark>$1</mark>');
}

/**
 * Sauvegarde un terme de recherche dans l'historique
 * @param {string} query - Terme de recherche
 * @param {number} maxHistory - Nombre maximum d'éléments à conserver
 */
export function saveSearchToHistory(query, maxHistory = 10) {
    if (!query || query.trim() === '') return;
    
    query = query.trim();
    
    // Récupérer l'historique existant
    let searchHistory = [];
    try {
        const storedHistory = localStorage.getItem('search_history');
        if (storedHistory) {
            searchHistory = JSON.parse(storedHistory);
        }
    } catch (e) {
        console.error('Error loading search history:', e);
        searchHistory = [];
    }
    
    // Vérifier si le terme existe déjà
    const existingIndex = searchHistory.indexOf(query);
    if (existingIndex !== -1) {
        // Supprimer l'occurrence existante
        searchHistory.splice(existingIndex, 1);
    }
    
    // Ajouter le nouveau terme au début
    searchHistory.unshift(query);
    
    // Limiter la taille de l'historique
    if (searchHistory.length > maxHistory) {
        searchHistory = searchHistory.slice(0, maxHistory);
    }
    
    // Sauvegarder l'historique mis à jour
    try {
        localStorage.setItem('search_history', JSON.stringify(searchHistory));
    } catch (e) {
        console.error('Error saving search history:', e);
    }
}

/**
 * Récupère l'historique des recherches
 * @returns {Array} Liste des termes de recherche récents
 */
export function getSearchHistory() {
    try {
        const storedHistory = localStorage.getItem('search_history');
        if (storedHistory) {
            return JSON.parse(storedHistory);
        }
    } catch (e) {
        console.error('Error loading search history:', e);
    }
    
    return [];
}

/**
 * Effectue une recherche avec debounce pour optimiser les performances
 * @param {Function} callback - Fonction à appeler avec les résultats
 * @param {number} delay - Délai en ms avant d'effectuer la recherche
 * @returns {Function} Fonction de recherche avec debounce
 */
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