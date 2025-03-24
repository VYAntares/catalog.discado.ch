/**
 * Utilitaires d'interface utilisateur
 * admin/js/utils/ui.js
 */

// Initialise les onglets et leur comportement
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn, .tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (btn.tagName === 'A' && !btn.getAttribute('href').startsWith('#')) {
                return;
            }
            
            e.preventDefault();
            
            activateTab(this.getAttribute('data-tab') || this.getAttribute('href').substring(1));
        });
    });
}

// Active un onglet spécifique
function activateTab(tabId) {
    const tabBtns = document.querySelectorAll('.tab-btn, .tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const activeBtn = document.querySelector(`[data-tab="${tabId}"], [href="#${tabId}"]`);
    const activeContent = document.getElementById(`${tabId}-tab`);
    
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    if (activeContent) {
        activeContent.classList.add('active');
    }
    
    document.dispatchEvent(new CustomEvent('tabChanged', { 
        detail: { tabId: tabId }
    }));
}

// Gère la navigation entre les pages
function handlePageNavigation(url, newTab = false) {
    if (newTab) {
        window.open(url, '_blank');
    } else {
        window.location.href = url;
    }
}

// Anime un élément (fade in/out, slide, etc.)
function animateElement(element, animation, duration = 300) {
    return new Promise(resolve => {
        if (!element) {
            resolve();
            return;
        }
        
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
        
        setTimeout(() => {
            if (animation === 'fadeOut' || animation === 'slideUp') {
                element.style.display = 'none';
            }
            
            if (animation === 'slideDown') {
                element.style.height = '';
                element.style.overflow = '';
            }
            
            resolve();
        }, duration);
    });
}

// Toggle un élément (afficher/masquer)
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

export {
    initTabs,
    activateTab,
    handlePageNavigation,
    animateElement,
    toggleElement
}