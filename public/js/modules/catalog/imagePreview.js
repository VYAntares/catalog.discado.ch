//public/js/modules/catalog/imagePreview.js

export function initImagePreview() {
    createImagePreviewModal();
    setupImagePreviews();
    
    document.addEventListener('productsLoaded', setupImagePreviews);
}

function createImagePreviewModal() {
    if (document.getElementById('image-preview-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'image-preview-modal';
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <div class="image-preview-content">
            <span class="close-preview">&times;</span>
            <img class="preview-image" src="" alt="Product preview">
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const previewImage = modal.querySelector('.preview-image');
    const closeButton = modal.querySelector('.close-preview');
    
    closeButton.addEventListener('click', closeImagePreview);
    
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeImagePreview();
        }
    });
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeImagePreview();
        }
    });
}

function setupImagePreviews() {
    const productImages = document.querySelectorAll('.product-img');
    
    productImages.forEach(img => {
        if (!img.hasAttribute('data-preview-enabled')) {
            img.style.cursor = 'zoom-in';
            
            img.addEventListener('click', function(event) {
                event.preventDefault();
                
                const highResUrl = this.getAttribute('data-high-res') || this.src;
                openImagePreview(highResUrl, this.alt);
            });
            
            img.setAttribute('data-preview-enabled', 'true');
        }
    });
}

function openImagePreview(imageUrl, altText = 'Product preview') {
    const modal = document.getElementById('image-preview-modal');
    const previewImage = modal.querySelector('.preview-image');
    
    previewImage.src = imageUrl;
    previewImage.alt = altText;
    
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.classList.add('show-preview');
    }, 10);
}

function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    
    modal.classList.remove('show-preview');
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

export function isImageUrl(url) {
    if (!url) return false;
    
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowercaseUrl = url.toLowerCase();
    
    return extensions.some(ext => lowercaseUrl.endsWith(ext));
}