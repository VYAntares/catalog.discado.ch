/**
 * Reset Password page logic
 * public/js/reset-password.js
 */
document.addEventListener('DOMContentLoaded', async function() {
  const loadingState = document.getElementById('loading-state');
  const invalidToken = document.getElementById('invalid-token');
  const resetForm = document.getElementById('resetForm');
  const passwordField = document.getElementById('password');
  const confirmField = document.getElementById('confirmPassword');
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const successMessage = document.getElementById('success-message');
  const successText = document.getElementById('success-text');
  const submitBtn = document.getElementById('submitBtn');
  const passwordToggle = document.getElementById('password-toggle');
  const confirmToggle = document.getElementById('confirm-toggle');

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showInvalidToken();
    return;
  }

  // Verify token validity
  try {
    const response = await fetch(`/api/verify-reset-token?token=${encodeURIComponent(token)}`);
    const data = await response.json();

    if (data.valid) {
      showResetForm();
    } else {
      showInvalidToken();
    }
  } catch (err) {
    showInvalidToken();
  }

  // Password visibility toggles
  passwordToggle.addEventListener('click', function() {
    togglePasswordVisibility(passwordField, this);
  });

  confirmToggle.addEventListener('click', function() {
    togglePasswordVisibility(confirmField, this);
  });

  function togglePasswordVisibility(field, btn) {
    const type = field.getAttribute('type') === 'password' ? 'text' : 'password';
    field.setAttribute('type', type);
    const icon = btn.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  }

  // Password strength checking
  passwordField.addEventListener('input', function() {
    const pwd = this.value;
    updateCriteria('crit-length', pwd.length >= 8);
    updateCriteria('crit-upper', /[A-Z]/.test(pwd));
    updateCriteria('crit-lower', /[a-z]/.test(pwd));
    updateCriteria('crit-number', /[0-9]/.test(pwd));
    updateCriteria('crit-special', /[^A-Za-z0-9]/.test(pwd));
  });

  function updateCriteria(id, valid) {
    const el = document.getElementById(id);
    const icon = el.querySelector('i');

    if (valid) {
      el.classList.add('valid');
      el.classList.remove('invalid');
      icon.className = 'fas fa-check-circle';
    } else {
      el.classList.remove('valid');
      el.classList.add('invalid');
      icon.className = 'fas fa-circle';
    }
  }

  // Form submission
  resetForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideMessages();
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const password = passwordField.value;
    const confirmPassword = confirmField.value;

    // Validate passwords match
    if (password !== confirmPassword) {
      showError('Les mots de passe ne correspondent pas.');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      return;
    }

    // Validate password strength
    const isStrong = password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!isStrong) {
      showError('Le mot de passe ne respecte pas tous les critères de sécurité.');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      return;
    }

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'same-origin'
      });

      const data = await response.json();

      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;

      if (response.ok && data.success) {
        showSuccess(data.message + ' Redirection en cours...');
        // Disable form
        passwordField.disabled = true;
        confirmField.disabled = true;
        submitBtn.style.display = 'none';

        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/pages/login.html';
        }, 3000);
      } else {
        showError(data.message || 'Une erreur est survenue.');
        // If token expired during the process, show invalid state
        if (data.message && data.message.includes('expiré')) {
          setTimeout(() => showInvalidToken(), 2000);
        }
      }
    } catch (err) {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      showError('Erreur de connexion. Veuillez réessayer.');
    }
  });

  function showInvalidToken() {
    loadingState.style.display = 'none';
    resetForm.style.display = 'none';
    invalidToken.style.display = 'block';
  }

  function showResetForm() {
    loadingState.style.display = 'none';
    invalidToken.style.display = 'none';
    resetForm.style.display = 'block';
    passwordField.focus();
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorMessage.classList.add('visible');
    errorMessage.style.display = 'flex';
    successMessage.style.display = 'none';
    successMessage.classList.remove('visible');
  }

  function showSuccess(msg) {
    successText.textContent = msg;
    successMessage.classList.add('visible');
    successMessage.style.display = 'flex';
    errorMessage.style.display = 'none';
    errorMessage.classList.remove('visible');
  }

  function hideMessages() {
    errorMessage.style.display = 'none';
    errorMessage.classList.remove('visible');
    successMessage.style.display = 'none';
    successMessage.classList.remove('visible');
  }
});
