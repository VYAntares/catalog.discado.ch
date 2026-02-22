/**
 * Profile page — Password validation UI
 * Extracted from profile.html inline <script>
 */
function setupPasswordValidationUI() {
  var currentPassword = document.getElementById('currentPassword');
  var newPassword = document.getElementById('newPassword');
  var confirmPassword = document.getElementById('confirmPassword');
  var submitButton = document.querySelector('.save-btn');
  var passwordForm = document.getElementById('profileForm');

  if (!currentPassword || !newPassword || !confirmPassword || !submitButton || !passwordForm) {
    console.warn('Required elements for password validation not found');
    return;
  }

  function validatePasswordFields() {
    // If no field is filled, no validation needed
    if (!currentPassword.value && !newPassword.value && !confirmPassword.value) {
      submitButton.classList.remove('disabled-submit');
      return true;
    }

    // If one field is filled, all must be filled
    if ((currentPassword.value || newPassword.value || confirmPassword.value) &&
        !(currentPassword.value && newPassword.value && confirmPassword.value)) {
      submitButton.classList.add('disabled-submit');
      submitButton.title = 'All password fields must be filled';
      return false;
    }

    // Check password strength criteria
    var criteriaList = document.querySelectorAll('.password-requirements li');
    var isStrongPassword = true;

    criteriaList.forEach(function(criterion) {
      if (!criterion.classList.contains('valid')) {
        isStrongPassword = false;
      }
    });

    if (!isStrongPassword) {
      submitButton.classList.add('disabled-submit');
      submitButton.title = 'Password must meet all requirements';
      return false;
    }

    // Check passwords match
    if (newPassword.value !== confirmPassword.value) {
      submitButton.classList.add('disabled-submit');
      confirmPassword.classList.add('password-mismatch');
      confirmPassword.classList.remove('password-match');

      var existingError = confirmPassword.parentNode.querySelector('.error-message');
      if (!existingError) {
        var errorMessage = document.createElement('div');
        errorMessage.className = 'error-message visible';
        errorMessage.textContent = 'Passwords do not match';
        confirmPassword.parentNode.appendChild(errorMessage);
      }

      submitButton.title = 'Passwords do not match';
      return false;
    } else {
      confirmPassword.classList.add('password-match');
      confirmPassword.classList.remove('password-mismatch');

      var existingError = confirmPassword.parentNode.querySelector('.error-message');
      if (existingError) {
        existingError.remove();
      }
    }

    // Everything is valid
    submitButton.classList.remove('disabled-submit');
    submitButton.title = '';
    return true;
  }

  // Attach events to fields
  [currentPassword, newPassword, confirmPassword].forEach(function(field) {
    field.addEventListener('input', validatePasswordFields);
    field.addEventListener('blur', validatePasswordFields);
  });

  // Intercept form submission
  passwordForm.addEventListener('submit', function(event) {
    if (!validatePasswordFields()) {
      event.preventDefault();
      event.stopPropagation();

      if (!currentPassword.value && (newPassword.value || confirmPassword.value)) {
        currentPassword.classList.add('input-error');

        var existingError = currentPassword.parentNode.querySelector('.error-message');
        if (!existingError) {
          var errorMessage = document.createElement('div');
          errorMessage.className = 'error-message visible';
          errorMessage.textContent = 'Current password is required';
          currentPassword.parentNode.appendChild(errorMessage);
        }
      }

      if (newPassword.value !== confirmPassword.value) {
        confirmPassword.focus();
      }

      return false;
    }

    return true;
  }, true);

  // Initial validation
  validatePasswordFields();

  console.log('Password validation configured');
}

// Setup immediately if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setupPasswordValidationUI();
} else {
  document.addEventListener('DOMContentLoaded', setupPasswordValidationUI);
}
