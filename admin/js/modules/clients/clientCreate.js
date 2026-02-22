/**
 * Création d'un nouveau client
 * admin/js/modules/clients/clientCreate.js
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Modal from '../../utils/modal.js';
import * as ClientList from './clientList.js';

let createClientModal;
let createClientForm;
let usernameField;
let passwordField;
let submitBtn;
let cancelBtn;


//Affiche la modale de création d'un client
function showCreateClientModal() {
    createClientModal = document.getElementById('createClientModal');
    createClientForm = document.getElementById('createClientForm');
    usernameField = document.getElementById('newUsername');
    passwordField = document.getElementById('newPassword');
    submitBtn = document.getElementById('submitClientForm');
    cancelBtn = document.getElementById('cancelClientForm');
    
    if (!createClientModal || !createClientForm) return;
    
    createClientForm.reset();
    Modal.showModal(createClientModal);
    
    if (usernameField) usernameField.focus();
    setupFormEvents();
}

//Configure les écouteurs d'événements pour le formulaire
function setupFormEvents() {
    if (submitBtn) submitBtn.addEventListener('click', handleFormSubmit);
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            Modal.hideModal(createClientModal);
        });
    }
    
    const closeBtn = createClientModal.querySelector('.close-create-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            Modal.hideModal(createClientModal);
        });
    }
    
    usernameField.addEventListener('input', validateUsername);
    passwordField.addEventListener('input', validatePassword);
}

//Valide le nom d'utilisateur
function validateUsername() {
    const username = usernameField.value.trim();
    
    if (username.length < 3) {
        showFieldError(usernameField, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return false;
    }
    
    if (!/^[a-zA-Z0-9_@.+\-]+$/.test(username)) {
        showFieldError(usernameField, 'Le nom d\'utilisateur ne peut contenir que des lettres, des chiffres et des underscores');
        return false;
    }
    
    clearFieldError(usernameField);
    return true;
}

//Valide le mot de passe
function validatePassword() {
    const password = passwordField.value;
    
    if (password.length < 6) {
        showFieldError(passwordField, 'Le mot de passe doit contenir au moins 6 caractères');
        return false;
    }
    
    clearFieldError(passwordField);
    return true;
}

//Affiche un message d'erreur pour un champ
function showFieldError(field, message) {
    clearFieldError(field);
    field.classList.add('error-field');
    
    let errorElement = field.parentNode.querySelector('.field-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        field.parentNode.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

//Efface le message d'erreur d'un champ
function clearFieldError(field) {
    field.classList.remove('error-field');
    
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) errorElement.style.display = 'none';
}

//Gère la soumission du formulaire
async function handleFormSubmit() {
    if (!validateUsername() || !validatePassword()) {
        Notification.showNotification("Veuillez corriger les erreurs du formulaire", "error");
        return;
    }
    
    const username = usernameField.value.trim();
    const password = passwordField.value;
    
    const profileData = {
        firstName: document.getElementById('firstName')?.value.trim() || '',
        lastName: document.getElementById('lastName')?.value.trim() || '',
        email: document.getElementById('email')?.value.trim() || '',
        phone: document.getElementById('phone')?.value.trim() || '',
        shopName: document.getElementById('shopName')?.value.trim() || '',
        shopAddress: document.getElementById('shopAddress')?.value.trim() || '',
        shopCity: document.getElementById('shopCity')?.value.trim() || '',
        shopZipCode: document.getElementById('shopZipCode')?.value.trim() || '',
        lastUpdated: new Date().toISOString()
    };
    
    const referralSourceElement = document.getElementById('referralSource');
    if (referralSourceElement) {
        profileData.referralSource = referralSourceElement.value.trim() || '';
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création en cours...';
    }
    
    try {
        const result = await API.createNewClient({
            username,
            password,
            profileData
        });
        
        if (result.success) {
            // Success notification already shown by API.createNewClient()
            Modal.hideModal(createClientModal);
            createClientForm.reset();
            ClientList.refreshClientList();
        } else {
            Notification.showNotification('Erreur : ' + (result.message || 'Veuillez réessayer'), 'error');
        }
    } catch (error) {
        Notification.showNotification('Erreur lors de la création du client', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer le client';
        }
    }
}

export {
    showCreateClientModal,
    validateUsername,
    validatePassword,
    handleFormSubmit
};