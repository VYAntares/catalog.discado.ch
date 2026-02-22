/**
 * Forgot Password page logic
 * public/js/forgot-password.js
 */
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('forgotForm');
  const emailField = document.getElementById('email');
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const successMessage = document.getElementById('success-message');
  const successText = document.getElementById('success-text');
  const submitBtn = document.getElementById('submitBtn');

  emailField.focus();

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideMessages();
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const email = emailField.value.trim();

    if (!email) {
      showError('Please enter your email address.');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address.');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      return;
    }

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'same-origin'
      });

      const data = await response.json();

      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;

      if (response.ok && data.success) {
        showSuccess(data.message);
        // Disable form after success
        emailField.disabled = true;
        submitBtn.style.display = 'none';
      } else {
        showError(data.message || 'An error occurred.');
      }
    } catch (err) {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      showError('Connection error. Please try again.');
    }
  });

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
