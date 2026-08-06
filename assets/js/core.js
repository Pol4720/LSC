/* =========================================================================
   LSC · Core utilities: DOM, i18n, theme, storage, formatting, events
   No dependencies. ES modules. Works in browser and (mostly) in Node tests.
   ========================================================================= */

/* ---------------------------------------------------------------- DOM ---- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Hyperscript-ish element factory.
 * el('div.card#x', {onclick, dataset:{}, html:'', attrs:{}}, ...children)
 */
export function el(spec, props = null, ...children) {
  const m = /^([a-zA-Z0-9-]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/.exec(spec);
  if (!m) throw new Error(`el(): bad spec "${spec}"`);
  const node = document.createElement(m[1] || 'div');
  if (m[2]) node.id = m[2].slice(1);
  if (m[3]) node.className = m[3].slice(1).split('.').join(' ');

  if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k in node && k !== 'list' && typeof v !== 'object') { try { node[k] = v; } catch { node.setAttribute(k, v); } }
      else node.setAttribute(k, v === true ? '' : v);
    }
  } else if (props !== null && props !== undefined) {
    children.unshift(props);
  }
  appendAll(node, children);
  return node;
}

function appendAll(node, kids) {
  for (const c of kids.flat(4)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const frag = (...children) => { const f = document.createDocumentFragment(); appendAll(f, children); return f; };
export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

/** Inline SVG icon from a 24x24 path set. */
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrowRight: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  arrowLeft: '<path d="M19 12H5M11 19l-7-7 7-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 13l5-5 5 5M4 3h16"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  car: '<path d="M5 17h14M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  gavel: '<path d="m14 3 7 7M17.5 6.5 11 13M3 21h9M6.5 17.5 13 11M9 8l7 7"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A3.7 3.7 0 0 0 7 19z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="m11 11 9-9M18 4l2 2M15 7l2 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9.5A1.6 1.6 0 0 0 10.5 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  whatsapp: '<path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.2-4.3A8.5 8.5 0 1 1 20.5 12z"/><path d="M8.8 8.4c.3-.6.6-.5.9-.5h.7c.2 0 .5 0 .7.5l.7 1.6c.1.3 0 .5-.1.7l-.4.5c-.1.2-.3.3-.1.6.5.9 1.4 1.7 2.4 2.2.3.1.5.1.6-.1l.5-.6c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5 0 .5-.3 1.4-1.4 1.6-1 .2-2.5 0-4.4-1.4a8.5 8.5 0 0 1-2.9-3.6c-.4-1.1-.2-2 0-2.3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  calc: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.3 8.3A17 17 0 0 0 2 13s3.6 7 10 7a9.7 9.7 0 0 0 4.3-1M3 3l18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  sparkles: '<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h3"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 1 5.3 5.3l-9 9a2.8 2.8 0 0 1-4-4l9-9z"/><path d="m14.7 6.3-3.4-3.4a4 4 0 0 0-5.3 5.3l3.4 3.4"/>',
};

export function icon(name, cls = 'ico') {
  const p = ICONS[name] || ICONS.info;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', cls);
  svg.innerHTML = p;
  return svg;
}
export const iconMarkup = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="ico">${ICONS[name] || ICONS.info}</svg>`;

/* -------------------------------------------------------------- utils ---- */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function debounce(fn, ms = 250) {
  let t;
  const wrapped = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  wrapped.cancel = () => clearTimeout(t);
  wrapped.flush = (...a) => { clearTimeout(t); fn(...a); };
  return wrapped;
}

export function throttle(fn, ms = 100) {
  let last = 0, timer = null, lastArgs;
  return (...a) => {
    lastArgs = a;
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...a); }
    else if (!timer) {
      timer = setTimeout(() => { timer = null; last = Date.now(); fn(...lastArgs); }, ms - (now - last));
    }
  };
}

const B32 = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Crockford-ish, no ambiguous chars
export function randomCode(len = 6) {
  const bytes = new Uint8Array(len);
  (globalThis.crypto || {}).getRandomValues?.(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += B32[bytes[i] % B32.length];
  return out;
}

export function uid(prefix = '') {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return `${prefix}${stamp}-${randomCode(6)}`;
}

const pad2 = (n) => String(n).padStart(2, '0');

export function deepGet(obj, path) {
  if (!path) return undefined;
  return String(path).split('.')
    .reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

export function deepSet(obj, path, value) {
  const keys = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return obj;
}

export const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

/** Normalize text for search: lowercase, strip diacritics. */
export const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Lightweight subsequence-based fuzzy match with a relevance score. */
export function fuzzyScore(needle, haystack) {
  const n = norm(needle), h = norm(haystack);
  if (!n) return 1;
  if (!h) return 0;
  const idx = h.indexOf(n);
  if (idx === 0) return 1;
  if (idx > 0) return 0.85 - Math.min(0.3, idx / 200);
  let hi = 0, hits = 0, streak = 0, best = 0;
  for (let i = 0; i < n.length; i++) {
    const found = h.indexOf(n[i], hi);
    if (found === -1) { streak = 0; continue; }
    if (found === hi) { streak++; best = Math.max(best, streak); } else streak = 1;
    hi = found + 1; hits++;
  }
  if (hits < n.length) return 0;
  return 0.4 + 0.25 * (best / n.length);
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------------------------------------------------- formatting --- */
export function fmtMoney(n, { currency = 'USD', lang = 'es', compact = false, decimals = 0 } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-US', {
      style: 'currency', currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard',
    }).format(v);
  } catch {
    return `$${v.toFixed(decimals)}`;
  }
}

export function fmtNumber(n, lang = 'es') {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  try { return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-US').format(v); }
  catch { return String(v); }
}

export function fmtDate(iso, lang = 'es', opts = { dateStyle: 'medium' }) {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try { return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-ES', opts).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}

export function fmtRelative(iso, lang = 'es') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = (d.getTime() - Date.now()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800],
                 ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  try {
    const rtf = new Intl.RelativeTimeFormat(lang === 'en' ? 'en' : 'es', { numeric: 'auto' });
    for (const [unit, secs] of units) {
      if (Math.abs(diff) >= secs || unit === 'second') return rtf.format(Math.round(diff / secs), unit);
    }
  } catch { /* fall through */ }
  return fmtDate(iso, lang);
}

/* ---------------------------------------------------------------- i18n --- */
export const UI = {
  es: {
    'app.name': 'La Subasta Cubana',
    'app.tool': 'Centro de Asesoría',
    'nav.form': 'Formulario',
    'nav.console': 'Consola',
    'nav.calculator': 'Calculadora',
    'common.next': 'Continuar',
    'common.back': 'Atrás',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.close': 'Cerrar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.search': 'Buscar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.copy': 'Copiar',
    'common.copied': 'Copiado al portapapeles',
    'common.download': 'Descargar',
    'common.print': 'Imprimir',
    'common.confirm': 'Confirmar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.optional': 'opcional',
    'common.required': 'obligatorio',
    'common.of': 'de',
    'common.step': 'Paso',
    'common.all': 'Todos',
    'common.none': 'Ninguno',
    'common.loading': 'Cargando…',
    'common.retry': 'Reintentar',
    'common.apply': 'Aplicar',
    'common.clear': 'Limpiar',
    'common.add': 'Añadir',
    'common.remove': 'Quitar',
    'common.select': 'Seleccionar…',
    'common.other': 'Otro',
    'common.notSpecified': 'Sin especificar',
    'common.unlock': 'Desbloquear',
    'theme.toggle': 'Cambiar tema',
    'theme.light': 'Claro',
    'theme.dark': 'Oscuro',
    'lang.toggle': 'Idioma',
    'err.required': 'Este campo es obligatorio',
    'err.email': 'Escribe un correo válido',
    'err.phone': 'Escribe un teléfono válido (incluye el código de país)',
    'err.number': 'Escribe un número válido',
    'err.min': 'El valor mínimo es {min}',
    'err.max': 'El valor máximo es {max}',
    'err.minLen': 'Escribe al menos {min} caracteres',
    'err.maxLen': 'Máximo {max} caracteres',
    'err.url': 'Escribe un enlace válido (https://…)',
    'err.pattern': 'El formato no es válido',
    'err.minSelect': 'Selecciona al menos {min} opción(es)',
    'err.maxSelect': 'Selecciona como máximo {max} opción(es)',
    'err.year': 'Escribe un año válido',
    'err.fixFields': 'Revisa los campos marcados para continuar',
  },
  en: {
    'app.name': 'La Subasta Cubana',
    'app.tool': 'Advisory Center',
    'nav.form': 'Form',
    'nav.console': 'Console',
    'nav.calculator': 'Calculator',
    'common.next': 'Continue',
    'common.back': 'Back',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.copy': 'Copy',
    'common.copied': 'Copied to clipboard',
    'common.download': 'Download',
    'common.print': 'Print',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.optional': 'optional',
    'common.required': 'required',
    'common.of': 'of',
    'common.step': 'Step',
    'common.all': 'All',
    'common.none': 'None',
    'common.loading': 'Loading…',
    'common.retry': 'Retry',
    'common.apply': 'Apply',
    'common.clear': 'Clear',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.select': 'Select…',
    'common.other': 'Other',
    'common.notSpecified': 'Not specified',
    'common.unlock': 'Unlock',
    'theme.toggle': 'Toggle theme',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'lang.toggle': 'Language',
    'err.required': 'This field is required',
    'err.email': 'Enter a valid email address',
    'err.phone': 'Enter a valid phone number (include country code)',
    'err.number': 'Enter a valid number',
    'err.min': 'Minimum value is {min}',
    'err.max': 'Maximum value is {max}',
    'err.minLen': 'Enter at least {min} characters',
    'err.maxLen': 'At most {max} characters',
    'err.url': 'Enter a valid link (https://…)',
    'err.pattern': 'Invalid format',
    'err.minSelect': 'Select at least {min} option(s)',
    'err.maxSelect': 'Select at most {max} option(s)',
    'err.year': 'Enter a valid year',
    'err.fixFields': 'Please review the highlighted fields',
  },
};

const LANG_KEY = 'lsc.lang';
const THEME_KEY = 'lsc.theme';

export const I18n = {
  lang: 'es',
  dicts: UI,
  listeners: new Set(),

  init() {
    let saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch { /* private mode */ }
    const url = new URLSearchParams(globalThis.location?.search || '').get('lang');
    const nav = (globalThis.navigator?.language || 'es').slice(0, 2);
    this.lang = ['es', 'en'].includes(url) ? url
      : ['es', 'en'].includes(saved) ? saved
      : nav === 'en' ? 'en' : 'es';
    this.apply();
    return this.lang;
  },

  set(lang) {
    if (!['es', 'en'].includes(lang) || lang === this.lang) return;
    this.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    this.apply();
    this.listeners.forEach((fn) => fn(lang));
  },

  toggle() { this.set(this.lang === 'es' ? 'en' : 'es'); },

  apply() {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.lang;
      document.documentElement.dataset.lang = this.lang;
    }
  },

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

  /** Translate a UI key with {placeholder} interpolation. */
  t(key, vars) {
    const d = this.dicts[this.lang] || this.dicts.es;
    let s = d[key] ?? this.dicts.es[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  },

  /** Resolve an inline {es, en} label object (or plain string). */
  L(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'function') return v(this.lang);
    return v[this.lang] ?? v.es ?? v.en ?? '';
  },
};

export const t = (k, v) => I18n.t(k, v);
export const L = (v) => I18n.L(v);

/* --------------------------------------------------------------- theme --- */
export const Theme = {
  mode: 'auto', // 'light' | 'dark' | 'auto'
  listeners: new Set(),

  init() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
    this.mode = ['light', 'dark', 'auto'].includes(saved) ? saved : 'auto';
    this.apply();
    globalThis.matchMedia?.('(prefers-color-scheme: dark)')
      ?.addEventListener?.('change', () => { if (this.mode === 'auto') this.apply(); });
    return this.mode;
  },

  effective() {
    if (this.mode !== 'auto') return this.mode;
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  },

  set(mode) {
    this.mode = mode;
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
    this.apply();
    this.listeners.forEach((fn) => fn(this.effective()));
  },

  toggle() { this.set(this.effective() === 'dark' ? 'light' : 'dark'); },

  apply() {
    if (typeof document === 'undefined') return;
    const eff = this.effective();
    document.documentElement.dataset.theme = eff;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', eff === 'dark' ? '#070c16' : '#f5f7fb');
  },

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};

/* ------------------------------------------------------------- storage --- */
/** Namespaced, JSON-safe localStorage wrapper that degrades to memory. */
export function createStore(ns) {
  const mem = new Map();
  const key = (k) => `lsc.${ns}.${k}`;
  const ok = (() => {
    try { localStorage.setItem('lsc.probe', '1'); localStorage.removeItem('lsc.probe'); return true; }
    catch { return false; }
  })();
  return {
    available: ok,
    get(k, def = null) {
      try {
        const raw = ok ? localStorage.getItem(key(k)) : mem.get(key(k));
        return raw === null || raw === undefined ? def : JSON.parse(raw);
      } catch { return def; }
    },
    set(k, v) {
      const raw = JSON.stringify(v);
      try { ok ? localStorage.setItem(key(k), raw) : mem.set(key(k), raw); return true; }
      catch { mem.set(key(k), raw); return false; }
    },
    remove(k) { try { ok ? localStorage.removeItem(key(k)) : mem.delete(key(k)); } catch { /* ignore */ } },
    keys() {
      const p = `lsc.${ns}.`;
      try {
        const src = ok ? Object.keys(localStorage) : Array.from(mem.keys());
        return src.filter((x) => x.startsWith(p)).map((x) => x.slice(p.length));
      } catch { return []; }
    },
    clear() { this.keys().forEach((k) => this.remove(k)); },
  };
}

/* --------------------------------------------------------------- toast --- */
let toastHost = null;
export function toast(message, kind = 'info', ms = 3800) {
  if (typeof document === 'undefined') return;
  if (!toastHost) {
    toastHost = $('.toasts') || el('div.toasts', { role: 'status', 'aria-live': 'polite' });
    if (!toastHost.isConnected) document.body.append(toastHost);
  }
  const node = el(`div.toast.toast-${kind}`, el('div.grow', message));
  toastHost.append(node);
  const kill = () => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 240);
  };
  node.addEventListener('click', kill);
  setTimeout(kill, ms);
  return node;
}

/* --------------------------------------------------------------- modal --- */
export function modal({ title, body, actions = [], size = '', dismissable = true, onClose } = {}) {
  const backdrop = el('div.modal-backdrop', { role: 'dialog', 'aria-modal': 'true' });
  const box = el(`div.modal${size === 'lg' ? '.modal-lg' : ''}`);
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = prevOverflow;
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) { e.preventDefault(); close(); }
    if (e.key === 'Tab') trapFocus(e, box);
  };

  if (title) {
    box.append(el('div.modal-head',
      el('h3', { text: title }),
      dismissable ? el('button.btn.btn-ghost.btn-icon.btn-sm',
        { onclick: close, 'aria-label': I18n.t('common.close') }, icon('x')) : null,
    ));
  }
  const bodyNode = el('div.modal-body');
  if (typeof body === 'string') bodyNode.innerHTML = body;
  else if (body) bodyNode.append(body);
  box.append(bodyNode);

  if (actions.length) {
    box.append(el('div.modal-foot', ...actions.map((a) =>
      el(`button.btn${a.variant ? '.btn-' + a.variant : ''}`, {
        text: a.label,
        onclick: async () => { const r = await a.onClick?.(close); if (r !== false && a.closeAfter !== false) close(); },
      }))));
  }

  backdrop.append(box);
  if (dismissable) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  setTimeout(() => (box.querySelector('input, textarea, select, button') || box).focus?.(), 40);
  return { close, box, body: bodyNode };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function trapFocus(e, container) {
  const items = $$(FOCUSABLE, container).filter((n) => n.offsetParent !== null || n === document.activeElement);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function confirmDialog({ title, message, confirmLabel, cancelLabel, danger = false }) {
  return new Promise((resolve) => {
    modal({
      title,
      body: el('p', { text: message }),
      dismissable: true,
      onClose: () => resolve(false),
      actions: [
        { label: cancelLabel || I18n.t('common.cancel'), variant: 'ghost', onClick: () => resolve(false) },
        { label: confirmLabel || I18n.t('common.confirm'), variant: danger ? 'danger' : 'primary', onClick: () => resolve(true) },
      ],
    });
  });
}

/* ---------------------------------------------------------- clipboard --- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = el('textarea', { value: text, style: { position: 'fixed', opacity: '0', top: '0' } });
      document.body.append(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function downloadBlob(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 400);
}

/* ------------------------------------------------------------ toolbar --- */
/** Standard theme + language switcher, wired to Theme/I18n. */
export function buildToolbar({ onLang, onTheme } = {}) {
  const langBtn = el('button.toolbar-btn', {
    type: 'button', 'aria-label': I18n.t('lang.toggle'), title: I18n.t('lang.toggle'),
    onclick: () => { I18n.toggle(); onLang?.(I18n.lang); },
  }, icon('globe'), el('span', { text: I18n.lang === 'es' ? 'ES' : 'EN' }));

  const themeBtn = el('button.toolbar-btn', {
    type: 'button', 'aria-label': I18n.t('theme.toggle'), title: I18n.t('theme.toggle'),
    onclick: () => { Theme.toggle(); onTheme?.(Theme.effective()); },
  });
  const paintTheme = () => {
    clear(themeBtn);
    const dark = Theme.effective() === 'dark';
    themeBtn.append(icon(dark ? 'moon' : 'sun'),
      el('span.sr-only', { text: I18n.t('theme.toggle') }));
  };
  paintTheme();
  Theme.onChange(paintTheme);
  I18n.onChange(() => {
    langBtn.querySelector('span').textContent = I18n.lang === 'es' ? 'ES' : 'EN';
    langBtn.title = I18n.t('lang.toggle');
    themeBtn.title = I18n.t('theme.toggle');
  });
  return { langBtn, themeBtn, node: el('div.row.gap-2', langBtn, themeBtn) };
}
