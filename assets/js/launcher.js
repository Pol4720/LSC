/* =========================================================================
   LSC · Platform launcher
   ---------------------------------------------------------------------------
   A floating button that opens every site the advisor works with, grouped and
   searchable, with per-client deep links when a client is open.

   Keyboard: "P" opens it from anywhere, "/" focuses the filter, Esc closes,
   arrow keys walk the list, Enter opens. Everything stays inside the panel
   while it is open, so it never steals focus from the page underneath.
   ========================================================================= */

import { el, clear, icon, I18n, L, t, norm, fuzzyScore, copyText, toast } from './core.js';
import { PLATFORMS, PLATFORM_GROUPS, contextualUrl } from './platforms.js';
import { CONFIG } from './config.js';

let host = null;
let panel = null;
let fab = null;
let open = false;
let context = {};          // { vin, query, clientName }
let filter = '';

/**
 * Mount the launcher once. Safe to call repeatedly — it replaces itself.
 * @param {HTMLElement} mount
 */
export function mountLauncher(mount = document.body) {
  unmountLauncher();

  fab = el('button.launcher-fab', {
    type: 'button',
    'aria-expanded': 'false',
    'aria-haspopup': 'dialog',
    'aria-label': label(),
    title: `${label()} · P`,
    onclick: () => toggle(),
  }, icon('gavel'), el('span.launcher-fab-text', { text: I18n.lang === 'en' ? 'Platforms' : 'Plataformas' }));

  host = el('div.launcher', fab);
  mount.append(host);
  document.addEventListener('keydown', onGlobalKey);
  return host;
}

export function unmountLauncher() {
  document.removeEventListener('keydown', onGlobalKey);
  host?.remove();
  host = null; panel = null; fab = null; open = false;
}

/**
 * Tell the launcher which client is on screen so it can build deep links.
 * @param {{vin?:string, query?:string, clientName?:string}} ctx
 */
export function setLauncherContext(ctx = {}) {
  context = ctx || {};
  if (open) paintList();
}

const label = () => (I18n.lang === 'en' ? 'Platforms' : 'Plataformas');

function onGlobalKey(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')
    || document.activeElement?.isContentEditable;

  if (e.key === 'Escape' && open) { e.preventDefault(); toggle(false); return; }
  if (typing) return;
  if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    toggle();
  }
}

export function toggle(next = !open) {
  open = next;
  fab.setAttribute('aria-expanded', String(open));
  if (!open) {
    panel?.remove();
    panel = null;
    document.removeEventListener('click', onOutside, true);
    fab.focus();
    return;
  }
  buildPanel();
  document.addEventListener('click', onOutside, true);
}

function onOutside(e) {
  if (!panel) return;
  if (host.contains(e.target)) return;
  toggle(false);
}

function buildPanel() {
  const en = I18n.lang === 'en';
  filter = '';

  const search = el('input.input.launcher-search', {
    type: 'search',
    placeholder: en ? 'Filter platforms…' : 'Filtrar plataformas…',
    'aria-label': en ? 'Filter platforms' : 'Filtrar plataformas',
    oninput: (e) => { filter = e.target.value; paintList(); },
    onkeydown: (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'Enter') return;
      e.preventDefault();
      panel.querySelector('.launcher-item')?.focus();
    },
  });

  const list = el('div.launcher-list', { id: 'launcher-list' });

  panel = el('div.launcher-panel', {
    role: 'dialog', 'aria-modal': 'false', 'aria-label': label(),
  },
    el('div.launcher-head',
      el('div.stack.gap-1',
        el('strong', { text: label() }),
        el('span.text-xs.text-subtle', {
          text: en ? `Everything ${CONFIG.brandName} works with` : `Todo lo que se usa en ${CONFIG.brandName}`,
        })),
      el('button.btn.btn-ghost.btn-icon.btn-sm', {
        type: 'button', 'aria-label': t('common.close'), onclick: () => toggle(false),
      }, icon('x'))),
    el('div.launcher-search-wrap', icon('search'), search),
    list,
    el('div.launcher-foot',
      el('span.text-xs.text-subtle', { text: en ? 'P opens · Esc closes' : 'P abre · Esc cierra' })),
  );

  host.append(panel);
  paintList();
  setTimeout(() => search.focus(), 40);
}

function paintList() {
  const list = panel?.querySelector('.launcher-list');
  if (!list) return;
  clear(list);

  const en = I18n.lang === 'en';
  const q = norm(filter.trim());
  const ctxLabel = context.vin || context.query;

  if (ctxLabel && !q) {
    list.append(el('div.launcher-context',
      icon('user'),
      el('span', {
        text: en
          ? `Links pre-filtered for ${context.clientName || ctxLabel}`
          : `Enlaces filtrados para ${context.clientName || ctxLabel}`,
      })));
  }

  let shown = 0;
  for (const group of PLATFORM_GROUPS) {
    const items = PLATFORMS
      .filter((p) => p.group === group.id)
      .filter((p) => !q || fuzzyScore(q, `${p.name} ${L(p.desc)}`) > 0.3);
    if (!items.length) continue;

    list.append(el('div.launcher-group', icon(group.icon), el('span', { text: L(group.label) })));
    for (const p of items) {
      list.append(launcherItem(p));
      shown++;
    }
  }

  if (!shown) {
    list.append(el('p.text-sm.text-subtle', {
      style: { padding: 'var(--sp-4)' },
      text: en ? 'No platform matches that.' : 'Ninguna plataforma coincide.',
    }));
  }
}

function launcherItem(p) {
  const href = contextualUrl(p, context);
  const deep = href !== p.url;

  const item = el('a.launcher-item', {
    href, target: '_blank', rel: 'noopener noreferrer',
    onkeydown: onItemKey,
  },
    el('span.launcher-mark', {
      style: { background: p.color, color: p.fg },
      'aria-hidden': 'true',
      text: p.mark,
    }),
    el('span.launcher-body',
      el('span.launcher-name',
        el('span', { text: p.name }),
        deep ? el('span.badge.badge-brand', {
          text: context.vin ? 'VIN' : (I18n.lang === 'en' ? 'search' : 'búsqueda'),
        }) : null),
      el('span.launcher-desc', { text: L(p.desc) })),
    el('span.launcher-go', icon('arrowRight')),
  );

  item.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const ok = await copyText(href);
    toast(ok ? t('common.copied') : 'Error', ok ? 'ok' : 'danger', 1600);
  });
  return item;
}

function onItemKey(e) {
  const items = Array.from(panel.querySelectorAll('.launcher-item'));
  const i = items.indexOf(e.currentTarget);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    (items[i + 1] || items[0]).focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (i === 0) panel.querySelector('.launcher-search').focus();
    else items[i - 1].focus();
  }
}

/** Inline list of platform links, used inside the client's "Target lots" tab. */
export function platformStrip(ctx = {}, groups = ['auctions', 'research', 'logistics']) {
  const row = el('div.row.gap-2.wrap');
  for (const p of PLATFORMS.filter((x) => groups.includes(x.group))) {
    row.append(el('a.platform-chip', {
      href: contextualUrl(p, ctx), target: '_blank', rel: 'noopener noreferrer',
      title: L(p.desc),
    },
      el('span.platform-chip-mark', { style: { background: p.color, color: p.fg }, text: p.mark, 'aria-hidden': 'true' }),
      el('span', { text: p.name })));
  }
  return row;
}

export const _internals = { paintList, get isOpen() { return open; } };
