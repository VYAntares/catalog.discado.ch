/**
 * Password management module for Discado
 * Located at: public/js/modules/profile/passwordManager.js
 */

import { saveUserPassword } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';

/**
 * Checks password match
 * Improved version without error messages during input
 * @param {boolean} shouldShowError - If true, displays an error message
 * @returns {boolean} - true if passwords match
 */
function checkPasswordMatch(shouldShowError = false) {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const confirmField = document.getElementById('confirmPassword');
    const submitButton = document.querySelector('.save-btn');
    
    if (!confirmField) return false;
    
    // If the field is empty, do nothing
    if (!confirmPass) {
        confirmField.classList.remove('password-match', 'password-mismatch', 'input-error');
        removeErrorMessage(confirmField);
        return false;
    }
    
    const isMatch = newPass === confirmPass;
    
    if (isMatch) {
        // Match: display in green
        confirmField.classList.add('password-match');
        confirmField.classList.remove('password-mismatch', 'input-error');
        removeErrorMessage(confirmField);
        
        // Allow submission if validation passed
        if (submitButton) {
            submitButton.classList.remove('disabled-submit');
        }
    } else {
        // Mismatch: display in red but without error message
        confirmField.classList.add('password-mismatch');
        confirmField.classList.remove('password-match');
        
        // Add input-error class and message only if requested
        // (typically on blur or submission)
        if (shouldShowError) {
            confirmField.classList.add('input-error');
            showErrorMessage(confirmField, 'Passwords do not match');
            
            // Block submission if passwords don't match
            if (submitButton) {
                submitButton.classList.add('disabled-submit');
            }
        }
    }
    
    return isMatch;
}

/**
 * Initializes the password manager with the new logic
 */
function initPasswordManager() {
    // Initialize interface elements
    const passwordFields = {
        current: document.getElementById('currentPassword'),
        new: document.getElementById('newPassword'),
        confirm: document.getElementById('confirmPassword')
    };
    
    // Check that elements exist
    if (!passwordFields.current || !passwordFields.new || !passwordFields.confirm) {
        console.error('Password fields not found');
        return;
    }
    
    // Add show/hide password toggle buttons
    Object.values(passwordFields).forEach(field => {
        if (!field) return;
        
        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'password-toggle';
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        toggleBtn.title = 'Show/Hide password';
        
        // Add button next to the field
        field.parentNode.style.position = 'relative';
        field.parentNode.appendChild(toggleBtn);
        
        // Toggle functionality
        toggleBtn.addEventListener('click', () => {
            if (field.type === 'password') {
                field.type = 'text';
                toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                field.type = 'password';
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });
    
    // Real-time password validation
    if (passwordFields.new) {
        passwordFields.new.addEventListener('input', function() {
            const password = this.value;
            validatePasswordStrength(password);
            
            // Check match if confirm field is filled
            // but without showing error message during input
            if (passwordFields.confirm && passwordFields.confirm.value) {
                checkPasswordMatch(false);
            }
        });
        
        // When user leaves the field, show errors if needed
        passwordFields.new.addEventListener('blur', function() {
            if (this.value && passwordFields.confirm && passwordFields.confirm.value) {
                checkPasswordMatch(true);
            }
        });
    }
    
    // Validate password match without error message during input
    if (passwordFields.confirm) {
        passwordFields.confirm.addEventListener('input', function() {
            checkPasswordMatch(false);
        });
        
        // Show error message only when user leaves the field
        passwordFields.confirm.addEventListener('blur', function() {
            if (this.value) {
                checkPasswordMatch(true);
            }
        });
    }
    
    // Clear error messages during input
    if (passwordFields.current) {
        passwordFields.current.addEventListener('input', function() {
            this.classList.remove('input-error');
            removeErrorMessage(this);
        });
    }
    
    initPasswordValidationWithSubmitControl();
    console.log('Password manager initialized successfully');
}

/**
 * Updates the password strength indicator
 * @param {number} score - Strength score (0-100)
 */
function updateStrengthMeter(score) {
    const strengthBar = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    
    if (!strengthBar || !strengthText) return;
    
    // Reset classes
    strengthBar.className = 'strength-indicator';
    
    if (score === 0) {
        strengthText.textContent = 'Password strength';
        return;
    }
    
    // Add appropriate class
    if (score < 40) {
        strengthBar.classList.add('strength-weak');
        strengthText.textContent = 'Weak password';
    } else if (score < 70) {
        strengthBar.classList.add('strength-fair');
        strengthText.textContent = 'Fair password';
    } else if (score < 90) {
        strengthBar.classList.add('strength-good');
        strengthText.textContent = 'Good password';
    } else {
        strengthBar.classList.add('strength-strong');
        strengthText.textContent = 'Strong password';
    }
    
    // Set bar width
    strengthBar.style.width = score + '%';
}

/**
 * Updates the password requirements indicators
 * @param {Object} criteria - Validated or not validated criteria
 */
function updateRequirements(criteria) {
    const requirements = {
        length: document.getElementById('req-length'),
        uppercase: document.getElementById('req-uppercase'),
        lowercase: document.getElementById('req-lowercase'),
        number: document.getElementById('req-number'),
        special: document.getElementById('req-special')
    };
    
    Object.keys(requirements).forEach(key => {
        const element = requirements[key];
        if (!element) return;
        
        if (criteria[key]) {
            element.classList.add('valid');
        } else {
            element.classList.remove('valid');
        }
    });
}

/**
 * Displays an error message below a field
 * @param {HTMLElement} field - The targeted field
 * @param {string} message - The error message
 */
function showErrorMessage(field, message) {
    removeErrorMessage(field);
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message visible';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
}

/**
 * Removes the error message from a field
 * @param {HTMLElement} field - The targeted field
 */
function removeErrorMessage(field) {
    const errorElement = field.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Checks if all password fields are valid
 * This function can be called from anywhere to check the current state
 * @returns {boolean} - true if passwords are valid for submission
 */
function arePasswordsValid() {
    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    
    // If no field is filled, everything is valid (no password change)
    if (!currentPassword && !newPassword && !confirmPassword) {
        return true;
    }
    
    // If one field is filled, all must be filled
    if ((currentPassword || newPassword || confirmPassword) && 
        !(currentPassword && newPassword && confirmPassword)) {
        return false;
    }
    
    // Check password strength
    const isStrong = validatePasswordStrength(newPassword);
    if (!isStrong) {
        return false;
    }
    
    // Check match
    return newPassword === confirmPassword;
}

/**
 * Validates password strength and updates visual indicators
 * Improved version that doesn't show error messages during input
 * @param {string} password - The password to validate
 * @param {boolean} showError - If true, displays an error message
 * @returns {boolean} - true if the password meets all criteria
 */
function validatePasswordStrength(password, showError = false) {
    const strengthBar = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    const submitButton = document.querySelector('.save-btn');
    
    if (!password) {
        updateStrengthMeter(0);
        updateRequirements({});
        return false;
    }
    
    // Validation criteria
    const criteria = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    // Update visual indicators
    updateRequirements(criteria);
    
    // Calculate score (0-100)
    let score = 0;
    if (criteria.length) score += 20;
    if (criteria.uppercase) score += 20;
    if (criteria.lowercase) score += 15;
    if (criteria.number) score += 20;
    if (criteria.special) score += 25;
    
    updateStrengthMeter(score);
    
    // Validate field if all criteria are met
    const isValid = Object.values(criteria).every(v => v);
    const passwordField = document.getElementById('newPassword');
    
    if (passwordField) {
        if (isValid) {
             // Remove error classes
             passwordField.classList.remove('input-error');
             passwordField.classList.remove('required-field');
             // Add validation class if needed
             passwordField.classList.add('valid-input');
             removeErrorMessage(passwordField);
        } else if (password.length > 0 && showError) {
            // Show error only if requested (e.g., after blur)
            passwordField.classList.add('input-error');
            showErrorMessage(passwordField, 'Password does not meet all requirements');
            
            // Disable button if password is not valid
            if (submitButton) {
                submitButton.classList.add('disabled-submit');
            }
        }
    }
    
    // If password validation changed and there's a confirmation, check without error message
    const confirmPassword = document.getElementById('confirmPassword');
    if (confirmPassword && confirmPassword.value) {
        checkPasswordMatch(false);
    }
    
    return isValid;
}

/**
 * Strictly validates the password section
 * @returns {boolean} - True if validation passed or no change requested
 */
function validatePasswordSection() {
    const result = validatePasswordInputs();
    
    // If validation failed, explicitly block submission
    if (!result.isValid) {
        const submitButton = document.querySelector('.save-btn');
        if (submitButton) {
            submitButton.classList.add('disabled-submit');
        }
    }
    
    return result.isValid;
}

/**
 * Initializes event listeners for real-time validation
 * of password fields with submit button control
 */
function initPasswordValidationWithSubmitControl() {
    const passwordFields = {
        current: document.getElementById('currentPassword'),
        new: document.getElementById('newPassword'),
        confirm: document.getElementById('confirmPassword')
    };
    
    const submitButton = document.querySelector('.save-btn');
    if (!submitButton) return;
    
    // Common function to validate and update button state
    function validateAndUpdateButton() {
        const isValid = arePasswordsValid();
        
        if (isValid) {
            submitButton.classList.remove('disabled-submit');
            submitButton.title = '';
        } else {
            // Only disable button if password fields are filled
            const anyPasswordFilled = 
                (passwordFields.current && passwordFields.current.value) ||
                (passwordFields.new && passwordFields.new.value) ||
                (passwordFields.confirm && passwordFields.confirm.value);
            
            if (anyPasswordFilled) {
                submitButton.classList.add('disabled-submit');
                submitButton.title = 'Please fill in all password fields correctly';
            }
        }
    }
    
    // Attach listeners to fields
    Object.values(passwordFields).forEach(field => {
        if (!field) return;
        
        field.addEventListener('input', validateAndUpdateButton);
        field.addEventListener('blur', validateAndUpdateButton);
    });
    
    // Initial validation
    validateAndUpdateButton();
}

/**
 * Checks if password inputs are valid
 * @returns {Object} - Validation result
 */
function validatePasswordInputs() {
    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    
    // If no field is filled, no change requested
    if (!currentPassword && !newPassword && !confirmPassword) {
        return {
            isValid: true,
            shouldUpdate: false,
            data: null
        };
    }
    
    // If one field is filled, all are required
    if ((currentPassword || newPassword || confirmPassword) && 
        !(currentPassword && newPassword && confirmPassword)) {
        
        if (!currentPassword) {
            const field = document.getElementById('currentPassword');
            if (field) {
                field.classList.add('input-error');
                showErrorMessage(field, 'Current password is required to change password');
            }
        }
        
        if (!newPassword) {
            const field = document.getElementById('newPassword');
            if (field) {
                field.classList.add('input-error');
                showErrorMessage(field, 'New password is required');
            }
        }
        
        if (!confirmPassword) {
            const field = document.getElementById('confirmPassword');
            if (field) {
                field.classList.add('input-error');
                showErrorMessage(field, 'Please confirm your new password');
            }
        }
        
        return {
            isValid: false,
            shouldUpdate: false,
            data: null
        };
    }
    
    // Validate password strength
    const isStrong = validatePasswordStrength(newPassword);
    if (!isStrong) {
        return {
            isValid: false,
            shouldUpdate: false,
            data: null
        };
    }
    
    // Check that passwords match
    const isMatch = checkPasswordMatch();
    if (!isMatch) {
        return {
            isValid: false,
            shouldUpdate: false,
            data: null
        };
    }
    
    // Everything is valid, prepare data
    return {
        isValid: true,
        shouldUpdate: true,
        data: {
            currentPassword,
            newPassword
        }
    };
}

/**
 * Handles password change
 * Improved version for better error handling
 * @returns {Promise<boolean>} - True if change succeeded or no change requested
 */
async function handlePasswordChange() {
    const result = validatePasswordInputs();
    
    // If no change requested or validation failed
    if (!result.isValid) {
        return false;
    }
    
    // If no update needed (empty fields)
    if (!result.shouldUpdate) {
        return true;
    }
    
    try {
        // Send request to server
        const response = await saveUserPassword(result.data);
        
        if (response.success) {
            // Reset fields
            const fields = ['currentPassword', 'newPassword', 'confirmPassword'];
            fields.forEach(id => {
                const field = document.getElementById(id);
                if (field) field.value = '';
            });
            
            // Reset strength indicator
            updateStrengthMeter(0);
            
            // Notification is already handled in saveUserPassword
            return true;
        } else {
            // Handle specific errors
            if (response.code === 'INVALID_CURRENT_PASSWORD') {
                const field = document.getElementById('currentPassword');
                if (field) {
                    field.classList.add('input-error');
                    showErrorMessage(field, 'Current password is incorrect');
                }
                
                // Return true to allow profile save to continue
                // even if password change failed
                // This prevents password error from blocking other data save
                return true;
            }
            
            // Silent error, let profile save continue
            console.warn('Password error ignored to allow profile save:', response.message);
            return true;
        }
    } catch (error) {
        console.error('Error updating password:', error);
        
        // Don't block profile save for a password issue
        // Return true to allow other data to be saved
        return true;
    }
}


// Export public functions
export {
    initPasswordManager,
    validatePasswordSection,
    handlePasswordChange,
    validatePasswordInputs,
    updateStrengthMeter,
    arePasswordsValid,
    checkPasswordMatch,
    validatePasswordStrength
};