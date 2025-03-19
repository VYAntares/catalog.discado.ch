/**
 * Module de prévisualisation d'image
 * Gère le zoom sur les images de produits
 */

/**
 * Initialise la prévisualisation d'image
 */
export function initImagePreview() {
    // Créer la modal de prévisualisation si elle n'existe pas
    createImagePreviewModal();
    
    // Configurer les événements pour toutes les images de produits
    setupImagePreviews();
    
    // S'abonner à l'événement productsLoaded pour reconfigurer les prévisualisations
    document.addEventListener('productsLoaded', setupImagePreviews);
}

/**
 * Crée la modal de prévisualisation d'image si elle n'existe pas déjà
 */
function createImagePreviewModal() {
    // Vérifier si la modal existe déjà
    if (document.getElementById('image-preview-modal')) return;
    
    // Créer la modal
    const modal = document.createElement('div');
    modal.id = 'image-preview-modal';
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <div class="image-preview-content">
            <span class="close-preview">&times;</span>
            <img class="preview-image" src="" alt="Product preview">
        </div>
    `;
    
    // Ajouter la modal au body
    document.body.appendChild(modal);
    
    // Récupérer les éléments de la modal
    const previewImage = modal.querySelector('.preview-image');
    const closeButton = modal.querySelector('.close-preview');
    
    // Fermer la modal en cliquant sur le bouton de fermeture
    closeButton.addEventListener('click', closeImagePreview);
    
    // Fermer la modal en cliquant en dehors de l'image
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeImagePreview();
        }
    });
    
    // Fermer la modal avec la touche Echap
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeImagePreview();
        }
    });
}

/**
 * Configure les événements pour toutes les images de produits
 */
function setupImagePreviews() {
    const productImages = document.querySelectorAll('.product-img');
    
    productImages.forEach(img => {
        // N'ajouter l'événement que si l'image n'a pas déjà été configurée
        if (!img.hasAttribute('data-preview-enabled')) {
            img.style.cursor = 'zoom-in'; // Changer le curseur pour indiquer que l'image est cliquable
            
            img.addEventListener('click', function(event) {
                event.preventDefault(); // Empêcher tout comportement par défaut
                
                // Récupérer l'URL de l'image haute résolution
                const highResUrl = this.getAttribute('data-high-res') || this.src;
                
                // Ouvrir la prévisualisation
                openImagePreview(highResUrl, this.alt);
            });
            
            // Marquer cette image comme configurée
            img.setAttribute('data-preview-enabled', 'true');
        }
    });
}

/**
 * Ouvre la prévisualisation d'image
 * @param {string} imageUrl - URL de l'image à afficher
 * @param {string} altText - Texte alternatif pour l'image
 */
function openImagePreview(imageUrl, altText = 'Product preview') {
    const modal = document.getElementById('image-preview-modal');
    const previewImage = modal.querySelector('.preview-image');
    
    // Définir l'image source et le texte alternatif
    previewImage.src = imageUrl;
    previewImage.alt = altText;
    
    // Afficher la modal
    modal.style.display = 'flex';
    
    // Ajouter la classe d'animation
    setTimeout(() => {
        modal.classList.add('show-preview');
    }, 10);
}

/**
 * Ferme la prévisualisation d'image
 */
function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    
    // Retirer la classe d'animation
    modal.classList.remove('show-preview');
    
    // Cacher la modal après l'animation
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

/**
 * Vérifie si une URL est une image
 * @param {string} url - URL à vérifier
 * @returns {boolean} True si l'URL semble être une image
 */
export function isImageUrl(url) {
    if (!url) return false;
    
    // Vérifier l'extension de fichier
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowercaseUrl = url.toLowerCase();
    
    return extensions.some(ext => lowercaseUrl.endsWith(ext));
}