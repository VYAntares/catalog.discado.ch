// Admin header dropdown menu
(function () {
    function initAdminMenu() {
        const btn = document.getElementById('adminMenuToggle');
        const dropdown = document.getElementById('adminDropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            btn.classList.toggle('active', isOpen);
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        document.addEventListener('click', function () {
            dropdown.classList.remove('open');
            btn.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
        });

        dropdown.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                dropdown.classList.remove('open');
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdminMenu);
    } else {
        initAdminMenu();
    }
})();
