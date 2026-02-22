/**
 * Login page logic — AJAX submission with inline error feedback
 * public/js/login.js
 */
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('loginForm');
  const usernameField = document.getElementById('username');
  const passwordField = document.getElementById('password');
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const attemptsWarning = document.getElementById('attempts-warning');
  const attemptsText = document.getElementById('attempts-text');
  const loginBtn = form.querySelector('.login-button');
  const passwordToggle = document.getElementById('password-toggle');

  // Pre-fill username if passed as URL param (e.g. from shared invoice link)
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledUsername = urlParams.get('username');
  if (prefilledUsername) {
    usernameField.value = prefilledUsername;
    passwordField.focus();
  } else {
    usernameField.focus();
  }

  // Password visibility toggle
  passwordToggle.addEventListener('click', function() {
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  });

  // AJAX form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Reset previous state
    hideError();
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    const username = usernameField.value.trim();
    const password = passwordField.value;

    if (!username || !password) {
      showError('Please fill in all fields.');
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
      return;
    }

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'same-origin'
      });

      const data = await response.json();

      if (data.success && data.redirect) {
        // Si un redirect est passé en URL param (ex: depuis la page shared invoices)
        // On l'utilise sauf si le serveur force vers profile (mot de passe faible / profil incomplet)
        const redirectParam = urlParams.get('redirect');
        const isForced = data.redirect === '/pages/profile.html';
        if (redirectParam && !isForced && redirectParam.startsWith('/pages/')) {
          window.location.href = redirectParam;
        } else {
          window.location.href = data.redirect;
        }
        return;
      }

      // Login failed
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;

      if (data.locked) {
        showError(data.message || 'Account temporarily locked.');
        showAttempts(0);
        shakeField(passwordField);
        shakeField(usernameField);
      } else {
        showError('Invalid username or password.');
        shakeField(passwordField);

        if (typeof data.remainingAttempts === 'number') {
          showAttempts(data.remainingAttempts);
        }
      }

      // Select password for quick re-entry
      passwordField.value = '';
      passwordField.focus();

    } catch (err) {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
      showError('Connection error. Please try again.');
    }
  });

  function showError(msg) {
    errorText.textContent = msg;
    errorMessage.classList.add('visible');
  }

  function hideError() {
    errorMessage.classList.remove('visible');
    attemptsWarning.classList.remove('visible');
  }

  function showAttempts(remaining) {
    if (remaining <= 0) {
      attemptsText.textContent = 'Account locked. Try again in 15 minutes.';
    } else {
      attemptsText.textContent = `${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
    }
    attemptsWarning.classList.add('visible');
  }

  function shakeField(field) {
    const wrapper = field.closest('.input-wrapper');
    wrapper.classList.add('shake');
    wrapper.addEventListener('animationend', () => {
      wrapper.classList.remove('shake');
    }, { once: true });
  }
});
