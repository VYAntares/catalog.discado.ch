/**
 * Utilitaires de validation
 * Fournit des fonctions pour valider les entrées utilisateur
 */

/**
 * Valide une adresse email
 * @param {string} email - Adresse email à valider
 * @returns {boolean} True si l'email est valide
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valide un numéro de téléphone (format: 10 chiffres uniquement)
 * @param {string} phone - Numéro de téléphone à valider
 * @returns {boolean} True si le téléphone est valide
 */
export function isValidPhone(phone) {
    // Vérifier que le numéro ne contient que des chiffres et a exactement 10 chiffres
    return /^\d{10}$/.test(phone);
}

/**
 * Valide un code postal (uniquement des chiffres)
 * @param {string} zipCode - Code postal à valider
 * @returns {boolean} True si le code postal est valide
 */
export function isValidZipCode(zipCode) {
    // Vérifier que le code postal ne contient que des chiffres
    return /^\d+$/.test(zipCode);
}

/**
 * Valide un formulaire complet avec des messages personnalisés
 * @param {HTMLFormElement} form - Formulaire à valider
 * @param {Object} customMessages - Messages d'erreur par champ
 * @returns {boolean} True si le formulaire est valide
 */
export function validateFormWithMessages(form, customMessages = {}) {
    let isValid = true;
    const fields = form.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
        // Ignorer les champs masqués ou désactivés
        if (field.type === 'hidden' || field.disabled) return;
        
        // Récupérer l'ID ou le nom du champ
        const fieldId = field.id || field.name;
        if (!fieldId) return;
        
        // Vérifier si le champ est requis
        const isRequired = field.required;
        
        // Vérifier si le champ est vide
        const isEmpty = !field.value.trim();
        
        // Valider selon le type
        let fieldIsValid = true;
        let errorMessage = '';
        
        if (isRequired && isEmpty) {
            fieldIsValid = false;
            errorMessage = customMessages[fieldId] || `${fieldId} is required.`;
        } else if (!isEmpty) {
            // Validations spécifiques par type
            if (field.type === 'email' || fieldId === 'email') {
                if (!isValidEmail(field.value)) {
                    fieldIsValid = false;
                    errorMessage = customMessages.email || 'Please enter a valid email address.';
                }
            } else if (fieldId === 'phone' || fieldId.includes('phone')) {
                if (!isValidPhone(field.value)) {
                    fieldIsValid = false;
                    errorMessage = customMessages.phone || 'Please enter a valid phone number (10 digits only).';
                }
            } else if (fieldId === 'zipCode' || fieldId === 'postalCode' || fieldId === 'shopZipCode') {
                if (!isValidZipCode(field.value)) {
                    fieldIsValid = false;
                    errorMessage = customMessages.zipCode || customMessages.postalCode || customMessages.shopZipCode || 'Please enter a valid zip code (numbers only).';
                }
            }
        }
        
        // Appliquer le résultat de la validation
        if (!fieldIsValid) {
            isValid = false;
            field.classList.add('input-error');
            
            // Afficher le message d'erreur si possible
            if (typeof showErrorMessage === 'function') {
                showErrorMessage(field, errorMessage);
            } else {
                // Si la fonction n'est pas disponible, créer un message d'erreur
                const parent = field.parentNode;
                let errorElement = parent.querySelector('.error-message');
                
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.className = 'error-message visible';
                    parent.appendChild(errorElement);
                } else {
                    errorElement.classList.add('visible');
                }
                
                errorElement.textContent = errorMessage;
            }
        } else {
            field.classList.remove('input-error');
            
            // Supprimer le message d'erreur si possible
            if (typeof removeErrorMessage === 'function') {
                removeErrorMessage(field);
            } else {
                // Si la fonction n'est pas disponible, supprimer l'élément d'erreur
                const parent = field.parentNode;
                const errorElement = parent.querySelector('.error-message');
                if (errorElement) {
                    errorElement.remove();
                }
            }
        }
    });
    
    return isValid;
}

/**
 * Nettoie une entrée en ne gardant que les chiffres
 * @param {string} input - Entrée à nettoyer
 * @returns {string} Entrée avec uniquement des chiffres
 */
export function cleanNumericInput(input) {
    return input.replace(/[^0-9]/g, '');
}

/**
 * Facilité pour montrer un message d'erreur (utilisé par validateFormWithMessages)
 * @param {HTMLElement} field - Champ concerné
 * @param {string} message - Message d'erreur
 */
function showErrorMessage(field, message) {
    // Supprimer les messages d'erreur existants
    removeErrorMessage(field);
    
    // Créer le message d'erreur
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message visible';
    errorElement.textContent = message;
    
    // Ajouter le message après le champ
    field.parentNode.appendChild(errorElement);
}

/**
 * Facilité pour supprimer un message d'erreur (utilisé par validateFormWithMessages)
 * @param {HTMLElement} field - Champ concerné
 */
function removeErrorMessage(field) {
    const parent = field.parentNode;
    if (!parent) return;
    
    const errorElement = parent.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}