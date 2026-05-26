// cartApi.js — panier côté serveur (remplace localStorage)

const BASE = '/api/cart';

export async function getCart() {
    const res = await fetch(BASE, { credentials: 'same-origin' });
    if (!res.ok) return [];
    return await res.json();
}

export async function addCartItem(product, quantity) {
    const res = await fetch(`${BASE}/items`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            product_id:    product.id    || null,
            product_name:  product.Nom,
            product_price: parseFloat(product.prix),
            quantity:      parseInt(quantity) || 1,
            category:      product.categorie  || null,
            image_url:     product.imageUrl   || null,
            size:          product.size        || null
        })
    });
    if (!res.ok) throw new Error('Erreur ajout panier');
    return await res.json();
}

export async function updateCartItem(cartItemId, quantity) {
    if (quantity <= 0) return removeCartItem(cartItemId);
    const res = await fetch(`${BASE}/items/${cartItemId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
    });
    if (!res.ok) throw new Error('Erreur mise à jour quantité');
    return await res.json();
}

export async function removeCartItem(cartItemId) {
    const res = await fetch(`${BASE}/items/${cartItemId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Erreur suppression article');
    return await res.json();
}

export async function clearCartItems() {
    const res = await fetch(BASE, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Erreur vidage panier');
    return await res.json();
}

export async function getCartItemCount() {
    const cart = await getCart();
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// Migration one-shot : si localStorage a un panier, le pousser sur le serveur
export async function migrateLocalStorageCart() {
    const CART_KEY = 'discado_cart';
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    try {
        const items = JSON.parse(raw);
        if (!Array.isArray(items) || items.length === 0) {
            localStorage.removeItem(CART_KEY);
            return;
        }
        await Promise.all(items.map(item => addCartItem(item, item.quantity)));
        localStorage.removeItem(CART_KEY);
        console.log(`✅ Panier migré depuis localStorage (${items.length} articles)`);
    } catch (e) {
        console.warn('Migration localStorage panier échouée :', e.message);
    }
}
