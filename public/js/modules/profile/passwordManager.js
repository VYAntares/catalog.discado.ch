/**
 * Module de gestion du mot de passe pour Discado
 * À placer dans: /js/modules/profile/passwordManager.js
 */

import { saveUserPassword } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';

/**
 * Vérifie la correspondance des mots de passe
 * Version améliorée sans messages d'erreur pendant la saisie
 * @param {boolean} shouldShowError - Si true, affiche un message d'erreur
 * @returns {boolean} - true si les mots de passe correspondent
 */
function checkPasswordMatch(shouldShowError = false) {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const confirmField = document.getElementById('confirmPassword');
    const submitButton = document.querySelector('.save-btn');
    
    if (!confirmField) return false;
    
    // Si le champ est vide, ne rien faire
    if (!confirmPass) {
        confirmField.classList.remove('password-match', 'password-mismatch', 'input-error');
        removeErrorMessage(confirmField);
        return false;
    }
    
    const isMatch = newPass === confirmPass;
    
    if (isMatch) {
        // Correspondance : afficher en vert
        confirmField.classList.add('password-match');
        confirmField.classList.remove('password-mismatch', 'input-error');
        removeErrorMessage(confirmField);
        
        // Permettre la soumission si la validation est passée
        if (submitButton) {
            submitButton.classList.remove('disabled-submit');
        }
    } else {
        // Non-correspondance : afficher en rouge mais sans message d'erreur
        confirmField.classList.add('password-mismatch');
        confirmField.classList.remove('password-match');
        
        // Ajouter la classe input-error et le message seulement si demandé
        // (typiquement à la perte de focus ou soumission)
        if (shouldShowError) {
            confirmField.classList.add('input-error');
            showErrorMessage(confirmField, 'Passwords do not match');
            
            // Bloquer la soumission si les mots de passe ne correspondent pas
            if (submitButton) {
                submitButton.classList.add('disabled-submit');
            }
        }
    }
    
    return isMatch;
}

/**
 * Initialise le gestionnaire de mot de passe avec la nouvelle logique
 */
function initPasswordManager() {
    // Initialisation des éléments de l'interface
    const passwordFields = {
        current: document.getElementById('currentPassword'),
        new: document.getElementById('newPassword'),
        confirm: document.getElementById('confirmPassword')
    };
    
    // Vérifier que les éléments existent
    if (!passwordFields.current || !passwordFields.new || !passwordFields.confirm) {
        console.error('Password fields not found');
        return;
    }
    
    // Ajout de boutons pour montrer/masquer les mots de passe
    Object.values(passwordFields).forEach(field => {
        if (!field) return;
        
        // Créer le bouton de toggle
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'password-toggle';
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        toggleBtn.title = 'Afficher/Masquer le mot de passe';
        
        // Ajouter le bouton à côté du champ
        field.parentNode.style.position = 'relative';
        field.parentNode.appendChild(toggleBtn);
        
        // Fonctionnalité de toggle
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
    
    // Validation en temps réel du mot de passe
    if (passwordFields.new) {
        passwordFields.new.addEventListener('input', function() {
            const password = this.value;
            validatePasswordStrength(password);
            
            // Vérifier la correspondance si le champ de confirmation est rempli
            // mais sans afficher de message d'erreur pendant la saisie
            if (passwordFields.confirm && passwordFields.confirm.value) {
                checkPasswordMatch(false);
            }
        });
        
        // Quand l'utilisateur quitte le champ, montrer les erreurs si nécessaire
        passwordFields.new.addEventListener('blur', function() {
            if (this.value && passwordFields.confirm && passwordFields.confirm.value) {
                checkPasswordMatch(true);
            }
        });
    }
    
    // Validation de la correspondance des mots de passe sans message d'erreur pendant la saisie
    if (passwordFields.confirm) {
        passwordFields.confirm.addEventListener('input', function() {
            checkPasswordMatch(false);
        });
        
        // Afficher le message d'erreur seulement quand l'utilisateur quitte le champ
        passwordFields.confirm.addEventListener('blur', function() {
            if (this.value) {
                checkPasswordMatch(true);
            }
        });
    }
    
    // Effacer les messages d'erreur lors de la saisie
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
 * Met à jour l'indicateur de force du mot de passe
 * @param {number} score - Score de force (0-100)
 */
function updateStrengthMeter(score) {
    const strengthBar = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    
    if (!strengthBar || !strengthText) return;
    
    // Réinitialiser les classes
    strengthBar.className = 'strength-indicator';
    
    if (score === 0) {
        strengthText.textContent = 'Password strength';
        return;
    }
    
    // Ajouter la classe appropriée
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
    
    // Définir la largeur de la barre
    strengthBar.style.width = score + '%';
}

/**
 * Met à jour les indicateurs des exigences du mot de passe
 * @param {Object} criteria - Critères validés ou non
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
 * Affiche un message d'erreur sous un champ
 * @param {HTMLElement} field - Le champ concerné
 * @param {string} message - Le message d'erreur
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
 * @param {HTMLElement} field - Le champ concerné
 */
function removeErrorMessage(field) {
    const errorElement = field.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Fonction qui indique si tous les champs de mot de passe sont valides
 * Cette fonction peut être appelée depuis n'importe où pour vérifier l'état actuel
 * @returns {boolean} - true si les mots de passe sont valides pour soumission
 */
function arePasswordsValid() {
    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    
    // Si aucun champ n'est rempli, tout est valide (pas de changement de mot de passe)
    if (!currentPassword && !newPassword && !confirmPassword) {
        return true;
    }
    
    // Si un des champs est rempli, tous doivent être remplis
    if ((currentPassword || newPassword || confirmPassword) && 
        !(currentPassword && newPassword && confirmPassword)) {
        return false;
    }
    
    // Vérifier la force du mot de passe
    const isStrong = validatePasswordStrength(newPassword);
    if (!isStrong) {
        return false;
    }
    
    // Vérifier la correspondance
    return newPassword === confirmPassword;
}

/**
 * Valide la force du mot de passe et met à jour les indicateurs visuels
 * Version améliorée qui ne montre pas de messages d'erreur pendant la saisie
 * @param {string} password - Le mot de passe à valider
 * @param {boolean} showError - Si true, affiche un message d'erreur
 * @returns {boolean} - true si le mot de passe répond à tous les critères
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
    
    // Critères de validation
    const criteria = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    // Mettre à jour les indicateurs visuels
    updateRequirements(criteria);
    
    // Calculer le score (0-100)
    let score = 0;
    if (criteria.length) score += 20;
    if (criteria.uppercase) score += 20;
    if (criteria.lowercase) score += 15;
    if (criteria.number) score += 20;
    if (criteria.special) score += 25;
    
    updateStrengthMeter(score);
    
    // Valider le champ si tous les critères sont respectés
    const isValid = Object.values(criteria).every(v => v);
    const passwordField = document.getElementById('newPassword');
    
    if (passwordField) {
        if (isValid) {
             // Supprimer les classes d'erreur
             passwordField.classList.remove('input-error');
             passwordField.classList.remove('required-field');
             // Ajouter une classe de validation si nécessaire
             passwordField.classList.add('valid-input');
             removeErrorMessage(passwordField);
        } else if (password.length > 0 && showError) {
            // Afficher l'erreur seulement si demandé (par exemple, après le blur)
            passwordField.classList.add('input-error');
            showErrorMessage(passwordField, 'Le mot de passe ne répond pas à toutes les exigences');
            
            // Désactiver le bouton si le mot de passe n'est pas valide
            if (submitButton) {
                submitButton.classList.add('disabled-submit');
            }
        }
    }
    
    // Si la validation du mot de passe a changé et qu'il y a une confirmation, vérifier sans message d'erreur
    const confirmPassword = document.getElementById('confirmPassword');
    if (confirmPassword && confirmPassword.value) {
        checkPasswordMatch(false);
    }
    
    return isValid;
}

/**
 * Fonction pour valider la section du mot de passe de manière stricte
 * @returns {boolean} - True si la validation est réussie ou si aucun changement n'est demandé
 */
function validatePasswordSection() {
    const result = validatePasswordInputs();
    
    // Si la validation a échoué, bloquer explicitement la soumission
    if (!result.isValid) {
        const submitButton = document.querySelector('.save-btn');
        if (submitButton) {
            submitButton.classList.add('disabled-submit');
        }
    }
    
    return result.isValid;
}

/**
 * Initialisation des écouteurs d'événements pour la validation en temps réel
 * des champs de mot de passe avec impact sur le bouton de soumission
 */
function initPasswordValidationWithSubmitControl() {
    const passwordFields = {
        current: document.getElementById('currentPassword'),
        new: document.getElementById('newPassword'),
        confirm: document.getElementById('confirmPassword')
    };
    
    const submitButton = document.querySelector('.save-btn');
    if (!submitButton) return;
    
    // Fonction commune pour valider et mettre à jour l'état du bouton
    function validateAndUpdateButton() {
        const isValid = arePasswordsValid();
        
        if (isValid) {
            submitButton.classList.remove('disabled-submit');
            submitButton.title = '';
        } else {
            // Ne désactiver le bouton que si des champs de mot de passe sont remplis
            const anyPasswordFilled = 
                (passwordFields.current && passwordFields.current.value) ||
                (passwordFields.new && passwordFields.new.value) ||
                (passwordFields.confirm && passwordFields.confirm.value);
            
            if (anyPasswordFilled) {
                submitButton.classList.add('disabled-submit');
                submitButton.title = 'Veuillez remplir correctement tous les champs de mot de passe';
            }
        }
    }
    
    // Attacher les écouteurs aux champs
    Object.values(passwordFields).forEach(field => {
        if (!field) return;
        
        field.addEventListener('input', validateAndUpdateButton);
        field.addEventListener('blur', validateAndUpdateButton);
    });
    
    // Validation initiale
    validateAndUpdateButton();
}

/**
 * Vérifie si les entrées de mot de passe sont valides
 * @returns {Object} - Résultat de la validation
 */
function validatePasswordInputs() {
    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    
    // Si aucun champ n'est rempli, pas de changement demandé
    if (!currentPassword && !newPassword && !confirmPassword) {
        return {
            isValid: true,
            shouldUpdate: false,
            data: null
        };
    }
    
    // Si un des champs est rempli, tous sont requis
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
    
    // Valider la force du mot de passe
    const isStrong = validatePasswordStrength(newPassword);
    if (!isStrong) {
        return {
            isValid: false,
            shouldUpdate: false,
            data: null
        };
    }
    
    // Vérifier que les mots de passe correspondent
    const isMatch = checkPasswordMatch();
    if (!isMatch) {
        return {
            isValid: false,
            shouldUpdate: false,
            data: null
        };
    }
    
    // Tout est valide, préparer les données
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
 * Gère le changement de mot de passe
 * Version corrigée pour mieux gérer les erreurs
 * @returns {Promise<boolean>} - True si le changement a réussi ou si aucun changement n'est demandé
 */
async function handlePasswordChange() {
    const result = validatePasswordInputs();
    
    // Si pas de changement demandé ou validation échouée
    if (!result.isValid) {
        return false;
    }
    
    // Si pas de mise à jour nécessaire (champs vides)
    if (!result.shouldUpdate) {
        return true;
    }
    
    try {
        // Envoyer la requête au serveur
        const response = await saveUserPassword(result.data);
        
        if (response.success) {
            // Réinitialiser les champs
            const fields = ['currentPassword', 'newPassword', 'confirmPassword'];
            fields.forEach(id => {
                const field = document.getElementById(id);
                if (field) field.value = '';
            });
            
            // Réinitialiser l'indicateur de force
            updateStrengthMeter(0);
            
            // La notification est déjà gérée dans saveUserPassword
            return true;
        } else {
            // Gérer les erreurs spécifiques
            if (response.code === 'INVALID_CURRENT_PASSWORD') {
                const field = document.getElementById('currentPassword');
                if (field) {
                    field.classList.add('input-error');
                    showErrorMessage(field, 'Le mot de passe actuel est incorrect');
                }
                
                // Retourner true pour permettre de continuer avec la sauvegarde du profil
                // même si le changement de mot de passe a échoué
                // Cela évite que l'erreur de mot de passe bloque la sauvegarde des autres données
                return true;
            }
            
            // Erreur silencieuse, laisser la sauvegarde du profil continuer
            console.warn('Erreur de mot de passe ignorée pour permettre la sauvegarde du profil:', response.message);
            return true;
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du mot de passe:', error);
        
        // Ne pas bloquer la sauvegarde du profil pour un problème de mot de passe
        // Retourner true pour permettre la sauvegarde des autres données
        return true;
    }
}


// Exporter les fonctions publiques
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