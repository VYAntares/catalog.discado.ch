/**
 * Formatage des données (dates, prix, etc.)
 * Ce module offre des fonctions utilitaires pour formater différents types de données
 */

/**
 * Formate une date
 * @param {string|Date} dateString - Date à formater
 * @param {Object} options - Options de formatage
 * @returns {string} Date formatée
 */
function formatDate(dateString, options = {}) {
    if (!dateString) return 'N/A';
    
    try {
        const date = dateString instanceof Date ? dateString : new Date(dateString);
        
        // Vérifier si la date est valide
        if (isNaN(date.getTime())) {
            return 'Date invalide';
        }
        
        // Options de formatage par défaut
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        // Fusionner les options
        const formatOptions = { ...defaultOptions, ...options };
        
        // Utiliser l'API Intl pour le formatage
        return date.toLocaleDateString('fr-FR', formatOptions);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Erreur';
    }
}

/**
 * Formate un prix
 * @param {number|string} price - Prix à formater
 * @param {Object} options - Options de formatage
 * @param {string} options.currency - Code de devise (défaut: CHF)
 * @param {number} options.decimals - Nombre de décimales (défaut: 2)
 * @returns {string} Prix formaté
 */
function formatPrice(price, options = {}) {
    if (price === undefined || price === null) return 'N/A';
    
    try {
        // Convertir en nombre
        const numPrice = typeof price === 'string' ? parseFloat(price) : price;
        
        // Vérifier si le prix est un nombre valide
        if (isNaN(numPrice)) {
            return 'Prix invalide';
        }
        
        // Options par défaut
        const currency = options.currency || 'CHF';
        const decimals = options.decimals !== undefined ? options.decimals : 2;
        
        // Formater le prix
        return numPrice.toFixed(decimals);
    } catch (error) {
        console.error('Error formatting price:', error);
        return 'Erreur';
    }
}

/**
 * Formate un ID de commande
 * @param {string} orderId - ID de commande à formater
 * @returns {string} ID formaté
 */
function formatOrderId(orderId) {
    if (!orderId) return 'N/A';
    
    // Exemple: "order_1234567890" -> "1234567890"
    if (orderId.startsWith('order_')) {
        return orderId.split('_').pop();
    }
    
    return orderId;
}

/**
 * Formate un nombre avec séparateurs de milliers
 * @param {number|string} number - Nombre à formater
 * @param {Object} options - Options de formatage
 * @param {string} options.locale - Locale à utiliser (défaut: fr-FR)
 * @param {number} options.decimals - Nombre de décimales (défaut: 0)
 * @returns {string} Nombre formaté
 */
function formatNumber(number, options = {}) {
    if (number === undefined || number === null) return 'N/A';
    
    try {
        // Convertir en nombre
        const num = typeof number === 'string' ? parseFloat(number) : number;
        
        // Vérifier si le nombre est valide
        if (isNaN(num)) {
            return 'Nombre invalide';
        }
        
        // Options par défaut
        const locale = options.locale || 'fr-FR';
        const decimals = options.decimals !== undefined ? options.decimals : 0;
        
        // Formater le nombre
        return num.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    } catch (error) {
        console.error('Error formatting number:', error);
        return 'Erreur';
    }
}

/**
 * Tronque un texte à une longueur donnée
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @param {string} suffix - Suffixe à ajouter (défaut: ...)
 * @returns {string} Texte tronqué
 */
function truncateText(text, maxLength, suffix = '...') {
    if (!text) return '';
    
    if (text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength) + suffix;
}

/**
 * Formate un texte en titre (première lettre de chaque mot en majuscule)
 * @param {string} text - Texte à formater
 * @returns {string} Texte formaté
 */
function toTitleCase(text) {
    if (!text) return '';
    
    return text.toLowerCase().replace(/(?:^|\s)\w/g, match => {
        return match.toUpperCase();
    });
}

/**
 * Formate un numéro de téléphone
 * @param {string} phone - Numéro de téléphone
 * @param {string} format - Format à appliquer (défaut: XX XXX XX XX)
 * @returns {string} Numéro formaté
 */
function formatPhone(phone, format = 'XX XXX XX XX') {
    if (!phone) return 'N/A';
    
    // Nettoyer le numéro (garder uniquement les chiffres)
    const digits = phone.replace(/\D/g, '');
    
    // Formater selon le motif
    let formatted = '';
    let digitIndex = 0;
    
    for (let i = 0; i < format.length; i++) {
        if (format[i] === 'X') {
            if (digitIndex < digits.length) {
                formatted += digits[digitIndex];
                digitIndex++;
            } else {
                formatted += 'X';
            }
        } else {
            formatted += format[i];
        }
    }
    
    return formatted;
}

// Exposer les fonctions publiques
export {
    formatDate,
    formatPrice,
    formatOrderId,
    formatNumber,
    truncateText,
    toTitleCase,
    formatPhone
};