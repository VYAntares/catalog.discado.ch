/**
 * Carte interactive des magasins clients suisses
 * admin/js/modules/clients/clientsMap.js
 */

import { viewClientDetails } from './clientView.js';
import { initModals } from '../../utils/modal.js';

// ===== ÉTAT =====
let map = null;
let markers = [];       // { id, marker, location }
let tempMarker = null;  // marqueur temporaire avant confirmation
let clientsCache = [];  // liste des profils clients chargés au démarrage
let selectedYear = new Date().getFullYear(); // année filtrée pour les commandes

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    initModals();
    await Promise.all([loadClients(), loadLocations()]);
    bindSearchBar();
    bindPopulateBtn();
    bindYearSelector();

    // Ré-ouvrir la fiche client si on revient depuis les factures (param ?openClient=)
    const urlParams = new URLSearchParams(window.location.search);
    const openClientId = urlParams.get('openClient');
    if (openClientId) {
        viewClientDetails(openClientId, true);
        // Nettoyer l'URL sans recharger la page
        const cleanUrl = window.location.pathname;
        history.replaceState(null, '', cleanUrl);
    }
});

/**
 * Initialise la carte Leaflet centrée sur la Suisse
 */
function initMap() {
    map = L.map('map').setView([46.8182, 8.2275], 8);

    const tileLayers = {
        plan: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }),
        satellite: L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            subdomains: ['0', '1', '2', '3'],
            attribution: '© Google',
            maxZoom: 20
        }),
        hybride: L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            subdomains: ['0', '1', '2', '3'],
            attribution: '© Google',
            maxZoom: 20
        }),
        topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a>',
            maxZoom: 17
        })
    };

    let activeLayer = tileLayers.plan;
    activeLayer.addTo(map);

    addLayerControl(tileLayers, (newLayer) => {
        map.removeLayer(activeLayer);
        activeLayer = newLayer;
        map.addLayer(activeLayer);
    });

    // Clic sur la carte → ajout manuel
    map.on('click', (e) => {
        openAddPopup(e.latlng.lat, e.latlng.lng);
    });

    addLegend();
}

/**
 * Contrôle custom de sélection de fond de carte (toggle identique à la légende)
 */
function addLayerControl(tileLayers, switchLayer) {
    const ctrl = L.control({ position: 'topright' });
    ctrl.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-layerctrl');
        div.innerHTML = `
            <button class="layerctrl-toggle" title="Changer le fond de carte">
                <i class="fas fa-layer-group"></i>
            </button>
            <div class="layerctrl-content">
                <div class="layerctrl-title">Fond de carte</div>
                <label class="layerctrl-option"><input type="radio" name="maplayer" value="plan" checked> Plan</label>
                <label class="layerctrl-option"><input type="radio" name="maplayer" value="satellite"> Satellite</label>
                <label class="layerctrl-option"><input type="radio" name="maplayer" value="hybride"> Satellite + Routes</label>
                <label class="layerctrl-option"><input type="radio" name="maplayer" value="topo"> Topographique</label>
            </div>
        `;

        L.DomEvent.disableClickPropagation(div);

        div.querySelector('.layerctrl-toggle').addEventListener('click', () => {
            div.classList.toggle('layerctrl-open');
        });

        div.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                switchLayer(tileLayers[radio.value]);
                div.classList.remove('layerctrl-open');
            });
        });

        return div;
    };
    ctrl.addTo(map);
}

/**
 * Ajoute la légende des couleurs de marqueurs (collapsible)
 */
function addLegend() {
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-legend');
        const pin = (fill, stroke) => `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="14" height="21" style="flex-shrink:0">
                <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z"
                      fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
                <circle cx="12" cy="11" r="4" fill="rgba(255,255,255,0.45)"/>
            </svg>`;
        div.innerHTML = `
            <button class="legend-toggle" title="Légende des marqueurs">?</button>
            <div class="legend-content">
                <div class="legend-title">Commandes (année)</div>
                <div class="legend-item">${pin('#9ca3af','#6b7280')} Aucune commande</div>
                <div class="legend-item">${pin('#ffffff','#94a3b8')} Inactif cette année</div>
                <div class="legend-item">${pin('#fbbf24','#d97706')} 1–3 commandes</div>
                <div class="legend-item">${pin('#22c55e','#16a34a')} 4+ commandes</div>
            </div>
        `;

        L.DomEvent.disableClickPropagation(div);
        div.querySelector('.legend-toggle').addEventListener('click', () => {
            div.classList.toggle('legend-open');
        });

        return div;
    };
    legend.addTo(map);
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
        const res = await fetch(`/api/client-locations?year=${selectedYear}`, { credentials: 'include' });
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
 * Crée une icône SVG en forme de pin coloré (pointe vers le bas)
 */
function createPinIcon(fillColor, strokeColor) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z"
              fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <circle cx="12" cy="11" r="4" fill="rgba(255,255,255,0.45)"/>
    </svg>`;
    return L.divIcon({
        html: svg,
        className: '',
        iconSize: [24, 36],
        iconAnchor: [12, 36],
        popupAnchor: [0, -36]
    });
}

/**
 * Retourne les couleurs du pin selon le nombre de commandes du client
 */
function getMarkerStyle(location) {
    if (!location.client_id || (location.orders_total || 0) === 0) {
        return { fill: '#9ca3af', stroke: '#6b7280' };   // gris — aucune commande
    }
    const year = location.orders_year || 0;
    if (year === 0) {
        return { fill: '#ffffff', stroke: '#94a3b8' };   // blanc — inactif cette année
    }
    if (year <= 3) {
        return { fill: '#fbbf24', stroke: '#d97706' };   // jaune — 1-3 commandes
    }
    return { fill: '#22c55e', stroke: '#16a34a' };       // vert — 4+ commandes
}

/**
 * Ajoute un marqueur permanent pour une localisation
 */
function addPermanentMarker(location) {
    const style = getMarkerStyle(location);
    const icon  = createPinIcon(style.fill, style.stroke);
    const marker = L.marker([location.latitude, location.longitude], { icon }).addTo(map);

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
                ${addr    ? `<div class="map-popup-row"><i class="fas fa-map-pin"></i> <a href="https://maps.apple.com/?daddr=${loc.latitude},${loc.longitude}&dirflg=d" target="_blank" rel="noopener noreferrer">${escapeHtml(addr)}</a></div>` : ''}
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
                <button class="btn-map-view-client" data-client-id="${escapeHtml(loc.client_id)}">
                    <i class="fas fa-user"></i> Voir fiche client
                </button>
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

    const viewClientBtn = document.querySelector(`.btn-map-view-client[data-client-id="${location.client_id}"]`);
    if (viewClientBtn) {
        viewClientBtn.addEventListener('click', () => {
            viewClientDetails(location.client_id, true);
        });
    }
}

// ===== POPUP D'AJOUT =====

/**
 * Ouvre la popup de création d'un nouveau point (clic carte ou recherche adresse)
 */
function openAddPopup(lat, lng) {
    clearTempMarker();

    tempMarker = L.marker([lat, lng], {
        icon: createPinIcon('#9ca3af', '#6b7280'),
        opacity: 0.7
    }).addTo(map);

    // Construire le DOM
    const container = document.createElement('div');
    container.className = 'map-confirm-popup';

    // 1. Créer le HTML de base
    container.innerHTML = `
        <p><i class="fas fa-map-pin"></i> Ajouter un point</p>
        <label class="map-form-label">Client (optionnel)</label>
        <select class="js-client-select">
            <option value="">— Nom libre (sans lien client) —</option>
            ${clientsCache.map(c => {
                const display = [c.shopName, [c.firstName, c.lastName].filter(Boolean).join(' ')]
                    .filter(Boolean).join(' — ') || c.clientId;
                return `<option value="${escapeHtml(c.clientId)}" data-shop="${escapeHtml(c.shopName || '')}" data-name="${escapeHtml([c.firstName, c.lastName].filter(Boolean).join(' '))}">${escapeHtml(display)}</option>`;
            }).join('')}
        </select>
        <label class="map-form-label">Nom affiché *</label>
        <input type="text" class="js-label-input" placeholder="Nom du magasin..." maxlength="200">
        <label class="map-form-label">Notes</label>
        <textarea class="js-notes-input" rows="2" placeholder="Notes (optionnel)"></textarea>
        <button class="js-confirm-btn"><i class="fas fa-plus"></i> Ajouter ce point</button>`;

    // 2. APRÈS avoir inséré le HTML, récupérer les éléments
    const selectEl   = container.querySelector('.js-client-select');
    const labelEl    = container.querySelector('.js-label-input');
    const notesEl    = container.querySelector('.js-notes-input');
    const confirmBtn = container.querySelector('.js-confirm-btn');

    // 3. Attacher les listeners
    selectEl.addEventListener('change', () => {
        const opt  = selectEl.options[selectEl.selectedIndex];
        const shop = opt.dataset.shop || '';
        const name = opt.dataset.name || '';
        if (selectEl.value) {
            labelEl.value = shop || name || '';
        }
    });

    confirmBtn.addEventListener('click', async () => {
        const clientId = selectEl.value || null;
        const label    = labelEl.value.trim();
        const notes    = notesEl.value || '';

        if (!label) {
            alert('Le nom affiché est obligatoire.');
            return;
        }
        
        // Désactiver le bouton pendant le traitement
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout...';
        
        await createLocation(clientId, label, lat, lng, notes);
    });

    // 4. Ouvrir la popup APRÈS avoir attaché les listeners
    tempMarker.bindPopup(container, { maxWidth: 300 }).openPopup();
    
    // Focus après un court délai pour s'assurer que la popup est bien ouverte
    setTimeout(() => labelEl.focus(), 100);
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

// ===== AJOUT AUTOMATIQUE DE TOUS LES CLIENTS =====

/**
 * Connecte le bouton "Ajouter tous les clients" à la route de géocodage en masse
 */
function bindPopulateBtn() {
    const btn = document.getElementById('populateMapBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        if (!confirm('Géocoder et ajouter tous les clients avec adresse non encore sur la carte ?\n\nCela peut prendre plusieurs minutes selon le nombre de clients.')) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Géocodage en cours...';

        try {
            const res = await fetch('/api/admin/populate-client-map', {
                method: 'POST',
                credentials: 'include'
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            const data = await res.json();

            const msg = `Terminé !\n\n✅ Ajoutés : ${data.added}\n❌ Échecs : ${data.failed}\nTotal traités : ${data.total}`;
            alert(msg);

            if (data.added > 0) {
                // Recharger les marqueurs
                markers.forEach(m => m.marker.remove());
                markers.length = 0;
                await Promise.all([loadClients(), loadLocations()]);
            }
        } catch (err) {
            console.error('Erreur populate-map:', err);
            showError('Erreur : ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-map-marked-alt"></i> Ajouter tous les clients';
        }
    });
}

/**
 * Connecte le sélecteur d'année pour recharger les marqueurs avec les bons compteurs
 */
function bindYearSelector() {
    const sel = document.getElementById('yearSelector');
    if (!sel) return;
    sel.addEventListener('change', async () => {
        selectedYear = parseInt(sel.value, 10);
        markers.forEach(m => m.marker.remove());
        markers.length = 0;
        await loadLocations();
    });
}

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
