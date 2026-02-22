/**
 * Welcome page logic — auth check & redirect
 * Extracted from index.html inline <script>
 */
document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/check-auth')
    .then(function(response) {
      if (response.ok) return response.json();
      return null;
    })
    .then(function(data) {
      if (!data) return;

      var authStatus = document.getElementById('auth-status');
      var loginBtn = document.getElementById('login-btn');

      authStatus.innerHTML = '<i class="fas fa-check-circle"></i> Welcome back, ' + (data.username || 'User') + '!';
      authStatus.classList.add('logged-in');
      authStatus.style.display = 'block';

      loginBtn.innerHTML = '<i class="fas fa-user"></i> My Account';
      loginBtn.href = '/pages/profile.html';

      setTimeout(function() {
        window.location.href = '/pages/catalog.html';
      }, 1500);
    })
    .catch(function(error) {
      console.log('Network error:', error);
    });
});
