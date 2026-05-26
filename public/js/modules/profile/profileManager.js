// public/js/modules/profile/profileManager.js

import { fetchUserProfile, saveUserProfile } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { 
    initPasswordManager, 
    validatePasswordSection, 
    handlePasswordChange,
    validatePasswordInputs,
    updateStrengthMeter,
    validatePasswordStrength
} from './passwordManager.js';

import { 
    isValidEmail, 
    isValidPhone, 
    isValidZipCode, 
    cleanNumericInput 
} from '../../utils/validation.js';

function initProfileManager() {
    setupProfileForm();
    initPasswordManager();
}

function validateForm() {
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone', 
        'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];

    let isValid = true;

    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            field.classList.add('input-error');
            showErrorMessage(field, window.t ? window.t('profile.errorRequired') : 'This field is required');
            isValid = false;
        } else {
            switch(fieldId) {
                case 'email':
                    isValid = validateEmailField(field) && isValid;
                    break;
                case 'phone':
                    isValid = validatePhoneField(field) && isValid;
                    break;
                case 'shopZipCode':
                    isValid = validateZipCodeField(field) && isValid;
                    break;
            }
        }
    });

    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';

    if (currentPassword || newPassword || confirmPassword) {
        if (!currentPassword) {
            const field = document.getElementById('currentPassword');
            field.classList.add('input-error');
            showErrorMessage(field, window.t ? window.t('profile.errorCurrentPwdRequired') : 'Current password is required to change password');
            isValid = false;
        }

        if (!newPassword) {
            const field = document.getElementById('newPassword');
            field.classList.add('input-error');
            showErrorMessage(field, window.t ? window.t('profile.errorNewPwdRequired') : 'New password is required');
            isValid = false;
        }

        if (!confirmPassword) {
            const field = document.getElementById('confirmPassword');
            field.classList.add('input-error');
            showErrorMessage(field, window.t ? window.t('profile.errorConfirmPwdRequired') : 'Please confirm your new password');
            isValid = false;
        }

        if (currentPassword && newPassword && confirmPassword) {
            const isStrong = validatePasswordStrength(newPassword);
            if (!isStrong) {
                isValid = false;
            }

            if (newPassword !== confirmPassword) {
                const field = document.getElementById('confirmPassword');
                field.classList.add('input-error', 'password-mismatch');
                field.classList.remove('password-match');
                showErrorMessage(field, window.t ? window.t('profile.errorPwdMismatch') : 'Passwords do not match');
                isValid = false;
            }
        }
    }

    return isValid;
}

async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = window.t ? window.t('profile.saving') : 'Saving...';
    }

    try {
        const profileData = collectProfileData();

        const currentPassword = document.getElementById('currentPassword')?.value || '';
        const newPassword = document.getElementById('newPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';

        if (currentPassword && newPassword && confirmPassword && newPassword === confirmPassword) {
            profileData.passwordChange = {
                currentPassword,
                newPassword
            };
        }

        if (typeof clearAllNotifications === 'function') {
            clearAllNotifications();
        }

        const result = await saveUserProfile(profileData);

        if (result.success) {
            if (result.passwordSameAsUsername) {
                const alertContainer = document.createElement('div');
                alertContainer.className = 'security-alert-banner';
                alertContainer.innerHTML = `
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <h4>${window.t ? window.t('profile.securityTitle') : 'Action required for your security'}</h4>
                        <p>${window.t ? window.t('profile.securityMsg1') : 'Your password is the same as your username, which is a security risk.'}</p>
                        <p>${window.t ? window.t('profile.securityMsg2') : 'Please set a new secure password before continuing.'}</p>
                    </div>
                `;
                
                const mainContent = document.querySelector('main') || document.querySelector('.main-content') || document.body;
                const existingAlert = mainContent.querySelector('.security-alert-banner');
                if (existingAlert) {
                    existingAlert.remove();
                }
                mainContent.insertBefore(alertContainer, mainContent.firstChild);
                
                const passwordSection = document.querySelector('.password-section') || document.getElementById('passwordFields');
                if (passwordSection) {
                    passwordSection.classList.add('highlight-section');
                    passwordSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                showNotification(window.t ? window.t('profile.securityNotif') : 'For security reasons, you must change your password', 'warning', 8000);
                
                const currentPasswordField = document.getElementById('currentPassword');
                if (currentPasswordField) {
                    currentPasswordField.classList.add('input-error');
                    showErrorMessage(currentPasswordField, window.t ? window.t('profile.errorPwdSameAsUsername') : 'For security reasons, you must change your password because it is the same as your username');
                    currentPasswordField.focus();
                }
                
                const newPasswordField = document.getElementById('newPassword');
                if (newPasswordField) {
                    newPasswordField.classList.add('required-field');
                    showErrorMessage(newPasswordField, window.t ? window.t('profile.errorSetNewPwd') : 'Please set a new password different from your username');
                }
                
                function setupPasswordFieldListeners() {
                    const newPwdField = document.getElementById('newPassword');
                    const confirmPwdField = document.getElementById('confirmPassword');
                    
                    function checkPasswordFields() {
                        const newPwd = newPwdField.value;
                        const confirmPwd = confirmPwdField.value;
                        
                        const isStrongPassword = validatePasswordStrength(newPwd, false);
                        
                        if (newPwd && isStrongPassword) {
                            newPwdField.classList.remove('input-error', 'required-field');
                            removeErrorMessage(newPwdField);
                            newPwdField.classList.add('password-match');
                        }
                        
                        if (newPwd && confirmPwd && newPwd === confirmPwd) {
                            confirmPwdField.classList.remove('input-error', 'password-mismatch');
                            confirmPwdField.classList.add('password-match');
                            removeErrorMessage(confirmPwdField);
                        }
                    }
                    
                    if (newPwdField) {
                        newPwdField.addEventListener('input', checkPasswordFields);
                        newPwdField.addEventListener('blur', checkPasswordFields);
                    }
                    
                    if (confirmPwdField) {
                        confirmPwdField.addEventListener('input', checkPasswordFields);
                        confirmPwdField.addEventListener('blur', checkPasswordFields);
                    }
                }
                
                setupPasswordFieldListeners();
            } else {
                showNotification(window.t ? window.t('profile.successMsg') : 'Profile saved successfully', 'success');
                
                if (document.getElementById('currentPassword')) document.getElementById('currentPassword').value = '';
                if (document.getElementById('newPassword')) document.getElementById('newPassword').value = '';
                if (document.getElementById('confirmPassword')) document.getElementById('confirmPassword').value = '';
                
                const passwordStrength = document.getElementById('passwordStrength');
                if (passwordStrength) passwordStrength.style.width = '0%';
                const passwordStrengthText = document.getElementById('passwordStrengthText');
                if (passwordStrengthText) passwordStrengthText.textContent = window.t ? window.t('profile.passwordStrength') : 'Password strength';
                
                document.querySelectorAll('.password-requirements li').forEach(li => {
                    li.classList.remove('valid');
                });
                
                if (result.shouldRedirect) {
                    setTimeout(() => {
                        window.location.href = '/pages/catalog.html';
                    }, 1500);
                }
            }
        } else {
            if (result.code === 'INVALID_CURRENT_PASSWORD') {
                const field = document.getElementById('currentPassword');
                field.classList.add('input-error');
                showErrorMessage(field, window.t ? window.t('profile.errorCurrentPwdIncorrect') : 'Current password is incorrect');
            } else {
                showNotification(result.message || (window.t ? window.t('profile.errorMsg') : 'Error saving profile'), 'error');
            }
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification(window.t ? window.t('profile.errorSaveFailed') : 'Unable to save profile. Please try again.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = window.t ? window.t('profile.save') : 'Save';
        }
    }
}

function injectSecurityStyles() {
    if (!document.getElementById('profile-security-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'profile-security-styles';
      styleEl.textContent = `
        .highlight-section {
          border: 2px solid #ff3860;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 20px;
          background-color: rgba(255, 56, 96, 0.05);
          box-shadow: 0 0 8px rgba(255, 56, 96, 0.3);
        }
        
        .security-alert-banner {
          display: flex;
          background-color: #fff3cd;
          border: 1px solid #ffeeba;
          color: #856404;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
          align-items: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .alert-icon {
          font-size: 24px;
          margin-right: 15px;
        }
        
        .alert-content h4 {
          margin-top: 0;
          margin-bottom: 8px;
          color: #856404;
        }
        
        .alert-content p {
          margin: 0 0 8px 0;
        }
        
        .input-error {
          border-color: #ff3860 !important;
          background-color: rgba(255, 56, 96, 0.05);
        }
        
        .required-field {
          background-color: rgba(255, 56, 96, 0.05);
          border-color: #ff3860 !important;
        }
        
        .error-message {
          color: #ff3860;
          font-size: 0.9rem;
          margin-top: 5px;
          font-weight: 500;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

function setupRealTimeSubmitButton() {
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const saveButton = document.querySelector('.save-btn');
    
    if (!currentPassword || !newPassword || !confirmPassword || !saveButton) {
        return;
    }
    
    function checkPasswordsValidity() {
        if (!currentPassword.value && !newPassword.value && !confirmPassword.value) {
            return true;
        }
        
        if ((currentPassword.value || newPassword.value || confirmPassword.value) &&
            !(currentPassword.value && newPassword.value && confirmPassword.value)) {
            return false;
        }
        
        const isStrong = validatePasswordStrength(newPassword.value);
        if (!isStrong) {
            return false;
        }
        
        return newPassword.value === confirmPassword.value;
    }
    
    function updateSubmitButtonState() {
        const isValid = checkPasswordsValidity();
        
        if (!isValid) {
            saveButton.classList.add('disabled-submit');
            saveButton.title = window.t ? window.t('profile.pwdFieldsHint') : 'Please fill in all password fields correctly';
        } else {
            saveButton.classList.remove('disabled-submit');
            saveButton.title = '';
        }
    }
    
    [currentPassword, newPassword, confirmPassword].forEach(field => {
        field.addEventListener('input', updateSubmitButtonState);
        field.addEventListener('blur', updateSubmitButtonState);
    });
    
    updateSubmitButtonState();
}

function setupProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) {
        console.error('Profile form not found');
        return;
    }

    injectSecurityStyles();
    loadUserProfile();
    setupRealtimeValidation(profileForm);
    setupRealTimeSubmitButton();
    setupBillingToggle();
    profileForm.addEventListener('submit', handleProfileSubmit);
}

function setupBillingToggle() {
    const toggle = document.getElementById('billingSameAsShipping');
    const fields = document.getElementById('billingFields');
    if (!toggle || !fields) return;

    const apply = () => {
        if (toggle.checked) {
            fields.classList.add('hidden');
            fields.querySelectorAll('input').forEach(input => {
                input.classList.remove('input-error');
                removeErrorMessage(input);
            });
        } else {
            fields.classList.remove('hidden');
            prefillBillingFromShipping();
        }
    };

    toggle.addEventListener('change', apply);
    apply();
}

function prefillBillingFromShipping() {
    const map = {
        billingFirstName: 'firstName',
        billingLastName: 'lastName',
        billingShopName: 'shopName',
        billingAddress: 'shopAddress',
        billingCity: 'shopCity',
        billingZipCode: 'shopZipCode'
    };
    Object.entries(map).forEach(([billingId, shippingId]) => {
        const billingField = document.getElementById(billingId);
        const shippingField = document.getElementById(shippingId);
        if (billingField && shippingField && !billingField.value.trim()) {
            billingField.value = shippingField.value;
        }
    });
}

async function loadUserProfile() {
    try {
        const profileForm = document.getElementById('profileForm');
        const formFields = profileForm.querySelectorAll('input');
        
        formFields.forEach(field => {
            field.disabled = true;
        });

        showLoadingIndicator(profileForm);

        const profileData = await fetchUserProfile();
        
        hideLoadingIndicator(profileForm);

        if (!profileData || Object.keys(profileData).length === 0) {
            showNotification(window.t ? window.t('profile.infoComplete') : 'Please complete your profile information', 'info');
            resetFormFields();
            return;
        }

        fillProfileForm(profileData);

        formFields.forEach(field => {
            field.disabled = false;
        });

        // Check if password is same as username — force password change
        if (profileData.passwordSameAsUsername) {
            showForcedPasswordChangeUI();
        } else {
            showNotification(window.t ? window.t('profile.loadedSuccess') : 'Profile loaded successfully', 'success');
        }

    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification(window.t ? window.t('profile.errorLoadFailed') : 'Unable to load profile. Please try again.', 'error');
        resetFormFields();
    }
}

function showForcedPasswordChangeUI() {
    // Show security alert banner at top of page
    const alertContainer = document.createElement('div');
    alertContainer.className = 'security-alert-banner';
    alertContainer.innerHTML = `
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
            <h4>Action required for your security</h4>
            <p>Your password is the same as your username, which is a security risk.</p>
            <p>Please set a new secure password before continuing.</p>
        </div>
    `;
    
    const mainContent = document.querySelector('main') || document.querySelector('.main-content') || document.body;
    const existingAlert = mainContent.querySelector('.security-alert-banner');
    if (existingAlert) {
        existingAlert.remove();
    }
    mainContent.insertBefore(alertContainer, mainContent.firstChild);
    
    // Highlight password section (now 4th section: Personal, Shop, Billing, Password)
    const passwordSection = document.querySelector('.profile-section:nth-child(4)') || document.querySelector('.password-section') || document.getElementById('passwordFields');
    if (passwordSection) {
        passwordSection.classList.add('highlight-section');
        passwordSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    showNotification(window.t ? window.t('profile.securityNotif') : 'For security reasons, you must change your password', 'warning', 8000);
    
    // Mark current password field with error
    const currentPasswordField = document.getElementById('currentPassword');
    if (currentPasswordField) {
        currentPasswordField.classList.add('input-error');
        showErrorMessage(currentPasswordField, window.t ? window.t('profile.errorPwdSameAsUsername') : 'For security reasons, you must change your password because it is the same as your username');
        currentPasswordField.focus();
    }
    
    // Mark new password field as required
    const newPasswordField = document.getElementById('newPassword');
    if (newPasswordField) {
        newPasswordField.classList.add('required-field');
        showErrorMessage(newPasswordField, window.t ? window.t('profile.errorSetNewPwd') : 'Please set a new password different from your username');
    }
    
    // Disable save button until password fields are properly filled
    const saveButton = document.querySelector('.save-btn');
    if (saveButton) {
        saveButton.classList.add('disabled-submit');
        saveButton.title = 'You must change your password before saving';
    }
}

function showLoadingIndicator(profileForm) {
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'profile-loading-message';
    loadingMessage.className = 'loading-container';
    loadingMessage.innerHTML = `
        <div class="loading-spinner"></div>
        <p>${window.t ? window.t('profile.loadingData') : 'Loading your data...'}</p>
    `;
    profileForm.parentNode.insertBefore(loadingMessage, profileForm);
}

function hideLoadingIndicator(profileForm) {
    const messageElement = document.getElementById('profile-loading-message');
    if (messageElement) {
        messageElement.remove();
    }
}

function fillProfileForm(profileData) {
    const fields = {
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        shopName: document.getElementById('shopName'),
        shopAddress: document.getElementById('shopAddress'),
        shopCity: document.getElementById('shopCity'),
        shopZipCode: document.getElementById('shopZipCode'),
        billingFirstName: document.getElementById('billingFirstName'),
        billingLastName: document.getElementById('billingLastName'),
        billingShopName: document.getElementById('billingShopName'),
        billingAddress: document.getElementById('billingAddress'),
        billingCity: document.getElementById('billingCity'),
        billingZipCode: document.getElementById('billingZipCode')
    };

    const fieldMappings = {
        firstName: ['firstName', 'first_name', 'firstname', 'prénom'],
        lastName: ['lastName', 'last_name', 'lastname', 'nom'],
        email: ['email', 'courriel', 'mail'],
        phone: ['phone', 'phoneNumber', 'téléphone', 'telephone'],
        shopName: ['shopName', 'shop_name', 'shopname', 'nom_boutique', 'boutique'],
        shopAddress: ['shopAddress', 'shop_address', 'shopaddress', 'address', 'adresse'],
        shopCity: ['shopCity', 'shop_city', 'shopcity', 'city', 'ville'],
        shopZipCode: ['shopZipCode', 'shop_zip_code', 'shopzipcode', 'zipCode', 'zip', 'postalCode', 'postal_code', 'code_postal'],
        billingFirstName: ['billingFirstName', 'billing_first_name'],
        billingLastName: ['billingLastName', 'billing_last_name'],
        billingShopName: ['billingShopName', 'billing_shop_name'],
        billingAddress: ['billingAddress', 'billing_address'],
        billingCity: ['billingCity', 'billing_city'],
        billingZipCode: ['billingZipCode', 'billing_zip_code']
    };

    function findFieldValue(fieldName) {
        const possibleNames = fieldMappings[fieldName] || [fieldName];

        for (const name of possibleNames) {
            const value = profileData[name] || profileData[name.toLowerCase()];
            if (value !== undefined && value !== null) {
                return value;
            }
        }

        return '';
    }

    for (const [fieldName, field] of Object.entries(fields)) {
        if (field) {
            const value = findFieldValue(fieldName);
            field.value = value;
        }
    }

    if (fields.phone) {
        fields.phone.value = cleanNumericInput(fields.phone.value);
    }
    if (fields.shopZipCode) {
        fields.shopZipCode.value = cleanNumericInput(fields.shopZipCode.value);
    }
    if (fields.billingZipCode) {
        fields.billingZipCode.value = cleanNumericInput(fields.billingZipCode.value);
    }

    // Coche la case "Same as shipping" en fonction du profil
    const toggle = document.getElementById('billingSameAsShipping');
    const billingContainer = document.getElementById('billingFields');
    if (toggle && billingContainer) {
        const sameAsShipping = profileData.billingSameAsShipping !== false;
        toggle.checked = sameAsShipping;
        if (sameAsShipping) {
            billingContainer.classList.add('hidden');
        } else {
            billingContainer.classList.remove('hidden');
        }
    }
}

function setupRealtimeValidation(form) {
    if (!form) {
        console.error('Form not found for real-time validation');
        return;
    }

    const inputFields = form.querySelectorAll('input:not([type="password"])');
    
    inputFields.forEach(field => {
        if (field.type === 'hidden' || field.type === 'submit') {
            return;
        }
        
        field.addEventListener('input', () => {
            field.classList.remove('input-error');
            removeErrorMessage(field);
        });
        
        field.addEventListener('blur', () => {
            validateField(field, true);
        });
    });
    
    const specialFields = form.querySelectorAll('#email, #phone, #shopZipCode');
    specialFields.forEach(field => {
        field.addEventListener('input', () => {
            validateField(field, false);
        });
    });
    
    console.log('Real-time validation setup completed for form:', form.id);
}

function validateField(field, showErrors = true) {
    if (!field) return false;
    
    let isValid = true;
    
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone', 
        'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];
    
    if (requiredFields.includes(field.id) && !field.value.trim()) {
        if (showErrors) {
            field.classList.add('input-error');
            showErrorMessage(field, 'This field is required');
        }
        isValid = false;
    } else {
        switch (field.id) {
            case 'email':
                if (field.value && !isValidEmail(field.value)) {
                    if (showErrors) {
                        field.classList.add('input-error');
                        showErrorMessage(field, window.t ? window.t('profile.errorEmail') : 'Please enter a valid email address');
                    }
                    isValid = false;
                } else {
                    field.classList.remove('input-error');
                    if (showErrors) removeErrorMessage(field);
                }
                break;
                
            case 'phone':
                if (field.value && !isValidPhone(field.value)) {
                    if (showErrors) {
                        field.classList.add('input-error');
                        showErrorMessage(field, window.t ? window.t('profile.errorPhone') : 'Please enter a valid phone number');
                    }
                    isValid = false;
                } else {
                    field.classList.remove('input-error');
                    if (showErrors) removeErrorMessage(field);
                }
                break;
                
            case 'shopZipCode':
                if (field.value && !isValidZipCode(field.value)) {
                    if (showErrors) {
                        field.classList.add('input-error');
                        showErrorMessage(field, window.t ? window.t('profile.errorZip') : 'Please enter a valid zip code');
                    }
                    isValid = false;
                } else {
                    field.classList.remove('input-error');
                    if (showErrors) removeErrorMessage(field);
                }
                break;
                
            default:
                field.classList.remove('input-error');
                if (showErrors) removeErrorMessage(field);
                break;
        }
    }
    
    return isValid;
}

function validateEmailField(emailField) {
    if (emailField.value && !isValidEmail(emailField.value)) {
        emailField.classList.add('input-error');
        showErrorMessage(emailField, window.t ? window.t('profile.errorEmail') : 'Please enter a valid email address');
        return false;
    }
    emailField.classList.remove('input-error');
    removeErrorMessage(emailField);
    return true;
}

function validatePhoneField(phoneField) {
    if (phoneField.value && !isValidPhone(phoneField.value)) {
        phoneField.classList.add('input-error');
        showErrorMessage(phoneField, window.t ? window.t('profile.errorPhone') : 'Please enter a valid phone number (10 digits)');
        return false;
    }
    phoneField.classList.remove('input-error');
    removeErrorMessage(phoneField);
    return true;
}

function validateZipCodeField(zipCodeField) {
    if (zipCodeField.value && !isValidZipCode(zipCodeField.value)) {
        zipCodeField.classList.add('input-error');
        showErrorMessage(zipCodeField, window.t ? window.t('profile.errorZip') : 'Please enter a valid zip code');
        return false;
    }
    zipCodeField.classList.remove('input-error');
    removeErrorMessage(zipCodeField);
    return true;
}

function collectProfileData() {
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const billingSameToggle = document.getElementById('billingSameAsShipping');
    const billingSameAsShipping = billingSameToggle ? billingSameToggle.checked : true;

    return {
        firstName: val('firstName'),
        lastName: val('lastName'),
        fullName: `${val('firstName')} ${val('lastName')}`,
        email: val('email'),
        phone: val('phone'),
        shopName: val('shopName'),
        shopAddress: val('shopAddress'),
        shopCity: val('shopCity'),
        shopZipCode: val('shopZipCode'),
        address: val('shopAddress'),
        city: val('shopCity'),
        postalCode: val('shopZipCode'),
        billingSameAsShipping,
        billingFirstName: billingSameAsShipping ? '' : val('billingFirstName'),
        billingLastName: billingSameAsShipping ? '' : val('billingLastName'),
        billingShopName: billingSameAsShipping ? '' : val('billingShopName'),
        billingAddress: billingSameAsShipping ? '' : val('billingAddress'),
        billingCity: billingSameAsShipping ? '' : val('billingCity'),
        billingZipCode: billingSameAsShipping ? '' : val('billingZipCode'),
        lastUpdated: new Date().toISOString()
    };
}

function showErrorMessage(field, message) {
    removeErrorMessage(field);
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message visible';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
}

function removeErrorMessage(field) {
    const errorElement = field.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

function resetFormFields() {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        const formFields = profileForm.querySelectorAll('input');
        formFields.forEach(field => {
            field.disabled = false;
            field.value = '';
            field.classList.remove('input-error');
            removeErrorMessage(field);
        });
    }
}

function disableInlineFormHandler() {
    const profileForm = document.getElementById('profileForm');
    if (profileForm && !profileForm.getAttribute('data-handler-overridden')) {
        profileForm.setAttribute('data-handler-overridden', 'true');
        
        const originalSubmit = profileForm.submit;
        profileForm.submit = function() {
            console.log('Attempted native submission blocked, using profileManager module handler');
            return false;
        };
        
        console.log('Inline form handler disabled');
    }
}

function initCompleteProfileManager() {
    disableInlineFormHandler();
    initProfileManager();
    
    console.log('Profile module fully initialized with priority over inline scripts');
}

document.addEventListener('DOMContentLoaded', function() {
    initCompleteProfileManager();
});

export { 
    initProfileManager,
    initCompleteProfileManager,
    loadUserProfile, 
    handleProfileSubmit,
    resetFormFields
};