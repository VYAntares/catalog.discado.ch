import { fetchUserProfile, saveUserProfile } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { 
    initPasswordManager, 
    validatePasswordSection, 
    handlePasswordChange,
    validatePasswordInputs ,
    updateStrengthMeter,
    validatePasswordStrength
} from './passwordManager.js';

import { 
    isValidEmail, 
    isValidPhone, 
    isValidZipCode, 
    cleanNumericInput 
} from '../../utils/validation.js';


/**
 * Initialise le gestionnaire de profil
 */
function initProfileManager() {
    console.log('Profile manager initialized');
    setupProfileForm();
    initPasswordManager();
}

/**
 * Modification de la fonction validateForm dans profileManager.js
 * Cette version vérifie explicitement si les champs de mot de passe
 * sont remplis et valides avant de permettre la soumission
 */
function validateForm() {
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone', 
        'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];

    let isValid = true;

    // Vérifier d'abord les champs obligatoires
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            field.classList.add('input-error');
            showErrorMessage(field, 'Ce champ est requis');
            isValid = false;
        } else {
            // Validations spécifiques
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

    // Vérifier ensuite les champs de mot de passe s'ils sont remplis
    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';

    // Si au moins un des champs de mot de passe est rempli
    if (currentPassword || newPassword || confirmPassword) {
        // Tous les champs doivent être remplis
        if (!currentPassword) {
            const field = document.getElementById('currentPassword');
            field.classList.add('input-error');
            showErrorMessage(field, 'Le mot de passe actuel est requis pour changer le mot de passe');
            isValid = false;
        }

        if (!newPassword) {
            const field = document.getElementById('newPassword');
            field.classList.add('input-error');
            showErrorMessage(field, 'Le nouveau mot de passe est requis');
            isValid = false;
        }

        if (!confirmPassword) {
            const field = document.getElementById('confirmPassword');
            field.classList.add('input-error');
            showErrorMessage(field, 'Veuillez confirmer votre nouveau mot de passe');
            isValid = false;
        }

        // Si tous les champs sont remplis, vérifier la force et la correspondance
        if (currentPassword && newPassword && confirmPassword) {
            // Vérifier que le nouveau mot de passe est fort
            const isStrong = validatePasswordStrength(newPassword);
            if (!isStrong) {
                isValid = false;
            }

            // Vérifier que les mots de passe correspondent
            if (newPassword !== confirmPassword) {
                const field = document.getElementById('confirmPassword');
                field.classList.add('input-error', 'password-mismatch');
                field.classList.remove('password-match');
                showErrorMessage(field, 'Passwords do not match');
                isValid = false;
            }
        }
    }

    return isValid;
}

/**
 * Fonction de gestion de la soumission du formulaire de profil
 * Version complète modifiée pour gérer correctement le cas où
 * le mot de passe est identique au nom d'utilisateur
 */
async function handleProfileSubmit(event) {
    event.preventDefault();
    console.log('Soumission du formulaire de profil');

    // Vérifier la validité complète du formulaire
    if (!validateForm()) {
        console.log('Validation du formulaire échouée');
        return;
    }

    // Désactiver le bouton de soumission
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';
    }

    try {
        // Collecter les données du formulaire
        const profileData = collectProfileData();

        // Vérifier si une mise à jour du mot de passe est demandée
        const currentPassword = document.getElementById('currentPassword')?.value || '';
        const newPassword = document.getElementById('newPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';

        if (currentPassword && newPassword && confirmPassword && newPassword === confirmPassword) {
            // Ajouter les informations de mot de passe au profil
            profileData.passwordChange = {
                currentPassword,
                newPassword
            };
        }

        // Sauvegarder le profil
        const result = await saveUserProfile(profileData);

        // Supprimer toutes les notifications existantes avant d'en afficher de nouvelles
        if (typeof clearAllNotifications === 'function') {
            clearAllNotifications();
        }

        if (result.success) {
            // Vérifier si le mot de passe est identique au nom d'utilisateur
            if (result.passwordSameAsUsername) {
                // NE PAS afficher de notification de succès du profil
                
                // Créer et afficher une alerte de sécurité visible en haut de la page
                const alertContainer = document.createElement('div');
                alertContainer.className = 'security-alert-banner';
                alertContainer.innerHTML = `
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <h4>Action requise pour votre sécurité</h4>
                        <p>Votre mot de passe est identique à votre identifiant, ce qui représente un risque de sécurité.</p>
                        <p>Veuillez définir un nouveau mot de passe sécurisé avant de continuer.</p>
                    </div>
                `;
                
                // Insérer l'alerte en haut du contenu principal
                const mainContent = document.querySelector('main') || document.querySelector('.main-content') || document.body;
                const existingAlert = mainContent.querySelector('.security-alert-banner');
                if (existingAlert) {
                    existingAlert.remove();
                }
                mainContent.insertBefore(alertContainer, mainContent.firstChild);
                
                // Mettre en évidence la section de mot de passe
                const passwordSection = document.querySelector('.password-section') || document.getElementById('passwordFields');
                if (passwordSection) {
                    passwordSection.classList.add('highlight-section');
                    
                    // Faire défiler jusqu'à la section mot de passe
                    passwordSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                // Afficher une notification d'avertissement
                showNotification('Pour des raisons de sécurité, vous devez changer votre mot de passe', 'warning', 8000);
                
                // Mettre en évidence le champ de mot de passe actuel
                const currentPasswordField = document.getElementById('currentPassword');
                if (currentPasswordField) {
                    currentPasswordField.classList.add('input-error');
                    showErrorMessage(currentPasswordField, 'Pour des raisons de sécurité, vous devez changer votre mot de passe car il est identique à votre nom d\'utilisateur');
                    currentPasswordField.focus();
                }
                
                // Mettre en évidence le champ de nouveau mot de passe
                const newPasswordField = document.getElementById('newPassword');
                if (newPasswordField) {
                    newPasswordField.classList.add('required-field');
                    showErrorMessage(newPasswordField, 'Veuillez définir un nouveau mot de passe différent de votre nom d\'utilisateur');
                }
                
                // NOUVEAU CODE: Ajouter des écouteurs d'événements pour supprimer les états d'erreur
                // lorsque l'utilisateur saisit des valeurs valides
                function setupPasswordFieldListeners() {
                    const newPwdField = document.getElementById('newPassword');
                    const confirmPwdField = document.getElementById('confirmPassword');
                    
                    // Fonction pour vérifier les champs et mettre à jour leur apparence
                    function checkPasswordFields() {
                        const newPwd = newPwdField.value;
                        const confirmPwd = confirmPwdField.value;
                        
                        // Vérifier si le nouveau mot de passe est valide
                        const isStrongPassword = validatePasswordStrength(newPwd, false);
                        
                        if (newPwd && isStrongPassword) {
                            // Si le mot de passe est fort, supprimer les classes d'erreur
                            newPwdField.classList.remove('input-error', 'required-field');
                            removeErrorMessage(newPwdField);
                            
                            // Ajouter une classe de validation
                            newPwdField.classList.add('password-match');
                        }
                        
                        // Vérifier si les mots de passe correspondent
                        if (newPwd && confirmPwd && newPwd === confirmPwd) {
                            // Si les mots de passe correspondent, supprimer les classes d'erreur
                            confirmPwdField.classList.remove('input-error', 'password-mismatch');
                            confirmPwdField.classList.add('password-match');
                            removeErrorMessage(confirmPwdField);
                        }
                    }
                    
                    // Attacher les écouteurs aux champs
                    if (newPwdField) {
                        newPwdField.addEventListener('input', checkPasswordFields);
                        newPwdField.addEventListener('blur', checkPasswordFields);
                    }
                    
                    if (confirmPwdField) {
                        confirmPwdField.addEventListener('input', checkPasswordFields);
                        confirmPwdField.addEventListener('blur', checkPasswordFields);
                    }
                }
                
                // Configurer les écouteurs d'événements
                setupPasswordFieldListeners();
            } else {
                // Notification de succès standard pour les cas normaux
                showNotification('Profil enregistré avec succès', 'success');
                
                // Vider les champs de mot de passe
                if (document.getElementById('currentPassword')) document.getElementById('currentPassword').value = '';
                if (document.getElementById('newPassword')) document.getElementById('newPassword').value = '';
                if (document.getElementById('confirmPassword')) document.getElementById('confirmPassword').value = '';
                
                // Réinitialiser l'indicateur de force
                const passwordStrength = document.getElementById('passwordStrength');
                if (passwordStrength) passwordStrength.style.width = '0%';
                const passwordStrengthText = document.getElementById('passwordStrengthText');
                if (passwordStrengthText) passwordStrengthText.textContent = 'Password strength';
                
                // Réinitialiser les indicateurs de validation
                document.querySelectorAll('.password-requirements li').forEach(li => {
                    li.classList.remove('valid');
                });
                
                // Redirection après sauvegarde seulement si le serveur dit de le faire
                if (result.shouldRedirect) {
                    setTimeout(() => {
                        window.location.href = '/pages/catalog.html';
                    }, 1500);
                }
            }
        } else {
            // Gérer les erreurs spécifiques
            if (result.code === 'INVALID_CURRENT_PASSWORD') {
                const field = document.getElementById('currentPassword');
                field.classList.add('input-error');
                showErrorMessage(field, 'Le mot de passe actuel est incorrect');
            } else {
                showNotification(result.message || 'Erreur lors de l\'enregistrement', 'error');
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du profil:', error);
        showNotification('Impossible d\'enregistrer le profil. Veuillez réessayer.', 'error');
    } finally {
        // Réactiver le bouton de soumission
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer';
        }
    }
}

/**
 * Ajouter cette fonction pour injecter les styles CSS nécessaires
 */
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

/**
 * Modification pour ajouter une validation en temps réel du bouton de soumission
 * Cette fonction doit être appelée lors de l'initialisation
 */
function setupRealTimeSubmitButton() {
    // Obtenir les champs de mot de passe et le bouton de soumission
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const saveButton = document.querySelector('.save-btn');
    
    if (!currentPassword || !newPassword || !confirmPassword || !saveButton) {
        return;
    }
    
    // Fonction pour vérifier la validité des mots de passe en temps réel
    function checkPasswordsValidity() {
        // Si aucun champ n'est rempli, tout est valide (pas de changement de mot de passe)
        if (!currentPassword.value && !newPassword.value && !confirmPassword.value) {
            return true;
        }
        
        // Si un des champs est rempli, tous doivent être remplis
        if ((currentPassword.value || newPassword.value || confirmPassword.value) &&
            !(currentPassword.value && newPassword.value && confirmPassword.value)) {
            return false;
        }
        
        // Vérifier la force du mot de passe
        const isStrong = validatePasswordStrength(newPassword.value);
        if (!isStrong) {
            return false;
        }
        
        // Vérifier la correspondance
        return newPassword.value === confirmPassword.value;
    }
    
    // Fonction pour mettre à jour l'état du bouton
    function updateSubmitButtonState() {
        const isValid = checkPasswordsValidity();
        
        if (!isValid) {
            saveButton.classList.add('disabled-submit');
            saveButton.title = 'Veuillez remplir correctement tous les champs de mot de passe';
        } else {
            saveButton.classList.remove('disabled-submit');
            saveButton.title = '';
        }
    }
    
    // Attacher les écouteurs d'événements
    [currentPassword, newPassword, confirmPassword].forEach(field => {
        field.addEventListener('input', updateSubmitButtonState);
        field.addEventListener('blur', updateSubmitButtonState);
    });
    
    // Vérification initiale
    updateSubmitButtonState();
}

/**
 * Modifiez la fonction setupProfileForm pour inclure l'injection des styles
 */
function setupProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) {
        console.error('Profile form not found');
        return;
    }

    // Injecter les styles de sécurité
    injectSecurityStyles();

    // Charger les données du profil au chargement
    loadUserProfile();

    // Configuration des validations en temps réel
    setupRealtimeValidation(profileForm);
    
    // Configuration de la validation en temps réel du bouton de soumission
    setupRealTimeSubmitButton();

    // Gestion de la soumission du formulaire
    profileForm.addEventListener('submit', handleProfileSubmit);
}

/**
 * Charge les données du profil utilisateur
 */
async function loadUserProfile() {
    try {
        const profileForm = document.getElementById('profileForm');
        const formFields = profileForm.querySelectorAll('input');
        
        // Désactiver les champs pendant le chargement
        formFields.forEach(field => {
            field.disabled = true;
        });

        // Afficher un indicateur de chargement
        showLoadingIndicator(profileForm);

        // Récupérer les données du profil
        const profileData = await fetchUserProfile();
        
        // Masquer l'indicateur de chargement
        hideLoadingIndicator(profileForm);

        // Vérifier si des données sont disponibles
        if (!profileData || Object.keys(profileData).length === 0) {
            showNotification('Veuillez compléter vos informations de profil', 'info');
            resetFormFields();
            return;
        }

        // Remplir le formulaire
        fillProfileForm(profileData);

        // Réactiver les champs
        formFields.forEach(field => {
            field.disabled = false;
        });

        showNotification('Profil chargé avec succès', 'success');

    } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        showNotification('Impossible de charger le profil. Veuillez réessayer.', 'error');
        resetFormFields();
    }
}

/**
 * Affiche un indicateur de chargement
 * @param {HTMLElement} profileForm - Formulaire de profil
 */
function showLoadingIndicator(profileForm) {
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'profile-loading-message';
    loadingMessage.className = 'loading-container';
    loadingMessage.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Chargement de vos données...</p>
    `;
    profileForm.parentNode.insertBefore(loadingMessage, profileForm);
}

/**
 * Masque l'indicateur de chargement
 * @param {HTMLElement} profileForm - Formulaire de profil
 */
function hideLoadingIndicator(profileForm) {
    const messageElement = document.getElementById('profile-loading-message');
    if (messageElement) {
        messageElement.remove();
    }
}

/**
 * Remplit le formulaire avec les données du profil
 * @param {Object} profileData - Données du profil
 */
function fillProfileForm(profileData) {
    const fields = {
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        shopName: document.getElementById('shopName'),
        shopAddress: document.getElementById('shopAddress'),
        shopCity: document.getElementById('shopCity'),
        shopZipCode: document.getElementById('shopZipCode')
    };

    // Tableau des variantes possibles pour chaque champ
    const fieldMappings = {
        firstName: ['firstName', 'first_name', 'firstname', 'prénom'],
        lastName: ['lastName', 'last_name', 'lastname', 'nom'],
        email: ['email', 'courriel', 'mail'],
        phone: ['phone', 'phoneNumber', 'téléphone', 'telephone'],
        shopName: ['shopName', 'shop_name', 'shopname', 'nom_boutique', 'boutique'],
        shopAddress: ['shopAddress', 'shop_address', 'shopaddress', 'address', 'adresse'],
        shopCity: ['shopCity', 'shop_city', 'shopcity', 'city', 'ville'],
        shopZipCode: ['shopZipCode', 'shop_zip_code', 'shopzipcode', 'zipCode', 'zip', 'postalCode', 'postal_code', 'code_postal']
    };

    // Fonction pour trouver la valeur d'un champ
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

    // Remplir les champs
    for (const [fieldName, field] of Object.entries(fields)) {
        if (field) {
            const value = findFieldValue(fieldName);
            field.value = value;
        }
    }

    // Formatage spécial pour téléphone et code postal
    if (fields.phone) {
        fields.phone.value = cleanNumericInput(fields.phone.value);
    }
    if (fields.shopZipCode) {
        fields.shopZipCode.value = cleanNumericInput(fields.shopZipCode.value);
    }
}

/**
 * Configure la validation en temps réel des champs du formulaire
 * Version simplifiée qui évite les notifications d'erreur intempestives
 * @param {HTMLFormElement} form - Le formulaire à valider
 */
function setupRealtimeValidation(form) {
    if (!form) {
        console.error('Form not found for real-time validation');
        return;
    }

    // Obtenir tous les champs de saisie (sauf les mots de passe qui sont gérés séparément)
    const inputFields = form.querySelectorAll('input:not([type="password"])');
    
    // Configurer la validation pour chaque champ
    inputFields.forEach(field => {
        // Ignorer les champs cachés ou de type submit
        if (field.type === 'hidden' || field.type === 'submit') {
            return;
        }
        
        // Suppression des messages d'erreur lorsque l'utilisateur recommence à taper
        field.addEventListener('input', () => {
            field.classList.remove('input-error');
            removeErrorMessage(field);
        });
        
        // Validation uniquement à la perte de focus (blur)
        field.addEventListener('blur', () => {
            validateField(field, true);
        });
    });
    
    // Pour les champs de type email, téléphone et code postal, validation en temps réel
    const specialFields = form.querySelectorAll('#email, #phone, #shopZipCode');
    specialFields.forEach(field => {
        field.addEventListener('input', () => {
            // Validation sans affichage d'erreur pendant la saisie
            validateField(field, false);
        });
    });
    
    console.log('Real-time validation setup completed for form:', form.id);
}

/**
 * Valide un champ spécifique selon son type
 * @param {HTMLInputElement} field - Le champ à valider
 * @param {boolean} showErrors - Indique si les erreurs doivent être affichées
 * @returns {boolean} - True si le champ est valide
 */
function validateField(field, showErrors = true) {
    if (!field) return false;
    
    let isValid = true;
    
    // Vérifier si le champ est vide pour les champs requis
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone', 
        'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];
    
    if (requiredFields.includes(field.id) && !field.value.trim()) {
        if (showErrors) {
            field.classList.add('input-error');
            showErrorMessage(field, 'Ce champ est requis');
        }
        isValid = false;
    } else {
        // Validations spécifiques selon le type de champ
        switch (field.id) {
            case 'email':
                if (field.value && !isValidEmail(field.value)) {
                    if (showErrors) {
                        field.classList.add('input-error');
                        showErrorMessage(field, 'Veuillez saisir une adresse email valide');
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
                        showErrorMessage(field, 'Veuillez saisir un numéro de téléphone valide');
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
                        showErrorMessage(field, 'Veuillez saisir un code postal valide');
                    }
                    isValid = false;
                } else {
                    field.classList.remove('input-error');
                    if (showErrors) removeErrorMessage(field);
                }
                break;
                
            default:
                // Les autres champs sont valides s'ils ont une valeur
                field.classList.remove('input-error');
                if (showErrors) removeErrorMessage(field);
                break;
        }
    }
    
    return isValid;
}


/**
 * Validation du champ email
 * @param {HTMLInputElement} emailField - Champ email
 * @returns {boolean} Validité du champ
 */
function validateEmailField(emailField) {
    if (emailField.value && !isValidEmail(emailField.value)) {
        emailField.classList.add('input-error');
        showErrorMessage(emailField, 'Veuillez saisir une adresse email valide');
        return false;
    }
    emailField.classList.remove('input-error');
    removeErrorMessage(emailField);
    return true;
}

/**
 * Validation du champ téléphone
 * @param {HTMLInputElement} phoneField - Champ téléphone
 * @returns {boolean} Validité du champ
 */
function validatePhoneField(phoneField) {
    if (phoneField.value && !isValidPhone(phoneField.value)) {
        phoneField.classList.add('input-error');
        showErrorMessage(phoneField, 'Veuillez saisir un numéro de téléphone valide (10 chiffres)');
        return false;
    }
    phoneField.classList.remove('input-error');
    removeErrorMessage(phoneField);
    return true;
}

/**
 * Validation du champ code postal
 * @param {HTMLInputElement} zipCodeField - Champ code postal
 * @returns {boolean} Validité du champ
 */
function validateZipCodeField(zipCodeField) {
    if (zipCodeField.value && !isValidZipCode(zipCodeField.value)) {
        zipCodeField.classList.add('input-error');
        showErrorMessage(zipCodeField, 'Veuillez saisir un code postal valide');
        return false;
    }
    zipCodeField.classList.remove('input-error');
    removeErrorMessage(zipCodeField);
    return true;
}



/**
 * Collecte les données du formulaire
 * @returns {Object} Données du profil
 */
function collectProfileData() {
    return {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        fullName: `${document.getElementById('firstName').value.trim()} ${document.getElementById('lastName').value.trim()}`,
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        shopName: document.getElementById('shopName').value.trim(),
        shopAddress: document.getElementById('shopAddress').value.trim(),
        shopCity: document.getElementById('shopCity').value.trim(),
        shopZipCode: document.getElementById('shopZipCode').value.trim(),
        // Ajouter des variantes pour la compatibilité
        address: document.getElementById('shopAddress').value.trim(),
        city: document.getElementById('shopCity').value.trim(),
        postalCode: document.getElementById('shopZipCode').value.trim(),
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Affiche un message d'erreur pour un champ
 * @param {HTMLElement} field - Champ concerné
 * @param {string} message - Message d'erreur
 */
function showErrorMessage(field, message) {
    removeErrorMessage(field);
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message visible';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
}

/**
 * Supprime le message d'erreur d'un champ
 * @param {HTMLElement} field - Champ concerné
 */
function removeErrorMessage(field) {
    const errorElement = field.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Réinitialise les champs du formulaire
 */
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

/**
 * Désactive le script inline de gestion du formulaire
 * Cette fonction est appelée au démarrage pour éviter les conflits
 */
function disableInlineFormHandler() {
    // Chercher si un gestionnaire inline existe
    const profileForm = document.getElementById('profileForm');
    if (profileForm && !profileForm.getAttribute('data-handler-overridden')) {
        // Marquer le formulaire comme traité
        profileForm.setAttribute('data-handler-overridden', 'true');
        
        // Enregistrer une fonction qui désactive les autres gestionnaires
        const originalSubmit = profileForm.submit;
        profileForm.submit = function() {
            console.log('Tentative de soumission native bloquée, utilisation du gestionnaire moduleProfileManager');
            return false;
        };
        
        console.log('Gestionnaire de formulaire inline désactivé');
    }
}

/**
 * Initialisation complète du module de profil
 * Cette fonction doit être appelée avant tout autre script inline
 */
function initCompleteProfileManager() {
    // Désactiver les gestionnaires inline conflictuels
    disableInlineFormHandler();
    
    // Initialiser normalement
    initProfileManager();
    
    console.log('Module de profil complètement initialisé avec priorité sur les scripts inline');
}

// Initialisation au chargement du document
document.addEventListener('DOMContentLoaded', function() {
    // Utiliser l'initialisation complète qui contourne les conflits
    initCompleteProfileManager();
});

// Exporter les fonctions publiques
export { 
    initProfileManager,
    initCompleteProfileManager,
    loadUserProfile, 
    handleProfileSubmit,
    resetFormFields
};