/**
 * Modal de création d'un fournisseur
 * admin/js/modules/suppliers/createSupplierModal.js
 */

import * as API from '../../core/api.js';
import * as State from './state.js';
import * as SuppliersList from './suppliersList.js';

/**
 * Initialise les event listeners du modal
 */
export function init() {
  const openBtn = document.getElementById('addSupplierBtn');
  const closeBtn = document.getElementById('closeCreateSupplierModal');
  const cancelBtn = document.getElementById('cancelCreateSupplierBtn');
  const submitBtn = document.getElementById('submitCreateSupplierBtn');

  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (submitBtn) submitBtn.addEventListener('click', handleSubmit);

  // Boutons "+" pour ajouter des champs dynamiques
  document.querySelectorAll('.btn-add-field').forEach(btn => {
    btn.addEventListener('click', () => addDynamicField(btn.dataset.target));
  });

  initImageUploader();
}

function initImageUploader() {
  const selectBtn = document.getElementById('supplierImageSelectBtn');
  const removeBtn = document.getElementById('supplierImageRemoveBtn');
  const input = document.getElementById('supplierImageInput');

  if (selectBtn && input) {
    selectBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', handleImageSelect);
  }
  if (removeBtn) {
    removeBtn.addEventListener('click', resetImage);
  }
}

async function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const selectBtn = document.getElementById('supplierImageSelectBtn');
  const originalLabel = selectBtn.innerHTML;
  selectBtn.disabled = true;
  selectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upload...';

  try {
    const result = await API.uploadSupplierImage(file);
    document.getElementById('supplierFormImageUrl').value = result.imagePath;
    updateImagePreview(result.imagePath);
  } catch (error) {
    console.error('Erreur upload image:', error);
    alert('Erreur lors de l\'upload de l\'image.');
  } finally {
    selectBtn.disabled = false;
    selectBtn.innerHTML = originalLabel;
    event.target.value = '';
  }
}

function updateImagePreview(imageUrl) {
  const preview = document.getElementById('supplierImagePreview');
  const removeBtn = document.getElementById('supplierImageRemoveBtn');
  if (imageUrl) {
    preview.innerHTML = `<img src="${imageUrl}" alt="Aperçu">`;
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  } else {
    preview.innerHTML = '<i class="fas fa-image"></i><span>Aucune image</span>';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function resetImage() {
  document.getElementById('supplierFormImageUrl').value = '';
  updateImagePreview(null);
}

/**
 * Ouvre le modal
 */
export function open() {
  const modal = document.getElementById('createSupplierModal');
  resetForm();
  modal.style.display = 'flex';
}

/**
 * Ferme le modal
 */
export function close() {
  const modal = document.getElementById('createSupplierModal');
  modal.style.display = 'none';
}

/**
 * Réinitialise le formulaire
 */
function resetForm() {
  document.getElementById('supplierFormName').value = '';
  document.getElementById('supplierFormNotes').value = '';
  resetImage();

  // Reset des champs dynamiques (garder seulement le premier vide)
  ['supplierEmailsContainer', 'supplierWechatsContainer', 'supplierPhonesContainer'].forEach(containerId => {
    const container = document.getElementById(containerId);
    const rows = container.querySelectorAll('.dynamic-field-row');
    // Supprimer toutes les lignes sauf la première
    rows.forEach((row, i) => {
      if (i === 0) {
        row.querySelector('input').value = '';
      } else {
        row.remove();
      }
    });
  });
}

/**
 * Ajoute un champ dynamique (email, wechat, phone)
 */
function addDynamicField(target) {
  const containerMap = {
    emails: { id: 'supplierEmailsContainer', type: 'email', placeholder: 'email@exemple.com', className: 'supplier-email-input' },
    wechats: { id: 'supplierWechatsContainer', type: 'text', placeholder: 'ID WeChat', className: 'supplier-wechat-input' },
    phones: { id: 'supplierPhonesContainer', type: 'tel', placeholder: '+XX XXX XXX XXXX', className: 'supplier-phone-input' }
  };

  const config = containerMap[target];
  if (!config) return;

  const container = document.getElementById(config.id);
  const row = document.createElement('div');
  row.className = 'dynamic-field-row';
  row.innerHTML = `
    <input type="${config.type}" placeholder="${config.placeholder}" class="${config.className}">
    <button type="button" class="btn-remove-field"><i class="fas fa-minus"></i></button>
  `;

  row.querySelector('.btn-remove-field').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

/**
 * Collecte les valeurs d'un conteneur de champs dynamiques
 */
function collectDynamicValues(className) {
  const inputs = document.querySelectorAll(`.${className}`);
  const values = [];
  inputs.forEach(input => {
    const val = input.value.trim();
    if (val) values.push(val);
  });
  return values;
}

/**
 * Gère la soumission du formulaire
 */
async function handleSubmit() {
  const name = document.getElementById('supplierFormName').value.trim();
  const notes = document.getElementById('supplierFormNotes').value.trim();

  if (!name) {
    alert('Le nom du fournisseur est obligatoire.');
    return;
  }

  const emails = collectDynamicValues('supplier-email-input');
  const wechats = collectDynamicValues('supplier-wechat-input');
  const phones = collectDynamicValues('supplier-phone-input');
  const image_url = document.getElementById('supplierFormImageUrl').value || null;

  const submitBtn = document.getElementById('submitCreateSupplierBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';

  try {
    const result = await API.createSupplier({
      name,
      emails,
      wechats,
      phones,
      notes,
      image_url
    });

    console.log('✅ Fournisseur créé:', result);

    close();

    // Recharger la liste des fournisseurs
    const suppliers = await API.fetchSuppliers();
    State.setSuppliers(suppliers);
    SuppliersList.render();

    alert(`Fournisseur "${name}" créé avec succès !`);
  } catch (error) {
    console.error('❌ Erreur création fournisseur:', error);
    if (error.message && error.message.includes('existe déjà')) {
      alert('Un fournisseur avec ce nom existe déjà.');
    } else {
      alert('Erreur lors de la création du fournisseur.');
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Créer le fournisseur';
  }
}
