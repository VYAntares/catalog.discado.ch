/**
 * i18n.js — Moteur de traduction Discado
 * Charge un fichier JSON local selon la langue mémorisée en localStorage.
 * Expose window.t(key) pour les chaînes générées en JS.
 */
(function () {
  const SUPPORTED = ['en', 'fr', 'de', 'it'];
  const DEFAULT   = 'en';

  const stored = localStorage.getItem('discado_lang');
  const currentLang = SUPPORTED.includes(stored) ? stored : DEFAULT;

  // ── Chargement synchrone du fichier de traduction ──
  let translations = {};
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/i18n/' + currentLang + '.json', false); // synchrone
    xhr.send();
    if (xhr.status === 200) {
      translations = JSON.parse(xhr.responseText);
    }
  } catch (e) {
    console.warn('[i18n] Failed to load', currentLang, e);
  }

  // ── Fallback anglais si la langue courante est incomplète ──
  let fallback = {};
  if (currentLang !== DEFAULT) {
    try {
      const xhr2 = new XMLHttpRequest();
      xhr2.open('GET', '/i18n/' + DEFAULT + '.json', false);
      xhr2.send();
      if (xhr2.status === 200) fallback = JSON.parse(xhr2.responseText);
    } catch (_) {}
  }

  /**
   * Résout une clé pointée (ex: "home.intro") dans l'objet de traductions.
   */
  function resolve(obj, key) {
    const parts = key.split('.');
    let val = obj;
    for (const p of parts) {
      if (val == null || typeof val !== 'object') return undefined;
      val = val[p];
    }
    return typeof val === 'string' ? val : undefined;
  }

  /**
   * t(key) — retourne la traduction ou la clé en fallback.
   */
  function t(key) {
    return resolve(translations, key) ?? resolve(fallback, key) ?? key;
  }

  /**
   * Applique les attributs data-i18n* sur tous les éléments du DOM.
   * Peut être rappelé après injection dynamique de HTML.
   */
  function applyAll(root) {
    const scope = root || document;

    // Contenu texte
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t(el.dataset.i18n);
      if (v !== el.dataset.i18n) el.textContent = v;
    });

    // Placeholder des inputs
    scope.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });

    // HTML (contenu riche)
    scope.querySelectorAll('[data-i18n-html]').forEach(el => {
      const v = t(el.dataset.i18nHtml);
      if (v !== el.dataset.i18nHtml) el.innerHTML = v;
    });

    // aria-label
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });

    // title
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
  }

  // ── Application automatique au chargement ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyAll());
  } else {
    applyAll();
  }

  /**
   * Change la langue et recharge la page.
   */
  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem('discado_lang', lang);
    location.reload();
  }

  function getLang() { return currentLang; }

  // ── API publique ──
  window.i18n = { t, setLang, getLang, applyAll, SUPPORTED, currentLang };
  window.t = t; // raccourci global
})();
