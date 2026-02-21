/**
 * Formatage des données (dates, prix, etc.)
 * admin/js/utils/formatter.js
 */

// Formate une date
function formatDate(dateString, options = {}) {
    if (!dateString) return 'N/A';
    
    try {
        const date = dateString instanceof Date ? dateString : new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return 'Date invalide';
        }
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        
        return date.toLocaleDateString('fr-FR', formatOptions);
    } catch (error) {
        return 'Erreur';
    }
}

// Formate un prix
function formatPrice(price, options = {}) {
    if (price === undefined || price === null) return 'N/A';

    try {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price;

        if (isNaN(numPrice)) {
            return 'Prix invalide';
        }

        const decimals = options.decimals !== undefined ? options.decimals : 2;

        return formatSwissNumber(numPrice, decimals);
    } catch (error) {
        return 'Erreur';
    }
}

// Formate un montant en devise CHF avec format suisse (apostrophe pour milliers)
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '0.00 CHF';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '0.00 CHF';
    return formatSwissNumber(numAmount) + ' CHF';
}

// Formate un nombre au format suisse (apostrophe pour milliers, point pour décimales)
// Ex: 21000.50 -> "21'000.50"
function formatSwissNumber(number, decimals = 2) {
    if (number === null || number === undefined) return '0.00';
    const num = typeof number === 'string' ? parseFloat(number) : number;
    if (isNaN(num)) return '0.00';

    const fixed = num.toFixed(decimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return parts.join('.');
}


// Formate un ID de commande
function formatOrderId(orderId) {
    if (!orderId) return 'N/A';
    
    if (orderId.startsWith('order_')) {
        return orderId.split('_').pop();
    }
    
    return orderId;
}

// Formate un nombre avec séparateurs de milliers
function formatNumber(number, options = {}) {
    if (number === undefined || number === null) return 'N/A';
    
    try {
        const num = typeof number === 'string' ? parseFloat(number) : number;
        
        if (isNaN(num)) {
            return 'Nombre invalide';
        }
        
        const locale = options.locale || 'fr-FR';
        const decimals = options.decimals !== undefined ? options.decimals : 0;
        
        return num.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    } catch (error) {
        return 'Erreur';
    }
}

// Tronque un texte à une longueur donnée
function truncateText(text, maxLength, suffix = '...') {
    if (!text) return '';
    
    if (text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength) + suffix;
}

// Formate un texte en titre (première lettre de chaque mot en majuscule)
function toTitleCase(text) {
    if (!text) return '';
    
    return text.toLowerCase().replace(/(?:^|\s)\w/g, match => {
        return match.toUpperCase();
    });
}

// Formate un numéro de téléphone
function formatPhone(phone, format = 'XX XXX XX XX') {
    if (!phone) return 'N/A';
    
    const digits = phone.replace(/\D/g, '');
    
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

export {
    formatDate,
    formatPrice,
    formatOrderId,
    formatNumber,
    truncateText,
    toTitleCase,
    formatPhone,
	formatCurrency,
    formatSwissNumber
};