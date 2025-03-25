// public/js/utils/formatter.js

export function formatDate(dateString, options = {}) {
    if (!dateString) return 'N/A';
    
    try {
        const date = dateString instanceof Date ? dateString : new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        
        return date.toLocaleDateString('en-US', formatOptions);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Error';
    }
}

export function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    return formatDate(dateString, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatPrice(price, options = {}) {
    if (price === undefined || price === null) return 'N/A';
    
    try {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price;
        
        if (isNaN(numPrice)) {
            return 'Invalid price';
        }
        
        const currency = options.currency || 'CHF';
        const decimals = options.decimals !== undefined ? options.decimals : 2;
        
        return numPrice.toFixed(decimals);
    } catch (error) {
        console.error('Error formatting price:', error);
        return 'Error';
    }
}

export function formatNumber(number, options = {}) {
    if (number === undefined || number === null) return 'N/A';
    
    try {
        const num = typeof number === 'string' ? parseFloat(number) : number;
        
        if (isNaN(num)) {
            return 'Invalid number';
        }
        
        const locale = options.locale || 'en-US';
        const decimals = options.decimals !== undefined ? options.decimals : 0;
        
        return num.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    } catch (error) {
        console.error('Error formatting number:', error);
        return 'Error';
    }
}

export function truncateText(text, maxLength, suffix = '...') {
    if (!text) return '';
    
    if (text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength) + suffix;
}

export function toTitleCase(text) {
    if (!text) return '';
    
    return text.toLowerCase().replace(/(?:^|\s)\w/g, match => {
        return match.toUpperCase();
    });
}

export function formatPhone(phone, format = 'XX XXX XX XX') {
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

export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}