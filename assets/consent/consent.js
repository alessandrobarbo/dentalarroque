/*!
 * cc-consent v1.0.0 — gestor de consentimiento de cookies sin dependencias.
 * Parte de la skill "spanish-legal-compliance". Criterios: LSSI art. 22.2 + Guía AEPD (2023).
 *
 * Uso mínimo:
 *   <script>window.CookieConsentConfig = { version:'1', policyUrl:'/politica-cookies.html',
 *     categories:[{ id:'analiticas', label:'Analíticas', description:'...', cookies:['_ga','_ga_*'] }] };</script>
 *   <link rel="stylesheet" href="/consent/consent.css">
 *   <script src="/consent/consent.js" defer></script>
 *
 * Bloqueo previo:
 *   <script type="text/plain" data-cc-category="analiticas" data-cc-src="https://..."></script>
 *   <script type="text/plain" data-cc-category="analiticas"> ...código inline... </script>
 *   <iframe data-cc-category="externos" data-cc-src="https://..." title="..."></iframe>
 *   <div data-cc-placeholder="externos">... <button data-cc-accept-category="externos">Cargar</button></div>
 * Reabrir preferencias: cualquier elemento con [data-cc-open].
 */
(function () {
  'use strict';
  if (window.CookieConsent) return;

  var DEFAULTS = {
    storageKey: 'cc_consent',
    version: '1',
    maxAgeDays: 365,           // la Guía AEPD orienta a renovar periódicamente (máx. orientativo 24 meses: comprobar)
    policyUrl: '/politica-cookies.html',
    reloadOnRevoke: true,
    categories: [],
    texts: {
      bannerLabel: 'Aviso de cookies',
      title: 'Cookies en este sitio',
      body: 'Usamos cookies propias necesarias para que el sitio funcione y, solo si lo aceptas, cookies de terceros para las finalidades que puedes ver en «Configurar». Puedes aceptarlas, rechazarlas o elegir por finalidad, y cambiar tu decisión cuando quieras.',
      accept: 'Aceptar todas',
      reject: 'Rechazar todas',
      configure: 'Configurar',
      save: 'Guardar preferencias',
      close: 'Cerrar',
      prefsTitle: 'Preferencias de cookies',
      prefsIntro: 'Elige qué cookies no necesarias permites. Ninguna está activada por defecto.',
      necessaryLabel: 'Necesarias',
      necessaryDesc: 'Imprescindibles para el funcionamiento del sitio y para recordar tu elección. No requieren consentimiento.',
      alwaysOn: 'Siempre activas',
      policy: 'Política de cookies'
    }
  };

  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') o[k] = merge(a[k], b[k]);
      else o[k] = b[k];
    }
    return o;
  }

  var cfg = merge(DEFAULTS, window.CookieConsentConfig || {});
  var state = null;
  var listeners = [];
  var bannerEl = null, modalEl = null, lastFocus = null;

  /* ---------- almacenamiento de la elección (técnica, exenta) ---------- */
  function read() {
    try {
      var r = JSON.parse(localStorage.getItem(cfg.storageKey));
      if (!r || r.version !== cfg.version) return null;
      if (Date.now() - r.ts > cfg.maxAgeDays * 864e5) return null;
      return r;
    } catch (e) { return null; }
  }
  function write(cats) {
    var prev = state;
    state = { version: cfg.version, ts: Date.now(), categories: cats };
    try { localStorage.setItem(cfg.storageKey, JSON.stringify(state)); } catch (e) { /* modo privado: la elección vale para esta página */ }
    var revoked = prev && prev.categories && Object.keys(prev.categories).some(function (id) { return prev.categories[id] && !cats[id]; });
    if (revoked) { deleteCookies(prev.categories, cats); }
    if (!(revoked && cfg.reloadOnRevoke)) activate();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
    document.dispatchEvent(new CustomEvent('cc:change', { detail: state }));
    if (revoked && cfg.reloadOnRevoke) location.reload();
  }
  function has(id) { return !!(state && state.categories && state.categories[id]); }

  /* ---------- borrado de cookies al retirar el consentimiento ---------- */
  function deleteCookies(before, after) {
    var names = [];
    cfg.categories.forEach(function (c) { if (before[c.id] && !after[c.id] && c.cookies) names = names.concat(c.cookies); });
    if (!names.length) return;
    var existing = document.cookie.split(';').map(function (s) { return s.split('=')[0].trim(); }).filter(Boolean);
    var host = location.hostname.split('.'), domains = [''];
    for (var i = 0; i < host.length - 1; i++) domains.push('.' + host.slice(i).join('.'));
    existing.forEach(function (n) {
      var match = names.some(function (p) { return p.slice(-1) === '*' ? n.indexOf(p.slice(0, -1)) === 0 : n === p; });
      if (!match) return;
      domains.forEach(function (d) {
        document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  /* ---------- activación de lo bloqueado ---------- */
  function activate() {
    document.querySelectorAll('script[type="text/plain"][data-cc-category]').forEach(function (s) {
      if (s.getAttribute('data-cc-done') || !has(s.getAttribute('data-cc-category'))) return;
      var n = document.createElement('script');
      for (var i = 0; i < s.attributes.length; i++) {
        var a = s.attributes[i];
        if (a.name === 'type' || a.name.indexOf('data-cc-') === 0) continue;
        n.setAttribute(a.name, a.value);
      }
      var src = s.getAttribute('data-cc-src');
      if (src) n.src = src; else n.text = s.text;
      s.setAttribute('data-cc-done', '1');
      s.parentNode.insertBefore(n, s.nextSibling);
    });
    document.querySelectorAll('[data-cc-category][data-cc-src]:not(script)').forEach(function (el) {
      if (has(el.getAttribute('data-cc-category')) && !el.getAttribute('src')) {
        el.setAttribute('src', el.getAttribute('data-cc-src'));
        el.hidden = false;
      }
    });
    document.querySelectorAll('[data-cc-placeholder]').forEach(function (p) {
      p.hidden = has(p.getAttribute('data-cc-placeholder'));
    });
  }

  /* ---------- UI ---------- */
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function all(v) { var o = {}; cfg.categories.forEach(function (c) { o[c.id] = v; }); return o; }

  function showBanner() {
    if (bannerEl) return;
    var t = cfg.texts;
    bannerEl = el('section', { 'class': 'cc-banner', 'aria-label': t.bannerLabel, 'aria-describedby': 'cc-banner-body' },
      '<h2 class="cc-title">' + esc(t.title) + '</h2>' +
      '<p class="cc-body" id="cc-banner-body">' + esc(t.body) + ' <a href="' + esc(cfg.policyUrl) + '">' + esc(t.policy) + '</a>.</p>' +
      '<div class="cc-actions">' +
      '<button type="button" class="cc-btn" data-cc-act="reject">' + esc(t.reject) + '</button>' +
      '<button type="button" class="cc-btn" data-cc-act="configure">' + esc(t.configure) + '</button>' +
      '<button type="button" class="cc-btn" data-cc-act="accept">' + esc(t.accept) + '</button>' +
      '</div>');
    bannerEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cc-act]'); if (!b) return;
      var act = b.getAttribute('data-cc-act');
      if (act === 'accept') { write(all(true)); hideBanner(); }
      else if (act === 'reject') { write(all(false)); hideBanner(); }
      else openPrefs();
    });
    document.body.insertBefore(bannerEl, document.body.firstChild);
  }
  function hideBanner() { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }

  function openPrefs() {
    if (modalEl) return;
    var t = cfg.texts;
    lastFocus = document.activeElement;
    var rows = '<li class="cc-cat"><div class="cc-cat-head"><span class="cc-cat-label">' + esc(t.necessaryLabel) + '</span>' +
      '<span class="cc-always">' + esc(t.alwaysOn) + '</span></div><p>' + esc(t.necessaryDesc) + '</p></li>';
    cfg.categories.forEach(function (c) {
      var id = 'cc-cat-' + c.id;
      rows += '<li class="cc-cat"><div class="cc-cat-head"><label class="cc-switch" for="' + id + '">' +
        '<input type="checkbox" id="' + id + '" data-cc-cat="' + esc(c.id) + '"' + (has(c.id) ? ' checked' : '') + '>' +
        '<span class="cc-cat-label">' + esc(c.label) + '</span></label></div>' +
        '<p>' + esc(c.description || '') + '</p></li>';
    });
    modalEl = el('div', { 'class': 'cc-overlay' },
      '<div class="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-prefs-title" tabindex="-1">' +
      '<button type="button" class="cc-close" data-cc-act="close" aria-label="' + esc(t.close) + '">×</button>' +
      '<h2 class="cc-title" id="cc-prefs-title">' + esc(t.prefsTitle) + '</h2>' +
      '<p class="cc-body">' + esc(t.prefsIntro) + ' <a href="' + esc(cfg.policyUrl) + '">' + esc(t.policy) + '</a>.</p>' +
      '<ul class="cc-cats">' + rows + '</ul>' +
      '<div class="cc-actions">' +
      '<button type="button" class="cc-btn" data-cc-act="reject">' + esc(t.reject) + '</button>' +
      '<button type="button" class="cc-btn" data-cc-act="save">' + esc(t.save) + '</button>' +
      '<button type="button" class="cc-btn" data-cc-act="accept">' + esc(t.accept) + '</button>' +
      '</div></div>');
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) { closePrefs(); return; }
      var b = e.target.closest('[data-cc-act]'); if (!b) return;
      var act = b.getAttribute('data-cc-act');
      if (act === 'close') return closePrefs();
      if (act === 'accept') write(all(true));
      else if (act === 'reject') write(all(false));
      else if (act === 'save') {
        var c = {};
        modalEl.querySelectorAll('[data-cc-cat]').forEach(function (i) { c[i.getAttribute('data-cc-cat')] = i.checked; });
        write(c);
      }
      hideBanner(); closePrefs();
    });
    modalEl.addEventListener('keydown', trap);
    document.body.appendChild(modalEl);
    modalEl.querySelector('.cc-modal').focus();
  }
  function closePrefs() {
    if (!modalEl) return;
    modalEl.remove(); modalEl = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    else if (bannerEl) bannerEl.querySelector('button').focus();
  }
  function trap(e) {
    if (e.key === 'Escape') { e.preventDefault(); closePrefs(); return; }
    if (e.key !== 'Tab') return;
    var f = modalEl.querySelectorAll('button, input, a[href]');
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- API pública ---------- */
  window.CookieConsent = {
    open: openPrefs,
    get: function () { return state; },
    has: has,
    reset: function () { try { localStorage.removeItem(cfg.storageKey); } catch (e) {} state = null; showBanner(); },
    onChange: function (fn) { listeners.push(fn); },
    acceptCategory: function (id) { var c = state ? Object.assign({}, state.categories) : all(false); c[id] = true; write(c); hideBanner(); }
  };

  function init() {
    if (!cfg.categories.length) {
      // Sin tecnologías no exentas no debe mostrarse banner (Guía AEPD): nada que hacer.
      if (window.console) console.info('[cc-consent] Sin categorías configuradas: no se muestra banner.');
      return;
    }
    state = read();
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-cc-open]');
      if (o) { e.preventDefault(); openPrefs(); return; }
      var a = e.target.closest('[data-cc-accept-category]');
      if (a) { e.preventDefault(); window.CookieConsent.acceptCategory(a.getAttribute('data-cc-accept-category')); }
    });
    if (state) activate(); else { activate(); showBanner(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
