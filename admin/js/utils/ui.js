/**
 * Utilitaires d'interface utilisateur
 * Ce module gère les interactions avec l'UI globale (onglets, navigation, etc.)
 */

/**
 * Initialise les onglets et leur comportement
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn, .tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Si c'est un lien, empêcher la navigation par défaut
            if (btn.tagName === 'A' && !btn.getAttribute('href').startsWith('#')) {
                return; // Laisser le navigateur gérer les liens externes
            }
            
            e.preventDefault();
            
            // Activer l'onglet cliqué
            activateTab(this.getAttribute('data-tab') || this.getAttribute('href').substring(1));
        });
    });
}

/**
 * Active un onglet spécifique
 * @param {string} tabId - ID de l'onglet à activer
 */
function activateTab(tabId) {
    // Désactiver tous les onglets
    const tabBtns = document.querySelectorAll('.tab-btn, .tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Activer l'onglet demandé
    const activeBtn = document.querySelector(`[data-tab="${tabId}"], [href="#${tabId}"]`);
    const activeContent = document.getElementById(`${tabId}-tab`);
    
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    if (activeContent) {
        activeContent.classList.add('active');
    }
    
    // Déclencher un événement personnalisé pour informer les autres modules
    document.dispatchEvent(new CustomEvent('tabChanged', { 
        detail: { tabId: tabId }
    }));
}

/**
 * Gère la navigation entre les pages
 * @param {string} url - URL de destination
 * @param {boolean} newTab - Ouvrir dans un nouvel onglet
 */
function handlePageNavigation(url, newTab = false) {
    if (newTab) {
        window.open(url, '_blank');
    } else {
        window.location.href = url;
    }
}

/**
 * Anime un élément (fade in/out, slide, etc.)
 * @param {HTMLElement} element - Élément à animer
 * @param {string} animation - Type d'animation
 * @param {number} duration - Durée en millisecondes
 * @returns {Promise} Promise qui se résout à la fin de l'animation
 */
function animateElement(element, animation, duration = 300) {
    return new Promise(resolve => {
        if (!element) {
            resolve();
            return;
        }
        
        // Appliquer l'animation
        switch(animation) {
            case 'fadeIn':
                element.style.opacity = '0';
                element.style.display = 'block';
                setTimeout(() => {
                    element.style.transition = `opacity ${duration}ms ease`;
                    element.style.opacity = '1';
                }, 10);
                break;
                
            case 'fadeOut':
                element.style.transition = `opacity ${duration}ms ease`;
                element.style.opacity = '0';
                break;
                
            case 'slideDown':
                const height = element.scrollHeight;
                element.style.overflow = 'hidden';
                element.style.height = '0';
                element.style.display = 'block';
                element.style.transition = `height ${duration}ms ease`;
                setTimeout(() => {
                    element.style.height = `${height}px`;
                }, 10);
                break;
                
            case 'slideUp':
                element.style.overflow = 'hidden';
                element.style.height = `${element.scrollHeight}px`;
                element.style.transition = `height ${duration}ms ease`;
                setTimeout(() => {
                    element.style.height = '0';
                }, 10);
                break;
        }
        
        // Résoudre la promesse après la fin de l'animation
        setTimeout(() => {
            // Nettoyer après fadeOut ou slideUp
            if (animation === 'fadeOut' || animation === 'slideUp') {
                element.style.display = 'none';
            }
            
            // Nettoyer après slideDown
            if (animation === 'slideDown') {
                element.style.height = '';
                element.style.overflow = '';
            }
            
            resolve();
        }, duration);
    });
}

/**
 * Toggle un élément (afficher/masquer)
 * @param {HTMLElement} element - Élément à toggle
 * @param {boolean} animate - Animer la transition
 */
function toggleElement(element, animate = true) {
    if (!element) return;
    
    const isVisible = element.style.display !== 'none' && 
                       element.offsetParent !== null;
    
    if (animate) {
        if (isVisible) {
            animateElement(element, 'fadeOut');
        } else {
            animateElement(element, 'fadeIn');
        }
    } else {
        element.style.display = isVisible ? 'none' : 'block';
    }
}

// Exposer les fonctions publiques
export {
    initTabs,
    activateTab,
    handlePageNavigation,
    animateElement,
    toggleElement
};