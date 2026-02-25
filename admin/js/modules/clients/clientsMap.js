/**
 * Carte interactive des magasins clients suisses
 * admin/js/modules/clients/clientsMap.js
 */

// ===== ÉTAT =====
let map = null;
let markers = [];       // { id, marker, location }
let tempMarker = null;  // marqueur temporaire avant confirmation
let clientsCache = [];  // liste des profils clients chargés au démarrage

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await Promise.all([loadClients(), loadLocations()]);
    bindSearchBar();
});

/**
 * Initialise la carte Leaflet centrée sur la Suisse
 */
function initMap() {
    map = L.map('map').setView([46.8182, 8.2275], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Clic sur la carte → ajout manuel
    map.on('click', (e) => {
        openAddPopup(e.latlng.lat, e.latlng.lng);
    });
}

// ===== CHARGEMENT DES CLIENTS =====

/**
 * Charge la liste des profils clients pour le dropdown
 */
async function loadClients() {
    try {
        const res = await fetch('/api/admin/client-profiles', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        clientsCache = await res.json();
    } catch (err) {
        console.error('Erreur chargement profils clients:', err);
        clientsCache = [];
    }
}

// ===== CHARGEMENT DES POINTS =====

/**
 * Charge tous les points depuis l'API et place les marqueurs
 */
async function loadLocations() {
    try {
        const res = await fetch('/api/client-locations', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const locations = await res.json();
        locations.forEach(addPermanentMarker);
    } catch (err) {
        console.error('Erreur chargement localisations:', err);
        showError('Impossible de charger les points de la carte.');
    }
}

// ===== MARQUEURS PERMANENTS =====

/**
 * Ajoute un marqueur permanent pour une localisation
 */
function addPermanentMarker(location) {
    const marker = L.marker([location.latitude, location.longitude]).addTo(map);
    marker.bindPopup(buildViewPopupHTML(location), { maxWidth: 300 });

    marker.on('popupopen', () => {
        attachViewPopupListeners(marker, location);
    });

    markers.push({ id: location.id, marker, location });
}

/**
 * Retire un marqueur de la carte
 */
function removePermanentMarker(id) {
    const idx = markers.findIndex(m => m.id === id);
    if (idx !== -1) {
        markers[idx].marker.remove();
        markers.splice(idx, 1);
    }
}

/**
 * Construit le HTML de la popup d'un point existant
 */
function buildViewPopupHTML(loc) {
    const hasClient = !!loc.client_id;

    // Infos client enrichies
    let clientBlock = '';
    if (hasClient) {
        const fullName = [loc.first_name, loc.last_name].filter(Boolean).join(' ') || '';
        const shop     = loc.shop_name   || '';
        const addr     = [loc.shop_address, loc.shop_zip_code, loc.shop_city].filter(Boolean).join(', ');
        const email    = loc.email || '';
        const phone    = loc.phone || '';

        clientBlock = `
            <div class="map-popup-client">
                ${shop    ? `<div class="map-popup-row"><i class="fas fa-store"></i> <strong>${escapeHtml(shop)}</strong></div>` : ''}
                ${fullName? `<div class="map-popup-row"><i class="fas fa-user"></i> ${escapeHtml(fullName)}</div>` : ''}
                ${addr    ? `<div class="map-popup-row"><i class="fas fa-map-pin"></i> ${escapeHtml(addr)}</div>` : ''}
                ${email   ? `<div class="map-popup-row"><i class="fas fa-envelope"></i> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>` : ''}
                ${phone   ? `<div class="map-popup-row"><i class="fas fa-phone"></i> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></div>` : ''}
            </div>`;
    }

    return `
        <div class="map-popup">
            <h3>${escapeHtml(loc.label)}</h3>
            ${clientBlock}
            <textarea class="map-popup-notes" id="popup-notes-${loc.id}" rows="3" placeholder="Notes...">${escapeHtml(loc.notes || '')}</textarea>
            <div class="map-popup-actions">
                <button class="btn-map-save" data-id="${loc.id}"><i class="fas fa-save"></i> Sauvegarder</button>
                <button class="btn-map-delete" data-id="${loc.id}"><i class="fas fa-trash"></i> Supprimer</button>
            </div>
            ${hasClient ? `
            <div class="map-popup-link">
                <a href="/admin/clients?client=${encodeURIComponent(loc.client_id)}" class="btn-map-view-client">
                    <i class="fas fa-external-link-alt"></i> Voir fiche client
                </a>
            </div>` : ''}
        </div>`;
}

/**
 * Attache les listeners sur la popup d'affichage
 */
function attachViewPopupListeners(marker, location) {
    const saveBtn   = document.querySelector(`.btn-map-save[data-id="${location.id}"]`);
    const deleteBtn = document.querySelector(`.btn-map-delete[data-id="${location.id}"]`);

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const notes = document.getElementById(`popup-notes-${location.id}`)?.value || '';
            await updateLocation(location.id, location.label, location.latitude, location.longitude, notes, marker, location);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Supprimer le point "${location.label}" ?`)) return;
            await deleteLocation(location.id);
        });
    }
}

// ===== POPUP D'AJOUT =====

/**
 * Ouvre la popup de création d'un nouveau point (clic carte ou recherche adresse)
 */
function openAddPopup(lat, lng) {
    clearTempMarker();

    tempMarker = L.marker([lat, lng], { opacity: 0.7 }).addTo(map);

    const selectOptions = clientsCache.map(c => {
        const display = [c.shopName, [c.firstName, c.lastName].filter(Boolean).join(' ')]
            .filter(Boolean).join(' — ') || c.clientId;
        return `<option value="${escapeHtml(c.clientId)}" data-shop="${escapeHtml(c.shopName || '')}" data-name="${escapeHtml([c.firstName, c.lastName].filter(Boolean).join(' '))}">${escapeHtml(display)}</option>`;
    }).join('');

    const popupContent = `
        <div class="map-confirm-popup">
            <p><i class="fas fa-map-pin"></i> Ajouter un point</p>
            <label class="map-form-label">Client (optionnel)</label>
            <select id="new-point-client">
                <option value="">— Nom libre (sans lien client) —</option>
                ${selectOptions}
            </select>
            <label class="map-form-label">Nom affiché *</label>
            <input type="text" id="new-point-label" placeholder="Nom du magasin..." maxlength="200">
            <label class="map-form-label">Notes</label>
            <textarea id="new-point-notes" rows="2" placeholder="Notes (optionnel)"></textarea>
            <button id="confirm-add-point"><i class="fas fa-plus"></i> Ajouter ce point</button>
        </div>`;

    tempMarker.bindPopup(popupContent, { maxWidth: 300 }).openPopup();

    tempMarker.on('popupopen', () => {
        const selectEl = document.getElementById('new-point-client');
        const labelEl  = document.getElementById('new-point-label');

        // Auto-remplir le label quand un client est sélectionné
        if (selectEl) {
            selectEl.addEventListener('change', () => {
                const opt = selectEl.options[selectEl.selectedIndex];
                const shop = opt.dataset.shop || '';
                const name = opt.dataset.name || '';
                if (selectEl.value && labelEl) {
                    labelEl.value = shop || name || '';
                } else if (labelEl && !labelEl.value) {
                    labelEl.value = '';
                }
            });
        }

        if (labelEl) labelEl.focus();

        const confirmBtn = document.getElementById('confirm-add-point');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const clientId = selectEl?.value || null;
                const label    = (labelEl?.value || '').trim();
                const notes    = document.getElementById('new-point-notes')?.value || '';

                if (!label) {
                    alert('Le nom affiché est obligatoire.');
                    return;
                }
                await createLocation(clientId || null, label, lat, lng, notes);
            });
        }
    });
}

/**
 * Supprime le marqueur temporaire
 */
function clearTempMarker() {
    if (tempMarker) {
        tempMarker.remove();
        tempMarker = null;
    }
}

// ===== RECHERCHE D'ADRESSE =====

function bindSearchBar() {
    const input = document.getElementById('addressSearch');
    const btn   = document.getElementById('searchBtn');

    if (btn)   btn.addEventListener('click', handleSearch);
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
}

async function handleSearch() {
    const input = document.getElementById('addressSearch');
    const query = input?.value.trim() || '';
    if (!query) return;

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ch&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'catalog.discado.ch' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const results = await res.json();

        if (!results || results.length === 0) {
            showError('Adresse introuvable. Essayez avec une ville ou un code postal.');
            return;
        }

        const place = results[0];
        map.setView([parseFloat(place.lat), parseFloat(place.lon)], 15);
        openAddPopup(parseFloat(place.lat), parseFloat(place.lon));
    } catch (err) {
        console.error('Erreur recherche Nominatim:', err);
        showError('Erreur lors de la recherche d\'adresse.');
    }
}

// ===== OPÉRATIONS API =====

async function createLocation(clientId, label, lat, lng, notes) {
    try {
        const res = await fetch('/api/client-locations', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, label, latitude: lat, longitude: lng, notes })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const raw = await res.json();

        // Enrichir avec les données client si disponibles
        const location = enrichWithClient(raw);

        clearTempMarker();
        addPermanentMarker(location);
    } catch (err) {
        console.error('Erreur création localisation:', err);
        showError('Impossible de sauvegarder le point : ' + err.message);
    }
}

async function updateLocation(id, label, lat, lng, notes, marker, oldLocation) {
    try {
        const res = await fetch(`/api/client-locations/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, latitude: lat, longitude: lng, notes })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const raw = await res.json();
        const updated = { ...oldLocation, ...enrichWithClient(raw) };

        // Mettre à jour le popup et l'état local
        marker.setPopupContent(buildViewPopupHTML(updated));
        marker.on('popupopen', () => attachViewPopupListeners(marker, updated));

        const entry = markers.find(m => m.id === id);
        if (entry) entry.location = updated;

        marker.closePopup();
    } catch (err) {
        console.error('Erreur mise à jour localisation:', err);
        showError('Impossible de mettre à jour le point : ' + err.message);
    }
}

async function deleteLocation(id) {
    try {
        const res = await fetch(`/api/client-locations/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        removePermanentMarker(id);
    } catch (err) {
        console.error('Erreur suppression localisation:', err);
        showError('Impossible de supprimer le point : ' + err.message);
    }
}

// ===== UTILITAIRES =====

/**
 * Enrichit un objet location brut (POST/PUT) avec les données client du cache
 */
function enrichWithClient(raw) {
    if (!raw.client_id) return raw;
    const client = clientsCache.find(c => c.clientId === raw.client_id || c.username === raw.client_id);
    if (!client) return raw;
    return {
        ...raw,
        first_name:    client.firstName  || '',
        last_name:     client.lastName   || '',
        shop_name:     client.shopName   || '',
        shop_address:  client.shopAddress || '',
        shop_city:     client.shopCity   || '',
        shop_zip_code: client.shopZipCode || '',
        email:         client.email      || '',
        phone:         client.phone      || ''
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showError(message) {
    const existing = document.querySelector('.map-error-msg');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'map-error-msg';
    el.textContent = message;
    document.querySelector('.map-wrapper')?.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}
