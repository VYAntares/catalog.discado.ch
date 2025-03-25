//public/js/utils/validation.js
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function isValidPhone(phone) {
    return /^\d{10}$/.test(phone);
}

export function isValidZipCode(zipCode) {
    return /^\d+$/.test(zipCode);
}

export function validateFormWithMessages(form, customMessages = {}) {
    let isValid = true;
    const fields = form.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
        if (field.type === 'hidden' || field.disabled) return;
        
        const fieldId = field.id || field.name;
        if (!fieldId) return;
        
        const isRequired = field.required;
        const isEmpty = !field.value.trim();
        
        let fieldIsValid = true;
        let errorMessage = '';
        
        if (isRequired && isEmpty) {
            fieldIsValid = false;
            errorMessage = customMessages[fieldId] || `${fieldId} is required.`;
        } else if (!isEmpty) {
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
        
        if (!fieldIsValid) {
            isValid = false;
            field.classList.add('input-error');
            
            if (typeof showErrorMessage === 'function') {
                showErrorMessage(field, errorMessage);
            } else {
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
            
            if (typeof removeErrorMessage === 'function') {
                removeErrorMessage(field);
            } else {
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

export function cleanNumericInput(input) {
    return input.replace(/[^0-9]/g, '');
}

function showErrorMessage(field, message) {
    removeErrorMessage(field);
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message visible';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
}

function removeErrorMessage(field) {
    const parent = field.parentNode;
    if (!parent) return;
    
    const errorElement = parent.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}